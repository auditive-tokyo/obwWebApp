import asyncio
import json
import os
from twilio.rest import Client
from twilio.twiml.voice_response import VoiceResponse, Gather as TwilioGather
import openai
import classification_service
from vector_search import openai_vector_search_with_file_search_tool
from lingual_manager import LingualManager

ACCOUNT_SID = os.environ.get('TWILIO_ACCOUNT_SID')
AUTH_TOKEN = os.environ.get('TWILIO_AUTH_TOKEN')
LAMBDA1_FUNCTION_URL = os.environ.get('LAMBDA1_FUNCTION_URL')
OPENAI_API_KEY = os.environ.get('OPENAI_API_KEY')
OPENAI_VECTOR_STORE_ID = os.environ.get('OPENAI_VECTOR_STORE_ID')

twilio_client = None
if ACCOUNT_SID and AUTH_TOKEN:
    twilio_client = Client(ACCOUNT_SID, AUTH_TOKEN)
else:
    print("エラー: TWILIO_ACCOUNT_SID または TWILIO_AUTH_TOKEN が環境変数に設定されていません。")

# LingualManagerのインスタンスを作成
lingual_mgr = LingualManager()

# 非同期OpenAIクライアントのインスタンスを作成 (Lambdaのグローバルスコープで)
openai_async_client = None
if OPENAI_API_KEY:
    openai_async_client = openai.AsyncOpenAI(api_key=OPENAI_API_KEY)
else:
    print("エラー: OPENAI_API_KEY が環境変数に設定されていません。非同期OpenAIクライアントを初期化できません。")


async def update_twilio_call_async(call_sid: str, twiml_string: str):
    """Twilioの通話を非同期で更新する (実際にはrun_in_executorで同期呼び出しをラップ)"""
    if not twilio_client:
        print("Error: update_twilio_call_async - Twilio client not initialized.")
        # エラーを呼び出し元に伝えるか、ここで例外を発生させる
        raise ConnectionError("Twilio client not initialized for async update.")
    try:
        loop = asyncio.get_event_loop()
        # twilio_client.calls(call_sid).update はブロッキングIOなので別スレッドで実行
        await loop.run_in_executor(None, lambda: twilio_client.calls(call_sid).update(twiml=twiml_string))
        print(f"Async Twilio call update for {call_sid} completed via executor.")
    except Exception as e:
        print(f"Error in update_twilio_call_async for call {call_sid}: {e}")
        # エラーを呼び出し元に伝えるか、ここで例外を発生させる
        raise


async def lambda_handler_async(event, context):
    print(f"AIProcessing Lambda Event: {json.dumps(event)}")
    speech_result = event.get('speech_result')
    call_sid = event.get('call_sid')
    language = event.get('language', 'en-US')
    voice = lingual_mgr.get_voice(language)

    if not twilio_client:
        print("エラー: Twilio clientが初期化されていません。")
        # ここでユーザーにエラーを伝えるTwiMLを返すのは難しいので、ログに残して終了
        return {'status': 'error', 'message': 'Twilio client not initialized at handler start'}
    
    if not openai_async_client: # OpenAIクライアントもチェック
        print("エラー: OpenAI async clientが初期化されていません。")
        return {'status': 'error', 'message': 'OpenAI async client not initialized at handler start'}

    # ★ OPENAI_VECTOR_STORE_ID のチェックを追加
    if not OPENAI_VECTOR_STORE_ID:
        print("エラー: OPENAI_VECTOR_STORE_ID が環境変数に設定されていません。")
        # ユーザーにエラーを伝えるTwiMLを返すのは難しいので、ログに残して終了
        # 必要であれば、ここでユーザーにシステムエラーを伝える処理を追加
        return {'status': 'error', 'message': 'OPENAI_VECTOR_STORE_ID not configured'}


    if not call_sid:
        print("エラー: call_sid がイベントに含まれていません。")
        return {'status': 'error', 'message': 'Missing call_sid'}

    if not speech_result:
        print("警告: speech_resultがAIProcessing Lambdaに渡されませんでした。")
        error_msg = lingual_mgr.get_message(language, "could_not_understand")
        hangup_msg = lingual_mgr.get_message(language, "hangup")
        error_response = VoiceResponse()
        error_response.say(error_msg, language=language, voice=voice)
        error_response.say(hangup_msg, language=language, voice=voice)
        error_response.hangup()
        try:
            await update_twilio_call_async(call_sid, str(error_response))
        except Exception as e:
            print(f"Error updating call with speech_result error: {e}")
        return {'status': 'error', 'message': 'Missing speech_result for processing'}

    try:
        print(f"Classifying speech: {speech_result}")
        urgency_result = await classification_service.classify_message_urgency_with_openai_tool_calling(
            openai_async_client,
            speech_result
        )
        print(f"Classification result: {urgency_result}")

        ai_response_segment = ""
        should_hangup_due_to_classification_error = False

        if urgency_result == "general":
            # 1. 「データベースを検索します」というメッセージを準備
            announce_search_msg = lingual_mgr.get_message(language, "general_inquiry")
            announce_twiml = VoiceResponse()
            announce_twiml.say(announce_search_msg, language=language, voice=voice)
            
            # タスクを作成
            announce_task = update_twilio_call_async(call_sid, str(announce_twiml))
            # search_task = openai_vector_search( # 修正前
            #     openai_async_client,
            #     speech_result,
            #     language
            # )
            search_task = openai_vector_search_with_file_search_tool( # 修正後
                openai_async_client,
                speech_result,
                language,
                OPENAI_VECTOR_STORE_ID # ★ OPENAI_VECTOR_STORE_ID を渡す
            )
            
            print("Announcement and vector search tasks created, starting them in parallel...")
            try:
                # アナウンス送信とベクトル検索を並行して実行
                # gather は両方のタスクが完了するまで待つ
                announce_result, search_results_text = await asyncio.gather(
                    announce_task,
                    search_task
                )                
                print("Search announcement sent and vector search completed.")
                print(f"Vector search service returned: {search_results_text}")

            except Exception as e_gather:
                # gather で実行したタスクのいずれかでエラーが発生した場合
                print(f"Error during announcement or vector search: {e_gather}")
                return {'status': 'error', 'message': f"Processing error during general inquiry: {str(e_gather)}"}

            # 3. 検索結果に基づいて次のTwiMLを生成
            results_twiml_obj = VoiceResponse()
            results_twiml_obj.say(search_results_text, language=language, voice=voice)
            
            gather = TwilioGather(
                input='speech', language=language, method='POST',
                action=f"{LAMBDA1_FUNCTION_URL}?language={language}",
                timeout=5, speechTimeout='auto', speechModel='deepgram-nova-3'
            )
            follow_up_msg = lingual_mgr.get_message(language, "follow_up_question")
            gather.say(follow_up_msg, language=language, voice=voice)
            results_twiml_obj.append(gather)

            timeout_msg = lingual_mgr.get_message(language, "timeout_message")
            results_twiml_obj.say(timeout_msg, language=language, voice=voice)
            results_twiml_obj.hangup()

            try:
                await update_twilio_call_async(call_sid, str(results_twiml_obj))
                print("Search results and follow-up prompt sent to user.")
                return {'status': 'completed', 'action': 'provided_search_results_and_gathered'}
            except Exception as e_results:
                print(f"Error sending search results to user: {e_results}")
                return {'status': 'error', 'message': f"Failed to send search results: {str(e_results)}"}

        # ... (urgent, unknown, error のケースは変更なし、ただし update_twilio_call_async を使うようにする) ...
        elif urgency_result == "urgent":
            ai_response_segment = lingual_mgr.get_message(language, "urgent_inquiry")
            # (TwiML構築)
            response_twiml_obj = VoiceResponse() # ... urgent用のTwiML ...
            response_twiml_obj.say(ai_response_segment, language=language, voice=voice)
            gather = TwilioGather( input='speech', language=language, method='POST', action=f"{LAMBDA1_FUNCTION_URL}?language={language}", timeout=5, speechTimeout='auto', speechModel='deepgram-nova-3')
            follow_up_msg = lingual_mgr.get_message(language, "follow_up_question")
            gather.say(follow_up_msg, language=language, voice=voice)
            response_twiml_obj.append(gather)
            timeout_msg = lingual_mgr.get_message(language, "timeout_message")
            response_twiml_obj.say(timeout_msg, language=language, voice=voice)
            response_twiml_obj.hangup()
            try:
                await update_twilio_call_async(call_sid, str(response_twiml_obj))
                return {'status': 'completed', 'action': 'prompted_for_more_requests_urgent'}
            except Exception as e:
                print(f"Error in urgent case: {e}")
                return {'status': 'error', 'message': f"Twilio API error in urgent case: {str(e)}"}


        elif urgency_result == "unknown":
            ai_response_segment = lingual_mgr.get_message(language, "inquiry_not_understood")
            response_twiml_obj = VoiceResponse() # ... unknown用のTwiML ...
            response_twiml_obj.say(ai_response_segment, language=language, voice=voice)
            gather = TwilioGather( input='speech', language=language, method='POST', action=f"{LAMBDA1_FUNCTION_URL}?language={language}", timeout=5, speechTimeout='auto', speechModel='deepgram-nova-3')
            re_prompt_msg = lingual_mgr.get_message(language, "re_prompt_inquiry") # 再度促すメッセージ
            gather.say(re_prompt_msg, language=language, voice=voice)
            response_twiml_obj.append(gather)
            timeout_msg = lingual_mgr.get_message(language, "timeout_message")
            response_twiml_obj.say(timeout_msg, language=language, voice=voice)
            response_twiml_obj.hangup()
            try:
                await update_twilio_call_async(call_sid, str(response_twiml_obj))
                return {'status': 'completed', 'action': 'prompted_again_unknown'}
            except Exception as e:
                print(f"Error in unknown case: {e}")
                return {'status': 'error', 'message': f"Twilio API error in unknown case: {str(e)}"}


        elif urgency_result == "error" or should_hangup_due_to_classification_error: # should_hangup... は既に上で処理されているはずだが念のため
            print("Classification service error or unexpected result. Hanging up.")
            ai_response_segment = lingual_mgr.get_message(language, "system_error")
            error_hangup_response = VoiceResponse()
            error_hangup_response.say(ai_response_segment, language=language, voice=voice)
            error_hangup_response.hangup()
            try:
                await update_twilio_call_async(call_sid, str(error_hangup_response))
                print(f"Successfully updated call {call_sid} to hang up due to classification error.")
                return {'status': 'completed', 'action': 'hangup_due_to_classification_error'}
            except Exception as e_hangup:
                print(f"Error updating call to hang up after classification error: {e_hangup}")
                return {'status': 'error', 'message': f"Twilio API error during error hangup: {str(e_hangup)}"}


    except openai.APIError as e: # これは openai_async_client を直接使った場合に発生する可能性
        print(f"OpenAI APIエラーが発生しました: {e}")
        # ユーザーにエラーを伝える試み
        try:
            error_response = VoiceResponse()
            error_response.say(lingual_mgr.get_message(language, "processing_error"), language=language, voice=voice)
            error_response.hangup()
            await update_twilio_call_async(call_sid, str(error_response))
        except Exception as e_twil:
            print(f"Failed to inform user about OpenAI API error via Twilio: {e_twil}")
        return {'status': 'error', 'message': f"OpenAI API Error: {str(e)}"}
    except ConnectionError as e: # update_twilio_call_async から発生する可能性
        print(f"Twilio接続エラー: {e}")
        return {'status': 'error', 'message': f"Twilio Connection Error: {str(e)}"}
    except Exception as e:
        print(f"AI処理中に予期せぬエラーが発生しました: {e}")
        try:
            error_response = VoiceResponse()
            error_response.say(lingual_mgr.get_message(language, "processing_error"), language=language, voice=voice)
            error_response.hangup()
            await update_twilio_call_async(call_sid, str(error_response))
        except Exception as e_twil:
            print(f"Failed to inform user about unexpected error via Twilio: {e_twil}")
        return {'status': 'error', 'message': f"Unexpected error: {str(e)}"}

def lambda_handler(event, context):
    # asyncio.run() を使って非同期関数を呼び出す
    return asyncio.run(lambda_handler_async(event, context))
