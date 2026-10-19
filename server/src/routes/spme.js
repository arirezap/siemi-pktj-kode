import { Router } from 'express';
import { db, logActivity } from '../db.js';
import { requireAuth, requireRole } from '../auth.js';

const router = Router();
router.use(requireAuth);

/* =====================================================================
   MODUL : SISTEM PENJAMINAN MUTU EKSTERNAL (SPME)
   Menilai skor penerapan acuan eksternal dengan pembobotan resmi tiap
   acuan (ref_items.bobot). Nilai tiap butir ditarik otomatis dari SKOR
   (bukan persen) hasil penilaian auditor pada Modul 3
   (audit_assessments.skor), sesuai skala resmi tiap acuan (refs.skor_min
   / skor_maks / skor_step — mis. 0-1 untuk BAN-PT/ISO 21001, 0-4 untuk
   LAM Teknik, 1-5 untuk GreenMetric, 0-1 kelipatan 0,25 untuk Zona
   Integritas), dan dapat dikoreksi manual oleh SPM dalam skala yang sama.

   Skor tertimbang = jumlah (bobot butir x skor efektif) — angka mentah
   sesuai skala acuan (mis. LAM Teknik bisa sampai ~400 bila bobot berjumlah
   ~100 dan skor maksimal 4). Persen tertimbang menormalkan angka itu
   memakai skor maksimal acuan supaya tetap bisa dibandingkan lintas
   instrumen meski skalanya berbeda-beda:
     persen tertimbang = skor tertimbang / (bobot maksimal x skor maksimal) x 100

   Empat instrumen tingkat institusi (Akreditasi PT, ISO 21001, Zona
   Integritas, GreenMetric) memakai acuan tetap (kode acuan tidak
   berubah). Instrumen akreditasi program studi BERBEDA: dibangkitkan
   otomatis dari data unit (units.type='prodi') dan jenjangnya
   (units.jenjang), dicocokkan ke acuan LAM yang ditandai jenjang yang
   sama (refs.jenjang). Jadi menambah prodi baru — termasuk dengan
   jenjang yang belum pernah ada (mis. Magister Terapan) — tidak perlu
   mengubah kode: SPM cukup menambahkan unit prodi tersebut di Data
   Master dan (bila jenjangnya baru) membuat acuan LAM yang sesuai di
   menu Acuan Mutu, ditandai jenjang yang sama persis, lengkap dengan
   skala skornya.
   ===================================================================== */

/** Empat instrumen tingkat institusi, acuannya tetap (bukan per-prodi). */
const INSTRUMEN_TETAP = {
  akreditasi_pt: { label: 'Akreditasi Perguruan Tinggi', kelompok: null, ref: 'BANPT', unitKode: null },
  iso21001:      { label: 'ISO 21001', kelompok: null, ref: 'ISO21001', unitKode: null },
  zi:            { label: 'Zona Integritas (WBK-WBBM)', kelompok: null, ref: 'ZI', unitKode: null },
  greenmetric:   { label: 'UI GreenMetric', kelompok: null, ref: 'GREENMETRIC', unitKode: null },
};

/** Kunci instrumen akreditasi prodi: stabil terhadap id unit, bukan kode/nama
 *  (supaya tidak berubah kalau kode/nama unit diedit belakangan). */
function kunciProdi(unitId) {
  return `akreditasi_prodi_u${unitId}`;
}

/** Apakah suatu acuan punya bobot resmi (>=1 butir daun berbobot). Dipakai
 *  untuk menentukan otomatis apakah skor tertimbang dihitung atau tidak,
 *  tanpa perlu ditandai manual per instrumen. */
function adaBobot(refId) {
  if (!refId) return false;
  return (
    db
      .prepare(`SELECT COUNT(*) c FROM ref_items WHERE ref_id=? AND wajib_petakan=1 AND bobot IS NOT NULL`)
      .get(refId).c > 0
  );
}

/** Skala skor resmi suatu acuan. Bila belum ditandai (acuan lama/khusus
 *  tanpa skor_min/skor_maks), dianggap 0-100 (skala persen) supaya
 *  perilaku lama tetap jalan tanpa mengubah data yang sudah ada. */
function skalaAcuan(acuan) {
  return {
    min: acuan?.skor_min ?? 0,
    maks: acuan?.skor_maks ?? 100,
    step: acuan?.skor_step ?? null,
  };
}

/**
 * Bangun daftar lengkap instrumen SPME saat ini: empat instrumen tetap
 * (acuannya dicari lewat kode) plus satu instrumen akreditasi per unit
 * prodi aktif (acuannya dicari lewat kecocokan jenjang). Dipanggil ulang
 * di setiap request supaya selalu mengikuti data unit/acuan terkini.
 */
function semuaInstrumen() {
  const hasil = {};

  const infoTetap = (kunci, def) => {
    const acuan = db.prepare(`SELECT * FROM refs WHERE code=?`).get(def.ref);
    const skala = skalaAcuan(acuan);
    hasil[kunci] = {
      label: def.label, kelompok: def.kelompok, unitKode: def.unitKode,
      acuanId: acuan?.id ?? null, acuanRefCode: def.ref,
      unitId: null, jenjang: null,
      berbobot: adaBobot(acuan?.id),
      skorMin: skala.min, skorMaks: skala.maks, skorStep: skala.step,
      keterangan: acuan?.name ?? `Acuan "${def.ref}" belum tersedia di Acuan Mutu`,
    };
  };
  infoTetap('akreditasi_pt', INSTRUMEN_TETAP.akreditasi_pt);

  const prodi = db
    .prepare(`SELECT id, code, name, jenjang FROM units WHERE type='prodi' AND is_active=1 ORDER BY name`)
    .all();
  for (const p of prodi) {
    const kunci = kunciProdi(p.id);
    const singkatan = p.code.replace(/^PS-?/i, '') || p.code;
    if (!p.jenjang) {
      hasil[kunci] = {
        label: `Akreditasi Prodi ${singkatan}`, kelompok: 'Akreditasi Program Studi',
        unitKode: p.code, acuanId: null, acuanRefCode: null,
        unitId: p.id, jenjang: null, berbobot: false,
        skorMin: 0, skorMaks: 100, skorStep: null,
        keterangan: `Jenjang prodi ini belum diisi — lengkapi di Data Master agar acuan LAM yang sesuai dapat dicocokkan.`,
      };
      continue;
    }
    const acuan = db
      .prepare(`SELECT * FROM refs WHERE jenjang=? COLLATE NOCASE AND is_active=1 ORDER BY sort_order LIMIT 1`)
      .get(p.jenjang);
    const skala = skalaAcuan(acuan);
    hasil[kunci] = {
      label: `Akreditasi Prodi ${singkatan}`, kelompok: 'Akreditasi Program Studi',
      unitKode: p.code, acuanId: acuan?.id ?? null, acuanRefCode: acuan?.code ?? null,
      unitId: p.id, jenjang: p.jenjang,
      berbobot: adaBobot(acuan?.id),
      skorMin: skala.min, skorMaks: skala.maks, skorStep: skala.step,
      keterangan: acuan
        ? acuan.name
        : `Acuan LAM untuk jenjang "${p.jenjang}" belum tersedia — tambahkan di menu Acuan Mutu dan tandai jenjangnya "${p.jenjang}".`,
    };
  }

  infoTetap('iso21001', INSTRUMEN_TETAP.iso21001);
  infoTetap('zi', INSTRUMEN_TETAP.zi);
  infoTetap('greenmetric', INSTRUMEN_TETAP.greenmetric);

  return hasil;
}

function ambilInstrumen(res, kunci) {
  const info = semuaInstrumen()[kunci];
  if (!info) {
    res.status(404).json({ error: `Instrumen SPME "${kunci}" tidak dikenal` });
    return null;
  }
  return info;
}

/**
 * Susun baris ref_items datar menjadi pohon pre-order (sama seperti
 * modul Acuan Mutu).
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
  if (hasil.length < baris.length) {
    const sudah = new Set(hasil.map((b) => b.id));
    for (const b of baris) if (!sudah.has(b.id)) hasil.push(b);
  }
  return hasil;
}

/**
 * Nilai otomatis satu butir acuan: rata-rata SKOR (bukan persen) dari
 * seluruh audit_assessments pada periode aktif atas indikator yang
 * diadopsi dari butir ini (source_ref_item_id) ATAU dipetakan longgar ke
 * butir ini (ref_map). Bila unitId diisi, dibatasi hanya audit unit
 * tersebut (instrumen tingkat program studi).
 */
function nilaiOtomatis(refItemId, periodId, unitId) {
  const params = [periodId, refItemId, refItemId];
  let filterUnit = '';
  if (unitId) { filterUnit = ' AND au.unit_id = ?'; params.push(unitId); }
  return db
    .prepare(
      `SELECT ROUND(AVG(a.skor), 2) AS skor, COUNT(*) AS jumlah
         FROM standard_indicators si
         JOIN audit_assessments a ON a.indicator_id = si.id AND a.skor IS NOT NULL
         JOIN audits au ON au.id = a.audit_id AND au.period_id = ?
        WHERE (si.source_ref_item_id = ?
               OR EXISTS (SELECT 1 FROM ref_map m
                           WHERE m.ref_item_id = ? AND m.indicator_id = si.id))
          ${filterUnit}`
    )
    .get(...params);
}

/**
 * Nilai CAPAIAN otomatis satu butir acuan: rata-rata "Capaian terhadap
 * target" (audit_assessments.capaian_persen, diisi auditor pada Modul 3
 * sesuai SATUAN target indikator — %, bulan, sks, dst., BUKAN skor 1-4).
 * Dipakai khusus untuk indikator syarat perlu akreditasi unggul LAM Teknik
 * yang bersifat kuantitatif (lihat SYARAT_PERLU_LAM/hitungSyaratPerluLAM) —
 * sama sekali terpisah dari nilaiOtomatis() (rata-rata SKOR) di atas.
 */
function nilaiCapaianOtomatis(refItemId, periodId, unitId) {
  const params = [periodId, refItemId, refItemId];
  let filterUnit = '';
  if (unitId) { filterUnit = ' AND au.unit_id = ?'; params.push(unitId); }
  return db
    .prepare(
      `SELECT ROUND(AVG(a.capaian_persen), 2) AS capaian, COUNT(*) AS jumlah
         FROM standard_indicators si
         JOIN audit_assessments a ON a.indicator_id = si.id AND a.capaian_persen IS NOT NULL
         JOIN audits au ON au.id = a.audit_id AND au.period_id = ?
        WHERE (si.source_ref_item_id = ?
               OR EXISTS (SELECT 1 FROM ref_map m
                           WHERE m.ref_item_id = ? AND m.indicator_id = si.id))
          ${filterUnit}`
    )
    .get(...params);
}

/**
 * Kelompokkan butir daun (leaf) menjadi kategori payung untuk sumbu grafik
 * radar. Level payung dipilih otomatis: level teratas yang memiliki >= 4
 * node (cukup untuk radar yang enak dibaca) — menyesuaikan struktur pohon
 * tiap acuan tanpa perlu dikonfigurasi manual per instrumen.
 *
 * Nilai tiap sumbu KATEGORI adalah **skor mentah** (rata-rata skor efektif
 * butir di bawahnya pada skala asli acuan, mis. 1–4 untuk LAM Teknik,
 * 1–5 untuk GreenMetric) — BUKAN persen tertimbang berbobot. Kekecualian:
 * acuan berskala biner (skor_maks <= 1, mis. BAN-PT/ISO 21001) ditampilkan
 * sebagai persentase indikator terpenuhi (0–100%) karena itulah cara paling
 * wajar membaca skala 0/1. Nilai tiap sumbu BUTIR (drill-down) selalu skor
 * mentah pada skala asli acuan, tidak pernah dinormalisasi ke persen.
 *
 * PENTING: `baris` harus sudah diurutkan pre-order lewat `urutkanPohon()`
 * (bukan hasil mentah query, yang hanya terurut per level dan sort_order
 * LOKAL tiap induk — dua sub-pohon berbeda bisa punya sort_order yang
 * sama-sama mulai dari 1, mis. ZI-A.1 dan ZI-B.1). Dengan input pre-order,
 * kategori maupun butir di dalamnya otomatis mengikuti urutan dokumen asli
 * acuan (mis. LT-1 lebih dulu dari LT-5) karena kategori/butir pertama yang
 * ditemui saat iterasi pasti yang pertama secara hierarki. Tiap kategori
 * juga membawa daftar butirnya sendiri untuk grafik radar rinci (drill-down).
 *
 * Opsi `skorTertimbang` (akreditasi prodi/LAM Teknik dan UI GreenMetric):
 * nilai kategori TIDAK memakai rata-rata skor polos, melainkan % capaian
 * tertimbang (Σ bobot×skor ÷ Σ bobot×skorMaks) — sama persis dengan yang
 * ditampilkan pada sheet Rekap Nilai. Secara bawaan angka itu dikonversi
 * ke skala asli acuan (skorMin..skorMaks, mis. 1-4 LAM Teknik) supaya tetap
 * sepadan dengan sumbu grafik skor — kecuali opsi `keluaranPersen` aktif
 * (khusus UI GreenMetric), yang membiarkan nilainya apa adanya sebagai
 * persentase 0-100% pada radar utama.
 */
function hitungKelompokRadar(baris, skorMin, skorMaks, opsi = {}) {
  const { skorTertimbang = false, keluaranPersen = false } = opsi;
  const biner = skorMaks <= 1;
  const jumlahPerLevel = {};
  for (const b of baris) {
    if (b.wajib_petakan === 1) continue;
    jumlahPerLevel[b.level] = (jumlahPerLevel[b.level] || 0) + 1;
  }
  const levelTersedia = Object.keys(jumlahPerLevel).map(Number).sort((a, z) => a - z);
  if (levelTersedia.length === 0) return [];
  const level = levelTersedia.find((lv) => jumlahPerLevel[lv] >= 4) ?? levelTersedia[0];

  const byId = new Map(baris.map((b) => [b.id, b]));
  function leluhurPadaLevel(b) {
    let cur = b;
    while (cur && cur.level > level) cur = byId.get(cur.parent_id);
    return cur;
  }

  const kelompok = new Map();
  for (const b of baris) {
    if (b.wajib_petakan !== 1) continue;
    const leluhur = leluhurPadaLevel(b);
    if (!leluhur) continue;
    let g = kelompok.get(leluhur.id);
    if (!g) {
      g = {
        kode: leluhur.code, label: leluhur.title, total_butir: 0, butir_dinilai: 0,
        skorJumlah: 0, skorN: 0, bobotJumlah: 0, skorTertimbangJumlah: 0, butir: [],
      };
      kelompok.set(leluhur.id, g);
    }
    g.total_butir++;
    const dinilai = b.skor_efektif != null;
    if (dinilai) {
      g.butir_dinilai++;
      g.skorJumlah += b.skor_efektif;
      g.skorN++;
    }
    if (b.bobot != null) {
      g.bobotJumlah += b.bobot;
      if (dinilai) g.skorTertimbangJumlah += b.bobot * b.skor_efektif;
    }
    g.butir.push({
      kode: b.code, label: b.title, bobot: b.bobot ?? null,
      skor: b.skor_efektif ?? null, dinilai, nilai: b.skor_efektif ?? null,
    });
  }

  return [...kelompok.values()].map((g) => {
    const rataSkor = g.skorN ? Math.round((g.skorJumlah / g.skorN) * 100) / 100 : null;
    // Persentase terpenuhi (acuan biner) dihitung terhadap SELURUH butir
    // kategori (butir yang belum dinilai dianggap 0), supaya konsisten
    // persis dengan angka yang ditampilkan pada sheet Rekap Nilai.
    const persenTerpenuhi = g.total_butir > 0
      ? Math.round((g.skorJumlah / (skorMaks * g.total_butir)) * 1000) / 10
      : null;
    let nilai;
    if (biner) {
      nilai = persenTerpenuhi;
    } else if (skorTertimbang) {
      // Pembulatan bertahap disamakan persis dengan RekapNilaiSheet (bobot →
      // skor tertimbang → skor maksimal → persentase) supaya angka radar
      // selalu identik dengan "% Capaian" pada sheet Rekap Nilai, tanpa
      // selisih pembulatan.
      const bobotBulat = Math.round(g.bobotJumlah * 100) / 100;
      const skorTertimbangBulat = Math.round(g.skorTertimbangJumlah * 100) / 100;
      const skorMaksimalKategori = Math.round(bobotBulat * skorMaks * 100) / 100;
      const persenKategori = skorMaksimalKategori > 0
        ? Math.round((skorTertimbangBulat / skorMaksimalKategori) * 1000) / 10
        : null;
      nilai = persenKategori == null
        ? null
        : keluaranPersen
        ? persenKategori
        : Math.round((skorMin + (persenKategori / 100) * (skorMaks - skorMin)) * 100) / 100;
    } else {
      nilai = rataSkor;
    }
    return {
      kode: g.kode,
      label: g.label,
      total_butir: g.total_butir,
      butir_dinilai: g.butir_dinilai,
      rata_skor: rataSkor,
      nilai,
      butir: g.butir,
    };
  });
}

/**
 * Rekap Nilai resmi Zona Integritas, mengikuti format Lembar Kerja Evaluasi
 * (LKE) Reformasi Birokrasi: Area Perubahan | Bobot | Pemenuhan | Reform |
 * Nilai | % | (kelengkapan penilaian). Hasil fungsi ini juga dipakai untuk
 * membangun kelompok Grafik Radar ZI (lihat `kelompokRadarDariRekapZI`)
 * supaya kedua tab selalu konsisten. Nilai dihitung SIGMA (bobot butir x skor butir) per cabang, karena bobot resmi
 * tiap butir ZI berbeda-beda (mis. 4, 3.5, 5, 7.5) sehingga rata-rata polos
 * tidak mencerminkan bobotnya. Skor butir ZI berskala 0-1 (kelipatan 0,25)
 * sehingga (bobot x skor) langsung bersatuan "poin" yang sepadan dengan
 * bobot area resminya (mis. total Pengungkit = 60, Hasil = 40).
 *
 * CATATAN: kolom "Pemenuhan Nilai Min" pada Lembar Kerja Evaluasi resmi
 * mengacu pada ambang nilai minimum per area sesuai Peraturan MenPAN-RB,
 * yang datanya belum ada di skema aplikasi ini. Kolom sejenis di sini
 * ("kelengkapan") karena itu menunjukkan status PENILAIAN (sudah/belum
 * seluruh butir dinilai), BUKAN status kelulusan/ambang resmi — perlu
 * dikonfirmasi/dilengkapi bila SPM memiliki data ambang resminya.
 */
function hitungRekapZI(baris) {
  const byId = new Map(baris.map((b) => [b.id, b]));
  const byCode = new Map(baris.map((b) => [b.code, b]));

  function daunDiBawah(nodeId) {
    return baris.filter((b) => {
      if (b.wajib_petakan !== 1) return false;
      let cur = b;
      while (cur && cur.id !== nodeId) cur = byId.get(cur.parent_id);
      return !!cur;
    });
  }

  function rekapCabang(nodeId) {
    const daun = daunDiBawah(nodeId);
    let bobot = 0, nilai = 0, dinilai = 0;
    const butir = daun.map((b) => {
      const b_ = b.bobot ?? 0;
      bobot += b_;
      const ada = b.skor_efektif != null;
      if (ada) { dinilai++; nilai += b_ * b.skor_efektif; }
      return {
        kode: b.code, label: b.title, bobot: b.bobot ?? null,
        skor: b.skor_efektif ?? null, dinilai: ada,
        nilai: ada ? Math.round(b_ * b.skor_efektif * 100) / 100 : null,
      };
    });
    return {
      bobot: Math.round(bobot * 100) / 100,
      nilai: Math.round(nilai * 100) / 100,
      total: daun.length, dinilai, butir,
    };
  }

  const a1 = byCode.get('ZI-A.1'); // PEMENUHAN
  const a2 = byCode.get('ZI-A.2'); // REFORM
  const anakA1 = a1 ? baris.filter((b) => b.parent_id === a1.id) : [];
  const anakA2 = a2 ? baris.filter((b) => b.parent_id === a2.id) : [];

  const aspek = [];
  for (const aspek1 of anakA1) {
    const aspek2 = anakA2.find(
      (b) => b.title.trim().toUpperCase() === aspek1.title.trim().toUpperCase()
    );
    const rp = rekapCabang(aspek1.id);
    const rr = aspek2 ? rekapCabang(aspek2.id) : { bobot: 0, nilai: 0, total: 0, dinilai: 0, butir: [] };
    const bobot = Math.round((rp.bobot + rr.bobot) * 100) / 100;
    const nilai = Math.round((rp.nilai + rr.nilai) * 100) / 100;
    aspek.push({
      kode_pemenuhan: aspek1.code,
      kode_reform: aspek2 ? aspek2.code : null,
      label: aspek1.title,
      bobot,
      pemenuhan: rp.nilai, pemenuhan_maks: rp.bobot,
      reform: rr.nilai, reform_maks: rr.bobot,
      nilai,
      persen: bobot > 0 ? Math.round((nilai / bobot) * 1000) / 10 : null,
      lengkap: rp.dinilai === rp.total && rr.dinilai === rr.total && rp.total + rr.total > 0,
      total_butir: rp.total + rr.total,
      butir_dinilai: rp.dinilai + rr.dinilai,
      butir: [
        ...rp.butir.map((x) => ({ ...x, cabang: 'Pemenuhan' })),
        ...rr.butir.map((x) => ({ ...x, cabang: 'Reform' })),
      ],
    });
  }
  const bobotPengungkit = Math.round(aspek.reduce((a, x) => a + x.bobot, 0) * 100) / 100;
  const nilaiPengungkit = Math.round(aspek.reduce((a, x) => a + x.nilai, 0) * 100) / 100;
  const pengungkit = {
    bobot: bobotPengungkit,
    nilai: nilaiPengungkit,
    persen: bobotPengungkit > 0 ? Math.round((nilaiPengungkit / bobotPengungkit) * 1000) / 10 : null,
    lengkap: aspek.every((x) => x.lengkap),
    aspek,
  };

  const areaHasil = [
    ['ZI-B.1', 'I', 'BIROKRASI YANG BERSIH DAN AKUNTABEL'],
    ['ZI-B.2', 'II', 'PELAYANAN PUBLIK YANG PRIMA'],
  ];
  const area = [];
  for (const [kode, romawi, labelResmi] of areaHasil) {
    const node = byCode.get(kode);
    if (!node) continue;
    const anak = baris.filter((b) => b.parent_id === node.id && b.wajib_petakan === 1);
    let bobot = 0, nilai = 0, dinilai = 0;
    const item = anak.map((b) => {
      const b_ = b.bobot ?? 0;
      bobot += b_;
      const ada = b.skor_efektif != null;
      if (ada) { dinilai++; nilai += b_ * b.skor_efektif; }
      return {
        kode: b.code, label: b.title, bobot: b.bobot ?? null,
        skor: b.skor_efektif ?? null, dinilai: ada,
        nilai: ada ? Math.round(b_ * b.skor_efektif * 100) / 100 : null,
        persen: b.bobot ? (ada ? Math.round(((b_ * b.skor_efektif) / b_) * 1000) / 10 : null) : null,
      };
    });
    bobot = Math.round(bobot * 100) / 100;
    nilai = Math.round(nilai * 100) / 100;
    area.push({
      kode: node.code, romawi, label: node.title || labelResmi,
      bobot, nilai,
      persen: bobot > 0 ? Math.round((nilai / bobot) * 1000) / 10 : null,
      lengkap: dinilai === anak.length && anak.length > 0,
      total_butir: anak.length, butir_dinilai: dinilai,
      item,
    });
  }
  const bobotHasil = Math.round(area.reduce((a, x) => a + x.bobot, 0) * 100) / 100;
  const nilaiHasil = Math.round(area.reduce((a, x) => a + x.nilai, 0) * 100) / 100;
  const hasil = {
    bobot: bobotHasil,
    nilai: nilaiHasil,
    persen: bobotHasil > 0 ? Math.round((nilaiHasil / bobotHasil) * 1000) / 10 : null,
    lengkap: area.every((x) => x.lengkap),
    area,
  };

  const bobotTotal = Math.round((pengungkit.bobot + hasil.bobot) * 100) / 100;
  const nilaiTotal = Math.round((pengungkit.nilai + hasil.nilai) * 100) / 100;
  const persenTotal = bobotTotal > 0 ? Math.round((nilaiTotal / bobotTotal) * 1000) / 10 : null;
  // Status Reformasi Birokrasi berdasarkan Nilai Evaluasi (persen) keseluruhan:
  // >=85 memenuhi predikat WBBM, >=75 memenuhi predikat WBK, selebihnya
  // belum memenuhi ambang minimum.
  const statusZI =
    persenTotal == null ? null
    : persenTotal >= 85 ? 'Memenuhi WBBM'
    : persenTotal >= 75 ? 'Memenuhi WBK'
    : 'Tidak Memenuhi';
  const total = {
    bobot: bobotTotal,
    nilai: nilaiTotal,
    persen: persenTotal,
    lengkap: pengungkit.lengkap && hasil.lengkap,
    status: statusZI,
  };

  return { pengungkit, hasil, total };
}

/**
 * Bangun struktur kelompok untuk tab Grafik Radar Zona Integritas dari hasil
 * `hitungRekapZI` (dipakai bersama sheet Rekap Nilai, supaya nilainya selalu
 * konsisten satu sama lain) — 6 kategori Pengungkit dengan kode GABUNGAN
 * kedua cabang (mis. "ZI-A.1.1 / ZI-A.2.1") dan nilai berupa % CAPAIAN
 * (nilai aspek ÷ bobot aspek × 100), ditambah 2 kategori Hasil dengan nilai
 * % capaian area. Tiap kategori tetap membawa daftar butirnya (dengan label
 * `cabang` Pemenuhan/Reform pada 6 kategori pertama) untuk drill-down.
 */
function kelompokRadarDariRekapZI(rekapZi) {
  const pengungkit = rekapZi.pengungkit.aspek.map((a) => ({
    kode: a.kode_reform ? `${a.kode_pemenuhan} / ${a.kode_reform}` : a.kode_pemenuhan,
    label: a.label,
    total_butir: a.total_butir,
    butir_dinilai: a.butir_dinilai,
    nilai: a.persen,
    butir: a.butir,
  }));
  const hasil = rekapZi.hasil.area.map((ar) => ({
    kode: ar.kode,
    label: ar.label,
    total_butir: ar.total_butir,
    butir_dinilai: ar.butir_dinilai,
    nilai: ar.persen,
    butir: ar.item.map((it) => ({
      kode: it.kode, label: it.label, bobot: it.bobot,
      skor: it.skor, dinilai: it.dinilai, nilai: it.skor,
    })),
  }));
  return [...pengungkit, ...hasil];
}

/**
 * Status akreditasi LAM Teknik berdasarkan Nilai Akreditasi (NA = skor
 * tertimbang / skor tertimbang maksimal ~400) dan dua "syarat perlu" yang
 * TIDAK bisa dihitung otomatis dari skor/bobot butir (mis. rasio dosen,
 * jumlah SKS, waktu tunggu lulusan) — diisi manual oleh SPM berdasarkan
 * Bab 4 pedoman penilaian. Mengikuti persis Tabel 3 "Status Akreditasi
 * Berdasarkan Nilai Akreditasi" pada pedoman LAM Teknik 2025.
 *
 * @param na                     Nilai Akreditasi (skor tertimbang, skala ~0-400)
 * @param syaratTerakreditasi    boolean — memenuhi Syarat Perlu Terakreditasi (Bab 4.2)?
 * @param unggulTier             'tidak' | 'tiga' | 'lima' — tingkat Syarat Perlu
 *                                Terakreditasi Unggul tertinggi yang terpenuhi
 *                                (Bab 4.1/4.3): 'lima' menyiratkan juga
 *                                memenuhi ambang 'tiga' (ambang lebih longgar).
 */
function statusAkreditasiLAM(na, syaratTerakreditasi, unggulTier) {
  if (na == null) return { status: null, durasi: null };
  if (na < 200 || !syaratTerakreditasi) return { status: 'Tidak Terakreditasi', durasi: null };
  if (na >= 361) {
    if (unggulTier === 'lima') return { status: 'Terakreditasi Unggul', durasi: '5 Tahun' };
    if (unggulTier === 'tiga') return { status: 'Terakreditasi Unggul', durasi: '3 Tahun' };
    return { status: 'Terakreditasi', durasi: '5 Tahun' };
  }
  if (na >= 331) {
    if (unggulTier === 'lima' || unggulTier === 'tiga')
      return { status: 'Terakreditasi Unggul', durasi: '3 Tahun' };
    return { status: 'Terakreditasi', durasi: '5 Tahun' };
  }
  // 200 <= na < 331
  return { status: 'Terakreditasi', durasi: '5 Tahun' };
}

/**
 * Definisi "syarat perlu" akreditasi (Bab 4 pedoman LAM Teknik), dipetakan
 * SPM ke butir instrumen yang benar-benar dinilai terpisah pada aplikasi
 * ini — tiap elemen I/II dicek sebagai rerata skor tersendiri, bukan
 * digabung ke satu kriteria besar seperti pada tabel resmi (yang
 * mengelompokkan beberapa elemen dalam satu baris "Rerata skor").
 *
 *  - tipe 'skor'    : dibandingkan terhadap SKOR EFEKTIF butir (skala 1-4,
 *                     sama seperti kolom Skor pada sheet Rekap Nilai/hasil
 *                     audit Modul 3). Ambang dasar (Bab 4.2, syarat perlu
 *                     Terakreditasi) = rerata skor ≥ 2,00 untuk semua item
 *                     bertipe ini.
 *  - tipe 'capaian' : dibandingkan terhadap "Capaian terhadap target" yang
 *                     diisi auditor pada Modul 3 (audit_assessments.
 *                     capaian_persen), sesuai satuan target indikator (%,
 *                     bulan, atau sks — lihat perbaikan satuan ref_items
 *                     terkait di data/acuan.js). Bab 4.2 pedoman menandai
 *                     '×' (tanpa syarat) untuk seluruh kriteria bertipe
 *                     ini pada syarat dasar Terakreditasi — hanya dipakai
 *                     untuk menentukan tingkat Unggul.
 *  - arah 'maks'    : capaian harus <= ambang (mis. waktu tunggu, makin
 *                     kecil makin baik); tidak diisi berarti 'min' (capaian
 *                     harus >= ambang).
 *  ambangUnggul5/ambangUnggul3 = ambang syarat unggul durasi 5/3 tahun.
 */
const SYARAT_PERLU_LAM = {
  LAMTEKNIKSTR: [
    { kunci: 'a', label: 'Sistem Tata Pamong', kode: ['STR-04a', 'STR-04b'], tipe: 'skor', ambangUnggul5: 3.5, ambangUnggul3: 3 },
    { kunci: 'b', label: 'Komitmen Pimpinan dan Kemampuan Manajerial', kode: ['STR-05a', 'STR-05b'], tipe: 'skor', ambangUnggul5: 3.5, ambangUnggul3: 3 },
    { kunci: 'c', label: 'Pemutakhiran Kurikulum', kode: ['STR-12'], tipe: 'skor', ambangUnggul5: 3.5, ambangUnggul3: 3 },
    { kunci: 'd', label: 'Profil Lulusan dan CPL', kode: ['STR-13a', 'STR-13b'], tipe: 'skor', ambangUnggul5: 3.5, ambangUnggul3: 3 },
    { kunci: 'e', label: 'Kesesuaian dan Tinjauan CPL', kode: ['STR-14a', 'STR-14b'], tipe: 'skor', ambangUnggul5: 3.5, ambangUnggul3: 3 },
    { kunci: 'f', label: 'Proses Pembelajaran', kode: ['STR-16a', 'STR-16b'], tipe: 'skor', ambangUnggul5: 3.5, ambangUnggul3: 3 },
    { kunci: 'g', label: 'Ketersediaan Mata Kuliah Basic Sciences dan Matematika', kode: ['STR-19'], tipe: 'capaian', satuan: 'sks', ambangUnggul5: 4, ambangUnggul3: 4 },
    { kunci: 'h', label: 'Kualifikasi Akademik DTPS', kode: ['STR-27'], tipe: 'capaian', satuan: '%', ambangUnggul5: 15, ambangUnggul3: 12.5 },
    { kunci: 'i', label: 'Jabatan Akademik DTPS', kode: ['STR-28'], tipe: 'capaian', satuan: '%', ambangUnggul5: 40, ambangUnggul3: 30 },
    { kunci: 'j', label: 'Kinerja DTPS (Karya Ilmiah)', kode: ['STR-38'], tipe: 'capaian', satuan: '%', ambangUnggul5: 10, ambangUnggul3: 7.5 },
    { kunci: 'k', label: 'Waktu Tunggu Lulusan', kode: ['STR-53'], tipe: 'capaian', satuan: 'bulan', arah: 'maks', ambangUnggul5: 6, ambangUnggul3: 6 },
    { kunci: 'l', label: 'Kesesuaian Bidang Kerja', kode: ['STR-54'], tipe: 'capaian', satuan: '%', ambangUnggul5: 50, ambangUnggul3: 50 },
    { kunci: 'm', label: 'Keberadaan Unit Penjaminan Mutu dan Komitmen Pimpinan', kode: ['STR-57a'], tipe: 'skor', ambangUnggul5: 3.5, ambangUnggul3: 3 },
    { kunci: 'n', label: 'Ketersediaan Perangkat SPMI dan Pengakuan Mutu Eksternal', kode: ['STR-57b'], tipe: 'skor', ambangUnggul5: 3.5, ambangUnggul3: 3 },
    { kunci: 'o', label: 'Indikator Kinerja Tambahan (IKT)', kode: ['STR-58'], tipe: 'skor', ambangUnggul5: 3.5, ambangUnggul3: 3 },
    { kunci: 'p', label: 'Keterlaksanaan Penjaminan Mutu dan Audit Mutu Internal', kode: ['STR-59'], tipe: 'skor', ambangUnggul5: 3.5, ambangUnggul3: 3 },
    { kunci: 'q', label: 'Evaluasi Capaian Kinerja', kode: ['STR-60'], tipe: 'skor', ambangUnggul5: 3.5, ambangUnggul3: 3 },
    { kunci: 'r', label: 'Kepuasan Pemangku Kepentingan', kode: ['STR-61'], tipe: 'skor', ambangUnggul5: 3.5, ambangUnggul3: 3 },
  ],
  LAMTEKNIKD3: [
    { kunci: 'c', label: 'Pemutakhiran Kurikulum', kode: ['D3-12'], tipe: 'skor', ambangUnggul5: 3.5, ambangUnggul3: 3 },
    { kunci: 'd', label: 'Profil Lulusan dan CPL', kode: ['D3-13a', 'D3-13b'], tipe: 'skor', ambangUnggul5: 3.5, ambangUnggul3: 3 },
    { kunci: 'e', label: 'Kesesuaian dan Tinjauan CPL', kode: ['D3-14a', 'D3-14b'], tipe: 'skor', ambangUnggul5: 3.5, ambangUnggul3: 3 },
    { kunci: 'f', label: 'Proses Pembelajaran', kode: ['D3-16a', 'D3-16b'], tipe: 'skor', ambangUnggul5: 3.5, ambangUnggul3: 3 },
    { kunci: 'i', label: 'Jabatan Akademik DTPS', kode: ['D3-25'], tipe: 'capaian', satuan: '%', ambangUnggul5: 40, ambangUnggul3: 30 },
    { kunci: 'k', label: 'Waktu Tunggu Lulusan', kode: ['D3-45'], tipe: 'capaian', satuan: 'bulan', arah: 'maks', ambangUnggul5: 3, ambangUnggul3: 3 },
    { kunci: 'l', label: 'Kesesuaian Bidang Kerja', kode: ['D3-46'], tipe: 'capaian', satuan: '%', ambangUnggul5: 70, ambangUnggul3: 70 },
    { kunci: 'm', label: 'Keberadaan Unit Penjaminan Mutu dan Komitmen Pimpinan', kode: ['D3-49a'], tipe: 'skor', ambangUnggul5: 3.5, ambangUnggul3: 3 },
    { kunci: 'n', label: 'Ketersediaan Perangkat SPMI dan Pengakuan Mutu Eksternal', kode: ['D3-49b'], tipe: 'skor', ambangUnggul5: 3.5, ambangUnggul3: 3 },
    { kunci: 'o', label: 'Indikator Kinerja Tambahan (IKT)', kode: ['D3-50'], tipe: 'skor', ambangUnggul5: 3.5, ambangUnggul3: 3 },
    { kunci: 'p', label: 'Keterlaksanaan Penjaminan Mutu dan Audit Mutu Internal', kode: ['D3-51'], tipe: 'skor', ambangUnggul5: 3.5, ambangUnggul3: 3 },
    { kunci: 'q', label: 'Evaluasi Capaian Kinerja', kode: ['D3-52'], tipe: 'skor', ambangUnggul5: 3.5, ambangUnggul3: 3 },
    { kunci: 'r', label: 'Kepuasan Pemangku Kepentingan', kode: ['D3-53'], tipe: 'skor', ambangUnggul5: 3.5, ambangUnggul3: 3 },
  ],
};
const AMBANG_DASAR_SKOR_SYARAT_PERLU = 2; // Bab 4.2 pedoman: rerata skor >= 2,00

/**
 * Hitung seluruh syarat perlu akreditasi (dasar + unggul) satu instrumen
 * akreditasi prodi LAM Teknik secara OTOMATIS dari nilai butir yang sudah
 * dinilai (skor_efektif) dan capaian auditor Modul 3 (capaian_persen) —
 * tidak ada lagi input manual SPM. `baris` adalah daftar butir instrumen
 * (sudah membawa skor_efektif) dari GET /:kunci; `acuanCode` menentukan
 * daftar item yang dipakai (LAMTEKNIKSTR = Sarjana Terapan, LAMTEKNIKD3 =
 * Diploma III). Mengembalikan null bila acuan bukan salah satu dari
 * keduanya (tidak berlaku, mis. jenjang lain yang belum dipetakan).
 */
function hitungSyaratPerluLAM(acuanCode, baris) {
  const daftar = SYARAT_PERLU_LAM[acuanCode];
  if (!daftar) return null;
  const byCode = new Map(baris.map((b) => [b.code, b]));

  const item = daftar.map((def) => {
    let nilai = null;
    let lengkap = true;
    if (def.tipe === 'skor') {
      const nilaiTiap = def.kode.map((k) => byCode.get(k)?.skor_efektif ?? null);
      if (nilaiTiap.some((v) => v == null)) lengkap = false;
      else nilai = Math.round((nilaiTiap.reduce((a, b) => a + b, 0) / nilaiTiap.length) * 100) / 100;
    } else {
      // Capaian target kini ditarik dari tab Penilaian instrumen ini sendiri
      // (butir.capaian_efektif — override SPM atau otomatis dari audit Modul
      // 3), bukan lagi dihitung terpisah lewat query audit_assessments.
      const nilaiCapaian = byCode.get(def.kode[0])?.capaian_efektif ?? null;
      if (nilaiCapaian == null) lengkap = false;
      else nilai = nilaiCapaian;
    }
    const cocok = (ambang) => (nilai == null ? null : def.arah === 'maks' ? nilai <= ambang : nilai >= ambang);
    return {
      kunci: def.kunci, label: def.label, kode: def.kode, tipe: def.tipe,
      satuan: def.satuan ?? 'skor 1-4', arah: def.arah ?? 'min',
      nilai, lengkap,
      ambang_dasar: def.tipe === 'skor' ? AMBANG_DASAR_SKOR_SYARAT_PERLU : null,
      ambang_unggul_5: def.ambangUnggul5, ambang_unggul_3: def.ambangUnggul3,
      memenuhi_dasar: def.tipe === 'skor' ? cocok(AMBANG_DASAR_SKOR_SYARAT_PERLU) : true,
      memenuhi_unggul_5: cocok(def.ambangUnggul5),
      memenuhi_unggul_3: cocok(def.ambangUnggul3),
    };
  });

  // Syarat dasar Terakreditasi hanya bergantung pada item bertipe skor
  // (Bab 4.2 pedoman menandai '×'/tanpa syarat untuk seluruh item capaian).
  const itemSkor = item.filter((it) => it.tipe === 'skor');
  const lengkapDasar = itemSkor.every((it) => it.lengkap);
  const syaratTerakreditasi = lengkapDasar && itemSkor.every((it) => it.memenuhi_dasar);

  // Tingkat Unggul butuh SELURUH item (skor maupun capaian) sudah dinilai.
  const lengkapUnggul = item.every((it) => it.lengkap);
  const unggulTier = lengkapUnggul && item.every((it) => it.memenuhi_unggul_5)
    ? 'lima'
    : lengkapUnggul && item.every((it) => it.memenuhi_unggul_3)
    ? 'tiga'
    : 'tidak';

  return {
    item, lengkap_dasar: lengkapDasar, lengkap_unggul: lengkapUnggul,
    syarat_terakreditasi: syaratTerakreditasi, unggul_tier: unggulTier,
  };
}

/** Ringkasan skor satu instrumen untuk kartu daftar (/spme). */
function ringkasanInstrumen(kunci, info, periodId) {
  if (!info.acuanId) return { kunci, ...info, tersedia: false };

  const daun = db
    .prepare(`SELECT id, bobot FROM ref_items WHERE ref_id=? AND wajib_petakan=1`)
    .all(info.acuanId);

  let bobotMaks = 0;
  let kontribusi = 0;
  let dinilai = 0;
  let jumlahSkor = 0;

  const overrides = new Map(
    db
      .prepare(
        `SELECT ref_item_id, skor FROM spme_scores
          WHERE period_id=? AND instrumen=? AND skor IS NOT NULL`
      )
      .all(periodId, kunci)
      .map((r) => [r.ref_item_id, r.skor])
  );

  daun.forEach((b) => {
    const override = overrides.get(b.id);
    const otomatis = override === undefined ? nilaiOtomatis(b.id, periodId, info.unitId) : null;
    const efektif = override ?? otomatis?.skor ?? null;
    if (efektif != null) {
      dinilai++;
      jumlahSkor += efektif;
      if (b.bobot != null) {
        bobotMaks += b.bobot;
        kontribusi += b.bobot * efektif;
      }
    } else if (b.bobot != null) {
      bobotMaks += b.bobot;
    }
  });

  return {
    kunci, ...info, tersedia: true,
    total_butir: daun.length,
    butir_dinilai: dinilai,
    // Rata-rata % capaian terhadap SELURUH butir (belum dinilai dianggap 0),
    // bukan rata-rata hanya dari butir yang sudah diisi.
    rata_capaian: daun.length
      ? Math.round((jumlahSkor / (daun.length * info.skorMaks)) * 1000) / 10
      : null,
    bobot_maksimal: info.berbobot ? Math.round(bobotMaks * 100) / 100 : null,
    skor_tertimbang: info.berbobot ? Math.round(kontribusi * 100) / 100 : null,
    persen_tertimbang:
      info.berbobot && bobotMaks > 0
        ? Math.round((kontribusi / (bobotMaks * info.skorMaks)) * 1000) / 10
        : null,
  };
}

/** Daftar seluruh instrumen SPME beserta ringkasan skornya. */
router.get('/', (req, res) => {
  const periodId = Number(req.query.period_id);
  if (!periodId) return res.status(400).json({ error: 'period_id wajib diisi' });

  res.json(
    Object.entries(semuaInstrumen()).map(([kunci, info]) =>
      ringkasanInstrumen(kunci, info, periodId)
    )
  );
});

/** Detail satu instrumen: pohon butir acuan lengkap dengan nilai tiap butir. */
router.get('/:kunci', (req, res) => {
  const info = ambilInstrumen(res, req.params.kunci);
  if (!info) return;
  const periodId = Number(req.query.period_id);
  if (!periodId) return res.status(400).json({ error: 'period_id wajib diisi' });

  if (!info.acuanId)
    return res.status(404).json({ error: info.keterangan || 'Acuan untuk instrumen ini belum tersedia' });

  const acuan = db.prepare(`SELECT * FROM refs WHERE id=?`).get(info.acuanId);
  const unit = info.unitId
    ? db.prepare(`SELECT id, name, code FROM units WHERE id=?`).get(info.unitId)
    : null;

  const baris = db
    .prepare(`SELECT * FROM ref_items WHERE ref_id=? ORDER BY level, sort_order, id`)
    .all(acuan.id);

  const overrides = new Map(
    db
      .prepare(
        `SELECT ref_item_id, skor, capaian, bukti_url, catatan, updated_at, u.name AS updated_by_name
           FROM spme_scores s LEFT JOIN users u ON u.id = s.updated_by
          WHERE s.period_id=? AND s.instrumen=?`
      )
      .all(periodId, req.params.kunci)
      .map((r) => [r.ref_item_id, r])
  );

  const instrumenProdi = req.params.kunci.startsWith('akreditasi_prodi_');

  let bobotMaks = 0;
  let kontribusi = 0;
  let dinilai = 0;
  let jumlahSkor = 0;
  let totalDaun = 0;

  const butir = baris.map((b) => {
    if (b.wajib_petakan !== 1) return { ...b };

    totalDaun++;
    const ov = overrides.get(b.id);
    const otomatis = nilaiOtomatis(b.id, periodId, unit?.id);
    const manual = ov?.skor ?? null;
    const efektif = manual ?? otomatis?.skor ?? null;

    if (efektif != null) {
      dinilai++;
      jumlahSkor += efektif;
      if (b.bobot != null) {
        bobotMaks += b.bobot;
        kontribusi += b.bobot * efektif;
      }
    } else if (b.bobot != null) {
      bobotMaks += b.bobot;
    }

    // Capaian target (nilai mentah sesuai satuan indikator — %, bulan, sks,
    // dst., bukan skor 1-4) hanya relevan untuk instrumen akreditasi prodi
    // (dipakai pengecekan syarat perlu LAM Teknik) — tidak dihitung untuk
    // instrumen lain supaya tidak menambah query percuma.
    let capaianOtomatis = null, capaianManual = null, capaianEfektif = null;
    if (instrumenProdi) {
      capaianOtomatis = nilaiCapaianOtomatis(b.id, periodId, unit?.id)?.capaian ?? null;
      capaianManual = ov?.capaian ?? null;
      capaianEfektif = capaianManual ?? capaianOtomatis;
    }

    return {
      ...b,
      skor_otomatis: otomatis?.skor ?? null,
      jumlah_penilaian: otomatis?.jumlah ?? 0,
      skor_manual: manual,
      skor_efektif: efektif,
      capaian_otomatis: capaianOtomatis,
      capaian_manual: capaianManual,
      capaian_efektif: capaianEfektif,
      bukti_url_manual: ov?.bukti_url ?? null,
      catatan_manual: ov?.catatan ?? null,
      diedit_oleh: ov?.updated_by_name ?? null,
      diedit_pada: ov?.updated_at ?? null,
    };
  });

  const butirTerurut = urutkanPohon(butir);

  // Struktur kategori radar: Zona Integritas memakai data yang SAMA dengan
  // sheet Rekap Nilai (hitungRekapZI) supaya nilainya selalu konsisten —
  // nilai sumbu kategori berupa % capaian (0-100%). Acuan biner (BAN-PT/
  // ISO 21001) juga ditampilkan sebagai persentase terpenuhi. Akreditasi
  // prodi (LAM Teknik) memakai % capaian tertimbang yang DIKONVERSI ke
  // skala asli acuan (1-4) supaya tetap sepadan dengan sumbu skor. UI
  // GreenMetric memakai % capaian tertimbang yang SAMA tapi TIDAK
  // dikonversi — ditampilkan langsung sebagai persentase 0-100% pada radar
  // utama (keluaranPersen), sama seperti kolom "% Capaian" pada sheet Rekap
  // Nilai — acuan lain memakai rata-rata skor polos seperti sebelumnya.
  const zi = acuan.code === 'ZI';
  const greenMetric = acuan.code === 'GREENMETRIC';
  const rekapZi = zi ? hitungRekapZI(butirTerurut) : null;
  const kelompokRadar = zi
    ? kelompokRadarDariRekapZI(rekapZi)
    : hitungKelompokRadar(butirTerurut, info.skorMin, info.skorMaks, {
        skorTertimbang: instrumenProdi || greenMetric,
        keluaranPersen: greenMetric,
      });
  const radarTipe = zi || info.skorMaks <= 1 || greenMetric ? 'persen' : 'skor';
  const radarDomainKategori = radarTipe === 'persen' ? [0, 100] : [info.skorMin, info.skorMaks];

  // Hasil Capaian untuk acuan tanpa bobot resmi (BAN-PT, ISO 21001): status
  // Terakreditasi/Tersertifikasi bila SELURUH kategori sudah 100% terpenuhi
  // (butir yang belum dinilai dianggap 0) — nilai kategori (kelompokRadar[].nilai)
  // sudah dihitung dengan aturan yang sama persis di hitungKelompokRadar().
  const hasilCapaian = !info.berbobot
    ? {
        terpenuhi: totalDaun > 0 && kelompokRadar.every((k) => k.nilai === 100),
        label_terpenuhi:
          acuan.code === 'BANPT' ? 'Terakreditasi'
          : acuan.code === 'ISO21001' ? 'Tersertifikasi'
          : 'Terpenuhi Seluruhnya',
        label_belum:
          acuan.code === 'BANPT' ? 'Belum Terakreditasi'
          : acuan.code === 'ISO21001' ? 'Belum Tersertifikasi'
          : 'Belum Terpenuhi Seluruhnya',
      }
    : null;

  // Status akreditasi LAM Teknik (khusus instrumen akreditasi prodi): Nilai
  // Akreditasi (NA) = skor tertimbang, dipadukan dengan syarat perlu yang
  // kini dihitung OTOMATIS dari nilai butir (hitungSyaratPerluLAM) —
  // mengikuti Tabel 3 pedoman. Status hanya dihitung bila seluruh item
  // syarat dasar (bertipe skor) sudah dinilai (syaratPerlu.lengkap_dasar);
  // sebelum itu status tetap null ("belum lengkap dinilai", bukan otomatis
  // dianggap tidak terakreditasi).
  let hasilAkreditasi = null;
  if (instrumenProdi && info.berbobot) {
    const na = Math.round(kontribusi * 100) / 100;
    const syaratPerlu = hitungSyaratPerluLAM(acuan.code, butirTerurut);
    const dihitung = syaratPerlu?.lengkap_dasar
      ? statusAkreditasiLAM(na, syaratPerlu.syarat_terakreditasi, syaratPerlu.unggul_tier)
      : { status: null, durasi: null };
    hasilAkreditasi = {
      na,
      na_maksimal: Math.round(bobotMaks * info.skorMaks * 100) / 100,
      status: dihitung.status,
      durasi: dihitung.durasi,
      syarat_perlu: syaratPerlu,
    };
  }

  res.json({
    instrumen: { kunci: req.params.kunci, ...info },
    acuan, unit,
    butir: butirTerurut,
    kelompok: kelompokRadar,
    rekap_zi: rekapZi,
    hasil_capaian: hasilCapaian,
    hasil_akreditasi: hasilAkreditasi,
    radar: {
      tipe: radarTipe,
      domain_kategori: radarDomainKategori,
      domain_butir: [info.skorMin, info.skorMaks],
    },
    ringkasan: {
      total_butir: totalDaun,
      butir_dinilai: dinilai,
      // Rata-rata % capaian terhadap SELURUH butir (belum dinilai dianggap 0).
      rata_capaian: totalDaun
        ? Math.round((jumlahSkor / (totalDaun * info.skorMaks)) * 1000) / 10
        : null,
      bobot_maksimal: info.berbobot ? Math.round(bobotMaks * 100) / 100 : null,
      skor_tertimbang: info.berbobot ? Math.round(kontribusi * 100) / 100 : null,
      persen_tertimbang:
        info.berbobot && bobotMaks > 0
          ? Math.round((kontribusi / (bobotMaks * info.skorMaks)) * 1000) / 10
          : null,
    },
  });
});

/**
 * Rincian isian auditee (realisasi + tautan bukti) di balik nilai satu
 * butir acuan — dimuat lazy saat SPM membuka modal koreksi skor, supaya
 * bisa melihat bukti aslinya sebelum menimpa nilai secara manual. Satu
 * baris per (indikator, unit) — mengikuti seluruh unit yang ditugaskan
 * (pengampu maupun pelaksana) pada indikator yang diadopsi langsung
 * (source_ref_item_id) ATAU dipetakan longgar (ref_map) ke butir ini, jadi
 * unit yang belum mengisi pun tetap terlihat ("belum mengisi"). Dibatasi
 * ke satu unit untuk instrumen akreditasi prodi (info.unitId terisi).
 */
router.get('/:kunci/butir/:refItemId/detail', (req, res) => {
  const info = ambilInstrumen(res, req.params.kunci);
  if (!info) return;
  const periodId = Number(req.query.period_id);
  const refItemId = Number(req.params.refItemId);
  if (!periodId) return res.status(400).json({ error: 'period_id wajib diisi' });

  const filterUnit = info.unitId ? ' AND un.id = ?' : '';
  const params = [periodId, periodId, periodId, refItemId, refItemId, ...(info.unitId ? [info.unitId] : [])];

  // s.period_id=? wajib disertakan: satu ref_item bisa diadopsi oleh
  // standard_indicators dari BEBERAPA periode (tiap siklus SPMI menyalin
  // standar+indikator+penugasannya sendiri). Tanpa filter ini, unit yang
  // sama akan muncul berkali-kali — sekali per periode yang kebetulan juga
  // mengadopsi ref_item ini, bukan cuma periode yang sedang dilihat.
  const baris = db
    .prepare(
      `SELECT si.id AS indicator_id, si.code, si.indicator, si.standard_id,
              s.title AS standard_title,
              un.id AS unit_id, un.name AS unit_name, ia.peran,
              im.realisasi, im.capaian_nilai, im.bukti_uraian, im.bukti_url,
              im.status AS status_isian, im.submitted_at,
              aa.skor AS skor_auditor, aa.capaian_persen AS capaian_auditor, aa.verdict
         FROM standard_indicators si
         JOIN standards s ON s.id = si.standard_id AND s.period_id = ?
         JOIN indicator_assignments ia ON ia.indicator_id = si.id
         JOIN units un ON un.id = ia.unit_id
         LEFT JOIN implementations im
                ON im.indicator_id = si.id AND im.unit_id = un.id AND im.period_id = ?
         LEFT JOIN audits au ON au.unit_id = un.id AND au.period_id = ?
         LEFT JOIN audit_assessments aa ON aa.audit_id = au.id AND aa.indicator_id = si.id
        WHERE (si.source_ref_item_id = ?
               OR EXISTS (SELECT 1 FROM ref_map m WHERE m.ref_item_id = ? AND m.indicator_id = si.id))
          ${filterUnit}
        ORDER BY s.title, si.code, ia.peran DESC, un.name`
    )
    .all(...params);

  res.json(baris);
});

/** Koreksi manual SPM atas nilai satu butir (menimpa nilai otomatis). Nilai
 *  yang diterima adalah SKOR mentah sesuai skala resmi acuan instrumen ini
 *  (bukan persen) — divalidasi terhadap skorMin/skorMaks/skorStep. bukti_url
 *  (opsional) adalah tautan berkas data dukung untuk butir ini — disimpan
 *  apa adanya (normalisasi skema http/https dilakukan di sisi klien lewat
 *  tautanBukti(), sama seperti tautan bukti pada modul Pelaksanaan). */
router.put('/:kunci/butir/:refItemId', requireRole('spm'), (req, res) => {
  const info = ambilInstrumen(res, req.params.kunci);
  if (!info) return;
  const { period_id, skor, capaian, bukti_url, catatan } = req.body;
  if (!period_id) return res.status(400).json({ error: 'period_id wajib diisi' });
  if (skor === undefined || skor === null || skor === '')
    return res.status(400).json({ error: 'Skor wajib diisi' });
  const nilai = Number(skor);
  if (Number.isNaN(nilai) || nilai < info.skorMin || nilai > info.skorMaks)
    return res.status(400).json({
      error: `Skor harus di antara ${info.skorMin} dan ${info.skorMaks}`,
    });
  if (info.skorStep) {
    const langkah = (nilai - info.skorMin) / info.skorStep;
    if (Math.abs(Math.round(langkah) - langkah) > 1e-6)
      return res.status(400).json({
        error: `Skor harus kelipatan ${info.skorStep} dari ${info.skorMin}`,
      });
  }

  // Capaian target (nilai mentah sesuai satuan indikator — %, bulan, sks,
  // dst.) — hanya dipakai instrumen akreditasi prodi, opsional, tidak
  // dibatasi skorMin/skorMaks karena satuannya bukan skor 1-4.
  let nilaiCapaian = null;
  if (capaian !== undefined && capaian !== null && capaian !== '') {
    nilaiCapaian = Number(capaian);
    if (Number.isNaN(nilaiCapaian))
      return res.status(400).json({ error: 'Capaian target harus berupa angka' });
  }

  const butir = db.prepare(`SELECT id FROM ref_items WHERE id=?`).get(req.params.refItemId);
  if (!butir) return res.status(404).json({ error: 'Butir acuan tidak ditemukan' });

  db.prepare(
    `INSERT INTO spme_scores (period_id, instrumen, ref_item_id, skor, capaian, bukti_url, catatan, updated_by)
     VALUES (?,?,?,?,?,?,?,?)
     ON CONFLICT(period_id, instrumen, ref_item_id)
       DO UPDATE SET skor=excluded.skor, capaian=excluded.capaian, bukti_url=excluded.bukti_url,
                     catatan=excluded.catatan,
                     updated_by=excluded.updated_by, updated_at=datetime('now','localtime')`
  ).run(period_id, req.params.kunci, req.params.refItemId, nilai, nilaiCapaian, bukti_url?.trim() || null, catatan ?? null, req.user.id);

  logActivity(req.user.id, 'koreksi_skor_spme', 'ref_items', req.params.refItemId,
    `${info.label}: skor ${nilai}`);
  res.json({ ok: true });
});

/** Hapus koreksi manual, kembali memakai nilai otomatis dari audit. */
router.delete('/:kunci/butir/:refItemId', requireRole('spm'), (req, res) => {
  const periodId = Number(req.query.period_id);
  if (!periodId) return res.status(400).json({ error: 'period_id wajib diisi' });

  db.prepare(
    `DELETE FROM spme_scores WHERE period_id=? AND instrumen=? AND ref_item_id=?`
  ).run(periodId, req.params.kunci, req.params.refItemId);

  res.json({ ok: true });
});

export default router;
