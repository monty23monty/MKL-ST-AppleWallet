import boto3
import json
import os
import time

s3 = boto3.client('s3')
ses = boto3.client('ses')
ddb = boto3.resource('dynamodb')
passes = ddb.Table(os.environ['TABLE_PASSES'])
FROM_EMAIL = os.environ['FROM_EMAIL']

BUCKET_OUT = os.environ['BUCKET_PASSES']


def lambda_handler(event, _ctx):
    # assume single message per invocation
    msg = json.loads(event['Records'][0]['body'])
    email = msg['email']
    serial = msg['serial']

    # 1️⃣ generate a time-limited download link
    presigned_url = s3.generate_presigned_url(
        'get_object',
        Params={'Bucket': BUCKET_OUT, 'Key': f"{serial}.pkpass"},
        ExpiresIn=3600  # 1 hour
    )

    # 2️⃣ send the link in an HTML email
    ses.send_email(
        Source=FROM_EMAIL,
        Destination={'ToAddresses': [email]},
        Message={
            'Subject': {'Data': 'Your Season Ticket Pass'},
            'Body': {
                'Html': {
                    'Data': f"""
                        <p>Hi there,</p>
                        <p>Your pass is ready! <a href="{presigned_url}">
                        Click here to download and install it.</a></p>
                        <p>This link expires in 1 hour.</p>
                    """
                }
            }
        }
    )

    # 3️⃣ update DynamoDB so frontend sees “queued” (or “sent”)
    passes.update_item(
        Key={'serialNumber': serial},
        UpdateExpression="SET emailStatus = :s, lastModified = :t",
        ExpressionAttributeValues={
            ':s': 'queued',
            ':t': int(time.time() * 1000)
        }
    )

    return {
        "statusCode": 200,
        "headers": {"Access-Control-Allow-Origin": "*"},
        "body": json.dumps({'message': 'email sent'})
    }
