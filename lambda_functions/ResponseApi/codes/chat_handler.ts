import { generateStreamResponse } from "./stream_response";
import { LambdaFunctionURLEvent, Context } from "aws-lambda";
import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";

const DEBUG = process.env.DEBUG === "true";
const TELEGRAM_LAMBDA_FUNCTION_NAME =
  process.env.TELEGRAM_LAMBDA_FUNCTION_NAME || "notify_admin";

const lambdaClient = new LambdaClient({
  region: process.env.AWS_REGION || "ap-northeast-1",
});

interface UserInfo {
  representativeName?: string;
  representativeEmail?: string;
  representativePhone?: string;
  currentLocation?: string;
  checkInDate?: string;
  checkOutDate?: string;
}

interface RequestBody {
  message?: string;
  previous_response_id?: string;
  roomId?: string;
  approved?: boolean;
  userInfo?: UserInfo;
}

interface ResponseStream {
  write: (chunk: string) => void;
  end: () => void;
}

interface ParsedRequestData {
  userMessage: string;
  previousResponseId?: string;
  roomId?: string;
  approved?: boolean;
  userInfo: UserInfo;
  representativeName: string | null;
  representativeEmail: string | null;
  representativePhone: string | null;
  currentLocation?: string;
  checkInDate?: string;
  checkOutDate?: string;
}

interface TelegramNotificationState {
  sent: boolean;
}

// AWS Lambdaランタイムが提供するグローバル変数に型を適用
declare const awslambda: {
  streamifyResponse(
    handler: (
      event: LambdaFunctionURLEvent,
      responseStream: ResponseStream,
      context: Context,
    ) => Promise<void>,
  ): unknown;
};

/**
 * CloudFront Secret検証
 * @returns true: 検証失敗（アクセス拒否）, false: 検証成功
 */
function validateCloudFrontSecret(
  event: LambdaFunctionURLEvent,
  responseStream: ResponseStream,
): boolean {
  const expectedSecret = process.env.CLOUDFRONT_SECRET;
  if (!expectedSecret) {
    return false;
  }

  const receivedSecret = event.headers?.["x-cloudfront-secret"];
  if (receivedSecret === expectedSecret) {
    return false;
  }

  console.warn("⚠️ CloudFront Secret検証失敗 - 不正なアクセス試行");
  responseStream.write(
    JSON.stringify({
      error: "Forbidden",
      message: "Access denied. Invalid CloudFront secret.",
    }),
  );
  responseStream.end();
  return true;
}

/**
 * リクエストボディをパースして必要なデータを抽出
 */
function parseRequestBody(
  event: LambdaFunctionURLEvent,
  responseStream: ResponseStream,
): ParsedRequestData | null {
  if (!event.body) {
    responseStream.write(JSON.stringify({ error: "Request body is required" }));
    responseStream.end();
    return null;
  }

  const body: RequestBody = JSON.parse(event.body);
  const userMessage = body.message;

  if (!userMessage) {
    responseStream.write(JSON.stringify({ error: "Message is required" }));
    responseStream.end();
    return null;
  }

  const userInfo = body.userInfo || {};

  return {
    userMessage,
    previousResponseId: body.previous_response_id,
    roomId: body.roomId,
    approved: body.approved,
    userInfo,
    representativeName: userInfo.representativeName || null,
    representativeEmail: userInfo.representativeEmail || null,
    representativePhone: userInfo.representativePhone || null,
    currentLocation: userInfo.currentLocation,
    checkInDate: userInfo.checkInDate,
    checkOutDate: userInfo.checkOutDate,
  };
}

/**
 * リクエストデータをログ出力
 */
function logRequestData(data: ParsedRequestData): void {
  console.info("👤 ユーザーメッセージ:", data.userMessage);
  console.info("🧾 代表者情報:", {
    representativeName: data.representativeName,
    representativeEmail: data.representativeEmail,
    representativePhone: data.representativePhone,
  });
  console.info("📍 位置情報:", data.currentLocation || "なし");
  console.info("📅 チェックイン日:", data.checkInDate || "未設定");
  console.info("📅 チェックアウト日:", data.checkOutDate || "未設定");
}

/**
 * AIレスポンスからオペレーター支援が必要か判定し、必要ならTelegram通知を送信
 */
function handleOperatorNotification(
  text: string,
  roomId: string | undefined,
  userInfo: UserInfo,
  notificationState: TelegramNotificationState,
): void {
  if (notificationState.sent) {
    return;
  }

  try {
    const parsed = JSON.parse(text) as unknown;
    if (typeof parsed !== "object" || parsed === null) {
      return;
    }

    const pr = parsed as Record<string, unknown>;
    const needsHumanOperator = pr.needs_human_operator === true;
    const summary = pr.inquiry_summary_for_operator;
    const hasValidSummary = typeof summary === "string" && summary.length > 0;

    if (needsHumanOperator && hasValidSummary) {
      console.info("🚨 オペレーター支援が必要 - Telegram Lambda呼び出し開始");
      notificationState.sent = true;
      invokeTelegramLambda({
        roomId: roomId || "unknown",
        inquirySummary: summary,
        userInfo,
      }).catch((error) => {
        console.error("Telegram Lambda呼び出しエラー:", error);
      });
    }
  } catch (parseError) {
    console.warn("AI レスポンスのJSON解析に失敗:", parseError);
  }
}

/**
 * content_part.done チャンクを処理
 */
function handleContentPartDone(
  chunk: Record<string, unknown>,
  responseStream: ResponseStream,
  roomId: string | undefined,
  userInfo: UserInfo,
  notificationState: TelegramNotificationState,
): void {
  const part = chunk.part as Record<string, unknown> | undefined;
  if (part?.type !== "output_text" || typeof part?.text !== "string") {
    return;
  }

  console.info("🤖 AI最終レスポンス:", part.text);
  handleOperatorNotification(part.text, roomId, userInfo, notificationState);

  // 既存フロントが扱える形式（response.output_text.done）に正規化
  responseStream.write(
    "\n" +
      JSON.stringify({
        type: "response.output_text.done",
        text: part.text,
      }) +
      "\n",
  );
}

/**
 * output_text.done チャンクを処理
 */
function handleOutputTextDone(
  chunk: Record<string, unknown>,
  responseStream: ResponseStream,
  roomId: string | undefined,
  userInfo: UserInfo,
  notificationState: TelegramNotificationState,
): void {
  const text = chunk.text as string | undefined;
  if (text) {
    console.info("🤖 AI最終レスポンス:", text);
    handleOperatorNotification(text, roomId, userInfo, notificationState);
  }
  responseStream.write("\n" + JSON.stringify(chunk) + "\n");
}

/**
 * response.completed チャンクを処理
 */
function handleResponseCompleted(
  chunk: Record<string, unknown>,
  responseStream: ResponseStream,
): void {
  const resp = chunk.response as Record<string, unknown> | undefined;
  if (resp && typeof resp.id === "string") {
    responseStream.write("\n" + JSON.stringify({ responseId: resp.id }) + "\n");
  }
}

/**
 * ストリームチャンクを処理
 */
function processStreamChunk(
  chunk: unknown,
  responseStream: ResponseStream,
  roomId: string | undefined,
  userInfo: UserInfo,
  notificationState: TelegramNotificationState,
): void {
  if (DEBUG) {
    console.debug("OpenAI chunk:", chunk);
  }

  const c = chunk as Record<string, unknown>;
  if (!c?.type) {
    return;
  }

  switch (c.type) {
    case "response.output_text.delta":
      responseStream.write(JSON.stringify(chunk) + "\n");
      break;
    case "response.content_part.done":
      handleContentPartDone(
        c,
        responseStream,
        roomId,
        userInfo,
        notificationState,
      );
      break;
    case "response.output_text.done":
      handleOutputTextDone(
        c,
        responseStream,
        roomId,
        userInfo,
        notificationState,
      );
      break;
    case "response.completed":
      handleResponseCompleted(c, responseStream);
      break;
  }
}

export const handler = awslambda.streamifyResponse(
  async (event: LambdaFunctionURLEvent, responseStream: ResponseStream) => {
    try {
      if (validateCloudFrontSecret(event, responseStream)) {
        return;
      }

      const requestData = parseRequestBody(event, responseStream);
      if (!requestData) {
        return;
      }

      logRequestData(requestData);

      const notificationState: TelegramNotificationState = { sent: false };

      for await (const chunk of generateStreamResponse({
        userMessage: requestData.userMessage,
        previousResponseId: requestData.previousResponseId,
        roomId: requestData.roomId,
        approved: requestData.approved,
        representativeName: requestData.representativeName,
        representativeEmail: requestData.representativeEmail,
        representativePhone: requestData.representativePhone,
        currentLocation: requestData.currentLocation,
        checkInDate: requestData.checkInDate,
        checkOutDate: requestData.checkOutDate,
      })) {
        processStreamChunk(
          chunk,
          responseStream,
          requestData.roomId,
          requestData.userInfo,
          notificationState,
        );
      }
      responseStream.end();
    } catch (e) {
      console.error("Error in handler:", e);
      responseStream.write(JSON.stringify({ error: String(e) }));
      responseStream.end();
    }
  },
);

/**
 * Telegram送信用Lambdaを非同期で呼び出し
 */
async function invokeTelegramLambda(params: {
  roomId: string;
  inquirySummary: string;
  userInfo?: UserInfo;
}): Promise<void> {
  const payload = {
    roomId: params.roomId,
    inquirySummary: params.inquirySummary,
    userInfo: params.userInfo,
    timestamp: new Date().toISOString(),
  };

  const command = new InvokeCommand({
    FunctionName: TELEGRAM_LAMBDA_FUNCTION_NAME,
    InvocationType: "Event", // 非同期呼び出し
    Payload: JSON.stringify(payload),
  });

  await lambdaClient.send(command);
  console.info(
    "✅ Telegram Lambda呼び出し完了:",
    TELEGRAM_LAMBDA_FUNCTION_NAME,
  );
}
