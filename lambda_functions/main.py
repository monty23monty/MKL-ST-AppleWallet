import base64
import hashlib
import io
import json
import os
import subprocess
import tempfile
import time
import uuid
import zipfile

import boto3

# Make sure your OpenSSL layer is attached and on PATH
os.environ['PATH'] = '/opt/bin:' + os.environ.get('PATH', '')
OPENSSL = '/opt/bin/openssl'

s3 = boto3.client('s3')
dynamo = boto3.resource('dynamodb')
passes = dynamo.Table(os.environ['TABLE_PASSES'])
sqs = boto3.client('sqs')
ssm = boto3.client('ssm')

BUCKET_TPL = os.environ['BUCKET_TEMPLATES']
BUCKET_OUT = os.environ['BUCKET_PASSES']
MAIL_QUEUE = os.environ['MAIL_QUEUE_URL']
CERT_PARAM = '/passkit/cert'
CERT_PASS_PARAM = '/passkit/certPass'


def _run_openssl(args, input_bytes=None):
    """Run openssl with args list, capture stderr, raise on error with diagnostics."""
    proc = subprocess.run(
        [OPENSSL] + args,
        input=input_bytes,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE
    )
    if proc.returncode != 0:
        raise RuntimeError(
            f"openssl {' '.join(args)} failed (exit {proc.returncode}):\n"
            f"{proc.stderr.decode().strip()}"
        )
    return proc.stdout


def _sign_pass_openssl(files: dict) -> bytes:
    # 1) Build manifest.json
    manifest = {
        name: hashlib.sha1(data).hexdigest()
        for name, data in files.items()
    }
    manifest_bytes = json.dumps(manifest, separators=(',', ':'), sort_keys=True).encode()
    files['manifest.json'] = manifest_bytes

    # 2) Get your PKCS#12 bundle from SSM
    p12_b64 = ssm.get_parameter(Name=CERT_PARAM, WithDecryption=True)['Parameter']['Value']
    p12_pass = ssm.get_parameter(Name=CERT_PASS_PARAM, WithDecryption=True)['Parameter']['Value']
    p12_bytes = base64.b64decode(p12_b64)

    with tempfile.TemporaryDirectory() as td:
        p12_path = os.path.join(td, 'bundle.p12')
        cert_path = os.path.join(td, 'cert.pem')
        key_path = os.path.join(td, 'key.pem')
        sig_path = os.path.join(td, 'signature')

        # write the .p12 file
        with open(p12_path, 'wb') as f:
            f.write(p12_bytes)

        # 3a) Extract only the client cert (no keys) with -clcerts
        _run_openssl([
            'pkcs12',
            '-in', p12_path,
            '-clcerts',  # only the client certificate
            '-nokeys',
            '-passin', f'pass:{p12_pass}',
            '-out', cert_path
        ])

        # 3b) Extract only the private key
        _run_openssl([
            'pkcs12',
            '-in', p12_path,
            '-nocerts',
            '-nodes',
            '-passin', f'pass:{p12_pass}',
            '-out', key_path
        ])

        # 4) Sign manifest.json → DER signature
        #    Make sure AppleWWDRCA.pem is in your code root
        _run_openssl([
            'smime',
            '-binary',
            '-sign',
            '-in', '/dev/stdin',
            '-signer', cert_path,
            '-inkey', key_path,
            '-certfile', os.path.join(os.getcwd(), 'AppleWWDR.pem'),
            '-outform', 'DER',
            '-out', sig_path,
            '-md', 'sha1',
        ], input_bytes=manifest_bytes)

        # 5) Build .pkpass
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, 'w', compression=zipfile.ZIP_DEFLATED) as zf:
            for fname, fdata in files.items():
                zf.writestr(fname, fdata)
            with open(sig_path, 'rb') as sf:
                zf.writestr('signature', sf.read())
        return buf.getvalue()


def lambda_handler(event, _ctx):
    body = json.loads(event['body'])
    email = body['email']
    member = body.get('memberId', 'unknown')

    serial = str(uuid.uuid4())
    auth = base64.urlsafe_b64encode(os.urandom(16)).decode()
    now_ms = int(time.time() * 1000)

    # Load template.zip once per cold start
    global TEMPLATE_ZIP
    if 'TEMPLATE_ZIP' not in globals():
        obj = s3.get_object(Bucket=BUCKET_TPL, Key='template.zip')
        TEMPLATE_ZIP = obj['Body'].read()

    # Populate template
    tpl_files = {}
    pass_json_path = None

    with zipfile.ZipFile(io.BytesIO(TEMPLATE_ZIP)) as z:
        # find all real file entries (skip directories)
        file_names = [n for n in z.namelist() if not n.endswith('/')]
        # detect a common top-level prefix (like "template/")
        common_prefix = os.path.commonprefix(file_names)
        if common_prefix and '/' in common_prefix:
            # ensure we cut at a slash boundary
            common_prefix = common_prefix.split('/', 1)[0] + '/'
        else:
            common_prefix = ''

        # now read & re-key each file without that prefix
        for full_name in file_names:
            data = z.read(full_name)
            name = full_name[len(common_prefix):] if full_name.startswith(common_prefix) else full_name

            # patch pass.json when we hit it
            if name.lower().endswith('pass.json'):
                pass_json_path = name
                j = json.loads(data)
                j.update(body.get('passData', {}))
                j.update({
                    "serialNumber": serial,
                    "authenticationToken": auth,
                    "webServiceURL": "https://bnlji95zgg.execute-api.eu-west-2.amazonaws.com"
                })
                data = json.dumps(j, separators=(',', ':'), sort_keys=True).encode()

            tpl_files[name] = data

    if pass_json_path is None:
        raise RuntimeError("template.zip didn’t contain a pass.json")

    # Sign & zip
    pkpass = _sign_pass_openssl(tpl_files)

    # Upload
    key = f"{serial}.pkpass"
    s3.put_object(
        Bucket=BUCKET_OUT,
        Key=key,
        Body=pkpass,
        ContentType='application/vnd.apple.pkpass'
    )

    # Store in DynamoDB
    passes.put_item(Item={
        "serialNumber": serial,
        "email": email,
        "auth": auth,
        "lastModified": now_ms,
        "emailStatus": "pending",
        # decode the patched JSON from the correct key
        "passData": tpl_files[pass_json_path].decode(),
        "passTypeIdentifier": "pass.uk.co.mk-lightning.season-ticket",
    })

    return {
        "statusCode": 200,
        "headers": {"Content-Type": "application/json"},
        "body": json.dumps({"serialNumber": serial, "auth": auth})
    }
