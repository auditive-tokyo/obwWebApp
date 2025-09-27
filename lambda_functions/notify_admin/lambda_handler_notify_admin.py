import os
import logging
from urllib.parse import urlencode
from urllib.request import Request, urlopen

logger = logging.getLogger()
logger.setLevel(logging.INFO)

ADMIN_BASE_URL = os.environ.get("ADMIN_BASE_URL", "")
TELEGRAM_BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "")
TELEGRAM_CHAT_ID = os.environ.get("TELEGRAM_CHAT_ID", "")  # 例: "-1001234567890"

def _s(attr, key="S"):
    return (attr or {}).get(key)

def send_telegram(text: str) -> None:
    if not TELEGRAM_BOT_TOKEN or not TELEGRAM_CHAT_ID:
        raise RuntimeError("TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID is not set")
    api = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
    body = urlencode({
        "chat_id": TELEGRAM_CHAT_ID,
        "text": text,
        "disable_web_page_preview": "true",
        # "parse_mode": "MarkdownV2",
    }).encode("utf-8")
    req = Request(api, data=body, headers={"Content-Type": "application/x-www-form-urlencoded"})
    with urlopen(req, timeout=10) as resp:
        body = resp.read()
        if resp.status != 200:
            raise RuntimeError(f"Telegram send failed: {resp.status} {body}")

def handler(event, context):
    # DynamoDB Streams レコード配列を処理
    published = 0
    for rec in event.get("Records", []):
        try:
            event_name = rec.get("eventName")
            if event_name not in ("INSERT", "MODIFY"):
                logger.debug(f"Skipping event with eventName: {event_name}")
                continue

            ddb = rec.get("dynamodb", {})
            new_img = ddb.get("NewImage") or {}
            old_img = ddb.get("OldImage") or {}

            new_status = _s(new_img.get("approvalStatus"))
            old_status = _s(old_img.get("approvalStatus"))

            # 新規 or pending へ遷移したときのみ通知
            if new_status != "pending" or (event_name == "MODIFY" and old_status == "pending"):
                logger.info(f"Skipping record. new_status: {new_status}, old_status: {old_status}, eventName: {event_name}")
                continue

            room_number = _s(new_img.get("roomNumber"))
            guest_id = _s(new_img.get("guestId"))
            guest_name = _s(new_img.get("guestName"))
            check_in = _s(new_img.get("checkInDate"))
            check_out = _s(new_img.get("checkOutDate"))

            display_name = guest_name or guest_id or "不明なゲスト"
            lines = [
                f"Room ({room_number}) の {display_name} さんが基本情報の登録と、IDの写真をアップロードしました。",
                "Admin Pageより確認してください:",
                f"滞在日: {check_in or '-'} ~ {check_out or '-'}",
                "",
                f"{ADMIN_BASE_URL}/{room_number}",
            ]
            message_text = "\n".join(lines)

            # Telegram 送信（失敗時は例外で再試行）
            send_telegram(message_text)
            logger.info(f"Sent Telegram message for guest {guest_id}")
            published += 1

        except Exception:
            logger.error(f"Error processing record: {rec}", exc_info=True)
            # バッチサイズ1前提、例外で当該レコードのみ再試行
            raise

    return {"published": published}