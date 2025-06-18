import base64
import json
import logging
import os
import re
import time
from decimal import Decimal

import boto3
from boto3.dynamodb.conditions import Attr, Key

# ─── setup ─────────────────────────────────────────────────────────────────────
logger = logging.getLogger()
logger.setLevel(logging.INFO)

s3 = boto3.client('s3')
dynamo = boto3.resource('dynamodb')
passes = dynamo.Table(os.environ['TABLE_PASSES'])
regs = dynamo.Table(os.environ['TABLE_REG'])
BUCKET = os.environ['BUCKET_PASSES']

# header of form:  Authorization: ApplePass <serial>:<token>
AUTH_RE = re.compile(r'^ApplePass\s+(?P<token>.+)$')


def _auth(event):
    h = event['headers'].get('authorization') or event['headers'].get('Authorization') or ''
    m = AUTH_RE.match(h)
    return m.group('token') if m else None


def _check_token(serial, token, pass_type):
    resp = passes.get_item(Key={'serialNumber': serial})
    item = resp.get('Item')
    return (
            item and
            item.get('passTypeIdentifier') == pass_type and
            item.get('auth') == token
    )

# ─── registration (POST) ───────────────────────────────────────────────────────
def _maybe_register(event, raw):
    if event["requestContext"]["http"]["method"] != "POST":
        return None

    parts = raw.split("?", 1)[0].split("/")
    if len(parts) != 7 or parts[2] != "devices" or parts[4] != "registrations":
        return None

    device_id = parts[3]
    pass_type = parts[5]
    serial    = parts[6]

    token = _auth(event)
    if not _check_token(serial, token, pass_type):
        return {'statusCode': 401}

    body = json.loads(event.get('body') or '{}')
    push_token = body.get("pushToken")
    if not push_token:
        return {'statusCode': 400,
                'body': json.dumps({'message': 'Missing pushToken'})}

    now = int(time.time() * 1000)
    regs.put_item(Item={
        'deviceLibraryIdentifier': device_id,   # ← partition key
        'serialNumber':            serial,      # ← sort key
        'passTypeIdentifier':      pass_type,
        'pushToken':               push_token,
        'updatedAt':               now
    })

    passes.update_item(
            Key={'serialNumber': serial},
            UpdateExpression="""
                SET emailStatus = :s,
                    installedAt = if_not_exists(installedAt, :t),
                    lastModified = :t
            """,
            ExpressionAttributeValues={
                ':s': 'installed',
                ':t': now
            }
        )

    logger.info("REGISTERED device=%s passType=%s serial=%s", device_id, pass_type, serial)
    return {'statusCode': 201}


# ─── list registrations (GET) ──────────────────────────────────────────────────
def _maybe_list_regs(event, raw: str):
    if event["requestContext"]["http"]["method"] != "GET":
        return None

    # /v1/devices/{deviceLID}/registrations/{passTypeIdentifier}
    m = re.fullmatch(
        r"/v1/devices/([^/]+)/registrations/([^/]+)", raw.split("?", 1)[0]
    )
    if not m:
        return None

    device_id, pass_type = m.groups()

    qs = event.get("queryStringParameters") or {}
    since_ms = int(qs.get("passesUpdatedSince", "0") or "0")

    # The table HASH key is deviceLibraryIdentifier.
    # We *can* query the base table, but using the GSI `deviceIdx`
    # saves RCUs if the table ever grows large.
    resp = regs.query(
        IndexName="deviceIdx",  # deviceLibraryIdentifier HASH, serialNumber RANGE
        KeyConditionExpression=Key("deviceLibraryIdentifier").eq(device_id),
        FilterExpression=(
            Attr("passTypeIdentifier").eq(pass_type) &
            Attr("updatedAt").gte(Decimal(str(since_ms)))
        ),
        ProjectionExpression="serialNumber, updatedAt",
    )

    items = resp.get("Items", [])
    if not items:
        return {"statusCode": 204}

    serials   = [i["serialNumber"] for i in items]
    last_upd  = max(int(i.get("updatedAt", 0)) for i in items)
    return {
        "statusCode": 200,
        "body": json.dumps({
            "serialNumbers": serials,
            "lastUpdated":   str(last_upd)
        }),
    }

def _maybe_unregister(event, raw):
    if event["requestContext"]["http"]["method"] != "DELETE":
        return None

    parts = raw.split("?", 1)[0].split("/")
    if len(parts) != 7 or parts[2] != "devices" or parts[4] != "registrations":
        return None

    device_id = parts[3]
    pass_type = parts[5]
    serial    = parts[6]

    token = _auth(event)
    if not _check_token(serial, token, pass_type):
        return {"statusCode": 401}

    # The table’s key-schema is (deviceLibraryIdentifier, serialNumber)
    regs.delete_item(Key={
        "deviceLibraryIdentifier": device_id,
        "serialNumber":            serial
    })

    logger.info("UNREGISTERED device=%s passType=%s serial=%s",
                device_id, pass_type, serial)
    return {"statusCode": 200}


def lambda_handler(event, _ctx):
    logger.info("REQUEST: method=%s rawPath=%s routeKey=%s pathParams=%s",
                event['requestContext']['http']['method'],
                event.get('rawPath'),
                event.get('requestContext')['http'].get('routeKey'),
                event.get('pathParameters'))
    method = event['requestContext']['http']['method']
    raw = event['rawPath']
    qp = event.get('queryStringParameters') or {}
    pp = event.get('pathParameters') or {}
    resp = _maybe_register(event, raw)
    if resp:
        return resp
    resp = _maybe_list_regs(event, raw)      # ← new line
    if resp:
        return resp
    resp = _maybe_unregister(event, raw)
    if resp:
        return resp

    parts = raw.split("/")
    device_id = parts[3] if len(parts) > 3 else None
    pass_type = parts[5] if len(parts) > 5 else None
    serial_param = parts[6] if len(parts) > 6 else None
    logger.info("ROUTE: device_id=%s pass_type=%s serial=%s", device_id, pass_type, serial_param)

    # extract common path parameters
    pass_type = pp.get('passTypeIdentifier')
    serial_param = pp.get('serialNumber')
    device_id = pp.get('deviceLibraryIdentifier')
    serial = pp.get('serialNumber')

    # 1. GET /v1/passes/{passTypeIdentifier}/{serialNumber}
    if method == 'GET' and pass_type and serial and raw.startswith(f"/v1/passes/{pass_type}/"):
        token = _auth(event)
        if not token or not _check_token(serial, token, pass_type):
            return {'statusCode': 401}

        # 1) load pass metadata (including lastModified)
        resp = passes.get_item(Key={'serialNumber': serial})
        item = resp.get('Item')
        if not item:
            return {'statusCode': 404}

        last_mod = int(item.get('lastModified', 0))

        # 2) parse the If-Modified-Since header (Wallet sends it as a millisecond‐tag)
        headers = event.get('headers') or {}
        ims_raw = headers.get('if-modified-since') or headers.get('If-Modified-Since')
        if ims_raw:
            try:
                ims = int(ims_raw)
            except ValueError:
                ims = None

            # 3) if nothing has changed, send 304
            if ims is not None and last_mod <= ims:
                logger.debug("Nothing to do, 304")
                return {
                    'statusCode': 304,
                    # no body, no PKPASS content
                }

        # 4) otherwise, fetch and return the full .pkpass with updated Last-Modified
        obj = s3.get_object(Bucket=BUCKET, Key=f"{serial}.pkpass")
        raw_bytes = obj['Body'].read()
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/vnd.apple.pkpass',
                'Last-Modified': str(last_mod)
            },
            'isBase64Encoded': True,
            'body': base64.b64encode(raw_bytes).decode('ascii')
        }

    # 2. GET /v1/passes/{passTypeIdentifier}?passesUpdatedSince=…
    if method == 'GET' and pass_type and raw == f"/v1/passes/{pass_type}":
        if 'passesUpdatedSince' not in qp:
            return {'statusCode': 400, 'body': json.dumps({'message': 'Missing passesUpdatedSince'})}
        since = int(qp['passesUpdatedSince'])
        # scan for all passes of this type modified since…
        scan = passes.scan(
            FilterExpression=(
                    Attr('passTypeIdentifier').eq(pass_type) &
                    Attr('lastModified').gt(since)
            ),
            ProjectionExpression='serialNumber,lastModified'
        )
        items = scan.get('Items', [])
        if not items:
            return {'statusCode': 204}
        serials = [i['serialNumber'] for i in items]
        newtag = max(i['lastModified'] for i in items)
        return {
            'statusCode': 200,
            'body': json.dumps({
                'lastUpdated': newtag,
                'serialNumbers': serials
            })
        }

 #3. POST /v1/devices/{deviceLID}/registrations/{passTypeIdentifier}/{serialNumber}
    if (method == 'POST'
            and device_id
            and pass_type
            and serial_param
            and raw.startswith(f"/v1/devices/{device_id}/registrations/{pass_type}/{serial_param}")
    ):
        token = _auth(event)
        if not _check_token(serial_param, token, pass_type):
            return {'statusCode': 401}
        body = json.loads(event.get('body') or '{}')
        if 'pushToken' not in body:
            return {'statusCode': 400,
                    'body': json.dumps({'message': 'Missing pushToken'})}
        # persist the device↔pass registration
        regs.put_item(Item={
            'deviceLibraryIdentifier': device_id,
            'passTypeIdentifier':   pass_type,
            'serialNumber':         serial_param,
            'pushToken':            body['pushToken']
        })
        return {'statusCode': 201}

    # 4. GET /v1/devices/{deviceLID}/registrations/{passTypeIdentifier}
    if method == 'GET' and device_id and pass_type and raw.startswith(
            f"/v1/devices/{device_id}/registrations/{pass_type}"):
        serial, token = _auth(event)
        if not _check_token(serial, token, pass_type):
            return {'statusCode': 401}
        # list all serials for this device + passType
        scan = regs.scan(
            FilterExpression=(
                    Attr('deviceLibraryIdentifier').eq(device_id) &
                    Attr('passTypeIdentifier').eq(pass_type)
            ),
            ProjectionExpression='serialNumber'
        )
        serials = [i['serialNumber'] for i in scan.get('Items', [])]
        return {
            'statusCode': 200,
            'body': json.dumps({'serialNumbers': serials})
        }

    # 5. DELETE /v1/devices/{deviceLID}/registrations/{passTypeIdentifier}/{serialNumber}
    if method == 'DELETE' and device_id and pass_type and serial_param \
            and raw.startswith(f"/v1/devices/{device_id}/registrations/{pass_type}/"):
        serial, token = _auth(event)
        if not _check_token(serial, token, pass_type):
            return {'statusCode': 401}
        regs.delete_item(Key={
            'deviceLibraryIdentifier': device_id,
            'passTypeIdentifier': pass_type,
            'serialNumber': serial_param
        })
        return {'statusCode': 200}

    # 6. POST /v1/log
    if method == 'POST' and raw.endswith('/v1/log'):
        logger.info("PassKit client log: %s", event.get('body'))
        return {'statusCode': 200}

    # anything else…
    logger.warning("FELL THROUGH to 404 for rawPath=%s", raw)
    return {'statusCode': 404}
