import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { api, tanggalID } from '../api.js';
import { useAuth } from '../auth.jsx';
import { Badge, Icon, JudulHalaman, Memuat, Progres } from '../components/ui.jsx';

function Kartu({ label, nilai, sub, warna = 'text-pktj-700', ikon, ke }) {
  const isi = (
    <div className="card-p h-full transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between">
        <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
          {label}
        </p>
        {ikon && <span className="text-slate-300">{ikon}</span>}
      </div>
      <p className={`mt-2 text-3xl font-bold ${warna}`}>{nilai}</p>
      {sub && <p className="mt-1 text-xs text-slate-500">{sub}</p>}
    </div>
  );
  return ke ? <Link to={ke}>{isi}</Link> : isi;
}

export default function Beranda() {
  const { user, periode } = useAuth();
  const [d, setD] = useState(null);
  const [unitData, setUnitData] = useState([]);

  useEffect(() => {
    (async () => {
      const r = await api.get('/dashboard/ringkasan');
      setD(r);
      if (r?.period?.id && user.role !== 'auditee') {
        try {
          setUnitData(await api.get(`/dashboard/capaian-unit?period_id=${r.period.id}`));
        } catch { /* abaikan */ }
      }
    })();
  }, [user.role]);

  if (!d) return <Memuat />;
  if (!d.period)
    return (
      <div className="card-p text-center text-sm text-slate-500">
        Belum ada periode SPMI. Satuan Penjaminan Mutu perlu membuat periode terlebih
        dahulu pada menu Data Master.
      </div>
    );

  const totalTemuan = d.temuan.reduce((a, t) => a + t.jumlah, 0);
  const totalDitutup = d.temuan.reduce((a, t) => a + t.ditutup, 0);
  const persenSerah = d.indikator
    ? Math.round(((d.pelaksanaan.diserahkan || 0) / d.indikator) * 100)
    : 0;

  const grafik = unitData
    .filter((u) => u.rata_capaian != null)
    .map((u) => ({ nama: u.code, capaian: u.rata_capaian, unit: u.unit_name }));

  return (
    <>
      <JudulHalaman
        judul={`Selamat datang, ${user.name.split(' ').slice(0, 2).join(' ')}`}
        deskripsi={`${periode?.name || d.period.name} — ${tanggalID(d.period.start_date)} s.d. ${tanggalID(d.period.end_date)}`}
        ikon={<Icon.Dashboard width={20} height={20} />}
      />

      {/* Kartu ringkasan siklus */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Kartu
          label="1. Standar Ditetapkan"
          nilai={`${d.standar.ditetapkan || 0}/${d.standar.total || 0}`}
          sub={`${d.indikator} indikator kinerja`}
          ikon={<Icon.Standar />} ke="/standar"
        />
        <Kartu
          label="2. Pelaksanaan"
          nilai={`${persenSerah}%`}
          sub={`${d.pelaksanaan.diserahkan || 0} dari ${d.indikator} indikator terisi`}
          warna="text-sky-700" ikon={<Icon.Pelaksanaan />} ke="/pelaksanaan"
        />
        <Kartu
          label="3. Audit Mutu"
          nilai={`${d.audit.selesai || 0}/${d.audit.total || 0}`}
          sub="berita acara ditandatangani"
          warna="text-violet-700" ikon={<Icon.Audit />} ke="/emi"
        />
        <Kartu
          label="4. Ketidaksesuaian"
          nilai={totalTemuan}
          sub={`${totalDitutup} temuan telah ditutup`}
          warna={totalTemuan > totalDitutup ? 'text-rose-600' : 'text-emerald-600'}
          ikon={<Icon.Kendali />} ke="/pengendalian"
        />
        <Kartu
          label="5. RTM"
          nilai={`${d.rtm.selesai || 0}/${d.rtm.total || 0}`}
          sub="rapat tinjauan manajemen"
          warna="text-aksen-600" ikon={<Icon.RTM />} ke="/rtm"
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {/* Grafik capaian per unit */}
        {grafik.length > 0 && (
          <div className="card-p lg:col-span-2">
            <h2 className="mb-1 text-base font-semibold">Rata-rata Capaian per Unit</h2>
            <p className="mb-4 text-xs text-slate-500">
              Persentase capaian indikator berdasarkan penilaian auditor
            </p>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={grafik} margin={{ top: 5, right: 8, left: -18, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="nama" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} stroke="#94a3b8" />
                <Tooltip
                  formatter={(v) => [`${v}%`, 'Capaian']}
                  labelFormatter={(l) => grafik.find((g) => g.nama === l)?.unit || l}
                  contentStyle={{ fontSize: 12, borderRadius: 8 }}
                />
                <Bar dataKey="capaian" radius={[4, 4, 0, 0]}>
                  {grafik.map((g, i) => (
                    <Cell
                      key={i}
                      fill={g.capaian >= 85 ? '#059669' : g.capaian >= 60 ? '#f59e0b' : '#e11d48'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Capaian per kategori standar */}
        <div className={`card-p ${grafik.length ? '' : 'lg:col-span-2'}`}>
          <h2 className="mb-4 text-base font-semibold">Capaian per Kelompok Standar</h2>
          {d.capaian_kategori.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">
              Belum ada penilaian auditor pada periode ini.
            </p>
          ) : (
            <div className="space-y-3.5">
              {d.capaian_kategori.map((k) => (
                <div key={k.category}>
                  <div className="mb-1 flex items-baseline justify-between gap-2">
                    <span className="text-xs font-medium text-slate-600">{k.category}</span>
                    <span className="text-xs font-bold tabular-nums text-slate-800">
                      {k.rata ?? 0}%
                    </span>
                  </div>
                  <Progres nilai={k.rata} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* Temuan per kategori */}
        <div className="card-p">
          <h2 className="mb-4 text-base font-semibold">Status Ketidaksesuaian</h2>
          {d.temuan.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">
              Belum ada ketidaksesuaian yang ditetapkan.
            </p>
          ) : (
            <div className="space-y-3">
              {d.temuan.map((t) => (
                <div
                  key={t.kategori}
                  className="flex items-center justify-between rounded-lg border border-slate-200 px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-medium">{t.kategori}</p>
                    <p className="text-xs text-slate-500">
                      {t.ditutup} dari {t.jumlah} telah ditutup
                    </p>
                  </div>
                  <span
                    className={`text-2xl font-bold ${
                      t.kategori === 'KTS Mayor' ? 'text-rose-600'
                        : t.kategori === 'KTS Minor' ? 'text-amber-600' : 'text-sky-600'
                    }`}
                  >
                    {t.jumlah}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Tenggat tindakan koreksi */}
        <div className="card-p">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold">Tenggat Tindakan Koreksi</h2>
            <Link to="/pengendalian" className="text-xs font-medium text-pktj-600 hover:underline">
              Lihat semua
            </Link>
          </div>
          {d.tenggat.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">
              Tidak ada tindakan koreksi yang menunggu penyelesaian.
            </p>
          ) : (
            <div className="space-y-2">
              {d.tenggat.map((t) => {
                const lewat = t.rencana_tanggal < new Date().toISOString().slice(0, 10);
                return (
                  <div
                    key={t.code}
                    className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-mono text-xs font-semibold text-slate-700">
                        {t.code}
                      </p>
                      <p className="truncate text-xs text-slate-500">{t.unit_name}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className={`text-xs font-medium ${lewat ? 'text-rose-600' : 'text-slate-600'}`}>
                        {tanggalID(t.rencana_tanggal)}
                      </p>
                      <Badge status={t.status} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
