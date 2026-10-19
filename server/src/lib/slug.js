/** Ubah teks bebas jadi slug URL yang aman: huruf kecil, angka, tanda hubung
 *  tunggal — tanpa spasi/diakritik/karakter lain. Dipakai untuk menyarankan
 *  slug otomatis dari judul berita/halaman. */
export function buatSlug(teks) {
  return String(teks || '')
    .normalize('NFKD').replace(/[̀-ͯ]/g, '') // lepas diakritik (é -> e, dst.)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}

/** Slug valid: huruf kecil/angka/tanda hubung saja, tidak diawali/diakhiri
 *  tanda hubung, tidak kosong, panjang wajar. Dipakai untuk MENOLAK slug
 *  hasil input manual yang tidak aman sebelum dipakai pada query atau
 *  dijadikan bagian URL publik. */
export function slugValid(s) {
  return typeof s === 'string' && s.length > 0 && s.length <= 120 &&
    /^[a-z0-9]+(-[a-z0-9]+)*$/.test(s);
}
