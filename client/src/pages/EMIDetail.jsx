import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, VERDICT, tanggalID, tautanBukti } from '../api.js';
import { useAuth } from '../auth.jsx';
import {
  Badge, Icon, JudulHalaman, Kosong, Memuat, Modal, Progres, useToast,
} from '../components/ui.jsx';
import { adalahPeringkat, persenPeringkat, teksCapaian } from '../lib/peringkat.js';

const PILIHAN_VERDICT = [
  { v: 'sesuai',    ket: 'Indikator tercapai, bukti memadai' },
  { v: 'observasi', ket: 'Potensi masalah, perlu perhatian' },
  { v: 'kts_minor', ket: 'Ketidaksesuaian yang tidak berdampak sistemik' },
  { v: 'kts_mayor', ket: 'Ketidaksesuaian yang berdampak sistemik' },
];

export default function EMIDetail() {
  const { id } = useParams();
  const { bolehAuditor } = useAuth();
  const { tampil, Toast } = useToast();

  const [d, setD] = useState(null);
  const [aktif, setAktif] = useState(null);
  const [f, setF] = useState({});
  const [simpan, setSimpan] = useState(false);
  const [saring, setSaring] = useState('semua');
  const [acuanFilter, setAcuanFilter] = useState('');
  const [cari, setCari] = useState('');
  const [kesimpulan, setKesimpulan] = useState('');

  const [aktifSM, setAktifSM] = useState(null);
  const [fSM, setFSM] = useState({});
  const [simpanSM, setSimpanSM] = useState(false);

  async function muat() {
    const r = await api.get(`/emi/${id}/lembar-penilaian`);
    setD(r);
    setKesimpulan(r.audit.kesimpulan || '');
  }
  useEffect(() => { muat(); }, [id]);

  // Muat ulang tanpa memindahkan posisi gulir — dipakai setelah menyimpan/
  // menghapus penilaian, supaya auditor tetap berada di indikator yang baru
  // saja dinilai alih-alih terlempar ke atas halaman.
  async function muatDiam() {
    const posisi = window.scrollY;
    await muat();
    requestAnimationFrame(() => window.scrollTo(0, posisi));
  }

  const items = d?.items || [];
  const sasaranMutu = d?.sasaranMutu || [];

  // Daftar acuan mutu yang muncul pada indikator audit ini — indikator
  // tanpa acuan/manual dikelompokkan sebagai "Manual (tanpa acuan)".
  const daftarAcuan = useMemo(() => {
    const peta = new Map();
    for (const i of items) {
      const kode = i.acuan_kode || '__manual__';
      if (!peta.has(kode)) peta.set(kode, { kode, nama: i.acuan_kode ? i.acuan_nama : 'Manual (tanpa acuan)' });
    }
    return [...peta.values()].sort((a, b) => a.nama.localeCompare(b.nama, 'id'));
  }, [items]);

  const tersaring = useMemo(() => {
    let hasil = items;
    if (saring === 'belum') hasil = hasil.filter((i) => !i.assessment_id);
    else if (saring === 'kts') hasil = hasil.filter((i) => (i.verdict || '').startsWith('kts'));
    else if (saring !== 'semua') hasil = hasil.filter((i) => i.verdict === saring);
    if (acuanFilter) {
      hasil = hasil.filter((i) =>
        acuanFilter === '__manual__' ? !i.acuan_kode : i.acuan_kode === acuanFilter);
    }
    const q = cari.trim().toLowerCase();
    if (q) {
      hasil = hasil.filter((i) =>
        i.indikator_kode?.toLowerCase().includes(q) ||
        i.indicator?.toLowerCase().includes(q) ||
        i.standar_kode?.toLowerCase().includes(q) ||
        i.standar_judul?.toLowerCase().includes(q)
      );
    }
    return hasil;
  }, [items, saring, acuanFilter, cari]);

  const dinilai = items.filter((i) => i.assessment_id).length;
  const persen = items.length ? Math.round((dinilai / items.length) * 100) : 0;
  const rataSkor = (() => {
    const v = items.filter((i) => i.skor != null);
    return v.length
      ? Math.round((v.reduce((a, i) => a + i.skor, 0) / v.length) * 100) / 100
      : null;
  })();

  function buka(it) {
    setAktif(it);
    const capaianOtomatis =
      it.capaian_persen ?? (it.capaian_nilai != null ? Number(it.capaian_nilai) : '');
    setF({
      skor: it.skor ?? '',
      capaian_persen: capaianOtomatis === null ? '' : capaianOtomatis,
      verdict: it.verdict || 'sesuai',
      catatan_auditor: it.catatan_auditor || '',
      verifikasi_bukti: it.verifikasi_bukti || '',
      uraian_temuan: '', kriteria_acuan: '', bukti_objektif: '',
    });
  }

  async function nilai() {
    setSimpan(true);
    try {
      await api.post(`/emi/${id}/nilai`, {
        indicator_id: aktif.indicator_id,
        implementation_id: aktif.implementation_id,
        ...f,
        skor: f.skor === '' ? null : Number(f.skor),
        capaian_persen: f.capaian_persen === '' ? null : Number(f.capaian_persen),
      });
      tampil(
        f.verdict === 'sesuai'
          ? 'Penilaian tersimpan'
          : 'Penilaian tersimpan dan ketidaksesuaian dicatat'
      );
      setAktif(null);
      muatDiam();
    } catch (e) { tampil(e.message, 'galat'); }
    finally { setSimpan(false); }
  }

  async function hapusPenilaian() {
    if (!aktif?.assessment_id) return;
    if (!confirm('Hapus penilaian indikator ini? Isian pelaksanaan auditee akan dikembalikan ke status diserahkan agar dapat dinilai ulang.'))
      return;
    setSimpan(true);
    try {
      await api.del(`/emi/${id}/nilai/${aktif.indicator_id}`);
      tampil('Penilaian dihapus');
      setAktif(null);
      muatDiam();
    } catch (e) { tampil(e.message, 'galat'); }
    finally { setSimpan(false); }
  }

  /** Sasaran peringkat: usulan persen dari capaian huruf terakhir yang sudah diserahkan unit */
  function persenPeringkatTerakhir(sm) {
    if (!adalahPeringkat(sm)) return null;
    const terakhir = [...sm.capaian].reverse().find((c) => c.status === 'diserahkan' && c.capaian_teks);
    return terakhir ? persenPeringkat(sm.skala_peringkat, sm.target, terakhir.capaian_teks) : null;
  }

  function bukaSM(sm) {
    setAktifSM(sm);
    setFSM({
      skor: sm.skor ?? '',
      capaian_persen: sm.capaian_persen ?? persenPeringkatTerakhir(sm) ?? '',
      verdict: sm.verdict || 'sesuai',
      catatan_auditor: sm.catatan_auditor || '',
      verifikasi_bukti: sm.verifikasi_bukti || '',
    });
  }

  async function nilaiSM() {
    setSimpanSM(true);
    try {
      await api.post(`/emi/${id}/nilai-sasaran-mutu`, {
        sasaran_mutu_id: aktifSM.sasaran_mutu_id,
        ...fSM,
        skor: fSM.skor === '' ? null : Number(fSM.skor),
        capaian_persen: fSM.capaian_persen === '' ? null : Number(fSM.capaian_persen),
      });
      tampil('Penilaian sasaran mutu tersimpan');
      setAktifSM(null);
      muatDiam();
    } catch (e) { tampil(e.message, 'galat'); }
    finally { setSimpanSM(false); }
  }

  async function hapusPenilaianSM() {
    if (!aktifSM?.assessment_id) return;
    if (!confirm('Hapus penilaian sasaran mutu ini?')) return;
    setSimpanSM(true);
    try {
      await api.del(`/emi/${id}/nilai-sasaran-mutu/${aktifSM.sasaran_mutu_id}`);
      tampil('Penilaian dihapus');
      setAktifSM(null);
      muatDiam();
    } catch (e) { tampil(e.message, 'galat'); }
    finally { setSimpanSM(false); }
  }

  async function simpanKesimpulan() {
    try {
      await api.put(`/emi/${id}`, { kesimpulan, status: 'selesai' });
      tampil('Kesimpulan audit tersimpan');
      muat();
    } catch (e) { tampil(e.message, 'galat'); }
  }

  if (!d) return <Memuat />;
  const a = d.audit;
  const terkunci = a.status === 'ditandatangani';

  const grup = tersaring.reduce((acc, i) => {
    (acc[`${i.standar_kode} — ${i.standar_judul}`] ||= []).push(i);
    return acc;
  }, {});

  return (
    <>
      <Toast />
      <JudulHalaman
        ikon={<Icon.Audit width={20} height={20} />}
        judul={`Lembar Penilaian — ${a.unit_name}`}
        deskripsi={`${a.ba_number} · ${a.period_name} · jadwal ${tanggalID(a.scheduled_date)}`}
        aksi={
          <>
            <Link to="/emi" className="btn-outline">
              <Icon.Kembali width={16} height={16} /> Daftar Audit
            </Link>
            <Badge status={a.status} />
            <Link to={`/emi/${id}/checklist`} className="btn-outline">
              <Icon.Cetak width={16} height={16} /> Audit Checklist
            </Link>
            <Link to={`/emi/${id}/berita-acara`} className="btn-primary">
              <Icon.Cetak width={16} height={16} /> Berita Acara
            </Link>
          </>
        }
      />

      {/* Ringkasan */}
      <div className="card-p mb-5">
        <div className="grid gap-5 sm:grid-cols-4">
          <div>
            <p className="text-xs uppercase tracking-wider text-slate-500">Progres Penilaian</p>
            <p className="mt-1 text-2xl font-bold tabular-nums">{persen}%</p>
            <div className="mt-2"><Progres nilai={persen} /></div>
            <p className="mt-1 text-xs text-slate-500">
              {dinilai} dari {items.length} indikator
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-slate-500">Rata-rata Skor</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-pktj-700">
              {rataSkor != null ? rataSkor : '-'}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-slate-500">Ketidaksesuaian</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-rose-600">
              {items.filter((i) => (i.verdict || '').startsWith('kts')).length}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-slate-500">Observasi</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-sky-600">
              {items.filter((i) => i.verdict === 'observasi').length}
            </p>
          </div>
        </div>
      </div>

      {/* Penyaring */}
      <div className="no-print mb-4 flex flex-wrap items-center gap-2">
        {[
          ['semua', `Semua (${items.length})`],
          ['belum', `Belum dinilai (${items.length - dinilai})`],
          ['sesuai', 'Sesuai'],
          ['observasi', 'Observasi'],
          ['kts', 'Ketidaksesuaian'],
        ].map(([k, l]) => (
          <button
            key={k}
            onClick={() => setSaring(k)}
            className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${
              saring === k ? 'bg-pktj-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-100'
            }`}
          >
            {l}
          </button>
        ))}
        <input
          className="input ml-auto w-auto max-w-xs"
          placeholder="Cari indikator atau standar…"
          value={cari}
          onChange={(e) => setCari(e.target.value)}
        />
        <select className="select w-auto" value={acuanFilter}
          onChange={(e) => setAcuanFilter(e.target.value)}>
          <option value="">Semua acuan mutu</option>
          {daftarAcuan.map((a) => (
            <option key={a.kode} value={a.kode}>{a.nama}</option>
          ))}
        </select>
      </div>

      {tersaring.length === 0 ? (
        <Kosong judul="Tidak ada indikator yang cocok"
          pesan="Coba ubah pilihan penyaring, acuan mutu, atau kata kunci pencarian." />
      ) : (
      <div className="space-y-5">
        {Object.entries(grup).map(([judul, daftar]) => (
          <div key={judul} className="card overflow-hidden">
            <div className="border-b border-slate-200 bg-slate-50 px-5 py-3">
              <h3 className="text-sm font-semibold">{judul}</h3>
            </div>
            <div className="divide-y divide-slate-100">
              {daftar.map((it) => (
                <div key={it.indicator_id} className="p-4 hover:bg-slate-50/50">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-[11px] text-slate-500">
                          {it.indikator_kode}
                        </span>
                        {it.acuan_kode && (
                          <span className="badge"
                            style={{ background: (it.acuan_warna || '#64748b') + '22', color: it.acuan_warna || '#475569' }}>
                            {it.acuan_kode}
                            {it.butir_kode && ` · ${it.butir_kode}`}
                          </span>
                        )}
                        {it.verdict && (
                          <span className={`badge ${VERDICT[it.verdict]?.cls}`}>
                            {VERDICT[it.verdict]?.label}
                          </span>
                        )}
                        {it.finding_code && (
                          <span className="badge bg-slate-100 font-mono text-[10px] text-slate-600">
                            {it.finding_code}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-sm font-medium">{it.indicator}</p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        Target: {it.target || '-'}{it.satuan && ` (satuan: ${it.satuan})`}
                      </p>

                      <div className="mt-2.5 rounded-lg bg-slate-50 p-3 text-xs">
                        <p className="mb-1 font-semibold text-slate-600">
                          Isian auditee (Modul 2)
                        </p>
                        {it.realisasi ? (
                          <>
                            <p className="text-slate-700">{it.realisasi}</p>
                            <p className="mt-1.5 flex flex-wrap gap-x-4 text-slate-500">
                              <span>
                                <span className="font-medium">Capaian auditee: </span>
                                {it.capaian_nilai != null
                                  ? `${it.capaian_nilai}${it.satuan ? ` ${it.satuan}` : ''}`
                                  : '-'}
                              </span>
                              <span>
                                <span className="font-medium">Skor auditee: </span>
                                {it.auditee_skor != null ? it.auditee_skor : '-'}
                              </span>
                            </p>
                            {it.bukti_uraian && (
                              <p className="mt-1.5 text-slate-500">
                                <span className="font-medium">Bukti: </span>{it.bukti_uraian}
                              </p>
                            )}
                            {it.bukti_url && (
                              <a href={tautanBukti(it.bukti_url)} target="_blank" rel="noreferrer"
                                className="mt-1 inline-block text-pktj-600 hover:underline">
                                Lihat berkas bukti →
                              </a>
                            )}
                            {it.kendala && (
                              <p className="mt-1.5 text-amber-700">
                                <span className="font-medium">Kendala: </span>{it.kendala}
                              </p>
                            )}
                          </>
                        ) : (
                          <p className="italic text-rose-500">
                            Auditee belum mengisi pelaksanaan standar untuk indikator ini.
                          </p>
                        )}
                      </div>

                      {it.catatan_auditor && (
                        <div className="mt-2 rounded-lg border border-pktj-200 bg-pktj-50 p-3 text-xs">
                          <p className="mb-1 font-semibold text-pktj-800">Catatan auditor</p>
                          <p className="text-pktj-900">{it.catatan_auditor}</p>
                        </div>
                      )}
                    </div>

                    <div className="flex shrink-0 items-center gap-3">
                      <div className="text-right">
                        <p className="text-xs text-slate-500">Capaian</p>
                        <p className="text-xl font-bold tabular-nums">
                          {it.capaian_persen != null
                            ? `${it.capaian_persen}${it.satuan ? ` ${it.satuan}` : ''}`
                            : '-'}
                        </p>
                        {it.skor != null && (
                          <p className="text-[11px] text-slate-500">Skor {it.skor}</p>
                        )}
                      </div>
                      {bolehAuditor && !terkunci && (
                        <button onClick={() => buka(it)} className="btn-outline btn-sm">
                          {it.assessment_id ? 'Ubah' : 'Nilai'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      )}

      {/* Sasaran Mutu — dinilai sekali per siklus, bukan per sub-periode.
          Dikelompokkan per program kerja (bisa memuat beberapa sasaran
          sekaligus) dan diberi label jenis: Kinerja Utama / Kinerja Tambahan. */}
      {sasaranMutu.length > 0 && (
        <div className="mt-6">
          <h2 className="mb-2.5 section-title">Sasaran Mutu</h2>
          <div className="space-y-4">
            {Object.values(
              sasaranMutu.reduce((a, sm) => {
                (a[sm.program_kerja_id] ||= { pk: sm, list: [] }).list.push(sm);
                return a;
              }, {})
            ).map(({ pk, list }) => (
              <div key={pk.program_kerja_id} className="card overflow-hidden">
                <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-4 py-2.5">
                  <span className="badge bg-pktj-50 text-pktj-700">
                    {pk.jenis_program === 'tambahan' ? 'Kinerja Tambahan' : 'Kinerja Utama'}
                  </span>
                  <h3 className="text-sm font-semibold">{pk.program_kerja}</h3>
                  <span className="text-[11px] text-slate-400">
                    {pk.sub_unit_name && `${pk.sub_unit_name} · `}Tahun {pk.tahun}
                  </span>
                </div>
                <div className="divide-y divide-slate-100">
                  {list.map((sm) => {
                    const jumlahDilaporkan = sm.capaian.filter((c) => c.status === 'diserahkan').length;
                    return (
                      <div key={sm.sasaran_mutu_id} className="p-4 hover:bg-slate-50/50">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-semibold">{sm.sasaran}</span>
                              {sm.verdict && (
                                <span className={`badge ${VERDICT[sm.verdict]?.cls}`}>
                                  {VERDICT[sm.verdict]?.label}
                                </span>
                              )}
                              {sm.finding_code && (
                                <span className="badge bg-slate-100 font-mono text-[10px] text-slate-600">
                                  {sm.finding_code}
                                </span>
                              )}
                            </div>
                            <p className="mt-1 text-xs text-slate-500">
                              Target: {sm.target}{sm.satuan ? ` ${sm.satuan}` : ''}
                            </p>

                            <div className="mt-2.5 rounded-lg bg-slate-50 p-3 text-xs">
                              <p className="mb-1 font-semibold text-slate-600">
                                Capaian dilaporkan unit ({jumlahDilaporkan}/{sm.capaian.length} sub-periode)
                              </p>
                              <ul className="space-y-1">
                                {sm.capaian.map((c) => (
                                  <li key={c.periode_ke} className="flex flex-wrap gap-x-2 text-slate-600">
                                    <span className="font-medium">{c.label}:</span>
                                    {c.status === 'diserahkan'
                                      ? <span>{c.realisasi} {teksCapaian(sm, c) && `(${teksCapaian(sm, c)})`}</span>
                                      : <span className="text-slate-400">belum dilaporkan</span>}
                                    {c.kendala && <span className="text-rose-600"> · Kendala: {c.kendala}</span>}
                                    {c.faktor_pendukung && <span className="text-emerald-600"> · Faktor pendukung: {c.faktor_pendukung}</span>}
                                    {c.bukti_url && (
                                      <a href={tautanBukti(c.bukti_url)} target="_blank" rel="noreferrer"
                                        className="text-pktj-600 hover:underline">
                                        · Lihat berkas bukti →
                                      </a>
                                    )}
                                  </li>
                                ))}
                              </ul>
                            </div>

                            {sm.tahun_sebelumnya && (
                              <p className="mt-2 text-[11px] text-slate-500">
                                Pembanding Tahun {sm.tahun_sebelumnya.tahun}: capaian{' '}
                                {sm.tahun_sebelumnya.capaian_persen ?? '-'}
                                {sm.tahun_sebelumnya.satuan ? ` ${sm.tahun_sebelumnya.satuan}` : ''}
                                {sm.tahun_sebelumnya.skor != null && `, skor ${sm.tahun_sebelumnya.skor}`}
                              </p>
                            )}

                            {sm.catatan_auditor && (
                              <div className="mt-2 rounded-lg border border-pktj-200 bg-pktj-50 p-3 text-xs">
                                <p className="mb-1 font-semibold text-pktj-800">Catatan auditor</p>
                                <p className="text-pktj-900">{sm.catatan_auditor}</p>
                              </div>
                            )}
                          </div>

                          <div className="flex shrink-0 items-center gap-3">
                            <div className="text-right">
                              <p className="text-xs text-slate-500">Capaian</p>
                              <p className="text-xl font-bold tabular-nums">
                                {sm.capaian_persen != null
                                  ? `${sm.capaian_persen}${adalahPeringkat(sm) ? '%' : sm.satuan ? ` ${sm.satuan}` : ''}`
                                  : '-'}
                              </p>
                              {sm.skor != null && (
                                <p className="text-[11px] text-slate-500">Skor {sm.skor}</p>
                              )}
                            </div>
                            {bolehAuditor && !terkunci && (
                              <button onClick={() => bukaSM(sm)} className="btn-outline btn-sm">
                                {sm.assessment_id ? 'Ubah' : 'Nilai'}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Kesimpulan audit */}
      {bolehAuditor && !terkunci && (
        <div className="card-p mt-6">
          <h2 className="mb-3 section-title">Kesimpulan Audit</h2>
          <textarea
            className="textarea" value={kesimpulan}
            onChange={(e) => setKesimpulan(e.target.value)}
            placeholder="Kesimpulan umum hasil audit mutu internal pada unit ini, termasuk kekuatan dan area yang perlu diperbaiki."
          />
          <div className="mt-3 flex justify-end">
            <button onClick={simpanKesimpulan} className="btn-primary">
              <Icon.Simpan width={16} height={16} /> Simpan Kesimpulan
            </button>
          </div>
        </div>
      )}

      {/* Formulir penilaian */}
      <Modal
        open={!!aktif} onClose={() => setAktif(null)}
        title="Penilaian Indikator" lebar="max-w-3xl"
        footer={
          <>
            {aktif?.assessment_id && (
              <button onClick={hapusPenilaian} className="btn-outline mr-auto text-red-600 hover:bg-red-50"
                disabled={simpan}>
                <Icon.Hapus width={16} height={16} /> Hapus Penilaian
              </button>
            )}
            <button onClick={() => setAktif(null)} className="btn-outline">Batal</button>
            <button onClick={nilai} className="btn-primary" disabled={simpan}>
              {simpan ? 'Menyimpan…' : 'Simpan Penilaian'}
            </button>
          </>
        }
      >
        {aktif && (
          <div className="space-y-4">
            <div className="rounded-lg bg-slate-50 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-mono text-xs text-pktj-600">{aktif.indikator_kode}</p>
                {aktif.acuan_kode && (
                  <span className="badge"
                    style={{ background: (aktif.acuan_warna || '#64748b') + '22', color: aktif.acuan_warna || '#475569' }}>
                    {aktif.acuan_kode}
                    {aktif.butir_kode && ` · ${aktif.butir_kode}`}
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm font-semibold">{aktif.indicator}</p>
              <p className="mt-1 text-xs text-slate-500">
                Target: {aktif.target || '-'}
                {aktif.target_skor && ` · Target Skor: ${aktif.target_skor}`}
                {aktif.satuan && ` · Satuan: ${aktif.satuan}`}
              </p>
              {aktif.realisasi && (
                <div className="mt-2 border-t border-slate-200 pt-2 text-xs text-slate-600">
                  <p><span className="font-medium">Realisasi auditee: </span>{aktif.realisasi}</p>
                  <p className="mt-1 flex flex-wrap gap-x-4">
                    <span>
                      <span className="font-medium">Capaian auditee: </span>
                      {aktif.capaian_nilai != null
                        ? `${aktif.capaian_nilai}${aktif.satuan ? ` ${aktif.satuan}` : ''}`
                        : '-'}
                    </span>
                    <span>
                      <span className="font-medium">Skor auditee: </span>
                      {aktif.auditee_skor != null ? aktif.auditee_skor : '-'}
                    </span>
                  </p>
                  {aktif.bukti_uraian && (
                    <p className="mt-1.5">
                      <span className="font-medium">Bukti: </span>{aktif.bukti_uraian}
                    </p>
                  )}
                  {aktif.bukti_url && (
                    <a href={tautanBukti(aktif.bukti_url)} target="_blank" rel="noreferrer"
                      className="mt-1 inline-block text-pktj-600 hover:underline">
                      Lihat berkas bukti →
                    </a>
                  )}
                </div>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label">Capaian terhadap target</label>
                <input type="number" step="any" className="input"
                  value={f.capaian_persen}
                  onChange={(e) => setF((p) => ({ ...p, capaian_persen: e.target.value }))}
                  placeholder="isi sesuai capaian target" />
                <p className="mt-1 text-[11px] text-slate-400">
                  Jika kualitatif tuliskan dalam persen, jika kuantitatif isi angka capaiannya
                </p>
              </div>
              <div>
                <label className="label">
                  Skor {aktif.skor_min != null && aktif.skor_maks != null
                    ? `(skala ${aktif.skor_min}–${aktif.skor_maks}${aktif.skor_step && aktif.skor_step !== 1 ? `, kelipatan ${aktif.skor_step}` : ''})`
                    : aktif.target_skor ? `(skala ${aktif.target_skor})` : ''}
                </label>
                <input type="number"
                  min={aktif.skor_min ?? undefined} max={aktif.skor_maks ?? undefined}
                  step={aktif.skor_step || 'any'} className="input"
                  value={f.skor}
                  onChange={(e) => setF((p) => ({ ...p, skor: e.target.value }))}
                  placeholder={
                    aktif.skor_min != null && aktif.skor_maks != null
                      ? `${aktif.skor_min} s.d. ${aktif.skor_maks}`
                      : aktif.satuan?.toLowerCase().includes('pemenuhan') ? '0 atau 1' : 'mis. 3'
                  } />
                {aktif.acuan_kode && (
                  <p className="mt-1 text-[11px] text-slate-400">
                    Sesuai skala resmi acuan {aktif.acuan_kode}
                  </p>
                )}
              </div>
            </div>

            <div>
              <label className="label">Hasil penilaian *</label>
              <div className="grid gap-2 sm:grid-cols-2">
                {PILIHAN_VERDICT.map(({ v, ket }) => (
                  <label key={v}
                    className={`flex cursor-pointer items-start gap-2.5 rounded-lg border p-3 transition-colors ${
                      f.verdict === v ? 'border-pktj-500 bg-pktj-50' : 'border-slate-200 hover:bg-slate-50'
                    }`}>
                    <input type="radio" name="verdict" className="mt-0.5 accent-pktj-600"
                      checked={f.verdict === v}
                      onChange={() => setF((p) => ({ ...p, verdict: v }))} />
                    <div>
                      <span className={`badge ${VERDICT[v].cls}`}>{VERDICT[v].label}</span>
                      <p className="mt-1 text-xs text-slate-500">{ket}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="label">Verifikasi bukti oleh auditor</label>
              <textarea className="textarea min-h-[70px]" value={f.verifikasi_bukti}
                onChange={(e) => setF((p) => ({ ...p, verifikasi_bukti: e.target.value }))}
                placeholder="Dokumen yang diperiksa, hasil wawancara, observasi lapangan" />
            </div>

            <div>
              <label className="label">Catatan auditor</label>
              <textarea className="textarea min-h-[70px]" value={f.catatan_auditor}
                onChange={(e) => setF((p) => ({ ...p, catatan_auditor: e.target.value }))} />
            </div>

            {f.verdict !== 'sesuai' && (
              <div className="space-y-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
                <p className="text-xs font-semibold text-amber-900">
                  Rincian ketidaksesuaian — akan diteruskan ke Modul 4 Pengendalian
                </p>
                <div>
                  <label className="label text-xs">Uraian ketidaksesuaian</label>
                  <textarea className="textarea min-h-[70px] bg-white" value={f.uraian_temuan}
                    onChange={(e) => setF((p) => ({ ...p, uraian_temuan: e.target.value }))}
                    placeholder="Kosongkan untuk memakai uraian otomatis dari indikator" />
                </div>
                <div>
                  <label className="label text-xs">Kriteria acuan yang tidak terpenuhi</label>
                  <input className="input bg-white" value={f.kriteria_acuan}
                    onChange={(e) => setF((p) => ({ ...p, kriteria_acuan: e.target.value }))}
                    placeholder="Kosongkan untuk memakai acuan standar otomatis" />
                </div>
                <div>
                  <label className="label text-xs">Bukti objektif</label>
                  <textarea className="textarea min-h-[60px] bg-white" value={f.bukti_objektif}
                    onChange={(e) => setF((p) => ({ ...p, bukti_objektif: e.target.value }))} />
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Formulir penilaian sasaran mutu — sekali per siklus, menilai rekap
          keseluruhan capaian sampai sub-periode terakhir yang dilaporkan. */}
      <Modal
        open={!!aktifSM} onClose={() => setAktifSM(null)}
        title="Penilaian Sasaran Mutu" lebar="max-w-2xl"
        footer={
          <>
            {aktifSM?.assessment_id && (
              <button onClick={hapusPenilaianSM} className="btn-outline mr-auto text-red-600 hover:bg-red-50"
                disabled={simpanSM}>
                <Icon.Hapus width={16} height={16} /> Hapus Penilaian
              </button>
            )}
            <button onClick={() => setAktifSM(null)} className="btn-outline">Batal</button>
            <button onClick={nilaiSM} className="btn-primary" disabled={simpanSM}>
              {simpanSM ? 'Menyimpan…' : 'Simpan Penilaian'}
            </button>
          </>
        }
      >
        {aktifSM && (
          <div className="space-y-4">
            <div className="rounded-lg bg-slate-50 p-4">
              <p className="text-sm font-semibold">{aktifSM.program_kerja}</p>
              <p className="mt-1 text-xs text-slate-500">
                {aktifSM.sasaran} · Target: {aktifSM.target}{aktifSM.satuan ? ` ${aktifSM.satuan}` : ''}
              </p>
              <p className="mt-2 text-[11px] text-slate-500">
                Tinjau konsistensi pengukuran, capaian periode sebelumnya, dan capaian sampai sub-periode
                terakhir yang sudah dilaporkan unit (lihat rincian di kartu sebelumnya) sebelum memberi nilai.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label">Capaian keseluruhan</label>
                <input type="number" step="any" className="input"
                  value={fSM.capaian_persen}
                  onChange={(e) => setFSM((p) => ({ ...p, capaian_persen: e.target.value }))}
                  placeholder="isi sesuai capaian keseluruhan" />
              </div>
              <div>
                <label className="label">Skor</label>
                <input type="number" step="any" className="input"
                  value={fSM.skor}
                  onChange={(e) => setFSM((p) => ({ ...p, skor: e.target.value }))}
                  placeholder="mis. 3.5" />
              </div>
            </div>

            <div>
              <label className="label">Hasil penilaian *</label>
              <div className="grid gap-2 sm:grid-cols-2">
                {PILIHAN_VERDICT.map(({ v, ket }) => (
                  <label key={v}
                    className={`flex cursor-pointer items-start gap-2.5 rounded-lg border p-3 transition-colors ${
                      fSM.verdict === v ? 'border-pktj-500 bg-pktj-50' : 'border-slate-200 hover:bg-slate-50'
                    }`}>
                    <input type="radio" name="verdict-sm" className="mt-0.5 accent-pktj-600"
                      checked={fSM.verdict === v}
                      onChange={() => setFSM((p) => ({ ...p, verdict: v }))} />
                    <div>
                      <span className={`badge ${VERDICT[v].cls}`}>{VERDICT[v].label}</span>
                      <p className="mt-1 text-xs text-slate-500">{ket}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="label">Verifikasi bukti oleh auditor</label>
              <textarea className="textarea min-h-[70px]" value={fSM.verifikasi_bukti}
                onChange={(e) => setFSM((p) => ({ ...p, verifikasi_bukti: e.target.value }))} />
            </div>

            <div>
              <label className="label">Catatan auditor</label>
              <textarea className="textarea min-h-[70px]" value={fSM.catatan_auditor}
                onChange={(e) => setFSM((p) => ({ ...p, catatan_auditor: e.target.value }))}
                placeholder="Konsistensi pengukuran, tren dibanding periode sebelumnya, dan rekomendasi" />
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
