.PHONY: build-dailyS3BackupFunction

build-dailyS3BackupFunction:
	GOOS=linux GOARCH=amd64 CGO_ENABLED=0 go build -tags lambda.norpc -o $(ARTIFACTS_DIR)/bootstrap .
