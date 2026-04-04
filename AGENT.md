# obwWebApp プロジェクト構造

## 概要

Osaka Bay Wheel Guest チェックイン・アクセス管理システムのコードベース。
GraphQL API (AppSync)、Lambda 関数、React フロントエンド、DynamoDB で構成。

## ディレクトリ構成

> 以下のコマンドで再生成できます（バイナリ・生成物・lockファイルを除外）：
>
> ```bash
> tree -I 'node_modules|.venv|venv|dist|.git|__pycache__|*.pyc|bootstrap|bootstrap.zip|go.sum|go.mod|.DS_Store|coverage|*.pdf|*.png|*.webp|*.svg|*.jpeg|*.jpg|*.numbers|*.csv|package-lock.json' -L 4 --dirsfirst
> ```

```
.
├── docs/                            # 設計書・契約書・見積もりなど（コード管理外）
│
├── lambda_functions/                # AWS Lambda 関数群
│   ├── ResponseApi/                 # チャットボット応答 API (TypeScript)
│   │   └── codes/
│   │       ├── chat_handler.ts      # チャットフロー制御
│   │       ├── stream_response.ts   # OpenAI ストリーミング応答
│   │       ├── system_instructions.ts
│   │       └── operational_hours.ts
│   ├── SummarizeInquiry/            # 問い合わせ要約 + DynamoDB 保存 (TypeScript)
│   │   └── src/handler.ts
│   ├── admin_approve_guest/         # ゲスト承認 (Go)
│   ├── ai_processing/               # Twilio 電話用 AI 処理・分類 (Python)
│   ├── change_session_expiry/       # セッション有効期限変更 (Go)
│   ├── daily_records_cleanup/       # 日次レコード削除 (Go)
│   ├── daily_s3_backup/             # S3 日次バックアップ (Go)
│   ├── get_presigned_url/           # 署名付き URL 生成 (Go)
│   ├── immediate-response/          # Twilio 電話用即座応答・音声処理 (Python)
│   ├── notify_admin/                # 管理者 Telegram 通知 (Go)
│   ├── request_access/              # アクセスリクエスト処理 (Go)
│   ├── sync_family_token_expiration/ # ファミリートークン有効期限同期 (Go)
│   ├── transfer_room_guests/        # 部屋移動 (Go)
│   └── verify_access_token/         # アクセストークン検証 (Go)
│
├── layers/                          # Lambda Layer 共有ライブラリ
│   ├── ResponseApi/                 # Node.js 共有パッケージ
│   └── twilio_functions/            # Python 共有ユーティリティ (Twilio)
│
├── obw_react_app/                   # React フロントエンド
│   ├── src/
│   │   ├── auth/                    # Cognito 認証処理
│   │   ├── components/              # 再利用可能なコンポーネント（チャット UI 等）
│   │   ├── header/
│   │   ├── i18n/                    # 多言語対応
│   │   ├── pages/                   # ページコンポーネント
│   │   │   ├── adminpage/           # 管理者画面（ゲスト管理・緊急対応履歴）
│   │   │   ├── roompage/
│   │   │   ├── AdminPage.tsx
│   │   │   ├── GeneralPage.tsx
│   │   │   └── RoomPage.tsx
│   │   ├── types/
│   │   └── utils/
│   └── public/                      # 静的ファイル（チェックイン画像・アクセスマップ）
│
├── vector_db_files/                 # AI 用 RAG 参考資料
│   ├── AccessMap.md
│   ├── FacilityGuide.md
│   └── FrequentlyAskedQuestions.md
│
├── template-infra-appsync.yaml      # AppSync API・DynamoDB・Cognito 構築
├── template-incidents-appsync.yaml  # 緊急対応履歴テーブル・GSI・Resolver
├── template-appsync-lambdas.yaml    # Lambda 関数とロール定義
├── template-responseapi-function.yaml # Response API Lambda
├── template-daily-actions.yaml      # 日次実行タスク
├── template-dynamostreams-actions.yaml # DynamoDB Stream トリガー
├── template-security.yaml           # セキュリティ設定
├── template-twilio-functions.yaml   # Twilio 連携
└── AGENT.md
```

## 主要サービス

### Lambda 関数 (lambda_functions/)

- **lambda_functions/**配下に集約
- **言語ごとにセット**になっている
  - Streaming処理が必要な場合はTypeScript、Twilioの電話Lambda二つはPython、その他はGoで書く（よほどの理由が無い限りはGoを基本言語とする）

> **脆弱性チェック（Go言語）**
>
> | 方法    | コマンド                             | 用途                                 |
> | ------- | ------------------------------------ | ------------------------------------ |
> | **IDE** | `Go: Toggle Vulncheck` (Cmd+Shift+P) | 任意のタイミングで脆弱性スキャン実行 |

### フロントエンド (obw_react_app/)

- **React + TypeScript**
- **Vite** ビルドシステム
- **Tailwind CSS** スタイリング
- **AWS Amplify** 認証・API
- **AppSync GraphQL** へのクエリ実行
- **多言語対応** (i18n)

> **開発コマンド**
>
> | コマンド            | 用途                     | 詳細                               |
> | ------------------- | ------------------------ | ---------------------------------- |
> | `npm run dev`       | 開発サーバー起動         | ホットリロード対応、デバッグモード |
> | `npm run build`     | 本番ビルド               | TypeScript チェック → Vite ビルド  |
> | `npm run typecheck` | 型チェックのみ           | ファイル生成せず、型エラー検出     |
> | `npm run lint`      | コード品質チェック       | ESLint による静的解析              |
> | `npm run preview`   | 本番環境シミュレーション | dist/ ディレクトリをサーブ         |

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

- **Frontend**: Vite ビルド → GH Pages
- **Lambda**: SAM で管理
- **IaC**: SAM/CloudFormation テンプレート
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

1. 「ディレクトリ構成」セクションのコマンドでプロジェクト構造を確認する
2. 対応する表やセクションを更新
3. フォーマットの一貫性を保つ
4. 実装と文書のズレを解消

---

## 🗂️ TODO — AI チャットボット アーキテクチャ刷新

> 壁打ちで固めた設計方針に基づくタスクリスト。  
> 完了したものから `- [x]` に変える。

### Step 1: OpenAI Vector Store の再編成

- [ ] 施設案内用 Vector Store を作成し、`vector_db_files/FacilityGuide.md` と `vector_db_files/FrequentlyAskedQuestions.md` をアップロードする
- [ ] 交通・周辺・観光案内用 Vector Store を作成し、`vector_db_files/AccessMap.md` をアップロードする
- [ ] 各 Store ID を SAM テンプレートに環境変数として追加する
  - `OPENAI_VECTOR_STORE_ID_FACILITY`
  - `OPENAI_VECTOR_STORE_ID_TRANSPORT`

### Step 2: Intent Classifier の新規実装

- [ ] `lambda_functions/ResponseApi/codes/intent_classifier.ts` を新規作成する
  - モデル: `gpt-5.4-nano`（非ストリーミング）reasoning effort: low or medium（速度を見て決定）
  - 分類カテゴリ: `facility` / `transport_tourism` / `emergency` / `conversation` / `unknown`
  - `previous_response_id` を常に渡してコンテキストを維持する
  - 返り値は Intent 文字列のみ（シンプルに保つ）ただしjson schemaで回答を指定した方が余計な文章を含みづらい

### Step 3: Intent → Tools マッピング定義

- [ ] Intent ごとの tools 設定を定数として定義する（`chat_handler.ts` または専用ファイル）

  | Intent              | file_search | web_search | vector_store               |
  | ------------------- | ----------- | ---------- | -------------------------- |
  | `facility`          | ✅          | ❌         | store_facility             |
  | `transport_tourism` | ✅          | ✅         | store_transport            |
  | `unknown`           | ✅          | ✅         | 両方                       |
  | `emergency`         | ❌          | ❌         | なし（system prompt のみ） |
  | `conversation`      | ❌          | ❌         | なし                       |

### Step 4: stream_response.ts の改修

- [ ] `GenerateStreamResponseParams` に `intent` フィールドを追加する
- [ ] Intent に応じて `tools` と `vector_store_ids` を動的に切り替えるロジックを実装する
- [ ] Emergency 用 system prompt（緊急連絡先・初動対応手順）をファイル検索なしで直書きする

### Step 5: chat_handler.ts のフロー実装

- [ ] Step 1（Intent 分類）→ Step 2（ストリーミング応答）の 2 ステップフローを実装する
- [ ] `intent_classifier.ts` の呼び出しを `chat_handler.ts` に組み込む
- [ ] エラー時のフォールバック intent を `unknown` とする

### Step 6: System Prompt の整理

- [ ] `system_instructions.ts`（または相当ファイル）の system prompt を Intent 別に分割・整理する
  - 施設案内用（詳細情報は vector store 参照）
  - 交通・周辺観光用（web 検索結果を要約）
  - 緊急対応用（連絡先・初動手順を直書き、LLM 創作禁止）
  - 雑談用（ホスピタリティ重視の短い応答）

### Step 7: SAM テンプレートの更新

- [ ] `template-responseapi-function.yaml` に以下の環境変数を追加する
  - `OPENAI_VECTOR_STORE_ID_FACILITY`
  - `OPENAI_VECTOR_STORE_ID_TRANSPORT`
- [ ] 必要であれば IAM ポリシーを確認・更新する

### Step 8: テスト・検証

- [ ] 各 Intent カテゴリのサンプル入力でローカル動作を確認する
- [ ] Emergency フローで余計な LLM 創作が入らないことを検証する
- [ ] `previous_response_id` が正しく引き継がれ、会話コンテキストが維持されることを確認する

---

## 🗂️ TODO — 追加機能

> 壁打ちで固めた設計方針に基づくタスクリスト。  
> 完了したものから `- [x]` に変える。

### 機能 A: 宿泊人数の調整通知（検討中）

- [ ] 宿泊人数の調整通知については別途 OBW メンバーと検討する
  - 部屋ごとの最大宿泊者数に対して人数が増減した際の通知方式を決定する
  - DynamoDB には宿泊者数が直接記録されないため、実装方針から再検討が必要

### 機能 C: 緊急対応履歴の DynamoDB 管理

> S3+CSV 案から DynamoDB 方針に変更。Admin 画面でステータス管理・後追い更新が可能。

**DynamoDB テーブル設計 (`obw-incidents`)**

| 項目            | 内容                                                                              |
| --------------- | --------------------------------------------------------------------------------- |
| PK              | `entityType` = `"INCIDENT"`（固定）                                               |
| SK              | `dateIncidentId` = `"YYYY-MM-DD#ISO-timestamp#telegram-message-id"`               |
| GSI             | `ProgressIndex` — PK=`progress`, SK=`dateIncidentId`（未解決一覧の効率的取得用）  |
| Lambda 自動入力 | `roomId`, `guestName`, `issue`, `currentLocation`, `progress="open"`, `createdAt` |
| Admin 更新可能  | `staff`, `timeSpent`, `resolutionDate`, `solution`, `progress`                    |

SK を `date#timestamp#id` 形式にすることで、`BETWEEN "2026-04-01#" AND "2026-04-30~"` の1クエリで日付範囲取得が可能。
`ProgressIndex` GSI により `progress="open"` のみを効率的にクエリでき、全レコードスキャン不要。

**実装方針**

- 新規 Lambda 不要（既存 SummarizeInquiry に DynamoDB PutItem を追加）
- AppSync スキーマ拡張は `template-infra-appsync.yaml`（1 ファイルに 1 `GraphQLSchema` 制約）
- テーブル・DataSource・Resolver は新規 `template-incidents-appsync.yaml` に分離

**フロー**

```
SummarizeInquiry Lambda
  ├── Telegram 送信（既存・Emergency topic 5）
  └── DynamoDB PutItem（Lambda 自動入力項目のみ、progress="open"）

Admin フロントエンド
  ├── 一覧: listIncidents(dateFrom, dateTo) → AppSync → Query BETWEEN
  └── 更新: updateIncident(date, incidentId, staff, solution, ...) → AppSync → UpdateItem
```

**実装ステップ**

- [x] **C-1**: `template-infra-appsync.yaml` に `Incident` 型・`listIncidents`・`updateIncident` をスキーマ追加、`AppSyncApiId` を Export
- [x] **C-2**: `template-incidents-appsync.yaml` を新規作成（`obw-incidents` テーブル・DataSource・Resolver）
- [x] **C-3**: `SummarizeInquiry/src/handler.ts` に DynamoDB PutItem 追加、`template-responseapi-function.yaml` に権限追加
- [x] **C-4**: Admin フロントエンド（一覧表示・UpdateItem フォーム）
- [x] **C-5**: `ProgressIndex` GSI 追加、`listIncidentsByProgress` クエリ・Resolver 追加、フロント未解決セクション表示

---
