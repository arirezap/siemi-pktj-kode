/**
 * Skala peringkat (nilai berupa huruf/predikat) untuk Sasaran Mutu yang
 * targetnya bukan angka — mis. Akreditasi "A", predikat "Unggul", opini
 * audit "WTP". Urutan level DARI YANG TERBAIK KE TERENDAH.
 *
 * Salinan konstanta yang sama ada di client/src/lib/peringkat.js — ubah
 * keduanya bersamaan bila menambah skala/level baru.
 */
export const SKALA_PERINGKAT = {
  abc: { label: 'Peringkat (A / B / C)', level: ['A', 'B', 'C'] },
  predikat: { label: 'Predikat (Unggul / Baik Sekali / Baik)', level: ['Unggul', 'Baik Sekali', 'Baik'] },
  opini: { label: 'Opini Audit (WTP / WDP / TW / TMP)', level: ['WTP', 'WDP', 'TW', 'TMP'] },
};

export const TIPE_NILAI = ['angka', 'peringkat'];

const norm = (v) => String(v ?? '').trim().toLowerCase();

/** Indeks level (0 = terbaik); -1 bila tidak dikenal */
export function urutanPeringkat(skala, nilai) {
  const def = SKALA_PERINGKAT[skala];
  if (!def) return -1;
  return def.level.findIndex((l) => norm(l) === norm(nilai));
}

/** Nilai kanonik (huruf besar/kecil sesuai definisi) atau null bila tidak valid */
export function normalkanPeringkat(skala, nilai) {
  const i = urutanPeringkat(skala, nilai);
  return i < 0 ? null : SKALA_PERINGKAT[skala].level[i];
}

/** Persen ketercapaian: capaian setara/lebih baik dari target = 100;
 *  satu tingkat di bawah target dihitung proporsional terhadap jumlah level. */
export function persenPeringkat(skala, target, capaian) {
  const n = SKALA_PERINGKAT[skala]?.level.length;
  const rt = urutanPeringkat(skala, target);
  const rc = urutanPeringkat(skala, capaian);
  if (!n || rt < 0 || rc < 0) return null;
  if (rc <= rt) return 100;
  return Math.round(((n - rc) / (n - rt)) * 100);
}
