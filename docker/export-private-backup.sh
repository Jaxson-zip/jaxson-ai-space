#!/bin/sh
set -eu
umask 077
OPS=/opt/jaxson-ops/current
STORE=/var/backups/jaxson-private-export
[ "$(id -u)" = 0 ] || exit 77
mkdir -p "$STORE"
chmod 700 "$STORE"
exec 9>/run/lock/jaxson-private-export.lock
flock -n 9 || exit 75
SOURCE=$(cat /var/backups/jaxson-ai-space/latest-release.path)
case "$SOURCE" in /var/backups/jaxson-ai-space/release-*) ;; *) exit 64 ;; esac
python3 "$OPS/lib/release_snapshot.py" verify "$SOURCE" --database jaxson_release_20261007 --max-age 129600 >/dev/null
python3 "$OPS/create-private-export.py" "$SOURCE"
