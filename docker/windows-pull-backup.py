#!/usr/bin/env python3
"""Download and verify a private encrypted snapshot with a restricted SSH key."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import sys
import tempfile
import paramiko

sys.path.insert(0, str(Path(__file__).resolve().parent / 'lib'))
from private_backup import decrypt_file, digest, verify_bundle
from windows_network import direct_connection


def pull(config_file):
    config = json.loads(Path(config_file).read_text(encoding='utf8'))
    directory = Path(config['backup_directory'])
    directory.mkdir(parents=True, exist_ok=True)
    client = paramiko.SSHClient()
    client.load_host_keys(config['known_hosts'])
    client.set_missing_host_key_policy(paramiko.RejectPolicy())
    partial = None
    try:
        connection = direct_connection(config['host'], 22, 20, config['direct_interface']) if config.get('direct_interface') else None
        client.connect(config['host'], port=22, username='root', key_filename=config['download_key'],
                       look_for_keys=False, allow_agent=False, timeout=20, auth_timeout=20, sock=connection)
        _, stdout, stderr = client.exec_command('encrypted-backup-export', timeout=120)
        raw = stdout.readline(4097)
        if not raw.endswith('\n') or len(raw) > 4096:
            raise ValueError('Invalid export header')
        header = json.loads(raw)
        if (set(header) != {'version', 'name', 'size', 'sha256'} or header['version'] != 1 or
                not re.fullmatch(r'jaxson-[0-9]{8}T[0-9]{12}Z\.jxb', header['name']) or
                not isinstance(header['size'], int) or not 1 <= header['size'] <= 8 * 1024**3 + 2048 or
                not re.fullmatch('[a-f0-9]{64}', header['sha256'])):
            raise ValueError('Invalid export metadata')
        target = directory / header['name']
        # A power loss can leave a partial file. A unique name lets the next
        # scheduled attempt proceed without deleting another running download.
        descriptor, temporary = tempfile.mkstemp(prefix='.download-', suffix='.partial', dir=directory)
        partial = Path(temporary)
        value, count = hashlib.sha256(), 0
        with os.fdopen(descriptor, 'wb') as output:
            while True:
                chunk = stdout.read(1024 * 1024)
                if not chunk:
                    break
                count += len(chunk)
                if count > header['size']:
                    raise ValueError('Oversized export')
                value.update(chunk)
                output.write(chunk)
            output.flush()
            os.fsync(output.fileno())
        status = stdout.channel.recv_exit_status()
        if status != 0 or count != header['size'] or value.hexdigest() != header['sha256']:
            raise ValueError('Download failed integrity check')
        # Authentication and all nested snapshots are verified before accepting it.
        with tempfile.TemporaryDirectory(prefix='.verify-', dir=directory) as work:
            clear = Path(work) / 'private.tar.gz'
            decrypt_file(partial, clear, Path(config['recovery_private']).read_bytes())
            result = verify_bundle(clear)
        if target.exists():
            if digest(target) != header['sha256']:
                raise ValueError('Existing backup has different content')
            partial.unlink()
        else:
            os.link(partial, target)
            partial.unlink()
        with tempfile.NamedTemporaryFile(mode='w', encoding='utf8', prefix='.metadata-',
                                         suffix='.partial', dir=directory, delete=False) as metadata:
            metadata.write(json.dumps({**header, **result, 'transport': 'restricted-ssh'}))
            metadata.flush()
            os.fsync(metadata.fileno())
        Path(metadata.name).replace(directory / 'last-success.json')
        return {**result, 'name': header['name'], 'bytes': count}
    finally:
        client.close()
        if partial is not None:
            partial.unlink(missing_ok=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--config', required=True)
    args = parser.parse_args()
    try:
        print(json.dumps(pull(args.config)))
    except Exception:
        print(json.dumps({'verified': False, 'error': 'BACKUP_DOWNLOAD_OR_VERIFICATION_FAILED'}))
        sys.exit(1)
