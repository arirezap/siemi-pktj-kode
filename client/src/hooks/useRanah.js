import { useCallback, useEffect, useState } from 'react';
import { api, RANAH_BAWAAN, warnaRanah } from '../api.js';

/**
 * Gabungan 5 ranah bawaan (A-E) + ranah tambahan yang sudah pernah dibuat
 * SPM (tabel ranah_custom di server, lihat routes/master.js). Dipakai di
 * seluruh tempat yang menampilkan/memilih ranah (Modul Penetapan Standar,
 * daftar standar, rekap cakupan) supaya ranah baru langsung konsisten
 * tampil di mana-mana begitu dibuat, tidak cuma di form saat itu.
 */
export function useRanah() {
  const [tambahan, setTambahan] = useState([]);
  const [memuat, setMemuat] = useState(true);

  const muatUlang = useCallback(() => {
    setMemuat(true);
    return api
      .get('/master/ranah')
      .then((rows) => setTambahan(rows))
      .catch(() => {})
      .finally(() => setMemuat(false));
  }, []);

  useEffect(() => { muatUlang(); }, [muatUlang]);

  const ranah = { ...RANAH_BAWAAN };
  for (const r of tambahan) {
    ranah[r.code] = { label: r.label, pendek: r.pendek, cls: warnaRanah(r.code) };
  }

  async function tambahRanah({ code, label, pendek }) {
    const dibuat = await api.post('/master/ranah', { code, label, pendek });
    await muatUlang();
    return dibuat;
  }

  return { ranah, memuat, tambahRanah };
}
