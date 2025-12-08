package main

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"crypto/tls"
	"encoding/base64"
	"encoding/hex"
	"fmt"
	"log"
	"net"
	"net/smtp"
	"os"
	"time"

	"github.com/aws/aws-lambda-go/lambda"
	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/feature/dynamodb/attributevalue"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb/types"
	"github.com/aws/aws-sdk-go-v2/service/sns"
)

// AppSync からのリクエスト構造
type AppSyncEvent struct {
	Arguments struct {
		Input TransferRoomInput `json:"input"`
	} `json:"arguments"`
}

// GraphQL Input 型
type TransferRoomInput struct {
	OldRoomNumber string   `json:"oldRoomNumber"`
	NewRoomNumber string   `json:"newRoomNumber"`
	BookingIDs    []string `json:"bookingIds,omitempty"` // 複数のbookingIDに対応
}

// GraphQL Result 型
type TransferRoomResult struct {
	Success          bool   `json:"success"`
	TransferredCount int    `json:"transferredCount"`
	Message          string `json:"message,omitempty"`
}

// DynamoDB Guest レコード構造
type GuestRecord struct {
	RoomNumber            string  `dynamodbav:"roomNumber"`
	GuestID               string  `dynamodbav:"guestId"`
	BookingID             *string `dynamodbav:"bookingId,omitempty"`
	GuestName             string  `dynamodbav:"guestName"`
	Email                 *string `dynamodbav:"email,omitempty"`
	Address               *string `dynamodbav:"address,omitempty"`
	Phone                 *string `dynamodbav:"phone,omitempty"`
	ContactChannel        *string `dynamodbav:"contactChannel,omitempty"` // 通知チャネル: "email" または "sms"
	Occupation            *string `dynamodbav:"occupation,omitempty"`
	Nationality           *string `dynamodbav:"nationality,omitempty"`
	PassportImageURL      *string `dynamodbav:"passportImageUrl,omitempty"`
	CheckInDate           *string `dynamodbav:"checkInDate,omitempty"`
	CheckOutDate          *string `dynamodbav:"checkOutDate,omitempty"`
	ApprovalStatus        string  `dynamodbav:"approvalStatus"`
	PromoConsent          *bool   `dynamodbav:"promoConsent,omitempty"`
	IsFamilyMember        *bool   `dynamodbav:"isFamilyMember,omitempty"`
	SessionTokenExpiresAt *int64  `dynamodbav:"sessionTokenExpiresAt,omitempty"`
	SessionTokenHash      *string `dynamodbav:"sessionTokenHash,omitempty"`
	CreatedAt             *string `dynamodbav:"createdAt,omitempty"`
	UpdatedAt             *string `dynamodbav:"updatedAt,omitempty"`
	CurrentLocation       *string `dynamodbav:"currentLocation,omitempty"`
}

var (
	dynamoClient *dynamodb.Client
	snsClient    *sns.Client
	tableName    string
	smtpServer   = "smtp.zoho.jp"
	smtpPort     = 465
	smtpUser     string
	smtpPassword string
	appBaseURL   string
)

func init() {
	// 環境変数からテーブル名を取得
	tableName = os.Getenv("TABLE_NAME")
	if tableName == "" {
		log.Fatal("TABLE_NAME environment variable is required")
	}

	// Zoho SMTP と通知用の環境変数を取得
	smtpUser = os.Getenv("SMTP_USER")
	if smtpUser == "" {
		log.Fatal("SMTP_USER environment variable is required")
	}

	smtpPassword = os.Getenv("SMTP_PASSWORD")
	if smtpPassword == "" {
		log.Fatal("SMTP_PASSWORD environment variable is required")
	}

	appBaseURL = os.Getenv("APP_BASE_URL")
	if appBaseURL == "" {
		appBaseURL = "https://app.osakabaywheel.com"
	}

	// AWS SDK v2 の初期化
	cfg, err := config.LoadDefaultConfig(context.TODO())
	if err != nil {
		log.Fatalf("unable to load SDK config, %v", err)
	}

	dynamoClient = dynamodb.NewFromConfig(cfg)
	snsClient = sns.NewFromConfig(cfg)
	log.Printf("DynamoDB client initialized. Table: %s", tableName)
}

// checkoutNoonEpoch calculates Unix timestamp for checkout date at JST noon (UTC 03:00)
func checkoutNoonEpoch(dateStr string) (int64, error) {
	// Parse date string "YYYY-MM-DD"
	t, err := time.Parse("2006-01-02", dateStr)
	if err != nil {
		return 0, fmt.Errorf("invalid date format: %w", err)
	}

	// Set time to JST noon (12:00 JST = 03:00 UTC)
	t = time.Date(t.Year(), t.Month(), t.Day(), 3, 0, 0, 0, time.UTC)
	return t.Unix(), nil
}

// Lambda ハンドラー
func HandleRequest(ctx context.Context, event AppSyncEvent) (TransferRoomResult, error) {
	input := event.Arguments.Input

	if len(input.BookingIDs) > 0 {
		log.Printf("🔄 部屋移動開始: %s → %s (bookingIds: %v)", input.OldRoomNumber, input.NewRoomNumber, input.BookingIDs)
	} else {
		log.Printf("🔄 部屋移動開始: %s → %s (全ゲスト)", input.OldRoomNumber, input.NewRoomNumber)
	}

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
	allGuests, err := queryGuestsByRoom(ctx, input.OldRoomNumber)
	if err != nil {
		log.Printf("❌ Query failed: %v", err)
		return TransferRoomResult{
			Success: false,
			Message: fmt.Sprintf("ゲスト情報の取得に失敗しました: %v", err),
		}, err
	}

	// bookingIds が指定されている場合はフィルタリング
	var guests []GuestRecord
	if len(input.BookingIDs) > 0 {
		bookingIDSet := make(map[string]bool)
		for _, id := range input.BookingIDs {
			bookingIDSet[id] = true
		}

		for _, guest := range allGuests {
			// bookingId が指定された bookingIds のいずれかに一致する場合のみ含める
			if guest.BookingID != nil && bookingIDSet[*guest.BookingID] {
				guests = append(guests, guest)
			}
		}

		log.Printf("📋 フィルタリング結果: %d/%d 件のゲストが対象", len(guests), len(allGuests))
	} else {
		// bookingIds 指定なしの場合は全ゲストを対象
		guests = allGuests
		log.Printf("📋 全 %d 件のゲストを対象", len(guests))
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
		end := min(i+maxGuestsPerBatch, len(guests))

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

	// トークンとハッシュを生成して保存
	type guestWithToken struct {
		guest GuestRecord
		token string
	}
	guestsWithTokens := make([]guestWithToken, 0, len(guests))

	for _, guest := range guests {
		// 新レコード作成: roomNumber を変更して Put
		newGuest := guest
		newGuest.RoomNumber = newRoomNumber
		newGuest.UpdatedAt = &now

		// SessionTokenHash を持っている代表者のみ、新しいトークンを生成
		if guest.SessionTokenHash != nil && *guest.SessionTokenHash != "" {
			token, err := generateToken()
			if err != nil {
				return fmt.Errorf("failed to generate token for guest %s: %w", guest.GuestID, err)
			}

			tokenHash := hashToken(token)

			// checkOutDateがあればその日のJST正午に設定
			// checkOutDateがなければ元のsessionTokenExpiresAtを保持
			var expiresAt int64
			if guest.CheckOutDate != nil && *guest.CheckOutDate != "" {
				var err error
				expiresAt, err = checkoutNoonEpoch(*guest.CheckOutDate)
				if err != nil {
					log.Printf("⚠️ Failed to parse checkOutDate for guest %s: %v", guest.GuestID, err)
					// パースエラーの場合は元の有効期限を保持
					if guest.SessionTokenExpiresAt != nil {
						expiresAt = *guest.SessionTokenExpiresAt
					} else {
						// 最終手段: 48時間後（admin_approve_guestと同じフォールバック）
						expiresAt = time.Now().Add(48 * time.Hour).Unix()
						log.Printf("⚠️ No existing sessionTokenExpiresAt, using 48h fallback for guest %s", guest.GuestID)
					}
				}
			} else {
				// checkOutDateがない場合は元の有効期限を保持
				if guest.SessionTokenExpiresAt != nil {
					expiresAt = *guest.SessionTokenExpiresAt
					log.Printf("ℹ️ No checkOutDate for guest %s, keeping existing sessionTokenExpiresAt", guest.GuestID)
				} else {
					// 最終手段: 48時間後
					expiresAt = time.Now().Add(48 * time.Hour).Unix()
					log.Printf("⚠️ No checkOutDate and no existing sessionTokenExpiresAt for guest %s, using 48h fallback", guest.GuestID)
				}
			}

			newGuest.SessionTokenHash = &tokenHash
			newGuest.SessionTokenExpiresAt = &expiresAt

			// 通知用にトークンを保存（代表者のみ）
			guestsWithTokens = append(guestsWithTokens, guestWithToken{
				guest: newGuest,
				token: token,
			})
		}

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

	// 部屋移動が成功したら通知を送信
	for _, gwt := range guestsWithTokens {
		err := notifyRoomTransfer(ctx, gwt.guest, newRoomNumber, gwt.token)
		if err != nil {
			// 通知失敗はログに記録するが、処理は継続
			log.Printf("⚠️ Failed to notify guest %s: %v", gwt.guest.GuestID, err)
		}
	}

	return nil
}

// トークン生成（32バイトのランダムデータをBase64エンコード）
func generateToken() (string, error) {
	tokenBytes := make([]byte, 32)
	_, err := rand.Read(tokenBytes)
	if err != nil {
		return "", fmt.Errorf("failed to generate random token: %w", err)
	}
	return base64.URLEncoding.EncodeToString(tokenBytes), nil
}

// トークンのSHA256ハッシュを生成
func hashToken(token string) string {
	hash := sha256.Sum256([]byte(token))
	return hex.EncodeToString(hash[:])
}

// Zoho SMTP経由でメール送信
func sendEmail(_ context.Context, toEmail, guestName, roomNumber, guestID, token, nationality string) error {
	if smtpUser == "" || smtpPassword == "" {
		return fmt.Errorf("SMTP_USER or SMTP_PASSWORD is not configured")
	}

	verifyURL := fmt.Sprintf("%s/room/%s?guestId=%s&token=%s", appBaseURL, roomNumber, guestID, token)

	// 国籍に応じてメッセージを切り替え
	var subject, textBody string
	if nationality == "Japan" {
		subject = "部屋移動のお知らせ"
		textBody = fmt.Sprintf(
			"【部屋移動のお知らせ】\n\n"+
				"%s 様\n\n"+
				"お部屋が %s に変更されました。\n\n"+
				"新しいお部屋でのアクセスを有効にするため、以下のリンクをクリックしてください：\n"+
				"%s\n",
			guestName, roomNumber, verifyURL)
	} else {
		subject = "Room Transfer Notification"
		textBody = fmt.Sprintf(
			"【Room Transfer Notice】\n\n"+
				"Dear %s,\n\n"+
				"Your room has been changed to %s.\n\n"+
				"Please click the link below to activate access for your new room:\n"+
				"%s\n",
			guestName, roomNumber, verifyURL)
	}

	// RFC 5322 format email
	from := smtpUser
	to := toEmail

	msg := []byte("From: " + from + "\r\n" +
		"To: " + to + "\r\n" +
		"Subject: " + subject + "\r\n" +
		"Content-Type: text/plain; charset=UTF-8\r\n" +
		"\r\n" +
		textBody + "\r\n")

	// Connect to SMTP server with TLS
	serverAddr := fmt.Sprintf("%s:%d", smtpServer, smtpPort)

	// Create TLS connection
	tlsConfig := &tls.Config{
		ServerName: smtpServer,
	}

	conn, err := tls.Dial("tcp", serverAddr, tlsConfig)
	if err != nil {
		return fmt.Errorf("TLS dial error: %w", err)
	}
	defer conn.Close()

	// Create SMTP client
	host, _, _ := net.SplitHostPort(serverAddr)
	client, err := smtp.NewClient(conn, host)
	if err != nil {
		return fmt.Errorf("SMTP client error: %w", err)
	}
	defer client.Close()

	// Authenticate
	auth := smtp.PlainAuth("", smtpUser, smtpPassword, smtpServer)
	if err = client.Auth(auth); err != nil {
		return fmt.Errorf("SMTP auth error: %w", err)
	}

	// Send email
	if err = client.Mail(from); err != nil {
		return fmt.Errorf("MAIL FROM error: %w", err)
	}
	if err = client.Rcpt(to); err != nil {
		return fmt.Errorf("RCPT TO error: %w", err)
	}

	w, err := client.Data()
	if err != nil {
		return fmt.Errorf("DATA error: %w", err)
	}

	_, err = w.Write(msg)
	if err != nil {
		return fmt.Errorf("write error: %w", err)
	}

	err = w.Close()
	if err != nil {
		return fmt.Errorf("close error: %w", err)
	}

	client.Quit()
	log.Printf("✅ Email sent to %s", toEmail)
	return nil
}

// AWS SNS経由でSMS送信
func sendSMS(ctx context.Context, phone, guestName, roomNumber, guestID, token, nationality string) error {
	verifyURL := fmt.Sprintf("%s/room/%s?guestId=%s&token=%s&source=sms", appBaseURL, roomNumber, guestID, token)

	// 国籍に応じてメッセージを切り替え
	var message string
	if nationality == "Japan" {
		message = fmt.Sprintf(
			"【Osaka Bay Wheel】\n%s様、お部屋が%sに変更されました。新しいアクセスを有効にするため、こちらをクリックしてください: %s",
			guestName, roomNumber, verifyURL,
		)
	} else {
		message = fmt.Sprintf(
			"[Osaka Bay Wheel]\nDear %s, your room has been changed to %s. Please click to activate access: %s",
			guestName, roomNumber, verifyURL,
		)
	}

	_, err := snsClient.Publish(ctx, &sns.PublishInput{
		PhoneNumber: aws.String(phone),
		Message:     aws.String(message),
	})

	if err != nil {
		return fmt.Errorf("failed to send SMS: %w", err)
	}

	log.Printf("✅ SMS sent to %s", phone)
	return nil
}

// 部屋移動通知を送信
func notifyRoomTransfer(ctx context.Context, guest GuestRecord, newRoomNumber, token string) error {
	// 国籍を取得（デフォルトは空文字列）
	nationality := ""
	if guest.Nationality != nil {
		nationality = *guest.Nationality
	}

	// contactChannel が "sms" の場合は SMS で送信
	if guest.ContactChannel != nil && *guest.ContactChannel == "sms" {
		if guest.Phone == nil || *guest.Phone == "" {
			return fmt.Errorf("phone number is missing for SMS notification (guestId: %s)", guest.GuestID)
		}
		return sendSMS(ctx, *guest.Phone, guest.GuestName, newRoomNumber, guest.GuestID, token, nationality)
	}

	// contactChannel が空または "sms" 以外の場合は Email で送信
	if guest.Email != nil && *guest.Email != "" {
		return sendEmail(ctx, *guest.Email, guest.GuestName, newRoomNumber, guest.GuestID, token, nationality)
	}

	// Email も Phone もない場合はエラー（通常は発生しないはず）
	return fmt.Errorf("no contact method available for guest %s (guestId: %s) - both email and phone are missing", guest.GuestName, guest.GuestID)
}

func main() {
	lambda.Start(HandleRequest)
}
