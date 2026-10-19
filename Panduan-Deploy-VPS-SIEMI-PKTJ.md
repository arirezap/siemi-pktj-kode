# Panduan Pemasangan SIEMI PKTJ di VPS (untuk Operator IT)

Panduan ini ditujukan bagi operator IT yang memasang aplikasi di server. Semua langkah dilakukan di server (atau di komputer operator bila disebut). Aplikasi berupa `client/` (React + Vite) dan `server/` (Node.js/Express + SQLite). Di produksi, **satu proses Node** menyajikan API sekaligus antarmuka web, dengan **nginx** di depannya untuk HTTPS.

```
Pengguna ──HTTPS──> nginx (80/443) ──> Node/Express :4000 ──> SQLite (server/data/emi-pktj.db)
                                        └─ dikelola PM2 (auto-restart)
```

## 0. Bahan dan syarat

**Diterima dari pemilik aplikasi:**

| Berkas | Isi |
|---|---|
| `siemi-pktj-kode.zip` | Kode aplikasi (tanpa `node_modules`, database, dan `.env`) |
| `siemi-pktj-database-AAAAMMDD.zip` | `emi-pktj.db` + folder `uploads/`. **Rahasia** (berisi akun pengguna); hapus salinannya setelah terpasang |

**Yang perlu disiapkan operator:**

- VPS Ubuntu 22.04/24.04, minimal 1 vCPU / 2 GB RAM / 20 GB SSD (1 GB RAM cukup, skrip menambah swap).
- Domain/subdomain (mis. `siemi.pktj.ac.id`) dan akses mengubah DNS-nya. Tanpa HTTPS, kata sandi terkirim polos — jangan buka ke pengguna tanpa HTTPS.
- Akses SSH (root atau user dengan sudo).
- Waktu: sekitar 1–2 jam.

**Berkas pendukung di folder `deploy/` dalam kode:**

| Berkas | Fungsi |
|---|---|
| `deploy/setup-server.sh` | Persiapan server sekali jalan (firewall, Node 22, nginx, certbot, PM2, swap) |
| `deploy/ecosystem.config.cjs` | Konfigurasi PM2 |
| `deploy/nginx-siemi-pktj.conf` | Konfigurasi nginx |
| `deploy/env.production.example` | Contoh `.env` produksi |
| `deploy/update.sh` | Perbarui aplikasi (cadangan → install → build → restart → cek) |
| `deploy/backup-siemi.sh` | Cadangan harian untuk cron |
| `server/scripts/backup-db.js` | Cadangan database yang aman (dipakai skrip di atas) |
| `server/scripts/cek-password-default.js` | Daftar akun yang masih memakai kata sandi bawaan |

> **Hal penting:**
> 1. Node.js harus **versi 22 atau lebih baru** (`better-sqlite3` v13). Versi 20 gagal.
> 2. **Jangan menjalankan `npm run reset`** — itu menghapus seluruh data.
> 3. Jangan menyalin `emi-pktj.db` begitu saja saat aplikasi berjalan. Database memakai mode WAL; salinan "polos" bisa basi/rusak. Gunakan `server/scripts/backup-db.js`.
> 4. Saat `NODE_ENV=production`, server **menolak start** bila `JWT_SECRET` masih bawaan/lemah (kurang dari 32 karakter). Itu disengaja.
> 5. Jalankan **satu instance saja**; SQLite tidak aman untuk banyak proses penulis.

---

## 1. Siapkan VPS dan user non-root

Login pertama (root atau user awal dari provider):

```bash
ssh root@ALAMAT_IP_VPS
adduser siemi
usermod -aG sudo siemi
# bila memakai SSH key, salin ke user baru:
rsync --archive --chown=siemi:siemi ~/.ssh /home/siemi
exit
```

Mulai sekarang login sebagai `siemi`:

```bash
ssh siemi@ALAMAT_IP_VPS
```

---

## 2. Unggah dan ekstrak kode

Dari komputer operator (folder tempat berkas kiriman berada):

```bash
scp siemi-pktj-kode.zip siemi-pktj-database-*.zip siemi@ALAMAT_IP_VPS:~/
```

Di server:

```bash
sudo apt-get install -y unzip
mkdir -p ~/siemi-pktj
unzip -q ~/siemi-pktj-kode.zip -d ~/siemi-pktj
```

---

## 3. Persiapan server (sekali saja)

```bash
bash ~/siemi-pktj/deploy/setup-server.sh siemi.domain-anda.ac.id
```

Skrip memasang firewall (hanya SSH/HTTP/HTTPS), Node.js 22, build tools, nginx, certbot, PM2, swap bila RAM kecil, dan konfigurasi nginx untuk domain. Akhir keluarannya harus menampilkan `Node v22.x`. Aman dijalankan ulang.

---

## 4. Pasang database

```bash
mkdir -p ~/siemi-pktj/server/data
unzip -q ~/siemi-pktj-database-*.zip -d ~/siemi-pktj/server/data
ls ~/siemi-pktj/server/data        # harus ada emi-pktj.db dan uploads/
```

Saat start pertama, server otomatis menyesuaikan skema database bila ada pembaruan (tanpa menghapus data). **Hapus berkas zip database dari server** setelah terpasang dan hasilnya terverifikasi:

```bash
rm ~/siemi-pktj-database-*.zip
```

> Jangan mengubah database langsung (mis. skrip impor) saat aplikasi berjalan. Matikan dulu (`pm2 stop siemi-pktj`), ubah, lalu nyalakan lagi.

---

## 5. Konfigurasi `.env` produksi

```bash
cd ~/siemi-pktj/server
cp ../deploy/env.production.example .env
nano .env
```

Buat kunci rahasia acak dan tempel sebagai `JWT_SECRET`:

```bash
openssl rand -hex 48
```

Isi akhir `.env`:

```
PORT=4000
JWT_SECRET=<hasil-openssl-48-byte-di-sini>
```

Simpan (Ctrl+O, Enter, Ctrl+X), lalu `chmod 600 .env`. Jangan membagikan atau meng-commit `.env`.

---

## 6. Install, build, dan jalankan

```bash
cd ~/siemi-pktj
npm run pasang          # install dependensi server + client (mengompilasi better-sqlite3)
npm run build           # build frontend ke client/dist (1–3 menit)

pm2 start deploy/ecosystem.config.cjs
pm2 save
pm2 startup systemd     # SALIN lalu jalankan perintah sudo yang ditampilkan, agar hidup otomatis setelah reboot
```

Periksa:

```bash
pm2 status                                  # status "online"
pm2 logs siemi-pktj --lines 30              # tidak boleh ada [FATAL]/error
curl http://127.0.0.1:4000/api/health       # {"ok":true,...}
```

---

## 7. Domain dan HTTPS

1. Di pengelola DNS, tambahkan **A record** untuk subdomain (mis. `siemi`) → alamat IP VPS. Tunggu 5 menit hingga beberapa jam; cek dengan `ping siemi.domain-anda.ac.id`.
2. Setelah domain mengarah ke VPS, pasang sertifikat gratis:
   ```bash
   sudo certbot --nginx -d siemi.domain-anda.ac.id
   ```
   Pilih opsi redirect HTTP → HTTPS. Pembaruan otomatis (uji: `sudo certbot renew --dry-run`).

---

## 8. Verifikasi setelah online

Buka `https://siemi.domain-anda.ac.id`, lalu centang:

- [ ] Beranda publik tampil.
- [ ] `https://siemi.domain-anda.ac.id/api/health` menampilkan `{"ok":true,...}`.
- [ ] Login berhasil (minta akun uji dari pemilik aplikasi).
- [ ] Menu **Sasaran Mutu**: unit-unit dan program kerjanya tampil, berstatus ditetapkan.
- [ ] Unggah satu berkas bukti kecil, muat ulang halaman, pastikan tersimpan.
- [ ] `pm2 logs siemi-pktj` tidak menampilkan galat.
- [ ] Reboot server sekali (`sudo reboot`), pastikan aplikasi hidup sendiri (`pm2 status`).

---

## 9. Pengamanan server

1. **Matikan login SSH dengan kata sandi** setelah SSH key berfungsi: di `/etc/ssh/sshd_config` set `PasswordAuthentication no`, lalu `sudo systemctl restart ssh`. Uji login dari terminal kedua **sebelum** menutup yang pertama.
2. Pasang proteksi tebak-sandi dan pembaruan keamanan otomatis:
   ```bash
   sudo apt install -y fail2ban unattended-upgrades
   ```
3. Periksa akun yang masih memakai kata sandi bawaan aplikasi:
   ```bash
   cd ~/siemi-pktj && npm run cek-password
   ```
   Bila masih ada, **laporkan ke pemilik aplikasi** sebelum aplikasi diumumkan. Penggantian kata sandi dilakukan oleh pemilik akun (menu **Profil Saya**) atau Administrator aplikasi (**Data Master → Pengguna**), bukan lewat server.

---

## 10. Cadangan otomatis (wajib)

```bash
chmod +x ~/siemi-pktj/deploy/*.sh
crontab -e
```

Tambahkan baris ini (setiap hari pukul 01.00; ganti `siemi` bila nama user berbeda):

```
0 1 * * * /home/siemi/siemi-pktj/deploy/backup-siemi.sh >> /home/siemi/backup/backup.log 2>&1
```

Uji sekali sekarang: `~/siemi-pktj/deploy/backup-siemi.sh` — harus mencetak `Integritas : ok`. Disimpan 14 cadangan terakhir di `~/backup`.

Cadangan di disk yang sama ikut hilang bila VPS rusak. **Salin ke luar server secara berkala** (mis. mingguan) dan aktifkan snapshot dari provider VPS bila ada:

```bash
scp -r siemi@ALAMAT_IP_VPS:~/backup/siemi-TANGGAL-JAM /lokasi/cadangan/
```

**Memulihkan dari cadangan:**

```bash
pm2 stop siemi-pktj
cd ~/siemi-pktj/server/data
rm -f emi-pktj.db-wal emi-pktj.db-shm
cp ~/backup/siemi-TANGGAL-JAM/emi-pktj.db emi-pktj.db
cp -r ~/backup/siemi-TANGGAL-JAM/uploads . 2>/dev/null || true
pm2 start siemi-pktj
```

Latih prosedur ini sekali pada saat tenang.

---

## 11. Memperbarui aplikasi di kemudian hari

Pemilik aplikasi akan mengirim `siemi-pktj-kode.zip` versi baru.

1. Ekstrak di atas folder aplikasi (database, `.env`, dan `uploads` tidak ada di zip sehingga tidak tertimpa):
   ```bash
   unzip -oq ~/siemi-pktj-kode.zip -d ~/siemi-pktj
   ```
2. Jalankan:
   ```bash
   bash ~/siemi-pktj/deploy/update.sh
   ```
   Skrip: cadangan database → install → build → restart → cek kesehatan. Skema database baru dimigrasikan otomatis saat start; **jangan** menjalankan `reset`.

Bila ada masalah setelah update, kembalikan kode versi sebelumnya, jalankan `update.sh` lagi, dan bila data terdampak pulihkan database dari cadangan yang dibuat otomatis di langkah 1 skrip.

---

## 12. Pemecahan masalah

| Gejala | Penyebab & solusi |
|---|---|
| `502 Bad Gateway` | Aplikasi tidak jalan. `pm2 status`, `pm2 logs siemi-pktj`. Nyalakan: `pm2 restart siemi-pktj`. |
| Log: `[FATAL] JWT_SECRET belum diatur` | `server/.env` kosong/masih contoh. Isi sesuai bagian 5, lalu `pm2 restart siemi-pktj --update-env`. |
| `npm run pasang` gagal di `better-sqlite3` | Node < 22 atau build tools belum ada. Cek `node -v` (harus ≥ 22); jalankan ulang `setup-server.sh`. |
| `npm run build` berhenti "Killed" | Kehabisan memori. Pastikan swap aktif (`free -m`), ulangi build. |
| Halaman putih / rute 404 saat refresh | `client/dist` belum ada. Jalankan `npm run build`, lalu `pm2 restart siemi-pktj`. |
| `413 Request Entity Too Large` saat unggah | Batas nginx. Pastikan `client_max_body_size 15m;` di `/etc/nginx/sites-available/siemi-pktj`, lalu `sudo nginx -t && sudo systemctl reload nginx`. |
| `database disk image is malformed` | Database korup (biasanya disalin/diubah saat aplikasi jalan). `pm2 stop siemi-pktj`, pulihkan dari cadangan (bagian 10). Jangan menyalin berkas `-wal`/`-shm` dari tempat lain. |
| Kena batas laju di halaman publik | Wajar bila banyak permintaan dari satu IP. Pastikan nginx meneruskan `X-Forwarded-For` (sudah ada di konfigurasi). |
| Setelah reboot aplikasi mati | Jalankan `pm2 startup systemd` dan perintah sudo yang ditampilkan, lalu `pm2 save`. |
| Sertifikat HTTPS gagal terbit | DNS belum mengarah ke VPS atau port 80 tertutup. Cek `ping domain` dan `sudo ufw status`. |

---

## 13. Aturan emas

- Satu proses saja (`instances: 1`).
- Ubah database langsung hanya saat aplikasi **dimatikan**, dan selalu cadangkan dulu.
- Cadangan hanya dianggap ada bila sudah disalin ke luar server **dan** pernah diuji dipulihkan.
- Jangan pernah membagikan `server/.env` atau berkas database.

## 14. Yang dilaporkan kembali ke pemilik aplikasi

- Alamat akses (URL) dan hasil `/api/health`.
- Konfirmasi HTTPS aktif dan cadangan harian berjalan (lokasi dan lama penyimpanan, plus salinan di luar server).
- Hasil `npm run cek-password` (jumlah akun yang masih berkata sandi bawaan).
- Daftar akun yang punya akses SSH ke server.
