import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, tanggalID, VERDICT } from '../api.js';
import { Icon, Memuat } from '../components/ui.jsx';
import logoPTK from '../assets/logo-ptk-form.png';

/** Audit Checklist — daftar standar, indikator, catatan auditor, dan hasil penilaian. */
export default function AuditChecklist() {
  const { id } = useParams();
  const [d, setD] = useState(null);

  useEffect(() => { api.get(`/emi/${id}/lembar-penilaian`).then(setD); }, [id]);

  if (!d) return <Memuat />;
  const { audit: a, items } = d;

  const grup = items.reduce((acc, i) => {
    (acc[`${i.standar_kode} — ${i.standar_judul}`] ||= []).push(i);
    return acc;
  }, {});

  return (
    <>
      <div className="no-print mb-5 flex flex-wrap items-center justify-between gap-3">
        <Link to={`/emi/${id}`} className="btn-outline">
          <Icon.Kembali width={16} height={16} /> Lembar Penilaian
        </Link>
        <button onClick={() => window.print()} className="btn-primary">
          <Icon.Cetak width={16} height={16} /> Cetak / Simpan PDF
        </button>
      </div>

      <div className="print-area card mx-auto max-w-5xl bg-white p-10 text-[13px] leading-relaxed text-slate-900">
        <div className="mb-6 flex items-center justify-between border-2 border-slate-900 px-5 py-3">
          <h1 className="text-lg font-bold uppercase tracking-wide">Audit Checklist</h1>
          <img src={logoPTK} alt="Logo PKTJ" className="h-16 w-16 shrink-0 object-contain" />
        </div>

        <table className="mb-6 w-full text-[12px]">
          <tbody>
            <tr>
              <td className="w-32 py-0.5 align-top">Unit / Struktur</td>
              <td className="w-3 py-0.5 align-top">:</td>
              <td className="py-0.5 font-semibold">{a.unit_name}</td>
            </tr>
            <tr>
              <td className="py-0.5 align-top">Periode</td>
              <td className="py-0.5 align-top">:</td>
              <td className="py-0.5">{a.period_name}</td>
            </tr>
            <tr>
              <td className="py-0.5 align-top">Tanggal audit</td>
              <td className="py-0.5 align-top">:</td>
              <td className="py-0.5">{tanggalID(a.executed_date || a.scheduled_date)}</td>
            </tr>
            <tr>
              <td className="py-0.5 align-top">Nomor berita acara</td>
              <td className="py-0.5 align-top">:</td>
              <td className="py-0.5 font-mono">{a.ba_number || '-'}</td>
            </tr>
          </tbody>
        </table>

        {Object.entries(grup).map(([judul, daftar]) => (
          <div key={judul} className="mb-5">
            <h2 className="mb-1.5 font-bold">{judul}</h2>
            <table className="w-full border-collapse border border-slate-900 text-[11px]">
              <thead>
                <tr className="bg-slate-100">
                  <th className="border border-slate-900 px-2 py-1.5 w-8">No</th>
                  <th className="border border-slate-900 px-2 py-1.5">Indikator</th>
                  <th className="border border-slate-900 px-2 py-1.5">Catatan Auditor</th>
                  <th className="border border-slate-900 px-2 py-1.5 w-24">Hasil</th>
                </tr>
              </thead>
              <tbody>
                {daftar.map((it, i) => (
                  <tr key={it.indicator_id}>
                    <td className="border border-slate-900 px-2 py-1.5 text-center">{i + 1}</td>
                    <td className="border border-slate-900 px-2 py-1.5">
                      <span className="font-mono text-[10px] text-slate-500">
                        {it.indikator_kode}
                      </span>{' '}
                      {it.indicator}
                    </td>
                    <td className="border border-slate-900 px-2 py-1.5">
                      {it.catatan_auditor || '-'}
                    </td>
                    <td className="border border-slate-900 px-2 py-1.5 text-center">
                      {it.verdict ? VERDICT[it.verdict]?.label || it.verdict : 'Belum dinilai'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}

        <p className="mt-6 text-xs text-slate-500">
          Dicetak dari Sistem Evaluasi Mutu Internal PKTJ — {tanggalID(new Date().toISOString().slice(0, 10))}
        </p>
      </div>
    </>
  );
}
