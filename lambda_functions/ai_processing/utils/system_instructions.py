from calculate_key_code import calculate_key_code
from datetime import datetime


def get_vector_search_instructions(guest_info: dict, language: str) -> str:
    """
    ベクトル検索用の基本システムインストラクション
    
    Args:
        guest_info: ゲスト情報辞書
        language: 応答言語（例: "ja-JP", "en-US"）
    
    Returns:
        システムインストラクション文字列
    """
    # ゲスト情報から各変数を取得
    guest_name = guest_info.get('guestName') if guest_info else None
    room_number = guest_info.get('roomNumber') if guest_info else None
    # phone = guest_info.get('phone') if guest_info else None
    check_in_date = guest_info.get('checkInDate') if guest_info else None
    check_out_date = guest_info.get('checkOutDate') if guest_info else None
    approval_status = guest_info.get('approvalStatus') if guest_info else None
    key_code = calculate_key_code(room_number) if room_number else None
    
    # 現在時刻
    now = datetime.now()
    
    # デフォルト条件：approval_status が approved 以外、または滞在期間外
    use_default_instructions = True
    
    if approval_status == 'approved' and check_in_date and check_out_date:
        try:
            # check_in_date の深夜0時
            check_in_datetime = datetime.fromisoformat(check_in_date.replace('Z', '+00:00'))
            check_in_start = check_in_datetime.replace(hour=0, minute=0, second=0, microsecond=0)
            
            # check_out_date の昼12時
            check_out_datetime = datetime.fromisoformat(check_out_date.replace('Z', '+00:00'))
            check_out_end = check_out_datetime.replace(hour=12, minute=0, second=0, microsecond=0)
            
            # 滞在期間内かチェック
            if check_in_start <= now <= check_out_end:
                use_default_instructions = False
        except (ValueError, AttributeError) as e:
            print(f"Warning: Failed to parse dates: {e}")
            use_default_instructions = True
    
    # デフォルトパターン（承認されていないか、滞在期間外）
    if use_default_instructions:
        system_instructions = f"""あなたは、〒552-0021 大阪府大阪市港区築港4-2-24にある、Osaka Bay Wheel民泊の親切な電話応答アシスタントです。
あなたの担当は、{room_number}号室の{guest_name}様です。

 {language} で自然な応答を生成してください。

電話でPollyが話しやすいように、簡潔でSpeech Synthesisに適したテキストを生成してください。特殊文字などは厳禁です。

検索結果が見つからない場合や、情報が不十分な場合は、その旨を正確に伝え、オペレーターと話す必要があるか確認してください。
オペレーターと話す必要があるか確認をした場合、'needs_operator' フラグをTrueにしてください。それ以外は全てFalseにしてください。

回答は以下のJSON形式で返してください：
{{
  "assistant_response_text": "ユーザーへの応答テキスト（{language}）",
  "needs_operator": true または false
}}
"""
    else:
        # 承認済みかつ滞在期間内のパターン
        system_instructions = f"""あなたは、〒552-0021 大阪府大阪市港区築港4-2-24にある、Osaka Bay Wheel民泊の親切な電話応答アシスタントです。
あなたの担当は、{room_number}号室の{guest_name}様です。

{room_number}号室のキーボックスの暗証番号のダイヤル4桁（**Key Box Code**）の番号は : {key_code}

 {language} で自然な応答を生成してください。

電話でPollyが話しやすいように、簡潔でSpeech Synthesisに適したテキストを生成してください。特殊文字などは厳禁です。

検索結果が見つからない場合や、情報が不十分な場合は、その旨を正確に伝え、オペレーターと話す必要があるか確認してください。
オペレーターと話す必要があるか確認をした場合、'needs_operator' フラグをTrueにしてください。それ以外は全てFalseにしてください。

回答は以下のJSON形式で返してください：
{{
  "assistant_response_text": "ユーザーへの応答テキスト（{language}）",
  "needs_operator": true または false
}}
"""
    
    return system_instructions
