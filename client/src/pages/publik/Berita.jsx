import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, tanggalID } from '../../api.js';
import LayoutPublik from '../../components/LayoutPublik.jsx';
import { Icon, Kosong, Memuat } from '../../components/ui.jsx';

const HALAMAN = 9;

export default function Berita() {
  const [items, setItems] = useState(null);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [memuatLagi, setMemuatLagi] = useState(false);

  useEffect(() => {
    setItems(null);
    setOffset(0);
    api.get(`/publik/berita?limit=${HALAMAN}&offset=0`)
      .then((r) => { setItems(r.items); setTotal(r.total); });
  }, []);

  async function muatLagi() {
    setMemuatLagi(true);
    try {
      const r = await api.get(`/publik/berita?limit=${HALAMAN}&offset=${offset + HALAMAN}`);
      setItems((p) => [...p, ...r.items]);
      setOffset((o) => o + HALAMAN);
      setTotal(r.total);
    } finally { setMemuatLagi(false); }
  }

  return (
    <LayoutPublik>
      <div className="mx-auto max-w-6xl px-4 py-10 lg:px-8">
        <h1 className="text-2xl font-bold text-slate-900">Berita</h1>
        <p className="mt-1 text-sm text-slate-500">Kabar dan pengumuman dari Politeknik Keselamatan Transportasi Jalan.</p>

        {items === null ? (
          <Memuat teks="Memuat berita…" />
        ) : items.length === 0 ? (
          <Kosong judul="Belum ada berita" pesan="Berita akan muncul di sini setelah diterbitkan." />
        ) : (
          <>
            <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((b) => (
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
                    {b.excerpt && <p className="mt-1.5 line-clamp-2 text-sm text-slate-500">{b.excerpt}</p>}
                  </div>
                </Link>
              ))}
            </div>

            {items.length < total && (
              <div className="mt-8 text-center">
                <button onClick={muatLagi} disabled={memuatLagi} className="btn-outline">
                  {memuatLagi ? 'Memuat…' : 'Muat lebih banyak'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </LayoutPublik>
  );
}
