import { generateStreamResponse } from './stream_response';
import { LambdaFunctionURLEvent, Context } from 'aws-lambda';
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';

const DEBUG = false; // TODO: デバッグモードは環境変数にするか？めんどいよね〜
const MODEL = "gpt-5-mini";
const TELEGRAM_LAMBDA_FUNCTION_NAME = process.env.TELEGRAM_LAMBDA_FUNCTION_NAME || 'notify_admin';

const lambdaClient = new LambdaClient({ region: process.env.AWS_REGION || 'ap-northeast-1' });

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

// AWS Lambdaランタイムが提供するグローバル変数に型を適用
declare const awslambda: {
    streamifyResponse(
        handler: (event: LambdaFunctionURLEvent, responseStream: { write: (chunk: string) => void; end: () => void }, context: Context) => Promise<void>
    ): unknown;
};

export const handler = awslambda.streamifyResponse(
    async (event: LambdaFunctionURLEvent, responseStream: { write: (chunk: string) => void; end: () => void }) => {
        try {
            // CloudFront Secret検証（セキュリティ）
            const expectedSecret = process.env.CLOUDFRONT_SECRET;
            if (expectedSecret) {
                const receivedSecret = event.headers?.['x-cloudfront-secret'];
                if (receivedSecret !== expectedSecret) {
                    console.warn('⚠️ CloudFront Secret検証失敗 - 不正なアクセス試行');
                    responseStream.write(JSON.stringify({ 
                        error: 'Forbidden',
                        message: 'Access denied. Invalid CloudFront secret.'
                    }));
                    responseStream.end();
                    return;
                }
            }

            if (!event.body) {
                responseStream.write(JSON.stringify({ error: 'Request body is required' }));
                responseStream.end();
                return;
            }

            const body: RequestBody = JSON.parse(event.body);
            const userMessage = body.message;
            const previousResponseId = body.previous_response_id;
            const roomId = body.roomId;
            const approved = body.approved;
            const userInfo = body.userInfo || {};
            // userInfo内から取得、後方互換のためbody.currentLocationもフォールバック
            const representativeName = userInfo.representativeName || null;
            const representativeEmail = userInfo.representativeEmail || null;
            const representativePhone = userInfo.representativePhone || null;
            const currentLocation = userInfo.currentLocation || undefined;
            const checkInDate = userInfo.checkInDate || undefined;
            const checkOutDate = userInfo.checkOutDate || undefined;

            if (!userMessage) {
                responseStream.write(JSON.stringify({ error: 'Message is required' }));
                responseStream.end();
                return;
            }

            // ユーザーメッセージをログ出力
            console.info("👤 ユーザーメッセージ:", userMessage);
            console.info("🧾 代表者情報:", { representativeName, representativeEmail, representativePhone });
            console.info("📍 位置情報:", currentLocation || 'なし');
            console.info("📅 チェックイン日:", checkInDate || '未設定');
            console.info("📅 チェックアウト日:", checkOutDate || '未設定');

            // Telegram Lambda呼び出しの重複を防ぐフラグ
            let telegramNotificationSent = false;

            for await (const chunk of generateStreamResponse({
                userMessage,
                model: MODEL,
                previousResponseId,
                roomId,
                approved,
                representativeName,
                representativeEmail,
                representativePhone,
                currentLocation,
                checkInDate,
                checkOutDate
            })) {
                if (DEBUG) {
                    console.debug("OpenAI chunk:", chunk);
                }

                const c = chunk as unknown as Record<string, unknown>;

                if (c && c.type === "response.output_text.delta") {
                    responseStream.write(JSON.stringify(chunk) + "\n");
                }

                // Structured output時のfinalは content_part.done で来るケースがある
                if (c && c.type === "response.content_part.done") {
                    const part = c.part as Record<string, unknown> | undefined;
                    if (part && part.type === 'output_text' && typeof part.text === 'string') {
                        // AI の最終レスポンスをログ出力
                        console.info("🤖 AI最終レスポンス:", part.text);

                        // needs_human_operatorの確認と別Lambda呼び出し（重複防止フラグ付き）
                        try {
                            const parsed = JSON.parse(part.text) as unknown;
                            if (typeof parsed === 'object' && parsed !== null) {
                                const pr = parsed as Record<string, unknown>;
                                const needs = pr.needs_human_operator;
                                const summary = pr.inquiry_summary_for_operator;
                                if (needs === true && typeof summary === 'string' && summary && !telegramNotificationSent) {
                                    console.info("🚨 オペレーター支援が必要 - Telegram Lambda呼び出し開始");
                                    telegramNotificationSent = true;
                                    invokeTelegramLambda({
                                        roomId: roomId || 'unknown',
                                        inquirySummary: summary,
                                        userInfo
                                    }).catch(error => {
                                        console.error("Telegram Lambda呼び出しエラー:", error);
                                    });
                                }
                            }
                        } catch (parseError) {
                            console.warn("AI レスポンスのJSON解析に失敗:", parseError);
                        }

                        // 既存フロントが扱える形式（response.output_text.done）に正規化
                        responseStream.write("\n" + JSON.stringify({
                            type: "response.output_text.done",
                            text: part.text
                        }) + "\n");
                    }
                }

                if (c && c.type === "response.output_text.done") {
                    const text = c.text as string | undefined;
                    if (text) {
                        console.info("🤖 AI最終レスポンス:", text);
                        try {
                            const parsed = JSON.parse(text) as unknown;
                            if (typeof parsed === 'object' && parsed !== null) {
                                const pr = parsed as Record<string, unknown>;
                                const needs = pr.needs_human_operator;
                                const summary = pr.inquiry_summary_for_operator;
                                if (needs === true && typeof summary === 'string' && summary && !telegramNotificationSent) {
                                    console.info("🚨 オペレーター支援が必要 - Telegram Lambda呼び出し開始");
                                    telegramNotificationSent = true;
                                    invokeTelegramLambda({
                                        roomId: roomId || 'unknown',
                                        inquirySummary: summary,
                                        userInfo
                                    }).catch(error => {
                                        console.error("Telegram Lambda呼び出しエラー:", error);
                                    });
                                }
                            }
                        } catch (parseError) {
                            console.warn("AI レスポンスのJSON解析に失敗:", parseError);
                        }
                    }
                    responseStream.write("\n" + JSON.stringify(c) + "\n");
                }

                if (c && c.type === "response.completed") {
                    const resp = c.response as Record<string, unknown> | undefined;
                    if (resp && typeof resp.id === 'string') {
                        responseStream.write("\n" + JSON.stringify({ responseId: resp.id }) + "\n");
                    }
                }
            }
            responseStream.end();
        } catch (e) {
            console.error('Error in handler:', e);
            responseStream.write(JSON.stringify({ error: String(e) }));
            responseStream.end();
        }
    }
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
        timestamp: new Date().toISOString()
    };

    const command = new InvokeCommand({
        FunctionName: TELEGRAM_LAMBDA_FUNCTION_NAME,
        InvocationType: 'Event', // 非同期呼び出し
        Payload: JSON.stringify(payload)
    });

    await lambdaClient.send(command);
    console.info("✅ Telegram Lambda呼び出し完了:", TELEGRAM_LAMBDA_FUNCTION_NAME);
}