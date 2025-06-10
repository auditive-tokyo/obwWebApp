import os

def validate_essential_env_vars():
    """
    必須の環境変数を読み込み、全てが設定されているか検証します。
    もし不足していれば EnvironmentError を発生させます。
    正常な場合は、環境変数の値を辞書として返します。
    """
    required_vars = {
        'TWILIO_ACCOUNT_SID': "Twilio Account SID",
        'TWILIO_AUTH_TOKEN': "Twilio Auth Token",
        'LAMBDA1_FUNCTION_URL': "Lambda 1 Function URL",
        'OPENAI_API_KEY': "OpenAI API Key",
        'OPENAI_VECTOR_STORE_ID': "OpenAI Vector Store ID"
    }
    
    missing = []
    env_values = {}
    
    for var, desc in required_vars.items():
        value = os.environ.get(var)
        if not value:
            missing.append(f"{desc} ({var})")
        else:
            env_values[var] = value
            
    if missing:
        raise EnvironmentError(
            "必須の環境変数が設定されていません: " + ", ".join(missing)
        )
    
    return env_values

def validate_handler_resources(twilio_client, openai_async_client, call_sid):
    """
    ハンドラで利用するリソースが正しく初期化されているかを検証します。
    - twilio_client, openai_async_client はクライアントの初期化状況をチェック
    - call_sid はイベントから取得できているかをチェック

    もし不足している場合は、エラーメッセージを含む辞書を返します。
    全て正常なら None を返します。
    """
    if not twilio_client:
        print("エラー: Twilio clientが初期化されていません。")
        return {'status': 'error', 'message': 'Twilio client not initialized at handler start'}

    if not openai_async_client:
        print("エラー: OpenAI async clientが初期化されていません。")
        return {'status': 'error', 'message': 'OpenAI async client not initialized at handler start'}

    if not call_sid:
        print("エラー: call_sid がイベントに含まれていません。")
        return {'status': 'error', 'message': 'Missing call_sid'}

    # 全て正常なら None を返す
    return None