import { Router } from 'express';
import { db, logActivity } from '../db.js';
import { requireAuth, requireRole, canAccessUnit } from '../auth.js';

const router = Router();
router.use(requireAuth);

/* ============================ MODUL 4 ==================================
   PENGENDALIAN STANDAR
   A. Auditee mengisi formulir tindakan koreksi
      (analisis penyebab, koreksi sementara, rencana tindakan + tanggal)
   B. Auditee melaporkan realisasi
   C. Auditor & SPM memantau: efektivitas + tanggal penyelesaian
   ====================================================================== */

const SELECT_BASE = `
  SELECT ca.*, f.id AS finding_id, f.code AS finding_code, f.kategori,
         f.uraian AS uraian_temuan,
         f.kriteria_acuan, f.bukti_objektif, f.status AS status_temuan,
         f.audit_id,
         a.ba_number, a.scheduled_date, a.executed_date, a.unit_id,
         un.name AS unit_name, un.code AS unit_code,
         p.id AS period_id, p.name AS period_name,
         i.indicator, i.code AS indikator_kode, i.target,
         s.code AS standar_kode, s.title AS standar_judul,
         ua.name AS pengisi_name, uv.name AS verifikator_name,
         la.name AS lead_auditor_name, la.jabatan AS lead_auditor_jabatan,
         la.nip AS lead_auditor_nip,
         ae.name AS auditee_name, ae.jabatan AS auditee_jabatan, ae.nip AS auditee_nip
    FROM findings f
    JOIN audits a ON a.id=f.audit_id
    JOIN units un ON un.id=a.unit_id
    JOIN periods p ON p.id=a.period_id
    LEFT JOIN corrective_actions ca ON ca.finding_id=f.id
    LEFT JOIN audit_assessments ass ON ass.id=f.assessment_id
    LEFT JOIN standard_indicators i ON i.id=ass.indicator_id
    LEFT JOIN standards s ON s.id=i.standard_id
    LEFT JOIN users ua ON ua.id=ca.diisi_oleh
    LEFT JOIN users uv ON uv.id=ca.diverifikasi_oleh
    LEFT JOIN users la ON la.id=a.lead_auditor_id
    LEFT JOIN users ae ON ae.id=a.auditee_id
`;

/** Daftar ketidaksesuaian & status tindakan koreksinya */
router.get('/', (req, res) => {
  const { period_id, unit_id, status, kategori } = req.query;
  const where = [];
  const params = [];

  if (period_id) { where.push('a.period_id=?'); params.push(period_id); }
  if (unit_id)   { where.push('a.unit_id=?');   params.push(unit_id); }
  if (kategori)  { where.push('f.kategori=?');  params.push(kategori); }
  if (status)    { where.push('COALESCE(ca.status,\'menunggu_auditee\')=?'); params.push(status); }
  if (req.user.role === 'auditee') {
    where.push('a.unit_id=?'); params.push(req.user.unit_id);
  }

  res.json(
    db.prepare(
      `${SELECT_BASE} ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
        ORDER BY CASE f.kategori WHEN 'KTS Mayor' THEN 1 WHEN 'KTS Minor' THEN 2
                                 ELSE 3 END, f.id DESC`
    ).all(...params)
  );
});

router.get('/:findingId', (req, res) => {
  const row = db.prepare(`${SELECT_BASE} WHERE f.id=?`).get(req.params.findingId);
  if (!row) return res.status(404).json({ error: 'Temuan tidak ditemukan' });
  if (!canAccessUnit(req.user, row.unit_id))
    return res.status(403).json({ error: 'Bukan unit Anda' });

  row.tanda_tangan = db
    .prepare(
      `SELECT * FROM signatures WHERE entity_type='corrective_action' AND entity_id=?
        ORDER BY id`
    )
    .all(row.finding_id);
  res.json(row);
});

/**
 * Formulir PTK resmi bertanda tangan digital, mengacu pada 3 titik tanda
 * tangan formulir cetak: Auditor (uraian temuan), Teraudit (rencana tindakan
 * koreksi), dan Auditor (tinjauan efektivitas pada audit berikutnya).
 */
const PERAN_PTK = [
  'Auditor (Temuan)',
  'Teraudit (Rencana Tindakan)',
  'Auditor (Tinjauan Efektivitas)',
];

router.post('/:findingId/tanda-tangan', (req, res) => {
  const fid = Number(req.params.findingId);
  const f = db
    .prepare(`SELECT f.*, a.unit_id FROM findings f JOIN audits a ON a.id=f.audit_id WHERE f.id=?`)
    .get(fid);
  if (!f) return res.status(404).json({ error: 'Temuan tidak ditemukan' });

  const { peran, image_data } = req.body;
  if (!PERAN_PTK.includes(peran))
    return res.status(400).json({ error: 'Peran tanda tangan tidak dikenal' });
  if (!image_data || !/^data:image\/(png|jpeg);base64,/.test(image_data))
    return res.status(400).json({ error: 'Tanda tangan harus berupa gambar PNG/JPEG' });

  const bolehAuditor = ['auditor', 'spm', 'admin'].includes(req.user.role);
  const bolehTeraudit =
    ['auditee', 'spm', 'admin'].includes(req.user.role) &&
    (req.user.role !== 'auditee' || Number(req.user.unit_id) === Number(f.unit_id));

  if (peran.startsWith('Auditor') && !bolehAuditor)
    return res.status(403).json({ error: 'Hanya auditor yang dapat menandatangani sebagai Auditor' });
  if (peran.startsWith('Teraudit') && !bolehTeraudit)
    return res.status(403).json({ error: 'Hanya auditee unit terkait yang dapat menandatangani sebagai Teraudit' });

  db.prepare(
    `INSERT INTO signatures (entity_type, entity_id, user_id, peran, nama, jabatan, image_data)
     VALUES ('corrective_action',?,?,?,?,?,?)
     ON CONFLICT(entity_type, entity_id, peran, user_id)
       DO UPDATE SET image_data=excluded.image_data, signed_at=datetime('now','localtime')`
  ).run(fid, req.user.id, peran, req.user.name, req.user.jabatan ?? null, image_data);

  logActivity(req.user.id, 'tanda_tangan_ptk', 'findings', fid, peran);
  res.json({ ok: true });
});

/** BAGIAN A — Auditee: formulir tindakan koreksi */
router.post('/:findingId/tindakan-koreksi', requireRole('auditee', 'spm'), (req, res) => {
  const fid = Number(req.params.findingId);
  const f = db
    .prepare(
      `SELECT f.*, a.unit_id FROM findings f JOIN audits a ON a.id=f.audit_id
        WHERE f.id=?`
    )
    .get(fid);
  if (!f) return res.status(404).json({ error: 'Temuan tidak ditemukan' });
  if (!canAccessUnit(req.user, f.unit_id))
    return res.status(403).json({ error: 'Bukan unit Anda' });

  const {
    analisis_penyebab, koreksi_sementara, rencana_tindakan,
    rencana_tanggal, penanggung_jawab,
  } = req.body;

  if (!analisis_penyebab || !rencana_tindakan || !rencana_tanggal)
    return res.status(400).json({
      error: 'Analisis penyebab, rencana tindakan koreksi, dan rencana tanggal penyelesaian wajib diisi',
    });

  db.prepare(`INSERT OR IGNORE INTO corrective_actions (finding_id) VALUES (?)`).run(fid);
  db.prepare(
    `UPDATE corrective_actions
        SET analisis_penyebab=?, koreksi_sementara=?, rencana_tindakan=?,
            rencana_tanggal=?, penanggung_jawab=?, diisi_oleh=?,
            diisi_at=datetime('now','localtime'),
            status = CASE WHEN status IN ('menunggu_auditee','rencana_disusun')
                          THEN 'rencana_disusun' ELSE status END,
            updated_at=datetime('now','localtime')
      WHERE finding_id=?`
  ).run(
    analisis_penyebab, koreksi_sementara ?? null, rencana_tindakan,
    rencana_tanggal, penanggung_jawab ?? req.user.name, req.user.id, fid
  );
  db.prepare(`UPDATE findings SET status='tindakan_koreksi' WHERE id=?`).run(fid);

  logActivity(req.user.id, 'isi_tindakan_koreksi', 'findings', fid);
  res.json({ ok: true });
});

/** BAGIAN B — Auditee: laporan realisasi tindakan koreksi */
router.post('/:findingId/realisasi', requireRole('auditee', 'spm'), (req, res) => {
  const fid = Number(req.params.findingId);
  const f = db
    .prepare(`SELECT f.*, a.unit_id FROM findings f JOIN audits a ON a.id=f.audit_id WHERE f.id=?`)
    .get(fid);
  if (!f) return res.status(404).json({ error: 'Temuan tidak ditemukan' });
  if (!canAccessUnit(req.user, f.unit_id))
    return res.status(403).json({ error: 'Bukan unit Anda' });

  const { realisasi_tindakan, bukti_realisasi, tanggal_realisasi } = req.body;
  if (!realisasi_tindakan)
    return res.status(400).json({ error: 'Uraian realisasi tindakan wajib diisi' });

  db.prepare(
    `UPDATE corrective_actions
        SET realisasi_tindakan=?, bukti_realisasi=?, tanggal_realisasi=?,
            realisasi_at=datetime('now','localtime'),
            status='realisasi_dilaporkan', updated_at=datetime('now','localtime')
      WHERE finding_id=?`
  ).run(realisasi_tindakan, bukti_realisasi ?? null, tanggal_realisasi ?? null, fid);
  db.prepare(`UPDATE findings SET status='verifikasi' WHERE id=?`).run(fid);

  logActivity(req.user.id, 'lapor_realisasi', 'findings', fid);
  res.json({ ok: true });
});

/** BAGIAN C — Auditor & SPM: pemantauan efektivitas tindakan koreksi */
router.post('/:findingId/verifikasi', requireRole('auditor', 'spm'), (req, res) => {
  const fid = Number(req.params.findingId);
  const { efektivitas, catatan_verifikasi, tanggal_penyelesaian, tutup } = req.body;

  if (!['efektif', 'belum_efektif', 'tidak_efektif'].includes(efektivitas))
    return res.status(400).json({
      error: 'Efektivitas harus salah satu dari: efektif, belum_efektif, tidak_efektif',
    });

  const tutupTemuan = efektivitas === 'efektif' && tutup !== false;

  db.prepare(
    `UPDATE corrective_actions
        SET efektivitas=?, catatan_verifikasi=?, tanggal_penyelesaian=?,
            diverifikasi_oleh=?, diverifikasi_at=datetime('now','localtime'),
            status=?, updated_at=datetime('now','localtime')
      WHERE finding_id=?`
  ).run(
    efektivitas, catatan_verifikasi ?? null, tanggal_penyelesaian ?? null,
    req.user.id, tutupTemuan ? 'ditutup' : 'diverifikasi', fid
  );

  db.prepare(`UPDATE findings SET status=? WHERE id=?`).run(
    tutupTemuan ? 'ditutup' : 'tindakan_koreksi', fid
  );

  logActivity(req.user.id, 'verifikasi_tindakan_koreksi', 'findings', fid, efektivitas);
  res.json({ ok: true, ditutup: tutupTemuan });
});

/** Rekap pengendalian untuk bahan RTM (agenda 3d: Ketidaksesuaian & tindakan koreksi) */
router.get('/rekap/periode/:periodId', (req, res) => {
  const pid = req.params.periodId;

  const perKategori = db
    .prepare(
      `SELECT f.kategori, COUNT(*) jumlah,
              SUM(CASE WHEN f.status='ditutup' THEN 1 ELSE 0 END) ditutup
         FROM findings f JOIN audits a ON a.id=f.audit_id
        WHERE a.period_id=? GROUP BY f.kategori`
    )
    .all(pid);

  const perUnit = db
    .prepare(
      `SELECT un.name AS unit_name, un.code,
              COUNT(*) jumlah,
              SUM(CASE WHEN f.status='ditutup' THEN 1 ELSE 0 END) ditutup,
              SUM(CASE WHEN ca.efektivitas='efektif' THEN 1 ELSE 0 END) efektif
         FROM findings f
         JOIN audits a ON a.id=f.audit_id
         JOIN units un ON un.id=a.unit_id
         LEFT JOIN corrective_actions ca ON ca.finding_id=f.id
        WHERE a.period_id=? GROUP BY un.id ORDER BY jumlah DESC`
    )
    .all(pid);

  const terlambat = db
    .prepare(
      `SELECT f.code, f.kategori, un.name AS unit_name, ca.rencana_tanggal,
              ca.status
         FROM findings f
         JOIN audits a ON a.id=f.audit_id
         JOIN units un ON un.id=a.unit_id
         JOIN corrective_actions ca ON ca.finding_id=f.id
        WHERE a.period_id=? AND ca.rencana_tanggal IS NOT NULL
          AND ca.rencana_tanggal < date('now','localtime')
          AND f.status <> 'ditutup'
        ORDER BY ca.rencana_tanggal`
    )
    .all(pid);

  res.json({ per_kategori: perKategori, per_unit: perUnit, terlambat });
});

/* -------------------- PENGESAHAN DAFTAR PTK (REGISTER) -------------------
   Formulir Daftar Permintaan Tindakan Koreksi dicetak per periode. Cukup
   satu tanda tangan pengesahan "Lead Auditor".
   ------------------------------------------------------------------------ */
router.get('/daftar-ptk/:periodId/tanda-tangan', (req, res) => {
  res.json(
    db
      .prepare(
        `SELECT * FROM signatures WHERE entity_type='daftar_ptk' AND entity_id=?`
      )
      .all(req.params.periodId)
  );
});

router.post(
  '/daftar-ptk/:periodId/tanda-tangan',
  requireRole('auditor', 'spm'),
  (req, res) => {
    const { image_data } = req.body;
    if (!image_data) return res.status(400).json({ error: 'image_data wajib diisi' });
    if (!/^data:image\/(png|jpeg);base64,/.test(image_data))
      return res.status(400).json({ error: 'Tanda tangan harus berupa gambar' });

    db.prepare(
      `INSERT INTO signatures (entity_type, entity_id, user_id, peran, nama, jabatan, image_data)
       VALUES ('daftar_ptk',?,?,'Lead Auditor',?,?,?)
       ON CONFLICT(entity_type, entity_id, peran, user_id)
         DO UPDATE SET image_data=excluded.image_data, signed_at=datetime('now','localtime')`
    ).run(req.params.periodId, req.user.id, req.user.name, req.user.jabatan ?? null, image_data);

    logActivity(req.user.id, 'tanda_tangan_daftar_ptk', 'periods', req.params.periodId);
    res.json({ ok: true });
  }
);

router.delete(
  '/daftar-ptk/:periodId/tanda-tangan',
  requireRole('auditor', 'spm'),
  (req, res) => {
    db.prepare(`DELETE FROM signatures WHERE entity_type='daftar_ptk' AND entity_id=?`)
      .run(req.params.periodId);
    res.json({ ok: true });
  }
);

export default router;
