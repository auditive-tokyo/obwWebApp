import OpenAI from "openai";
import { getSystemPrompt } from "./system_instructions";
import { Intent } from "./intent_classifier";

const MODEL = "gpt-5.4-mini";

const OPENAI_VECTOR_STORE_ID_FACILITY = process.env.OPENAI_VECTOR_STORE_ID_FACILITY;
const OPENAI_VECTOR_STORE_ID_TRANSPORT = process.env.OPENAI_VECTOR_STORE_ID_TRANSPORT;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

interface GenerateStreamResponseParams {
  userMessage: string;
  previousResponseId?: string | null;
  roomId?: string;
  approved?: boolean;
  currentLocation?: string;
  representativeName?: string | null;
  representativeEmail?: string | null;
  representativePhone?: string | null;
  checkInDate?: string;
  checkOutDate?: string;
  intent?: Intent;
  needsOperatorCheck?: boolean;
}

/** intentに応じてfile_searchが参照するVector Store IDの配列を返す */
function resolveVectorStoreIds(intent: Intent): string[] {
  switch (intent) {
    case "facility":
      return OPENAI_VECTOR_STORE_ID_FACILITY ? [OPENAI_VECTOR_STORE_ID_FACILITY] : [];
    case "transport_tourism":
      return OPENAI_VECTOR_STORE_ID_TRANSPORT ? [OPENAI_VECTOR_STORE_ID_TRANSPORT] : [];
    case "combined":
      return [
        ...(OPENAI_VECTOR_STORE_ID_FACILITY ? [OPENAI_VECTOR_STORE_ID_FACILITY] : []),
        ...(OPENAI_VECTOR_STORE_ID_TRANSPORT ? [OPENAI_VECTOR_STORE_ID_TRANSPORT] : []),
      ];
    case "emergency":
    case "conversation":
    case "unknown":
      return [];
  }
}

/** intentに応じてweb_searchを有効にするかを返す */
function shouldUseWebSearch(intent: Intent): boolean {
  return intent === "transport_tourism" || intent === "combined";
}

export async function* generateStreamResponse({
  userMessage,
  previousResponseId,
  roomId,
  approved,
  representativeName,
  representativeEmail,
  representativePhone,
  currentLocation,
  checkInDate,
  checkOutDate,
  intent = "unknown",
  needsOperatorCheck = true,
}: GenerateStreamResponseParams): AsyncGenerator<unknown, void, unknown> {
  try {
    // システムプロンプトを動的生成
    const systemPrompt = await getSystemPrompt(roomId || "", approved || false, {
      representativeName: representativeName ?? null,
      representativeEmail: representativeEmail ?? null,
      representativePhone: representativePhone ?? null,
      currentLocation: currentLocation ?? undefined,
      checkInDate,
      checkOutDate,
    }, intent, needsOperatorCheck);
    console.info("Generated system prompt for:", {
      roomId,
      approved,
      representativeName,
      representativeEmail,
      representativePhone,
      currentLocation,
      checkInDate,
      checkOutDate,
    });

    const tools: Array<Record<string, unknown>> = [];

    // File Search ツール（intentに応じてVector Storeを選択）
    const vectorStoreIds = resolveVectorStoreIds(intent);
    if (vectorStoreIds.length > 0) {
      tools.push({
        type: "file_search",
        vector_store_ids: vectorStoreIds,
        max_num_results: 10,
        ranking_options: { score_threshold: 0.2 },
      });
    }

    // Web Search ツール（intentに応じて有効化）
    if (shouldUseWebSearch(intent)) {
      tools.push({
        type: "web_search_preview",
        search_context_size: "low",
      });
    }

    console.info(
      `[StreamResponse] intent="${intent}" vectorStores=${JSON.stringify(vectorStoreIds)} tools=${JSON.stringify(tools.map((t) => t.type))}`,
    );

    // needsOperatorCheckがtrueの場合のみ転送関連フィールドをスキーマに含める
    const baseProperties: Record<string, unknown> = {
      assistant_response_text: {
        type: "string",
        description:
          "Clean assistant response text, excluding citation markers, reference numbers, and metadata annotations like 'citeturn0forecast0'.",
      },
      reference_sources: {
        type: "array",
        items: { type: "string" },
        description:
          "Sources referenced by the assistant (database files, web URLs, etc.). Empty array [] if no external sources were used.",
      },
      images: {
        type: "array",
        items: { type: "string" },
        description:
          "An array of absolute HTTPS image URLs relevant to the answer for display in the chat UI. If none are relevant, return an empty array []. Limit to at most 15.",
      },
    };

    const operatorProperties: Record<string, unknown> = {
      needs_human_operator: {
        type: "boolean",
        description:
          "Set to true ONLY when the user answers 'yes' to the question 'Would you like to transfer your inquiry to an operator?' (オペレーターにお問い合わせを転送しますか？). NEVER set to true before asking this confirmation question. This triggers a Telegram notification to the operator.",
      },
      inquiry_summary_for_operator: {
        type: "string",
        description:
          "A concise summary of the guest's inquiry for the human operator. If guest information IS available in the system prompt, DO NOT include it here. If NOT available, include the guest's contact info obtained during the conversation. Return empty string \"\" if needs_human_operator is false.",
      },
    };

    const schemaProperties = needsOperatorCheck
      ? { ...baseProperties, ...operatorProperties }
      : baseProperties;

    const schemaRequired = needsOperatorCheck
      ? ["assistant_response_text", "reference_sources", "images", "needs_human_operator", "inquiry_summary_for_operator"]
      : ["assistant_response_text", "reference_sources", "images"];

    const requestPayload: Record<string, unknown> = {
      model: MODEL,
      instructions: systemPrompt,
      input: [{ role: "user", content: userMessage }],
      tools: tools,
      reasoning: {
        effort: "low",
      },
      parallel_tool_calls: true,
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
            properties: schemaProperties,
            required: schemaRequired,
            additionalProperties: false,
          },
        },
      },
    };
    if (previousResponseId)
      requestPayload.previous_response_id = previousResponseId;

    // OpenAI SDK expects a broadly typed payload; we cast here safely
    const response = await openai.responses.create(
      requestPayload as unknown as Record<string, unknown>,
    );

    for await (const chunk of response as unknown as AsyncIterable<unknown>) {
      yield chunk;
    }

    yield `data: ${JSON.stringify({ completed: true })}\n\n`;

    console.info("Response API stream completed successfully");
  } catch (e) {
    console.error(`Error in generateStreamResponse: ${e}`);
    yield `data: ${JSON.stringify({ error: String(e) })}\n\n`;
  }
}
