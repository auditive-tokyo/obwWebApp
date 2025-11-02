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

ACCOUNT_SID = os.environ.get('TWILIO_ACCOUNT_SID')
AUTH_TOKEN = os.environ.get('TWILIO_AUTH_TOKEN')
LAMBDA1_FUNCTION_URL = os.environ.get('LAMBDA1_FUNCTION_URL')
OPENAI_API_KEY = os.environ.get('OPENAI_API_KEY')
OPENAI_VECTOR_STORE_ID = os.environ.get('OPENAI_VECTOR_STORE_ID')

validate_essential_env_vars()

# インスタンスの作成
twilio_client = Client(ACCOUNT_SID, AUTH_TOKEN)
lingual_mgr = LingualManager()
openai_async_client = openai.AsyncOpenAI(api_key=OPENAI_API_KEY)


async def lambda_handler_async(event, context):
    print(f"AIProcessing Lambda Event: {json.dumps(event)}")
    speech_result = event.get('speech_result')
    call_sid = event.get('call_sid')
    language = event.get('language', 'en-US')
    room_number = event.get('room_number')
    phone_last4 = event.get('phone_last4')
    guest_info = event.get('guest_info')
    previous_response_id_from_event = event.get('previous_openai_response_id', None)

    voice = lingual_mgr.get_voice(language)
    
    # ゲスト情報をログ出力（デバッグ用）
    if guest_info:
        print(f"Guest info received: {guest_info.get('guestName')} in room {guest_info.get('roomNumber')}")
    else:
        print("Warning: No guest info provided in event")

    resource_validation_error = validate_handler_resources(
        twilio_client,
        openai_async_client,
        call_sid
    )
    if resource_validation_error:
        return resource_validation_error

    if not speech_result:
        print("警告: speech_resultがAIProcessing Lambdaに渡されませんでした。")
        error_msg = lingual_mgr.get_message(language, "could_not_understand")
        hangup_msg = lingual_mgr.get_message(language, "hangup")
        error_response = VoiceResponse()
        error_response.say(error_msg, language=language, voice=voice)
        error_response.say(hangup_msg, language=language, voice=voice)
        error_response.hangup()
        try:
            await update_twilio_call_async(twilio_client, call_sid, str(error_response))
        except Exception as e:
            print(f"Error updating call with speech_result error: {e}")
        return {'status': 'error', 'message': 'Missing speech_result for processing'}

    try:
        urgency_result = None
        should_hangup_due_to_classification_error = False

        # 会話の継続（previous_response_idあり）の場合はclassificationをスキップ
        if previous_response_id_from_event:
            print(f"Continuing conversation with previous_response_id: {previous_response_id_from_event}")
            print("Skipping classification - treating as 'general' inquiry")
            urgency_result = "general"
        else:
            # 初回ターン: ユーザーメッセージの緊急度を分類
            print(f"First turn - Classifying user message: '{speech_result}'")
            
            classification_result = await classification_service.classify_message_urgency(
                openai_async_client,
                speech_result
            )
            print(f"Classification result: {classification_result}")
            urgency_result = classification_result.get('urgency')
            
            if urgency_result == "error":
                # 分類サービス自体がエラーを返した場合
                should_hangup_due_to_classification_error = True
                print("Classification service returned an error. Will proceed to hangup.")

        if urgency_result == "general":
            # 1. 「データベースを検索します」というメッセージを準備
            announce_search_msg = lingual_mgr.get_message(language, "general_inquiry")
            announce_twiml = VoiceResponse()
            announce_twiml.say(announce_search_msg, language=language, voice=voice)
            announce_twiml.pause(length=25)  # Vector Search完了まで25秒待機
            
            # タスクを作成
            announce_task = update_twilio_call_async(twilio_client, call_sid, str(announce_twiml))
            search_task = openai_vector_search_with_file_search_tool(
                openai_async_client,
                speech_result,
                language,
                OPENAI_VECTOR_STORE_ID,
                previous_response_id_from_event,
                guest_info
            )
            
            print("Announcement and vector search tasks created, starting them in parallel...")
            try:
                # アナウンス送信とベクトル検索を並行して実行
                announce_result, search_results_json_string = await asyncio.gather(
                    announce_task,
                    search_task
                )
                print("Search announcement sent and vector search completed.")

                # JSON文字列をパースして必要な情報を取得
                parsed_search_results = {}
                try:
                    parsed_search_results = json.loads(search_results_json_string)
                except json.JSONDecodeError:
                    print(f"Error: Failed to parse JSON from vector search: {search_results_json_string}")
                    # エラー時のデフォルト応答を設定 (またはエラー処理を強化)
                    parsed_search_results["assistant_response_text"] = lingual_mgr.get_message(language, "system_error")
                    parsed_search_results["needs_operator"] = False # デフォルト
                    parsed_search_results["response_id"] = None # デフォルト

                assistant_text_to_speak = parsed_search_results.get("assistant_response_text", lingual_mgr.get_message(language, "system_error"))
                needs_operator_flag = parsed_search_results.get("needs_operator", False)
                end_conversation_flag = parsed_search_results.get("end_conversation", False)
                current_openai_response_id = parsed_search_results.get("response_id")

                print(f"  Assistant text to speak: {assistant_text_to_speak}")
                print(f"  Needs operator flag: {needs_operator_flag}")
                print(f"  End conversation flag: {end_conversation_flag}")
                print(f"  OpenAI Response ID: {current_openai_response_id}")

                # end_conversation_flag が True の場合は会話を終了
                if end_conversation_flag:
                    ending_twiml = VoiceResponse()
                    ending_twiml.say(assistant_text_to_speak, language=language, voice=voice)
                    ending_msg = lingual_mgr.get_message(language, "ending_message")
                    ending_twiml.say(ending_msg, language=language, voice=voice)
                    ending_twiml.hangup()
                    
                    try:
                        await update_twilio_call_async(twilio_client, call_sid, str(ending_twiml))
                        print("Conversation ended by user request.")
                        return {'status': 'completed', 'action': 'conversation_ended'}
                    except Exception as e_ending:
                        print(f"Error ending conversation: {e_ending}")
                        return {'status': 'error', 'message': f"Failed to end conversation: {str(e_ending)}"}

                # needs_operator_flag が True かどうかで応答を分岐
                if needs_operator_flag:
                    # オペレーター転送の選択肢を提示するTwiMLを生成
                    operator_choice_twiml = VoiceResponse()
                    # まず、AIからの提案（「オペレーターにお繋ぎしましょうか？」など）を再生
                    operator_choice_twiml.say(assistant_text_to_speak, language=language, voice=voice)

                    # 「1を押すか、2を押してください」というプロンプトを準備
                    prompt_for_choice_text = lingual_mgr.get_message(language, "prompt_for_operator_dtmf")
                    
                    # 部屋番号と電話番号を取得
                    phone_last4 = event.get('phone_last4')
                    room_param = f"&room_number={room_number}" if room_number else ""
                    phone_param = f"&phone_last4={phone_last4}" if phone_last4 else ""
                    
                    # DTMF(キー入力)を待つGather
                    gather = TwilioGather(
                        input='dtmf',
                        num_digits=1, # 「1」か「2」の一桁を期待
                        method='POST',
                        timeout=7, # 少し長めに待つ
                        # actionには、この選択を処理するLambda1のURLを指定し、どの応答かを伝えるクエリを追加
                        action=f"{LAMBDA1_FUNCTION_URL}?language={language}&source=operator_choice_dtmf&previous_openai_response_id={current_openai_response_id}{room_param}{phone_param}"
                    )
                    gather.say(prompt_for_choice_text, language=language, voice=voice)
                    operator_choice_twiml.append(gather)

                    # タイムアウトした場合のメッセージ
                    timeout_msg = lingual_mgr.get_message(language, "timeout_message")
                    operator_choice_twiml.say(timeout_msg, language=language, voice=voice)
                    operator_choice_twiml.hangup()

                    # 生成したTwiMLで通話を更新
                    await update_twilio_call_async(twilio_client, call_sid, str(operator_choice_twiml))
                    print("Prompted user for operator transfer choice (DTMF).")
                    return {'status': 'completed', 'action': 'prompted_for_operator_choice_dtmf'}

                else:
                    # --- 元々の、通常の検索結果を返して次の質問を促す処理 ---
                    # 3. 検索結果に基づいて次のTwiMLを生成
                    results_twiml_obj = VoiceResponse()
                    results_twiml_obj.say(assistant_text_to_speak, language=language, voice=voice)
                    
                    # Gatherのaction URLに、次のターンのための情報をクエリパラメータとして含める
                    phone_last4 = event.get('phone_last4')
                    next_gather_action_url = f"{LAMBDA1_FUNCTION_URL}?language={language}"
                    if current_openai_response_id:
                        next_gather_action_url += f"&previous_openai_response_id={current_openai_response_id}"
                    if room_number:
                        next_gather_action_url += f"&room_number={room_number}"
                    if phone_last4:
                        next_gather_action_url += f"&phone_last4={phone_last4}"

                    gather = TwilioGather(
                        input='speech', language=language, method='POST',
                        action=next_gather_action_url, # ★ 更新された action URL
                        timeout=5, speechTimeout='auto', speechModel='deepgram-nova-3'
                    )
                    follow_up_msg = lingual_mgr.get_message(language, "follow_up_question")
                    gather.say(follow_up_msg, language=language, voice=voice)
                    results_twiml_obj.append(gather)

                    timeout_msg = lingual_mgr.get_message(language, "timeout_message")
                    results_twiml_obj.say(timeout_msg, language=language, voice=voice)
                    results_twiml_obj.hangup()

                    try:
                        await update_twilio_call_async(twilio_client, call_sid, str(results_twiml_obj))
                        print("Search results and follow-up prompt sent to user.")
                        return {
                            'status': 'completed',
                            'action': 'provided_search_results_and_gathered',
                            'openai_response_id': current_openai_response_id
                        }
                    except Exception as e_results:
                        print(f"Error sending search results to user: {e_results}")
                        return {'status': 'error', 'message': f"Failed to send search results: {str(e_results)}"}

            except Exception as e_gather:
                print(f"Error during announcement or vector search: {e_gather}")
                # ユーザーにエラーを伝えるTwiMLを生成して返す
                error_response = VoiceResponse()
                error_response.say(lingual_mgr.get_message(language, "processing_error"), language=language, voice=voice)
                error_response.hangup()
                try:
                    await update_twilio_call_async(twilio_client, call_sid, str(error_response))
                except Exception as e_twil_err:
                    print(f"Failed to inform user about gather error: {e_twil_err}")
                return {'status': 'error', 'message': f"Processing error during general inquiry: {str(e_gather)}"}

        elif urgency_result in ["urgent", "operator_request"]:
            # 緊急事態またはオペレーター希望 → 即座にオペレーターに転送
            if urgency_result == "urgent":
                ai_response_segment = lingual_mgr.get_message(language, "urgent_inquiry")
            else:  # operator_request
                ai_response_segment = lingual_mgr.get_message(language, "transferring_to_operator")
            
            response_twiml_obj = VoiceResponse()
            response_twiml_obj.say(ai_response_segment, language=language, voice=voice)
            
            # オペレーターに転送
            operator_phone_number = os.environ.get("OPERATOR_PHONE_NUMBER", "+15005550006")
            response_twiml_obj.dial(operator_phone_number)
            
            try:
                await update_twilio_call_async(twilio_client, call_sid, str(response_twiml_obj))
                print(f"Transferred to operator due to: {urgency_result}")
                return {'status': 'completed', 'action': f'transferred_to_operator_{urgency_result}'}
            except Exception as e:
                print(f"Error in {urgency_result} case: {e}")
                return {'status': 'error', 'message': f"Twilio API error in {urgency_result} case: {str(e)}"}


        elif urgency_result == "unknown":
            ai_response_segment = lingual_mgr.get_message(language, "inquiry_not_understood")
            response_twiml_obj = VoiceResponse() # ... unknown用のTwiML ...
            response_twiml_obj.say(ai_response_segment, language=language, voice=voice)
            phone_last4 = event.get('phone_last4')
            unknown_action_url = f"{LAMBDA1_FUNCTION_URL}?language={language}"
            if room_number:
                unknown_action_url += f"&room_number={room_number}"
            if phone_last4:
                unknown_action_url += f"&phone_last4={phone_last4}"
            gather = TwilioGather( input='speech', language=language, method='POST', action=unknown_action_url, timeout=5, speechTimeout='auto', speechModel='deepgram-nova-3')
            re_prompt_msg = lingual_mgr.get_message(language, "re_prompt_inquiry") # 再度促すメッセージ
            gather.say(re_prompt_msg, language=language, voice=voice)
            response_twiml_obj.append(gather)
            timeout_msg = lingual_mgr.get_message(language, "timeout_message")
            response_twiml_obj.say(timeout_msg, language=language, voice=voice)
            response_twiml_obj.hangup()
            try:
                await update_twilio_call_async(twilio_client, call_sid, str(response_twiml_obj))
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
                await update_twilio_call_async(twilio_client, call_sid, str(error_hangup_response))
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
            await update_twilio_call_async(twilio_client, call_sid, str(error_response))
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
            await update_twilio_call_async(twilio_client, call_sid, str(error_response))
        except Exception as e_twil:
            print(f"Failed to inform user about unexpected error via Twilio: {e_twil}")
        return {'status': 'error', 'message': f"Unexpected error: {str(e)}"}

def lambda_handler(event, context):
    # asyncio.run() を使って非同期関数を呼び出す
    return asyncio.run(lambda_handler_async(event, context))
