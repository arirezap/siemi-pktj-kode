import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, KELOMPOK, SIFAT } from '../api.js';
import { useAuth } from '../auth.jsx';
import { Icon, JudulHalaman, Kosong, Memuat, Progres } from '../components/ui.jsx';
import { useRanah } from '../hooks/useRanah.js';

export default function Cakupan() {
  const { periode } = useAuth();
  const { ranah: RANAH } = useRanah();
  const [d, setD] = useState(null);
  const [tab, setTab] = useState('ringkasan');
  const [filterAcuan, setFilterAcuan] = useState('');

  useEffect(() => {
    if (!periode) return;
    api.get(`/acuan/laporan/cakupan?period_id=${periode.id}`).then(setD);
  }, [periode?.id]);

  const yatimTersaring = useMemo(
    () =>
      (d?.butir_yatim || []).filter(
        (b) => !filterAcuan || b.acuan_kode === filterAcuan
      ),
    [d, filterAcuan]
  );

  const manualPerStandar = useMemo(() => {
    const peta = new Map();
    (d?.indikator_manual || []).forEach((it) => {
      const arr = peta.get(it.standard_id) || [];
      arr.push(it);
      peta.set(it.standard_id, arr);
    });
    return peta;
  }, [d]);

  if (!d) return <Memuat />;

  const totalWajib = d.ringkasan.reduce((a, r) => a + (r.butir_wajib || 0), 0);
  const totalTerpetakan = d.ringkasan.reduce((a, r) => a + (r.terpetakan || 0), 0);
  const persenTotal = totalWajib ? Math.round((totalTerpetakan / totalWajib) * 100) : 0;

  return (
    <>
      <JudulHalaman
        ikon={<Icon.Cakupan width={20} height={20} />}
        judul="Cakupan Acuan"
        deskripsi="Memeriksa dua arah: butir acuan mana yang belum diadopsi jadi indikator, dan standar/indikator mana yang belum bersandar pada acuan mana pun"
      />

      {/* Ringkasan menyeluruh */}
      <div className="card-p mb-6">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div>
            <p className="text-xs uppercase tracking-wider text-slate-500">
              Cakupan seluruh acuan
            </p>
            <p className="mt-1 text-3xl font-bold tabular-nums text-pktj-700">
              {persenTotal}%
            </p>
            <p className="mt-0.5 text-xs text-slate-500">
              {totalTerpetakan} dari {totalWajib} butir sudah diadopsi
            </p>
          </div>
          <div className="flex-1" style={{ minWidth: 220 }}>
            <Progres nilai={persenTotal} />
          </div>
          <div className="flex gap-8 text-center">
            <div>
              <p className="text-2xl font-bold tabular-nums text-rose-600">
                {d.butir_yatim.length}
              </p>
              <p className="text-[11px] uppercase tracking-wide text-slate-500">
                Butir belum diadopsi
              </p>
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums text-amber-600">
                {d.standar_tanpa_acuan.length}
              </p>
              <p className="text-[11px] uppercase tracking-wide text-slate-500">
                Standar tanpa acuan
              </p>
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums text-amber-600">
                {(d.indikator_manual || []).length}
              </p>
              <p className="text-[11px] uppercase tracking-wide text-slate-500">
                Indikator manual belum di acuan
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="mb-5 flex flex-wrap gap-2">
        {[
          ['ringkasan', 'Ringkasan per Acuan'],
          ['yatim', `Butir Belum Diadopsi (${d.butir_yatim.length})`],
          ['standar', `Standar Tanpa Acuan (${d.standar_tanpa_acuan.length})`],
          ['manual', `Indikator Manual (${(d.indikator_manual || []).length})`],
          ['ranah', 'Serapan per Ranah'],
        ].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              tab === k ? 'bg-pktj-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-100'
            }`}>
            {l}
          </button>
        ))}
      </div>

      {/* ---------------------------- RINGKASAN ---------------------------- */}
      {tab === 'ringkasan' && (
        <div className="grid gap-4 lg:grid-cols-2">
          {d.ringkasan.map((r) => (
            <div key={r.id} className="card-p">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <span className="badge"
                    style={{ background: (r.warna || '#64748b') + '22', color: r.warna || '#475569' }}>
                    {r.code}
                  </span>
                  <h3 className="mt-1.5 text-sm font-semibold leading-snug">{r.name}</h3>
                  {r.version && <p className="text-xs text-slate-500">{r.version}</p>}
                </div>
                <span className="shrink-0 text-2xl font-bold tabular-nums text-slate-800">
                  {r.persen == null ? '—' : `${r.persen}%`}
                </span>
              </div>

              {r.butir_wajib === 0 ? (
                <p className="rounded-md bg-amber-50 px-3 py-2 text-xs leading-snug text-amber-800">
                  Belum ada butir yang diunggah untuk acuan ini, sehingga cakupannya belum
                  dapat dihitung.
                </p>
              ) : (
                <>
                  <Progres nilai={r.persen} />
                  <p className="mt-1.5 text-xs text-slate-500">
                    {r.terpetakan} dari {r.butir_wajib} butir sudah diadopsi ·{' '}
                    <span className={r.butir_wajib - r.terpetakan > 0 ? 'font-medium text-rose-600' : ''}>
                      {r.butir_wajib - r.terpetakan} belum diadopsi
                    </span>
                  </p>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ------------------------------ YATIM ------------------------------ */}
      {tab === 'yatim' && (
        d.butir_yatim.length === 0 ? (
          <Kosong
            judul="Seluruh butir acuan sudah diadopsi"
            pesan="Tidak ada butir wajib yang belum diadopsi sebagai indikator standar. Perlu diingat, ini hanya berlaku untuk butir yang sudah diunggah."
          />
        ) : (
          <div className="card overflow-hidden">
            <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-5 py-3">
              <p className="mr-auto text-sm text-slate-600">
                Butir berikut belum diadopsi sebagai indikator standar mana pun. Setiap barisnya adalah lubang cakupan.
              </p>
              <select className="select w-auto" value={filterAcuan}
                onChange={(e) => setFilterAcuan(e.target.value)}>
                <option value="">Semua acuan</option>
                {[...new Set(d.butir_yatim.map((b) => b.acuan_kode))].map((k) => (
                  <option key={k} value={k}>{k}</option>
                ))}
              </select>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="th w-32">Acuan</th>
                    <th className="th w-36">Kode Butir</th>
                    <th className="th">Judul Butir</th>
                    <th className="th w-32">Tipe</th>
                  </tr>
                </thead>
                <tbody>
                  {yatimTersaring.map((b) => (
                    <tr key={b.id}>
                      <td className="td">
                        <span className="badge bg-slate-100 text-slate-700">{b.acuan_kode}</span>
                      </td>
                      <td className="td font-mono text-xs font-semibold text-pktj-700">{b.code}</td>
                      <td className="td text-sm">{b.title}</td>
                      <td className="td text-xs text-slate-500">
                        {String(b.tipe).replace('_', ' ')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}

      {/* -------------------------- TANPA ACUAN ---------------------------- */}
      {tab === 'standar' && (
        d.standar_tanpa_acuan.length === 0 ? (
          <Kosong judul="Setiap standar sudah bersandar pada minimal satu acuan" />
        ) : (
          <>
            <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <Icon.Info width={18} height={18} />
              <p>
                Standar berikut tidak bersandar pada acuan mana pun. Ini bukan otomatis
                kesalahan — standar internal murni memang sah dan sering paling bernilai —
                tetapi keberadaannya harus disadari dan punya alasan yang tercatat. Butir
                indikatornya (seluruhnya ditulis manual, karena standar ini belum
                tertaut acuan mana pun) ditampilkan di bawah kode standar masing-masing.
              </p>
            </div>
            <div className="card overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="th w-28">Kode</th>
                    <th className="th">Judul Standar &amp; Indikator Manual</th>
                    <th className="th w-56">Ranah</th>
                    <th className="th w-40">Sifat</th>
                    <th className="th w-20"></th>
                  </tr>
                </thead>
                <tbody>
                  {d.standar_tanpa_acuan.map((s) => {
                    const manual = manualPerStandar.get(s.id) || [];
                    return (
                      <tr key={s.id}>
                        <td className="td font-mono text-xs font-semibold text-pktj-700 align-top">{s.code}</td>
                        <td className="td text-sm">
                          <p>{s.title}</p>
                          {manual.length > 0 && (
                            <ul className="mt-1.5 space-y-1 border-l-2 border-amber-200 pl-2.5">
                              {manual.map((it) => (
                                <li key={it.id} className="text-xs leading-snug text-slate-600">
                                  <span className="font-mono text-[11px] text-slate-400">{it.code}</span>{' '}
                                  {it.indicator}
                                </li>
                              ))}
                            </ul>
                          )}
                        </td>
                        <td className="td align-top">
                          <span className={`badge ${RANAH[s.ranah]?.cls || 'bg-slate-100 text-slate-700'}`}>
                            {RANAH[s.ranah]?.pendek || s.ranah}
                            {s.kelompok && ` · ${KELOMPOK[s.kelompok]}`}
                          </span>
                        </td>
                        <td className="td align-top">
                          <span className={`badge ${SIFAT[s.sifat]?.cls}`}>
                            {SIFAT[s.sifat]?.label}
                          </span>
                        </td>
                        <td className="td align-top">
                          <Link to={`/standar/${s.id}`} className="btn-outline btn-sm">Buka</Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )
      )}

      {/* ----------------------------- MANUAL ------------------------------ */}
      {tab === 'manual' && (
        (d.indikator_manual || []).length === 0 ? (
          <Kosong
            judul="Tidak ada indikator manual yang belum termasuk acuan"
            pesan="Seluruh indikator yang ditulis manual sudah tertaut ke acuan mutu (adopsi verbatim atau pemetaan longgar), atau memang belum ada indikator manual sama sekali."
          />
        ) : (
          <div className="card overflow-hidden">
            <div className="border-b border-slate-200 px-5 py-3">
              <p className="text-sm text-slate-600">
                Indikator berikut ditulis manual dan belum termasuk/tertaut ke acuan mutu
                mana pun — baik pada standar yang seluruhnya manual maupun standar yang
                sebagian indikatornya sudah diadopsi dari acuan.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="th w-28">Standar</th>
                    <th className="th">Judul Standar</th>
                    <th className="th w-32">Kode Indikator</th>
                    <th className="th">Indikator</th>
                    <th className="th w-20"></th>
                  </tr>
                </thead>
                <tbody>
                  {d.indikator_manual.map((it) => (
                    <tr key={it.id}>
                      <td className="td font-mono text-xs font-semibold text-pktj-700">{it.standar_kode}</td>
                      <td className="td text-sm">{it.standar_judul}</td>
                      <td className="td font-mono text-xs text-slate-500">{it.code}</td>
                      <td className="td text-sm">{it.indicator}</td>
                      <td className="td">
                        <Link to={`/standar/${it.standard_id}`} className="btn-outline btn-sm">Buka</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}

      {/* ----------------------------- PER RANAH --------------------------- */}
      {tab === 'ranah' && (
        <div className="card overflow-hidden">
          <div className="border-b border-slate-200 px-5 py-3">
            <h2 className="text-sm font-semibold">Serapan Butir Acuan per Ranah</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Ranah dengan banyak standar namun sedikit butir terserap menandakan standar
              internal yang belum ditautkan ke acuan.
            </p>
          </div>
          <table className="w-full">
            <thead>
              <tr>
                <th className="th">Ranah dan Kelompok</th>
                <th className="th w-32">Jumlah Standar</th>
                <th className="th w-36">Butir Acuan Terserap</th>
                <th className="th w-32">Rata per Standar</th>
              </tr>
            </thead>
            <tbody>
              {d.per_ranah.map((r) => (
                <tr key={`${r.ranah}-${r.kelompok}`}>
                  <td className="td text-sm">
                    <span className={`badge ${RANAH[r.ranah]?.cls || 'bg-slate-100'}`}>
                      {RANAH[r.ranah]?.pendek || r.ranah}
                    </span>
                    {r.kelompok && (
                      <span className="ml-2 text-xs text-slate-500">{KELOMPOK[r.kelompok]}</span>
                    )}
                  </td>
                  <td className="td text-center tabular-nums">{r.jumlah_standar}</td>
                  <td className="td text-center tabular-nums">{r.butir_terserap}</td>
                  <td className="td text-center tabular-nums text-slate-600">
                    {r.jumlah_standar
                      ? (r.butir_terserap / r.jumlah_standar).toFixed(1)
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
