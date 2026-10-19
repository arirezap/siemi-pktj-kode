import { db } from '../db.js';

/**
 * Skala skor resmi acuan asal suatu indikator (bila indikator diadopsi
 * verbatim dari butir acuan eksternal, via standard_indicators.source_ref_item_id).
 * Null bila indikator tidak berasal dari acuan manapun, atau acuannya belum
 * ditandai skala skornya — dalam kedua kasus itu skor tidak divalidasi
 * (bebas seperti sebelumnya).
 *
 * Dipakai bersama oleh Modul 2 (pelaksanaan.js, isian mandiri auditee) dan
 * Modul 3 (emi.js, penilaian auditor) agar batasan skor konsisten pada
 * kedua tahap — auditee dan auditor menilai pada skala resmi yang sama.
 */
export function skalaSkorIndikator(indicatorId) {
  const r = db
    .prepare(
      `SELECT rf.skor_min, rf.skor_maks, rf.skor_step, rf.code AS acuan_kode
         FROM standard_indicators i
         LEFT JOIN ref_items ri ON ri.id = i.source_ref_item_id
         LEFT JOIN refs rf ON rf.id = ri.ref_id
        WHERE i.id = ?`
    )
    .get(indicatorId);
  if (!r || r.skor_min == null || r.skor_maks == null) return null;
  return r;
}

/**
 * Validasi nilai skor terhadap skala resmi (min/maks/kelipatan step).
 * step bernilai NULL/0 berarti skala kontinu (boleh desimal bebas, mis.
 * LAM Teknik 1-4 yang mengizinkan nilai seperti 3.7 atau 2.5).
 */
export function validasiSkor(skor, skala) {
  if (skor == null || !skala) return null; // tidak diisi atau tanpa skala: lolos
  const { skor_min: min, skor_maks: maks, skor_step: step, acuan_kode } = skala;
  if (skor < min || skor > maks)
    return `Skor harus di antara ${min} dan ${maks} (acuan ${acuan_kode})`;
  if (step) {
    const langkah = (skor - min) / step;
    if (Math.abs(Math.round(langkah) - langkah) > 1e-6)
      return `Skor harus kelipatan ${step} dari ${min} (acuan ${acuan_kode})`;
  }
  return null;
}
