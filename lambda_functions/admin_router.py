"""
Admin REST façade (Cognito-protected).

Required env vars
-----------------
BULK_MAILER_ARN   – λ that builds & mails passes in bulk
TABLE_PASSES      – DynamoDB table with one row per pass
TABLE_REGS        – DynamoDB table with one row per device-pass registration
MAIL_QUEUE_URL    – SQS queue for individual “resend” requests
BUCKET_PASSES     – S3 bucket that stores {serial}.pkpass
PUSH_LAMBDA_ARN   – λ that sends a silent APNs ping (background push)
"""

import base64
import csv
import io
import json
import logging
import os
import time
import zipfile
from decimal import Decimal
from importlib import import_module

import boto3
from boto3.dynamodb.conditions import Key   # << needed for the GSI query

# ── AWS clients / resources ────────────────────────────────────────────────────
ddb       = boto3.resource("dynamodb")
passes    = ddb.Table(os.environ["TABLE_PASSES"])
regs      = ddb.Table(os.environ["TABLE_REGS"])
lambda_c  = boto3.client("lambda")
sqs       = boto3.client("sqs")
s3        = boto3.client("s3")

BULK   = os.environ["BULK_MAILER_ARN"]
BUCKET = os.environ["BUCKET_PASSES"]
QUEUE  = os.environ["MAIL_QUEUE_URL"]
PUSH   = os.environ["PUSH_LAMBDA_ARN"]

# ── logger (shows up in CloudWatch) ────────────────────────────────────────────
logger = logging.getLogger()
logger.setLevel(logging.INFO)

_now_ms = lambda: int(time.time() * 1000)

# cache for the signer imported from main.py
_build_pass = None


# ──────────────────────────────  ENTRY  ────────────────────────────────────────
def lambda_handler(event, _ctx):
    p   = event.get("rawPath", "")
    met = event.get("requestContext", {}).get("http", {}).get("method", "")

    if p == "/admin/metrics":
        return _metrics()

    if p == "/admin/passes" and met == "GET":
        return _list_passes()

    if p.startswith("/admin/resend/"):
        return _single(p.rsplit("/", 1)[-1])

    if p == "/admin/import" and met == "POST":
        return _import_csv(event)

    if p == "/admin/bulkSend":
        lambda_c.invoke(FunctionName=BULK, InvocationType="Event", Payload=b"{}")
        return {"statusCode": 202, "body": "bulk send triggered"}

    if p.startswith("/admin/passes/") and met == "GET":
        return _get_pass(p.rsplit("/", 1)[-1])

    if p.startswith("/admin/passes/") and met == "POST":
        return _handle_pass_update(event, p.rsplit("/", 1)[-1])

    return {"statusCode": 404}


# ──────────────────────────────  HELPERS  ──────────────────────────────────────
def _recreate_pkpass(serial: str, new_json: dict) -> None:
    """
    Download {serial}.pkpass from S3, replace pass.json, re-sign with the
    existing _sign_pass_openssl() helper in main.py, and upload the package
    back to the same key.
    """
    global _build_pass
    if _build_pass is None:
        _build_pass = import_module("main")._sign_pass_openssl  # lazy import

    obj = s3.get_object(Bucket=BUCKET, Key=f"{serial}.pkpass")
    buf = io.BytesIO(obj["Body"].read())

    files = {}
    with zipfile.ZipFile(buf) as zf:
        for name in zf.namelist():
            if name.lower() in ("signature", "manifest.json", "pass.json"):
                continue
            if name.startswith(".DS_Store"):
                continue
            files[name] = zf.read(name)
        files["pass.json"] = json.dumps(
        new_json, separators=(",", ":"), sort_keys=True
    ).encode()
    new_pkpass = _build_pass(files)
    s3.put_object(
        Bucket=BUCKET,
        Key=f"{serial}.pkpass",
        Body=new_pkpass,
        ContentType="application/vnd.apple.pkpass",
    )
    logger.info("Re-signed and uploaded %s.pkpass (%d bytes)", serial, len(new_pkpass))


def _handle_pass_update(event, serial):
    """
    Update DynamoDB → regenerate .pkpass → push APNs to every
    registered device → bump updatedAt in regs.
    """
    raw_body = event.get("body", "")
    if event.get("isBase64Encoded"):
        try:
            raw_body = base64.b64decode(raw_body).decode("utf-8")
        except Exception:
            return {"statusCode": 400, "body": "Invalid base64 body"}

    try:
        body = json.loads(raw_body)
    except (TypeError, json.JSONDecodeError):
        return {"statusCode": 400, "body": "Invalid JSON body"}

    if not isinstance(body, dict):
        return {"statusCode": 400, "body": "Body must be a JSON object"}

    pass_data = body.get("passData")
    if pass_data is None:
        return {"statusCode": 400, "body": "Missing passData"}

    # ① guarantee lastModified strictly increases
    new_ts = _now_ms()
    current = passes.get_item(Key={"serialNumber": serial}).get("Item")
    prev_ts = int(current.get("lastModified", 0)) if current else 0
    if new_ts <= prev_ts:
        new_ts = prev_ts + 1

    passes.update_item(
        Key={"serialNumber": serial},
        UpdateExpression="SET passData = :d, lastModified = :t",
        ExpressionAttributeValues={
            ":d": json.dumps(pass_data, default=_json_decimal_fix),
            ":t": Decimal(str(new_ts)),
        },
    )

    # ② rebuild and upload the pkpass
    try:
        _recreate_pkpass(serial, pass_data)
    except Exception as e:
        logger.exception("Re-sign failed for %s: %s", serial, e)
        return {"statusCode": 500, "body": "Could not re-sign pkpass"}

    # ③ fetch every registration for this serial (GSI on regs required)
    regs_resp = regs.query(
        IndexName="serialNumber-index",          # ← GSI!
        KeyConditionExpression=Key("serialNumber").eq(serial),
        ProjectionExpression="deviceLibraryIdentifier, pushToken",
    )

    # ④ fire a background push for each device (fan-out, non-blocking)
    for item in regs_resp.get("Items", []):
        lambda_c.invoke(
            FunctionName=PUSH,
            InvocationType="Event",
            Payload=json.dumps({"token": item["pushToken"]}).encode(),
        )

    # ⑤ bump updatedAt so /registrations?passesUpdatedSince works
    for item in regs_resp.get("Items", []):
        regs.update_item(
            Key={
                "deviceLibraryIdentifier": item["deviceLibraryIdentifier"],
                "serialNumber": serial,
                },
                UpdateExpression="SET updatedAt = :t",
                ExpressionAttributeValues={":t": Decimal(str(new_ts))},
                )

    logger.info("UPDATED + PUSHED serial=%s lastModified=%s", serial, new_ts)
    return {
        "statusCode": 200,
        "body": json.dumps({"ok": True, "lastModified": new_ts, "pushed": True}),
    }


def _json_decimal_fix(obj):
    """Allow json.dumps() to serialise Decimal values."""
    if isinstance(obj, Decimal):
        return float(obj)
    raise TypeError


# ────────────────────────────  ADMIN ROUTES  ───────────────────────────────────
def _metrics():
    cnt = lambda st: passes.scan(Select='COUNT',
                                 FilterExpression='emailStatus = :s',
                                 ExpressionAttributeValues={':s': st})['Count']
    return {"statusCode": 200,
            "body": json.dumps(dict(pending=cnt('pending'),
                                    queued=cnt('queued'),
                                    mailed=cnt('mailed')))}


def _list_passes():
    items = passes.scan()["Items"]
    return {"statusCode": 200, "body": json.dumps(items, default=str)}


def _single(serial):
    item = passes.get_item(Key={"serialNumber": serial}).get("Item")
    if not item or not item.get("email"):
        return {"statusCode": 404, "body": "Not found"}

    sqs.send_message(
        QueueUrl=QUEUE,
        MessageBody=json.dumps(
            {
                "email": item["email"],
                "serial": serial,
                "bucket": BUCKET,
                "key": f"{serial}.pkpass",
            }
        ),
    )
    return {"statusCode": 202}


def _import_csv(event):
    body = event.get("body", "")
    if event.get("isBase64Encoded"):
        try:
            body = base64.b64decode(body).decode("utf-8")
        except Exception:
            return {"statusCode": 400, "body": "Invalid base64 CSV"}

    rdr = csv.DictReader(io.StringIO(body))
    for row in rdr:
        pass  # createPass logic goes here
    return {"statusCode": 200, "body": "uploaded"}


def _get_pass(serial):
    item = passes.get_item(Key={"serialNumber": serial}).get("Item")
    if not item:
        return {"statusCode": 404, "body": "Not found"}
    return {"statusCode": 200, "body": item["passData"]}