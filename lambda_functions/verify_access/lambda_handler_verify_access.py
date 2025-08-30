import os, boto3, hashlib, time
from datetime import datetime, timezone, timedelta

dynamodb = boto3.client('dynamodb')
TABLE_NAME = os.environ.get("TABLE_NAME")
PROVISIONAL_SESSION_HOURS = 48  # 仮セッション時間
PROPERTY_TZ_OFFSET_HOURS = 9  # JST=+9

def hash_token(token):
    return hashlib.sha256(token.encode('utf-8')).hexdigest()

def checkout_noon_epoch(date_str: str, tz_offset_hours: int = 9, noon_hour: int = 12) -> int:
    y, m, d = map(int, date_str.split('-'))
    tz = timezone(timedelta(hours=tz_offset_hours))
    dt = datetime(y, m, d, noon_hour, 0, 0, tzinfo=tz)
    return int(dt.timestamp())

def now_iso_ms_z() -> str:
    return datetime.now(timezone.utc).isoformat(timespec='milliseconds').replace('+00:00', 'Z')

def lambda_handler(event, context):
    args = event.get('arguments', {})
    room_number = args.get('roomNumber')
    guest_id = args.get('guestId')
    token = args.get('token')

    if not room_number or not guest_id or not token:
        return {"success": False, "guest": None}

    token_hash = hash_token(token)

    # 取得
    resp = dynamodb.get_item(
        TableName=TABLE_NAME,
        Key={"roomNumber": {"S": room_number}, "guestId": {"S": guest_id}}
    )
    item = resp.get('Item')
    if not item:
        return {"success": False, "guest": None}

    # DBから bookingId を取得
    booking_id = item.get("bookingId", {}).get("S") if item.get("bookingId") else None

    expected = item.get("sessionTokenHash", {}).get("S")
    if not expected or expected != token_hash:
        return {"success": False, "guest": None}

    status = item.get("approvalStatus", {}).get("S", "")
    now = int(time.time())

    # 新しい有効期限を決定
    check_out = item.get("checkOutDate", {}).get("S")  # 例: "YYYY-MM-DD"
    if check_out:
        new_expires = checkout_noon_epoch(check_out, PROPERTY_TZ_OFFSET_HOURS)
    else:
        new_expires = now + PROVISIONAL_SESSION_HOURS * 3600  # 仮セッション

    # 状態更新
    if status == "pendingVerification":
        # 初回認証: TTL 削除 + ステータス遷移 + 期限セット
        dynamodb.update_item(
            TableName=TABLE_NAME,
            Key={'roomNumber': {'S': room_number}, 'guestId': {'S': guest_id}},
            UpdateExpression="""
              SET approvalStatus = :w,
                  sessionTokenExpiresAt = :exp,
                  updatedAt = :u
              REMOVE pendingVerificationTtl
            """,
            ExpressionAttributeValues={
              ':w': {'S': 'waitingForBasicInfo'},
              ':exp': {'N': str(new_expires)},
              ':u': {'S': now_iso_ms_z()},
            }
        )
        return {"success": True, "guest": {"guestId": guest_id, "bookingId": booking_id}}

    # 既に認証済み（waitingForBasicInfo等）の再アクセス:
    # 期限があるならチェック（安全のため）
    expires_val = int(item.get("sessionTokenExpiresAt", {}).get("N", "0"))
    if expires_val and now > expires_val:
        return {"success": False, "guest": None}

    return {"success": True, "guest": {"guestId": guest_id, "bookingId": booking_id}}