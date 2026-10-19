/**
 * Cadangan basis data AMAN (konsisten) — dipakai untuk:
 *   1. Mengekspor data dari komputer lokal sebelum diunggah ke server, dan
 *   2. Cadangan terjadwal (cron) di server produksi.
 *
 * Mengapa tidak cukup `cp emi-pktj.db`? Basis data memakai mode WAL: sebagian
 * data terbaru bisa masih berada di berkas `emi-pktj.db-wal`, bukan di
 * `emi-pktj.db`. Menyalin berkas utama saja bisa menghasilkan salinan basi
 * atau rusak. Skrip ini memakai API backup SQLite yang menjamin hasil utuh
 * walau server sedang berjalan, lalu memeriksa integritas salinannya.
 *
 *   node scripts/backup-db.js                       -> ke ~/backup, simpan 14
 *   node scripts/backup-db.js --ke=/folder/tujuan   -> folder tujuan lain
 *   node scripts/backup-db.js --simpan=30           -> jumlah cadangan dipertahankan
 *
 * Hasil: <tujuan>/siemi-YYYYMMDD-HHMM/{emi-pktj.db, uploads/}
 */
import 'dotenv/config';
import Database from 'better-sqlite3';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const DB_PATH = path.join(DATA_DIR, 'emi-pktj.db');

const arg = (nama, bawaan) => {
  const a = process.argv.find((x) => x.startsWith(`--${nama}=`));
  return a ? a.slice(nama.length + 3) : bawaan;
};
const TUJUAN = path.resolve(arg('ke', path.join(os.homedir(), 'backup')));
const SIMPAN = Math.max(1, Number(arg('simpan', 14)) || 14);

const p2 = (n) => String(n).padStart(2, '0');
const d = new Date();
const cap = `${d.getFullYear()}${p2(d.getMonth() + 1)}${p2(d.getDate())}-${p2(d.getHours())}${p2(d.getMinutes())}`;
const FOLDER = path.join(TUJUAN, `siemi-${cap}`);

if (!fs.existsSync(DB_PATH)) {
  console.error(`Basis data tidak ditemukan: ${DB_PATH}`);
  process.exit(1);
}

fs.mkdirSync(FOLDER, { recursive: true });
const berkasDb = path.join(FOLDER, 'emi-pktj.db');

const sumber = new Database(DB_PATH, { readonly: true, fileMustExist: true });
try {
  await sumber.backup(berkasDb);
} finally {
  sumber.close();
}

// Periksa salinan: harus utuh sebelum dianggap berhasil.
const salinan = new Database(berkasDb, { readonly: true });
const hasil = salinan.pragma('integrity_check', { simple: true });
const jmlUnit = salinan.prepare('SELECT COUNT(*) c FROM units').get().c;
const jmlPengguna = salinan.prepare('SELECT COUNT(*) c FROM users').get().c;
salinan.close();
if (hasil !== 'ok') {
  console.error(`Cadangan GAGAL integrity_check: ${hasil}`);
  process.exit(2);
}

const uploads = path.join(DATA_DIR, 'uploads');
if (fs.existsSync(uploads)) fs.cpSync(uploads, path.join(FOLDER, 'uploads'), { recursive: true });

// Hapus cadangan lama, sisakan SIMPAN terbaru.
const lama = fs.readdirSync(TUJUAN)
  .filter((n) => /^siemi-\d{8}-\d{4}$/.test(n))
  .sort()
  .reverse()
  .slice(SIMPAN);
for (const n of lama) fs.rmSync(path.join(TUJUAN, n), { recursive: true, force: true });

console.log(`Cadangan OK  : ${FOLDER}`);
console.log(`Integritas   : ${hasil} (${jmlUnit} unit, ${jmlPengguna} pengguna)`);
if (lama.length) console.log(`Dihapus lama : ${lama.length} cadangan (menyisakan ${SIMPAN})`);
