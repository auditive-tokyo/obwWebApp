import os
import openai
import json

# OpenAI APIキーを設定 (Lambdaの環境変数から取得することを推奨)
# openai.api_key = os.environ.get("OPENAI_API_KEY")
# SAM CLIローカル実行時など、環境変数が設定されていない場合のフォールバック
if not openai.api_key:
    try:
        # ローカルテスト用に .env ファイルなどから読み込む場合 (例)
        # from dotenv import load_dotenv
        # load_dotenv()
        openai.api_key = os.environ.get("OPENAI_API_KEY")
        if not openai.api_key:
            print("警告: OPENAI_API_KEYが設定されていません。")
    except ImportError:
        print("警告: python-dotenvがインストールされていません。OPENAI_API_KEYが環境変数に設定されているか確認してください。")
    except Exception as e:
        print(f"APIキー読み込み中にエラー: {e}")


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
                        "enum": ["urgent", "general"],
                        "description": "問い合わせの緊急度。緊急の場合は'urgent'、そうでない場合は'general'。"
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


def classify_message_urgency_with_openai_tool_calling(user_message: str) -> str:
    """
    OpenAIのTool Callingを使用してユーザーのメッセージの緊急度を分類します。
    """
    if not openai.api_key:
        print("OpenAI APIキーが未設定のため、キーワードベースの分類にフォールバックします。")
        return classify_message_urgency_keyword_based(user_message)

    print(f"OpenAI (Tool Calling)でメッセージの緊急度を分類中: '{user_message}'")

    system_prompt = """あなたはユーザーからの問い合わせを分類するアシスタントです。
ユーザーのメッセージが緊急かどうかを判断してください。
以下の言葉やフレーズが含まれる場合は「緊急（urgent）」と判断してください：
- 不審者です
- 助けて
- 家具が壊れている
- ドアが壊れている
- 鍵を落とした (紛失した場合)
- 大変なことになっています
- 緊急で連絡が必要です
- 緊急事態です
- 鍵を盗まれた

ただし、「鍵の場所がわからない」「鍵どこだっけ」のような、単に鍵の置き場所を忘れただけで紛失や盗難ではない場合は「一般（general）」のお問い合わせとしてください。
必ず 'categorize_user_request' 関数を呼び出して結果を返してください。
"""
    try:
        response = openai.chat.completions.create(
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
                    reasoning = function_args.get("reasoning", "N/A")  # 任意で理由も取得
                    print(f"OpenAIからの分類結果 (Tool Call): urgency='{urgency}', reasoning='{reasoning}'")
                    if urgency == "urgent":
                        return "urgent"
                    elif urgency == "general":
                        return "general"
                    else:
                        print(f"予期しない緊急度の値: {urgency}")
                        return "general"  # 不明な場合は general とする

        print("Tool callが期待通りに実行されませんでした。")
        # Tool callがなかった場合、メッセージ内容から判断を試みる (フォールバック)
        content_response = response_message.content
        if content_response:
            print(f"Tool callなし。モデルの直接応答: {content_response}")
            if "urgent" in content_response.lower():
                return "urgent"
        return "general"

    except openai.APIConnectionError as e:
        print(f"OpenAI APIへの接続に失敗しました: {e}")
    except openai.RateLimitError as e:
        print(f"OpenAI APIのレート制限に達しました: {e}")
    except openai.APIStatusError as e:
        print(f"OpenAI APIがエラーを返しました (ステータスコード: {e.status_code}): {e.response}")
    except Exception as e:
        print(f"OpenAI (Tool Calling)での分類中に予期せぬエラーが発生しました: {e}")

    print("OpenAI (Tool Calling)での分類に失敗したため、キーワードベースの分類にフォールバックします。")
    return classify_message_urgency_keyword_based(user_message)


def classify_message_urgency_keyword_based(user_message: str) -> str:
    """
    ユーザーのメッセージを緊急度に基づいて分類します。(キーワードベース)
    """
    print(f"キーワードベースでメッセージの緊急度を分類中: '{user_message}'")
    urgent_keywords = [
        "不審者", "助けて", "家具が壊れて", "ドアが壊れて", "鍵を落とした",
        "大変なこと", "緊急で連絡", "緊急事態", "鍵を盗まれた"
    ]
    for keyword in urgent_keywords:
        if keyword in user_message:
            if keyword == "鍵を落とした" and ("場所がわからない" in user_message or "どこだっけ" in user_message):
                continue
            print(f"キーワード「{keyword}」を検出しました。緊急と分類します。")
            return "urgent"
    print("緊急キーワードは検出されませんでした。一般と分類します。")
    return "general"


# デフォルトの関数をTool Calling版に変更
classify_message_urgency = classify_message_urgency_with_openai_tool_calling
# classify_message_urgency = classify_message_urgency_keyword_based # テスト用