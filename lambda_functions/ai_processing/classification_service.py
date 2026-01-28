import openai
import json
from typing import Optional

# 有効な緊急度の値
VALID_URGENCY_VALUES = frozenset(["urgent", "general", "operator_request", "unknown"])

# JSON Schema for Structured Outputs
urgency_classification_schema = {
    "type": "object",
    "properties": {
        "urgency": {
            "type": "string",
            "enum": ["urgent", "general", "operator_request", "unknown"],
            "description": "問い合わせの緊急度。緊急の場合は'urgent'、オペレーターと話したい場合は'operator_request'、一般的な問い合わせは'general'、判断できない場合は'unknown'。"
        },
        "reasoning": {
            "type": "string",
            "description": "なぜその緊急度と判断したかの簡単な理由。"
        }
    },
    "required": ["urgency", "reasoning"],
    "additionalProperties": False
}


def _extract_text_from_content(content_item) -> Optional[str]:
    """コンテンツアイテムからoutput_textのテキストを抽出"""
    if hasattr(content_item, 'type') and content_item.type == 'output_text':
        return content_item.text
    return None


def _extract_text_from_message(item) -> Optional[str]:
    """messageタイプのアイテムからテキストを抽出"""
    if not (hasattr(item, 'type') and item.type == 'message'):
        return None
    if not (hasattr(item, 'content') and item.content):
        return None
    
    for content_item in item.content:
        text = _extract_text_from_content(content_item)
        if text:
            return text
    return None


def _extract_text_from_response(response) -> Optional[str]:
    """OpenAIレスポンスからテキストを抽出"""
    if not response.output:
        return None
    
    for item in response.output:
        text = _extract_text_from_message(item)
        if text:
            return text
    return None


def _parse_urgency_result(text: str) -> dict:
    """JSON文字列から緊急度結果をパース"""
    result = json.loads(text)
    urgency = result.get("urgency")
    reasoning = result.get("reasoning", "N/A")
    
    print(f"分類結果: urgency='{urgency}', reasoning='{reasoning}'")
    
    if urgency in VALID_URGENCY_VALUES:
        return {"urgency": urgency}
    
    print(f"予期しない緊急度の値: {urgency}")
    return {"urgency": "unknown"}


def _handle_api_status_error(e: openai.APIStatusError) -> dict:
    """APIStatusErrorの詳細をログ出力してエラー結果を返す"""
    error_details = "N/A"
    try:
        error_details_json = e.response.json()
        error_details = json.dumps(error_details_json, indent=2, ensure_ascii=False)
    except json.JSONDecodeError:
        error_details = e.response.text
    except Exception as ex_detail:
        error_details = f"エラー詳細の取得中に別のエラーが発生: {ex_detail}"
        
    print(f"OpenAI APIがエラーを返しました (ステータスコード: {e.status_code}): {e.response}")
    print(f"エラー詳細:\n{error_details}")
    return {"urgency": "error"}


async def classify_message_urgency(
    openai_async_client: openai.AsyncOpenAI,
    user_message: str
) -> dict:
    """
    OpenAIを使用してユーザーのメッセージの緊急度を分類（初回ターンのみ実行）
    
    Args:
        openai_async_client: OpenAI非同期クライアント
        user_message: 分類するメッセージ
    
    Returns:
        {
            'urgency': str ("urgent", "general", "operator_request", "unknown", "error")
        }
    """
    if not openai_async_client:
        print("Error: classify_message_urgency - OpenAI async client not provided.")
        return {"urgency": "error", "response_id": None}

    print(f"メッセージの緊急度を分類中: '{user_message}'")

    system_instructions = """あなたはOsaka Bay Wheelというホテルのユーザーからの問い合わせを分類するアシスタントです。
ユーザーの最初のメッセージを以下の4つのカテゴリに分類してください。

判断基準：

1. **緊急（urgent）**: 人命に関わるもの、ゲストの安全・セキュリティに関わるもの
   - 不審者の侵入や目撃
   - 火事・煙・焦げ臭い
   - 地震・台風などの災害
   - 盗難・紛失（特に鍵やセキュリティに関わるもの）
   - 事故・怪我
   - 水漏れ・ガス漏れ
   - 器物損壊
   - 救急を要する体調不良
   - その他犯罪行為

2. **オペレーター希望（operator_request）**: ユーザーが明確に人間のオペレーターと話したいと言っている
   - 「オペレーターと話したい」
   - 「人と話したい」
   - 「スタッフに繋いでほしい」
   - 「担当者はいますか」
   など

3. **一般（general）**: 施設案内、チェックイン方法など通常の問い合わせ

4. **不明（unknown）**: 意味が分からない、判断できないテキスト

回答は以下のJSON形式で返してください：
{
  "urgency": "urgent" または "general" または "operator_request" または "unknown",
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
            }
        )

        # レスポンスからテキストを抽出
        text = _extract_text_from_response(response)
        if text:
            return _parse_urgency_result(text)
        
        print("テキスト出力が見つかりませんでした")
        return {"urgency": "unknown"}

    except openai.APIConnectionError as e:
        print(f"OpenAI APIへの接続に失敗しました: {e}")
        return {"urgency": "error"}
    except openai.RateLimitError as e:
        print(f"OpenAI APIのレート制限に達しました: {e}")
        return {"urgency": "error"}
    except openai.APIStatusError as e:
        return _handle_api_status_error(e)
    except Exception as e:
        print(f"OpenAI分類中に予期せぬエラーが発生しました: {e}")
        return {"urgency": "error"}
