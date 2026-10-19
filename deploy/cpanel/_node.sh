#!/usr/bin/env bash
# Pembantu (di-source oleh skrip lain): menemukan Node.js milik aplikasi cPanel
# ("Setup Node.js App" membuat lingkungan di ~/nodevenv/<folder-aplikasi>/<versi>/bin).
# Cron dan Terminal cPanel tidak otomatis memakai Node itu, jadi PATH diatur di sini.

# Folder root proyek (…/siemi-pktj) dan folder server (application root di cPanel).
PROYEK_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SERVER_DIR="$PROYEK_DIR/server"

REL="${SERVER_DIR#"$HOME"/}"                      # mis. siemi-pktj/server
BIN_DIR="$(ls -d "$HOME/nodevenv/$REL"/*/bin 2>/dev/null | sort -V | tail -1 || true)"
if [ -z "$BIN_DIR" ]; then                         # cadangan: Node apa pun di nodevenv
  BIN_DIR="$(dirname "$(find "$HOME/nodevenv" -path '*/bin/node' 2>/dev/null | sort -V | tail -1)" 2>/dev/null || true)"
fi
if [ -n "$BIN_DIR" ] && [ -x "$BIN_DIR/node" ]; then
  export PATH="$BIN_DIR:$PATH"
fi

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js tidak ditemukan. Buat aplikasi dulu di cPanel > Setup Node.js App (Node 22)." >&2
  exit 1
fi
NODE_MAJOR="$(node -v | sed 's/^v\([0-9]*\).*/\1/')"
if [ "$NODE_MAJOR" -lt 22 ]; then
  echo "Node $(node -v) terlalu lama; aplikasi butuh Node 22 atau lebih baru." >&2
  exit 1
fi
