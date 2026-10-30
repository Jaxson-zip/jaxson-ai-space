"""Check that release verification rejects drift without mutating services."""
import importlib.util
import json
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('postflight', Path(__file__).parents[1] / 'verify-vps-existing.py')
audit = importlib.util.module_from_spec(spec)
spec.loader.exec_module(audit)


class PostflightTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name)
        release = self.path('/opt/jaxson-releases') / audit.EXPECTED
        release.mkdir(parents=True)
        self.current = release
        artifact = self.path('/opt/jaxson-releases/artifacts') / audit.EXPECTED
        artifact.mkdir(parents=True)
        (artifact / 'artifact.json').write_text(json.dumps({'release_id': audit.EXPECTED,
            'web_image': 'build-web', 'portfolio_image': 'build-portfolio'}))
        self.caddy = self.path('/caddy-mounted')
        self.caddy.write_bytes(b'approved-caddy')
        (release / 'Caddyfile').write_bytes(b'approved-caddy')
        backup = self.path('/var/backups/jaxson-ai-space') / audit.BACKUP_NAME
        backup.mkdir(parents=True)
        (backup / 'COMPLETE').touch()
        rollback = self.path('/opt/jaxson-releases') / audit.PREVIOUS
        rollback.mkdir()
        (rollback / 'compose.yaml').touch()
        self.health = 'healthy'
        self.image = 'runtime-web'
        self.bad_backup = False

    def path(self, value):
        if str(value) == '/opt/jaxson-releases/current' and hasattr(self, 'current'):
            return self.current
        return self.root / str(value).lstrip('/')

    def command(self, *args, cwd=None):
        if args[0] == 'python3':
            return 'runtime-portfolio' if 'portfolio' in args[2] else 'runtime-web'
        if args[:2] == ('docker', 'inspect'):
            if args[3] == '{{.Id}}':
                return audit.CADDY_ID
            if '.Mounts' in args[3]:
                return '/caddy-mounted'
            image = 'runtime-portfolio' if args[-1].endswith('portfolio-1') else self.image
            return f'{image}|{self.health}|0'
        if 'psql' in args:
            self.assertTrue(args[-1].startswith('SELECT count(*) FROM owner.'))
            return '6' if 'payload_migrations' in args[-1] else '8'
        if args[:2] == ('docker', 'exec'):
            return json.dumps({'ok': True, 'pending': 0, 'processing': 0, 'failed': 0})
        if args[0] == 'sha256sum':
            if self.bad_backup:
                raise subprocess.CalledProcessError(1, args)
            return ''
        if args[0] == 'systemctl':
            return 'LoadState=loaded\nActiveState=active'
        if args[0] == 'sshd':
            return 'port 22\npasswordauthentication yes\n'
        self.fail('Unexpected command; verifier must only inspect known resources')

    def verify(self):
        with patch.object(audit, 'Path', side_effect=self.path), \
             patch.object(audit, 'CADDY_HASH', audit.hashlib.sha256(b'approved-caddy').hexdigest()), \
             patch.object(audit, 'run', side_effect=self.command):
            return audit.verify()

    def test_runtime_image_id_is_resolved_separately_from_build_config(self):
        report = self.verify()
        self.assertTrue(report['ok'])
        self.assertTrue(report['backupChecksums'])
        self.assertTrue(report['caddyUnchanged'])

    def test_wrong_current_release_is_rejected(self):
        self.current = self.root / 'different-release'
        self.current.mkdir()
        with self.assertRaisesRegex(ValueError, 'CURRENT_RELEASE_MISMATCH'):
            self.verify()

    def test_unhealthy_service_is_rejected(self):
        self.health = 'unhealthy'
        with self.assertRaisesRegex(ValueError, 'WEB_UNHEALTHY'):
            self.verify()

    def test_wrong_running_image_is_rejected(self):
        self.image = 'unapproved-runtime'
        with self.assertRaisesRegex(ValueError, 'WEB_IMAGE_MISMATCH'):
            self.verify()

    def test_caddy_config_drift_is_rejected(self):
        self.caddy.write_bytes(b'changed')
        with self.assertRaisesRegex(ValueError, 'CADDY_CONFIG_CHANGED'):
            self.verify()

    def test_backup_checksum_failure_is_not_reported_as_success(self):
        self.bad_backup = True
        with self.assertRaises(subprocess.CalledProcessError):
            self.verify()


if __name__ == '__main__':
    unittest.main()
