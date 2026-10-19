#!/usr/bin/env bash
# Perbarui aplikasi di cPanel setelah berkas baru diunggah/diekstrak.
# Jalankan dari Terminal cPanel:
#   bash ~/siemi-pktj/deploy/cpanel/update-cpanel.sh
# Urutan: cadangan DB -> pasang dependensi -> minta Passenger memulai ulang.
set -euo pipefail
# shellcheck source=/dev/null
source "$(dirname "${BASH_SOURCE[0]}")/_node.sh"

cd "$SERVER_DIR"

echo "==> [1/3] Cadangan basis data sebelum update"
mkdir -p "${BACKUP_DIR:-$HOME/backup}"
node scripts/backup-db.js --ke="${BACKUP_DIR:-$HOME/backup}" --simpan="${SIMPAN:-14}"

echo "==> [2/3] Pasang dependensi server (tanpa compiler: better-sqlite3 membawa binari siap pakai)"
npm install --omit=dev --no-audit --no-fund

echo "==> [3/3] Mulai ulang aplikasi (Passenger)"
mkdir -p tmp
touch tmp/restart.txt

if [ ! -f "$PROYEK_DIR/client/dist/index.html" ]; then
  echo "PERINGATAN: client/dist/index.html tidak ada — antarmuka web belum terunggah (build di Mac, lihat panduan)." >&2
fi
echo "Selesai. Buka situs Anda dan cek /api/health. Bila ragu, tekan Restart di Setup Node.js App."
