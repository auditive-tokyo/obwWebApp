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

1. プロジェクト構造を `tree -I 'node_modules|.venv|venv|docs' -L 3` で確認
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

### 機能 A': ゲスト側通知専用 Lambda の新設（低優先・要検討）

> 現状: DynamoDB Streams + `notify_admin` Lambda でフィルタ `approvalStatus IN [waitingForBasicInfo, waitingForPassportImage]` により通知。  
> **課題**: Admin が `waitingForPassportImage` ステータスのゲストの日付を変更した場合、誤通知が発生しうる。

- [ ] ゲスト側からの変更（宿泊日変更・人数追加）専用の通知 Lambda を新設することを検討する
  - 変更元を確実に区別する唯一の方法: `updateRoomCheckDates()`（ゲスト側）完了後に AppSync mutation 経由で Lambda を呼び出す
  - これにより DynamoDB Streams のフィルタへの依存をなくし、Admin 変更による誤通知を完全に排除できる
  - ただし実装コスト（mutation 定義・resolver・template・IAM 変更）が高く、現状の誤通知リスクが低いため優先度は低い
  - 同 Lambda で宿泊人数変更通知も将来的に統合できる

### 機能 C: 緊急対応履歴の CSV 出力

- [ ] Telegram に届いた緊急対応内容を集計して CSV に出力する機能を実装する
  - 対象データ: 緊急メッセージの本文、受信日時、対処者（未定）、対処ステータスなど
  - 出力形式: CSV（BOM 付き UTF-8 推奨、Excel での開きやすさのため）
  - 出力手段: Admin ページからダウンロード or S3 経由（要検討）

---

## 🗂️ TODO — Telegram 設定・拡張

> Telegram 側の設定作業 → コード実装の順で進める。

### Step 1: カスタム絵文字スタンプセットの作成（Telegram アプリ上）

- [ ] Telegram アプリで `@Stickers` と**個人チャット**を開く
- [ ] `/newemojipack` を送信してカスタム絵文字パックを作成する
  - 担当者ごとのアイコン画像（100×100px 推奨、PNG/WebP）を用意して送信
  - 各画像に対して絵文字（例: 👤）を関連づける
  - `/publish` で公開して絵文字パック ID を控える

### Step 2: 既存グループをスーパーグループ（フォーラムモード）に変換（Telegram アプリ上）

- [x] Admin Telegram グループを開く → 「グループ設定を編集」
- [x] 「トピック」をオンにする（自動的にスーパーグループに昇格）
  - ⚠️ 既存メッセージはそのまま残る。chat_id は変わらない場合が多いが念のため確認する

### Step 3: トピックを 3 つ作成して ID を控える（Telegram アプリ上）

- [x] 以下の 3 トピックを手動で作成する

  | トピック名 | 用途 | 環境変数名 | message_thread_id |
  |-----------|------|-----------|-------------------|
  | `Approval` | `approvalStatus → pending` 遷移時の通知 | `TELEGRAM_TOPIC_ID_APPROVAL` | `3` |
  | `Emergency` | Twilio 経由の緊急電話通知 | `TELEGRAM_TOPIC_ID_EMERGENCY` | `5` |
  | `Change Requests` | ゲストによる宿泊日変更通知 | `TELEGRAM_TOPIC_ID_DATE_CHANGE` | `8` |
  | （共通） | chat_id | `TELEGRAM_CHAT_ID` | `-1003740916969` |

- [x] 各トピックの `message_thread_id` を確認する（Telegram Web URL の `_` 以降の数字で確認済み）

### Step 4: カスタム絵文字をグループのリアクション許可リストに追加（Telegram アプリ上）

- [ ] グループ設定 → 「リアクション」→ 「カスタム絵文字」から Step 1 で作成したパックを追加する
  - これにより **非 Premium メンバー全員**がそのカスタム絵文字でリアクション可能になる
  - 緊急メッセージへの対処完了時に、担当者が自分の絵文字でリアクションする運用で「誰が対処したか」を記録できる

### Step 5: SAM テンプレートに環境変数を追加（コード）

- [x] `template-dynamostreams-actions.yaml` の `NotifyAdminOnPendingFunction` に以下を追加した
  ```yaml
  TELEGRAM_TOPIC_ID_APPROVAL: "3"
  TELEGRAM_TOPIC_ID_EMERGENCY: "5"
  TELEGRAM_TOPIC_ID_DATE_CHANGE: "8"
  ```

### Step 6: notify_admin/main.go のトピック別送信対応（コード）

- [x] `sendTelegram()` 関数に `topicID string` 引数を追加した
- [x] `topicID != ""` の場合のみ `message_thread_id` を HTTP リクエストボディに含めるようにした
- [x] `notifyApprovalPending()` → `telegramTopicApproval`（トピックID: 3）トピックへ送信
- [x] `notifyDateChange()` → `telegramTopicDateChange`（トピックID: 8）トピックへ送信
