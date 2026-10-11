#!/bin/sh
# Default: inspect a snapshot. Rehearsal never connects to the live PostgreSQL.
set -eu
umask 077
. "$(dirname -- "$0")/lib/release.sh"
mode=verify
snapshot=
confirm_db=
confirm_release=
while [ "$#" -gt 0 ]; do
  case "$1" in
    --verify) mode=verify; shift;;
    --rehearse) mode=rehearse; shift;;
    --apply) mode=apply; shift;;
    --confirm-database) [ "$#" -ge 2 ] || die 'Missing database confirmation'; confirm_db=$2; shift 2;;
    --confirm-release) [ "$#" -ge 2 ] || die 'Missing release confirmation'; confirm_release=$2; shift 2;;
    --*) die "Unknown option: $1";;
    *) [ -z "$snapshot" ] || die 'Specify one snapshot'; snapshot=$1; shift;;
  esac
done
[ -n "$snapshot" ] || die 'Usage: restore-vps-existing.sh SNAPSHOT [--verify | --rehearse | --apply --confirm-database DATABASE --confirm-release /opt/jaxson-releases/ID]'
python3 "$validator" verify "$snapshot" --database "$db" >&2
snapshot=$(CDPATH= cd -- "$snapshot" && pwd)
[ "$mode" != verify ] || { printf '%s\n' 'Snapshot verified; no database/config/media was changed'; exit 0; }

if [ "$mode" = rehearse ]; then
  work=$(mktemp -d)
  rehearsal="jaxson-restore-rehearsal-$(date +%s)-$$"
  cleanup() { docker rm -fv "$rehearsal" >/dev/null 2>&1 || true; rm -rf -- "$work"; }
  trap cleanup EXIT
  trap 'exit 130' INT
  trap 'exit 143' TERM
  mkdir "$work/media"
  python3 "$validator" extract-media "$snapshot" --destination "$work/media"
  # No published ports, external network, host paths or production credentials.
  docker run -d --name "$rehearsal" --network none --memory 256m --cpus 1 --label jaxson.operation=restore-rehearsal \
    -e POSTGRES_HOST_AUTH_METHOD=trust -e POSTGRES_DB=jaxson_rehearsal \
    "${JAXSON_REHEARSAL_IMAGE:-pgvector/pgvector:pg17}" >/dev/null
  attempt=0
  # The initialization server accepts Unix sockets then restarts. Wait for final TCP readiness.
  until docker exec "$rehearsal" pg_isready -h 127.0.0.1 -U postgres -d jaxson_rehearsal >/dev/null 2>&1; do
    attempt=$((attempt + 1)); [ "$attempt" -lt 60 ] || die 'Rehearsal PostgreSQL was not ready'; sleep 1
  done
  docker exec -i "$rehearsal" pg_restore --no-owner --no-privileges --exit-on-error --single-transaction -U postgres -d jaxson_rehearsal < "$snapshot/database.dump"
  docker exec -i "$rehearsal" psql -X -v ON_ERROR_STOP=1 -U postgres -d jaxson_rehearsal <<SQL
CREATE ROLE $reader NOLOGIN;
ALTER ROLE $reader IN DATABASE jaxson_rehearsal SET search_path TO public_read, public;
GRANT USAGE ON SCHEMA public_read TO $reader;
GRANT SELECT ON ALL TABLES IN SCHEMA public_read TO $reader;
SELECT nspname FROM pg_namespace WHERE nspname IN ('owner','public_read','public') ORDER BY nspname;
SELECT extname FROM pg_extension ORDER BY extname;
SELECT count(*) AS restored_projects FROM owner.projects;
SELECT count(*) AS restored_knowledge FROM owner.ai_knowledge;
SET ROLE $reader;
SET search_path TO public_read, public;
SELECT count(*) AS restored_vectors, count(embedding <=> embedding) AS valid_vector_distances FROM knowledge_embeddings WHERE is_active;
DO \$\$ BEGIN
  PERFORM count(*) FROM owner.users;
  RAISE EXCEPTION 'Reader unexpectedly accessed private schema';
EXCEPTION WHEN insufficient_privilege THEN NULL;
END \$\$;
RESET ROLE;
SQL
  printf '%s\n' 'Isolated database/media rehearsal passed; temporary container/media removed on exit; live config and global roles were not applied'
  exit 0
fi

validate_scope
[ "$confirm_db" = "$db" ] && [ "$confirm_release" = "$release" ] || die 'Apply requires exact current database and resolved release confirmations'
[ "$(readlink -f "$release_root/current")" = "$release" ] || die 'Apply must target the current release'
python3 "$validator" verify "$snapshot" --database "$db" --release "$release" >&2
operation_lock
docker exec -i "$postgres" pg_restore --list < "$snapshot/database.dump" >/dev/null
# Verify required existing roles; global role dumps are for manual review only.
count=$(docker exec "$postgres" psql -X -At -U "$admin" -d "$db" -c "SELECT count(*) FROM pg_roles WHERE rolname IN ('$owner','$reader')")
[ "$count" = 2 ] || die 'Dedicated release roles are missing; do not replay global roles automatically'
fresh=$(JAXSON_RELEASE_DIR="$release" sh "$release_tools/backup-vps-existing.sh")
python3 "$validator" verify "$fresh" --database "$db" --release "$release" --max-age 300 >&2
media=$(readlink -f "$release/media")
case "$media" in "$release_root"/*/media) ;; *) die 'Media directory is outside the release tree';; esac
[ -d "$media" ] || die 'Missing media directory'
staged=$(mktemp -d "${media}.restore-XXXXXX")
python3 "$validator" extract-media "$snapshot" --destination "$staged"
chown -R --reference="$media" "$staged"
chmod --reference="$media" "$staged"
old_media="${staged}.before"
paused=0
db_changed=0
media_swapped=0
finished=0
recover() {
  status=$?
  trap - EXIT
  if [ "$finished" != 1 ] && [ "$db_changed" = 1 ]; then
    printf '%s\n' "Restore failed; recovering database from $fresh" >&2
    docker exec -i "$postgres" pg_restore --clean --if-exists --exit-on-error --single-transaction -U "$admin" -d "$db" < "$fresh/database.dump" >&2 || status=1
    reader_path >&2 || status=1
  fi
  if [ "$finished" != 1 ] && [ "$media_swapped" = 1 ]; then
    mv -- "$media" "$staged.failed" || status=1
    mv -- "$old_media" "$media" || status=1
  fi
  if [ "$paused" = 1 ]; then compose start web worker >&2 || status=1; fi
  [ ! -d "$staged" ] || rm -rf -- "$staged"
  exit "$status"
}
trap recover EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
paused=1
compose stop web worker >&2
# Each dump replacement is transactional; only this database is addressed.
docker exec -i "$postgres" pg_restore --clean --if-exists --exit-on-error --single-transaction -U "$admin" -d "$db" < "$snapshot/database.dump"
db_changed=1
reader_path >&2
mv -- "$media" "$old_media"
if ! mv -- "$staged" "$media"; then mv -- "$old_media" "$media"; die 'Unable to install staged media'; fi
media_swapped=1
compose start web worker >&2
health
paused=0
finished=1
printf '%s\n' "Database/media restored and healthy. Recovery backup: $fresh; previous media: $old_media. Config and global roles remain review-only."
