#!/usr/bin/env bash
# =========================================================================
# Jaxson AI Space Database Restore Script
# Decrypts AES-256 backup and restores into PostgreSQL database.
# =========================================================================

set -euo pipefail
umask 077

if [ "$#" -ne 1 ]; then
    echo "Usage: $0 <path-to-encrypted-backup-file.sql.gz.enc>"
    exit 1
fi

ENC_FILE="$1"
CONTAINER_NAME="jaxson-postgres-prod"
DB_USER="jaxson_admin"
DB_NAME="jaxson_space"

if [ -z "${BACKUP_ENCRYPTION_KEY:-}" ]; then
  echo "❌ Error: BACKUP_ENCRYPTION_KEY environment variable is mandatory for decrypting backups." >&2
  exit 1
fi
BACKUP_PASSWORD="${BACKUP_ENCRYPTION_KEY}"
TEMP_DUMP="/tmp/restore_dump.sql.gz"

echo "🔓 Decrypting ${ENC_FILE}..."
openssl enc -d -aes-256-cbc -pbkdf2 -iter 100000 \
  -in "${ENC_FILE}" \
  -out "${TEMP_DUMP}" \
  -pass "pass:${BACKUP_PASSWORD}"

echo "🔄 Restoring into container ${CONTAINER_NAME}..."
gunzip -c "${TEMP_DUMP}" | docker exec -i "${CONTAINER_NAME}" psql -U "${DB_USER}" -d "${DB_NAME}"

rm -f "${TEMP_DUMP}"
echo "✅ Database restored successfully!"
