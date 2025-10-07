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

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/session"
	"github.com/aws/aws-sdk-go/service/s3"
)

var (
	s3client *s3.S3
	// 英数字とハイフン/アンダースコア/ピリオドだけ残す
	filenameSanitizeRe = regexp.MustCompile(`[^A-Za-z0-9._-]`)
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
	// セッションとS3クライアントをモジュール初期化で作る（handler毎に作らない）
	sess := session.Must(session.NewSession())
	s3client = s3.New(sess)
}

func sanitizeFilename(fn string) string {
	fn = path.Base(fn)
	fn = filenameSanitizeRe.ReplaceAllString(fn, "_")
	if len(fn) > 255 {
		fn = fn[:255]
	}
	return fn
}

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

	filename := sanitizeFilename(getStr("filename"))
	if filename == "" {
		return PresignResponse{}, errors.New("filename is required")
	}
	roomId := getStr("roomId")
	if roomId == "" {
		roomId = "unknown"
	}
	timestamp := getStr("timestamp")
	if timestamp == "" {
		timestamp = time.Now().UTC().Format("20060102T150405Z")
	}
	contentType := getStr("contentType")
	if contentType == "" {
		contentType = guessContentTypeByExt(filename)
	}

	bucket := os.Getenv("UPLOAD_BUCKET")
	if bucket == "" {
		return PresignResponse{}, errors.New("UPLOAD_BUCKET env missing")
	}

	s3Key := fmt.Sprintf("%s/%s/%s", roomId, timestamp, filename)

	// Put URL (Presign)
	putReq, _ := s3client.PutObjectRequest(&s3.PutObjectInput{
		Bucket:      aws.String(bucket),
		Key:         aws.String(s3Key),
		ContentType: aws.String(contentType),
	})
	putUrl, err := putReq.Presign(3600 * time.Second)
	if err != nil {
		return PresignResponse{}, fmt.Errorf("failed to presign put: %w", err)
	}

	// Get URL
	getReq, _ := s3client.GetObjectRequest(&s3.GetObjectInput{
		Bucket: aws.String(bucket),
		Key:    aws.String(s3Key),
	})
	getUrl, err := getReq.Presign(3600 * time.Second)
	if err != nil {
		return PresignResponse{}, fmt.Errorf("failed to presign get: %w", err)
	}

	baseUrl := fmt.Sprintf("https://%s.s3.amazonaws.com/%s", bucket, s3Key)

	return PresignResponse{
		PutUrl:  putUrl,
		GetUrl:  getUrl,
		BaseUrl: baseUrl,
	}, nil
}

func main() {
	lambda.Start(handler)
}
