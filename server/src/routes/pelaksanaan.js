import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { db, logActivity, DATA_DIR } from '../db.js';
import { requireAuth, requireRole, canAccessUnit } from '../auth.js';
import { skalaSkorIndikator, validasiSkor } from '../lib/skorSkala.js';

const router = Router();
router.use(requireAuth);

/* ============================ MODUL 2 ==================================
   PELAKSANAAN STANDAR — diisi oleh Auditee (unit/struktur PKTJ terkait)
   berdasarkan standar yang telah DITETAPKAN pada Modul 1.
   ====================================================================== */

// Untuk indikator yang bersumber dari acuan LAM Teknik (Sarjana Terapan
// maupun Diploma III), unit pengampu (mis. BAAK untuk "Waktu Tunggu
// Lulusan") pada praktiknya adalah pemegang data, sementara nilai yang
// dipakai untuk penilaian akreditasi harus tercatat per unit PELAKSANA
// (prodi) karena SPME menghitung skor berdasarkan unit_id prodi itu
// sendiri. Supaya pengampu tidak perlu menitipkan data ke tiap prodi satu
// per satu, layar lembar kerja pengampu memecah indikator semacam ini
// menjadi satu baris per unit pelaksana, dan pengampu diberi izin mengisi
// langsung baris milik tiap pelaksana tsb (lihat bisaIsiAtasNamaPelaksana).
const ACUAN_PENGAMPU_BOLEH_ISI_PELAKSANA = ['LAMTEKNIKSTR', 'LAMTEKNIKD3'];

/** Cek apakah userUnitId (pengampu) boleh mengisi/menghapus isian indikator
 *  atas nama targetUnitId (salah satu unit pelaksana indikator tsb). */
function bisaIsiAtasNamaPelaksana(userUnitId, indicatorId, targetUnitId) {
  if (Number(userUnitId) === Number(targetUnitId)) return false;
  const row = db
    .prepare(
      `SELECT
         EXISTS(SELECT 1 FROM indicator_assignments
                 WHERE indicator_id=? AND unit_id=? AND peran='pengampu') AS pengampu,
         EXISTS(SELECT 1 FROM indicator_assignments
                 WHERE indicator_id=? AND unit_id=? AND peran='pelaksana') AS pelaksana,
         (SELECT r.code FROM standard_indicators i
            LEFT JOIN ref_items b ON b.id = i.source_ref_item_id
            LEFT JOIN refs r ON r.id = b.ref_id
           WHERE i.id = ?) AS acuan_kode`
    )
    .get(indicatorId, userUnitId, indicatorId, targetUnitId, indicatorId);
  return (
    !!row?.pengampu && !!row?.pelaksana &&
    ACUAN_PENGAMPU_BOLEH_ISI_PELAKSANA.includes(row.acuan_kode)
  );
}

/**
 * Lembar kerja pelaksanaan: seluruh indikator dari standar yang ditetapkan
 * dan ditugaskan kepada suatu unit, digabung dengan isian yang sudah ada.
 * Khusus indikator LAM Teknik yang unit ini ampu (pengampu) dan punya unit
 * pelaksana lain (mis. BAAK mengampu "Waktu Tunggu" untuk prodi RSTJ & TRO),
 * baris dipecah satu per unit pelaksana supaya bisa diisi terpisah untuk
 * tiap prodi dari satu layar yang sama.
 */
router.get('/lembar-kerja', (req, res) => {
  const unitId = Number(req.query.unit_id || req.user.unit_id);
  const periodId = Number(req.query.period_id);

  if (!unitId) return res.status(400).json({ error: 'unit_id wajib diisi' });
  if (!periodId) return res.status(400).json({ error: 'period_id wajib diisi' });
  if (!canAccessUnit(req.user, unitId))
    return res.status(403).json({ error: 'Bukan unit Anda' });

  const unit = db.prepare(`SELECT * FROM units WHERE id=?`).get(unitId);

  // Penanggung jawab ditetapkan pada tingkat indikator
  const rows = db
    .prepare(
      `SELECT s.id AS standard_id, s.code AS standar_kode, s.category,
              s.ranah, s.kelompok, s.sifat, s.title AS standar_judul, s.statement,
              i.id AS indicator_id, i.code AS indikator_kode, i.indicator, i.target,
              i.target_skor, i.satuan, i.strategy, i.deadline,
              ia.peran AS peran_unit,
              r.code AS acuan_kode, r.name AS acuan_nama, r.warna AS acuan_warna,
              r.skor_min, r.skor_maks, r.skor_step,
              b.code AS butir_kode
         FROM standard_indicators i
         JOIN indicator_assignments ia ON ia.indicator_id = i.id AND ia.unit_id = ?
         JOIN standards s ON s.id = i.standard_id
         LEFT JOIN ref_items b ON b.id = i.source_ref_item_id
         LEFT JOIN refs r ON r.id = b.ref_id
        WHERE s.period_id = ? AND s.status = 'ditetapkan'
        ORDER BY s.ranah, s.kelompok, s.code, i.sort_order, i.id`
    )
    .all(unitId, periodId);

  const implStmt = db.prepare(
    `SELECT im.id AS implementation_id, im.realisasi, im.capaian_nilai, im.skor,
            im.bukti_uraian, im.bukti_url, im.kendala, im.status,
            im.submitted_at, u.name AS submitted_by_name
       FROM implementations im
       LEFT JOIN users u ON u.id = im.submitted_by
      WHERE im.indicator_id = ? AND im.unit_id = ? AND im.period_id = ?`
  );
  const pelaksanaStmt = db.prepare(
    `SELECT a.unit_id, un.code, un.name
       FROM indicator_assignments a
       JOIN units un ON un.id = a.unit_id
      WHERE a.indicator_id = ? AND a.peran = 'pelaksana'
      ORDER BY un.name`
  );

  const items = [];
  for (const row of rows) {
    const isPengampuLamTeknik =
      row.peran_unit === 'pengampu' &&
      ACUAN_PENGAMPU_BOLEH_ISI_PELAKSANA.includes(row.acuan_kode);
    const pelaksanaUnits = isPengampuLamTeknik ? pelaksanaStmt.all(row.indicator_id) : [];

    if (pelaksanaUnits.length) {
      for (const pu of pelaksanaUnits) {
        const im = implStmt.get(row.indicator_id, pu.unit_id, periodId) || {};
        items.push({
          ...row,
          untuk_unit_id: pu.unit_id,
          untuk_unit_kode: pu.code,
          untuk_unit_nama: pu.name,
          ...im,
        });
      }
    } else {
      const im = implStmt.get(row.indicator_id, unitId, periodId) || {};
      items.push({
        ...row,
        untuk_unit_id: unit?.id ?? unitId,
        untuk_unit_kode: unit?.code,
        untuk_unit_nama: unit?.name,
        ...im,
      });
    }
  }

  res.json({ unit, period_id: periodId, items });
});

/** Simpan / perbarui isian pelaksanaan satu indikator */
router.post('/', requireRole('auditee', 'spm'), (req, res) => {
  const {
    period_id, standard_id, indicator_id, unit_id,
    realisasi, capaian_nilai, skor, bukti_uraian, bukti_url, kendala,
    status = 'draft',
  } = req.body;

  const uid = Number(unit_id || req.user.unit_id);
  if (!period_id || !standard_id || !indicator_id || !uid)
    return res.status(400).json({
      error: 'period_id, standard_id, indicator_id, dan unit_id wajib diisi',
    });
  if (
    !canAccessUnit(req.user, uid) &&
    !bisaIsiAtasNamaPelaksana(req.user.unit_id, indicator_id, uid)
  )
    return res.status(403).json({ error: 'Bukan unit Anda' });

  if (skor !== undefined && skor !== null && skor !== '') {
    const galat = validasiSkor(Number(skor), skalaSkorIndikator(indicator_id));
    if (galat) return res.status(400).json({ error: galat });
  }

  const existing = db
    .prepare(
      `SELECT * FROM implementations
        WHERE period_id=? AND indicator_id=? AND unit_id=?`
    )
    .get(period_id, indicator_id, uid);

  if (existing && existing.status === 'dinilai')
    return res.status(400).json({
      error: 'Isian sudah dinilai auditor dan tidak dapat diubah',
    });

  const submitted = status === 'diserahkan';

  if (existing) {
    db.prepare(
      `UPDATE implementations
          SET realisasi=?, capaian_nilai=?, skor=?, bukti_uraian=?, bukti_url=?, kendala=?,
              status=?, submitted_by=?,
              submitted_at = CASE WHEN ?=1 THEN datetime('now','localtime')
                                  ELSE submitted_at END,
              updated_at = datetime('now','localtime')
        WHERE id=?`
    ).run(
      realisasi ?? null, capaian_nilai ?? null, skor ?? null, bukti_uraian ?? null,
      bukti_url ?? null, kendala ?? null, status, req.user.id,
      submitted ? 1 : 0, existing.id
    );
    logActivity(req.user.id, 'isi_pelaksanaan', 'implementations', existing.id);
    return res.json({ id: existing.id, ok: true });
  }

  const info = db
    .prepare(
      `INSERT INTO implementations
         (period_id, standard_id, indicator_id, unit_id, realisasi, capaian_nilai, skor,
          bukti_uraian, bukti_url, kendala, status, submitted_by, submitted_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`
    )
    .run(
      period_id, standard_id, indicator_id, uid, realisasi ?? null,
      capaian_nilai ?? null, skor ?? null, bukti_uraian ?? null, bukti_url ?? null,
      kendala ?? null, status, req.user.id,
      submitted ? new Date().toISOString().slice(0, 19).replace('T', ' ') : null
    );
  logActivity(req.user.id, 'isi_pelaksanaan', 'implementations', info.lastInsertRowid);
  res.status(201).json({ id: info.lastInsertRowid, ok: true });
});

/** Hapus satu isian pelaksanaan (mis. salah isi) — tidak bisa dihapus bila
 *  sudah dinilai auditor (Modul 3), harus dihapus dulu penilaiannya. */
router.delete('/:id', requireRole('auditee', 'spm'), (req, res) => {
  const existing = db
    .prepare(`SELECT * FROM implementations WHERE id=?`)
    .get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Isian tidak ditemukan' });
  if (
    !canAccessUnit(req.user, existing.unit_id) &&
    !bisaIsiAtasNamaPelaksana(req.user.unit_id, existing.indicator_id, existing.unit_id)
  )
    return res.status(403).json({ error: 'Bukan unit Anda' });
  if (existing.status === 'dinilai')
    return res.status(400).json({
      error: 'Isian sudah dinilai auditor. Hapus dulu penilaiannya di Modul 3 sebelum menghapus isian ini.',
    });

  db.prepare(`DELETE FROM implementations WHERE id=?`).run(req.params.id);
  logActivity(req.user.id, 'hapus_pelaksanaan', 'implementations', existing.id);
  res.json({ ok: true });
});

/** Serahkan seluruh isian unit untuk periode tertentu (kunci untuk audit) */
router.post('/serahkan', requireRole('auditee', 'spm'), (req, res) => {
  const { period_id, unit_id } = req.body;
  const uid = Number(unit_id || req.user.unit_id);
  if (!canAccessUnit(req.user, uid))
    return res.status(403).json({ error: 'Bukan unit Anda' });

  const submitStmt = db.prepare(
    `UPDATE implementations
        SET status='diserahkan', submitted_at=datetime('now','localtime'),
            submitted_by=?
      WHERE period_id=? AND indicator_id=? AND unit_id=? AND status='draft'`
  );

  // Isian milik unit ini sendiri, untuk indikator apa pun.
  let jumlah = db
    .prepare(
      `UPDATE implementations
          SET status='diserahkan', submitted_at=datetime('now','localtime'),
              submitted_by=?
        WHERE period_id=? AND unit_id=? AND status='draft'`
    )
    .run(req.user.id, period_id, uid).changes;

  // Ditambah isian yang diisikan unit ini atas nama unit pelaksana LAM
  // Teknik yang diampunya (lihat bisaIsiAtasNamaPelaksana) — dibatasi per
  // indikator supaya tidak ikut menyerahkan draf unit pelaksana yang tidak
  // terkait dengan indikator yang diampu unit ini.
  const pasanganPelaksana = db
    .prepare(
      `SELECT DISTINCT pengampu.indicator_id, pel.unit_id
         FROM indicator_assignments pengampu
         JOIN indicator_assignments pel
               ON pel.indicator_id = pengampu.indicator_id AND pel.peran = 'pelaksana'
         JOIN standard_indicators i ON i.id = pengampu.indicator_id
         LEFT JOIN ref_items b ON b.id = i.source_ref_item_id
         LEFT JOIN refs r ON r.id = b.ref_id
        WHERE pengampu.unit_id = ? AND pengampu.peran = 'pengampu'
          AND r.code IN ('LAMTEKNIKSTR', 'LAMTEKNIKD3')`
    )
    .all(uid);
  for (const p of pasanganPelaksana) {
    jumlah += submitStmt.run(req.user.id, period_id, p.indicator_id, p.unit_id).changes;
  }

  logActivity(req.user.id, 'serahkan_pelaksanaan', 'units', uid, `${jumlah} indikator`);
  res.json({ ok: true, jumlah });
});

/** Rekap progres pengisian per unit pada satu periode */
router.get('/rekap', (req, res) => {
  const periodId = Number(req.query.period_id);
  if (!periodId) return res.status(400).json({ error: 'period_id wajib diisi' });

  const rows = db
    .prepare(
      `SELECT un.id AS unit_id, un.code, un.name, un.type,
              COUNT(DISTINCT i.id) AS total_indikator,
              COUNT(DISTINCT CASE WHEN ia.peran='pengampu' THEN i.id END) AS diampu,
              COUNT(DISTINCT CASE WHEN im.status IN ('diserahkan','dinilai')
                                  THEN im.indicator_id END) AS terisi
         FROM units un
         JOIN indicator_assignments ia ON ia.unit_id = un.id
         JOIN standard_indicators i ON i.id = ia.indicator_id
         JOIN standards s ON s.id = i.standard_id
                         AND s.period_id = ? AND s.status='ditetapkan'
         LEFT JOIN implementations im
                ON im.indicator_id = i.id AND im.unit_id = un.id
                AND im.period_id = ?
        WHERE un.is_active = 1
        GROUP BY un.id ORDER BY un.type, un.name`
    )
    .all(periodId, periodId);

  res.json(
    rows.map((r) => ({
      ...r,
      persen: r.total_indikator
        ? Math.round((r.terisi / r.total_indikator) * 100)
        : 0,
    }))
  );
});

/** Unggah berkas bukti (base64 data URL) */
router.post('/unggah-bukti', (req, res) => {
  const { filename, data } = req.body || {};
  if (!filename || !data)
    return res.status(400).json({ error: 'filename dan data wajib diisi' });

  const m = /^data:([^;]+);base64,(.+)$/.exec(data);
  if (!m) return res.status(400).json({ error: 'Format data URL tidak valid' });

  const buf = Buffer.from(m[2], 'base64');
  if (buf.length > 10 * 1024 * 1024)
    return res.status(400).json({ error: 'Ukuran berkas maksimal 10 MB' });

  const dir = path.join(DATA_DIR, 'uploads');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const safe = String(filename).replace(/[^\w.\-]/g, '_');
  const name = `${Date.now()}-${req.user.id}-${safe}`;
  fs.writeFileSync(path.join(dir, name), buf);

  res.json({ url: `/uploads/${name}`, filename: safe });
});

export default router;
