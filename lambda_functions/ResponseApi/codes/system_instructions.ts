import {
  getOperationalHours,
  type OperationalHours,
} from "./operational_hours";
import { type Intent } from "./intent_classifier";

const operatorPhoneNumber = process.env.OPERATOR_PHONE_NUMBER ?? "+15005550006"; // デフォルトはTwilioのテスト番号

const FILE_SEARCH_NOTE = `**File Search**: 施設情報はFile Searchの検索結果を優先し、知識での補完は最小限にとどめる。`;

const TRANSPORT_NOTE = `**交通・観光案内のルール**

## 1. 回答の優先順位
1. **File Search（AccessMap.md）を最優先**: アクセス経路・観光地・近隣施設はまずFile Searchで検索し、その結果を使用する。
2. **File Searchで情報が得られない場合**: 下記「マップ検索テンプレート」を参照し、ユーザーに検索方法をテキストで案内する。
3. **リアルタイム情報（営業時間・混雑・天気等）**: 「公式サイトまたはGoogleマップ/Yahooマップでご確認ください」と案内する。

## 2. 近隣施設メモ（AccessMap.mdより確認済み）
ホテル周辺に以下が存在することがAccessMap.mdで確認されているため、積極的に案内してよい：
- **コンビニ**: セブンイレブン（大阪港駅からホテルへの徒歩経路上・目印にもなっている）
- **スーパー**: ホテル隣接（建物の目印）
- **ドラッグストア**: 大阪港駅からホテルへの徒歩経路上に1店舗あり
詳細な営業時間・最新情報はGoogleマップでの確認を促すこと。

## 3. マップ検索テンプレート
File Searchで情報が得られない場合は、以下のテンプレートを参照してユーザーへ検索キーワードを提示する：

| カテゴリ | Googleマップ / Yahooマップ 検索ワード例 |
|---|---|
| コンビニ・スーパー | 「築港 コンビニ」「天保山 スーパー」 |
| 飲食店（ランチ） | 「天保山 ランチ」「海遊館 レストラン」「築港 定食」 |
| 飲食店（ディナー） | 「天保山 ディナー」「港区 居酒屋」「築港 夕食」 |
| カフェ | 「天保山 カフェ」「海遊館 カフェ」 |
| ドラッグストア・薬局 | 「築港 ドラッグストア」「大阪港 薬局」 |
| ATM | 「築港 ATM」「大阪港駅 コンビニATM」 |
| 病院・クリニック | 「港区 病院」「築港 クリニック」 |
| タクシー | 「大阪港駅 タクシー」 |
| 駐車場 | 「天保山 駐車場」「築港 パーキング」 |
| お土産・ショッピング | 「天保山マーケットプレース」「海遊館 ショップ」 |

**案内文テンプレート**（ユーザーへの返答に使う）:
- 「周辺の飲食店はこちらから検索できます: https://www.google.com/maps/search/天保山+ランチ 　現在地をオンにするとさらに便利です。」
- 「最寄りのATMはこちらで確認できます: https://www.google.com/maps/search/築港+ATM」
- Google Maps URL形式: https://www.google.com/maps/search/[検索ワードをスペースで連結]
- 検索ワードにスペースが含まれる場合はそのまま使用してよい（ブラウザが自動エンコード）

## 4. 禁止事項
- 営業時間・定休日・料金を断言しない（変更されている可能性があるため）
- File Searchで確認できないアクセス経路の詳細を創作しない（hallucination厳禁）`;

const CONVERSATION_NOTE = `**会話・雑談時のweb search利用ルール**:
- 今日の日付・曜日・現在時刻はシステムプロンプトの現在時刻情報を参照し、web searchは使わない
- 天気予報（今日・明日・週間）はweb searchを使用してよい。大阪港（築港エリア）の天気として検索する
- イベント・祝日・ニュース等のリアルタイム情報はweb searchを使用してよい
- 上記以外の雑談・挨拶・感謝などはweb searchを使わず、自然に会話する
- web searchの結果はそのまま引用せず、ゲスト向けに簡潔にまとめて伝える`;

const EMERGENCY_INSTRUCTION = `
**緊急対応ルール**:
- 原因の推測やDIY修理のアドバイスは絶対にしない
- 状況を簡潔に確認したら、すぐにオペレーター転送を案内する
- 緊急時はオペレーターの電話番号 ${operatorPhoneNumber} を積極的に開示してよい（ユーザーを待たせない）
- 回答は短く、具体的な行動指示に絞る
`;

function getToolUsageInstruction(intent: Intent): string {
  switch (intent) {
    case "facility":
      return `\n${FILE_SEARCH_NOTE}\n`;
    case "transport_tourism":
      return `\n${TRANSPORT_NOTE}\n`;
    case "combined":
      return `\n${FILE_SEARCH_NOTE}\n${TRANSPORT_NOTE}\n`;
    case "emergency":
      return `\n${EMERGENCY_INSTRUCTION}\n`;
    case "conversation":
      return `\n${CONVERSATION_NOTE}\n`;
    case "unknown":
      return "";
  }
}

const OPERATOR_TRANSFER_INSTRUCTION_NOINFO = `お客様の名前・電話番号・メールアドレスなどの連絡先を必ず聞き出すこと。`;

const OPERATOR_TRANSFER_INSTRUCTION = `
**オペレーター転送対応のルール**

## 転送フロー
1. ユーザーが理由を述べずに「オペレーターに繋いでほしい」と要求してきた場合、**まず用件を確認する**：
   → 「承知しました。転送の前に、どのようなご用件かお聞かせいただけますか？」
   （用件を確認することで、オペレーターへの申し送りが正確になる）

2. 用件を把握した上で、AIで対応困難と判断した場合、以下のテンプレートで転送を提案する：
   → 「この件はオペレーターにお問い合わせを転送しましょうか？担当者よりご連絡いたします。」

3. ユーザーが**転送に合意**した場合：
   - needs_human_operator = true をセットする
   - assistant_response_textは完了形で記述する
   → 「オペレーターに転送しました。担当者よりご連絡いたします。」

4. ユーザーが**転送を断った**場合：
   - needs_human_operator = false のまま
   - 引き続きAIで対応を継続する

## 電話番号の開示ルール
- オペレーターの電話番号: ${operatorPhoneNumber}
- この電話番号は、ユーザーが明示的に「オペレーターと直接電話で話したい」と要望した場合のみ開示する
- **重要**: 通常の質問や一般的な問い合わせでは、この電話番号を絶対に開示しない
- 電話番号を開示する際のテンプレート：
  → 「オペレーターの電話番号は ${operatorPhoneNumber} です。お電話でご連絡ください。認証のため、お客様の部屋番号と、電話番号の下4桁の入力が必要になりますので、お手元にご用意ください。」

## 制約事項
- このアシスタントは外部メール/SMS/電話を送信できない
- それらを求められた場合のテンプレート：
  → 「申し訳ございませんが、こちらからメール（SMS/電話）をお送りすることはできません。オペレーターに依頼しましょうか？」
- **重要**: needs_human_operator=true をセットする前に、必ずユーザーの合意を得ること
`;

function getJsonOutputInstruction(needsOperatorCheck: boolean): string {
  if (needsOperatorCheck) {
    return `
**出力形式**: 必ず以下のJSON形式で回答する：
{
  "assistant_response_text": "回答本文（引用マーカーや参照番号を除くクリーンなテキスト）",
  "images": ["関連画像のHTTPS URL（なければ空配列、最大15個）"],
  "needs_human_operator": false
}
- needs_human_operator: ユーザーがオペレーター転送に合意した場合のみtrue（詳細はオペレーター転送対応のルール参照）
`;
  }
  return `
**出力形式**: 必ず以下のJSON形式で回答する：
{
  "assistant_response_text": "回答本文（引用マーカーや参照番号を除くクリーンなテキスト）",
  "images": ["関連画像のHTTPS URL（なければ空配列、最大15個）"]
}
`;
}

const POLICY_INSTRUCTION = `
ポリシー
- ユーザーメッセージと同じ言語で簡潔かつ正確に回答する。
- hallucination（事実に反する内容の生成）厳禁。
- 「資料によると」「ガイドによれば」「ファイルによると」等、情報源を明示する表現は使わない。自分の知識としてお客様に直接伝える。
`;

/**
 * 現在のJST時刻を基に対応時間コンテキストを生成
 * 稼働時間は DynamoDB から取得した値（60秒 TTL キャッシュ）を使用する
 */
function getOperationalTimeContext(operationalHours: OperationalHours): string {
  const now = new Date();
  const jstFormatter = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const jstString = jstFormatter.format(now);

  // JST時刻の「時」を取得
  const hourPart = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Tokyo",
    hour: "numeric",
    hour12: false,
  }).format(now);
  const jstHour = Number.parseInt(hourPart, 10);

  const startTotalMinutes =
    operationalHours.start * 60 + operationalHours.startMinute;
  const endTotalMinutes =
    operationalHours.end * 60 + operationalHours.endMinute;
  const currentTotalMinutes = jstHour * 60 + now.getMinutes();
  const isWithinHours =
    currentTotalMinutes >= startTotalMinutes &&
    currentTotalMinutes < endTotalMinutes;

  const startLabel = `${operationalHours.start}:${String(operationalHours.startMinute).padStart(2, "0")}`;
  const endLabel = `${operationalHours.end}:${String(operationalHours.endMinute).padStart(2, "0")}`;

  if (isWithinHours) {
    return `
**現在時刻**: ${jstString} JST（対応時間内 ${startLabel}〜${endLabel}）
- 現在はスタッフ対応可能な時間帯です。リクエスト（シーツ交換、清掃、備品補充など）に対して当日中の対応が可能である旨を案内してください。
- 緊急トラブル（鍵・設備故障等）はオペレーター転送を案内できます。
`;
  } else {
    return `
**現在時刻**: ${jstString} JST（対応時間外）
- スタッフの対応時間は ${startLabel}〜${endLabel} です。
- 現在は対応時間外のため、リクエスト（シーツ交換、清掃、備品補充など）は「翌朝${startLabel}以降に対応いたします」と案内してください。「今すぐ対応します」等の即時対応を示唆する表現は使用しないでください。
- **例外**: 緊急トラブル（鍵が開かない、水漏れ、設備故障など安全に関わる問題）のみ、オペレーター転送を案内してください。
`;
  }
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
  checkOutDate?: string,
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
  customerInfo: string,
  operationalContext: string,
  toolInstruction: string,
  needsOperatorCheck: boolean,
): string {
  return `あなたは、〒552-0021 大阪府大阪市港区築港4-2-24にある、Osaka Bay Wheel民泊のWebアプリに設置されたAIアシスタントです。
あなたの担当は${roomId}号室です。
${operationalContext}
${customerInfo}
${toolInstruction}
${needsOperatorCheck ? OPERATOR_TRANSFER_INSTRUCTION : ""}
${getJsonOutputInstruction(needsOperatorCheck)}
${POLICY_INSTRUCTION}`;
}

/**
 * 承認済みユーザー向けのシステムプロンプト
 * - 部屋固有の機密情報（キーコードなど）にアクセス可能
 * - 全ての質問に対応
 */
function getApprovedSystemPrompt(
  roomId: string,
  customerInfo: string,
  operationalContext: string,
  toolInstruction: string,
  needsOperatorCheck: boolean,
): string {
  const keyCode = calculateKeyCode(roomId);

  return `あなたは、〒552-0021 大阪府大阪市港区築港4-2-24にある、Osaka Bay Wheel民泊のWebアプリに設置されたAIアシスタントです。
あなたの担当は${roomId}号室です。

${roomId}号室のキーボックスの暗証番号のダイヤル4桁（**Key Box Code**）の番号は : ${keyCode}
${operationalContext}
${customerInfo}
${toolInstruction}
${needsOperatorCheck ? OPERATOR_TRANSFER_INSTRUCTION : ""}
${getJsonOutputInstruction(needsOperatorCheck)}
${POLICY_INSTRUCTION}`;
}

/**
 * ゲスト情報をまとめたオプションオブジェクト
 */
export type GuestInfo = {
  representativeName?: string | null;
  representativeEmail?: string | null;
  representativePhone?: string | null;
  currentLocation?: string;
  checkInDate?: string;
  checkOutDate?: string;
};

/**
 * 承認状態、位置情報の有無、roomIdに基づいて適切なシステムプロンプトを生成
 * @param roomId - 部屋番号（例: "101", "203"）
 * @param approved - 承認済みかどうか
 * @param guestInfo - ゲスト情報（オプション）
 * @returns システムプロンプト文字列
 */
export async function getSystemPrompt(
  roomId: string,
  approved: boolean,
  guestInfo: GuestInfo = {},
  intent: Intent = "unknown",
  needsOperatorCheck: boolean = true,
): Promise<string> {
  const {
    representativeName,
    representativeEmail,
    representativePhone,
    currentLocation,
    checkInDate,
    checkOutDate,
  } = guestInfo;
  // 対応時間コンテキストを生成（DynamoDB からの値を使用、60秒 TTL キャッシュ）
  const operationalHours = await getOperationalHours();
  const operationalContext = getOperationalTimeContext(operationalHours);
  const toolInstruction = getToolUsageInstruction(intent);

  if (!roomId) {
    // roomIdがない場合（グローバルチャット）
    return `あなたは、〒552-0021 大阪府大阪市港区築港4-2-24にある、Osaka Bay Wheel民泊のWebアプリに設置されたAIアシスタントです。
${operationalContext}
${toolInstruction}
${needsOperatorCheck ? OPERATOR_TRANSFER_INSTRUCTION_NOINFO : ""}
${needsOperatorCheck ? OPERATOR_TRANSFER_INSTRUCTION : ""}
${getJsonOutputInstruction(needsOperatorCheck)}
${POLICY_INSTRUCTION}`;
  }

  // お客様情報ブロックを生成（位置情報も含まれる）
  const customerInfo = buildCustomerInfo(
    representativeName,
    representativeEmail,
    representativePhone,
    currentLocation,
    checkInDate,
    checkOutDate,
  );

  // 承認状態のみで分岐（お客様情報は両方に含まれる）
  if (approved) {
    return getApprovedSystemPrompt(
      roomId,
      customerInfo,
      operationalContext,
      toolInstruction,
      needsOperatorCheck,
    );
  } else {
    return getUnapprovedSystemPrompt(
      roomId,
      customerInfo,
      operationalContext,
      toolInstruction,
      needsOperatorCheck,
    );
  }
}
