import { Router } from 'express';
import { db } from '../db.js';
import { slugValid } from '../lib/slug.js';

/* ============================================================================
   RUTE PUBLIK — TANPA LOGIN. Dipasang TANPA requireAuth (lihat index.js).

   Aturan keamanan wajib dijaga di file ini:
   1. Berita/halaman hanya dikembalikan bila status='terbit' — filter ini ada
      di SETIAP query, tidak pernah diandalkan ke frontend.
   2. Rekap mutu HANYA mengembalikan angka agregat (COUNT/SUM). Kolom naratif
      tabel findings/corrective_actions (uraian, bukti_objektif, catatan,
      nama personel, dst.) TIDAK BOLEH pernah muncul di SELECT rute ini —
      lihat catatan keamanan di dalam handler /rekap-mutu.
   ============================================================================ */

const router = Router();

/* ------------------------------- BERITA -------------------------------- */
router.get('/berita', (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 20, 50);
  const offset = Math.max(Number(req.query.offset) || 0, 0);
  const baris = db.prepare(`
    SELECT id, slug, title, excerpt, cover_url, published_at
      FROM posts
     WHERE status='terbit'
     ORDER BY published_at DESC
     LIMIT ? OFFSET ?
  `).all(limit, offset);
  const total = db.prepare(`SELECT COUNT(*) c FROM posts WHERE status='terbit'`).get().c;
  res.json({ items: baris, total });
});

router.get('/berita/:slug', (req, res) => {
  if (!slugValid(req.params.slug)) return res.status(404).json({ error: 'Berita tidak ditemukan' });
  const row = db.prepare(`
    SELECT id, slug, title, excerpt, content, cover_url, published_at
      FROM posts WHERE slug=? AND status='terbit'
  `).get(req.params.slug);
  if (!row) return res.status(404).json({ error: 'Berita tidak ditemukan' });
  res.json(row);
});

/* ------------------------------- HALAMAN --------------------------------
   Dikembalikan sebagai pohon 2 tingkat (induk + children) supaya menu
   navigasi publik (LayoutPublik.jsx) bisa membangun submenu SPMI/SPME (dan
   halaman lain yang diberi sub-halaman) secara dinamis, tanpa daftar
   hardcode di frontend. Hanya halaman berstatus 'terbit' yang disertakan,
   baik di tingkat induk maupun anak. */
router.get('/halaman', (_req, res) => {
  const induk = db.prepare(`
    SELECT id, slug, title, external_url FROM pages WHERE status='terbit' AND parent_id IS NULL ORDER BY sort_order, title
  `).all();
  const anakStmt = db.prepare(`
    SELECT slug, title, external_url FROM pages WHERE status='terbit' AND parent_id=? ORDER BY sort_order, title
  `);
  res.json(induk.map(({ id, slug, title, external_url }) => ({ slug, title, external_url, children: anakStmt.all(id) })));
});

router.get('/halaman/:slug', (req, res) => {
  if (!slugValid(req.params.slug)) return res.status(404).json({ error: 'Halaman tidak ditemukan' });
  const row = db.prepare(`
    SELECT slug, title, content, external_url FROM pages WHERE slug=? AND status='terbit'
  `).get(req.params.slug);
  if (!row) return res.status(404).json({ error: 'Halaman tidak ditemukan' });
  res.json(row);
});

/* ------------------------------ REKAP MUTU -------------------------------
   Hanya angka agregat tingkat institusi — TIDAK ADA rincian per unit dan
   TIDAK ADA kolom naratif (lihat catatan keamanan di kepala berkas ini). */
router.get('/rekap-mutu', (req, res) => {
  const pid =
    Number(req.query.period_id) ||
    db.prepare(`SELECT id FROM periods WHERE status='aktif' ORDER BY id DESC`).get()?.id ||
    db.prepare(`SELECT id FROM periods ORDER BY id DESC`).get()?.id;

  // Periode yang layak dipilih di selektor publik: yang sudah punya temuan
  // EMI ATAU sudah punya standar ditetapkan (supaya siklus SPMI yang baru
  // mulai — standar sudah ditetapkan tapi audit belum berjalan — tetap
  // muncul, bukan cuma yang sudah ada temuan).
  const daftarPeriode = db.prepare(`
    SELECT DISTINCT p.id, p.name, p.year
      FROM periods p
     WHERE EXISTS (SELECT 1 FROM audits a JOIN findings f ON f.audit_id = a.id WHERE a.period_id = p.id)
        OR EXISTS (SELECT 1 FROM standards s WHERE s.period_id = p.id AND s.status='ditetapkan')
     ORDER BY p.year DESC, p.id DESC
  `).all();

  if (!pid) {
    return res.json({
      period: null, kategori: [], total: { temuan: 0, selesai: 0 }, standar: [], daftar_periode: [],
    });
  }

  const period = db.prepare(`SELECT id, name, year FROM periods WHERE id=?`).get(pid);

  // Hanya kategori + hitungan — TIDAK men-select findings.uraian, bukti_objektif,
  // kriteria_acuan, created_by, ataupun join ke units/audits untuk rincian per unit.
  const kategori = db.prepare(`
    SELECT f.kategori,
           COUNT(*) AS jumlah,
           SUM(CASE WHEN f.status='ditutup' THEN 1 ELSE 0 END) AS selesai
      FROM findings f
      JOIN audits a ON a.id = f.audit_id
     WHERE a.period_id = ?
     GROUP BY f.kategori
     ORDER BY f.kategori
  `).all(pid);

  const total = kategori.reduce(
    (acc, k) => ({ temuan: acc.temuan + k.jumlah, selesai: acc.selesai + k.selesai }),
    { temuan: 0, selesai: 0 }
  );

  // Jumlah standar yang sudah ditetapkan pada periode ini, dipilah sifat:
  // wajib (SN Dikti) vs melampaui (di luar SN Dikti). Hanya hitungan —
  // tidak men-select judul/isi standar.
  const standar = db.prepare(`
    SELECT sifat, COUNT(*) AS jumlah
      FROM standards
     WHERE period_id=? AND status='ditetapkan'
     GROUP BY sifat
  `).all(pid);

  res.json({ period, kategori, total, standar, daftar_periode: daftarPeriode });
});

export default router;
