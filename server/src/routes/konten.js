import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { db, logActivity, DATA_DIR } from '../db.js';
import { requireAuth, requireRole } from '../auth.js';
import { buatSlug, slugValid } from '../lib/slug.js';

/* ============================================================================
   MODUL: Konten Publik (Berita & Halaman) — pengelolaan oleh SPM.
   Seluruh rute di berkas ini butuh login DAN peran SPM (admin selalu boleh,
   lihat requireRole di auth.js). Rute baca-publik terpisah ada di
   routes/publik.js — TIDAK menggunakan berkas ini sama sekali.
   ============================================================================ */

const router = Router();
router.use(requireAuth);
router.use(requireRole('spm'));

function waktuSekarang() {
  return db.prepare(`SELECT datetime('now','localtime') AS t`).get().t;
}

function slugUnik(tabel, basis, idKecuali) {
  const dasar = buatSlug(basis) || 'tanpa-judul';
  let slug = dasar;
  let n = 1;
  const ada = db.prepare(`SELECT id FROM ${tabel} WHERE slug=? AND id<>?`);
  while (ada.get(slug, idKecuali || 0)) {
    n++;
    slug = `${dasar}-${n}`;
  }
  return slug;
}

/* ------------------------------- BERITA -------------------------------- */
router.get('/posts', (_req, res) => {
  res.json(
    db.prepare(`
      SELECT p.id, p.slug, p.title, p.excerpt, p.cover_url, p.status,
             p.published_at, p.created_at, p.updated_at, u.name AS created_by_name
        FROM posts p LEFT JOIN users u ON u.id = p.created_by
       ORDER BY p.created_at DESC
    `).all()
  );
});

router.get('/posts/:id', (req, res) => {
  const row = db.prepare(`SELECT * FROM posts WHERE id=?`).get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Berita tidak ditemukan' });
  res.json(row);
});

router.post('/posts', (req, res) => {
  const { title, excerpt, content, cover_url, status, slug: slugInput } = req.body;
  if (!title?.trim() || !content?.trim())
    return res.status(400).json({ error: 'Judul dan isi wajib diisi' });

  const st = status === 'terbit' ? 'terbit' : 'draft';
  const basisSlug = slugInput?.trim() && slugValid(buatSlug(slugInput)) ? slugInput.trim() : title;
  const slug = slugUnik('posts', basisSlug);

  const info = db.prepare(`
    INSERT INTO posts (slug, title, excerpt, content, cover_url, status, published_at, created_by)
    VALUES (?,?,?,?,?,?,?,?)
  `).run(
    slug, title.trim(), excerpt?.trim() || null, content, cover_url || null, st,
    st === 'terbit' ? waktuSekarang() : null, req.user.id
  );
  logActivity(req.user.id, 'tambah', 'posts', info.lastInsertRowid, `Berita baru: ${title}`);
  res.status(201).json({ id: info.lastInsertRowid, slug });
});

router.put('/posts/:id', (req, res) => {
  const existing = db.prepare(`SELECT * FROM posts WHERE id=?`).get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Berita tidak ditemukan' });

  const { title, excerpt, content, cover_url, status, slug: slugInput } = req.body;
  if (!title?.trim() || !content?.trim())
    return res.status(400).json({ error: 'Judul dan isi wajib diisi' });

  const st = status === 'terbit' ? 'terbit' : 'draft';
  let slug = existing.slug;
  const slugBaru = slugInput?.trim();
  if (slugBaru && slugBaru !== existing.slug && slugValid(buatSlug(slugBaru))) {
    slug = slugUnik('posts', slugBaru, existing.id);
  }
  // Tanggal terbit dipertahankan bila sudah pernah terbit sebelumnya (supaya
  // menyunting berita lama tidak menaikkannya ke urutan teratas); baru diisi
  // saat PERTAMA KALI berstatus terbit. Kembali ke draft mengosongkannya lagi.
  const publishedAt = st === 'terbit' ? (existing.published_at || waktuSekarang()) : null;

  db.prepare(`
    UPDATE posts SET title=?, excerpt=?, content=?, cover_url=?, status=?, slug=?,
           published_at=?, updated_at=datetime('now','localtime')
     WHERE id=?
  `).run(title.trim(), excerpt?.trim() || null, content, cover_url || null, st, slug, publishedAt, existing.id);
  logActivity(req.user.id, 'ubah', 'posts', existing.id, `Berita diubah: ${title}`);
  res.json({ ok: true, slug });
});

router.delete('/posts/:id', (req, res) => {
  const existing = db.prepare(`SELECT title FROM posts WHERE id=?`).get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Berita tidak ditemukan' });
  db.prepare(`DELETE FROM posts WHERE id=?`).run(req.params.id);
  logActivity(req.user.id, 'hapus', 'posts', Number(req.params.id), `Berita dihapus: ${existing.title}`);
  res.json({ ok: true });
});

/* ------------------------------- HALAMAN --------------------------------
   Mendukung hierarki 2 tingkat: sebuah halaman boleh punya parent_id yang
   menunjuk ke halaman lain, ASALKAN halaman induk itu sendiri tidak punya
   induk (dibatasi maks. 2 tingkat, lihat validasiParent()) — cukup untuk
   kebutuhan mis. SPMI/SPME beserta sub-halamannya. */
// Menu/sub-menu halaman bisa dijadikan redirect ke alamat luar (lih.
// LayoutPublik.jsx) — dirender sebagai <a href> APA ADANYA di navigasi
// publik, bukan lewat markdownRingan.jsx yang menyaring skema tautan. Karena
// itu skemanya divalidasi/dinormalisasi di sini juga: skema selain
// http/https (mis. javascript:, data:) DITOLAK; alamat tanpa skema (mis.
// "contoh.com") otomatis diberi awalan https://.
function normalisasiTautanEksternal(input) {
  const t = (input || '').trim();
  if (!t) return { ok: true, url: null };
  if (/^https?:\/\//i.test(t)) return { ok: true, url: t };
  if (/^[a-z][a-z0-9+.-]*:/i.test(t))
    return { ok: false, error: 'Tautan eksternal harus berupa alamat web (http/https)' };
  return { ok: true, url: `https://${t}` };
}

function validasiParent(parentIdInput, existingId) {
  if (!parentIdInput) return { ok: true, parentId: null };
  const parentId = Number(parentIdInput);
  if (existingId && parentId === Number(existingId))
    return { ok: false, error: 'Halaman tidak boleh menjadi induk dirinya sendiri' };

  const induk = db.prepare(`SELECT id, parent_id FROM pages WHERE id=?`).get(parentId);
  if (!induk) return { ok: false, error: 'Halaman induk tidak ditemukan' };
  if (induk.parent_id) return { ok: false, error: 'Halaman induk tidak boleh berupa sub-halaman (maksimal 2 tingkat)' };

  if (existingId) {
    const adaAnak = db.prepare(`SELECT 1 FROM pages WHERE parent_id=?`).get(existingId);
    if (adaAnak)
      return { ok: false, error: 'Halaman ini sudah punya sub-halaman sendiri, tidak bisa dijadikan sub-halaman dari halaman lain' };
  }
  return { ok: true, parentId };
}

// Urutan tampil: dikelompokkan menurut urutan halaman induknya (halaman
// tingkat atas memakai urutannya sendiri), lalu induk sebelum anak, lalu
// urutan masing-masing anak — supaya sub-halaman selalu tampil tepat di
// bawah induknya di daftar admin, sesuai urutan menu publik.
const URUTAN_HIERARKI = `
  ORDER BY COALESCE((SELECT sort_order FROM pages pp WHERE pp.id = p.parent_id), p.sort_order),
           (p.parent_id IS NOT NULL),
           p.sort_order, p.title
`;

router.get('/pages', (_req, res) => {
  res.json(
    db.prepare(`
      SELECT p.id, p.slug, p.title, p.status, p.sort_order, p.parent_id, p.external_url,
             par.title AS parent_title,
             p.created_at, p.updated_at, u.name AS created_by_name
        FROM pages p
        LEFT JOIN users u ON u.id = p.created_by
        LEFT JOIN pages par ON par.id = p.parent_id
      ${URUTAN_HIERARKI}
    `).all()
  );
});

router.get('/pages/:id', (req, res) => {
  const row = db.prepare(`SELECT * FROM pages WHERE id=?`).get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Halaman tidak ditemukan' });
  res.json(row);
});

router.post('/pages', (req, res) => {
  const { title, content, status, sort_order, slug: slugInput, parent_id, external_url } = req.body;

  const cekTautan = normalisasiTautanEksternal(external_url);
  if (!cekTautan.ok) return res.status(400).json({ error: cekTautan.error });
  // Isi konten hanya wajib bila halaman ini TIDAK jadi redirect eksternal —
  // begitu tautan eksternal terisi, isi diabaikan sepenuhnya di sisi publik.
  if (!title?.trim() || (!cekTautan.url && !content?.trim()))
    return res.status(400).json({ error: 'Judul wajib diisi, dan isi wajib diisi kecuali halaman ini memakai tautan eksternal' });

  const cekParent = validasiParent(parent_id, null);
  if (!cekParent.ok) return res.status(400).json({ error: cekParent.error });

  const st = status === 'terbit' ? 'terbit' : 'draft';
  const basisSlug = slugInput?.trim() && slugValid(buatSlug(slugInput)) ? slugInput.trim() : title;
  const slug = slugUnik('pages', basisSlug);

  const info = db.prepare(`
    INSERT INTO pages (slug, title, content, status, sort_order, parent_id, external_url, created_by)
    VALUES (?,?,?,?,?,?,?,?)
  `).run(slug, title.trim(), content || '', st, Number(sort_order) || 0, cekParent.parentId, cekTautan.url, req.user.id);
  logActivity(req.user.id, 'tambah', 'pages', info.lastInsertRowid, `Halaman baru: ${title}`);
  res.status(201).json({ id: info.lastInsertRowid, slug });
});

router.put('/pages/:id', (req, res) => {
  const existing = db.prepare(`SELECT * FROM pages WHERE id=?`).get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Halaman tidak ditemukan' });

  const { title, content, status, sort_order, slug: slugInput, parent_id, external_url } = req.body;

  const cekTautan = normalisasiTautanEksternal(external_url);
  if (!cekTautan.ok) return res.status(400).json({ error: cekTautan.error });
  if (!title?.trim() || (!cekTautan.url && !content?.trim()))
    return res.status(400).json({ error: 'Judul wajib diisi, dan isi wajib diisi kecuali halaman ini memakai tautan eksternal' });

  const cekParent = validasiParent(parent_id, existing.id);
  if (!cekParent.ok) return res.status(400).json({ error: cekParent.error });

  const st = status === 'terbit' ? 'terbit' : 'draft';
  let slug = existing.slug;
  const slugBaru = slugInput?.trim();
  if (slugBaru && slugBaru !== existing.slug && slugValid(buatSlug(slugBaru))) {
    slug = slugUnik('pages', slugBaru, existing.id);
  }

  db.prepare(`
    UPDATE pages SET title=?, content=?, status=?, sort_order=?, slug=?, parent_id=?, external_url=?,
           updated_at=datetime('now','localtime')
     WHERE id=?
  `).run(title.trim(), content || '', st, Number(sort_order) || 0, slug, cekParent.parentId, cekTautan.url, existing.id);
  logActivity(req.user.id, 'ubah', 'pages', existing.id, `Halaman diubah: ${title}`);
  res.json({ ok: true, slug });
});

router.delete('/pages/:id', (req, res) => {
  const existing = db.prepare(`SELECT title FROM pages WHERE id=?`).get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Halaman tidak ditemukan' });
  db.prepare(`DELETE FROM pages WHERE id=?`).run(req.params.id);
  logActivity(req.user.id, 'hapus', 'pages', Number(req.params.id), `Halaman dihapus: ${existing.title}`);
  res.json({ ok: true });
});

/* ------------------------------ UNGGAH SAMPUL ---------------------------- */
router.post('/unggah-sampul', (req, res) => {
  const { filename, data } = req.body || {};
  if (!filename || !data) return res.status(400).json({ error: 'filename dan data wajib diisi' });

  const m = /^data:(image\/(?:png|jpe?g|webp|gif));base64,(.+)$/i.exec(data);
  if (!m) return res.status(400).json({ error: 'Berkas harus berupa gambar (PNG/JPG/WEBP/GIF)' });

  const buf = Buffer.from(m[2], 'base64');
  if (buf.length > 5 * 1024 * 1024)
    return res.status(400).json({ error: 'Ukuran gambar maksimal 5 MB' });

  const dir = path.join(DATA_DIR, 'uploads');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const safe = String(filename).replace(/[^\w.\-]/g, '_');
  const name = `sampul-${Date.now()}-${req.user.id}-${safe}`;
  fs.writeFileSync(path.join(dir, name), buf);

  res.json({ url: `/uploads/${name}` });
});

export default router;
