import { useEffect, useState } from 'react';
import { api, tanggalWaktuID } from '../api.js';
import {
  Badge, Icon, JudulHalaman, Kosong, Memuat, Modal, useToast,
} from '../components/ui.jsx';
import { RenderMarkdownRingan } from '../lib/markdownRingan.jsx';

const KOSONG_POST = { title: '', excerpt: '', content: '', cover_url: '', status: 'draft', slug: '' };
const KOSONG_PAGE = { title: '', content: '', status: 'draft', sort_order: 0, slug: '', parent_id: '', external_url: '' };

export default function KelolaKonten() {
  const { tampil, Toast } = useToast();
  const [tab, setTab] = useState('berita'); // 'berita' | 'halaman'

  const [posts, setPosts] = useState(null);
  const [pages, setPages] = useState(null);

  const [aktif, setAktif] = useState(null);   // { ...item, baru: bool }
  const [form, setForm] = useState({});
  const [pratinjau, setPratinjau] = useState(false);
  const [simpan, setSimpan] = useState(false);
  const [unggahProses, setUnggahProses] = useState(false);

  async function muatPosts() { setPosts(await api.get('/konten/posts')); }
  async function muatPages() { setPages(await api.get('/konten/pages')); }

  useEffect(() => {
    if (tab === 'berita' && posts === null) muatPosts();
    if (tab === 'halaman' && pages === null) muatPages();
  }, [tab]);

  function bukaBaru() {
    setForm(tab === 'berita' ? { ...KOSONG_POST } : { ...KOSONG_PAGE });
    setPratinjau(false);
    setAktif({ baru: true });
  }

  function bukaEdit(item) {
    setForm(
      tab === 'berita'
        ? { title: item.title, excerpt: item.excerpt || '', content: item.content, cover_url: item.cover_url || '', status: item.status, slug: item.slug }
        : { title: item.title, content: item.content, status: item.status, sort_order: item.sort_order, slug: item.slug, parent_id: item.parent_id || '', external_url: item.external_url || '' }
    );
    setPratinjau(false);
    setAktif({ ...item, baru: false });
  }

  function tutup() { setAktif(null); }

  async function unggahSampul(file) {
    if (!file) return;
    const data = await new Promise((res) => {
      const r = new FileReader();
      r.onload = () => res(r.result);
      r.readAsDataURL(file);
    });
    setUnggahProses(true);
    try {
      const r = await api.post('/konten/unggah-sampul', { filename: file.name, data });
      setForm((p) => ({ ...p, cover_url: r.url }));
      tampil('Gambar sampul terunggah');
    } catch (e) { tampil(e.message, 'galat'); }
    finally { setUnggahProses(false); }
  }

  async function simpanForm() {
    // Isi hanya wajib bila halaman ini BUKAN redirect ke tautan eksternal —
    // begitu Tautan Eksternal diisi, isi diabaikan sepenuhnya di sisi publik
    // (lihat routes/konten.js dan LayoutPublik.jsx).
    const bolehKosongkanIsi = tab === 'halaman' && form.external_url?.trim();
    if (!form.title?.trim() || (!bolehKosongkanIsi && !form.content?.trim()))
      return tampil('Judul wajib diisi, dan isi wajib diisi kecuali halaman ini memakai tautan eksternal', 'galat');
    setSimpan(true);
    try {
      if (tab === 'berita') {
        if (aktif.baru) await api.post('/konten/posts', form);
        else await api.put(`/konten/posts/${aktif.id}`, form);
        await muatPosts();
      } else {
        if (aktif.baru) await api.post('/konten/pages', form);
        else await api.put(`/konten/pages/${aktif.id}`, form);
        await muatPages();
      }
      tampil(aktif.baru ? 'Konten baru dibuat' : 'Perubahan disimpan');
      tutup();
    } catch (e) { tampil(e.message, 'galat'); }
    finally { setSimpan(false); }
  }

  async function hapus(item) {
    if (!confirm(`Hapus "${item.title}"? Tindakan ini tidak dapat dibatalkan.`)) return;
    try {
      if (tab === 'berita') { await api.del(`/konten/posts/${item.id}`); await muatPosts(); }
      else { await api.del(`/konten/pages/${item.id}`); await muatPages(); }
      tampil('Konten dihapus');
    } catch (e) { tampil(e.message, 'galat'); }
  }

  const daftar = tab === 'berita' ? posts : pages;

  return (
    <>
      <Toast />
      <JudulHalaman
        ikon={<Icon.Pena width={20} height={20} />}
        judul="Berita & Halaman"
        deskripsi="Kelola konten beranda publik kampus — berita, pengumuman, dan halaman."
        aksi={<button onClick={bukaBaru} className="btn-primary"><Icon.Plus width={16} height={16} /> Tulis Baru</button>}
      />

      <div className="no-print mb-5 flex gap-2">
        {[['berita', 'Berita'], ['halaman', 'Halaman']].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${
              tab === k ? 'bg-pktj-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-100'
            }`}>
            {l}
          </button>
        ))}
      </div>

      {daftar === null ? (
        <Memuat />
      ) : daftar.length === 0 ? (
        <Kosong judul={tab === 'berita' ? 'Belum ada berita' : 'Belum ada halaman'}
          pesan="Klik &quot;Tulis Baru&quot; untuk membuat konten pertama." />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr>
                <th className="th">Judul</th>
                <th className="th w-32">Status</th>
                {tab === 'berita' && <th className="th w-40">Tanggal Terbit</th>}
                <th className="th w-40">Terakhir Diubah</th>
                <th className="th w-28"></th>
              </tr>
            </thead>
            <tbody>
              {daftar.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/60">
                  <td className="td">
                    <p className={`font-medium text-slate-800 ${tab === 'halaman' && item.parent_id ? 'pl-4' : ''}`}>
                      {tab === 'halaman' && item.parent_id && <span className="mr-1.5 text-slate-300">↳</span>}
                      {item.title}
                      {tab === 'halaman' && item.external_url && (
                        <span className="ml-2 badge bg-sky-100 text-sky-800" title={item.external_url}>
                          ↗ Eksternal
                        </span>
                      )}
                    </p>
                    <p className={`font-mono text-[11px] text-slate-400 ${tab === 'halaman' && item.parent_id ? 'pl-4' : ''}`}>
                      {tab === 'halaman' && item.external_url ? item.external_url : `/${tab === 'berita' ? 'berita' : 'halaman'}/${item.slug}`}
                      {tab === 'halaman' && item.parent_title && (
                        <span className="ml-2 font-sans text-slate-400">· di bawah {item.parent_title}</span>
                      )}
                    </p>
                  </td>
                  <td className="td">
                    <Badge status={item.status === 'terbit' ? 'ditetapkan' : 'draft'}>
                      {item.status === 'terbit' ? 'Terbit' : 'Draf'}
                    </Badge>
                  </td>
                  {tab === 'berita' && (
                    <td className="td text-xs text-slate-500">
                      {item.published_at ? tanggalWaktuID(item.published_at) : '-'}
                    </td>
                  )}
                  <td className="td text-xs text-slate-500">{tanggalWaktuID(item.updated_at)}</td>
                  <td className="td">
                    <div className="flex justify-end gap-1.5">
                      <button onClick={() => bukaEdit(item)} className="btn-ghost btn-sm" title="Ubah">
                        <Icon.Pena width={14} height={14} />
                      </button>
                      <button onClick={() => hapus(item)} className="btn-ghost btn-sm text-rose-600" title="Hapus">
                        <Icon.Hapus width={14} height={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Formulir tulis/ubah */}
      <Modal
        open={!!aktif}
        onClose={tutup}
        title={aktif?.baru ? `Tulis ${tab === 'berita' ? 'Berita' : 'Halaman'} Baru` : `Ubah ${tab === 'berita' ? 'Berita' : 'Halaman'}`}
        lebar="max-w-3xl"
        footer={
          <>
            <button onClick={tutup} className="btn-outline">Batal</button>
            <button onClick={simpanForm} className="btn-primary" disabled={simpan}>
              {simpan ? 'Menyimpan…' : 'Simpan'}
            </button>
          </>
        }
      >
        {aktif && (
          <div className="space-y-4">
            <div>
              <label className="label">Judul *</label>
              <input className="input" value={form.title}
                onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} />
            </div>

            {tab === 'berita' && (
              <>
                <div>
                  <label className="label">Ringkasan singkat</label>
                  <input className="input" value={form.excerpt}
                    onChange={(e) => setForm((p) => ({ ...p, excerpt: e.target.value }))}
                    placeholder="Tampil pada daftar berita, opsional" />
                </div>
                <div>
                  <label className="label">Gambar sampul</label>
                  <div className="flex items-center gap-3">
                    {form.cover_url && (
                      <img src={form.cover_url} alt="" className="h-14 w-20 rounded-lg object-cover" />
                    )}
                    <label className="btn-outline btn-sm cursor-pointer">
                      {unggahProses ? 'Mengunggah…' : (form.cover_url ? 'Ganti gambar' : 'Unggah gambar')}
                      <input type="file" accept="image/*" className="hidden"
                        onChange={(e) => unggahSampul(e.target.files?.[0])} />
                    </label>
                  </div>
                </div>
              </>
            )}

            {tab === 'halaman' && (
              <div className="flex flex-wrap gap-4">
                <div>
                  <label className="label">Urutan tampil di menu</label>
                  <input type="number" className="input w-32" value={form.sort_order}
                    onChange={(e) => setForm((p) => ({ ...p, sort_order: e.target.value }))} />
                </div>
                <div className="flex-1 min-w-[220px]">
                  <label className="label">Letakkan di bawah</label>
                  <select className="select" value={form.parent_id || ''}
                    onChange={(e) => setForm((p) => ({ ...p, parent_id: e.target.value }))}>
                    <option value="">(Tidak ada — halaman utama)</option>
                    {(pages || [])
                      .filter((p) => !p.parent_id && p.id !== aktif?.id)
                      .map((p) => (
                        <option key={p.id} value={p.id}>{p.title}</option>
                      ))}
                  </select>
                  <p className="mt-1 text-[11px] text-slate-400">
                    Jadikan halaman ini sub-halaman, mis. sub-menu di bawah SPMI/SPME. Hanya bisa satu tingkat.
                  </p>
                </div>
              </div>
            )}

            {tab === 'halaman' && (
              <div>
                <label className="label">Tautan Eksternal</label>
                <input type="text" className="input" value={form.external_url}
                  onChange={(e) => setForm((p) => ({ ...p, external_url: e.target.value }))}
                  placeholder="mis. https://situs-lain.go.id — kosongkan bila tidak dipakai" />
                <p className="mt-1 text-[11px] text-slate-400">
                  Jika diisi, menu/sub-menu halaman ini akan langsung mengarahkan (redirect, tab yang sama)
                  ke alamat ini — isi halaman di bawah diabaikan sepenuhnya.
                </p>
              </div>
            )}

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label className="label !mb-0">
                  Isi {tab === 'halaman' && form.external_url?.trim() ? '(diabaikan — Tautan Eksternal aktif)' : '*'}
                </label>
                <button type="button" onClick={() => setPratinjau((v) => !v)}
                  className="text-xs font-medium text-pktj-600 hover:underline">
                  {pratinjau ? '← Tulis' : 'Pratinjau →'}
                </button>
              </div>
              {pratinjau ? (
                <div className="min-h-[220px] rounded-lg border border-slate-200 p-4">
                  <RenderMarkdownRingan teks={form.content} />
                </div>
              ) : (
                <>
                  <textarea className="textarea min-h-[220px] font-mono text-sm" value={form.content}
                    onChange={(e) => setForm((p) => ({ ...p, content: e.target.value }))}
                    placeholder={'## Judul bagian\n\nTulis isi di sini. Format yang didukung: **tebal**, *miring*, [tautan](https://...), daftar dengan "- ".'} />
                  <p className="mt-1 text-[11px] text-slate-400">
                    Format sederhana: <code>## judul</code>, <code>**tebal**</code>, <code>*miring*</code>,{' '}
                    <code>[teks](https://...)</code>, baris diawali <code>- </code> untuk daftar.
                  </p>
                </>
              )}
            </div>

            <div className="flex items-center gap-3 rounded-lg bg-slate-50 p-3">
              <label className="label !mb-0">Status</label>
              <select className="select w-auto" value={form.status}
                onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}>
                <option value="draft">Draf (belum tampil di publik)</option>
                <option value="terbit">Terbit (tampil di publik)</option>
              </select>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
