"""Local tests only: release cleanup keeps the live and rollback releases and touches nothing else."""
import importlib.util
from pathlib import Path
import re
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('release_retention', ROOT / 'docker/lib/release_retention.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

CURRENT = 'f7382486f8514a88dc39a4fbaf30d75a8d1ff0a9'
PREVIOUS = '569d892cb72a2c25ed436f4d3f986c6aae58ee48'
OLD = 'e8b98749ce527c88b6f1cedab7adbe84fa737580'
OLDER = 'da55f8b9af50e31cf778f4a0d140e400ed88fc12'
IMAGES = [
    f'jaxson-web:{CURRENT}', f'jaxson-portfolio:{CURRENT}',
    f'jaxson-web:{PREVIOUS}', f'jaxson-portfolio:{PREVIOUS}',
    f'jaxson-web:{OLD}', f'jaxson-portfolio:{OLD}', f'jaxson-web:{OLDER}',
    # Never ours to remove: other services, hand-tagged builds, mutable tags.
    'jaxson-web-release:20261007', 'caddy:2-alpine', 'pgvector/pgvector:pg17', 'ghcr.io/openclaw/openclaw:2026.9.8',
    'jaxson-web:latest', 'jaxson-web:<none>', 'jaxson-portfolio:E8B98749CE527C88B6F1CEDAB7ADBE84FA737580',
]


class PlanTests(unittest.TestCase):
    def test_keeps_the_live_and_rollback_releases_and_removes_older_release_images(self):
        images, _ = module.plan(IMAGES, [], {CURRENT, PREVIOUS})
        self.assertEqual(images, [f'jaxson-web:{OLD}', f'jaxson-portfolio:{OLD}', f'jaxson-web:{OLDER}'])

    def test_removes_only_older_release_packages(self):
        names = [CURRENT, PREVIOUS, OLD, OLDER, 'artifact-retention-20261020.json', 'notes', OLD.upper()]
        _, artifacts = module.plan([], names, {CURRENT, PREVIOUS})
        self.assertEqual(artifacts, [OLD, OLDER])

    def test_refuses_to_run_without_a_valid_live_release(self):
        for current in ('', 'latest', CURRENT[:-1], CURRENT.upper()):
            with self.assertRaises(ValueError):
                module.keep_set(current, PREVIOUS)

    def test_a_previous_release_that_is_not_a_commit_keeps_only_the_live_one(self):
        self.assertEqual(module.keep_set(CURRENT, '20261007'), {CURRENT})
        self.assertEqual(module.keep_set(CURRENT, PREVIOUS), {CURRENT, PREVIOUS})


class RunTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name) / 'artifacts'
        self.root.mkdir()
        for name in (CURRENT, PREVIOUS, OLD):
            (self.root / name).mkdir()
            (self.root / name / 'images.tar').write_bytes(b'fixture')
        self.outside = Path(self.temp.name) / 'outside'
        self.outside.mkdir()
        (self.outside / 'keep.txt').write_text('must survive')
        # Windows without developer mode cannot create links; CI on Linux always covers this case.
        try:
            (self.root / OLDER).symlink_to(self.outside, target_is_directory=True)
            self.linked = True
        except OSError:
            self.linked = False
        self.calls = []

    def tearDown(self):
        self.temp.cleanup()

    def run_docker(self, args, **kwargs):
        self.calls.append(args)
        if args[:3] == ['docker', 'image', 'ls']:
            return subprocess.CompletedProcess(args, 0, stdout='\n'.join(IMAGES) + '\n')
        # An image a container still uses is refused by Docker; cleanup carries on.
        return subprocess.CompletedProcess(args, 1 if args[-1].endswith(OLD) and 'web' in args[-1] else 0, stdout='')

    def test_removes_old_images_without_force_and_old_packages_but_follows_no_links(self):
        module.cleanup(CURRENT, PREVIOUS, run=self.run_docker, artifacts_root=self.root)
        removals = [args for args in self.calls if args[:3] == ['docker', 'image', 'rm']]
        self.assertEqual([args[-1] for args in removals], [f'jaxson-web:{OLD}', f'jaxson-portfolio:{OLD}', f'jaxson-web:{OLDER}'])
        for args in removals:
            self.assertNotIn('-f', args)
            self.assertNotIn('--force', args)
        left = [CURRENT, PREVIOUS, OLDER] if self.linked else [CURRENT, PREVIOUS]
        self.assertEqual(sorted(path.name for path in self.root.iterdir()), sorted(left))
        self.assertEqual((self.outside / 'keep.txt').read_text(), 'must survive')


class DeployWiringTests(unittest.TestCase):
    def test_cleanup_runs_only_after_a_healthy_release_and_never_fails_it(self):
        script = (ROOT / 'docker/deploy-vps-existing.sh').read_text(encoding='utf-8')
        finished = script.index('finished=1')
        cleanup = script.index('release_retention.py')
        healthy = script.index('Release healthy:')
        self.assertLess(finished, cleanup)
        self.assertLess(cleanup, healthy)
        line = next(line for line in script.splitlines() if 'release_retention.py' in line)
        self.assertRegex(line, r'"\$commit" "\$\(basename -- "\$old_release"\)"')
        self.assertIn('||', line)

    def test_the_release_ships_the_cleanup_tool(self):
        workflow = (ROOT / '.github/workflows/deploy.yml').read_text(encoding='utf-8')
        copy = re.search(r'^\s+cp docker/lib/release\.sh .*release-artifact/tools/lib/$', workflow, re.MULTILINE)
        self.assertIsNotNone(copy)
        self.assertIn('docker/lib/release_retention.py', copy.group())


if __name__ == '__main__':
    unittest.main()
