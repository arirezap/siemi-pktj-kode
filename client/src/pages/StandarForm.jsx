import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, KELOMPOK, SIFAT, labelKategori } from '../api.js';
import { useAuth } from '../auth.jsx';
import { Badge, Icon, JudulHalaman, Memuat, Modal, useToast } from '../components/ui.jsx';
import { useRanah } from '../hooks/useRanah.js';

const RANAH_BARU_KOSONG = { code: '', label: '', pendek: '' };

const KOSONG = {
  code: '', ranah: 'D', kelompok: '', sifat: 'melampaui',
  title: '', rationale: '', scope: '', strategy: '',
};

const pernyataanKosong = () => ({ label: '', statement: '', rationale: '', indikator: [] });

const indikatorManualKosong = () => ({
  source_ref_item_id: null, indicator: '', target: '', target_skor: '', satuan: '',
  strategy: '', bukti_sahih: '', deadline: '', pengampu_unit_id: '', pelaksana_unit_ids: [],
});

export default function StandarForm() {
  const { id } = useParams();
  const baru = !id;
  const nav = useNavigate();
  const { periode, bolehSPM } = useAuth();
  const { tampil, Toast } = useToast();
  const { ranah: RANAH, tambahRanah } = useRanah();

  const [f, setF] = useState(KOSONG);
  const [mRanahBaru, setMRanahBaru] = useState(null); // { code, label, pendek } | null
  const [simpanRanah, setSimpanRanah] = useState(false);
  const [pernyataan, setPernyataan] = useState([pernyataanKosong()]);
  const [tanpaPernyataan, setTanpaPernyataan] = useState([]);
  const [units, setUnits] = useState([]);
  const [daftarAcuan, setDaftarAcuan] = useState([]);
  const [status, setStatus] = useState('draft');
  const [memuat, setMemuat] = useState(!baru);
  const [simpan, setSimpan] = useState(false);

  // Pemilih indikator lintas-acuan (adopsi apa adanya)
  const [mPilih, setMPilih] = useState(null);  // { p: indeks pernyataan } | null
  const [pilihRef, setPilihRef] = useState('');
  const [pilihCari, setPilihCari] = useState('');
  const [kandidat, setKandidat] = useState([]);
  const [memuatKandidat, setMemuatKandidat] = useState(false);

  const kunci = !bolehSPM;

  useEffect(() => {
    (async () => {
      const [u, a] = await Promise.all([api.get('/master/units'), api.get('/acuan')]);
      setUnits(u);
      setDaftarAcuan(a);
      if (baru) return;

      const s = await api.get(`/standar/${id}`);
      setF({
        code: s.code, ranah: s.ranah || 'D', kelompok: s.kelompok || '',
        sifat: s.sifat || 'melampaui', title: s.title,
        rationale: s.rationale || '', scope: s.scope || '', strategy: s.strategy || '',
      });
      const daftarPernyataan = (s.pernyataan || []).map((p) => ({
        id: p.id, label: p.label || '', statement: p.statement || '', rationale: p.rationale || '',
        indikator: (p.indikator || []).map((i) => ({
          id: i.id, source_ref_item_id: i.source_ref_item_id || null,
          code: i.code, indicator: i.indicator, target: i.target || '',
          target_skor: i.target_skor || '', satuan: i.satuan || '',
          strategy: i.strategy || '', bukti_sahih: i.bukti_sahih || '', deadline: i.deadline || '',
          acuan_kode: i.acuan_kode, acuan_nama: i.acuan_nama, warna: i.warna,
          butir_kode: i.butir_kode, butir_judul: i.butir_judul,
          pengampu_unit_id: i.units?.find((x) => x.peran === 'pengampu')?.unit_id || '',
          pelaksana_unit_ids: (i.units || [])
            .filter((x) => x.peran === 'pelaksana')
            .map((x) => x.unit_id),
        })),
      }));
      setPernyataan(daftarPernyataan.length ? daftarPernyataan : [pernyataanKosong()]);
      setTanpaPernyataan(s.indikator_tanpa_pernyataan || []);
      setStatus(s.status);
      setMemuat(false);
    })();
  }, [id]);

  const ubah = (k, v) => setF((p) => ({ ...p, [k]: v }));

  async function simpanRanahBaru() {
    if (!mRanahBaru?.code?.trim() || !mRanahBaru?.label?.trim()) {
      tampil('Kode dan label ranah wajib diisi', 'galat');
      return;
    }
    setSimpanRanah(true);
    try {
      const dibuat = await tambahRanah(mRanahBaru);
      ubah('ranah', dibuat.code);
      setMRanahBaru(null);
      tampil(`Ranah "${dibuat.code}" berhasil dibuat`);
    } catch (err) {
      tampil(err.message, 'galat');
    } finally {
      setSimpanRanah(false);
    }
  }

  const ubahPernyataan = (p, k, v) =>
    setPernyataan((prev) => prev.map((pp, pn) => (pn === p ? { ...pp, [k]: v } : pp)));

  const ubahIndikator = (p, i, k, v) =>
    setPernyataan((prev) =>
      prev.map((pp, pn) =>
        pn !== p ? pp : { ...pp, indikator: pp.indikator.map((it, n) => (n === i ? { ...it, [k]: v } : it)) }
      )
    );

  const tambahPernyataan = () => setPernyataan((prev) => [...prev, pernyataanKosong()]);

  const hapusPernyataan = (p) => {
    if (pernyataan[p]?.id && !confirm('Hapus pernyataan ini beserta seluruh indikatornya?')) return;
    setPernyataan((prev) => prev.filter((_, n) => n !== p));
  };

  const tambahManual = (p) =>
    setPernyataan((prev) =>
      prev.map((pp, pn) => (pn === p ? { ...pp, indikator: [...pp.indikator, indikatorManualKosong()] } : pp))
    );

  const hapusIndikator = (p, i) =>
    setPernyataan((prev) =>
      prev.map((pp, pn) => (pn !== p ? pp : { ...pp, indikator: pp.indikator.filter((_, n) => n !== i) }))
    );

  const wajibKelompok = ['A', 'B', 'C'].includes(f.ranah);

  // Ringkasan seluruh indikator (dipakai untuk validasi & panel ringkasan)
  const semuaIndikator = useMemo(() => pernyataan.flatMap((p) => p.indikator), [pernyataan]);
  const acuanSumber = useMemo(() => {
    const peta = new Map();
    semuaIndikator
      .filter((i) => i.source_ref_item_id)
      .forEach((i) => {
        const k = i.acuan_kode || '?';
        const ada = peta.get(k) || { kode: k, warna: i.warna, jumlah: 0 };
        ada.jumlah += 1;
        peta.set(k, ada);
      });
    return [...peta.values()];
  }, [semuaIndikator]);

  async function kirim(e) {
    e?.preventDefault();
    if (!f.code || !f.title) return tampil('Kode dan judul standar wajib diisi', 'galat');
    if (wajibKelompok && !f.kelompok)
      return tampil('Ranah A, B, dan C wajib memiliki kelompok Luaran/Proses/Masukan', 'galat');

    const pernyataanBersih = pernyataan
      .filter((p) => p.statement.trim())
      .map((p) => ({
        ...p,
        indikator: p.indikator.filter((it) => it.source_ref_item_id || it.indicator.trim()),
      }));

    if (!pernyataanBersih.length)
      return tampil('Minimal satu pernyataan standar harus diisi', 'galat');
    const kosong = pernyataanBersih.find((p) => !p.indikator.length);
    if (kosong)
      return tampil(
        `Pernyataan "${kosong.label || kosong.statement.slice(0, 40)}…" belum memiliki indikator`,
        'galat'
      );

    setSimpan(true);
    const body = {
      ...f,
      kelompok: wajibKelompok ? f.kelompok : null,
      category: labelKategori(f.ranah, wajibKelompok ? f.kelompok : null, RANAH),
      period_id: periode.id,
      pernyataan: pernyataanBersih.map((p) => ({
        id: p.id, label: p.label || null, statement: p.statement, rationale: p.rationale || null,
        indikator: p.indikator.map((it) => ({
          id: it.id,
          code: it.code || undefined,
          indicator: it.indicator || undefined,   // diabaikan server bila source_ref_item_id terisi
          target: it.target || undefined,
          target_skor: it.target_skor || undefined,
          satuan: it.satuan || undefined,
          strategy: it.strategy || undefined,
          bukti_sahih: it.bukti_sahih || undefined,
          deadline: it.deadline || null,
          source_ref_item_id: it.source_ref_item_id || null,
          pengampu_unit_id: it.pengampu_unit_id || null,
          pelaksana_unit_ids: it.pelaksana_unit_ids || [],
        })),
      })),
    };
    try {
      if (baru) {
        const r = await api.post('/standar', body);
        tampil('Standar tersimpan sebagai draf');
        nav(`/standar/${r.id}`, { replace: true });
      } else {
        await api.put(`/standar/${id}`, body);
        tampil('Perubahan tersimpan');
      }
    } catch (err) { tampil(err.message, 'galat'); }
    finally { setSimpan(false); }
  }

  async function tetapkan() {
    try {
      await api.post(`/standar/${id}/tetapkan`);
      setStatus('ditetapkan');
      tampil('Standar ditetapkan dan siap dilaksanakan unit terkait');
    } catch (e) { tampil(e.message, 'galat'); }
  }

  async function hapus() {
    if (!confirm('Hapus standar ini beserta seluruh pernyataan dan indikatornya?')) return;
    try {
      await api.del(`/standar/${id}`);
      nav('/standar');
    } catch (e) { tampil(e.message, 'galat'); }
  }

  /* -------------------- Pemilih indikator lintas-acuan ------------------- */
  function bukaPilih(p) {
    setMPilih({ p });
    setPilihRef('');
    setPilihCari('');
    setKandidat([]);
  }

  useEffect(() => {
    if (!mPilih) return;
    setMemuatKandidat(true);
    const t = setTimeout(async () => {
      const q = new URLSearchParams();
      if (pilihCari.trim()) q.set('cari', pilihCari.trim());
      if (pilihRef) q.set('ref_id', pilihRef);
      try {
        setKandidat(await api.get(`/acuan/kandidat-indikator?${q.toString()}`));
      } finally { setMemuatKandidat(false); }
    }, 250);
    return () => clearTimeout(t);
  }, [mPilih, pilihCari, pilihRef]);

  function pakaiKandidat(c) {
    setPernyataan((prev) =>
      prev.map((pp, pn) =>
        pn !== mPilih.p
          ? pp
          : {
              ...pp,
              indikator: [
                ...pp.indikator,
                {
                  source_ref_item_id: c.id,
                  indicator: c.uraian || c.title,
                  target: c.target || '', target_skor: c.target_skor || '',
                  satuan: c.satuan || '', strategy: c.strategy || '',
                  bukti_sahih: '', deadline: '',
                  acuan_kode: c.acuan_kode, acuan_nama: c.acuan_nama, warna: c.warna,
                  butir_kode: c.code, butir_judul: c.title,
                  pengampu_unit_id: '', pelaksana_unit_ids: [],
                },
              ],
            }
      )
    );
    tampil(`Indikator dari ${c.acuan_kode} ${c.code} ditambahkan — ditarik apa adanya`);
  }

  const sudahDipakai = (p, refItemId) =>
    (pernyataan[p]?.indikator || []).some((it) => it.source_ref_item_id === refItemId);

  if (memuat) return <Memuat />;

  return (
    <form onSubmit={kirim}>
      <Toast />
      <JudulHalaman
        ikon={<Icon.Standar width={20} height={20} />}
        judul={baru ? 'Standar Mutu Baru' : `Standar ${f.code}`}
        deskripsi={baru ? 'Modul 1 — Penetapan Standar' : f.title}
        aksi={
          <>
            <Link to="/standar" className="btn-outline">
              <Icon.Kembali width={16} height={16} /> Kembali
            </Link>
            {!baru && <Badge status={status} />}
            {bolehSPM && !baru && status === 'draft' && (
              <button type="button" onClick={tetapkan} className="btn-success">
                <Icon.Cek width={16} height={16} /> Tetapkan
              </button>
            )}
            {bolehSPM && (
              <button className="btn-primary" disabled={simpan}>
                <Icon.Simpan width={16} height={16} />
                {simpan ? 'Menyimpan…' : 'Simpan'}
              </button>
            )}
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Identitas */}
          <div className="card-p">
            <h2 className="mb-4 section-title">Identitas dan Posisi dalam Arsitektur</h2>
            <div className="grid gap-4 sm:grid-cols-6">
              <div className="sm:col-span-2">
                <label className="label">Kode standar *</label>
                <input className="input font-mono" value={f.code} disabled={kunci}
                  onChange={(e) => ubah('code', e.target.value)} placeholder="A.M.05+" />
                <p className="mt-1 text-[11px] text-slate-500">
                  Akhiri dengan tanda + bila melampaui SN Dikti
                </p>
              </div>
              <div className="sm:col-span-2">
                <label className="label">Ranah *</label>
                <select className="select" value={f.ranah} disabled={kunci || f.sifat === 'wajib'}
                  onChange={(e) => {
                    if (e.target.value === '__baru__') { setMRanahBaru(RANAH_BARU_KOSONG); return; }
                    ubah('ranah', e.target.value);
                  }}>
                  {Object.entries(RANAH).map(([k, v]) => (
                    <option key={k} value={k}>{v.label}</option>
                  ))}
                  <option value="__baru__">+ Ranah baru…</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="label">
                  Kelompok {wajibKelompok ? '*' : <span className="text-slate-400">(tidak berlaku)</span>}
                </label>
                <select className="select" value={f.kelompok} disabled={kunci || !wajibKelompok}
                  onChange={(e) => ubah('kelompok', e.target.value)}>
                  <option value="">—</option>
                  {Object.entries(KELOMPOK).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-6">
                <label className="label">Sifat standar *</label>
                <div className="grid gap-2 sm:grid-cols-2">
                  {Object.entries(SIFAT).map(([k, v]) => (
                    <label key={k}
                      className={`flex cursor-pointer items-start gap-2.5 rounded-lg border p-3 transition-colors ${
                        f.sifat === k ? 'border-pktj-500 bg-pktj-50' : 'border-slate-200 hover:bg-slate-50'
                      } ${kunci ? 'pointer-events-none opacity-70' : ''}`}>
                      <input type="radio" name="sifat" className="mt-0.5 accent-pktj-600"
                        checked={f.sifat === k} disabled={kunci}
                        onChange={() => ubah('sifat', k)} />
                      <div>
                        <span className={`badge ${v.cls}`}>{v.label}</span>
                        <p className="mt-1 text-xs text-slate-500">
                          {k === 'wajib'
                            ? 'Nomenklatur dikunci, tidak boleh diganti nama atau dihapus'
                            : 'Inisiatif PKTJ, bebas disusun dan diubah'}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div className="sm:col-span-6">
                <label className="label">Judul standar *</label>
                <input className="input" value={f.title}
                  disabled={kunci || f.sifat === 'wajib'}
                  onChange={(e) => ubah('title', e.target.value)} />
                {f.sifat === 'wajib' && (
                  <p className="mt-1 text-[11px] text-amber-700">
                    Judul standar wajib SN Dikti terkunci agar pemenuhannya dapat dibuktikan.
                  </p>
                )}
              </div>
              <div className="sm:col-span-6">
                <label className="label">Rasionale umum standar</label>
                <textarea className="textarea" value={f.rationale} disabled={kunci}
                  onChange={(e) => ubah('rationale', e.target.value)}
                  placeholder="Alasan keberadaan standar ini secara umum, di luar rasionale tiap pernyataan" />
              </div>
              <div className="sm:col-span-6">
                <label className="label">Ruang lingkup</label>
                <input className="input" value={f.scope} disabled={kunci}
                  onChange={(e) => ubah('scope', e.target.value)} />
              </div>
              <div className="sm:col-span-6">
                <label className="label">Strategi pencapaian standar (umum)</label>
                <textarea className="textarea" value={f.strategy} disabled={kunci}
                  onChange={(e) => ubah('strategy', e.target.value)}
                  placeholder="Strategi tingkat standar, di luar strategi tiap indikator" />
              </div>
            </div>
          </div>

          {tanpaPernyataan.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-800">
              {tanpaPernyataan.length} indikator lawas belum tertaut ke pernyataan standar mana pun
              (data sebelum migrasi). Hubungi administrator bila ini muncul.
            </div>
          )}

          {/* Pernyataan standar + indikator */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="section-title">Pernyataan Standar dan Indikator</h2>
                <p className="mt-1 text-xs text-slate-500">
                  Satu standar boleh memiliki lebih dari satu pernyataan. Setiap pernyataan boleh
                  menaungi indikator dari acuan yang berbeda-beda — teks indikator yang diadopsi
                  ditarik apa adanya, tidak digabung atau ditulis ulang.
                </p>
              </div>
            </div>

            {pernyataan.map((p, pIdx) => {
              const acuanPernyataan = new Map();
              p.indikator
                .filter((it) => it.source_ref_item_id)
                .forEach((it) => {
                  const k = it.acuan_kode || '?';
                  const a = acuanPernyataan.get(k) || { kode: k, warna: it.warna, jumlah: 0 };
                  a.jumlah += 1;
                  acuanPernyataan.set(k, a);
                });

              return (
                <div key={p.id ?? `baru-${pIdx}`} className="card-p">
                  <div className="mb-3 flex items-start justify-between gap-2">
                    <span className="badge bg-pktj-100 text-pktj-800">Pernyataan {pIdx + 1}</span>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {[...acuanPernyataan.values()].map((a) => (
                        <span key={a.kode} className="badge"
                          style={{ background: (a.warna || '#64748b') + '22', color: a.warna || '#475569' }}>
                          {a.kode} ×{a.jumlah}
                        </span>
                      ))}
                      {!kunci && pernyataan.length > 1 && (
                        <button type="button" onClick={() => hapusPernyataan(pIdx)}
                          className="btn-ghost btn-sm text-rose-600">
                          <Icon.Hapus width={13} height={13} />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-6">
                    <div className="sm:col-span-2">
                      <label className="label text-xs">Label singkat (opsional)</label>
                      <input className="input" value={p.label || ''} disabled={kunci}
                        onChange={(e) => ubahPernyataan(pIdx, 'label', e.target.value)}
                        placeholder="mis. Capaian Pembelajaran" />
                    </div>
                    <div className="sm:col-span-4">
                      <label className="label text-xs">Rasionale pernyataan ini (opsional)</label>
                      <input className="input" value={p.rationale || ''} disabled={kunci}
                        onChange={(e) => ubahPernyataan(pIdx, 'rationale', e.target.value)} />
                    </div>
                    <div className="sm:col-span-6">
                      <label className="label text-xs">Rumusan pernyataan standar *</label>
                      <textarea className="textarea" value={p.statement} disabled={kunci}
                        onChange={(e) => ubahPernyataan(pIdx, 'statement', e.target.value)}
                        placeholder="Pola Audience–Behaviour–Competence–Degree, memakai bahasa PKTJ sendiri" />
                    </div>
                  </div>

                  <div className="mt-4 space-y-3">
                    {p.indikator.map((it, iIdx) => {
                      const adopsi = !!it.source_ref_item_id;
                      return (
                        <div key={it.id ?? `ind-${pIdx}-${iIdx}`}
                          className={`rounded-lg border p-3.5 ${
                            adopsi ? 'border-sky-200 bg-sky-50/50' : 'border-slate-200 bg-slate-50/60'
                          }`}>
                          <div className="mb-2 flex items-center justify-between gap-2">
                            {adopsi ? (
                              <span className="badge"
                                style={{ background: (it.warna || '#0284c7') + '22', color: it.warna || '#0369a1' }}>
                                diadopsi · {it.acuan_kode} {it.butir_kode}
                              </span>
                            ) : (
                              <span className="badge bg-slate-100 text-slate-600">ditulis manual</span>
                            )}
                            {!kunci && (
                              <button type="button" onClick={() => hapusIndikator(pIdx, iIdx)}
                                className="btn-ghost btn-sm text-rose-600">
                                <Icon.Hapus width={13} height={13} />
                              </button>
                            )}
                          </div>

                          <div className="grid gap-3 sm:grid-cols-8">
                            <div className="sm:col-span-8">
                              <label className="label text-xs">Indikator *</label>
                              {adopsi ? (
                                <p className="rounded-md border border-sky-200 bg-white px-3 py-2 text-sm">
                                  {it.indicator}
                                </p>
                              ) : (
                                <input className="input" value={it.indicator} disabled={kunci}
                                  onChange={(e) => ubahIndikator(pIdx, iIdx, 'indicator', e.target.value)} />
                              )}
                            </div>
                            <div className="sm:col-span-2">
                              <label className="label text-xs">Target Pencapaian</label>
                              {adopsi ? (
                                <p className="rounded-md border border-sky-200 bg-white px-3 py-2 text-sm">
                                  {it.target || '—'}
                                </p>
                              ) : (
                                <input className="input" value={it.target || ''} disabled={kunci}
                                  onChange={(e) => ubahIndikator(pIdx, iIdx, 'target', e.target.value)} />
                              )}
                            </div>
                            <div className="sm:col-span-2">
                              <label className="label text-xs">Target Skor</label>
                              {adopsi ? (
                                <p className="rounded-md border border-sky-200 bg-white px-3 py-2 text-sm">
                                  {it.target_skor || '—'}
                                </p>
                              ) : (
                                <input className="input" value={it.target_skor || ''} disabled={kunci}
                                  onChange={(e) => ubahIndikator(pIdx, iIdx, 'target_skor', e.target.value)} />
                              )}
                            </div>
                            <div className="sm:col-span-2">
                              <label className="label text-xs">Satuan</label>
                              {adopsi ? (
                                <p className="rounded-md border border-sky-200 bg-white px-3 py-2 text-sm">
                                  {it.satuan || '—'}
                                </p>
                              ) : (
                                <input className="input" value={it.satuan || ''} disabled={kunci}
                                  onChange={(e) => ubahIndikator(pIdx, iIdx, 'satuan', e.target.value)} />
                              )}
                            </div>
                            <div className="sm:col-span-2">
                              <label className="label text-xs">Batas waktu</label>
                              <input type="date" className="input" value={it.deadline || ''} disabled={kunci}
                                onChange={(e) => ubahIndikator(pIdx, iIdx, 'deadline', e.target.value)} />
                            </div>
                            <div className="sm:col-span-8">
                              <label className="label text-xs">Strategi pencapaian</label>
                              {adopsi ? (
                                <p className="rounded-md border border-sky-200 bg-white px-3 py-2 text-sm">
                                  {it.strategy || '—'}
                                </p>
                              ) : (
                                <input className="input" value={it.strategy || ''} disabled={kunci}
                                  onChange={(e) => ubahIndikator(pIdx, iIdx, 'strategy', e.target.value)} />
                              )}
                            </div>
                            <div className="sm:col-span-8">
                              <label className="label text-xs">
                                Bukti sahih
                                <span className="ml-1 font-normal text-slate-400">
                                  (dokumen/rekaman institusi sendiri — selalu dapat diedit)
                                </span>
                              </label>
                              <input className="input" value={it.bukti_sahih || ''} disabled={kunci}
                                onChange={(e) => ubahIndikator(pIdx, iIdx, 'bukti_sahih', e.target.value)}
                                placeholder="Dokumen/rekaman pendukung pemenuhan indikator ini" />
                            </div>

                            <div className="sm:col-span-3">
                              <label className="label text-xs">Unit pengampu (akuntabel) *</label>
                              <select className="select" value={it.pengampu_unit_id || ''} disabled={kunci}
                                onChange={(e) => ubahIndikator(pIdx, iIdx, 'pengampu_unit_id', e.target.value)}>
                                <option value="">Pilih unit pengampu…</option>
                                {units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                              </select>
                            </div>
                            <div className="sm:col-span-3">
                              <label className="label text-xs">
                                Unit pelaksana{' '}
                                <span className="text-slate-400">
                                  ({(it.pelaksana_unit_ids || []).length} dipilih)
                                </span>
                              </label>
                              <div className="max-h-24 overflow-y-auto rounded-lg border border-slate-300 bg-white p-2">
                                {units.map((u) => (
                                  <label key={u.id}
                                    className="flex cursor-pointer items-start gap-2 rounded px-1 py-0.5 text-xs hover:bg-slate-50">
                                    <input type="checkbox" className="mt-0.5 accent-pktj-600" disabled={kunci}
                                      checked={(it.pelaksana_unit_ids || []).includes(u.id)}
                                      onChange={(e) =>
                                        ubahIndikator(pIdx, iIdx, 'pelaksana_unit_ids',
                                          e.target.checked
                                            ? [...(it.pelaksana_unit_ids || []), u.id]
                                            : (it.pelaksana_unit_ids || []).filter((x) => x !== u.id))
                                      } />
                                    <span className="leading-snug">{u.name}</span>
                                  </label>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {!kunci && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button type="button" onClick={() => bukaPilih(pIdx)} className="btn-outline btn-sm">
                        <Icon.Tautan width={13} height={13} /> Pilih dari acuan
                      </button>
                      <button type="button" onClick={() => tambahManual(pIdx)} className="btn-outline btn-sm">
                        <Icon.Plus width={13} height={13} /> Tulis manual
                      </button>
                    </div>
                  )}
                </div>
              );
            })}

            {!kunci && (
              <button type="button" onClick={tambahPernyataan} className="btn-outline w-full">
                <Icon.Plus width={14} height={14} /> Tambah pernyataan standar
              </button>
            )}
          </div>
        </div>

        {/* Sisi kanan */}
        <div className="space-y-6">
          <div className="card-p">
            <h2 className="mb-3 section-title">Acuan Sumber Standar Ini</h2>
            {acuanSumber.length === 0 ? (
              <p className="text-xs text-slate-500">
                Belum ada indikator yang diadopsi dari acuan eksternal. Standar ini murni
                inisiatif PKTJ, atau gunakan tombol "Pilih dari acuan" pada setiap pernyataan.
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {acuanSumber.map((a) => (
                  <span key={a.kode} className="badge"
                    style={{ background: (a.warna || '#64748b') + '22', color: a.warna || '#475569' }}>
                    {a.kode} · {a.jumlah} indikator
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="card-p">
            <h2 className="mb-3 section-title">Ringkasan</h2>
            <dl className="space-y-2 text-xs">
              <div className="flex justify-between">
                <dt className="text-slate-500">Posisi arsitektur</dt>
                <dd className="font-medium">{labelKategori(f.ranah, f.kelompok)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Jumlah pernyataan</dt>
                <dd className="font-medium">{pernyataan.length}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Jumlah indikator</dt>
                <dd className="font-medium">{semuaIndikator.length}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Indikator tanpa pengampu</dt>
                <dd className={`font-medium ${
                  semuaIndikator.filter((i) => !i.pengampu_unit_id).length ? 'text-rose-600' : ''
                }`}>
                  {semuaIndikator.filter((i) => !i.pengampu_unit_id).length}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Indikator diadopsi dari acuan</dt>
                <dd className="font-medium">
                  {semuaIndikator.filter((i) => i.source_ref_item_id).length}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Indikator ditulis manual</dt>
                <dd className="font-medium">
                  {semuaIndikator.filter((i) => !i.source_ref_item_id).length}
                </dd>
              </div>
            </dl>
          </div>

          {bolehSPM && !baru && f.sifat !== 'wajib' && (
            <button type="button" onClick={hapus} className="btn-outline w-full text-rose-600">
              <Icon.Hapus width={16} height={16} /> Hapus standar
            </button>
          )}
        </div>
      </div>

      {/* Modal pemilih indikator lintas-acuan */}
      <Modal
        open={!!mPilih} onClose={() => setMPilih(null)}
        title="Pilih Indikator dari Acuan Mutu"
        lebar="max-w-3xl"
        footer={<button type="button" onClick={() => setMPilih(null)} className="btn-outline">Selesai</button>}
      >
        <div className="space-y-4">
          <p className="text-xs leading-relaxed text-slate-500">
            Indikator yang dipilih akan ditarik apa adanya (judul/uraian, target pencapaian,
            target skor, satuan, strategi) dari butir acuan aslinya — tidak digabung atau
            ditulis ulang. Boleh
            memilih lebih dari satu indikator dari acuan yang berbeda-beda ke pernyataan ini.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label">Acuan</label>
              <select className="select" value={pilihRef} onChange={(e) => setPilihRef(e.target.value)}>
                <option value="">Semua acuan…</option>
                {daftarAcuan.map((a) => (
                  <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Cari indikator</label>
              <input className="input" value={pilihCari}
                onChange={(e) => setPilihCari(e.target.value)}
                placeholder="Kode atau kata kunci" />
            </div>
          </div>

          {memuatKandidat ? (
            <Memuat />
          ) : kandidat.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">
              Tidak ada butir acuan siap diadopsi. Isi kolom Target Pencapaian pada butir di
              menu Acuan Mutu agar butir tersebut muncul di sini.
            </p>
          ) : (
            <div className="max-h-80 space-y-1.5 overflow-y-auto">
              {kandidat.map((c) => {
                const dipakai = mPilih && sudahDipakai(mPilih.p, c.id);
                return (
                  <div key={c.id}
                    className="flex items-start justify-between gap-3 rounded-lg border border-slate-200 p-2.5">
                    <div className="min-w-0">
                      <span className="badge mr-1.5"
                        style={{ background: (c.warna || '#64748b') + '22', color: c.warna || '#475569' }}>
                        {c.acuan_kode}
                      </span>
                      <span className="font-mono text-xs font-semibold text-pktj-700">{c.code}</span>
                      <p className="text-sm leading-snug">{c.uraian || c.title}</p>
                      <p className="mt-0.5 text-[11px] text-slate-500">
                        Target: {c.target}{c.target_skor ? ` · Skor: ${c.target_skor}` : ''}
                        {c.satuan ? ` ${c.satuan}` : ''}
                        {c.jumlah_diadopsi > 0 && ` · sudah diadopsi ${c.jumlah_diadopsi}×`}
                      </p>
                    </div>
                    <button type="button" onClick={() => pakaiKandidat(c)} disabled={dipakai}
                      className={dipakai ? 'btn-ghost btn-sm shrink-0 text-emerald-600' : 'btn-outline btn-sm shrink-0'}>
                      {dipakai ? '✓ dipakai' : 'Pakai'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Modal>

      {/* Modal ranah baru */}
      <Modal
        open={!!mRanahBaru} onClose={() => setMRanahBaru(null)}
        title="Ranah Baru"
        lebar="max-w-md"
        footer={
          <>
            <button type="button" onClick={() => setMRanahBaru(null)} className="btn-outline">Batal</button>
            <button type="button" onClick={simpanRanahBaru} disabled={simpanRanah} className="btn-primary">
              {simpanRanah ? 'Menyimpan…' : 'Simpan'}
            </button>
          </>
        }
      >
        {mRanahBaru && (
          <div className="space-y-4">
            <p className="text-xs leading-relaxed text-slate-500">
              Dipakai untuk standar melampaui SN Dikti yang tidak cocok ke ranah bawaan
              (Pendidikan, Penelitian, PkM, Tata Kelola, Keberlanjutan). Ranah baru ini akan
              tersimpan dan bisa dipakai ulang untuk standar lain.
            </p>
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className="label">Kode *</label>
                <input className="input font-mono uppercase" maxLength={3}
                  value={mRanahBaru.code}
                  onChange={(e) => setMRanahBaru({ ...mRanahBaru, code: e.target.value.toUpperCase() })}
                  placeholder="F" autoFocus />
              </div>
              <div className="sm:col-span-2">
                <label className="label">Label lengkap *</label>
                <input className="input" value={mRanahBaru.label}
                  onChange={(e) => setMRanahBaru({ ...mRanahBaru, label: e.target.value })}
                  placeholder="F. Kewirausahaan dan Inovasi" />
              </div>
            </div>
            <div>
              <label className="label">Label ringkas (utk lencana/badge)</label>
              <input className="input" value={mRanahBaru.pendek}
                onChange={(e) => setMRanahBaru({ ...mRanahBaru, pendek: e.target.value })}
                placeholder="Kewirausahaan (kosongkan utk pakai label lengkap)" />
            </div>
          </div>
        )}
      </Modal>
    </form>
  );
}
