import OpenAI from 'openai';
import { getSystemPrompt } from './system_instructions';

const OPENAI_VECTOR_STORE_ID = process.env.OPENAI_VECTOR_STORE_ID;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

interface GenerateStreamResponseParams {
    userMessage: string;
    model: string;
    previousResponseId?: string | null;
    roomId?: string;
    approved?: boolean;
    currentLocation?: string;
    representativeName?: string | null;
    representativeEmail?: string | null;
    representativePhone?: string | null;
}

export async function* generateStreamResponse({
    userMessage,
    model,
    previousResponseId,
    roomId,
    approved,
    representativeName,
    representativeEmail,
    representativePhone,
    currentLocation,
}: GenerateStreamResponseParams): AsyncGenerator<any, void, unknown> {
    try {
        // システムプロンプトを動的生成
        const systemPrompt = getSystemPrompt(
            roomId || '', 
            approved || false, 
            representativeName ?? null,
            representativeEmail ?? null,
            representativePhone ?? null,
            currentLocation ? currentLocation : undefined,
        );
        console.info("Generated system prompt for:", { roomId, approved, representativeName, representativeEmail, representativePhone, currentLocation });

        let tools: any[] = [];

        // File Search ツール
        if (OPENAI_VECTOR_STORE_ID) {
            const fileSearchTool: any = {
                type: "file_search",
                vector_store_ids: [OPENAI_VECTOR_STORE_ID],
                max_num_results: 10,
                ranking_options: { score_threshold: 0.2 }
            };
            tools.push(fileSearchTool);
        }

        // Web Search ツール
       const webSearchTool: any = {
            type: "web_search_preview",
            search_context_size: "low"
        };
        tools.push(webSearchTool);

        console.info("Enabled tools:", tools.map(t => t.type));

        const requestPayload: any = {
            model: model,
            instructions: systemPrompt,
            input: [{ role: "user", content: userMessage }],
            tools: tools,
            reasoning: {
                effort: "low"
            },
            parallel_tool_calls: false,
            truncation: "auto",
            stream: true,
            text: {
                verbosity: "low",
                format: {
                    type: "json_schema",
                    name: "assistant_response",
                    strict: true,
                    schema: {
                        type: "object",
                        properties: {
                            assistant_response_text: {
                                type: "string",
                                description: "Clean assistant response text, excluding citation markers, reference numbers, and metadata annotations like 'citeturn0forecast0'."
                            },
                            reference_sources: {
                                type: "array",
                                items: { type: "string" },
                                description: "Sources referenced by the assistant (database files, web URLs, etc.). Empty array [] if no external sources were used."
                            },
                            images: {
                                type: "array",
                                items: { type: "string" },
                                description: "An array of absolute HTTPS image URLs relevant to the answer for display in the chat UI. If none are relevant, return an empty array []. Limit to at most 15."
                            },
                            needs_human_operator: {
                                type: "boolean",
                                description: "Set to true ONLY when the user explicitly requests human operator assistance or answers 'yes' to the question 'Would you like me to contact a human operator?'. Do NOT set to true automatically based on the complexity of the issue."
                            },
                            inquiry_summary_for_operator: {
                                type: "string",
                                description: "A concise summary of the guest's inquiry for the human operator, formatted for Telegram messaging. Include key details like the issue type, current situation, and any urgent actions needed. DO NOT include guest personal information (name, email, phone) as it will be retrieved from the database. Return empty string \"\" if needs_human_operator is false."
                            }
                        },
                        required: ["assistant_response_text", "reference_sources", "images", "needs_human_operator", "inquiry_summary_for_operator"],
                        additionalProperties: false
                    }
                }
            }
        };
        if (previousResponseId) requestPayload.previous_response_id = previousResponseId;

        const response = await openai.responses.create(requestPayload);

        for await (const chunk of response as unknown as AsyncIterable<any>) {
            yield chunk;
        }

        yield `data: ${JSON.stringify({ completed: true })}\n\n`;

        console.info("Response API stream completed successfully");
    } catch (e) {
        console.error(`Error in generateStreamResponse: ${e}`);
        yield `data: ${JSON.stringify({ error: String(e) })}\n\n`;
    }
}