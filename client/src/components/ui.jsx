import { useEffect, useRef, useState } from 'react';
import { STATUS_CLS, statusLabel } from '../api.js';

/* ------------------------------ Ikon SVG -------------------------------- */
const I = (p) => ({
  width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none',
  stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round',
  strokeLinejoin: 'round', ...p,
});

export const Icon = {
  Dashboard: (p) => (<svg {...I(p)}><rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/></svg>),
  Standar:   (p) => (<svg {...I(p)}><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>),
  Pelaksanaan:(p) => (<svg {...I(p)}><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>),
  Audit:     (p) => (<svg {...I(p)}><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>),
  Kendali:   (p) => (<svg {...I(p)}><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>),
  RTM:       (p) => (<svg {...I(p)}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>),
  Acuan:     (p) => (<svg {...I(p)}><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>),
  Cakupan:   (p) => (<svg {...I(p)}><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>),
  Tautan:    (p) => (<svg {...I(p)}><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>),
  Unggah:    (p) => (<svg {...I(p)}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M17 8l-5-5-5 5M12 3v12"/></svg>),
  Master:    (p) => (<svg {...I(p)}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>),
  Keluar:    (p) => (<svg {...I(p)}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/></svg>),
  Plus:      (p) => (<svg {...I(p)}><path d="M12 5v14M5 12h14"/></svg>),
  Simpan:    (p) => (<svg {...I(p)}><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><path d="M17 21v-8H7v8M7 3v5h8"/></svg>),
  Cetak:     (p) => (<svg {...I(p)}><path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 14h12v8H6z"/></svg>),
  Pena:      (p) => (<svg {...I(p)}><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z"/></svg>),
  Hapus:     (p) => (<svg {...I(p)}><path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>),
  Tutup:     (p) => (<svg {...I(p)}><path d="M18 6 6 18M6 6l12 12"/></svg>),
  Unduh:     (p) => (<svg {...I(p)}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5M12 15V3"/></svg>),
  Kembali:   (p) => (<svg {...I(p)}><path d="m15 18-6-6 6-6"/></svg>),
  Info:      (p) => (<svg {...I(p)}><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>),
  Cek:       (p) => (<svg {...I(p)}><path d="M20 6 9 17l-5-5"/></svg>),
  Peringatan:(p) => (<svg {...I(p)}><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3z"/><path d="M12 9v4M12 17h.01"/></svg>),
  Segarkan:  (p) => (<svg {...I(p)}><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/><path d="M3 21v-5h5"/></svg>),
  Sertifikat:(p) => (<svg {...I(p)}><circle cx="12" cy="8" r="6"/><path d="M9.5 13.5 8 22l4-2 4 2-1.5-8.5"/></svg>),
  Global:    (p) => (<svg {...I(p)}><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>),
  Perisai:   (p) => (<svg {...I(p)}><path d="M12 2 4 5v6c0 5 3.4 8.7 8 11 4.6-2.3 8-6 8-11V5z"/><path d="m9 12 2 2 4-4"/></svg>),
  Radar:     (p) => (<svg {...I(p)}><circle cx="12" cy="12" r="9"/><polygon points="12,5 18.5,10 16,18 8,18 5.5,10"/><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none"/></svg>),
  Tabel:     (p) => (<svg {...I(p)}><rect x="3" y="4" width="18" height="16" rx="1.5"/><path d="M3 9h18M3 14h18M9 4v16"/></svg>),
  ChevronBawah: (p) => (<svg {...I(p)}><path d="m6 9 6 6 6-6"/></svg>),
  Rekap:     (p) => (<svg {...I(p)}><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/></svg>),
  Pengguna:  (p) => (<svg {...I(p)}><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7"/></svg>),
  Kunci:     (p) => (<svg {...I(p)}><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>),
};

/* ------------------------------- Badge ---------------------------------- */
export function Badge({ status, children, cls }) {
  return (
    <span className={`badge ${cls || STATUS_CLS[status] || 'bg-slate-100 text-slate-700'}`}>
      {children || statusLabel(status)}
    </span>
  );
}

/* ------------------------------- Modal ---------------------------------- */
export function Modal({ open, onClose, title, children, lebar = 'max-w-2xl', footer }) {
  useEffect(() => {
    const h = (e) => e.key === 'Escape' && onClose?.();
    if (open) document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 sm:p-8">
      <div className={`card w-full ${lebar} my-auto`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5">
          <h3 className="text-base font-semibold">{title}</h3>
          <button type="button" onClick={onClose} className="btn-ghost btn-sm" aria-label="Tutup">
            <Icon.Tutup width={16} height={16} />
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------- Toast ---------------------------------- */
export function useToast() {
  const [pesan, setPesan] = useState(null);
  const timer = useRef();

  const tampil = (teks, jenis = 'sukses') => {
    clearTimeout(timer.current);
    setPesan({ teks, jenis });
    timer.current = setTimeout(() => setPesan(null), 4000);
  };

  const Toast = () =>
    pesan ? (
      <div className="no-print fixed bottom-6 right-6 z-[60] animate-in">
        <div
          className={`flex items-start gap-2.5 rounded-lg px-4 py-3 text-sm text-white shadow-lg ${
            pesan.jenis === 'galat' ? 'bg-rose-600' : 'bg-emerald-600'
          }`}
        >
          {pesan.jenis === 'galat' ? <Icon.Peringatan /> : <Icon.Cek />}
          <span className="max-w-xs">{pesan.teks}</span>
        </div>
      </div>
    ) : null;

  return { tampil, Toast };
}

/* ---------------------------- Kondisi kosong ---------------------------- */
export function Kosong({ judul = 'Belum ada data', pesan, aksi }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-14 text-center">
      <div className="rounded-full bg-slate-100 p-3 text-slate-400">
        <Icon.Info width={26} height={26} />
      </div>
      <p className="font-medium text-slate-700">{judul}</p>
      {pesan && <p className="max-w-md text-sm text-slate-500">{pesan}</p>}
      {aksi}
    </div>
  );
}

/* ------------------------------- Memuat --------------------------------- */
export function Memuat({ teks = 'Memuat data…' }) {
  return (
    <div className="flex items-center justify-center gap-3 py-14 text-sm text-slate-500">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-pktj-600" />
      {teks}
    </div>
  );
}

/* ------------------------------ Bilah judul ----------------------------- */
export function JudulHalaman({ judul, deskripsi, aksi, ikon }) {
  return (
    <div className="no-print mb-5 flex flex-wrap items-start justify-between gap-3">
      <div className="flex items-start gap-3">
        {ikon && (
          <div className="mt-0.5 rounded-lg bg-pktj-50 p-2 text-pktj-700">{ikon}</div>
        )}
        <div>
          <h1 className="text-xl font-bold tracking-tight">{judul}</h1>
          {deskripsi && <p className="mt-0.5 text-sm text-slate-500">{deskripsi}</p>}
        </div>
      </div>
      {aksi && <div className="flex flex-wrap items-center gap-2">{aksi}</div>}
    </div>
  );
}

/* ------------------------------ Bilah progres --------------------------- */
export function Progres({ nilai, warna }) {
  const v = Math.max(0, Math.min(100, Number(nilai) || 0));
  const w = warna || (v >= 85 ? 'bg-emerald-500' : v >= 60 ? 'bg-aksen-500' : 'bg-rose-500');
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
      <div className={`h-full rounded-full ${w} transition-all`} style={{ width: `${v}%` }} />
    </div>
  );
}

/* ---------------------- Kanvas tanda tangan digital --------------------- */
export function PadTandaTangan({ onChange, tinggi = 170, nilaiAwal }) {
  const ref = useRef(null);
  const fileRef = useRef(null);
  const [menggambar, setMenggambar] = useState(false);
  const [kosong, setKosong] = useState(!nilaiAwal);
  const [galatFile, setGalatFile] = useState('');

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = c.getBoundingClientRect();
    c.width = rect.width * dpr;
    c.height = tinggi * dpr;
    const ctx = c.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#0f172a';
    if (nilaiAwal) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0, rect.width, tinggi);
      img.src = nilaiAwal;
    }
  }, [tinggi, nilaiAwal]);

  const pos = (e) => {
    const r = ref.current.getBoundingClientRect();
    const p = e.touches?.[0] ?? e;
    return { x: p.clientX - r.left, y: p.clientY - r.top };
  };

  const mulai = (e) => {
    e.preventDefault();
    const ctx = ref.current.getContext('2d');
    const { x, y } = pos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    setMenggambar(true);
  };

  const gambar = (e) => {
    if (!menggambar) return;
    e.preventDefault();
    const ctx = ref.current.getContext('2d');
    const { x, y } = pos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    setKosong(false);
  };

  const selesai = () => {
    if (!menggambar) return;
    setMenggambar(false);
    onChange?.(kosong ? null : ref.current.toDataURL('image/png'));
  };

  const bersihkan = () => {
    const c = ref.current;
    c.getContext('2d').clearRect(0, 0, c.width, c.height);
    setKosong(true);
    setGalatFile('');
    onChange?.(null);
  };

  const unggahFile = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!['image/png', 'image/jpeg'].includes(file.type)) {
      setGalatFile('Berkas harus berupa gambar PNG atau JPG');
      return;
    }
    setGalatFile('');
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const c = ref.current;
        const rect = c.getBoundingClientRect();
        const ctx = c.getContext('2d');
        ctx.clearRect(0, 0, rect.width, tinggi);
        const skala = Math.min(rect.width / img.width, tinggi / img.height, 1);
        const w = img.width * skala;
        const h = img.height * skala;
        ctx.drawImage(img, (rect.width - w) / 2, (tinggi - h) / 2, w, h);
        setKosong(false);
        onChange?.(c.toDataURL('image/png'));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  };

  return (
    <div>
      <div className="rounded-lg border-2 border-dashed border-slate-300 bg-slate-50">
        <canvas
          ref={ref}
          style={{ width: '100%', height: tinggi, touchAction: 'none', cursor: 'crosshair' }}
          onMouseDown={mulai} onMouseMove={gambar}
          onMouseUp={selesai} onMouseLeave={selesai}
          onTouchStart={mulai} onTouchMove={gambar} onTouchEnd={selesai}
        />
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-slate-500">
          Gambar langsung dengan tetikus/layar sentuh, atau unggah berkas PNG/JPG.
        </p>
        <div className="flex gap-2">
          <input ref={fileRef} type="file" accept="image/png,image/jpeg"
            onChange={unggahFile} className="hidden" />
          <button type="button" onClick={() => fileRef.current?.click()}
            className="btn-outline btn-sm">
            Unggah PNG/JPG
          </button>
          <button type="button" onClick={bersihkan} className="btn-ghost btn-sm">
            Bersihkan
          </button>
        </div>
      </div>
      {galatFile && <p className="mt-1 text-xs text-rose-600">{galatFile}</p>}
    </div>
  );
}
