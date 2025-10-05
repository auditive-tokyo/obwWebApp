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
- 複雑な問題や解決困難な場合は、まず最善を尽くして回答し、その上で「オペレーターにお繋ぎしますか？」と確認する
- needs_human_operatorをtrueにするのは、ユーザーが「オペレーターに連絡してもらえますか？」の質問に「はい」と答えた場合のみ：
- inquiry_summary_for_operatorには、ユーザーが同意した場合のみ、問題の種類、状況、緊急度を簡潔にまとめる
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
function getApprovedWithLocationSystemPrompt(roomId: string): string {
    const keyCode = calculateKeyCode(roomId);
    
    return `あなたは、〒552-0021 大阪府大阪市港区築港4-2-24にある、Osaka Bay Wheel民泊のWebアプリに設置されたAIアシスタントです。
あなたの担当は${roomId}号室です。

${roomId}号室のキーボックスの暗証番号のダイヤル4桁（**Key Box Code**）の番号は : ${keyCode}

${TOOL_USAGE_INSTRUCTION}

${JSON_OUTPUT_INSTRUCTION}

${POLICY_INSTRUCTION}`;
}

/**
 * 未承認 + 位置情報ありユーザー向けのシステムプロンプト
 * - 一般的な質問のみ対応（キーコード情報なし）
 * - ユーザーの現在位置を考慮した回答が可能
 */
function getUnapprovedWithLocationSystemPrompt(roomId: string): string {
    return `あなたは、〒552-0021 大阪府大阪市港区築港4-2-24にある、Osaka Bay Wheel民泊のWebアプリに設置されたAIアシスタントです。
あなたの担当は${roomId}号室です。

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
export function getSystemPrompt(
    roomId: string,
    approved: boolean,
    currentLocation?: string,
    representativeName?: string | null,
    representativeEmail?: string | null,
    representativePhone?: string | null
): string {
    if (!roomId) {
        // roomIdがない場合（グローバルチャット）
        return `あなたは、〒552-0021 大阪府大阪市港区築港4-2-24にある、Osaka Bay Wheel民泊のWebアプリに設置されたAIアシスタントです。

${TOOL_USAGE_INSTRUCTION}

${JSON_OUTPUT_INSTRUCTION}

${POLICY_INSTRUCTION}`;
    }

    // 4パターンの分岐でベースのプロンプトを決定
    let base = "";
    if (approved && currentLocation) {
        base = getApprovedWithLocationSystemPrompt(roomId);
    } else if (approved) {
        base = getApprovedSystemPrompt(roomId);
    } else if (currentLocation) {
        base = getUnapprovedWithLocationSystemPrompt(roomId);
    } else {
        base = getUnapprovedSystemPrompt(roomId);
    }

    // お客様情報ブロックを追記（任意）
    const customerLines: string[] = [];
    if (representativeName) customerLines.push(`- お名前: ${representativeName}`);
    if (representativePhone) customerLines.push(`- 電話番号: ${representativePhone}`);
    if (representativeEmail) customerLines.push(`- Email: ${representativeEmail}`);
    if (currentLocation) customerLines.push(`- 現在位置: ${currentLocation}`);

    if (customerLines.length > 0) {
        base += `\n\n**お客様情報**:\n${customerLines.join("\n")}`;
    }

    return base;
}