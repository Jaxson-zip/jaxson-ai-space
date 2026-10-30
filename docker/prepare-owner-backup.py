#!/usr/bin/env python3
"""Rekey the owner's encrypted export after an explicitly authorized PC change.

JSON stdin contains public keys only. Existing public keys and encrypted files
are retained. Private recovery keys never leave the owner's computer.
"""
import base64
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ed25519, rsa


def public_keys(request):
    recovery = base64.b64decode(request['recovery_public_b64'], validate=True)
    download = base64.b64decode(request['download_public_b64'], validate=True).strip()
    key = serialization.load_pem_public_key(recovery)
    if not isinstance(key, rsa.RSAPublicKey) or key.key_size < 3072:
        raise ValueError('Invalid recovery public key')
    key = serialization.load_ssh_public_key(download)
    if not isinstance(key, ed25519.Ed25519PublicKey) or b'\n' in download or b'\r' in download:
        raise ValueError('Invalid restricted download public key')
    return recovery, download


def preserve_and_write(path, content, archive):
    if path.read_bytes() == content:
        return
    previous = path.read_bytes()
    preserved = archive / (path.name + '-' + hashlib.sha256(previous).hexdigest()[:16])
    if not preserved.exists():
        with preserved.open('xb') as output:
            output.write(previous)
    pending = path.with_name(path.name + '.new-pc-pending')
    with pending.open('wb') as output:
        output.write(content)
    pending.chmod(0o600)
    pending.replace(path)


def prepare(request):
    if os.geteuid() != 0:
        raise ValueError('Root required')
    os.umask(0o077)
    recovery, download = public_keys(request)
    ops = Path('/opt/jaxson-ops')
    current = ops / 'current'
    keyfile = Path('/root/.ssh/jaxson-backup-authorized_keys')
    if not all(path.is_file() for path in [ops / 'recovery-public.pem', ops / 'backup-download.pub', keyfile]):
        raise ValueError('Expected established restricted backup setup')
    initialize = request.get('initialize') is True
    if not initialize and (ops / 'recovery-public.pem').read_bytes() != recovery:
        raise ValueError('Backup public key changed; explicit PC initialization required')
    if initialize:
        archive = ops / 'previous-public-keys'
        archive.mkdir(mode=0o700, exist_ok=True)
        preserve_and_write(ops / 'recovery-public.pem', recovery, archive)
        preserve_and_write(ops / 'backup-download.pub', download + b'\n', archive)
        # Add only the fixed forced command; existing login keys are untouched.
        line = b'restrict,command="/usr/bin/python3 /opt/jaxson-ops/current/serve-private-backup.py" ' + download
        existing = keyfile.read_bytes()
        if line not in existing.splitlines():
            preserve_and_write(keyfile, existing.rstrip(b'\n') + b'\n' + line + b'\n', archive)
        subprocess.run(['sshd', '-t'], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    subprocess.run(['/bin/sh', str(current / 'export-private-backup.sh')], check=True,
                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=240)
    store = Path('/var/backups/jaxson-private-export')
    header = json.loads((store / 'latest.json').read_text())
    if not re.fullmatch(r'jaxson-[0-9]{8}T[0-9]{12}Z\.jxb', header['name']):
        raise ValueError('Unexpected export name')
    if not isinstance(header['size'], int) or not 1 <= header['size'] <= 8 * 1024**3 + 2048:
        raise ValueError('Unexpected export size')
    if not re.fullmatch('[a-f0-9]{64}', header['sha256']):
        raise ValueError('Unexpected export checksum')
    if (store / header['name']).stat().st_size != header['size']:
        raise ValueError('Export size mismatch')
    return {key: header[key] for key in ['version', 'name', 'size', 'sha256']}


if __name__ == '__main__':
    try:
        request = json.loads(sys.stdin.buffer.read(16385))
        print(json.dumps(prepare(request)))
    except Exception:
        print('Owner encrypted export setup failed; private data is not logged.', file=sys.stderr)
        sys.exit(1)
