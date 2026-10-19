import { useEffect, useState } from 'react';
import { api, SIFAT } from '../../api.js';
import LayoutPublik from '../../components/LayoutPublik.jsx';
import { Kosong, Memuat, Progres } from '../../components/ui.jsx';

const WARNA_KATEGORI = {
  'KTS Mayor': 'bg-rose-500',
  'KTS Minor': 'bg-amber-500',
  'Observasi': 'bg-sky-500',
};

export default function RekapitulasiMutu() {
  const [periodId, setPeriodId] = useState(null);
  const [d, setD] = useState(null);

  useEffect(() => {
    api.get(`/publik/rekap-mutu${periodId ? `?period_id=${periodId}` : ''}`).then((r) => {
      setD(r);
      if (!periodId && r.period) setPeriodId(r.period.id);
    });
  }, [periodId]);

  return (
    <LayoutPublik>
      <div className="mx-auto max-w-4xl px-4 py-10 lg:px-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Rekapitulasi Mutu</h1>
            <p className="mt-1 text-sm text-slate-500">
              Ringkasan ketidaksesuaian hasil Evaluasi Mutu Internal (EMI) dan status penyelesaiannya.
            </p>
          </div>
          {d?.daftar_periode?.length > 0 && (
            <select className="select w-auto" value={periodId || ''} onChange={(e) => setPeriodId(Number(e.target.value))}>
              {d.daftar_periode.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          )}
        </div>

        {d === null ? (
          <Memuat teks="Memuat rekapitulasi…" />
        ) : !d.period ? (
          <Kosong judul="Belum ada data" pesan="Rekapitulasi akan tampil setelah ada hasil evaluasi mutu internal." />
        ) : (
          <>
            <h2 className="mt-6 text-sm font-bold uppercase tracking-wider text-slate-500">
              Standar Mutu Ditetapkan
            </h2>
            {d.standar.length === 0 ? (
              <p className="mt-3 text-sm text-slate-400">
                Belum ada standar yang ditetapkan pada siklus SPMI ini.
              </p>
            ) : (
              <div className="mt-3 grid gap-4 sm:grid-cols-3">
                {['wajib', 'melampaui'].map((s) => {
                  const jumlah = d.standar.find((x) => x.sifat === s)?.jumlah || 0;
                  return (
                    <div key={s} className="card-p">
                      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                        {SIFAT[s]?.label}
                      </p>
                      <p className="mt-1 text-3xl font-bold text-slate-900">{jumlah}</p>
                    </div>
                  );
                })}
                <div className="card-p bg-pktj-50">
                  <p className="text-xs font-semibold uppercase tracking-wider text-pktj-700">Total Standar</p>
                  <p className="mt-1 text-3xl font-bold text-pktj-800">
                    {d.standar.reduce((s, x) => s + x.jumlah, 0)}
                  </p>
                </div>
              </div>
            )}

            <div className="mt-10 grid gap-4 sm:grid-cols-2">
              <div className="card-p">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Ketidaksesuaian</p>
                <p className="mt-1 text-3xl font-bold text-slate-900">{d.total.temuan}</p>
              </div>
              <div className="card-p">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Sudah Diselesaikan</p>
                <p className="mt-1 text-3xl font-bold text-emerald-600">
                  {d.total.selesai}
                  <span className="ml-2 text-base font-medium text-slate-400">
                    {d.total.temuan ? `(${Math.round((d.total.selesai / d.total.temuan) * 100)}%)` : ''}
                  </span>
                </p>
              </div>
            </div>

            <h2 className="mt-10 text-sm font-bold uppercase tracking-wider text-slate-500">
              Ketidaksesuaian per Kategori
            </h2>
            {d.kategori.length === 0 ? (
              <p className="mt-3 text-sm text-slate-400">
                Belum ada ketidaksesuaian tercatat pada siklus SPMI ini.
              </p>
            ) : (
              <div className="mt-3 space-y-5">
                {d.kategori.map((k) => {
                  const persen = k.jumlah ? Math.round((k.selesai / k.jumlah) * 100) : 0;
                  return (
                    <div key={k.kategori} className="card-p">
                      <div className="mb-2 flex items-center justify-between text-sm">
                        <span className="font-semibold text-slate-800">{k.kategori}</span>
                        <span className="text-slate-500">{k.selesai} dari {k.jumlah} selesai ({persen}%)</span>
                      </div>
                      <Progres nilai={persen} warna={WARNA_KATEGORI[k.kategori]} />
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </LayoutPublik>
  );
}
