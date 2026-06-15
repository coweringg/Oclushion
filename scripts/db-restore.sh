#!/bin/sh
set -euo pipefail

usage() {
  echo "Usage: $0 <backup-file> [--target-db DB_NAME]"
  echo ""
  echo "Restore a PostgreSQL backup created by db-backup.sh"
  echo ""
  echo "Arguments:"
  echo "  backup-file    Path to the .sql.gz or .dump backup file"
  echo "  --target-db    Target database name (default: oclushion)"
  exit 1
}

BACKUP_FILE="${1:-}"
TARGET_DB="${TARGET_DB:-oclushion}"
DB_HOST="${DB_HOST:-postgres}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${POSTGRES_USER:?required}"
DB_PASS="${POSTGRES_PASSWORD:?required}"

[ -z "$BACKUP_FILE" ] && usage
[ ! -f "$BACKUP_FILE" ] && echo "[Restore] Error: File not found: $BACKUP_FILE" && exit 1

export PGPASSWORD="$DB_PASS"

echo "[Restore] WARNING: This will overwrite the database '${TARGET_DB}' on ${DB_HOST}:${DB_PORT}"
echo "[Restore] Backup file: ${BACKUP_FILE}"
echo "[Restore] Press Ctrl+C within 5 seconds to abort..."
sleep 5

echo "[Restore] Dropping existing connections to ${TARGET_DB}..."
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -c "
  SELECT pg_terminate_backend(pg_stat_activity.pid)
  FROM pg_stat_activity
  WHERE pg_stat_activity.datname = '${TARGET_DB}'
    AND pid <> pg_backend_pid();
"

echo "[Restore] Dropping and recreating database ${TARGET_DB}..."
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -c "DROP DATABASE IF EXISTS ${TARGET_DB};"
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -c "CREATE DATABASE ${TARGET_DB};"

echo "[Restore] Starting restore from ${BACKUP_FILE}..."
pg_restore -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$TARGET_DB" \
  --no-owner --no-acl \
  --clean --if-exists \
  --file="$BACKUP_FILE" --format=custom

echo "[Restore] Complete"
