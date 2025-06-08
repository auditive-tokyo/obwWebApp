import os
import openai
import json

# Tool Callingで使用する関数の定義
tools = [
    {
        "type": "function",
        "function": {
            "name": "categorize_user_request",
            "description": "ユーザーからの問い合わせ内容を分析し、緊急度を判断します。",
            "parameters": {
                "type": "object",
                "properties": {
                    "urgency": {
                        "type": "string",
                        "enum": ["urgent", "general", "unknown"],
                        "description": "問い合わせの緊急度。緊急の場合は'urgent'、そうでない場合は'general'、判断できない場合は'unknown'。"
                    },
                    "reasoning": {
                        "type": "string",
                        "description": "なぜその緊急度と判断したかの簡単な理由（モデルの思考）。"
                    }
                },
                "required": ["urgency"]
            }
        }
    }
]


async def classify_message_urgency_with_openai_tool_calling(
    openai_async_client: openai.AsyncOpenAI,
    user_message: str
) -> str:
    """
    OpenAIのTool Callingを使用してユーザーのメッセージの緊急度を分類
    戻り値: "urgent", "general", "unknown", "error"
    """
    if not openai_async_client:
        print("Error: classify_message_urgency - OpenAI async client not provided.")
        return "error"

    print(f"OpenAI (Tool Calling)でメッセージの緊急度を分類中: '{user_message}'")

    system_prompt = """あなたはOsaka Bay Wheelというホテルのユーザーからの問い合わせを分類するアシスタントです。
ユーザーのメッセージが緊急かどうかを判断してください。
判断基準として、以下のケースが挙げられますが、これに限らず人命に関わるものは必ず「緊急（urgent）」としてください。
不明なテキストや意味が分からない質問と判断した場合は「不明（unknown）」としてください。
想定されるケース：
- 不審者
- 家事
- 災害
- 盗難
- 事故
- 水漏れ
- 器物損壊
- 紛失
- 救急
- 犯罪
上記に関わるもの全て

必ず 'categorize_user_request' 関数を呼び出して結果を返してください。
"""
    try:
        response = await openai_async_client.chat.completions.create(
            model="gpt-4.1-mini",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message}
            ],
            tools=tools,
            tool_choice={"type": "function", "function": {"name": "categorize_user_request"}},
            temperature=0.0
        )

        response_message = response.choices[0].message
        tool_calls = response_message.tool_calls

        if tool_calls:
            for tool_call in tool_calls:
                if tool_call.function.name == "categorize_user_request":
                    function_args = json.loads(tool_call.function.arguments)
                    urgency = function_args.get("urgency")
                    reasoning = function_args.get("reasoning", "N/A")
                    print(f"OpenAIからの分類結果 (Tool Call): urgency='{urgency}', reasoning='{reasoning}'")
                    if urgency in ["urgent", "general", "unknown"]:
                        return urgency
                    else:
                        print(f"予期しない緊急度の値: {urgency}。'unknown'として扱います。")
                        return "unknown"
        
        print("OpenAIが期待通りにTool Callを返しませんでした。分類結果を 'unknown' とします。")
        return "unknown"

    except openai.APIConnectionError as e:
        print(f"OpenAI APIへの接続に失敗しました: {e}")
        return "error"
    except openai.RateLimitError as e:
        print(f"OpenAI APIのレート制限に達しました: {e}")
        return "error"
    except openai.APIStatusError as e:
        print(f"OpenAI APIがエラーを返しました (ステータスコード: {e.status_code}: {e.response}")
        return "error"
    except Exception as e:
        print(f"OpenAI (Tool Calling)での分類中に予期せぬエラーが発生しました: {e}")
        return "error"

