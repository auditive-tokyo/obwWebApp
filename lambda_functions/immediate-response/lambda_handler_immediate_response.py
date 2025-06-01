import json
import urllib.parse
import base64
import boto3
import os
from twilio.twiml.voice_response import VoiceResponse

# Lambda関数2の名前を環境変数から取得
AI_PROCESSING_LAMBDA_NAME = os.environ.get('AI_PROCESSING_LAMBDA_NAME', 'obw-ai-processing-function')

lambda_client = boto3.client('lambda')

def lambda_handler(event, context):
    print(f"ImmediateResponse Lambda Event: {json.dumps(event)}")

    # リクエストヘッダー全体をログに出力してOriginを確認
    if 'headers' in event:
        print(f"Request Headers: {json.dumps(event['headers'])}")
        # Originヘッダーの存在を確認 (ヘッダー名は大文字・小文字を区別しない場合があるため、両方試すか、キーを小文字に統一してチェック)
        origin_header = event['headers'].get('origin') or event['headers'].get('Origin')
        if origin_header:
            print(f"Received Origin header: {origin_header}")
        else:
            print("Origin header not found in request.")
    else:
        print("No headers found in event.")

    speech_result = None
    call_sid = None
    actual_body_content_for_parsing = ""

    # Twilioからのリクエストボディを解析
    if event.get('requestContext', {}).get('http', {}).get('method') == 'POST' and 'body' in event and event['body']:
        raw_body = event['body']
        if event.get('isBase64Encoded', False):
            try:
                actual_body_content_for_parsing = base64.b64decode(raw_body).decode('utf-8')
            except Exception as e:
                print(f"Error decoding Base64 body: {e}. Will try to parse raw body.")
                actual_body_content_for_parsing = raw_body
        else:
            actual_body_content_for_parsing = raw_body

        if actual_body_content_for_parsing:
            try:
                parsed_body = urllib.parse.parse_qs(actual_body_content_for_parsing)
                print(f"Parsed body dictionary: {json.dumps(parsed_body)}")
                if 'SpeechResult' in parsed_body:
                    speech_result = parsed_body['SpeechResult'][0]
                    print(f"Received SpeechResult: {speech_result}")
                if 'CallSid' in parsed_body:
                    call_sid = parsed_body['CallSid'][0]
                    print(f"Received CallSid: {call_sid}")
            except Exception as e:
                print(f"Error parsing the body content: {e}")
                # speech_result will remain None
        else:
            print("Body content for parsing is empty.")
    else:
        print("Not a POST request with body, or body is empty.")

    twilio_response = VoiceResponse()

    if speech_result and call_sid:
        # ユーザーの発話を受け取った場合
        print(f"Speech result received: '{speech_result}'. Invoking AI processing Lambda.")

        payload = {
            'speech_result': speech_result,
            'call_sid': call_sid
        }

        try:
            lambda_client.invoke(
                FunctionName=AI_PROCESSING_LAMBDA_NAME,
                InvocationType='Event',  # 非同期呼び出し
                Payload=json.dumps(payload)
            )
            print(f"Successfully invoked {AI_PROCESSING_LAMBDA_NAME} asynchronously.")
        except Exception as e:
            # Lambda2の呼び出しに失敗した場合、ログには残すがユーザーへのTwiML応答は変えない
            print(f"Error invoking {AI_PROCESSING_LAMBDA_NAME}: {e}")

        # Twilioに即時応答
        twilio_response.say(
            "メッセージを受け取りました。解析します。少々お待ちください。",
            language="ja-JP",
            voice="Polly.Tomoko-Neural"
        )
        # Lambda2がCall Updateで通話を上書きするまで待機させるためのPause
        # この時間はLambda2の処理時間に応じて調整
        twilio_response.pause(length=15)
        # この後には何もTwiMLを追加しない。Lambda2が応答を返すことを期待する。

    else:
        # 初回呼び出し、またはSpeechResultが取得できなかった場合 (既存のロジック)
        initial_message = "お電話ありがとうございます。こちらは大阪ベイウィールのAI自動応答です。通信状態によっては最大で５秒程度のレスポンスの遅延がある場合がございます。ご了承ください。"
        prompt_message = "ご用件をどうぞ。"
        twilio_response.say(initial_message, language="ja-JP", voice="Polly.Tomoko-Neural")
        gather = twilio_response.gather(
            input='speech', language='ja-JP', method='POST', timeout=5, speechTimeout='auto'
        )
        gather.say(prompt_message, language="ja-JP", voice="Polly.Tomoko-Neural")
        # <Gather>が失敗した場合のフォールバック (これはTwilioの標準的な使い方として残す)
        twilio_response.say(
            "聞き取れませんでした。お手数ですが、もう一度おかけ直しください。",
            language="ja-JP", voice="Polly.Tomoko-Neural"
        )
        twilio_response.hangup()

    twiml_body = str(twilio_response)
    print(f"ImmediateResponse Lambda Returning TwiML: {twiml_body}")
    return {
        'statusCode': 200,
        'headers': {'Content-Type': 'application/xml'},
        'body': twiml_body
    }
