import asyncio

async def update_twilio_call_async(twilio_client, call_sid: str, twiml_string: str):
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