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
    url = s3.generate_presigned_url(
        ClientMethod='put_object',
        Params={
            'Bucket': bucket,
            'Key': filename,
            'ContentType': 'image/webp'
        },
        ExpiresIn=600,
        HttpMethod='PUT'
    )

    return {
        "statusCode": 200,
        "headers": {"Access-Control-Allow-Origin": "*"},
        "body": json.dumps({"url": url})
    }