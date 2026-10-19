import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, tanggalID } from '../api.js';
import { useAuth } from '../auth.jsx';
import { Badge, Icon, JudulHalaman, Kosong, Memuat } from '../components/ui.jsx';

const TAHAP = [
  { k: 'menunggu_auditee',     l: 'Menunggu Auditee',      w: 'text-rose-600' },
  { k: 'rencana_disusun',      l: 'Rencana Disusun',       w: 'text-amber-600' },
  { k: 'realisasi_dilaporkan', l: 'Realisasi Dilaporkan',  w: 'text-sky-600' },
  { k: 'ditutup',              l: 'Ditutup',               w: 'text-emerald-600' },
];

export default function Pengendalian() {
  const { periode, user } = useAuth();
  const [data, setData] = useState(null);
  const [units, setUnits] = useState([]);
  const [unitId, setUnitId] = useState('');
  const [kategori, setKategori] = useState('');
  const [tahap, setTahap] = useState('');

  useEffect(() => {
    api.get('/master/units').then(setUnits).catch(() => {});
  }, []);

  useEffect(() => {
    if (!periode) return;
    api.get(`/pengendalian?period_id=${periode.id}`).then(setData);
  }, [periode?.id]);

  const tersaring = useMemo(
    () =>
      (data || []).filter(
        (t) =>
          (!unitId || String(t.unit_id) === unitId) &&
          (!kategori || t.kategori === kategori) &&
          (!tahap || (t.status || 'menunggu_auditee') === tahap)
      ),
    [data, unitId, kategori, tahap]
  );

  if (!data) return <Memuat />;

  const hitung = (k) =>
    data.filter((t) => (t.status || 'menunggu_auditee') === k).length;

  const hariIni = new Date().toISOString().slice(0, 10);

  return (
    <>
      <JudulHalaman
        ikon={<Icon.Kendali width={20} height={20} />}
        judul="Modul 4 — Pengendalian Standar"
        deskripsi="Auditee menyusun tindakan koreksi atas ketidaksesuaian; auditor dan Satuan Penjaminan Mutu memantau realisasi dan efektivitasnya"
        aksi={
          <>
            {user.role !== 'auditee' && (
              <select className="select w-auto" value={unitId}
                onChange={(e) => setUnitId(e.target.value)}>
                <option value="">Semua unit</option>
                {units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            )}
            <Link
              to={`/pengendalian/daftar-ptk?${new URLSearchParams({
                ...(unitId ? { unit_id: unitId } : {}),
                ...(kategori ? { kategori } : {}),
              })}`}
              className="btn-outline">
              <Icon.Cetak width={16} height={16} /> Cetak Daftar PTK
            </Link>
          </>
        }
      />

      {/* Kartu tahapan */}
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {TAHAP.map((t) => (
          <button
            key={t.k}
            onClick={() => setTahap(tahap === t.k ? '' : t.k)}
            className={`card-p text-left transition-all hover:shadow-md ${
              tahap === t.k ? 'ring-2 ring-pktj-500' : ''
            }`}
          >
            <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
              {t.l}
            </p>
            <p className={`mt-1 text-3xl font-bold ${t.w}`}>{hitung(t.k)}</p>
          </button>
        ))}
      </div>

      <div className="no-print mb-4 flex flex-wrap gap-2">
        {['', 'KTS Mayor', 'KTS Minor', 'Observasi'].map((k) => (
          <button key={k || 'semua'} onClick={() => setKategori(k)}
            className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${
              kategori === k ? 'bg-pktj-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-100'
            }`}>
            {k || 'Semua kategori'}
          </button>
        ))}
      </div>

      {tersaring.length === 0 ? (
        <Kosong
          judul="Tidak ada ketidaksesuaian"
          pesan="Ketidaksesuaian akan muncul di sini setelah auditor menetapkannya pada Modul 3 Evaluasi Mutu Internal."
        />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="th w-36">Kode Temuan</th>
                  <th className="th w-24">Kategori</th>
                  <th className="th">Uraian Ketidaksesuaian</th>
                  <th className="th w-40">Unit</th>
                  <th className="th w-28">Rencana Selesai</th>
                  <th className="th w-32">Efektivitas</th>
                  <th className="th w-40">Status</th>
                  <th className="th w-20"></th>
                </tr>
              </thead>
              <tbody>
                {tersaring.map((t) => {
                  const lewat =
                    t.rencana_tanggal && t.rencana_tanggal < hariIni && t.status !== 'ditutup';
                  return (
                    <tr key={t.finding_code} className="hover:bg-slate-50/60">
                      <td className="td font-mono text-xs font-semibold text-pktj-700">
                        {t.finding_code}
                        <p className="mt-0.5 font-sans text-[11px] font-normal text-slate-400">
                          {t.ba_number}
                        </p>
                      </td>
                      <td className="td">
                        <span className={`badge ${
                          t.kategori === 'KTS Mayor' ? 'bg-rose-100 text-rose-800'
                          : t.kategori === 'KTS Minor' ? 'bg-amber-100 text-amber-800'
                          : 'bg-sky-100 text-sky-800'
                        }`}>
                          {t.kategori}
                        </span>
                      </td>
                      <td className="td max-w-md">
                        <p className="line-clamp-2 text-xs">{t.uraian_temuan}</p>
                        {t.standar_kode && (
                          <p className="mt-1 text-[11px] text-slate-400">
                            {t.standar_kode} · {t.indikator_kode}
                          </p>
                        )}
                      </td>
                      <td className="td text-xs">{t.unit_name}</td>
                      <td className="td">
                        <span className={`text-xs ${lewat ? 'font-semibold text-rose-600' : ''}`}>
                          {t.rencana_tanggal ? tanggalID(t.rencana_tanggal) : '-'}
                        </span>
                        {lewat && (
                          <p className="text-[10px] font-medium text-rose-500">Terlambat</p>
                        )}
                      </td>
                      <td className="td">
                        {t.efektivitas ? <Badge status={t.efektivitas} />
                          : <span className="text-xs text-slate-400">-</span>}
                      </td>
                      <td className="td">
                        <Badge status={t.status || 'menunggu_auditee'} />
                      </td>
                      <td className="td">
                        <Link to={`/pengendalian/${t.finding_id}`} className="btn-outline btn-sm">
                          Buka
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
