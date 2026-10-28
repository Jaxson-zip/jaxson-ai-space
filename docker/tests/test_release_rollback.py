"""Exercise the real release EXIT trap against an isolated filesystem, never /opt."""
import os
from pathlib import Path
import shlex
import shutil
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]


@unittest.skipUnless(os.name == 'posix' and shutil.which('sh'), 'Run filesystem rollback traps on Linux')
class RollbackTests(unittest.TestCase):
    def exercise(self, health_status=0, activated=1, finished=0):
        source = (ROOT / 'docker/deploy-vps-existing.sh').read_text()
        recover = source[source.index('recover() {'):source.index('trap recover EXIT')]
        with tempfile.TemporaryDirectory() as directory:
            base = Path(directory)
            old, candidate = base / 'old', base / 'candidate'
            old.mkdir()
            candidate.mkdir()
            (base / 'current').symlink_to(candidate, target_is_directory=True)
            health_log = base / 'health.log'
            q = lambda value: shlex.quote(str(value))
            script = f'''set -eu
release_root={q(base)}
old_release={q(old)}
release={q(candidate)}
backup=synthetic-backup
activated={activated}
finished={finished}
applied={q(base / 'applied')}
expected={q(base / 'expected')}
link_tmp={q(base / '.current-test')}
tools_link_tmp={q(base / '.tools-test')}
health() {{ printf '%s\\n' "$release" > {q(health_log)}; return {health_status}; }}
{recover}
trap recover EXIT
exit 23
'''
            result = subprocess.run(['sh', '-c', script], capture_output=True, timeout=10)
            return result.returncode, (base / 'current').resolve().name, health_log.read_text().strip() if health_log.exists() else None, str(old)

    def test_failed_candidate_restores_old_link_checks_old_release_and_preserves_error(self):
        status, current, checked, old = self.exercise()
        self.assertEqual((status, current, checked), (23, 'old', old))

    def test_failed_rollback_health_cannot_report_success(self):
        status, current, checked, old = self.exercise(health_status=17)
        self.assertEqual((status, current, checked), (1, 'old', old))

    def test_unactivated_or_finished_release_does_not_switch_or_restart(self):
        for activated, finished in [(0, 0), (1, 1)]:
            with self.subTest(activated=activated, finished=finished):
                status, current, checked, _ = self.exercise(activated=activated, finished=finished)
                self.assertEqual((status, current, checked), (23, 'candidate', None))


if __name__ == '__main__':
    unittest.main()
