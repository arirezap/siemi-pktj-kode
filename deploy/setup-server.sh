#!/usr/bin/env bash
# Persiapan SATU KALI server Ubuntu 22.04/24.04 untuk SIEMI PKTJ.
# Jalankan sebagai user biasa yang punya sudo (bukan root langsung):
#
#   bash ~/siemi-pktj/deploy/setup-server.sh domain-anda.ac.id
#
# Memasang: firewall (SSH/HTTP/HTTPS), Node.js 22, build tools, nginx, certbot,
# PM2, swap (bila RAM kecil), dan konfigurasi nginx. Aman dijalankan ulang.
set -euo pipefail

DOMAIN="${1:-}"
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [ "$(id -u)" -eq 0 ]; then
  echo "Jalankan sebagai user biasa (bukan root). Lihat panduan bagian 2." >&2
  exit 1
fi
if [ -z "$DOMAIN" ]; then
  echo "Pemakaian: bash deploy/setup-server.sh domain-anda.ac.id   (atau IP server bila belum punya domain)" >&2
  exit 1
fi

echo "==> [1/6] Paket dasar & firewall"
sudo apt-get update -y
sudo apt-get install -y curl git unzip build-essential python3 ufw nginx certbot python3-certbot-nginx
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable

echo "==> [2/6] Node.js 22 (wajib: better-sqlite3 v13 butuh Node >= 22)"
need_node=1
if command -v node >/dev/null 2>&1; then
  major="$(node -v | sed 's/^v\([0-9]*\).*/\1/')"
  [ "$major" -ge 22 ] && need_node=0
fi
if [ "$need_node" -eq 1 ]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi
echo "    Node $(node -v), npm $(npm -v)"

echo "==> [3/6] PM2"
command -v pm2 >/dev/null 2>&1 || sudo npm install -g pm2

echo "==> [4/6] Swap (build Vite butuh memori; dilewati bila RAM+swap sudah cukup)"
mem_mb="$(free -m | awk '/^Mem:/{print $2}')"
swap_mb="$(free -m | awk '/^Swap:/{print $2}')"
if [ $((mem_mb + swap_mb)) -lt 2000 ] && [ ! -f /swapfile ]; then
  sudo fallocate -l 2G /swapfile
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile
  sudo swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab >/dev/null
  echo "    Swap 2 GB dibuat."
else
  echo "    Tidak perlu."
fi

echo "==> [5/6] nginx untuk $DOMAIN"
sudo sed "s/DOMAIN_ANDA/$DOMAIN/g" "$APP_DIR/deploy/nginx-siemi-pktj.conf" \
  | sudo tee /etc/nginx/sites-available/siemi-pktj >/dev/null
sudo ln -sf /etc/nginx/sites-available/siemi-pktj /etc/nginx/sites-enabled/siemi-pktj
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx

echo "==> [6/6] Folder cadangan & izin skrip"
mkdir -p "$HOME/backup"
chmod +x "$APP_DIR"/deploy/*.sh

echo
echo "Selesai. Lanjutkan ke panduan bagian 5 (unggah database) dan 6 (konfigurasi .env)."
