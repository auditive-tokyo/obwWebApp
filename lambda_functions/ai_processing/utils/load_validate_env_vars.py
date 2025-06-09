import os

def load_and_validate_essential_env_vars():
    """
    必須の環境変数を読み込み、全てが設定されているか検証します。
    もしどれか不足していれば EnvironmentError を発生させます。
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