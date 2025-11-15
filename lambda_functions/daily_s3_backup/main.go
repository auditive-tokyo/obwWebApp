package main

import (
	"bytes"
	"context"
	"encoding/csv"
	"fmt"
	"io"
	"log"
	"os"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/aws/aws-lambda-go/lambda"
	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/feature/dynamodb/attributevalue"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb/types"
	"github.com/aws/aws-sdk-go-v2/service/s3"
)

var (
	dynamoClient *dynamodb.Client
	s3Client     *s3.Client
	tableName    string
	bucketName   string
)

// GuestRecord represents a guest record from DynamoDB
type GuestRecord struct {
	RoomNumber            string `dynamodbav:"roomNumber"`
	GuestID               string `dynamodbav:"guestId"`
	Address               string `dynamodbav:"address"`
	ApprovalStatus        string `dynamodbav:"approvalStatus"`
	BookingID             string `dynamodbav:"bookingId"`
	CheckInDate           string `dynamodbav:"checkInDate"`
	CheckOutDate          string `dynamodbav:"checkOutDate"`
	ContactChannel        string `dynamodbav:"contactChannel"`
	CreatedAt             string `dynamodbav:"createdAt"`
	CurrentLocation       string `dynamodbav:"currentLocation"`
	Email                 string `dynamodbav:"email"`
	GuestName             string `dynamodbav:"guestName"`
	IsFamilyMember        string `dynamodbav:"isFamilyMember"`
	Nationality           string `dynamodbav:"nationality"`
	Occupation            string `dynamodbav:"occupation"`
	PassportImageURL      string `dynamodbav:"passportImageUrl"`
	Phone                 string `dynamodbav:"phone"`
	PromoConsent          string `dynamodbav:"promoConsent"`
	SessionTokenExpiresAt int64  `dynamodbav:"sessionTokenExpiresAt"`
	SessionTokenHash      string `dynamodbav:"sessionTokenHash"`
	UpdatedAt             string `dynamodbav:"updatedAt"`
}

func init() {
	ctx := context.Background()
	cfg, err := config.LoadDefaultConfig(ctx, config.WithRegion("ap-northeast-1"))
	if err != nil {
		log.Fatalf("Unable to load AWS SDK config: %v", err)
	}

	dynamoClient = dynamodb.NewFromConfig(cfg)
	s3Client = s3.NewFromConfig(cfg)
	tableName = os.Getenv("TABLE_NAME")
	bucketName = os.Getenv("BACKUP_BUCKET")

	if tableName == "" {
		log.Fatal("TABLE_NAME environment variable is required")
	}
	if bucketName == "" {
		log.Fatal("BACKUP_BUCKET environment variable is required")
	}
}

// handleRequest is the Lambda handler function
func handleRequest(ctx context.Context) (string, error) {
	log.Println("Starting daily S3 backup process...")

	// Get current Unix timestamp
	now := time.Now().Unix()
	log.Printf("Current Unix time: %d", now)

	// Query DynamoDB for expired approved records
	expiredRecords, err := scanExpiredRecords(ctx, now)
	if err != nil {
		return "", fmt.Errorf("failed to query DynamoDB: %w", err)
	}

	if len(expiredRecords) == 0 {
		log.Println("No expired records found. Nothing to backup.")
		return "No expired records to process", nil
	}

	log.Printf("Found %d expired records to backup", len(expiredRecords))

	// Group records by month (based on checkInDate)
	recordsByMonth := groupRecordsByMonth(expiredRecords)

	totalProcessed := 0
	var uploadedKeys []string

	// Process each month separately
	for yearMonth, records := range recordsByMonth {
		log.Printf("Processing %d records for month: %s", len(records), yearMonth)

		// Sort records by checkInDate, then roomNumber
		sortRecords(records)

		// Get or create monthly CSV
		s3Key := fmt.Sprintf("backups/%s/expired-guests.csv", yearMonth)

		// Download existing CSV if exists
		existingRecords, err := downloadExistingCSV(ctx, s3Key)
		if err != nil {
			log.Printf("No existing CSV found for %s, will create new one", yearMonth)
		} else {
			log.Printf("Found existing CSV with %d records for %s", len(existingRecords), yearMonth)
		}

		// Merge existing and new records
		allRecords := append(existingRecords, records...)
		sortRecords(allRecords)

		// Generate CSV content
		csvData, err := generateCSV(allRecords)
		if err != nil {
			return "", fmt.Errorf("failed to generate CSV for %s: %w", yearMonth, err)
		}

		// Upload to S3 (overwrite)
		if err := uploadToS3Overwrite(ctx, s3Key, csvData); err != nil {
			return "", fmt.Errorf("failed to upload CSV for %s: %w", yearMonth, err)
		}

		log.Printf("Successfully uploaded CSV to S3: %s (%d total records)", s3Key, len(allRecords))
		uploadedKeys = append(uploadedKeys, s3Key)
		totalProcessed += len(records)
	}

	// Delete records from DynamoDB (only after all successful S3 uploads)
	deleted, err := deleteRecordsFromDynamoDB(ctx, expiredRecords)
	if err != nil {
		return "", fmt.Errorf("failed to delete records from DynamoDB (CSVs backed up to %v): %w", uploadedKeys, err)
	}

	result := fmt.Sprintf("Successfully processed %d expired records across %d months. Deleted %d records from DynamoDB. Uploaded: %v",
		totalProcessed, len(recordsByMonth), deleted, uploadedKeys)
	log.Println(result)
	return result, nil
}

// scanExpiredRecords queries DynamoDB using GSI for approved records with expired sessionTokenExpiresAt
func scanExpiredRecords(ctx context.Context, currentTime int64) ([]GuestRecord, error) {
	var expiredRecords []GuestRecord
	var lastEvaluatedKey map[string]types.AttributeValue

	log.Println("Querying approved records with expired sessionTokenExpiresAt using GSI...")

	for {
		input := &dynamodb.QueryInput{
			TableName:              aws.String(tableName),
			IndexName:              aws.String("ApprovalStatusExpiresIndex"),
			KeyConditionExpression: aws.String("approvalStatus = :status AND sessionTokenExpiresAt < :now"),
			ExpressionAttributeValues: map[string]types.AttributeValue{
				":status": &types.AttributeValueMemberS{Value: "approved"},
				":now":    &types.AttributeValueMemberN{Value: strconv.FormatInt(currentTime, 10)},
			},
		}

		if lastEvaluatedKey != nil {
			input.ExclusiveStartKey = lastEvaluatedKey
		}

		result, err := dynamoClient.Query(ctx, input)
		if err != nil {
			return nil, fmt.Errorf("DynamoDB query error: %w", err)
		}

		var pageRecords []GuestRecord
		if err := attributevalue.UnmarshalListOfMaps(result.Items, &pageRecords); err != nil {
			return nil, fmt.Errorf("failed to unmarshal records: %w", err)
		}

		for _, record := range pageRecords {
			expiredRecords = append(expiredRecords, record)
			log.Printf("Found expired approved record: Room=%s, Guest=%s, ExpiresAt=%d",
				record.RoomNumber, record.GuestID, record.SessionTokenExpiresAt)
		}

		lastEvaluatedKey = result.LastEvaluatedKey
		if lastEvaluatedKey == nil {
			break
		}
	}

	return expiredRecords, nil
}

// groupRecordsByMonth groups records by their checkInDate year-month (YYYY-MM)
func groupRecordsByMonth(records []GuestRecord) map[string][]GuestRecord {
	grouped := make(map[string][]GuestRecord)

	for _, record := range records {
		// Extract year-month from checkInDate (format: "YYYY-MM-DD")
		yearMonth := extractYearMonth(record.CheckInDate)
		if yearMonth == "" {
			log.Printf("Warning: Invalid checkInDate format for record Room=%s, Guest=%s: %s",
				record.RoomNumber, record.GuestID, record.CheckInDate)
			continue
		}
		grouped[yearMonth] = append(grouped[yearMonth], record)
	}

	return grouped
}

// extractYearMonth extracts YYYY-MM from a date string (YYYY-MM-DD)
func extractYearMonth(dateStr string) string {
	if len(dateStr) < 7 {
		return ""
	}
	return dateStr[:7] // "2025-11-15" -> "2025-11"
}

// sortRecords sorts records by checkInDate (ascending), then roomNumber (ascending)
func sortRecords(records []GuestRecord) {
	sort.Slice(records, func(i, j int) bool {
		if records[i].CheckInDate != records[j].CheckInDate {
			return records[i].CheckInDate < records[j].CheckInDate
		}
		return records[i].RoomNumber < records[j].RoomNumber
	})
}

// downloadExistingCSV downloads existing CSV from S3 and parses it
func downloadExistingCSV(ctx context.Context, s3Key string) ([]GuestRecord, error) {
	result, err := s3Client.GetObject(ctx, &s3.GetObjectInput{
		Bucket: aws.String(bucketName),
		Key:    aws.String(s3Key),
	})
	if err != nil {
		if strings.Contains(err.Error(), "NoSuchKey") || strings.Contains(err.Error(), "Not Found") {
			return nil, fmt.Errorf("file not found")
		}
		return nil, fmt.Errorf("failed to download CSV: %w", err)
	}
	defer result.Body.Close()

	// Read CSV content
	bodyBytes, err := io.ReadAll(result.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read CSV body: %w", err)
	}

	// Parse CSV
	reader := csv.NewReader(bytes.NewReader(bodyBytes))
	rows, err := reader.ReadAll()
	if err != nil {
		return nil, fmt.Errorf("failed to parse CSV: %w", err)
	}

	if len(rows) == 0 {
		return nil, fmt.Errorf("CSV is empty")
	}

	// Skip header row
	var records []GuestRecord
	for i, row := range rows {
		if i == 0 {
			continue // Skip header
		}

		if len(row) < 21 {
			log.Printf("Warning: Skipping row %d with insufficient columns", i)
			continue
		}

		// Parse sessionTokenExpiresAt
		expiresAt, _ := strconv.ParseInt(row[18], 10, 64)

		record := GuestRecord{
			RoomNumber:            row[0],
			BookingID:             row[1],
			GuestName:             row[2],
			IsFamilyMember:        row[3],
			PromoConsent:          row[4],
			ContactChannel:        row[5],
			Email:                 row[6],
			Phone:                 row[7],
			CheckInDate:           row[8],
			CheckOutDate:          row[9],
			GuestID:               row[10],
			Address:               row[11],
			ApprovalStatus:        row[12],
			CreatedAt:             row[13],
			CurrentLocation:       row[14],
			Nationality:           row[15],
			Occupation:            row[16],
			PassportImageURL:      row[17],
			SessionTokenExpiresAt: expiresAt,
			SessionTokenHash:      row[19],
			UpdatedAt:             row[20],
		}

		records = append(records, record)
	}

	return records, nil
}

// uploadToS3Overwrite uploads CSV data to S3 (overwrites if exists)
func uploadToS3Overwrite(ctx context.Context, s3Key string, data []byte) error {
	_, err := s3Client.PutObject(ctx, &s3.PutObjectInput{
		Bucket:      aws.String(bucketName),
		Key:         aws.String(s3Key),
		Body:        bytes.NewReader(data),
		ContentType: aws.String("text/csv"),
	})

	if err != nil {
		return fmt.Errorf("S3 upload error: %w", err)
	}

	return nil
}

// generateCSV creates CSV content from guest records
func generateCSV(records []GuestRecord) ([]byte, error) {
	var buf bytes.Buffer
	writer := csv.NewWriter(&buf)

	// CSV header - prioritized columns first, then remaining fields
	header := []string{
		"roomNumber", "bookingId", "guestName", "isFamilyMember", "promoConsent",
		"contactChannel", "email", "phone", "checkInDate", "checkOutDate",
		"guestId", "address", "approvalStatus", "createdAt", "currentLocation",
		"nationality", "occupation", "passportImageUrl", "sessionTokenExpiresAt",
		"sessionTokenHash", "updatedAt",
	}

	if err := writer.Write(header); err != nil {
		return nil, fmt.Errorf("failed to write CSV header: %w", err)
	}

	// Write data rows
	for _, record := range records {
		row := []string{
			record.RoomNumber,
			record.BookingID,
			record.GuestName,
			record.IsFamilyMember,
			record.PromoConsent,
			record.ContactChannel,
			record.Email,
			record.Phone,
			record.CheckInDate,
			record.CheckOutDate,
			record.GuestID,
			record.Address,
			record.ApprovalStatus,
			record.CreatedAt,
			record.CurrentLocation,
			record.Nationality,
			record.Occupation,
			record.PassportImageURL,
			strconv.FormatInt(record.SessionTokenExpiresAt, 10),
			record.SessionTokenHash,
			record.UpdatedAt,
		}

		if err := writer.Write(row); err != nil {
			return nil, fmt.Errorf("failed to write CSV row: %w", err)
		}
	}

	writer.Flush()
	if err := writer.Error(); err != nil {
		return nil, fmt.Errorf("CSV writer error: %w", err)
	}

	return buf.Bytes(), nil
}

// deleteRecordsFromDynamoDB deletes records from DynamoDB in batches
func deleteRecordsFromDynamoDB(ctx context.Context, records []GuestRecord) (int, error) {
	const batchSize = 25 // DynamoDB BatchWriteItem limit
	deleted := 0

	for i := 0; i < len(records); i += batchSize {
		end := i + batchSize
		if end > len(records) {
			end = len(records)
		}

		batch := records[i:end]
		writeRequests := make([]types.WriteRequest, 0, len(batch))

		for _, record := range batch {
			writeRequests = append(writeRequests, types.WriteRequest{
				DeleteRequest: &types.DeleteRequest{
					Key: map[string]types.AttributeValue{
						"roomNumber": &types.AttributeValueMemberS{Value: record.RoomNumber},
						"guestId":    &types.AttributeValueMemberS{Value: record.GuestID},
					},
				},
			})
		}

		input := &dynamodb.BatchWriteItemInput{
			RequestItems: map[string][]types.WriteRequest{
				tableName: writeRequests,
			},
		}

		_, err := dynamoClient.BatchWriteItem(ctx, input)
		if err != nil {
			return deleted, fmt.Errorf("failed to delete batch (starting at index %d): %w", i, err)
		}

		deleted += len(batch)
		log.Printf("Deleted batch of %d records (total: %d)", len(batch), deleted)
	}

	return deleted, nil
}

func main() {
	lambda.Start(handleRequest)
}
