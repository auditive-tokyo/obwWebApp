import asyncio
import json
import os
from twilio.rest import Client
from twilio.twiml.voice_response import VoiceResponse, Gather as TwilioGather
import openai
import classification_service
# 内部モジュールのインポート
from vector_search import openai_vector_search_with_file_search_tool
from utils.validation import validate_essential_env_vars, validate_handler_resources
from utils.twilio_utils import update_twilio_call_async
# layerのインポート
from lingual_manager import LingualManager
from ssml_helper import wrap_with_prosody

ACCOUNT_SID = os.environ.get('TWILIO_ACCOUNT_SID')
AUTH_TOKEN = os.environ.get('TWILIO_AUTH_TOKEN')
LAMBDA1_FUNCTION_URL = os.environ.get('LAMBDA1_FUNCTION_URL')
OPENAI_API_KEY = os.environ.get('OPENAI_API_KEY')
OPENAI_VECTOR_STORE_ID = os.environ.get('OPENAI_VECTOR_STORE_ID')
OPERATOR_PHONE_NUMBER = os.environ.get('OPERATOR_PHONE_NUMBER', '+15005550006')  # デフォルトはTwilioのテスト番号

validate_essential_env_vars()

# インスタンスの作成
twilio_client = Client(ACCOUNT_SID, AUTH_TOKEN)
lingual_mgr = LingualManager()
openai_async_client = openai.AsyncOpenAI(api_key=OPENAI_API_KEY)


def _build_action_url(language: str, room_number: str = None, phone_last4: str = None, response_id: str = None, source: str = None) -> str:
    """GatherのアクションURLを構築"""
    url = f"{LAMBDA1_FUNCTION_URL}?language={language}"
    if source:
        url += f"&source={source}"
    if response_id:
        url += f"&previous_openai_response_id={response_id}"
    if room_number:
        url += f"&room_number={room_number}"
    if phone_last4:
        url += f"&phone_last4={phone_last4}"
    return url


def _create_timeout_hangup_twiml(response: VoiceResponse, language: str, voice: str) -> None:
    """タイムアウトメッセージと切断を追加"""
    timeout_msg = lingual_mgr.get_message(language, "timeout_message")
    response.say(wrap_with_prosody(timeout_msg), language=language, voice=voice)
    response.pause(length=3)
    response.hangup()


def _create_error_hangup_twiml(language: str, voice: str, message_key: str = "processing_error") -> VoiceResponse:
    """エラーメッセージと切断のTwiMLを生成"""
    response = VoiceResponse()
    response.say(wrap_with_prosody(lingual_mgr.get_message(language, message_key)), language=language, voice=voice)
    response.pause(length=3)
    response.hangup()
    return response


async def _send_error_and_hangup(call_sid: str, language: str, voice: str, message_key: str = "processing_error") -> dict:
    """エラーメッセージを送信して切断"""
    error_twiml = _create_error_hangup_twiml(language, voice, message_key)
    try:
        await update_twilio_call_async(twilio_client, call_sid, str(error_twiml))
    except Exception as e:
        print(f"Failed to send error message: {e}")
    return {'status': 'error', 'message': message_key}


def _parse_search_results(search_results_json: str, language: str) -> dict:
    """検索結果JSONをパース"""
    try:
        return json.loads(search_results_json)
    except json.JSONDecodeError:
        print(f"Error: Failed to parse JSON from vector search: {search_results_json}")
        return {
            "assistant_response_text": lingual_mgr.get_message(language, "system_error"),
            "needs_operator": False,
            "response_id": None
        }


async def _handle_end_conversation(call_sid: str, language: str, voice: str, assistant_text: str) -> dict:
    """会話終了処理"""
    ending_twiml = VoiceResponse()
    ending_twiml.say(wrap_with_prosody(assistant_text), language=language, voice=voice)
    ending_msg = lingual_mgr.get_message(language, "ending_message")
    ending_twiml.say(wrap_with_prosody(ending_msg), language=language, voice=voice)
    ending_twiml.pause(length=3)
    ending_twiml.hangup()
    
    try:
        await update_twilio_call_async(twilio_client, call_sid, str(ending_twiml))
        print("Conversation ended by user request.")
        return {'status': 'completed', 'action': 'conversation_ended'}
    except Exception as e:
        print(f"Error ending conversation: {e}")
        return {'status': 'error', 'message': f"Failed to end conversation: {str(e)}"}


async def _handle_operator_choice(call_sid: str, language: str, voice: str, assistant_text: str, 
                                   response_id: str, room_number: str, phone_last4: str) -> dict:
    """オペレーター転送の選択肢を提示"""
    twiml = VoiceResponse()
    twiml.say(wrap_with_prosody(assistant_text), language=language, voice=voice)
    
    prompt_text = lingual_mgr.get_message(language, "prompt_for_operator_dtmf")
    action_url = _build_action_url(language, room_number, phone_last4, response_id, "operator_choice_dtmf")
    
    gather = TwilioGather(
        input='dtmf',
        num_digits=1,
        method='POST',
        timeout=7,
        action=action_url
    )
    gather.say(wrap_with_prosody(prompt_text), language=language, voice=voice)
    twiml.append(gather)
    _create_timeout_hangup_twiml(twiml, language, voice)
    
    await update_twilio_call_async(twilio_client, call_sid, str(twiml))
    print("Prompted user for operator transfer choice (DTMF).")
    return {'status': 'completed', 'action': 'prompted_for_operator_choice_dtmf'}


async def _handle_search_results_response(call_sid: str, language: str, voice: str, assistant_text: str,
                                           response_id: str, room_number: str, phone_last4: str) -> dict:
    """検索結果を返して次の質問を促す"""
    twiml = VoiceResponse()
    twiml.say(wrap_with_prosody(assistant_text), language=language, voice=voice)
    
    action_url = _build_action_url(language, room_number, phone_last4, response_id)
    gather = TwilioGather(
        input='speech', language=language, method='POST',
        action=action_url, timeout=7, speechTimeout='auto', speechModel='deepgram-nova-3'
    )
    follow_up_msg = lingual_mgr.get_message(language, "follow_up_question")
    gather.say(wrap_with_prosody(follow_up_msg), language=language, voice=voice)
    twiml.append(gather)
    _create_timeout_hangup_twiml(twiml, language, voice)
    
    try:
        await update_twilio_call_async(twilio_client, call_sid, str(twiml))
        print("Search results and follow-up prompt sent to user.")
        return {
            'status': 'completed',
            'action': 'provided_search_results_and_gathered',
            'openai_response_id': response_id
        }
    except Exception as e:
        print(f"Error sending search results to user: {e}")
        return {'status': 'error', 'message': f"Failed to send search results: {str(e)}"}


async def _handle_general_inquiry(call_sid: str, language: str, voice: str, speech_result: str,
                                   previous_response_id: str, guest_info: dict, room_number: str, phone_last4: str) -> dict:
    """一般的な問い合わせの処理"""
    # 検索中アナウンス
    announce_msg = lingual_mgr.get_message(language, "general_inquiry")
    announce_twiml = VoiceResponse()
    announce_twiml.say(wrap_with_prosody(announce_msg), language=language, voice=voice)
    announce_twiml.pause(length=25)
    
    # 並行処理
    announce_task = update_twilio_call_async(twilio_client, call_sid, str(announce_twiml))
    search_task = openai_vector_search_with_file_search_tool(
        openai_async_client, speech_result, language, OPENAI_VECTOR_STORE_ID, previous_response_id, guest_info
    )
    
    print("Announcement and vector search tasks created, starting them in parallel...")
    _, search_results_json = await asyncio.gather(announce_task, search_task)
    print("Search announcement sent and vector search completed.")
    
    # 結果をパース
    parsed = _parse_search_results(search_results_json, language)
    assistant_text = parsed.get("assistant_response_text", lingual_mgr.get_message(language, "system_error"))
    needs_operator = parsed.get("needs_operator", False)
    end_conversation = parsed.get("end_conversation", False)
    response_id = parsed.get("response_id")
    
    print(f"  Assistant text: {assistant_text}")
    print(f"  Needs operator: {needs_operator}, End conversation: {end_conversation}")
    print(f"  OpenAI Response ID: {response_id}")
    
    if end_conversation:
        return await _handle_end_conversation(call_sid, language, voice, assistant_text)
    
    if needs_operator:
        return await _handle_operator_choice(call_sid, language, voice, assistant_text, response_id, room_number, phone_last4)
    
    return await _handle_search_results_response(call_sid, language, voice, assistant_text, response_id, room_number, phone_last4)


async def _handle_urgent_or_operator(call_sid: str, language: str, voice: str, urgency: str) -> dict:
    """緊急またはオペレーター希望の処理"""
    message_key = "urgent_inquiry" if urgency == "urgent" else "transferring_to_operator"
    ai_response = lingual_mgr.get_message(language, message_key)
    
    twiml = VoiceResponse()
    twiml.say(wrap_with_prosody(ai_response), language=language, voice=voice)
    twiml.dial(OPERATOR_PHONE_NUMBER)
    
    try:
        await update_twilio_call_async(twilio_client, call_sid, str(twiml))
        print(f"Transferred to operator due to: {urgency}")
        return {'status': 'completed', 'action': f'transferred_to_operator_{urgency}'}
    except Exception as e:
        print(f"Error in {urgency} case: {e}")
        return {'status': 'error', 'message': f"Twilio API error in {urgency} case: {str(e)}"}


async def _handle_unknown_inquiry(call_sid: str, language: str, voice: str, room_number: str, phone_last4: str) -> dict:
    """不明な問い合わせの処理"""
    ai_response = lingual_mgr.get_message(language, "inquiry_not_understood")
    twiml = VoiceResponse()
    twiml.say(wrap_with_prosody(ai_response), language=language, voice=voice)
    
    action_url = _build_action_url(language, room_number, phone_last4)
    gather = TwilioGather(
        input='speech', language=language, method='POST',
        action=action_url, timeout=7, speechTimeout='auto', speechModel='deepgram-nova-3'
    )
    re_prompt_msg = lingual_mgr.get_message(language, "re_prompt_inquiry")
    gather.say(wrap_with_prosody(re_prompt_msg), language=language, voice=voice)
    twiml.append(gather)
    _create_timeout_hangup_twiml(twiml, language, voice)
    
    try:
        await update_twilio_call_async(twilio_client, call_sid, str(twiml))
        return {'status': 'completed', 'action': 'prompted_again_unknown'}
    except Exception as e:
        print(f"Error in unknown case: {e}")
        return {'status': 'error', 'message': f"Twilio API error in unknown case: {str(e)}"}


async def _handle_classification_error(call_sid: str, language: str, voice: str) -> dict:
    """分類エラーの処理"""
    print("Classification service error or unexpected result. Hanging up.")
    ai_response = lingual_mgr.get_message(language, "system_error")
    twiml = VoiceResponse()
    twiml.say(wrap_with_prosody(ai_response), language=language, voice=voice)
    twiml.pause(length=3)
    twiml.hangup()
    
    try:
        await update_twilio_call_async(twilio_client, call_sid, str(twiml))
        print(f"Successfully updated call {call_sid} to hang up due to classification error.")
        return {'status': 'completed', 'action': 'hangup_due_to_classification_error'}
    except Exception as e:
        print(f"Error updating call to hang up after classification error: {e}")
        return {'status': 'error', 'message': f"Twilio API error during error hangup: {str(e)}"}


async def _classify_user_message(speech_result: str, previous_response_id: str) -> tuple[str, bool]:
    """ユーザーメッセージを分類"""
    if previous_response_id:
        print(f"Continuing conversation with previous_response_id: {previous_response_id}")
        print("Skipping classification - treating as 'general' inquiry")
        return "general", False
    
    print(f"First turn - Classifying user message: '{speech_result}'")
    classification_result = await classification_service.classify_message_urgency(
        openai_async_client, speech_result
    )
    print(f"Classification result: {classification_result}")
    urgency = classification_result.get('urgency')
    should_hangup = urgency == "error"
    
    if should_hangup:
        print("Classification service returned an error. Will proceed to hangup.")
    
    return urgency, should_hangup


async def _handle_missing_speech_result(call_sid: str, language: str, voice: str) -> dict:
    """speech_resultがない場合の処理"""
    print("警告: speech_resultがAIProcessing Lambdaに渡されませんでした。")
    error_msg = lingual_mgr.get_message(language, "could_not_understand")
    hangup_msg = lingual_mgr.get_message(language, "hangup")
    
    twiml = VoiceResponse()
    twiml.say(wrap_with_prosody(error_msg), language=language, voice=voice)
    twiml.say(wrap_with_prosody(hangup_msg), language=language, voice=voice)
    twiml.pause(length=3)
    twiml.hangup()
    
    try:
        await update_twilio_call_async(twilio_client, call_sid, str(twiml))
    except Exception as e:
        print(f"Error updating call with speech_result error: {e}")
    return {'status': 'error', 'message': 'Missing speech_result for processing'}


async def _dispatch_by_urgency(urgency: str, should_hangup: bool, call_sid: str, language: str, voice: str,
                                speech_result: str, previous_response_id: str, guest_info: dict,
                                room_number: str, phone_last4: str) -> dict:
    """緊急度に応じて適切なハンドラにディスパッチ"""
    if urgency == "general":
        return await _handle_general_inquiry(
            call_sid, language, voice, speech_result, previous_response_id, guest_info, room_number, phone_last4
        )
    
    if urgency in ["urgent", "operator_request"]:
        return await _handle_urgent_or_operator(call_sid, language, voice, urgency)
    
    if urgency == "unknown":
        return await _handle_unknown_inquiry(call_sid, language, voice, room_number, phone_last4)
    
    if urgency == "error" or should_hangup:
        return await _handle_classification_error(call_sid, language, voice)
    
    # 予期しないurgency値
    print(f"Unexpected urgency value: {urgency}")
    return await _handle_classification_error(call_sid, language, voice)


async def lambda_handler_async(event, context):
    print(f"AIProcessing Lambda Event: {json.dumps(event)}")
    speech_result = event.get('speech_result')
    call_sid = event.get('call_sid')
    language = event.get('language', 'en-US')
    room_number = event.get('room_number')
    phone_last4 = event.get('phone_last4')
    guest_info = event.get('guest_info')
    previous_response_id = event.get('previous_openai_response_id')

    voice = lingual_mgr.get_voice(language)
    
    # ゲスト情報をログ出力（デバッグ用）
    if guest_info:
        print(f"Guest info received: {guest_info.get('guestName')} in room {guest_info.get('roomNumber')}")
    else:
        print("Warning: No guest info provided in event")

    resource_validation_error = validate_handler_resources(twilio_client, openai_async_client, call_sid)
    if resource_validation_error:
        return resource_validation_error

    if not speech_result:
        return await _handle_missing_speech_result(call_sid, language, voice)

    try:
        # メッセージ分類
        urgency, should_hangup = await _classify_user_message(speech_result, previous_response_id)
        
        # 緊急度に応じた処理にディスパッチ
        return await _dispatch_by_urgency(
            urgency, should_hangup, call_sid, language, voice,
            speech_result, previous_response_id, guest_info, room_number, phone_last4
        )

    except openai.APIError as e:
        print(f"OpenAI APIエラーが発生しました: {e}")
        return await _send_error_and_hangup(call_sid, language, voice, "processing_error")
    except ConnectionError as e:
        print(f"Twilio接続エラー: {e}")
        return {'status': 'error', 'message': f"Twilio Connection Error: {str(e)}"}
    except Exception as e:
        print(f"AI処理中に予期せぬエラーが発生しました: {e}")
        return await _send_error_and_hangup(call_sid, language, voice, "processing_error")

def lambda_handler(event, context):
    # asyncio.run() を使って非同期関数を呼び出す
    return asyncio.run(lambda_handler_async(event, context))
