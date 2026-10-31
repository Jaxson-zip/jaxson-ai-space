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
                    self.assertEqual(run.call_count, 5)
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

    def test_cms_timeout_reports_only_the_last_safe_phase_and_uses_a_file_entrypoint(self):
        with tempfile.TemporaryDirectory() as directory:
            release = Path(directory) / ('a' * 40)
            release.mkdir()
            (release / 'production.env').write_text('placeholder')
            request = self.request()
            def respond(args, **kwargs):
                if 'psql' in args:
                    return subprocess.CompletedProcess(args, 0, '\n'.join(request['migrations']), '')
                if '--import' in args:
                    self.assertTrue(args[-1].endswith('/operation.mjs'))
                    self.assertNotIn('-i', args)
                    self.assertIn('timeout', args)
                    return subprocess.CompletedProcess(args, 124,
                        '\n'.join([json.dumps({'event': 'cms-phase', 'stage': stage})
                                   for stage in ['importing', 'initializing', 'private-error-must-stay-hidden']]), '')
                if '-e' in args:
                    return subprocess.CompletedProcess(args, 0, '', '')
                return subprocess.CompletedProcess(args, 0, '/tmp/jaxson-shizhang-Test123', '')
            with patch.object(module, 'Path', side_effect=lambda value: release), \
                 patch.object(module.subprocess, 'run', side_effect=respond):
                with self.assertRaisesRegex(module.SafeFailure, '^CMS_TIMEOUT_INITIALIZING$'):
                    module.execute(request)

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

    def test_content_snapshot_preserves_public_records_and_removes_private_fields(self):
        inventory = {'projects': [{'id': 1, 'visibility': 'public', 'title': 'Existing'}],
            'ai-knowledge': [{'id': 2, 'isPublic': True, 'title': 'Public',
                'content': 'approved facts', 'privateMemoryKey': 'private-link-must-not-be-backed-up'}]}
        archive = {'records': {'projects': [{'slug': 'shizhang', 'visibility': 'public'}], 'ai-knowledge': []}}
        with tempfile.TemporaryDirectory() as directory:
            target = module.content_snapshot(inventory, archive, 'a' * 40, Path(directory))
            self.assertTrue((target / 'CONTENT_SNAPSHOT_COMPLETE').is_file())
            before = (target / 'before.json').read_text(encoding='utf8')
            self.assertIn('approved facts', before)
            self.assertNotIn('private-link', before)
            self.assertNotIn('privateMemoryKey', before)
            for line in (target / 'SHA256SUMS').read_text().splitlines():
                digest, name = line.split('  ')
                self.assertEqual(module.hashlib.sha256((target / name).read_bytes()).hexdigest(), digest)

    def test_content_snapshot_refuses_private_records_before_creating_files(self):
        inventory = {'projects': [{'visibility': 'private'}], 'ai-knowledge': []}
        with tempfile.TemporaryDirectory() as directory:
            with self.assertRaisesRegex(module.SafeFailure, 'SNAPSHOT_MUST_BE_PUBLIC'):
                module.content_snapshot(inventory, {'records': inventory}, 'a' * 40, Path(directory))
            self.assertEqual(list(Path(directory).iterdir()), [])


if __name__ == '__main__':
    unittest.main()
