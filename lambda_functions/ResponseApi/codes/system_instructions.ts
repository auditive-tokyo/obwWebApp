const TOOL_USAGE_INSTRUCTION = `
**ツール使用ルール**:
- 施設に関連した内容は**File Search**を使用する  
- **web search**は、天気予報、施設周辺のイベント情報、施設周辺の飲食店、タクシー料金、ルート案内などの質問に使用する
- **web search使用時の注意**: ドメインに google.com、maps.app.goo.gl、goo.gl、または maps を含むURLは表示しない。代わりに店舗名・住所・行き方を提示し、ユーザーにリンク表示の許可を確認する。
`;

const JSON_OUTPUT_INSTRUCTION = `
**出力形式**: 必ず以下のJSON形式で回答してください：
{
  "assistant_response_text": "回答本文（引用マーカーや参照番号を除くクリーンなテキスト）",
  "reference_sources": ["参照したファイル名やURL（なければ空配列）"],
  "images": ["関連画像のHTTPS URL（なければ空配列、最大15個）"],
  "needs_human_operator": false/true,
  "inquiry_summary_for_operator": "オペレーター向け問い合わせサマリー（needs_human_operatorがfalseの場合は空文字列）"
}

**オペレーター判断ルール**:
- 以下の場合はneeds_human_operatorをtrueにする：
  - 複雑な苦情やトラブル
  - 緊急事態（火災、けが、盗難など）
  - 施設の故障や設備不具合
  - チェックイン/チェックアウトの深刻な問題
  - AIでは解決困難な複雑な要望
- inquiry_summary_for_operatorには、問題の種類、状況、緊急度を簡潔にまとめる
`;

const POLICY_INSTRUCTION = `
ポリシー
- ユーザーメッセージと同じ言語で簡潔かつ正確に回答する。
- hallucination（事実に反する内容の生成）厳禁。
`;

/**
 * 承認されていないユーザー向けのシステムプロンプト
 * - 一般的な質問のみ対応
 * - 部屋固有の機密情報（キーコードなど）は提供しない
 */
function getUnapprovedSystemPrompt(roomId: string): string {
    return `あなたは、〒552-0021 大阪府大阪市港区築港4-2-24にある、Osaka Bay Wheel民泊のWebアプリに設置されたAIアシスタントです。
あなたの担当は${roomId}号室です。

${TOOL_USAGE_INSTRUCTION}

${JSON_OUTPUT_INSTRUCTION}

${POLICY_INSTRUCTION}`;
}

/**
 * 部屋番号からキーボックスのダイヤル4桁コードを計算
 * ルール: 部屋番号の真ん中の0を67に置き換える
 * 例: 201 → 2671, 304 → 3674
 * @param roomId - 部屋番号（例: "201", "304"）
 * @returns 4桁のキーコード
 */
function calculateKeyCode(roomId: string): string {
    // roomIdが3桁の数字であることを確認
    if (!/^\d{3}$/.test(roomId)) {
        return "0000"; // 無効な部屋番号の場合のデフォルト
    }

    // 例: "201" → "2" + "67" + "1" = "2671"
    const firstDigit = roomId[0];   // 階数
    const lastDigit = roomId[2];    // 部屋番号
    
    return `${firstDigit}67${lastDigit}`;
}

/**
 * 承認済みユーザー向けのシステムプロンプト
 * - 部屋固有の機密情報（キーコードなど）にアクセス可能
 * - 全ての質問に対応
 */
function getApprovedSystemPrompt(roomId: string): string {
    const keyCode = calculateKeyCode(roomId);
    
    return `あなたは、〒552-0021 大阪府大阪市港区築港4-2-24にある、Osaka Bay Wheel民泊のWebアプリに設置されたAIアシスタントです。
あなたの担当は${roomId}号室です。

${roomId}号室のキーボックスの暗証番号のダイヤル4桁（**Key Box Code**）の番号は : ${keyCode}

${TOOL_USAGE_INSTRUCTION}

${JSON_OUTPUT_INSTRUCTION}

${POLICY_INSTRUCTION}`;
}

/**
 * 承認済み + 位置情報ありユーザー向けのシステムプロンプト
 * - 部屋固有の機密情報（キーコードなど）にアクセス可能
 * - ユーザーの現在位置を考慮した回答が可能
 */
function getApprovedWithLocationSystemPrompt(roomId: string, currentLocation: string): string {
    const keyCode = calculateKeyCode(roomId);
    
    return `あなたは、〒552-0021 大阪府大阪市港区築港4-2-24にある、Osaka Bay Wheel民泊のWebアプリに設置されたAIアシスタントです。
あなたの担当は${roomId}号室です。

${roomId}号室のキーボックスの暗証番号のダイヤル4桁（**Key Box Code**）の番号は : ${keyCode}

**お客様の現在位置**: ${currentLocation}

${TOOL_USAGE_INSTRUCTION}

${JSON_OUTPUT_INSTRUCTION}

${POLICY_INSTRUCTION}`;
}

/**
 * 未承認 + 位置情報ありユーザー向けのシステムプロンプト
 * - 一般的な質問のみ対応（キーコード情報なし）
 * - ユーザーの現在位置を考慮した回答が可能
 */
function getUnapprovedWithLocationSystemPrompt(roomId: string, currentLocation: string): string {
    return `あなたは、〒552-0021 大阪府大阪市港区築港4-2-24にある、Osaka Bay Wheel民泊のWebアプリに設置されたAIアシスタントです。
あなたの担当は${roomId}号室です。

**お客様の現在位置**: ${currentLocation}

${TOOL_USAGE_INSTRUCTION}

${JSON_OUTPUT_INSTRUCTION}

${POLICY_INSTRUCTION}`;
}

/**
 * 承認状態、位置情報の有無、roomIdに基づいて適切なシステムプロンプトを生成
 * @param roomId - 部屋番号（例: "101", "203"）
 * @param approved - 承認済みかどうか
 * @param currentLocation - お客様の現在位置（オプション）
 * @returns システムプロンプト文字列
 */
export function getSystemPrompt(roomId: string, approved: boolean, currentLocation?: string): string {
    if (!roomId) {
        // roomIdがない場合（グローバルチャット）
        return `あなたは、〒552-0021 大阪府大阪市港区築港4-2-24にある、Osaka Bay Wheel民泊のWebアプリに設置されたAIアシスタントです。

${TOOL_USAGE_INSTRUCTION}

${JSON_OUTPUT_INSTRUCTION}

${POLICY_INSTRUCTION}`;
    }

    // 4パターンの分岐
    if (approved && currentLocation) {
        // ① 承認済み + 位置情報あり（キーコード + 位置情報）
        return getApprovedWithLocationSystemPrompt(roomId, currentLocation);
    } else if (approved) {
        // ② 承認済み + 位置情報なし（キーコードのみ）
        return getApprovedSystemPrompt(roomId);
    } else if (currentLocation) {
        // ③ 未承認 + 位置情報あり（位置情報のみ、キーコードなし）
        return getUnapprovedWithLocationSystemPrompt(roomId, currentLocation);
    } else {
        // ④ 未承認 + 位置情報なし（基本情報のみ）
        return getUnapprovedSystemPrompt(roomId);
    }
}