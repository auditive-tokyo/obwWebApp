"""
Twilio電話認証用のゲスト認証モジュール

部屋番号（roomNumber）と電話番号下4桁（phoneLast4）を使って
DynamoDBからゲスト情報を取得し、認証を行う。
"""
import boto3
import os
from typing import Dict, Optional, List
from boto3.dynamodb.conditions import Key

# 環境変数からテーブル名を取得
GUEST_TABLE_NAME = os.environ.get('GUEST_TABLE_NAME', 'obw-guest')

# DynamoDBクライアント
dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table(GUEST_TABLE_NAME)


def authenticate_guest(room_number: str, phone_last4: str) -> Dict:
    """
    部屋番号と電話番号下4桁でゲストを認証
    
    Args:
        room_number: 部屋番号（例: "201", "802"）
        phone_last4: 電話番号の下4桁（例: "1234"）
    
    Returns:
        {
            'success': bool,
            'guest_info': dict (成功時のみ),
            'error': str (失敗時のみ)
        }
    """
    try:
        # 1. roomNumberで全ゲストを取得
        response = table.query(
            KeyConditionExpression=Key('roomNumber').eq(room_number)
        )
        
        guests: List[Dict] = response.get('Items', [])
        
        if not guests:
            print(f"No guests found for room: {room_number}")
            return {
                'success': False,
                'error': 'NO_GUESTS_IN_ROOM'
            }
        
        print(f"Found {len(guests)} guest(s) in room {room_number}")
        
        # 2. 電話番号下4桁でフィルタ（数字のみを抽出して比較）
        matching_guests = []
        for guest in guests:
            phone = guest.get('phone', '')
            if phone:
                # 電話番号から数字のみを抽出
                phone_digits_only = ''.join(c for c in phone if c.isdigit())
                # 数字のみの電話番号の末尾4桁と比較
                if phone_digits_only.endswith(phone_last4):
                    matching_guests.append(guest)
                    print(f"Match found: guestId={guest.get('guestId')}, phone {phone} (digits: {phone_digits_only}) ends with {phone_last4}")
        
        if not matching_guests:
            print(f"No guest with phone ending in {phone_last4} found in room {room_number}")
            return {
                'success': False,
                'error': 'PHONE_NOT_MATCH'
            }
        
        # 3. マッチしたゲストを返す（複数いる場合は最初の1件）
        guest_info = matching_guests[0]
        
        # 認証成功時に返す情報を選別（必要最小限のみ）
        return {
            'success': True,
            'guest_info': {
                'guestName': guest_info.get('guestName'),
                'roomNumber': guest_info.get('roomNumber'),
                'phone': guest_info.get('phone'),
                'checkInDate': guest_info.get('checkInDate'),
                'checkOutDate': guest_info.get('checkOutDate'),
                'approvalStatus': guest_info.get('approvalStatus')
            }
        }
        
    except Exception as e:
        print(f"Error authenticating guest: {str(e)}")
        return {
            'success': False,
            'error': 'DATABASE_ERROR',
            'details': str(e)
        }
