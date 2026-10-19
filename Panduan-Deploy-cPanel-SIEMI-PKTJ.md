# Panduan Pemasangan SIEMI PKTJ di Hosting cPanel (untuk Operator IT)

Panduan ini ditujukan bagi operator IT. Bahan yang diterima dari pemilik aplikasi: `siemi-pktj-cpanel.zip` (kode **beserta antarmuka web yang sudah di-build**, siap unggah) dan `siemi-pktj-database-AAAAMMDD.zip` (database + `uploads/`, **rahasia** — hapus salinannya setelah terpasang).

Panduan ini untuk hosting yang memiliki menu **Setup Node.js App** di cPanel (Phusion Passenger). Bila hosting Anda tidak punya menu itu, atau hanya menyediakan Node di bawah 22, gunakan `Panduan-Deploy-VPS-SIEMI-PKTJ.md`.

```
Pengguna ──HTTPS──> Apache/Passenger (cPanel) ──> Node/Express (app.cjs → src/index.js)
                                                   └─ SQLite: ~/siemi-pktj/server/data/emi-pktj.db
```

Perbedaan utama dari VPS: tidak ada PM2/nginx/SSH root. cPanel yang menjalankan, memulai ulang, dan memasang HTTPS. Antarmuka web **sudah di-build oleh pemilik** (`client/dist` ada di dalam zip), jadi operator tidak perlu build di hosting.

> **Aturan penting**
> 1. Butuh **Node.js 22+** (database `better-sqlite3` v13). Pastikan versi 22 muncul di daftar pilihan Setup Node.js App.
> 2. Letakkan aplikasi **di luar `public_html`** (mis. `~/siemi-pktj`). Jangan pernah menaruh database di folder yang bisa diakses web.
> 3. **Jangan** menjalankan `npm run reset` (menghapus semua data). Data dibawa lewat berkas database kiriman pemilik (bagian 2).
> 4. Jangan menyalin `emi-pktj.db` mentah saat aplikasi berjalan; pakai skrip cadangan (ada `-wal` yang bisa membuat salinan rusak).

---

## 0. Cek hosting sebelum mulai (5 menit)

Login cPanel, lalu pastikan:

- [ ] Ada menu **Software → Setup Node.js App**, dan opsi versi **22.x** tersedia.
- [ ] Ada **Terminal** (atau akses SSH). Bila tidak ada, tetap bisa, tetapi beberapa langkah (cek password, cadangan manual) harus lewat tombol UI/Cron.
- [ ] Sisa ruang disk ≥ 1 GB; batas memori/proses (CloudLinux "LVE") ≥ 512 MB bila bisa ditanyakan.
- [ ] Domain atau subdomain untuk aplikasi (disarankan subdomain, mis. `siemi.domain-anda.ac.id`).

Bila Node 22 tidak ada, minta penyedia hosting meningkatkannya, atau pindah ke VPS. Tanyakan juga: *"OS server CloudLinux 8/AlmaLinux 8 ke atas?"* Sistem yang sangat lama (CloudLinux 7, glibc 2.17) tidak bisa menjalankan modul database (galat `GLIBC_2.xx not found`).

Kabar baiknya: modul database sudah membawa binari siap pakai, jadi **tidak perlu compiler** di hosting.

---

## 1. Periksa kiriman

- `siemi-pktj-cpanel.zip` — isinya `client/dist`, `server`, `deploy`, `package.json`. **Tidak** berisi database, `.env`, maupun `node_modules`.
- `siemi-pktj-database-AAAAMMDD.zip` — isinya `emi-pktj.db` dan folder `uploads/`. Ekstrak di komputer operator untuk mengambil kedua berkas itu.

Bila `client/dist` tidak ada di dalam zip kode, minta pemilik mengirim ulang paket yang sudah berisi hasil build (jangan membuild di hosting bersama).

---

## 2. Unggah ke cPanel (File Manager)

1. **File Manager** → buka folder **home** (`/home/USERNAME`, *bukan* `public_html`).
2. **Upload** `siemi-pktj-cpanel.zip` → klik kanan → **Extract**. Hasil: `/home/USERNAME/siemi-pktj/` berisi `client/dist`, `server`, `deploy`. (Bila hasil ekstrak berada di dalam sub-folder ganda, pindahkan isinya agar tepat seperti itu. Hapus berkas zip setelahnya.)
3. Buat folder `/home/USERNAME/siemi-pktj/server/data`, lalu **upload** `emi-pktj.db` (dari zip database kiriman pemilik) ke folder itu. Bila ada folder `uploads/`, unggah juga ke `server/data/uploads`.
4. Buat folder `/home/USERNAME/backup` (untuk cadangan nanti).

Susunan akhir yang benar:

```
/home/USERNAME/siemi-pktj/
├── client/dist/index.html
├── deploy/…
└── server/
    ├── app.cjs
    ├── package.json
    ├── src/…
    └── data/emi-pktj.db
```

---

## 3. Buat aplikasi Node.js

**Software → Setup Node.js App → Create Application**:

| Kolom | Isi |
|---|---|
| Node.js version | **22.x** |
| Application mode | **Production** |
| Application root | `siemi-pktj/server` |
| Application URL | domain/subdomain Anda (kosongkan path) |
| Application startup file | **`app.cjs`** (bukan `app.js`/`index.js`) |

Klik **Create**. Lalu di bagian **Environment variables** tambahkan (**Add Variable** → Save):

| Nama | Nilai |
|---|---|
| `NODE_ENV` | `production` |
| `JWT_SECRET` | string acak minimal 32 karakter — buat dengan `openssl rand -hex 48` |

> Bila hosting Anda menyimpan data di penyimpanan jaringan dan nanti muncul galat *database is locked/malformed*, tambahkan juga `SQLITE_JOURNAL_MODE` = `DELETE`.

Selanjutnya klik **Run NPM Install** (memasang dependensi dari `server/package.json`; berjalan 1–2 menit), lalu **Restart** (atau Start).

---

## 4. HTTPS

- cPanel → **SSL/TLS Status** → **Run AutoSSL** untuk domain/subdomain aplikasi (sertifikat gratis, diperbarui otomatis).
- cPanel → **Domains** → aktifkan **Force HTTPS Redirect** untuk domain itu.

Tanpa HTTPS, kata sandi terkirim tanpa enkripsi — jangan buka aplikasi ke pengguna sebelum langkah ini selesai.

---

## 5. Verifikasi

Buka `https://siemi.domain-anda.ac.id/api/health` — harus tampil `{"ok":true,...}`. (Permintaan pertama bisa lambat karena aplikasi baru dinyalakan.) Lalu buka halaman utamanya dan centang:

- [ ] Beranda publik tampil; halaman berstatus draf tidak terlihat publik.
- [ ] Login berhasil (minta akun uji dari pemilik aplikasi).
- [ ] **Sasaran Mutu**: unit dan program kerja ada, berstatus ditetapkan (BAAK, Perpustakaan 2025/2026, dll.).
- [ ] **Modul 2 → tab Sasaran Mutu** tampil sebagai tabel; capaian dan realisasi terisi.
- [ ] Nama unit **Unit Teknik Informatika** benar.
- [ ] Unggah satu berkas bukti kecil, muat ulang, berkas masih ada.

Bila gagal, lihat bagian 9 (Pemecahan masalah).

---

## 6. Pengamanan sebelum diumumkan

1. Cek akun yang masih memakai kata sandi bawaan aplikasi (Terminal cPanel):
   ```bash
   bash -c 'source ~/siemi-pktj/deploy/cpanel/_node.sh && cd ~/siemi-pktj/server && npm run cek-password'
   ```
   Bila masih ada, **laporkan ke pemilik aplikasi** sebelum diumumkan. Penggantian dilakukan oleh pemilik akun (menu **Profil Saya**) atau Administrator aplikasi (**Data Master → Pengguna**), bukan lewat server.
2. Pastikan `server/data` dan `server/.env` tidak berada di bawah `public_html`.
3. Aktifkan **2FA** pada akun cPanel dan gunakan kata sandi cPanel yang kuat — siapa pun yang masuk cPanel dapat membaca seluruh database.
4. Hapus berkas zip database dari server/komputer yang tidak lagi diperlukan.

---

## 7. Cadangan otomatis (wajib)

**Cron Jobs** (cPanel → Advanced → Cron Jobs) → *Once Per Day* (01:00) → isi Command (ganti `USERNAME`):

```
/bin/bash /home/USERNAME/siemi-pktj/deploy/cpanel/backup-cpanel.sh >> /home/USERNAME/backup/backup.log 2>&1
```

Skrip menyimpan 14 cadangan terakhir di `/home/USERNAME/backup`, aman walau aplikasi sedang berjalan, dan memeriksa integritasnya (lihat `backup.log`: harus ada `Integritas : ok`). Uji sekali dari Terminal: `bash ~/siemi-pktj/deploy/cpanel/backup-cpanel.sh`.

Lapis tambahan:
- Aktifkan **Backup / JetBackup** bawaan hosting bila tersedia.
- **Unduh** folder `backup` ke komputer/penyimpanan lain secara berkala (File Manager → Compress → Download), atau tarik via `scp`. Cadangan yang hanya ada di server yang sama tidak aman bila akun hosting bermasalah.

**Memulihkan dari cadangan**

1. Setup Node.js App → **Stop** aplikasi.
2. File Manager: di `server/data`, hapus `emi-pktj.db-wal` dan `emi-pktj.db-shm` (bila ada), lalu timpa `emi-pktj.db` dengan `backup/siemi-TANGGAL-JAM/emi-pktj.db` (dan folder `uploads` bila perlu).
3. **Start** aplikasi.

Latih sekali pada saat tenang.

---

## 8. Memperbarui aplikasi di kemudian hari

1. Pemilik mengirim `siemi-pktj-cpanel.zip` versi baru (sudah berisi hasil build). Paket tidak berisi database/`.env`, jadi data dan kunci tidak tertimpa.
2. cPanel: upload zip ke folder home → Extract dengan opsi menimpa berkas yang ada → hapus zip.
3. Terminal cPanel: `bash ~/siemi-pktj/deploy/cpanel/update-cpanel.sh`
   (cadangan DB → pasang dependensi → restart). Tanpa Terminal: cukup **Run NPM Install** lalu **Restart** di Setup Node.js App; cadangan dilakukan dulu lewat cron/Terminal.
4. Skema database baru dimigrasikan otomatis saat start. **Jangan** menjalankan `reset`.

Mengubah database langsung hanya boleh saat aplikasi **di-Stop**, dan cadangkan dulu.

---

## 9. Pemecahan masalah

| Gejala | Penyebab & solusi |
|---|---|
| Halaman error Passenger / "Incomplete response" / 503 | Aplikasi gagal start. Lihat log: `stderr.log` di folder `server/` atau cPanel → **Metrics → Errors**. Perbaiki, lalu Restart. |
| `ERR_REQUIRE_ESM` | Startup file bukan `app.cjs`. Ubah di Setup Node.js App → Save → Restart. |
| Log: `[FATAL] JWT_SECRET belum diatur` | Variabel `JWT_SECRET` belum ditambahkan / kurang dari 32 karakter. Isi di Environment variables, Save, Restart. |
| `Cannot find module 'better-sqlite3'` | NPM Install belum dijalankan atau gagal. Klik **Run NPM Install** lagi; pastikan versi Node 22. |
| `GLIBC_2.xx not found` / `invalid ELF header` | OS hosting terlalu lama untuk binari modul database. Minta pindah ke server CloudLinux 8+ atau gunakan VPS. |
| `engine "node" is incompatible` | Versi Node aplikasi < 22. Ganti ke 22.x di Setup Node.js App. |
| Halaman putih / 404 pada halaman web | `client/dist` tidak terunggah. Pastikan `siemi-pktj/client/dist/index.html` ada (bagian 2), lalu Restart. |
| Unggah berkas bukti gagal (413) | Batas ukuran dari hosting/Apache. Minta penyedia menaikkan `LimitRequestBody` ≥ 15 MB, atau gunakan tautan Google Drive untuk bukti. |
| `database is locked` / `malformed` | Penyimpanan hosting tidak cocok dengan mode WAL. Tambahkan env `SQLITE_JOURNAL_MODE=DELETE`, Restart. Bila sudah rusak, pulihkan dari cadangan (bagian 7). |
| Lambat di permintaan pertama setelah lama sepi | Wajar: Passenger mematikan aplikasi yang menganggur lalu menyalakannya lagi. |
| "Resource Limit Reached" | Batas CPU/memori paket hosting terlewati. Minta penyedia menaikkan, atau pindah ke VPS. |
| Setelah update tampilan tidak berubah | Cache browser (Cmd+Shift+R) dan pastikan `client/dist` baru ikut terunggah & ditimpa. |

---

## 10. Batasan hosting cPanel dibanding VPS

- Aplikasi dimatikan Passenger saat sepi dan dinyalakan lagi saat ada permintaan (tidak ada proses tetap seperti PM2).
- Batas memori/proses ditentukan penyedia hosting; bila pengguna bersamaan bertambah banyak, VPS lebih leluasa.
- Tidak ada akses root: perbaikan yang butuh paket sistem harus lewat penyedia hosting.

Untuk skala satu kampus dengan puluhan pengguna, cPanel yang memenuhi syarat Node 22 sudah memadai.

---

## 11. Yang dilaporkan kembali ke pemilik aplikasi

- Alamat akses (URL) dan hasil `/api/health`.
- Konfirmasi HTTPS aktif dan cadangan harian (cron) berjalan, termasuk lokasi salinan di luar server.
- Hasil `npm run cek-password` (jumlah akun yang masih berkata sandi bawaan).
- Daftar akun yang memiliki akses ke cPanel/SSH.
