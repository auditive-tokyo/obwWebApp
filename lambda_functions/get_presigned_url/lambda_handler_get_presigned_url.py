import json
import boto3
import os

def lambda_handler(event, context):
    input_data = event.get('arguments', {}).get('input', {})
    filename = input_data.get('filename')
    room_id = input_data.get('roomId', 'unknown')
    timestamp = input_data.get('timestamp', '')
    
    if not filename:
        raise Exception("filename is required")

    bucket = os.environ.get("UPLOAD_BUCKET")
    if not bucket:
        raise Exception("UPLOAD_BUCKET env missing")

    s3 = boto3.client('s3')
    s3_key = f"{room_id}/{timestamp}/{filename}"
    
    # presigned URLを生成
    put_url = s3.generate_presigned_url(
        ClientMethod='put_object',
        Params={
            'Bucket': bucket,
            'Key': s3_key,
            'ContentType': 'image/jpeg'
        },
        ExpiresIn=3600,
        HttpMethod='PUT'
    )
    get_url = s3.generate_presigned_url(
        ClientMethod='get_object',
        Params={
            'Bucket': bucket,
            'Key': s3_key
        },
        ExpiresIn=3600,
        HttpMethod='GET'
    )
    
    # 恒久的なS3 URL（署名なし）
    base_url = f"https://{bucket}.s3.amazonaws.com/{s3_key}"
    
    return {
        "putUrl": put_url,
        "getUrl": get_url,
        "baseUrl": base_url
    }