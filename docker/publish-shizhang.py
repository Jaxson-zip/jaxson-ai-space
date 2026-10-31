#!/usr/bin/env python3
"""Use the authenticated CMS Local API over owner-authorized pinned SSH."""
import hashlib
import json
from pathlib import Path, PurePosixPath
import re
import subprocess
import sys

CURRENT_STAGE = 'request_validation'


class SafeFailure(Exception):
    pass


def command(args, *, source=None, timeout=90, cwd=None):
    result = subprocess.run(args, input=source, text=True, capture_output=True,
                            timeout=timeout, cwd=cwd, check=False)
    if result.returncode:
        raise SafeFailure('COMMAND_FAILED')
    return result.stdout.strip()


def execute(request):
    global CURRENT_STAGE
    expected = request.get('expectedRelease', '')
    mode = request.get('mode')
    if not re.fullmatch(r'[a-f0-9]{40}', expected) or mode not in ('plan', 'apply'):
        raise SafeFailure('INVALID_REQUEST')
    release = Path('/opt/jaxson-releases/current').resolve()
    if release.name != expected:
        raise SafeFailure('CURRENT_RELEASE_MISMATCH')
    if not (release / 'production.env').is_file():
        raise SafeFailure('RELEASE_CONFIGURATION_MISSING')
    program = request['importerProgram']
    archive = request['archive']
    if not isinstance(program, str) or len(program) > 30000:
        raise SafeFailure('INVALID_IMPORT_PROGRAM')
    archive_bytes = json.dumps(archive, ensure_ascii=False, separators=(',', ':')).encode()
    if hashlib.sha256(archive_bytes).hexdigest() != request['archiveSha256']:
        raise SafeFailure('CONTENT_CHECKSUM_MISMATCH')
    source_files = request.get('sourceFiles', {})
    for name, contents in source_files.items():
        path = PurePosixPath(name)
        allowed = (name in ['package.json', 'tsconfig.json', 'src/payload.config.ts',
                            'scripts/lib/smtp-config.mjs']
                   or name.startswith(('src/collections/', 'src/migrations/', 'src/features/cms/'))
                   and path.suffix == '.ts' and not name.endswith('.test.ts'))
        if path.is_absolute() or '..' in path.parts or not allowed or not isinstance(contents, str):
            raise SafeFailure('INVALID_CMS_SOURCE')
    if not all(name in source_files for name in
               ['package.json', 'tsconfig.json', 'src/payload.config.ts', 'src/migrations/index.ts']):
        raise SafeFailure('CMS_SOURCE_MISSING')
    expected_migrations = request.get('migrations', [])
    CURRENT_STAGE = 'migration_history'
    actual_migrations = command(['docker', 'exec', 'jaxson-postgres-prod', 'psql', '-X', '-At',
        '-U', 'jaxson_admin', '-d', 'jaxson_release_20261007',
        '-c', 'SELECT name FROM owner.payload_migrations ORDER BY name;']).splitlines()
    if len(expected_migrations) != 6 or sorted(actual_migrations) != sorted(expected_migrations):
        raise SafeFailure('MIGRATION_HISTORY_MISMATCH')
    # The exact running release's public config/collections are mounted only in a temporary directory.
    bootstrap = """
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
const files=FILES
const directory=await fs.mkdtemp(path.join(os.tmpdir(),'jaxson-shizhang-'))
for(const [name,body] of Object.entries(files)){
 const target=path.join(directory,name)
 await fs.mkdir(path.dirname(target),{recursive:true})
 await fs.writeFile(target,body,{mode:0o600})
}
await fs.symlink('/app/apps/web/node_modules',path.join(directory,'node_modules'))
console.log(directory)
"""
    CURRENT_STAGE = 'runtime_setup'
    runtime = command(['docker', 'exec', '-i', 'jaxson-release-web-1', 'node', '--input-type=module', '-'],
        source=bootstrap.replace('FILES', json.dumps(source_files, ensure_ascii=False)))
    if not re.fullmatch(r'/tmp/jaxson-shizhang-[a-zA-Z0-9]+', runtime):
        raise SafeFailure('INVALID_CMS_RUNTIME')

    def cms_run(apply):
        global CURRENT_STAGE
        CURRENT_STAGE = 'cms_apply' if apply else 'cms_plan'
        # This verifies the administrator password, then passes the real user and overrideAccess:false.
        # It does not modify or disable the HTTP/Cloudflare perimeter.
        tail = """
import { getPayload } from 'payload'
import config from './src/payload.config.ts'
let payload, report
try {
  payload=await getPayload({config})
  const login=await payload.login({collection:'users',data:{
    email:process.env.CMS_EMAIL||process.env.OWNER_EMAIL,
    password:process.env.CMS_PASSWORD||process.env.OWNER_INITIAL_PASSWORD
  }})
  if(!login.user) throw Error('CMS_AUTHENTICATION_FAILED')
  const user=login.user
  const cms={
    list:async collection=>(await payload.find({collection,overrideAccess:false,user,depth:0,pagination:false,
      where:collection==='projects'
        ? {or:[{visibility:{equals:'public'}},{slug:{equals:'shizhang'}}]}
        : {or:[{isPublic:{equals:true}},{title:{equals:ARCHIVE.records['ai-knowledge'][0].title}}]}
    })).docs,
    write:async (collection,data)=>payload.create({collection,data,user,overrideAccess:false,depth:0})
  }
  report={ok:true,result:await publishShizhang(cms,ARCHIVE,{apply:APPLY})}
} catch(error) {
  const message=String(error?.message||'')
  const code=error?.name==='AuthenticationError'||message==='CMS_AUTHENTICATION_FAILED'
    ? 'CMS_AUTHENTICATION_FAILED'
    : ['EXISTING_CONTENT_DIFFERS','AMBIGUOUS_EXISTING_RECORD'].includes(message)?message:'CMS_IMPORT_FAILED'
  report={ok:false,error:code}
} finally { if(payload) await payload.destroy() }
console.log(JSON.stringify(report))
if(!report.ok) process.exitCode=1
"""
        source = program + '\nconst ARCHIVE=' + json.dumps(archive, ensure_ascii=False) + ';\n'
        source += 'const APPLY=' + ('true' if apply else 'false') + ';\n' + tail
        result = subprocess.run(['docker', 'exec', '-i', '-w', runtime, '-e',
            'TSX_TSCONFIG_PATH=' + runtime + '/tsconfig.json', 'jaxson-release-web-1',
            'node', '--import', '/app/apps/web/node_modules/tsx/dist/loader.mjs', '--input-type=module', '-'],
            input=source, text=True, capture_output=True, timeout=300, check=False)
        try:
            report = json.loads(result.stdout.strip().splitlines()[-1])
        except Exception:
            raise SafeFailure('INVALID_CMS_REPORT') from None
        if result.returncode or not report.get('ok'):
            raise SafeFailure(report.get('error', 'CMS_IMPORT_FAILED'))
        return report['result']

    try:
        plan = cms_run(False)
        report = {'ok': True, 'release': expected, 'mode': mode,
                  'contentSha256': request['archiveSha256'], 'plan': plan, 'backup': None}
        if mode == 'apply':
            if plan['plannedCreates']:
                CURRENT_STAGE = 'content_backup'
                output = command(['sh', '/opt/jaxson-release-tools/current/backup-vps-existing.sh'], timeout=900)
                backup = Path(output.splitlines()[-1])
                if (backup.parent != Path('/var/backups/jaxson-ai-space')
                        or not re.fullmatch(r'release-[0-9]{8}T[0-9]{6}Z-[a-zA-Z0-9]+', backup.name)
                        or not (backup / 'COMPLETE').is_file()):
                    raise SafeFailure('CONTENT_BACKUP_INCOMPLETE')
                command(['sha256sum', '--check', '--quiet', 'SHA256SUMS'], cwd=backup)
                report['backup'] = str(backup)
            if Path('/opt/jaxson-releases/current').resolve().name != expected:
                raise SafeFailure('CURRENT_RELEASE_CHANGED')
            report['result'] = cms_run(True)
        CURRENT_STAGE = 'worker_health'
        worker = json.loads(command(['docker', 'exec', 'jaxson-release-worker-1', 'node',
                                   'apps/web/scripts/run-index-worker.mjs', '--health']))
        report['worker'] = {key: worker[key] for key in ('ok', 'pending', 'processing', 'failed')}
        return report
    finally:
        cleanup = "import fs from 'node:fs/promises';await fs.rm(process.argv[1],{recursive:true,force:true})"
        # runtime was generated by mkdtemp and validated above, never supplied as an arbitrary path.
        try:
            command(['docker', 'exec', 'jaxson-release-web-1', 'node', '--input-type=module', '-e', cleanup, runtime])
            if 'report' in locals():
                report['temporaryCleanup'] = True
        except (SafeFailure, subprocess.TimeoutExpired):
            # The directory contains only public source. Do not hide a CMS auth/write result behind cleanup.
            if 'report' in locals():
                report['temporaryCleanup'] = False


if __name__ == '__main__':
    try:
        print(json.dumps(execute(json.loads(sys.stdin.read(500001))), ensure_ascii=False))
    except SafeFailure as error:
        print(json.dumps({'ok': False, 'error': str(error), 'stage': CURRENT_STAGE}))
        sys.exit(1)
    except subprocess.TimeoutExpired:
        print(json.dumps({'ok': False, 'error': 'CONTENT_COMMAND_TIMEOUT', 'stage': CURRENT_STAGE}))
        sys.exit(1)
    except Exception:
        print(json.dumps({'ok': False, 'error': 'CONTENT_OPERATION_FAILED', 'stage': CURRENT_STAGE}))
        sys.exit(1)
