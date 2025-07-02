class LingualManager:
    def __init__(self):
        self.messages = {
            "ja-JP": {
                "welcome": "お電話ありがとうございます。こちらは大阪ベイウィールのAI自動応答です。ご用件をどうぞ。",
                "received_and_analyzing": "メッセージを受け取りました。解析します。少々お待ちください。",
                "could_not_understand": "聞き取れませんでした。",
                "re_prompt_inquiry": "お手数ですが、もう一度、ご用件をお話しください。",
                "hangup": "お手数ですが、もう一度おかけ直しください。",
                "processing_error": "システムエラーが発生しました。申し訳ありませんが、後ほどおかけ直しください。",
                # 緊急度判定用メッセージを追加
                "urgent_inquiry": "緊急のお問い合わせと判断しました。これは、デモバージョンですが、本番環境ではここで担当者にお繋ぎします。",
                "general_inquiry": "データベースを検索しますので、少々お待ちください。",
                "inquiry_not_understood": "お問い合わせ内容を解析できませんでした。可能な限りゆっくり話してください。",
                "follow_up_question": "他にもご用件はございますか？",
                "prompt_for_operator_dtmf": "オペレーターにお繋ぎする場合は「いち」を、他のご用件がございましたら「に」を押してください。",
                "transferring_to_operator": "オペレーターにお繋ぎします。少々お待ちください。",
                "timeout_message": "タイムアウトしました。またご用件がございましたら、おかけ直しください。お電話ありがとうございました。",
                "ending_message": "承知いたしました。お電話ありがとうございました。",
                "system_error": "システムエラーのため、これ以上の対応はできません。申し訳ありません。"
            },
            "en-US": {
                "welcome": "Thank you for calling. This is the Osaka Bay Wheel AI automated attendant. How can I help you?",
                "received_and_analyzing": "Message received. I am analyzing it. Please wait a moment.",
                "could_not_understand": "I couldn't understand your request.",
                "re_prompt_inquiry": "Could you please state your inquiry again?",
                "hangup": "Please try calling again.",
                "processing_error": "A system error occurred. I apologize, please try calling back later.",
                # 英語版の緊急度判定用メッセージを追加
                "urgent_inquiry": "I've identified this as an urgent inquiry. This is a demo version, but in the production environment, I would connect you with a representative.",
                "general_inquiry": "I will search the database, please wait a moment.",
                "inquiry_not_understood": "I was unable to analyze your inquiry. Please try speaking as slowly as possible.",
                "follow_up_question": "Is there anything else I can help you with?",
                "prompt_for_operator_dtmf": "To speak with an operator, please press 1. For other inquiries, please press 2.",
                "transferring_to_operator": "Connecting you to an operator. Please wait a moment.",
                "timeout_message": "The session has timed out. If you have any other inquiries, please call again. Thank you for your call.",
                "ending_message": "Understood. Thank you for your call.",
                "system_error": "Due to a system error, I cannot process further requests. I apologize for the inconvenience."
            }
            # 他の言語は後で追加
        }
        self.voices = {
            "ja-JP": "Polly.Tomoko-Neural",
            "en-US": "Polly.Ruth-Neural"
            # 他の言語のボイスも追加
        }

    def get_message(self, language_code, key):
        """
        指定された言語コードとキーに基づいてメッセージを取得します。
        インスタンス変数に依存せず、引数のみを使用するように修正。
        """
        lang_messages = self.messages.get(language_code)
        if not lang_messages:
            print(f"Warning: Language code '{language_code}' not found in messages. Returning key '{key}'.")
            return key
        
        message = lang_messages.get(key)
        if not message:
            print(f"Warning: Message key '{key}' not found for language '{language_code}'. Returning key itself.")
            return key
            
        return message

    def get_voice(self, language_code):
        """
        指定された言語コードに基づいて音声名を取得します。
        インスタンス変数を変更しないように修正。
        """
        return self.voices.get(language_code, self.voices["en-US"]) # デフォルトは 'en-US'