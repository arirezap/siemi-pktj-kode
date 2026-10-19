import { Router } from 'express';
import { db, logActivity } from '../db.js';
import { requireAuth, requireRole } from '../auth.js';

const router = Router();
router.use(requireAuth);

/* ============================ KOMPETENSI AUDITOR ========================
   Sertifikat pelatihan SPMI dan sertifikat auditor yang dimiliki auditor.
   Diisi mandiri oleh auditor; dipantau pemenuhannya oleh SPM lewat menu
   Manajemen Auditor.
   ====================================================================== */

export const JENIS_LABEL = {
  pelatihan_spmi: 'Sertifikat Pelatihan SPMI',
  sertifikat_auditor: 'Sertifikat Auditor',
  lainnya: 'Sertifikat / Pelatihan Lainnya',
};
// Jenis yang dihitung dalam status pemenuhan kompetensi auditor.
export const JENIS_WAJIB = ['pelatihan_spmi', 'sertifikat_auditor'];

router.get('/meta/jenis', (_req, res) =>
  res.json({ jenis: JENIS_LABEL, wajib: JENIS_WAJIB })
);

/** Sertifikat milik auditor yang sedang masuk */
router.get('/saya', requireRole('auditor'), (req, res) => {
  res.json(
    db
      .prepare(
        `SELECT * FROM auditor_certificates WHERE user_id=?
          ORDER BY jenis, tanggal_terbit DESC`
      )
      .all(req.user.id)
  );
});

/** SPM: daftar seluruh auditor beserta ringkasan pemenuhan sertifikat */
router.get('/', requireRole('spm'), (_req, res) => {
  const auditors = db
    .prepare(
      `SELECT u.id, u.name, u.email, u.jabatan, u.unit_id, un.name AS unit_name
         FROM users u LEFT JOIN units un ON un.id = u.unit_id
        WHERE u.role='auditor' AND u.is_active=1
        ORDER BY u.name`
    )
    .all();
  const certs = db
    .prepare(`SELECT * FROM auditor_certificates ORDER BY jenis, tanggal_terbit DESC`)
    .all();

  const today = new Date().toISOString().slice(0, 10);
  const hasil = auditors.map((a) => {
    const milik = certs.filter((c) => c.user_id === a.id);
    const pemenuhan = {};
    JENIS_WAJIB.forEach((j) => {
      const punya = milik.filter((c) => c.jenis === j);
      const berlaku = punya.filter(
        (c) => !c.tanggal_kedaluwarsa || c.tanggal_kedaluwarsa >= today
      );
      pemenuhan[j] = punya.length === 0
        ? 'belum'
        : berlaku.length > 0
        ? 'berlaku'
        : 'kedaluwarsa';
    });
    return { ...a, sertifikat: milik, pemenuhan };
  });
  res.json(hasil);
});

/** SPM: sertifikat satu auditor tertentu */
router.get('/auditor/:userId', requireRole('spm'), (req, res) => {
  const target = db
    .prepare(`SELECT id, role FROM users WHERE id=?`)
    .get(req.params.userId);
  if (!target || target.role !== 'auditor')
    return res.status(404).json({ error: 'Auditor tidak ditemukan' });

  res.json(
    db
      .prepare(
        `SELECT * FROM auditor_certificates WHERE user_id=?
          ORDER BY jenis, tanggal_terbit DESC`
      )
      .all(req.params.userId)
  );
});

function bolehKelola(req, targetUserId) {
  if (['spm', 'admin'].includes(req.user.role)) return true;
  return req.user.role === 'auditor' && Number(req.user.id) === Number(targetUserId);
}

/** Tambah sertifikat: auditor untuk dirinya sendiri, atau SPM untuk auditor manapun */
router.post('/', requireRole('auditor', 'spm'), (req, res) => {
  const {
    user_id, jenis, nama, penyelenggara, nomor_sertifikat,
    tanggal_terbit, tanggal_kedaluwarsa, berkas_url, keterangan,
  } = req.body;

  const targetUserId = req.user.role === 'auditor' ? req.user.id : Number(user_id);
  if (!targetUserId) return res.status(400).json({ error: 'user_id wajib diisi' });
  if (!JENIS_LABEL[jenis])
    return res.status(400).json({ error: 'Jenis sertifikat tidak dikenal' });
  if (!nama?.trim())
    return res.status(400).json({ error: 'Nama sertifikat/pelatihan wajib diisi' });

  const target = db.prepare(`SELECT role FROM users WHERE id=?`).get(targetUserId);
  if (!target || target.role !== 'auditor')
    return res.status(400).json({ error: 'Pengguna target bukan auditor' });

  const info = db
    .prepare(
      `INSERT INTO auditor_certificates
         (user_id, jenis, nama, penyelenggara, nomor_sertifikat, tanggal_terbit,
          tanggal_kedaluwarsa, berkas_url, keterangan, created_by)
       VALUES (?,?,?,?,?,?,?,?,?,?)`
    )
    .run(
      targetUserId, jenis, nama, penyelenggara ?? null, nomor_sertifikat ?? null,
      tanggal_terbit ?? null, tanggal_kedaluwarsa ?? null, berkas_url ?? null,
      keterangan ?? null, req.user.id
    );
  logActivity(req.user.id, 'tambah_sertifikat_auditor', 'auditor_certificates',
    info.lastInsertRowid, nama);
  res.status(201).json({ id: info.lastInsertRowid });
});

router.put('/:id', requireRole('auditor', 'spm'), (req, res) => {
  const c = db.prepare(`SELECT * FROM auditor_certificates WHERE id=?`).get(req.params.id);
  if (!c) return res.status(404).json({ error: 'Sertifikat tidak ditemukan' });
  if (!bolehKelola(req, c.user_id))
    return res.status(403).json({ error: 'Bukan sertifikat Anda' });

  const {
    jenis, nama, penyelenggara, nomor_sertifikat,
    tanggal_terbit, tanggal_kedaluwarsa, berkas_url, keterangan,
  } = req.body;
  if (jenis && !JENIS_LABEL[jenis])
    return res.status(400).json({ error: 'Jenis sertifikat tidak dikenal' });

  db.prepare(
    `UPDATE auditor_certificates
        SET jenis=?, nama=?, penyelenggara=?, nomor_sertifikat=?, tanggal_terbit=?,
            tanggal_kedaluwarsa=?, berkas_url=?, keterangan=?,
            updated_at=datetime('now','localtime')
      WHERE id=?`
  ).run(
    jenis ?? c.jenis, nama ?? c.nama, penyelenggara ?? c.penyelenggara,
    nomor_sertifikat ?? c.nomor_sertifikat, tanggal_terbit ?? c.tanggal_terbit,
    tanggal_kedaluwarsa ?? c.tanggal_kedaluwarsa, berkas_url ?? c.berkas_url,
    keterangan ?? c.keterangan, req.params.id
  );
  logActivity(req.user.id, 'ubah_sertifikat_auditor', 'auditor_certificates', c.id);
  res.json({ ok: true });
});

router.delete('/:id', requireRole('auditor', 'spm'), (req, res) => {
  const c = db.prepare(`SELECT * FROM auditor_certificates WHERE id=?`).get(req.params.id);
  if (!c) return res.status(404).json({ error: 'Sertifikat tidak ditemukan' });
  if (!bolehKelola(req, c.user_id))
    return res.status(403).json({ error: 'Bukan sertifikat Anda' });

  db.prepare(`DELETE FROM auditor_certificates WHERE id=?`).run(req.params.id);
  logActivity(req.user.id, 'hapus_sertifikat_auditor', 'auditor_certificates', c.id, c.nama);
  res.json({ ok: true });
});

export default router;
