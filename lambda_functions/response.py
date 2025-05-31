import json
from twilio.twiml.voice_response import VoiceResponse
import urllib.parse
import base64

import classification_service

def lambda_handler(event, context):
    print(f"Lambda Event: {json.dumps(event)}")

    speech_result = None
    actual_body_content_for_parsing = ""

    if event.get('requestContext', {}).get('http', {}).get('method') == 'POST' and 'body' in event and event['body']:
        raw_body = event['body']
        if event.get('isBase64Encoded', False):
            print("Body is Base64 encoded. Decoding...")
            try:
                actual_body_content_for_parsing = base64.b64decode(raw_body).decode('utf-8')
                print(f"Successfully decoded body: {actual_body_content_for_parsing}")
            except Exception as e:
                print(f"Error decoding Base64 body: {e}. Will try to parse raw body.")
                actual_body_content_for_parsing = raw_body
        else:
            print(f"Body is not Base64 encoded. Raw body: {raw_body}")
            actual_body_content_for_parsing = raw_body

        if actual_body_content_for_parsing:
            try:
                parsed_body = urllib.parse.parse_qs(actual_body_content_for_parsing)
                print(f"Parsed body dictionary: {json.dumps(parsed_body)}")
                if 'SpeechResult' in parsed_body:
                    speech_result = parsed_body['SpeechResult'][0]
                    print(f"Received SpeechResult: {speech_result}")
                else:
                    print(f"No SpeechResult in parsed body. Keys found: {list(parsed_body.keys())}")
            except Exception as e:
                print(f"Error parsing the body content: {e}")
                print(f"Content that failed to parse: {actual_body_content_for_parsing}")
                speech_result = None
        else:
            print("Body content for parsing is empty.")
            speech_result = None
            
    else:
        print("Not a POST request with body, or body is empty.")
        print(f"HTTP Method: {event.get('requestContext', {}).get('http', {}).get('method')}")
        print(f"Body present: {'body' in event}, Body content: {event.get('body')}")

    twilio_response = VoiceResponse()

    if speech_result:
        # 1. ユーザーの発話を受け取ったことを伝える
        twilio_response.say(
            "メッセージを受け取りました。",
            language="ja-JP",
            voice="Polly.Tomoko-Neural"
        )

        # 2. ユーザーのメッセージの緊急度を判断
        #    classification_service.py内の関数を呼び出す
        urgency = classification_service.classify_message_urgency(speech_result)
        
        # 3. 判断結果に基づいて応答
        if urgency == "urgent":
            twilio_response.say(
                "緊急のお問い合わせと判断しました。",
                language="ja-JP",
                voice="Polly.Tomoko-Neural"
            )
        else: # general
            twilio_response.say(
                "一般のお問い合わせと判断しました。",
                language="ja-JP",
                voice="Polly.Tomoko-Neural"
            )
        
        twilio_response.hangup() # 通話を終了
    else:
        # 初回呼び出し、またはSpeechResultが取得できなかった場合
        initial_message = "お電話ありがとうございます。こちらは大阪ベイウィールのAI自動応答です。"
        prompt_message = "ご用件をどうぞ。"
        twilio_response.say(initial_message, language="ja-JP", voice="Polly.Tomoko-Neural")
        gather = twilio_response.gather(
            input='speech', language='ja-JP', method='POST', timeout=5, speechTimeout='auto'
        )
        gather.say(prompt_message, language="ja-JP", voice="Polly.Tomoko-Neural")
        # Gatherがタイムアウトした場合などのフォールバック
        twilio_response.say(
            "聞き取れませんでした。お手数ですが、もう一度おかけ直しください。",
            language="ja-JP", voice="Polly.Tomoko-Neural"
        )
        twilio_response.hangup()

    twiml_body = str(twilio_response)
    print(f"Returning TwiML: {twiml_body}")
    return {
        'statusCode': 200,
        'headers': {'Content-Type': 'application/xml'},
        'body': twiml_body
    }
