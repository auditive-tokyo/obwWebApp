#!/bin/bash

# 設定（必要に応じて変更）
TARGET_FILE_ID="file-W8tfSP2EuZdEeGFfrpEV5q"  # アップロード済みファイルIDをここに
ROOM_NUMBER="201"

# .envファイルの読み込み
ENV_FILE=".env"
if [ -f "$ENV_FILE" ]; then
  export $(grep -v '^#' "$ENV_FILE" | xargs)
else
  echo "Error: $ENV_FILE not found."
  exit 1
fi

# 必須環境変数チェック
if [ -z "$OPENAI_API_KEY" ]; then
  echo "Error: OPENAI_API_KEY is not set in $ENV_FILE."
  exit 1
fi

if [ -z "$TEST_VECTOR_STORE_ID" ]; then
  echo "Error: TEST_VECTOR_STORE_ID is not set in $ENV_FILE."
  exit 1
fi

echo "Attaching file $TARGET_FILE_ID to Vector Store $TEST_VECTOR_STORE_ID with room_number=$ROOM_NUMBER"

curl -X POST "https://api.openai.com/v1/vector_stores/${TEST_VECTOR_STORE_ID}/files" \
  -H "Authorization: Bearer ${OPENAI_API_KEY}" \
  -H "Content-Type: application/json" \
  -H "OpenAI-Beta: assistants=v2" \
  -d "{
        \"file_id\": \"${TARGET_FILE_ID}\",
        \"attributes\": {
            \"room_number\": \"${ROOM_NUMBER}\"
        }
      }"

echo -e "\nCommand execution finished."