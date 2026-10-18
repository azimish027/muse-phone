#!/usr/bin/env bash
# ============================
# SQLite 数据库每日备份
# ============================
# 用法：
#   ./scripts/backup.sh              # 手动备份到 ./backups/
#   crontab -e 加一行：              # 每天凌晨 3 点自动备份
#     0 3 * * * cd /opt/muse-phone && ./scripts/backup.sh >> /var/log/muse-backup.log 2>&1
#
# 保留最近 30 天备份；备份文件是 gzip 压缩的 .db-wal（WAL 模式下要先 checkpoint）
# ============================
set -euo pipefail

cd "$(dirname "$0")/.."

BACKUP_DIR="${BACKUP_DIR:-./backups}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
DATA_DIR="${DATA_DIR:-./data}"

mkdir -p "$BACKUP_DIR"

DATE=$(date +%Y%m%d-%H%M%S)
DB="$DATA_DIR/lingua.db"
DEST="$BACKUP_DIR/lingua-$DATE.db"

if [ ! -f "$DB" ]; then
  echo "[$DATE] ERROR: 数据库不存在 $DB"
  exit 1
fi

# SQLite WAL checkpoint（确保数据完整性）
if command -v sqlite3 >/dev/null 2>&1; then
  sqlite3 "$DB" "PRAGMA wal_checkpoint(TRUNCATE);" 2>/dev/null || true
fi

# 复制 + gzip
cp "$DB" "$DEST"
gzip -f "$DEST"

SIZE=$(du -h "$DEST.gz" | cut -f1)
echo "[$DATE] ✅ 备份完成 → $DEST.gz ($SIZE)"

# 清理旧备份
find "$BACKUP_DIR" -name "lingua-*.db.gz" -mtime +$RETENTION_DAYS -delete 2>/dev/null || true

echo "  🗑️  保留最近 $RETENTION_DAYS 天备份"
