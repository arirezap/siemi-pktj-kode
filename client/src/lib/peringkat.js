// Skala peringkat untuk Sasaran Mutu yang bernilai huruf/predikat.
// Salinan dari server/src/peringkat.js — ubah keduanya bersamaan.
// Urutan level: dari yang terbaik ke terendah.
export const SKALA_PERINGKAT = {
  abc: { label: 'Peringkat (A / B / C)', level: ['A', 'B', 'C'] },
  predikat: { label: 'Predikat (Unggul / Baik Sekali / Baik)', level: ['Unggul', 'Baik Sekali', 'Baik'] },
  opini: { label: 'Opini Audit (WTP / WDP / TW / TMP)', level: ['WTP', 'WDP', 'TW', 'TMP'] },
};

export const adalahPeringkat = (sm) => sm?.tipe_nilai === 'peringkat' && !!SKALA_PERINGKAT[sm.skala_peringkat];

export const levelPeringkat = (sm) => SKALA_PERINGKAT[sm?.skala_peringkat]?.level || [];

const norm = (v) => String(v ?? '').trim().toLowerCase();

export function urutanPeringkat(skala, nilai) {
  const def = SKALA_PERINGKAT[skala];
  return def ? def.level.findIndex((l) => norm(l) === norm(nilai)) : -1;
}

/** Persen ketercapaian (null bila tidak bisa dihitung). Setara/lebih baik dari target = 100. */
export function persenPeringkat(skala, target, capaian) {
  const n = SKALA_PERINGKAT[skala]?.level.length;
  const rt = urutanPeringkat(skala, target);
  const rc = urutanPeringkat(skala, capaian);
  if (!n || rt < 0 || rc < 0) return null;
  return rc <= rt ? 100 : Math.round(((n - rc) / (n - rt)) * 100);
}

/** Teks capaian untuk ditampilkan: huruf untuk peringkat, angka+satuan untuk angka. */
export function teksCapaian(sm, c) {
  if (!c) return null;
  if (adalahPeringkat(sm)) return c.capaian_teks || null;
  return c.capaian_nilai != null ? `${c.capaian_nilai}${sm.satuan ? ` ${sm.satuan}` : ''}` : null;
}
