#!/usr/bin/env python3
"""Prepare an isolated, initially closed gateway. Never copy AI provider keys."""
import json
import os
import secrets
from pathlib import Path

base = Path('/opt/jaxson-openclaw')
state = base / 'state'
state.mkdir(mode=0o700, exist_ok=True)
config = state / 'openclaw.json'
if config.exists():
    raise SystemExit('Configuration already exists; refusing to overwrite account state.')
data = {
    'gateway': {'mode': 'local', 'bind': 'lan', 'port': 18789,
                'auth': {'mode': 'token', 'token': secrets.token_hex(32)},
                'controlUi': {'enabled': False}},
    'session': {'dmScope': 'per-account-channel-peer'},
    'agents': {'defaults': {'heartbeat': {'every': '0m'}}},
    'browser': {'enabled': False},
    'cron': {'enabled': False},
    'update': {'checkOnStart': False, 'auto': {'enabled': False}},
    'models': {'catalogRefresh': {'enabled': False}},
    'tools': {'deny': ['*'], 'elevated': {'enabled': False}},
    'commands': {'native': False, 'nativeSkills': False, 'text': False,
                 'bash': False, 'config': False, 'plugins': False, 'debug': False, 'restart': False},
    'plugins': {'allow': ['jaxson-inbox'], 'slots': {'memory': 'none'}},
}
config.write_text(json.dumps(data, indent=2) + '\n')
config.chmod(0o600)
os.chown(state, 1000, 1000)
os.chown(config, 1000, 1000)
private_env = base / 'inbox.env'
if private_env.exists():
    raise SystemExit('inbox.env already exists; refusing to overwrite secrets.')
private_env.write_text('SPACE_BOT_BASE_URL=https://api.jaxson.bond\nSTUDIO_INBOX_ALLOWED_IDENTITIES=[]\n')
private_env.chmod(0o600)
print(json.dumps({'prepared': True, 'private_ingestion': 'closed', 'provider_keys_copied': False}))
