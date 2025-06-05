import json
import urllib.parse
import base64
import boto3
import os
from twilio.twiml.voice_response import VoiceResponse, Gather
try:
    # 本番環境（レイヤーがマウントされている場合）
    from lingual_manager import LingualManager
except ImportError:
    # 開発環境
    import sys
    import os
    # レイヤーのパスを追加
    layer_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "layers/my_common_layer/python")
    sys.path.append(layer_path)
    from lingual_manager import LingualManager

# Lambda関数2の名前を環境変数から取得
AI_PROCESSING_LAMBDA_NAME = os.environ.get('AI_PROCESSING_LAMBDA_NAME', 'obw-ai-processing-function')

lambda_client = boto3.client('lambda')
lingual_mgr = LingualManager() # LingualManagerのインスタンスを作成

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
    digits_result = None # DTMF入力を格納する変数
    language_preference = event.get('queryStringParameters', {}).get('language', 'en-US') # URLクエリから言語設定を取得、デフォルトは英語

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
                if 'Digits' in parsed_body: # Digitsパラメータをチェック
                    digits_result = parsed_body['Digits'][0]
                    print(f"Received Digits: {digits_result}")
                if 'CallSid' in parsed_body:
                    call_sid = parsed_body['CallSid'][0]
                    print(f"Received CallSid: {call_sid}")
            except Exception as e:
                print(f"Error parsing the body content: {e}")
        else:
            print("Body content for parsing is empty.")
    else:
        print("Not a POST request with body, or body is empty.")

    twilio_response = VoiceResponse()

    # 状態を管理するためのシンプルな方法（例：URLクエリパラメータやセッション情報で言語を渡す）
    # ここでは、digits_result があるか、speech_result があるかで処理を分岐
    
    current_action = event.get('queryStringParameters', {}).get('action', 'greet') # actionクエリパラメータで状態管理

    if digits_result: # ユーザーが言語選択の番号を入力した場合
        if digits_result == "1":
            language_preference = "en-US"
            print(f"Language selected: English (en-US)")
        elif digits_result == "2":
            language_preference = "ja-JP"
            print(f"Language selected: Japanese (ja-JP)")
        else:
            # 不正な入力の場合、再度言語選択を促す
            print(f"Invalid digit input: {digits_result}. Defaulting to bilingual messages")

            # 英語のプロンプトを英語のボイスで再生
            twilio_response.say("For English, press 1.", language="en-US", voice=lingual_mgr.get_voice("en-US"))
            
            # 日本語のプロンプトを日本語のボイスで再生
            twilio_response.say("日本語をご希望の場合は2を押してください。", language="ja-JP", voice=lingual_mgr.get_voice("ja-JP"))

            gather_lang = Gather(input='dtmf', numDigits=1, method='POST', action='?action=language_selected')
            twilio_response.append(gather_lang)
            
            # Gatherがタイムアウトした場合のフォールバック - バイリンガルでメッセージ
            # 英語のエラーメッセージ
            twilio_response.say(
                "We could not understand your input. Please try calling again.",
                language="en-US", voice=lingual_mgr.get_voice("en-US")
            )
            # 日本語のエラーメッセージ
            twilio_response.say(
                "入力が確認できませんでした。もう一度おかけ直しください。",
                language="ja-JP", voice=lingual_mgr.get_voice("ja-JP") 
            )
            twilio_response.hangup()
            current_action = "language_selection_failed"

        if current_action != "language_selection_failed":
            # 言語選択成功後、用件を伺う
            welcome_message = lingual_mgr.get_message(language_preference, "welcome")
            voice = lingual_mgr.get_voice(language_preference)

            twilio_response.say(welcome_message, language=language_preference, voice=voice)

            # --- 1回目の用件伺い ---
            prompt_inquiry_text_1 = lingual_mgr.get_message(language_preference, "prompt_for_inquiry")
            gather_inquiry_1 = Gather(
                input='speech',
                method='POST',
                language=language_preference,
                speechTimeout='auto',
                timeout=5,
                speechModel='deepgram-nova-3',
                action=f'?action=speech_captured&language={language_preference}&attempt=1' # 試行回数を渡す
            )
            gather_inquiry_1.say(prompt_inquiry_text_1, language=language_preference, voice=voice)
            twilio_response.append(gather_inquiry_1)

            # --- 1回目のGatherが失敗した場合 (タイムアウト、無音など) ---
            # 「聞き取れませんでした。もう一度お話しください」というメッセージを再生
            retry_speech_prompt_text = lingual_mgr.get_message(language_preference, "could_not_understand_retry")
            twilio_response.say(retry_speech_prompt_text, language=language_preference, voice=voice)

            # --- 2回目の用件伺い (リトライ) ---
            # 再度聞き直すプロンプト (re_prompt_inquiry を使用)
            prompt_inquiry_text_2 = lingual_mgr.get_message(language_preference, "re_prompt_inquiry")
            gather_inquiry_2 = Gather(
                input='speech',
                method='POST',
                language=language_preference,
                speechTimeout='auto',
                timeout=5,
                speechModel='deepgram-nova-3',
                action=f'?action=speech_captured&language={language_preference}&attempt=2'
            )
            gather_inquiry_2.say(prompt_inquiry_text_2, language=language_preference, voice=voice)
            twilio_response.append(gather_inquiry_2)

            # --- 2回目のGatherも失敗した場合 ---
            # 「聞き取れませんでした。おかけ直しください」というメッセージを再生して通話終了
            hangup_speech_prompt_text = lingual_mgr.get_message(language_preference, "could_not_understand_hangup")
            twilio_response.say(hangup_speech_prompt_text, language=language_preference, voice=voice)
            twilio_response.hangup()

    elif speech_result and call_sid: # ユーザーの発話を受け取った場合 (言語選択後)
        # URLから言語設定を取得 (action URLに含めて渡す)
        language_preference = event.get('queryStringParameters', {}).get('language', language_preference) # speech_captured actionから渡された言語
        print(f"Speech result received: '{speech_result}' in language '{language_preference}'. Invoking AI processing Lambda.")

        payload = {
            'speech_result': speech_result,
            'call_sid': call_sid,
            'language': language_preference # AI処理Lambdaに言語情報を渡す
        }

        try:
            lambda_client.invoke(
                FunctionName=f"{AI_PROCESSING_LAMBDA_NAME}:live",
                InvocationType='Event',
                Payload=json.dumps(payload)
            )
            print(f"Successfully invoked {AI_PROCESSING_LAMBDA_NAME} asynchronously.")
        except Exception as e:
            print(f"Error invoking {AI_PROCESSING_LAMBDA_NAME}: {e}")
            # エラー発生時
            error_message_text = lingual_mgr.get_message(language_preference, "processing_error")
            error_voice = lingual_mgr.get_voice(language_preference)
            twilio_response.say(error_message_text, language=language_preference, voice=error_voice)
            twilio_response.hangup()
            # レスポンスを返す前に終了
            twiml_body_error = str(twilio_response)
            print(f"ImmediateResponse Lambda Returning TwiML (Error): {twiml_body_error}")
            return {
                'statusCode': 200,
                'headers': {'Content-Type': 'application/xml'},
                'body': twiml_body_error
            }

        # Twilioに即時応答
        analyzing_message_text = lingual_mgr.get_message(language_preference, "received_and_analyzing")
        analyzing_voice = lingual_mgr.get_voice(language_preference)
        twilio_response.say(analyzing_message_text, language=language_preference, voice=analyzing_voice)
        twilio_response.pause(length=15)

    else: # 初回呼び出し (current_action == 'greet')
        # 英語のプロンプトを英語のボイスで再生
        twilio_response.say("For English, press 1.", language="en-US", voice=lingual_mgr.get_voice("en-US"))
        
        # 日本語のプロンプトを日本語のボイスで再生
        twilio_response.say("日本語をご希望の場合は2を押してください。", language="ja-JP", voice=lingual_mgr.get_voice("ja-JP"))

        # 言語選択用のGather
        gather_lang = Gather(input='dtmf', numDigits=1, method='POST', action='?action=language_selected')
        twilio_response.append(gather_lang)

        # Gatherがタイムアウトした場合のフォールバック - バイリンガルで案内
        twilio_response.say(
            "We could not understand your input. Please try calling again.",
            language="en-US", voice=lingual_mgr.get_voice("en-US")
        )
        twilio_response.say(
            "入力が確認できませんでした。もう一度おかけ直しください。",
            language="ja-JP", voice=lingual_mgr.get_voice("ja-JP")
        )
        twilio_response.hangup()

    twiml_body = str(twilio_response)
    print(f"ImmediateResponse Lambda Returning TwiML: {twiml_body}")
    return {
        'statusCode': 200,
        'headers': {'Content-Type': 'application/xml'},
        'body': twiml_body
    }
