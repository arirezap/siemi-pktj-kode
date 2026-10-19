import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, tanggalID, unduhBerkas, KELOMPOK, SIFAT } from '../api.js';
import { useAuth } from '../auth.jsx';
import { Badge, Icon, JudulHalaman, Kosong, Memuat, Modal, useToast } from '../components/ui.jsx';
import { useRanah } from '../hooks/useRanah.js';

export default function Standar() {
  const { periode, bolehSPM } = useAuth();
  const { tampil, Toast } = useToast();
  const { ranah: RANAH } = useRanah();
  const [data, setData] = useState(null);
  const [cari, setCari] = useState('');
  const [ranah, setRanah] = useState('');
  const [sifat, setSifat] = useState('');
  const [status, setStatus] = useState('');
  const [mDupBuka, setMDupBuka] = useState(false);

  async function muat() {
    if (!periode) return;
    setData(await api.get(`/standar?period_id=${periode.id}`));
  }
  useEffect(() => { muat(); }, [periode?.id]);

  const tersaring = useMemo(() => {
    const q = cari.toLowerCase();
    return (data || []).filter(
      (s) =>
        (!ranah || s.ranah === ranah) &&
        (!sifat || s.sifat === sifat) &&
        (!status || s.status === status) &&
        (!q ||
          s.title.toLowerCase().includes(q) ||
          s.code.toLowerCase().includes(q) ||
          (s.pernyataan_utama || '').toLowerCase().includes(q))
    );
  }, [data, cari, ranah, sifat, status]);

  async function tetapkan(s) {
    try {
      await api.post(`/standar/${s.id}/tetapkan`);
      tampil(`Standar ${s.code} berhasil ditetapkan`);
      muat();
    } catch (e) { tampil(e.message, 'galat'); }
  }

  if (!data) return <Memuat />;

  const grup = tersaring.reduce((acc, s) => {
    (acc[s.category] ||= []).push(s);
    return acc;
  }, {});

  async function unduhMatriks() {
    try {
      await unduhBerkas(
        `/standar/export?period_id=${periode.id}`,
        'Matriks_Standar_dan_Kode_Modul_Penetapan_Standar.xlsx'
      );
    } catch (e) { tampil(e.message, 'galat'); }
  }

  return (
    <>
      <Toast />
      <JudulHalaman
        ikon={<Icon.Standar width={20} height={20} />}
        judul="Modul 1 — Penetapan Standar"
        deskripsi="Standar mutu internal PKTJ yang ditetapkan Satuan Penjaminan Mutu, mengacu pada ISO 21001:2018 dan Kriteria LAM Teknik 2025"
        aksi={
          <>
            <button onClick={unduhMatriks} className="btn-outline">
              <Icon.Unduh width={16} height={16} /> Ekspor Matriks Excel
            </button>
            {bolehSPM && (
              <button onClick={() => setMDupBuka(true)} className="btn-outline">
                <Icon.Segarkan width={16} height={16} /> Duplikasi dari Periode Lain
              </button>
            )}
            {bolehSPM && (
              <Link to="/standar/baru" className="btn-primary">
                <Icon.Plus width={16} height={16} /> Standar Baru
              </Link>
            )}
          </>
        }
      />

      {/* Penyaring */}
      <div className="card mb-5 flex flex-wrap items-center gap-3 p-4">
        <input
          className="input max-w-xs flex-1"
          placeholder="Cari kode, judul, atau isi standar…"
          value={cari}
          onChange={(e) => setCari(e.target.value)}
        />
        <select className="select w-auto" value={ranah} onChange={(e) => setRanah(e.target.value)}>
          <option value="">Semua ranah</option>
          {Object.entries(RANAH).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
        <select className="select w-auto" value={sifat} onChange={(e) => setSifat(e.target.value)}>
          <option value="">Wajib dan melampaui</option>
          <option value="wajib">Wajib SN Dikti</option>
          <option value="melampaui">Melampaui SN Dikti</option>
        </select>
        <select className="select w-auto" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Semua status</option>
          <option value="draft">Draf</option>
          <option value="ditetapkan">Ditetapkan</option>
        </select>
        <span className="ml-auto text-xs text-slate-500">
          {tersaring.length} standar ·{' '}
          {tersaring.reduce((a, s) => a + s.jumlah_indikator, 0)} indikator ·{' '}
          {tersaring.filter((s) => s.sifat === 'wajib').length} wajib
        </span>
      </div>

      {tersaring.length === 0 ? (
        <Kosong
          judul="Standar tidak ditemukan"
          pesan="Ubah kata kunci pencarian atau tambahkan standar baru."
        />
      ) : (
        <div className="space-y-6">
          {Object.entries(grup).map(([kat, daftar]) => (
            <div key={kat}>
              <h2 className="mb-2.5 section-title">{kat}</h2>
              <div className="grid gap-3 lg:grid-cols-2">
                {daftar.map((s) => (
                  <div key={s.id} className="card-p flex flex-col">
                    <div className="mb-2 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <span className="font-mono text-xs font-semibold text-pktj-600">
                          {s.code}
                        </span>
                        <h3 className="mt-0.5 text-sm font-semibold leading-snug">
                          {s.title}
                        </h3>
                      </div>
                      <Badge status={s.status} />
                    </div>

                    {s.pernyataan_utama && (
                      <p className="mb-3 line-clamp-3 text-xs leading-relaxed text-slate-600">
                        {s.pernyataan_utama}
                        {s.jumlah_pernyataan > 1 && (
                          <span className="text-slate-400"> · +{s.jumlah_pernyataan - 1} pernyataan lainnya</span>
                        )}
                      </p>
                    )}

                    <div className="mb-3 flex flex-wrap gap-1.5 text-[11px]">
                      <span className={`badge ${SIFAT[s.sifat]?.cls || 'bg-slate-100'}`}>
                        {SIFAT[s.sifat]?.label || s.sifat}
                      </span>
                      {s.kelompok && (
                        <span className="badge bg-slate-100 text-slate-600">
                          {KELOMPOK[s.kelompok]}
                        </span>
                      )}
                      <span className={`badge ${
                        s.jumlah_acuan > 0
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-rose-50 text-rose-700'
                      }`}>
                        {s.jumlah_acuan > 0
                          ? `${s.jumlah_acuan} butir acuan`
                          : 'belum bersandar acuan'}
                      </span>
                    </div>

                    <div className="mt-auto flex items-center justify-between border-t border-slate-100 pt-3">
                      <p className="text-xs text-slate-500">
                        {s.jumlah_indikator} indikator · {s.jumlah_unit} unit
                        {s.ditetapkan_at && ` · ${tanggalID(s.ditetapkan_at)}`}
                      </p>
                      <div className="flex gap-1.5">
                        {bolehSPM && s.status === 'draft' && (
                          <button onClick={() => tetapkan(s)} className="btn-success btn-sm">
                            Tetapkan
                          </button>
                        )}
                        <Link to={`/standar/${s.id}`} className="btn-outline btn-sm">
                          {bolehSPM ? 'Kelola' : 'Lihat'}
                        </Link>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <ModalDuplikasi
        open={mDupBuka}
        onClose={() => setMDupBuka(false)}
        periodeAktif={periode}
        onSelesai={(hasil) => {
          const bagian = [`${hasil.diduplikasi.length} standar berhasil diduplikasi`];
          if (hasil.dilewati.length) {
            bagian.push(`${hasil.dilewati.length} dilewati karena kode sudah ada (${hasil.dilewati.join(', ')})`);
          }
          tampil(bagian.join(' · '), hasil.diduplikasi.length ? 'sukses' : 'galat');
          muat();
        }}
      />
    </>
  );
}

function ModalDuplikasi({ open, onClose, periodeAktif, onSelesai }) {
  const [periodeList, setPeriodeList] = useState(null);
  const [sourceId, setSourceId] = useState('');
  const [standarSumber, setStandarSumber] = useState(null);
  const [dipilih, setDipilih] = useState(new Set());
  const [mengirim, setMengirim] = useState(false);
  const [galat, setGalat] = useState('');

  useEffect(() => {
    if (!open) return;
    setSourceId('');
    setStandarSumber(null);
    setDipilih(new Set());
    setGalat('');
    api.get('/master/periods').then((list) =>
      setPeriodeList((list || []).filter((p) => p.id !== periodeAktif?.id))
    );
  }, [open, periodeAktif?.id]);

  useEffect(() => {
    if (!sourceId) { setStandarSumber(null); setDipilih(new Set()); return; }
    api.get(`/standar?period_id=${sourceId}`).then((list) => {
      setStandarSumber(list || []);
      setDipilih(new Set((list || []).map((s) => s.id)));
    });
  }, [sourceId]);

  function toggleSemua() {
    if (!standarSumber) return;
    setDipilih((d) =>
      d.size === standarSumber.length ? new Set() : new Set(standarSumber.map((s) => s.id))
    );
  }
  function toggleSatu(id) {
    setDipilih((d) => {
      const n = new Set(d);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }

  async function kirim() {
    if (!sourceId || dipilih.size === 0) return;
    setMengirim(true);
    setGalat('');
    try {
      const hasil = await api.post('/standar/duplikasi', {
        source_period_id: Number(sourceId),
        target_period_id: periodeAktif.id,
        standard_ids: [...dipilih],
      });
      onSelesai(hasil);
      onClose();
    } catch (e) {
      setGalat(e.message);
    } finally {
      setMengirim(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Duplikasi Penetapan Standar dari Periode Lain"
      lebar="max-w-2xl"
      footer={
        <>
          <button type="button" onClick={onClose} className="btn-outline btn-sm">
            Batal
          </button>
          <button
            type="button"
            onClick={kirim}
            disabled={!sourceId || dipilih.size === 0 || mengirim}
            className="btn-primary btn-sm"
          >
            {mengirim ? 'Menduplikasi…' : `Duplikasi ${dipilih.size || ''} Standar`}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-xs text-slate-500">
          Standar yang dipilih akan disalin — beserta pernyataan, indikator, dan penugasan
          unit pengampu/pelaksana — ke periode aktif ({periodeAktif?.name}) berstatus{' '}
          <strong>draf</strong>. Standar yang kodenya sudah ada di periode aktif akan dilewati.
        </p>

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Periode Sumber</label>
          <select
            className="select w-full"
            value={sourceId}
            onChange={(e) => setSourceId(e.target.value)}
          >
            <option value="">Pilih periode…</option>
            {(periodeList || []).map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        {galat && <p className="text-xs text-rose-600">{galat}</p>}

        {sourceId && !standarSumber && <Memuat />}

        {standarSumber && standarSumber.length === 0 && (
          <p className="text-xs text-slate-500">Periode ini tidak memiliki standar.</p>
        )}

        {standarSumber && standarSumber.length > 0 && (
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
                <input
                  type="checkbox"
                  checked={dipilih.size === standarSumber.length}
                  onChange={toggleSemua}
                />
                Pilih semua ({standarSumber.length} standar)
              </label>
              <span className="text-xs text-slate-500">{dipilih.size} dipilih</span>
            </div>
            <div className="max-h-64 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-2">
              {standarSumber.map((s) => (
                <label
                  key={s.id}
                  className="flex items-center gap-2 rounded px-2 py-1.5 text-xs hover:bg-slate-50"
                >
                  <input
                    type="checkbox"
                    checked={dipilih.has(s.id)}
                    onChange={() => toggleSatu(s.id)}
                  />
                  <span className="font-mono font-semibold text-pktj-600">{s.code}</span>
                  <span className="truncate text-slate-700">{s.title}</span>
                </label>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
