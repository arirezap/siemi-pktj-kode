import { Router } from 'express';
import { db, logActivity } from '../db.js';
import { requireAuth, requireRole, canAccessUnit } from '../auth.js';
import { SKALA_PERINGKAT, TIPE_NILAI, normalkanPeringkat, persenPeringkat } from '../peringkat.js';

const router = Router();
router.use(requireAuth);

/* ============================================================
   SASARAN MUTU — diisi oleh SEMUA unit/bagian. Satu Program
   Kerja (berjenis Kinerja Utama atau Kinerja Tambahan) dapat
   memuat BEBERAPA sasaran mutu sekaligus. Setiap sasaran punya
   rencana capaian per sub-periode (bulanan/triwulanan/semester);
   capaian aktual dicatat berkala di Modul Pelaksanaan (lihat
   POST /sasaran/:sasaranId/capaian di bawah). Hasilnya turut
   dievaluasi lewat Modul 3 EMI/Audit — lihat routes/emi.js.
   ============================================================ */

const JUMLAH_PERIODE = { bulanan: 12, triwulanan: 4, semester: 2 };
const LABEL_BULAN = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];
const LABEL_DEFAULT = {
  bulanan: LABEL_BULAN,
  triwulanan: ['Triwulan I', 'Triwulan II', 'Triwulan III', 'Triwulan IV'],
  semester: ['Semester I', 'Semester II'],
};
const JENIS_VALID = ['utama', 'tambahan'];

/** Tipe nilai sasaran: 'angka' (default) atau 'peringkat' (huruf/predikat,
 *  skala di peringkat.js). Kembalikan pesan galat, atau null bila valid. */
function cekTipeNilai(s) {
  const tipe = s.tipe_nilai || 'angka';
  if (!TIPE_NILAI.includes(tipe)) return 'tipe_nilai harus "angka" atau "peringkat"';
  if (tipe === 'angka') return null;
  if (!SKALA_PERINGKAT[s.skala_peringkat]) return 'Skala peringkat tidak dikenal';
  if (!normalkanPeringkat(s.skala_peringkat, s.target))
    return `Target "${s.target}" bukan level pada skala ${SKALA_PERINGKAT[s.skala_peringkat].label}`;
  for (const r of s.rencana || []) {
    if (r.target_periode && !['0', '-'].includes(String(r.target_periode).trim()) && !normalkanPeringkat(s.skala_peringkat, r.target_periode))
      return `Rencana "${r.target_periode}" bukan level pada skala ${SKALA_PERINGKAT[s.skala_peringkat].label}`;
  }
  return null;
}
const nilaiTipe = (s) => (s.tipe_nilai === 'peringkat' ? 'peringkat' : 'angka');
const nilaiSkala = (s) => (s.tipe_nilai === 'peringkat' ? s.skala_peringkat : null);

/** Sasaran mutu boleh disusun untuk tahun berjalan atau tahun sebelumnya
 *  saja (bisa aktif bersamaan), terlepas dari siklus SPMI yang sedang
 *  berjalan — lihat komentar kolom program_kerja.tahun di schema.sql. */
function tahunValid(t) {
  const now = new Date().getFullYear();
  return [now, now - 1].includes(Number(t));
}

/** Pastikan sub_unit_id (bila diisi) benar-benar sub-unit kerja milik unit
 *  ini (type='sub_unit' dan parent_id=uid) — mencegah salah pasang. */
function subUnitValid(subUnitId, uid) {
  if (!subUnitId) return true;
  const su = db.prepare(`SELECT * FROM units WHERE id=?`).get(subUnitId);
  return !!su && su.type === 'sub_unit' && Number(su.parent_id) === Number(uid);
}

/** Kunci komposit unit_id+tahun dipakai sebagai signatures.entity_id (tabel
 *  itu memakai satu kolom entity_id INTEGER dan dipakai bersama modul lain,
 *  jadi tidak menambah kolom baru) — aman selama unit_id tidak pernah
 *  mencapai puluhan ribu, jauh di atas kebutuhan realistis aplikasi ini. */
function kunciTtd(unitId, tahun) {
  return Number(unitId) * 100000 + Number(tahun);
}

function buatRencanaDefault(periode_evaluasi, rencana) {
  if (Array.isArray(rencana) && rencana.length) return rencana;
  return Array.from({ length: JUMLAH_PERIODE[periode_evaluasi] }, (_, i) => ({
    periode_ke: i + 1,
    label: LABEL_DEFAULT[periode_evaluasi][i],
    target_periode: null,
  }));
}

/** Ambil satu program kerja lengkap dengan sasaran+rencana+capaian+penilaian */
function ambilProgramKerjaLengkap(pk) {
  const sasaranList = db
    .prepare(`SELECT * FROM sasaran_mutu WHERE program_kerja_id=? ORDER BY sort_order, id`)
    .all(pk.id);

  const rencanaStmt = db.prepare(
    `SELECT periode_ke, label, target_periode FROM sasaran_mutu_rencana
      WHERE sasaran_mutu_id=? ORDER BY periode_ke`
  );
  const capaianStmt = db.prepare(
    `SELECT periode_ke, realisasi, capaian_nilai, capaian_teks, bukti_uraian, bukti_url,
            kendala, faktor_pendukung, status, submitted_at
       FROM sasaran_mutu_capaian WHERE sasaran_mutu_id=? ORDER BY periode_ke`
  );
  const nilaiStmt = db.prepare(
    `SELECT aa.skor, aa.capaian_persen, aa.verdict, aa.catatan_auditor,
            aa.verifikasi_bukti, a.status AS audit_status
       FROM audit_assessments aa JOIN audits a ON a.id = aa.audit_id
      WHERE aa.sasaran_mutu_id=? ORDER BY aa.updated_at DESC LIMIT 1`
  );

  const sasaran = sasaranList.map((sm) => {
    const rencana = rencanaStmt.all(sm.id);
    const capaian = capaianStmt.all(sm.id);
    const capaianByPeriode = Object.fromEntries(capaian.map((c) => [c.periode_ke, c]));
    return {
      ...sm,
      rencana: rencana.map((r) => {
        const gab = { ...r, ...(capaianByPeriode[r.periode_ke] || {}) };
        if (sm.tipe_nilai === 'peringkat' && gab.capaian_teks)
          gab.capaian_persen = persenPeringkat(sm.skala_peringkat, sm.target, gab.capaian_teks);
        return gab;
      }),
      terisi: capaian.filter((c) => c.status === 'diserahkan').length,
      total_periode: rencana.length,
      penilaian: nilaiStmt.get(sm.id) || null,
    };
  });

  return { ...pk, sasaran };
}

/* --------------------- PENGESAHAN FORMULIR SASARAN MUTU ------------------
   Tanda tangan pengesahan formulir cetak Sasaran Mutu (Penetapan, Rencana
   Target, Monitoring Pencapaian) — satu tanda tangan berlaku untuk ketiga
   lembar sekaligus, dibubuhkan oleh Kepala Unit/Bagian pemilik program
   kerja (atau SPM), per unit + tahun. Dibubuhkan dengan menggambar
   langsung atau mengunggah gambar tanda tangan (lihat PadTandaTangan).
   Ditempatkan SEBELUM route ber-parameter (/:id, dst.) supaya
   'GET/DELETE /tanda-tangan' tidak tertangkap sebagai id='tanda-tangan'.
   --------------------------------------------------------------------- */
router.get('/tanda-tangan', (req, res) => {
  const unitId = Number(req.query.unit_id);
  const tahun = Number(req.query.tahun);
  if (!unitId || !tahun)
    return res.status(400).json({ error: 'unit_id dan tahun wajib diisi' });

  const ttd = db
    .prepare(`SELECT * FROM signatures WHERE entity_type='sasaran_mutu' AND entity_id=?`)
    .get(kunciTtd(unitId, tahun));
  res.json(ttd || null);
});

router.post('/tanda-tangan', requireRole('auditee', 'spm'), (req, res) => {
  const { unit_id, tahun, image_data } = req.body;
  const unitId = Number(unit_id);
  const th = Number(tahun);
  if (!unitId || !th)
    return res.status(400).json({ error: 'unit_id dan tahun wajib diisi' });
  if (!canAccessUnit(req.user, unitId))
    return res.status(403).json({ error: 'Bukan unit Anda' });
  if (!image_data) return res.status(400).json({ error: 'image_data wajib diisi' });
  if (!/^data:image\/(png|jpeg);base64,/.test(image_data))
    return res.status(400).json({ error: 'Tanda tangan harus berupa gambar' });

  db.prepare(
    `INSERT INTO signatures (entity_type, entity_id, user_id, peran, nama, jabatan, image_data)
     VALUES ('sasaran_mutu',?,?,'Kepala Unit/Bagian',?,?,?)
     ON CONFLICT(entity_type, entity_id, peran, user_id)
       DO UPDATE SET image_data=excluded.image_data, nama=excluded.nama,
                      jabatan=excluded.jabatan, signed_at=datetime('now','localtime')`
  ).run(kunciTtd(unitId, th), req.user.id, req.user.name, req.user.jabatan ?? null, image_data);

  logActivity(req.user.id, 'tanda_tangan_sasaran_mutu', 'program_kerja', null, `Unit ${unitId} tahun ${th}`);
  res.json({ ok: true });
});

router.delete('/tanda-tangan', requireRole('auditee', 'spm'), (req, res) => {
  const unitId = Number(req.query.unit_id);
  const tahun = Number(req.query.tahun);
  if (!unitId || !tahun)
    return res.status(400).json({ error: 'unit_id dan tahun wajib diisi' });
  if (!canAccessUnit(req.user, unitId))
    return res.status(403).json({ error: 'Bukan unit Anda' });

  db.prepare(`DELETE FROM signatures WHERE entity_type='sasaran_mutu' AND entity_id=?`)
    .run(kunciTtd(unitId, tahun));
  res.json({ ok: true });
});

/** Daftar program kerja (+ sasaran di dalamnya) satu unit pada satu periode.
 *  Query opsional `tahun` memfilter satu tahun saja — bila tidak diisi,
 *  seluruh tahun yang ada (mis. tahun berjalan & tahun sebelumnya, yang
 *  boleh aktif bersamaan) ikut dikembalikan. */
router.get('/', (req, res) => {
  const unitId = Number(req.query.unit_id);
  const periodId = Number(req.query.period_id);
  const tahun = req.query.tahun ? Number(req.query.tahun) : null;
  if (!unitId || !periodId)
    return res.status(400).json({ error: 'unit_id dan period_id wajib diisi' });
  if (!canAccessUnit(req.user, unitId))
    return res.status(403).json({ error: 'Bukan unit Anda' });

  const daftar = db
    .prepare(
      `SELECT pk.*, u.name AS unit_name, u.code AS unit_code, su.name AS sub_unit_name
         FROM program_kerja pk
         JOIN units u ON u.id = pk.unit_id
         LEFT JOIN units su ON su.id = pk.sub_unit_id
        WHERE pk.unit_id=? AND pk.period_id=? AND (? IS NULL OR pk.tahun=?)
        ORDER BY pk.tahun DESC, pk.jenis, pk.id`
    )
    .all(unitId, periodId, tahun, tahun);

  res.json(daftar.map(ambilProgramKerjaLengkap));
});

/** Detail satu program kerja */
router.get('/:id', (req, res) => {
  const pk = db
    .prepare(
      `SELECT pk.*, u.name AS unit_name, su.name AS sub_unit_name
         FROM program_kerja pk
         JOIN units u ON u.id = pk.unit_id
         LEFT JOIN units su ON su.id = pk.sub_unit_id
        WHERE pk.id=?`
    )
    .get(req.params.id);
  if (!pk) return res.status(404).json({ error: 'Program kerja tidak ditemukan' });
  if (!canAccessUnit(req.user, pk.unit_id))
    return res.status(403).json({ error: 'Bukan unit Anda' });

  res.json(ambilProgramKerjaLengkap(pk));
});

/** Buat program kerja baru beserta satu atau beberapa sasaran mutu.
 *  sub_unit_id opsional (hanya berlaku bila unit ini punya sub-unit kerja
 *  terdaftar di Data Master); tahun wajib diisi — tahun berjalan atau tahun
 *  sebelumnya saja, boleh punya program kerja aktif di keduanya sekaligus. */
router.post('/', requireRole('auditee', 'spm'), (req, res) => {
  const {
    unit_id, sub_unit_id = null, period_id, tahun = new Date().getFullYear(),
    jenis = 'utama', nama, sasaran,
  } = req.body;

  const uid = Number(unit_id || req.user.unit_id);
  if (!uid || !period_id || !nama)
    return res.status(400).json({ error: 'unit_id, period_id, dan nama program kerja wajib diisi' });
  if (!canAccessUnit(req.user, uid))
    return res.status(403).json({ error: 'Bukan unit Anda' });
  if (!JENIS_VALID.includes(jenis))
    return res.status(400).json({ error: 'jenis harus "utama" atau "tambahan"' });
  if (!tahunValid(tahun))
    return res.status(400).json({ error: 'Tahun hanya boleh tahun berjalan atau tahun sebelumnya' });
  if (!subUnitValid(sub_unit_id, uid))
    return res.status(400).json({ error: 'Sub-unit kerja tidak valid untuk unit ini' });
  if (!Array.isArray(sasaran) || sasaran.length === 0)
    return res.status(400).json({ error: 'Minimal satu sasaran wajib diisi' });
  for (const s of sasaran) {
    if (!s.sasaran || !s.target)
      return res.status(400).json({ error: 'Setiap sasaran wajib memiliki uraian sasaran dan target' });
    if (!JUMLAH_PERIODE[s.periode_evaluasi || 'bulanan'])
      return res.status(400).json({ error: 'periode_evaluasi tidak valid' });
    const galat = cekTipeNilai(s);
    if (galat) return res.status(400).json({ error: galat });
  }

  const insProgram = db.prepare(
    `INSERT INTO program_kerja (unit_id, sub_unit_id, period_id, tahun, jenis, nama, created_by)
     VALUES (?,?,?,?,?,?,?)`
  );
  const insSasaran = db.prepare(
    `INSERT INTO sasaran_mutu (program_kerja_id, sasaran, target, satuan, periode_evaluasi, sort_order, tipe_nilai, skala_peringkat)
     VALUES (?,?,?,?,?,?,?,?)`
  );
  const insRencana = db.prepare(
    `INSERT INTO sasaran_mutu_rencana (sasaran_mutu_id, periode_ke, label, target_periode)
     VALUES (?,?,?,?)`
  );

  const id = db.transaction(() => {
    const pkId = insProgram.run(uid, sub_unit_id || null, period_id, Number(tahun), jenis, nama, req.user.id).lastInsertRowid;
    sasaran.forEach((s, idx) => {
      const pe = s.periode_evaluasi || 'bulanan';
      const smId = insSasaran.run(pkId, s.sasaran, s.target, s.satuan ?? null, pe, idx, nilaiTipe(s), nilaiSkala(s)).lastInsertRowid;
      for (const r of buatRencanaDefault(pe, s.rencana)) {
        insRencana.run(smId, r.periode_ke, r.label, r.target_periode ?? null);
      }
    });
    return pkId;
  })();

  logActivity(req.user.id, 'buat_program_kerja', 'program_kerja', id, nama);
  res.status(201).json({ id, ok: true });
});

/** Perbarui program kerja — hanya boleh selama masih draft. Body.sasaran,
 *  bila dikirim, MENGGANTI seluruh daftar sasaran: item yang punya "id"
 *  diperbarui, yang tanpa "id" ditambahkan baru, dan sasaran lama yang
 *  tidak lagi disebut akan dihapus (ditolak bila sudah ada capaian yang
 *  diserahkan, supaya data isian tidak hilang tanpa sengaja). */
router.put('/:id', requireRole('auditee', 'spm'), (req, res) => {
  const pk = db.prepare(`SELECT * FROM program_kerja WHERE id=?`).get(req.params.id);
  if (!pk) return res.status(404).json({ error: 'Program kerja tidak ditemukan' });
  if (!canAccessUnit(req.user, pk.unit_id))
    return res.status(403).json({ error: 'Bukan unit Anda' });
  if (pk.status === 'ditetapkan')
    return res.status(400).json({ error: 'Sudah ditetapkan. Batalkan penetapan dahulu untuk mengubah.' });

  const { jenis, nama, sub_unit_id, tahun, sasaran } = req.body;
  if (jenis && !JENIS_VALID.includes(jenis))
    return res.status(400).json({ error: 'jenis harus "utama" atau "tambahan"' });
  if (tahun !== undefined && !tahunValid(tahun))
    return res.status(400).json({ error: 'Tahun hanya boleh tahun berjalan atau tahun sebelumnya' });
  if (sub_unit_id !== undefined && !subUnitValid(sub_unit_id, pk.unit_id))
    return res.status(400).json({ error: 'Sub-unit kerja tidak valid untuk unit ini' });

  if (Array.isArray(sasaran)) {
    for (const s of sasaran) {
      const galat = cekTipeNilai(s);
      if (galat) return res.status(400).json({ error: galat });
    }
  }

  try {
    db.transaction(() => {
      db.prepare(`UPDATE program_kerja SET jenis=?, nama=?, sub_unit_id=?, tahun=? WHERE id=?`)
        .run(
          jenis ?? pk.jenis, nama ?? pk.nama,
          sub_unit_id !== undefined ? (sub_unit_id || null) : pk.sub_unit_id,
          tahun !== undefined ? Number(tahun) : pk.tahun,
          pk.id
        );

      if (Array.isArray(sasaran)) {
      const sasaranAda = db
        .prepare(`SELECT id FROM sasaran_mutu WHERE program_kerja_id=?`)
        .all(pk.id)
        .map((r) => r.id);
      const dipertahankan = new Set(sasaran.filter((s) => s.id).map((s) => Number(s.id)));

      for (const smId of sasaranAda) {
        if (dipertahankan.has(smId)) continue;
        const adaCapaian = db
          .prepare(`SELECT 1 FROM sasaran_mutu_capaian WHERE sasaran_mutu_id=? AND status='diserahkan'`)
          .get(smId);
        if (adaCapaian) {
          throw Object.assign(new Error('Salah satu sasaran yang dihapus sudah memiliki capaian yang diserahkan'), { status: 400 });
        }
        db.prepare(`DELETE FROM sasaran_mutu WHERE id=?`).run(smId);
      }

      const updSasaran = db.prepare(
        `UPDATE sasaran_mutu SET sasaran=?, target=?, satuan=?, periode_evaluasi=?, sort_order=?, tipe_nilai=?, skala_peringkat=? WHERE id=?`
      );
      const insSasaran = db.prepare(
        `INSERT INTO sasaran_mutu (program_kerja_id, sasaran, target, satuan, periode_evaluasi, sort_order, tipe_nilai, skala_peringkat)
         VALUES (?,?,?,?,?,?,?,?)`
      );
      const insRencana = db.prepare(
        `INSERT INTO sasaran_mutu_rencana (sasaran_mutu_id, periode_ke, label, target_periode)
         VALUES (?,?,?,?)`
      );
      const delRencana = db.prepare(`DELETE FROM sasaran_mutu_rencana WHERE sasaran_mutu_id=?`);

      sasaran.forEach((s, idx) => {
        const pe = s.periode_evaluasi || 'bulanan';
        if (s.id) {
          updSasaran.run(s.sasaran, s.target, s.satuan ?? null, pe, idx, nilaiTipe(s), nilaiSkala(s), s.id);
          if (Array.isArray(s.rencana)) {
            delRencana.run(s.id);
            for (const r of s.rencana) insRencana.run(s.id, r.periode_ke, r.label, r.target_periode ?? null);
          }
        } else {
          const smId = insSasaran.run(pk.id, s.sasaran, s.target, s.satuan ?? null, pe, idx, nilaiTipe(s), nilaiSkala(s)).lastInsertRowid;
          for (const r of buatRencanaDefault(pe, s.rencana)) {
            insRencana.run(smId, r.periode_ke, r.label, r.target_periode ?? null);
          }
        }
      });
    }
    })();
  } catch (e) {
    return res.status(e.status || 400).json({ error: e.message });
  }

  logActivity(req.user.id, 'ubah_program_kerja', 'program_kerja', pk.id);
  res.json({ ok: true });
});

/** Tetapkan program kerja — mengunci seluruh sasaran di dalamnya, siap dicatat capaiannya */
router.post('/:id/tetapkan', requireRole('auditee', 'spm'), (req, res) => {
  const pk = db.prepare(`SELECT * FROM program_kerja WHERE id=?`).get(req.params.id);
  if (!pk) return res.status(404).json({ error: 'Program kerja tidak ditemukan' });
  if (!canAccessUnit(req.user, pk.unit_id))
    return res.status(403).json({ error: 'Bukan unit Anda' });

  const adaSasaran = db.prepare(`SELECT 1 FROM sasaran_mutu WHERE program_kerja_id=?`).get(pk.id);
  if (!adaSasaran) return res.status(400).json({ error: 'Minimal satu sasaran wajib diisi sebelum ditetapkan' });

  db.prepare(
    `UPDATE program_kerja SET status='ditetapkan', ditetapkan_at=datetime('now','localtime'), ditetapkan_by=?
      WHERE id=?`
  ).run(req.user.id, pk.id);

  logActivity(req.user.id, 'tetapkan_program_kerja', 'program_kerja', pk.id);
  res.json({ ok: true });
});

/** Batalkan penetapan — dipakai bila perlu mengubah lagi sasaran/rencana */
router.post('/:id/batal-tetapkan', requireRole('auditee', 'spm'), (req, res) => {
  const pk = db.prepare(`SELECT * FROM program_kerja WHERE id=?`).get(req.params.id);
  if (!pk) return res.status(404).json({ error: 'Program kerja tidak ditemukan' });
  if (!canAccessUnit(req.user, pk.unit_id))
    return res.status(403).json({ error: 'Bukan unit Anda' });

  db.prepare(
    `UPDATE program_kerja SET status='draft', ditetapkan_at=NULL, ditetapkan_by=NULL WHERE id=?`
  ).run(pk.id);
  res.json({ ok: true });
});

/** Hapus program kerja — hanya bila masih draft dan belum ada capaian terisi */
router.delete('/:id', requireRole('auditee', 'spm'), (req, res) => {
  const pk = db.prepare(`SELECT * FROM program_kerja WHERE id=?`).get(req.params.id);
  if (!pk) return res.status(404).json({ error: 'Program kerja tidak ditemukan' });
  if (!canAccessUnit(req.user, pk.unit_id))
    return res.status(403).json({ error: 'Bukan unit Anda' });
  if (pk.status === 'ditetapkan')
    return res.status(400).json({ error: 'Sudah ditetapkan. Batalkan penetapan dahulu untuk menghapus.' });

  const adaCapaian = db
    .prepare(
      `SELECT 1 FROM sasaran_mutu_capaian c
         JOIN sasaran_mutu sm ON sm.id = c.sasaran_mutu_id
        WHERE sm.program_kerja_id=? AND c.status='diserahkan'`
    )
    .get(pk.id);
  if (adaCapaian)
    return res.status(400).json({ error: 'Sudah ada capaian yang diserahkan pada program kerja ini' });

  db.prepare(`DELETE FROM program_kerja WHERE id=?`).run(pk.id);
  logActivity(req.user.id, 'hapus_program_kerja', 'program_kerja', pk.id, pk.nama);
  res.json({ ok: true });
});

/** Simpan/perbarui capaian satu sub-periode untuk satu sasaran — dipanggil
 *  dari halaman Pelaksanaan setiap bulan/triwulan/semester berjalan.
 *  kendala diisi bila realisasi gagal mencapai rencana, faktor_pendukung
 *  diisi bila realisasi melampaui rencana (evaluasi ketercapaian). */
router.post('/sasaran/:sasaranId/capaian', requireRole('auditee', 'spm'), (req, res) => {
  const sm = db
    .prepare(
      `SELECT sm.*, pk.unit_id, pk.status AS status_program
         FROM sasaran_mutu sm JOIN program_kerja pk ON pk.id = sm.program_kerja_id
        WHERE sm.id=?`
    )
    .get(req.params.sasaranId);
  if (!sm) return res.status(404).json({ error: 'Sasaran mutu tidak ditemukan' });
  if (!canAccessUnit(req.user, sm.unit_id))
    return res.status(403).json({ error: 'Bukan unit Anda' });
  if (sm.status_program !== 'ditetapkan')
    return res.status(400).json({ error: 'Program kerja belum ditetapkan' });

  const {
    periode_ke, realisasi, bukti_uraian, bukti_url,
    kendala, faktor_pendukung, status = 'draft',
  } = req.body;
  let { capaian_nilai, capaian_teks } = req.body;
  if (!periode_ke) return res.status(400).json({ error: 'periode_ke wajib diisi' });

  // Sasaran bernilai peringkat: capaian berupa huruf/predikat (capaian_teks);
  // sasaran angka: capaian berupa angka (capaian_nilai) saja.
  if (sm.tipe_nilai === 'peringkat') {
    capaian_nilai = null;
    if (capaian_teks === undefined || capaian_teks === null || capaian_teks === '') {
      capaian_teks = null;
    } else {
      const baku = normalkanPeringkat(sm.skala_peringkat, capaian_teks);
      if (!baku)
        return res.status(400).json({
          error: `Capaian "${capaian_teks}" bukan level pada skala ${SKALA_PERINGKAT[sm.skala_peringkat]?.label || '-'}`,
        });
      capaian_teks = baku;
    }
  } else {
    capaian_teks = null;
  }

  const rencanaAda = db
    .prepare(`SELECT 1 FROM sasaran_mutu_rencana WHERE sasaran_mutu_id=? AND periode_ke=?`)
    .get(sm.id, periode_ke);
  if (!rencanaAda) return res.status(400).json({ error: 'Sub-periode tidak dikenal untuk sasaran ini' });

  const existing = db
    .prepare(`SELECT * FROM sasaran_mutu_capaian WHERE sasaran_mutu_id=? AND periode_ke=?`)
    .get(sm.id, periode_ke);
  const submitted = status === 'diserahkan';

  if (existing) {
    db.prepare(
      `UPDATE sasaran_mutu_capaian
          SET realisasi=?, capaian_nilai=?, capaian_teks=?, bukti_uraian=?, bukti_url=?, kendala=?, faktor_pendukung=?,
              status=?, submitted_by=?,
              submitted_at = CASE WHEN ?=1 THEN datetime('now','localtime') ELSE submitted_at END,
              updated_at = datetime('now','localtime')
        WHERE id=?`
    ).run(
      realisasi ?? null, capaian_nilai ?? null, capaian_teks, bukti_uraian ?? null, bukti_url ?? null,
      kendala ?? null, faktor_pendukung ?? null, status, req.user.id, submitted ? 1 : 0, existing.id
    );
    logActivity(req.user.id, 'isi_capaian_sasaran_mutu', 'sasaran_mutu_capaian', existing.id);
    return res.json({ id: existing.id, ok: true });
  }

  const info = db
    .prepare(
      `INSERT INTO sasaran_mutu_capaian
         (sasaran_mutu_id, periode_ke, realisasi, capaian_nilai, capaian_teks, bukti_uraian, bukti_url,
          kendala, faktor_pendukung, status, submitted_by, submitted_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`
    )
    .run(
      sm.id, periode_ke, realisasi ?? null, capaian_nilai ?? null, capaian_teks, bukti_uraian ?? null,
      bukti_url ?? null, kendala ?? null, faktor_pendukung ?? null, status, req.user.id,
      submitted ? new Date().toISOString().slice(0, 19).replace('T', ' ') : null
    );
  logActivity(req.user.id, 'isi_capaian_sasaran_mutu', 'sasaran_mutu_capaian', info.lastInsertRowid);
  res.status(201).json({ id: info.lastInsertRowid, ok: true });
});

/** Data lengkap untuk cetak formulir: Penetapan Sasaran Mutu, Rencana Target
 *  Sasaran Mutu, dan Monitoring Pencapaian Sasaran Mutu — dikelompokkan per
 *  jenis (Kinerja Utama / Kinerja Tambahan). */
router.get('/laporan/cetak', (req, res) => {
  const unitId = Number(req.query.unit_id);
  const periodId = Number(req.query.period_id);
  const tahun = req.query.tahun ? Number(req.query.tahun) : null;
  if (!unitId || !periodId)
    return res.status(400).json({ error: 'unit_id dan period_id wajib diisi' });
  if (!canAccessUnit(req.user, unitId))
    return res.status(403).json({ error: 'Bukan unit Anda' });

  const unit = db.prepare(`SELECT * FROM units WHERE id=?`).get(unitId);
  const period = db.prepare(`SELECT * FROM periods WHERE id=?`).get(periodId);

  const daftar = db
    .prepare(
      `SELECT pk.*, su.name AS sub_unit_name
         FROM program_kerja pk
         LEFT JOIN units su ON su.id = pk.sub_unit_id
        WHERE pk.unit_id=? AND pk.period_id=? AND pk.status='ditetapkan'
          AND (? IS NULL OR pk.tahun=?)
        ORDER BY pk.tahun DESC, pk.jenis, pk.id`
    )
    .all(unitId, periodId, tahun, tahun);

  res.json({ unit, period, tahun, programKerja: daftar.map(ambilProgramKerjaLengkap) });
});

/** Rekap progres sasaran mutu seluruh unit pada satu periode (kartu ringkas) */
router.get('/laporan/rekap', (req, res) => {
  const periodId = Number(req.query.period_id);
  if (!periodId) return res.status(400).json({ error: 'period_id wajib diisi' });

  const rows = db
    .prepare(
      `SELECT un.id AS unit_id, un.code, un.name, un.type,
              COUNT(DISTINCT pk.id) AS total_program,
              COUNT(DISTINCT CASE WHEN pk.status='ditetapkan' THEN pk.id END) AS ditetapkan
         FROM units un
         LEFT JOIN program_kerja pk ON pk.unit_id = un.id AND pk.period_id = ?
        WHERE un.is_active = 1
        GROUP BY un.id
       HAVING total_program > 0
        ORDER BY un.type, un.name`
    )
    .all(periodId);

  res.json(rows);
});

/** Daftar tahun (selain tahun aktif berjalan) yang punya program kerja
 *  tersimpan untuk unit ini — dipakai sebagai pilihan "tahun sumber" pada
 *  fitur duplikasi program kerja & sasaran ke tahun berjalan. */
router.get('/laporan/tahun-tersedia', (req, res) => {
  const unitId = Number(req.query.unit_id);
  if (!unitId) return res.status(400).json({ error: 'unit_id wajib diisi' });
  if (!canAccessUnit(req.user, unitId))
    return res.status(403).json({ error: 'Bukan unit Anda' });

  const rows = db
    .prepare(
      `SELECT DISTINCT tahun FROM program_kerja WHERE unit_id=? ORDER BY tahun DESC`
    )
    .all(unitId);
  res.json(rows.map((r) => r.tahun));
});

/**
 * Duplikasi program kerja + sasaran dari satu tahun ke tahun lain (dalam
 * unit yang sama) — dipakai unit untuk menyusun program kerja tahun
 * berjalan berdasarkan tahun sebelumnya tanpa mengetik ulang dari nol.
 * Hanya struktur (nama program kerja, jenis, sub-unit, sasaran beserta
 * target/satuan/periode evaluasi) yang disalin. Rencana per sub-periode
 * DIBUAT BARU KOSONG (tidak menyalin rencana lama) dan capaian aktual TIDAK
 * ikut disalin sama sekali — keduanya harus disusun ulang untuk tahun
 * tujuan. Program kerja hasil duplikasi SELALU berstatus draft, terlepas
 * dari status sumbernya. Program kerja yang nama+jenis+sub-unitnya sudah
 * ada di tahun tujuan dilewati (tidak ditimpa).
 */
router.post('/duplikasi', requireRole('auditee', 'spm'), (req, res) => {
  const { unit_id, source_tahun, target_tahun, period_id, program_kerja_ids } = req.body;
  const uid = Number(unit_id);
  const sourceTahun = Number(source_tahun);
  const targetTahun = Number(target_tahun);

  if (!uid || !sourceTahun || !targetTahun || !period_id)
    return res.status(400).json({ error: 'unit_id, source_tahun, target_tahun, dan period_id wajib diisi' });
  if (!canAccessUnit(req.user, uid))
    return res.status(403).json({ error: 'Bukan unit Anda' });
  if (sourceTahun === targetTahun)
    return res.status(400).json({ error: 'Tahun sumber dan tujuan tidak boleh sama' });
  if (!tahunValid(targetTahun))
    return res.status(400).json({ error: 'Tahun tujuan hanya boleh tahun berjalan atau tahun sebelumnya' });

  let sumber = db.prepare(`SELECT * FROM program_kerja WHERE unit_id=? AND tahun=?`).all(uid, sourceTahun);
  if (Array.isArray(program_kerja_ids) && program_kerja_ids.length) {
    const set = new Set(program_kerja_ids.map(Number));
    sumber = sumber.filter((pk) => set.has(pk.id));
  }
  if (!sumber.length)
    return res.status(400).json({ error: 'Tidak ada program kerja terpilih dari tahun sumber' });

  const kunciTerpakai = new Set(
    db.prepare(`SELECT jenis, nama, sub_unit_id FROM program_kerja WHERE unit_id=? AND tahun=?`)
      .all(uid, targetTahun)
      .map((r) => `${r.jenis}::${r.nama}::${r.sub_unit_id ?? ''}`)
  );

  const insProgram = db.prepare(
    `INSERT INTO program_kerja (unit_id, sub_unit_id, period_id, tahun, jenis, nama, created_by)
     VALUES (?,?,?,?,?,?,?)`
  );
  const selSasaran = db.prepare(`SELECT * FROM sasaran_mutu WHERE program_kerja_id=? ORDER BY sort_order, id`);
  const insSasaran = db.prepare(
    `INSERT INTO sasaran_mutu (program_kerja_id, sasaran, target, satuan, periode_evaluasi, sort_order, tipe_nilai, skala_peringkat)
     VALUES (?,?,?,?,?,?,?,?)`
  );
  const insRencana = db.prepare(
    `INSERT INTO sasaran_mutu_rencana (sasaran_mutu_id, periode_ke, label, target_periode)
     VALUES (?,?,?,NULL)`
  );

  const hasil = { diduplikasi: [], dilewati: [] };

  db.transaction(() => {
    for (const pk of sumber) {
      const kunci = `${pk.jenis}::${pk.nama}::${pk.sub_unit_id ?? ''}`;
      if (kunciTerpakai.has(kunci)) {
        hasil.dilewati.push(pk.nama);
        continue;
      }
      const pkBaruId = insProgram.run(
        uid, pk.sub_unit_id, period_id, targetTahun, pk.jenis, pk.nama, req.user.id
      ).lastInsertRowid;

      for (const s of selSasaran.all(pk.id)) {
        const smBaruId = insSasaran.run(
          pkBaruId, s.sasaran, s.target, s.satuan, s.periode_evaluasi, s.sort_order,
          s.tipe_nilai || 'angka', s.skala_peringkat
        ).lastInsertRowid;
        for (const r of buatRencanaDefault(s.periode_evaluasi)) {
          insRencana.run(smBaruId, r.periode_ke, r.label);
        }
      }

      hasil.diduplikasi.push(pk.nama);
      kunciTerpakai.add(kunci); // jaga-jaga bila program_kerja_ids memuat duplikat
    }
  })();

  logActivity(
    req.user.id, 'duplikasi_program_kerja', 'program_kerja', null,
    `${hasil.diduplikasi.length} program kerja diduplikasi dari tahun ${sourceTahun} ke tahun ${targetTahun} (unit ${uid})`
  );
  res.json(hasil);
});

export default router;
