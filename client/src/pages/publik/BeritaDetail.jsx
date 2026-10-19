import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, tanggalID } from '../../api.js';
import LayoutPublik from '../../components/LayoutPublik.jsx';
import { Icon, Kosong, Memuat } from '../../components/ui.jsx';
import { RenderMarkdownRingan } from '../../lib/markdownRingan.jsx';

export default function BeritaDetail() {
  const { slug } = useParams();
  const [b, setB] = useState(undefined); // undefined = memuat, null = tidak ditemukan

  useEffect(() => {
    setB(undefined);
    api.get(`/publik/berita/${slug}`).then(setB).catch(() => setB(null));
  }, [slug]);

  return (
    <LayoutPublik>
      <div className="mx-auto max-w-3xl px-4 py-10 lg:px-8">
        <Link to="/berita" className="inline-flex items-center gap-1.5 text-sm font-medium text-pktj-600 hover:underline">
          <Icon.Kembali width={16} height={16} /> Semua berita
        </Link>

        {b === undefined ? (
          <Memuat teks="Memuat berita…" />
        ) : b === null ? (
          <Kosong judul="Berita tidak ditemukan" pesan="Berita ini mungkin sudah dihapus atau belum diterbitkan." />
        ) : (
          <article className="mt-6">
            {b.cover_url && (
              <img src={b.cover_url} alt="" className="mb-6 h-64 w-full rounded-xl object-cover" />
            )}
            <p className="text-xs text-slate-400">{tanggalID(b.published_at)}</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900 lg:text-3xl">{b.title}</h1>
            <div className="mt-6">
              <RenderMarkdownRingan teks={b.content} />
            </div>
          </article>
        )}
      </div>
    </LayoutPublik>
  );
}
