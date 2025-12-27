"""
SSML Helper - Twilio音声出力のSSML変換ユーティリティ

責務: 音声出力の「どう話すか」（話速、ピッチ、音量等）を制御
LingualManagerは「何を話すか」（メッセージ内容とボイス選択）を担当
"""

# デフォルトの話速（80% = 0.8倍速）
DEFAULT_SPEECH_RATE = "80%"


def wrap_with_prosody(text: str, rate: str = DEFAULT_SPEECH_RATE) -> str:
    """
    テキストをSSMLのprosodyタグでラップして話速を調整する
    
    Args:
        text: 変換するテキスト
        rate: 話速 (例: "80%", "slow", "medium", "fast", "x-slow", "x-fast")
              パーセンテージの場合: "50%" (半分の速度) 〜 "200%" (2倍速)
    
    Returns:
        SSMLでラップされたテキスト
    
    Example:
        >>> wrap_with_prosody("こんにちは", "80%")
        '<speak><prosody rate="80%">こんにちは</prosody></speak>'
    """
    # テキストが既にSSMLタグを含んでいる場合はそのまま返す
    if text.strip().startswith('<speak>'):
        return text
    
    return f'<speak><prosody rate="{rate}">{text}</prosody></speak>'
