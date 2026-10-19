/**
 * Daftar akun yang MASIH memakai kata sandi bawaan seed ("pktj2026").
 * Jalankan sebelum/sesudah go-live, lalu minta pemilik akun mengganti lewat
 * menu Profil Saya (atau Administrator mengatur ulang di Data Master).
 *
 *   node scripts/cek-password-default.js
 *
 * Hanya membaca; tidak mengubah apa pun. Keluar dengan kode 1 bila masih ada.
 */
import 'dotenv/config';
import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const BAWAAN = 'pktj2026';

const db = new Database(path.join(DATA_DIR, 'emi-pktj.db'), { readonly: true, fileMustExist: true });
const users = db.prepare(
  `SELECT id, name, email, role, is_active FROM users ORDER BY role, email`
).all();
const pw = db.prepare(`SELECT id, password_hash FROM users`).all();
db.close();

const hashById = new Map(pw.map((r) => [r.id, r.password_hash]));
const masihBawaan = users.filter((u) => bcrypt.compareSync(BAWAAN, hashById.get(u.id)));

if (!masihBawaan.length) {
  console.log(`Aman: tidak ada akun yang memakai kata sandi bawaan (${users.length} akun diperiksa).`);
  process.exit(0);
}
console.log(`${masihBawaan.length} dari ${users.length} akun MASIH memakai kata sandi bawaan:\n`);
for (const u of masihBawaan) {
  console.log(`  ${u.role.padEnd(9)} ${u.email}${u.is_active ? '' : '  (nonaktif)'}`);
}
console.log('\nGanti semuanya (atau nonaktifkan akun yang tidak dipakai) sebelum aplikasi dibuka ke publik.');
process.exit(1);
