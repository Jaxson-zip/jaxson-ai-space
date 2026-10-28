#!/bin/sh
# Common functions for the existing VPS release layout. No env file is sourced.
release_tools=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
validator="$release_tools/lib/release_snapshot.py"
release_root=/opt/jaxson-releases
release=${JAXSON_RELEASE_DIR:-$release_root/current}
db=${JAXSON_DATABASE:-jaxson_release_20261007}
postgres=jaxson-postgres-prod
admin=jaxson_admin
owner=release_owner_20261007
reader=release_reader_20261007
die() { printf '%s\n' "$*" >&2; exit 1; }
validate_scope() {
  [ "$(id -u)" = 0 ] || die 'Run mutation commands as root'
  [ "$db" = jaxson_release_20261007 ] || die 'Only the established release database is supported'
  release=$(readlink -f -- "$release")
  case "$release" in "$release_root"/*) ;; *) die 'Release is outside /opt/jaxson-releases';; esac
  [ "$release" != "$release_root/current" ] || die 'Current release link did not resolve'
  [ -f "$release/compose.yaml" ] && [ ! -L "$release/compose.yaml" ] || die 'Missing regular compose.yaml'
  [ -f "$release/production.env" ] && [ ! -L "$release/production.env" ] || die 'Missing regular production.env'
  [ "$(stat -c '%u:%a' "$release/production.env")" = 0:600 ] || die 'production.env must be owned by root with mode 600'
}
compose_at() {
  selected=$1
  shift
  if [ -f "$selected/images.override.yaml" ]; then
    docker compose -p jaxson-release --project-directory "$selected" --env-file "$selected/production.env" -f "$selected/compose.yaml" -f "$selected/images.override.yaml" "$@"
  else
    docker compose -p jaxson-release --project-directory "$selected" --env-file "$selected/production.env" -f "$selected/compose.yaml" "$@"
  fi
}
compose() { compose_at "$release" "$@"; }
operation_lock() {
  if [ "${JAXSON_OPERATION_LOCK_HELD:-0}" != 1 ]; then
    exec 8>/run/lock/jaxson-release-operation.lock
    flock -n 8 || die 'A release operation is already running'
    export JAXSON_OPERATION_LOCK_HELD=1
  fi
}
reader_path() {
  docker exec -i "$postgres" psql -X -v ON_ERROR_STOP=1 -U "$admin" -d "$db" <<SQL
ALTER ROLE $reader IN DATABASE $db SET search_path TO public_read, public;
SQL
}
health() {
  compose up -d --no-deps --wait --wait-timeout 180 web worker portfolio caddy >&2
  curl --fail --silent --show-error --max-time 15 http://127.0.0.1:3000/api/showcase-projects >/dev/null
  curl --fail --silent --show-error --max-time 15 http://127.0.0.1:39000/ >/dev/null
  # Supply the checker from this artifact: rollback images predate this file.
  compose exec -T web node --input-type=module - < "$release_tools/lib/check-public-health.mjs" >&2
  compose exec -T worker node apps/web/scripts/run-index-worker.mjs --health >&2
}
