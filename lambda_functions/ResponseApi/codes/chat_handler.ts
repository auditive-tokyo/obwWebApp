import { generateStreamResponse } from './stream_response';
import { LambdaFunctionURLEvent, Context } from 'aws-lambda';

const DEBUG = false; // TODO: デバッグモードは環境変数にするか？めんどいよね〜
const MODEL = "gpt-5-mini";

interface RequestBody {
    message?: string;
    previous_response_id?: string;
    roomId?: string;
    approved?: boolean;
    currentLocation?: string;
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

            if (!userMessage) {
                responseStream.write(JSON.stringify({ error: 'Message is required' }));
                responseStream.end();
                return;
            }

            // ユーザーメッセージをログ出力
            console.info("👤 ユーザーメッセージ:", userMessage);
            console.info("📍 位置情報:", currentLocation || 'なし');

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
                    
                    // 既存フロントが扱える形式（response.output_text.done）に正規化
                    responseStream.write("\n" + JSON.stringify({
                      type: "response.output_text.done",
                      text: chunk.part.text
                    }) + "\n");
                }
                if (chunk?.type === "response.output_text.done") {
                    
                    // AI の最終レスポンスをログ出力
                    console.info("🤖 AI最終レスポンス:", chunk.text);
                    
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