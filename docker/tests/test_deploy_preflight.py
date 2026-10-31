"""A verified deploy preflight must hash the archive once, and reject it before any Docker call."""
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest


class DeployPreflightTests(unittest.TestCase):
    def run_fixture(self, reject=False):
        shell = Path('C:/Program Files/Git/bin/bash.exe') if os.name == 'nt' else Path('/bin/sh')
        if not shell.is_file():
            self.skipTest('POSIX shell is required for deployment-script integration')
        with tempfile.TemporaryDirectory(prefix='jaxson-preflight-') as directory:
            root = Path(directory)
            tools = root / 'tools'
            (tools / 'lib').mkdir(parents=True)
            binary = root / 'bin'
            binary.mkdir()
            script = tools / 'deploy.sh'
            shutil.copyfile(Path(__file__).parents[1] / 'deploy-vps-existing.sh', script)
            (tools / 'lib/release.sh').write_text(
                'release_tools=$(dirname -- "$0")\nvalidator="$release_tools/lib/release_snapshot.py"\n'
                'postgres=fixture\nadmin=fixture\ndb=fixture\n'
                'validate_scope() { :; }\noperation_lock() { :; }\n'
                'die() { printf "%s\\n" "$*" >&2; exit 1; }\n', encoding='utf8')
            metadata = {'release_id': 'a' * 40, 'web_image': 'sha256:' + 'b' * 64,
                        'portfolio_image': 'sha256:' + 'c' * 64,
                        'migrations': ['20261028_000000_security_update']}
            validator = (
                'import json,os,sys\nfrom pathlib import Path\n'
                'root=Path(__file__).parents[2]\n'
                'with (root/"validation-calls.txt").open("a") as f:f.write("validated\\n")\n'
                'if os.environ.get("REJECT_ARCHIVE")=="1":sys.exit(9)\n'
                'data=' + repr(metadata) + '\n'
                'if "--field" in sys.argv:\n'
                ' value=data[sys.argv[sys.argv.index("--field")+1]]\n'
                ' print("\\n".join(value) if isinstance(value,list) else value)\n'
                'else:print(json.dumps(data))\n')
            (tools / 'lib/release_snapshot.py').write_text(validator, encoding='utf8')
            quote = lambda value: "'" + str(value).replace("'", "'\\''") + "'"
            (binary / 'python3').write_text('#!/bin/sh\nexec ' + quote(Path(sys.executable).as_posix()) + ' "$@"\n', encoding='utf8')
            (binary / 'docker').write_text('#!/bin/sh\nprintf called > ' + quote((root / 'docker-called').as_posix())
                + ("\nprintf '%s\\r\\n' 20261028_000000_security_update\n" if os.name == 'nt'
                   else "\nprintf '%s\\n' 20261028_000000_security_update\n"), encoding='utf8')
            for path in binary.iterdir():
                path.chmod(0o700)
            env = {**os.environ, 'PATH': str(binary) + os.pathsep + os.environ['PATH'],
                   'REJECT_ARCHIVE': '1' if reject else '0'}
            result = subprocess.run([str(shell), script.as_posix(), (root / 'bundle').as_posix(), '--verify'],
                                    env=env, capture_output=True, text=True, timeout=30)
            calls = len((root / 'validation-calls.txt').read_text().splitlines())
            return result.returncode, result.stderr, calls, (root / 'docker-called').exists()

    def test_preflight_validates_archive_once_for_all_metadata_fields(self):
        code, error, calls, docker_called = self.run_fixture()
        self.assertEqual(code, 0, error)
        self.assertTrue(docker_called)
        self.assertEqual(calls, 1, 'Metadata extraction must not re-hash the multi-GB image archive')

    def test_invalid_archive_is_rejected_before_docker(self):
        code, _, calls, docker_called = self.run_fixture(reject=True)
        self.assertNotEqual(code, 0)
        self.assertEqual(calls, 1)
        self.assertFalse(docker_called)


if __name__ == '__main__':
    unittest.main()
