package main

import (
	"bytes"
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"math/big"
	"net/http"
	"os"
	"strconv"
	"time"

	"github.com/aws/aws-lambda-go/lambda"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb/types"
	"github.com/aws/aws-sdk-go-v2/service/sns"
	"github.com/google/uuid"
)

var (
	dynamoClient *dynamodb.Client
	snsClient    *sns.Client
	tableName    string
	appBaseURL   = "https://app.osakabaywheel.com"
	mailFrom     = "osakabaywheel4224@gmail.com"
	sendGridKey  string
)

type RequestAccessInput struct {
	RoomNumber     string `json:"roomNumber"`
	GuestName      string `json:"guestName"`
	Email          string `json:"email"`
	Phone          string `json:"phone"`
	ContactChannel string `json:"contactChannel"` // "email" or "sms"
	Lang           string `json:"lang"`
}

type Event struct {
	Arguments struct {
		Input RequestAccessInput `json:"input"`
	} `json:"arguments"`
}

type Response struct {
	Success bool   `json:"success"`
	GuestID string `json:"guestId,omitempty"`
	Error   string `json:"error,omitempty"`
}

func init() {
	cfg, err := config.LoadDefaultConfig(context.Background())
	if err != nil {
		panic(fmt.Sprintf("unable to load SDK config: %v", err))
	}
	dynamoClient = dynamodb.NewFromConfig(cfg)
	snsClient = sns.NewFromConfig(cfg)

	tableName = os.Getenv("TABLE_NAME")
	sendGridKey = os.Getenv("SENDGRID_API_KEY")
}

// generateToken generates a URL-safe base64 encoded random token
func generateToken() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.URLEncoding.EncodeToString(b), nil
}

// hashToken returns SHA256 hash of the token
func hashToken(token string) string {
	h := sha256.Sum256([]byte(token))
	return fmt.Sprintf("%x", h)
}

// nowISOmsZ returns current time in ISO8601 format with milliseconds and Z suffix
func nowISOmsZ() string {
	return time.Now().UTC().Format("2006-01-02T15:04:05.000Z")
}

// generateBookingID generates a random alphanumeric ID of given length
func generateBookingID(length int) (string, error) {
	alphabet := "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
	result := make([]byte, length)
	for i := range result {
		n, err := rand.Int(rand.Reader, big.NewInt(int64(len(alphabet))))
		if err != nil {
			return "", err
		}
		result[i] = alphabet[n.Int64()]
	}
	return string(result), nil
}

// sendViaSendGrid sends email via SendGrid API
func sendViaSendGrid(toEmail, subject, textBody string) error {
	if sendGridKey == "" {
		return fmt.Errorf("Missing SENDGRID_API_KEY env")
	}

	payload := map[string]interface{}{
		"personalizations": []map[string]interface{}{
			{
				"to":      []map[string]string{{"email": toEmail}},
				"subject": subject,
			},
		},
		"from": map[string]string{"email": mailFrom},
		"content": []map[string]string{
			{"type": "text/plain", "value": textBody},
		},
	}

	data, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("json marshal error: %w", err)
	}

	req, err := http.NewRequest("POST", "https://api.sendgrid.com/v3/mail/send", bytes.NewBuffer(data))
	if err != nil {
		return fmt.Errorf("request creation error: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+sendGridKey)
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("SendGrid URLError: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 && resp.StatusCode != 202 {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("SendGrid HTTPError %d: %s", resp.StatusCode, string(body))
	}

	return nil
}

// buildEmailBody builds the email body based on language
func buildEmailBody(lang, link string) string {
	if lang == "ja" {
		return fmt.Sprintf(
			"ゲストページへのアクセスリンクです:\n"+
				"%s\n\n"+
				"このリンクは大切に保管してください。同じ部屋に宿泊するご家族・ご友人以外には共有しないでください。\n\n"+
				"複数のデバイスやブラウザからアクセスする場合も、このリンクを開くことでセッションを復元できます。\n\n"+
				"注意: 基本情報の入力が完了しないまま24時間経過するとこのリンクは無効になります。\n"+
				"基本情報送信後は、同じリンクで再アクセスしてセッションを復元できます。\n",
			link)
	}
	// default English
	return fmt.Sprintf(
		"Guest page access link:\n"+
			"%s\n\n"+
			"Please keep this link secure. Do NOT share it with anyone except family or companions staying in the same room.\n\n"+
			"If you use multiple devices or browsers, opening this link restores your session.\n\n"+
			"Note: If you do NOT complete the basic information within 24 hours, this link becomes invalid.\n"+
			"After submitting the basic information you can still revisit using the same link to restore your session.\n",
		link)
}

// buildSMS builds the SMS message based on language
func buildSMS(lang, link string) string {
	if lang == "ja" {
		return fmt.Sprintf(
			"【Osaka Bay Wheel】\n"+
				"ご宿泊ありがとうございます。\n"+
				"こちらのリンクより安全に本人確認書類をアップロードいただけます:\n"+
				"%s",
			link)
	}
	return fmt.Sprintf(
		"[Osaka Bay Wheel]\n"+
			"Thank you for staying with us.\n"+
			"Please securely upload your ID via this link:\n"+
			"%s",
		link)
}

func HandleRequest(ctx context.Context, event Event) (Response, error) {
	input := event.Arguments.Input
	roomNumber := input.RoomNumber
	guestName := input.GuestName
	email := input.Email
	phone := input.Phone
	contactChannel := input.ContactChannel
	lang := input.Lang

	// Default language
	if lang == "" {
		lang = "en"
	}

	// Validate required fields
	if roomNumber == "" || guestName == "" || email == "" || phone == "" {
		return Response{Success: false, Error: "Missing required fields"}, nil
	}

	if contactChannel == "email" && email == "" {
		return Response{Success: false, Error: "Email required for contactChannel=email"}, nil
	}
	if contactChannel == "sms" && phone == "" {
		return Response{Success: false, Error: "Phone required for contactChannel=sms"}, nil
	}

	// Generate guest ID and token
	guestID := uuid.New().String()
	token, err := generateToken()
	if err != nil {
		return Response{Success: false, Error: fmt.Sprintf("Token generation failed: %v", err)}, nil
	}
	tokenHash := hashToken(token)

	// TTL and booking ID
	now := time.Now().Unix()
	pendingVerificationTTL := now + 86400 // 24h
	bookingID, err := generateBookingID(11)
	if err != nil {
		return Response{Success: false, Error: fmt.Sprintf("BookingID generation failed: %v", err)}, nil
	}

	// DynamoDB put item
	_, err = dynamoClient.PutItem(ctx, &dynamodb.PutItemInput{
		TableName: &tableName,
		Item: map[string]types.AttributeValue{
			"roomNumber":             &types.AttributeValueMemberS{Value: roomNumber},
			"guestId":                &types.AttributeValueMemberS{Value: guestID},
			"guestName":              &types.AttributeValueMemberS{Value: guestName},
			"email":                  &types.AttributeValueMemberS{Value: email},
			"phone":                  &types.AttributeValueMemberS{Value: phone},
			"sessionTokenHash":       &types.AttributeValueMemberS{Value: tokenHash},
			"approvalStatus":         &types.AttributeValueMemberS{Value: "pendingVerification"},
			"pendingVerificationTtl": &types.AttributeValueMemberN{Value: strconv.FormatInt(pendingVerificationTTL, 10)},
			"createdAt":              &types.AttributeValueMemberS{Value: nowISOmsZ()},
			"contactChannel":         &types.AttributeValueMemberS{Value: contactChannel},
			"bookingId":              &types.AttributeValueMemberS{Value: bookingID},
		},
	})
	if err != nil {
		return Response{Success: false, Error: fmt.Sprintf("DynamoDB put failed: %v", err)}, nil
	}

	// Send link via SMS or Email
	if contactChannel == "sms" {
		link := fmt.Sprintf("%s/room/%s?guestId=%s&token=%s&source=sms", appBaseURL, roomNumber, guestID, token)
		smsBody := buildSMS(lang, link)
		_, err = snsClient.Publish(ctx, &sns.PublishInput{
			PhoneNumber: &phone,
			Message:     &smsBody,
		})
		if err != nil {
			return Response{Success: false, Error: fmt.Sprintf("SMS send failed: %v", err)}, nil
		}
	} else {
		link := fmt.Sprintf("%s/room/%s?guestId=%s&token=%s", appBaseURL, roomNumber, guestID, token)
		if contactChannel == "email" {
			subject := "Osaka Bay Wheel Guest Access"
			if lang == "ja" {
				subject = "Osaka Bay Wheel ゲストアクセス"
			}
			textBody := buildEmailBody(lang, link)
			if err := sendViaSendGrid(email, subject, textBody); err != nil {
				return Response{Success: false, Error: fmt.Sprintf("Email send failed: %v", err)}, nil
			}
		}
	}

	return Response{Success: true, GuestID: guestID}, nil
}

func main() {
	lambda.Start(HandleRequest)
}
