#!/usr/bin/env bash
# Cadangan database & unggahan untuk hosting cPanel. Aman saat aplikasi berjalan.
#
# Cron Jobs cPanel (setiap hari 01.00), ganti USERNAME:
#   0 1 * * * /bin/bash /home/USERNAME/siemi-pktj/deploy/cpanel/backup-cpanel.sh >> /home/USERNAME/backup/backup.log 2>&1
set -euo pipefail
# shellcheck source=/dev/null
source "$(dirname "${BASH_SOURCE[0]}")/_node.sh"

mkdir -p "${BACKUP_DIR:-$HOME/backup}"
cd "$SERVER_DIR"
echo "[$(date '+%F %T')]"
node scripts/backup-db.js --ke="${BACKUP_DIR:-$HOME/backup}" --simpan="${SIMPAN:-14}"
