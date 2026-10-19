import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, tanggalID } from '../../api.js';
import LayoutPublik from '../../components/LayoutPublik.jsx';
import { Icon } from '../../components/ui.jsx';

export default function BerandaPublik() {
  const [berita, setBerita] = useState(null);

  useEffect(() => {
    api.get('/publik/berita?limit=3').then((r) => setBerita(r.items)).catch(() => setBerita([]));
  }, []);

  return (
    <LayoutPublik>
      {/* Hero */}
      <section className="bg-pktj-800 text-white">
        <div className="mx-auto max-w-6xl px-4 py-16 lg:px-8 lg:py-24">
          <h1 className="max-w-2xl text-3xl font-bold leading-tight lg:text-4xl">
            Penjaminan Mutu Internal Politeknik Keselamatan Transportasi Jalan
          </h1>
          <p className="mt-4 max-w-xl leading-relaxed text-pktj-100">
            Informasi berita, halaman resmi, dan capaian penjaminan mutu PKTJ —
            mengacu pada siklus PPEPP, ISO 21001:2018, dan Instrumen Akreditasi LAM Teknik.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/berita" className="btn-primary bg-aksen-500 text-pktj-900 hover:bg-aksen-400">
              Lihat Berita
            </Link>
            <Link to="/rekapitulasi-mutu" className="btn-outline border-white/30 bg-transparent text-white hover:bg-white/10">
              Rekapitulasi Mutu
            </Link>
          </div>
        </div>
      </section>

      {/* Berita terbaru */}
      <section className="mx-auto max-w-6xl px-4 pb-16 pt-10 lg:px-8">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">Berita Terbaru</h2>
          <Link to="/berita" className="text-sm font-medium text-pktj-600 hover:underline">
            Semua berita →
          </Link>
        </div>

        {berita === null ? (
          <p className="text-sm text-slate-400">Memuat berita…</p>
        ) : berita.length === 0 ? (
          <p className="text-sm text-slate-400">Belum ada berita yang diterbitkan.</p>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {berita.map((b) => (
              <Link key={b.slug} to={`/berita/${b.slug}`}
                className="card overflow-hidden transition-shadow hover:shadow-md">
                {b.cover_url ? (
                  <img src={b.cover_url} alt="" className="h-40 w-full object-cover" />
                ) : (
                  <div className="flex h-40 w-full items-center justify-center bg-pktj-50 text-pktj-300">
                    <Icon.Dashboard width={32} height={32} />
                  </div>
                )}
                <div className="p-4">
                  <p className="text-xs text-slate-400">{tanggalID(b.published_at)}</p>
                  <h3 className="mt-1 line-clamp-2 font-semibold text-slate-900">{b.title}</h3>
                  {b.excerpt && (
                    <p className="mt-1.5 line-clamp-2 text-sm text-slate-500">{b.excerpt}</p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </LayoutPublik>
  );
}
