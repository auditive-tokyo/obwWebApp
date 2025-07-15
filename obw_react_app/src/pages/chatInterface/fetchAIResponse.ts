import { saveResponseId, loadResponseId } from './utils';
import { parse } from 'best-effort-json-parser';

export async function fetchAIResponseStream(
  message: string,
  filter_keys: string[] = [],
  onDelta: (text: string, isDone?: boolean) => void
): Promise<void> {
  let streamedText = "";
  let finalResult = "";

  const url = import.meta.env.VITE_LAMBDA_URL;
  const previous_response_id = loadResponseId();
  const payload = { message, previous_response_id, filter_keys };

  console.debug("Sending request to:", url);
  console.debug("Payload:", payload);

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
        if (obj.type === "response.output_text.delta" && obj.delta) {
          streamedText += obj.delta;
          const parsed = parse(streamedText);
          // console.debug("Parsed JSON:", parsed);
          onDelta(parsed, false);
        }
        else if (obj.type === "response.output_text.done" && obj.text) {
          try {
            const result = JSON.parse(obj.text);
            if (result.reference_files && result.reference_files.length > 0) {
              finalResult += `${result.assistant_response_text}\n\n${result.reference_files.join('\n')}`;
            } else {
              finalResult += result.assistant_response_text;
            }
            console.debug("Final result:", finalResult);
            onDelta(finalResult, true);
          } catch (e) {
            console.error("JSON parse error (done):", e, obj.text);
          }
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