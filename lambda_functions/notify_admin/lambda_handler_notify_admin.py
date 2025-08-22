import os
import json
import boto3
import logging
from datetime import datetime, timezone
from urllib.parse import quote

sns = boto3.client("sns")

logger = logging.getLogger()
logger.setLevel(logging.INFO)

TOPIC_ARN = os.environ.get("ADMIN_TOPIC_ARN", "")
ADMIN_BASE_URL = os.environ.get("ADMIN_BASE_URL", "")  # 例: https://admin.example.com/guests

def _s(attr, key="S"):
    return (attr or {}).get(key)

def handler(event, context):
    # event は DynamoDB Streams のレコード配列
    # フィルタで NewImage.approvalStatus = pending のみ受けるが、念のためコード側でも遷移判定
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

            if new_status != "pending" or (event_name == "MODIFY" and old_status == "pending"):
                # pending 以外、または MODIFY で既に pending のままならスキップ
                logger.info(f"Skipping record. new_status: {new_status}, old_status: {old_status}, eventName: {event_name}")
                continue

            room_number = _s(new_img.get("roomNumber"))
            guest_id = _s(new_img.get("guestId"))
            guest_name = _s(new_img.get("guestName"))
            email = _s(new_img.get("email"))
            phone = _s(new_img.get("phone"))

            check_in = _s(new_img.get("checkInDate"))
            check_out = _s(new_img.get("checkOutDate"))
            updated_at = _s(new_img.get("updatedAt")) or datetime.now(timezone.utc).isoformat()

            if ADMIN_BASE_URL:
                base = ADMIN_BASE_URL.rstrip('/')
                admin_url = f"{base}/rooms/{quote(room_number or '', safe='')}/guests/{quote(guest_id or '', safe='')}"
            else:
                admin_url = "(set ADMIN_BASE_URL to include link)"

            subject = f"[GuestCheckin] Approval requested: room {room_number}, guest {guest_name or guest_id}"
            message = {
                "event": "guest_approval_requested",
                "roomNumber": room_number,
                "guestId": guest_id,
                "guestName": guest_name,
                "email": email,
                "phone": phone,
                "checkInDate": check_in,
                "checkOutDate": check_out,
                "approvalStatus": new_status,
                "updatedAt": updated_at,
                "adminUrl": admin_url,
            }

            if not TOPIC_ARN:
                logger.error("ADMIN_TOPIC_ARN is not set. Skipping publish.", extra={"message_body": message})
                continue

            response = sns.publish(
                TopicArn=TOPIC_ARN,
                Subject=subject,
                Message=json.dumps(message, ensure_ascii=False, indent=2),
                MessageAttributes={
                    "roomNumber": {"DataType": "String", "StringValue": room_number or ""},
                    "guestId": {"DataType": "String", "StringValue": guest_id or ""},
                    "eventType": {"DataType": "String", "StringValue": "guest_approval_requested"},
                },
            )
            logger.info(f"Successfully published message for guest {guest_id} to SNS. MessageId: {response.get('MessageId')}")
            published += 1

        except Exception as e:
            logger.error(f"Error processing record: {rec}", exc_info=True)
            # Continue to the next record

    return {"published": published}