#!/usr/bin/env python3
"""Read-only verification of the approved PR 17 release and its rollback backup.

Run over stdin via verify-production.yml; never loads environment secrets or
reads database records. This snapshot is intentionally tied to the media release.
"""
import hashlib
import ipaddress
import json
from pathlib import Path
import shutil
import subprocess
import sys

EXPECTED = 'e2270b7d5c7d496d3d1d67b485f5fc72476fb766'
PREVIOUS = 'b9cb7211515d5a4ea2477003dcc4a3256f452675'
CADDY_ID = '5ce9ccf30c0bf734772997f5749b88a302548902ac11a21061ab8265c43a7bc9'
CADDY_HASH = '2dca59daa3e5b73e7ab4815756a56c62c2ecae5925781e05982899b562eae6f1'


def run(*args, cwd=None):
    return subprocess.check_output(args, cwd=cwd, text=True,
                                   stderr=subprocess.DEVNULL, timeout=120).strip()


def require(condition, code):
    if not condition:
        raise ValueError(code)


def verify(client_ip=''):
    current = Path('/opt/jaxson-releases/current').resolve()
    require(current.name == EXPECTED, 'CURRENT_RELEASE_MISMATCH')
    artifact_dir = Path('/opt/jaxson-releases/artifacts') / EXPECTED
    artifact = json.loads((artifact_dir / 'artifact.json').read_text())
    require(artifact['release_id'] == EXPECTED, 'ARTIFACT_RELEASE_MISMATCH')
    helper = artifact_dir / 'tools/lib/release_images.py'
    images = {key: run('python3', str(helper), f'jaxson-{service}:{EXPECTED}', artifact[key])
              for service, key in [('web', 'web_image'), ('portfolio', 'portfolio_image')]}
    containers = {}
    for service, key in [('web', 'web_image'), ('worker', 'web_image'), ('portfolio', 'portfolio_image')]:
        image, health, restarts = run('docker', 'inspect', '--format',
            '{{.Image}}|{{.State.Health.Status}}|{{.RestartCount}}', f'jaxson-release-{service}-1').split('|')
        require(image == images[key], f'{service.upper()}_IMAGE_MISMATCH')
        require(health == 'healthy', f'{service.upper()}_UNHEALTHY')
        containers[service] = {'imageMatches': True, 'health': health, 'restarts': int(restarts)}
    def sql(query):
        return run('docker', 'exec', 'jaxson-postgres-prod', 'psql', '-X', '-At', '-U',
                   'jaxson_admin', '-d', 'jaxson_release_20261007', '-c', query)
    require(int(sql('SELECT count(*) FROM owner.payload_migrations;')) == 6, 'MIGRATION_COUNT_CHANGED')
    require(int(sql('SELECT count(*) FROM owner.ai_knowledge WHERE is_public=true;')) == 8,
            'PUBLIC_KNOWLEDGE_COUNT_CHANGED')
    worker = json.loads(run('docker', 'exec', 'jaxson-release-worker-1', 'node',
                            'apps/web/scripts/run-index-worker.mjs', '--health'))
    require(worker['ok'] and not any(worker[key] for key in ['pending', 'processing', 'failed']),
            'INDEX_QUEUE_NOT_CLEAR')
    caddy = 'jaxson-release-caddy-1'
    require(run('docker', 'inspect', '--format', '{{.Id}}', caddy) == CADDY_ID, 'CADDY_CONTAINER_CHANGED')
    source = Path(run('docker', 'inspect', '--format',
        '{{range .Mounts}}{{if eq .Destination "/etc/caddy/Caddyfile"}}{{.Source}}{{end}}{{end}}', caddy))
    for path in [current / 'Caddyfile', source]:
        require(hashlib.sha256(path.read_bytes()).hexdigest() == CADDY_HASH, 'CADDY_CONFIG_CHANGED')
    backup = Path('/var/backups/jaxson-ai-space/release-20261029T143128Z-Vdaa6j')
    require((backup / 'COMPLETE').is_file(), 'RELEASE_BACKUP_INCOMPLETE')
    run('sha256sum', '--check', '--quiet', 'SHA256SUMS', cwd=backup)
    rollback = Path('/opt/jaxson-releases') / PREVIOUS
    require((rollback / 'compose.yaml').is_file(), 'ROLLBACK_RELEASE_MISSING')
    timers = {}
    for unit in ['jaxson-vps-backup.timer', 'jaxson-vps-backup.service']:
        timers[unit] = dict(line.split('=', 1) for line in run('systemctl', 'show', unit,
            '--property=LoadState,ActiveState,Result,ExecMainStatus,LastTriggerUSec,NextElapseUSecRealtime').splitlines()
            if '=' in line)
    ssh = {line.split(None, 1)[0]: line.split(None, 1)[1] for line in run('sshd', '-T').splitlines()
           if line.split(None, 1)[0] in ['port', 'maxstartups', 'persourcemaxstartups', 'passwordauthentication']}
    connectivity = {}
    if client_ip:
        client_ip = str(ipaddress.ip_address(client_ip))
        if shutil.which('fail2ban-client'):
            banned = run('fail2ban-client', 'get', 'sshd', 'banip').split()
            connectivity['clientBannedByFail2ban'] = client_ip in banned
        else:
            connectivity['fail2banInstalled'] = False
        if shutil.which('iptables'):
            rules = run('iptables-save')
            connectivity['clientMentionedByFirewall'] = client_ip in rules
    ops = Path('/opt/jaxson-ops')
    backup_setup = {name: (ops / name).is_file() for name in ['recovery-public.pem', 'backup-download.pub']}
    backup_setup['restrictedSshKeyConfigured'] = Path('/root/.ssh/jaxson-backup-authorized_keys').is_file()
    backup_setup['privateExportToolPresent'] = (ops / 'current/export-private-backup.sh').is_file()
    return {'ok': True, 'current': str(current), 'containers': containers,
            'worker': {key: worker[key] for key in ['ok', 'pending', 'processing', 'failed']},
            'migrations': 6, 'publicKnowledge': 8, 'caddyUnchanged': True,
            'backup': str(backup), 'backupChecksums': True, 'rollback': str(rollback),
            'freeDiskBytes': shutil.disk_usage(current).free, 'backupUnits': timers, 'sshSettings': ssh,
            'ownerConnectivity': connectivity, 'backupSetup': backup_setup}


if __name__ == '__main__':
    try:
        print(json.dumps(verify(sys.argv[1] if len(sys.argv) > 1 else '')))
    except ValueError as error:
        # Only our own diagnostic codes are safe to expose; JSON parser errors
        # and command stderr may include details outside this report's scope.
        code = str(error)
        print(json.dumps({'ok': False, 'error': code if code.replace('_', '').isupper() else 'INVALID_DIAGNOSTIC_DATA'}))
        sys.exit(1)
    except Exception:
        print(json.dumps({'ok': False, 'error': 'PRODUCTION_VERIFICATION_FAILED'}))
        sys.exit(1)
