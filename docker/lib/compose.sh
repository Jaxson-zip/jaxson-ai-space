#!/bin/sh
set -eu
repo_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$repo_dir"
ENV_FILE=${ENV_FILE:-docker/.env.production}
test -f "$ENV_FILE" || { echo "Missing environment file: $ENV_FILE" >&2; exit 1; }
compose() {
  if [ -n "${COMPOSE_OVERRIDE:-}" ]; then
    docker compose --env-file "$ENV_FILE" -f docker/compose.prod.yaml -f "$COMPOSE_OVERRIDE" "$@"
  else
    docker compose --env-file "$ENV_FILE" -f docker/compose.prod.yaml "$@"
  fi
}
selected_project() {
  postgres_id=$(compose ps -q postgres)
  test -n "$postgres_id" || { echo 'Start PostgreSQL before backup or restore' >&2; return 1; }
  docker inspect --format '{{index .Config.Labels "com.docker.compose.project"}}' "$postgres_id"
}
