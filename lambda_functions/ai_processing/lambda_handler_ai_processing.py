import json
import os
from twilio.rest import Client
from twilio.twiml.voice_response import VoiceResponse, Gather as TwilioGather
import openai
import classification_service

ACCOUNT_SID = os.environ.get('TWILIO_ACCOUNT_SID')
AUTH_TOKEN = os.environ.get('TWILIO_AUTH_TOKEN')
LAMBDA1_FUNCTION_URL = os.environ.get('LAMBDA1_FUNCTION_URL')

# 終話を示すキーワードのリスト（小文字）
END_CONVERSATION_KEYWORDS = [
    "特にないです", "とくにないです", "いいえ", "ありません", "ないです",
    "大丈夫です", "けっこうです", "終わりです", "以上です"
]

twilio_client = None
if ACCOUNT_SID and AUTH_TOKEN:
    twilio_client = Client(ACCOUNT_SID, AUTH_TOKEN)
else:
    print("エラー: TWILIO_ACCOUNT_SID または TWILIO_AUTH_TOKEN が環境変数に設定されていません。")

def lambda_handler(event, context):
    print(f"AIProcessing Lambda Event: {json.dumps(event)}")

    speech_result = event.get('speech_result')
    call_sid = event.get('call_sid')

    if not twilio_client:
        print("エラー: Twilio clientが初期化されていません。処理を中断します。")
        return {'status': 'error', 'message': 'Twilio client not initialized'}

    if not call_sid: # speech_resultは初回以外は必須だが、call_sidは常に必須
        print("エラー: call_sid がイベントに含まれていません。")
        return {'status': 'error', 'message': 'Missing call_sid'}

    # ユーザーが終話を望んでいるかキーワードでチェック
    if speech_result: # speech_resultが存在する場合のみキーワードチェック
        for keyword in END_CONVERSATION_KEYWORDS:
            if keyword in speech_result.lower():
                print(f"User indicated end of conversation with keyword: '{keyword}' in '{speech_result}'")
                response_message_to_user = "承知いたしました。お電話ありがとうございました。"
                hangup_twiml_obj = VoiceResponse()
                hangup_twiml_obj.say(response_message_to_user, language='ja-JP', voice='Polly.Tomoko-Neural')
                hangup_twiml_obj.hangup()
                try:
                    call = twilio_client.calls(call_sid).update(twiml=str(hangup_twiml_obj))
                    print(f"Successfully updated call {call_sid} to hang up. Status: {call.status}")
                    return {'status': 'completed', 'action': 'hangup_due_to_keyword'}
                except Exception as e:
                    print(f"Error updating call to hang up: {e}")
                    return {'status': 'error', 'message': f"Twilio API error during hangup: {str(e)}"}

    # 終話でない場合、または初回処理の場合 (speech_resultがNoneの可能性は低いが念のため)
    if not speech_result: # 通常、Lambda1から呼び出される際にはspeech_resultはあるはず
        print("警告: speech_resultがAIProcessing Lambdaに渡されませんでした。")
        # speech_resultがない場合、ユーザーにエラーを伝えて終了するなどの処理も検討可能
        # ここでは、エラーメッセージを返して終了する例
        error_response = VoiceResponse()
        error_response.say("申し訳ありません、発話内容を認識できませんでした。お手数ですが、もう一度おかけ直しください。", language='ja-JP', voice='Polly.Tomoko-Neural')
        error_response.hangup()
        try:
            twilio_client.calls(call_sid).update(twiml=str(error_response))
        except Exception as e:
            print(f"Error updating call with speech_result error: {e}")
        return {'status': 'error', 'message': 'Missing speech_result for processing'}

    try:
        # 1. AIによる緊急度判定
        print(f"Classifying speech: {speech_result}")
        urgency_result = classification_service.classify_message_urgency(speech_result)
        print(f"Classification result: {urgency_result}")

        # 2. AIの応答メッセージ部分の生成
        ai_response_segment = ""
        if urgency_result == "urgent":
            ai_response_segment = "緊急のお問い合わせと判断しました。これは、デモバージョンですが、本番環境ではここで担当者にお繋ぎします。"
        elif urgency_result == "general":
            ai_response_segment = "一般のお問い合わせと判断しました。これは、デモバージョンですが、本番環境ではここでデータベースの検索を行います。"
        else:
            ai_response_segment = "お問い合わせ内容を解析できませんでした。"

        # 3. フォローアップのTwiML作成
        if not LAMBDA1_FUNCTION_URL:
            print("致命的エラー: LAMBDA1_FUNCTION_URLが環境変数に設定されていません。")
            # フォールバックとして、AIの応答だけを伝えて終了
            fallback_response = VoiceResponse()
            fallback_response.say(ai_response_segment, language='ja-JP', voice='Polly.Tomoko-Neural')
            fallback_response.say("システムエラーのため、これ以上の対応はできません。申し訳ありません。", language='ja-JP', voice='Polly.Tomoko-Neural')
            fallback_response.hangup()
            try:
                twilio_client.calls(call_sid).update(twiml=str(fallback_response))
            except Exception as e_fb:
                print(f"Error updating call with LAMBDA1_FUNCTION_URL error: {e_fb}")
            return {'status': 'error', 'message': 'LAMBDA1_FUNCTION_URL not set'}

        response_twiml_obj = VoiceResponse()
        response_twiml_obj.say(ai_response_segment, language='ja-JP', voice='Polly.Tomoko-Neural')

        gather = TwilioGather(
            input='speech',
            language='ja-JP',
            method='POST',
            action=LAMBDA1_FUNCTION_URL, # Lambda1のURLへ結果をPOST
            timeout=7, # 発話がない場合のタイムアウト（秒）
            speechTimeout='auto' # 発話終了後の無音検知
        )
        gather.say("他にもご用件はございますか？", language='ja-JP', voice='Polly.Tomoko-Neural')
        response_twiml_obj.append(gather)

        # Gatherがタイムアウトした場合や、何も聞き取れなかった場合のフォールバック
        response_twiml_obj.say("タイムアウトしました。またご用件がございましたら、おかけ直しください。お電話ありがとうございました。", language='ja-JP', voice='Polly.Tomoko-Neural')
        response_twiml_obj.hangup()

        new_twiml = str(response_twiml_obj)
        print(f"Generated TwiML for Call Update: {new_twiml}")

        # 4. Twilio Call Update APIの呼び出し
        print(f"Updating call {call_sid} with new TwiML.")
        call = twilio_client.calls(call_sid).update(twiml=new_twiml)
        print(f"Successfully updated call {call_sid}. Status: {call.status}")

        return {'status': 'completed', 'action': 'prompted_for_more_requests'}

    except openai.APIError as e:
        print(f"OpenAI APIエラーが発生しました: {e}")
        # ユーザーにはLambda1のPause後のメッセージが流れるか、通話が切れる想定
        # または、ここでエラーメッセージを<Say>するTwiMLを返すことも可能
        return {'status': 'error', 'message': f"OpenAI API Error: {str(e)}"}
    except Exception as e:
        print(f"AI処理中に予期せぬエラーが発生しました: {e}")
        return {'status': 'error', 'message': f"Unexpected error: {str(e)}"}
