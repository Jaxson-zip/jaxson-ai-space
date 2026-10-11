#!/usr/bin/env python3
"""Root installation, preserving original SSH keys and backup service settings."""
import datetime as dt
import os
from pathlib import Path
import shutil
import subprocess

if os.geteuid() != 0:
    raise SystemExit('Root required')
os.umask(0o077)
ops = Path('/opt/jaxson-ops')
before = ops / ('install-backup-' + dt.datetime.now(dt.timezone.utc).strftime('%Y%m%dT%H%M%SZ'))
before.mkdir(mode=0o700)
# Use a dedicated authorized-keys file so enabling public-key login cannot
# activate unrelated legacy root keys. Existing password access is preserved.
keyfile = Path('/root/.ssh/jaxson-backup-authorized_keys')
if not keyfile.exists():
    subprocess.run(['python3', str(ops / 'current/enable-backup-key.py')], check=True)
dropdir = Path('/etc/systemd/system/jaxson-vps-backup.service.d')
dropdir.mkdir(exist_ok=True)
drop = dropdir / 'private-export.conf'
if drop.exists():
    shutil.copyfile(drop, before / 'private-export.conf')
drop.write_text('[Service]\nExecStartPost=/bin/sh /opt/jaxson-ops/current/export-private-backup.sh\n', encoding='utf8')
subprocess.run(['systemctl', 'daemon-reload'], check=True)
subprocess.run(['sshd', '-t'], check=True)
print('Installed restricted encrypted export and backup post-step; originals preserved.')
