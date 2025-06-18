#!/bin/bash

# .envファイルの読み込み（必要なら）
source .env

FILE_PATH="/Volumes/AUDITIVE/GitHub/obwWebApp/vector_db_files/201OBWacceess.pdf"

curl https://api.openai.com/v1/files \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -H "OpenAI-Beta: assistants=v2" \
  -F "file=@${FILE_PATH}" \
  -F "purpose=assistants"