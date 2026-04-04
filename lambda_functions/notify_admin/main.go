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
	adminBaseURL             string
	telegramBotToken        string
	telegramChatID          string
	telegramTopicApproval   string
	telegramTopicDateChange string
)

func init() {
	adminBaseURL = os.Getenv("ADMIN_BASE_URL")
	if adminBaseURL == "" {
		adminBaseURL = "https://app.osakabaywheel.com/admin"
	}

	telegramBotToken = os.Getenv("TELEGRAM_BOT_TOKEN")
	telegramChatID = os.Getenv("TELEGRAM_CHAT_ID")
	telegramTopicApproval = os.Getenv("TELEGRAM_TOPIC_ID_APPROVAL")
	telegramTopicDateChange = os.Getenv("TELEGRAM_TOPIC_ID_DATE_CHANGE")

	log.Printf("Initialized with ADMIN_BASE_URL: %s", adminBaseURL)
}

// DynamoDB Streamから文字列属性を取得
func getStringAttr(attrs map[string]events.DynamoDBAttributeValue, key string) string {
	if attr, ok := attrs[key]; ok && attr.DataType() == events.DataTypeString {
		return attr.String()
	}
	return ""
}

// Telegram にメッセージを送信。topicID が空文字でない場合はそのトピックへ送信する
func sendTelegram(text string, topicID string) error {
	if telegramBotToken == "" || telegramChatID == "" {
		return fmt.Errorf("TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID is not set")
	}

	apiURL := fmt.Sprintf("https://api.telegram.org/bot%s/sendMessage", telegramBotToken)

	data := url.Values{}
	data.Set("chat_id", telegramChatID)
	data.Set("text", text)
	data.Set("disable_web_page_preview", "true")
	if topicID != "" {
		data.Set("message_thread_id", topicID)
	}

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

// 機能A: 宿泊日変更のTelegram通知
// 既存の日付が存在し、チェックイン/アウト日が変わった場合のみ通知する
func notifyDateChange(record events.DynamoDBEventRecord) error {
	if record.EventName != "MODIFY" {
		return nil
	}

	newImage := record.Change.NewImage
	oldImage := record.Change.OldImage

	oldCheckIn := getStringAttr(oldImage, "checkInDate")
	newCheckIn := getStringAttr(newImage, "checkInDate")
	oldCheckOut := getStringAttr(oldImage, "checkOutDate")
	newCheckOut := getStringAttr(newImage, "checkOutDate")

	if oldCheckIn == "" || (newCheckIn == oldCheckIn && newCheckOut == oldCheckOut) {
		return nil
	}

	roomNumber := getStringAttr(newImage, "roomNumber")
	guestID := getStringAttr(newImage, "guestId")
	guestName := getStringAttr(newImage, "guestName")
	bookingID := getStringAttr(newImage, "bookingId")

	if newCheckIn == "" {
		newCheckIn = "-"
	}
	if newCheckOut == "" {
		newCheckOut = "-"
	}

	message := fmt.Sprintf(
		"📅 Room (%s) の %s さんが宿泊日の変更をリクエストしました。\n"+
			"変更前: %s 〜 %s\n"+
			"変更後: %s 〜 %s\n\n"+
			"%s/%s/%s",
		roomNumber, guestName,
		oldCheckIn, oldCheckOut,
		newCheckIn, newCheckOut,
		adminBaseURL, roomNumber, bookingID,
	)

	if err := sendTelegram(message, telegramTopicDateChange); err != nil {
		log.Printf("❌ Error sending date change telegram for guest %s: %v", guestID, err)
		return err
	}
	log.Printf("✅ Sent date change Telegram message for guest %s", guestID)
	return nil
}

// 機能B: approvalStatus が pending に遷移した場合のTelegram通知
// 代表者ゲストのみ通知する
func notifyApprovalPending(record events.DynamoDBEventRecord) error {
	newImage := record.Change.NewImage
	oldImage := record.Change.OldImage

	newStatus := getStringAttr(newImage, "approvalStatus")
	oldStatus := getStringAttr(oldImage, "approvalStatus")

	if oldStatus == "" || oldStatus == "pending" || newStatus != "pending" {
		log.Printf("Skipping pending-check for record. new_status: %s, old_status: %s", newStatus, oldStatus)
		return nil
	}

	// sessionの代表者のみ sessionTokenHash を持つ
	if getStringAttr(newImage, "sessionTokenHash") == "" {
		log.Printf("Skipping non-representative record for guest %s", getStringAttr(newImage, "guestId"))
		return nil
	}

	roomNumber := getStringAttr(newImage, "roomNumber")
	guestID := getStringAttr(newImage, "guestId")
	guestName := getStringAttr(newImage, "guestName")
	checkIn := getStringAttr(newImage, "checkInDate")
	checkOut := getStringAttr(newImage, "checkOutDate")
	bookingID := getStringAttr(newImage, "bookingId")

	if checkIn == "" {
		checkIn = "-"
	}
	if checkOut == "" {
		checkOut = "-"
	}

	message := fmt.Sprintf(
		"Room (%s) の %s さんが基本情報の登録と、IDの写真をアップロードしました。\n"+
			"Admin Pageより確認してください:\n"+
			"滞在日: %s ~ %s\n\n"+
			"%s/%s/%s",
		roomNumber, guestName, checkIn, checkOut, adminBaseURL, roomNumber, bookingID,
	)

	if err := sendTelegram(message, telegramTopicApproval); err != nil {
		log.Printf("❌ Error sending telegram for guest %s: %v", guestID, err)
		// バッチサイズ1前提、例外で当該レコードのみ再試行
		return err
	}
	log.Printf("✅ Sent Telegram message for guest %s", guestID)
	return nil
}

// Lambda ハンドラー
func HandleRequest(ctx context.Context, event events.DynamoDBEvent) error {
	log.Printf("Processing %d DynamoDB Stream records", len(event.Records))

	for _, record := range event.Records {
		if err := notifyDateChange(record); err != nil {
			return err
		}
		if err := notifyApprovalPending(record); err != nil {
			return err
		}
	}

	return nil
}

func main() {
	lambda.Start(HandleRequest)
}
