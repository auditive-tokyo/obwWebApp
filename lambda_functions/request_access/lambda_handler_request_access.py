import os
import boto3
import uuid
import base64
import hashlib
import time
import secrets
from datetime import datetime, timezone
import json
from urllib import request, error

dynamodb = boto3.client('dynamodb')
sns = boto3.client('sns')

TABLE_NAME = os.environ.get("TABLE_NAME")
APP_BASE_URL = "https://app.osakabaywheel.com"
MAIL_FROM = "osakabaywheel4224@gmail.com"
SENDGRID_API_KEY = os.environ.get("SENDGRID_API_KEY")

def generate_token():
    return base64.urlsafe_b64encode(os.urandom(32)).decode('utf-8')

def hash_token(token):
    return hashlib.sha256(token.encode('utf-8')).hexdigest()

def now_iso_ms_z() -> str:
    # 例: 2025-08-14T11:40:29.504Z
    return datetime.now(timezone.utc).isoformat(timespec='milliseconds').replace('+00:00', 'Z')

def generate_booking_id(length=11) -> str:
    alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    return ''.join(secrets.choice(alphabet) for _ in range(length))

def send_via_sendgrid(to_email: str, subject: str, text_body: str):
    if not SENDGRID_API_KEY:
        raise RuntimeError("Missing SENDGRID_API_KEY env")
    payload = {
        "personalizations": [{
            "to": [{"email": to_email}],
            "subject": subject
        }],
        "from": {"email": MAIL_FROM},
        "content": [
            {"type": "text/plain", "value": text_body}
        ]
    }
    data = json.dumps(payload).encode("utf-8")
    req = request.Request(
        "https://api.sendgrid.com/v3/mail/send",
        method="POST",
        data=data,
        headers={
            "Authorization": f"Bearer {SENDGRID_API_KEY}",
            "Content-Type": "application/json"
        }
    )
    try:
        with request.urlopen(req, timeout=10) as resp:
            if resp.status not in (200, 202):
                raise RuntimeError(f"SendGrid unexpected status {resp.status}")
    except error.HTTPError as e:
        body = e.read().decode("utf-8", errors="ignore")
        raise RuntimeError(f"SendGrid HTTPError {e.code}: {body}") from e
    except error.URLError as e:
        raise RuntimeError(f"SendGrid URLError: {e}") from e

def lambda_handler(event, context):
    args = event.get('arguments', {}).get('input', {})
    room_number = args.get('roomNumber')
    guest_name = args.get('guestName')
    email = args.get('email')
    phone = args.get('phone')
    contact_channel = args.get('contactChannel')  # "email" or "sms"

    if not room_number or not guest_name or not email or not phone:
        return {"success": False, "error": "Missing required fields"}

    if contact_channel == "email" and not email:
        return {"success": False, "error": "Email required for contactChannel=email"}
    if contact_channel == "sms" and not phone:
        return {"success": False, "error": "Phone required for contactChannel=sms"}

    guest_id = str(uuid.uuid4())
    token = generate_token()
    token_hash = hash_token(token)

    now = int(time.time())
    pending_verification_ttl = now + 86400  # 24h
    booking_id = generate_booking_id()

    # DynamoDB put item
    dynamodb.put_item(
        TableName=TABLE_NAME,
        Item={
            "roomNumber": {"S": room_number},
            "guestId": {"S": guest_id},
            "guestName": {"S": guest_name},
            "email": {"S": email},
            "phone": {"S": phone},
            "sessionTokenHash": {"S": token_hash},
            "approvalStatus": {"S": "pendingVerification"},
            "pendingVerificationTtl": {"N": str(pending_verification_ttl)},
            "createdAt": {"S": now_iso_ms_z()},
            "contactChannel": {"S": contact_channel},
            "bookingId": {"S": booking_id}
        }
    )

    link = f"{APP_BASE_URL}/room/{room_number}?guestId={guest_id}&token={token}"

    # Send Magic Link
    if contact_channel == "email":
        try:
            send_via_sendgrid(
                to_email=email,
                subject="Osaka Bay Wheel Guest Access",
                text_body=f"Access your guest page:\n{link}\n\nThis link is valid for 24 hours."
            )
        except Exception as e:
            return {"success": False, "error": f"Email send failed: {e}"}
    elif contact_channel == "sms":
        sns.publish(
            PhoneNumber=phone,
            Message=f"Access your guest page: {link}"
        )

    return {"success": True, "guestId": guest_id}