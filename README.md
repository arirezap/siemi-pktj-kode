# SIEMI PKTJ — Sistem Evaluasi Mutu Internal

Aplikasi Evaluasi Mutu Internal Politeknik Keselamatan Transportasi Jalan (PKTJ).
Menaungi siklus penjaminan mutu **PPEPP** dalam lima modul terpadu, dengan tujuh
acuan mutu terpadu: **SN Dikti**, **ISO 21001:2018 (SMOP)**, **LAM Teknik Sarjana
Terapan 2025**, **LAM Teknik Diploma III 2025**, **APT BAN-PT**, **UI GreenMetric**,
dan **LKE Zona Integritas**.

---

## Cara Menjalankan

Prasyarat: **Node.js 20 atau lebih baru** (diuji pada Node v24).

```bash
# 1. Pasang seluruh dependensi (server + client)
npm run pasang

# 2. Isi basis data dengan struktur organisasi, pengguna, dan 16 standar mutu PKTJ
npm run seed

# 3. Jalankan API (terminal 1)
npm run server

# 4. Jalankan antarmuka (terminal 2)
npm run client
```

Buka `http://localhost:5173`.

Untuk mengisi ulang basis data dari awal: `npm run reset`.

> **Setelah pemutakhiran arsitektur standar**, jalankan `npm run reset` sekali.
> Data lama (16 standar contoh) diganti dengan arsitektur 30 standar, dan
> penugasan unit berpindah dari tingkat standar ke tingkat indikator. Basis data
> yang sudah berisi data audit sungguhan sebaiknya dicadangkan lebih dulu —
> salin `server/data/emi-pktj.db`.

### Bila pemasangan bermasalah

**npm memblokir install script.** Sebagian npm terbaru menolak menjalankan
*install script* secara bawaan, padahal `better-sqlite3` (modul SQLite native) dan
`esbuild` (binary untuk Vite) membutuhkannya. Bila muncul peringatan
`allow-scripts`, izinkan keduanya:

```bash
cd server && npm approve-scripts --allow-scripts-pending && npm rebuild better-sqlite3
cd ../client && npm approve-scripts --allow-scripts-pending && npm rebuild esbuild
```

**Node.js mogok saat `npm run seed`** dengan pesan
`Assertion failed: (env) != nullptr` pada `better_sqlite3.node` — versi
`better-sqlite3` tidak cocok dengan versi Node.js yang terpasang. Perbarui ke versi
terbaru, lalu izinkan ulang install script-nya karena nomor versinya berubah:

```bash
cd server
rm -rf data
npm install better-sqlite3@latest
npm approve-scripts --allow-scripts-pending
npm rebuild better-sqlite3
```

### Mode produksi (satu server)

```bash
npm run build     # membangun frontend ke client/dist
npm start         # server menyajikan API sekaligus antarmuka di port 4000
```

Sebelum dipakai secara nyata, salin `server/.env.example` menjadi `server/.env`
dan ganti nilai `JWT_SECRET`. Dengan `NODE_ENV=production`, server menolak start
bila `JWT_SECRET` masih bawaan atau kurang dari 32 karakter.

Panduan lengkap mengonlinekan ke VPS (termasuk membawa database, HTTPS, cadangan,
dan pembaruan): lihat `Panduan-Deploy-VPS-SIEMI-PKTJ.md`. Untuk hosting **cPanel**
(Setup Node.js App): lihat `Panduan-Deploy-cPanel-SIEMI-PKTJ.md` (berkas awal
`server/app.cjs`). Node.js yang dibutuhkan: **22 atau lebih baru**.

---

## Akun Uji Coba

Kata sandi seluruh akun: `pktj2026`

| Peran | Surel | Kewenangan |
|---|---|---|
| Satuan Penjaminan Mutu | `spm@pktj.ac.id` | Seluruh modul, data master |
| Auditor (contoh) | `frans.tohom@gmail.com` | Penilaian audit, berita acara, verifikasi tindakan koreksi |
| Auditee | `baak@pktj.ac.id`, `rstj@pktj.ac.id`, dst. | Pelaksanaan standar dan tindakan koreksi unitnya |
| Pimpinan | `direktur@pktj.ac.id`, `wadir1@pktj.ac.id` … `wadir3@pktj.ac.id` | Rapat Tinjauan Manajemen |
| Administrator | `admin@pktj.ac.id` | Seluruh kewenangan |

Setiap unit organisasi PKTJ memiliki satu akun auditee (kepala unit terkait).
Hanya disertakan 1 akun auditor contoh — akun auditor dan auditee lainnya
ditambahkan oleh **Administrator** melalui menu **Data Master → Pengguna →
Pengguna Baru** (pilih peran "Auditor" atau "Auditee" dan tautkan ke unit yang
sesuai). Tab **Pengguna** pada Data Master hanya terlihat dan dapat dibuka
oleh akun Administrator — peran lain (termasuk SPM) tidak melihat daftar
pengguna di halaman ini sama sekali. Daftar pengguna tetap dapat dipakai
peran lain sebatas sebagai pilihan pada formulir lain (mis. memilih
pemimpin/notulis rapat, ketua/anggota tim auditor), bukan sebagai daftar
yang dapat dijelajahi.

---

## Manajemen Auditor (Kompetensi)

Menu **Manajemen Auditor** (tersedia untuk peran Auditor dan SPM) mengelola
bukti kompetensi auditor mutu internal:

- **Auditor** menambahkan sendiri sertifikat pelatihan SPMI dan sertifikat
  auditor yang dimiliki (nama, penyelenggara, nomor, tanggal terbit/berlaku
  sampai, dan berkas bukti), serta dapat mengubah/menghapus miliknya sendiri.
- **SPM** memantau pemenuhan kompetensi seluruh auditor dalam satu tampilan
  ringkas (status *Berlaku* / *Kedaluwarsa* / *Belum Ada* untuk tiap jenis
  sertifikat wajib), dan dapat menambah/mengubah/menghapus sertifikat atas
  nama auditor manapun bila diperlukan (mis. mengarsipkan sertifikat lama).

Status *Kedaluwarsa* dihitung otomatis dari `tanggal_kedaluwarsa` dibandingkan
tanggal hari ini — sertifikat tanpa tanggal kedaluwarsa dianggap berlaku
selamanya.

---

## Arsitektur Standar

Tulang punggungnya **SN Dikti** (Permendiktisaintek 39/2025), ditambah dua ranah
pelampauan untuk hal yang tidak diatur SN Dikti. Seluruhnya **30 standar**:
14 wajib dan 16 melampaui.

| Ranah | Kelompok | Jumlah |
|---|---|---|
| A. Pendidikan | Luaran · Proses · Masukan | 13 standar (8 wajib) |
| B. Penelitian | Luaran · Proses · Masukan | 3 standar (wajib) |
| C. Pengabdian kepada Masyarakat | Luaran · Proses · Masukan | 3 standar (wajib) |
| D. Tata Kelola dan Kelembagaan | — | 8 standar (melampaui) |
| E. Keberlanjutan dan Lingkungan Kampus | — | 3 standar (melampaui) |

Kode standar berpola `[Ranah].[Kelompok].[NN]`, dengan sufiks `+` untuk standar
yang melampaui SN Dikti — misalnya `A.M.05+` (K3L Praktik) dan `D.06`
(Integritas dan Reformasi Birokrasi).

**Lima aturan yang dijaga aplikasi:**

1. Judul standar bersifat `wajib` terkunci dan tidak dapat dihapus — pemenuhannya
   harus dapat dibuktikan dengan nomenklatur yang sama persis dengan regulasi.
2. Satu standar hanya menempati satu ranah. Keterkaitan lintas-ranah diurus lewat
   pemetaan acuan, bukan penempatan ganda.
3. **Satu standar boleh memuat lebih dari satu pernyataan standar**, dan setiap
   pernyataan boleh menaungi lebih dari satu indikator (lihat *Pernyataan Standar
   dan Adopsi Indikator* di bawah).
4. **Penanggung jawab ditetapkan pada tingkat indikator, bukan pernyataan standar.**
   Setiap indikator punya minimal satu unit pengampu yang akuntabel (boleh dua
   unit sekaligus bila memang akuntabilitasnya bersama, mis. Direktur dan Senat
   pada standar Visi/Misi/Tujuan/Strategi) dan boleh punya beberapa unit pelaksana.
5. Standar tidak dapat ditetapkan bila masih ada indikator tanpa unit pengampu.

Definisi 30 standar berikut seluruh pernyataan dan indikatornya ada di
`server/src/data/standar30.js`, bersumber dari **Peta Standar Gabungan PKTJ**
(dokumen kerja SPM yang memetakan seluruh 440 indikator siap-adopsi dari
ketujuh acuan mutu ke 30 standar mutu internal), dan dapat disunting langsung
sebelum `npm run reset`. Setiap standar juga memiliki kolom **Strategi
Pencapaian Standar** (strategi umum tingkat standar, terpisah dari strategi
tiap indikator) dan setiap indikator memiliki kolom **Bukti Sahih** (jenis
dokumen/rekaman pembuktian) — keduanya dapat diedit kapan pun lewat Modul 1
karena murni informasi milik institusi, bukan ditarik dari acuan.

### Pernyataan Standar dan Adopsi Indikator

Modul 1 memakai **tiga lapis**: Standar → Pernyataan Standar → Indikator.

```
A.L.01  Standar Kompetensi Lulusan
 ├─ Pernyataan 1  "Lulusan terserap di dunia kerja dengan cepat dan diakui pengguna"
 │    ├─ Indikator diadopsi dari SNDIKTI A.1   (masa tunggu kerja ≤ 6 bulan)
 │    └─ Indikator diadopsi dari LAMTEKNIKSTR 12.1 (kepuasan pengguna lulusan ≥ 3,5)
 └─ Pernyataan 2  "Lulusan memiliki sertifikat kompetensi tambahan"
      └─ Indikator ditulis manual            (80% lulusan bersertifikat)
```

Aturan kuncinya: **indikator yang diadopsi dari acuan ditarik apa adanya** —
judul/uraian, target, dan satuannya sama persis dengan butir aslinya saat
disimpan ulang lewat Modul 1, tidak digabung atau ditulis ulang lintas acuan.
Penggabungan hanya terjadi pada tingkat pernyataan: satu pernyataan boleh
menaungi indikator dari SN Dikti, LAM Teknik, GreenMetric, dsb. sekaligus,
masing-masing tetap berdiri sendiri secara redaksional. Bila standar belum
punya acuan yang relevan sama sekali, indikatornya boleh ditulis manual
(metode hibrida). Seluruh 440 indikator dari 30 standar bawaan berasal dari
adopsi acuan — tidak ada yang ditulis manual.

Kolom **strategi pencapaian indikator** dan **bukti sahih** adalah pengecualian:
keduanya murni tulisan SPM sendiri (dari Peta Standar Gabungan), bukan ditarik
dari acuan, sehingga tetap bisa disunting bebas meski indikatornya berstatus
adopsi. Sebagian kecil (47 dari 440) kolom target/satuan pada standar bawaan
juga sengaja dilokalkan dari Peta Standar Gabungan — mis. sebutan generik
acuan "perguruan tinggi"/"PTKL/LPNK" diganti "PKTJ", dan satuan indikator
ber-acuan BAN-PT/PTKL memakai teks "Pemenuhan (bukan skor 1-4)" alih-alih `-`
seperti pada acuan.js. **Perlu diperhatikan:** karena Modul 1 selalu menarik
ulang target/satuan dari `ref_items` setiap kali sebuah pernyataan disimpan,
menyimpan ulang salah satu dari 47 indikator ini lewat formulir (meski tanpa
perubahan) akan mengembalikan teksnya ke redaksi generik acuan.js, menimpa
pelokalan tersebut — perbarui `ref_items` di `data/acuan.js` terlebih dahulu
bila ingin pelokalan itu tetap bertahan setelah disimpan ulang.

Sebuah butir acuan baru bisa dipilih sebagai indikator setelah kolom **Target Pencapaian**-nya
diisi di menu Acuan Mutu — lihat bagian berikutnya.

## Acuan Mutu dan Pemetaannya

PKTJ memakai tujuh acuan sekaligus. Aplikasi memperlakukannya sebagai **rujukan**,
bukan sebagai kerangka — satu himpunan standar, banyak acuan yang menempel
secara banyak-ke-banyak. Auditee tetap mengisi sekali.

| Acuan | Isi bawaan |
|---|---|
| SN Dikti (Permendiktisaintek 39/2025 jo. 10/2026) | 3 standar utama (Pendidikan, Penelitian, PkM), 9 sub-standar, 14 butir standar, 56 indikator siap diadopsi (Pasal 6–63, redaksi kutipan verbatim pasal), satuan seragam "Pemenuhan (Sesuai/Tidak Sesuai)" — standar kepatuhan, bobot tidak berlaku |
| ISO 21001:2018 (EOMS) | 7 klausul utama (4–10), 29 sub-klausul/indikator siap diadopsi, satuan seragam "Konformitas (Sesuai/Tidak Sesuai)" — standar konformitas, bobot tidak berlaku |
| LAM Teknik Sarjana Terapan 2025 | 8 kriteria, 9 sub-kriteria, 76 indikator siap diadopsi (12 dari 64 indikator resmi berformula skor gabungan I+II dipecah jadi 2 butir terpisah, mis. LT-13a/LT-13b) |
| LAM Teknik Diploma III 2025 | 8 kriteria, 9 sub-kriteria, 67 indikator siap diadopsi (11 dari 45 indikator resmi berformula skor gabungan I+II dipecah jadi 2 butir terpisah, mis. D3-04a/D3-04b) |
| APT BAN-PT untuk PTKL (Perban-PT No.35/2025) | 6 kriteria, 24 sub-kriteria (Masukan/Proses/Luaran-Capaian/Dampak), 39 indikator siap diadopsi (satuan seragam `-`, bobot belum tersedia pada dokumen sumber) |
| UI GreenMetric 2026 | 7 kategori (termasuk Governance and Digitalization/GD yang baru), 60 indikator siap diadopsi, total 10.000 poin |
| LKE Zona Integritas | 2 komponen (A. Pengungkit → area Pemenuhan/Reform; B. Hasil → area Birokrasi Bersih-Akuntabel/Pelayanan Publik Prima), berjenjang hingga sub-area, 113 butir siap diadopsi (bobot total 100: Pengungkit 60, Hasil 40) |

Seluruh tujuh acuan sudah dimuat lengkap dengan redaksi dan target ke
`server/src/data/acuan.js`, disusun berjenjang: kriteria/klausul/komponen/standar
(payung) → sub-kriteria/area/sub-standar (payung) → indikator (leaf) — satu
sub-kriteria/klausul boleh menaungi lebih dari satu indikator sekaligus, cukup
dengan menambahkan beberapa node `tipe: 'butir'` sebagai anak dari satu node
payung.

Setiap indikator siap-adopsi punya dua kolom target yang terpisah: **Target
Pencapaian** (`target`, deskripsi kualitatif capaian) dan **Target Skor**
(`target_skor`, khusus acuan berbasis rubrik skor). Kedua acuan LAM Teknik
memakai rubrik skor 0–4: `target` diisi ringkasan syarat Skor 4, `target_skor`
diisi `"4 (Skor Maksimal)"`, dan `satuan` diisi `"Skor (skala 1-4)"`; redaksi
lengkapnya tetap di `uraian`. Kolom `bobot` pada tiap indikator LAM Teknik
mengikuti bobot resmi instrumen (total ±100 per acuan). Seluruh kolom ini
ditarik verbatim saat diadopsi ke Modul 1 — tidak digabung atau ditulis ulang.

**Catatan mutu sumber** (lihat juga `keterangan` tiap acuan di `data/acuan.js`):
seluruh 39 indikator APT BAN-PT untuk PTKL tidak mencantumkan bobot pada
dokumen sumber sehingga kolom `bobot` disimpan kosong untuk acuan ini; kolom
`satuan` diisi seragam `-` karena instrumen ini berbasis pemenuhan, bukan skala
numerik. ISO 21001:2018 juga tidak memakai bobot numerik (standar konformitas,
bukan instrumen berskor) sehingga kolom `bobot` disimpan kosong di seluruh 29
indikatornya; ISO 21001:2018 sendiri adalah dokumen komersial berhak cipta
ISO/BSN yang tidak diunggah penuh ke aplikasi ini — kolom `uraian` pada tiap
indikatornya merupakan **parafrase/interpretasi independen** atas maksud umum
klausul, bukan kutipan verbatim teks normatif resmi; untuk kepastian hukum dan
kepatuhan sertifikasi, rujuk teks resmi SNI ISO 21001:2018 dari BSN atau
lembaga sertifikasi terkait. SN Dikti juga tidak memakai bobot numerik (standar
kepatuhan berbasis pasal, bukan instrumen berskor) sehingga kolom `bobot`
disimpan kosong di seluruh 56 indikatornya; berbeda dengan ISO 21001, redaksi
`uraian` SN Dikti adalah **kutipan verbatim** Pasal 6–63 Permendiktisaintek
39/2025 karena merupakan peraturan pemerintah terbuka, bukan parafrase. Pada
kedua acuan LAM Teknik, satu butir per acuan (LT-62b dan D3-54b) juga tidak
mencantumkan bobot pada dokumen sumber sehingga disimpan kosong. Rujuk naskah
resmi masing-masing sebelum menjadikan redaksi ini dasar penilaian final. Bila
dokumen sumber diperbarui (mis. instrumen
BAN-PT pasca Permendiktisaintek 10/2026, kuesioner GreenMetric tahun berjalan,
atau LKE ZI edisi baru), impor ulang lewat menu **Acuan Mutu → Impor Butir**
untuk mengganti butir yang sudah ada.

### Mengunggah butir acuan

Menu **Acuan Mutu → pilih acuan → Impor Butir**. Susun di Excel dengan sebelas
kolom, blok, salin, lalu tempel:

| Kode | Judul | Uraian | Kode induk | Tipe | Bobot | Payung | Target Pencapaian | Target Skor | Satuan | Strategi |
|---|---|---|---|---|---|---|---|---|---|---|
| `LT-5` | Pendidikan | | | sub_kriteria | | ya | | | | |
| `LT-5.1` | Kurikulum | Program studi memiliki kurikulum… | `LT-5` | elemen | 4 | | | | | |
| `LT-12.1` | Kepuasan pengguna lulusan | Tingkat kepuasan pengguna lulusan minimal baik | `LT-12` | sub_kriteria | | | `>=3,5` | `4 (Skor Maksimal)` | skala 1-4 | Survei pengguna lulusan tahunan |

Butir dengan kode yang sudah ada akan **diperbarui**, bukan diduplikasi, sehingga
impor aman dijalankan berulang kali. Butir bertanda *payung* adalah judul
pengelompokan dan tidak dihitung dalam laporan cakupan. Butir dengan **Target
Pencapaian** terisi otomatis muncul di pemilih indikator Modul 1, siap diadopsi
apa adanya — bila kosong, butir itu hanya berperan sebagai struktur/kriteria,
bukan indikator. **Target Skor** adalah field terpisah khusus acuan berbasis
rubrik skor (mis. LAM Teknik: `4 (Skor Maksimal)`, satuan `Skor (skala 1-4)`) —
boleh dikosongkan untuk acuan yang tidak memakai skema skor.

Butir juga bisa diisi/diubah satu per satu lewat tombol **Butir** atau ikon pensil
pada baris butir, termasuk kolom Target Pencapaian/Target Skor/Satuan/Strategi-nya.

Kartu tiap acuan menampilkan jumlah **butir/indikator** (baris `wajib_petakan=1`,
bukan total baris termasuk payung) dan persentase yang **sudah diadopsi** — dihitung
dari indikator Modul 1 mana pun yang menautkan `source_ref_item_id` ke butir
tersebut (atau pemetaan lama lewat `ref_map`), bukan sekadar dipetakan longgar ke
standar.

### Cakupan Acuan

Menu **Cakupan Acuan** memeriksa dua arah sekaligus:

- **Maju** — butir acuan mana yang belum punya standar. Sebuah butir dianggap
  tercakup bila sudah **diadopsi langsung** sebagai indikator di Modul 1, atau
  ditautkan secara longgar lewat pemetaan tingkat standar. Setiap baris yang
  tersisa adalah lubang cakupan yang akan ditanyakan asesor.
- **Mundur** — standar mana yang tidak bersandar pada acuan mana pun (baik lewat
  adopsi indikator maupun pemetaan longgar). Bukan otomatis kesalahan, tetapi
  harus disadari dan punya alasan tercatat.

Cara utama menautkan acuan adalah **adopsi indikator**: di Modul 1, pada setiap
pernyataan standar, tombol **Pilih dari acuan** membuka pencarian lintas-acuan
dan menarik butir terpilih apa adanya menjadi indikator. Pemetaan longgar lewat
`ref_map` (tingkat standar) masih tersedia untuk penandaan struktural yang tidak
perlu diwakili sebagai indikator tersendiri.

## Alur Kerja Aplikasi

```
Modul 1  Penetapan Standar        SPM menyusun standar + indikator, menugaskan unit
   ↓                              → status "ditetapkan"
Modul 2  Pelaksanaan Standar      Auditee mengisi realisasi, capaian, bukti
   ↓                              → status "diserahkan"
Modul 3  Evaluasi Mutu Internal   Auditor menilai tiap indikator
   ↓                              → verdict KTS Mayor/Minor/Observasi otomatis
   ↓                                membentuk temuan + formulir tindakan koreksi
   ↓                              → Berita Acara ditandatangani auditor & auditee
Modul 4  Pengendalian             A. Auditee: analisis penyebab, koreksi sementara,
   ↓                                 rencana tindakan koreksi + rencana tanggal
   ↓                              B. Auditee: laporan realisasi
   ↓                              C. Auditor & SPM: efektivitas + tanggal penyelesaian
   ↓                              → temuan "ditutup" bila efektif
Modul 5  Rapat Tinjauan Manajemen Pimpinan membahas 16 butir agenda,
                                  menetapkan 3 kelompok keluaran
```

Di luar kelima modul siklus PPEPP di atas, menu **Penjaminan Mutu Eksternal
(SPME)** berjalan independen dan berisi tujuh instrumen akreditasi/sertifikasi
eksternal yang skornya ditarik otomatis dari hasil Modul 3 (lihat bagian
tersendiri di bawah).

### Modul 1 — Penetapan Standar

Diinput **Satuan Penjaminan Mutu**. Setiap standar memuat satu atau lebih
**pernyataan standar**, dan setiap pernyataan memuat satu atau lebih **indikator**
— baik diadopsi apa adanya dari Acuan Mutu maupun ditulis manual — lengkap dengan
target, satuan, strategi pencapaian, dan batas waktu. Setiap indikator ditugaskan
kepada satu unit pengampu dan boleh beberapa unit pelaksana. Standar berstatus
*draf* sampai ditetapkan; hanya standar yang telah ditetapkan yang muncul di
Modul 2.

### Modul 2 — Pelaksanaan Standar

Diinput **seluruh unit terkait (auditee)**. Lembar kerja menampilkan setiap
indikator yang menjadi tanggung jawab unit. Auditee mengisi uraian realisasi,
nilai **capaian** (bebas satuan — sesuai target indikator, bukan selalu persen;
lihat "Skala skor per acuan" di bawah), **skor** mandiri, dokumen/berkas bukti
(mendukung unggah berkas), dan kendala. Bila indikator diadopsi dari suatu acuan
eksternal, skor dibatasi otomatis sesuai skala resmi acuan tersebut (sama
seperti pembatasan pada Modul 3). Isian dapat disimpan sebagai draf lalu
diserahkan untuk diaudit.

### Modul 3 — Evaluasi Mutu Internal

Diisi **auditor**. Lembar penilaian menampilkan indikator berdampingan dengan
isian auditee. Auditor mengisi **capaian** (nilai realisasi sesuai satuan target
indikator — mis. rata-rata IPK, persentase luas vegetasi, atau jumlah orang;
lihat "Skala skor per acuan"), **skor** sesuai skala resmi acuan sumber indikator
(bila ada), hasil verifikasi bukti, dan menetapkan salah satu dari:
*Sesuai*, *Observasi*, *KTS Minor*, atau *KTS Mayor*.
Setiap ketidaksesuaian otomatis membentuk temuan bernomor (mis. `KTS/BAAK/2026/01`)
beserta formulir tindakan koreksi kosong di Modul 4.

Setiap indikator yang telah dinilai dapat dicetak sebagai **Audit Checklist**
(tombol "Audit Checklist" pada Lembar Penilaian), berisi nama standar,
indikator, catatan auditor, dan hasil penilaian (Sesuai/Observasi/KTS
Minor/KTS Mayor), dikelompokkan per standar.

Hasil audit diterbitkan sebagai **Berita Acara** siap cetak A4 dengan kop institusi,
ringkasan penilaian, daftar ketidaksesuaian, observasi, dan kesimpulan. Baris
"rata-rata capaian" pada ringkasan memakai **skor** (bukan nilai capaian bebas
satuan, yang sejak revisi skor berskala tidak lagi sebanding lintas indikator),
dikelompokkan **per acuan sumber indikator** karena skalanya berbeda-beda:
acuan berbasis rubrik multi-level (mis. LAM Teknik 1–4, UI GreenMetric 1–5)
ditampilkan sebagai "Rerata skor", sedangkan acuan berskala 0/1 (BAN-PT,
ISO 21001, SNDIKTI, Zona Integritas) ditampilkan sebagai "Persentase indikator
terpenuhi". Indikator SPMI yang tidak diadopsi dari acuan eksternal apa pun
ditampilkan tersendiri sebagai rerata skor mentah.
Berita acara menjadi sah setelah **ditandatangani auditor dan auditee** melalui
kanvas tanda tangan digital (tetikus atau layar sentuh); status audit berubah
menjadi *ditandatangani* dan seluruh temuan diteruskan ke Modul 4. Tombol
"Tarik Tanda Tangan" mengizinkan penanda tangan (auditor atau auditee)
membatalkan tanda tangannya sendiri kapan pun; bila berita acara sudah sah,
status audit kembali ke *selesai* sampai ditandatangani ulang.

Jadwal audit satu periode dapat dicetak sebagai **Formulir Jadwal Pelaksanaan
Audit Internal** (tombol "Cetak Jadwal Audit"), mengikuti format formulir baku
PKTJ (FRM.08): tabel Hari/Tanggal, Jam, Divisi yang diaudit, Tim Audit (ketua
dan anggota), dan Persyaratan Standar, diurutkan kronologis. Ketua tim auditor
diisi saat menjadwalkan audit; anggota tim tambahan dapat dipilih lewat daftar
centang pada modal yang sama, dan jam pelaksanaan diisi bebas (mis. "09.00 –
11.00 WIB"). Kolom **Persyaratan Standar** terisi otomatis dari nama standar
(kode — judul) yang ditugaskan ke unit terkait pada lembar penilaian, tidak
perlu diisi manual. Formulir hanya memuat satu kotak pengesahan, **"Disetujui oleh
Satuan Penjaminan Mutu"**, memakai tanda tangan digital: tombol "Setujui &
Tanda Tangani" pada halaman cetak (dapat dibubuhkan oleh anggota SPM mana
pun, bukan hanya Ketua) langsung menampilkan tanda tangan di formulir.
Tombol "Tarik Persetujuan" mengizinkan anggota SPM mana pun membatalkan
tanda tangan tersebut bila diperlukan.

### Modul 4 — Pengendalian Standar

Tiga bagian berurutan:

- **A. Formulir tindakan koreksi** (auditee) — analisis penyebab masalah,
  koreksi sementara, rencana tindakan koreksi, rencana tanggal penyelesaian,
  penanggung jawab.
- **B. Laporan realisasi** (auditee) — uraian realisasi, bukti, tanggal.
- **C. Pemantauan** (auditor & SPM) — efektivitas tindakan koreksi
  (*efektif* / *belum efektif* / *tidak efektif*), catatan verifikasi, dan tanggal
  penyelesaian. Temuan ditutup otomatis bila dinilai efektif.

Tenggat yang terlewat ditandai secara visual di daftar pengendalian dan beranda.

Setiap temuan memiliki **Formulir PTK** resmi yang dapat dicetak (tombol
"Formulir PTK" pada detail tindakan koreksi), mengikuti format formulir
Permintaan Tindakan Koreksi baku PKTJ lengkap dengan KOP surat dan tiga titik
tanda tangan digital: Auditor (uraian temuan), Teraudit (rencana tindakan
koreksi), dan Auditor (tinjauan efektivitas pada audit berikutnya). Daftar
seluruh PTK pada satu unit/periode juga dapat dicetak sebagai register lewat
tombol "Cetak Daftar PTK" pada halaman Pengendalian.

### Modul 5 — Rapat Tinjauan Manajemen

Dipimpin **Direktur dan Wakil Direktur I, II, III**. Nomor rapat dibuat
otomatis mengikuti pola `RTM/{urut}/PKTJ/{tahun}` (mis. `RTM/01/PKTJ/2026`,
`RTM/02/PKTJ/2026`, ...) berurutan per periode dan tidak dapat diubah manual.
Jam mulai dan selesai rapat diisi lewat pemilih jam, bukan diketik bebas.
Setiap rapat otomatis dibuatkan 16 butir agenda:

1. Status RTM sebelumnya
2. Perubahan dalam masalah eksternal dan internal yang relevan dengan SMOP
3. Informasi tentang kinerja dan efektivitas SMOP
   - 3a Kepuasan pemangku kepentingan (IKM)
   - 3b Pencapaian kinerja / Sasaran mutu
   - 3c Efektivitas dan kesesuaian produk dan layanan
   - 3d Ketidaksesuaian dan tindakan koreksi
   - 3e Pemantauan dan pengukuran hasil
   - 3f Hasil Audit
   - 3g Kinerja penyedia eksternal
   - 3h Nilai formatif dan sumatif
4. Kecukupan Sumber Daya
5. Efektivitas identifikasi risiko dan peluang
6. Peluang untuk perbaikan berkelanjutan
7. Umpan balik staf berkaitan dengan peningkatan kompetensinya

Tombol **Tarik Bahan Rapat** mengumpulkan data dari Modul 1–4 (hasil audit,
rekap ketidaksesuaian, capaian sasaran mutu per kelompok standar, status keluaran
RTM sebelumnya, progres pelaksanaan per unit) dan dapat disisipkan langsung ke
kolom data pendukung butir agenda terkait.

Setiap butir agenda memiliki empat isian: **Pembahasan**, **Data pendukung**,
**Kesimpulan / keputusan**, dan **PIC** (unit atau orang yang bertanggung
jawab atas keputusan butir tersebut).

Keluaran rapat dicatat dalam tiga kelompok wajib, ditampilkan pada tab Agenda
tepat di bawah butir agenda nomor 7 (butir agenda terakhir), berurutan:

1. Kebutuhan perubahan untuk SMOP
2. Kebutuhan sumber daya
3. Peluang untuk perbaikan yang diprogramkan

Setiap keluaran memiliki unit pelaksana, penanggung jawab, target tanggal, dan
status tindak lanjut yang terpantau hingga RTM berikutnya (pemutakhiran
realisasi oleh auditee tetap berjalan meski notulen sudah disahkan).

**Pengesahan notulen berjenjang tiga tanda tangan digital** (bagian "Alur
Pengesahan Notulen" pada detail RTM):

1. **Notulen** (sesuai `notulis_id` rapat, atau SPM) membubuhkan tanda tangan
   lewat tombol "Sahkan Notulen" setelah agenda dan keluaran selesai diisi.
   Status berubah ke *menunggu verifikasi SPM* dan seluruh isi rapat (agenda,
   keluaran, peserta, jadwal) terkunci. Selama tahap ini, Notulen masih dapat
   menekan **"Tarik Pengesahan"** untuk membatalkan dan membuka kembali
   isian bila ada yang perlu diperbaiki.
2. **Kepala SPM** — wajib akun berperan `spm` dengan jabatan mengandung
   "Kepala"/"Ketua" (mis. "Ketua Satuan Penjaminan Mutu"); anggota SPM lain
   seperti Sekretaris SPM tidak berwenang di tahap ini — meninjau lalu
   memilih **Setuju** (membubuhkan tanda tangan, status lanjut ke *menunggu
   Direktur*) atau **Tolak** (mengisi alasan; tanda tangan Notulen dihapus
   otomatis, status kembali ke *ditolak SPM* dan isian rapat terbuka lagi
   untuk diperbaiki dan disahkan ulang oleh Notulen). Selama masih *menunggu
   Direktur*, Kepala SPM dapat menekan **"Tarik Persetujuan"** untuk
   membatalkan persetujuannya dan kembali ke tahap verifikasi.
3. **Direktur** (pemimpin rapat, atau peran pimpinan lain) membubuhkan tanda
   tangan final setelah disetujui SPM; status menjadi *ditandatangani* dan
   notulen terkunci permanen. Direktur dapat menekan **"Tarik Tanda Tangan"**
   untuk membuka kembali notulen ke tahap *menunggu Direktur* bila ternyata
   perlu ditandatangani ulang.

Jadwal RTM (agenda, peserta, keluaran) terkunci begitu memasuki alur
pengesahan dan hanya bisa dihapus oleh pimpinan/SPM selama masih berstatus
*rencana* atau *ditolak SPM*. **Administrator** dikecualikan dari kuncian ini
dan dapat menghapus jadwal RTM pada status apa pun, termasuk yang sudah
*ditandatangani*, untuk keperluan koreksi data.

Ketiga tanda tangan otomatis tampil pada halaman **Cetak Notulen** (format
**Risalah Tinjauan Manajemen** baku PKTJ/FRM.13) begitu dibubuhkan — tidak
perlu langkah manual tambahan. Halaman cetak menampilkan kotak
Tempat/Tgl/Waktu, Ketua Rapat, Notulis, Peserta rapat (yang hadir), daftar
Agenda Rapat, tabel **Hasil Rapat** (Uraian Hasil Rapat, Tindak Lanjut, PIC —
satu baris per butir agenda, diisi dari Pembahasan, Kesimpulan, dan PIC butir
tersebut), tabel **Keluaran RTM** (tiga kelompok keluaran wajib, berurutan:
Kebutuhan Perubahan untuk SMOP, Kebutuhan Sumber Daya, Peluang untuk
Perbaikan yang Diprogramkan) tepat di bawahnya, dan blok pengesahan tiga
kolom: Disiapkan oleh (Notulen), Diperiksa oleh (Kepala SPM), Disetujui oleh
(Direktur).

---

## Sistem Penjaminan Mutu Eksternal (SPME)

Menu tersendiri di sidebar, **setara dengan Acuan Mutu, Siklus PPEPP, dan
Pengaturan** — bukan bagian dari lima modul PPEPP di atas karena berjalan
independen dari siklus tahunan Penetapan–Pelaksanaan–Evaluasi–Pengendalian–
Tinjauan. Dipantau **Satuan Penjaminan Mutu**, terbuka untuk dilihat semua
peran. Sidebar menampilkan setiap instrumen sebagai tautan langsung (bukan
lewat halaman ringkasan), dikelompokkan menjadi lima kebutuhan penjaminan:

1. **Akreditasi Perguruan Tinggi** — acuan BAN-PT (Perban-PT No. 35 Tahun 2025)
2. **Akreditasi Program Studi** — satu instrumen per unit program studi yang
   terdaftar di Data Master, dibangkitkan otomatis (lihat "Prodi dan jenjang
   bersifat pengaturan" di bawah); bawaan aplikasi:
   - Akreditasi Prodi RSTJ — acuan LAM Teknik Sarjana Terapan
   - Akreditasi Prodi TRO — acuan LAM Teknik Sarjana Terapan
   - Akreditasi Prodi TO — acuan LAM Teknik Diploma III
3. **ISO 21001** — acuan ISO 21001:2018 (EOMS)
4. **Zona Integritas (WBK-WBBM)** — acuan Lembar Kerja Evaluasi Zona Integritas
5. **UI GreenMetric** — acuan UI GreenMetric World University Rankings

### Prodi dan jenjang bersifat pengaturan, bukan kode

Daftar instrumen akreditasi program studi **tidak di-hardcode**. Setiap unit
di Data Master bertipe "Program Studi" punya atribut **Jenjang** (mis.
"Sarjana Terapan", "Diploma III", atau nilai baru apa pun yang diketik SPM).
Setiap acuan di menu Acuan Mutu juga bisa ditandai **Jenjang** yang sama
(field ini hanya relevan untuk acuan akreditasi prodi seperti LAM Teknik;
dikosongkan untuk acuan institusi seperti ISO 21001/ZI/GreenMetric/BAN-PT).
SPME mencocokkan keduanya: setiap prodi otomatis mendapat satu instrumen
"Akreditasi Prodi [nama]" yang dinilai memakai acuan berjenjang sama persis.

Jadi menambah program studi baru — termasuk dengan **jenjang yang sama sekali
baru**, mis. Magister Terapan — tidak memerlukan perubahan kode:

1. SPM menambahkan unit prodi baru di **Data Master**, mengisi Jenjang
   (memilih dari daftar yang sudah ada, atau mengetik nama jenjang baru).
2. Instrumen "Akreditasi Prodi [nama]" langsung muncul di sidebar dan halaman
   SPME. Bila jenjangnya belum punya acuan yang cocok, kartunya tetap tampil
   dengan status "acuan belum tersedia" beserta jenjang yang dicari.
3. Bila jenjang tersebut memang belum pernah ada acuan LAM-nya, SPM membuat
   acuan baru di menu **Acuan Mutu** (tombol "Acuan Baru") — mengisi kode,
   nama, dan menandai **Jenjang** persis sama dengan yang diisi di langkah 1
   — lalu menambahkan butir beserta bobotnya satu per satu (atau lewat
   templat impor tempel-dari-Excel yang sudah ada).
4. Begitu acuan itu tersimpan, instrumen SPME prodi tersebut otomatis
   berubah jadi "tersedia" dan mulai dinilai — tanpa perlu me-restart atau
   mengubah kode aplikasi sama sekali.

Kunci internal setiap instrumen prodi memakai id unit (bukan kode/nama),
supaya riwayat skor dan koreksi manualnya tidak putus meski kode atau nama
prodi diedit belakangan.

Setiap halaman detail instrumen menyediakan dua komponen tampilan yang bisa
dipilih lewat tab di atas kontennya:

- **Penilaian** — tabel pohon butir acuan (kode, uraian, bobot, capaian,
  sumber nilai), tempat Satuan Penjaminan Mutu meninjau dan mengoreksi nilai.
- **Grafik Radar** — diagram radar (laba-laba) yang memetakan skor per
  kategori/kriteria utama acuan tersebut sebagai satu sumbu (mis. 8 kriteria
  untuk LAM Teknik, 6 kriteria untuk BAN-PT, 7 klausul untuk ISO 21001, 4
  komponen untuk Zona Integritas, 7 kategori untuk GreenMetric), memakai
  persen tertimbang per kategori untuk instrumen berbobot atau rata-rata
  capaian untuk instrumen tanpa bobot resmi — memudahkan melihat kategori
  mana yang masih lemah secara sekilas.

### Skala skor per acuan

Setiap acuan eksternal punya **skala skor resmi sendiri** (bukan persen),
ditandai pada `refs.skor_min` / `skor_maks` / `skor_step` dan dapat diedit
lewat menu Acuan Mutu:

| Acuan | Skala skor | Arti |
|---|---|---|
| SNDIKTI | 0 – 1 | 0 = tidak memenuhi, 1 = memenuhi (dipakai di Modul 2 & 3 saja, bukan instrumen SPME) |
| BAN-PT | 0 – 1 | 0 = tidak memenuhi, 1 = memenuhi |
| LAM Teknik (Sarjana Terapan) | 1 – 4, nilai riil/desimal | skor butir sesuai rubrik LAM Teknik, boleh pecahan (mis. 3,7 atau 2,5), bukan hanya bilangan bulat |
| LAM Teknik Diploma III | 1 – 4, nilai riil/desimal | skor butir sesuai rubrik LAM Teknik, boleh pecahan (mis. 3,7 atau 2,5), bukan hanya bilangan bulat |
| ISO 21001 | 0 – 1 | 0 = tidak sesuai, 1 = sesuai (conform) |
| UI GreenMetric | 1 – 5 | skala penilaian 1 (terendah) sampai 5 (tertinggi) |
| Zona Integritas (WBK-WBBM) | 0 – 1, kelipatan 0,25 | mengizinkan nilai antara (0 / 0,25 / 0,5 / 0,75 / 1) |

Skala ini **membatasi input skor pada Modul 2 (isian mandiri auditee) dan
Modul 3 (penilaian auditor)**: formulir otomatis memasang batas
minimum/maksimum/kelipatan sesuai acuan asal indikator yang sedang dinilai,
dan server menolak nilai di luar skala tersebut pada kedua modul. Indikator
yang tidak berasal dari acuan manapun (ditulis manual oleh SPM) tetap bebas
tanpa batasan skala.

Skor ini terpisah dari nilai **capaian**, yang isinya bebas mengikuti satuan
target indikator masing-masing dan bukan selalu persen — mis. rata-rata IPK
lulusan diisi "3,4", persentase area kampus tertutup vegetasi diisi "20%",
dan Kecukupan Jumlah DTPS diisi "12 orang". Formulir Modul 2 dan Modul 3
menampilkan label serta satuan capaian mengikuti kolom `satuan` pada
indikator, bukan format persen tetap.

Setiap instrumen memakai butir dan bobot resmi yang sudah tersedia di menu
**Acuan Mutu** (lihat "Acuan Mutu dan Pemetaannya"). **Skor** tiap butir
(bukan persen) **ditarik otomatis** — bukan diisi ulang dari nol — dari
rata-rata `skor` hasil penilaian auditor pada Modul 3, atas seluruh indikator
yang diadopsi verbatim (`source_ref_item_id`) atau dipetakan (`ref_map`) dari
butir acuan tersebut. Untuk instrumen akreditasi program studi, rata-rata
hanya dihitung dari audit unit program studi bersangkutan; instrumen lain
(BAN-PT, ISO 21001, Zona Integritas, GreenMetric) tidak dibatasi per unit
karena berlaku institusi.

**Skor tertimbang** dihitung otomatis untuk instrumen yang acuannya sudah
punya bobot resmi terisi pada butirnya (dideteksi langsung dari data, bukan
ditandai manual per instrumen) — begitu SPM melengkapi bobot pada acuan baru,
instrumen itu otomatis mulai menghitung skor tertimbang, memakai skor mentah
(bukan persen), tepat seperti cara kerja borang akreditasi LAM Teknik/ZI yang
sesungguhnya:

```
kontribusi butir   = bobot butir × skor efektif           (skor pada skala aslinya, mis. 0-4)
skor tertimbang    = jumlah seluruh kontribusi butir       (angka mentah, mis. bisa sampai ~400 untuk LAM Teknik)
bobot maksimal     = jumlah bobot seluruh butir (termasuk yang belum dinilai)
persen tertimbang  = skor tertimbang ÷ (bobot maksimal × skor maksimal acuan) × 100
```

Pembagian dengan skor maksimal acuan pada langkah terakhir membuat "persen
tertimbang" tetap bisa dibandingkan lintas instrumen meski skala skor
aslinya berbeda-beda (0-1, 0-4, atau 1-5). Butir yang belum pernah diaudit
tetap dihitung dalam bobot maksimal (sebagai bobot yang belum "diraih")
namun menyumbang nol pada skor tertimbang. Dua instrumen yang belum memiliki
bobot resmi pada dokumen sumber (BAN-PT dan ISO 21001) hanya menampilkan
rata-rata skor (dinormalisasi ke persen memakai skor maksimalnya) per butir,
**tanpa skor tertimbang**.

Satuan Penjaminan Mutu dapat **mengoreksi skor secara manual** per butir
(tombol edit pada halaman detail instrumen, dibatasi sesuai skala resmi
acuan yang sama seperti Modul 3) bila nilai otomatis dari audit belum
mencerminkan kondisi terkini; koreksi ini menggantikan nilai otomatis pada
perhitungan skor sampai dikembalikan lewat tombol "kembalikan ke otomatis".
Periode penilaian SPME mengikuti periode SPMI aktif yang sama dengan
Modul 1–5.

---

## Struktur Organisasi & Standar Bawaan

**17 unit organisasi:** Direktorat, Senat, Satuan Pemeriksaan Intern, Satuan
Penjaminan Mutu, Pusbangkar, P3M, BAAK, Bagian KUK, tiga program studi
(Sarjana Terapan Rekayasa Sistem Transportasi Jalan, Sarjana Terapan Teknologi
Rekayasa Otomotif, Diploma III Teknologi Otomotif), serta Unit Laboratorium,
Bahasa, Teknik Informatika, Kesehatan, Asrama, dan Pengembangan Usaha.

**16 standar mutu / 60 indikator**, dikelompokkan menurut tujuh kriteria
akreditasi LAM Teknik 2025 dan dipetakan ke klausul ISO 21001:2018:

| Kriteria LAM Teknik | Standar |
|---|---|
| K1 Diferensiasi Misi | STD-01 Visi, Misi, Tujuan, dan Strategi |
| K2 Akuntabilitas | STD-02 Tata Pamong, Tata Kelola, dan Kerja Sama · STD-15 Pengelolaan Keuangan dan Penyedia Eksternal |
| K3 Relevansi Pendidikan, Penelitian, PkM | STD-03 Kompetensi Lulusan · STD-04 Isi dan Kurikulum · STD-05 Proses Pembelajaran · STD-06 Penilaian Formatif dan Sumatif · STD-07 Penelitian dan PkM |
| K4 Sumber Daya Manusia | STD-08 Dosen dan Tenaga Kependidikan |
| K5 Sarana, Prasarana, K3L | STD-09 Sarana dan Prasarana · STD-10 Keselamatan, Kesehatan Kerja, dan Lingkungan |
| K6 Mahasiswa dan Luaran | STD-11 Ketarunaan dan Pembangunan Karakter |
| K7 Sistem Penjaminan Mutu | STD-12 SPMI · STD-13 Kepuasan Pemangku Kepentingan · STD-14 Risiko dan Peluang · STD-16 Sistem Informasi dan Dokumen Terkendali |

Seluruh standar bawaan dapat diubah, ditambah, atau dihapus melalui Modul 1.

---

## Arsitektur

```
Aplikasi Evaluasi Mutu Internal/
├── server/                     Backend — Node.js + Express + SQLite
│   ├── src/
│   │   ├── index.js            Titik masuk aplikasi
│   │   ├── db.js               Koneksi better-sqlite3
│   │   ├── schema.sql          19 tabel basis data
│   │   ├── auth.js             JWT, middleware peran, kontrol akses unit
│   │   ├── seed.js             Data awal PKTJ
│   │   └── routes/             auth · master · standar · pelaksanaan ·
│   │                           emi · pengendalian · rtm · dashboard
│   └── data/                   Basis data & berkas bukti (dibuat otomatis)
└── client/                     Frontend — React 18 + Vite + Tailwind CSS
    └── src/
        ├── api.js              Klien HTTP dan utilitas tampilan
        ├── auth.jsx            Konteks autentikasi
        ├── components/         Layout, komponen UI, kanvas tanda tangan
        └── pages/              Beranda + halaman kelima modul
```

**Kontrol akses:** JWT dengan lima peran (`admin`, `spm`, `auditor`, `auditee`,
`pimpinan`). Auditee hanya dapat membaca dan mengubah data unitnya sendiri;
pembatasan ini ditegakkan di sisi server, bukan sekadar di antarmuka.

**Keluaran cetak:** Berita Acara EMI, formulir tindakan koreksi, dan notulen RTM
memiliki gaya cetak A4 tersendiri — gunakan **Cetak → Simpan sebagai PDF**.

---

## Catatan Pengembangan Lanjutan

- Basis data SQLite disimpan di `server/data/emi-pktj.db`. Cadangkan berkas ini
  secara berkala. Untuk penggunaan lintas kampus dengan konkurensi tinggi,
  skema dapat dipindahkan ke PostgreSQL tanpa perubahan struktur tabel.
- Ganti `JWT_SECRET` sebelum digunakan di lingkungan produksi.
- Berkas bukti tersimpan di `server/data/uploads/` dengan batas 10 MB per berkas.
