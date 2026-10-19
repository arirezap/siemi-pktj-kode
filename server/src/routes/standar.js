import { Router } from 'express';
import { db, logActivity } from '../db.js';
import { requireAuth, requireRole } from '../auth.js';
import { buatWorkbookXlsx, GAYA, PALET_BARIS } from '../lib/xlsxWriter.js';

// Warna latar baris data pada ekspor matriks, satu warna per ranah (A-E),
// meniru format dokumen referensi Matriks_Standar_dan_Kode_Modul_Penetapan_Standar.
const WARNA_RANAH = { A: PALET_BARIS[0], B: PALET_BARIS[1], C: PALET_BARIS[2], D: PALET_BARIS[3], E: PALET_BARIS[4] };

const router = Router();
router.use(requireAuth);

/* ============================ MODUL 1 ==================================
   PENETAPAN STANDAR — hak input: Satuan Penjaminan Mutu (role: spm)

   Arsitektur 3 lapis:
     Standar (ranah A–E, kelompok Luaran/Proses/Masukan untuk ranah A–C)
       -> Pernyataan Standar (boleh lebih dari satu per standar)
            -> Indikator (boleh lebih dari satu per pernyataan)

   Setiap indikator TIDAK PERNAH digabung isinya lintas acuan. Bila
   diadopsi dari Acuan Mutu (source_ref_item_id terisi), teks indikator
   beserta target/satuan/strategi ditarik APA ADANYA dari butir acuan di
   sisi server (bukan dari input klien) — memastikan tidak ada penulisan
   ulang. Penggabungan hanya terjadi pada tingkat pernyataan standar,
   yaitu satu pernyataan boleh menaungi banyak indikator dari acuan yang
   berbeda-beda.

   Penanggung jawab ditetapkan pada tingkat INDIKATOR, bukan pernyataan
   standar. Unit yang tercantum pada sebuah standar adalah gabungan unit
   dari seluruh indikatornya.
   ====================================================================== */

/** Daftar standar */
router.get('/', (req, res) => {
  const { period_id, category, ranah, kelompok, sifat, unit_id, status } = req.query;
  const where = [];
  const params = [];

  if (period_id) { where.push('s.period_id = ?'); params.push(period_id); }
  if (category)  { where.push('s.category = ?');  params.push(category); }
  if (ranah)     { where.push('s.ranah = ?');     params.push(ranah); }
  if (kelompok)  { where.push('s.kelompok = ?');  params.push(kelompok); }
  if (sifat)     { where.push('s.sifat = ?');     params.push(sifat); }
  if (status)    { where.push('s.status = ?');    params.push(status); }
  if (unit_id) {
    where.push(
      `EXISTS (SELECT 1 FROM standard_indicators i
                 JOIN indicator_assignments a ON a.indicator_id = i.id
                WHERE i.standard_id = s.id AND a.unit_id = ?)`
    );
    params.push(unit_id);
  }

  res.json(
    db.prepare(
      `SELECT s.*, p.name AS period_name,
              (SELECT st.statement FROM standard_statements st
                WHERE st.standard_id = s.id ORDER BY st.sort_order, st.id LIMIT 1)
                AS pernyataan_utama,
              (SELECT COUNT(*) FROM standard_statements st WHERE st.standard_id = s.id)
                AS jumlah_pernyataan,
              (SELECT COUNT(*) FROM standard_indicators i WHERE i.standard_id = s.id)
                AS jumlah_indikator,
              (SELECT COUNT(DISTINCT a.unit_id)
                 FROM standard_indicators i
                 JOIN indicator_assignments a ON a.indicator_id = i.id
                WHERE i.standard_id = s.id) AS jumlah_unit,
              (SELECT COUNT(DISTINCT bid) FROM (
                 SELECT ref_item_id AS bid FROM ref_map WHERE standard_id = s.id
                 UNION
                 SELECT m.ref_item_id AS bid FROM ref_map m
                   JOIN standard_indicators ii ON ii.id = m.indicator_id
                  WHERE ii.standard_id = s.id
                 UNION
                 SELECT source_ref_item_id AS bid FROM standard_indicators
                  WHERE standard_id = s.id AND source_ref_item_id IS NOT NULL
               )) AS jumlah_acuan
         FROM standards s
         JOIN periods p ON p.id = s.period_id
         ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
        ORDER BY s.ranah, s.kelompok, s.code`
    ).all(...params)
  );
});

/**
 * Duplikasi standar dari periode lain ke periode tujuan (biasanya periode
 * aktif) — dipakai SPM saat pergantian tahun akademik supaya tidak perlu
 * menyusun ulang dari nol. Menyalin standar beserta seluruh pernyataan,
 * indikator (termasuk tautan ke butir acuan asalnya — "diadopsi apa
 * adanya" tetap terjaga, bukan ditulis ulang), dan penugasan unit
 * pengampu/pelaksana. Standar hasil duplikasi SELALU berstatus draft,
 * terlepas dari status standar sumbernya, supaya SPM meninjau ulang
 * sebelum menetapkannya untuk periode baru. Standar yang kodenya sudah
 * ada di periode tujuan dilewati (tidak ditimpa) supaya tidak menimpa
 * standar yang mungkin sudah disusun manual untuk periode itu.
 */
router.post('/duplikasi', requireRole('spm'), (req, res) => {
  const { source_period_id, target_period_id, standard_ids } = req.body;
  const sourcePid = Number(source_period_id);
  const targetPid = Number(target_period_id);
  if (!sourcePid || !targetPid)
    return res.status(400).json({ error: 'source_period_id dan target_period_id wajib diisi' });
  if (sourcePid === targetPid)
    return res.status(400).json({ error: 'Periode sumber dan tujuan tidak boleh sama' });

  const target = db.prepare(`SELECT id FROM periods WHERE id=?`).get(targetPid);
  if (!target) return res.status(404).json({ error: 'Periode tujuan tidak ditemukan' });

  let standarSumber = db.prepare(`SELECT * FROM standards WHERE period_id=?`).all(sourcePid);
  if (Array.isArray(standard_ids) && standard_ids.length) {
    const set = new Set(standard_ids.map(Number));
    standarSumber = standarSumber.filter((s) => set.has(s.id));
  }
  if (!standarSumber.length)
    return res.status(400).json({ error: 'Tidak ada standar terpilih dari periode sumber' });

  const kodeTerpakai = new Set(
    db.prepare(`SELECT code FROM standards WHERE period_id=?`).all(targetPid).map((r) => r.code)
  );

  const insStandar = db.prepare(
    `INSERT INTO standards
       (period_id, code, category, ranah, kelompok, sifat, title,
        rationale, scope, strategy, status, created_by)
     VALUES (?,?,?,?,?,?,?,?,?,?,'draft',?)`
  );
  const selPernyataan = db.prepare(
    `SELECT * FROM standard_statements WHERE standard_id=? ORDER BY sort_order, id`
  );
  const insPernyataan = db.prepare(
    `INSERT INTO standard_statements (standard_id, label, statement, rationale, sort_order)
     VALUES (?,?,?,?,?)`
  );
  const selIndikator = db.prepare(
    `SELECT * FROM standard_indicators WHERE statement_id=? ORDER BY sort_order, id`
  );
  const insIndikator = db.prepare(
    `INSERT INTO standard_indicators
       (standard_id, statement_id, code, indicator, target, target_skor, satuan,
        strategy, bukti_sahih, deadline, source_ref_item_id, sort_order)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`
  );
  const selAssignments = db.prepare(
    `SELECT unit_id, peran FROM indicator_assignments WHERE indicator_id=?`
  );
  const insAssignment = db.prepare(
    `INSERT OR IGNORE INTO indicator_assignments (indicator_id, unit_id, peran) VALUES (?,?,?)`
  );

  const hasil = { diduplikasi: [], dilewati: [] };

  db.transaction(() => {
    for (const std of standarSumber) {
      if (kodeTerpakai.has(std.code)) {
        hasil.dilewati.push(std.code);
        continue;
      }
      const newStdId = insStandar.run(
        targetPid, std.code, std.category, std.ranah, std.kelompok, std.sifat, std.title,
        std.rationale, std.scope, std.strategy, req.user.id
      ).lastInsertRowid;

      const pernyataanList = selPernyataan.all(std.id);
      for (const p of pernyataanList) {
        const newPid = insPernyataan
          .run(newStdId, p.label, p.statement, p.rationale, p.sort_order)
          .lastInsertRowid;

        const indikatorList = selIndikator.all(p.id);
        for (const ind of indikatorList) {
          const newIid = insIndikator
            .run(
              newStdId, newPid, ind.code, ind.indicator, ind.target, ind.target_skor,
              ind.satuan, ind.strategy, ind.bukti_sahih, ind.deadline,
              ind.source_ref_item_id, ind.sort_order
            )
            .lastInsertRowid;

          for (const a of selAssignments.all(ind.id)) {
            insAssignment.run(newIid, a.unit_id, a.peran);
          }
        }
      }
      hasil.diduplikasi.push(std.code);
      kodeTerpakai.add(std.code); // jaga-jaga bila standard_ids memuat kode ganda
    }
  })();

  logActivity(
    req.user.id, 'duplikasi_standar', 'standards', null,
    `${hasil.diduplikasi.length} standar diduplikasi dari periode ${sourcePid} ke periode ${targetPid}`
  );
  res.json(hasil);
});

/**
 * Ekspor matriks lengkap Penetapan Standar satu periode ke Excel: satu
 * baris per indikator, memuat standar - pernyataan - indikator sekaligus,
 * mengikuti format dokumen referensi
 * "Matriks_Standar_dan_Kode_Modul_Penetapan_Standar". Urutan baris
 * mengikuti urutan tampil di Modul 1 (ranah/kelompok/kode standar, lalu
 * sort_order pernyataan dan indikator — sudah mengikuti urutan acuan tetap,
 * lihat urutkanPernyataanDanIndikator di db.js).
 */
router.get('/export', (req, res) => {
  const periodId = Number(req.query.period_id);
  if (!periodId) return res.status(400).json({ error: 'period_id wajib diisi' });

  const period = db.prepare(`SELECT * FROM periods WHERE id=?`).get(periodId);
  if (!period) return res.status(404).json({ error: 'Periode tidak ditemukan' });

  const standarList = db
    .prepare(`SELECT * FROM standards WHERE period_id=? ORDER BY ranah, kelompok, code`)
    .all(periodId);

  const ambilPernyataan = db.prepare(
    `SELECT * FROM standard_statements WHERE standard_id=? ORDER BY sort_order, id`
  );
  const ambilIndikator = db.prepare(
    `SELECT si.*, r.code AS acuan_kode, r.name AS acuan_nama, b.code AS butir_kode
       FROM standard_indicators si
       LEFT JOIN ref_items b ON b.id = si.source_ref_item_id
       LEFT JOIN refs r ON r.id = b.ref_id
      WHERE si.statement_id=? ORDER BY si.sort_order, si.id`
  );
  const ambilUnit = db.prepare(
    `SELECT a.peran, un.name FROM indicator_assignments a
       JOIN units un ON un.id = a.unit_id
      WHERE a.indicator_id=? ORDER BY a.peran DESC, un.name`
  );

  const HEADER = [
    'Ranah', 'Kelompok', 'Kategori', 'Kode Standar', 'Judul Standar', 'Sifat',
    'Rasional Umum Standar', 'Ruang Lingkup', 'Strategi Pencapaian Standar',
    'Unit Pengampu', 'Unit Pelaksana', 'No. Pernyataan', 'Label Pernyataan',
    'Rumusan Pernyataan Standar', 'Rasional Pernyataan', 'No. Indikator',
    'Kode Indikator', 'Kode Acuan', 'Nama Acuan', 'Kode Butir Acuan', 'Indikator',
    'Target Pencapaian', 'Target Skor', 'Satuan', 'Strategi Pencapaian Indikator',
    'Bukti Sahih',
  ];

  let jumlahPernyataan = 0;
  let jumlahIndikator = 0;
  const barisData = [];

  for (const std of standarList) {
    const warna = WARNA_RANAH[std.ranah] || PALET_BARIS[5];
    const pernyataanList = ambilPernyataan.all(std.id);
    pernyataanList.forEach((p, pIdx) => {
      jumlahPernyataan++;
      const indikatorList = ambilIndikator.all(p.id);
      indikatorList.forEach((ind, iIdx) => {
        jumlahIndikator++;
        const unitRows = ambilUnit.all(ind.id);
        const pengampu = unitRows.find((u) => u.peran === 'pengampu')?.name || null;
        const pelaksana =
          unitRows.filter((u) => u.peran === 'pelaksana').map((u) => u.name).join('; ') || null;

        barisData.push({
          gaya: GAYA.data(warna),
          nilai: [
            std.ranah, std.kelompok, std.category, std.code, std.title, std.sifat,
            std.rationale, std.scope, std.strategy,
            pengampu, pelaksana,
            pIdx + 1, p.label, p.statement, p.rationale,
            iIdx + 1, ind.code, ind.acuan_kode, ind.acuan_nama, ind.butir_kode, ind.indicator,
            ind.target, ind.target_skor, ind.satuan, ind.strategy, ind.bukti_sahih,
          ],
        });
      });
    });
  }

  const sheet = {
    nama: 'Matriks Standar',
    kolom: [
      { lebar: 6 }, { lebar: 8 }, { lebar: 26 }, { lebar: 10 }, { lebar: 24 }, { lebar: 8 },
      { lebar: 34 }, { lebar: 34 }, { lebar: 34 }, { lebar: 16 }, { lebar: 28 }, { lebar: 8 },
      { lebar: 20 }, { lebar: 40 }, { lebar: 34 }, { lebar: 8 }, { lebar: 12 }, { lebar: 12 },
      { lebar: 24 }, { lebar: 10 }, { lebar: 34 }, { lebar: 34 }, { lebar: 16 }, { lebar: 10 },
      { lebar: 34 }, { lebar: 34 },
    ],
    beku: { kolom: 4, baris: 3 },
    baris: [
      {
        gaya: GAYA.judul, tinggi: 26,
        nilai: [`Matriks Standar Mutu Internal PKTJ — Modul Penetapan Standar (${period.name})`],
      },
      {
        gaya: GAYA.subjudul, tinggi: 18,
        nilai: [`${standarList.length} standar · ${jumlahPernyataan} pernyataan · ${jumlahIndikator} indikator — seluruh indikator diadopsi verbatim dari acuan mutu yang berlaku`],
      },
      { gaya: GAYA.header, tinggi: 32, nilai: HEADER },
      ...barisData,
    ],
  };

  const buf = buatWorkbookXlsx([sheet]);
  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  );
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="Matriks_Standar_dan_Kode_Modul_Penetapan_Standar.xlsx"`
  );
  res.send(buf);
});

/** Detail standar + indikator (beserta penanggung jawabnya) + pemetaan acuan */
router.get('/:id', (req, res) => {
  const std = db
    .prepare(
      `SELECT s.*, p.name AS period_name, u.name AS penetap_name
         FROM standards s
         JOIN periods p ON p.id = s.period_id
         LEFT JOIN users u ON u.id = s.ditetapkan_by
        WHERE s.id = ?`
    )
    .get(req.params.id);
  if (!std) return res.status(404).json({ error: 'Standar tidak ditemukan' });

  std.pernyataan = db
    .prepare(
      `SELECT * FROM standard_statements WHERE standard_id = ?
        ORDER BY sort_order, id`
    )
    .all(std.id);

  const indikator = db
    .prepare(
      `SELECT i.*, r.code AS acuan_kode, r.name AS acuan_nama, r.warna,
              b.code AS butir_kode, b.title AS butir_judul
         FROM standard_indicators i
         LEFT JOIN ref_items b ON b.id = i.source_ref_item_id
         LEFT JOIN refs r ON r.id = b.ref_id
        WHERE i.standard_id = ?
        ORDER BY i.sort_order, i.id`
    )
    .all(std.id);

  const penugasan = db
    .prepare(
      `SELECT a.indicator_id, a.unit_id, a.peran, un.code, un.name, un.type
         FROM indicator_assignments a
         JOIN units un ON un.id = a.unit_id
         JOIN standard_indicators i ON i.id = a.indicator_id
        WHERE i.standard_id = ?
        ORDER BY a.peran DESC, un.name`
    )
    .all(std.id);

  indikator.forEach((i) => {
    i.units = penugasan.filter((p) => p.indicator_id === i.id);
  });

  // Susun indikator ke bawah pernyataannya masing-masing
  std.pernyataan.forEach((p) => {
    p.indikator = indikator.filter((i) => i.statement_id === p.id);
  });
  // Indikator lawas tanpa statement_id (basis data belum sempat bermigrasi)
  std.indikator_tanpa_pernyataan = indikator.filter((i) => !i.statement_id);

  // Gabungan unit seluruh indikator, untuk tampilan ringkas
  const peta = new Map();
  penugasan.forEach((p) => {
    const ada = peta.get(p.unit_id);
    if (!ada || (p.peran === 'pengampu' && ada.peran !== 'pengampu'))
      peta.set(p.unit_id, { id: p.unit_id, code: p.code, name: p.name, type: p.type, peran: p.peran });
  });
  std.units = [...peta.values()].sort((a, b) => a.name.localeCompare(b.name));

  // Ringkasan acuan yang menjadi sumber standar ini: pemetaan longgar
  // (ref_map, tingkat standar/indikator) DAN adopsi langsung indikator
  // (source_ref_item_id) — keduanya ditampilkan sebagai satu daftar acuan.
  std.acuan = db
    .prepare(
      `SELECT 'map' AS jenis, m.id AS map_id, m.indicator_id, m.kekuatan, m.catatan,
              r.code AS acuan_kode, r.name AS acuan_nama, r.warna,
              b.id AS butir_id, b.code AS butir_kode, b.title AS butir_judul
         FROM ref_map m
         JOIN ref_items b ON b.id = m.ref_item_id
         JOIN refs r ON r.id = b.ref_id
        WHERE m.standard_id = ?
           OR m.indicator_id IN (SELECT id FROM standard_indicators WHERE standard_id = ?)
        UNION ALL
       SELECT 'adopsi' AS jenis, NULL AS map_id, i.id AS indicator_id, NULL, NULL,
              r.code AS acuan_kode, r.name AS acuan_nama, r.warna,
              b.id AS butir_id, b.code AS butir_kode, b.title AS butir_judul
         FROM standard_indicators i
         JOIN ref_items b ON b.id = i.source_ref_item_id
         JOIN refs r ON r.id = b.ref_id
        WHERE i.standard_id = ?
        ORDER BY acuan_kode, butir_kode`
    )
    .all(std.id, std.id, std.id);

  res.json(std);
});

/**
 * Simpan indikator di bawah SATU pernyataan standar, beserta penanggung
 * jawabnya. Bila sebuah indikator diadopsi dari acuan (source_ref_item_id
 * terisi), teks/target/satuan/strategi TIDAK diambil dari input klien —
 * melainkan ditarik apa adanya dari ref_items di sisi server, supaya tidak
 * ada penulisan ulang atau penggabungan isi lintas acuan.
 */
function simpanIndikator(sid, stid, kodeStandar, urutanPernyataan, daftar) {
  // Disiapkan di dalam fungsi (bukan pada scope modul) supaya baru dieksekusi
  // saat sebuah request ditangani — setelah initSchema()/migrasi kolom baru
  // (mis. ref_items.target) selesai berjalan di index.js, bukan pada saat
  // modul ini diimpor.
  const ambilRefItem = db.prepare(
    `SELECT title, uraian, target, target_skor, satuan, strategy FROM ref_items WHERE id=?`
  );
  const bersih = kodeStandar.replace('+', '');

  const existing = db
    .prepare(`SELECT id FROM standard_indicators WHERE statement_id=?`)
    .all(stid).map((r) => r.id);
  const keep = daftar.filter((i) => i.id).map((i) => Number(i.id));
  existing
    .filter((eid) => !keep.includes(eid))
    .forEach((eid) => db.prepare(`DELETE FROM standard_indicators WHERE id=?`).run(eid));

  const upd = db.prepare(
    `UPDATE standard_indicators SET code=?, indicator=?, target=?, target_skor=?,
            satuan=?, strategy=?, bukti_sahih=?, deadline=?, source_ref_item_id=?,
            sort_order=? WHERE id=?`
  );
  const ins = db.prepare(
    `INSERT INTO standard_indicators
       (standard_id, statement_id, code, indicator, target, target_skor, satuan,
        strategy, bukti_sahih, deadline, source_ref_item_id, sort_order)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`
  );
  const hapusAsg = db.prepare(`DELETE FROM indicator_assignments WHERE indicator_id=?`);
  const insAsg = db.prepare(
    `INSERT OR IGNORE INTO indicator_assignments (indicator_id, unit_id, peran)
     VALUES (?,?,?)`
  );

  daftar.forEach((it, n) => {
    let { indicator, target, target_skor, satuan, strategy } = it;
    const { bukti_sahih } = it; // catatan bukti sahih: selalu milik institusi sendiri,
                                 // tidak ditarik dari acuan (acuan tidak memiliki kolom ini)
    const sumberId = it.source_ref_item_id || null;

    if (sumberId) {
      const src = ambilRefItem.get(sumberId);
      if (!src)
        throw new Error(`Butir acuan sumber (id ${sumberId}) tidak ditemukan`);
      // Ditarik apa adanya — tidak digabung/ditulis ulang.
      indicator = (src.uraian && src.uraian.trim()) || src.title;
      target = src.target;
      target_skor = src.target_skor;
      satuan = src.satuan;
      strategy = src.strategy;
    }
    if (!indicator || !String(indicator).trim())
      throw new Error('Setiap indikator wajib memiliki teks atau sumber acuan yang valid');

    const kode = it.code || `${bersih}.${urutanPernyataan + 1}.${n + 1}`;
    let iid;
    if (it.id) {
      upd.run(kode, indicator, target ?? null, target_skor ?? null, satuan ?? null,
              strategy ?? null, bukti_sahih ?? null, it.deadline ?? null, sumberId, n, it.id);
      iid = Number(it.id);
    } else {
      iid = ins.run(sid, stid, kode, indicator, target ?? null, target_skor ?? null,
                    satuan ?? null, strategy ?? null, bukti_sahih ?? null,
                    it.deadline ?? null, sumberId, n)
                .lastInsertRowid;
    }

    // Penanggung jawab indikator: satu pengampu, banyak pelaksana
    hapusAsg.run(iid);
    if (it.pengampu_unit_id) insAsg.run(iid, it.pengampu_unit_id, 'pengampu');
    (it.pelaksana_unit_ids || []).forEach((u) => {
      if (Number(u) !== Number(it.pengampu_unit_id)) insAsg.run(iid, u, 'pelaksana');
    });
  });
}

/**
 * Simpan seluruh pernyataan standar (dan indikator di bawahnya). Pernyataan
 * yang tidak lagi ada di `daftar` akan dihapus — indikatornya ikut terhapus
 * lewat ON DELETE CASCADE.
 */
function simpanPernyataan(sid, kodeStandar, daftar) {
  const existing = db
    .prepare(`SELECT id FROM standard_statements WHERE standard_id=?`)
    .all(sid).map((r) => r.id);
  const keep = daftar.filter((p) => p.id).map((p) => Number(p.id));
  existing
    .filter((eid) => !keep.includes(eid))
    .forEach((eid) => db.prepare(`DELETE FROM standard_statements WHERE id=?`).run(eid));

  const upd = db.prepare(
    `UPDATE standard_statements SET label=?, statement=?, rationale=?, sort_order=? WHERE id=?`
  );
  const ins = db.prepare(
    `INSERT INTO standard_statements (standard_id, label, statement, rationale, sort_order)
     VALUES (?,?,?,?,?)`
  );

  daftar.forEach((p, pn) => {
    if (!p.statement || !p.statement.trim())
      throw new Error(`Pernyataan standar ke-${pn + 1} tidak boleh kosong`);

    let stid;
    if (p.id) {
      upd.run(p.label ?? null, p.statement, p.rationale ?? null, pn, p.id);
      stid = Number(p.id);
    } else {
      stid = ins.run(sid, p.label ?? null, p.statement, p.rationale ?? null, pn)
        .lastInsertRowid;
    }
    simpanIndikator(sid, stid, kodeStandar, pn, p.indikator || []);
  });
}

/**
 * Terima payload lama (`indikator` datar) maupun baru (`pernyataan`
 * bertingkat) dan kembalikan bentuk `pernyataan` yang seragam. Payload lama
 * dibungkus sebagai satu pernyataan implisit, memakai teks `statement` bila
 * ada, agar data yang belum dimigrasi ke UI baru tetap tersimpan benar.
 */
function normalisasiPernyataan(body) {
  if (Array.isArray(body.pernyataan)) return body.pernyataan;
  if (Array.isArray(body.indikator) && body.indikator.length)
    return [{ statement: body.statement || body.title, indikator: body.indikator }];
  return [];
}

/** Buat standar baru */
router.post('/', requireRole('spm'), (req, res) => {
  const {
    period_id, code, category, ranah, kelompok, sifat, title,
    rationale, scope, strategy,
  } = req.body;

  if (!period_id || !code || !title)
    return res.status(400).json({ error: 'period_id, code, dan title wajib diisi' });

  const pernyataan = normalisasiPernyataan(req.body);

  try {
    const id = db.transaction(() => {
      const sid = db
        .prepare(
          `INSERT INTO standards
             (period_id, code, category, ranah, kelompok, sifat, title,
              rationale, scope, strategy, created_by)
           VALUES (?,?,?,?,?,?,?,?,?,?,?)`
        )
        .run(
          period_id, code, category || ranah || '-', ranah ?? null,
          kelompok || null, sifat ?? 'melampaui', title,
          rationale ?? null, scope ?? null, strategy ?? null, req.user.id
        ).lastInsertRowid;

      simpanPernyataan(sid, code, pernyataan);
      return sid;
    })();

    logActivity(req.user.id, 'tetapkan_standar', 'standards', id, code);
    res.status(201).json({ id });
  } catch (e) {
    res.status(400).json({ error: `Gagal menyimpan: ${e.message}` });
  }
});

/** Ubah standar */
router.put('/:id', requireRole('spm'), (req, res) => {
  const id = Number(req.params.id);
  const std = db.prepare(`SELECT * FROM standards WHERE id = ?`).get(id);
  if (!std) return res.status(404).json({ error: 'Standar tidak ditemukan' });

  const {
    code, category, ranah, kelompok, sifat, title, rationale, scope, strategy,
  } = req.body;
  const adaPernyataan =
    Array.isArray(req.body.pernyataan) || Array.isArray(req.body.indikator);
  const pernyataan = normalisasiPernyataan(req.body);

  // Nomenklatur standar wajib SN Dikti dikunci
  if (std.sifat === 'wajib' && title && title !== std.title)
    return res.status(400).json({
      error:
        'Standar wajib SN Dikti tidak boleh diganti namanya. Ubah sifatnya menjadi "melampaui" bila memang bukan standar wajib.',
    });

  try {
    db.transaction(() => {
      db.prepare(
        `UPDATE standards SET code=?, category=?, ranah=?, kelompok=?, sifat=?,
                title=?, rationale=?, scope=?, strategy=? WHERE id=?`
      ).run(
        code ?? std.code, category ?? std.category, ranah ?? std.ranah,
        kelompok === undefined ? std.kelompok : (kelompok || null),
        sifat ?? std.sifat, title ?? std.title,
        rationale ?? std.rationale, scope ?? std.scope,
        strategy ?? std.strategy, id
      );
      if (adaPernyataan) simpanPernyataan(id, code ?? std.code, pernyataan);
    })();

    logActivity(req.user.id, 'ubah_standar', 'standards', id);
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: `Gagal menyimpan: ${e.message}` });
  }
});

/** Tambah/ubah/hapus satu pernyataan standar tanpa mengirim ulang seluruh standar */
router.put('/:id/pernyataan', requireRole('spm'), (req, res) => {
  const id = Number(req.params.id);
  const std = db.prepare(`SELECT id, code FROM standards WHERE id=?`).get(id);
  if (!std) return res.status(404).json({ error: 'Standar tidak ditemukan' });
  if (!Array.isArray(req.body.pernyataan))
    return res.status(400).json({ error: 'pernyataan (array) wajib diisi' });

  try {
    db.transaction(() => simpanPernyataan(id, std.code, req.body.pernyataan))();
    logActivity(req.user.id, 'ubah_pernyataan_standar', 'standards', id);
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: `Gagal menyimpan: ${e.message}` });
  }
});

/** Tetapkan (sahkan) standar */
router.post('/:id/tetapkan', requireRole('spm'), (req, res) => {
  const id = Number(req.params.id);
  const jml = db
    .prepare(`SELECT COUNT(*) c FROM standard_indicators WHERE standard_id=?`)
    .get(id).c;
  if (!jml)
    return res
      .status(400)
      .json({ error: 'Standar harus memiliki minimal satu indikator' });

  const tanpaPengampu = db
    .prepare(
      `SELECT COUNT(*) c FROM standard_indicators i
        WHERE i.standard_id=?
          AND NOT EXISTS (SELECT 1 FROM indicator_assignments a
                           WHERE a.indicator_id=i.id AND a.peran='pengampu')`
    )
    .get(id).c;
  if (tanpaPengampu)
    return res.status(400).json({
      error: `${tanpaPengampu} indikator belum memiliki unit pengampu. Tetapkan penanggung jawab pada setiap indikator terlebih dahulu.`,
    });

  db.prepare(
    `UPDATE standards SET status='ditetapkan',
            ditetapkan_at=datetime('now','localtime'), ditetapkan_by=? WHERE id=?`
  ).run(req.user.id, id);
  logActivity(req.user.id, 'sahkan_standar', 'standards', id);
  res.json({ ok: true });
});

router.post('/:id/batal-tetapkan', requireRole('spm'), (req, res) => {
  db.prepare(
    `UPDATE standards SET status='draft', ditetapkan_at=NULL, ditetapkan_by=NULL
      WHERE id=?`
  ).run(req.params.id);
  res.json({ ok: true });
});

router.delete('/:id', requireRole('spm'), (req, res) => {
  const std = db.prepare(`SELECT sifat, code FROM standards WHERE id=?`).get(req.params.id);
  if (std?.sifat === 'wajib')
    return res.status(400).json({
      error: `${std.code} adalah standar wajib SN Dikti dan tidak boleh dihapus.`,
    });
  db.prepare(`DELETE FROM standards WHERE id=?`).run(req.params.id);
  logActivity(req.user.id, 'hapus_standar', 'standards', req.params.id);
  res.json({ ok: true });
});

/** Beban indikator per unit — untuk menakar kewajaran distribusi */
router.get('/meta/beban-unit', (req, res) => {
  const periodId = Number(req.query.period_id);
  if (!periodId) return res.status(400).json({ error: 'period_id wajib diisi' });
  res.json(
    db.prepare(
      `SELECT un.id, un.code, un.name, un.type,
              COUNT(DISTINCT CASE WHEN a.peran='pengampu' THEN i.id END) AS diampu,
              COUNT(DISTINCT CASE WHEN a.peran='pelaksana' THEN i.id END) AS dilaksanakan,
              COUNT(DISTINCT i.standard_id) AS jumlah_standar
         FROM units un
         LEFT JOIN indicator_assignments a ON a.unit_id = un.id
         LEFT JOIN standard_indicators i ON i.id = a.indicator_id
         LEFT JOIN standards s ON s.id = i.standard_id AND s.period_id = ?
        WHERE un.is_active = 1
        GROUP BY un.id ORDER BY diampu DESC, un.name`
    ).all(periodId)
  );
});

router.get('/meta/kategori', (_req, res) => {
  res.json(
    db.prepare(
      `SELECT DISTINCT category, ranah, kelompok FROM standards
        ORDER BY ranah, kelompok`
    ).all()
  );
});

export default router;
