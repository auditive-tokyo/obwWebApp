import OpenAI from "openai";

const SUMMARIZER_MODEL = "gpt-5.4-nano";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

const SYSTEM_PROMPT = `You are a hotel concierge assistant at Osaka Bay Wheel (大阪ベイホイール).
Based on the conversation history, write a concise summary in Japanese for the human operator who will be taking over.
Focus on: the guest's issue, urgency, and any contact info mentioned during the conversation that is NOT already stored in the system.
Do not repeat information that should already be in the database (room number, name, check-in/out dates).
Return only the JSON object with no extra text.`;

const RESPONSE_SCHEMA = {
  type: "json_schema",
  name: "operator_summary",
  strict: true,
  schema: {
    type: "object",
    properties: {
      inquiry_summary_for_operator: {
        type: "string",
        description:
          "Concise Japanese summary of the guest's inquiry for the human operator.",
      },
    },
    required: ["inquiry_summary_for_operator"],
    additionalProperties: false,
  },
} as const;

/**
 * 会話履歴（previousResponseId）をもとにオペレーター向けサマリーを生成する
 */
export async function summarizeForOperator(
  previousResponseId: string,
): Promise<string> {
  try {
    const requestPayload: Record<string, unknown> = {
      model: SUMMARIZER_MODEL,
      instructions: SYSTEM_PROMPT,
      input: [
        {
          role: "user",
          content: "この会話内容をオペレーター向けに要約してください。",
        },
      ],
      previous_response_id: previousResponseId,
      reasoning: { effort: "low" },
      text: {
        format: RESPONSE_SCHEMA,
      },
    };

    const response = await (
      openai.responses.create as (
        payload: Record<string, unknown>,
      ) => Promise<{ output_text: string }>
    )(requestPayload);

    const parsed = JSON.parse(response.output_text) as {
      inquiry_summary_for_operator: string;
    };
    console.info(
      "[OperatorSummarizer] Summary generated:",
      parsed.inquiry_summary_for_operator.slice(0, 100),
    );
    return parsed.inquiry_summary_for_operator;
  } catch (e) {
    console.error("[OperatorSummarizer] Failed to generate summary:", e);
    return "（サマリーの生成に失敗しました）";
  }
}
