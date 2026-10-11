#!/bin/sh
set -eu
. "$(dirname -- "$0")/lib/compose.sh"
backup_root=${1:-"$repo_dir/backups"}
umask 077
mkdir -p "$backup_root"
snapshot=$(mktemp -d "$backup_root/backup-$(date -u +%Y%m%dT%H%M%SZ)-XXXXXX")
paused=0
resume() {
  if [ "$paused" = 1 ]; then compose start web worker >&2 || true; fi
}
trap resume EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
touch "$snapshot/INCOMPLETE"
compose exec -T postgres pg_isready -U jaxson_admin -d jaxson_space >/dev/null
project_name=$(selected_project)
paused=1
compose stop web worker >&2
compose exec -T postgres pg_dump -Fc -U jaxson_admin -d jaxson_space > "$snapshot/database.dump"
test -s "$snapshot/database.dump"
compose run --rm -T --no-deps --entrypoint tar web -czf - -C /app/media . > "$snapshot/media.tar.gz"
test -s "$snapshot/media.tar.gz"
printf 'version=1\ncreated_at=%s\nproject=%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$project_name" > "$snapshot/metadata.txt"
(cd "$snapshot" && sha256sum database.dump media.tar.gz metadata.txt > SHA256SUMS)
mv "$snapshot/INCOMPLETE" "$snapshot/COMPLETE"
printf '%s\n' "$snapshot"
