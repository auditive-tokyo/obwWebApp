package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"time"

	"github.com/aws/aws-lambda-go/lambda"
	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/feature/dynamodb/attributevalue"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb/types"
)

// AppSync からのリクエスト構造
type AppSyncEvent struct {
	Arguments struct {
		Input TransferRoomInput `json:"input"`
	} `json:"arguments"`
}

// GraphQL Input 型
type TransferRoomInput struct {
	OldRoomNumber string `json:"oldRoomNumber"`
	NewRoomNumber string `json:"newRoomNumber"`
}

// GraphQL Result 型
type TransferRoomResult struct {
	Success          bool   `json:"success"`
	TransferredCount int    `json:"transferredCount"`
	Message          string `json:"message,omitempty"`
}

// DynamoDB Guest レコード構造
type GuestRecord struct {
	RoomNumber             string  `dynamodbav:"roomNumber"`
	GuestID                string  `dynamodbav:"guestId"`
	BookingID              *string `dynamodbav:"bookingId,omitempty"`
	GuestName              string  `dynamodbav:"guestName"`
	Email                  *string `dynamodbav:"email,omitempty"`
	Address                *string `dynamodbav:"address,omitempty"`
	Phone                  *string `dynamodbav:"phone,omitempty"`
	Occupation             *string `dynamodbav:"occupation,omitempty"`
	Nationality            *string `dynamodbav:"nationality,omitempty"`
	PassportImageURL       *string `dynamodbav:"passportImageUrl,omitempty"`
	CheckInDate            *string `dynamodbav:"checkInDate,omitempty"`
	CheckOutDate           *string `dynamodbav:"checkOutDate,omitempty"`
	ApprovalStatus         string  `dynamodbav:"approvalStatus"`
	PromoConsent           *bool   `dynamodbav:"promoConsent,omitempty"`
	IsFamilyMember         *bool   `dynamodbav:"isFamilyMember,omitempty"`
	SessionTokenExpiresAt  *int64  `dynamodbav:"sessionTokenExpiresAt,omitempty"`
	SessionTokenHash       *string `dynamodbav:"sessionTokenHash,omitempty"`
	PendingVerificationTTL *int64  `dynamodbav:"pendingVerificationTtl,omitempty"`
	CreatedAt              *string `dynamodbav:"createdAt,omitempty"`
	UpdatedAt              *string `dynamodbav:"updatedAt,omitempty"`
	CurrentLocation        *string `dynamodbav:"currentLocation,omitempty"`
}

var (
	dynamoClient *dynamodb.Client
	tableName    string
)

func init() {
	// 環境変数からテーブル名を取得
	tableName = os.Getenv("TABLE_NAME")
	if tableName == "" {
		tableName = "obw-guest" // デフォルト値
	}

	// AWS SDK v2 の初期化
	cfg, err := config.LoadDefaultConfig(context.TODO())
	if err != nil {
		log.Fatalf("unable to load SDK config, %v", err)
	}

	dynamoClient = dynamodb.NewFromConfig(cfg)
	log.Printf("DynamoDB client initialized. Table: %s", tableName)
}

// Lambda ハンドラー
func HandleRequest(ctx context.Context, event AppSyncEvent) (TransferRoomResult, error) {
	input := event.Arguments.Input
	log.Printf("🔄 部屋移動開始: %s → %s", input.OldRoomNumber, input.NewRoomNumber)

	// 入力バリデーション
	if input.OldRoomNumber == "" || input.NewRoomNumber == "" {
		return TransferRoomResult{
			Success: false,
			Message: "部屋番号が指定されていません",
		}, fmt.Errorf("invalid input: oldRoomNumber and newRoomNumber are required")
	}

	if input.OldRoomNumber == input.NewRoomNumber {
		return TransferRoomResult{
			Success: false,
			Message: "移動元と移動先の部屋番号が同じです",
		}, fmt.Errorf("oldRoomNumber and newRoomNumber must be different")
	}

	// 旧部屋のゲストを全件取得
	guests, err := queryGuestsByRoom(ctx, input.OldRoomNumber)
	if err != nil {
		log.Printf("❌ Query failed: %v", err)
		return TransferRoomResult{
			Success: false,
			Message: fmt.Sprintf("ゲスト情報の取得に失敗しました: %v", err),
		}, err
	}

	if len(guests) == 0 {
		log.Printf("ℹ️ 移動対象のゲストが見つかりませんでした")
		return TransferRoomResult{
			Success:          true,
			TransferredCount: 0,
			Message:          "移動対象のゲストがいませんでした",
		}, nil
	}

	log.Printf("📋 %d 件のゲストを移動します", len(guests))

	// TransactWrite でアトミックに移動
	err = transferGuestsWithTransaction(ctx, guests, input.NewRoomNumber)
	if err != nil {
		log.Printf("❌ Transfer failed: %v", err)
		return TransferRoomResult{
			Success: false,
			Message: fmt.Sprintf("部屋移動に失敗しました: %v", err),
		}, err
	}

	log.Printf("✅ 部屋移動成功: %d 件", len(guests))
	return TransferRoomResult{
		Success:          true,
		TransferredCount: len(guests),
		Message:          fmt.Sprintf("%d件のゲストを部屋 %s から部屋 %s に移動しました", len(guests), input.OldRoomNumber, input.NewRoomNumber),
	}, nil
}

// 部屋番号で Query してゲストを取得
func queryGuestsByRoom(ctx context.Context, roomNumber string) ([]GuestRecord, error) {
	log.Printf("🔍 Query guests in room: %s", roomNumber)

	result, err := dynamoClient.Query(ctx, &dynamodb.QueryInput{
		TableName:              aws.String(tableName),
		KeyConditionExpression: aws.String("roomNumber = :roomNumber"),
		ExpressionAttributeValues: map[string]types.AttributeValue{
			":roomNumber": &types.AttributeValueMemberS{Value: roomNumber},
		},
	})

	if err != nil {
		return nil, fmt.Errorf("query failed: %w", err)
	}

	var guests []GuestRecord
	err = attributevalue.UnmarshalListOfMaps(result.Items, &guests)
	if err != nil {
		return nil, fmt.Errorf("unmarshal failed: %w", err)
	}

	log.Printf("✅ Found %d guests", len(guests))
	return guests, nil
}

// TransactWrite でアトミックに移動（作成 + 削除）
func transferGuestsWithTransaction(ctx context.Context, guests []GuestRecord, newRoomNumber string) error {
	// DynamoDB の TransactWriteItems は最大 100 アイテムまで
	// 各ゲストで Put + Delete = 2 アイテムなので、50 ゲストずつバッチ処理
	const maxGuestsPerBatch = 50

	for i := 0; i < len(guests); i += maxGuestsPerBatch {
		end := i + maxGuestsPerBatch
		if end > len(guests) {
			end = len(guests)
		}

		batch := guests[i:end]
		err := transferBatch(ctx, batch, newRoomNumber)
		if err != nil {
			return fmt.Errorf("batch transfer failed: %w", err)
		}
		log.Printf("✅ Batch %d-%d transferred", i, end)
	}

	return nil
}

// バッチ単位で TransactWrite 実行
func transferBatch(ctx context.Context, guests []GuestRecord, newRoomNumber string) error {
	transactItems := make([]types.TransactWriteItem, 0, len(guests)*2)
	now := time.Now().UTC().Format(time.RFC3339)

	for _, guest := range guests {
		// 新レコード作成: roomNumber を変更して Put
		newGuest := guest
		newGuest.RoomNumber = newRoomNumber
		newGuest.UpdatedAt = &now

		newItem, err := attributevalue.MarshalMap(newGuest)
		if err != nil {
			return fmt.Errorf("marshal new guest failed: %w", err)
		}

		// Put (新レコード作成)
		transactItems = append(transactItems, types.TransactWriteItem{
			Put: &types.Put{
				TableName: aws.String(tableName),
				Item:      newItem,
			},
		})

		// Delete (旧レコード削除)
		transactItems = append(transactItems, types.TransactWriteItem{
			Delete: &types.Delete{
				TableName: aws.String(tableName),
				Key: map[string]types.AttributeValue{
					"roomNumber": &types.AttributeValueMemberS{Value: guest.RoomNumber},
					"guestId":    &types.AttributeValueMemberS{Value: guest.GuestID},
				},
			},
		})
	}

	// TransactWrite 実行
	_, err := dynamoClient.TransactWriteItems(ctx, &dynamodb.TransactWriteItemsInput{
		TransactItems: transactItems,
	})

	if err != nil {
		return fmt.Errorf("transact write failed: %w", err)
	}

	return nil
}

func main() {
	lambda.Start(HandleRequest)
}
