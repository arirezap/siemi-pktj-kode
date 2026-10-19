import { useEffect, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { api } from '../api.js';

const navCls = ({ isActive }) =>
  `rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
    isActive ? 'bg-pktj-50 text-pktj-700' : 'text-slate-600 hover:bg-slate-100'
  }`;
const navClsEksternal = 'rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100';

/** Tautan satu item menu UTAMA: kalau halaman diberi Tautan Eksternal (lewat
 *  Halaman > Kelola Konten, lihat routes/konten.js), item ini redirect ke
 *  alamat itu di tab yang sama — selain itu tetap NavLink internal seperti
 *  sebelumnya (ikut status aktif). */
function TautanMenuUtama({ h }) {
  if (h.external_url) return <a href={h.external_url} className={navClsEksternal}>{h.title}</a>;
  return <NavLink to={`/halaman/${h.slug}`} className={navCls}>{h.title}</NavLink>;
}

/** Item menu dengan submenu yang muncul saat disorot (hover) — dipakai utk
 *  halaman mana pun yang punya sub-halaman (mis. SPMI, SPME), dibangun
 *  dinamis dari data /publik/halaman (field children, lihat routes/publik.js
 *  dan menu "Letakkan di bawah" pada Halaman > Kelola Konten). Trigger dan
 *  tiap item submenu bisa masing-masing berupa tautan internal atau
 *  eksternal, tergantung external_url halaman/sub-halaman itu sendiri. */
function MenuDenganSubmenu({ h }) {
  return (
    <div className="group relative">
      <TautanMenuUtama h={h} />
      <div className="invisible absolute left-0 top-full z-30 min-w-[260px] rounded-xl border border-slate-200 bg-white py-2 opacity-0 shadow-lg transition-all group-hover:visible group-hover:opacity-100">
        {h.children.map((sub) =>
          sub.external_url ? (
            <a key={sub.slug} href={sub.external_url}
              className="block px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 hover:text-pktj-700">
              {sub.title}
            </a>
          ) : (
            <Link key={sub.slug} to={`/halaman/${sub.slug}`}
              className="block px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 hover:text-pktj-700">
              {sub.title}
            </Link>
          )
        )}
      </div>
    </div>
  );
}

/** Layout untuk halaman PUBLIK (tanpa login) — beranda kampus, halaman
 *  statis, rekapitulasi mutu. Terpisah sepenuhnya dari Layout.jsx (dashboard
 *  internal): tidak ada sidebar menu aplikasi, hanya header/nav sederhana
 *  dan tombol "Masuk" menuju dashboard internal. */
export default function LayoutPublik({ children }) {
  const [halaman, setHalaman] = useState([]);

  useEffect(() => {
    api.get('/publik/halaman').then(setHalaman).catch(() => setHalaman([]));
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 lg:px-8">
          <Link to="/" className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-pktj-700 text-sm font-extrabold text-white">
              MI
            </div>
            <div className="leading-tight">
              <p className="text-sm font-bold text-slate-900">SIEMI PKTJ</p>
              <p className="text-[11px] text-slate-500">Sistem Evaluasi Mutu Internal</p>
            </div>
          </Link>

          <nav className="ml-4 hidden items-center gap-1 md:flex">
            <NavLink to="/" end className={navCls}>Beranda</NavLink>
            <NavLink to="/rekapitulasi-mutu" className={navCls}>Rekapitulasi Mutu</NavLink>
            {halaman.map((h) =>
              h.children?.length > 0 ? (
                <MenuDenganSubmenu key={h.slug} h={h} />
              ) : (
                <TautanMenuUtama key={h.slug} h={h} />
              )
            )}
          </nav>

          <div className="ml-auto">
            <Link to="/masuk" className="btn-primary btn-sm">Masuk</Link>
          </div>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-slate-200 bg-slate-50 px-4 py-8 text-sm text-slate-500 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <p className="font-semibold text-slate-700">Politeknik Keselamatan Transportasi Jalan</p>
          <p className="mt-1 text-xs">
            Mengacu pada ISO 21001:2018 dan Instrumen Akreditasi LAM Teknik 2025
          </p>
        </div>
      </footer>
    </div>
  );
}
