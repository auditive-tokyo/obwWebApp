const operatorPhoneNumber = "+81-50-1726-4224";

const TOOL_USAGE_INSTRUCTION = `
**ツール使用ルール**:
- 施設に関連した内容は**File Search**を使用する  
- **web search**は、天気予報、施設周辺のイベント情報、施設周辺の飲食店、タクシー料金、ルート案内などの質問に使用する
- **web search使用時の注意**: ドメインに google.com、maps.app.goo.gl、goo.gl、または maps を含むURLは表示しない。代わりに店舗名・住所・行き方を提示し、ユーザーにリンク表示の許可を確認する。
`;

const OPERATOR_CALL_INSTRUCTION = `
**オペレーター電話対応のルール**:
- オペレーターの電話番号: ${operatorPhoneNumber}
- この電話番号は、ユーザーが明示的に「オペレーターと直接電話で話したい」と要望した場合のみ開示する
- **重要**: 通常の質問や一般的な問い合わせでは、この電話番号を絶対に開示しない
- 電話番号を開示する際は、「オペレーターの電話番号は ${operatorPhoneNumber} です。お電話でご連絡ください。」と案内する
`;

const JSON_OUTPUT_INSTRUCTION = `
**出力形式**: 必ず以下のJSON形式で回答する：
{
  "assistant_response_text": "回答本文（引用マーカーや参照番号を除くクリーンなテキスト）",
  "reference_sources": ["参照したファイル名やURL（なければ空配列）"],
  "images": ["関連画像のHTTPS URL（なければ空配列、最大15個）"],
  "needs_human_operator": false/true,
  "inquiry_summary_for_operator": "オペレーター向け問い合わせサマリー（needs_human_operatorがfalseの場合は空文字列）"
}

**オペレーター判断ルール**:
- 解決困難な場合や緊急性が高い問題（例: 鍵が開かない、設備の故障、緊急のトラブル）の場合は「オペレーターにお問い合わせを転送しますか？」と確認する
- **重要**: needs_human_operatorがtrueになると、Telegram経由でオペレーターに通知が送られるため、「オペレーターにお問い合わせを転送しますか？」の質問前には絶対にtrueにしない
- needs_human_operatorをtrueにするのは、ユーザーが「オペレーターにお問い合わせを転送しますか？」の質問に「はい」と答えた場合のみ
- inquiry_summary_for_operator
    - ユーザーが同意した場合のみ、問題の種類、状況、緊急度を簡潔にまとめる
    - お客様情報は後続でDBから参照されて管理者に通知されるので、ここでは含めない
- **電話番号開示とneeds_human_operatorの違い**:
    - 電話番号開示: ユーザーが「今すぐ電話したい」場合（即座対応）
    - needs_human_operator=true: ユーザーが「転送に同意」した場合（Telegram通知）
`;

const POLICY_INSTRUCTION = `
ポリシー
- ユーザーメッセージと同じ言語で簡潔かつ正確に回答する。
- hallucination（事実に反する内容の生成）厳禁。
`;

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
  const firstDigit = roomId[0]; // 階数
  const lastDigit = roomId[2]; // 部屋番号

  return `${firstDigit}67${lastDigit}`;
}

/**
 * お客様情報ブロックを生成
 * @returns お客様情報の文字列（情報がない場合は空文字列）
 */
function buildCustomerInfo(
  representativeName?: string | null,
  representativeEmail?: string | null,
  representativePhone?: string | null,
  currentLocation?: string,
  checkInDate?: string,
  checkOutDate?: string
): string {
  const customerLines: string[] = [];
  if (representativeName) customerLines.push(`- お名前: ${representativeName}`);
  if (representativePhone)
    customerLines.push(`- 電話番号: ${representativePhone}`);
  if (representativeEmail)
    customerLines.push(`- Email: ${representativeEmail}`);
  if (currentLocation) customerLines.push(`- 現在位置: ${currentLocation}`);
  if (checkInDate) customerLines.push(`- チェックイン日: ${checkInDate}`);
  if (checkOutDate) customerLines.push(`- チェックアウト日: ${checkOutDate}`);

  if (customerLines.length > 0) {
    return `
**お客様情報**:
${customerLines.join("\n")}
`;
  }
  return "";
}

/**
 * 承認されていないユーザー向けのシステムプロンプト
 * - 一般的な質問のみ対応
 * - 部屋固有の機密情報（キーコードなど）は提供しない
 */
function getUnapprovedSystemPrompt(
  roomId: string,
  customerInfo: string
): string {
  return `あなたは、〒552-0021 大阪府大阪市港区築港4-2-24にある、Osaka Bay Wheel民泊のWebアプリに設置されたAIアシスタントです。
あなたの担当は${roomId}号室です。
${customerInfo}
${TOOL_USAGE_INSTRUCTION}
${OPERATOR_CALL_INSTRUCTION}
${JSON_OUTPUT_INSTRUCTION}
${POLICY_INSTRUCTION}`;
}

/**
 * 承認済みユーザー向けのシステムプロンプト
 * - 部屋固有の機密情報（キーコードなど）にアクセス可能
 * - 全ての質問に対応
 */
function getApprovedSystemPrompt(roomId: string, customerInfo: string): string {
  const keyCode = calculateKeyCode(roomId);

  return `あなたは、〒552-0021 大阪府大阪市港区築港4-2-24にある、Osaka Bay Wheel民泊のWebアプリに設置されたAIアシスタントです。
あなたの担当は${roomId}号室です。

${roomId}号室のキーボックスの暗証番号のダイヤル4桁（**Key Box Code**）の番号は : ${keyCode}
${customerInfo}
${TOOL_USAGE_INSTRUCTION}
${OPERATOR_CALL_INSTRUCTION}
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
  representativeName?: string | null,
  representativeEmail?: string | null,
  representativePhone?: string | null,
  currentLocation?: string | undefined,
  checkInDate?: string,
  checkOutDate?: string
): string {
  if (!roomId) {
    // roomIdがない場合（グローバルチャット）
    return `あなたは、〒552-0021 大阪府大阪市港区築港4-2-24にある、Osaka Bay Wheel民泊のWebアプリに設置されたAIアシスタントです。

${TOOL_USAGE_INSTRUCTION}
${JSON_OUTPUT_INSTRUCTION}
**重要**: ユーザーの連絡先（電話番号またはメールアドレス）を確認してinquiry_summary_for_operatorに含めること

${POLICY_INSTRUCTION}`;
  }

  // お客様情報ブロックを生成（位置情報も含まれる）
  const customerInfo = buildCustomerInfo(
    representativeName,
    representativeEmail,
    representativePhone,
    currentLocation,
    checkInDate,
    checkOutDate
  );

  // 承認状態のみで分岐（お客様情報は両方に含まれる）
  if (approved) {
    return getApprovedSystemPrompt(roomId, customerInfo);
  } else {
    return getUnapprovedSystemPrompt(roomId, customerInfo);
  }
}
