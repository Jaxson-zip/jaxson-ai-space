"""Local tests only: a release keeps Caddy running unless its configuration really changed."""
import importlib.util
from pathlib import Path
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'docker/lib'))
spec = importlib.util.spec_from_file_location('release_candidate', ROOT / 'docker/lib/release_candidate.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class CaddyfileTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        base = Path(self.temp.name)
        self.live = base / 'live' / 'Caddyfile'
        self.candidate = base / 'candidate' / 'Caddyfile'
        for path in (self.live, self.candidate):
            path.parent.mkdir()
            path.write_text('jaxson.bond {\n  reverse_proxy portfolio:3000\n}\n')

    def tearDown(self):
        self.temp.cleanup()

    def test_an_unchanged_caddyfile_keeps_the_live_mount_so_compose_leaves_caddy_running(self):
        self.assertEqual(module.caddyfile_source(str(self.live), self.candidate), str(self.live))

    def test_a_changed_caddyfile_mounts_the_candidate_copy(self):
        self.candidate.write_text('jaxson.bond {\n  reverse_proxy portfolio:3001\n}\n')
        self.assertEqual(module.caddyfile_source(str(self.live), self.candidate), str(self.candidate))

    def test_a_missing_live_file_mounts_the_candidate_copy(self):
        self.live.unlink()
        self.assertEqual(module.caddyfile_source(str(self.live), self.candidate), str(self.candidate))
        self.assertEqual(module.caddyfile_source(None, self.candidate), str(self.candidate))


if __name__ == '__main__':
    unittest.main()
