#!/bin/sh
# Backup the release while preserving the VPS's externally managed PostgreSQL.
set -eu
umask 077
. "$(dirname -- "$0")/lib/release.sh"
validate_scope
operation_lock
backup_root=${JAXSON_BACKUP_ROOT:-/var/backups/jaxson-ai-space}
[ ! -f "$release/images.override.yaml" ] || die 'Consolidate image overrides into compose.yaml before backing up'
mkdir -p "$backup_root"
snapshot=$(mktemp -d "$backup_root/release-$(date -u +%Y%m%dT%H%M%SZ)-XXXXXX")
paused=0
resume() {
  status=$?
  trap - EXIT
  if [ "$paused" = 1 ]; then
    # The CMS health check includes a 60s start period and repeated 30s probes.
    # Keep a bounded recovery wait that covers cold route/database initialization.
    if ! compose start --wait --wait-timeout 300 web worker >/dev/null; then
      printf '%s\n' 'Backup service recovery failed; check web/worker health' >&2
      status=1
    fi
  fi
  exit "$status"
}
trap resume EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
touch "$snapshot/INCOMPLETE"
paused=1
compose stop web worker >/dev/null
docker exec jaxson-postgres-prod pg_dump -Fc -U jaxson_admin -d "$db" > "$snapshot/database.dump"
test -s "$snapshot/database.dump"
docker exec -i jaxson-postgres-prod pg_restore -l < "$snapshot/database.dump" > "$snapshot/database-contents.txt"
tar -czf "$snapshot/media.tar.gz" -C "$release/media" .
tar -czf "$snapshot/config.tar.gz" -C "$release" production.env compose.yaml Caddyfile
docker exec jaxson-postgres-prod pg_dumpall -U jaxson_admin --globals-only > "$snapshot/database-roles.sql"
printf 'database=%s\nrelease=%s\ncreated_at=%s\n' "$db" "$(readlink -f "$release")" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$snapshot/metadata.txt"
(cd "$snapshot" && sha256sum database.dump media.tar.gz config.tar.gz database-roles.sql metadata.txt > SHA256SUMS && sha256sum -c SHA256SUMS >/dev/null)
mv "$snapshot/INCOMPLETE" "$snapshot/COMPLETE"
python3 "$validator" verify "$snapshot" --database "$db" --release "$release" >/dev/null
printf '%s\n' "$snapshot" > "$backup_root/latest-release.path"
printf '%s\n' "$snapshot"
