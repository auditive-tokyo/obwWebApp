# obwWebApp プロジェクト構造

## 概要

Osaka Bay Wheel Guest チェックイン・アクセス管理システムのコードベース。
GraphQL API (AppSync)、Lambda 関数、React フロントエンド、DynamoDB で構成。

## ディレクトリ構成

```
obwWebApp/
├── lambda_functions/           # AWS Lambda 関数群
│   ├── admin_approve_guest/    # ゲスト承認 (Go)
│   ├── ai_processing/          # Twilio（電話用）のAI 処理・分類 (Python)
│   ├── change_session_expiry/  # セッション有効期限変更 (Go)
│   ├── daily_records_cleanup/  # 日次レコード削除 (Go)
│   ├── daily_s3_backup/        # S3 日次バックアップ (Go)
│   ├── get_presigned_url/      # 署名付きURL 生成 (Go)
│   ├── immediate-response/     # Twilio（電話用）即座応答・音声処理 (Python)
│   ├── notify_admin/           # 管理者通知 (Go)
│   ├── request_access/         # アクセスリクエスト処理 (Go)
│   ├── ResponseApi/            # Response API (TypeScript)
│   ├── SummarizeInquiry/       # 問い合わせ要約 (TypeScript)
│   ├── sync_family_token_expiration/ # ファミリートークン有効期限同期 (Go)
│   ├── transfer_room_guests/   # 部屋移動 (Go)
│   └── verify_access_token/    # アクセストークン検証 (Go)
│
├── layers/                     # Lambda Layer 共有ライブラリ
│   ├── ResponseApi/            # Node.js 共有パッケージ
│   └── twilio_functions/       # Python 共有ユーティリティ (Twilio)
│
├── obw_react_app/              # React フロントエンド
│   ├── src/
│   │   ├── pages/              # ページコンポーネント
│   │   ├── components/         # 再利用可能なコンポーネント
│   │   ├── auth/               # 認証処理
│   │   ├── i18n/               # 多言語対応 (日本語は文字化けしている)
│   │   ├── utils/              # ユーティリティ関数
│   │   ├── types/              # TypeScript 型定義
│   │   ├── assets/             # 画像・リソース
│   │   └── header/             # ヘッダーコンポーネント
│   ├── public/                 # 静的ファイル (チェックイン、アクセスマップ)
│   ├── dist/                   # ビルド出力
│   └── package.json            # npm 依存関係
│
├── vector_db_files/            # AI 用ベクトルDB・参考資料
│   ├── AccessMap.md            # アクセスマップ情報
│   ├── FacilityGuide.md        # 施設ガイド
│   └── FrequentlyAskedQuestions.md # FAQ
│
└── template-*.yaml             # CloudFormation テンプレート
    ├── template-infra-appsync.yaml    # AppSync, DynamoDB, Cognito 構築
    ├── template-appsync-lambdas.yaml  # Lambda 関数とロール定義
    ├── template-daily-actions.yaml    # 日次実行タスク
    ├── template-dynamostreams-actions.yaml # DynamoDB Stream トリガー
    ├── template-responseapi-function.yaml  # Response API
    ├── template-security.yaml         # セキュリティ設定
    └── template-twilio-functions.yaml # Twilio 連携
```

## 主要サービス

### Lambda 関数 (lambda_functions/)

| 関数                 | 言語       | 役割                                                       |
| -------------------- | ---------- | ---------------------------------------------------------- |
| request_access       | Go         | ゲストアクセスリクエスト受付・SMS/Email送信                |
| verify_access_token  | Go         | アクセストークン検証                                       |
| admin_approve_guest  | Go         | 管理者によるゲスト承認                                     |
| transfer_room_guests | Go         | ゲストの部屋移動処理                                       |
| get_presigned_url    | Go         | S3 署名付きURL 生成                                        |
| ai_processing        | Python     | Twilio（電話用）のAI 処理・分類                            |
| immediate-response   | Python     | Twilio（電話用）即座応答・音声処理                         |
| ResponseApi          | TypeScript | ストリーミング応答処理（chatbot回答をchunk表示）           |
| SummarizeInquiry     | TypeScript | 問い合わせ内容の要約                                       |
| 日次タスク           | Go         | record cleanup, s3_backup, session expiry, token sync など |

### フロントエンド (obw_react_app/)

- **React + TypeScript**
- **Vite** ビルドシステム
- **Tailwind CSS** スタイリング
- **AWS Amplify** 認証・API
- **AppSync GraphQL** へのクエリ実行
- **多言語対応** (i18n)

### インフラ (CloudFormation)

- **AppSync GraphQL API** で全リソース統合
- **DynamoDB** ゲスト情報保存（複数 GSI 対応）
- **Cognito** ユーザー認証
- **S3** パスポート写真アップロード
- **SNS** SMS 通知
- **Lambda** サーバーレス処理

### AI/ベクトルDB (vector_db_files/)

- RAG (Retrieval Augmented Generation) 用参考資料
- 施設ガイド、FAQ、アクセスマップ情報

## 開発フロー

```
Frontend: React → AppSync GraphQL
     ↓
AppSync Resolver via Lambda DataSource
     ↓
Lambda Functions (Go/Python)
     ↓
DynamoDB / SNS / S3
```

## デプロイ方式

- **Frontend**: Vite ビルド → S3 へデプロイ
- **Lambda**: SAM/CloudFormation で管理
- **IaC**: CloudFormation テンプレート
- **リージョン**: ap-northeast-1 (東京)

---

## 📝 メンテナンスノート

**このファイルは自動更新対象です。以下の場合は AGENT.md を更新してください：**

- ✅ 新しい Lambda 関数が追加された場合
- ✅ Lambda 関数の役割や言語に変更があった場合
- ✅ ディレクトリ構造に新しいフォルダが追加された場合
- ✅ CloudFormation テンプレートが追加・削除された場合
- ✅ vector_db_files に新しいファイルが追加された場合
- ✅ 主要なライブラリやツールバージョンが更新された場合
- ✅ **実装と文書の内容が異なる場合**（重要）

**更新時の手順：**
1. プロジェクト構造を `tree -I 'node_modules|.venv|venv|docs' -L 3` で確認
2. 対応する表やセクションを更新
3. フォーマットの一貫性を保つ
4. 実装と文書のズレを解消

**最終更新**: 2026-02-12 (SMS 正常送信確認後)
