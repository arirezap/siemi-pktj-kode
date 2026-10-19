import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { db, logActivity } from '../db.js';
import { signToken, requireAuth } from '../auth.js';

const router = Router();

router.post('/login', (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password)
    return res.status(400).json({ error: 'Email dan kata sandi wajib diisi' });

  const user = db
    .prepare(`SELECT * FROM users WHERE lower(email) = lower(?)`)
    .get(String(email).trim());

  if (!user || !bcrypt.compareSync(password, user.password_hash))
    return res.status(401).json({ error: 'Email atau kata sandi salah' });
  if (!user.is_active)
    return res.status(403).json({ error: 'Akun dinonaktifkan' });

  const unit = user.unit_id
    ? db.prepare(`SELECT name, code FROM units WHERE id = ?`).get(user.unit_id)
    : null;

  logActivity(user.id, 'login', 'users', user.id);

  res.json({
    token: signToken(user),
    user: {
      id: user.id,
      nip: user.nip,
      name: user.name,
      email: user.email,
      role: user.role,
      jabatan: user.jabatan,
      unit_id: user.unit_id,
      unit_name: unit?.name ?? null,
      unit_code: unit?.code ?? null,
    },
  });
});

router.get('/me', requireAuth, (req, res) => res.json({ user: req.user }));

router.post('/ubah-sandi', requireAuth, (req, res) => {
  const { sandi_lama, sandi_baru } = req.body || {};
  if (!sandi_baru || sandi_baru.length < 6)
    return res.status(400).json({ error: 'Kata sandi baru minimal 6 karakter' });

  const row = db
    .prepare(`SELECT password_hash FROM users WHERE id = ?`)
    .get(req.user.id);
  if (!bcrypt.compareSync(sandi_lama || '', row.password_hash))
    return res.status(400).json({ error: 'Kata sandi lama salah' });

  db.prepare(`UPDATE users SET password_hash = ? WHERE id = ?`).run(
    bcrypt.hashSync(sandi_baru, 10),
    req.user.id
  );
  logActivity(req.user.id, 'ubah_sandi', 'users', req.user.id);
  res.json({ ok: true });
});

/** Ganti surel akun SENDIRI (beda dari PUT /master/users/:id yang khusus
 *  admin mengubah akun orang lain) — wajib konfirmasi kata sandi saat ini
 *  supaya sesi yang dibajak tidak bisa mengganti surel pemulihan akun. */
router.put('/surel', requireAuth, (req, res) => {
  const { email, sandi_saat_ini } = req.body || {};
  const emailBaru = String(email || '').trim();
  if (!emailBaru || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailBaru))
    return res.status(400).json({ error: 'Surel tidak valid' });

  const row = db
    .prepare(`SELECT password_hash FROM users WHERE id = ?`)
    .get(req.user.id);
  if (!bcrypt.compareSync(sandi_saat_ini || '', row.password_hash))
    return res.status(400).json({ error: 'Kata sandi saat ini salah' });

  try {
    db.prepare(`UPDATE users SET email = ? WHERE id = ?`).run(emailBaru, req.user.id);
  } catch {
    return res.status(400).json({ error: 'Surel sudah digunakan akun lain' });
  }

  logActivity(req.user.id, 'ubah_surel', 'users', req.user.id, emailBaru);
  res.json({ ok: true, email: emailBaru });
});

export default router;
