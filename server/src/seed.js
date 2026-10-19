/**
 * Seed data awal Aplikasi Evaluasi Mutu Internal PKTJ.
 *
 *   node src/seed.js           -> isi data bila basis data masih kosong
 *   node src/seed.js --reset   -> hapus seluruh data lalu isi ulang
 */
import bcrypt from 'bcryptjs';
import { db, initSchema } from './db.js';
import { AGENDA_TEMPLATE } from './routes/rtm.js';
import { STANDAR30, labelKategori } from './data/standar30.js';
import { ACUAN } from './data/acuan.js';

const RESET = process.argv.includes('--reset');

initSchema();

if (RESET) {
  db.pragma('foreign_keys = OFF');
  [
    'ref_map', 'ref_items', 'refs',
    'signatures', 'rtm_outputs', 'rtm_agenda', 'rtm_participants', 'rtm_meetings',
    'corrective_actions', 'findings', 'audit_assessments', 'audit_members', 'audits',
    'implementations', 'indicator_assignments', 'standard_indicators',
    'standard_statements', 'standards',
    'periods', 'users', 'units', 'activity_log',
  ].forEach((t) => {
    try { db.prepare(`DELETE FROM ${t}`).run(); } catch { /* tabel belum ada */ }
  });
  try { db.prepare(`DELETE FROM standard_assignments`).run(); } catch { /* sudah tidak dipakai */ }
  try { db.prepare(`DELETE FROM sqlite_sequence`).run(); } catch { /* tabel belum ada */ }
  db.pragma('foreign_keys = ON');
  console.log('  Data lama dihapus.');
}

if (db.prepare(`SELECT COUNT(*) c FROM units`).get().c > 0 && !RESET) {
  console.log('  Basis data sudah berisi data. Gunakan --reset untuk mengisi ulang.');
  process.exit(0);
}

/* ===================================================================== */
/* 1. UNIT / STRUKTUR ORGANISASI PKTJ                                    */
/* ===================================================================== */
const UNITS = [
  ['DIR',        'Direktorat (Direktur dan Wakil Direktur)',                       'pimpinan', null],
  ['SENAT',      'Senat',                                                          'senat', null],
  ['SPI',        'Satuan Pemeriksaan Intern',                                      'satuan', null],
  ['SPM',        'Satuan Penjaminan Mutu',                                         'satuan', null],
  ['PUSBANGKAR', 'Pusat Pembangunan Karakter',                                     'pusat', null],
  ['P3M',        'Pusat Penelitian dan Pengabdian kepada Masyarakat',              'pusat', null],
  ['BAAK',       'Bagian Administrasi Akademik dan Ketarunaan',                    'bagian', null],
  ['KUK',        'Bagian Keuangan, Umum, dan Kerjasama',                           'bagian', null],
  ['PS-RSTJ',    'Sarjana Terapan Rekayasa Sistem Transportasi Jalan',             'prodi', 'Sarjana Terapan'],
  ['PS-TRO',     'Sarjana Terapan Teknologi Rekayasa Otomotif',                    'prodi', 'Sarjana Terapan'],
  ['PS-D3TO',    'Diploma III Teknologi Otomotif',                                 'prodi', 'Diploma III'],
  ['LAB',        'Unit Laboratorium',                                              'unit', null],
  ['BHS',        'Unit Bahasa',                                                    'unit', null],
  ['UTI',        'Unit Teknik Informatika',                                       'unit', null],
  ['KES',        'Unit Kesehatan',                                                 'unit', null],
  ['ASR',        'Unit Asrama',                                                    'unit', null],
  ['UPU',        'Unit Pengembangan Usaha',                                        'unit', null],
  ['PERPUS',     'Unit Perpustakaan',                                              'unit', null],
];

const insUnit = db.prepare(`INSERT INTO units (code, name, type, jenjang) VALUES (?,?,?,?)`);
const U = {};
UNITS.forEach(([c, n, t, j]) => { U[c] = insUnit.run(c, n, t, j).lastInsertRowid; });
console.log(`  ${UNITS.length} unit organisasi ditambahkan.`);

/* ===================================================================== */
/* 2. PENGGUNA                                                           */
/* ===================================================================== */
const pw = (p) => bcrypt.hashSync(p, 10);
const DEFAULT_PW = 'pktj2026';

const USERS = [
  ['198001012005011001', 'Administrator Sistem',        'admin@pktj.ac.id',       'admin',    'Administrator Aplikasi',              'SPM'],

  ['197505102000031002', 'Direktur PKTJ',               'direktur@pktj.ac.id',    'pimpinan', 'Direktur',                            'DIR'],
  ['197801152003121003', 'Wakil Direktur I',            'wadir1@pktj.ac.id',      'pimpinan', 'Wakil Direktur I Bidang Akademik',    'DIR'],
  ['197903202004011004', 'Wakil Direktur II',           'wadir2@pktj.ac.id',      'pimpinan', 'Wakil Direktur II Bidang Umum dan Keuangan', 'DIR'],
  ['198102252006041005', 'Wakil Direktur III',          'wadir3@pktj.ac.id',      'pimpinan', 'Wakil Direktur III Bidang Ketarunaan','DIR'],

  ['198304102008012006', 'Ketua Satuan Penjaminan Mutu','spm@pktj.ac.id',         'spm',      'Ketua Satuan Penjaminan Mutu',        'SPM'],
  ['198705152010012007', 'Sekretaris SPM',              'sekspm@pktj.ac.id',      'spm',      'Sekretaris Satuan Penjaminan Mutu',   'SPM'],

  // Auditor lain akan ditambahkan kemudian oleh akun SPM (Data Master > Pengguna).
  // Ini contoh 1 akun auditor awal.
  [null,                    'Frans Tohom',                'frans.tohom@gmail.com', 'auditor',  'Auditor Mutu Internal (Ketua Tim)',   'SPM'],

  ['197712122002121011', 'Ketua Senat',                 'senat@pktj.ac.id',       'auditee',  'Ketua Senat',                         'SENAT'],
  ['198202022006041012', 'Kepala SPI',                  'spi@pktj.ac.id',         'auditee',  'Kepala Satuan Pemeriksaan Intern',    'SPI'],
  ['198505052010011013', 'Kepala Pusbangkar',           'pusbangkar@pktj.ac.id',  'auditee',  'Kepala Pusat Pembangunan Karakter',   'PUSBANGKAR'],
  ['198606062011011014', 'Kepala P3M',                  'p3m@pktj.ac.id',         'auditee',  'Kepala P3M',                          'P3M'],
  ['198707072012011015', 'Kepala BAAK',                 'baak@pktj.ac.id',        'auditee',  'Kepala Bagian Administrasi Akademik dan Ketarunaan', 'BAAK'],
  ['198808082013011016', 'Kepala Bagian KUK',           'kuk@pktj.ac.id',         'auditee',  'Kepala Bagian Keuangan, Umum, dan Kerjasama', 'KUK'],
  ['198909092014011017', 'Ketua Prodi RSTJ',            'rstj@pktj.ac.id',        'auditee',  'Ketua Program Studi Sarjana Terapan RSTJ', 'PS-RSTJ'],
  ['199010102015011018', 'Ketua Prodi TRO',             'tro@pktj.ac.id',         'auditee',  'Ketua Program Studi Sarjana Terapan TRO', 'PS-TRO'],
  ['199111112016011019', 'Ketua Prodi D-III TO',        'd3to@pktj.ac.id',        'auditee',  'Ketua Program Studi Diploma III Teknologi Otomotif', 'PS-D3TO'],
  ['199212122017011020', 'Kepala Unit Laboratorium',    'lab@pktj.ac.id',         'auditee',  'Kepala Unit Laboratorium',            'LAB'],
  ['199301132018012021', 'Kepala Unit Bahasa',          'bahasa@pktj.ac.id',      'auditee',  'Kepala Unit Bahasa',                  'BHS'],
  ['199402142019011022', 'Kepala Unit TI',              'uti@pktj.ac.id',         'auditee',  'Kepala Unit Teknik Informatika',     'UTI'],
  ['199503152020012023', 'Kepala Unit Kesehatan',       'kesehatan@pktj.ac.id',   'auditee',  'Kepala Unit Kesehatan',               'KES'],
  ['199604162021011024', 'Kepala Unit Asrama',          'asrama@pktj.ac.id',      'auditee',  'Kepala Unit Asrama',                  'ASR'],
  ['199705172022011025', 'Kepala Unit Pengembangan Usaha','upu@pktj.ac.id',       'auditee',  'Kepala Unit Pengembangan Usaha',      'UPU'],
];

const insUser = db.prepare(
  `INSERT INTO users (nip, name, email, password_hash, role, jabatan, unit_id)
   VALUES (?,?,?,?,?,?,?)`
);
const USR = {};
USERS.forEach(([nip, name, email, role, jabatan, unit]) => {
  USR[email] = insUser.run(nip, name, email, pw(DEFAULT_PW), role, jabatan, U[unit])
    .lastInsertRowid;
});
console.log(`  ${USERS.length} pengguna ditambahkan (kata sandi awal: ${DEFAULT_PW}).`);

/* ===================================================================== */
/* 3. PERIODE                                                            */
/* ===================================================================== */
const periodId = db
  .prepare(
    `INSERT INTO periods (name, year, start_date, end_date, status) VALUES (?,?,?,?,?)`
  )
  .run('Siklus SPMI Tahun Akademik 2025/2026', 2026, '2025-09-01', '2026-08-31', 'aktif')
  .lastInsertRowid;

/* ===================================================================== */
/* 4. ACUAN MUTU EKSTERNAL                                               */
/* ===================================================================== */
const insRef = db.prepare(
  `INSERT INTO refs (code, name, version, publisher, effective_date, warna,
                     keterangan, jenjang, skor_min, skor_maks, skor_step, sort_order)
   VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`
);
const insRefItem = db.prepare(
  `INSERT INTO ref_items (ref_id, parent_id, code, title, uraian, tipe, level,
                          bobot, wajib_petakan, target, target_skor, satuan,
                          strategy, sort_order)
   VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
);

let jmlButir = 0;
let jmlButirIndikator = 0;
// Peta (kode acuan):(kode butir) -> id ref_items, dipakai Modul 1 (STANDAR30)
// untuk menautkan source_ref_item_id secara verbatim tanpa kueri tambahan.
const REF_ITEM_ID = {};
db.transaction(() => {
  ACUAN.forEach((a, n) => {
    const rid = insRef.run(
      a.code, a.name, a.version ?? null, a.publisher ?? null,
      a.effective_date ?? null, a.warna ?? null, a.keterangan ?? null,
      a.jenjang ?? null, a.skor_min ?? null, a.skor_maks ?? null, a.skor_step ?? null, n
    ).lastInsertRowid;

    const tanam = (daftar, parentId, level) => {
      (daftar || []).forEach((b, i) => {
        const id = insRefItem.run(
          rid, parentId, b.code, b.title, b.uraian ?? null,
          b.tipe ?? 'butir', level, b.bobot ?? null, b.payung ? 0 : 1,
          b.target ?? null, b.target_skor ?? null, b.satuan ?? null,
          b.strategy ?? null, i
        ).lastInsertRowid;
        jmlButir++;
        if (b.target) jmlButirIndikator++;
        REF_ITEM_ID[`${a.code}:${b.code}`] = id;
        if (b.anak?.length) tanam(b.anak, id, level + 1);
      });
    };
    tanam(a.butir, null, 1);
  });
})();
console.log(
  `  ${ACUAN.length} acuan mutu, ${jmlButir} butir kerangka, ${jmlButirIndikator} di antaranya siap diadopsi sebagai indikator.`
);

/* ===================================================================== */
/* 5. STANDAR MUTU — 30 standar dari Peta Standar Gabungan PKTJ           */
/*    Setiap indikator ditarik verbatim dari salah satu 7 acuan mutu     */
/*    (source_ref_item_id) — tidak ada indikator yang diketik manual.    */
/* ===================================================================== */
const insStd = db.prepare(
  `INSERT INTO standards
     (period_id, code, category, ranah, kelompok, sifat, title,
      rationale, scope, strategy, status, ditetapkan_at, ditetapkan_by, created_by)
   VALUES (?,?,?,?,?,?,?,?,?,?,'ditetapkan',datetime('now','localtime'),?,?)`
);
const insStmt = db.prepare(
  `INSERT INTO standard_statements (standard_id, label, statement, rationale, sort_order)
   VALUES (?,?,?,?,?)`
);
const insInd = db.prepare(
  `INSERT INTO standard_indicators
     (standard_id, statement_id, code, indicator, target, target_skor, satuan,
      strategy, bukti_sahih, deadline, source_ref_item_id, sort_order)
   VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`
);
const insAsg = db.prepare(
  `INSERT OR IGNORE INTO indicator_assignments (indicator_id, unit_id, peran)
   VALUES (?,?,?)`
);

const spmUser = USR['spm@pktj.ac.id'];
let jmlPernyataan = 0;
let jmlIndikator = 0;
let jmlPenugasan = 0;

db.transaction(() => {
  STANDAR30.forEach((s) => {
    const sid = insStd.run(
      periodId, s.code, labelKategori(s.ranah, s.kelompok), s.ranah,
      s.kelompok ?? null, s.sifat, s.title, s.rationale,
      s.scope ?? null, s.strategiStandar ?? null, spmUser, spmUser
    ).lastInsertRowid;

    s.pernyataan.forEach((p, pn) => {
      const stmtId = insStmt.run(sid, p.label ?? null, p.statement, p.rationale ?? null, pn)
        .lastInsertRowid;
      jmlPernyataan++;

      p.indikator.forEach((it, n) => {
        const refItemId = REF_ITEM_ID[`${it.ref}:${it.kode}`];
        if (!refItemId) {
          throw new Error(
            `STANDAR30 ${s.code}: butir sumber tidak ditemukan (${it.ref}:${it.kode})`
          );
        }
        const kodeInd = `${s.code.replace('+', '')}.${pn + 1}.${n + 1}`;
        const iid = insInd.run(
          sid, stmtId, kodeInd, it.indikator, it.target ?? null,
          it.target_skor ?? null, it.satuan ?? null, it.strategy ?? null,
          it.bukti_sahih ?? null, '2026-06-30', refItemId, n
        ).lastInsertRowid;
        jmlIndikator++;

        // Penanggung jawab ditetapkan pada tingkat STANDAR (pengampu/pelaksana
        // sesuai Peta Standar Gabungan), diterapkan ke setiap indikatornya.
        (s.unitPengampu || []).forEach((kode) => {
          if (U[kode]) { insAsg.run(iid, U[kode], 'pengampu'); jmlPenugasan++; }
        });
        (s.unitPelaksana || []).forEach((kode) => {
          if (U[kode] && !(s.unitPengampu || []).includes(kode)) {
            insAsg.run(iid, U[kode], 'pelaksana');
            jmlPenugasan++;
          }
        });
      });
    });
  });
})();

const wajib = STANDAR30.filter((s) => s.sifat === 'wajib').length;
console.log(
  `  ${STANDAR30.length} standar (${wajib} wajib SN Dikti, ` +
  `${STANDAR30.length - wajib} melampaui), ${jmlPernyataan} pernyataan, ` +
  `${jmlIndikator} indikator (seluruhnya adopsi verbatim dari 7 acuan mutu), ` +
  `${jmlPenugasan} penugasan unit.`
);

/* ===================================================================== */
/* 6. CONTOH RTM                                                         */
/* ===================================================================== */
const rtmId = db
  .prepare(
    `INSERT INTO rtm_meetings
       (period_id, nomor, judul, tanggal, waktu, tempat, pemimpin_id, notulis_id,
        status, created_by)
     VALUES (?,?,?,?,?,?,?,?,?,?)`
  )
  .run(
    periodId, 'RTM/01/PKTJ/2026',
    'Rapat Tinjauan Manajemen Semester Genap TA 2025/2026',
    '2026-07-15', '09.00 - 15.00 WIB', 'Ruang Rapat Direktorat PKTJ',
    USR['direktur@pktj.ac.id'], USR['sekspm@pktj.ac.id'], 'rencana', spmUser
  ).lastInsertRowid;

const insAg = db.prepare(
  `INSERT INTO rtm_agenda (rtm_id, agenda_key, parent_key, judul, sort_order)
   VALUES (?,?,?,?,?)`
);
AGENDA_TEMPLATE.forEach((a, n) => insAg.run(rtmId, a.key, a.parent, a.judul, n));

const insPes = db.prepare(
  `INSERT OR IGNORE INTO rtm_participants (rtm_id, user_id, nama, jabatan, hadir)
   VALUES (?,?,?,?,1)`
);
db.prepare(
  `SELECT id, name, jabatan FROM users WHERE role IN ('pimpinan','spm') AND is_active=1`
).all().forEach((u) => insPes.run(rtmId, u.id, u.name, u.jabatan));

console.log('  1 agenda RTM contoh dibuat beserta 16 butir agenda.');

console.log(`
=====================================================================
  Data awal berhasil dibuat.

  Akun untuk masuk (kata sandi semua akun: ${DEFAULT_PW})
  ---------------------------------------------------------------
  Penjaminan Mutu   : spm@pktj.ac.id
  Auditor (contoh)  : frans.tohom@gmail.com
  Auditee (contoh)  : baak@pktj.ac.id  /  rstj@pktj.ac.id
  Pimpinan          : direktur@pktj.ac.id  /  wadir1@pktj.ac.id
  Administrator     : admin@pktj.ac.id

  Tambah akun auditee/auditor lain: masuk sebagai SPM > menu Data Master >
  tab Pengguna > "Pengguna Baru".
=====================================================================
`);
