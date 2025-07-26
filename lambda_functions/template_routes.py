# template_routes.py
import os
import json
import base64
import urllib.parse
import boto3

BUCKET        = os.environ['BUCKET_TEMPLATES']
PREFIX        = os.environ.get('TEMPLATE_PREFIX', 'template/')
s3            = boto3.client('s3')

def lambda_handler(event, context):
    method      = event['httpMethod']
    name_enc    = (event.get('pathParameters') or {}).get('name')
    name        = urllib.parse.unquote(name_enc) if name_enc else None

    if method == 'GET' and not name:
        return list_files()
    if method == 'GET' and name:
        return get_file(name)
    if method == 'PUT' and name:
        return upload_file(name, event)
    if method == 'DELETE' and name:
        return delete_file(name)

    return {
        'statusCode': 405,
        'body': json.dumps({'message': 'Method Not Allowed'})
    }

def list_files():
    resp = s3.list_objects_v2(Bucket=BUCKET, Prefix=PREFIX)
    files = []
    for obj in resp.get('Contents', []):
        key = obj['Key']
        if not key.endswith('/'):
            files.append(key[len(PREFIX):])
    return {
        'statusCode': 200,
        'headers': {'Content-Type': 'application/json'},
        'body': json.dumps(files)
    }

def get_file(name):
    key = PREFIX + name
    obj = s3.get_object(Bucket=BUCKET, Key=key)
    data = obj['Body'].read()
    is_json = name.lower().endswith('.json')

    return {
        'statusCode': 200,
        'headers': {
            'Content-Type': 'application/json' if is_json else 'application/octet-stream',
            **({'Content-Encoding': 'base64'} if not is_json else {})
        },
        'isBase64Encoded': not is_json,
        'body': data.decode() if is_json else base64.b64encode(data).decode()
    }

def upload_file(name, event):
    key = PREFIX + name
    is_json = name.lower().endswith('.json')
    body = event['body']
    if event.get('isBase64Encoded') and not is_json:
        data = base64.b64decode(body)
    else:
        # JSON/text; body is raw string
        data = body.encode()
    content_type = 'application/json' if is_json else 'application/octet-stream'

    s3.put_object(Bucket=BUCKET, Key=key, Body=data, ContentType=content_type)
    return {'statusCode': 204}

def delete_file(name):
    key = PREFIX + name
    s3.delete_object(Bucket=BUCKET, Key=key)
    return {'statusCode': 204}
