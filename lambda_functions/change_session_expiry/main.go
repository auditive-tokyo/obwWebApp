package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"time"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"
	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/feature/dynamodb/attributevalue"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb/types"
)

var (
	dynamoClient *dynamodb.Client
	tableName    string
)

func init() {
	cfg, err := config.LoadDefaultConfig(context.TODO())
	if err != nil {
		log.Fatalf("failed to load AWS config: %v", err)
	}
	dynamoClient = dynamodb.NewFromConfig(cfg)
	tableName = os.Getenv("GUEST_TABLE_NAME")
	if tableName == "" {
		log.Fatal("GUEST_TABLE_NAME environment variable is required")
	}
}

// getStringAttr extracts a string value from DynamoDB attribute
func getStringAttr(attr events.DynamoDBAttributeValue) string {
	if attr.DataType() == events.DataTypeString {
		return attr.String()
	}
	return ""
}

// calculateSessionExpiry calculates Unix timestamp for checkout date at JST noon (UTC 03:00)
func calculateSessionExpiry(checkOutDate string) (int64, error) {
	// Parse YYYY-MM-DD format
	t, err := time.Parse("2006-01-02", checkOutDate)
	if err != nil {
		return 0, fmt.Errorf("invalid checkOutDate format: %w", err)
	}

	// Set to JST noon (12:00) = UTC 03:00
	t = time.Date(t.Year(), t.Month(), t.Day(), 3, 0, 0, 0, time.UTC)

	// Return Unix timestamp in seconds
	return t.Unix(), nil
}

// queryGuestsByBookingId retrieves all guests with the same bookingId
func queryGuestsByBookingId(ctx context.Context, bookingId string) ([]map[string]types.AttributeValue, error) {
	input := &dynamodb.QueryInput{
		TableName:              aws.String(tableName),
		IndexName:              aws.String("BookingIndex"),
		KeyConditionExpression: aws.String("bookingId = :bookingId"),
		ExpressionAttributeValues: map[string]types.AttributeValue{
			":bookingId": &types.AttributeValueMemberS{Value: bookingId},
		},
	}

	result, err := dynamoClient.Query(ctx, input)
	if err != nil {
		return nil, fmt.Errorf("failed to query by bookingId: %w", err)
	}

	return result.Items, nil
}

// updateSessionTokenExpiresAt updates sessionTokenExpiresAt for a guest
func updateSessionTokenExpiresAt(ctx context.Context, roomNumber, guestId string, expiresAt int64) error {
	input := &dynamodb.UpdateItemInput{
		TableName: aws.String(tableName),
		Key: map[string]types.AttributeValue{
			"roomNumber": &types.AttributeValueMemberS{Value: roomNumber},
			"guestId":    &types.AttributeValueMemberS{Value: guestId},
		},
		UpdateExpression: aws.String("SET sessionTokenExpiresAt = :expiresAt"),
		ExpressionAttributeValues: map[string]types.AttributeValue{
			":expiresAt": &types.AttributeValueMemberN{Value: fmt.Sprintf("%d", expiresAt)},
		},
	}

	_, err := dynamoClient.UpdateItem(ctx, input)
	if err != nil {
		return fmt.Errorf("failed to update sessionTokenExpiresAt: %w", err)
	}

	return nil
}

// shouldProcessRecord checks if the record should be processed
func shouldProcessRecord(record events.DynamoDBEventRecord) bool {
	if record.EventName != "MODIFY" {
		return false
	}
	return record.Change.NewImage != nil && record.Change.OldImage != nil
}

// extractCheckOutDateChange extracts checkout date change info from the record
// Returns newCheckOutDate, bookingId, and whether the change should be processed
func extractCheckOutDateChange(newImage, oldImage map[string]events.DynamoDBAttributeValue) (string, string, bool) {
	// Check if approvalStatus is "approved"
	approvalStatus := getStringAttr(newImage["approvalStatus"])
	if approvalStatus != "approved" {
		log.Printf("Skipping record: approvalStatus=%s (not approved)", approvalStatus)
		return "", "", false
	}

	// Get checkOutDate from both images
	oldCheckOutDate := getStringAttr(oldImage["checkOutDate"])
	newCheckOutDate := getStringAttr(newImage["checkOutDate"])

	// Skip if checkOutDate hasn't changed or is empty
	if oldCheckOutDate == newCheckOutDate {
		log.Printf("Skipping: checkOutDate unchanged (%s)", newCheckOutDate)
		return "", "", false
	}

	if newCheckOutDate == "" {
		log.Printf("Skipping: newCheckOutDate is empty")
		return "", "", false
	}

	// Get bookingId
	bookingId := getStringAttr(newImage["bookingId"])
	if bookingId == "" {
		log.Printf("Skipping: bookingId is empty")
		return "", "", false
	}

	log.Printf("🔄 Detected checkOutDate change: %s → %s for bookingId=%s",
		oldCheckOutDate, newCheckOutDate, bookingId)

	return newCheckOutDate, bookingId, true
}

// updateGuestsExpiry updates sessionTokenExpiresAt for all guests in a booking
func updateGuestsExpiry(ctx context.Context, guests []map[string]types.AttributeValue, expiresAt int64, bookingId string) {
	successCount := 0
	for _, item := range guests {
		var guest struct {
			RoomNumber string `dynamodbav:"roomNumber"`
			GuestID    string `dynamodbav:"guestId"`
		}

		if err := attributevalue.UnmarshalMap(item, &guest); err != nil {
			log.Printf("⚠️ Failed to unmarshal guest: %v", err)
			continue
		}

		if err := updateSessionTokenExpiresAt(ctx, guest.RoomNumber, guest.GuestID, expiresAt); err != nil {
			log.Printf("⚠️ Failed to update guest %s/%s: %v", guest.RoomNumber, guest.GuestID, err)
			continue
		}

		log.Printf("✅ Updated sessionTokenExpiresAt for guest %s/%s", guest.RoomNumber, guest.GuestID)
		successCount++
	}

	log.Printf("🎉 Successfully updated %d/%d guests for bookingId=%s", successCount, len(guests), bookingId)
}

// processRecord processes a single DynamoDB stream record
func processRecord(ctx context.Context, record events.DynamoDBEventRecord) error {
	if !shouldProcessRecord(record) {
		return nil
	}

	newCheckOutDate, bookingId, shouldProcess := extractCheckOutDateChange(
		record.Change.NewImage,
		record.Change.OldImage,
	)
	if !shouldProcess {
		return nil
	}

	// Calculate new sessionTokenExpiresAt (checkout date at JST noon)
	expiresAt, err := calculateSessionExpiry(newCheckOutDate)
	if err != nil {
		log.Printf("❌ Error calculating expiry: %v", err)
		return err
	}

	log.Printf("📅 New sessionTokenExpiresAt: %d (%s)", expiresAt, time.Unix(expiresAt, 0).UTC())

	// Query all guests with the same bookingId
	guests, err := queryGuestsByBookingId(ctx, bookingId)
	if err != nil {
		log.Printf("❌ Error querying guests by bookingId: %v", err)
		return err
	}

	log.Printf("📋 Found %d guests with bookingId=%s", len(guests), bookingId)

	// Update sessionTokenExpiresAt for all guests in the booking
	updateGuestsExpiry(ctx, guests, expiresAt, bookingId)

	return nil
}

// HandleRequest processes DynamoDB Stream events
func HandleRequest(ctx context.Context, event events.DynamoDBEvent) error {
	for _, record := range event.Records {
		if err := processRecord(ctx, record); err != nil {
			return err
		}
	}

	return nil
}

func main() {
	lambda.Start(HandleRequest)
}
