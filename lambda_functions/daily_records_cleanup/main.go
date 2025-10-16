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
	dynamoClient         *dynamodb.Client
	tableName            string
	expiredCheckStatuses = []string{"waitingForBasicInfo", "waitingForPassportImage", "pending"}
)

type GuestKey struct {
	RoomNumber string
	GuestID    string
}

type GuestItem struct {
	RoomNumber     string `dynamodbav:"roomNumber"`
	GuestID        string `dynamodbav:"guestId"`
	BookingID      string `dynamodbav:"bookingId"`
	ApprovalStatus string `dynamodbav:"approvalStatus"`
}

type Response struct {
	RejectedRecords      int   `json:"rejectedRecords"`
	ExpiredNonApproved   int   `json:"expiredNonApproved"`
	BookingGroupsTouched int   `json:"bookingGroupsTouched"`
	DeletedRecords       int   `json:"deletedRecords"`
	Timestamp            int64 `json:"timestamp"`
}

func init() {
	cfg, err := config.LoadDefaultConfig(context.Background())
	if err != nil {
		panic(fmt.Sprintf("unable to load SDK config: %v", err))
	}
	dynamoClient = dynamodb.NewFromConfig(cfg)
	tableName = os.Getenv("TABLE_NAME")
}

// fetchRejectedAll fetches all records with "rejected" status (no expiration check)
func fetchRejectedAll(ctx context.Context) ([]GuestItem, error) {
	var items []GuestItem
	var lastKey map[string]types.AttributeValue

	for {
		input := &dynamodb.QueryInput{
			TableName:              &tableName,
			IndexName:              aws.String("ApprovalStatusExpiresIndex"),
			KeyConditionExpression: aws.String("approvalStatus = :status"),
			ExpressionAttributeValues: map[string]types.AttributeValue{
				":status": &types.AttributeValueMemberS{Value: "rejected"},
			},
		}
		if lastKey != nil {
			input.ExclusiveStartKey = lastKey
		}

		resp, err := dynamoClient.Query(ctx, input)
		if err != nil {
			return nil, fmt.Errorf("failed to query rejected items: %w", err)
		}

		var pageItems []GuestItem
		if err := attributevalue.UnmarshalListOfMaps(resp.Items, &pageItems); err != nil {
			return nil, fmt.Errorf("failed to unmarshal items: %w", err)
		}
		items = append(items, pageItems...)

		lastKey = resp.LastEvaluatedKey
		if lastKey == nil {
			break
		}
	}

	return items, nil
}

// fetchExpiredNonApproved fetches all expired records with non-approved statuses
func fetchExpiredNonApproved(ctx context.Context, nowTS int64) ([]GuestItem, error) {
	var items []GuestItem

	for _, status := range expiredCheckStatuses {
		var lastKey map[string]types.AttributeValue

		for {
			input := &dynamodb.QueryInput{
				TableName:              &tableName,
				IndexName:              aws.String("ApprovalStatusExpiresIndex"),
				KeyConditionExpression: aws.String("approvalStatus = :status AND sessionTokenExpiresAt <= :now"),
				ExpressionAttributeValues: map[string]types.AttributeValue{
					":status": &types.AttributeValueMemberS{Value: status},
					":now":    &types.AttributeValueMemberN{Value: strconv.FormatInt(nowTS, 10)},
				},
			}
			if lastKey != nil {
				input.ExclusiveStartKey = lastKey
			}

			resp, err := dynamoClient.Query(ctx, input)
			if err != nil {
				return nil, fmt.Errorf("failed to query expired items for status %s: %w", status, err)
			}

			var pageItems []GuestItem
			if err := attributevalue.UnmarshalListOfMaps(resp.Items, &pageItems); err != nil {
				return nil, fmt.Errorf("failed to unmarshal items: %w", err)
			}
			items = append(items, pageItems...)

			lastKey = resp.LastEvaluatedKey
			if lastKey == nil {
				break
			}
		}
	}

	return items, nil
}

// collectRejectedKeys collects keys from rejected items (no bookingId expansion)
func collectRejectedKeys(rejectedItems []GuestItem) map[GuestKey]bool {
	keys := make(map[GuestKey]bool)
	for _, item := range rejectedItems {
		if item.RoomNumber != "" && item.GuestID != "" {
			keys[GuestKey{RoomNumber: item.RoomNumber, GuestID: item.GuestID}] = true
		}
	}
	return keys
}

// collectKeysToDelete collects keys to delete and expands bookingId groups
func collectKeysToDelete(ctx context.Context, expiredItems []GuestItem) (map[GuestKey]bool, int, error) {
	keys := make(map[GuestKey]bool)
	bookingIDs := make(map[string]bool)

	// Collect initial keys and bookingIds
	for _, item := range expiredItems {
		// Skip approved guests - they should never be deleted
		if item.ApprovalStatus == "approved" {
			continue
		}
		if item.RoomNumber != "" && item.GuestID != "" {
			keys[GuestKey{RoomNumber: item.RoomNumber, GuestID: item.GuestID}] = true
		}
		if item.BookingID != "" {
			bookingIDs[item.BookingID] = true
		}
	}

	// Expand bookingId groups
	for bookingID := range bookingIDs {
		var lastKey map[string]types.AttributeValue

		for {
			input := &dynamodb.QueryInput{
				TableName:              &tableName,
				IndexName:              aws.String("BookingIndex"),
				KeyConditionExpression: aws.String("bookingId = :bid"),
				ExpressionAttributeValues: map[string]types.AttributeValue{
					":bid": &types.AttributeValueMemberS{Value: bookingID},
				},
			}
			if lastKey != nil {
				input.ExclusiveStartKey = lastKey
			}

			resp, err := dynamoClient.Query(ctx, input)
			if err != nil {
				log.Printf("Failed to query BookingIndex for bookingId=%s: %v", bookingID, err)
				break
			}

			var relatedItems []GuestItem
			if err := attributevalue.UnmarshalListOfMaps(resp.Items, &relatedItems); err != nil {
				log.Printf("Failed to unmarshal related items: %v", err)
				break
			}

			for _, related := range relatedItems {
				if related.RoomNumber != "" && related.GuestID != "" {
					// Skip approved guests - they should never be deleted
					if related.ApprovalStatus == "approved" {
						continue
					}
					keys[GuestKey{RoomNumber: related.RoomNumber, GuestID: related.GuestID}] = true
				}
			}

			lastKey = resp.LastEvaluatedKey
			if lastKey == nil {
				break
			}
		}
	}

	return keys, len(bookingIDs), nil
}

// batchDeleteItems deletes items in batches of 25 (DynamoDB limit)
func batchDeleteItems(ctx context.Context, keys map[GuestKey]bool) error {
	if len(keys) == 0 {
		return nil
	}

	keySlice := make([]GuestKey, 0, len(keys))
	for k := range keys {
		keySlice = append(keySlice, k)
	}

	// Process in batches of 25
	batchSize := 25
	for i := 0; i < len(keySlice); i += batchSize {
		end := i + batchSize
		if end > len(keySlice) {
			end = len(keySlice)
		}
		batch := keySlice[i:end]

		var writeRequests []types.WriteRequest
		for _, key := range batch {
			writeRequests = append(writeRequests, types.WriteRequest{
				DeleteRequest: &types.DeleteRequest{
					Key: map[string]types.AttributeValue{
						"roomNumber": &types.AttributeValueMemberS{Value: key.RoomNumber},
						"guestId":    &types.AttributeValueMemberS{Value: key.GuestID},
					},
				},
			})
		}

		_, err := dynamoClient.BatchWriteItem(ctx, &dynamodb.BatchWriteItemInput{
			RequestItems: map[string][]types.WriteRequest{
				tableName: writeRequests,
			},
		})
		if err != nil {
			return fmt.Errorf("failed to batch delete items: %w", err)
		}
	}

	return nil
}

func HandleRequest(ctx context.Context, event map[string]interface{}) (Response, error) {
	nowTS := time.Now().Unix()

	// 1. rejected: immediate deletion (no expiration check, single deletion)
	rejectedItems, err := fetchRejectedAll(ctx)
	if err != nil {
		return Response{}, fmt.Errorf("failed to fetch rejected items: %w", err)
	}
	rejectedKeys := collectRejectedKeys(rejectedItems)

	// 2. other non-approved statuses: delete only expired (with bookingId group deletion)
	expiredItems, err := fetchExpiredNonApproved(ctx, nowTS)
	if err != nil {
		return Response{}, fmt.Errorf("failed to fetch expired items: %w", err)
	}
	expiredKeys, bookingCount, err := collectKeysToDelete(ctx, expiredItems)
	if err != nil {
		return Response{}, fmt.Errorf("failed to collect keys to delete: %w", err)
	}

	// Merge all keys to delete
	allKeysToDelete := make(map[GuestKey]bool)
	for k := range rejectedKeys {
		allKeysToDelete[k] = true
	}
	for k := range expiredKeys {
		allKeysToDelete[k] = true
	}

	// Batch delete
	if len(allKeysToDelete) > 0 {
		if err := batchDeleteItems(ctx, allKeysToDelete); err != nil {
			return Response{}, fmt.Errorf("failed to delete items: %w", err)
		}
	}

	log.Printf("Cleanup summary: rejectedRecords=%d, expiredNonApproved=%d, bookingGroupsTouched=%d, deletedRecords=%d",
		len(rejectedItems), len(expiredItems), bookingCount, len(allKeysToDelete))

	return Response{
		RejectedRecords:      len(rejectedItems),
		ExpiredNonApproved:   len(expiredItems),
		BookingGroupsTouched: bookingCount,
		DeletedRecords:       len(allKeysToDelete),
		Timestamp:            nowTS,
	}, nil
}

func main() {
	lambda.Start(HandleRequest)
}
