#!/usr/bin/env python3
"""After a healthy release, keep only the live and rollback releases' images and uploaded packages.

Only `jaxson-web:<commit>` / `jaxson-portfolio:<commit>` tags and `artifacts/<commit>` directories are
considered; other services' images, hand-tagged builds, backups and release directories are never touched.
Images are removed without force, so Docker refuses any image a container still uses.
"""
from pathlib import Path
import re
import shutil
import subprocess
import sys

COMMIT = re.compile(r'[a-f0-9]{40}')
RELEASE_IMAGE = re.compile(r'jaxson-(?:web|portfolio):([a-f0-9]{40})')
ARTIFACTS = Path('/opt/jaxson-releases/artifacts')


def keep_set(current, previous):
    if not COMMIT.fullmatch(current):
        raise ValueError('The live release must be a commit')
    return {current, previous} if COMMIT.fullmatch(previous) else {current}


def plan(images, artifact_names, keep):
    remove_images = [ref for ref in images if (match := RELEASE_IMAGE.fullmatch(ref)) and match.group(1) not in keep]
    remove_artifacts = [name for name in artifact_names if COMMIT.fullmatch(name) and name not in keep]
    return remove_images, remove_artifacts


def cleanup(current, previous, run=subprocess.run, artifacts_root=ARTIFACTS):
    keep = keep_set(current, previous)
    listed = run(['docker', 'image', 'ls', '--format', '{{.Repository}}:{{.Tag}}'], capture_output=True, text=True, check=True)
    names = sorted(path.name for path in artifacts_root.iterdir()) if artifacts_root.is_dir() else []
    images, artifacts = plan(listed.stdout.split(), names, keep)
    for ref in images:
        result = run(['docker', 'image', 'rm', ref], capture_output=True, text=True)
        print(f'{"removed" if result.returncode == 0 else "kept (in use)"} {ref}', file=sys.stderr)
    for name in artifacts:
        path = artifacts_root / name
        # A link could point anywhere; only real package directories are removed.
        if path.is_dir() and not path.is_symlink():
            shutil.rmtree(path)
            print(f'removed package {name}', file=sys.stderr)


if __name__ == '__main__':
    try:
        cleanup(*sys.argv[1:3])
    except (ValueError, TypeError, OSError, subprocess.CalledProcessError) as error:
        sys.exit(f'Release cleanup skipped: {error}')
