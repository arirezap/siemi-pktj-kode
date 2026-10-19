#!/usr/bin/env bash
# Perbarui aplikasi di server setelah kode baru diunggah (rsync) atau di-pull (git).
#   bash ~/siemi-pktj/deploy/update.sh
# Urutan: cadangan DB -> (git pull bila repo git) -> install -> build -> restart -> cek sehat.
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$APP_DIR"

echo "==> [1/5] Cadangan basis data sebelum update"
(cd server && node scripts/backup-db.js --ke="${BACKUP_DIR:-$HOME/backup}" --simpan="${SIMPAN:-14}")

echo "==> [2/5] Ambil kode terbaru"
if [ -d .git ]; then
  git pull --ff-only
else
  echo "    (bukan repo git — dianggap kode baru sudah diekstrak dari zip kiriman pemilik)"
fi

echo "==> [3/5] Pasang dependensi"
npm run pasang

echo "==> [4/5] Build frontend"
npm run build

echo "==> [5/5] Restart aplikasi"
pm2 startOrReload deploy/ecosystem.config.cjs --update-env
pm2 save

sleep 3
PORT_APP="$(grep -E '^PORT=' server/.env 2>/dev/null | cut -d= -f2 || true)"
if curl -fsS "http://127.0.0.1:${PORT_APP:-4000}/api/health" >/dev/null; then
  echo "OK — aplikasi sehat."
else
  echo "PERINGATAN: cek kesehatan gagal. Lihat: pm2 logs siemi-pktj" >&2
  exit 1
fi
