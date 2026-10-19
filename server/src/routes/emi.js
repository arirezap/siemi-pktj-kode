import { Router } from 'express';
import { db, logActivity } from '../db.js';
import { requireAuth, requireRole } from '../auth.js';
import { skalaSkorIndikator, validasiSkor } from '../lib/skorSkala.js';

const router = Router();
router.use(requireAuth);

/* ============================ MODUL 3 ==================================
   EVALUASI MUTU INTERNAL (AUDIT) — diisi oleh Auditor.
   Auditor menilai pencapaian standar berdasarkan isian Modul 2,
   menetapkan ketidaksesuaian, dan menerbitkan Berita Acara ber-tanda tangan.
   ====================================================================== */

const VERDICT_KATEGORI = {
  kts_mayor: 'KTS Mayor',
  kts_minor: 'KTS Minor',
  observasi: 'Observasi',
};

/** Daftar audit (auditee hanya melihat auditnya sendiri) */
router.get('/', (req, res) => {
  const { period_id, unit_id, status } = req.query;
  const where = [];
  const params = [];

  if (period_id) { where.push('a.period_id=?'); params.push(period_id); }
  if (unit_id)   { where.push('a.unit_id=?');   params.push(unit_id); }
  if (status)    { where.push('a.status=?');    params.push(status); }
  if (req.user.role === 'auditee') {
    where.push('a.unit_id=?'); params.push(req.user.unit_id);
  }
  if (req.user.role === 'auditor') {
    where.push(`(a.lead_auditor_id=? OR EXISTS
      (SELECT 1 FROM audit_members m WHERE m.audit_id=a.id AND m.user_id=?))`);
    params.push(req.user.id, req.user.id);
  }

  res.json(
    db.prepare(
      `SELECT a.*, un.name AS unit_name, un.code AS unit_code,
              p.name AS period_name,
              la.name AS lead_auditor_name, ae.name AS auditee_name,
              (SELECT COUNT(*) FROM findings f WHERE f.audit_id=a.id) AS jumlah_temuan,
              (SELECT COUNT(*) FROM audit_assessments s WHERE s.audit_id=a.id) AS jumlah_dinilai,
              (SELECT COUNT(*) FROM signatures g
                WHERE g.entity_type='audit' AND g.entity_id=a.id) AS jumlah_ttd,
              (SELECT GROUP_CONCAT(u.name, ', ') FROM audit_members m
                 JOIN users u ON u.id=m.user_id WHERE m.audit_id=a.id) AS anggota_names,
              (SELECT GROUP_CONCAT(t.label, ', ') FROM (
                 SELECT DISTINCT s.code || ' — ' || s.title AS label
                   FROM standard_indicators i
                   JOIN indicator_assignments ia
                     ON ia.indicator_id = i.id AND ia.unit_id = a.unit_id
                   JOIN standards s ON s.id = i.standard_id
                  WHERE s.period_id = a.period_id AND s.status = 'ditetapkan'
                  ORDER BY s.code
               ) t) AS persyaratan_standar
         FROM audits a
         JOIN units un ON un.id=a.unit_id
         JOIN periods p ON p.id=a.period_id
         LEFT JOIN users la ON la.id=a.lead_auditor_id
         LEFT JOIN users ae ON ae.id=a.auditee_id
         ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
        ORDER BY a.scheduled_date DESC, a.id DESC`
    ).all(...params)
  );
});

/** Buat jadwal audit */
router.post('/', requireRole('spm', 'auditor'), (req, res) => {
  const {
    period_id, unit_id, lead_auditor_id, auditee_id, scheduled_date, scheduled_time,
    tempat, scope, anggota = [],
  } = req.body;

  if (!period_id || !unit_id)
    return res.status(400).json({ error: 'period_id dan unit_id wajib diisi' });

  const tahun = db.prepare(`SELECT year FROM periods WHERE id=?`).get(period_id)?.year;
  const unit = db.prepare(`SELECT code FROM units WHERE id=?`).get(unit_id);
  const urut =
    db.prepare(`SELECT COUNT(*) c FROM audits WHERE period_id=?`).get(period_id).c + 1;
  const baNumber = `BA-EMI/${String(urut).padStart(3, '0')}/${unit?.code || 'UNIT'}/${tahun}`;

  const info = db
    .prepare(
      `INSERT INTO audits
         (period_id, unit_id, ba_number, lead_auditor_id, auditee_id,
          scheduled_date, scheduled_time, tempat, scope, created_by)
       VALUES (?,?,?,?,?,?,?,?,?,?)`
    )
    .run(
      period_id, unit_id, baNumber, lead_auditor_id ?? null, auditee_id ?? null,
      scheduled_date ?? null, scheduled_time ?? null, tempat ?? null, scope ?? null, req.user.id
    );

  const ins = db.prepare(
    `INSERT OR IGNORE INTO audit_members (audit_id, user_id, peran) VALUES (?,?,?)`
  );
  anggota.forEach((a) =>
    ins.run(info.lastInsertRowid, a.user_id ?? a, a.peran || 'Anggota Auditor')
  );

  logActivity(req.user.id, 'jadwalkan_audit', 'audits', info.lastInsertRowid, baNumber);
  res.status(201).json({ id: info.lastInsertRowid, ba_number: baNumber });
});

router.put('/:id', requireRole('spm', 'auditor'), (req, res) => {
  const a = db.prepare(`SELECT * FROM audits WHERE id=?`).get(req.params.id);
  if (!a) return res.status(404).json({ error: 'Audit tidak ditemukan' });
  if (a.status === 'ditandatangani')
    return res.status(400).json({ error: 'Berita acara sudah ditandatangani' });

  const {
    unit_id, lead_auditor_id, auditee_id, scheduled_date, scheduled_time, executed_date,
    tempat, scope, kesimpulan, status, ba_number, anggota,
  } = req.body;

  if (unit_id && Number(unit_id) !== a.unit_id) {
    const jumlahDinilai = db
      .prepare(`SELECT COUNT(*) c FROM audit_assessments WHERE audit_id=?`)
      .get(a.id).c;
    if (jumlahDinilai > 0)
      return res.status(400).json({
        error: 'Unit tidak dapat diubah karena sudah ada indikator yang dinilai. Hapus jadwal ini dan buat ulang bila unitnya salah.',
      });
  }

  db.prepare(
    `UPDATE audits SET unit_id=?, lead_auditor_id=?, auditee_id=?, scheduled_date=?,
            scheduled_time=?, executed_date=?, tempat=?, scope=?, kesimpulan=?, status=?, ba_number=?
      WHERE id=?`
  ).run(
    unit_id ?? a.unit_id, lead_auditor_id ?? a.lead_auditor_id, auditee_id ?? a.auditee_id,
    scheduled_date ?? a.scheduled_date, scheduled_time ?? a.scheduled_time, executed_date ?? a.executed_date,
    tempat ?? a.tempat, scope ?? a.scope, kesimpulan ?? a.kesimpulan,
    status ?? a.status, ba_number ?? a.ba_number, req.params.id
  );

  // Perbarui anggota tim auditor bila daftar dikirim (mengganti seluruhnya).
  if (Array.isArray(anggota)) {
    db.prepare(`DELETE FROM audit_members WHERE audit_id=?`).run(a.id);
    const ins = db.prepare(
      `INSERT OR IGNORE INTO audit_members (audit_id, user_id, peran) VALUES (?,?,?)`
    );
    anggota.forEach((x) =>
      ins.run(a.id, x.user_id ?? x, x.peran || 'Anggota Auditor')
    );
  }

  logActivity(req.user.id, 'ubah_jadwal_audit', 'audits', a.id);
  res.json({ ok: true });
});

/** Anggota tim auditor (untuk isian ulang formulir jadwal) */
router.get('/:id/anggota', (req, res) => {
  res.json(
    db.prepare(
      `SELECT m.user_id, m.peran, u.name FROM audit_members m
         JOIN users u ON u.id=m.user_id WHERE m.audit_id=?`
    ).all(req.params.id)
  );
});

/**
 * Hapus jadwal audit beserta seluruh penilaian, temuan, dan tindakan koreksi
 * terkait (untuk memperbaiki kesalahan penjadwalan). Tidak bisa dihapus bila
 * berita acara sudah ditandatangani.
 */
router.delete('/:id', requireRole('spm', 'auditor'), (req, res) => {
  const a = db.prepare(`SELECT * FROM audits WHERE id=?`).get(req.params.id);
  if (!a) return res.status(404).json({ error: 'Audit tidak ditemukan' });
  if (a.status === 'ditandatangani')
    return res.status(400).json({
      error: 'Berita acara sudah ditandatangani dan tidak dapat dihapus.',
    });

  db.transaction(() => {
    db.prepare(`DELETE FROM signatures WHERE entity_type='audit' AND entity_id=?`)
      .run(a.id);
    // Kembalikan isian Modul 2 yang sempat dinilai dalam audit ini ke status
    // 'diserahkan' — harus dilakukan SEBELUM audit_assessments ikut terhapus
    // oleh ON DELETE CASCADE di bawah, supaya auditee tidak terkunci
    // selamanya di status 'dinilai' tanpa penilaian yang sungguh ada.
    db.prepare(
      `UPDATE implementations SET status='diserahkan'
        WHERE status='dinilai' AND id IN (
          SELECT implementation_id FROM audit_assessments
           WHERE audit_id=? AND implementation_id IS NOT NULL
        )`
    ).run(a.id);
    // audit_members, audit_assessments, findings (dan corrective_actions via
    // findings) terhapus otomatis melalui ON DELETE CASCADE.
    db.prepare(`DELETE FROM audits WHERE id=?`).run(a.id);
  })();

  logActivity(req.user.id, 'hapus_jadwal_audit', 'audits', a.id, a.ba_number);
  res.json({ ok: true });
});

/** Lembar penilaian auditor: indikator + isian auditee + penilaian */
router.get('/:id/lembar-penilaian', (req, res) => {
  const audit = db
    .prepare(
      `SELECT a.*, un.name AS unit_name, un.code AS unit_code, p.name AS period_name
         FROM audits a JOIN units un ON un.id=a.unit_id
         JOIN periods p ON p.id=a.period_id WHERE a.id=?`
    )
    .get(req.params.id);
  if (!audit) return res.status(404).json({ error: 'Audit tidak ditemukan' });

  const items = db
    .prepare(
      `SELECT s.id AS standard_id, s.code AS standar_kode, s.category,
              s.ranah, s.kelompok, s.sifat,
              s.title AS standar_judul, s.statement,
              i.id AS indicator_id, i.code AS indikator_kode, i.indicator,
              i.target, i.target_skor, i.satuan,
              ia.peran AS peran_unit,
              im.id AS implementation_id, im.realisasi, im.capaian_nilai,
              im.skor AS auditee_skor,
              im.bukti_uraian, im.bukti_url, im.kendala, im.status AS status_isian,
              as_.id AS assessment_id, as_.skor, as_.capaian_persen, as_.verdict,
              as_.catatan_auditor, as_.verifikasi_bukti,
              f.id AS finding_id, f.code AS finding_code, f.kategori AS finding_kategori,
              r.code AS acuan_kode, r.name AS acuan_nama, r.warna AS acuan_warna,
              r.skor_min, r.skor_maks, r.skor_step, ri.code AS butir_kode
         FROM standard_indicators i
         JOIN indicator_assignments ia ON ia.indicator_id=i.id AND ia.unit_id=?
         JOIN standards s ON s.id=i.standard_id
         LEFT JOIN implementations im
                ON im.indicator_id=i.id AND im.unit_id=? AND im.period_id=?
         LEFT JOIN audit_assessments as_
                ON as_.audit_id=? AND as_.indicator_id=i.id
         LEFT JOIN findings f ON f.assessment_id = as_.id
         LEFT JOIN ref_items ri ON ri.id = i.source_ref_item_id
         LEFT JOIN refs r ON r.id = ri.ref_id
        WHERE s.period_id=? AND s.status='ditetapkan'
        ORDER BY s.ranah, s.kelompok, s.code, i.sort_order, i.id`
    )
    .all(audit.unit_id, audit.unit_id, audit.period_id, audit.id, audit.period_id);

  // Sasaran Mutu unit ini pada periode yang sama — dinilai SEKALI per siklus
  // (bukan per sub-periode seperti capaian bulanannya), jadi cukup satu baris
  // per sasaran berisi rekap capaian sampai sub-periode terakhir yang sudah
  // diserahkan, plus penilaian periode sebelumnya untuk pembanding. Dikaitkan
  // ke program kerja induknya (nama + jenis: Kinerja Utama/Tambahan) supaya
  // bisa dikelompokkan sama seperti di halaman Sasaran Mutu & Pelaksanaan.
  const sasaranMutu = db
    .prepare(
      `SELECT sm.id AS sasaran_mutu_id, sm.sasaran, sm.target, sm.satuan, sm.periode_evaluasi,
              sm.tipe_nilai, sm.skala_peringkat,
              pk.id AS program_kerja_id, pk.nama AS program_kerja, pk.jenis AS jenis_program,
              pk.tahun, su.name AS sub_unit_name,
              as_.id AS assessment_id, as_.skor, as_.capaian_persen, as_.verdict,
              as_.catatan_auditor, as_.verifikasi_bukti,
              f.id AS finding_id, f.code AS finding_code
         FROM sasaran_mutu sm
         JOIN program_kerja pk ON pk.id = sm.program_kerja_id
         LEFT JOIN units su ON su.id = pk.sub_unit_id
         LEFT JOIN audit_assessments as_
                ON as_.audit_id=? AND as_.sasaran_mutu_id=sm.id
         LEFT JOIN findings f ON f.assessment_id = as_.id
        WHERE pk.unit_id=? AND pk.period_id=? AND pk.status='ditetapkan'
        ORDER BY pk.tahun DESC, pk.jenis, pk.id, sm.sort_order, sm.id`
    )
    .all(audit.id, audit.unit_id, audit.period_id);

  const capaianStmt = db.prepare(
    `SELECT r.periode_ke, r.label, r.target_periode,
            c.realisasi, c.capaian_nilai, c.capaian_teks, c.status, c.submitted_at, c.kendala, c.faktor_pendukung,
            c.bukti_uraian, c.bukti_url
       FROM sasaran_mutu_rencana r
       LEFT JOIN sasaran_mutu_capaian c
              ON c.sasaran_mutu_id=r.sasaran_mutu_id AND c.periode_ke=r.periode_ke
      WHERE r.sasaran_mutu_id=? ORDER BY r.periode_ke`
  );
  // Sasaran mutu tahun sebelumnya (sasaran yang sama teksnya, di bawah
  // program kerja milik unit yang sama) — dipakai auditor sebagai pembanding
  // tren capaian. Dibandingkan berdasarkan tahun program kerja (bukan lagi
  // period_id/siklus SPMI), karena satu unit kini boleh punya program kerja
  // aktif di lebih dari satu tahun dalam siklus SPMI yang sama.
  const tahunSebelumnyaStmt = db.prepare(
    `SELECT sm2.target, sm2.satuan, aa2.capaian_persen, aa2.skor, pk2.tahun
       FROM sasaran_mutu sm2
       JOIN program_kerja pk2 ON pk2.id = sm2.program_kerja_id
       LEFT JOIN audit_assessments aa2 ON aa2.sasaran_mutu_id = sm2.id
      WHERE pk2.unit_id=? AND sm2.sasaran=? AND pk2.tahun<?
      ORDER BY pk2.tahun DESC LIMIT 1`
  );

  const sasaranMutuLengkap = sasaranMutu.map((sm) => ({
    ...sm,
    capaian: capaianStmt.all(sm.sasaran_mutu_id),
    tahun_sebelumnya: tahunSebelumnyaStmt.get(audit.unit_id, sm.sasaran, sm.tahun) || null,
  }));

  res.json({ audit, items, sasaranMutu: sasaranMutuLengkap });
});

/**
 * Simpan penilaian satu indikator.
 * Bila verdict = ketidaksesuaian, temuan dibuat/diperbarui otomatis
 * beserta formulir tindakan koreksi kosong (Modul 4).
 */
router.post('/:id/nilai', requireRole('auditor', 'spm'), (req, res) => {
  const auditId = Number(req.params.id);
  const audit = db.prepare(`SELECT * FROM audits WHERE id=?`).get(auditId);
  if (!audit) return res.status(404).json({ error: 'Audit tidak ditemukan' });
  if (audit.status === 'ditandatangani')
    return res.status(400).json({ error: 'Berita acara sudah ditandatangani' });

  const {
    indicator_id, implementation_id, skor, capaian_persen, verdict = 'sesuai',
    catatan_auditor, verifikasi_bukti,
    uraian_temuan, kriteria_acuan, bukti_objektif,
  } = req.body;
  if (!indicator_id)
    return res.status(400).json({ error: 'indicator_id wajib diisi' });

  if (skor !== undefined && skor !== null && skor !== '') {
    const galat = validasiSkor(Number(skor), skalaSkorIndikator(indicator_id));
    if (galat) return res.status(400).json({ error: galat });
  }

  const tx = db.transaction(() => {
    const ada = db
      .prepare(`SELECT * FROM audit_assessments WHERE audit_id=? AND indicator_id=?`)
      .get(auditId, indicator_id);

    let assessmentId;
    if (ada) {
      db.prepare(
        `UPDATE audit_assessments
            SET implementation_id=?, skor=?, capaian_persen=?, verdict=?,
                catatan_auditor=?, verifikasi_bukti=?,
                updated_at=datetime('now','localtime')
          WHERE id=?`
      ).run(
        implementation_id ?? ada.implementation_id, skor ?? null,
        capaian_persen ?? null, verdict, catatan_auditor ?? null,
        verifikasi_bukti ?? null, ada.id
      );
      assessmentId = ada.id;
    } else {
      assessmentId = db
        .prepare(
          `INSERT INTO audit_assessments
             (audit_id, indicator_id, implementation_id, skor, capaian_persen,
              verdict, catatan_auditor, verifikasi_bukti)
           VALUES (?,?,?,?,?,?,?,?)`
        )
        .run(
          auditId, indicator_id, implementation_id ?? null, skor ?? null,
          capaian_persen ?? null, verdict, catatan_auditor ?? null,
          verifikasi_bukti ?? null
        ).lastInsertRowid;
    }

    if (implementation_id)
      db.prepare(`UPDATE implementations SET status='dinilai' WHERE id=?`)
        .run(implementation_id);

    const temuanAda = db
      .prepare(`SELECT * FROM findings WHERE assessment_id=?`)
      .get(assessmentId);

    if (verdict === 'sesuai') {
      // Tidak ada ketidaksesuaian → hapus temuan bila sebelumnya ada & belum ditindak
      if (temuanAda) {
        const ca = db
          .prepare(`SELECT * FROM corrective_actions WHERE finding_id=?`)
          .get(temuanAda.id);
        if (!ca || (!ca.analisis_penyebab && !ca.rencana_tindakan))
          db.prepare(`DELETE FROM findings WHERE id=?`).run(temuanAda.id);
      }
      return assessmentId;
    }

    const ind = db
      .prepare(
        `SELECT i.*, s.code AS standar_kode, s.title AS standar_judul,
                s.reference_iso, s.reference_lam
           FROM standard_indicators i JOIN standards s ON s.id=i.standard_id
          WHERE i.id=?`
      )
      .get(indicator_id);
    const kategori = VERDICT_KATEGORI[verdict] || 'Observasi';
    const acuan =
      kriteria_acuan ||
      `${ind.standar_kode} — ${ind.standar_judul}` +
        (ind.reference_iso ? ` (ISO 21001 klausul ${ind.reference_iso})` : '');
    const uraian =
      uraian_temuan ||
      `Indikator "${ind.indicator}" dengan target ${ind.target || '-'} belum tercapai/tidak sesuai.`;

    if (temuanAda) {
      db.prepare(
        `UPDATE findings SET kategori=?, uraian=?, kriteria_acuan=?, bukti_objektif=?
          WHERE id=?`
      ).run(kategori, uraian, acuan, bukti_objektif ?? temuanAda.bukti_objektif,
            temuanAda.id);
      return assessmentId;
    }

    const unit = db.prepare(`SELECT code FROM units WHERE id=?`).get(audit.unit_id);
    const tahun = db.prepare(`SELECT year FROM periods WHERE id=?`)
      .get(audit.period_id)?.year;
    const urut =
      db.prepare(`SELECT COUNT(*) c FROM findings WHERE audit_id=?`).get(auditId).c + 1;
    const prefix = verdict === 'observasi' ? 'OBS' : 'KTS';
    const code = `${prefix}/${unit?.code || 'UNIT'}/${tahun}/${String(urut).padStart(2, '0')}`;

    const fid = db
      .prepare(
        `INSERT INTO findings
           (audit_id, assessment_id, code, kategori, uraian, kriteria_acuan,
            bukti_objektif, created_by)
         VALUES (?,?,?,?,?,?,?,?)`
      )
      .run(auditId, assessmentId, code, kategori, uraian, acuan,
           bukti_objektif ?? null, req.user.id).lastInsertRowid;

    // Siapkan formulir tindakan koreksi (Modul 4)
    db.prepare(`INSERT OR IGNORE INTO corrective_actions (finding_id) VALUES (?)`)
      .run(fid);

    return assessmentId;
  });

  const id = tx();
  res.json({ ok: true, assessment_id: id });
});

/**
 * Hapus satu penilaian (mis. salah nilai) — mengembalikan isian Modul 2
 * terkait ke status 'diserahkan' agar dapat dinilai ulang, dan menghapus
 * temuan otomatis yang belum ditindaklanjuti. Tidak bisa dihapus bila
 * berita acara sudah ditandatangani.
 */
router.delete('/:id/nilai/:indicatorId', requireRole('auditor', 'spm'), (req, res) => {
  const auditId = Number(req.params.id);
  const audit = db.prepare(`SELECT * FROM audits WHERE id=?`).get(auditId);
  if (!audit) return res.status(404).json({ error: 'Audit tidak ditemukan' });
  if (audit.status === 'ditandatangani')
    return res.status(400).json({ error: 'Berita acara sudah ditandatangani' });

  const assessment = db
    .prepare(`SELECT * FROM audit_assessments WHERE audit_id=? AND indicator_id=?`)
    .get(auditId, req.params.indicatorId);
  if (!assessment) return res.status(404).json({ error: 'Penilaian tidak ditemukan' });

  db.transaction(() => {
    const temuan = db
      .prepare(`SELECT * FROM findings WHERE assessment_id=?`)
      .get(assessment.id);
    if (temuan) {
      const ca = db
        .prepare(`SELECT * FROM corrective_actions WHERE finding_id=?`)
        .get(temuan.id);
      if (!ca || (!ca.analisis_penyebab && !ca.rencana_tindakan)) {
        db.prepare(`DELETE FROM findings WHERE id=?`).run(temuan.id);
      } else {
        // Tindakan koreksi sudah berjalan — pertahankan temuannya, lepas
        // saja kaitannya ke penilaian yang dihapus.
        db.prepare(`UPDATE findings SET assessment_id=NULL WHERE id=?`).run(temuan.id);
      }
    }

    if (assessment.implementation_id)
      db.prepare(
        `UPDATE implementations SET status='diserahkan' WHERE id=? AND status='dinilai'`
      ).run(assessment.implementation_id);

    db.prepare(`DELETE FROM audit_assessments WHERE id=?`).run(assessment.id);
  })();

  logActivity(req.user.id, 'hapus_penilaian', 'audit_assessments', assessment.id);
  res.json({ ok: true });
});

/**
 * Simpan penilaian auditor terhadap SATU sasaran mutu — dilakukan sekali per
 * siklus audit (bukan per sub-periode), menilai rekap keseluruhan capaian
 * yang sudah dilaporkan unit sampai sub-periode terakhir. Tidak menerbitkan
 * temuan/tindakan koreksi otomatis seperti penilaian indikator standar —
 * catatan ketidaksesuaian sasaran mutu cukup dituliskan di catatan_auditor.
 */
router.post('/:id/nilai-sasaran-mutu', requireRole('auditor', 'spm'), (req, res) => {
  const auditId = Number(req.params.id);
  const audit = db.prepare(`SELECT * FROM audits WHERE id=?`).get(auditId);
  if (!audit) return res.status(404).json({ error: 'Audit tidak ditemukan' });
  if (audit.status === 'ditandatangani')
    return res.status(400).json({ error: 'Berita acara sudah ditandatangani' });

  const {
    sasaran_mutu_id, skor, capaian_persen, verdict = 'sesuai',
    catatan_auditor, verifikasi_bukti,
  } = req.body;
  if (!sasaran_mutu_id)
    return res.status(400).json({ error: 'sasaran_mutu_id wajib diisi' });

  const sm = db
    .prepare(
      `SELECT sm.* FROM sasaran_mutu sm
         JOIN program_kerja pk ON pk.id = sm.program_kerja_id
        WHERE sm.id=? AND pk.unit_id=?`
    )
    .get(sasaran_mutu_id, audit.unit_id);
  if (!sm) return res.status(404).json({ error: 'Sasaran mutu tidak ditemukan pada unit audit ini' });

  const ada = db
    .prepare(`SELECT * FROM audit_assessments WHERE audit_id=? AND sasaran_mutu_id=?`)
    .get(auditId, sasaran_mutu_id);

  let assessmentId;
  if (ada) {
    db.prepare(
      `UPDATE audit_assessments
          SET skor=?, capaian_persen=?, verdict=?, catatan_auditor=?, verifikasi_bukti=?,
              updated_at=datetime('now','localtime')
        WHERE id=?`
    ).run(skor ?? null, capaian_persen ?? null, verdict, catatan_auditor ?? null,
          verifikasi_bukti ?? null, ada.id);
    assessmentId = ada.id;
  } else {
    assessmentId = db
      .prepare(
        `INSERT INTO audit_assessments
           (audit_id, sasaran_mutu_id, skor, capaian_persen, verdict, catatan_auditor, verifikasi_bukti)
         VALUES (?,?,?,?,?,?,?)`
      )
      .run(auditId, sasaran_mutu_id, skor ?? null, capaian_persen ?? null, verdict,
           catatan_auditor ?? null, verifikasi_bukti ?? null).lastInsertRowid;
  }

  logActivity(req.user.id, 'nilai_sasaran_mutu', 'audit_assessments', assessmentId, sm.sasaran);
  res.json({ ok: true, assessment_id: assessmentId });
});

/** Hapus penilaian sasaran mutu — sama seperti hapus penilaian indikator,
 *  tidak bisa dihapus bila berita acara sudah ditandatangani. */
router.delete('/:id/nilai-sasaran-mutu/:sasaranMutuId', requireRole('auditor', 'spm'), (req, res) => {
  const auditId = Number(req.params.id);
  const audit = db.prepare(`SELECT * FROM audits WHERE id=?`).get(auditId);
  if (!audit) return res.status(404).json({ error: 'Audit tidak ditemukan' });
  if (audit.status === 'ditandatangani')
    return res.status(400).json({ error: 'Berita acara sudah ditandatangani' });

  const assessment = db
    .prepare(`SELECT * FROM audit_assessments WHERE audit_id=? AND sasaran_mutu_id=?`)
    .get(auditId, req.params.sasaranMutuId);
  if (!assessment) return res.status(404).json({ error: 'Penilaian tidak ditemukan' });

  db.prepare(`DELETE FROM audit_assessments WHERE id=?`).run(assessment.id);
  logActivity(req.user.id, 'hapus_penilaian_sasaran_mutu', 'audit_assessments', assessment.id);
  res.json({ ok: true });
});

/* ------------------------------ TEMUAN ---------------------------------- */
router.get('/:id/temuan', (req, res) => {
  res.json(
    db.prepare(
      `SELECT f.*, i.indicator, i.code AS indikator_kode,
              s.code AS standar_kode, s.title AS standar_judul,
              ca.status AS status_tindakan, ca.efektivitas
         FROM findings f
         LEFT JOIN audit_assessments a ON a.id=f.assessment_id
         LEFT JOIN standard_indicators i ON i.id=a.indicator_id
         LEFT JOIN standards s ON s.id=i.standard_id
         LEFT JOIN corrective_actions ca ON ca.finding_id=f.id
        WHERE f.audit_id=? ORDER BY f.kategori, f.id`
    ).all(req.params.id)
  );
});

/** Tambah temuan manual (tanpa terkait indikator tertentu) */
router.post('/:id/temuan', requireRole('auditor', 'spm'), (req, res) => {
  const auditId = Number(req.params.id);
  const audit = db.prepare(`SELECT * FROM audits WHERE id=?`).get(auditId);
  if (!audit) return res.status(404).json({ error: 'Audit tidak ditemukan' });

  const { kategori, uraian, kriteria_acuan, bukti_objektif } = req.body;
  if (!kategori || !uraian)
    return res.status(400).json({ error: 'kategori dan uraian wajib diisi' });

  const unit = db.prepare(`SELECT code FROM units WHERE id=?`).get(audit.unit_id);
  const tahun = db.prepare(`SELECT year FROM periods WHERE id=?`).get(audit.period_id)?.year;
  const urut =
    db.prepare(`SELECT COUNT(*) c FROM findings WHERE audit_id=?`).get(auditId).c + 1;
  const prefix = kategori === 'Observasi' ? 'OBS' : 'KTS';
  const code = `${prefix}/${unit?.code || 'UNIT'}/${tahun}/${String(urut).padStart(2, '0')}`;

  const fid = db
    .prepare(
      `INSERT INTO findings (audit_id, code, kategori, uraian, kriteria_acuan,
                             bukti_objektif, created_by)
       VALUES (?,?,?,?,?,?,?)`
    )
    .run(auditId, code, kategori, uraian, kriteria_acuan ?? null,
         bukti_objektif ?? null, req.user.id).lastInsertRowid;

  db.prepare(`INSERT OR IGNORE INTO corrective_actions (finding_id) VALUES (?)`).run(fid);
  res.status(201).json({ id: fid, code });
});

router.delete('/temuan/:fid', requireRole('auditor', 'spm'), (req, res) => {
  db.prepare(`DELETE FROM findings WHERE id=?`).run(req.params.fid);
  res.json({ ok: true });
});

/* --------------------------- BERITA ACARA ------------------------------- */
router.get('/:id/berita-acara', (req, res) => {
  const audit = db
    .prepare(
      `SELECT a.*, un.name AS unit_name, un.code AS unit_code, un.type AS unit_type,
              p.name AS period_name, p.year,
              la.name AS lead_auditor_name, la.jabatan AS lead_auditor_jabatan,
              la.nip AS lead_auditor_nip,
              ae.name AS auditee_name, ae.jabatan AS auditee_jabatan, ae.nip AS auditee_nip
         FROM audits a
         JOIN units un ON un.id=a.unit_id
         JOIN periods p ON p.id=a.period_id
         LEFT JOIN users la ON la.id=a.lead_auditor_id
         LEFT JOIN users ae ON ae.id=a.auditee_id
        WHERE a.id=?`
    )
    .get(req.params.id);
  if (!audit) return res.status(404).json({ error: 'Audit tidak ditemukan' });

  const anggota = db
    .prepare(
      `SELECT m.peran, u.name, u.jabatan, u.nip FROM audit_members m
         JOIN users u ON u.id=m.user_id WHERE m.audit_id=?`
    )
    .all(audit.id);

  const temuan = db
    .prepare(
      `SELECT f.*, i.indicator, i.code AS indikator_kode, i.target,
              s.code AS standar_kode, s.title AS standar_judul
         FROM findings f
         LEFT JOIN audit_assessments a ON a.id=f.assessment_id
         LEFT JOIN standard_indicators i ON i.id=a.indicator_id
         LEFT JOIN standards s ON s.id=i.standard_id
        WHERE f.audit_id=?
        ORDER BY CASE f.kategori WHEN 'KTS Mayor' THEN 1 WHEN 'KTS Minor' THEN 2
                                 ELSE 3 END, f.id`
    )
    .all(audit.id);

  const ringkasan = db
    .prepare(
      `SELECT verdict, COUNT(*) c, AVG(capaian_persen) avg_capaian, AVG(skor) avg_skor
         FROM audit_assessments WHERE audit_id=? GROUP BY verdict`
    )
    .all(audit.id);

  const total = db
    .prepare(
      `SELECT COUNT(*) total, AVG(capaian_persen) rata_capaian, AVG(skor) rata_skor
         FROM audit_assessments WHERE audit_id=?`
    )
    .get(audit.id);

  // Rata-rata capaian resmi berita acara memakai SKOR (bukan capaian_persen,
  // yang sejak revisi ini bebas satuan sesuai indikator dan tidak lagi
  // sebanding lintas indikator). Skor dikelompokkan per acuan sumber
  // indikator karena skalanya berbeda-beda: acuan berbasis rubrik multi-level
  // (mis. LAM Teknik 1-4, UI GreenMetric 1-5) ditampilkan sebagai rerata skor,
  // sedangkan acuan biner (skala 0/1, mis. BAN-PT/ISO 21001/SNDIKTI/ZI)
  // ditampilkan sebagai persentase indikator terpenuhi. Indikator SPMI tanpa
  // acuan eksternal (source_ref_item_id kosong) dikelompokkan tersendiri dan
  // tetap ditampilkan sebagai rerata skor mentah.
  const kelompokSkor = db
    .prepare(
      `SELECT COALESCE(r.code, '') AS acuan_kode, r.name AS acuan_nama, r.skor_maks,
              COUNT(*) c, AVG(as_.skor) avg_skor
         FROM audit_assessments as_
         JOIN standard_indicators i ON i.id = as_.indicator_id
         LEFT JOIN ref_items ri ON ri.id = i.source_ref_item_id
         LEFT JOIN refs r ON r.id = ri.ref_id
        WHERE as_.audit_id=? AND as_.skor IS NOT NULL
        GROUP BY COALESCE(r.code,''), r.name, r.skor_maks
        ORDER BY r.name IS NULL, r.name`
    )
    .all(audit.id);

  const ringkasanSkor = kelompokSkor.map((k) => {
    const biner = k.skor_maks != null && k.skor_maks <= 1;
    return {
      acuan_kode: k.acuan_kode || null,
      acuan_nama: k.acuan_nama || null,
      tipe: biner ? 'persen' : 'skor',
      skor_maks: k.skor_maks ?? null,
      nilai: biner
        ? Math.round((k.avg_skor / k.skor_maks) * 1000) / 10
        : Math.round(k.avg_skor * 100) / 100,
      jumlah: k.c,
    };
  });

  const ttd = db
    .prepare(
      `SELECT * FROM signatures WHERE entity_type='audit' AND entity_id=?
        ORDER BY id`
    )
    .all(audit.id);

  res.json({
    audit, anggota, temuan, ringkasan, total,
    ringkasan_skor: ringkasanSkor, tanda_tangan: ttd,
  });
});

/** Bubuhkan tanda tangan digital pada berita acara */
router.post('/:id/tanda-tangan', (req, res) => {
  const auditId = Number(req.params.id);
  const audit = db.prepare(`SELECT * FROM audits WHERE id=?`).get(auditId);
  if (!audit) return res.status(404).json({ error: 'Audit tidak ditemukan' });

  const { peran, image_data } = req.body;
  if (!peran || !image_data)
    return res.status(400).json({ error: 'peran dan image_data wajib diisi' });
  if (!/^data:image\/(png|jpeg);base64,/.test(image_data))
    return res.status(400).json({ error: 'Tanda tangan harus berupa gambar PNG/JPEG' });

  // Validasi kewenangan
  const bolehAuditor = ['auditor', 'spm', 'admin'].includes(req.user.role);
  const bolehAuditee =
    req.user.role === 'auditee' && Number(req.user.unit_id) === Number(audit.unit_id);
  if (peran.toLowerCase().includes('auditee') && !bolehAuditee && req.user.role !== 'admin')
    return res.status(403).json({ error: 'Hanya auditee unit terkait yang dapat menandatangani' });
  if (peran.toLowerCase().includes('auditor') && !bolehAuditor)
    return res.status(403).json({ error: 'Hanya auditor yang dapat menandatangani' });

  db.prepare(
    `INSERT INTO signatures (entity_type, entity_id, user_id, peran, nama, jabatan, image_data)
     VALUES ('audit',?,?,?,?,?,?)
     ON CONFLICT(entity_type, entity_id, peran, user_id)
       DO UPDATE SET image_data=excluded.image_data,
                     signed_at=datetime('now','localtime')`
  ).run(auditId, req.user.id, peran, req.user.name, req.user.jabatan ?? null, image_data);

  // Bila auditor & auditee sudah tanda tangan → berita acara sah
  const peranTtd = db
    .prepare(`SELECT peran FROM signatures WHERE entity_type='audit' AND entity_id=?`)
    .all(auditId).map((r) => r.peran.toLowerCase());
  const adaAuditor = peranTtd.some((p) => p.includes('auditor'));
  const adaAuditee = peranTtd.some((p) => p.includes('auditee'));

  if (adaAuditor && adaAuditee) {
    db.prepare(
      `UPDATE audits SET status='ditandatangani',
              executed_date = COALESCE(executed_date, date('now','localtime'))
        WHERE id=?`
    ).run(auditId);
    db.prepare(
      `UPDATE findings SET status='tindakan_koreksi'
        WHERE audit_id=? AND status='terbuka'`
    ).run(auditId);
  }

  logActivity(req.user.id, 'tanda_tangan_ba', 'audits', auditId, peran);
  res.json({ ok: true, lengkap: adaAuditor && adaAuditee });
});

/**
 * Tarik kembali tanda tangan berita acara milik sendiri (auditor atau
 * auditee yang bersangkutan). Bila berita acara sudah sah ('ditandatangani'),
 * status dikembalikan ke 'selesai' agar dapat ditandatangani ulang.
 */
router.delete('/:id/tanda-tangan', (req, res) => {
  const auditId = Number(req.params.id);
  const audit = db.prepare(`SELECT * FROM audits WHERE id=?`).get(auditId);
  if (!audit) return res.status(404).json({ error: 'Audit tidak ditemukan' });

  const sig = db
    .prepare(`SELECT * FROM signatures WHERE entity_type='audit' AND entity_id=? AND user_id=?`)
    .get(auditId, req.user.id);
  if (!sig)
    return res.status(404).json({ error: 'Anda belum menandatangani berita acara ini' });

  db.prepare(`DELETE FROM signatures WHERE id=?`).run(sig.id);
  if (audit.status === 'ditandatangani')
    db.prepare(`UPDATE audits SET status='selesai' WHERE id=?`).run(auditId);

  logActivity(req.user.id, 'tarik_ttd_ba', 'audits', auditId, sig.peran);
  res.json({ ok: true });
});

/* ------------------ PENGESAHAN JADWAL PELAKSANAAN AUDIT ------------------
   Formulir Jadwal Pelaksanaan Audit Internal (FRM.08) dicetak per periode.
   Cukup satu tanda tangan pengesahan "Disetujui oleh", yang dapat dibubuhkan
   atau ditarik kembali oleh anggota Satuan Penjaminan Mutu (SPM) mana pun.
   ------------------------------------------------------------------------ */
router.get('/jadwal/:periodId/tanda-tangan', (req, res) => {
  res.json(
    db
      .prepare(
        `SELECT * FROM signatures WHERE entity_type='jadwal_audit' AND entity_id=?`
      )
      .all(req.params.periodId)
  );
});

router.post('/jadwal/:periodId/tanda-tangan', requireRole('spm'), (req, res) => {
  const { image_data } = req.body;
  if (!image_data) return res.status(400).json({ error: 'image_data wajib diisi' });
  if (!/^data:image\/(png|jpeg);base64,/.test(image_data))
    return res.status(400).json({ error: 'Tanda tangan harus berupa gambar' });

  db.prepare(
    `INSERT INTO signatures (entity_type, entity_id, user_id, peran, nama, jabatan, image_data)
     VALUES ('jadwal_audit',?,?,'SPM',?,?,?)
     ON CONFLICT(entity_type, entity_id, peran, user_id)
       DO UPDATE SET image_data=excluded.image_data, signed_at=datetime('now','localtime')`
  ).run(req.params.periodId, req.user.id, req.user.name, req.user.jabatan ?? null, image_data);

  logActivity(req.user.id, 'tanda_tangan_jadwal_audit', 'periods', req.params.periodId);
  res.json({ ok: true });
});

router.delete('/jadwal/:periodId/tanda-tangan', requireRole('spm'), (req, res) => {
  db.prepare(`DELETE FROM signatures WHERE entity_type='jadwal_audit' AND entity_id=?`)
    .run(req.params.periodId);
  res.json({ ok: true });
});

export default router;
