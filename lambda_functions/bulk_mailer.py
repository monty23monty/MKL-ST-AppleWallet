"""
Scans Passes where emailStatus = pending and queues a PassMail job for each.
Env: TABLE_PASSES, BUCKET_PASSES, MAIL_QUEUE_URL
"""
import boto3
import json
import os

dynamo = boto3.resource('dynamodb')
table = dynamo.Table(os.environ['TABLE_PASSES'])
sqs = boto3.client('sqs')

QUEUE = os.environ['MAIL_QUEUE_URL']
BUCKET = os.environ['BUCKET_PASSES']


def lambda_handler(event, _ctx):
    scan = table.scan(FilterExpression='emailStatus = :p',
                      ExpressionAttributeValues={':p': 'pending'})
    for item in scan['Items']:
        sqs.send_message(QueueUrl=QUEUE,
                         MessageBody=json.dumps({
                             "email": item['email'],
                             "serial": item['serialNumber'],
                             "bucket": BUCKET,
                             "key": f"{item['serialNumber']}.pkpass"
                         }))
        table.update_item(Key={'serialNumber': item['serialNumber']},
                          UpdateExpression='SET emailStatus = :q',
                          ExpressionAttributeValues={':q': 'queued'})
    return {"statusCode": 200, "body": f"Queued {scan['Count']} passes"}
