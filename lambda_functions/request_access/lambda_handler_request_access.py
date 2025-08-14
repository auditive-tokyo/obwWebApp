import os
import boto3
import uuid
import base64
import hashlib
import time
from datetime import datetime, timezone

dynamodb = boto3.client('dynamodb')
ses = boto3.client('ses')
sns = boto3.client('sns')

TABLE_NAME = os.environ.get("TABLE_NAME")
APP_BASE_URL = "https://app.osakabaywheel.com"
MAIL_FROM = "keigochezstudio@gmail.com"

def generate_token():
    return base64.urlsafe_b64encode(os.urandom(32)).decode('utf-8')

def hash_token(token):
    return hashlib.sha256(token.encode('utf-8')).hexdigest()

def now_iso_ms_z() -> str:
    # 例: 2025-08-14T11:40:29.504Z
    return datetime.now(timezone.utc).isoformat(timespec='milliseconds').replace('+00:00', 'Z')

def lambda_handler(event, context):
    args = event.get('arguments', {}).get('input', {})
    room_number = args.get('roomNumber')
    guest_name = args.get('guestName')
    email = args.get('email')
    phone = args.get('phone')

    if not room_number or not guest_name or not (email or phone):
        return {"success": False, "error": "Missing required fields"}

    guest_id = str(uuid.uuid4())
    token = generate_token()
    token_hash = hash_token(token)

    now = int(time.time())
    pending_verification_ttl = now + 86400  # 24h

    # DynamoDB put item
    dynamodb.put_item(
        TableName=TABLE_NAME,
        Item={
            "roomNumber": {"S": room_number},
            "guestId": {"S": guest_id},
            "guestName": {"S": guest_name},
            "sessionTokenHash": {"S": token_hash},
            "approvalStatus": {"S": "pendingVerification"},
            "pendingVerificationTtl": {"N": str(pending_verification_ttl)},
            "createdAt": {"S": now_iso_ms_z()},
            "updatedAt": {"S": now_iso_ms_z()},
            "contactChannel": {"S": "email" if email else "sms"}
        }
    )

    link = f"{APP_BASE_URL}/room/{room_number}?guestId={guest_id}&token={token}"

    # Send Magic Link
    if email:
        ses.send_email(
            Source=MAIL_FROM,
            Destination={"ToAddresses": [email]},
            Message={
                "Subject": {"Data": f"Osaka Bay Wheel Guest Access"},
                "Body": {"Text": {"Data": f"Access your guest page: {link}"}}
            }
        )
    elif phone:
        sns.publish(
            PhoneNumber=phone,
            Message=f"Access your guest page: {link}"
        )

    return {"success": True, "guestId": guest_id}