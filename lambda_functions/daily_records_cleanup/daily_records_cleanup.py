import os
import time
import logging
from typing import Set, Tuple

import boto3
from boto3.dynamodb.conditions import Key

logger = logging.getLogger()
logger.setLevel(logging.INFO)

dynamodb = boto3.resource("dynamodb")
table = dynamodb.Table(os.environ["TABLE_NAME"])

NON_APPROVED_STATUSES = ["waitingForBasicInfo", "rejected", "waitingForPassportImage", "pending"]


def _fetch_expired_non_approved(now_ts: int):
    """非承認ステータスで有効期限切れのレコードを全件取得"""
    items = []
    for status in NON_APPROVED_STATUSES:
        last_key = None
        while True:
            params = {
                "IndexName": "ApprovalStatusExpiresIndex",
                "KeyConditionExpression": Key("approvalStatus").eq(status) & Key("sessionTokenExpiresAt").lte(now_ts),
            }
            if last_key:
                params["ExclusiveStartKey"] = last_key
            resp = table.query(**params)
            items.extend(resp.get("Items", []))
            last_key = resp.get("LastEvaluatedKey")
            if not last_key:
                break
    return items


def _collect_keys_to_delete(expired_items) -> Tuple[Set[Tuple[str, str]], int]:
    """削除対象キーと関連bookingIdの全ゲストを収集"""
    keys: Set[Tuple[str, str]] = set()
    booking_ids: Set[str] = set()

    for item in expired_items:
        room = item.get("roomNumber")
        guest = item.get("guestId")
        if room and guest:
            keys.add((room, guest))
        booking = item.get("bookingId")
        if booking:
            booking_ids.add(str(booking))

    for booking_id in booking_ids:
        last_key = None
        while True:
            params = {
                "IndexName": "BookingIndex",
                "KeyConditionExpression": Key("bookingId").eq(booking_id),
            }
            if last_key:
                params["ExclusiveStartKey"] = last_key
            resp = table.query(**params)
            for related in resp.get("Items", []):
                room = related.get("roomNumber")
                guest = related.get("guestId")
                if room and guest:
                    keys.add((room, guest))
            last_key = resp.get("LastEvaluatedKey")
            if not last_key:
                break

    return keys, len(booking_ids)


def lambda_handler(event, context):
    now_ts = int(time.time())

    expired_items = _fetch_expired_non_approved(now_ts)
    keys_to_delete, booking_count = _collect_keys_to_delete(expired_items)

    if keys_to_delete:
        with table.batch_writer() as batch:
            for room, guest in keys_to_delete:
                batch.delete_item(Key={"roomNumber": room, "guestId": guest})

    logger.info(
        "Cleanup summary",
        extra={
            "expiredNonApproved": len(expired_items),
            "bookingGroupsTouched": booking_count,
            "deletedRecords": len(keys_to_delete),
        },
    )

    return {
        "expiredNonApproved": len(expired_items),
        "bookingGroupsTouched": booking_count,
        "deletedRecords": len(keys_to_delete),
        "timestamp": now_ts,
    }