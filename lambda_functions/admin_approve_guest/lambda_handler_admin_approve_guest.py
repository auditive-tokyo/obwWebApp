import os, boto3, time
from datetime import datetime, timezone, timedelta
from boto3.dynamodb.conditions import Key

# use high-level resource API so items are returned as native Python types (no 'S'/'N' wrappers)
dynamodb = boto3.resource('dynamodb')
TABLE_NAME = os.environ.get("TABLE_NAME")
table = dynamodb.Table(TABLE_NAME)
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

    # 対象取得（resource.Table.get_item は Item をネイティブ型で返す）
    resp = table.get_item(Key={"roomNumber": room_number, "guestId": guest_id})
    item = resp.get('Item')
    if not item:
        return None

    # checkoutDate があれば正午(JST)に TTL を設定。item はネイティブな Python 型（str/int/None）なので直接取得
    check_out = item.get("checkOutDate")
    booking_id = item.get("bookingId")
    if check_out:
        expires = checkout_noon_epoch(check_out, PROPERTY_TZ_OFFSET_HOURS)
    else:
        expires = int(time.time()) + 48 * 3600  # 予備（要件に応じて調整）

    # 更新（承認＋期限セット） - resource.Table.update_item はネイティブ型で渡せる
    table.update_item(
        Key={'roomNumber': room_number, 'guestId': guest_id},
        UpdateExpression="SET approvalStatus = :approved, sessionTokenExpiresAt = :exp, updatedAt = :u",
        ExpressionAttributeValues={
            ':approved': 'approved',
            ':exp': expires,
            ':u': now_iso_ms_z(),
        }
    )

    # bookingId が利用可能なら、その booking に紐づく全員の sessionTokenExpiresAt を更新する
    if booking_id:
        try:
            qres = table.query(
                IndexName='BookingIndex',
                KeyConditionExpression=Key('bookingId').eq(booking_id)
            )
            members = qres.get('Items', [])
            for m in members:
                rn = m.get('roomNumber')
                gid = m.get('guestId')

                # skip rejected members: don't assign session expiry to explicitly rejected guests
                if m.get('approvalStatus') == 'rejected':
                    continue

                # skip if it's the same as the already-updated guest (optional)
                if rn == room_number and gid == guest_id:
                    continue
                try:
                    table.update_item(
                        Key={'roomNumber': rn, 'guestId': gid},
                        UpdateExpression='SET sessionTokenExpiresAt = :exp, updatedAt = :u',
                        ExpressionAttributeValues={':exp': expires, ':u': now_iso_ms_z()}
                    )
                except Exception as e:
                    print(f"Failed to update member {rn}/{gid}: {e}")
        except Exception as e:
            print(f"Failed to query BookingIndex for bookingId={booking_id}: {e}")

    # 必要最小限を返却
    return {
        "guestId": guest_id,
        "roomNumber": room_number,
        "approvalStatus": "approved"
    }