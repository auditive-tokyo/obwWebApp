import json
import urllib.parse
import base64
import boto3
from botocore.config import Config
import os
from twilio.twiml.voice_response import VoiceResponse, Gather
from lingual_manager import LingualManager
from authenticate_guest import authenticate_guest
from ssml_helper import wrap_with_prosody

# Lambda関数2の名前を環境変数から取得
AI_PROCESSING_LAMBDA_NAME = os.environ.get('AI_PROCESSING_LAMBDA_NAME', 'obw-ai-processing-function')
OPERATOR_PHONE_NUMBER = os.environ.get('OPERATOR_PHONE_NUMBER', '+15005550006')  # デフォルトはTwilioのテスト番号

# boto3クライアントにタイムアウトを設定（SonarQube対応）
boto3_config = Config(
    connect_timeout=5,    # 接続タイムアウト: 5秒
    read_timeout=30,      # 読み取りタイムアウト: 30秒
    retries={'max_attempts': 3}  # リトライ回数
)
lambda_client = boto3.client('lambda', config=boto3_config)
lingual_mgr = LingualManager() # LingualManagerのインスタンスを作成


# 許可される部屋番号リスト (2F〜8F 各フロア 01〜04号室)
def get_allowed_rooms():
    """2階〜8階の各フロア01〜04号室のリストを生成"""
    allowed = []
    for floor in range(2, 9):  # 2〜8階
        for room in range(1, 5):  # 01〜04号室
            allowed.append(f"{floor}{room:02d}")
    return allowed

ALLOWED_ROOMS = get_allowed_rooms()

def is_valid_room_number(room_number):
    """部屋番号が有効かチェック"""
    return room_number in ALLOWED_ROOMS


# ============================================================
# ヘルパー関数（Cognitive Complexity削減のため）
# ============================================================

def _validate_cloudfront_secret(event):
    """CloudFront Secret検証。失敗時は403レスポンスを返す、成功時はNone"""
    expected_secret = os.environ.get('CLOUDFRONT_SECRET')
    if not expected_secret:
        return None
    
    headers = event.get('headers', {})
    received_secret = headers.get('x-cloudfront-secret')
    if received_secret == expected_secret:
        return None
    
    print('⚠️ CloudFront Secret検証失敗 - 不正なアクセス試行')
    return {
        'statusCode': 403,
        'headers': {'Content-Type': 'application/json'},
        'body': json.dumps({
            'error': 'Forbidden',
            'message': 'Access denied. Invalid CloudFront secret.'
        })
    }


def _log_request_headers(event):
    """リクエストヘッダーをログに出力"""
    if 'headers' not in event:
        print("No headers found in event.")
        return
    
    print(f"Request Headers: {json.dumps(event['headers'])}")
    origin_header = event['headers'].get('origin') or event['headers'].get('Origin')
    if origin_header:
        print(f"Received Origin header: {origin_header}")
    else:
        print("Origin header not found in request.")


def _get_body_content(event):
    """リクエストボディを取得（Base64デコード対応）"""
    is_post = event.get('requestContext', {}).get('http', {}).get('method') == 'POST'
    if not is_post or 'body' not in event or not event['body']:
        print("Not a POST request with body, or body is empty.")
        return ""
    
    raw_body = event['body']
    if not event.get('isBase64Encoded', False):
        return raw_body
    
    try:
        return base64.b64decode(raw_body).decode('utf-8')
    except Exception as e:
        print(f"Error decoding Base64 body: {e}. Will try to parse raw body.")
        return raw_body


def _parse_request_body(event):
    """Twilioからのリクエストボディを解析"""
    body_content = _get_body_content(event)
    if not body_content:
        return None, None, None
    
    try:
        parsed_body = urllib.parse.parse_qs(body_content)
        print(f"Parsed body dictionary: {json.dumps(parsed_body)}")
        
        speech_result = parsed_body.get('SpeechResult', [None])[0]
        digits_result = parsed_body.get('Digits', [None])[0]
        call_sid = parsed_body.get('CallSid', [None])[0]
        
        if speech_result:
            print(f"Received SpeechResult: {speech_result}")
        if digits_result:
            print(f"Received Digits: {digits_result}")
        if call_sid:
            print(f"Received CallSid: {call_sid}")
        
        return speech_result, digits_result, call_sid
    except Exception as e:
        print(f"Error parsing the body content: {e}")
        return None, None, None


def _add_timeout_and_hangup(twilio_response, language):
    """タイムアウトメッセージとハングアップを追加"""
    timeout_msg = lingual_mgr.get_message(language, "timeout_message")
    voice = lingual_mgr.get_voice(language)
    twilio_response.say(wrap_with_prosody(timeout_msg), language=language, voice=voice)
    twilio_response.pause(length=3)
    twilio_response.hangup()


def _create_language_selection_gather():
    """言語選択用のGatherを作成"""
    gather_lang = Gather(input='dtmf', numDigits=1, method='POST', action='?action=language_selected')
    gather_lang.say(wrap_with_prosody("For English, press 1."), language="en-US", voice=lingual_mgr.get_voice("en-US"))
    gather_lang.say(wrap_with_prosody("日本語をご希望の場合は2を押してください。"), language="ja-JP", voice=lingual_mgr.get_voice("ja-JP"))
    return gather_lang


def _create_room_number_gather(language, attempt=1):
    """部屋番号入力用のGatherを作成"""
    room_prompt = lingual_mgr.get_message(language, "prompt_room_number")
    voice = lingual_mgr.get_voice(language)
    gather_room = Gather(
        input='dtmf', numDigits=3, method='POST',
        action=f'?language={language}&source=room_number_input&attempt={attempt}'
    )
    gather_room.say(wrap_with_prosody(room_prompt), language=language, voice=voice)
    return gather_room


def _create_phone_last4_gather(language, room_number, attempt=1):
    """電話番号下4桁入力用のGatherを作成"""
    phone_prompt = lingual_mgr.get_message(language, "prompt_phone_last4")
    voice = lingual_mgr.get_voice(language)
    gather_phone = Gather(
        input='dtmf', numDigits=4, method='POST',
        action=f'?language={language}&source=phone_last4_input&room_number={room_number}&attempt={attempt}'
    )
    gather_phone.say(wrap_with_prosody(phone_prompt), language=language, voice=voice)
    return gather_phone


def _handle_operator_choice_dtmf(twilio_response, digits_result, language, query_params, previous_openai_response_id_from_query, room_number):
    """オペレーター選択プロンプト(DTMF)からの応答を処理"""
    print("Handling response from 'operator_choice_dtmf' prompt.")
    voice = lingual_mgr.get_voice(language)
    
    if digits_result == '1':
        print("User pressed 1 for operator. Transferring...")
        transfer_message = lingual_mgr.get_message(language, "transferring_to_operator")
        twilio_response.say(wrap_with_prosody(transfer_message), language=language, voice=voice)
        twilio_response.dial(OPERATOR_PHONE_NUMBER)
        return
    
    if digits_result == '2':
        print("User pressed 2 for other inquiries. Re-prompting.")
        follow_up_msg = lingual_mgr.get_message(language, "follow_up_question")
        phone_last4 = query_params.get('phone_last4')
        room_param = f"&room_number={room_number}" if room_number else ""
        phone_param = f"&phone_last4={phone_last4}" if phone_last4 else ""
        gather = Gather(
            input='speech', method='POST', language=language,
            speechTimeout='auto', timeout=7, speechModel='deepgram-nova-3',
            action=f'?language={language}&previous_openai_response_id={previous_openai_response_id_from_query}{room_param}{phone_param}'
        )
        gather.say(wrap_with_prosody(follow_up_msg), language=language, voice=voice)
        twilio_response.append(gather)
        twilio_response.pause(length=3)
        twilio_response.hangup()
        return
    
    # タイムアウトまたは無効な入力
    print("Timeout or invalid input after operator choice prompt.")
    _add_timeout_and_hangup(twilio_response, language)


def _handle_valid_room_number(twilio_response, digits_result, language):
    """有効な部屋番号の処理"""
    print(f"Valid room number: {digits_result}")
    gather_phone = _create_phone_last4_gather(language, digits_result, attempt=1)
    twilio_response.append(gather_phone)
    _add_timeout_and_hangup(twilio_response, language)


def _handle_invalid_room_number(twilio_response, digits_result, language, attempt):
    """無効な部屋番号の処理"""
    print(f"Invalid room number: {digits_result}. Attempt: {attempt}")
    invalid_msg = lingual_mgr.get_message(language, "invalid_room_number")
    voice = lingual_mgr.get_voice(language)
    twilio_response.say(wrap_with_prosody(invalid_msg), language=language, voice=voice)
    
    if attempt < 2:
        gather_room_retry = _create_room_number_gather(language, attempt=2)
        twilio_response.append(gather_room_retry)
    
    _add_timeout_and_hangup(twilio_response, language)


def _handle_room_number_input(twilio_response, digits_result, language, attempt):
    """部屋番号入力からの応答を処理"""
    print(f"Handling room number input: {digits_result}")
    
    if is_valid_room_number(digits_result):
        _handle_valid_room_number(twilio_response, digits_result, language)
    else:
        _handle_invalid_room_number(twilio_response, digits_result, language, attempt)


def _handle_auth_success(twilio_response, guest_info, language, room_number, digits_result):
    """認証成功時の処理"""
    print(f"Authentication successful for guest: {guest_info.get('guestName')} in room {room_number}")
    welcome_message = lingual_mgr.get_message(language, "welcome")
    voice = lingual_mgr.get_voice(language)
    gather_inquiry = Gather(
        input='speech', method='POST', language=language,
        speechTimeout='auto', timeout=7, speechModel='deepgram-nova-3',
        action=f'?language={language}&room_number={room_number}&phone_last4={digits_result}&attempt=1'
    )
    gather_inquiry.say(wrap_with_prosody(welcome_message), language=language, voice=voice)
    twilio_response.append(gather_inquiry)
    _add_timeout_and_hangup(twilio_response, language)


def _handle_auth_failure(twilio_response, auth_result, language, room_number, digits_result):
    """認証失敗時の処理"""
    error_code = auth_result.get('error', 'UNKNOWN_ERROR')
    print(f"Authentication failed: {error_code} for room {room_number}, phone_last4 {digits_result}")
    voice = lingual_mgr.get_voice(language)
    auth_failed_msg = lingual_mgr.get_message(language, "authentication_failed")
    twilio_response.say(wrap_with_prosody(auth_failed_msg), language=language, voice=voice)
    twilio_response.pause(length=3)
    twilio_response.hangup()


def _handle_valid_phone_last4(twilio_response, digits_result, language, room_number):
    """有効な電話番号下4桁の処理"""
    print(f"Valid phone last 4 digits: {digits_result}")
    print(f"Room number from query: {room_number}")
    
    auth_result = authenticate_guest(room_number, digits_result)
    
    if auth_result['success']:
        _handle_auth_success(twilio_response, auth_result['guest_info'], language, room_number, digits_result)
    else:
        _handle_auth_failure(twilio_response, auth_result, language, room_number, digits_result)


def _handle_invalid_phone_last4(twilio_response, digits_result, language, room_number, attempt):
    """無効な電話番号下4桁の処理"""
    print(f"Invalid phone last 4 digits: {digits_result}. Attempt: {attempt}")
    invalid_msg = lingual_mgr.get_message(language, "invalid_phone_last4")
    voice = lingual_mgr.get_voice(language)
    twilio_response.say(wrap_with_prosody(invalid_msg), language=language, voice=voice)
    
    if attempt < 2:
        gather_phone_retry = _create_phone_last4_gather(language, room_number, attempt=2)
        twilio_response.append(gather_phone_retry)
    
    _add_timeout_and_hangup(twilio_response, language)


def _handle_phone_last4_input(twilio_response, digits_result, language, room_number, attempt):
    """電話番号下4桁入力からの応答を処理"""
    print(f"Handling phone last 4 digits input: {digits_result}")
    
    is_valid = len(digits_result) == 4 and digits_result.isdigit()
    if is_valid:
        _handle_valid_phone_last4(twilio_response, digits_result, language, room_number)
    else:
        _handle_invalid_phone_last4(twilio_response, digits_result, language, room_number, attempt)


def _handle_language_selection(twilio_response, digits_result):
    """言語選択の処理。選択された言語を返す（無効な場合はNone）"""
    print("Handling language selection.")
    
    language_map = {"1": "en-US", "2": "ja-JP"}
    language = language_map.get(digits_result)
    
    if language:
        print(f"Language selected: {language}")
        gather_room = _create_room_number_gather(language, attempt=1)
        twilio_response.append(gather_room)
        _add_timeout_and_hangup(twilio_response, language)
        return language
    
    # 不正な入力の場合、再度言語選択を促す
    print(f"Invalid digit input: {digits_result}. Re-prompting for language.")
    gather_lang = _create_language_selection_gather()
    twilio_response.append(gather_lang)
    twilio_response.pause(length=3)
    twilio_response.hangup()
    return None


def _retrieve_guest_info(room_number, phone_last4):
    """ゲスト情報を再取得"""
    if not room_number or not phone_last4:
        return None
    
    auth_result = authenticate_guest(room_number, phone_last4)
    if auth_result['success']:
        guest_info = auth_result['guest_info']
        print(f"Guest info retrieved: {guest_info.get('guestName')} in room {room_number}")
        return guest_info
    
    print(f"Warning: Guest re-authentication failed in speech handling: {auth_result.get('error')}")
    return None


def _invoke_ai_processing_lambda(payload, language, twilio_response):
    """AI処理Lambdaを非同期で呼び出す。成功時はTrue、失敗時はFalse"""
    try:
        lambda_client.invoke(
            FunctionName=AI_PROCESSING_LAMBDA_NAME,
            InvocationType='Event',
            Payload=json.dumps(payload)
        )
        print(f"Successfully invoked {AI_PROCESSING_LAMBDA_NAME} asynchronously.")
        return True
    except Exception as e:
        print(f"Error invoking {AI_PROCESSING_LAMBDA_NAME}: {e}")
        error_message_text = lingual_mgr.get_message(language, "processing_error")
        voice = lingual_mgr.get_voice(language)
        twilio_response.say(wrap_with_prosody(error_message_text), language=language, voice=voice)
        twilio_response.pause(length=3)
        twilio_response.hangup()
        return False


def _handle_speech_result(twilio_response, speech_result, call_sid, event, previous_openai_response_id_from_query):
    """ユーザーの発話を受け取った場合の処理。エラー時は早期レスポンスを返す"""
    query_params = event.get('queryStringParameters', {})
    language = query_params.get('language', 'en-US')
    room_number = query_params.get('room_number')
    phone_last4 = query_params.get('phone_last4')
    print(f"Speech result received: '{speech_result}'. Room: {room_number}, Phone: {phone_last4}. Invoking AI processing Lambda.")

    guest_info = _retrieve_guest_info(room_number, phone_last4)

    payload = {
        'speech_result': speech_result,
        'call_sid': call_sid,
        'language': language,
        'room_number': room_number,
        'phone_last4': phone_last4,
        'guest_info': guest_info,
        'previous_openai_response_id': previous_openai_response_id_from_query
    }

    success = _invoke_ai_processing_lambda(payload, language, twilio_response)
    if not success:
        # エラー発生時は早期レスポンスを返す
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
    twilio_response.say(wrap_with_prosody(analyzing_message_text), language=language, voice=voice)
    twilio_response.pause(length=30)  # AI処理完了まで30秒待機（Classification + Vector Search）
    return None


def _handle_initial_call(twilio_response):
    """初回呼び出し (GETリクエスト、または入力なしのPOST)の処理"""
    gather_lang = Gather(input='dtmf', numDigits=1, method='POST', action='?action=language_selected')
    gather_lang.pause(length=1)
    gather_lang.say(wrap_with_prosody("For English, press 1."), language="en-US", voice=lingual_mgr.get_voice("en-US"))
    gather_lang.say(wrap_with_prosody("日本語をご希望の場合は2を押してください。"), language="ja-JP", voice=lingual_mgr.get_voice("ja-JP"))
    twilio_response.append(gather_lang)

    # Gatherがタイムアウトした場合のフォールバック - バイリンガルで案内
    twilio_response.say(
        wrap_with_prosody("We could not understand your input. Please try calling again."),
        language="en-US", voice=lingual_mgr.get_voice("en-US")
    )
    twilio_response.say(
        wrap_with_prosody("入力が確認できませんでした。もう一度おかけ直しください。"),
        language="ja-JP", voice=lingual_mgr.get_voice("ja-JP")
    )
    twilio_response.pause(length=3)
    twilio_response.hangup()


def _build_twiml_response(twiml_body):
    """TwiMLレスポンスを構築"""
    print(f"ImmediateResponse Lambda Returning TwiML: {twiml_body}")
    return {
        'statusCode': 200,
        'headers': {'Content-Type': 'application/xml'},
        'body': twiml_body
    }


# ============================================================
# メインハンドラー
# ============================================================

def lambda_handler(event, context):
    print(f"ImmediateResponse Lambda Event: {json.dumps(event)}")

    # CloudFront Secret検証（セキュリティ）
    forbidden_response = _validate_cloudfront_secret(event)
    if forbidden_response:
        return forbidden_response

    # リクエストヘッダー全体をログに出力してOriginを確認
    _log_request_headers(event)

    # クエリパラメータを取得
    query_params = event.get('queryStringParameters', {}) or {}
    language = query_params.get('language', 'en-US')
    previous_openai_response_id_from_query = query_params.get('previous_openai_response_id')
    source = query_params.get('source')
    attempt = int(query_params.get('attempt', '1'))
    room_number = query_params.get('room_number')
    
    print(f"  Query Param - language: {language}")
    print(f"  Query Param - previous_openai_response_id: {previous_openai_response_id_from_query}")
    print(f"  Query Param - source: {source}")
    print(f"  Query Param - attempt: {attempt}")
    print(f"  Query Param - room_number: {room_number}")

    # Twilioからのリクエストボディを解析
    speech_result, digits_result, call_sid = _parse_request_body(event)

    twilio_response = VoiceResponse()

    # ルーティング処理
    early_response = _route_request(
        twilio_response, source, digits_result, speech_result, call_sid,
        language, query_params, previous_openai_response_id_from_query,
        room_number, attempt, event
    )
    if early_response:
        return early_response

    return _build_twiml_response(str(twilio_response))


def _route_request(twilio_response, source, digits_result, speech_result, call_sid,
                   language, query_params, previous_openai_response_id_from_query,
                   room_number, attempt, event):
    """リクエストを適切なハンドラーにルーティング"""
    # A. オペレーター選択プロンプト(DTMF)からの応答
    if source == 'operator_choice_dtmf':
        _handle_operator_choice_dtmf(
            twilio_response, digits_result, language, query_params,
            previous_openai_response_id_from_query, room_number
        )
        return None

    # B. 部屋番号入力からの応答
    if source == 'room_number_input' and digits_result:
        _handle_room_number_input(twilio_response, digits_result, language, attempt)
        return None

    # C. 電話番号下4桁入力からの応答
    if source == 'phone_last4_input' and digits_result:
        _handle_phone_last4_input(twilio_response, digits_result, language, room_number, attempt)
        return None

    # D. ユーザーが言語選択の番号を入力した場合
    if digits_result:
        _handle_language_selection(twilio_response, digits_result)
        return None

    # E. ユーザーの発話を受け取った場合
    if speech_result and call_sid:
        return _handle_speech_result(
            twilio_response, speech_result, call_sid, event,
            previous_openai_response_id_from_query
        )

    # F. 初回呼び出し (GETリクエスト、または入力なしのPOST)
    _handle_initial_call(twilio_response)
    return None
