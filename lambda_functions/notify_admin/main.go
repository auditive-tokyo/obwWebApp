package main

import (
	"bytes"
	"context"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"os"
	"time"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"
)

var (
	adminBaseURL     string
	telegramBotToken string
	telegramChatID   string
)

func init() {
	adminBaseURL = os.Getenv("ADMIN_BASE_URL")
	if adminBaseURL == "" {
		adminBaseURL = "https://app.osakabaywheel.com/admin"
	}

	telegramBotToken = os.Getenv("TELEGRAM_BOT_TOKEN")
	telegramChatID = os.Getenv("TELEGRAM_CHAT_ID")

	log.Printf("Initialized with ADMIN_BASE_URL: %s", adminBaseURL)
}

// DynamoDB Streamから文字列属性を取得
func getStringAttr(attrs map[string]events.DynamoDBAttributeValue, key string) string {
	if attr, ok := attrs[key]; ok && attr.DataType() == events.DataTypeString {
		return attr.String()
	}
	return ""
}

// Telegram にメッセージを送信
func sendTelegram(text string) error {
	if telegramBotToken == "" || telegramChatID == "" {
		return fmt.Errorf("TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID is not set")
	}

	apiURL := fmt.Sprintf("https://api.telegram.org/bot%s/sendMessage", telegramBotToken)

	data := url.Values{}
	data.Set("chat_id", telegramChatID)
	data.Set("text", text)
	data.Set("disable_web_page_preview", "true")

	req, err := http.NewRequest("POST", apiURL, bytes.NewBufferString(data.Encode()))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to send telegram: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		var body bytes.Buffer
		body.ReadFrom(resp.Body)
		return fmt.Errorf("telegram send failed: status=%d body=%s", resp.StatusCode, body.String())
	}

	return nil
}

// Lambda ハンドラー
func HandleRequest(ctx context.Context, event events.DynamoDBEvent) error {
	log.Printf("Processing %d DynamoDB Stream records", len(event.Records))

	for _, record := range event.Records {
		// イベント名とイメージを取得
		eventName := record.EventName
		newImage := record.Change.NewImage
		oldImage := record.Change.OldImage

		// approvalStatus の遷移をチェック
		newStatus := getStringAttr(newImage, "approvalStatus")
		oldStatus := getStringAttr(oldImage, "approvalStatus")

		// old_status が存在し、old_status != 'pending' かつ new_status == 'pending' の遷移のみ通知
		if oldStatus == "" || oldStatus == "pending" || newStatus != "pending" {
			log.Printf("Skipping record. new_status: %s, old_status: %s, eventName: %s", newStatus, oldStatus, eventName)
			continue
		}

		// ゲスト情報を取得
		roomNumber := getStringAttr(newImage, "roomNumber")
		guestID := getStringAttr(newImage, "guestId")
		guestName := getStringAttr(newImage, "guestName")
		checkIn := getStringAttr(newImage, "checkInDate")
		checkOut := getStringAttr(newImage, "checkOutDate")
		bookingID := getStringAttr(newImage, "bookingId")

		// sessionの代表者のみ sessionTokenHash を持つ
		sessionTokenHash := getStringAttr(newImage, "sessionTokenHash")
		isRepresentative := sessionTokenHash != ""

		if !isRepresentative {
			log.Printf("Skipping non-representative record for guest %s", guestID)
			continue
		}

		// チェックイン・アウト日のデフォルト値
		if checkIn == "" {
			checkIn = "-"
		}
		if checkOut == "" {
			checkOut = "-"
		}

		// メッセージを作成
		message := fmt.Sprintf(
			"Room (%s) の %s さんが基本情報の登録と、IDの写真をアップロードしました。\n"+
				"Admin Pageより確認してください:\n"+
				"滞在日: %s ~ %s\n\n"+
				"%s/%s/%s",
			roomNumber, guestName, checkIn, checkOut, adminBaseURL, roomNumber, bookingID,
		)

		// Telegram 送信
		err := sendTelegram(message)
		if err != nil {
			log.Printf("❌ Error sending telegram for guest %s: %v", guestID, err)
			// バッチサイズ1前提、例外で当該レコードのみ再試行
			return err
		}

		log.Printf("✅ Sent Telegram message for guest %s", guestID)
	}

	return nil
}

func main() {
	lambda.Start(HandleRequest)
}
