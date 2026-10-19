import jwt from 'jsonwebtoken';
import { db } from './db.js';

const JWT_SECRET_DEV = 'emi-pktj-development-secret-change-me';
export const JWT_SECRET = process.env.JWT_SECRET || JWT_SECRET_DEV;

// Di produksi, tolak berjalan dengan kunci bawaan/lemah: siapa pun yang tahu
// kunci bawaan (ada di kode sumber) bisa memalsukan token login.
if (process.env.NODE_ENV === 'production') {
  const s = process.env.JWT_SECRET || '';
  if (s === JWT_SECRET_DEV || s.startsWith('ganti-dengan') || s.length < 32) {
    console.error(
      '\n  [FATAL] JWT_SECRET belum diatur dengan benar untuk mode produksi.\n' +
      '  Isi server/.env dengan JWT_SECRET acak minimal 32 karakter, mis. hasil: openssl rand -hex 48\n'
    );
    process.exit(1);
  }
}
export const TOKEN_TTL = '12h';

export function signToken(user) {
  return jwt.sign(
    { sub: user.id, role: user.role, unit_id: user.unit_id, name: user.name },
    JWT_SECRET,
    { expiresIn: TOKEN_TTL }
  );
}

/** Middleware: wajib login */
export function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Token tidak ditemukan' });

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = db
      .prepare(
        `SELECT u.id, u.nip, u.name, u.email, u.role, u.jabatan, u.unit_id,
                u.is_active, un.name AS unit_name, un.code AS unit_code
           FROM users u LEFT JOIN units un ON un.id = u.unit_id
          WHERE u.id = ?`
      )
      .get(payload.sub);

    if (!user || !user.is_active)
      return res.status(401).json({ error: 'Pengguna tidak aktif' });

    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: 'Token tidak valid atau kedaluwarsa' });
  }
}

/** Middleware: batasi berdasarkan peran */
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Belum login' });
    if (req.user.role === 'admin') return next();
    if (!roles.includes(req.user.role))
      return res.status(403).json({
        error: `Akses ditolak. Dibutuhkan peran: ${roles.join(' / ')}`,
      });
    next();
  };
}

/** Auditee hanya boleh mengakses data unitnya sendiri (kecuali admin/spm) */
export function canAccessUnit(user, unitId) {
  if (['admin', 'spm', 'pimpinan', 'auditor'].includes(user.role)) return true;
  return Number(user.unit_id) === Number(unitId);
}
