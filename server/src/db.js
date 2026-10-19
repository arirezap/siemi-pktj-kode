import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TENTANG_PERNYATAAN } from './data/pernyataanTentang.js';
import { KONEKTOR_PERNYATAAN } from './data/pernyataanKonektor.js';
import { RASIONAL_PERNYATAAN } from './data/pernyataanRasional.js';
import { STRATEGI_INDIKATOR } from './data/indikatorStrategi.js';
import { BUKTI_SAHIH_INDIKATOR } from './data/indikatorBuktiSahih.js';
import { SATUAN_INDIKATOR } from './data/indikatorSatuan.js';
import { PEMISAHAN_BUTIR_BANPT } from './data/pemisahanButirBANPT.js';
import { RASIONAL_UMUM_STANDAR } from './data/standarRasionalUmum.js';
import { PENUGASAN_UNIT_INDIKATOR } from './data/penugasanUnitIndikator.js';
import { REVISI_INDIKATOR } from './data/revisiIndikator.js';
import { SKALA_PERINGKAT, normalkanPeringkat, urutanPeringkat } from './peringkat.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const DB_PATH = path.join(DATA_DIR, 'emi-pktj.db');

export const db = new Database(DB_PATH);
// WAL (bawaan) paling cepat dan aman di disk lokal. Bila hosting menaruh data di
// penyimpanan jaringan (NFS) dan muncul galat "database is locked"/"malformed",
// set SQLITE_JOURNAL_MODE=DELETE di .env (lebih lambat tapi aman di NFS).
const JOURNAL_MODE = ['WAL', 'DELETE', 'TRUNCATE'].includes(String(process.env.SQLITE_JOURNAL_MODE).toUpperCase())
  ? String(process.env.SQLITE_JOURNAL_MODE).toUpperCase()
  : 'WAL';
db.pragma(`journal_mode = ${JOURNAL_MODE}`);
db.pragma('foreign_keys = ON');

export function initSchema() {
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  try {
    db.exec(sql);
  } catch {
    // Basis data lama belum memiliki kolom/tabel baru (mis. standards.ranah).
    // Semua pernyataan sebelum yang gagal sudah tereksekusi (CREATE TABLE/INDEX
    // IF NOT EXISTS), jadi tambahkan kolom yang hilang lalu jalankan ulang —
    // aman karena seluruh pernyataan di schema.sql bersifat IF NOT EXISTS.
    migrate();
    db.exec(sql);
  }
  migrate();
  migrasiPernyataanStandar();
  revisiRumusanPernyataan();
  revisiKonektorPernyataan();
  revisiRasionalPernyataan();
  revisiStrategiDanBuktiSahihIndikator();
  revisiSatuanIndikator();
  revisiPisahkanButirBANPT();
  revisiRasionalUmumStandar();
  tambahUnitPerpustakaan();
  tambahHalamanBawaan();
  resetKontenIndukSpmiSpme();
  revisiPenugasanUnitIndikator();
  hapusIndikatorTidakDiadopsi();
  perbaikiImplementasiTersangkutDinilai();
  pindahkanImplementasiPengampuKePelaksana();
  revisiKalimatIndikator();
  urutkanPernyataanDanIndikator();
}

/**
 * Migrasi idempoten: menghapus 4 indikator A.P.01.8.9-12 (program magister
 * terapan/doktor terapan/profesi-spesialis-subspesialis) dari standar A.P.01
 * — PKTJ hanya menyelenggarakan Diploma Tiga dan Sarjana Terapan sehingga
 * SPM memutuskan ke-4 indikator ini TIDAK diadopsi ke penetapan standar
 * (bukan sekadar dikosongkan pengampu/pelaksananya, seperti yang dilakukan
 * revisiPenugasanUnitIndikator()). Sebelumnya baris ini masih dipertahankan
 * dengan penugasan unit kosong, tapi ternyata itu membuat modul Cakupan
 * Acuan tetap menghitungnya "sudah diadopsi" (Cakupan hanya mengecek
 * keberadaan baris standard_indicators dengan source_ref_item_id terisi,
 * bukan ada/tidaknya pengampu) — sehingga butir acuan sumbernya salah
 * dilaporkan sudah tercakup PKTJ. Guard: hanya menghapus baris yang MASIH
 * ada dan MASIH belum punya pengampu (kalau SPM sudah menetapkan ulang
 * pengampu/pelaksananya secara manual sejak migrasi ini ditulis — artinya
 * SPM berubah pikiran dan indikator ini jadi diadopsi — baris itu
 * dibiarkan, tidak dihapus). Dicek tidak ada implementations/audit_assessments
 * yang bergantung pada baris ini sebelum migrasi ditulis (aman dihapus).
 */
function hapusIndikatorTidakDiadopsi() {
  const KODE = ['A.P.01.8.9', 'A.P.01.8.10', 'A.P.01.8.11', 'A.P.01.8.12'];
  const cari = db.prepare(`SELECT id FROM standard_indicators WHERE code=?`);
  const adaPengampu = db.prepare(
    `SELECT 1 FROM indicator_assignments WHERE indicator_id=? AND peran='pengampu'`
  );
  const hapus = db.prepare(`DELETE FROM standard_indicators WHERE id=?`);
  let jumlah = 0;
  db.transaction(() => {
    for (const kode of KODE) {
      const ind = cari.get(kode);
      if (!ind) continue; // sudah terhapus sebelumnya, atau belum pernah ada
      if (adaPengampu.get(ind.id)) continue; // SPM sudah menetapkan ulang, jangan hapus
      hapus.run(ind.id);
      jumlah++;
    }
  })();
  if (jumlah) console.log(`  ${jumlah} indikator (A.P.01.8.9-12) dihapus dari standar — tidak diadopsi ke penetapan standar.`);
}

/**
 * Migrasi idempoten (perbaikan data + perbaikan bug): mengembalikan isian
 * Modul 2 (Pelaksanaan Standar) yang tersangkut berstatus 'dinilai' padahal
 * penilaian auditornya (audit_assessments) sudah tidak ada — balik ke
 * 'diserahkan' supaya auditee bisa mengisi ulang.
 *
 * Ini terjadi karena bug pada route DELETE /audit/:id (hapus seluruh jadwal
 * audit): route itu mengandalkan ON DELETE CASCADE untuk menghapus baris
 * audit_assessments, tapi lupa mengembalikan status implementations terkait
 * — berbeda dengan route hapus-satu-nilai (DELETE /audit/:id/nilai/:id) yang
 * sudah benar melakukan itu. Akibatnya auditee terkunci hanya bisa melihat
 * ("Isian sudah dinilai auditor dan tidak dapat diubah") walau penilaian
 * yang menjustifikasi kuncian itu sudah tidak ada sama sekali. Bug pada
 * route sudah diperbaiki terpisah; migrasi ini menyapu data yang sudah
 * telanjur tersangkut sebelum perbaikan itu ada. Aman dijalankan berulang —
 * hanya menyentuh baris yang benar-benar yatim (tidak ada audit_assessments
 * yang menunjuk ke situ), jadi tidak akan mengganggu isian yang sedang
 * benar-benar dalam proses dinilai auditor.
 */
function perbaikiImplementasiTersangkutDinilai() {
  const info = db.prepare(
    `UPDATE implementations SET status='diserahkan'
      WHERE status='dinilai'
        AND NOT EXISTS (
          SELECT 1 FROM audit_assessments aa WHERE aa.implementation_id = implementations.id
        )`
  ).run();
  if (info.changes) {
    console.log(`  ${info.changes} isian Pelaksanaan Standar yang tersangkut 'dinilai' tanpa penilaian auditor dikembalikan ke status 'diserahkan'.`);
  }
}

/**
 * Migrasi idempoten (perbaikan data): memindahkan isian Pelaksanaan Standar
 * yang tersimpan di bawah unit PENGAMPU padahal seharusnya di bawah unit
 * PELAKSANA, khusus untuk indikator dari acuan LAM Teknik D3/S.Tr yang
 * penilaiannya wajib per program studi (lihat ACUAN_PENGAMPU_BOLEH_ISI_
 * PELAKSANA di routes/pelaksanaan.js — pengampu boleh MENGISIKAN data atas
 * nama pelaksana, tapi hasilnya harus tersimpan dengan unit_id milik
 * pelaksana, bukan pengampu, karena lembar kerja dan skor SPME membaca
 * berdasarkan unit pelaksana).
 *
 * Sebagian isian lama tersimpan dengan unit_id pengampu itu sendiri (data
 * lama, sebelum aturan pemisahan-per-prodi konsisten diterapkan) sehingga
 * "hilang" dari lembar kerja prodi terkait meski progres unit pengampu
 * tampak sudah terisi — itulah sumber selisih angka yang dilaporkan SPM.
 *
 * Hanya memindahkan bila TIDAK ambigu (indikator itu punya persis satu unit
 * pelaksana) dan TIDAK ada isian lain yang sudah ada di unit pelaksana
 * tujuan (guna menghindari menimpa data asli unit pelaksana). Kasus yang
 * ambigu/konflik dibiarkan apa adanya dan dicatat di log untuk ditinjau
 * manual — migrasi tidak pernah menghapus data.
 */
function pindahkanImplementasiPengampuKePelaksana() {
  const ACUAN = ['LAMTEKNIKSTR', 'LAMTEKNIKD3'];
  const salah = db
    .prepare(
      `SELECT im.id, im.period_id, im.indicator_id, im.unit_id, i.code, un.name AS unit_name
         FROM implementations im
         JOIN standard_indicators i ON i.id = im.indicator_id
         JOIN units un ON un.id = im.unit_id
         JOIN indicator_assignments ia
               ON ia.indicator_id = i.id AND ia.unit_id = im.unit_id AND ia.peran = 'pengampu'
         LEFT JOIN ref_items b ON b.id = i.source_ref_item_id
         LEFT JOIN refs r ON r.id = b.ref_id
        WHERE r.code IN (${ACUAN.map(() => '?').join(',')})`
    )
    .all(...ACUAN);

  const pelaksanaStmt = db.prepare(
    `SELECT unit_id FROM indicator_assignments WHERE indicator_id=? AND peran='pelaksana'`
  );
  const konflikStmt = db.prepare(
    `SELECT id FROM implementations WHERE period_id=? AND indicator_id=? AND unit_id=?`
  );
  const pindah = db.prepare(`UPDATE implementations SET unit_id=? WHERE id=?`);

  let jumlahPindah = 0;
  const dilewati = [];
  db.transaction(() => {
    for (const s of salah) {
      const pelaksana = pelaksanaStmt.all(s.indicator_id);
      if (pelaksana.length !== 1) {
        dilewati.push(`${s.code} (unit pelaksana ambigu: ${pelaksana.length})`);
        continue;
      }
      const tujuanUnitId = pelaksana[0].unit_id;
      if (konflikStmt.get(s.period_id, s.indicator_id, tujuanUnitId)) {
        dilewati.push(`${s.code} (sudah ada isian di unit pelaksana tujuan)`);
        continue;
      }
      pindah.run(tujuanUnitId, s.id);
      jumlahPindah++;
    }
  })();

  if (jumlahPindah) {
    console.log(`  ${jumlahPindah} isian Pelaksanaan Standar dipindah dari unit pengampu ke unit pelaksana yang benar.`);
  }
  if (dilewati.length) {
    console.log(`  ${dilewati.length} isian dilewati (perlu tinjauan manual): ${dilewati.join('; ')}`);
  }
}

/**
 * Migrasi idempoten (perubahan struktur tabel): memecah sasaran_mutu yang
 * semula datar (1 baris = 1 program kerja + 1 sasaran) menjadi dua tingkat —
 * program_kerja (bisa berjenis 'utama'/Kinerja Utama atau 'tambahan'/Kinerja
 * Tambahan, dan menyimpan status/penetapan) dan sasaran_mutu sebagai anaknya
 * (satu program kerja bisa memuat banyak sasaran). Setiap baris sasaran_mutu
 * LAMA disalin jadi satu program_kerja baru (jenis default 'utama' — SPM
 * dapat menyesuaikan lewat aplikasi) + satu baris sasaran_mutu baru dengan
 * ID YANG SAMA, supaya sasaran_mutu_rencana/sasaran_mutu_capaian/audit_
 * assessments yang sudah menunjuk ke situ tetap valid tanpa perlu diubah.
 * Dijaga idempoten lewat PRAGMA table_info: begitu kolom program_kerja_id
 * sudah ada di sasaran_mutu, migrasi ini tidak melakukan apa-apa lagi. HARUS
 * dijalankan sebelum schema.sql dieksekusi ulang (lihat initSchema), karena
 * schema.sql membuat indeks yang menyebut kolom program_kerja_id.
 */
function pisahkanSasaranMutuJadiProgramKerja() {
  const adaSM = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='sasaran_mutu'`).get();
  if (!adaSM) return; // belum pernah dibuat — schema.sql akan buat langsung dengan struktur baru

  const kolom = db.prepare(`PRAGMA table_info(sasaran_mutu)`).all().map((r) => r.name);
  if (kolom.includes('program_kerja_id')) return; // sudah bermigrasi

  db.pragma('foreign_keys = OFF');
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS program_kerja (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        unit_id       INTEGER NOT NULL REFERENCES units(id) ON DELETE CASCADE,
        period_id     INTEGER NOT NULL REFERENCES periods(id) ON DELETE CASCADE,
        jenis         TEXT NOT NULL DEFAULT 'utama',
        nama          TEXT NOT NULL,
        status        TEXT NOT NULL DEFAULT 'draft',
        ditetapkan_at TEXT,
        ditetapkan_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_by    INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at    TEXT NOT NULL DEFAULT (datetime('now','localtime'))
      );
      CREATE INDEX IF NOT EXISTS idx_program_kerja_unit_period ON program_kerja(unit_id, period_id);

      CREATE TABLE sasaran_mutu_new (
        id               INTEGER PRIMARY KEY AUTOINCREMENT,
        program_kerja_id INTEGER NOT NULL REFERENCES program_kerja(id) ON DELETE CASCADE,
        sasaran          TEXT NOT NULL,
        target           TEXT NOT NULL,
        satuan           TEXT,
        periode_evaluasi TEXT NOT NULL DEFAULT 'bulanan',
        sort_order       INTEGER NOT NULL DEFAULT 0,
        created_at       TEXT NOT NULL DEFAULT (datetime('now','localtime'))
      );
    `);

    const lama = db.prepare(`SELECT * FROM sasaran_mutu`).all();
    const insProgram = db.prepare(
      `INSERT INTO program_kerja
         (unit_id, period_id, jenis, nama, status, ditetapkan_at, ditetapkan_by, created_by, created_at)
       VALUES (?,?, 'utama', ?,?,?,?,?,?)`
    );
    const insSasaran = db.prepare(
      `INSERT INTO sasaran_mutu_new
         (id, program_kerja_id, sasaran, target, satuan, periode_evaluasi, sort_order, created_at)
       VALUES (?,?,?,?,?,?,0,?)`
    );

    for (const s of lama) {
      const pkId = insProgram.run(
        s.unit_id, s.period_id, s.program_kerja, s.status,
        s.ditetapkan_at, s.ditetapkan_by, s.created_by, s.created_at
      ).lastInsertRowid;
      insSasaran.run(s.id, pkId, s.sasaran, s.target, s.satuan, s.periode_evaluasi, s.created_at);
    }

    db.exec(`
      DROP TABLE sasaran_mutu;
      ALTER TABLE sasaran_mutu_new RENAME TO sasaran_mutu;
      CREATE INDEX IF NOT EXISTS idx_sasaran_mutu_program ON sasaran_mutu(program_kerja_id);
    `);

    if (lama.length) {
      console.log(`  ${lama.length} sasaran mutu lama dipindahkan ke struktur baru (program kerja + sasaran) — jenis default "Kinerja Utama", sesuaikan bila perlu.`);
    }
  } finally {
    db.pragma('foreign_keys = ON');
  }
}

/**
 * Migrasi idempoten (perubahan struktur tabel): memperluas audit_assessments
 * agar bisa menunjuk ke sasaran_mutu selain standard_indicators — satu
 * lembar penilaian audit per unit jadi bisa memuat indikator standar (Modul
 * 1/2) MAUPUN sasaran mutu sekaligus. SQLite tidak bisa mengubah kolom
 * NOT NULL jadi nullable lewat ALTER TABLE biasa, jadi tabel dibuat ulang
 * dengan struktur baru lalu seluruh data lama disalin apa adanya (id tetap
 * sama, supaya findings.assessment_id yang menunjuk ke situ tetap valid).
 * Dijaga idempoten lewat PRAGMA table_info: begitu kolom sasaran_mutu_id
 * sudah ada, migrasi ini tidak melakukan apa-apa lagi. HARUS dijalankan
 * sebelum schema.sql dieksekusi ulang (lihat initSchema), karena schema.sql
 * membuat indeks unik yang menyebut kolom sasaran_mutu_id.
 */
function perluasAuditAssessmentsUntukSasaranMutu() {
  const ada = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='audit_assessments'`).get();
  if (!ada) return; // belum pernah dibuat sama sekali — schema.sql akan membuatnya dengan struktur baru langsung

  const kolom = db.prepare(`PRAGMA table_info(audit_assessments)`).all().map((r) => r.name);
  if (kolom.includes('sasaran_mutu_id')) return; // sudah bermigrasi

  const adaSasaranMutu = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='sasaran_mutu'`).get();
  if (!adaSasaranMutu) return; // tabel sasaran_mutu belum sempat dibuat — akan dicoba lagi di restart berikutnya

  db.pragma('foreign_keys = OFF');
  try {
    db.exec(`
      CREATE TABLE audit_assessments_new (
        id                INTEGER PRIMARY KEY AUTOINCREMENT,
        audit_id          INTEGER NOT NULL REFERENCES audits(id) ON DELETE CASCADE,
        indicator_id      INTEGER REFERENCES standard_indicators(id) ON DELETE CASCADE,
        sasaran_mutu_id   INTEGER REFERENCES sasaran_mutu(id) ON DELETE CASCADE,
        implementation_id INTEGER REFERENCES implementations(id) ON DELETE SET NULL,
        skor              REAL,
        capaian_persen    REAL,
        verdict           TEXT NOT NULL DEFAULT 'sesuai',
        catatan_auditor   TEXT,
        verifikasi_bukti  TEXT,
        updated_at        TEXT NOT NULL DEFAULT (datetime('now','localtime')),
        CHECK (
          (indicator_id IS NOT NULL AND sasaran_mutu_id IS NULL) OR
          (indicator_id IS NULL AND sasaran_mutu_id IS NOT NULL)
        )
      );
      INSERT INTO audit_assessments_new
        (id, audit_id, indicator_id, implementation_id, skor, capaian_persen,
         verdict, catatan_auditor, verifikasi_bukti, updated_at)
      SELECT id, audit_id, indicator_id, implementation_id, skor, capaian_persen,
             verdict, catatan_auditor, verifikasi_bukti, updated_at
        FROM audit_assessments;
      DROP TABLE audit_assessments;
      ALTER TABLE audit_assessments_new RENAME TO audit_assessments;
      CREATE UNIQUE INDEX IF NOT EXISTS idx_audit_assessments_unik
        ON audit_assessments (audit_id, COALESCE(indicator_id,0), COALESCE(sasaran_mutu_id,0));
    `);
    console.log('  Tabel audit_assessments diperluas — kini bisa menilai sasaran mutu selain indikator standar.');
  } finally {
    db.pragma('foreign_keys = ON');
  }
}

/**
 * Migrasi idempoten: memperbaiki kalimat 434 indikator standar dari 6 acuan
 * (SN Dikti, BAN-PT PTKL, LAM Teknik D3, LAM Teknik S.Tr, LKE ZI, UI
 * GreenMetric) — lihat data/revisiIndikator.js untuk detail dan alasan tiap
 * pola. Menyentuh DUA tempat sekaligus agar tetap konsisten: teks yang sudah
 * diadopsi ke standar (standard_indicators.indicator) dan butir sumbernya di
 * modul Acuan Mutu (ref_items.uraian) — masing-masing dijaga idempoten
 * TERPISAH memakai nilai lama miliknya sendiri sebagai sentinel, karena
 * kedua kolom itu bisa saja sudah berbeda satu sama lain (butir acuan bisa
 * diedit lewat modul Acuan Mutu kapan pun, terlepas dari kapan standar yang
 * mengadopsinya terakhir disimpan). Kalau salah satu kolom sudah diubah
 * manual sejak migrasi ini ditulis, kolom itu dilewati — kolom lainnya tetap
 * diproses seperti biasa.
 */
function revisiKalimatIndikator() {
  const updSI = db.prepare(`UPDATE standard_indicators SET indicator=? WHERE code=? AND indicator=?`);
  const selSI = db.prepare(`SELECT id FROM standard_indicators WHERE code=?`);
  const selRI = db.prepare(`SELECT uraian FROM ref_items WHERE id=?`);
  const updRI = db.prepare(`UPDATE ref_items SET uraian=? WHERE id=? AND uraian=?`);

  let jumlahSI = 0, jumlahRI = 0, dilewatiSI = 0, dilewatiRI = 0;
  db.transaction(() => {
    for (const [kode, r] of Object.entries(REVISI_INDIKATOR)) {
      const si = selSI.get(kode);
      if (si) {
        const info = updSI.run(r.baru, kode, r.lamaIndikator);
        if (info.changes) jumlahSI++;
        else dilewatiSI++;
      }
      if (r.refItemId) {
        const ri = selRI.get(r.refItemId);
        if (ri && ri.uraian === r.lamaUraian) {
          updRI.run(r.baru, r.refItemId, r.lamaUraian);
          jumlahRI++;
        } else if (ri) {
          dilewatiRI++;
        }
      }
    }
  })();
  if (jumlahSI) console.log(`  ${jumlahSI} standard_indicators.indicator direvisi kalimatnya.`);
  if (dilewatiSI) console.log(`  ${dilewatiSI} standard_indicators dilewati (sudah diubah manual).`);
  if (jumlahRI) console.log(`  ${jumlahRI} ref_items.uraian direvisi kalimatnya.`);
  if (dilewatiRI) console.log(`  ${dilewatiRI} ref_items dilewati (sudah diubah manual sejak ditulis).`);
}

/**
 * Migrasi idempoten: menambahkan "Unit Perpustakaan" ke master unit
 * organisasi — unit ini sudah dipakai SPM sebagai unit pelaksana pada
 * beberapa indikator standar (lihat data/penugasanUnitIndikator.js) tapi
 * belum ada di tabel units. Aman dijalankan berulang kali (WHERE NOT EXISTS).
 */
function tambahUnitPerpustakaan() {
  const ada = db.prepare(`SELECT id FROM units WHERE code='PERPUS'`).get();
  if (ada) return;
  db.prepare(
    `INSERT INTO units (code, name, type, jenjang) VALUES ('PERPUS','Unit Perpustakaan','unit',NULL)`
  ).run();
  console.log('  Unit Perpustakaan ditambahkan ke master unit.');
}

const P = (judul) => `*(${judul})*`;

// Sub-bagian SPMI/SPME diminta sebagai kerangka konten — sejak migrasi ini
// masing-masing menjadi HALAMAN ANAK tersendiri (kolom pages.parent_id),
// bukan lagi heading (##) di dalam satu halaman induk, supaya bisa dikelola
// terpisah (judul, isi, terbit/draf) lewat menu Berita & Halaman -> Halaman.
const SPMI_ANAK = [
  ['kebijakan-penjaminan-mutu', 'Kebijakan Penjaminan Mutu', 'isi kebijakan penjaminan mutu'],
  ['penetapan-dokumen-spmi', 'Penetapan Dokumen SPMI', 'isi ringkasan dokumen kebijakan, standar, manual, dan formulir SPMI yang sudah ditetapkan'],
  ['pelaksanaan-standar-spmi', 'Pelaksanaan Standar SPMI', 'isi ringkasan pelaksanaan standar oleh seluruh unit'],
  ['evaluasi-audit-mutu-internal', 'Evaluasi: Audit Mutu Internal', 'isi ringkasan pelaksanaan audit mutu internal'],
  ['pengendalian-rapat-tinjauan-manajemen', 'Pengendalian: Rapat Tinjauan Manajemen', 'isi ringkasan rapat tinjauan manajemen dan tindak lanjutnya'],
  ['peningkatan-spmi', 'Peningkatan SPMI', 'isi ringkasan peningkatan berkelanjutan siklus SPMI'],
];
const SPME_ANAK = [
  ['status-akreditasi', 'Status Akreditasi', 'isi ringkasan status akreditasi institusi dan program studi saat ini'],
  ['akreditasi-perguruan-tinggi', 'Akreditasi Perguruan Tinggi', 'isi informasi akreditasi tingkat institusi'],
  ['akreditasi-program-studi', 'Akreditasi Program Studi', 'isi informasi akreditasi tiap program studi'],
  ['ui-green-metric', 'UI Green Metric', 'isi informasi partisipasi/peringkat UI GreenMetric'],
  ['iso-21001', 'ISO 21001', 'isi informasi sertifikasi ISO 21001'],
  ['zona-integritas', 'Zona Integritas', 'isi informasi status Zona Integritas WBK/WBBM'],
];
const kontenAnak = (judul, ket) => `## ${judul}\n\n${P(ket)}`;
// Teks gabungan versi LAMA (sebelum ada halaman anak) — dipakai sebagai
// penjaga idempoten pada resetKontenIndukSpmiSpme(): isi halaman induk hanya
// diringkas bila masih PERSIS sama dengan teks gabungan lama ini, supaya
// perubahan manual SPM sejak migrasi sebelumnya tidak pernah tertimpa.
const kontenLamaGabungan = (anak) => anak.map(([, judul, ket]) => kontenAnak(judul, ket)).join('\n\n');
const KONTEN_INTRO_SPMI = '*(Tulis ringkasan singkat Sistem Penjaminan Mutu Internal di sini — rincian tiap tahap ada pada sub-halaman di menu SPMI.)*';
const KONTEN_INTRO_SPME = '*(Tulis ringkasan singkat Sistem Penjaminan Mutu Eksternal di sini — rincian tiap bagian ada pada sub-halaman di menu SPME.)*';

/**
 * Migrasi idempoten: menyiapkan 4 halaman bawaan untuk beranda publik
 * (Profil, SPMI, SPME, Survei Kepuasan) berisi teks penanda tempat
 * (placeholder) saja — SEMUA berstatus 'draft' supaya tidak tampil ke
 * publik sebelum SPM meninjau dan mengisi kontennya lewat menu Berita &
 * Halaman, lalu menerbitkannya sendiri. SPMI dan SPME masing-masing juga
 * mendapat 6 halaman ANAK (pages.parent_id) sesuai kerangka sub-bagian yang
 * diminta. Idempoten lewat INSERT OR IGNORE + UNIQUE(slug): begitu SPM sudah
 * mulai mengedit halaman ini (slug tetap sama), migrasi berikutnya tidak
 * menimpanya lagi — termasuk saat fungsi ini dijalankan ulang pada basis
 * data yang induknya sudah ada tapi anaknya belum (mis. baru naik dari versi
 * lama), anak yang masih hilang akan ikut dilengkapi tanpa menyentuh induk.
 */
function tambahHalamanBawaan() {
  const HALAMAN = [
    {
      slug: 'profil', title: 'Profil', sort_order: 1,
      content:
        `## Profil Politeknik Keselamatan Transportasi Jalan\n\n${P('Tulis profil singkat dan sejarah kampus di sini')}\n\n` +
        `## Visi\n\n${P('isi visi')}\n\n## Misi\n\n${P('isi misi')}`,
    },
    { slug: 'spmi', title: 'SPMI', sort_order: 2, content: KONTEN_INTRO_SPMI },
    { slug: 'spme', title: 'SPME', sort_order: 3, content: KONTEN_INTRO_SPME },
    {
      slug: 'survei-kepuasan', title: 'Survei Kepuasan', sort_order: 4,
      content: `## Survei Kepuasan\n\n${P('tautkan atau jelaskan survei kepuasan layanan/pendidikan di sini, mis. tautan formulir')}`,
    },
  ];

  const insInduk = db.prepare(
    `INSERT OR IGNORE INTO pages (slug, title, content, status, sort_order, created_by)
     VALUES (?,?,?,'draft',?,NULL)`
  );
  const cariId = db.prepare(`SELECT id FROM pages WHERE slug=?`);
  const insAnak = db.prepare(
    `INSERT OR IGNORE INTO pages (slug, title, content, status, sort_order, parent_id, created_by)
     VALUES (?,?,?,'draft',?,?,NULL)`
  );

  let jumlah = 0;
  db.transaction(() => {
    for (const h of HALAMAN) {
      const info = insInduk.run(h.slug, h.title, h.content, h.sort_order);
      if (info.changes) jumlah++;
    }
    const spmiId = cariId.get('spmi')?.id;
    const spmeId = cariId.get('spme')?.id;
    if (spmiId) {
      SPMI_ANAK.forEach(([slug, judul, ket], i) => {
        const info = insAnak.run(slug, judul, kontenAnak(judul, ket), i + 1, spmiId);
        if (info.changes) jumlah++;
      });
    }
    if (spmeId) {
      SPME_ANAK.forEach(([slug, judul, ket], i) => {
        const info = insAnak.run(slug, judul, kontenAnak(judul, ket), i + 1, spmeId);
        if (info.changes) jumlah++;
      });
    }
  })();
  if (jumlah) {
    console.log(`  ${jumlah} halaman bawaan disiapkan sebagai draf (Profil/SPMI+sub/SPME+sub/Survei Kepuasan) — tinjau & terbitkan lewat menu Berita & Halaman.`);
  }
}

/**
 * Migrasi idempoten (khusus basis data yang sudah lebih dulu berjalan
 * dengan struktur LAMA, sebelum SPMI/SPME punya halaman anak): meringkas
 * isi halaman induk "SPMI"/"SPME" dari teks gabungan 6 heading menjadi
 * pengantar singkat, karena rinciannya sudah dipindah ke halaman anak oleh
 * tambahHalamanBawaan(). HANYA mengganti isi bila masih PERSIS sama dengan
 * teks gabungan lama — kalau SPM sudah mengedit halaman itu sejak dibuat,
 * dilewati supaya perubahan manual tidak pernah tertimpa.
 */
function resetKontenIndukSpmiSpme() {
  const set = db.prepare(`UPDATE pages SET content=? WHERE slug=? AND content=?`);
  const a = set.run(KONTEN_INTRO_SPMI, 'spmi', kontenLamaGabungan(SPMI_ANAK));
  const b = set.run(KONTEN_INTRO_SPME, 'spme', kontenLamaGabungan(SPME_ANAK));
  if (a.changes) console.log('  Isi halaman "SPMI" diringkas jadi pengantar (rincian sudah ada di sub-halaman).');
  if (b.changes) console.log('  Isi halaman "SPME" diringkas jadi pengantar (rincian sudah ada di sub-halaman).');
}

/**
 * Migrasi idempoten: menyesuaikan unit pengampu dan unit pelaksana tiap
 * indikator standar dengan penugasan yang sudah ditetapkan SPM pada file
 * Matriks_Standar_dan_Kode_Modul_Penetapan_Standar-2.xlsx (lihat
 * data/penugasanUnitIndikator.js). Guard idempoten memakai pola yang sama
 * seperti migrasi lain di file ini: setiap indikator hanya diganti bila
 * penugasannya SAAT INI masih persis sama dengan snapshot "lama" yang
 * dicatat ketika migrasi ini ditulis — kalau SPM sudah mengubahnya lewat
 * aplikasi sejak saat itu, indikator tsb dilewati agar perubahan manual
 * tidak tertimpa. pengampu/pelaksana bernilai null/[] berarti sel
 * dikosongkan di file (indikator yang sengaja tidak diadopsi ke penetapan
 * standar, mis. program magister/doktor/profesi yang belum diselenggarakan).
 */
function revisiPenugasanUnitIndikator() {
  const kodeUnit = new Map(
    db.prepare(`SELECT id, code FROM units`).all().map((u) => [u.code, u.id])
  );
  const indBy = db.prepare(`SELECT id FROM standard_indicators WHERE code=?`);
  const ambilSekarang = db.prepare(
    `SELECT u.code AS unit_code, a.peran FROM indicator_assignments a
       JOIN units u ON u.id = a.unit_id WHERE a.indicator_id=?`
  );
  const hapus = db.prepare(`DELETE FROM indicator_assignments WHERE indicator_id=?`);
  const tambah = db.prepare(
    `INSERT OR IGNORE INTO indicator_assignments (indicator_id, unit_id, peran) VALUES (?,?,?)`
  );

  const samaSet = (a, b) => {
    const sa = [...a].sort();
    const sb = [...b].sort();
    return sa.length === sb.length && sa.every((v, i) => v === sb[i]);
  };

  let jumlah = 0;
  let dilewati = 0;
  db.transaction(() => {
    for (const [kodeIndikator, { lama, baru }] of Object.entries(PENUGASAN_UNIT_INDIKATOR)) {
      const ind = indBy.get(kodeIndikator);
      if (!ind) continue;

      const sekarang = ambilSekarang.all(ind.id);
      const sekarangPengampu = sekarang.find((r) => r.peran === 'pengampu')?.unit_code || null;
      const sekarangPelaksana = sekarang.filter((r) => r.peran === 'pelaksana').map((r) => r.unit_code);

      const cocokLama =
        sekarangPengampu === lama.pengampu && samaSet(sekarangPelaksana, lama.pelaksana);
      if (!cocokLama) { dilewati++; continue; }

      // Sudah sama persis dgn target — tidak perlu tulis ulang.
      if (sekarangPengampu === baru.pengampu && samaSet(sekarangPelaksana, baru.pelaksana)) continue;

      hapus.run(ind.id);
      if (baru.pengampu && kodeUnit.has(baru.pengampu))
        tambah.run(ind.id, kodeUnit.get(baru.pengampu), 'pengampu');
      for (const kodeU of baru.pelaksana) {
        if (!kodeUnit.has(kodeU)) continue;
        if (kodeU === baru.pengampu) continue; // hindari bentrok UNIQUE(indicator_id, unit_id)
        tambah.run(ind.id, kodeUnit.get(kodeU), 'pelaksana');
      }
      jumlah++;
    }
  })();
  if (jumlah) console.log(`  ${jumlah} indikator direvisi penugasan unit pengampu/pelaksananya.`);
  if (dilewati) console.log(`  ${dilewati} indikator dilewati (penugasan sudah diubah manual sejak migrasi ditulis).`);
}

/**
 * Migrasi idempoten satu-kali: mengganti frasa generik pada
 * standard_statements.statement — "sehingga seluruh N butir persyaratan
 * [acuan] pada kelompok ini terpenuhi" — menjadi "sehingga butir persyaratan
 * tentang [rangkuman indikator] dapat terpenuhi", memakai rangkuman yang
 * sudah dibaca dan disusun manual per pernyataan (lihat
 * data/pernyataanTentang.js). Hanya menyentuh baris yang masih memakai
 * frasa lama dan punya rangkuman di peta tersebut — aman dijalankan
 * berulang kali dan tidak mengubah pernyataan yang sudah direvisi atau
 * pernyataan baru di luar peta.
 */
function revisiRumusanPernyataan() {
  const polaLama = /sehingga seluruh (?:\d+ )?butir persyaratan .*? pada kelompok ini terpenuhi/;
  const baris = db.prepare(`SELECT id, statement FROM standard_statements`).all();
  const set = db.prepare(`UPDATE standard_statements SET statement=? WHERE id=?`);
  let jumlah = 0;
  db.transaction(() => {
    for (const b of baris) {
      const tentang = TENTANG_PERNYATAAN[b.id];
      if (!tentang || !polaLama.test(b.statement)) continue;
      const baru = b.statement.replace(
        polaLama,
        `sehingga butir persyaratan tentang ${tentang} dapat terpenuhi`
      );
      set.run(baru, b.id);
      jumlah++;
    }
  })();
  if (jumlah) console.log(`  ${jumlah} standard_statements.statement direvisi ke rumusan "tentang ...".`);
}

/**
 * Migrasi idempoten satu-kali: mengganti fragmen "penyelenggaraan <Label>" pada
 * standard_statements.statement dengan konektor yang lebih sesuai sifat label
 * tersebut per acuan (mis. "pemenuhan aspek" untuk label dimensi/aspek BAN-PT,
 * LAM Teknik, dan ISO 21001; "pemenuhan" untuk label "Standar ..." SN Dikti;
 * "pemenuhan indikator" untuk label kategori UI GreenMetric; "perwujudan"
 * untuk label kondisi hasil akhir Zona Integritas; tetap "penyelenggaraan"
 * untuk label yang memang aktivitas), sekaligus menyisipkan cakupan program
 * ("pada program diploma III"/"pada program sarjana terapan") atau tingkat
 * ("di tingkat Perguruan Tinggi") untuk acuan LAMTEKNIKD3/LAMTEKNIKSTR/BANPT.
 * Lihat data/pernyataanKonektor.js untuk peta lengkapnya. Hanya menyentuh
 * baris yang masih memakai fragmen lama persis — aman dijalankan berulang
 * kali dan tidak mengubah pernyataan yang sudah direvisi.
 */
function revisiKonektorPernyataan() {
  const baris = db.prepare(`SELECT id, statement FROM standard_statements`).all();
  const set = db.prepare(`UPDATE standard_statements SET statement=? WHERE id=?`);
  let jumlah = 0;
  db.transaction(() => {
    for (const b of baris) {
      const ganti = KONEKTOR_PERNYATAAN[b.id];
      if (!ganti) continue;
      // Fragmen baru kadang berupa perluasan dari fragmen lama (mis. "penyelenggaraan
      // Pendidikan" -> "penyelenggaraan Pendidikan pada program diploma III"), jadi
      // fragmen lama masih akan "includes()"-match pada baris yang sudah direvisi.
      // Cek dulu fragmen baru sudah ada (berarti sudah direvisi) sebelum memeriksa
      // fragmen lama — supaya migrasi benar-benar idempoten.
      if (b.statement.includes(ganti.new)) continue;
      if (!b.statement.includes(ganti.old)) continue;
      const baru = b.statement.replace(ganti.old, ganti.new);
      set.run(baru, b.id);
      jumlah++;
    }
  })();
  if (jumlah) console.log(`  ${jumlah} standard_statements.statement direvisi konektor/cakupannya.`);
}

/**
 * Migrasi idempoten satu-kali: mengganti standard_statements.rationale dari
 * template generik "Butir-butir pada kelompok ... dikelompokkan menjadi satu
 * pernyataan standar karena ..." (menjelaskan CARA pengelompokan) dengan alasan
 * substantif MENGAPA pernyataan standar itu penting bagi PKTJ (dampak
 * akreditasi/kepatuhan regulasi/tata kelola sesuai acuannya). Lihat
 * data/pernyataanRasional.js. Guard idempotensi: hanya menimpa baris yang
 * rationale-nya masih persis sama dengan nilai lama yang tercatat di peta
 * tersebut — supaya revisi manual lewat UI Modul 1 setelah migrasi ini tidak
 * pernah ditimpa balik oleh restart server berikutnya.
 */
function revisiRasionalPernyataan() {
  const set = db.prepare(`UPDATE standard_statements SET rationale=? WHERE id=? AND rationale=?`);
  let jumlah = 0;
  db.transaction(() => {
    for (const [id, ganti] of Object.entries(RASIONAL_PERNYATAAN)) {
      const info = set.run(ganti.new, Number(id), ganti.old);
      if (info.changes) jumlah++;
    }
  })();
  if (jumlah) console.log(`  ${jumlah} standard_statements.rationale direvisi.`);
}

/**
 * Migrasi idempoten satu-kali: mengganti standard_indicators.strategy dan
 * .bukti_sahih dari teks generik/tersalin-antar-indikator (dalam 1 pernyataan
 * standar yang sama) menjadi teks spesifik per indikator — mekanisme/jenis
 * bukti yang relevan dengan label/acuan indikator tersebut, disertai kutipan
 * target capaian indikator itu sendiri (bukan sekadar mengutip kode butir).
 * Lihat data/indikatorStrategi.js dan data/indikatorBuktiSahih.js. Guard
 * idempotensi sama seperti revisiRasionalPernyataan(): hanya menimpa baris
 * yang nilainya masih persis sama dengan nilai lama tercatat, supaya tidak
 * menimpa balik revisi manual pengguna lewat UI.
 */
function revisiStrategiDanBuktiSahihIndikator() {
  const setStrategi = db.prepare(`UPDATE standard_indicators SET strategy=? WHERE id=? AND strategy=?`);
  const setBukti = db.prepare(`UPDATE standard_indicators SET bukti_sahih=? WHERE id=? AND bukti_sahih=?`);
  let jumlahStrategi = 0;
  let jumlahBukti = 0;
  db.transaction(() => {
    for (const [id, ganti] of Object.entries(STRATEGI_INDIKATOR)) {
      const info = setStrategi.run(ganti.new, Number(id), ganti.old);
      if (info.changes) jumlahStrategi++;
    }
    for (const [id, ganti] of Object.entries(BUKTI_SAHIH_INDIKATOR)) {
      const info = setBukti.run(ganti.new, Number(id), ganti.old);
      if (info.changes) jumlahBukti++;
    }
  })();
  if (jumlahStrategi) console.log(`  ${jumlahStrategi} standard_indicators.strategy direvisi.`);
  if (jumlahBukti) console.log(`  ${jumlahBukti} standard_indicators.bukti_sahih direvisi.`);
}

/**
 * Migrasi idempoten: revisi satuan target capaian indikator. Target yang
 * sifatnya kualitatif (mis. "tersedia bukti", "menetapkan", "memenuhi")
 * diberi satuan %, target yang kuantitatif diberi satuan sesuai apa yang
 * diminta pada teks target itu sendiri (Rasio, Rupiah, sks, Unit, Skor
 * (skala 4,00), Tahun, Bulan, kWh/orang, Ton metrik/orang, dll). Kasus
 * abu-abu (target kepatuhan kualitatif yang menempel kriteria frekuensi,
 * mis. "minimal 1 kali per tahun") diperlakukan sebagai kualitatif -> %.
 * Lihat data/indikatorSatuan.js. Guard idempotensi sama seperti migrasi
 * lain: hanya menimpa baris yang satuan-nya masih persis sama dengan nilai
 * lama tercatat, supaya tidak menimpa balik revisi manual pengguna lewat UI.
 */
function revisiSatuanIndikator() {
  const set = db.prepare(`UPDATE standard_indicators SET satuan=? WHERE id=? AND satuan=?`);
  let jumlah = 0;
  db.transaction(() => {
    for (const [id, ganti] of Object.entries(SATUAN_INDIKATOR)) {
      const info = set.run(ganti.new, Number(id), ganti.old);
      if (info.changes) jumlah++;
    }
  })();
  if (jumlah) console.log(`  ${jumlah} standard_indicators.satuan direvisi.`);
}

/**
 * Migrasi idempoten: pisahkan butir acuan BAN-PT (instrumen akreditasi
 * PTKL/LPNK) yang "gemuk" — satu butir mencampur 2-3 elemen A/B/(C) yang
 * masing-masing punya target pencapaian sendiri — menjadi butir-butir
 * terpisah per elemen (mis. PTKL-08 -> PTKL-08A + PTKL-08B). Lihat
 * data/pemisahanButirBANPT.js untuk daftar lengkap dan isi tiap bagian.
 *
 * Bagian pertama (A) SELALU memakai kembali baris ref_items +
 * standard_indicators yang sudah ada (id sama, cuma kontennya dipersempit
 * ke elemen A) — supaya penugasan (indicator_assignments) dan riwayat kecil
 * PPEPP/audit yang sudah ada tidak hilang lewat cascade delete. Bagian
 * berikutnya (B, C) dibuat sebagai baris baru, dengan indicator_assignments
 * disalin dari bagian A supaya Modul Pelaksanaan/Evaluasi (PPEPP) dan SPME
 * — yang semuanya membaca indicator_assignments/source_ref_item_id secara
 * dinamis, tanpa kode acuan yang di-hardcode — otomatis menampilkannya ke
 * unit yang sama tanpa perlu penugasan ulang manual.
 *
 * Idempoten: ref_items digeser dari kode asli (mis. "PTKL-08") ke kode
 * bagian pertama (mis. "PTKL-08A") hanya sekali (guard pada kolom code);
 * standard_indicators direvisi hanya bila target masih persis sama dengan
 * target gabungan LAMA yang tercatat (targetLamaGabungan) — begitu
 * SPM mengedit manual lewat UI, guard tidak lagi cocok dan migrasi
 * berhenti menimpa baris tsb. Baris baru (B/C) dibuat hanya bila kode/
 * source_ref_item_id-nya belum ada.
 */
function revisiPisahkanButirBANPT() {
  const acuan = db.prepare(`SELECT id FROM refs WHERE code='BANPT'`).get();
  if (!acuan) return;

  const cariRefItemByCode = db.prepare(`SELECT * FROM ref_items WHERE ref_id=? AND code=?`);
  const updateRefItemA = db.prepare(
    `UPDATE ref_items SET code=?, title=?, uraian=?, target=?, satuan=? WHERE id=? AND code=?`
  );
  const insertRefItem = db.prepare(
    `INSERT INTO ref_items
       (ref_id, parent_id, code, title, uraian, tipe, level, bobot, wajib_petakan,
        sort_order, target, satuan, strategy, target_skor)
     VALUES (@ref_id, @parent_id, @code, @title, @uraian, @tipe, @level, @bobot,
             @wajib_petakan, @sort_order, @target, @satuan, @strategy, @target_skor)`
  );
  const cariIndikatorBySourceRef = db.prepare(
    `SELECT * FROM standard_indicators WHERE source_ref_item_id=?`
  );
  const updateIndikatorA = db.prepare(
    `UPDATE standard_indicators
        SET indicator=?, target=?, satuan=?, strategy=?, bukti_sahih=?
      WHERE id=? AND target=?`
  );
  const insertIndikator = db.prepare(
    `INSERT INTO standard_indicators
       (standard_id, code, indicator, target, satuan, strategy, deadline,
        sort_order, statement_id, source_ref_item_id, target_skor, bukti_sahih)
     VALUES (@standard_id, @code, @indicator, @target, @satuan, @strategy, @deadline,
             @sort_order, @statement_id, @source_ref_item_id, @target_skor, @bukti_sahih)`
  );
  const salinPenugasan = db.prepare(
    `INSERT OR IGNORE INTO indicator_assignments (indicator_id, unit_id, peran)
       SELECT ?, unit_id, peran FROM indicator_assignments WHERE indicator_id=?`
  );
  const setSortRefItem = db.prepare(
    `UPDATE ref_items SET sort_order=? WHERE id=? AND sort_order<>?`
  );

  const kodeIndikatorBerikutnya = (statementId) => {
    const rows = db.prepare(`SELECT code FROM standard_indicators WHERE statement_id=?`).all(statementId);
    let maks = 0;
    let prefix = '';
    for (const r of rows) {
      const idx = r.code.lastIndexOf('.');
      if (idx < 0) continue;
      prefix = r.code.slice(0, idx + 1);
      const n = parseInt(r.code.slice(idx + 1), 10);
      if (!Number.isNaN(n) && n > maks) maks = n;
    }
    return prefix + (maks + 1);
  };

  let jmlRefItemDirevisi = 0;
  let jmlRefItemBaru = 0;
  let jmlIndikatorDirevisi = 0;
  let jmlIndikatorBaru = 0;
  const parentTersentuh = new Set();

  db.transaction(() => {
    for (const grup of PEMISAHAN_BUTIR_BANPT) {
      const bagianA = grup.bagian[0];

      let refA = cariRefItemByCode.get(acuan.id, grup.kodeAsli);
      if (!refA) refA = cariRefItemByCode.get(acuan.id, bagianA.kode);
      if (!refA) continue; // butir tidak ditemukan di basis data ini, lewati dengan aman

      if (refA.code === grup.kodeAsli) {
        updateRefItemA.run(
          bagianA.kode, bagianA.judul, bagianA.uraian, bagianA.target, bagianA.satuan,
          refA.id, grup.kodeAsli
        );
        jmlRefItemDirevisi++;
        refA = cariRefItemByCode.get(acuan.id, bagianA.kode);
      }
      parentTersentuh.add(refA.parent_id);

      const indA = cariIndikatorBySourceRef.get(refA.id);
      if (indA) {
        const info = updateIndikatorA.run(
          bagianA.uraian, bagianA.target, bagianA.satuan, bagianA.strategy, bagianA.buktiSahih,
          indA.id, grup.targetLamaGabungan
        );
        if (info.changes) jmlIndikatorDirevisi++;
      }

      for (let i = 1; i < grup.bagian.length; i++) {
        const b = grup.bagian[i];
        let refB = cariRefItemByCode.get(acuan.id, b.kode);
        if (!refB) {
          insertRefItem.run({
            ref_id: refA.ref_id,
            parent_id: refA.parent_id,
            code: b.kode,
            title: b.judul,
            uraian: b.uraian,
            tipe: refA.tipe,
            level: refA.level,
            bobot: refA.bobot,
            wajib_petakan: refA.wajib_petakan,
            sort_order: refA.sort_order + i,
            target: b.target,
            satuan: b.satuan,
            strategy: refA.strategy,
            target_skor: refA.target_skor,
          });
          refB = cariRefItemByCode.get(acuan.id, b.kode);
          jmlRefItemBaru++;
        }
        parentTersentuh.add(refB.parent_id);

        const indB = cariIndikatorBySourceRef.get(refB.id);
        if (!indB && indA) {
          const kodeBaru = kodeIndikatorBerikutnya(indA.statement_id);
          insertIndikator.run({
            standard_id: indA.standard_id,
            code: kodeBaru,
            indicator: b.uraian,
            target: b.target,
            satuan: b.satuan,
            strategy: b.strategy,
            deadline: indA.deadline,
            sort_order: i,
            statement_id: indA.statement_id,
            source_ref_item_id: refB.id,
            target_skor: indA.target_skor,
            bukti_sahih: b.buktiSahih,
          });
          const indBaru = cariIndikatorBySourceRef.get(refB.id);
          jmlIndikatorBaru++;
          salinPenugasan.run(indBaru.id, indA.id);
        }
      }
    }

    const ambilAnak = db.prepare(`SELECT id FROM ref_items WHERE parent_id=? ORDER BY code`);
    for (const pid of parentTersentuh) {
      if (pid == null) continue;
      const anak = ambilAnak.all(pid);
      anak.forEach((a, i) => setSortRefItem.run(i, a.id, i));
    }
  })();

  if (jmlRefItemDirevisi)
    console.log(`  ${jmlRefItemDirevisi} ref_items BAN-PT diubah jadi bagian pertama hasil split.`);
  if (jmlRefItemBaru)
    console.log(`  ${jmlRefItemBaru} ref_items baru dibuat dari pemisahan butir BAN-PT.`);
  if (jmlIndikatorDirevisi)
    console.log(`  ${jmlIndikatorDirevisi} standard_indicators direvisi (bagian pertama hasil split BAN-PT).`);
  if (jmlIndikatorBaru)
    console.log(`  ${jmlIndikatorBaru} standard_indicators baru dibuat dari pemisahan butir BAN-PT.`);
}

/**
 * Migrasi idempoten: revisi rasional umum standar (standards.rationale).
 * Rasional lama banyak menyitir nomor pasal (SN Dikti, PM 104/2021, dst.)
 * dengan nada kaku "sesuai ketentuan X". Revisi ini menghapus semua sitiran
 * pasal dan mengganti fokusnya ke konteks serta alasan standar tersebut
 * perlu ada — bukan sekadar mekanisme pemenuhan ketentuan. Lihat
 * data/standarRasionalUmum.js. Guard idempoten sama seperti migrasi
 * rasional pernyataan standar: hanya menimpa baris yang rationale-nya
 * masih persis sama dengan nilai lama tercatat.
 */
function revisiRasionalUmumStandar() {
  const set = db.prepare(`UPDATE standards SET rationale=? WHERE id=? AND rationale=?`);
  let jumlah = 0;
  db.transaction(() => {
    for (const [id, ganti] of Object.entries(RASIONAL_UMUM_STANDAR)) {
      const info = set.run(ganti.new, Number(id), ganti.old);
      if (info.changes) jumlah++;
    }
  })();
  if (jumlah) console.log(`  ${jumlah} standards.rationale direvisi.`);
}

/**
 * Migrasi idempoten untuk basis data yang sudah terlanjur dibuat sebelum
 * penambahan arsitektur ranah dan modul acuan. Aman dijalankan berulang kali.
 */
/**
 * Idempoten: sasaran mutu yang targetnya BUKAN angka tapi persis sebuah level
 * pada skala peringkat (mis. "A", "WTP", "Unggul") dijadikan tipe 'peringkat'
 * — dulu tersimpan sebagai teks biasa. Capaian lama yang tersimpan sebagai
 * uraian "Realisasi: A" dipindahkan ke kolom capaian_teks. Sasaran yang sudah
 * bertipe peringkat atau bertarget angka tidak disentuh.
 */
function konversiSasaranBerperingkat() {
  const rows = db
    .prepare(`SELECT id, target FROM sasaran_mutu WHERE tipe_nilai='angka' AND target IS NOT NULL`)
    .all();
  const updSM = db.prepare(`UPDATE sasaran_mutu SET tipe_nilai='peringkat', skala_peringkat=?, target=? WHERE id=?`);
  const capaian = db.prepare(
    `SELECT id, realisasi FROM sasaran_mutu_capaian WHERE sasaran_mutu_id=? AND capaian_teks IS NULL AND realisasi IS NOT NULL`
  );
  const updC = db.prepare(`UPDATE sasaran_mutu_capaian SET capaian_teks=?, capaian_nilai=NULL WHERE id=?`);
  for (const r of rows) {
    const t = String(r.target).trim();
    if (!t || /^[\d.,\s]+$/.test(t)) continue; // angka biasa
    const skala = Object.keys(SKALA_PERINGKAT).find((k) => urutanPeringkat(k, t) >= 0);
    if (!skala) continue;
    // hanya bila seluruh rencana terisi (selain 0/-) juga level skala yang sama;
    // bila tidak (mis. target "WTP" tapi rencana angka 1) biarkan bertipe angka
    const rencanaCocok = db
      .prepare(`SELECT target_periode FROM sasaran_mutu_rencana WHERE sasaran_mutu_id=? AND target_periode IS NOT NULL AND TRIM(target_periode) NOT IN ('0','-','')`)
      .all(r.id)
      .every((x) => urutanPeringkat(skala, x.target_periode) >= 0);
    if (!rencanaCocok) continue;
    db.transaction(() => {
      updSM.run(skala, normalkanPeringkat(skala, t), r.id);
      // rencana "0" (hasil aturan kosong=0 untuk angka) tak bermakna pada peringkat
      db.prepare(`UPDATE sasaran_mutu_rencana SET target_periode=NULL WHERE sasaran_mutu_id=? AND TRIM(target_periode) IN ('0','-','')`).run(r.id);
      // capaian bernilai angka 0 (isian otomatis "kosong=0") tanpa huruf = belum diisi
      db.prepare(`DELETE FROM sasaran_mutu_capaian WHERE sasaran_mutu_id=? AND capaian_teks IS NULL AND capaian_nilai=0 AND realisasi LIKE 'Realisasi: 0%'`).run(r.id);
      for (const c of capaian.all(r.id)) {
        const uraian = String(c.realisasi).replace(/^\s*Realisasi:\s*/i, '').trim();
        const baku = normalkanPeringkat(skala, uraian) || normalkanPeringkat(skala, uraian.split(/\s+/)[0]);
        if (baku) updC.run(baku, c.id);
      }
    })();
  }
}

function migrate() {
  const kolom = (tabel) =>
    db.prepare(`PRAGMA table_info(${tabel})`).all().map((r) => r.name);

  const tambahKolom = (tabel, nama, ddl) => {
    if (!kolom(tabel).includes(nama))
      db.exec(`ALTER TABLE ${tabel} ADD COLUMN ${nama} ${ddl}`);
  };

  tambahKolom('standards', 'ranah', 'TEXT');
  tambahKolom('standards', 'kelompok', 'TEXT');
  tambahKolom('standards', 'sifat', "TEXT NOT NULL DEFAULT 'wajib'");
  tambahKolom('standards', 'strategy', 'TEXT');
  tambahKolom('standard_indicators', 'statement_id', 'INTEGER');
  tambahKolom('standard_indicators', 'source_ref_item_id', 'INTEGER');
  tambahKolom('standard_indicators', 'target_skor', 'TEXT');
  tambahKolom('standard_indicators', 'bukti_sahih', 'TEXT');
  tambahKolom('implementations', 'skor', 'REAL');
  tambahKolom('spme_scores', 'capaian', 'REAL');
  tambahKolom('spme_scores', 'bukti_url', 'TEXT');
  tambahKolom('ref_items', 'target', 'TEXT');
  tambahKolom('ref_items', 'target_skor', 'TEXT');
  tambahKolom('ref_items', 'satuan', 'TEXT');
  tambahKolom('ref_items', 'strategy', 'TEXT');
  tambahKolom('audits', 'scheduled_time', 'TEXT');
  if (db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='sasaran_mutu_capaian'`).get()) {
    tambahKolom('sasaran_mutu_capaian', 'faktor_pendukung', 'TEXT');
    // Sasaran bernilai peringkat (huruf/predikat): capaian_teks menyimpan hurufnya
    tambahKolom('sasaran_mutu_capaian', 'capaian_teks', 'TEXT');
  }
  if (db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='sasaran_mutu'`).get()) {
    // tipe_nilai: 'angka' (default) | 'peringkat'; skala_peringkat: kunci di peringkat.js
    tambahKolom('sasaran_mutu', 'tipe_nilai', "TEXT NOT NULL DEFAULT 'angka'");
    tambahKolom('sasaran_mutu', 'skala_peringkat', 'TEXT');
  }
  konversiSasaranBerperingkat();
  tambahKolom('rtm_agenda', 'pic', 'TEXT');
  tambahKolom('units', 'jenjang', 'TEXT');
  tambahKolom('refs', 'jenjang', 'TEXT');
  tambahKolom('refs', 'skor_min', 'REAL');
  tambahKolom('refs', 'skor_maks', 'REAL');
  tambahKolom('refs', 'skor_step', 'REAL');
  tambahKolom('program_kerja', 'sub_unit_id', 'INTEGER REFERENCES units(id) ON DELETE SET NULL');
  tambahKolom('program_kerja', 'tahun', 'INTEGER');
  if (db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='pages'`).get()) {
    tambahKolom('pages', 'parent_id', 'INTEGER REFERENCES pages(id) ON DELETE SET NULL');
    tambahKolom('pages', 'external_url', 'TEXT');
  }
  // Isi tahun program kerja lama (kolom baru, semula NULL) dari tahun siklus
  // SPMI yang sedang berlaku saat dibuat — patokan awal yang masuk akal
  // sebelum unit menyesuaikannya secara manual bila perlu. Idempoten: hanya
  // menyentuh baris yang tahun-nya masih NULL.
  if (db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='program_kerja'`).get()) {
    db.exec(`
      UPDATE program_kerja
         SET tahun = COALESCE(
               (SELECT year FROM periods WHERE periods.id = program_kerja.period_id),
               CAST(strftime('%Y','now') AS INTEGER)
             )
       WHERE tahun IS NULL
    `);
  }

  // spme_scores.capaian_persen (nama lama, isinya sebenarnya persen) diganti
  // jadi skor (isinya sekarang skor mentah sesuai skala acuan, dipakai untuk
  // hitung bobot x skor, bukan bobot x persen). Aman untuk basis data lama
  // yang masih memakai nama kolom lama.
  if (kolom('spme_scores').includes('capaian_persen') && !kolom('spme_scores').includes('skor')) {
    db.exec(`ALTER TABLE spme_scores RENAME COLUMN capaian_persen TO skor`);
  }

  // Ganti nama acuan LAM Teknik Sarjana Terapan: kode acuan 'LAMTEKNIK' menjadi
  // 'LAMTEKNIKSTR', dan prefix kode butirnya 'LT-' menjadi 'STR-' (mis. LT-53
  // jadi STR-53). Sekali jalan saja — begitu refs.code sudah berganti,
  // WHERE code='LAMTEKNIK' di bawah ini tidak akan cocok lagi pada
  // pemanggilan berikutnya. Acuan LAM Teknik Diploma III (LAMTEKNIKD3,
  // prefix D3-) tidak berubah.
  const acuanLamStr = db.prepare(`SELECT id FROM refs WHERE code='LAMTEKNIK'`).get();
  if (acuanLamStr) {
    db.transaction(() => {
      db.prepare(`UPDATE refs SET code='LAMTEKNIKSTR' WHERE id=?`).run(acuanLamStr.id);
      db.prepare(
        `UPDATE ref_items SET code = 'STR-' || substr(code, 4)
          WHERE ref_id=? AND code LIKE 'LT-%'`
      ).run(acuanLamStr.id);
    })();
    console.log('  Acuan LAMTEKNIK diganti nama menjadi LAMTEKNIKSTR (kode butir LT- -> STR-).');
  }

  // Rename di atas hanya mengganti ref_items.code — teks bebas yang SUDAH
  // ditulis sebelumnya (standard_indicators.strategy/bukti_sahih, disalin
  // "apa adanya" dari acuan saat diadopsi ke Modul 1) masih menyebut kode
  // lama "LT-xx" secara harfiah di dalam kalimatnya. Migrasi ini mengganti
  // setiap penyebutan "LT-" jadi "STR-" di kedua kolom itu. Idempoten:
  // begitu tidak ada lagi baris yang cocok, tidak melakukan apa-apa.
  for (const kolom of ['strategy', 'bukti_sahih']) {
    const baris = db
      .prepare(`SELECT id, ${kolom} AS teks FROM standard_indicators WHERE ${kolom} LIKE '%LT-%'`)
      .all();
    if (!baris.length) continue;
    const set = db.prepare(`UPDATE standard_indicators SET ${kolom}=? WHERE id=?`);
    db.transaction(() => {
      for (const b of baris) set.run(b.teks.replace(/\bLT-(?=[A-Za-z0-9])/g, 'STR-'), b.id);
    })();
    console.log(`  ${baris.length} standard_indicators.${kolom} dikoreksi dari kode LT- ke STR-.`);
  }

  // Isi skala skor bawaan sekali saja (tidak menimpa bila sudah diisi manual oleh SPM)
  const isiSkala = (kode, min, maks, step) => {
    db.prepare(
      `UPDATE refs SET skor_min=?, skor_maks=?, skor_step=?
        WHERE code=? AND skor_min IS NULL AND skor_maks IS NULL`
    ).run(min, maks, step, kode);
  };
  isiSkala('SNDIKTI', 0, 1, 1);
  isiSkala('BANPT', 0, 1, 1);
  isiSkala('LAMTEKNIKSTR', 1, 4, null);
  isiSkala('LAMTEKNIKD3', 1, 4, null);
  isiSkala('ISO21001', 0, 1, 1);
  isiSkala('ZI', 0, 1, 0.25);
  isiSkala('GREENMETRIC', 1, 5, 1);

  // Koreksi skala LAM Teknik: skala aslinya 1-4 (bukan 0-4) dan boleh berupa
  // nilai riil/desimal (mis. 3.7, 2.5), bukan hanya bilangan bulat. Basis
  // data yang sudah sempat terisi skala lama (0-4, kelipatan 1) dikoreksi
  // otomatis; bila SPM sudah mengubahnya secara manual ke nilai lain,
  // migrasi ini tidak menimpanya.
  const koreksiSkalaLamTeknik = (kode) => {
    db.prepare(
      `UPDATE refs SET skor_min=1, skor_step=NULL
        WHERE code=? AND skor_min=0 AND skor_maks=4 AND skor_step=1`
    ).run(kode);
  };
  koreksiSkalaLamTeknik('LAMTEKNIKSTR');
  koreksiSkalaLamTeknik('LAMTEKNIKD3');

  // Isi jenjang bawaan sekali saja (tidak menimpa bila sudah diisi manual oleh SPM)
  db.prepare(
    `UPDATE units SET jenjang='Sarjana Terapan'
      WHERE code IN ('PS-RSTJ','PS-TRO') AND (jenjang IS NULL OR jenjang='')`
  ).run();
  db.prepare(
    `UPDATE units SET jenjang='Diploma III'
      WHERE code='PS-D3TO' AND (jenjang IS NULL OR jenjang='')`
  ).run();
  db.prepare(
    `UPDATE refs SET jenjang='Sarjana Terapan'
      WHERE code='LAMTEKNIKSTR' AND (jenjang IS NULL OR jenjang='')`
  ).run();
  db.prepare(
    `UPDATE refs SET jenjang='Diploma III'
      WHERE code='LAMTEKNIKD3' AND (jenjang IS NULL OR jenjang='')`
  ).run();

  // Modul SPME: kunci instrumen akreditasi prodi lama (akreditasi_prodi_rstj/tro/to,
  // dibuat sebelum instrumen dibangkitkan dinamis dari units+jenjang) dipindahkan ke
  // skema baru berbasis unit.id (stabil walau kode/nama unit berubah nanti).
  try {
    const adaTabelSpme = db
      .prepare(`SELECT COUNT(*) c FROM sqlite_master WHERE type='table' AND name='spme_scores'`)
      .get().c;
    if (adaTabelSpme) {
      const pasanganLama = [
        ['akreditasi_prodi_rstj', 'PS-RSTJ'],
        ['akreditasi_prodi_tro', 'PS-TRO'],
        ['akreditasi_prodi_to', 'PS-D3TO'],
      ];
      for (const [kunciLama, kodeUnit] of pasanganLama) {
        const unit = db.prepare(`SELECT id FROM units WHERE code=?`).get(kodeUnit);
        if (!unit) continue;
        db.prepare(`UPDATE spme_scores SET instrumen=? WHERE instrumen=?`)
          .run(`akreditasi_prodi_u${unit.id}`, kunciLama);
      }
    }
  } catch {
    /* aman diabaikan — migrasi ringan, tidak boleh menggagalkan startup */
  }

  // Tabel spme_syarat: dipakai versi lama fitur "syarat perlu akreditasi
  // LAM Teknik" (diisi manual SPM). Sejak syarat perlu dihitung otomatis
  // dari nilai butir (lihat routes/spme.js hitungSyaratPerluLAM), tabel ini
  // sudah tidak dipakai lagi — CREATE TABLE dibiarkan (basis data lama
  // mungkin masih memilikinya) supaya tidak perlu migrasi penghapusan yang
  // berisiko, tapi tidak ada lagi kode yang menulis/membacanya.
  db.exec(`
    CREATE TABLE IF NOT EXISTS spme_syarat (
      period_id             INTEGER NOT NULL REFERENCES periods(id) ON DELETE CASCADE,
      instrumen              TEXT NOT NULL,
      syarat_terakreditasi   INTEGER,
      unggul_tier            TEXT,
      catatan                TEXT,
      updated_by             INTEGER REFERENCES users(id) ON DELETE SET NULL,
      updated_at             TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      PRIMARY KEY (period_id, instrumen)
    )
  `);

  // Satuan sejumlah ref_items LAM Teknik (indikator syarat perlu akreditasi
  // unggul yang bersifat kuantitatif — %, bulan, sks) sebelumnya salah
  // ditandai generik "Skor (skala 1-4)" di acuan.js, padahal target
  // aslinya berupa persentase/bulan/sks. Sumber data acuan.js sudah
  // dikoreksi, tapi basis data yang sudah lebih dulu terisi dari sumber
  // lama itu (di-seed sebelum koreksi) tidak ikut berubah otomatis —
  // migrasi ini mengoreksi ref_items yang bersangkutan secara langsung.
  // Dijaga hanya menimpa bila satuan MASIH generik "Skor (skala 1-4)",
  // supaya tidak menimpa perubahan manual SPM di Acuan Mutu.
  try {
    const satuanBenar = {
      'STR-19': 'sks', 'STR-27': '%', 'STR-28': '%', 'STR-38': '%',
      'STR-53': 'bulan', 'STR-54': '%',
      'D3-24': '%', 'D3-25': '%', 'D3-45': 'bulan', 'D3-46': '%',
    };
    const koreksiSatuan = db.prepare(
      `UPDATE ref_items SET satuan=? WHERE code=? AND satuan='Skor (skala 1-4)'`
    );
    for (const [kode, satuan] of Object.entries(satuanBenar)) koreksiSatuan.run(satuan, kode);
  } catch {
    /* aman diabaikan — migrasi ringan, tidak boleh menggagalkan startup */
  }

  // standard_indicators yang sudah diadopsi dari ref_items di atas
  // (source_ref_item_id) ikut menyalin satuan lama saat dibuat — migrasi
  // ini menyelaraskannya ke satuan ref_items terbaru supaya kolom
  // "Capaian terhadap target" pada Modul 3 (audit_assessments.capaian_persen)
  // diisi auditor dengan satuan yang benar, dipakai untuk pengecekan syarat
  // perlu akreditasi unggul otomatis (lihat hitungSyaratPerluLAM di
  // routes/spme.js). Aman dijalankan berulang — hanya menyamakan dengan
  // satuan ref_items saat ini.
  try {
    db.exec(`
      UPDATE standard_indicators
         SET satuan = (SELECT ri.satuan FROM ref_items ri WHERE ri.id = standard_indicators.source_ref_item_id)
       WHERE source_ref_item_id IN (
         SELECT id FROM ref_items WHERE code IN (
           'STR-19','STR-27','STR-28','STR-38','STR-53','STR-54',
           'D3-24','D3-25','D3-45','D3-46'
         )
       )
    `);
  } catch {
    /* aman diabaikan — migrasi ringan, tidak boleh menggagalkan startup */
  }

  // Pindahkan penugasan lama (tingkat standar) ke tingkat indikator, sekali saja.
  const adaTabelLama = db
    .prepare(
      `SELECT COUNT(*) c FROM sqlite_master
        WHERE type='table' AND name='standard_assignments'`
    )
    .get().c;

  if (adaTabelLama) {
    const belumMigrasi =
      db.prepare(`SELECT COUNT(*) c FROM indicator_assignments`).get().c === 0 &&
      db.prepare(`SELECT COUNT(*) c FROM standard_assignments`).get().c > 0;

    if (belumMigrasi) {
      db.exec(`
        INSERT OR IGNORE INTO indicator_assignments (indicator_id, unit_id, peran)
        SELECT i.id, a.unit_id, 'pelaksana'
          FROM standard_assignments a
          JOIN standard_indicators i ON i.standard_id = a.standard_id
      `);
      console.log('  Penugasan unit dipindahkan dari tingkat standar ke indikator.');
    }
  }

  // Harus dijalankan di sini (bagian dari migrate(), bukan initSchema() saja)
  // supaya rampung SEBELUM schema.sql dieksekusi ulang setelah catch —
  // schema.sql membuat indeks yang menyebut kolom program_kerja_id/
  // sasaran_mutu_id, jadi kolom itu harus sudah ada di tabel lama.
  pisahkanSasaranMutuJadiProgramKerja();
  perluasAuditAssessmentsUntukSasaranMutu();
}

/**
 * Setiap standar wajib memiliki minimal satu pernyataan. Basis data yang
 * dibuat sebelum lapisan "pernyataan standar" ditambahkan hanya punya
 * standards.statement (satu kalimat per standar) dan indikator yang
 * langsung menempel ke standar. Migrasi ini idempoten: standar yang sudah
 * punya pernyataan dilewati begitu saja.
 */
function migrasiPernyataanStandar() {
  const standarTanpaPernyataan = db
    .prepare(
      `SELECT s.id, s.statement, s.title FROM standards s
        WHERE NOT EXISTS (SELECT 1 FROM standard_statements st WHERE st.standard_id = s.id)`
    )
    .all();

  if (!standarTanpaPernyataan.length) return;

  const insStmt = db.prepare(
    `INSERT INTO standard_statements (standard_id, statement, sort_order)
     VALUES (?,?,0)`
  );
  const backfill = db.prepare(
    `UPDATE standard_indicators SET statement_id = ?
      WHERE standard_id = ? AND statement_id IS NULL`
  );

  db.transaction(() => {
    standarTanpaPernyataan.forEach((s) => {
      const teks = (s.statement && s.statement.trim()) || s.title;
      const stmtId = insStmt.run(s.id, teks).lastInsertRowid;
      backfill.run(stmtId, s.id);
    });
  })();

  console.log(
    `  ${standarTanpaPernyataan.length} standar dimigrasikan ke lapisan pernyataan standar.`
  );
}

// Urutan tetap acuan mutu dipakai untuk menyusun pernyataan standar dan
// indikator di dalamnya pada Modul 1 (Penetapan Standar & Kelola Standar):
// SN Dikti dahulu, lalu ISO 21001, BAN-PT, LAM Teknik (STr & D3 disetarakan),
// UI GreenMetric, dan Zona Integritas paling akhir. Indikator/pernyataan yang
// tidak bersumber dari acuan mana pun (ditulis manual) diletakkan paling
// akhir.
const URUTAN_ACUAN_STANDAR = {
  SNDIKTI: 1, ISO21001: 2, BANPT: 3, LAMTEKNIKSTR: 4, LAMTEKNIKD3: 4,
  GREENMETRIC: 5, ZI: 6,
};
const peringkatAcuan = (kode) => URUTAN_ACUAN_STANDAR[kode] ?? 99;

/**
 * Susun ulang standard_statements.sort_order dan standard_indicators.sort_order
 * di setiap standar mengikuti urutan acuan tetap di atas — pernyataan
 * ditentukan oleh peringkat TERBAIK di antara indikator-indikatornya
 * (pernyataan biasanya sudah homogen satu acuan per desain, lihat
 * simpanPernyataan/simpanIndikator di routes/standar.js), sementara
 * indikator di dalam satu pernyataan diurut oleh peringkat acuannya
 * masing-masing. Sepenuhnya deterministik dari data saat ini — aman dan
 * perlu dijalankan setiap start server (bukan cuma sekali) supaya standar
 * yang isinya berubah setelahnya (indikator baru ditambah, dsb.) tetap
 * mengikuti urutan ini tanpa perlu migrasi tersendiri.
 */
function urutkanPernyataanDanIndikator() {
  const standarList = db.prepare(`SELECT id FROM standards`).all();
  if (!standarList.length) return;

  const ambilPernyataan = db.prepare(
    `SELECT id, sort_order FROM standard_statements WHERE standard_id=?`
  );
  const ambilIndikator = db.prepare(
    `SELECT si.id, si.sort_order, si.statement_id, r.code AS acuan_kode
       FROM standard_indicators si
       LEFT JOIN ref_items b ON b.id = si.source_ref_item_id
       LEFT JOIN refs r ON r.id = b.ref_id
      WHERE si.standard_id=?`
  );
  const setUrutanPernyataan = db.prepare(
    `UPDATE standard_statements SET sort_order=? WHERE id=? AND sort_order<>?`
  );
  const setUrutanIndikator = db.prepare(
    `UPDATE standard_indicators SET sort_order=? WHERE id=? AND sort_order<>?`
  );

  db.transaction(() => {
    for (const std of standarList) {
      const pernyataan = ambilPernyataan.all(std.id);
      const indikator = ambilIndikator.all(std.id);

      const indikatorPerPernyataan = new Map();
      for (const ind of indikator) {
        const key = ind.statement_id;
        if (!indikatorPerPernyataan.has(key)) indikatorPerPernyataan.set(key, []);
        indikatorPerPernyataan.get(key).push(ind);
      }

      const pernyataanBerperingkat = pernyataan.map((p) => {
        const daftarIndikator = indikatorPerPernyataan.get(p.id) || [];
        const peringkat = daftarIndikator.length
          ? Math.min(...daftarIndikator.map((i) => peringkatAcuan(i.acuan_kode)))
          : 99;
        return { ...p, _peringkat: peringkat };
      });
      pernyataanBerperingkat.sort(
        (a, b) => a._peringkat - b._peringkat || a.sort_order - b.sort_order || a.id - b.id
      );
      pernyataanBerperingkat.forEach((p, i) => setUrutanPernyataan.run(i, p.id, i));

      for (const daftarIndikator of indikatorPerPernyataan.values()) {
        const terurut = [...daftarIndikator].sort(
          (a, b) =>
            peringkatAcuan(a.acuan_kode) - peringkatAcuan(b.acuan_kode) ||
            a.sort_order - b.sort_order ||
            a.id - b.id
        );
        terurut.forEach((ind, i) => setUrutanIndikator.run(i, ind.id, i));
      }
    }
  })();
}

export function logActivity(userId, aksi, entity, entityId, keterangan = null) {
  try {
    db.prepare(
      `INSERT INTO activity_log (user_id, aksi, entity, entity_id, keterangan)
       VALUES (?, ?, ?, ?, ?)`
    ).run(userId ?? null, aksi, entity ?? null, entityId ?? null, keterangan);
  } catch {
    /* logging tidak boleh menggagalkan request */
  }
}

export { DB_PATH, DATA_DIR };
