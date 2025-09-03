import os, boto3, time
from datetime import datetime, timezone, timedelta

dynamodb = boto3.client('dynamodb')
TABLE_NAME = os.environ.get("TABLE_NAME")
PROPERTY_TZ_OFFSET_HOURS = 9  # JST

def now_iso_ms_z() -> str:
    return datetime.now(timezone.utc).isoformat(timespec='milliseconds').replace('+00:00', 'Z')

def checkout_noon_epoch(date_str: str, tz_offset_hours: int = 9, noon_hour: int = 12) -> int:
    y, m, d = map(int, date_str.split('-'))
    tz = timezone(timedelta(hours=tz_offset_hours))
    dt = datetime(y, m, d, noon_hour, 0, 0, tzinfo=tz)
    return int(dt.timestamp())

def lambda_handler(event, context):
    args = event.get('arguments', {}) or {}
    room_number = args.get('roomNumber')
    guest_id = args.get('guestId')
    if not room_number or not guest_id:
        return None

    # 対象取得
    resp = dynamodb.get_item(
        TableName=TABLE_NAME,
        Key={"roomNumber": {"S": room_number}, "guestId": {"S": guest_id}}
    )
    item = resp.get('Item')
    if not item:
        return None

    # checkoutDate があれば正午(JST)に TTL を設定、なければ現状維持 or 即時+48h等にしたい場合は適宜
    check_out = item.get("checkOutDate", {}).get("S")
    if check_out:
        expires = checkout_noon_epoch(check_out, PROPERTY_TZ_OFFSET_HOURS)
    else:
        expires = int(time.time()) + 48 * 3600  # 予備（要件に応じて調整）

    # 更新（承認＋期限セット）
    dynamodb.update_item(
        TableName=TABLE_NAME,
        Key={'roomNumber': {'S': room_number}, 'guestId': {'S': guest_id}},
        UpdateExpression="""
          SET approvalStatus = :approved,
              sessionTokenExpiresAt = :exp,
              updatedAt = :u
        """,
        ExpressionAttributeValues={
          ':approved': {'S': 'approved'},
          ':exp': {'N': str(expires)},
          ':u': {'S': now_iso_ms_z()},
        }
    )

    # 必要最小限を返却
    return {
        "guestId": guest_id,
        "roomNumber": room_number,
        "approvalStatus": "approved"
    }