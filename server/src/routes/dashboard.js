import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth } from '../auth.js';

const router = Router();
router.use(requireAuth);

/** Ringkasan siklus SPMI (PPEPP) untuk beranda */
router.get('/ringkasan', (req, res) => {
  const pid =
    Number(req.query.period_id) ||
    db.prepare(`SELECT id FROM periods WHERE status='aktif' ORDER BY id DESC`).get()?.id ||
    db.prepare(`SELECT id FROM periods ORDER BY id DESC`).get()?.id;

  if (!pid) return res.json({ period: null });

  const period = db.prepare(`SELECT * FROM periods WHERE id=?`).get(pid);
  const unitFilter = req.user.role === 'auditee' ? req.user.unit_id : null;

  const standar = db
    .prepare(
      `SELECT COUNT(*) total,
              SUM(CASE WHEN status='ditetapkan' THEN 1 ELSE 0 END) ditetapkan
         FROM standards WHERE period_id=?`
    )
    .get(pid);

  const indikator = db
    .prepare(
      `SELECT COUNT(*) c FROM standard_indicators i
         JOIN standards s ON s.id=i.standard_id
        WHERE s.period_id=? AND s.status='ditetapkan'`
    )
    .get(pid).c;

  const pelaksanaan = db
    .prepare(
      `SELECT COUNT(*) total,
              SUM(CASE WHEN status IN ('diserahkan','dinilai') THEN 1 ELSE 0 END) diserahkan
         FROM implementations WHERE period_id=? ${unitFilter ? 'AND unit_id=?' : ''}`
    )
    .get(...(unitFilter ? [pid, unitFilter] : [pid]));

  const audit = db
    .prepare(
      `SELECT COUNT(*) total,
              SUM(CASE WHEN status='ditandatangani' THEN 1 ELSE 0 END) selesai
         FROM audits WHERE period_id=? ${unitFilter ? 'AND unit_id=?' : ''}`
    )
    .get(...(unitFilter ? [pid, unitFilter] : [pid]));

  const temuan = db
    .prepare(
      `SELECT f.kategori, COUNT(*) jumlah,
              SUM(CASE WHEN f.status='ditutup' THEN 1 ELSE 0 END) ditutup
         FROM findings f JOIN audits a ON a.id=f.audit_id
        WHERE a.period_id=? ${unitFilter ? 'AND a.unit_id=?' : ''}
        GROUP BY f.kategori`
    )
    .all(...(unitFilter ? [pid, unitFilter] : [pid]));

  const rtm = db
    .prepare(
      `SELECT COUNT(*) total,
              SUM(CASE WHEN status='ditandatangani' THEN 1 ELSE 0 END) selesai
         FROM rtm_meetings WHERE period_id=?`
    )
    .get(pid);

  const capaianKategori = db
    .prepare(
      `SELECT s.category, ROUND(AVG(ass.capaian_persen),1) rata
         FROM audit_assessments ass
         JOIN audits a ON a.id=ass.audit_id AND a.period_id=?
         JOIN standard_indicators i ON i.id=ass.indicator_id
         JOIN standards s ON s.id=i.standard_id
        ${unitFilter ? 'WHERE a.unit_id=?' : ''}
        GROUP BY s.category ORDER BY s.category`
    )
    .all(...(unitFilter ? [pid, unitFilter] : [pid]));

  const tenggat = db
    .prepare(
      `SELECT f.code, f.kategori, un.name AS unit_name, ca.rencana_tanggal, ca.status
         FROM corrective_actions ca
         JOIN findings f ON f.id=ca.finding_id
         JOIN audits a ON a.id=f.audit_id
         JOIN units un ON un.id=a.unit_id
        WHERE a.period_id=? AND f.status<>'ditutup' AND ca.rencana_tanggal IS NOT NULL
          ${unitFilter ? 'AND a.unit_id=?' : ''}
        ORDER BY ca.rencana_tanggal LIMIT 10`
    )
    .all(...(unitFilter ? [pid, unitFilter] : [pid]));

  res.json({
    period, standar, indikator, pelaksanaan, audit, temuan, rtm,
    capaian_kategori: capaianKategori, tenggat,
  });
});

/** Capaian per unit (untuk grafik) */
router.get('/capaian-unit', (req, res) => {
  const pid = Number(req.query.period_id);
  res.json(
    db.prepare(
      `SELECT un.name AS unit_name, un.code,
              ROUND(AVG(ass.capaian_persen),1) rata_capaian,
              COUNT(ass.id) jumlah_indikator,
              SUM(CASE WHEN ass.verdict LIKE 'kts%' THEN 1 ELSE 0 END) kts
         FROM audits a
         JOIN units un ON un.id=a.unit_id
         LEFT JOIN audit_assessments ass ON ass.audit_id=a.id
        WHERE a.period_id=? GROUP BY un.id ORDER BY rata_capaian DESC`
    ).all(pid)
  );
});

export default router;
