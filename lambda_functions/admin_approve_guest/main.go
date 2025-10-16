package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"strconv"
	"time"

	"github.com/aws/aws-lambda-go/lambda"
	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/feature/dynamodb/attributevalue"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb/types"
)

var (
	dynamoClient          *dynamodb.Client
	tableName             string
	propertyTZOffsetHours = 9 // JST
)

type Event struct {
	Arguments struct {
		RoomNumber string `json:"roomNumber"`
		GuestID    string `json:"guestId"`
	} `json:"arguments"`
}

type Response struct {
	GuestID        string `json:"guestId"`
	RoomNumber     string `json:"roomNumber"`
	ApprovalStatus string `json:"approvalStatus"`
}

type GuestItem struct {
	RoomNumber   string `dynamodbav:"roomNumber"`
	GuestID      string `dynamodbav:"guestId"`
	CheckOutDate string `dynamodbav:"checkOutDate"`
	BookingID    string `dynamodbav:"bookingId"`
}

func init() {
	cfg, err := config.LoadDefaultConfig(context.Background())
	if err != nil {
		panic(fmt.Sprintf("unable to load SDK config: %v", err))
	}
	dynamoClient = dynamodb.NewFromConfig(cfg)
	tableName = os.Getenv("TABLE_NAME")
}

// nowISOmsZ returns current time in ISO8601 format with milliseconds and Z suffix
func nowISOmsZ() string {
	return time.Now().UTC().Format("2006-01-02T15:04:05.000Z")
}

// checkoutNoonEpoch calculates Unix timestamp for checkout date at noon in specified timezone
func checkoutNoonEpoch(dateStr string, tzOffsetHours int, noonHour int) (int64, error) {
	// Parse date string "YYYY-MM-DD"
	t, err := time.Parse("2006-01-02", dateStr)
	if err != nil {
		return 0, fmt.Errorf("invalid date format: %w", err)
	}

	// Set time to noon in the specified timezone
	loc := time.FixedZone("Property", tzOffsetHours*3600)
	dt := time.Date(t.Year(), t.Month(), t.Day(), noonHour, 0, 0, 0, loc)
	return dt.Unix(), nil
}

func HandleRequest(ctx context.Context, event Event) (*Response, error) {
	roomNumber := event.Arguments.RoomNumber
	guestID := event.Arguments.GuestID

	if roomNumber == "" || guestID == "" {
		return nil, nil
	}

	// Get the target guest item
	getResp, err := dynamoClient.GetItem(ctx, &dynamodb.GetItemInput{
		TableName: &tableName,
		Key: map[string]types.AttributeValue{
			"roomNumber": &types.AttributeValueMemberS{Value: roomNumber},
			"guestId":    &types.AttributeValueMemberS{Value: guestID},
		},
	})
	if err != nil {
		return nil, fmt.Errorf("failed to get item: %w", err)
	}

	if getResp.Item == nil {
		return nil, nil
	}

	// Unmarshal item
	var item GuestItem
	if err := attributevalue.UnmarshalMap(getResp.Item, &item); err != nil {
		return nil, fmt.Errorf("failed to unmarshal item: %w", err)
	}

	// Calculate expiration time
	var expires int64
	if item.CheckOutDate != "" {
		expires, err = checkoutNoonEpoch(item.CheckOutDate, propertyTZOffsetHours, 12)
		if err != nil {
			// Fallback if date parsing fails
			expires = time.Now().Unix() + 48*3600
		}
	} else {
		expires = time.Now().Unix() + 48*3600 // 48 hours fallback
	}

	// Update the guest (approve + set expiration)
	_, err = dynamoClient.UpdateItem(ctx, &dynamodb.UpdateItemInput{
		TableName: &tableName,
		Key: map[string]types.AttributeValue{
			"roomNumber": &types.AttributeValueMemberS{Value: roomNumber},
			"guestId":    &types.AttributeValueMemberS{Value: guestID},
		},
		UpdateExpression: aws.String("SET approvalStatus = :approved, sessionTokenExpiresAt = :exp, updatedAt = :u"),
		ExpressionAttributeValues: map[string]types.AttributeValue{
			":approved": &types.AttributeValueMemberS{Value: "approved"},
			":exp":      &types.AttributeValueMemberN{Value: strconv.FormatInt(expires, 10)},
			":u":        &types.AttributeValueMemberS{Value: nowISOmsZ()},
		},
	})
	if err != nil {
		return nil, fmt.Errorf("failed to update item: %w", err)
	}

	// If bookingId is available, update all members of the booking
	if item.BookingID != "" {
		if err := updateBookingMembers(ctx, item.BookingID, roomNumber, guestID, expires); err != nil {
			log.Printf("Failed to update booking members: %v", err)
			// Don't fail the entire operation, just log the error
		}
	}

	return &Response{
		GuestID:        guestID,
		RoomNumber:     roomNumber,
		ApprovalStatus: "approved",
	}, nil
}

// updateBookingMembers updates sessionTokenExpiresAt for all members of a booking
func updateBookingMembers(ctx context.Context, bookingID, skipRoomNumber, skipGuestID string, expires int64) error {
	// Query BookingIndex to get all members
	queryResp, err := dynamoClient.Query(ctx, &dynamodb.QueryInput{
		TableName:              &tableName,
		IndexName:              aws.String("BookingIndex"),
		KeyConditionExpression: aws.String("bookingId = :bid"),
		ExpressionAttributeValues: map[string]types.AttributeValue{
			":bid": &types.AttributeValueMemberS{Value: bookingID},
		},
	})
	if err != nil {
		return fmt.Errorf("failed to query BookingIndex for bookingId=%s: %w", bookingID, err)
	}

	// Update each member
	for _, item := range queryResp.Items {
		var member GuestItem
		if err := attributevalue.UnmarshalMap(item, &member); err != nil {
			log.Printf("Failed to unmarshal member: %v", err)
			continue
		}

		// Skip if it's the same as the already-updated guest (optional)
		if member.RoomNumber == skipRoomNumber && member.GuestID == skipGuestID {
			continue
		}

		_, err := dynamoClient.UpdateItem(ctx, &dynamodb.UpdateItemInput{
			TableName: &tableName,
			Key: map[string]types.AttributeValue{
				"roomNumber": &types.AttributeValueMemberS{Value: member.RoomNumber},
				"guestId":    &types.AttributeValueMemberS{Value: member.GuestID},
			},
			UpdateExpression: aws.String("SET sessionTokenExpiresAt = :exp, updatedAt = :u"),
			ExpressionAttributeValues: map[string]types.AttributeValue{
				":exp": &types.AttributeValueMemberN{Value: strconv.FormatInt(expires, 10)},
				":u":   &types.AttributeValueMemberS{Value: nowISOmsZ()},
			},
		})
		if err != nil {
			log.Printf("Failed to update member %s/%s: %v", member.RoomNumber, member.GuestID, err)
			// Continue with other members
		}
	}

	return nil
}

func main() {
	lambda.Start(HandleRequest)
}
