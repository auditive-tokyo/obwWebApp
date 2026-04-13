import OpenAI from "openai";

const CLASSIFIER_MODEL = "gpt-5.4-nano";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

export type Intent =
  | "facility"
  | "transport_tourism"
  | "combined"
  | "emergency"
  | "conversation"
  | "unknown";

const INTENT_SYSTEM_PROMPT = `
You are an intent classifier for a Japanese hotel chatbot.
Classify the user's message into exactly one of the following categories:

- facility           : Questions about room features, check-in/out, amenities, cleaning, laundry, luggage storage, invoices, booking changes, or any service requiring staff assistance
- transport_tourism  : Questions about directions, transportation, access routes, nearby sightseeing spots, USJ, or any travel-related topic
- combined           : Questions that involve BOTH facility/services AND transport/tourism (e.g., "I want to store my luggage and then go to USJ", "After late check-out, how do I get to Shin-Osaka?")
- emergency          : Urgent problems requiring immediate action (e.g., cannot enter room, water leak, equipment failure, safety concerns, noise complaints)
- conversation       : Greetings, small talk, thanks, farewells, or messages with no actionable request
- unknown            : Unclear or ambiguous message that does not fit any category above

Rules:
- Return only the JSON object. No explanation, no extra text.
- If in doubt between emergency and facility, choose emergency.
- If in doubt between facility and unknown, choose facility.
- If a message involves both facility/services and transport/tourism topics, choose combined.
- Use unknown ONLY when the message is completely unintelligible (e.g., random characters, severe garbling with no recoverable meaning).
`;

const RESPONSE_SCHEMA = {
  type: "json_schema",
  name: "intent_classification",
  strict: true,
  schema: {
    type: "object",
    properties: {
      intent: {
        type: "string",
        enum: [
          "facility",
          "transport_tourism",
          "combined",
          "emergency",
          "conversation",
          "unknown",
        ],
        description: "The classified intent of the user message.",
      },
    },
    required: ["intent"],
    additionalProperties: false,
  },
} as const;

export async function classifyIntent(
  userMessage: string,
  previousResponseId?: string | null,
): Promise<Intent> {
  try {
    const requestPayload: Record<string, unknown> = {
      model: CLASSIFIER_MODEL,
      instructions: INTENT_SYSTEM_PROMPT,
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

    const parsed = JSON.parse(response.output_text) as { intent: Intent };
    console.info(
      `[IntentClassifier] message="${userMessage.slice(0, 60)}" → intent="${parsed.intent}"`,
    );
    return parsed.intent;
  } catch (e) {
    console.error(
      "[IntentClassifier] Failed to classify intent, falling back to 'unknown':",
      e,
    );
    return "unknown";
  }
}
