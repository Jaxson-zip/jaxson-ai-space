import pathlib
import re
import shutil
import subprocess
import unittest

SH = shutil.which('sh')
if not SH and pathlib.Path('C:/Program Files/Git/bin/sh.exe').is_file():
    SH = 'C:/Program Files/Git/bin/sh.exe'

class BackupResumeTests(unittest.TestCase):
    @unittest.skipUnless(SH, 'Requires a POSIX shell; run on Linux CI')
    def test_resume_allows_cms_health_to_settle_after_a_slow_restart(self):
        source = (pathlib.Path(__file__).resolve().parents[1] / 'backup-vps-existing.sh').read_text()
        function = source[source.index('resume()'):source.index('trap resume EXIT')]
        # This VPS needed about eight minutes to become healthy during severe CPU steal.
        # Model that recovery without sleeping; the wait must remain bounded.
        compose = '''compose() {
          while [ "$#" -gt 0 ]; do
            if [ "$1" = --wait-timeout ]; then
              shift
              [ "$1" -ge 480 ] && [ "$1" -le 600 ] && return 0
              return 17
            fi
            shift
          done
          return 18
        }'''
        settings = (pathlib.Path(__file__).resolve().parents[1] / 'lib/release.sh').read_text()
        budget = re.search(r'^health_wait=(\d+)$', settings, re.MULTILINE)
        wait = budget.group(1) if budget else '300'
        result = subprocess.run([SH, '-c', f'health_wait={wait}\npaused=1\n{compose}\n{function}\ntrap resume EXIT\nexit 0\n'], capture_output=True)
        self.assertEqual(result.returncode, 0, result.stderr.decode())

    @unittest.skipUnless(SH, 'Requires a POSIX shell; run on Linux CI')
    def test_resume_failure_cannot_report_success_and_original_error_is_preserved(self):
        source = (pathlib.Path(__file__).resolve().parents[1] / 'backup-vps-existing.sh').read_text()
        function = source[source.index('resume()'):source.index('trap resume EXIT')]
        for resume_status, original, expected in [(17, 0, 1), (0, 3, 3), (0, 0, 0)]:
            with self.subTest(resume_status=resume_status, original=original):
                script = f'health_wait=600\npaused=1\ncompose() {{ return {resume_status}; }}\n{function}\ntrap resume EXIT\nexit {original}\n'
                result = subprocess.run([SH, '-c', script], capture_output=True)
                self.assertEqual(result.returncode, expected)


if __name__ == '__main__':
    unittest.main()
