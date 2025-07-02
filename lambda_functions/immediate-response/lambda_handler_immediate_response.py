import json
import urllib.parse
import base64
import boto3
import os
from twilio.twiml.voice_response import VoiceResponse, Gather
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

    # クエリパラメータを取得
    query_params = event.get('queryStringParameters', {})
    language = query_params.get('language', 'en-US')
    previous_openai_response_id_from_query = query_params.get('previous_openai_response_id')
    source = query_params.get('source') # どのGatherからのリクエストかを取得
    
    print(f"  Query Param - language: {language}")
    print(f"  Query Param - previous_openai_response_id: {previous_openai_response_id_from_query}")
    print(f"  Query Param - source: {source}")

    speech_result = None
    call_sid = None
    digits_result = None # DTMF入力を格納する変数
 
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

    # A. オペレーター選択プロンプト(DTMF)からの応答
    if source == 'operator_choice_dtmf':
        print("Handling response from 'operator_choice_dtmf' prompt.")
        if digits_result == '1':
            # オペレーターに転送
            print("User pressed 1 for operator. Transferring...")
            operator_phone_number = os.environ.get("OPERATOR_PHONE_NUMBER", "+15005550006") # テスト用番号
            transfer_message = lingual_mgr.get_message(language, "transferring_to_operator")
            voice = lingual_mgr.get_voice(language)
            twilio_response.say(transfer_message, language=language, voice=voice)
            twilio_response.dial(operator_phone_number)
        elif digits_result == '2':
            # 他の用件を伺う
            print("User pressed 2 for other inquiries. Re-prompting.")
            follow_up_msg = lingual_mgr.get_message(language, "follow_up_question")
            voice = lingual_mgr.get_voice(language)
            gather = Gather(
                input='speech', method='POST', language=language,
                speechTimeout='auto', timeout=5, speechModel='deepgram-nova-3',
                action=f'?language={language}&previous_openai_response_id={previous_openai_response_id_from_query}'
            )
            gather.say(follow_up_msg, language=language, voice=voice)
            twilio_response.append(gather)
            twilio_response.hangup() # タイムアウトしたら通話終了
        else:
            # タイムアウトまたは無効な入力
            print("Timeout or invalid input after operator choice prompt.")
            timeout_message = lingual_mgr.get_message(language, "timeout_message")
            voice = lingual_mgr.get_voice(language)
            twilio_response.say(timeout_message, language=language, voice=voice)
            twilio_response.hangup()

    # B. ユーザーが言語選択の番号を入力した場合
    elif digits_result:
        # このブロックは言語選択専用
        print("Handling language selection.")
        language_selection_valid = True
        if digits_result == "1":
            language = "en-US"
            print(f"Language selected: English (en-US)")
        elif digits_result == "2":
            language = "ja-JP"
            print(f"Language selected: Japanese (ja-JP)")
        else:
            language_selection_valid = False
            print(f"Invalid digit input: {digits_result}. Re-prompting for language.")
            # 不正な入力の場合、再度言語選択を促す
            gather_lang = Gather(input='dtmf', numDigits=1, method='POST', action='?action=language_selected')
            gather_lang.say("For English, press 1.", language="en-US", voice=lingual_mgr.get_voice("en-US"))
            gather_lang.say("日本語をご希望の場合は2を押してください。", language="ja-JP", voice=lingual_mgr.get_voice("ja-JP"))
            twilio_response.append(gather_lang)
            twilio_response.hangup()

        if language_selection_valid:
            # 言語選択成功後、用件を伺う (リトライ処理は別途考慮が必要)
            welcome_message = lingual_mgr.get_message(language, "welcome")
            voice = lingual_mgr.get_voice(language)
            gather_inquiry = Gather(
                input='speech', method='POST', language=language,
                speechTimeout='auto', timeout=5, speechModel='deepgram-nova-3',
                action=f'?language={language}&attempt=1'
            )
            gather_inquiry.say(welcome_message, language=language, voice=voice)
            twilio_response.append(gather_inquiry)
            # Gatherがタイムアウトした場合の処理は、次のリクエストで attempt=1 を見て判断する
            # ここでは、タイムアウトしたら通話が終了するようにhangupを追加しておく
            twilio_response.hangup()

    # C. ユーザーの発話を受け取った場合
    elif speech_result and call_sid:
        # URLから言語設定を取得 (action URLに含めて渡す)
        language = event.get('queryStringParameters', {}).get('language', language) # speech_captured actionから渡された言語
        print(f"Speech result received: '{speech_result}'. Invoking AI processing Lambda.")

        payload = {
            'speech_result': speech_result,
            'call_sid': call_sid,
            'language': language, # AI処理Lambdaに言語情報を渡す
            'previous_openai_response_id': previous_openai_response_id_from_query
        }

        try:
            lambda_client.invoke(
                FunctionName=AI_PROCESSING_LAMBDA_NAME,
                InvocationType='Event',
                Payload=json.dumps(payload)
            )
            print(f"Successfully invoked {AI_PROCESSING_LAMBDA_NAME} asynchronously.")
        except Exception as e:
            print(f"Error invoking {AI_PROCESSING_LAMBDA_NAME}: {e}")
            # エラー発生時
            error_message_text = lingual_mgr.get_message(language, "processing_error")
            voice = lingual_mgr.get_voice(language)
            twilio_response.say(error_message_text, language=language, voice=voice)
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
        analyzing_message_text = lingual_mgr.get_message(language, "received_and_analyzing")
        voice = lingual_mgr.get_voice(language)
        twilio_response.say(analyzing_message_text, language=language, voice=voice)
        twilio_response.pause(length=15)

    # D. 初回呼び出し (GETリクエスト、または入力なしのPOST)
    else:
        # 言語選択用のGather
        gather_lang = Gather(input='dtmf', numDigits=1, method='POST', action='?action=language_selected')
        # 1秒ポーズをGatherの内側の最初に配置
        gather_lang.pause(length=1)
        # Gather内に音声プロンプトを配置することで、再生中でもボタン入力を検知できるようになる
        gather_lang.say("For English, press 1.", language="en-US", voice=lingual_mgr.get_voice("en-US"))
        gather_lang.say("日本語をご希望の場合は2を押してください。", language="ja-JP", voice=lingual_mgr.get_voice("ja-JP"))

        # 作成したGatherをレスポンスに追加
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

    # TwiMLを返す
    twiml_body = str(twilio_response)
    print(f"ImmediateResponse Lambda Returning TwiML: {twiml_body}")
    return {
        'statusCode': 200,
        'headers': {'Content-Type': 'application/xml'},
        'body': twiml_body
    }
