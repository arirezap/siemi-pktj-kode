import { useEffect, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { api } from '../../api.js';
import LayoutPublik from '../../components/LayoutPublik.jsx';
import { Kosong, Memuat } from '../../components/ui.jsx';
import { RenderMarkdownRingan } from '../../lib/markdownRingan.jsx';

export default function HalamanStatis() {
  const { slug } = useParams();
  const { hash } = useLocation();
  const [h, setH] = useState(undefined); // undefined = memuat, null = tidak ditemukan

  useEffect(() => {
    setH(undefined);
    api.get(`/publik/halaman/${slug}`).then(setH).catch(() => setH(null));
  }, [slug]);

  // Jaring pengaman: halaman ini bisa saja diakses langsung (bookmark lama,
  // tautan dari luar) padahal sudah diberi Tautan Eksternal lewat Halaman >
  // Kelola Konten (lihat LayoutPublik.jsx, yang normalnya sudah tidak lagi
  // menautkan ke sini untuk halaman semacam ini) — redirect langsung di tab
  // yang sama alih-alih menampilkan halaman kosong.
  useEffect(() => {
    if (h?.external_url) window.location.href = h.external_url;
  }, [h]);

  // React Router tidak otomatis menggulir ke #jangkar pada navigasi sisi
  // klien (beda dengan navigasi berkas HTML biasa) — dilakukan manual di
  // sini setelah konten selesai dimuat & dirender, dipakai submenu SPMI/SPME
  // di LayoutPublik.jsx untuk langsung menuju bagian yang dipilih.
  useEffect(() => {
    if (!hash || h === undefined || h === null) return;
    const id = decodeURIComponent(hash.slice(1));
    const timer = setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
    return () => clearTimeout(timer);
  }, [hash, h]);

  // Semua Hook di atas sudah selalu dipanggil setiap render (Rules of
  // Hooks) — baru di sini aman untuk early-return saat redirect berlangsung,
  // supaya tidak sempat menampilkan halaman kosong sebelum browser pindah.
  if (h?.external_url) return null;

  return (
    <LayoutPublik>
      <div className="mx-auto max-w-3xl px-4 py-10 lg:px-8">
        {h === undefined ? (
          <Memuat teks="Memuat halaman…" />
        ) : h === null ? (
          <Kosong judul="Halaman tidak ditemukan" pesan="Halaman ini mungkin sudah dihapus atau belum diterbitkan." />
        ) : (
          <article>
            <h1 className="text-2xl font-bold text-slate-900 lg:text-3xl">{h.title}</h1>
            <div className="mt-6">
              <RenderMarkdownRingan teks={h.content} />
            </div>
          </article>
        )}
      </div>
    </LayoutPublik>
  );
}
