import datetime as dt
import os
from pathlib import Path
import shutil
import subprocess

os.umask(0o077)
ops = Path('/opt/jaxson-ops')
config = Path('/etc/ssh/sshd_config')
if 'Include /etc/ssh/sshd_config.d/*.conf' not in config.read_text():
    raise RuntimeError('Expected default SSH include layout')
public = (ops / 'backup-download.pub').read_text(encoding='ascii').strip()
if not public.startswith('ssh-ed25519 ') or len(public.split()) != 3:
    raise RuntimeError('Invalid key')
before = ops / ('ssh-backup-' + dt.datetime.now(dt.timezone.utc).strftime('%Y%m%dT%H%M%SZ'))
before.mkdir(mode=0o700)
drop = Path('/etc/ssh/sshd_config.d/01-jaxson-backup-key.conf')
keyfile = Path('/root/.ssh/jaxson-backup-authorized_keys')
if drop.exists() or keyfile.exists():
    raise RuntimeError('Backup-key configuration already exists')
shutil.copyfile(config, before / 'sshd_config')
keyfile.write_text('restrict,command="/usr/bin/python3 /opt/jaxson-ops/current/serve-private-backup.py" ' + public + '\n', encoding='ascii')
keyfile.chmod(0o600)
drop.write_text('Match User root\n    PubkeyAuthentication yes\n    AuthorizedKeysFile .ssh/jaxson-backup-authorized_keys\nMatch all\n', encoding='ascii')
try:
    subprocess.run(['sshd', '-t'], check=True)
    effective = subprocess.check_output(['sshd', '-T', '-C', 'user=root,addr=127.0.0.1,host=localhost'], text=True)
    if 'pubkeyauthentication yes\n' not in effective or 'authorizedkeysfile .ssh/jaxson-backup-authorized_keys\n' not in effective:
        raise RuntimeError('SSH restrictions not effective')
    subprocess.run(['systemctl', 'reload', 'ssh'], check=True)
except Exception:
    drop.unlink()
    keyfile.unlink()
    subprocess.run(['systemctl', 'reload', 'ssh'])
    raise
print('Only the restricted backup key is enabled for root public-key authentication; password login preserved.')
