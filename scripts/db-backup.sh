#!/bin/sh
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/backups}"
DB_HOST="${DB_HOST:-postgres}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-oclushion}"
DB_USER="${POSTGRES_USER:?required}"
DB_PASS="${POSTGRES_PASSWORD:?required}"
KEEP_DAYS="${BACKUP_KEEP_DAYS:-7}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
FILENAME="oclushion_${DB_NAME}_${TIMESTAMP}.sql.gz"
LOCAL_PATH="${BACKUP_DIR}/${FILENAME}"

export PGPASSWORD="$DB_PASS"

echo "[Backup] Starting backup of ${DB_NAME}@${DB_HOST}:${DB_PORT}"

pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
  --no-owner --no-acl \
  --format=custom \
  --compress=9 \
  --file="$LOCAL_PATH"

echo "[Backup] Backup saved: ${LOCAL_PATH}"
echo "[Backup] Size: $(wc -c < "$LOCAL_PATH") bytes"

if [ -n "${BACKUP_AWS_S3_BUCKET:-}" ]; then
  echo "[Backup] Uploading to S3: s3://${BACKUP_AWS_S3_BUCKET}/database/${FILENAME}"
  aws s3 cp "$LOCAL_PATH" "s3://${BACKUP_AWS_S3_BUCKET}/database/${FILENAME}" \
    --region "${BACKUP_AWS_REGION:-us-east-1}"
  echo "[Backup] S3 upload complete"
fi

find "$BACKUP_DIR" -name "oclushion_${DB_NAME}_*.sql.gz" -type f -mtime +"$KEEP_DAYS" -delete
echo "[Backup] Removed backups older than ${KEEP_DAYS} days"

echo "[Backup] Complete"
