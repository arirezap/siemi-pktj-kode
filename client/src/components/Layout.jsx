import { useEffect, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { api, ROLE_LABEL } from '../api.js';
import { Icon } from './ui.jsx';

const MENU_UTAMA = [
  { ke: '/beranda',       label: 'Beranda',              ikon: Icon.Dashboard,   peran: null },
  { ke: '/acuan',         label: 'Acuan Mutu',           ikon: Icon.Acuan,       peran: null, judul: 'Kerangka Acuan' },
  { ke: '/cakupan',       label: 'Cakupan Acuan',        ikon: Icon.Cakupan,     peran: null },
  { ke: '/sasaran-mutu',  label: 'Sasaran Mutu',         ikon: Icon.Radar,       peran: null },
  { ke: '/standar',       label: '1. Penetapan Standar', ikon: Icon.Standar,     peran: null, judul: 'Siklus PPEPP' },
  { ke: '/pelaksanaan',   label: '2. Pelaksanaan Standar', ikon: Icon.Pelaksanaan, peran: null },
  { ke: '/emi',           label: '3. Evaluasi Mutu Internal', ikon: Icon.Audit,  peran: null },
  { ke: '/pengendalian',  label: '4. Pengendalian',      ikon: Icon.Kendali,     peran: null },
  { ke: '/rtm',           label: '5. Rapat Tinjauan Manajemen', ikon: Icon.RTM,  peran: null },
];

const MENU_PENGATURAN = [
  { ke: '/manajemen-auditor', label: 'Manajemen Auditor', ikon: Icon.Sertifikat, peran: ['auditor', 'spm', 'admin'], judul: 'Pengaturan' },
  { ke: '/master',        label: 'Data Master',          ikon: Icon.Master,      peran: ['spm', 'admin'] },
  { ke: '/konten',        label: 'Berita & Halaman',     ikon: Icon.Pena,        peran: ['spm', 'admin'] },
];

/**
 * Item sidebar berupa grup yang bisa dibuka/tutup (dropdown), dipakai untuk
 * "Akreditasi Program Studi" agar daftar prodi (RSTJ, TRO, TO, dst. — jumlahnya
 * mengikuti Data Master) tidak memenuhi sidebar sebagai tautan datar.
 * Otomatis terbuka bila salah satu anaknya sedang aktif.
 */
function GrupMenuSpme({ grup, tutup }) {
  const location = useLocation();
  const adaAnakAktif = grup.anak.some((a) => location.pathname === a.ke);
  const [override, setOverride] = useState(null);
  const terbuka = override ?? adaAnakAktif;

  return (
    <div>
      <button
        type="button"
        onClick={() => setOverride(!terbuka)}
        className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
          adaAnakAktif ? 'font-semibold text-white' : 'text-pktj-100 hover:bg-white/10'
        }`}
      >
        <grup.ikon />
        <span className="flex-1 text-left">{grup.label}</span>
        <Icon.ChevronBawah
          width={14} height={14}
          className={`shrink-0 transition-transform ${terbuka ? 'rotate-180' : ''}`}
        />
      </button>
      {terbuka && (
        <div className="ml-4 mt-0.5 space-y-0.5 border-l border-white/10 pl-3">
          {grup.anak.map((a) => (
            <NavLink
              key={a.ke}
              to={a.ke}
              onClick={tutup}
              className={({ isActive }) =>
                `flex items-center gap-2 rounded-lg px-3 py-2 text-[13px] transition-colors ${
                  isActive
                    ? 'bg-white/15 font-semibold text-white'
                    : 'text-pktj-200 hover:bg-white/10'
                }`
              }
            >
              <span className="h-1 w-1 shrink-0 rounded-full bg-current opacity-60" />
              <span>{a.label}</span>
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Layout({ children }) {
  const { user, periode, keluar } = useAuth();
  const nav = useNavigate();
  const [buka, setBuka] = useState(false);
  const [prodiSpme, setProdiSpme] = useState([]);

  // Bagian "Akreditasi Program Studi" bersifat dinamis: mengikuti unit prodi
  // yang terdaftar di Data Master (bertambah/berkurang otomatis di sidebar
  // tanpa perlu ubah kode saat prodi baru ditambahkan).
  useEffect(() => {
    if (!periode?.id) { setProdiSpme([]); return; }
    api.get(`/spme?period_id=${periode.id}`)
      .then((d) => setProdiSpme(d.filter((x) => x.kelompok === 'Akreditasi Program Studi')))
      .catch(() => setProdiSpme([]));
  }, [periode?.id]);

  const menuSpme = [
    { ke: '/spme/akreditasi_pt', label: 'Akreditasi Perguruan Tinggi', ikon: Icon.Sertifikat, peran: null, judul: 'Penjaminan Mutu Eksternal (SPME)' },
    {
      tipe: 'grup', kunci: 'akreditasi-prodi', label: 'Akreditasi Program Studi',
      ikon: Icon.Sertifikat, peran: null,
      anak: prodiSpme.map((p) => ({ ke: `/spme/${p.kunci}`, label: p.label })),
    },
    { ke: '/spme/iso21001',    label: 'ISO 21001', ikon: Icon.Cek, peran: null },
    { ke: '/spme/zi',          label: 'Zona Integritas (WBK-WBBM)', ikon: Icon.Perisai, peran: null },
    { ke: '/spme/greenmetric', label: 'UI GreenMetric', ikon: Icon.Global, peran: null },
  ];

  const menu = [...MENU_UTAMA, ...menuSpme, ...MENU_PENGATURAN]
    .filter((m) => !m.peran || m.peran.includes(user?.role))
    .filter((m) => m.tipe !== 'grup' || m.anak.length > 0);

  function logout() {
    keluar();
    nav('/masuk');
  }

  return (
    <div className="min-h-screen lg:flex">
      {/* ------------------------------ Sidebar ------------------------------ */}
      <aside
        className={`no-print fixed inset-y-0 left-0 z-40 flex w-72 transform flex-col bg-pktj-800 text-white transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${
          buka ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-16 shrink-0 items-center gap-3 border-b border-white/10 px-5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-aksen-500 text-sm font-extrabold text-pktj-900">
            MI
          </div>
          <div className="leading-tight">
            <p className="text-sm font-bold tracking-wide">SIEMI PKTJ</p>
            <p className="text-[11px] text-pktj-200">Sistem Evaluasi Mutu Internal</p>
          </div>
        </div>

        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
          {menu.map((m) => (
            <div key={m.ke || m.kunci}>
              {m.judul && (
                <p className="px-3 pb-2 pt-3 text-[10px] font-bold uppercase tracking-wider text-pktj-300">
                  {m.judul}
                </p>
              )}
              {m.tipe === 'grup' ? (
                <GrupMenuSpme grup={m} tutup={() => setBuka(false)} />
              ) : (
                <NavLink
                  to={m.ke}
                  end={m.ke === '/beranda'}
                  onClick={() => setBuka(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                      isActive
                        ? 'bg-white/15 font-semibold text-white'
                        : 'text-pktj-100 hover:bg-white/10'
                    }`
                  }
                >
                  <m.ikon />
                  <span>{m.label}</span>
                </NavLink>
              )}
            </div>
          ))}
        </nav>

        <div className="shrink-0 border-t border-white/10 p-4">
          <div className="mb-3 rounded-lg bg-white/10 px-3 py-2">
            <p className="text-[10px] uppercase tracking-wider text-pktj-300">
              Periode aktif
            </p>
            <p className="mt-0.5 text-xs font-medium leading-snug">
              {periode?.name || 'Belum ada periode'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <NavLink to="/profil" onClick={() => setBuka(false)}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-pktj-600 text-xs font-bold hover:bg-pktj-500"
              title="Profil Saya">
              {user?.name?.split(' ').map((w) => w[0]).slice(0, 2).join('')}
            </NavLink>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold">{user?.name}</p>
              <p className="truncate text-[11px] text-pktj-300">
                {ROLE_LABEL[user?.role]}
              </p>
            </div>
            <NavLink to="/profil" onClick={() => setBuka(false)}
              className="rounded-lg p-2 text-pktj-200 hover:bg-white/10" title="Profil Saya">
              <Icon.Pengguna width={16} height={16} />
            </NavLink>
            <button onClick={logout} className="rounded-lg p-2 text-pktj-200 hover:bg-white/10" title="Keluar">
              <Icon.Keluar width={16} height={16} />
            </button>
          </div>
        </div>
      </aside>

      {buka && (
        <div
          className="no-print fixed inset-0 z-30 bg-slate-900/50 lg:hidden"
          onClick={() => setBuka(false)}
        />
      )}

      {/* ------------------------------ Konten ------------------------------ */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-slate-200 bg-white px-4 lg:px-8">
          <button
            className="btn-ghost btn-sm lg:hidden"
            onClick={() => setBuka(true)}
            aria-label="Buka menu"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 6h18M3 12h18M3 18h18" />
            </svg>
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-slate-800">
              Politeknik Keselamatan Transportasi Jalan
            </p>
            <p className="truncate text-xs text-slate-500">
              {user?.unit_name || 'Sistem Penjaminan Mutu'}
            </p>
          </div>
          <span className="hidden rounded-full bg-pktj-50 px-3 py-1 text-xs font-medium text-pktj-700 sm:inline">
            {ROLE_LABEL[user?.role]}
          </span>
        </header>

        <main className="flex-1 p-4 lg:p-8">{children}</main>

        <footer className="no-print border-t border-slate-200 px-4 py-4 text-center text-xs text-slate-400 lg:px-8">
          SIEMI PKTJ — mengacu pada ISO 21001:2018 dan Instrumen Akreditasi LAM Teknik 2025
        </footer>
      </div>
    </div>
  );
}
