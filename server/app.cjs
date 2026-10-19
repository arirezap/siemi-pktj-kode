/**
 * Berkas awal (startup file) untuk cPanel "Setup Node.js App" (Phusion Passenger).
 *
 * Aplikasi ini ES Module ("type": "module"), sedangkan Passenger memuat berkas
 * awal dengan require() gaya CommonJS. Berkas .cjs ini menjembatani keduanya
 * lewat import() dinamis. Di cPanel isi kolom "Application startup file"
 * dengan:  app.cjs
 *
 * Di luar cPanel (VPS/PM2/lokal) berkas ini tidak dipakai — jalankan src/index.js.
 */
import('./src/index.js').catch((err) => {
  console.error('Gagal memulai aplikasi:', err);
  process.exit(1);
});
