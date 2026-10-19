import { Router } from 'express';
import { db, logActivity } from '../db.js';
import { requireAuth, requireRole } from '../auth.js';

const router = Router();
router.use(requireAuth);

/* ============================ MODUL 5 ==================================
   RAPAT TINJAUAN MANAJEMEN (RTM)
   Dipimpin Direktur / Wakil Direktur I, II, III.
   ====================================================================== */

/** Template agenda RTM sesuai SMOP PKTJ */
export const AGENDA_TEMPLATE = [
  { key: '1',  parent: null, judul: 'Status RTM sebelumnya' },
  { key: '2',  parent: null, judul: 'Perubahan dalam masalah eksternal dan internal yang relevan dengan SMOP' },
  { key: '3',  parent: null, judul: 'Informasi tentang kinerja dan efektivitas SMOP' },
  { key: '3a', parent: '3',  judul: 'Kepuasan pemangku kepentingan (IKM)' },
  { key: '3b', parent: '3',  judul: 'Pencapaian kinerja / Sasaran mutu' },
  { key: '3c', parent: '3',  judul: 'Efektivitas dan kesesuaian produk dan layanan' },
  { key: '3d', parent: '3',  judul: 'Ketidaksesuaian dan tindakan koreksi' },
  { key: '3e', parent: '3',  judul: 'Pemantauan dan pengukuran hasil' },
  { key: '3f', parent: '3',  judul: 'Hasil Audit' },
  { key: '3g', parent: '3',  judul: 'Kinerja penyedia eksternal' },
  { key: '3h', parent: '3',  judul: 'Nilai formatif dan sumatif' },
  { key: '4',  parent: null, judul: 'Kecukupan Sumber Daya' },
  { key: '5',  parent: null, judul: 'Efektivitas identifikasi risiko dan peluang' },
  { key: '6',  parent: null, judul: 'Peluang untuk perbaikan berkelanjutan' },
  { key: '7',  parent: null, judul: 'Umpan balik staf berkaitan dengan peningkatan kompetensinya' },
];

export const KATEGORI_KELUARAN = [
  { key: 'peluang_perbaikan',     label: 'Peluang untuk perbaikan yang diprogramkan' },
  { key: 'perubahan_smop',        label: 'Kebutuhan perubahan untuk SMOP' },
  { key: 'kebutuhan_sumber_daya', label: 'Kebutuhan sumber daya' },
];

/**
 * Status yang boleh diubah isinya (agenda, keluaran, peserta, jadwal).
 * Begitu Notulen mengesahkan (status berubah keluar dari daftar ini),
 * isi rapat terkunci sampai pengesahan ditarik atau ditolak Kepala SPM.
 */
const STATUS_EDITABLE = ['rencana', 'ditolak_spm'];

function ambilRtm(id) {
  return db.prepare(`SELECT * FROM rtm_meetings WHERE id=?`).get(id);
}

/** Kirim galat 400 bila notulen sedang dalam proses pengesahan; true bila boleh diubah. */
function pastikanBolehEdit(res, r) {
  if (!STATUS_EDITABLE.includes(r.status)) {
    res.status(400).json({
      error:
        'Notulen sedang dalam proses pengesahan dan tidak dapat diubah. ' +
        'Tarik pengesahan notulen terlebih dahulu bila ingin mengubah isi rapat.',
    });
    return false;
  }
  return true;
}

function simpanTtdRtm(rtmId, peran, user, image_data) {
  db.prepare(
    `INSERT INTO signatures (entity_type, entity_id, user_id, peran, nama, jabatan, image_data)
     VALUES ('rtm',?,?,?,?,?,?)
     ON CONFLICT(entity_type, entity_id, peran, user_id)
       DO UPDATE SET image_data=excluded.image_data, signed_at=datetime('now','localtime')`
  ).run(rtmId, user.id, peran, user.name, user.jabatan ?? null, image_data);
}

router.get('/meta/agenda-template', (_req, res) =>
  res.json({ agenda: AGENDA_TEMPLATE, keluaran: KATEGORI_KELUARAN })
);

/* ------------------------------ RAPAT ----------------------------------- */
router.get('/', (req, res) => {
  const { period_id } = req.query;
  res.json(
    db.prepare(
      `SELECT r.*, p.name AS period_name, u.name AS pemimpin_name,
              u.jabatan AS pemimpin_jabatan, n.name AS notulis_name,
              (SELECT COUNT(*) FROM rtm_outputs o WHERE o.rtm_id=r.id) AS jumlah_keluaran,
              (SELECT COUNT(*) FROM rtm_participants c WHERE c.rtm_id=r.id AND c.hadir=1)
                AS jumlah_hadir
         FROM rtm_meetings r
         JOIN periods p ON p.id=r.period_id
         LEFT JOIN users u ON u.id=r.pemimpin_id
         LEFT JOIN users n ON n.id=r.notulis_id
        ${period_id ? 'WHERE r.period_id=?' : ''}
        ORDER BY r.tanggal DESC, r.id DESC`
    ).all(...(period_id ? [period_id] : []))
  );
});

/**
 * Nomor rapat RTM otomatis mengikuti pola "RTM/{urut}/PKTJ/{tahun}",
 * bernomor urut per periode (mis. RTM/01/PKTJ/2026, RTM/02/PKTJ/2026, ...).
 */
function nomorRtmBerikutnya(periodId) {
  const tahun = db.prepare(`SELECT year FROM periods WHERE id=?`).get(periodId)?.year;
  const urut =
    db.prepare(`SELECT COUNT(*) c FROM rtm_meetings WHERE period_id=?`).get(periodId).c + 1;
  return `RTM/${String(urut).padStart(2, '0')}/PKTJ/${tahun || ''}`;
}

/** Buat RTM baru — nomor rapat & agenda otomatis dibuat dari template */
router.post('/', requireRole('pimpinan', 'spm'), (req, res) => {
  const { period_id, judul, tanggal, waktu, tempat, pemimpin_id, notulis_id } =
    req.body;
  if (!period_id || !judul)
    return res.status(400).json({ error: 'period_id dan judul wajib diisi' });

  const nomor = nomorRtmBerikutnya(period_id);

  const tx = db.transaction(() => {
    const id = db
      .prepare(
        `INSERT INTO rtm_meetings
           (period_id, nomor, judul, tanggal, waktu, tempat, pemimpin_id,
            notulis_id, created_by)
         VALUES (?,?,?,?,?,?,?,?,?)`
      )
      .run(
        period_id, nomor, judul, tanggal ?? null, waktu ?? null,
        tempat ?? null, pemimpin_id ?? null, notulis_id ?? null, req.user.id
      ).lastInsertRowid;

    const ins = db.prepare(
      `INSERT INTO rtm_agenda (rtm_id, agenda_key, parent_key, judul, sort_order)
       VALUES (?,?,?,?,?)`
    );
    AGENDA_TEMPLATE.forEach((a, n) => ins.run(id, a.key, a.parent, a.judul, n));

    // Peserta default: seluruh pimpinan + ketua unit
    const kandidat = db
      .prepare(
        `SELECT id, name, jabatan FROM users
          WHERE is_active=1 AND role IN ('pimpinan','spm') ORDER BY role, name`
      )
      .all();
    const insP = db.prepare(
      `INSERT OR IGNORE INTO rtm_participants (rtm_id, user_id, nama, jabatan)
       VALUES (?,?,?,?)`
    );
    kandidat.forEach((u) => insP.run(id, u.id, u.name, u.jabatan));
    return id;
  });

  const id = tx();
  logActivity(req.user.id, 'buat_rtm', 'rtm_meetings', id, judul);
  res.status(201).json({ id, nomor });
});

/** Detail RTM: agenda, peserta, keluaran, tanda tangan */
router.get('/:id', (req, res) => {
  const rtm = db
    .prepare(
      `SELECT r.*, p.name AS period_name, p.year,
              u.name AS pemimpin_name, u.jabatan AS pemimpin_jabatan,
              n.name AS notulis_name, n.jabatan AS notulis_jabatan
         FROM rtm_meetings r
         JOIN periods p ON p.id=r.period_id
         LEFT JOIN users u ON u.id=r.pemimpin_id
         LEFT JOIN users n ON n.id=r.notulis_id
        WHERE r.id=?`
    )
    .get(req.params.id);
  if (!rtm) return res.status(404).json({ error: 'RTM tidak ditemukan' });

  rtm.agenda = db
    .prepare(`SELECT * FROM rtm_agenda WHERE rtm_id=? ORDER BY sort_order`)
    .all(rtm.id);
  rtm.peserta = db
    .prepare(`SELECT * FROM rtm_participants WHERE rtm_id=? ORDER BY id`)
    .all(rtm.id);
  rtm.keluaran = db
    .prepare(
      `SELECT o.*, un.name AS unit_name FROM rtm_outputs o
         LEFT JOIN units un ON un.id=o.unit_id
        WHERE o.rtm_id=? ORDER BY o.kategori, o.sort_order, o.id`
    )
    .all(rtm.id);
  rtm.tanda_tangan = db
    .prepare(`SELECT * FROM signatures WHERE entity_type='rtm' AND entity_id=?`)
    .all(rtm.id);

  res.json(rtm);
});

router.put('/:id', requireRole('pimpinan', 'spm'), (req, res) => {
  const r = db.prepare(`SELECT * FROM rtm_meetings WHERE id=?`).get(req.params.id);
  if (!r) return res.status(404).json({ error: 'RTM tidak ditemukan' });
  if (!pastikanBolehEdit(res, r)) return;

  const { nomor, judul, tanggal, waktu, tempat, pemimpin_id, notulis_id, status, catatan } =
    req.body;
  db.prepare(
    `UPDATE rtm_meetings SET nomor=?, judul=?, tanggal=?, waktu=?, tempat=?,
            pemimpin_id=?, notulis_id=?, status=?, catatan=? WHERE id=?`
  ).run(
    nomor ?? r.nomor, judul ?? r.judul, tanggal ?? r.tanggal, waktu ?? r.waktu,
    tempat ?? r.tempat, pemimpin_id ?? r.pemimpin_id, notulis_id ?? r.notulis_id,
    status ?? r.status, catatan ?? r.catatan, req.params.id
  );
  logActivity(req.user.id, 'ubah_jadwal_rtm', 'rtm_meetings', r.id);
  res.json({ ok: true });
});

/**
 * Hapus jadwal RTM beserta agenda, peserta, dan keluaran terkait (untuk
 * memperbaiki kesalahan penjadwalan). Pimpinan/SPM tidak bisa menghapus
 * selama notulen sedang/sudah dalam proses pengesahan; admin dapat
 * menghapus pada status apa pun, termasuk yang sudah ditandatangani.
 */
router.delete('/:id', requireRole('pimpinan', 'spm'), (req, res) => {
  const r = db.prepare(`SELECT * FROM rtm_meetings WHERE id=?`).get(req.params.id);
  if (!r) return res.status(404).json({ error: 'RTM tidak ditemukan' });
  if (req.user.role !== 'admin' && !pastikanBolehEdit(res, r)) return;

  db.transaction(() => {
    db.prepare(`DELETE FROM signatures WHERE entity_type='rtm' AND entity_id=?`)
      .run(r.id);
    // rtm_participants, rtm_agenda, rtm_outputs terhapus otomatis melalui
    // ON DELETE CASCADE.
    db.prepare(`DELETE FROM rtm_meetings WHERE id=?`).run(r.id);
  })();

  logActivity(req.user.id, 'hapus_jadwal_rtm', 'rtm_meetings', r.id, r.judul);
  res.json({ ok: true });
});

/* ------------------------------ AGENDA ---------------------------------- */
router.put('/:id/agenda/:agendaId', requireRole('pimpinan', 'spm'), (req, res) => {
  const r = ambilRtm(req.params.id);
  if (!r) return res.status(404).json({ error: 'RTM tidak ditemukan' });
  if (!pastikanBolehEdit(res, r)) return;

  const { pembahasan, data_pendukung, kesimpulan, pic } = req.body;
  db.prepare(
    `UPDATE rtm_agenda SET pembahasan=?, data_pendukung=?, kesimpulan=?, pic=?
      WHERE id=? AND rtm_id=?`
  ).run(
    pembahasan ?? null, data_pendukung ?? null, kesimpulan ?? null, pic ?? null,
    req.params.agendaId, req.params.id
  );
  res.json({ ok: true });
});

/* ------------------------------ PESERTA --------------------------------- */
router.post('/:id/peserta', requireRole('pimpinan', 'spm'), (req, res) => {
  const r = ambilRtm(req.params.id);
  if (!r) return res.status(404).json({ error: 'RTM tidak ditemukan' });
  if (!pastikanBolehEdit(res, r)) return;

  const { user_id, nama, jabatan, hadir } = req.body;
  if (!nama) return res.status(400).json({ error: 'nama wajib diisi' });
  const info = db
    .prepare(
      `INSERT OR REPLACE INTO rtm_participants (rtm_id, user_id, nama, jabatan, hadir)
       VALUES (?,?,?,?,?)`
    )
    .run(req.params.id, user_id ?? null, nama, jabatan ?? null, hadir ? 1 : 0);
  res.status(201).json({ id: info.lastInsertRowid });
});

router.put('/:id/peserta/:pid', requireRole('pimpinan', 'spm'), (req, res) => {
  const r = ambilRtm(req.params.id);
  if (!r) return res.status(404).json({ error: 'RTM tidak ditemukan' });
  if (!pastikanBolehEdit(res, r)) return;

  db.prepare(`UPDATE rtm_participants SET hadir=? WHERE id=? AND rtm_id=?`).run(
    req.body.hadir ? 1 : 0, req.params.pid, req.params.id
  );
  res.json({ ok: true });
});

router.delete('/:id/peserta/:pid', requireRole('pimpinan', 'spm'), (req, res) => {
  const r = ambilRtm(req.params.id);
  if (!r) return res.status(404).json({ error: 'RTM tidak ditemukan' });
  if (!pastikanBolehEdit(res, r)) return;

  db.prepare(`DELETE FROM rtm_participants WHERE id=? AND rtm_id=?`)
    .run(req.params.pid, req.params.id);
  res.json({ ok: true });
});

/* ----------------------------- KELUARAN --------------------------------- */
router.post('/:id/keluaran', requireRole('pimpinan', 'spm'), (req, res) => {
  const r = ambilRtm(req.params.id);
  if (!r) return res.status(404).json({ error: 'RTM tidak ditemukan' });
  if (!pastikanBolehEdit(res, r)) return;

  const { kategori, uraian, unit_id, penanggung_jawab, target_tanggal } = req.body;
  if (!KATEGORI_KELUARAN.some((k) => k.key === kategori))
    return res.status(400).json({ error: 'Kategori keluaran tidak dikenal' });
  if (!uraian) return res.status(400).json({ error: 'uraian wajib diisi' });

  const info = db
    .prepare(
      `INSERT INTO rtm_outputs
         (rtm_id, kategori, uraian, unit_id, penanggung_jawab, target_tanggal)
       VALUES (?,?,?,?,?,?)`
    )
    .run(req.params.id, kategori, uraian, unit_id ?? null,
         penanggung_jawab ?? null, target_tanggal ?? null);
  res.status(201).json({ id: info.lastInsertRowid });
});

router.put('/:id/keluaran/:oid', requireRole('pimpinan', 'spm', 'auditee'), (req, res) => {
  const o = db.prepare(`SELECT * FROM rtm_outputs WHERE id=?`).get(req.params.oid);
  if (!o) return res.status(404).json({ error: 'Keluaran tidak ditemukan' });

  // Auditee hanya boleh memperbarui realisasi tindak lanjut untuk unitnya
  if (req.user.role === 'auditee' && Number(o.unit_id) !== Number(req.user.unit_id))
    return res.status(403).json({ error: 'Bukan unit Anda' });

  const { uraian, unit_id, penanggung_jawab, target_tanggal, status_tindak_lanjut, realisasi } =
    req.body;

  if (req.user.role === 'auditee') {
    // Pemutakhiran realisasi tindak lanjut berlangsung terus meski notulen
    // sudah disahkan, sehingga tidak dikunci oleh status pengesahan.
    db.prepare(
      `UPDATE rtm_outputs SET status_tindak_lanjut=?, realisasi=? WHERE id=?`
    ).run(status_tindak_lanjut ?? o.status_tindak_lanjut, realisasi ?? o.realisasi,
          req.params.oid);
  } else {
    const r = ambilRtm(req.params.id);
    if (!r) return res.status(404).json({ error: 'RTM tidak ditemukan' });
    if (!pastikanBolehEdit(res, r)) return;

    db.prepare(
      `UPDATE rtm_outputs SET uraian=?, unit_id=?, penanggung_jawab=?,
              target_tanggal=?, status_tindak_lanjut=?, realisasi=? WHERE id=?`
    ).run(
      uraian ?? o.uraian, unit_id ?? o.unit_id, penanggung_jawab ?? o.penanggung_jawab,
      target_tanggal ?? o.target_tanggal,
      status_tindak_lanjut ?? o.status_tindak_lanjut, realisasi ?? o.realisasi,
      req.params.oid
    );
  }
  res.json({ ok: true });
});

router.delete('/:id/keluaran/:oid', requireRole('pimpinan', 'spm'), (req, res) => {
  const r = ambilRtm(req.params.id);
  if (!r) return res.status(404).json({ error: 'RTM tidak ditemukan' });
  if (!pastikanBolehEdit(res, r)) return;

  db.prepare(`DELETE FROM rtm_outputs WHERE id=? AND rtm_id=?`)
    .run(req.params.oid, req.params.id);
  res.json({ ok: true });
});

/* ----------------- BAHAN RAPAT OTOMATIS (data pendukung) ---------------- */
/**
 * Mengumpulkan data dari Modul 1–4 sebagai bahan agenda RTM.
 * Dipakai tombol "Tarik Data" pada tiap butir agenda.
 */
router.get('/:id/bahan', (req, res) => {
  const rtm = db.prepare(`SELECT * FROM rtm_meetings WHERE id=?`).get(req.params.id);
  if (!rtm) return res.status(404).json({ error: 'RTM tidak ditemukan' });
  const pid = rtm.period_id;

  // 3f. Hasil audit
  const hasilAudit = db
    .prepare(
      `SELECT un.name AS unit_name, a.ba_number, a.status, a.executed_date,
              (SELECT ROUND(AVG(capaian_persen),2) FROM audit_assessments s
                WHERE s.audit_id=a.id) AS rata_capaian,
              (SELECT COUNT(*) FROM findings f WHERE f.audit_id=a.id) AS temuan
         FROM audits a JOIN units un ON un.id=a.unit_id
        WHERE a.period_id=? ORDER BY un.name`
    )
    .all(pid);

  // 3d. Ketidaksesuaian & tindakan koreksi
  const ketidaksesuaian = db
    .prepare(
      `SELECT f.kategori, COUNT(*) jumlah,
              SUM(CASE WHEN f.status='ditutup' THEN 1 ELSE 0 END) ditutup,
              SUM(CASE WHEN ca.efektivitas='efektif' THEN 1 ELSE 0 END) efektif
         FROM findings f JOIN audits a ON a.id=f.audit_id
         LEFT JOIN corrective_actions ca ON ca.finding_id=f.id
        WHERE a.period_id=? GROUP BY f.kategori`
    )
    .all(pid);

  // 3b. Pencapaian sasaran mutu per kategori standar
  const sasaranMutu = db
    .prepare(
      `SELECT s.category, COUNT(DISTINCT i.id) AS indikator,
              ROUND(AVG(ass.capaian_persen),2) AS rata_capaian
         FROM standards s
         JOIN standard_indicators i ON i.standard_id=s.id
         LEFT JOIN audit_assessments ass ON ass.indicator_id=i.id
         LEFT JOIN audits a ON a.id=ass.audit_id AND a.period_id=s.period_id
        WHERE s.period_id=? GROUP BY s.category ORDER BY s.category`
    )
    .all(pid);

  // 1. Status RTM sebelumnya
  const rtmSebelumnya = db
    .prepare(
      `SELECT o.kategori, o.uraian, o.status_tindak_lanjut, o.realisasi,
              o.target_tanggal, r.judul AS rtm_judul, r.tanggal AS rtm_tanggal
         FROM rtm_outputs o JOIN rtm_meetings r ON r.id=o.rtm_id
        WHERE r.id <> ? AND r.tanggal <= COALESCE(?, date('now','localtime'))
        ORDER BY r.tanggal DESC LIMIT 50`
    )
    .all(rtm.id, rtm.tanggal);

  // 2 & 5. Progres pelaksanaan standar per unit
  const progresUnit = db
    .prepare(
      `SELECT un.name AS unit_name,
              COUNT(DISTINCT i.id) AS total,
              COUNT(DISTINCT CASE WHEN im.status IN ('diserahkan','dinilai')
                                  THEN im.indicator_id END) AS terisi
         FROM units un
         JOIN indicator_assignments ia ON ia.unit_id=un.id
         JOIN standard_indicators i ON i.id=ia.indicator_id
         JOIN standards s ON s.id=i.standard_id AND s.period_id=? AND s.status='ditetapkan'
         LEFT JOIN implementations im ON im.indicator_id=i.id AND im.unit_id=un.id
                                     AND im.period_id=?
        WHERE un.is_active=1 GROUP BY un.id ORDER BY un.name`
    )
    .all(pid, pid);

  res.json({
    hasil_audit: hasilAudit,
    ketidaksesuaian,
    sasaran_mutu: sasaranMutu,
    rtm_sebelumnya: rtmSebelumnya,
    progres_unit: progresUnit,
  });
});

/* --------------------------- PENGESAHAN NOTULEN --------------------------
   Alur berjenjang tiga tanda tangan:
     1. Notulen mengesahkan draf notulen (dapat ditarik kembali selama
        belum diverifikasi Kepala SPM).
     2. Kepala SPM memverifikasi: setuju (lanjut ke Direktur, sekaligus
        membubuhkan tanda tangan) atau tolak (notulen dikembalikan ke
        notulis untuk diperbaiki dan disahkan ulang).
     3. Direktur (pemimpin rapat) membubuhkan tanda tangan final —
        notulen resmi ditandatangani dan terkunci.
   -------------------------------------------------------------------- */

/** 1. Notulen mengesahkan draf notulen */
router.post('/:id/tanda-tangan/notulen', (req, res) => {
  const r = ambilRtm(req.params.id);
  if (!r) return res.status(404).json({ error: 'RTM tidak ditemukan' });
  if (!STATUS_EDITABLE.includes(r.status))
    return res.status(400).json({ error: 'Notulen sudah diajukan untuk pengesahan lebih lanjut.' });

  const bolehTtd = req.user.id === r.notulis_id || ['spm', 'admin'].includes(req.user.role);
  if (!bolehTtd)
    return res.status(403).json({ error: 'Hanya notulis rapat ini yang dapat mengesahkan notulen.' });

  const { image_data } = req.body;
  if (!image_data) return res.status(400).json({ error: 'image_data wajib diisi' });
  if (!/^data:image\/(png|jpeg);base64,/.test(image_data))
    return res.status(400).json({ error: 'Tanda tangan harus berupa gambar' });

  simpanTtdRtm(r.id, 'Notulen', req.user, image_data);
  db.prepare(`UPDATE rtm_meetings SET status='menunggu_verifikasi_spm', catatan=NULL WHERE id=?`)
    .run(r.id);
  logActivity(req.user.id, 'sahkan_notulen', 'rtm_meetings', r.id);
  res.json({ ok: true, status: 'menunggu_verifikasi_spm' });
});

/** Notulen menarik kembali pengesahan (hanya selama menunggu verifikasi SPM) */
router.delete('/:id/tanda-tangan/notulen', (req, res) => {
  const r = ambilRtm(req.params.id);
  if (!r) return res.status(404).json({ error: 'RTM tidak ditemukan' });
  if (r.status !== 'menunggu_verifikasi_spm')
    return res.status(400).json({
      error: 'Pengesahan hanya dapat ditarik selama menunggu verifikasi Kepala SPM.',
    });

  const bolehTarik = req.user.id === r.notulis_id || ['spm', 'admin'].includes(req.user.role);
  if (!bolehTarik)
    return res.status(403).json({ error: 'Hanya notulis rapat ini yang dapat menarik pengesahan.' });

  db.prepare(`DELETE FROM signatures WHERE entity_type='rtm' AND entity_id=? AND peran='Notulen'`)
    .run(r.id);
  db.prepare(`UPDATE rtm_meetings SET status='rencana' WHERE id=?`).run(r.id);
  logActivity(req.user.id, 'tarik_pengesahan_notulen', 'rtm_meetings', r.id);
  res.json({ ok: true, status: 'rencana' });
});

/**
 * Otorisasi verifikasi Kepala SPM: wajib peran spm DAN jabatan mengandung
 * "Kepala"/"Ketua" (mis. "Ketua Satuan Penjaminan Mutu") — bukan sembarang
 * anggota SPM seperti Sekretaris SPM. Admin selalu diizinkan.
 */
function bolehVerifikasiSpm(req) {
  if (req.user.role === 'admin') return true;
  return req.user.role === 'spm' && /kepala|ketua/i.test(req.user.jabatan || '');
}

/** 2. Kepala SPM menyetujui (lanjut ke Direktur) atau menolak (kembali ke notulis) */
router.post('/:id/verifikasi-spm', (req, res) => {
  const r = ambilRtm(req.params.id);
  if (!r) return res.status(404).json({ error: 'RTM tidak ditemukan' });
  if (r.status !== 'menunggu_verifikasi_spm')
    return res.status(400).json({ error: 'Notulen belum diajukan untuk verifikasi Kepala SPM.' });
  if (!bolehVerifikasiSpm(req))
    return res.status(403).json({
      error: 'Hanya Kepala Satuan Penjaminan Mutu yang dapat memverifikasi notulen.',
    });

  const { keputusan, catatan, image_data } = req.body;
  if (!['setuju', 'tolak'].includes(keputusan))
    return res.status(400).json({ error: 'Keputusan harus "setuju" atau "tolak"' });

  if (keputusan === 'tolak') {
    db.transaction(() => {
      db.prepare(
        `DELETE FROM signatures WHERE entity_type='rtm' AND entity_id=? AND peran='Notulen'`
      ).run(r.id);
      db.prepare(`UPDATE rtm_meetings SET status='ditolak_spm', catatan=? WHERE id=?`).run(
        catatan || 'Notulen ditolak oleh Kepala SPM, mohon diperbaiki dan disahkan ulang.',
        r.id
      );
    })();
    logActivity(req.user.id, 'tolak_notulen', 'rtm_meetings', r.id, catatan || '');
    return res.json({ ok: true, status: 'ditolak_spm' });
  }

  if (!image_data) return res.status(400).json({ error: 'image_data wajib diisi untuk menyetujui' });
  if (!/^data:image\/(png|jpeg);base64,/.test(image_data))
    return res.status(400).json({ error: 'Tanda tangan harus berupa gambar' });

  simpanTtdRtm(r.id, 'Kepala SPM', req.user, image_data);
  db.prepare(`UPDATE rtm_meetings SET status='menunggu_direktur', catatan=NULL WHERE id=?`)
    .run(r.id);
  logActivity(req.user.id, 'setujui_notulen', 'rtm_meetings', r.id);
  res.json({ ok: true, status: 'menunggu_direktur' });
});

/** Kepala SPM menarik kembali persetujuannya (hanya selama Direktur belum menandatangani) */
router.delete('/:id/verifikasi-spm', (req, res) => {
  const r = ambilRtm(req.params.id);
  if (!r) return res.status(404).json({ error: 'RTM tidak ditemukan' });
  if (r.status !== 'menunggu_direktur')
    return res.status(400).json({
      error: 'Persetujuan hanya dapat ditarik selama menunggu tanda tangan Direktur.',
    });
  if (!bolehVerifikasiSpm(req))
    return res.status(403).json({
      error: 'Hanya Kepala Satuan Penjaminan Mutu yang dapat menarik persetujuan.',
    });

  db.prepare(`DELETE FROM signatures WHERE entity_type='rtm' AND entity_id=? AND peran='Kepala SPM'`)
    .run(r.id);
  db.prepare(`UPDATE rtm_meetings SET status='menunggu_verifikasi_spm' WHERE id=?`).run(r.id);
  logActivity(req.user.id, 'tarik_persetujuan_spm', 'rtm_meetings', r.id);
  res.json({ ok: true, status: 'menunggu_verifikasi_spm' });
});

/** 3. Direktur (pemimpin rapat) menandatangani final */
router.post('/:id/tanda-tangan/direktur', (req, res) => {
  const r = ambilRtm(req.params.id);
  if (!r) return res.status(404).json({ error: 'RTM tidak ditemukan' });
  if (r.status !== 'menunggu_direktur')
    return res.status(400).json({ error: 'Notulen belum disetujui Kepala SPM.' });

  const bolehTtd = req.user.id === r.pemimpin_id || ['pimpinan', 'admin'].includes(req.user.role);
  if (!bolehTtd)
    return res.status(403).json({ error: 'Hanya pemimpin rapat yang dapat menandatangani notulen final.' });

  const { image_data } = req.body;
  if (!image_data) return res.status(400).json({ error: 'image_data wajib diisi' });
  if (!/^data:image\/(png|jpeg);base64,/.test(image_data))
    return res.status(400).json({ error: 'Tanda tangan harus berupa gambar' });

  simpanTtdRtm(r.id, 'Direktur', req.user, image_data);
  db.prepare(`UPDATE rtm_meetings SET status='ditandatangani' WHERE id=?`).run(r.id);
  logActivity(req.user.id, 'tanda_tangan_notulen_final', 'rtm_meetings', r.id);
  res.json({ ok: true, status: 'ditandatangani' });
});

/** Direktur menarik kembali tanda tangan final (membuka kembali untuk ditandatangani ulang) */
router.delete('/:id/tanda-tangan/direktur', (req, res) => {
  const r = ambilRtm(req.params.id);
  if (!r) return res.status(404).json({ error: 'RTM tidak ditemukan' });
  if (r.status !== 'ditandatangani')
    return res.status(400).json({ error: 'Notulen belum ditandatangani Direktur.' });

  const bolehTarik = req.user.id === r.pemimpin_id || ['pimpinan', 'admin'].includes(req.user.role);
  if (!bolehTarik)
    return res.status(403).json({ error: 'Hanya pemimpin rapat yang dapat menarik tanda tangan final.' });

  db.prepare(`DELETE FROM signatures WHERE entity_type='rtm' AND entity_id=? AND peran='Direktur'`)
    .run(r.id);
  db.prepare(`UPDATE rtm_meetings SET status='menunggu_direktur' WHERE id=?`).run(r.id);
  logActivity(req.user.id, 'tarik_tanda_tangan_direktur', 'rtm_meetings', r.id);
  res.json({ ok: true, status: 'menunggu_direktur' });
});

export default router;
