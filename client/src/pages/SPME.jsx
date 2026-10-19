import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { Icon, JudulHalaman, Kosong, Memuat, Progres } from '../components/ui.jsx';

export default function SPME() {
  const { periode } = useAuth();
  const [data, setData] = useState(null);

  useEffect(() => {
    if (!periode) return;
    api.get(`/spme?period_id=${periode.id}`).then(setData);
  }, [periode?.id]);

  if (!periode) return <Kosong judul="Belum ada periode aktif" pesan="Tetapkan periode aktif pada Data Master terlebih dahulu." />;
  if (!data) return <Memuat />;

  const tunggal = data.filter((d) => !d.kelompok);
  const prodi = data.filter((d) => d.kelompok === 'Akreditasi Program Studi');

  return (
    <>
      <JudulHalaman
        ikon={<Icon.Global width={20} height={20} />}
        judul="Modul 6 — Sistem Penjaminan Mutu Eksternal (SPME)"
        deskripsi="Skor penerapan acuan eksternal (akreditasi, ISO 21001, Zona Integritas, UI GreenMetric) dengan pembobotan resmi tiap acuan, ditarik otomatis dari hasil penilaian auditor pada Modul 3"
      />

      {prodi.length > 0 && (
        <div className="mb-6">
          <h2 className="mb-3 section-title">Akreditasi Program Studi</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {prodi.map((d) => <KartuInstrumen key={d.kunci} d={d} />)}
          </div>
        </div>
      )}

      <div>
        {prodi.length > 0 && <h2 className="mb-3 section-title">Instrumen Lainnya</h2>}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tunggal.map((d) => <KartuInstrumen key={d.kunci} d={d} />)}
        </div>
      </div>
    </>
  );
}

function KartuInstrumen({ d }) {
  return (
    <Link to={`/spme/${d.kunci}`} className="card-p flex flex-col transition-shadow hover:shadow-md">
      <h3 className="text-sm font-semibold leading-snug">{d.label}</h3>
      {d.tersedia && <p className="mt-0.5 text-xs text-slate-500">{d.keterangan}</p>}

      {!d.tersedia ? (
        <p className="mt-4 text-xs italic text-rose-500">{d.keterangan}</p>
      ) : d.berbobot ? (
        <div className="mt-4">
          <div className="flex items-end justify-between">
            <p className="text-2xl font-bold tabular-nums text-pktj-700">
              {d.persen_tertimbang != null ? `${d.persen_tertimbang}%` : '-'}
            </p>
            <p className="text-xs text-slate-500">
              {d.skor_tertimbang != null
                ? `${d.skor_tertimbang} / ${Math.round(d.bobot_maksimal * d.skorMaks * 100) / 100}`
                : ''}
            </p>
          </div>
          <div className="mt-1.5"><Progres nilai={d.persen_tertimbang || 0} /></div>
          <p className="mt-2 text-[11px] text-slate-500">
            {d.butir_dinilai} dari {d.total_butir} butir dinilai
          </p>
        </div>
      ) : (
        <div className="mt-4">
          <p className="text-2xl font-bold tabular-nums text-pktj-700">
            {d.rata_capaian != null ? `${d.rata_capaian}%` : '-'}
          </p>
          <p className="mt-1 text-[11px] text-slate-500">
            {d.butir_dinilai} dari {d.total_butir} butir dinilai · rata-rata capaian, tanpa skor tertimbang
          </p>
        </div>
      )}
    </Link>
  );
}
