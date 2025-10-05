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
}

interface RequestBody {
    message?: string;
    previous_response_id?: string;
    roomId?: string;
    approved?: boolean;
    currentLocation?: string;
    userInfo?: UserInfo;
}

// AWS Lambdaランタイムが提供するグローバル変数に型を適用
declare const awslambda: {
    streamifyResponse(
        handler: (event: LambdaFunctionURLEvent, responseStream: any, context: Context) => Promise<void>
    ): any;
};

export const handler = awslambda.streamifyResponse(
    async (event: LambdaFunctionURLEvent, responseStream: any, context: Context) => {
        try {
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
            const currentLocation = body.currentLocation;
            const userInfo = body.userInfo || {};
            const representativeName = userInfo.representativeName || null;
            const representativeEmail = userInfo.representativeEmail || null;
            const representativePhone = userInfo.representativePhone || null;

            if (!userMessage) {
                responseStream.write(JSON.stringify({ error: 'Message is required' }));
                responseStream.end();
                return;
            }

            // ユーザーメッセージをログ出力
            console.info("👤 ユーザーメッセージ:", userMessage);
            console.info("📍 位置情報:", currentLocation || 'なし');
            console.info("🧾 代表者情報:", { representativeName, representativeEmail, representativePhone });

            // Telegram Lambda呼び出しの重複を防ぐフラグ
            let telegramNotificationSent = false;

            for await (const chunk of generateStreamResponse({
                userMessage,
                model: MODEL,
                previousResponseId,
                roomId,
                approved,
                currentLocation
            })) {
                if (DEBUG) {
                    console.debug("OpenAI chunk:", chunk);
                }
                if (chunk?.type === "response.output_text.delta") {
                    responseStream.write(JSON.stringify(chunk) + "\n");
                }
                // Structured output時のfinalは content_part.done で来るケースがある
                if (chunk?.type === "response.content_part.done" &&
                    chunk.part?.type === "output_text" &&
                    typeof chunk.part?.text === "string") {
                    
                    // AI の最終レスポンスをログ出力
                    console.info("🤖 AI最終レスポンス:", chunk.part.text);
                    
                    // needs_human_operatorの確認と別Lambda呼び出し（重複防止フラグ付き）
                    try {
                        const aiResponse = JSON.parse(chunk.part.text);
                        if (aiResponse.needs_human_operator === true && aiResponse.inquiry_summary_for_operator && !telegramNotificationSent) {
                            console.info("🚨 オペレーター支援が必要 - Telegram Lambda呼び出し開始");
                            telegramNotificationSent = true; // 重複防止フラグ
                            // 非同期でTelegram送信Lambda呼び出し（レスポンスを待たない）
                            invokeTelegramLambda({
                                roomId: roomId || 'unknown',
                                userMessage,
                                inquirySummary: aiResponse.inquiry_summary_for_operator,
                                currentLocation
                            }).catch(error => {
                                console.error("Telegram Lambda呼び出しエラー:", error);
                            });
                        }
                    } catch (parseError) {
                        console.warn("AI レスポンスのJSON解析に失敗:", parseError);
                    }
                    
                    // 既存フロントが扱える形式（response.output_text.done）に正規化
                    responseStream.write("\n" + JSON.stringify({
                      type: "response.output_text.done",
                      text: chunk.part.text
                    }) + "\n");
                }
                if (chunk?.type === "response.output_text.done") {
                    
                    // AI の最終レスポンスをログ出力
                    console.info("🤖 AI最終レスポンス:", chunk.text);
                    
                    // needs_human_operatorの確認と別Lambda呼び出し（重複防止フラグ付き）
                    try {
                        const aiResponse = JSON.parse(chunk.text);
                        if (aiResponse.needs_human_operator === true && aiResponse.inquiry_summary_for_operator && !telegramNotificationSent) {
                            console.info("🚨 オペレーター支援が必要 - Telegram Lambda呼び出し開始");
                            telegramNotificationSent = true; // 重複防止フラグ
                            // 非同期でTelegram送信Lambda呼び出し（レスポンスを待たない）
                            invokeTelegramLambda({
                                roomId: roomId || 'unknown',
                                userMessage,
                                inquirySummary: aiResponse.inquiry_summary_for_operator,
                                currentLocation
                            }).catch(error => {
                                console.error("Telegram Lambda呼び出しエラー:", error);
                            });
                        }
                    } catch (parseError) {
                        console.warn("AI レスポンスのJSON解析に失敗:", parseError);
                    }
                    
                    responseStream.write("\n" + JSON.stringify(chunk) + "\n");
                }
                if (chunk?.type === "response.completed" && chunk.response?.id) {
                    responseStream.write("\n" + JSON.stringify({ responseId: chunk.response.id }) + "\n");
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
    userMessage: string;
    inquirySummary: string;
    currentLocation?: string;
}): Promise<void> {
    const payload = {
        roomId: params.roomId,
        userMessage: params.userMessage,
        inquirySummary: params.inquirySummary,
        currentLocation: params.currentLocation,
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