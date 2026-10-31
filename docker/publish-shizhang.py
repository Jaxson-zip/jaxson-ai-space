#!/usr/bin/env python3
"""Run the approved create-only CMS import on the expected release, without printing credentials."""
import hashlib
import json
from pathlib import Path
import re
import subprocess
import sys


class SafeFailure(Exception):
    pass


def command(args, *, source=None, timeout=90, cwd=None):
    result = subprocess.run(args, input=source, text=True, capture_output=True,
                            timeout=timeout, cwd=cwd, check=False)
    if result.returncode:
        raise SafeFailure('COMMAND_FAILED')
    return result.stdout.strip()


def execute(request):
    expected = request.get('expectedRelease', '')
    mode = request.get('mode')
    if not re.fullmatch(r'[a-f0-9]{40}', expected) or mode not in ('plan', 'apply'):
        raise SafeFailure('INVALID_REQUEST')
    release = Path('/opt/jaxson-releases/current').resolve()
    if release.name != expected:
        raise SafeFailure('CURRENT_RELEASE_MISMATCH')
    if not (release / 'production.env').is_file():
        raise SafeFailure('RELEASE_CONFIGURATION_MISSING')
    # The reviewed program and candidate arrive over the pinned administrative SSH connection.
    program = request['importerProgram']
    archive = request['archive']
    if not isinstance(program, str) or len(program) > 30000:
        raise SafeFailure('INVALID_IMPORT_PROGRAM')
    archive_bytes = json.dumps(archive, ensure_ascii=False, separators=(',', ':')).encode()
    if hashlib.sha256(archive_bytes).hexdigest() != request['archiveSha256']:
        raise SafeFailure('CONTENT_CHECKSUM_MISMATCH')

    def cms_run(apply):
        tail = """
import { createCmsClient } from '/app/apps/web/scripts/lib/cms-transfer.mjs'
try {
  const cms = await createCmsClient('http://127.0.0.1:3000',
    process.env.CMS_EMAIL || process.env.OWNER_EMAIL,
    process.env.CMS_PASSWORD || process.env.OWNER_INITIAL_PASSWORD)
  const result = await publishShizhang(cms, ARCHIVE, { apply: APPLY })
  console.log(JSON.stringify({ok:true,result}))
} catch (error) {
  const message = String(error?.message || '')
  const code = message.startsWith('CMS login failed: HTTP ') ? 'CMS_AUTHENTICATION_FAILED'
    : ['EXISTING_CONTENT_DIFFERS','AMBIGUOUS_EXISTING_RECORD'].includes(message) ? message : 'CMS_IMPORT_FAILED'
  console.log(JSON.stringify({ok:false,error:code}))
  process.exitCode=1
}
"""
        source = program + '\nconst ARCHIVE=' + json.dumps(archive, ensure_ascii=False) + ';\n'
        source += 'const APPLY=' + ('true' if apply else 'false') + ';\n' + tail
        # Do not return stderr: login bodies, CMS errors or database diagnostics may contain secrets.
        result = subprocess.run(['docker', 'exec', '-i', 'jaxson-release-web-1',
                                 'node', '--input-type=module', '-'],
                                input=source, text=True, capture_output=True, timeout=180, check=False)
        try:
            report = json.loads(result.stdout.strip().splitlines()[-1])
        except Exception:
            raise SafeFailure('INVALID_CMS_REPORT') from None
        if result.returncode or not report.get('ok'):
            raise SafeFailure(report.get('error', 'CMS_IMPORT_FAILED'))
        return report['result']

    plan = cms_run(False)  # Authenticate and validate every collision before stopping services or writing.
    report = {'ok': True, 'release': expected, 'mode': mode, 'contentSha256': request['archiveSha256'],
              'plan': plan, 'backup': None}
    if mode == 'apply':
        if plan['plannedCreates']:
            tools = Path('/opt/jaxson-release-tools/current')
            output = command(['sh', str(tools / 'backup-vps-existing.sh')], timeout=480)
            backup_name = output.splitlines()[-1]
            backup = Path(backup_name)
            if (backup.parent != Path('/var/backups/jaxson-ai-space')
                    or not re.fullmatch(r'release-[0-9]{8}T[0-9]{6}Z-[a-zA-Z0-9]+', backup.name)
                    or not (backup / 'COMPLETE').is_file()):
                raise SafeFailure('CONTENT_BACKUP_INCOMPLETE')
            command(['sha256sum', '--check', '--quiet', 'SHA256SUMS'], cwd=backup)
            report['backup'] = str(backup)
        if Path('/opt/jaxson-releases/current').resolve().name != expected:
            raise SafeFailure('CURRENT_RELEASE_CHANGED')
        report['result'] = cms_run(True)
    worker = command(['docker', 'exec', 'jaxson-release-worker-1', 'node',
                      'apps/web/scripts/run-index-worker.mjs', '--health'])
    state = json.loads(worker)
    report['worker'] = {key: state[key] for key in ('ok', 'pending', 'processing', 'failed')}
    return report


if __name__ == '__main__':
    try:
        request = json.loads(sys.stdin.read(200001))
        print(json.dumps(execute(request), ensure_ascii=False))
    except SafeFailure as error:
        print(json.dumps({'ok': False, 'error': str(error)}))
        sys.exit(1)
    except Exception:
        print(json.dumps({'ok': False, 'error': 'CONTENT_OPERATION_FAILED'}))
        sys.exit(1)
