package main

import (
	"context"
	"crypto/sha256"
	"fmt"
	"os"
	"strconv"
	"time"

	"github.com/aws/aws-lambda-go/lambda"
	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb/types"
)

var (
	dynamoClient            *dynamodb.Client
	tableName               string
	provisionalSessionHours = 48 // 仮セッション時間
	propertyTZOffsetHours   = 9  // JST
)

type Event struct {
	Arguments struct {
		RoomNumber string `json:"roomNumber"`
		GuestID    string `json:"guestId"`
		Token      string `json:"token"`
	} `json:"arguments"`
}

type GuestInfo struct {
	GuestID   string  `json:"guestId"`
	BookingID *string `json:"bookingId,omitempty"`
}

type Response struct {
	Success bool       `json:"success"`
	Guest   *GuestInfo `json:"guest"`
}

func init() {
	cfg, err := config.LoadDefaultConfig(context.Background())
	if err != nil {
		panic(fmt.Sprintf("unable to load SDK config: %v", err))
	}
	dynamoClient = dynamodb.NewFromConfig(cfg)
	tableName = os.Getenv("TABLE_NAME")
}

// hashToken returns SHA256 hash of the token
func hashToken(token string) string {
	h := sha256.Sum256([]byte(token))
	return fmt.Sprintf("%x", h)
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

// nowISOmsZ returns current time in ISO8601 format with milliseconds and Z suffix
func nowISOmsZ() string {
	return time.Now().UTC().Format("2006-01-02T15:04:05.000Z")
}

func HandleRequest(ctx context.Context, event Event) (Response, error) {
	roomNumber := event.Arguments.RoomNumber
	guestID := event.Arguments.GuestID
	token := event.Arguments.Token

	if roomNumber == "" || guestID == "" || token == "" {
		return Response{Success: false, Guest: nil}, nil
	}

	tokenHash := hashToken(token)

	// Get item from DynamoDB
	getResp, err := dynamoClient.GetItem(ctx, &dynamodb.GetItemInput{
		TableName: &tableName,
		Key: map[string]types.AttributeValue{
			"roomNumber": &types.AttributeValueMemberS{Value: roomNumber},
			"guestId":    &types.AttributeValueMemberS{Value: guestID},
		},
	})
	if err != nil {
		return Response{Success: false, Guest: nil}, fmt.Errorf("failed to get item: %w", err)
	}

	if getResp.Item == nil {
		return Response{Success: false, Guest: nil}, nil
	}

	item := getResp.Item

	// Extract bookingId
	var bookingID *string
	if bid, ok := item["bookingId"].(*types.AttributeValueMemberS); ok && bid.Value != "" {
		bookingID = &bid.Value
	}

	// Verify token hash
	expectedHash := ""
	if hashAttr, ok := item["sessionTokenHash"].(*types.AttributeValueMemberS); ok {
		expectedHash = hashAttr.Value
	}
	if expectedHash == "" || expectedHash != tokenHash {
		return Response{Success: false, Guest: nil}, nil
	}

	// Get approval status
	status := ""
	if statusAttr, ok := item["approvalStatus"].(*types.AttributeValueMemberS); ok {
		status = statusAttr.Value
	}

	now := time.Now().Unix()

	// Determine new expiration time
	var newExpires int64
	checkOutDate := ""
	if checkOutAttr, ok := item["checkOutDate"].(*types.AttributeValueMemberS); ok {
		checkOutDate = checkOutAttr.Value
	}

	if checkOutDate != "" {
		var err error
		newExpires, err = checkoutNoonEpoch(checkOutDate, propertyTZOffsetHours, 12)
		if err != nil {
			// Fallback to provisional session
			newExpires = now + int64(provisionalSessionHours*3600)
		}
	} else {
		newExpires = now + int64(provisionalSessionHours*3600)
	}

	// Handle pendingVerification status (initial authentication)
	if status == "pendingVerification" {
		// First-time authentication: Remove TTL + transition status + set expiration
		_, err = dynamoClient.UpdateItem(ctx, &dynamodb.UpdateItemInput{
			TableName: &tableName,
			Key: map[string]types.AttributeValue{
				"roomNumber": &types.AttributeValueMemberS{Value: roomNumber},
				"guestId":    &types.AttributeValueMemberS{Value: guestID},
			},
			UpdateExpression: aws.String("SET approvalStatus = :w, sessionTokenExpiresAt = :exp, updatedAt = :u REMOVE pendingVerificationTtl"),
			ExpressionAttributeValues: map[string]types.AttributeValue{
				":w":   &types.AttributeValueMemberS{Value: "waitingForBasicInfo"},
				":exp": &types.AttributeValueMemberN{Value: strconv.FormatInt(newExpires, 10)},
				":u":   &types.AttributeValueMemberS{Value: nowISOmsZ()},
			},
		})
		if err != nil {
			return Response{Success: false, Guest: nil}, fmt.Errorf("failed to update item: %w", err)
		}

		return Response{
			Success: true,
			Guest: &GuestInfo{
				GuestID:   guestID,
				BookingID: bookingID,
			},
		}, nil
	}

	// Already authenticated (waitingForBasicInfo, etc.) - check expiration
	expiresVal := int64(0)
	if expiresAttr, ok := item["sessionTokenExpiresAt"].(*types.AttributeValueMemberN); ok {
		expiresVal, _ = strconv.ParseInt(expiresAttr.Value, 10, 64)
	}
	if expiresVal > 0 && now > expiresVal {
		return Response{Success: false, Guest: nil}, nil
	}

	return Response{
		Success: true,
		Guest: &GuestInfo{
			GuestID:   guestID,
			BookingID: bookingID,
		},
	}, nil
}

func main() {
	lambda.Start(HandleRequest)
}
