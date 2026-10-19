#!/usr/bin/env bash
# Cadangan terjadwal (dipanggil cron). Aman saat aplikasi berjalan.
#   crontab -e  ->  0 1 * * * /home/USER/siemi-pktj/deploy/backup-siemi.sh >> /home/USER/backup/backup.log 2>&1
set -euo pipefail
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$APP_DIR/server"
echo "[$(date '+%F %T')]"
node scripts/backup-db.js --ke="${BACKUP_DIR:-$HOME/backup}" --simpan="${SIMPAN:-14}"
