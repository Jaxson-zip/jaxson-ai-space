#!/usr/bin/env python3
"""Prepare a private Compose candidate from the established live release."""
import json
import re
from pathlib import Path
import sys
from release_snapshot import artifact, fail

source, candidate, bundle, base_config = map(Path, sys.argv[1:5])
web_runtime, portfolio_runtime = sys.argv[5:]
if not all(re.fullmatch(r'sha256:[a-f0-9]{64}', value) for value in (web_runtime, portfolio_runtime)):
    fail('Runtime image references must be immutable digests')
metadata = artifact(bundle)
config = json.loads(base_config.read_text())
if set(config['services']) != {'web', 'worker', 'portfolio', 'caddy'}:
    fail('Unexpected service scope')
for service in ('web', 'worker'):
    config['services'][service]['image'] = web_runtime
    config['services'][service]['env_file'] = [{'path': str(candidate / 'production.env'), 'required': True}]
config['services']['portfolio']['image'] = portfolio_runtime
for volume in config['services']['caddy'].get('volumes', []):
    if volume.get('target') == '/etc/caddy/Caddyfile':
        volume['source'] = str(candidate / 'Caddyfile')
media = (source / 'media').resolve(strict=True)
if media.name != 'media' or '/opt/jaxson-releases' not in [str(path) for path in media.parents]:
    fail('Media is outside the release scope')
config['name'] = 'jaxson-release'
(candidate / 'compose.yaml').write_text(json.dumps(config, indent=2) + '\n')
(candidate / 'compose.yaml').chmod(0o600)
(candidate / 'media').symlink_to(media, target_is_directory=True)
