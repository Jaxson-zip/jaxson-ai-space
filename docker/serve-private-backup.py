#!/usr/bin/env python3
"""Forced SSH command. Metadata + bytes only, never executes requested commands."""
import hashlib
import json
from pathlib import Path
import re
import sys

store = Path('/var/backups/jaxson-private-export')
try:
    metadata_file = store / 'latest.json'
    if metadata_file.is_symlink() or not metadata_file.is_file():
        raise ValueError('No completed export')
    metadata = json.loads(metadata_file.read_text(encoding='utf8'))
    if set(metadata) != {'version', 'name', 'size', 'sha256'} or metadata['version'] != 1:
        raise ValueError('Invalid metadata')
    if not re.fullmatch(r'jaxson-[0-9]{8}T[0-9]{12}Z\.jxb', metadata['name']):
        raise ValueError('Invalid filename')
    file = store / metadata['name']
    if file.is_symlink() or not file.is_file() or file.stat().st_size != metadata['size']:
        raise ValueError('Invalid encrypted export')
    header = json.dumps(metadata).encode('ascii') + b'\n'
    sys.stdout.buffer.write(header)
    with file.open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            sys.stdout.buffer.write(chunk)
    sys.stdout.buffer.flush()
except Exception:
    print('Encrypted export unavailable.', file=sys.stderr)
    sys.exit(1)
