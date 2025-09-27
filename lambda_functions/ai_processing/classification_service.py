import openai
import json

# Tool Callingで使用する関数の定義
tools = [
    {
        "type": "function",
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

    system_instructions = """あなたはOsaka Bay Wheelというホテルのユーザーからの問い合わせを分類するアシスタントです。
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
        response = await openai_async_client.responses.create(
            model="gpt-5-mini",
            instructions=system_instructions,
            input=[
                {"role": "user", "content": user_message}
            ],
            tools=tools,
            tool_choice={
                "type": "function",
                "name": "categorize_user_request"
            },
            store=False
        )

        tool_calls = None
        if response and response.output and isinstance(response.output, list) and len(response.output) > 0:
            first_output_item = response.output[0]
            if hasattr(first_output_item, 'type') and first_output_item.type == 'function_call':
                tool_calls = [{
                    "id": getattr(first_output_item, 'call_id', None),
                    "type": "function",
                    "function": {
                        "name": getattr(first_output_item, 'name', None),
                        "arguments": getattr(first_output_item, 'arguments', None)
                    }
                }]
                print(f"抽出されたTool Call: {tool_calls}")

        if tool_calls:
            for tool_call in tool_calls:
                if tool_call["function"]["name"] == "categorize_user_request":
                    function_args_str = tool_call["function"]["arguments"]
                    if function_args_str:
                        try:
                            function_args = json.loads(function_args_str)
                            urgency = function_args.get("urgency")
                            reasoning = function_args.get("reasoning", "N/A")
                            print(f"OpenAIからの分類結果 (Tool Call): urgency='{urgency}', reasoning='{reasoning}'")
                            if urgency in ["urgent", "general", "unknown"]:
                                return urgency
                            else:
                                print(f"予期しない緊急度の値: {urgency}。'unknown'として扱います。")
                                return "unknown"
                        except json.JSONDecodeError as e_json:
                            print(f"Tool Callの引数JSONのパースに失敗しました: {e_json}")
                            print(f"問題の引数文字列: {function_args_str}")
                            return "error"
                    else:
                        print("Tool Callの引数が空です。")
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
        error_details = "N/A"
        try:
            # APIからのJSONレスポンスを取得
            error_details_json = e.response.json()
            error_details = json.dumps(error_details_json, indent=2, ensure_ascii=False)
        except json.JSONDecodeError:
            # JSONでデコードできない場合はテキストとして取得
            error_details = e.response.text
        except Exception as ex_detail:
            error_details = f"エラー詳細の取得中に別のエラーが発生: {ex_detail}"
            
        print(f"OpenAI APIがエラーを返しました (ステータスコード: {e.status_code}): {e.response}")
        print(f"エラー詳細:\n{error_details}") # ★エラー詳細を出力
        return "error"
    except Exception as e:
        print(f"OpenAI (Tool Calling)での分類中に予期せぬエラーが発生しました: {e}")
        return "error"


# # --- ここからテスト実行用のコード ---
# if __name__ == "__main__":
#     import asyncio
#     import os

#     async def main_test():
#         # 環境変数からAPIキーを読み込む (テスト実行時のみ)
#         api_key = os.environ.get("OPENAI_API_KEY")
#         if not api_key:
#             print("テスト実行エラー: 環境変数 OPENAI_API_KEY が設定されていません。")
#             return

#         openai_async_client = openai.AsyncOpenAI(api_key=api_key)

#         print("\n--- テスト開始 ---")

#         test_messages = {
#             "緊急のケース1": "部屋で火事だ！助けて！",
#             "緊急のケース2": "不審者が廊下をうろついている、怖い。",
#             "一般的なケース1": "レストランの予約をしたいのですが。",
#             "一般的なケース2": "明日の天気はどうですか？",
#             "不明なケース1": "あｓｄｆｇｈｊｋｌ",
#             "不明なケース2": "えっと、あの、その、あれがですね。",
#             "紛失のケース": "部屋の鍵をなくしてしまいました。",
#             "救急のケース": "気分が悪くて倒れそうです、救急車を呼んでください。"
#         }

#         for description, message in test_messages.items():
#             print(f"\nテストメッセージ ({description}): 「{message}」")
#             try:
#                 urgency = await classify_message_urgency_with_openai_tool_calling(
#                     openai_async_client,
#                     message
#                 )
#                 print(f"分類結果: {urgency}")
#             except Exception as e_test:
#                 print(f"テスト中にエラーが発生しました: {e_test}")
        
#         print("\n--- テスト終了 ---")

#         # 非同期クライアントを閉じる (推奨)
#         await openai_async_client.close()

#     # Python 3.7以降でasyncioのメイン関数を実行する標準的な方法
#     asyncio.run(main_test())