import OpenAI from "openai";

const CLASSIFIER_MODEL = "gpt-5.4-nano";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

const SYSTEM_PROMPT = `
You are a classifier for a Japanese hotel chatbot.
Analyze the user's message and conversation history (if any) to determine whether the situation warrants offering a transfer to a human operator.

Return true if ANY of the following apply:
- The user explicitly requests to speak with staff or an operator
- The user has an urgent problem (cannot enter room, equipment failure, water leak, safety concern, noise complaint)
- The user has been trying to resolve an issue across multiple turns and it remains unresolved
- The user expresses distress, frustration, or urgency
- The issue requires physical action by staff (e.g., key replacement, repair, emergency assistance)
- This assistant cannot resolve the issue (e.g., requests to send email/SMS/make a phone call on behalf of the user)

Return false if:
- This is a simple information request (check-in time, facility info, directions, FAQ, etc.)
- This is casual conversation, greeting, or thanks
- This is a first-turn question about a non-urgent topic
- The user's question can be fully answered with information alone

Important: This classifier determines whether the main AI should ASK the user if they want to be transferred.
The actual transfer only happens if the user explicitly agrees. This is a pre-check to decide if the offer is appropriate.

Return only the JSON object. No explanation.
`;

const RESPONSE_SCHEMA = {
  type: "json_schema",
  name: "operator_transfer_classification",
  strict: true,
  schema: {
    type: "object",
    properties: {
      needs_operator_check: {
        type: "boolean",
        description:
          "Whether the conversation warrants offering operator transfer to the user.",
      },
    },
    required: ["needs_operator_check"],
    additionalProperties: false,
  },
} as const;

export async function classifyOperatorTransferNeeded(
  userMessage: string,
  previousResponseId?: string | null,
): Promise<boolean> {
  try {
    const requestPayload: Record<string, unknown> = {
      model: CLASSIFIER_MODEL,
      instructions: SYSTEM_PROMPT,
      input: [{ role: "user", content: userMessage }],
      reasoning: { effort: "low" },
      text: {
        format: RESPONSE_SCHEMA,
      },
    };

    if (previousResponseId) {
      requestPayload.previous_response_id = previousResponseId;
    }

    const response = await (
      openai.responses.create as (
        payload: Record<string, unknown>,
      ) => Promise<{ output_text: string }>
    )(requestPayload);

    const parsed = JSON.parse(response.output_text) as {
      needs_operator_check: boolean;
    };
    console.info(
      `[OperatorTransferClassifier] message="${userMessage.slice(0, 60)}" → needs_operator_check=${parsed.needs_operator_check}`,
    );
    return parsed.needs_operator_check;
  } catch (e) {
    console.error(
      "[OperatorTransferClassifier] Failed to classify, falling back to true:",
      e,
    );
    return true; // フォールバックは安全側（転送可能性を残す）
  }
}
