-- =====================================================================
-- Aplikasi Evaluasi Mutu Internal (EMI) - Politeknik Keselamatan
-- Transportasi Jalan (PKTJ)
-- Skema basis data SQLite
-- =====================================================================

PRAGMA foreign_keys = ON;

-- ---------------------------------------------------------------------
-- MASTER: Unit / Struktur Organisasi
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS units (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  code        TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  type        TEXT NOT NULL,            -- pimpinan | prodi | satuan | pusat | bagian | unit | senat | sub_unit
  jenjang     TEXT,                     -- khusus type='prodi': Diploma III | Sarjana Terapan | dst.
                                         -- menentukan acuan akreditasi (refs.jenjang) yang dipakai di SPME
  parent_id   INTEGER REFERENCES units(id) ON DELETE SET NULL,
                                         -- khusus type='sub_unit': unit induknya (mis. Akademik → BAAK).
                                         -- Dipakai sasaran mutu (program_kerja.sub_unit_id) sebagai pilihan
                                         -- opsional saat unit induknya punya sub-unit terdaftar.
  is_active   INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

-- ---------------------------------------------------------------------
-- MASTER: Pengguna
-- role: admin | spm | auditor | auditee | pimpinan
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  nip           TEXT UNIQUE,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL,
  jabatan       TEXT,
  unit_id       INTEGER REFERENCES units(id) ON DELETE SET NULL,
  is_active     INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

-- Kompetensi/sertifikat yang dimiliki auditor (pelatihan SPMI, sertifikat
-- auditor, dsb). Diisi mandiri oleh auditor, dipantau pemenuhannya oleh SPM
-- lewat menu Manajemen Auditor.
CREATE TABLE IF NOT EXISTS auditor_certificates (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id             INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  jenis               TEXT NOT NULL,
                      -- pelatihan_spmi | sertifikat_auditor | lainnya
  nama                TEXT NOT NULL,
  penyelenggara       TEXT,
  nomor_sertifikat    TEXT,
  tanggal_terbit      TEXT,
  tanggal_kedaluwarsa TEXT,
  berkas_url          TEXT,
  keterangan          TEXT,
  created_by          INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at          TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  updated_at          TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE INDEX IF NOT EXISTS idx_auditor_certificates_user ON auditor_certificates(user_id);

-- ---------------------------------------------------------------------
-- MASTER: Periode / Siklus SPMI
-- status: draft | aktif | selesai
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS periods (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL,
  year        INTEGER NOT NULL,
  start_date  TEXT,
  end_date    TEXT,
  status      TEXT NOT NULL DEFAULT 'draft',
  created_at  TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

-- =====================================================================
-- MODUL 1 : PENETAPAN STANDAR  (diinput oleh Satuan Penjaminan Mutu)
-- =====================================================================
CREATE TABLE IF NOT EXISTS standards (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  period_id     INTEGER NOT NULL REFERENCES periods(id) ON DELETE CASCADE,
  code          TEXT NOT NULL,          -- mis. A.M.05+
  category      TEXT NOT NULL,          -- label ranah-kelompok untuk tampilan
  ranah         TEXT,                   -- A | B | C | D | E
  kelompok      TEXT,                   -- L (luaran) | P (proses) | M (masukan) | NULL
  sifat         TEXT NOT NULL DEFAULT 'wajib',  -- wajib (SN Dikti) | melampaui
  title         TEXT NOT NULL,
  statement     TEXT,                   -- USANG: dipertahankan untuk kompatibilitas lama.
                                         -- Pernyataan standar kini ada di standard_statements.
  rationale     TEXT,                   -- rasionale keberadaan standar ini secara umum
  reference_iso TEXT,                   -- USANG
  reference_lam TEXT,                   -- USANG
  scope         TEXT,                   -- ruang lingkup
  strategy      TEXT,                   -- strategi pencapaian standar secara umum
  status        TEXT NOT NULL DEFAULT 'draft',  -- draft | ditetapkan | arsip
  ditetapkan_at TEXT,
  ditetapkan_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_by    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  UNIQUE (period_id, code)
);

-- Pernyataan standar: satu standar boleh memiliki LEBIH DARI SATU pernyataan
-- (mis. A.L.01 dapat memuat pernyataan tentang capaian pembelajaran DAN
-- pernyataan tentang sertifikasi kompetensi secara terpisah).
CREATE TABLE IF NOT EXISTS standard_statements (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  standard_id   INTEGER NOT NULL REFERENCES standards(id) ON DELETE CASCADE,
  label         TEXT,                   -- judul singkat opsional, mis. "Capaian Pembelajaran"
  statement     TEXT NOT NULL,          -- rumusan pernyataan (pola ABCD)
  rationale     TEXT,                   -- rasionale pernyataan ini secara spesifik
  sort_order    INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS standard_indicators (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  standard_id   INTEGER NOT NULL REFERENCES standards(id) ON DELETE CASCADE,
  statement_id  INTEGER REFERENCES standard_statements(id) ON DELETE CASCADE,
  code          TEXT NOT NULL,
  indicator     TEXT NOT NULL,
  target        TEXT,                   -- target pencapaian (mis. "100%", ">= 3.5")
  target_skor   TEXT,                   -- target skor bila acuan sumbernya berbasis rubrik skor
  satuan        TEXT,                   -- satuan ukur
  strategy      TEXT,                   -- strategi pencapaian
  bukti_sahih   TEXT,                   -- jenis bukti/dokumen sahih yang membuktikan pemenuhan
  deadline      TEXT,                   -- batas waktu pencapaian
  -- Bila terisi: indikator ini ditarik APA ADANYA dari butir acuan tersebut
  -- (judul, target, satuan tidak diubah/digabung). Kosong = diketik manual.
  source_ref_item_id INTEGER REFERENCES ref_items(id) ON DELETE SET NULL,
  sort_order    INTEGER NOT NULL DEFAULT 0
);

-- Penanggung jawab ditetapkan pada tingkat INDIKATOR, bukan pernyataan standar.
-- Satu indikator boleh diampu satu unit dan dilaksanakan beberapa unit.
CREATE TABLE IF NOT EXISTS indicator_assignments (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  indicator_id INTEGER NOT NULL REFERENCES standard_indicators(id) ON DELETE CASCADE,
  unit_id      INTEGER NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  peran        TEXT NOT NULL DEFAULT 'pelaksana',  -- pengampu | pelaksana
  UNIQUE (indicator_id, unit_id)
);

-- =====================================================================
-- ACUAN MUTU EKSTERNAL DAN PEMETAANNYA
-- =====================================================================

-- Daftar acuan yang berlaku di PKTJ
CREATE TABLE IF NOT EXISTS refs (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  code           TEXT NOT NULL UNIQUE,   -- ISO21001 | LAMTEKNIKSTR | GREENMETRIC | ZI | BANPT | SNDIKTI
  name           TEXT NOT NULL,
  version        TEXT,                   -- mis. "2025 (pemutakhiran 12 November 2025)"
  publisher      TEXT,
  effective_date TEXT,
  warna          TEXT,                   -- kode warna untuk lensa pelaporan
  keterangan     TEXT,
  jenjang        TEXT,                   -- diisi hanya untuk acuan akreditasi program studi
                                         -- (mis. "Sarjana Terapan", "Diploma III"); dipakai SPME
                                         -- untuk mencocokkan acuan ini ke unit prodi berjenjang sama
  skor_min       REAL,                   -- batas bawah skala skor resmi acuan ini (mis. 0)
  skor_maks      REAL,                   -- batas atas skala skor resmi acuan ini (mis. 1, 4, atau 5)
  skor_step      REAL,                   -- kelipatan skor yang sah (mis. 1 untuk skala utuh,
                                         -- 0.25 untuk ZI yang mengizinkan nilai antara)
  is_active      INTEGER NOT NULL DEFAULT 1,
  sort_order     INTEGER NOT NULL DEFAULT 0,
  created_at     TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

-- Butir acuan, hierarkis: kriteria → sub-kriteria → elemen penilaian
CREATE TABLE IF NOT EXISTS ref_items (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  ref_id        INTEGER NOT NULL REFERENCES refs(id) ON DELETE CASCADE,
  parent_id     INTEGER REFERENCES ref_items(id) ON DELETE CASCADE,
  code          TEXT NOT NULL,          -- "7.1.2" | "K5" | "5.2" | "WS-3"
  title         TEXT NOT NULL,
  uraian        TEXT,                   -- redaksi lengkap butir dari dokumen asli
  tipe          TEXT NOT NULL DEFAULT 'butir',
                -- klausul | kriteria | sub_kriteria | elemen | kategori | area | butir
  level         INTEGER NOT NULL DEFAULT 1,
  bobot         REAL,                   -- untuk acuan berbobot (GreenMetric, LKE ZI)
  wajib_petakan INTEGER NOT NULL DEFAULT 1,  -- 0 untuk butir payung/judul
  -- Kolom berikut mengubah butir menjadi INDIKATOR siap tarik ke Modul 1.
  -- Terisi target berarti butir ini dapat diadopsi apa adanya sebagai indikator.
  target        TEXT,                   -- Target Pencapaian (deskripsi kualitatif capaian)
  target_skor   TEXT,                   -- Target Skor (mis. "4 (Skor Maksimal)"), khusus acuan berbasis rubrik skor
  satuan        TEXT,
  strategy      TEXT,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  UNIQUE (ref_id, code)
);

-- Pemetaan butir acuan ke standar dan/atau indikator (banyak-ke-banyak)
CREATE TABLE IF NOT EXISTS ref_map (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  ref_item_id  INTEGER NOT NULL REFERENCES ref_items(id) ON DELETE CASCADE,
  standard_id  INTEGER REFERENCES standards(id) ON DELETE CASCADE,
  indicator_id INTEGER REFERENCES standard_indicators(id) ON DELETE CASCADE,
  kekuatan     TEXT NOT NULL DEFAULT 'utama',   -- utama | pendukung
  catatan      TEXT,
  created_by   INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at   TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

-- NULL dianggap berbeda oleh UNIQUE biasa, sehingga dipakai indeks berekspresi
CREATE UNIQUE INDEX IF NOT EXISTS idx_ref_map_unik
  ON ref_map (ref_item_id, COALESCE(standard_id,0), COALESCE(indicator_id,0));

-- =====================================================================
-- MODUL 2 : PELAKSANAAN STANDAR  (diinput oleh Auditee / unit terkait)
-- =====================================================================
CREATE TABLE IF NOT EXISTS implementations (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  period_id      INTEGER NOT NULL REFERENCES periods(id) ON DELETE CASCADE,
  standard_id    INTEGER NOT NULL REFERENCES standards(id) ON DELETE CASCADE,
  indicator_id   INTEGER NOT NULL REFERENCES standard_indicators(id) ON DELETE CASCADE,
  unit_id        INTEGER NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  realisasi      TEXT,                  -- uraian pelaksanaan / capaian
  capaian_nilai  REAL,                  -- nilai capaian sesuai SATUAN target indikator —
                                         -- bukan selalu persen (mis. IPK 3.4, luas vegetasi 20%,
                                         -- jumlah DTPS 12 orang); lihat standard_indicators.satuan
  skor           REAL,                  -- skor mandiri auditee sesuai skala resmi acuan indikator
                                         -- (mis. 1-4 riil/desimal untuk LAM Teknik, 0/1 untuk pemenuhan)
  bukti_uraian   TEXT,                  -- uraian dokumen bukti
  bukti_url      TEXT,                  -- tautan / nama berkas bukti
  kendala        TEXT,
  status         TEXT NOT NULL DEFAULT 'draft',  -- draft | diserahkan | dinilai
  submitted_by   INTEGER REFERENCES users(id) ON DELETE SET NULL,
  submitted_at   TEXT,
  updated_at     TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  UNIQUE (period_id, indicator_id, unit_id)
);

-- =====================================================================
-- SASARAN MUTU  (diisi oleh SEMUA unit/bagian, terpisah dari Modul 1/2
-- karena kadensanya per bulan/triwulan/semester, bukan sekali per siklus
-- SPMI). Rencana capaian per sub-periode ditetapkan di awal, capaian aktual
-- dicatat berkala di Modul Pelaksanaan, dan hasilnya turut dievaluasi lewat
-- Modul 3 EMI/Audit (lihat audit_assessments.sasaran_mutu_id di bawah) —
-- auditor menilai SEKALI di akhir siklus/saat audit, memantau konsistensi
-- pengukuran, capaian tahun sebelumnya, dan capaian tahun berjalan hingga
-- sub-periode terakhir yang sudah dilaporkan.
-- =====================================================================
-- Program Kerja — satu program kerja dapat memuat BEBERAPA sasaran mutu
-- sekaligus (mis. program "Peningkatan Mutu Lulusan" bisa punya sasaran
-- "Rerata IPK" dan "Waktu Tunggu Lulusan" berbarengan). jenis membedakan
-- Kinerja Utama (terkait tupoksi inti unit) dari Kinerja Tambahan
-- (pendukung/inovasi). Ditetapkan sebagai satu kesatuan — begitu
-- ditetapkan, seluruh sasaran di dalamnya terkunci dan siap dicatat
-- capaiannya berkala di Modul Pelaksanaan.
CREATE TABLE IF NOT EXISTS program_kerja (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  unit_id       INTEGER NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  sub_unit_id   INTEGER REFERENCES units(id) ON DELETE SET NULL,
                -- opsional: sub-unit kerja di bawah unit_id (mis. Akademik di
                -- bawah BAAK), dikelola lewat Data Master > Unit (parent_id).
                -- Tidak semua unit punya sub-unit — boleh NULL.
  period_id     INTEGER NOT NULL REFERENCES periods(id) ON DELETE CASCADE,
  tahun         INTEGER NOT NULL DEFAULT (CAST(strftime('%Y','now') AS INTEGER)),
                -- tahun berjalan program kerja ini, TERPISAH dari siklus SPMI
                -- (period_id) karena sasaran mutu tidak selalu mengikuti
                -- siklus SPMI. Satu unit boleh punya program kerja aktif di
                -- lebih dari satu tahun sekaligus (tahun berjalan & sebelumnya).
  jenis         TEXT NOT NULL DEFAULT 'utama',  -- utama (Kinerja Utama) | tambahan (Kinerja Tambahan)
  nama          TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'draft',  -- draft | ditetapkan
  ditetapkan_at TEXT,
  ditetapkan_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_by    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE INDEX IF NOT EXISTS idx_program_kerja_unit_period ON program_kerja(unit_id, period_id);
CREATE INDEX IF NOT EXISTS idx_program_kerja_unit_tahun ON program_kerja(unit_id, tahun);

CREATE TABLE IF NOT EXISTS sasaran_mutu (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  program_kerja_id INTEGER NOT NULL REFERENCES program_kerja(id) ON DELETE CASCADE,
  sasaran          TEXT NOT NULL,        -- uraian sasaran yang ingin dicapai
  target           TEXT NOT NULL,        -- nilai target akhir (teks bebas, lihat satuan)
  satuan           TEXT,                 -- satuan ukur target (%, hari, orang, dst.)
  periode_evaluasi TEXT NOT NULL DEFAULT 'bulanan',
                   -- bulanan (12 sub-periode) | triwulanan (4) | semester (2)
  sort_order       INTEGER NOT NULL DEFAULT 0,
  created_at       TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE INDEX IF NOT EXISTS idx_sasaran_mutu_program ON sasaran_mutu(program_kerja_id);

-- Rencana capaian per sub-periode, ditetapkan sekali bersamaan dengan
-- sasaran mutu itu sendiri (mis. rencana Januari s.d. Desember).
CREATE TABLE IF NOT EXISTS sasaran_mutu_rencana (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  sasaran_mutu_id INTEGER NOT NULL REFERENCES sasaran_mutu(id) ON DELETE CASCADE,
  periode_ke      INTEGER NOT NULL,      -- 1..12 bulanan | 1..4 triwulanan | 1..2 semester
  label           TEXT NOT NULL,         -- "Januari", "Triwulan I", dst.
  target_periode  TEXT,                  -- rencana capaian pada sub-periode ini
  UNIQUE (sasaran_mutu_id, periode_ke)
);

-- Capaian aktual per sub-periode, dicatat berkala oleh unit di Modul
-- Pelaksanaan. Sengaja TIDAK punya status 'dinilai' per baris — penilaian
-- auditor dilakukan sekali di akhir siklus terhadap rekap keseluruhan
-- (lihat audit_assessments.sasaran_mutu_id), bukan per sub-periode.
-- kendala dan faktor_pendukung adalah evaluasi ketercapaian: kendala diisi
-- bila realisasi GAGAL mencapai rencana target sub-periode ini, faktor_
-- pendukung diisi bila realisasi MELAMPAUI rencana target.
CREATE TABLE IF NOT EXISTS sasaran_mutu_capaian (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  sasaran_mutu_id  INTEGER NOT NULL REFERENCES sasaran_mutu(id) ON DELETE CASCADE,
  periode_ke       INTEGER NOT NULL,
  realisasi        TEXT,                  -- uraian capaian pada sub-periode ini
  capaian_nilai    REAL,                  -- nilai capaian sesuai satuan target
  bukti_uraian     TEXT,
  bukti_url        TEXT,
  kendala          TEXT,                  -- evaluasi ketercapaian: penyebab bila gagal capai target
  faktor_pendukung TEXT,                  -- evaluasi ketercapaian: faktor pendukung bila lampaui target
  status           TEXT NOT NULL DEFAULT 'draft',   -- draft | diserahkan
  submitted_by     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  submitted_at     TEXT,
  updated_at       TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  UNIQUE (sasaran_mutu_id, periode_ke)
);

-- =====================================================================
-- MODUL 3 : EVALUASI MUTU INTERNAL / AUDIT  (diisi oleh Auditor)
-- =====================================================================
CREATE TABLE IF NOT EXISTS audits (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  period_id        INTEGER NOT NULL REFERENCES periods(id) ON DELETE CASCADE,
  unit_id          INTEGER NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  ba_number        TEXT,                -- nomor berita acara
  lead_auditor_id  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  auditee_id       INTEGER REFERENCES users(id) ON DELETE SET NULL,
  scheduled_date   TEXT,
  scheduled_time   TEXT,               -- jam pelaksanaan (mis. 09:00 - selesai)
  executed_date    TEXT,
  tempat           TEXT,
  scope            TEXT,                -- lingkup audit
  kesimpulan       TEXT,
  status           TEXT NOT NULL DEFAULT 'dijadwalkan',
                   -- dijadwalkan | berlangsung | selesai | ditandatangani
  created_by       INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at       TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS audit_members (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  audit_id  INTEGER NOT NULL REFERENCES audits(id) ON DELETE CASCADE,
  user_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  peran     TEXT NOT NULL DEFAULT 'Anggota Auditor',
  UNIQUE (audit_id, user_id)
);

-- Penilaian auditor terhadap tiap indikator (Modul 1/2) ATAU sasaran mutu
-- (lihat sasaran_mutu di atas) — persis satu dari indicator_id/sasaran_
-- mutu_id yang terisi per baris (dijaga lewat CHECK), supaya satu lembar
-- penilaian audit per unit bisa memuat keduanya sekaligus. Penilaian
-- sasaran mutu dilakukan sekali (menilai rekap keseluruhan capaian sampai
-- sub-periode terakhir), bukan per sub-periode.
CREATE TABLE IF NOT EXISTS audit_assessments (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  audit_id          INTEGER NOT NULL REFERENCES audits(id) ON DELETE CASCADE,
  indicator_id      INTEGER REFERENCES standard_indicators(id) ON DELETE CASCADE,
  sasaran_mutu_id   INTEGER REFERENCES sasaran_mutu(id) ON DELETE CASCADE,
  implementation_id INTEGER REFERENCES implementations(id) ON DELETE SET NULL,
  skor              REAL,               -- skor auditor sesuai skala resmi acuan indikator
                                         -- (mis. 1-4 riil/desimal untuk LAM Teknik, 0/1 untuk pemenuhan)
  capaian_persen    REAL,               -- nilai capaian sesuai SATUAN target indikator —
                                         -- bukan selalu persen (mis. IPK 3.4, luas vegetasi 20%,
                                         -- jumlah DTPS 12 orang); nama kolom historis, isinya bebas satuan
  verdict           TEXT NOT NULL DEFAULT 'sesuai',
                    -- sesuai | observasi | kts_minor | kts_mayor
  catatan_auditor   TEXT,
  verifikasi_bukti  TEXT,
  updated_at        TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  CHECK (
    (indicator_id IS NOT NULL AND sasaran_mutu_id IS NULL) OR
    (indicator_id IS NULL AND sasaran_mutu_id IS NOT NULL)
  )
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_audit_assessments_unik
  ON audit_assessments (audit_id, COALESCE(indicator_id,0), COALESCE(sasaran_mutu_id,0));

-- Temuan / Ketidaksesuaian
CREATE TABLE IF NOT EXISTS findings (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  audit_id       INTEGER NOT NULL REFERENCES audits(id) ON DELETE CASCADE,
  assessment_id  INTEGER REFERENCES audit_assessments(id) ON DELETE SET NULL,
  code           TEXT,                  -- nomor temuan, mis. KTS-2026-BAAK-01
  kategori       TEXT NOT NULL,         -- KTS Mayor | KTS Minor | Observasi
  uraian         TEXT NOT NULL,         -- uraian ketidaksesuaian
  kriteria_acuan TEXT,                  -- standar/klausul yang dilanggar
  bukti_objektif TEXT,
  status         TEXT NOT NULL DEFAULT 'terbuka',
                 -- terbuka | tindakan_koreksi | verifikasi | ditutup
  created_by     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at     TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

-- Tanda tangan digital (berita acara EMI, RTM, dll.)
CREATE TABLE IF NOT EXISTS signatures (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_type  TEXT NOT NULL,           -- audit | rtm | corrective_action | jadwal_audit | daftar_ptk
  entity_id    INTEGER NOT NULL,
  user_id      INTEGER REFERENCES users(id) ON DELETE SET NULL,
  peran        TEXT NOT NULL,           -- Auditor | Auditee | Ketua SPM | Direktur
  nama         TEXT NOT NULL,
  jabatan      TEXT,
  image_data   TEXT NOT NULL,           -- data URL PNG hasil canvas
  signed_at    TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  UNIQUE (entity_type, entity_id, peran, user_id)
);

-- =====================================================================
-- MODUL 4 : PENGENDALIAN STANDAR (Tindakan Koreksi)
-- =====================================================================
CREATE TABLE IF NOT EXISTS corrective_actions (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  finding_id            INTEGER NOT NULL UNIQUE REFERENCES findings(id) ON DELETE CASCADE,
  -- Bagian A: diisi AUDITEE
  analisis_penyebab     TEXT,
  koreksi_sementara     TEXT,
  rencana_tindakan      TEXT,
  rencana_tanggal       TEXT,
  penanggung_jawab      TEXT,
  diisi_oleh            INTEGER REFERENCES users(id) ON DELETE SET NULL,
  diisi_at              TEXT,
  -- Bagian B: realisasi oleh AUDITEE
  realisasi_tindakan    TEXT,
  bukti_realisasi       TEXT,
  tanggal_realisasi     TEXT,
  realisasi_at          TEXT,
  -- Bagian C: pemantauan oleh AUDITOR & SPM
  efektivitas           TEXT,           -- efektif | belum_efektif | tidak_efektif
  catatan_verifikasi    TEXT,
  tanggal_penyelesaian  TEXT,
  diverifikasi_oleh     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  diverifikasi_at       TEXT,
  -- status keseluruhan
  status                TEXT NOT NULL DEFAULT 'menunggu_auditee',
                        -- menunggu_auditee | rencana_disusun | realisasi_dilaporkan
                        -- | diverifikasi | ditutup
  updated_at            TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

-- =====================================================================
-- MODUL 5 : RAPAT TINJAUAN MANAJEMEN (RTM)
-- =====================================================================
CREATE TABLE IF NOT EXISTS rtm_meetings (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  period_id    INTEGER NOT NULL REFERENCES periods(id) ON DELETE CASCADE,
  nomor        TEXT,
  judul        TEXT NOT NULL,
  tanggal      TEXT,
  waktu        TEXT,
  tempat       TEXT,
  pemimpin_id  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  notulis_id   INTEGER REFERENCES users(id) ON DELETE SET NULL,
  status       TEXT NOT NULL DEFAULT 'rencana',
               -- rencana | ditolak_spm | menunggu_verifikasi_spm |
               -- menunggu_direktur | ditandatangani
  catatan      TEXT,
  created_by   INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at   TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS rtm_participants (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  rtm_id   INTEGER NOT NULL REFERENCES rtm_meetings(id) ON DELETE CASCADE,
  user_id  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  nama     TEXT NOT NULL,
  jabatan  TEXT,
  hadir    INTEGER NOT NULL DEFAULT 0,
  UNIQUE (rtm_id, user_id)
);

CREATE TABLE IF NOT EXISTS rtm_agenda (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  rtm_id         INTEGER NOT NULL REFERENCES rtm_meetings(id) ON DELETE CASCADE,
  agenda_key     TEXT NOT NULL,         -- 1, 2, 3, 3a, 3b, ...
  parent_key     TEXT,
  judul          TEXT NOT NULL,
  pembahasan     TEXT,
  data_pendukung TEXT,
  kesimpulan     TEXT,
  pic            TEXT,                  -- unit/orang penanggung jawab keputusan agenda ini
  sort_order     INTEGER NOT NULL DEFAULT 0,
  UNIQUE (rtm_id, agenda_key)
);

CREATE TABLE IF NOT EXISTS rtm_outputs (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  rtm_id             INTEGER NOT NULL REFERENCES rtm_meetings(id) ON DELETE CASCADE,
  kategori           TEXT NOT NULL,
                     -- peluang_perbaikan | perubahan_smop | kebutuhan_sumber_daya
  uraian             TEXT NOT NULL,
  unit_id            INTEGER REFERENCES units(id) ON DELETE SET NULL,
  penanggung_jawab   TEXT,
  target_tanggal     TEXT,
  status_tindak_lanjut TEXT NOT NULL DEFAULT 'direncanakan',
                     -- direncanakan | berjalan | selesai | ditunda
  realisasi          TEXT,
  sort_order         INTEGER NOT NULL DEFAULT 0
);

-- =====================================================================
-- MODUL 6 : SISTEM PENJAMINAN MUTU EKSTERNAL (SPME)
-- Menilai skor penerapan acuan eksternal (akreditasi PT, akreditasi
-- prodi, ISO 21001, Zona Integritas, UI GreenMetric) dengan pembobotan
-- resmi tiap acuan (kolom ref_items.bobot). Nilai tiap butir DITARIK
-- OTOMATIS dari hasil penilaian auditor (audit_assessments) atas
-- indikator yang diadopsi dari butir acuan tersebut (source_ref_item_id
-- / ref_map); baris di bawah ini hanya menyimpan KOREKSI MANUAL oleh SPM
-- bila nilai otomatis perlu ditimpa (mis. belum ada indikator/audit yang
-- menaunginya). Tidak ada baris berarti nilai murni otomatis dari audit.
-- =====================================================================
CREATE TABLE IF NOT EXISTS spme_scores (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  period_id      INTEGER NOT NULL REFERENCES periods(id) ON DELETE CASCADE,
  instrumen      TEXT NOT NULL,
                 -- akreditasi_pt | akreditasi_prodi_u<id unit> | iso21001 | zi | greenmetric
  ref_item_id    INTEGER NOT NULL REFERENCES ref_items(id) ON DELETE CASCADE,
  skor           REAL,                  -- koreksi manual SPM, sesuai skala skor acuan (refs.skor_min..skor_maks)
  capaian        REAL,                  -- koreksi manual SPM atas capaian target (khusus akreditasi prodi;
                                         -- nilai mentah sesuai satuan indikator — %, bulan, sks, dst.)
  bukti_url      TEXT,                  -- tautan berkas data dukung (opsional), dinormalisasi lewat tautanBukti()
  catatan        TEXT,
  updated_by     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  updated_at     TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  UNIQUE (period_id, instrumen, ref_item_id)
);
CREATE INDEX IF NOT EXISTS idx_spme_period ON spme_scores(period_id, instrumen);

-- Syarat Perlu Akreditasi LAM Teknik (Bab 4 pedoman): dua penanda yang
-- TIDAK bisa dihitung otomatis dari skor/bobot butir karena mengacu ke
-- data lain (mis. rasio dosen, jumlah SKS, waktu tunggu lulusan) — diisi
-- manual oleh SPM berdasarkan pedoman penilaian, dipakai untuk menentukan
-- status akreditasi (Tabel 3 pedoman) bersama Nilai Akreditasi (skor
-- tertimbang). Hanya relevan untuk instrumen akreditasi_prodi_*.
CREATE TABLE IF NOT EXISTS spme_syarat (
  period_id             INTEGER NOT NULL REFERENCES periods(id) ON DELETE CASCADE,
  instrumen              TEXT NOT NULL,
  syarat_terakreditasi   INTEGER,        -- 1=memenuhi, 0=tidak, NULL=belum diisi SPM
  unggul_tier            TEXT,           -- 'tidak' | 'tiga' | 'lima' | NULL=belum diisi
  catatan                TEXT,
  updated_by             INTEGER REFERENCES users(id) ON DELETE SET NULL,
  updated_at             TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  PRIMARY KEY (period_id, instrumen)
);

-- =====================================================================
-- Ranah tambahan (di luar A-E bawaan) untuk arsitektur standar mutu.
-- Ranah bawaan (A. Pendidikan, B. Penelitian, C. PkM, D. Tata Kelola dan
-- Kelembagaan, E. Keberlanjutan dan Lingkungan Kampus) sudah tersedia
-- langsung di client (lihat RANAH_BAWAAN di api.js) dan tidak perlu
-- didaftarkan di sini. Tabel ini hanya menampung ranah BARU yang dibuat
-- SPM lewat Modul Penetapan Standar, supaya kode+labelnya konsisten
-- ditampilkan ulang di seluruh aplikasi (bukan cuma di sesi form saat itu).
-- =====================================================================
CREATE TABLE IF NOT EXISTS ranah_custom (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  code        TEXT NOT NULL UNIQUE,   -- kode singkat, mis. 'F' — dipakai sbg prefix kode standar
  label       TEXT NOT NULL,          -- label lengkap, mis. 'F. Kewirausahaan dan Inovasi'
  pendek      TEXT NOT NULL,          -- label ringkas utk badge, mis. 'Kewirausahaan'
  created_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

-- =====================================================================
-- Konten publik (beranda kampus): berita/pengumuman dan halaman statis.
-- Hanya baris berstatus 'terbit' yang boleh dikembalikan oleh rute publik
-- (tanpa login) — lihat routes/publik.js. Penulisan/pengeditan dibatasi
-- peran SPM lewat routes/konten.js.
-- =====================================================================
CREATE TABLE IF NOT EXISTS posts (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  slug          TEXT NOT NULL UNIQUE,   -- huruf kecil/angka/tanda hubung saja, divalidasi di rute
  title         TEXT NOT NULL,
  excerpt       TEXT,                   -- ringkasan singkat utk daftar berita
  content       TEXT NOT NULL,          -- isi berita, format Markdown (disaring saat dirender)
  cover_url     TEXT,
  status        TEXT NOT NULL DEFAULT 'draft',  -- draft | terbit
  published_at  TEXT,
  created_by    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS pages (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  slug          TEXT NOT NULL UNIQUE,   -- huruf kecil/angka/tanda hubung saja, divalidasi di rute
  title         TEXT NOT NULL,
  content       TEXT NOT NULL,          -- isi halaman, format Markdown (disaring saat dirender)
  status        TEXT NOT NULL DEFAULT 'draft',  -- draft | terbit
  sort_order    INTEGER NOT NULL DEFAULT 0,      -- urutan tampil di menu halaman publik
  parent_id     INTEGER REFERENCES pages(id) ON DELETE SET NULL, -- halaman induk (maks. 2 tingkat, lihat routes/konten.js)
  external_url  TEXT,                    -- bila terisi, menu/sub-menu halaman ini redirect ke alamat ini
                                          -- (tab sama) dan MENANG atas isi konten — lihat routes/konten.js
  created_by    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

-- =====================================================================
-- Log aktivitas
-- =====================================================================
CREATE TABLE IF NOT EXISTS activity_log (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  aksi        TEXT NOT NULL,
  entity      TEXT,
  entity_id   INTEGER,
  keterangan  TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

-- Indeks
CREATE INDEX IF NOT EXISTS idx_std_period      ON standards(period_id);
CREATE INDEX IF NOT EXISTS idx_std_ranah       ON standards(period_id, ranah, kelompok);
CREATE INDEX IF NOT EXISTS idx_ind_std         ON standard_indicators(standard_id);
CREATE INDEX IF NOT EXISTS idx_ind_stmt        ON standard_indicators(statement_id);
CREATE INDEX IF NOT EXISTS idx_ind_source      ON standard_indicators(source_ref_item_id);
CREATE INDEX IF NOT EXISTS idx_stmt_std        ON standard_statements(standard_id);
CREATE INDEX IF NOT EXISTS idx_refitem_target  ON ref_items(ref_id, target);
CREATE INDEX IF NOT EXISTS idx_ia_ind          ON indicator_assignments(indicator_id);
CREATE INDEX IF NOT EXISTS idx_ia_unit         ON indicator_assignments(unit_id);
CREATE INDEX IF NOT EXISTS idx_refitem_ref     ON ref_items(ref_id, parent_id);
CREATE INDEX IF NOT EXISTS idx_refmap_item     ON ref_map(ref_item_id);
CREATE INDEX IF NOT EXISTS idx_refmap_std      ON ref_map(standard_id);
CREATE INDEX IF NOT EXISTS idx_refmap_ind      ON ref_map(indicator_id);
CREATE INDEX IF NOT EXISTS idx_impl_unit       ON implementations(unit_id, period_id);
CREATE INDEX IF NOT EXISTS idx_audit_unit      ON audits(unit_id, period_id);
CREATE INDEX IF NOT EXISTS idx_assess_audit    ON audit_assessments(audit_id);
CREATE INDEX IF NOT EXISTS idx_find_audit      ON findings(audit_id);
CREATE INDEX IF NOT EXISTS idx_sig_entity      ON signatures(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_rtm_agenda      ON rtm_agenda(rtm_id);
CREATE INDEX IF NOT EXISTS idx_rtm_output      ON rtm_outputs(rtm_id);
CREATE INDEX IF NOT EXISTS idx_posts_status     ON posts(status, published_at);
CREATE INDEX IF NOT EXISTS idx_pages_status     ON pages(status, sort_order);
CREATE INDEX IF NOT EXISTS idx_pages_parent      ON pages(parent_id);
