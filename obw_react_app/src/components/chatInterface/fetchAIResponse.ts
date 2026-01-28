import { saveResponseId, loadResponseId } from "./utils";
import { parse } from "best-effort-json-parser";

type OptionalUserInfo = {
  representativeName?: string;
  representativeEmail?: string;
  representativePhone?: string;
  currentLocation?: string;
  checkInDate?: string;
  checkOutDate?: string;
};

type FinalPayload = {
  assistant_response_text: string;
  reference_sources: string[];
  images: string[];
};

type OnDeltaCallback = (text: string | FinalPayload, isDone?: boolean) => void;

type ParsedResult = {
  assistant_response_text?: unknown;
  reference_sources?: unknown;
  images?: unknown;
};

/**
 * 配列から文字列のみをフィルタリング
 */
function filterStrings(arr: unknown): string[] {
  if (!Array.isArray(arr)) return [];
  return arr.filter((x): x is string => typeof x === "string");
}

/**
 * パース結果から最終ペイロードを構築
 */
function buildFinalPayload(rawText: string): FinalPayload {
  const result = parse(rawText) as ParsedResult;
  const assistantText =
    typeof result?.assistant_response_text === "string"
      ? result.assistant_response_text
      : rawText;

  return {
    assistant_response_text: assistantText,
    reference_sources: filterStrings(result?.reference_sources),
    images: filterStrings(result?.images),
  };
}

/**
 * ストリームイベントを処理
 */
function processStreamEvent(
  obj: Record<string, unknown>,
  state: { streamedText: string; gotFinal: boolean },
  onDelta: OnDeltaCallback,
): void {
  // Delta event - streaming text
  if (
    obj.type === "response.output_text.delta" &&
    obj.delta &&
    !state.gotFinal
  ) {
    state.streamedText += obj.delta;
    onDelta(parse(state.streamedText), false);
    return;
  }

  // Content part done event
  if (!state.gotFinal && obj.type === "response.content_part.done") {
    const part = obj.part as Record<string, unknown> | undefined;
    if (part?.type === "output_text" && typeof part?.text === "string") {
      onDelta(buildFinalPayload(part.text), true);
      state.gotFinal = true;
      return;
    }
  }

  // Output text done event
  if (
    !state.gotFinal &&
    obj.type === "response.output_text.done" &&
    typeof obj.text === "string"
  ) {
    onDelta(buildFinalPayload(obj.text), true);
    state.gotFinal = true;
    return;
  }

  // Response ID event
  if (typeof obj.responseId === "string") {
    saveResponseId(obj.responseId);
  }
}

/**
 * 1行のJSONをパースして処理
 */
function processLine(
  line: string,
  state: { streamedText: string; gotFinal: boolean },
  onDelta: OnDeltaCallback,
): void {
  if (!line.trim()) return;

  try {
    const obj = JSON.parse(line) as Record<string, unknown>;
    processStreamEvent(obj, state, onDelta);
  } catch (e: unknown) {
    try {
      console.error("JSON parse error:", e, line);
    } catch {
      console.error("JSON parse error while logging, line:", line);
    }
  }
}

/**
 * リクエストペイロードを構築
 */
function buildRequestPayload(
  message: string,
  roomId: string,
  approved: boolean,
  userInfo?: OptionalUserInfo,
) {
  const previous_response_id = loadResponseId();
  return {
    message,
    previous_response_id,
    roomId,
    approved,
    ...(userInfo && Object.keys(userInfo).length ? { userInfo } : {}),
  };
}

export async function fetchAIResponseStream(
  message: string,
  roomId: string,
  approved: boolean,
  onDelta: OnDeltaCallback,
  userInfo?: OptionalUserInfo,
): Promise<void> {
  const state = { streamedText: "", gotFinal: false };

  const url = import.meta.env.VITE_CHAT_LAMBDA_URL;
  const payload = buildRequestPayload(message, roomId, approved, userInfo);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    },
    body: JSON.stringify(payload),
  });

  if (!response.body) {
    console.error("No response body");
    throw new Error("No response body");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunkStr = decoder.decode(value, { stream: true });
    const lines = chunkStr.split("\n");

    for (const line of lines) {
      processLine(line, state, onDelta);
    }
  }
}
