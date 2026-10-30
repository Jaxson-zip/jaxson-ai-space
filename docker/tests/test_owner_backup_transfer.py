"""Reject unsafe keys, filenames, and altered ciphertext before using a relay."""
import base64
import hashlib
import importlib.util
from pathlib import Path
import tempfile
import unittest
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ed25519, rsa


def module(name, filename):
    spec = importlib.util.spec_from_file_location(name, Path(__file__).parents[1] / filename)
    value = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(value)
    return value


server = module('owner_backup_server', 'prepare-owner-backup.py')
client = module('owner_backup_client', 'windows-pull-actions-backup.py')


class TransferTests(unittest.TestCase):
    def test_valid_ciphertext_header_and_checksum(self):
        data = b'encrypted backup bytes'
        header = {'version': 1, 'name': 'jaxson-20261030T090000123456Z.jxb',
                  'size': len(data), 'sha256': hashlib.sha256(data).hexdigest()}
        client.validate_header(header, data)
        with self.assertRaises(ValueError):
            client.validate_header(header, data + b'changed')

    def test_parent_path_is_rejected_even_with_matching_checksum(self):
        with self.assertRaises(ValueError):
            client.validate_header({'version': 1, 'name': '../key.pem', 'size': 1,
                                    'sha256': hashlib.sha256(b'x').hexdigest()}, b'x')

    def test_private_key_cannot_be_used_as_public_workflow_input(self):
        key = rsa.generate_private_key(public_exponent=65537, key_size=3072)
        recovery = key.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8,
                                     serialization.NoEncryption())
        download = ed25519.Ed25519PrivateKey.generate().public_key().public_bytes(
            serialization.Encoding.OpenSSH, serialization.PublicFormat.OpenSSH)
        with self.assertRaises(ValueError):
            server.public_keys({'recovery_public_b64': base64.b64encode(recovery).decode(),
                                'download_public_b64': base64.b64encode(download).decode()})

    def test_prior_public_key_is_preserved_on_replacement(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            path = root / 'public.pem'
            path.write_bytes(b'original public key')
            archive = root / 'archive'
            archive.mkdir()
            server.preserve_and_write(path, b'new public key', archive)
            self.assertEqual(path.read_bytes(), b'new public key')
            self.assertEqual(next(archive.iterdir()).read_bytes(), b'original public key')
            server.preserve_and_write(path, b'new public key', archive)
            self.assertEqual(len(list(archive.iterdir())), 1)


if __name__ == '__main__':
    unittest.main()
