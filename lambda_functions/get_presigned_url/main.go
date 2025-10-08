package main

import (
	"context"
	"errors"
	"fmt"
	"os"
	"path"
	"regexp"
	"strings"
	"time"

	"github.com/aws/aws-lambda-go/lambda"
	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/s3"
)

var (
	s3client        *s3.Client
	s3presignClient *s3.PresignClient
)

// AppSync-style input shape
type InputEvent struct {
	Arguments struct {
		Input map[string]interface{} `json:"input"`
	} `json:"arguments"`
}

// Response shape
type PresignResponse struct {
	PutUrl  string `json:"putUrl"`
	GetUrl  string `json:"getUrl"`
	BaseUrl string `json:"baseUrl"`
}

func init() {
	// AWS SDK v2の設定ロードとクライアント初期化（handler毎に作らない）
	cfg, err := config.LoadDefaultConfig(context.Background())
	if err != nil {
		panic(fmt.Sprintf("unable to load SDK config: %v", err))
	}
	s3client = s3.NewFromConfig(cfg)
	s3presignClient = s3.NewPresignClient(s3client)
}

func sanitizeFilename(fn string) string {
	// Trim, normalize common user mistakes, and cap length to S3 limits.
	// - remove surrounding whitespace
	// - collapse spaces immediately before a dot (" foo .jpg" -> "foo.jpg")
	// - replace remaining spaces with underscores
	// - replace slashes with underscores to avoid accidental path segments
	fn = strings.TrimSpace(fn)
	// collapse spaces before dot
	fn = regexp.MustCompile(`\s+\.`).ReplaceAllString(fn, ".")
	// replace slashes
	fn = strings.ReplaceAll(fn, "/", "_")
	// replace remaining spaces with underscore
	fn = strings.ReplaceAll(fn, " ", "_")
	if fn == "" {
		return "unnamed"
	}
	if len(fn) > 255 {
		fn = fn[:255]
	}
	return fn
}

// escapedS3Path removed: use simple key and front-end validation/encoding if needed

func guessContentTypeByExt(fn string) string {
	ext := strings.ToLower(path.Ext(fn))
	switch ext {
	case ".jpg", ".jpeg":
		return "image/jpeg"
	case ".png":
		return "image/png"
	case ".gif":
		return "image/gif"
	default:
		return "application/octet-stream"
	}
}

func handler(ctx context.Context, event InputEvent) (PresignResponse, error) {
	input := event.Arguments.Input
	if input == nil {
		return PresignResponse{}, errors.New("input is required")
	}

	getStr := func(k string) string {
		if v, ok := input[k]; ok && v != nil {
			return fmt.Sprintf("%v", v)
		}
		return ""
	}

	rawFilename := getStr("filename")
	if rawFilename == "" {
		return PresignResponse{}, errors.New("filename is required")
	}
	// normalize filename: replace any slashes with underscore then sanitize
	filename := sanitizeFilename(strings.ReplaceAll(rawFilename, "/", "_"))
	roomId := getStr("roomId")
	if roomId == "" {
		roomId = "unknown"
	}
	// Prefer client-provided timestamp (expected to be JST if client follows spec).
	// If missing or empty, fall back to server-generated Japan time (UTC+9).
	clientTs := getStr("timestamp")
	var timestamp string
	if clientTs != "" {
		// sanitize timestamp to remove problematic chars (keep 0-9, T, -, and Z if present)
		ts := regexp.MustCompile(`[^0-9TtZz-]`).ReplaceAllString(clientTs, "")
		timestamp = ts
	} else {
		timestamp = time.Now().UTC().Add(9 * time.Hour).Format("20060102T150405")
	}
	contentType := getStr("contentType")
	if contentType == "" {
		contentType = guessContentTypeByExt(filename)
	}

	// If filename ends with .jpg, prefer image/jpeg content type to keep S3 object metadata consistent
	if strings.HasSuffix(strings.ToLower(filename), ".jpg") {
		contentType = "image/jpeg"
	}

	bucket := os.Getenv("UPLOAD_BUCKET")
	if bucket == "" {
		return PresignResponse{}, errors.New("UPLOAD_BUCKET env missing")
	}

	// filename will not contain '/', construct key as roomId/timestamp/filename
	s3Key := fmt.Sprintf("%s/%s/%s", roomId, timestamp, filename)

	// Put URL (Presign) - AWS SDK v2
	putPresigned, err := s3presignClient.PresignPutObject(ctx, &s3.PutObjectInput{
		Bucket:      aws.String(bucket),
		Key:         aws.String(s3Key),
		ContentType: aws.String(contentType),
	}, s3.WithPresignExpires(3600*time.Second))
	if err != nil {
		return PresignResponse{}, fmt.Errorf("failed to presign put: %w", err)
	}

	// Get URL - AWS SDK v2
	getPresigned, err := s3presignClient.PresignGetObject(ctx, &s3.GetObjectInput{
		Bucket: aws.String(bucket),
		Key:    aws.String(s3Key),
	}, s3.WithPresignExpires(3600*time.Second))
	if err != nil {
		return PresignResponse{}, fmt.Errorf("failed to presign get: %w", err)
	}

	baseUrl := fmt.Sprintf("https://%s.s3.amazonaws.com/%s", bucket, s3Key)

	return PresignResponse{
		PutUrl:  putPresigned.URL,
		GetUrl:  getPresigned.URL,
		BaseUrl: baseUrl,
	}, nil
}

func main() {
	lambda.Start(handler)
}
