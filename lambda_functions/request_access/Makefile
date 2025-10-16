.PHONY: build-RequestAccessFunction

build-RequestAccessFunction:
	GOOS=linux GOARCH=amd64 CGO_ENABLED=0 go build -tags lambda.norpc -o $(ARTIFACTS_DIR)/bootstrap .
