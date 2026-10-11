import hashlib
import importlib.util
import json
from pathlib import Path
import re
import shutil
import subprocess
import unittest

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('release_images', ROOT / 'docker/lib/release_images.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

class ImageIdentityTests(unittest.TestCase):
    def fixture(self, config=b'{"rootfs":{"diff_ids":["sha256:layer"]}}', expected=None):
        digest = 'sha256:' + hashlib.sha256(config).hexdigest()
        manifest = json.dumps({'schemaVersion': 2, 'config': {'digest': digest}, 'layers': []}).encode()
        runtime = 'sha256:' + hashlib.sha256(manifest).hexdigest()
        def run(args):
            if args[:3] == ['docker', 'image', 'inspect']:
                return json.dumps([{'Id': runtime, 'Descriptor': {'digest': runtime}}]).encode()
            if args[:2] == ['docker', 'info']:
                return b'{"Address":"/run/containerd/containerd.sock","Namespaces":{"Containers":"moby"}}'
            if args[-1] == runtime:
                return manifest
            if args[-1] == digest:
                return config
            raise AssertionError(args)
        return run, runtime, digest

    def test_classic_store_uses_verified_config_id(self):
        expected = 'sha256:' + 'a' * 64
        run = lambda args: json.dumps([{'Id': expected}]).encode()
        self.assertEqual(module.resolve_image('jaxson-web:fixture', expected, run), expected)

    def test_containerd_store_verifies_config_and_pins_manifest_id(self):
        run, runtime, expected = self.fixture()
        self.assertEqual(module.resolve_image('jaxson-web:fixture', expected, run), runtime)

    def test_mutable_tag_with_different_config_is_rejected(self):
        run, runtime, expected = self.fixture()
        with self.assertRaises(ValueError):
            module.resolve_image('jaxson-web:fixture', 'sha256:' + '0' * 64, run)

    def test_corrupted_manifest_is_rejected(self):
        run, runtime, expected = self.fixture()
        def corrupt(args):
            data = run(args)
            return data + b' ' if args[0] == 'ctr' and args[-1] == runtime else data
        with self.assertRaises(ValueError):
            module.resolve_image('jaxson-web:fixture', expected, corrupt)

    def test_corrupted_config_blob_is_rejected(self):
        run, runtime, expected = self.fixture()
        def corrupt(args):
            data = run(args)
            return data + b' ' if args[0] == 'ctr' and args[-1] == expected else data
        with self.assertRaises(ValueError):
            module.resolve_image('jaxson-web:fixture', expected, corrupt)

    def test_wrong_classic_identity_cannot_fall_back_to_a_tag(self):
        run = lambda args: json.dumps([{'Id': 'sha256:' + 'a' * 64}]).encode()
        with self.assertRaises(ValueError):
            module.resolve_image('jaxson-web:fixture', 'sha256:' + 'b' * 64, run)

class SSHTransportTests(unittest.TestCase):
    def test_openssh_effective_configuration_keeps_idle_deployments_alive(self):
        bash = 'C:/Program Files/Git/bin/bash.exe' if Path('C:/Program Files/Git/bin/bash.exe').exists() else shutil.which('bash')
        ssh = shutil.which('ssh')
        if not bash or not ssh:
            self.skipTest('Requires Bash and OpenSSH; Linux CI supplies both')
        source = (ROOT / '.github/workflows/deploy.yml').read_text(encoding='utf-8')
        line = re.search(r'^\s+ssh_args=\(.*\)$', source, re.MULTILINE).group().strip()
        result = subprocess.run([bash, '-c', 'private=/tmp/fixture\n' + line + '\nprintf "%s\\0" "${ssh_args[@]}"'], capture_output=True, check=True)
        args = [item.decode() for item in result.stdout.split(b'\0') if item]
        config = subprocess.run([ssh, '-G', '-F', 'none', *args, 'fixture.invalid'], capture_output=True, text=True, check=True)
        effective = dict(line.split(' ', 1) for line in config.stdout.splitlines() if ' ' in line)
        self.assertGreater(int(effective['serveraliveinterval']), 0, 'Silent docker load must send keepalive packets')
        self.assertLessEqual(int(effective['serveraliveinterval']), 60)
        self.assertLessEqual(int(effective['serveralivecountmax']), 10)
        self.assertIn(effective['stricthostkeychecking'], ['true', 'yes'])

if __name__ == '__main__':
    unittest.main()
