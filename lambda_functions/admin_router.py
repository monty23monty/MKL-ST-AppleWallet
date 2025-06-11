"""
Admin REST façade (Cognito-protected).
Env: BULK_MAILER_ARN, TABLE_PASSES, MAIL_QUEUE_URL, BUCKET_PASSES
"""
import base64
import boto3
import csv
import io
import json
import os
import time

ddb = boto3.resource('dynamodb')
passes = ddb.Table(os.environ['TABLE_PASSES'])
lambda_c = boto3.client('lambda')
sqs = boto3.client('sqs')
events = boto3.client('scheduler')

BULK = os.environ['BULK_MAILER_ARN']
BUCKET = os.environ['BUCKET_PASSES']
QUEUE = os.environ['MAIL_QUEUE_URL']


def lambda_handler(event, _ctx):
    p = event['rawPath']
    met = event['requestContext']['http']['method']

    if p == '/admin/metrics':
        return _metrics()
    if p == '/admin/passes':
        return _list_passes(event)
    if p.startswith('/admin/resend/'):
        return _single(p.split('/')[-1])
    if p == '/admin/import' and met == 'POST':
        return _import_csv(event['body'])
    if p == '/admin/bulkSend':
        lambda_c.invoke(FunctionName=BULK, InvocationType='Event', Payload=b'{}')
        return {"statusCode": 202, "body": "bulk send triggered"}

    if p.startswith('/admin/passes/') and met == 'GET':
        serial = p.split('/')[-1]
        return _get_pass(serial)

    if p.startswith('/admin/passes/') and met == 'POST':
        serial = p.split('/')[-1]
        body = json.loads(event['body'])
        return _update_pass(serial, body.get('passData'))

    return {"statusCode": 404}


def _metrics():
    cnt = lambda st: passes.scan(Select='COUNT',
                                 FilterExpression='emailStatus = :s',
                                 ExpressionAttributeValues={':s': st})['Count']
    return {"statusCode": 200,
            "body": json.dumps(dict(pending=cnt('pending'),
                                    queued=cnt('queued'),
                                    mailed=cnt('mailed')))}


def _list_passes(event):
    out = passes.scan()['Items']
    return {"statusCode": 200, "body": json.dumps(out, default=str)}


def _single(serial):
    sqs.send_message(QueueUrl=QUEUE, MessageBody=json.dumps({
        "email": passes.get_item(Key={'serialNumber': serial})['Item']['email'],
        "serial": serial,
        "bucket": BUCKET,
        "key": f"{serial}.pkpass"}))
    return {"statusCode": 202}


def _import_csv(b64):
    data = base64.b64decode(b64)
    rdr = csv.DictReader(io.StringIO(data.decode()))
    for row in rdr:
        # call your /createPass endpoint internally (skip here)
        pass
    return {"statusCode": 200, "body": "uploaded"}


def _get_pass(serial):
    item = passes.get_item(Key={'serialNumber': serial}).get('Item')
    if not item:
        return {"statusCode": 404, "body": "Not found"}
    # Return just the passData as parsed JSON for the frontend editor
    return {
        "statusCode": 200,
        "body": json.dumps(json.loads(item['passData']))
    }


def _update_pass(serial, new_pass_data):
    now = int(time.time() * 1000)
    passes.update_item(
        Key={'serialNumber': serial},
        UpdateExpression="SET passData = :d, lastModified = :t",
        ExpressionAttributeValues={
            ':d': json.dumps(new_pass_data),
            ':t': now
        }
    )
    return {"statusCode": 200, "body": json.dumps({"ok": True})}
