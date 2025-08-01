import json
import boto3
import os

def lambda_handler(event, context):
    # POST bodyからファイル名を取得
    body = json.loads(event.get('body', '{}'))
    filename = body.get('filename')
    if not filename:
        return {
            "statusCode": 400,
            "body": json.dumps({"error": "filename is required"})
        }

    bucket = os.environ.get("UPLOAD_BUCKET")
    if not bucket:
        return {
            "statusCode": 500,
            "body": json.dumps({"error": "UPLOAD_BUCKET env missing"})
        }

    s3 = boto3.client('s3')
    # presigned URLを生成（有効期限: 10分）
    put_url = s3.generate_presigned_url(
        ClientMethod='put_object',
        Params={
            'Bucket': bucket,
            'Key': filename,
            'ContentType': 'image/webp'
        },
        ExpiresIn=600,
        HttpMethod='PUT'
    )
    get_url = s3.generate_presigned_url(
        ClientMethod='get_object',
        Params={
            'Bucket': bucket,
            'Key': filename
        },
        ExpiresIn=600,
        HttpMethod='GET'
    )

    return {
        "statusCode": 200,
        "body": json.dumps({"put_url": put_url, "get_url": get_url})
    }