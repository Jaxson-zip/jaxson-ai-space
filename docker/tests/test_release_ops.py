"""Local tests only. Fixtures never contain production credentials."""
import hashlib
import io
import json
import pathlib
import re
import subprocess
import sys
import tarfile
import tempfile
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[2]
VALIDATOR = ROOT / "docker/lib/release_snapshot.py"
FILES = ["database.dump", "media.tar.gz", "config.tar.gz", "database-roles.sql", "metadata.txt"]


class SnapshotTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.snapshot = pathlib.Path(self.temp.name) / "snapshot"
        self.snapshot.mkdir()
        (self.snapshot / "COMPLETE").touch()
        (self.snapshot / "database.dump").write_bytes(b"PGDMPfixture")
        (self.snapshot / "database-roles.sql").write_text("-- Do not execute global roles\n")
        (self.snapshot / "metadata.txt").write_text(
            "database=jaxson_release_20261007\nrelease=/opt/jaxson-releases/20261007\ncreated_at=2026-10-08T01:00:00Z\n"
        )
        self.archive("media.tar.gz", [(".", "dir"), ("./cover.jpg", "file")])
        self.archive("config.tar.gz", [(name, "file") for name in ("production.env", "compose.yaml", "Caddyfile")])
        self.manifest()

    def tearDown(self):
        self.temp.cleanup()

    def archive(self, name, entries):
        with tarfile.open(self.snapshot / name, "w:gz") as archive:
            for path, kind in entries:
                item = tarfile.TarInfo(path)
                if kind == "dir":
                    item.type = tarfile.DIRTYPE
                    archive.addfile(item)
                elif kind == "link":
                    item.type = tarfile.SYMTYPE
                    item.linkname = "/etc/passwd"
                    archive.addfile(item)
                else:
                    data = b"fixture"
                    item.size = len(data)
                    archive.addfile(item, io.BytesIO(data))

    def manifest(self):
        (self.snapshot / "SHA256SUMS").write_text("".join(
            f"{hashlib.sha256((self.snapshot / name).read_bytes()).hexdigest()}  {name}\n" for name in FILES
        ))

    def check(self, *args):
        return subprocess.run([sys.executable, str(VALIDATOR), "verify", str(self.snapshot), *args], capture_output=True, text=True)

    def test_current_five_file_snapshot_is_accepted(self):
        result = self.check("--database", "jaxson_release_20261007", "--release", "/opt/jaxson-releases/20261007")
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_default_restore_only_verifies(self):
        script = ROOT / "docker/restore-vps-existing.sh"
        self.assertTrue(script.is_file(), "release restore entry point is missing")
        source = script.read_text()
        self.assertIn("mode=verify", source)

    def test_duplicate_manifest_entry_is_rejected(self):
        path = self.snapshot / "SHA256SUMS"
        lines = path.read_text().splitlines(True)
        path.write_text("".join([lines[0], lines[0], *lines[2:]]))
        self.assertNotEqual(self.check().returncode, 0)

    def test_checksum_mutation_is_rejected(self):
        (self.snapshot / "database.dump").write_bytes(b"changed")
        self.assertNotEqual(self.check().returncode, 0)

    def test_wrong_database_is_rejected(self):
        self.assertNotEqual(self.check("--database", "trading").returncode, 0)

    def test_wrong_release_is_rejected(self):
        self.assertNotEqual(self.check("--release", "/opt/jaxson-releases/other").returncode, 0)

    def test_traversal_member_is_rejected(self):
        self.archive("media.tar.gz", [("../outside", "file")])
        self.manifest()
        self.assertNotEqual(self.check().returncode, 0)

    def test_symlink_member_is_rejected(self):
        self.archive("media.tar.gz", [("./escape", "link")])
        self.manifest()
        self.assertNotEqual(self.check().returncode, 0)

    def test_extra_config_member_is_rejected(self):
        self.archive("config.tar.gz", [(name, "file") for name in ("production.env", "compose.yaml", "Caddyfile", "other.env")])
        self.manifest()
        self.assertNotEqual(self.check().returncode, 0)

    def test_symlink_snapshot_payload_is_rejected(self):
        target = self.snapshot / "database.dump"
        external = pathlib.Path(self.temp.name) / "outside.dump"
        external.write_bytes(target.read_bytes())
        target.unlink()
        try:
            target.symlink_to(external)
        except OSError:
            self.skipTest("Host does not grant symlink creation")
        self.assertNotEqual(self.check().returncode, 0)

    def test_incomplete_marker_is_rejected(self):
        (self.snapshot / "INCOMPLETE").touch()
        self.assertNotEqual(self.check().returncode, 0)

    def test_old_layout_deployment_is_removed(self):
        source = (ROOT / ".github/workflows/deploy.yml").read_text(encoding="utf-8")
        remote = source.split("deploy-to-vps:", 1)[1]
        self.assertNotIn("jaxson_space", remote)
        self.assertNotIn("git pull", remote)
        self.assertIn("deploy-vps-existing.sh", remote)

    def test_portfolio_deploy_build_supplies_its_required_api_origin(self):
        dockerfile = (ROOT / "docker/Dockerfile.portfolio").read_text()
        self.assertIn('test -n "$PORTFOLIO_API_ORIGIN"', dockerfile)
        workflow = (ROOT / ".github/workflows/deploy.yml").read_text(encoding="utf-8")
        deploy = workflow.split("deploy-to-vps:", 1)[1]
        build = re.search(r"^\s+docker build .*Dockerfile\.portfolio.*$", deploy, re.MULTILINE)
        self.assertIsNotNone(build, "Portfolio deployment build is missing")
        self.assertIn('--build-arg PORTFOLIO_API_ORIGIN="$API_URL"', build.group())


if __name__ == "__main__":
    unittest.main()
