import { saveResponseId, loadResponseId } from './utils';
import { parse } from 'best-effort-json-parser';

type OptionalUserInfo = {
  representativeName?: string;
  representativeEmail?: string;
  representativePhone?: string;
};

export async function fetchAIResponseStream(
  message: string,
  roomId: string,
  approved: boolean,
  currentLocation: string | undefined,
  onDelta: (
    text: string | { assistant_response_text: string; reference_sources?: string[]; images?: string[] },
    isDone?: boolean
  ) => void,
  userInfo?: OptionalUserInfo
): Promise<void> {
  let streamedText = "";
  let gotFinal = false;

  const url = import.meta.env.VITE_CHAT_LAMBDA_URL;
  const previous_response_id = loadResponseId();
  const payload = { 
    message, 
    previous_response_id, 
    roomId,
    approved,
    currentLocation,
    ...((userInfo && Object.keys(userInfo).length) ? { userInfo } : {})
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "text/event-stream",
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
    // console.log("Raw chunk received:", chunkStr);

    const lines = chunkStr.split('\n');
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const obj = JSON.parse(line);

        if (obj.type === "response.output_text.delta" && obj.delta && !gotFinal) {
          streamedText += obj.delta;
          onDelta(parse(streamedText), false);
        }
        else if (!gotFinal &&
                 obj.type === "response.content_part.done" &&
                 obj.part?.type === "output_text" &&
                 obj.part?.text) {
          const result = parse(obj.part.text) as any;
          onDelta({
            assistant_response_text: typeof result?.assistant_response_text === 'string' ? result.assistant_response_text : obj.part.text,
            reference_sources: Array.isArray(result?.reference_sources) ? result.reference_sources : [],
            images: Array.isArray(result?.images) ? result.images : [],
          }, true);
          gotFinal = true;
        }
        else if (!gotFinal && obj.type === "response.output_text.done" && obj.text) {
          const result = parse(obj.text) as any;
          onDelta({
            assistant_response_text: typeof result?.assistant_response_text === 'string' ? result.assistant_response_text : obj.text,
            reference_sources: Array.isArray(result?.reference_sources) ? result.reference_sources : [],
            images: Array.isArray(result?.images) ? result.images : [],
          }, true);
          gotFinal = true;
        }
        else if (obj.responseId) {
          saveResponseId(obj.responseId);
        }
      } catch (e) {
        console.error("JSON parse error:", e, line);
      }
    }
  }
}