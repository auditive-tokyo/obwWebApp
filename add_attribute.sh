#!/bin/bash

# 既存のファイルにattributeを追加するスクリプト

# 対象のFile ID (必要に応じて変更)
TARGET_FILE_ID="file-FEfi4gVxj8Zfsbf4rRu6AS"

# .envファイルが存在するか確認し、存在すれば読み込む
ENV_FILE=".env"
if [ -f "$ENV_FILE" ]; then
  echo "Loading environment variables from $ENV_FILE"
  export $(grep -v '^#' "$ENV_FILE" | xargs)
else
  echo "Error: $ENV_FILE not found."
  exit 1
fi

# 環境変数が設定されているか確認
if [ -z "$OPENAI_API_KEY" ]; then
  echo "Error: OPENAI_API_KEY is not set in $ENV_FILE."
  exit 1
fi

if [ -z "$TEST_VECTOR_STORE_ID" ]; then
  echo "Error: TEST_VECTOR_STORE_ID is not set in $ENV_FILE."
  exit 1
fi

echo "Updating attributes for File ID: $TARGET_FILE_ID in Vector Store: $TEST_VECTOR_STORE_ID"

curl -X POST "https://api.openai.com/v1/vector_stores/${TEST_VECTOR_STORE_ID}/files/${TARGET_FILE_ID}" \
  -H "Authorization: Bearer ${OPENAI_API_KEY}" \
  -H "Content-Type: application/json" \
  -H "OpenAI-Beta: assistants=v2" \
  -d '{
        "attributes": {
            "room_number": "201"
        }
      }'

echo -e "\nCommand execution finished."