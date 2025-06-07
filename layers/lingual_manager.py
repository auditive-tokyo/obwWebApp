class LingualManager:
    def __init__(self):
        self.messages = {
            "ja-JP": {
                "welcome": "お電話ありがとうございます。こちらは大阪ベイウィールのAI自動応答です。",
                "received_and_analyzing": "メッセージを受け取りました。解析します。少々お待ちください。",
                "prompt_for_inquiry": "ご用件をどうぞ。",
                "could_not_understand": "聞き取れませんでした。",
                "re_prompt_inquiry": "お手数ですが、もう一度、ご用件をお話しください。",
                "hangup": "お手数ですが、もう一度おかけ直しください。",
                "processing_error": "システムエラーが発生しました。申し訳ありませんが、後ほどおかけ直しください。",
                # 緊急度判定用メッセージを追加
                "urgent_inquiry": "緊急のお問い合わせと判断しました。これは、デモバージョンですが、本番環境ではここで担当者にお繋ぎします。",
                "general_inquiry": "一般のお問い合わせと判断しました。これは、デモバージョンですが、本番環境ではここでデータベースの検索を行います。",
                "inquiry_not_understood": "お問い合わせ内容を解析できませんでした。可能な限りゆっくり話してください。",
                "follow_up_question": "他にもご用件はございますか？",
                "timeout_message": "タイムアウトしました。またご用件がございましたら、おかけ直しください。お電話ありがとうございました。",
                "ending_message": "承知いたしました。お電話ありがとうございました。",
                "system_error": "システムエラーのため、これ以上の対応はできません。申し訳ありません。"
            },
            "en-US": {
                "welcome": "Thank you for calling. This is the Osaka Bay Wheel AI automated attendant.",
                "received_and_analyzing": "Message received. I am analyzing it. Please wait a moment.",
                "prompt_for_inquiry": "How can I help you?",
                "could_not_understand": "I couldn't understand your request.",
                "re_prompt_inquiry": "Could you please state your inquiry again?",
                "hangup": "Please try calling again.",
                "processing_error": "A system error occurred. I apologize, please try calling back later.",
                # 英語版の緊急度判定用メッセージを追加
                "urgent_inquiry": "I've identified this as an urgent inquiry. This is a demo version, but in the production environment, I would connect you with a representative.",
                "general_inquiry": "I've identified this as a general inquiry. This is a demo version, but in the production environment, I would search our database for information.",
                "inquiry_not_understood": "I was unable to analyze your inquiry. Please try speaking as slowly as possible.",
                "follow_up_question": "Is there anything else I can help you with?",
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

    def get_message(self, language_code, message_key, default_lang="ja-JP"):
        # 指定された言語のメッセージを取得、なければデフォルト言語、それもなければキー自体を返すかエラー
        # Ensure that if a language is selected, I try to get messages for that language first.
        lang_messages = self.messages.get(language_code)
        if lang_messages and message_key in lang_messages:
            return lang_messages[message_key]
        
        # Fallback to default language if message_key not found in selected language
        default_lang_messages = self.messages.get(default_lang)
        if default_lang_messages and message_key in default_lang_messages:
            return default_lang_messages[message_key]
            
        return f"Message key '{message_key}' not found for language '{language_code}' or default '{default_lang}'"

    def get_voice(self, language_code, default_lang="en-US"):
        # 指定された言語のボイスを取得、なければデフォルト言語、それもなければフォールバックボイスを返す
        return self.voices.get(language_code) or self.voices.get(default_lang) or "Polly.Ruth-Neural"