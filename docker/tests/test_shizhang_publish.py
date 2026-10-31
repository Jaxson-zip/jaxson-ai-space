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
                'archiveSha256': module.hashlib.sha256(b'{}').hexdigest(),
                'sourceFiles': {name: '{}' for name in ['package.json', 'tsconfig.json',
                    'src/payload.config.ts', 'src/migrations/index.ts']},
                'migrations': ['migration-' + str(index) for index in range(6)]}

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
            def respond(args, **kwargs):
                if 'psql' in args:
                    return subprocess.CompletedProcess(args, 0, '\n'.join(request['migrations']), '')
                if '--import' in args:
                    return response
                if '-e' in args:
                    return subprocess.CompletedProcess(args, 0, '', '')
                return subprocess.CompletedProcess(args, 0, '/tmp/jaxson-shizhang-Test123', '')
            with patch.object(module, 'Path', side_effect=lambda value: release):
                with patch.object(module.subprocess, 'run', side_effect=respond) as run:
                    with self.assertRaisesRegex(module.SafeFailure, 'CMS_AUTHENTICATION_FAILED'):
                        module.execute(request)
                    self.assertEqual(run.call_count, 4)
                    self.assertTrue(all(call.args[0][:2] == ['docker', 'exec'] for call in run.call_args_list))
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

    def test_cleanup_timeout_preserves_the_original_auth_failure(self):
        with tempfile.TemporaryDirectory() as directory:
            release = Path(directory) / ('a' * 40)
            release.mkdir()
            (release / 'production.env').write_text('placeholder')
            request = {**self.request(), 'mode': 'apply'}
            def respond(args, **kwargs):
                if 'psql' in args:
                    return subprocess.CompletedProcess(args, 0, '\n'.join(request['migrations']), '')
                if '--import' in args:
                    return subprocess.CompletedProcess(args, 1,
                        json.dumps({'ok': False, 'error': 'CMS_AUTHENTICATION_FAILED'}), '')
                if '-e' in args:
                    raise subprocess.TimeoutExpired(args, 90)
                return subprocess.CompletedProcess(args, 0, '/tmp/jaxson-shizhang-Test123', '')
            with patch.object(module, 'Path', side_effect=lambda value: release), \
                 patch.object(module.subprocess, 'run', side_effect=respond):
                with self.assertRaisesRegex(module.SafeFailure, 'CMS_AUTHENTICATION_FAILED'):
                    module.execute(request)


if __name__ == '__main__':
    unittest.main()
