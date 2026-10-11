#!/bin/sh
set -eu
cd /opt/jaxson-openclaw
IMAGE='ghcr.io/openclaw/openclaw:2026.9.8@sha256:d0ded1dd76939b2bf4d67ef2d13247b8b160aa5666331d4a0b0e58811182cbb8'
docker image inspect "$IMAGE" >/dev/null
# No shell execution or provider credentials are available to chat senders.
docker compose run --rm --no-deps --entrypoint node gateway dist/index.js config validate
docker compose run --rm --no-deps --entrypoint node \
  -v /opt/jaxson-openclaw/openclaw-weixin-2.4.9.tgz:/tmp/openclaw-weixin.tgz:ro \
  gateway dist/index.js plugins install /tmp/openclaw-weixin.tgz --force --accept-capabilities
JAXSON_WEIXIN_SOURCE_SHA256=f411870309327b202fb23687970510311869723984463bb7882cfaf234f7582a \
  node /opt/jaxson-openclaw/weixin-admission.mjs
node /opt/jaxson-openclaw/weixin-context.mjs
node /opt/jaxson-openclaw/weixin-inbox-path.mjs
node --check state/extensions/openclaw-weixin/dist/src/messaging/process-message.js
node --check state/extensions/openclaw-weixin/dist/src/messaging/inbound.js
node --check state/extensions/jaxson-inbox/weixin-inbox.mjs
chown -R 1000:1000 state/extensions/openclaw-weixin
python3 - <<'PY'
import json
from pathlib import Path
p = Path('state/openclaw.json')
d = json.loads(p.read_text())
d['plugins']['allow'] = ['jaxson-inbox', 'openclaw-weixin']
d['plugins'].setdefault('entries', {})['jaxson-inbox'] = {'enabled': True, 'hooks': {'allowConversationAccess': True, 'allowPromptInjection': False}}
d['channels'] = {'openclaw-weixin': {'enabled': True, 'replyProgressMessages': False, 'quoteCache': {'enabled': False}}}
p.write_text(json.dumps(d, indent=2) + '\n')
p.chmod(0o600)
PY
docker compose run --rm --no-deps --entrypoint node gateway dist/index.js config validate
docker compose run --rm --no-deps --entrypoint node gateway dist/index.js plugins enable jaxson-inbox --accept-capabilities
docker compose run --rm --no-deps --entrypoint node gateway dist/index.js plugins list
# No live channel starts until the owner completes QR login and admission checks.
printf '%s\n' 'READY_FOR_OWNER_LOGIN'
