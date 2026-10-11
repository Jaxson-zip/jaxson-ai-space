#!/usr/bin/env python3
import datetime as dt
import json
import os
from pathlib import Path
import sys
import tempfile

sys.path.insert(0, str(Path(__file__).resolve().parent / 'lib'))
from private_backup import pack_bundle, verify_bundle, encrypt_file, digest

os.umask(0o077)
store = Path('/var/backups/jaxson-private-export')
public = Path('/opt/jaxson-ops/recovery-public.pem')
try:
    with tempfile.TemporaryDirectory(prefix='.capture-', dir=store) as work:
        bundle = Path(work) / 'private.tar.gz'
        pack_bundle(Path(sys.argv[1]), Path('/opt/jaxson-openclaw'), bundle)
        verify_bundle(bundle)
        name = 'jaxson-' + dt.datetime.now(dt.timezone.utc).strftime('%Y%m%dT%H%M%S%fZ') + '.jxb'
        encrypted = store / name
        encrypt_file(bundle, encrypted, public.read_bytes())
        metadata = {'version': 1, 'name': name, 'size': encrypted.stat().st_size, 'sha256': digest(encrypted)}
        # Only a finished encrypted file becomes exportable. No plaintext marker.
        pending = store / 'latest.json.pending'
        pending.write_text(json.dumps(metadata), encoding='utf8')
        pending.replace(store / 'latest.json')
    print(json.dumps({'encrypted': True, 'bytes': metadata['size']}))
except Exception:
    print('Private export failed; previous encrypted export retained.', file=sys.stderr)
    sys.exit(1)
