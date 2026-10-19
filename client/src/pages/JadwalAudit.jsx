import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, hariTanggalID, tanggalID } from '../api.js';
import { useAuth } from '../auth.jsx';
import { Icon, Memuat, Modal, PadTandaTangan, useToast } from '../components/ui.jsx';
import logoPTK from '../assets/logo-ptk-form.png';

/** Formulir Jadwal Pelaksanaan Audit Internal — mengikuti format FRM.08. */
export default function JadwalAudit() {
  const { periode, user, bolehSPM } = useAuth();
  const { tampil, Toast } = useToast();
  const [params] = useSearchParams();
  const unitId = params.get('unit_id') || '';

  const [data, setData] = useState(null);
  const [unit, setUnit] = useState(null);
  const [ttd, setTtd] = useState(null);
  const [ttdBuka, setTtdBuka] = useState(false);
  const [gambar, setGambar] = useState(null);
  const [tanggalCetak, setTanggalCetak] = useState(new Date().toISOString().slice(0, 10));

  async function muatTtd() {
    if (!periode) return;
    const daftar = await api.get(`/emi/jadwal/${periode.id}/tanda-tangan`);
    setTtd(daftar[0] || null);
  }

  useEffect(() => {
    if (!periode) return;
    const q = new URLSearchParams({ period_id: periode.id });
    if (unitId) q.set('unit_id', unitId);
    api.get(`/emi?${q}`).then((rows) => {
      const urut = [...rows].sort((a, b) => {
        const ta = `${a.scheduled_date || ''}T${a.scheduled_time || ''}`;
        const tb = `${b.scheduled_date || ''}T${b.scheduled_time || ''}`;
        return ta.localeCompare(tb);
      });
      setData(urut);
    });
    muatTtd();
  }, [periode?.id, unitId]);

  useEffect(() => {
    if (unitId) api.get('/master/units').then((us) => setUnit(us.find((u) => String(u.id) === unitId)));
    else setUnit(null);
  }, [unitId]);

  async function simpanTtd() {
    if (!gambar) return tampil('Bubuhkan tanda tangan terlebih dahulu', 'galat');
    try {
      await api.post(`/emi/jadwal/${periode.id}/tanda-tangan`, { image_data: gambar });
      tampil('Jadwal audit disetujui dan ditandatangani');
      setTtdBuka(false);
      setGambar(null);
      muatTtd();
    } catch (e) { tampil(e.message, 'galat'); }
  }

  async function tarikTtd() {
    if (!confirm('Tarik kembali persetujuan jadwal audit ini?')) return;
    try {
      await api.del(`/emi/jadwal/${periode.id}/tanda-tangan`);
      tampil('Persetujuan jadwal audit ditarik');
      muatTtd();
    } catch (e) { tampil(e.message, 'galat'); }
  }

  if (!data) return <Memuat />;

  const tim = (a) =>
    [a.lead_auditor_name, a.anggota_names].filter(Boolean).join(', ') || '-';

  return (
    <>
      <Toast />

      <div className="no-print mb-5 flex flex-wrap items-center justify-between gap-3">
        <Link to="/emi" className="btn-outline">
          <Icon.Kembali width={16} height={16} /> Modul 3 — Evaluasi Mutu Internal
        </Link>
        <div className="flex flex-wrap gap-2">
          {bolehSPM && !ttd && (
            <button onClick={() => setTtdBuka(true)} className="btn-warn">
              <Icon.Pena width={16} height={16} /> Setujui &amp; Tanda Tangani
            </button>
          )}
          {bolehSPM && ttd && (
            <button onClick={tarikTtd} className="btn-outline text-rose-600">
              Tarik Persetujuan
            </button>
          )}
          <button onClick={() => window.print()} className="btn-primary">
            <Icon.Cetak width={16} height={16} /> Cetak / Simpan PDF
          </button>
        </div>
      </div>

      <div className="print-area card mx-auto max-w-5xl bg-white p-10 text-[13px] leading-relaxed text-slate-900">
        {/* Kotak judul + logo, sesuai formulir FRM.08 */}
        <div className="mb-6 flex items-center justify-between border-2 border-slate-900 px-5 py-3">
          <h1 className="text-lg font-bold uppercase tracking-wide">
            Jadwal Pelaksanaan Audit Internal
          </h1>
          <img src={logoPTK} alt="Logo PKTJ" className="h-16 w-16 shrink-0 object-contain" />
        </div>

        {(periode || unit) && (
          <p className="mb-4 text-xs text-slate-600">
            {periode?.name}
            {unit && ` · ${unit.name}`}
          </p>
        )}

        {data.length === 0 ? (
          <p className="mb-6 italic text-slate-600">
            Belum ada audit terjadwal pada cakupan ini.
          </p>
        ) : (
          <table className="mb-10 w-full border-collapse border border-slate-900 text-[11px]">
            <thead>
              <tr className="bg-slate-100">
                <th className="border border-slate-900 px-2 py-1.5 w-8">No</th>
                <th className="border border-slate-900 px-2 py-1.5 w-32">Hari/Tanggal</th>
                <th className="border border-slate-900 px-2 py-1.5 w-24">Jam</th>
                <th className="border border-slate-900 px-2 py-1.5 w-32">Divisi Yang Diaudit</th>
                <th className="border border-slate-900 px-2 py-1.5">Tim Audit (Ketua dan Anggota)</th>
                <th className="border border-slate-900 px-2 py-1.5">Persyaratan Standar</th>
              </tr>
            </thead>
            <tbody>
              {data.map((a, i) => (
                <tr key={a.id}>
                  <td className="border border-slate-900 px-2 py-1.5 text-center">{i + 1}</td>
                  <td className="border border-slate-900 px-2 py-1.5">
                    {hariTanggalID(a.scheduled_date)}
                  </td>
                  <td className="border border-slate-900 px-2 py-1.5">
                    {a.scheduled_time || '-'}
                  </td>
                  <td className="border border-slate-900 px-2 py-1.5">{a.unit_name}</td>
                  <td className="border border-slate-900 px-2 py-1.5">{tim(a)}</td>
                  <td className="border border-slate-900 px-2 py-1.5">
                    {a.persyaratan_standar || '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div className="flex justify-end">
          <div className="w-full max-w-xs text-center">
            <div className="no-print mb-2 flex items-center justify-end gap-2">
              <label className="text-xs text-slate-500">Tanggal:</label>
              <input type="date" className="input w-40 py-1 text-xs" value={tanggalCetak}
                onChange={(e) => setTanggalCetak(e.target.value)} />
            </div>
            <p className="print-only mb-2 text-right">
              Tegal, {tanggalID(tanggalCetak)}
            </p>
            <p>Disetujui oleh:</p>
            <div className="flex h-16 items-center justify-center">
              {ttd && (
                <img src={ttd.image_data} alt={`Tanda tangan ${ttd.nama}`}
                  className="max-h-14 object-contain" />
              )}
            </div>
            <p className="border-t border-slate-900 pt-1 font-bold">
              {ttd ? ttd.nama : 'Nama Jelas'}
            </p>
          </div>
        </div>

        <p className="mt-6 text-xs text-slate-500">FRM.08 Rev. 00</p>
      </div>

      <Modal
        open={ttdBuka} onClose={() => setTtdBuka(false)}
        title="Persetujuan Jadwal Pelaksanaan Audit — Satuan Penjaminan Mutu"
        footer={
          <>
            <button onClick={() => setTtdBuka(false)} className="btn-outline">Batal</button>
            <button onClick={simpanTtd} className="btn-primary">Setujui &amp; Tanda Tangani</button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="rounded-lg bg-slate-50 p-4 text-sm">
            <p><span className="text-slate-500">Nama: </span>
              <span className="font-medium">{user.name}</span></p>
            <p><span className="text-slate-500">Jabatan: </span>
              <span className="font-medium">{user.jabatan || '-'}</span></p>
          </div>
          <p className="text-xs text-slate-600">
            Dengan membubuhkan tanda tangan, Anda menyetujui jadwal pelaksanaan audit
            internal pada periode ini.
          </p>
          <PadTandaTangan onChange={setGambar} />
        </div>
      </Modal>
    </>
  );
}
