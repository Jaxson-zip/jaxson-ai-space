#!/usr/bin/env python3
"""Download a ciphertext relay and verify/decrypt locally on the replacement PC."""
import argparse
import base64
import hashlib
import io
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import tarfile
import tempfile
import time

sys.path.insert(0, str(Path(__file__).resolve().parent / 'lib'))
from private_backup import decrypt_file, digest, verify_bundle

REPO = 'Jaxson-zip/jaxson-ai-space'
STAGE = 'configuration'


def command(*args, input=None, timeout=600, retries=3):
    for attempt in range(retries):
        try:
            return subprocess.check_output(args, input=input, text=True, encoding='utf-8',
                                           stderr=subprocess.DEVNULL, timeout=timeout)
        except (subprocess.CalledProcessError, subprocess.TimeoutExpired):
            if attempt + 1 == retries:
                raise
            time.sleep(3)


def validate_header(header, data):
    if (set(header) != {'version', 'name', 'size', 'sha256'} or header['version'] != 1 or
            not re.fullmatch(r'jaxson-[0-9]{8}T[0-9]{12}Z\.jxb', header['name']) or
            not isinstance(header['size'], int) or not 1 <= header['size'] <= 8 * 1024**3 + 2048 or
            not re.fullmatch('[a-f0-9]{64}', header['sha256'])):
        raise ValueError('Invalid export header')
    if len(data) != header['size'] or hashlib.sha256(data).hexdigest() != header['sha256']:
        raise ValueError('Encrypted export integrity check failed')


def import_monitor_smtp(clear, config):
    # Only recover the existing SMTP settings, never display configuration or
    # inspect private memories. Both archive and subprocess stay local.
    with tarfile.open(clear, 'r:gz') as archive:
        packed = archive.extractfile('release/config.tar.gz').read(8 * 1024**2 + 1)
    if len(packed) > 8 * 1024**2:
        raise ValueError('Oversized configuration archive')
    with tarfile.open(fileobj=io.BytesIO(packed), mode='r:gz') as archive:
        env = archive.extractfile('production.env').read(1024**2 + 1)
    if len(env) > 1024**2:
        raise ValueError('Oversized environment configuration')
    parser = "import{parseEnv}from'node:util';let s='';for await(const c of process.stdin)s+=c;const e=parseEnv(s);console.log(JSON.stringify(Object.fromEntries(Object.entries(e).filter(([k])=>k.startsWith('SMTP_')))))"
    smtp = json.loads(command(config['node'], '--input-type=module', '-e', parser,
                              input=env.decode('utf-8'), timeout=30))
    if smtp.get('SMTP_HOST') != 'smtp.163.com' or smtp.get('SMTP_USER') != '15347640609@163.com' or not smtp.get('SMTP_PASSWORD'):
        raise ValueError('Expected owner SMTP configuration')
    path = Path(config['monitor_config'])
    pending = json.loads(path.with_name('monitor-config.pending.json').read_text(encoding='utf-8'))
    pending['smtp'] = smtp
    path.write_text(json.dumps(pending), encoding='utf-8')


def pull(config_file, initialize=False, import_smtp=False, resume_run=None):
    global STAGE
    config = json.loads(Path(config_file).read_text(encoding='utf-8'))
    gh = config['gh']
    directory = Path(config['backup_directory'])
    directory.mkdir(parents=True, exist_ok=True)
    inputs = {'recovery_public_b64': base64.b64encode(Path(config['recovery_public']).read_bytes()).decode(),
              'download_public_b64': base64.b64encode(Path(config['download_public']).read_bytes()).decode(),
              'initialize': 'true' if initialize else 'false'}
    STAGE = 'dispatch'
    if resume_run:
        if not re.fullmatch('[0-9]+', resume_run):
            raise ValueError('Invalid resumed workflow id')
        run_id = resume_run
    else:
        dispatched = command(gh, 'workflow', 'run', 'owner-backup.yml', '--repo', REPO,
                             '--ref', 'main', '--json', input=json.dumps(inputs), timeout=45, retries=1)
        match = re.search(r'/actions/runs/([0-9]+)', dispatched)
        if not match:
            raise ValueError('Cannot identify dispatched backup run')
        run_id = match[1]
    STAGE = 'workflow'
    print(json.dumps({'stage': STAGE, 'run_id': run_id}), flush=True)
    command(gh, 'run', 'watch', run_id, '--repo', REPO, '--exit-status', '--interval', '10')
    with tempfile.TemporaryDirectory(prefix='.verify-actions-', dir=directory) as work:
        work = Path(work)
        STAGE = 'download'
        command(gh, 'run', 'download', run_id, '--repo', REPO, '--name',
                'encrypted-owner-backup', '--dir', str(work), timeout=180)
        header = json.loads((work / 'header.json').read_text())
        source = work / 'backup.jxb'
        STAGE = 'ciphertext_verification'
        validate_header(header, source.read_bytes())
        clear = work / 'private.tar.gz'
        STAGE = 'local_decryption'
        decrypt_file(source, clear, Path(config['recovery_private']).read_bytes())
        STAGE = 'bundle_verification'
        result = verify_bundle(clear)
        if import_smtp:
            STAGE = 'local_smtp_import'
            import_monitor_smtp(clear, config)
        STAGE = 'local_backup_acceptance'
        target = directory / header['name']
        if target.exists():
            if digest(target) != header['sha256']:
                raise ValueError('Existing encrypted backup differs')
        else:
            os.link(source, target)
        metadata = {**header, **result, 'transport': 'github-actions-ciphertext-relay', 'run_id': run_id}
        pending = directory / 'last-success.json.pending'
        pending.write_text(json.dumps(metadata), encoding='utf-8')
        pending.replace(directory / 'last-success.json')
    deleted = False
    try:
        artifacts = json.loads(command(gh, 'api', f'repos/{REPO}/actions/runs/{run_id}/artifacts', timeout=30))
        for artifact in artifacts['artifacts']:
            if artifact['name'] == 'encrypted-owner-backup':
                command(gh, 'api', '--method', 'DELETE', f'repos/{REPO}/actions/artifacts/{artifact["id"]}', timeout=30)
                deleted = True
    except Exception:
        pass  # The relay expires after one day even if cleanup is unavailable.
    return {**result, 'name': header['name'], 'bytes': header['size'], 'run_id': run_id,
            'relayDeleted': deleted, 'smtpImported': import_smtp}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--config', required=True)
    parser.add_argument('--initialize', action='store_true')
    parser.add_argument('--import-monitor-smtp', action='store_true')
    parser.add_argument('--resume-run')
    args = parser.parse_args()
    try:
        print(json.dumps(pull(args.config, args.initialize, args.import_monitor_smtp, args.resume_run)))
    except Exception:
        print(json.dumps({'verified': False, 'error': 'ENCRYPTED_RELAY_OR_LOCAL_VERIFICATION_FAILED', 'stage': STAGE}))
        sys.exit(1)
