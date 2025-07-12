export async function fetchAIResponseStream(
  message: string,
  previous_response_id: string = "",
  filter_keys: string[] = [],
  onDelta: (text: string, isDone?: boolean) => void
): Promise<void> {
  const url = "https://m7o42vwvmkxp7557qxcqoeqiie0ozdku.lambda-url.ap-south-1.on.aws/";
  const payload = { message, previous_response_id, filter_keys };

  console.log("Sending request to:", url);
  console.log("Payload:", payload);

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
    console.log("Raw chunk received:", chunkStr);

    // chunk内のすべてのJSONオブジェクトを抽出
    const jsonRegex = /{.*?}(?={|$)/gs;
    let match;
    while ((match = jsonRegex.exec(chunkStr)) !== null) {
      const jsonStr = match[0];
      try {
        const obj = JSON.parse(jsonStr);
        console.log("Parsed chunk object:", obj);
        if (obj.type === "response.output_text.delta" && obj.delta) {
          onDelta(obj.delta, false);
        } else if (obj.type === "response.output_text.done" && obj.text) {
          try {
            const parsed = JSON.parse(obj.text);
            onDelta(parsed.assistant_response_text ?? obj.text, true);
          } catch {
            onDelta(obj.text, true);
          }
        }
      } catch (e) {
        console.log("JSON parse error:", e, jsonStr);
      }
    }
  }
}