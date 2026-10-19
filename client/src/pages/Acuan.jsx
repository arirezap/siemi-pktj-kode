import { useEffect, useMemo, useState } from 'react';
import { api, tanggalID, unduhBerkas } from '../api.js';
import { useAuth } from '../auth.jsx';
import {
  Icon, JudulHalaman, Kosong, Memuat, Modal, Progres, useToast,
} from '../components/ui.jsx';

const TIPE_BUTIR = [
  'klausul', 'kriteria', 'sub_kriteria', 'elemen', 'kategori', 'area', 'standar', 'kelompok', 'butir',
];

export default function Acuan() {
  const { bolehSPM } = useAuth();
  const { tampil, Toast } = useToast();

  const [daftar, setDaftar] = useState(null);
  const [aktif, setAktif] = useState(null);      // id acuan terpilih
  const [pohon, setPohon] = useState(null);
  const [cari, setCari] = useState('');
  const [mAcuan, setMAcuan] = useState(null);
  const [acuanJenjangManual, setAcuanJenjangManual] = useState(false);
  const [jenjangList, setJenjangList] = useState([]);
  const [mButir, setMButir] = useState(null);
  const [mImpor, setMImpor] = useState(false);
  const [teksImpor, setTeksImpor] = useState('');
  const [hasilImpor, setHasilImpor] = useState(null);

  async function muat() {
    const [d, jj] = await Promise.all([api.get('/acuan'), api.get('/master/jenjang')]);
    setDaftar(d);
    setJenjangList(jj);
    if (!aktif && d.length) setAktif(d[0].id);
  }
  useEffect(() => { muat(); }, []);

  async function muatPohon() {
    if (!aktif) return;
    setPohon(null);
    setPohon(await api.get(`/acuan/${aktif}/butir`));
  }
  useEffect(() => { muatPohon(); }, [aktif]);

  const butirTersaring = useMemo(() => {
    const b = pohon?.butir || [];
    const q = cari.trim().toLowerCase();
    if (!q) return b;
    return b.filter(
      (x) =>
        x.code.toLowerCase().includes(q) ||
        x.title.toLowerCase().includes(q) ||
        (x.uraian || '').toLowerCase().includes(q)
    );
  }, [pohon, cari]);

  async function simpanAcuan() {
    try {
      if (mAcuan.id) await api.put(`/acuan/${mAcuan.id}`, mAcuan);
      else await api.post('/acuan', mAcuan);
      tampil('Acuan tersimpan');
      setMAcuan(null);
      muat();
    } catch (e) { tampil(e.message, 'galat'); }
  }

  async function simpanButir() {
    try {
      if (mButir.id) await api.put(`/acuan/butir/${mButir.id}`, mButir);
      else await api.post(`/acuan/${aktif}/butir`, mButir);
      tampil('Butir tersimpan');
      setMButir(null);
      muatPohon();
      muat();
    } catch (e) { tampil(e.message, 'galat'); }
  }

  async function hapusButir(b) {
    if (!confirm(`Hapus butir ${b.code} beserta seluruh turunannya?`)) return;
    await api.del(`/acuan/butir/${b.id}`);
    muatPohon(); muat();
  }

  /** Tempel dari Excel: kolom dipisah TAB, satu butir per baris */
  async function jalankanImpor() {
    const baris = teksImpor
      .split('\n')
      .map((l) => l.replace(/\r$/, ''))
      .filter((l) => l.trim())
      .map((l) => {
        const k = l.split('\t');
        return {
          kode: k[0], judul: k[1], uraian: k[2] || null,
          kode_induk: k[3] || null, tipe: k[4] || 'butir',
          bobot: k[5] ? Number(k[5]) : null, payung: k[6] || null,
          target: k[7] || null, target_skor: k[8] || null,
          satuan: k[9] || null, strategy: k[10] || null,
        };
      });

    // Buang baris judul bila ada
    if (baris[0] && /^kode$/i.test(String(baris[0].kode).trim())) baris.shift();
    if (!baris.length) return tampil('Tidak ada baris yang terbaca', 'galat');

    try {
      const r = await api.post(`/acuan/${aktif}/impor`, { baris });
      setHasilImpor(r);
      tampil(`${r.ditambah} butir baru, ${r.diperbarui} diperbarui`);
      muatPohon(); muat();
    } catch (e) { tampil(e.message, 'galat'); }
  }

  if (!daftar) return <Memuat />;

  const acuanAktif = daftar.find((a) => a.id === aktif);
  const indent = (lv) => ({ paddingLeft: `${(lv - 1) * 22}px` });

  async function unduhMatriks() {
    try {
      await unduhBerkas('/acuan/export', 'Matriks_Acuan_Mutu.xlsx');
    } catch (e) { tampil(e.message, 'galat'); }
  }

  return (
    <>
      <Toast />
      <JudulHalaman
        ikon={<Icon.Acuan width={20} height={20} />}
        judul="Acuan Mutu"
        deskripsi="Acuan eksternal yang berlaku di PKTJ beserta butir-butirnya. Butir inilah yang dipetakan ke standar dan indikator pada Modul 1."
        aksi={
          <>
            <button onClick={unduhMatriks} className="btn-outline">
              <Icon.Unduh width={16} height={16} /> Ekspor Excel
            </button>
            {bolehSPM && (
              <button
                onClick={() => {
                  setMAcuan({ code: '', name: '', version: '', publisher: '', keterangan: '', jenjang: null });
                  setAcuanJenjangManual(false);
                }}
                className="btn-primary"
              >
                <Icon.Plus width={16} height={16} /> Acuan Baru
              </button>
            )}
          </>
        }
      />

      {/* Kartu acuan */}
      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {daftar.map((a) => {
          const persen = a.butir_wajib
            ? Math.round((a.butir_terpetakan / a.butir_wajib) * 100)
            : null;
          return (
            <button
              key={a.id}
              onClick={() => setAktif(a.id)}
              className={`card-p text-left transition-all hover:shadow-md ${
                a.id === aktif ? 'ring-2 ring-pktj-500' : ''
              }`}
            >
              <div className="mb-2 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <span
                    className="badge"
                    style={{
                      background: (a.warna || '#64748b') + '22',
                      color: a.warna || '#475569',
                    }}
                  >
                    {a.code}
                  </span>
                  <h3 className="mt-1.5 text-sm font-semibold leading-snug">{a.name}</h3>
                  {a.version && (
                    <p className="mt-0.5 text-xs text-slate-500">{a.version}</p>
                  )}
                </div>
              </div>

              {a.butir_wajib === 0 ? (
                <p className="mt-2 rounded-md bg-amber-50 px-2.5 py-1.5 text-[11px] leading-snug text-amber-800">
                  Belum ada butir. Unggah dari dokumen resmi.
                </p>
              ) : (
                <div className="mt-3">
                  <div className="mb-1 flex justify-between text-[11px] text-slate-500">
                    <span>{a.butir_wajib} butir/indikator</span>
                    <span className="font-semibold tabular-nums text-slate-700">
                      {persen ?? 0}%
                    </span>
                  </div>
                  <Progres nilai={persen ?? 0} />
                  <p className="mt-1 text-[11px] text-slate-500">
                    {a.butir_terpetakan} dari {a.butir_wajib} indikator sudah diadopsi
                  </p>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Pohon butir */}
      {acuanAktif && (
        <div className="card overflow-hidden">
          <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 px-5 py-3.5">
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-semibold">{acuanAktif.name}</h2>
              <p className="text-xs text-slate-500">
                {acuanAktif.publisher}
                {acuanAktif.effective_date && ` · berlaku ${tanggalID(acuanAktif.effective_date)}`}
              </p>
            </div>
            <input
              className="input max-w-xs"
              placeholder="Cari butir…"
              value={cari}
              onChange={(e) => setCari(e.target.value)}
            />
            {bolehSPM && (
              <>
                <button
                  onClick={() => { setMImpor(true); setTeksImpor(''); setHasilImpor(null); }}
                  className="btn-outline btn-sm"
                >
                  <Icon.Unggah width={14} height={14} /> Impor Butir
                </button>
                <button
                  onClick={() => setMButir({
                    code: '', title: '', uraian: '', tipe: 'butir', parent_id: null,
                    wajib_petakan: 1, target: '', target_skor: '', satuan: '', strategy: '',
                  })}
                  className="btn-primary btn-sm"
                >
                  <Icon.Plus width={14} height={14} /> Butir
                </button>
                <button
                  onClick={() => {
                    setMAcuan(acuanAktif);
                    setAcuanJenjangManual(!!acuanAktif.jenjang && !jenjangList.includes(acuanAktif.jenjang));
                  }}
                  className="btn-ghost btn-sm">
                  <Icon.Pena width={14} height={14} />
                </button>
              </>
            )}
          </div>

          {acuanAktif.keterangan && (
            <div className="border-b border-slate-100 bg-slate-50 px-5 py-3 text-xs leading-relaxed text-slate-600">
              {acuanAktif.keterangan}
            </div>
          )}

          {!pohon ? (
            <Memuat />
          ) : butirTersaring.length === 0 ? (
            <Kosong
              judul={cari ? 'Butir tidak ditemukan' : 'Belum ada butir acuan'}
              pesan={
                cari
                  ? 'Ubah kata kunci pencarian.'
                  : 'Unggah butir dari dokumen resmi menggunakan tombol Impor Butir, atau tambahkan satu per satu.'
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="th w-40">Kode</th>
                    <th className="th">Judul Butir</th>
                    <th className="th w-32">Tipe</th>
                    <th className="th w-40">Indikator</th>
                    <th className="th w-28">Adopsi</th>
                    {bolehSPM && <th className="th w-24"></th>}
                  </tr>
                </thead>
                <tbody>
                  {butirTersaring.map((b) => (
                    <tr key={b.id} className={b.wajib_petakan ? '' : 'bg-slate-50/60'}>
                      <td className="td">
                        <span
                          className="font-mono text-xs font-semibold text-pktj-700"
                          style={indent(b.level)}
                        >
                          {b.code}
                        </span>
                      </td>
                      <td className="td">
                        <p className={b.wajib_petakan ? 'text-sm' : 'text-sm font-semibold text-slate-600'}>
                          {b.title}
                        </p>
                        {b.uraian && (
                          <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{b.uraian}</p>
                        )}
                      </td>
                      <td className="td">
                        <span className="badge bg-slate-100 text-slate-600">
                          {String(b.tipe).replace('_', ' ')}
                        </span>
                      </td>
                      <td className="td">
                        {!b.wajib_petakan ? (
                          <span className="text-xs text-slate-400">payung</span>
                        ) : b.target ? (
                          <span className="badge bg-sky-100 text-sky-800" title={`Target Pencapaian: ${b.target}${b.target_skor ? ' · Target Skor: ' + b.target_skor : ''}${b.satuan ? ' ' + b.satuan : ''}`}>
                            siap diadopsi
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">belum ada target</span>
                        )}
                      </td>
                      <td className="td">
                        {b.jumlah_diadopsi > 0 ? (
                          <span className="badge bg-emerald-100 text-emerald-800">
                            {b.jumlah_diadopsi} indikator
                          </span>
                        ) : b.wajib_petakan ? (
                          <span className="badge bg-rose-100 text-rose-800">belum</span>
                        ) : (
                          <span className="text-xs text-slate-300">—</span>
                        )}
                      </td>
                      {bolehSPM && (
                        <td className="td">
                          <div className="flex gap-1">
                            <button onClick={() => setMButir(b)} className="btn-ghost btn-sm">
                              <Icon.Pena width={13} height={13} />
                            </button>
                            <button onClick={() => hapusButir(b)} className="btn-ghost btn-sm text-rose-600">
                              <Icon.Hapus width={13} height={13} />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Modal acuan */}
      <Modal
        open={!!mAcuan} onClose={() => setMAcuan(null)}
        title={mAcuan?.id ? 'Ubah Acuan' : 'Acuan Baru'}
        footer={
          <>
            <button onClick={() => setMAcuan(null)} className="btn-outline">Batal</button>
            <button onClick={simpanAcuan} className="btn-primary">Simpan</button>
          </>
        }
      >
        {mAcuan && (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className="label">Kode *</label>
                <input className="input font-mono" value={mAcuan.code}
                  onChange={(e) => setMAcuan({ ...mAcuan, code: e.target.value })}
                  placeholder="LAMTEKNIKSTR" />
              </div>
              <div className="sm:col-span-2">
                <label className="label">Nama acuan *</label>
                <input className="input" value={mAcuan.name}
                  onChange={(e) => setMAcuan({ ...mAcuan, name: e.target.value })} />
              </div>
              <div>
                <label className="label">Versi</label>
                <input className="input" value={mAcuan.version || ''}
                  onChange={(e) => setMAcuan({ ...mAcuan, version: e.target.value })}
                  placeholder="2025" />
              </div>
              <div className="sm:col-span-2">
                <label className="label">Penerbit</label>
                <input className="input" value={mAcuan.publisher || ''}
                  onChange={(e) => setMAcuan({ ...mAcuan, publisher: e.target.value })} />
              </div>
              <div>
                <label className="label">Tanggal berlaku</label>
                <input type="date" className="input" value={mAcuan.effective_date || ''}
                  onChange={(e) => setMAcuan({ ...mAcuan, effective_date: e.target.value })} />
              </div>
              <div>
                <label className="label">Warna lensa</label>
                <input type="color" className="input h-[38px] p-1" value={mAcuan.warna || '#1e488a'}
                  onChange={(e) => setMAcuan({ ...mAcuan, warna: e.target.value })} />
              </div>
            </div>
            {(() => {
              const custom = acuanJenjangManual || (!!mAcuan.jenjang && !jenjangList.includes(mAcuan.jenjang));
              return (
                <div>
                  <label className="label">Jenjang (khusus acuan akreditasi program studi)</label>
                  <select className="select" value={custom ? '__lain__' : (mAcuan.jenjang || '')}
                    onChange={(e) => {
                      if (e.target.value === '__lain__') {
                        setAcuanJenjangManual(true);
                        setMAcuan({ ...mAcuan, jenjang: '' });
                      } else {
                        setAcuanJenjangManual(false);
                        setMAcuan({ ...mAcuan, jenjang: e.target.value || null });
                      }
                    }}>
                    <option value="">Tidak berlaku (institusi/bukan akreditasi prodi)</option>
                    {jenjangList.map((j) => <option key={j} value={j}>{j}</option>)}
                    <option value="__lain__">+ Jenjang baru…</option>
                  </select>
                  {custom && (
                    <input className="input mt-2" autoFocus
                      placeholder="Nama jenjang baru, mis. Magister Terapan"
                      value={mAcuan.jenjang || ''}
                      onChange={(e) => setMAcuan({ ...mAcuan, jenjang: e.target.value })} />
                  )}
                  <p className="mt-1 text-xs text-slate-500">
                    Isi hanya untuk acuan LAM akreditasi program studi (mis. "Sarjana Terapan",
                    "Diploma III"). Modul Penjaminan Mutu Eksternal mencocokkan acuan ini ke unit
                    prodi yang jenjangnya sama persis di Data Master.
                  </p>
                </div>
              );
            })()}
            <div>
              <label className="label">Skala skor penilaian</label>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <input type="number" step="any" className="input" placeholder="Min"
                    value={mAcuan.skor_min ?? ''}
                    onChange={(e) => setMAcuan({ ...mAcuan, skor_min: e.target.value })} />
                  <p className="mt-0.5 text-[11px] text-slate-400">Skor minimum</p>
                </div>
                <div>
                  <input type="number" step="any" className="input" placeholder="Maks"
                    value={mAcuan.skor_maks ?? ''}
                    onChange={(e) => setMAcuan({ ...mAcuan, skor_maks: e.target.value })} />
                  <p className="mt-0.5 text-[11px] text-slate-400">Skor maksimum</p>
                </div>
                <div>
                  <input type="number" step="any" className="input" placeholder="Kelipatan"
                    value={mAcuan.skor_step ?? ''}
                    onChange={(e) => setMAcuan({ ...mAcuan, skor_step: e.target.value })} />
                  <p className="mt-0.5 text-[11px] text-slate-400">mis. 1 atau 0,25</p>
                </div>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Skala skor resmi acuan ini (bukan persen) — dipakai membatasi input skor auditor
                di Modul 3 dan sebagai dasar hitungan bobot×skor pada Penjaminan Mutu Eksternal.
                Contoh: BAN-PT/ISO 21001 0–1, LAM Teknik 0–4, GreenMetric 1–5, Zona Integritas
                0–1 kelipatan 0,25.
              </p>
            </div>
            <div>
              <label className="label">Keterangan</label>
              <textarea className="textarea min-h-[80px]" value={mAcuan.keterangan || ''}
                onChange={(e) => setMAcuan({ ...mAcuan, keterangan: e.target.value })}
                placeholder="Catatan tentang versi, kestabilan, dan cara memperlakukan acuan ini" />
            </div>
          </div>
        )}
      </Modal>

      {/* Modal butir */}
      <Modal
        open={!!mButir} onClose={() => setMButir(null)}
        title={mButir?.id ? `Ubah Butir ${mButir.code}` : 'Butir Acuan Baru'}
        footer={
          <>
            <button onClick={() => setMButir(null)} className="btn-outline">Batal</button>
            <button onClick={simpanButir} className="btn-primary">Simpan</button>
          </>
        }
      >
        {mButir && (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className="label">Kode butir *</label>
                <input className="input font-mono" value={mButir.code}
                  onChange={(e) => setMButir({ ...mButir, code: e.target.value })}
                  placeholder="LT-5.1" />
              </div>
              <div className="sm:col-span-2">
                <label className="label">Butir induk</label>
                <select className="select" value={mButir.parent_id || ''}
                  disabled={!!mButir.id}
                  onChange={(e) => setMButir({ ...mButir, parent_id: e.target.value || null })}>
                  <option value="">Tanpa induk (tingkat teratas)</option>
                  {(pohon?.butir || []).map((b) => (
                    <option key={b.id} value={b.id}>{b.code} — {b.title}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="label">Judul butir *</label>
              <input className="input" value={mButir.title}
                onChange={(e) => setMButir({ ...mButir, title: e.target.value })} />
            </div>
            <div>
              <label className="label">Redaksi lengkap dari dokumen asli</label>
              <textarea className="textarea" value={mButir.uraian || ''}
                onChange={(e) => setMButir({ ...mButir, uraian: e.target.value })}
                placeholder="Salin persis bunyi butir dari dokumen resmi" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label">Tipe butir</label>
                <select className="select" value={mButir.tipe}
                  onChange={(e) => setMButir({ ...mButir, tipe: e.target.value })}>
                  {TIPE_BUTIR.map((t) => (
                    <option key={t} value={t}>{t.replace('_', ' ')}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Bobot (bila acuan berbobot)</label>
                <input type="number" step="0.01" className="input" value={mButir.bobot || ''}
                  onChange={(e) => setMButir({ ...mButir, bobot: e.target.value })} />
              </div>
            </div>
            <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-slate-200 p-3">
              <input type="checkbox" className="mt-0.5 accent-pktj-600"
                checked={!mButir.wajib_petakan}
                onChange={(e) => setMButir({ ...mButir, wajib_petakan: e.target.checked ? 0 : 1 })} />
              <div>
                <p className="text-sm font-medium">Butir payung (judul pengelompokan)</p>
                <p className="text-xs text-slate-500">
                  Tidak dihitung dalam laporan cakupan karena bukan persyaratan yang harus dipetakan.
                </p>
              </div>
            </label>

            <div className="rounded-lg border border-sky-200 bg-sky-50 p-3.5">
              <p className="text-sm font-medium text-sky-900">Jadikan indikator siap diadopsi</p>
              <p className="mt-0.5 text-xs leading-relaxed text-sky-800">
                Isi Target Pencapaian agar butir ini muncul di pemilih indikator pada Modul 1.
                Saat dipilih di sana, judul/uraian, Target Pencapaian, Target Skor, satuan, dan
                strategi di bawah ini akan ditarik apa adanya — tidak digabung atau ditulis ulang.
                Target Skor dipakai untuk acuan berbasis rubrik skor (mis. LAM Teknik: skor 0-4);
                boleh dikosongkan bila acuan tidak memakainya.
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="label">Target Pencapaian</label>
                  <input className="input" value={mButir.target || ''}
                    onChange={(e) => setMButir({ ...mButir, target: e.target.value })}
                    placeholder="mis. 100% atau >= 3,5" />
                </div>
                <div>
                  <label className="label">Target Skor</label>
                  <input className="input" value={mButir.target_skor || ''}
                    onChange={(e) => setMButir({ ...mButir, target_skor: e.target.value })}
                    placeholder="mis. 4 (Skor Maksimal)" />
                </div>
                <div>
                  <label className="label">Satuan</label>
                  <input className="input" value={mButir.satuan || ''}
                    onChange={(e) => setMButir({ ...mButir, satuan: e.target.value })}
                    placeholder="mis. %, Skor (skala 1-4)" />
                </div>
                <div>
                  <label className="label">Strategi pencapaian</label>
                  <input className="input" value={mButir.strategy || ''}
                    onChange={(e) => setMButir({ ...mButir, strategy: e.target.value })}
                    placeholder="opsional" />
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal impor */}
      <Modal
        open={mImpor} onClose={() => setMImpor(false)}
        title={`Impor Butir — ${acuanAktif?.name || ''}`} lebar="max-w-3xl"
        footer={
          <>
            <button onClick={() => setMImpor(false)} className="btn-outline">Tutup</button>
            <button onClick={jalankanImpor} className="btn-primary">
              <Icon.Unggah width={16} height={16} /> Jalankan Impor
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="rounded-lg border border-pktj-200 bg-pktj-50 p-4 text-xs leading-relaxed text-pktj-900">
            <p className="mb-2 font-semibold">Cara memakai</p>
            <p>
              Susun butir acuan di Excel dengan sebelas kolom berikut, blok seluruh barisnya,
              salin, lalu tempel ke kotak di bawah. Kolom dipisah otomatis oleh tabulasi.
            </p>
            <ol className="mt-2 list-decimal space-y-0.5 pl-5">
              <li><b>Kode</b> — penomoran asli dari dokumen, wajib unik</li>
              <li><b>Judul</b> — nama butir, wajib</li>
              <li><b>Uraian</b> — redaksi lengkap, boleh kosong</li>
              <li><b>Kode induk</b> — kode butir di atasnya, kosongkan bila tingkat teratas</li>
              <li><b>Tipe</b> — klausul, kriteria, sub_kriteria, elemen, kategori, area</li>
              <li><b>Bobot</b> — angka, boleh kosong</li>
              <li><b>Payung</b> — isi <span className="font-mono">ya</span> bila butir ini hanya judul pengelompokan</li>
              <li><b>Target Pencapaian</b> — isi bila butir ini siap diadopsi jadi indikator di Modul 1, boleh kosong</li>
              <li><b>Target Skor</b> — target berbasis skor bila acuan memakai rubrik skor (mis. LAM Teknik), boleh kosong</li>
              <li><b>Satuan</b> — satuan target, boleh kosong</li>
              <li><b>Strategi</b> — strategi pencapaian, boleh kosong</li>
            </ol>
            <p className="mt-2">
              Butir dengan kode yang sudah ada akan diperbarui, bukan diduplikasi — jadi impor
              boleh dijalankan berulang kali. Butir dengan Target Pencapaian terisi akan langsung
              tampil di pemilih indikator Modul 1, ditarik apa adanya.
            </p>
            <p className="mt-2">
              Cara tercepat menyiapkan data: klik <b>Ekspor Excel</b> di pojok kanan atas halaman
              ini, buka sheet acuan yang dituju, sunting seperlunya, lalu salin baris-barisnya
              (boleh sertakan baris judul kolom) dan tempel di kotak bawah ini.
            </p>
          </div>

          <div>
            <label className="label">Tempel data di sini</label>
            <textarea
              className="textarea min-h-[200px] font-mono text-xs"
              value={teksImpor}
              onChange={(e) => setTeksImpor(e.target.value)}
              placeholder={'LT-5\tPendidikan\t\t\tsub_kriteria\t\tya\t\t\t\t\nLT-5.1\tKurikulum\tProgram studi memiliki kurikulum…\tLT-5\telemen\t4\t\t>=3,5\t4 (Skor Maksimal)\tskala 1-4\tEvaluasi kurikulum tahunan'}
            />
          </div>

          {hasilImpor && (
            <div className="rounded-lg border border-slate-200 p-4 text-sm">
              <p className="font-medium">
                {hasilImpor.ditambah} butir ditambahkan · {hasilImpor.diperbarui} diperbarui
              </p>
              {hasilImpor.gagal?.length > 0 && (
                <div className="mt-2">
                  <p className="text-xs font-semibold text-rose-700">
                    {hasilImpor.gagal.length} baris gagal:
                  </p>
                  <ul className="mt-1 max-h-40 space-y-0.5 overflow-y-auto text-xs text-rose-600">
                    {hasilImpor.gagal.map((g, i) => (
                      <li key={i}>Baris {g.baris} {g.kode ? `(${g.kode})` : ''} — {g.alasan}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </Modal>
    </>
  );
}
