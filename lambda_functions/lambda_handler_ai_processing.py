import json
import os
from twilio.rest import Client
# classification_service.py が同じディレクトリにあることを前提
import classification_service
import openai

# Lambdaの環境変数からTwilioの認証情報を取得
ACCOUNT_SID = os.environ.get('TWILIO_ACCOUNT_SID')
AUTH_TOKEN = os.environ.get('TWILIO_AUTH_TOKEN')

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

    if not speech_result or not call_sid:
        print("エラー: speech_result または call_sid がイベントに含まれていません。")
        return {'status': 'error', 'message': 'Missing speech_result or call_sid'}

    try:
        # 1. AIによる緊急度判定
        print(f"Classifying speech: {speech_result}")
        # classification_service.classify_message_urgency は 'urgent' または 'general' を返す想定
        urgency_result = classification_service.classify_message_urgency(speech_result)
        print(f"Classification result: {urgency_result}")

        # 2. 応答メッセージの生成
        response_message_to_user = ""
        if urgency_result == "urgent":
            response_message_to_user = "緊急のお問い合わせと判断しました。担当者にお繋ぎしますので、少々お待ちください。" # 将来的には転送など
            # 現状はメッセージを伝えて終了
        elif urgency_result == "general":
            response_message_to_user = "一般のお問い合わせと判断しました。これでもバージョンですが、本番環境ではここでデータベースの検索を行います。" # 将来的にはDB保存など
            # 現状はメッセージを伝えて終了
        else:
            # classification_serviceが予期せぬ値を返した場合や、エラーを示唆する値を返した場合
            print(f"予期せぬ緊急度判定結果: {urgency_result}")
            response_message_to_user = "お問い合わせ内容を正しく解析できませんでした。恐れ入りますが、もう一度おかけ直しください。"

        # 3. Twilioに返すTwiMLの作成
        #    <Say>でメッセージを再生し、<Hangup/>で通話を終了する
        new_twiml = f"<Response><Say language='ja-JP' voice='Polly.Tomoko-Neural'>{response_message_to_user}</Say><Hangup/></Response>"
        print(f"Generated TwiML for Call Update: {new_twiml}")

        # 4. Twilio Call Update APIの呼び出し
        print(f"Updating call {call_sid} with new TwiML.")
        call = twilio_client.calls(call_sid).update(twiml=new_twiml)
        print(f"Successfully updated call {call_sid}. Status: {call.status}")

        return {'status': 'completed', 'urgency': urgency_result}

    except openai.APIError as e: # classification_service内で発生する可能性のあるOpenAIのエラー
        print(f"OpenAI APIエラーが発生しました: {e}")
        # この場合、ユーザーにはLambda1のPause後のメッセージが流れるか、通話が切れる
        return {'status': 'error', 'message': f"OpenAI API Error: {str(e)}"}
    except Exception as e:
        print(f"AI処理中に予期せぬエラーが発生しました: {e}")
        # この場合も、ユーザーにはLambda1のPause後のメッセージが流れるか、通話が切れる
        return {'status': 'error', 'message': f"Unexpected error: {str(e)}"}
