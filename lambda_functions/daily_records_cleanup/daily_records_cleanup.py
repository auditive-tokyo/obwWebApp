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

EXPIRED_CHECK_STATUSES = ["waitingForBasicInfo", "waitingForPassportImage", "pending"]


def _fetch_rejected_all():
    """rejectedステータスのレコードを全件取得（期限チェックなし）"""
    items = []
    last_key = None
    while True:
        params = {
            "IndexName": "ApprovalStatusExpiresIndex",
            "KeyConditionExpression": Key("approvalStatus").eq("rejected"),
        }
        if last_key:
            params["ExclusiveStartKey"] = last_key
        resp = table.query(**params)
        items.extend(resp.get("Items", []))
        last_key = resp.get("LastEvaluatedKey")
        if not last_key:
            break
    return items


def _fetch_expired_non_approved(now_ts: int):
    """非承認ステータスで有効期限切れのレコードを全件取得"""
    items = []
    for status in EXPIRED_CHECK_STATUSES:
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


def _collect_rejected_keys(rejected_items) -> Set[Tuple[str, str]]:
    """rejectedレコードのキーを収集（単独削除、bookingId展開なし）"""
    keys: Set[Tuple[str, str]] = set()
    for item in rejected_items:
        room = item.get("roomNumber")
        guest = item.get("guestId")
        if room and guest:
            keys.add((room, guest))
    return keys


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

    # 1. rejected: 即削除（期限チェックなし、単独削除）
    rejected_items = _fetch_rejected_all()
    rejected_keys = _collect_rejected_keys(rejected_items)

    # 2. 他の非承認ステータス: 期限切れのみ削除（bookingIdグループで削除）
    expired_items = _fetch_expired_non_approved(now_ts)
    expired_keys, booking_count = _collect_keys_to_delete(expired_items)

    # 全削除キーを統合
    all_keys_to_delete = rejected_keys | expired_keys

    if all_keys_to_delete:
        with table.batch_writer() as batch:
            for room, guest in all_keys_to_delete:
                batch.delete_item(Key={"roomNumber": room, "guestId": guest})

    logger.info(
        "Cleanup summary",
        extra={
            "rejectedRecords": len(rejected_items),
            "expiredNonApproved": len(expired_items),
            "bookingGroupsTouched": booking_count,
            "deletedRecords": len(all_keys_to_delete),
        },
    )

    return {
        "rejectedRecords": len(rejected_items),
        "expiredNonApproved": len(expired_items),
        "bookingGroupsTouched": booking_count,
        "deletedRecords": len(all_keys_to_delete),
        "timestamp": now_ts,
    }