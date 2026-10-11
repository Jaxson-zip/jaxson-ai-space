#!/bin/sh
set -eu
. "$(dirname -- "$0")/lib/compose.sh"
test "$#" = 2 && test "$2" = '--confirm-replace' || {
  echo 'Usage: restore.sh <snapshot-directory> --confirm-replace' >&2
  exit 1
}
snapshot=$(CDPATH= cd -- "$1" && pwd)
test -f "$snapshot/COMPLETE" && test ! -f "$snapshot/INCOMPLETE" || { echo 'Snapshot is incomplete' >&2; exit 1; }
test "$(sed -n 's/^version=//p' "$snapshot/metadata.txt")" = 1 || { echo 'Unsupported snapshot version' >&2; exit 1; }
test "$(sed -n 's/^project=//p' "$snapshot/metadata.txt")" = "$(selected_project)" || { echo 'Snapshot belongs to a different Compose project' >&2; exit 1; }
# Use explicit filenames; never trust arbitrary paths listed in a checksum file.
test "$(wc -l < "$snapshot/SHA256SUMS" | tr -d ' ')" = 3 || { echo 'Invalid checksum manifest' >&2; exit 1; }
if grep -Ev '^[a-f0-9]{64}  (database[.]dump|media[.]tar[.]gz|metadata[.]txt)$' "$snapshot/SHA256SUMS" >/dev/null; then
  echo 'Unsafe checksum manifest' >&2; exit 1
fi
for name in database.dump media.tar.gz metadata.txt; do
  test "$(grep -c "  $name$" "$snapshot/SHA256SUMS")" = 1 || { echo 'Duplicate or missing checksum entry' >&2; exit 1; }
done
(cd "$snapshot" && sha256sum -c SHA256SUMS >&2)
archive_paths=$(tar -tzf "$snapshot/media.tar.gz")
if printf '%s\n' "$archive_paths" | grep -E '(^/|(^|/)\.\.(/|$))' >/dev/null; then
  echo 'Unsafe media archive paths' >&2; exit 1
fi
# Only regular files and directories are accepted, never links or special files.
if tar -tvzf "$snapshot/media.tar.gz" | grep -Ev '^[-d]' >/dev/null; then
  echo 'Unsafe media archive file types' >&2; exit 1
fi
running_web=$(compose ps -q web)
test -n "$running_web" || { echo 'Start the existing stack before restoring' >&2; exit 1; }
compose exec -T postgres pg_restore --list < "$snapshot/database.dump" >/dev/null
# Save a recovery point before replacing the selected environment.
sh "$repo_dir/docker/backup.sh" "${BACKUP_ROOT:-$repo_dir/backups}" >&2
paused=0
resume() {
  if [ "$paused" = 1 ]; then compose start web worker >&2 || true; fi
}
trap resume EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
paused=1
compose stop web worker >&2
compose exec -T postgres pg_restore --clean --if-exists --exit-on-error --single-transaction -U jaxson_admin -d jaxson_space < "$snapshot/database.dump"
compose run --rm -T --no-deps --entrypoint sh web -c \
  'test -d /app/media && find /app/media -mindepth 1 -maxdepth 1 -exec rm -rf -- {} + && tar -xzf - -C /app/media' < "$snapshot/media.tar.gz"
compose start web worker >&2
paused=0
compose up -d --no-deps --wait --wait-timeout 180 web worker >&2
echo 'Database and media restored; services healthy'
