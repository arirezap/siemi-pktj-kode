import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { db, logActivity } from '../db.js';
import { requireAuth, requireRole } from '../auth.js';

const router = Router();
router.use(requireAuth);

/* ------------------------------- UNIT ---------------------------------- */
router.get('/units', (_req, res) => {
  res.json(
    db.prepare(
      `SELECT u.*, p.name AS parent_name
         FROM units u LEFT JOIN units p ON p.id = u.parent_id
        WHERE u.is_active = 1
        ORDER BY u.type, u.name`
    ).all()
  );
});

router.post('/units', requireRole('spm'), (req, res) => {
  const { code, name, type, parent_id, jenjang } = req.body;
  if (!code || !name || !type)
    return res.status(400).json({ error: 'code, name, dan type wajib diisi' });
  if (type === 'sub_unit' && !parent_id)
    return res.status(400).json({ error: 'Sub-unit kerja wajib memilih unit induk' });
  const info = db
    .prepare(`INSERT INTO units (code, name, type, parent_id, jenjang) VALUES (?,?,?,?,?)`)
    .run(code, name, type, type === 'sub_unit' ? parent_id : (parent_id ?? null), type === 'prodi' ? (jenjang || null) : null);
  res.status(201).json({ id: info.lastInsertRowid });
});

router.put('/units/:id', requireRole('spm'), (req, res) => {
  const { code, name, type, parent_id, is_active, jenjang } = req.body;
  if (type === 'sub_unit' && !parent_id)
    return res.status(400).json({ error: 'Sub-unit kerja wajib memilih unit induk' });
  db.prepare(
    `UPDATE units SET code=?, name=?, type=?, parent_id=?, is_active=?, jenjang=? WHERE id=?`
  ).run(
    code, name, type, type === 'sub_unit' ? parent_id : (parent_id ?? null), is_active ?? 1,
    type === 'prodi' ? (jenjang || null) : null, req.params.id
  );
  res.json({ ok: true });
});

/**
 * Daftar nilai jenjang yang sudah pernah dipakai (gabungan units.jenjang dan
 * refs.jenjang), dipakai sebagai pilihan siap-pakai pada form Unit dan form
 * Acuan agar penamaan jenjang di keduanya selalu cocok persis (SPME
 * mencocokkan prodi ke acuan berdasarkan kesamaan teks jenjang ini).
 */
router.get('/jenjang', (_req, res) => {
  const dariUnit = db
    .prepare(`SELECT DISTINCT jenjang FROM units WHERE jenjang IS NOT NULL AND jenjang<>''`)
    .all().map((r) => r.jenjang);
  const dariRef = db
    .prepare(`SELECT DISTINCT jenjang FROM refs WHERE jenjang IS NOT NULL AND jenjang<>''`)
    .all().map((r) => r.jenjang);
  const bawaan = ['Diploma III', 'Sarjana Terapan'];
  const semua = [...new Set([...bawaan, ...dariUnit, ...dariRef])].sort();
  res.json(semua);
});

/**
 * Ranah TAMBAHAN di luar 5 ranah bawaan (A-E, sudah ada langsung di client).
 * Dipakai Modul Penetapan Standar supaya SPM bisa membuat ranah baru
 * (mis. untuk standar melampaui SN Dikti yang tidak cocok ke A-E) tanpa
 * perlu ubah kode — kode+label ranah baru tersimpan di sini dan otomatis
 * konsisten dipakai ulang di seluruh aplikasi (bukan cuma sesi form saat itu).
 */
router.get('/ranah', (_req, res) => {
  res.json(db.prepare(`SELECT id, code, label, pendek FROM ranah_custom ORDER BY code`).all());
});

router.post('/ranah', requireRole('spm'), (req, res) => {
  const kode = (req.body.code || '').trim().toUpperCase();
  const label = (req.body.label || '').trim();
  const pendek = (req.body.pendek || '').trim() || label;
  if (!kode || !label)
    return res.status(400).json({ error: 'Kode dan label ranah wajib diisi' });
  if (['A', 'B', 'C', 'D', 'E'].includes(kode))
    return res.status(400).json({ error: `Kode "${kode}" sudah dipakai ranah bawaan` });
  const ada = db.prepare(`SELECT id FROM ranah_custom WHERE code=?`).get(kode);
  if (ada) return res.status(400).json({ error: `Kode ranah "${kode}" sudah pernah dibuat` });
  const info = db
    .prepare(`INSERT INTO ranah_custom (code, label, pendek, created_by) VALUES (?,?,?,?)`)
    .run(kode, label, pendek, req.user.id);
  logActivity(req.user.id, 'tambah', 'ranah_custom', info.lastInsertRowid, `Ranah baru: ${kode} — ${label}`);
  res.status(201).json({ id: info.lastInsertRowid, code: kode, label, pendek });
});

/* ------------------------------ PENGGUNA -------------------------------- */
router.get('/users', requireRole('spm', 'auditor', 'pimpinan'), (_req, res) => {
  res.json(
    db
      .prepare(
        `SELECT u.id, u.nip, u.name, u.email, u.role, u.jabatan, u.unit_id,
                u.is_active, un.name AS unit_name
           FROM users u LEFT JOIN units un ON un.id = u.unit_id
          ORDER BY u.role, u.name`
      )
      .all()
  );
});

router.post('/users', requireRole('admin'), (req, res) => {
  const { nip, name, email, password, role, jabatan, unit_id } = req.body;
  if (!name || !email || !password || !role)
    return res
      .status(400)
      .json({ error: 'name, email, password, dan role wajib diisi' });
  try {
    const info = db
      .prepare(
        `INSERT INTO users (nip, name, email, password_hash, role, jabatan, unit_id)
         VALUES (?,?,?,?,?,?,?)`
      )
      .run(
        nip ?? null,
        name,
        email,
        bcrypt.hashSync(password, 10),
        role,
        jabatan ?? null,
        unit_id ?? null
      );
    logActivity(req.user.id, 'tambah_pengguna', 'users', info.lastInsertRowid, name);
    res.status(201).json({ id: info.lastInsertRowid });
  } catch (e) {
    res.status(400).json({ error: 'Email atau NIP sudah digunakan' });
  }
});

router.put('/users/:id', requireRole('admin'), (req, res) => {
  const { nip, name, email, role, jabatan, unit_id, is_active, password } =
    req.body;
  db.prepare(
    `UPDATE users SET nip=?, name=?, email=?, role=?, jabatan=?, unit_id=?, is_active=?
      WHERE id=?`
  ).run(
    nip ?? null,
    name,
    email,
    role,
    jabatan ?? null,
    unit_id ?? null,
    is_active ?? 1,
    req.params.id
  );
  if (password)
    db.prepare(`UPDATE users SET password_hash=? WHERE id=?`).run(
      bcrypt.hashSync(password, 10),
      req.params.id
    );
  res.json({ ok: true });
});

/* ------------------------------ PERIODE --------------------------------- */
router.get('/periods', (_req, res) => {
  res.json(db.prepare(`SELECT * FROM periods ORDER BY year DESC, id DESC`).all());
});

router.get('/periods/aktif', (_req, res) => {
  const p =
    db.prepare(`SELECT * FROM periods WHERE status='aktif' ORDER BY id DESC`).get() ||
    db.prepare(`SELECT * FROM periods ORDER BY id DESC`).get();
  res.json(p || null);
});

router.post('/periods', requireRole('spm'), (req, res) => {
  const { name, year, start_date, end_date, status } = req.body;
  if (!name || !year)
    return res.status(400).json({ error: 'Nama dan tahun periode wajib diisi' });
  const info = db
    .prepare(
      `INSERT INTO periods (name, year, start_date, end_date, status)
       VALUES (?,?,?,?,?)`
    )
    .run(name, year, start_date ?? null, end_date ?? null, status ?? 'draft');
  res.status(201).json({ id: info.lastInsertRowid });
});

router.put('/periods/:id', requireRole('spm'), (req, res) => {
  const { name, year, start_date, end_date, status } = req.body;
  if (status === 'aktif')
    db.prepare(`UPDATE periods SET status='selesai' WHERE status='aktif'`).run();
  db.prepare(
    `UPDATE periods SET name=?, year=?, start_date=?, end_date=?, status=? WHERE id=?`
  ).run(name, year, start_date ?? null, end_date ?? null, status, req.params.id);
  res.json({ ok: true });
});

/* --------------------------- LOG AKTIVITAS ------------------------------ */
router.get('/log', requireRole('spm'), (_req, res) => {
  res.json(
    db
      .prepare(
        `SELECT l.*, u.name AS user_name FROM activity_log l
           LEFT JOIN users u ON u.id = l.user_id
          ORDER BY l.id DESC LIMIT 200`
      )
      .all()
  );
});

export default router;
