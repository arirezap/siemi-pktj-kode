const BASE = '/api';

export function getToken() {
  return sessionStorage.getItem('emi_token');
}
export function setToken(t) {
  if (t) sessionStorage.setItem('emi_token', t);
  else sessionStorage.removeItem('emi_token');
}

async function request(method, path, body) {
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(BASE + path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (res.status === 401) {
    setToken(null);
    if (!location.pathname.startsWith('/masuk')) location.href = '/masuk';
    throw new Error('Sesi berakhir, silakan masuk kembali');
  }

  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error(data?.error || `Kesalahan ${res.status}`);
  return data;
}

export const api = {
  get:  (p) => request('GET', p),
  post: (p, b) => request('POST', p, b ?? {}),
  put:  (p, b) => request('PUT', p, b ?? {}),
  del:  (p) => request('DELETE', p),
};

/** Unduh berkas biner (mis. ekspor Excel) dari endpoint GET yang butuh token. */
export async function unduhBerkas(path, namaBerkas) {
  const headers = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(BASE + path, { headers });
  if (res.status === 401) {
    setToken(null);
    if (!location.pathname.startsWith('/masuk')) location.href = '/masuk';
    throw new Error('Sesi berakhir, silakan masuk kembali');
  }
  if (!res.ok) {
    let pesan = `Kesalahan ${res.status}`;
    try { pesan = (await res.json())?.error || pesan; } catch { /* respons bukan JSON */ }
    throw new Error(pesan);
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = namaBerkas;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/* -------------------------- Utilitas tampilan -------------------------- */

export const ROLE_LABEL = {
  admin: 'Administrator',
  spm: 'Satuan Penjaminan Mutu',
  auditor: 'Auditor',
  auditee: 'Auditee',
  pimpinan: 'Pimpinan',
};

export const VERDICT = {
  sesuai:    { label: 'Sesuai',     cls: 'bg-emerald-100 text-emerald-800' },
  observasi: { label: 'Observasi',  cls: 'bg-sky-100 text-sky-800' },
  kts_minor: { label: 'KTS Minor',  cls: 'bg-amber-100 text-amber-800' },
  kts_mayor: { label: 'KTS Mayor',  cls: 'bg-rose-100 text-rose-800' },
};

/* ---------------------- Arsitektur standar mutu ------------------------ */

// 5 ranah bawaan arsitektur standar mutu. Ranah TAMBAHAN yang dibuat SPM
// lewat Modul Penetapan Standar (tabel ranah_custom di server) digabungkan
// ke sini secara dinamis lewat hook useRanah() — lihat hooks/useRanah.js.
// Komponen yang cuma perlu label bawaan (tanpa ranah tambahan) masih bisa
// memakai RANAH_BAWAAN langsung.
export const RANAH_BAWAAN = {
  A: { label: 'A. Pendidikan', pendek: 'Pendidikan', cls: 'bg-pktj-100 text-pktj-800' },
  B: { label: 'B. Penelitian', pendek: 'Penelitian', cls: 'bg-sky-100 text-sky-800' },
  C: { label: 'C. Pengabdian kepada Masyarakat', pendek: 'PkM', cls: 'bg-teal-100 text-teal-800' },
  D: { label: 'D. Tata Kelola dan Kelembagaan', pendek: 'Tata Kelola', cls: 'bg-violet-100 text-violet-800' },
  E: { label: 'E. Keberlanjutan dan Lingkungan Kampus', pendek: 'Keberlanjutan', cls: 'bg-emerald-100 text-emerald-800' },
};

// Palet warna badge utk ranah TAMBAHAN (di luar 5 warna ranah bawaan di
// atas), dipilih berulang secara deterministik dari kode ranah supaya
// warnanya konsisten di seluruh aplikasi tanpa perlu disimpan di server.
const PALET_RANAH_TAMBAHAN = [
  'bg-rose-100 text-rose-800', 'bg-indigo-100 text-indigo-800',
  'bg-amber-100 text-amber-800', 'bg-cyan-100 text-cyan-800',
  'bg-lime-100 text-lime-800', 'bg-fuchsia-100 text-fuchsia-800',
];
export const warnaRanah = (kode) => {
  let h = 0;
  for (const c of String(kode)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return PALET_RANAH_TAMBAHAN[h % PALET_RANAH_TAMBAHAN.length];
};

export const KELOMPOK = { L: 'Luaran', P: 'Proses', M: 'Masukan' };

export const SIFAT = {
  wajib: { label: 'Wajib SN Dikti', cls: 'bg-pktj-100 text-pktj-800' },
  melampaui: { label: 'Melampaui SN Dikti', cls: 'bg-amber-100 text-amber-800' },
};

export const labelKategori = (ranah, kelompok, semuaRanah = RANAH_BAWAAN) =>
  kelompok
    ? `${semuaRanah[ranah]?.label || ranah} — ${KELOMPOK[kelompok]}`
    : semuaRanah[ranah]?.label || ranah;

export const STATUS_CLS = {
  draft: 'bg-slate-100 text-slate-700',
  ditetapkan: 'bg-emerald-100 text-emerald-800',
  diserahkan: 'bg-sky-100 text-sky-800',
  dinilai: 'bg-violet-100 text-violet-800',
  dijadwalkan: 'bg-slate-100 text-slate-700',
  berlangsung: 'bg-amber-100 text-amber-800',
  selesai: 'bg-sky-100 text-sky-800',
  ditandatangani: 'bg-emerald-100 text-emerald-800',
  terbuka: 'bg-rose-100 text-rose-800',
  tindakan_koreksi: 'bg-amber-100 text-amber-800',
  verifikasi: 'bg-sky-100 text-sky-800',
  ditutup: 'bg-emerald-100 text-emerald-800',
  menunggu_auditee: 'bg-rose-100 text-rose-800',
  rencana_disusun: 'bg-amber-100 text-amber-800',
  realisasi_dilaporkan: 'bg-sky-100 text-sky-800',
  diverifikasi: 'bg-violet-100 text-violet-800',
  rencana: 'bg-slate-100 text-slate-700',
  menunggu_verifikasi_spm: 'bg-amber-100 text-amber-800',
  ditolak_spm: 'bg-rose-100 text-rose-800',
  menunggu_direktur: 'bg-violet-100 text-violet-800',
  efektif: 'bg-emerald-100 text-emerald-800',
  belum_efektif: 'bg-amber-100 text-amber-800',
  tidak_efektif: 'bg-rose-100 text-rose-800',
};

export const statusLabel = (s) =>
  (s || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

export function tanggalID(v) {
  if (!v) return '-';
  const d = new Date(v.length <= 10 ? v + 'T00:00:00' : v.replace(' ', 'T'));
  if (isNaN(d)) return v;
  return d.toLocaleDateString('id-ID', {
    day: 'numeric', month: 'long', year: 'numeric',
  });
}

/** "Senin, 8 September 2026" — dipakai pada formulir jadwal (kolom Hari/Tanggal). */
export function hariTanggalID(v) {
  if (!v) return '-';
  const d = new Date(v.length <= 10 ? v + 'T00:00:00' : v.replace(' ', 'T'));
  if (isNaN(d)) return v;
  return d.toLocaleDateString('id-ID', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
}

/** "09.00 - 15.00 WIB" / "09:00-15:00" → { mulai: '09:00', selesai: '15:00' } */
export function uraiWaktu(w) {
  const jam = [...(w || '').matchAll(/(\d{1,2})[.:](\d{2})/g)]
    .map((m) => `${m[1].padStart(2, '0')}:${m[2]}`);
  return { mulai: jam[0] || '', selesai: jam[1] || '' };
}

/** { mulai: '09:00', selesai: '15:00' } → "09.00 - 15.00 WIB" (format formulir baku) */
export function rangkaiWaktu(mulai, selesai) {
  const titik = (j) => j.replace(':', '.');
  if (mulai && selesai) return `${titik(mulai)} - ${titik(selesai)} WIB`;
  if (mulai) return `${titik(mulai)} WIB`;
  return '';
}

/** Normalisasi tautan bukti sebelum dipakai sebagai href/disimpan: bila
 *  pengguna menempel tautan tanpa skema (mis. "drive.google.com/…" tanpa
 *  "https://"), peramban akan salah mengartikannya sebagai path RELATIF dan
 *  membukanya di alamat aplikasi sendiri (tampak seperti "localhost")
 *  alih-alih Google Drive. Path unggahan lokal (diawali "/") dibiarkan apa
 *  adanya karena memang relatif terhadap server aplikasi. */
export function tautanBukti(u) {
  const t = (u || '').trim();
  if (!t || t.startsWith('/')) return t;
  return /^https?:\/\//i.test(t) ? t : `https://${t}`;
}

export function tanggalWaktuID(v) {
  if (!v) return '-';
  const d = new Date(v.replace(' ', 'T'));
  if (isNaN(d)) return v;
  return d.toLocaleString('id-ID', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}
