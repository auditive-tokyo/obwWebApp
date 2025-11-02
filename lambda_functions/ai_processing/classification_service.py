import openai
import json

# JSON Schema for Structured Outputs
urgency_classification_schema = {
    "type": "object",
    "properties": {
        "urgency": {
            "type": "string",
            "enum": ["urgent", "general", "unknown"],
            "description": "問い合わせの緊急度。緊急の場合は'urgent'、そうでない場合は'general'、判断できない場合は'unknown'。"
        },
        "reasoning": {
            "type": "string",
            "description": "なぜその緊急度と判断したかの簡単な理由。"
        }
    },
    "required": ["urgency", "reasoning"],
    "additionalProperties": False
}


async def classify_message_urgency_with_openai_tool_calling(
    openai_async_client: openai.AsyncOpenAI,
    user_message: str,
    previous_response_id: str = None
) -> dict:
    """
    OpenAIのTool Callingを使用してユーザーのメッセージの緊急度を分類
    
    Args:
        openai_async_client: OpenAI非同期クライアント
        user_message: 分類するメッセージ
        previous_response_id: 前回のレスポンスID（会話の継続用）
    
    Returns:
        {
            'urgency': str ("urgent", "general", "unknown", "error"),
            'response_id': str (次回の previous_response_id として使用)
        }
    """
    if not openai_async_client:
        print("Error: classify_message_urgency - OpenAI async client not provided.")
        return {"urgency": "error", "response_id": None}

    print(f"メッセージの緊急度を分類中: '{user_message}'")

    system_instructions = """あなたはOsaka Bay Wheelというホテルのユーザーからの問い合わせを分類するアシスタントです。
ユーザーのメッセージが緊急かどうかを判断してください。

会話履歴がある場合は、それまでの文脈を考慮して緊急度を判断してください。
例えば、最初は一般的な問い合わせでも、続く発言で緊急性が明らかになる場合があります。

判断基準として、以下のケースが挙げられますが、これに限らず人命に関わるものや、
ゲストの安全・セキュリティに関わるものは必ず「緊急（urgent）」としてください。

想定される緊急ケース：
- 不審者の侵入や目撃
- 火事・煙・焦げ臭い
- 地震・台風などの災害
- 盗難・紛失（特に鍵やセキュリティに関わるもの）
- 事故・怪我
- 水漏れ・ガス漏れ
- 器物損壊
- 救急を要する体調不良
- その他犯罪行為

不明なテキストや意味が分からない質問と判断した場合は「不明（unknown）」としてください。
それ以外の一般的な問い合わせ（施設案内、チェックイン方法など）は「一般（general）」としてください。

回答は以下のJSON形式で返してください：
{
  "urgency": "urgent" または "general" または "unknown",
  "reasoning": "判断理由を簡潔に（日本語）"
}
"""
    try:
        response = await openai_async_client.responses.create(
            model="gpt-5-mini",
            instructions=system_instructions,
            input=[
                {"role": "user", "content": user_message}
            ],
            reasoning={
                "effort": "minimal"
            },
            text={
                "format": {
                    "type": "json_schema",
                    "name": "urgency_classification",
                    "schema": urgency_classification_schema,
                    "strict": True
                },
                "verbosity": "low"
            },
            previous_response_id=previous_response_id
        )

        # レスポンスIDを取得
        response_id = response.id if hasattr(response, 'id') else None

        # レスポンスから message を探す（JSON Schema で返される）
        if response.output:
            for item in response.output:
                # message タイプの出力を探す
                if hasattr(item, 'type') and item.type == 'message':
                    # content 配列から output_text を探す
                    if hasattr(item, 'content') and item.content:
                        for content_item in item.content:
                            if hasattr(content_item, 'type') and content_item.type == 'output_text':
                                # JSON 文字列をパース
                                result = json.loads(content_item.text)
                                urgency = result.get("urgency")
                                reasoning = result.get("reasoning", "N/A")
                                
                                print(f"分類結果: urgency='{urgency}', reasoning='{reasoning}'")
                                
                                if urgency in ["urgent", "general", "unknown"]:
                                    return {
                                        "urgency": urgency,
                                        "response_id": response_id
                                    }
                                else:
                                    print(f"予期しない緊急度の値: {urgency}")
                                    return {
                                        "urgency": "unknown",
                                        "response_id": response_id
                                    }
        
        print("テキスト出力が見つかりませんでした")
        return {
            "urgency": "unknown",
            "response_id": response_id
        }

    except openai.APIConnectionError as e:
        print(f"OpenAI APIへの接続に失敗しました: {e}")
        return {"urgency": "error", "response_id": None}
    except openai.RateLimitError as e:
        print(f"OpenAI APIのレート制限に達しました: {e}")
        return {"urgency": "error", "response_id": None}
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
        return {"urgency": "error", "response_id": None}
    except Exception as e:
        print(f"OpenAI (Tool Calling)での分類中に予期せぬエラーが発生しました: {e}")
        return {"urgency": "error", "response_id": None}


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

#         print("\n--- テスト開始: 段階的な緊急度変化 ---")

#         # テスト1: 不明なテキスト（意味不明な入力）
#         print("\n=== テスト1: 不明なテキスト ===")
#         result1 = await classify_message_urgency_with_openai_tool_calling(
#             openai_async_client,
#             "あのー、えっと、なんか、その。"
#         )
#         print(f"期待: unknown | 結果: urgency={result1['urgency']}")
        
#         # テスト2: 一般的な問い合わせ（緊急性なし）
#         print("\n=== テスト2: 一般的な問い合わせ ===")
#         result2 = await classify_message_urgency_with_openai_tool_calling(
#             openai_async_client,
#             "すみません、近くにコンビニはありますか？",
#             previous_response_id=result1['response_id']
#         )
#         print(f"期待: general | 結果: urgency={result2['urgency']}")
        
#         # テスト3: 緊急性が徐々に明らかになる
#         print("\n=== テスト3: 緊急性の兆候 ===")
#         result3 = await classify_message_urgency_with_openai_tool_calling(
#             openai_async_client,
#             "あと、部屋の廊下で知らない人を見かけたんですが...",
#             previous_response_id=result2['response_id']
#         )
#         print(f"期待: urgent | 結果: urgency={result3['urgency']}")
        
#         # テスト4: 明確な危険・緊急事態
#         print("\n=== テスト4: 明確な緊急事態 ===")
#         result4 = await classify_message_urgency_with_openai_tool_calling(
#             openai_async_client,
#             "その人が今も部屋のドアの前にいて、中に入ろうとしています！",
#             previous_response_id=result3['response_id']
#         )
#         print(f"期待: urgent | 結果: urgency={result4['urgency']}")
        
#         print("\n--- テスト終了 ---")

#         # 非同期クライアントを閉じる (推奨)
#         await openai_async_client.close()

#     # Python 3.7以降でasyncioのメイン関数を実行する標準的な方法
#     asyncio.run(main_test())