package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"
)

var (
	telegramBotToken string
	telegramChatID   string
)

func init() {
	telegramBotToken = os.Getenv("TELEGRAM_BOT_TOKEN")
	telegramChatID = os.Getenv("TELEGRAM_CHAT_ID")
}

// DynamoDB Streamから文字列属性を取得
func getStringAttr(attrs map[string]events.DynamoDBAttributeValue, key string) string {
	if attr, ok := attrs[key]; ok && attr.DataType() == events.DataTypeString {
		return attr.String()
	}
	return ""
}

// SK "YYYY-MM-DD#ISO-timestamp#messageId" の末尾から message_id を取得
func parseMessageID(dateIncidentId string) (int, error) {
	parts := strings.Split(dateIncidentId, "#")
	if len(parts) < 3 {
		return 0, fmt.Errorf("unexpected SK format: %s", dateIncidentId)
	}
	msgID, err := strconv.Atoi(parts[len(parts)-1])
	if err != nil {
		return 0, fmt.Errorf("failed to parse message_id from SK %s: %w", dateIncidentId, err)
	}
	return msgID, nil
}

// Telegram setMessageReaction でリアクションを設定（空スライスで削除）
func setReaction(messageID int, reactions []map[string]string) error {
	if telegramBotToken == "" || telegramChatID == "" {
		return fmt.Errorf("TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID is not set")
	}

	apiURL := fmt.Sprintf("https://api.telegram.org/bot%s/setMessageReaction", telegramBotToken)

	payload := map[string]interface{}{
		"chat_id":    telegramChatID,
		"message_id": messageID,
		"reaction":   reactions,
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("failed to marshal payload: %w", err)
	}

	req, err := http.NewRequest("POST", apiURL, bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to call Telegram API: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		var buf bytes.Buffer
		buf.ReadFrom(resp.Body)
		return fmt.Errorf("setMessageReaction failed: status=%d body=%s", resp.StatusCode, buf.String())
	}
	return nil
}

func processRecord(record events.DynamoDBEventRecord) {
	if record.EventName != "MODIFY" {
		return
	}

	newProgress := getStringAttr(record.Change.NewImage, "progress")
	oldProgress := getStringAttr(record.Change.OldImage, "progress")

	isClosed := newProgress == "closed" && oldProgress != "closed"
	isReopened := oldProgress == "closed" && newProgress != "closed"
	if !isClosed && !isReopened {
		return
	}

	dateIncidentId := getStringAttr(record.Change.NewImage, "dateIncidentId")
	if dateIncidentId == "" {
		log.Printf("WARN: dateIncidentId is empty, skipping")
		return
	}

	msgID, err := parseMessageID(dateIncidentId)
	if err != nil {
		log.Printf("ERROR: %v", err)
		return
	}

	var reactions []map[string]string
	if isClosed {
		reactions = []map[string]string{{"type": "emoji", "emoji": "👍"}}
		log.Printf("Incident closed: %s (message_id=%d) → 👍", dateIncidentId, msgID)
	} else {
		reactions = []map[string]string{}
		log.Printf("Incident reopened: %s (message_id=%d) → remove reaction", dateIncidentId, msgID)
	}

	if err := setReaction(msgID, reactions); err != nil {
		log.Printf("ERROR: setReaction failed for message_id=%d: %v", msgID, err)
		return
	}

	log.Printf("reaction updated on message_id=%d", msgID)
}

func handler(_ context.Context, event events.DynamoDBEvent) error {
	for _, record := range event.Records {
		processRecord(record)
	}
	return nil
}

func main() {
	lambda.Start(handler)
}
