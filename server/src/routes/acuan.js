import { Router } from 'express';
import { db, logActivity } from '../db.js';
import { requireAuth, requireRole } from '../auth.js';
import { buatWorkbookXlsx, GAYA } from '../lib/xlsxWriter.js';

/** Campur warna hex (mis. "#1d4ed8") ke arah putih supaya jadi versi pastel
 *  yang enak dipakai sebagai latar sel berisi teks gelap. */
function pastelkan(hex, campuranPutih = 0.82) {
  const h = String(hex || '64748b').replace('#', '');
  const r = parseInt(h.slice(0, 2), 16) || 100;
  const g = parseInt(h.slice(2, 4), 16) || 116;
  const b = parseInt(h.slice(4, 6), 16) || 139;
  const campur = (c) => Math.round(c + (255 - c) * campuranPutih);
  return [campur(r), campur(g), campur(b)].map((v) => v.toString(16).padStart(2, '0')).join('');
}

const router = Router();
router.use(requireAuth);

/* =====================================================================
   MODUL ACUAN MUTU
   Pengelolaan acuan eksternal, butir-butirnya, dan pemetaannya ke
   standar/indikator PKTJ. Menjadi dasar laporan cakupan dan lensa.
   ===================================================================== */

/**
 * Sinkronkan ulang indikator standar yang mengadopsi satu butir acuan
 * (standard_indicators.source_ref_item_id) begitu butir sumbernya diedit di
 * Acuan Mutu — supaya Penetapan Standar (Modul 1) beserta Pelaksanaan
 * (Modul 2) dan Evaluasi (Modul 3), yang membaca datanya langsung dari
 * standard_indicators, ikut mengikuti perubahan tanpa perlu dibuka-simpan
 * ulang manual satu per satu. Logikanya sama persis dengan penarikan "apa
 * adanya" saat adopsi pertama kali (lihat simpanIndikator di routes/standar.js).
 */
function sinkronkanIndikatorAdopsi(refItemId) {
  const src = db
    .prepare(`SELECT title, uraian, target, target_skor, satuan, strategy FROM ref_items WHERE id=?`)
    .get(refItemId);
  if (!src) return;
  const indicator = (src.uraian && src.uraian.trim()) || src.title;
  db.prepare(
    `UPDATE standard_indicators
        SET indicator=?, target=?, target_skor=?, satuan=?, strategy=?
      WHERE source_ref_item_id=?`
  ).run(indicator, src.target, src.target_skor, src.satuan, src.strategy, refItemId);
}

/**
 * Urutkan baris ref_items datar (hasil SELECT ... WHERE ref_id=?) menjadi
 * urutan pohon (pre-order/depth-first): tiap induk langsung diikuti oleh
 * seluruh anaknya secara berurutan sebelum lanjut ke cabang berikutnya.
 * Baris sumber sudah terurut sort_order/id di dalam SQL, jadi di sini kita
 * cukup menjalankannya lewat peta parent_id -> anak-anak.
 */
function urutkanPohon(baris) {
  const anakDari = new Map();
  const akar = [];
  for (const b of baris) {
    if (b.parent_id) {
      if (!anakDari.has(b.parent_id)) anakDari.set(b.parent_id, []);
      anakDari.get(b.parent_id).push(b);
    } else {
      akar.push(b);
    }
  }
  const hasil = [];
  const jalan = (node) => {
    hasil.push(node);
    for (const anak of anakDari.get(node.id) || []) jalan(anak);
  };
  akar.forEach(jalan);
  // Jaga-jaga: baris dengan parent_id yang tidak ditemukan di antara baris
  // yang sama (seharusnya tidak terjadi bila data konsisten) tetap disertakan.
  if (hasil.length < baris.length) {
    const sudah = new Set(hasil.map((b) => b.id));
    for (const b of baris) if (!sudah.has(b.id)) hasil.push(b);
  }
  return hasil;
}

/* ------------------------------- ACUAN -------------------------------- */
router.get('/', (_req, res) => {
  res.json(
    db.prepare(
      `SELECT r.*,
              (SELECT COUNT(*) FROM ref_items i WHERE i.ref_id = r.id) AS jumlah_butir,
              (SELECT COUNT(*) FROM ref_items i
                WHERE i.ref_id = r.id AND i.wajib_petakan = 1) AS butir_wajib,
              (SELECT COUNT(*) FROM ref_items i
                WHERE i.ref_id = r.id AND i.wajib_petakan = 1
                  AND (
                    EXISTS (SELECT 1 FROM ref_map m WHERE m.ref_item_id = i.id)
                    OR EXISTS (SELECT 1 FROM standard_indicators si
                                WHERE si.source_ref_item_id = i.id)
                  )) AS butir_terpetakan
         FROM refs r ORDER BY r.sort_order, r.id`
    ).all()
  );
});

router.post('/', requireRole('spm'), (req, res) => {
  const {
    code, name, version, publisher, effective_date, warna, keterangan, jenjang,
    skor_min, skor_maks, skor_step,
  } = req.body;
  if (!code || !name)
    return res.status(400).json({ error: 'Kode dan nama acuan wajib diisi' });
  try {
    const urut = db.prepare(`SELECT COUNT(*) c FROM refs`).get().c;
    const info = db
      .prepare(
        `INSERT INTO refs (code, name, version, publisher, effective_date, warna,
                           keterangan, jenjang, skor_min, skor_maks, skor_step, sort_order)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`
      )
      .run(code, name, version ?? null, publisher ?? null, effective_date ?? null,
           warna ?? null, keterangan ?? null, jenjang || null,
           skor_min === '' || skor_min == null ? null : Number(skor_min),
           skor_maks === '' || skor_maks == null ? null : Number(skor_maks),
           skor_step === '' || skor_step == null ? null : Number(skor_step), urut);
    logActivity(req.user.id, 'tambah_acuan', 'refs', info.lastInsertRowid, code);
    res.status(201).json({ id: info.lastInsertRowid });
  } catch {
    res.status(400).json({ error: 'Kode acuan sudah digunakan' });
  }
});

router.put('/:id', requireRole('spm'), (req, res) => {
  const r = db.prepare(`SELECT * FROM refs WHERE id=?`).get(req.params.id);
  if (!r) return res.status(404).json({ error: 'Acuan tidak ditemukan' });
  const {
    code, name, version, publisher, effective_date, warna, keterangan, is_active, jenjang,
    skor_min, skor_maks, skor_step,
  } = req.body;
  const angka = (v, lama) => (v === undefined ? lama : (v === '' || v == null ? null : Number(v)));
  db.prepare(
    `UPDATE refs SET code=?, name=?, version=?, publisher=?, effective_date=?,
            warna=?, keterangan=?, is_active=?, jenjang=?, skor_min=?, skor_maks=?, skor_step=?
      WHERE id=?`
  ).run(
    code ?? r.code, name ?? r.name, version ?? r.version, publisher ?? r.publisher,
    effective_date ?? r.effective_date, warna ?? r.warna, keterangan ?? r.keterangan,
    is_active ?? r.is_active, jenjang !== undefined ? (jenjang || null) : r.jenjang,
    angka(skor_min, r.skor_min), angka(skor_maks, r.skor_maks), angka(skor_step, r.skor_step),
    req.params.id
  );
  res.json({ ok: true });
});

router.delete('/:id', requireRole('spm'), (req, res) => {
  db.prepare(`DELETE FROM refs WHERE id=?`).run(req.params.id);
  logActivity(req.user.id, 'hapus_acuan', 'refs', req.params.id);
  res.json({ ok: true });
});

/**
 * Ekspor seluruh Acuan Mutu (semua acuan beserta butir/indikatornya) jadi
 * satu berkas Excel: satu sheet ringkasan "Daftar Acuan", ditambah satu
 * sheet per acuan berisi butirnya. Kolom & urutan tiap sheet acuan PERSIS
 * sama dengan yang dibaca menu Impor (lihat POST /:id/impor dan
 * jalankanImpor di client/src/pages/Acuan.jsx) — kode, judul, uraian,
 * kode_induk, tipe, bobot, payung, target, target_skor, satuan, strategy —
 * supaya baris hasil ekspor ini bisa langsung disalin (kolom dipisah TAB
 * saat disalin dari Excel) dan ditempel kembali ke menu Impor acuan yang
 * bersangkutan, baik untuk diedit massal maupun dipulihkan.
 */
router.get('/export', (_req, res) => {
  const acuanList = db.prepare(`SELECT * FROM refs ORDER BY sort_order, id`).all();

  const sheetRingkasan = {
    nama: 'Daftar Acuan',
    kolom: [
      { lebar: 16 }, { lebar: 42 }, { lebar: 14 }, { lebar: 20 }, { lebar: 14 },
      { lebar: 16 }, { lebar: 10 }, { lebar: 10 }, { lebar: 10 }, { lebar: 12 },
    ],
    beku: { kolom: 1, baris: 1 },
    baris: [
      {
        gaya: GAYA.header, tinggi: 28,
        nilai: ['Kode', 'Nama Acuan', 'Versi', 'Penerbit', 'Tanggal Berlaku', 'Jenjang',
                'Skor Min', 'Skor Maks', 'Skor Step', 'Jumlah Butir'],
      },
      ...acuanList.map((a) => {
        const jumlah = db.prepare(`SELECT COUNT(*) c FROM ref_items WHERE ref_id=?`).get(a.id).c;
        return {
          gaya: GAYA.data(pastelkan(a.warna)),
          nilai: [
            a.code, a.name, a.version, a.publisher, a.effective_date, a.jenjang,
            a.skor_min, a.skor_maks, a.skor_step, jumlah,
          ],
        };
      }),
    ],
  };

  const HEADER_BUTIR = [
    'kode', 'judul', 'uraian', 'kode_induk', 'tipe', 'bobot', 'payung',
    'target', 'target_skor', 'satuan', 'strategy',
  ];
  const LEBAR_BUTIR = [
    { lebar: 12 }, { lebar: 34 }, { lebar: 42 }, { lebar: 12 }, { lebar: 12 },
    { lebar: 8 }, { lebar: 8 }, { lebar: 34 }, { lebar: 16 }, { lebar: 10 }, { lebar: 42 },
  ];

  const sheetAcuan = acuanList.map((a) => {
    const butir = urutkanPohon(
      db
        .prepare(`SELECT * FROM ref_items WHERE ref_id=? ORDER BY level, sort_order, id`)
        .all(a.id)
    );
    const idKeKode = new Map(butir.map((b) => [b.id, b.code]));
    const gayaHeaderAcuan = {
      font: { name: 'Arial', size: 10, bold: true, color: 'FFFFFF' },
      fill: String(a.warna || '1D4ED8').replace('#', ''),
      align: { h: 'left', v: 'center', wrap: true, indent: 1 },
      border: true,
    };
    const warnaData = pastelkan(a.warna);
    return {
      nama: a.code,
      kolom: LEBAR_BUTIR,
      beku: { kolom: 2, baris: 1 },
      baris: [
        { gaya: gayaHeaderAcuan, tinggi: 28, nilai: HEADER_BUTIR },
        ...butir.map((b) => ({
          gaya: GAYA.data(warnaData),
          nilai: [
            b.code,
            b.title,
            b.uraian,
            b.parent_id ? idKeKode.get(b.parent_id) ?? null : null,
            b.tipe,
            b.bobot,
            b.wajib_petakan === 0 ? 'Ya' : null,
            b.target,
            b.target_skor,
            b.satuan,
            b.strategy,
          ],
        })),
      ],
    };
  });

  const buf = buatWorkbookXlsx([sheetRingkasan, ...sheetAcuan]);
  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  );
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="Matriks_Acuan_Mutu.xlsx"`
  );
  res.send(buf);
});

/**
 * Kandidat indikator: butir dari SEMUA acuan sekaligus yang sudah punya
 * target (siap diadopsi apa adanya ke Modul 1). Dipakai oleh pemilih
 * indikator pada form pernyataan standar.
 */
router.get('/kandidat-indikator', (req, res) => {
  const { cari, ref_id } = req.query;
  const where = [`i.target IS NOT NULL AND i.target <> ''`, `r.is_active = 1`];
  const params = [];

  if (ref_id) { where.push('i.ref_id = ?'); params.push(ref_id); }
  if (cari) {
    where.push('(i.code LIKE ? OR i.title LIKE ? OR i.uraian LIKE ?)');
    const q = `%${cari}%`;
    params.push(q, q, q);
  }

  res.json(
    db.prepare(
      `SELECT i.id, i.code, i.title, i.uraian, i.target, i.target_skor, i.satuan, i.strategy,
              r.id AS ref_id, r.code AS acuan_kode, r.name AS acuan_nama, r.warna,
              (SELECT COUNT(*) FROM standard_indicators si
                WHERE si.source_ref_item_id = i.id) AS jumlah_diadopsi
         FROM ref_items i JOIN refs r ON r.id = i.ref_id
        WHERE ${where.join(' AND ')}
        ORDER BY r.sort_order, i.code
        LIMIT 200`
    ).all(...params)
  );
});

/* ---------------------------- BUTIR ACUAN ----------------------------- */

/** Pohon butir satu acuan, lengkap dengan jumlah pemetaan tiap butir */
router.get('/:id/butir', (req, res) => {
  const acuan = db.prepare(`SELECT * FROM refs WHERE id=?`).get(req.params.id);
  if (!acuan) return res.status(404).json({ error: 'Acuan tidak ditemukan' });

  const butir = db
    .prepare(
      `SELECT i.*,
              (SELECT COUNT(*) FROM ref_map m WHERE m.ref_item_id = i.id) AS jumlah_petaan,
              (SELECT COUNT(*) FROM standard_indicators si
                WHERE si.source_ref_item_id = i.id) AS jumlah_diadopsi
         FROM ref_items i WHERE i.ref_id = ?
        ORDER BY i.level, i.sort_order, i.id`
    )
    .all(req.params.id);

  res.json({ acuan, butir: urutkanPohon(butir) });
});

router.post('/:id/butir', requireRole('spm'), (req, res) => {
  const { parent_id, code, title, uraian, tipe, bobot, wajib_petakan,
          target, target_skor, satuan, strategy } = req.body;
  if (!code || !title)
    return res.status(400).json({ error: 'Kode dan judul butir wajib diisi' });

  const level = parent_id
    ? (db.prepare(`SELECT level FROM ref_items WHERE id=?`).get(parent_id)?.level ?? 0) + 1
    : 1;
  const urut = db
    .prepare(
      `SELECT COUNT(*) c FROM ref_items
        WHERE ref_id=? AND COALESCE(parent_id,0)=COALESCE(?,0)`
    )
    .get(req.params.id, parent_id ?? null).c;

  try {
    const info = db
      .prepare(
        `INSERT INTO ref_items (ref_id, parent_id, code, title, uraian, tipe, level,
                                bobot, wajib_petakan, target, target_skor, satuan,
                                strategy, sort_order)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
      )
      .run(
        req.params.id, parent_id ?? null, code, title, uraian ?? null,
        tipe ?? 'butir', level, bobot ?? null,
        wajib_petakan === 0 || wajib_petakan === false ? 0 : 1,
        target ?? null, target_skor ?? null, satuan ?? null, strategy ?? null, urut
      );
    res.status(201).json({ id: info.lastInsertRowid });
  } catch {
    res.status(400).json({ error: `Kode butir "${code}" sudah ada pada acuan ini` });
  }
});

router.put('/butir/:bid', requireRole('spm'), (req, res) => {
  const b = db.prepare(`SELECT * FROM ref_items WHERE id=?`).get(req.params.bid);
  if (!b) return res.status(404).json({ error: 'Butir tidak ditemukan' });
  const { code, title, uraian, tipe, bobot, wajib_petakan, target, target_skor,
          satuan, strategy } = req.body;
  db.prepare(
    `UPDATE ref_items SET code=?, title=?, uraian=?, tipe=?, bobot=?, wajib_petakan=?,
            target=?, target_skor=?, satuan=?, strategy=?
      WHERE id=?`
  ).run(
    code ?? b.code, title ?? b.title, uraian ?? b.uraian, tipe ?? b.tipe,
    bobot ?? b.bobot,
    wajib_petakan === undefined ? b.wajib_petakan : (wajib_petakan ? 1 : 0),
    target === undefined ? b.target : target,
    target_skor === undefined ? b.target_skor : target_skor,
    satuan === undefined ? b.satuan : satuan,
    strategy === undefined ? b.strategy : strategy,
    req.params.bid
  );
  sinkronkanIndikatorAdopsi(req.params.bid);
  res.json({ ok: true });
});

router.delete('/butir/:bid', requireRole('spm'), (req, res) => {
  const jumlah = db
    .prepare(`SELECT COUNT(*) c FROM standard_indicators WHERE source_ref_item_id=?`)
    .get(req.params.bid).c;
  if (jumlah)
    return res.status(400).json({
      error: `Butir ini sudah diadopsi menjadi ${jumlah} indikator standar. Lepas adopsinya terlebih dahulu di Modul 1 sebelum menghapus butir.`,
    });
  db.prepare(`DELETE FROM ref_items WHERE id=?`).run(req.params.bid);
  res.json({ ok: true });
});

/**
 * Impor butir massal.
 * body.baris = [{ kode, judul, uraian, tipe, bobot, kode_induk, payung }]
 * Butir dengan kode yang sudah ada akan diperbarui, bukan diduplikasi.
 */
router.post('/:id/impor', requireRole('spm'), (req, res) => {
  const refId = Number(req.params.id);
  const acuan = db.prepare(`SELECT * FROM refs WHERE id=?`).get(refId);
  if (!acuan) return res.status(404).json({ error: 'Acuan tidak ditemukan' });

  const baris = Array.isArray(req.body?.baris) ? req.body.baris : null;
  if (!baris?.length)
    return res.status(400).json({ error: 'Tidak ada baris yang dikirim' });

  const hasil = { ditambah: 0, diperbarui: 0, gagal: [] };

  db.transaction(() => {
    // Urutkan agar induk selalu diproses sebelum anak
    const terurut = [...baris].sort(
      (a, b) => String(a.kode).length - String(b.kode).length
    );

    terurut.forEach((r, n) => {
      const kode = String(r.kode ?? '').trim();
      const judul = String(r.judul ?? '').trim();
      if (!kode || !judul) {
        hasil.gagal.push({ baris: n + 1, alasan: 'Kode atau judul kosong' });
        return;
      }

      const kodeInduk = String(r.kode_induk ?? '').trim();
      let parentId = null;
      let level = 1;
      if (kodeInduk) {
        const induk = db
          .prepare(`SELECT id, level FROM ref_items WHERE ref_id=? AND code=?`)
          .get(refId, kodeInduk);
        if (!induk) {
          hasil.gagal.push({
            baris: n + 1, kode,
            alasan: `Kode induk "${kodeInduk}" belum ada pada acuan ini`,
          });
          return;
        }
        parentId = induk.id;
        level = induk.level + 1;
      }

      const payung =
        r.payung === true || r.payung === 1 ||
        String(r.payung ?? '').toLowerCase().startsWith('y');

      const target = String(r.target ?? '').trim() || null;
      const target_skor = String(r.target_skor ?? '').trim() || null;
      const satuan = String(r.satuan ?? '').trim() || null;
      const strategy = String(r.strategy ?? '').trim() || null;

      const ada = db
        .prepare(`SELECT id FROM ref_items WHERE ref_id=? AND code=?`)
        .get(refId, kode);

      if (ada) {
        db.prepare(
          `UPDATE ref_items SET parent_id=?, title=?, uraian=?, tipe=?, level=?,
                  bobot=?, wajib_petakan=?, target=?, target_skor=?, satuan=?,
                  strategy=? WHERE id=?`
        ).run(
          parentId, judul, r.uraian ?? null, r.tipe ?? 'butir', level,
          r.bobot ?? null, payung ? 0 : 1, target, target_skor, satuan, strategy, ada.id
        );
        sinkronkanIndikatorAdopsi(ada.id);
        hasil.diperbarui++;
      } else {
        db.prepare(
          `INSERT INTO ref_items (ref_id, parent_id, code, title, uraian, tipe,
                                  level, bobot, wajib_petakan, target, target_skor,
                                  satuan, strategy, sort_order)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
        ).run(
          refId, parentId, kode, judul, r.uraian ?? null, r.tipe ?? 'butir',
          level, r.bobot ?? null, payung ? 0 : 1, target, target_skor, satuan, strategy, n
        );
        hasil.ditambah++;
      }
    });
  })();

  logActivity(req.user.id, 'impor_butir_acuan', 'refs', refId,
    `${hasil.ditambah} baru, ${hasil.diperbarui} diperbarui`);
  res.json(hasil);
});

/* ----------------------------- PEMETAAN ------------------------------- */

/** Pemetaan sebuah butir acuan */
router.get('/butir/:bid/petaan', (req, res) => {
  res.json(
    db.prepare(
      `SELECT m.*, s.code AS standar_kode, s.title AS standar_judul,
              s.ranah, s.kelompok, s.sifat,
              i.code AS indikator_kode, i.indicator
         FROM ref_map m
         LEFT JOIN standards s ON s.id = m.standard_id
         LEFT JOIN standard_indicators i ON i.id = m.indicator_id
        WHERE m.ref_item_id = ? ORDER BY s.code, i.sort_order`
    ).all(req.params.bid)
  );
});

/** Pemetaan yang menempel pada satu standar (beserta indikatornya) */
router.get('/petaan/standar/:sid', (req, res) => {
  res.json(
    db.prepare(
      `SELECT m.*, r.code AS acuan_kode, r.name AS acuan_nama, r.warna,
              b.code AS butir_kode, b.title AS butir_judul, b.tipe
         FROM ref_map m
         JOIN ref_items b ON b.id = m.ref_item_id
         JOIN refs r ON r.id = b.ref_id
        WHERE m.standard_id = ?
           OR m.indicator_id IN (SELECT id FROM standard_indicators WHERE standard_id = ?)
        ORDER BY r.sort_order, b.code`
    ).all(req.params.sid, req.params.sid)
  );
});

router.post('/petaan', requireRole('spm'), (req, res) => {
  const { ref_item_id, standard_id, indicator_id, kekuatan, catatan } = req.body;
  if (!ref_item_id)
    return res.status(400).json({ error: 'ref_item_id wajib diisi' });
  if (!standard_id && !indicator_id)
    return res
      .status(400)
      .json({ error: 'Butir harus dipetakan ke standar atau indikator' });

  // Bila dipetakan ke indikator, standard_id diisi otomatis dari indikatornya
  let sid = standard_id ?? null;
  if (indicator_id) {
    const ind = db
      .prepare(`SELECT standard_id FROM standard_indicators WHERE id=?`)
      .get(indicator_id);
    if (!ind) return res.status(404).json({ error: 'Indikator tidak ditemukan' });
    sid = ind.standard_id;
  }

  try {
    const info = db
      .prepare(
        `INSERT INTO ref_map (ref_item_id, standard_id, indicator_id, kekuatan,
                              catatan, created_by)
         VALUES (?,?,?,?,?,?)`
      )
      .run(ref_item_id, sid, indicator_id ?? null, kekuatan ?? 'utama',
           catatan ?? null, req.user.id);
    res.status(201).json({ id: info.lastInsertRowid });
  } catch {
    res.status(400).json({ error: 'Pemetaan ini sudah ada' });
  }
});

router.delete('/petaan/:mid', requireRole('spm'), (req, res) => {
  db.prepare(`DELETE FROM ref_map WHERE id=?`).run(req.params.mid);
  res.json({ ok: true });
});

/* ------------------------- LAPORAN CAKUPAN ---------------------------- */

/**
 * Cakupan acuan: butir mana yang belum punya standar, dan standar mana
 * yang tidak bersandar pada acuan mana pun.
 */
router.get('/laporan/cakupan', (req, res) => {
  const periodId = Number(req.query.period_id);
  if (!periodId) return res.status(400).json({ error: 'period_id wajib diisi' });

  // Sebuah butir dianggap "tercakup" bila ada pemetaan longgar (ref_map) ATAU
  // — khusus butir berindikator — sudah diadopsi apa adanya ke standard_indicators.
  const tercakup = `(
    EXISTS (SELECT 1 FROM ref_map m WHERE m.ref_item_id = i.id)
    OR EXISTS (SELECT 1 FROM standard_indicators si WHERE si.source_ref_item_id = i.id)
  )`;

  const ringkasan = db
    .prepare(
      `SELECT r.id, r.code, r.name, r.version, r.warna,
              COUNT(i.id) AS butir_wajib,
              COUNT(CASE WHEN ${tercakup} THEN 1 END) AS terpetakan
         FROM refs r
         LEFT JOIN ref_items i ON i.ref_id = r.id AND i.wajib_petakan = 1
        WHERE r.is_active = 1
        GROUP BY r.id ORDER BY r.sort_order`
    )
    .all();

  const butirYatim = db
    .prepare(
      `SELECT r.code AS acuan_kode, r.name AS acuan_nama, i.id, i.code, i.title, i.tipe,
              CASE WHEN i.target IS NOT NULL AND i.target <> '' THEN 1 ELSE 0 END AS punya_indikator
         FROM ref_items i
         JOIN refs r ON r.id = i.ref_id
        WHERE i.wajib_petakan = 1 AND r.is_active = 1 AND NOT ${tercakup}
        ORDER BY r.sort_order, i.level, i.sort_order`
    )
    .all();

  const standarTanpaAcuan = db
    .prepare(
      `SELECT s.id, s.code, s.title, s.ranah, s.kelompok, s.sifat, s.category
         FROM standards s
        WHERE s.period_id = ?
          AND NOT EXISTS (
            SELECT 1 FROM ref_map m
             WHERE m.standard_id = s.id
                OR m.indicator_id IN (
                     SELECT id FROM standard_indicators WHERE standard_id = s.id))
          AND NOT EXISTS (
            SELECT 1 FROM standard_indicators si
             WHERE si.standard_id = s.id AND si.source_ref_item_id IS NOT NULL)
        ORDER BY s.code`
    )
    .all(periodId);

  // Indikator yang ditulis manual DAN belum tertaut ke acuan mana pun —
  // baik lewat adopsi verbatim (source_ref_item_id) maupun pemetaan longgar
  // (ref_map). Berbeda dari standar_tanpa_acuan: di sini terlihat sampai ke
  // tingkat indikator, termasuk indikator manual di dalam standar yang
  // sebagian indikatornya SUDAH diadopsi dari acuan (kasus campuran).
  const indikatorManual = db
    .prepare(
      `SELECT si.id, si.code, si.indicator, si.standard_id,
              s.code AS standar_kode, s.title AS standar_judul,
              s.ranah, s.kelompok, s.sifat
         FROM standard_indicators si
         JOIN standards s ON s.id = si.standard_id
        WHERE s.period_id = ?
          AND si.source_ref_item_id IS NULL
          AND NOT EXISTS (SELECT 1 FROM ref_map m WHERE m.indicator_id = si.id)
        ORDER BY s.code, si.sort_order`
    )
    .all(periodId);

  const perRanah = db
    .prepare(
      `SELECT s.ranah, s.kelompok, COUNT(DISTINCT s.id) AS jumlah_standar,
              COUNT(DISTINCT COALESCE(m.ref_item_id, i.source_ref_item_id)) AS butir_terserap
         FROM standards s
         LEFT JOIN standard_indicators i ON i.standard_id = s.id
         LEFT JOIN ref_map m ON m.standard_id = s.id OR m.indicator_id = i.id
        WHERE s.period_id = ?
        GROUP BY s.ranah, s.kelompok ORDER BY s.ranah, s.kelompok`
    )
    .all(periodId);

  res.json({
    ringkasan: ringkasan.map((r) => ({
      ...r,
      persen: r.butir_wajib ? Math.round((r.terpetakan / r.butir_wajib) * 100) : null,
    })),
    butir_yatim: butirYatim,
    standar_tanpa_acuan: standarTanpaAcuan,
    indikator_manual: indikatorManual,
    per_ranah: perRanah,
  });
});

/**
 * Lensa pelaporan: standar dan capaiannya dikelompokkan menurut satu acuan.
 */
router.get('/lensa/:refId', (req, res) => {
  const periodId = Number(req.query.period_id);
  if (!periodId) return res.status(400).json({ error: 'period_id wajib diisi' });

  const acuan = db.prepare(`SELECT * FROM refs WHERE id=?`).get(req.params.refId);
  if (!acuan) return res.status(404).json({ error: 'Acuan tidak ditemukan' });

  const butir = urutkanPohon(
    db
      .prepare(
        `SELECT i.id, i.code, i.title, i.tipe, i.level, i.parent_id, i.wajib_petakan,
                i.sort_order
           FROM ref_items i WHERE i.ref_id = ?
          ORDER BY i.level, i.sort_order, i.id`
      )
      .all(req.params.refId)
  );

  const petaan = db
    .prepare(
      `SELECT m.ref_item_id, s.id AS standard_id, s.code AS standar_kode,
              s.title AS standar_judul, s.ranah, s.kelompok, s.sifat,
              ind.id AS indicator_id, ind.code AS indikator_kode, ind.indicator,
              ind.target,
              (SELECT ROUND(AVG(a.capaian_persen),1)
                 FROM audit_assessments a
                 JOIN audits au ON au.id = a.audit_id AND au.period_id = ?
                WHERE a.indicator_id = ind.id) AS capaian
         FROM ref_map m
         JOIN ref_items b ON b.id = m.ref_item_id AND b.ref_id = ?
         LEFT JOIN standards s ON s.id = m.standard_id
         LEFT JOIN standard_indicators ind ON ind.id = m.indicator_id
        WHERE s.period_id = ? OR s.id IS NULL
        ORDER BY s.code, ind.sort_order`
    )
    .all(periodId, req.params.refId, periodId);

  res.json({ acuan, butir, petaan });
});

export default router;
