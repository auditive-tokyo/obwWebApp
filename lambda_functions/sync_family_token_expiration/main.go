package main

import (
	"context"
	"fmt"
	"log"
	"os"

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
		log.Fatalf("Failed to load AWS config: %v", err)
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

// findRepresentativeGuest finds the guest with sessionTokenHash for the given bookingId
func findRepresentativeGuest(ctx context.Context, bookingId string) (int64, error) {
	// Query by bookingId (GSI)
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
		return 0, fmt.Errorf("failed to query by bookingId: %w", err)
	}

	// Find the guest with sessionTokenHash
	for _, item := range result.Items {
		var guest struct {
			SessionTokenHash      string `dynamodbav:"sessionTokenHash"`
			SessionTokenExpiresAt int64  `dynamodbav:"sessionTokenExpiresAt"`
		}
		if err := attributevalue.UnmarshalMap(item, &guest); err != nil {
			continue
		}
		if guest.SessionTokenHash != "" && guest.SessionTokenExpiresAt > 0 {
			return guest.SessionTokenExpiresAt, nil
		}
	}

	return 0, fmt.Errorf("no representative guest found for bookingId: %s", bookingId)
}

// updateGuestTokenExpiration updates sessionTokenExpiresAt for the family member
func updateGuestTokenExpiration(ctx context.Context, roomNumber string, guestId string, expiresAt int64) error {
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

// HandleRequest processes DynamoDB Stream events
func HandleRequest(ctx context.Context, event events.DynamoDBEvent) error {
	for _, record := range event.Records {
		// Only process INSERT events
		if record.EventName != "INSERT" {
			continue
		}

		newImage := record.Change.NewImage
		if newImage == nil {
			continue
		}

		// Get approvalStatus from NewImage
		approvalStatus := getStringAttr(newImage["approvalStatus"])

		// Only process if approvalStatus is waitingForPassportImage
		// Skip if pendingVerification (new user creation)
		if approvalStatus != "waitingForPassportImage" {
			log.Printf("Skipping record: approvalStatus=%s (not waitingForPassportImage)", approvalStatus)
			continue
		}

		// Get roomNumber, guestId, bookingId
		roomNumber := getStringAttr(newImage["roomNumber"])
		guestId := getStringAttr(newImage["guestId"])
		bookingId := getStringAttr(newImage["bookingId"])

		if bookingId == "" || guestId == "" || roomNumber == "" {
			log.Printf("Missing bookingId, guestId, or roomNumber, skipping")
			continue
		}

		log.Printf("Processing family member: guestId=%s, roomNumber=%s, bookingId=%s", guestId, roomNumber, bookingId)

		// Find representative guest's sessionTokenExpiresAt
		expiresAt, err := findRepresentativeGuest(ctx, bookingId)
		if err != nil {
			log.Printf("Error finding representative guest: %v", err)
			// Return error to trigger Lambda retry
			return err
		}

		log.Printf("Found representative's expiresAt: %d", expiresAt)

		// Update family member's sessionTokenExpiresAt
		if err := updateGuestTokenExpiration(ctx, roomNumber, guestId, expiresAt); err != nil {
			log.Printf("Error updating sessionTokenExpiresAt: %v", err)
			// Return error to trigger Lambda retry
			return err
		}

		log.Printf("Successfully synced sessionTokenExpiresAt for guestId=%s", guestId)
	}

	return nil
}

func main() {
	lambda.Start(HandleRequest)
}
