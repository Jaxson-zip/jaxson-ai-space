#!/bin/sh
# Verified immutable images; existing VPS database and unrelated services stay scoped.
set -eu
umask 077
. "$(dirname -- "$0")/lib/release.sh"
bundle=${1:-}
mode=${2:---verify}
[ -n "$bundle" ] || die 'Usage: deploy-vps-existing.sh ARTIFACT_DIRECTORY [--verify | --apply]'
[ "$mode" = --verify ] || [ "$mode" = --apply ] || die 'Invalid deploy mode'
artifact_info=$(python3 "$validator" artifact "$bundle")
validate_scope
operation_lock
commit=$(printf '%s' "$artifact_info" | python3 -c 'import json,sys; print(json.load(sys.stdin)["release_id"])')
web_image=$(printf '%s' "$artifact_info" | python3 -c 'import json,sys; print(json.load(sys.stdin)["web_image"])')
portfolio_image=$(printf '%s' "$artifact_info" | python3 -c 'import json,sys; print(json.load(sys.stdin)["portfolio_image"])')
# Gate schema changes before starting an image that could automatically migrate.
applied=$(mktemp)
expected=$(mktemp)
trap 'rm -f -- "$applied" "$expected"' EXIT
docker exec "$postgres" psql -X -At -v ON_ERROR_STOP=1 -U "$admin" -d "$db" -c 'SELECT name FROM owner.payload_migrations ORDER BY name' > "$applied"
printf '%s' "$artifact_info" | python3 -c 'import json,sys; print("\n".join(json.load(sys.stdin)["migrations"]))' | sort > "$expected"
sort -o "$applied" "$applied"
cmp -s "$applied" "$expected" || die 'Migration history differs: prepare a reviewed database migration and recovery plan before deployment'
[ "$mode" != --verify ] || { printf '%s\n' 'Artifact, release scope and migration history verified; no images or services changed'; exit 0; }
[ "$(readlink -f "$release_root/current")" = "$release" ] || die 'Deploy must start from the current release'
candidate="$release_root/$commit"
[ ! -e "$candidate" ] && [ ! -L "$candidate" ] || die 'Candidate release already exists; use a new committed artifact'
backup=$(JAXSON_RELEASE_DIR="$release" sh "$release_tools/backup-vps-existing.sh")
python3 "$validator" verify "$backup" --database "$db" --release "$release" --max-age "$((health_wait + 300))" >&2
docker load -i "$bundle/images.tar" >/dev/null
web_runtime=$(python3 "$release_tools/lib/release_images.py" "jaxson-web:$commit" "$web_image")
portfolio_runtime=$(python3 "$release_tools/lib/release_images.py" "jaxson-portfolio:$commit" "$portfolio_image")
mkdir -m 700 "$candidate"
cp -- "$release/production.env" "$candidate/production.env"
cp -- "$release/Caddyfile" "$candidate/Caddyfile"
chmod 600 "$candidate/production.env" "$candidate/Caddyfile"
compose config --no-env-resolution --format json > "$candidate/base-compose.json"
python3 "$release_tools/lib/release_candidate.py" "$release" "$candidate" "$bundle" "$candidate/base-compose.json" "$web_runtime" "$portfolio_runtime"
rm -f -- "$candidate/base-compose.json"
cp -- "$bundle/artifact.json" "$candidate/artifact.json"
compose_at "$candidate" config --quiet
old_release=$release
activated=0
finished=0
link_tmp="$release_root/.current-$$"
tools_link_tmp="/opt/jaxson-release-tools/.current-$$"
recover() {
  status=$?
  trap - EXIT
  rm -f -- "$applied" "$expected" "$link_tmp" "$tools_link_tmp"
  if [ "$activated" = 1 ] && [ "$finished" != 1 ]; then
    printf '%s\n' "Health check failed; rolling back to $old_release. Backup: $backup" >&2
    ln -s "$old_release" "$link_tmp"
    mv -Tf -- "$link_tmp" "$release_root/current"
    release=$old_release
    health || status=1
  fi
  exit "$status"
}
trap recover EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
activated=1
ln -s "$candidate" "$link_tmp"
mv -Tf -- "$link_tmp" "$release_root/current"
release=$candidate
reader_path >&2
health
mkdir -p /opt/jaxson-release-tools
ln -s "$release_tools" "$tools_link_tmp"
mv -Tf -- "$tools_link_tmp" /opt/jaxson-release-tools/current
finished=1
# Every release adds about 4.6 GB of images and packages; keep only the live and rollback ones.
python3 "$release_tools/lib/release_retention.py" "$commit" "$(basename -- "$old_release")" >&2 || printf '%s\n' 'Old release cleanup failed; the release itself is healthy' >&2
printf '%s\n' "Release healthy: $candidate; rollback release: $old_release; complete backup: $backup"
