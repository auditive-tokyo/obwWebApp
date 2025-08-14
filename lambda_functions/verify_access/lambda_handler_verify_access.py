import os
import boto3
import hashlib
import time
from datetime import datetime

dynamodb = boto3.client('dynamodb')

TABLE_NAME = os.environ.get("TABLE_NAME")

def hash_token(token):
    return hashlib.sha256(token.encode('utf-8')).hexdigest()

def lambda_handler(event, context):
    args = event.get('arguments', {})
    room_number = args.get('roomNumber')
    guest_id = args.get('guestId')
    token = args.get('token')

    if not room_number or not guest_id or not token:
        return {"success": False, "guest": None}

    token_hash = hash_token(token)

    # Get item by PK/SK
    resp = dynamodb.get_item(
        TableName=TABLE_NAME,
        Key={
            "roomNumber": {"S": room_number},
            "guestId": {"S": guest_id}
        }
    )
    item = resp.get('Item')
    if not item:
        return {"success": False, "guest": None}

    # Check token hash and expiry
    if item.get("sessionTokenHash", {}).get("S") != token_hash:
        return {"success": False, "guest": None}
    expires = int(item.get("sessionTokenExpiresAt", {}).get("N", "0"))
    now = int(time.time())
    if now > expires:
        return {"success": False, "guest": None}

    # 状態遷移: pendingVerification → waitingForPassportImage
    if item.get("approvalStatus", {}).get("S") == "pendingVerification":
        dynamodb.update_item(
            TableName=TABLE_NAME,
            Key={
                "roomNumber": {"S": room_number},
                "guestId": {"S": guest_id}
            },
            UpdateExpression="SET approvalStatus = :status, updatedAt = :now REMOVE pendingVerificationTtl",
            ExpressionAttributeValues={
                ":status": {"S": "waitingForPassportImage"},
                ":now": {"S": datetime.utcnow().isoformat()}
            }
        )
        item["approvalStatus"] = {"S": "waitingForPassportImage"}

    # 返却項目を限定（機微情報は返さない。tokenは返さない）
    def unwrap(attr):
        if not isinstance(attr, dict): return None
        return attr.get("S") or attr.get("N") or attr.get("BOOL")
    allowed = ("roomNumber","guestId","guestName","approvalStatus","createdAt","updatedAt","contactChannel")
    guest = {k: unwrap(item[k]) for k in allowed if k in item}
    return {"success": True, "guest": guest}