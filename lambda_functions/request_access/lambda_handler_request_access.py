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

def build_email_body(lang: str, link: str) -> str:
    if lang == 'ja':
        return (
            "ゲストページへのアクセスリンクです:\n"
            f"{link}\n\n"
            "このリンクは大切に保管してください。同じ部屋に宿泊するご家族・ご友人以外には共有しないでください。\n\n"
            "複数のデバイスやブラウザからアクセスする場合も、このリンクを開くことでセッションを復元できます。\n\n"
            "注意: 基本情報の入力が完了しないまま24時間経過するとこのリンクは無効になります。\n"
            "基本情報送信後は、同じリンクで再アクセスしてセッションを復元できます。\n"
        )
    # default English
    return (
        "Guest page access link:\n"
        f"{link}\n\n"
        "Please keep this link secure. Do NOT share it with anyone except family or companions staying in the same room.\n\n"
        "If you use multiple devices or browsers, opening this link restores your session.\n\n"
        "Note: If you do NOT complete the basic information within 24 hours, this link becomes invalid.\n"
        "After submitting the basic information you can still revisit using the same link to restore your session.\n"
    )

# SMS本文生成（短縮）
def build_sms(lang: str, link: str) -> str:
    if lang == 'ja':
        return (
            f"【Osaka Bay Wheel】ご宿泊ありがとうございます。"
            f"こちらのリンクより安全に本人確認書類をアップロードいただけます: {link}"
        )
    return (
        f"[Osaka Bay Wheel] Thank you for staying with us. "
        f"Please securely upload your ID via this link: {link}"
    )

def lambda_handler(event, context):
    args = event.get('arguments', {}).get('input', {})
    room_number = args.get('roomNumber')
    guest_name = args.get('guestName')
    email = args.get('email')
    phone = args.get('phone')
    contact_channel = args.get('contactChannel')  # "email" or "sms"
    lang = args.get('lang', 'en')

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

    # SMS用とEmail用でURLを分ける
    if contact_channel == "sms":
        link = f"{APP_BASE_URL}/room/{room_number}?guestId={guest_id}&token={token}&source=sms"
        # SMSメッセージを大幅にシンプル化
        sms_body = build_sms(lang, link)
        sns.publish(PhoneNumber=phone, Message=sms_body)
    else:
        link = f"{APP_BASE_URL}/room/{room_number}?guestId={guest_id}&token={token}"
        # Send Magic Link
        if contact_channel == "email":
            try:
                text_body = build_email_body(lang, link)
                subject = "Osaka Bay Wheel ゲストアクセス" if lang == 'ja' else "Osaka Bay Wheel Guest Access"
                send_via_sendgrid(
                    to_email=email,
                    subject=subject,
                    text_body=text_body
                )
            except Exception as e:
                return {"success": False, "error": f"Email send failed: {e}"}

    return {"success": True, "guestId": guest_id}