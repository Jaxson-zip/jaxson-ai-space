"""Reject content operations before writes or service pauses on validation/auth failures."""
import importlib.util
import json
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('shizhang_publish', Path(__file__).parents[1] / 'publish-shizhang.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class ContentOperationTests(unittest.TestCase):
    def request(self):
        return {'mode': 'plan', 'expectedRelease': 'a' * 40, 'archive': {}, 'importerProgram': '',
                'archiveSha256': module.hashlib.sha256(b'{}').hexdigest()}

    def test_rejects_invalid_target_before_running_any_command(self):
        for fields in [{'expectedRelease': '../main'}, {'mode': 'delete'}]:
            request = {**self.request(), **fields}
            with patch.object(module.subprocess, 'run') as run:
                with self.assertRaisesRegex(module.SafeFailure, 'INVALID_REQUEST'):
                    module.execute(request)
                run.assert_not_called()

    def test_refuses_to_import_on_a_different_release(self):
        with tempfile.TemporaryDirectory() as directory:
            with patch.object(module, 'Path', side_effect=lambda value: Path(directory)):
                with patch.object(module.subprocess, 'run') as run:
                    with self.assertRaisesRegex(module.SafeFailure, 'CURRENT_RELEASE_MISMATCH'):
                        module.execute(self.request())
                    run.assert_not_called()

    def test_authentication_failure_never_pauses_services_or_runs_backup(self):
        with tempfile.TemporaryDirectory() as directory:
            release = Path(directory) / ('a' * 40)
            release.mkdir()
            (release / 'production.env').write_text('placeholder')
            request = {**self.request(), 'mode': 'apply'}
            response = subprocess.CompletedProcess([], 1,
                json.dumps({'ok': False, 'error': 'CMS_AUTHENTICATION_FAILED'}), 'sensitive response must stay hidden')
            with patch.object(module, 'Path', side_effect=lambda value: release):
                with patch.object(module.subprocess, 'run', return_value=response) as run:
                    with self.assertRaisesRegex(module.SafeFailure, 'CMS_AUTHENTICATION_FAILED'):
                        module.execute(request)
                    self.assertEqual(run.call_count, 1)
                    self.assertEqual(run.call_args.args[0][:2], ['docker', 'exec'])
                    self.assertNotIn('sensitive response', str(run.call_args.args))

    def test_bad_checksum_cannot_authenticate_or_write(self):
        with tempfile.TemporaryDirectory() as directory:
            release = Path(directory) / ('a' * 40)
            release.mkdir()
            (release / 'production.env').write_text('placeholder')
            request = {**self.request(), 'archiveSha256': '0' * 64}
            with patch.object(module, 'Path', side_effect=lambda value: release):
                with patch.object(module.subprocess, 'run') as run:
                    with self.assertRaisesRegex(module.SafeFailure, 'CONTENT_CHECKSUM_MISMATCH'):
                        module.execute(request)
                    run.assert_not_called()


if __name__ == '__main__':
    unittest.main()
