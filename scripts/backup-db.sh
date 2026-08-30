#!/usr/bin/env bash
# =========================================================================
# Jaxson AI Space Automated Database Backup & AES-256 Encryption Script
# Backs up PostgreSQL 17 database, encrypts with OpenSSL, and retains 30 days.
# =========================================================================

set -euo pipefail
umask 077

# Configuration
BACKUP_DIR="${BACKUP_DIR:-/var/backups/jaxson_space}"
DATE_TAG=$(date +"%Y%m%d_%H%M%S")
DUMP_FILE="${BACKUP_DIR}/jaxson_space_${DATE_TAG}.sql.gz"
ENC_FILE="${DUMP_FILE}.enc"
CONTAINER_NAME="jaxson-postgres-prod"
DB_USER="jaxson_admin"
DB_NAME="jaxson_space"

if [ -z "${BACKUP_ENCRYPTION_KEY:-}" ]; then
  echo "❌ Error: BACKUP_ENCRYPTION_KEY environment variable is mandatory for encrypting production backups." >&2
  exit 1
fi
BACKUP_PASSWORD="${BACKUP_ENCRYPTION_KEY}"

mkdir -p "${BACKUP_DIR}"

echo "[$(date)] 🚀 Starting database backup for ${DB_NAME}..."

# 1. Export database dump using pg_dump inside container and compress with gzip
docker exec "${CONTAINER_NAME}" pg_dump -U "${DB_USER}" -d "${DB_NAME}" | gzip > "${DUMP_FILE}"

echo "[$(date)] 🔒 Encrypting backup with OpenSSL AES-256-CBC..."
# 2. Encrypt with OpenSSL AES-256
openssl enc -aes-256-cbc -salt -pbkdf2 -iter 100000 \
  -in "${DUMP_FILE}" \
  -out "${ENC_FILE}" \
  -pass "pass:${BACKUP_PASSWORD}"

# Remove unencrypted dump file
rm -f "${DUMP_FILE}"

echo "[$(date)] ✅ Backup successfully encrypted: ${ENC_FILE}"

# 3. Optional: Sync to S3 / Cloudflare R2 if rclone / aws-cli is configured
if command -v rclone &> /dev/null; then
  echo "[$(date)] ☁️ Uploading to Cloudflare R2..."
  rclone copy "${ENC_FILE}" "r2:jaxson-space-backups/"
fi

# 4. Retain only last 30 days of local backups
find "${BACKUP_DIR}" -type f -name "*.enc" -mtime +30 -delete
echo "[$(date)] 🧹 Cleaned up backups older than 30 days."
