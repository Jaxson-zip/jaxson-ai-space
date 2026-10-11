import importlib.util
from contextlib import closing
import pathlib
import os
import sqlite3
import tempfile
import unittest
import sys
import io
import tarfile

ROOT = pathlib.Path(__file__).resolve().parents[2]
sys.path.insert(0, str(pathlib.Path(os.environ.get('JAXSON_PRIVATE_BACKUP_MODULE', ROOT / 'docker/lib/private_backup.py')).parent))
spec = importlib.util.spec_from_file_location('private_backup', os.environ.get('JAXSON_PRIVATE_BACKUP_MODULE', ROOT / 'docker/lib/private_backup.py'))
backup = importlib.util.module_from_spec(spec)
spec.loader.exec_module(backup)


class EncryptionTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = pathlib.Path(self.temp.name)
        self.private, self.public = backup.generate_keypair()
        self.source = self.root / 'source'
        self.source.write_bytes(b'private fixture' * 10000)
        self.encrypted = self.root / 'backup.jxb'
        self.output = self.root / 'recovered'

    def tearDown(self):
        self.temp.cleanup()

    def test_authenticated_round_trip_does_not_embed_plaintext(self):
        backup.encrypt_file(self.source, self.encrypted, self.public)
        self.assertNotIn(b'private fixture', self.encrypted.read_bytes())
        backup.decrypt_file(self.encrypted, self.output, self.private)
        self.assertEqual(self.source.read_bytes(), self.output.read_bytes())

    def test_tampering_or_truncation_never_leaves_plaintext_output(self):
        backup.encrypt_file(self.source, self.encrypted, self.public)
        original = self.encrypted.read_bytes()
        for mutated in (original[:-1], original[:-30], original[:100], original[:-17] + bytes([original[-17] ^ 1]) + original[-16:]):
            self.encrypted.write_bytes(mutated)
            with self.assertRaises(Exception):
                backup.decrypt_file(self.encrypted, self.output, self.private)
            self.assertFalse(self.output.exists())
            self.assertFalse(self.output.with_name(self.output.name + '.partial').exists())

    def test_wrong_key_and_existing_destination_are_rejected(self):
        backup.encrypt_file(self.source, self.encrypted, self.public)
        other, _ = backup.generate_keypair()
        with self.assertRaises(Exception):
            backup.decrypt_file(self.encrypted, self.output, other)
        self.encrypted.write_bytes(b'keep existing')
        with self.assertRaises(FileExistsError):
            backup.encrypt_file(self.source, self.encrypted, self.public)
        self.assertEqual(self.encrypted.read_bytes(), b'keep existing')

    def test_sqlite_backup_includes_committed_wal_data(self):
        source = self.root / 'live.sqlite'
        with closing(sqlite3.connect(source)) as db:
            db.execute('PRAGMA journal_mode=WAL')
            db.execute('CREATE TABLE receipts (id TEXT, status TEXT)')
            db.execute("INSERT INTO receipts VALUES ('fixture', 'completed')")
            db.commit()
            target = self.root / 'snapshot.sqlite'
            backup.snapshot_sqlite(source, target)
            with closing(sqlite3.connect(target)) as copy:
                self.assertEqual(copy.execute('SELECT COUNT(*) FROM receipts').fetchone()[0], 1)

    def test_unsafe_file_trees_are_rejected(self):
        tree = self.root / 'tree'
        tree.mkdir()
        (tree / 'valid').write_text('fixture')
        try:
            (tree / 'linked').symlink_to(self.source)
        except OSError:
            self.skipTest('Windows user lacks symbolic link privilege; also run on Linux')
        with self.assertRaises(ValueError):
            backup.add_private_tree(tree, 'state', [])

    def test_traversal_and_links_are_rejected_without_extracting(self):
        for name, kind in [('../outside', tarfile.REGTYPE), ('gateway/link', tarfile.SYMTYPE)]:
            archive_file = self.root / 'unsafe.tar.gz'
            with tarfile.open(archive_file, 'w:gz') as archive:
                item = tarfile.TarInfo(name)
                item.type = kind
                item.linkname = '/etc/passwd'
                archive.addfile(item)
            with self.assertRaises(ValueError):
                backup.verify_bundle(archive_file)
            self.assertFalse((self.root / 'outside').exists())


if __name__ == '__main__':
    unittest.main()
