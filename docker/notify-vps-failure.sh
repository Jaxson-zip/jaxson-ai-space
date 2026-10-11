#!/bin/sh
set -eu
case "${1:-}" in jaxson-vps-backup.service|--send-test) ;; *) exit 64 ;; esac
TOOLS=/opt/jaxson-release-tools/current
RELEASE=/opt/jaxson-releases/current
WEB=$(docker ps -aq --filter label=com.docker.compose.project=jaxson-release --filter label=com.docker.compose.service=web)
[ "$(printf '%s\n' "$WEB" | wc -l)" -eq 1 ] && [ -n "$WEB" ] || exit 69
IMAGE=$(docker inspect --format '{{.Image}}' "$WEB")
exec timeout 45 docker run --rm --name jaxson-backup-notification --user 0:0 \
  --read-only --cap-drop ALL --security-opt no-new-privileges --pids-limit 32 --memory 128m \
  --log-driver none --entrypoint node \
  --mount "type=bind,src=$RELEASE/production.env,dst=/run/jaxson/production.env,readonly" \
  --mount "type=bind,src=$TOOLS/notify-vps-failure.mjs,dst=/app/docker/notify-vps-failure.mjs,readonly" \
  "$IMAGE" /app/docker/notify-vps-failure.mjs "$1"
