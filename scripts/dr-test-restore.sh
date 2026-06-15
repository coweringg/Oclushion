#!/bin/sh
set -euo pipefail

# DR Test Script — Validates restore process and measures RTO
# Usage: ./dr-test-restore.sh [--backup-file <path>] [--target-db oclushion_dr_test]
#
# Exit codes:
#   0 — Restore successful, RTO within target
#   1 — Restore failed
#   2 — RTO exceeded target

BACKUP_FILE="${BACKUP_FILE:-/backups/$(ls -t /backups/*.sql.gz 2>/dev/null | head -1)}"
TARGET_DB="${TARGET_DB:-oclushion_dr_test}"
RTO_TARGET_SECONDS="${RTO_TARGET_SECONDS:-300}"

DB_HOST="${DB_HOST:-postgres}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${POSTGRES_USER:?required}"
DB_PASS="${POSTGRES_PASSWORD:?required}"

[ ! -f "$BACKUP_FILE" ] && echo "[DR Test] Error: No backup file found at $BACKUP_FILE" && exit 1

export PGPASSWORD="$DB_PASS"

echo "[DR Test] === DR Restore Test ==="
echo "[DR Test] Backup: $BACKUP_FILE"
echo "[DR Test] Target DB: $TARGET_DB"
echo "[DR Test] RTO Target: ${RTO_TARGET_SECONDS}s"
echo ""
echo "[DR Test] Starting RTO timer..."
START_TIME=$(date +%s)

echo "[DR Test] Terminating connections to ${TARGET_DB} (if exists)..."
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -c "
  SELECT pg_terminate_backend(pg_stat_activity.pid)
  FROM pg_stat_activity
  WHERE pg_stat_activity.datname = '${TARGET_DB}'
    AND pid <> pg_backend_pid();
" 2>/dev/null || true

echo "[DR Test] Dropping and recreating ${TARGET_DB}..."
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -c "DROP DATABASE IF EXISTS ${TARGET_DB};"
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -c "CREATE DATABASE ${TARGET_DB};"

echo "[DR Test] Restoring from backup..."
pg_restore -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$TARGET_DB" \
  --no-owner --no-acl \
  --clean --if-exists \
  --file="$BACKUP_FILE" --format=custom

END_TIME=$(date +%s)
RTO_ACTUAL=$((END_TIME - START_TIME))

echo ""
echo "[DR Test] Restore complete: ${RTO_ACTUAL}s"
echo "[DR Test] RTO Target: ${RTO_TARGET_SECONDS}s"

# Validate: check table count
TABLE_COUNT=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$TARGET_DB" -t -c "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';" | xargs)
echo "[DR Test] Tables restored: $TABLE_COUNT"

if [ "$TABLE_COUNT" -eq 0 ]; then
  echo "[DR Test] FAIL: No tables found in restored database"
  exit 1
fi

# Validate: check user count
USER_COUNT=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$TARGET_DB" -t -c "SELECT count(*) FROM platform_users;" 2>/dev/null | xargs || echo "0")
echo "[DR Test] Users restored: $USER_COUNT"

echo "[DR Test] Cleaning up test database..."
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -c "DROP DATABASE IF EXISTS ${TARGET_DB};"

echo ""
if [ $RTO_ACTUAL -le $RTO_TARGET_SECONDS ]; then
  echo "[DR Test] PASS: RTO ${RTO_ACTUAL}s within target ${RTO_TARGET_SECONDS}s"
  exit 0
else
  echo "[DR Test] FAIL: RTO ${RTO_ACTUAL}s exceeded target ${RTO_TARGET_SECONDS}s"
  exit 2
fi
