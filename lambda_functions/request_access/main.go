package main

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"crypto/tls"
	"encoding/base64"
	"fmt"
	"math/big"
	"net"
	"net/smtp"
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
	smtpServer   = "smtp.zoho.jp"
	smtpPort     = 465
	smtpUser     string
	smtpPassword string
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
	if tableName == "" {
		panic("TABLE_NAME environment variable is required")
	}

	smtpUser = os.Getenv("SMTP_USER")
	if smtpUser == "" {
		panic("SMTP_USER environment variable is required")
	}

	smtpPassword = os.Getenv("SMTP_PASSWORD")
	if smtpPassword == "" {
		panic("SMTP_PASSWORD environment variable is required")
	}
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

// sendViaZoho sends email via Zoho SMTP server
func sendViaZoho(toEmail, subject, textBody string) error {
	if smtpUser == "" || smtpPassword == "" {
		return fmt.Errorf("Missing SMTP_USER or SMTP_PASSWORD env")
	}

	// Build email message
	from := smtpUser
	to := toEmail

	// RFC 5322 format email
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
		return fmt.Errorf("Write error: %w", err)
	}

	err = w.Close()
	if err != nil {
		return fmt.Errorf("Close error: %w", err)
	}

	client.Quit()
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

// errorResponse creates an error response with the given message
func errorResponse(msg string) Response {
	return Response{Success: false, Error: msg}
}

// validateInput validates the request input fields
func validateInput(input RequestAccessInput) *Response {
	if input.RoomNumber == "" || input.GuestName == "" || input.Email == "" || input.Phone == "" {
		resp := errorResponse("Missing required fields")
		return &resp
	}
	if input.ContactChannel == "email" && input.Email == "" {
		resp := errorResponse("Email required for contactChannel=email")
		return &resp
	}
	if input.ContactChannel == "sms" && input.Phone == "" {
		resp := errorResponse("Phone required for contactChannel=sms")
		return &resp
	}
	return nil
}

// saveGuestToDynamoDB saves the guest record to DynamoDB
func saveGuestToDynamoDB(ctx context.Context, input RequestAccessInput, guestID, tokenHash, bookingID string, pendingVerificationTTL int64) error {
	_, err := dynamoClient.PutItem(ctx, &dynamodb.PutItemInput{
		TableName: &tableName,
		Item: map[string]types.AttributeValue{
			"roomNumber":             &types.AttributeValueMemberS{Value: input.RoomNumber},
			"guestId":                &types.AttributeValueMemberS{Value: guestID},
			"guestName":              &types.AttributeValueMemberS{Value: input.GuestName},
			"email":                  &types.AttributeValueMemberS{Value: input.Email},
			"phone":                  &types.AttributeValueMemberS{Value: input.Phone},
			"sessionTokenHash":       &types.AttributeValueMemberS{Value: tokenHash},
			"approvalStatus":         &types.AttributeValueMemberS{Value: "pendingVerification"},
			"pendingVerificationTtl": &types.AttributeValueMemberN{Value: strconv.FormatInt(pendingVerificationTTL, 10)},
			"createdAt":              &types.AttributeValueMemberS{Value: nowISOmsZ()},
			"contactChannel":         &types.AttributeValueMemberS{Value: input.ContactChannel},
			"bookingId":              &types.AttributeValueMemberS{Value: bookingID},
		},
	})
	return err
}

// sendViaSMS sends the access link via SMS using SNS
func sendViaSMS(ctx context.Context, phone, lang, link string) error {
	smsBody := buildSMS(lang, link)
	_, err := snsClient.Publish(ctx, &sns.PublishInput{
		PhoneNumber: &phone,
		Message:     &smsBody,
	})
	return err
}

// sendViaEmail sends the access link via email using Zoho SMTP
func sendViaEmail(email, lang, link string) error {
	subject := "Osaka Bay Wheel Guest Access"
	if lang == "ja" {
		subject = "Osaka Bay Wheel ゲストアクセス"
	}
	textBody := buildEmailBody(lang, link)
	return sendViaZoho(email, subject, textBody)
}

// sendNotification sends the access link via the specified contact channel
func sendNotification(ctx context.Context, input RequestAccessInput, guestID, token, lang string) error {
	if input.ContactChannel == "sms" {
		link := fmt.Sprintf("%s/room/%s?guestId=%s&token=%s&source=sms", appBaseURL, input.RoomNumber, guestID, token)
		return sendViaSMS(ctx, input.Phone, lang, link)
	}
	// Default to email
	link := fmt.Sprintf("%s/room/%s?guestId=%s&token=%s", appBaseURL, input.RoomNumber, guestID, token)
	if input.ContactChannel == "email" {
		return sendViaEmail(input.Email, lang, link)
	}
	return nil
}

func HandleRequest(ctx context.Context, event Event) (Response, error) {
	input := event.Arguments.Input

	// Default language
	lang := input.Lang
	if lang == "" {
		lang = "en"
	}

	// Validate required fields
	if validationErr := validateInput(input); validationErr != nil {
		return *validationErr, nil
	}

	// Generate guest ID and token
	guestID := uuid.New().String()
	token, err := generateToken()
	if err != nil {
		return errorResponse(fmt.Sprintf("Token generation failed: %v", err)), nil
	}
	tokenHash := hashToken(token)

	// TTL and booking ID
	now := time.Now().Unix()
	pendingVerificationTTL := now + 86400 // 24h
	bookingID, err := generateBookingID(11)
	if err != nil {
		return errorResponse(fmt.Sprintf("BookingID generation failed: %v", err)), nil
	}

	// DynamoDB put item
	if err := saveGuestToDynamoDB(ctx, input, guestID, tokenHash, bookingID, pendingVerificationTTL); err != nil {
		return errorResponse(fmt.Sprintf("DynamoDB put failed: %v", err)), nil
	}

	// Send link via SMS or Email
	if err := sendNotification(ctx, input, guestID, token, lang); err != nil {
		return errorResponse(fmt.Sprintf("Notification send failed: %v", err)), nil
	}

	return Response{Success: true, GuestID: guestID}, nil
}

func main() {
	lambda.Start(HandleRequest)
}
