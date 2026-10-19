import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, tanggalID } from '../api.js';
import { useAuth } from '../auth.jsx';
import { Icon, Memuat, Modal, PadTandaTangan, useToast } from '../components/ui.jsx';
import kopPKTJ from '../assets/kop-pktj.png';

export default function DaftarPTK() {
  const { periode, user, bolehAuditor } = useAuth();
  const { tampil, Toast } = useToast();
  const [params] = useSearchParams();
  const unitId = params.get('unit_id') || '';
  const kategori = params.get('kategori') || '';

  const [data, setData] = useState(null);
  const [unit, setUnit] = useState(null);
  const [ttd, setTtd] = useState(null);
  const [ttdBuka, setTtdBuka] = useState(false);
  const [gambar, setGambar] = useState(null);
  const [tanggalCetak, setTanggalCetak] = useState(new Date().toISOString().slice(0, 10));

  async function muatTtd() {
    if (!periode) return;
    const daftar = await api.get(`/pengendalian/daftar-ptk/${periode.id}/tanda-tangan`);
    setTtd(daftar[0] || null);
  }

  useEffect(() => {
    if (!periode) return;
    const q = new URLSearchParams({ period_id: periode.id });
    if (unitId) q.set('unit_id', unitId);
    if (kategori) q.set('kategori', kategori);
    api.get(`/pengendalian?${q}`).then(setData);
    muatTtd();
  }, [periode?.id, unitId, kategori]);

  useEffect(() => {
    if (unitId) api.get('/master/units').then((us) => setUnit(us.find((u) => String(u.id) === unitId)));
    else setUnit(null);
  }, [unitId]);

  async function simpanTtd() {
    if (!gambar) return tampil('Bubuhkan tanda tangan terlebih dahulu', 'galat');
    try {
      await api.post(`/pengendalian/daftar-ptk/${periode.id}/tanda-tangan`, { image_data: gambar });
      tampil('Daftar PTK ditandatangani');
      setTtdBuka(false);
      setGambar(null);
      muatTtd();
    } catch (e) { tampil(e.message, 'galat'); }
  }

  async function tarikTtd() {
    if (!confirm('Tarik kembali tanda tangan Daftar PTK ini?')) return;
    try {
      await api.del(`/pengendalian/daftar-ptk/${periode.id}/tanda-tangan`);
      tampil('Tanda tangan Daftar PTK ditarik');
      muatTtd();
    } catch (e) { tampil(e.message, 'galat'); }
  }

  if (!data) return <Memuat />;

  return (
    <>
      <Toast />

      <div className="no-print mb-5 flex flex-wrap items-center justify-between gap-3">
        <Link to="/pengendalian" className="btn-outline">
          <Icon.Kembali width={16} height={16} /> Daftar Pengendalian
        </Link>
        <div className="flex flex-wrap gap-2">
          {bolehAuditor && !ttd && (
            <button onClick={() => setTtdBuka(true)} className="btn-warn">
              <Icon.Pena width={16} height={16} /> Tanda Tangani
            </button>
          )}
          {bolehAuditor && ttd && (
            <button onClick={tarikTtd} className="btn-outline text-rose-600">
              Tarik Tanda Tangan
            </button>
          )}
          <button onClick={() => window.print()} className="btn-primary">
            <Icon.Cetak width={16} height={16} /> Cetak / Simpan PDF
          </button>
        </div>
      </div>

      <div className="print-area card mx-auto max-w-5xl bg-white p-10 text-[13px] leading-relaxed text-slate-900">
        <div className="mb-6">
          <img src={kopPKTJ} alt="Kop Surat Politeknik Keselamatan Transportasi Jalan"
            className="w-full" />
        </div>

        <div className="mb-5 text-center">
          <h1 className="text-base font-bold uppercase tracking-wide underline">
            Daftar Permintaan Tindakan Koreksi (PTK)
          </h1>
          <p className="mt-1 text-xs">
            {periode?.name}
            {unit && ` · ${unit.name}`}
            {kategori && ` · Kategori ${kategori}`}
          </p>
        </div>

        {data.length === 0 ? (
          <p className="mb-6 italic text-slate-600">
            Tidak ada Permintaan Tindakan Koreksi pada cakupan ini.
          </p>
        ) : (
          <table className="mb-8 w-full border-collapse border border-slate-400 text-[11px]">
            <thead>
              <tr className="bg-slate-100">
                <th rowSpan={2} className="border border-slate-400 px-2 py-1.5 w-8">No</th>
                <th rowSpan={2} className="border border-slate-400 px-2 py-1.5 w-32">No PTK</th>
                <th colSpan={3} className="border border-slate-400 px-2 py-1.5">Kategori PTK</th>
                <th rowSpan={2} className="border border-slate-400 px-2 py-1.5 w-28">
                  Rencana Penyelesaian
                </th>
                <th rowSpan={2} className="border border-slate-400 px-2 py-1.5">Realisasi PTK</th>
                <th rowSpan={2} className="border border-slate-400 px-2 py-1.5 w-32">
                  Penanggung Jawab PTK
                </th>
              </tr>
              <tr className="bg-slate-100">
                <th className="border border-slate-400 px-1 py-1 w-14">Mayor</th>
                <th className="border border-slate-400 px-1 py-1 w-14">Minor</th>
                <th className="border border-slate-400 px-1 py-1 w-16">Observasi</th>
              </tr>
            </thead>
            <tbody>
              {data.map((t, i) => (
                <tr key={t.finding_id}>
                  <td className="border border-slate-400 px-2 py-1.5 text-center">{i + 1}</td>
                  <td className="border border-slate-400 px-2 py-1.5 font-mono">
                    {t.finding_code}
                  </td>
                  <td className="border border-slate-400 text-center">
                    {t.kategori === 'KTS Mayor' ? '✓' : ''}
                  </td>
                  <td className="border border-slate-400 text-center">
                    {t.kategori === 'KTS Minor' ? '✓' : ''}
                  </td>
                  <td className="border border-slate-400 text-center">
                    {t.kategori === 'Observasi' ? '✓' : ''}
                  </td>
                  <td className="border border-slate-400 px-2 py-1.5 text-center">
                    {t.rencana_tanggal ? tanggalID(t.rencana_tanggal) : '-'}
                  </td>
                  <td className="border border-slate-400 px-2 py-1.5">
                    {t.realisasi_tindakan
                      ? `${t.realisasi_tindakan}${t.tanggal_realisasi ? ` (${tanggalID(t.tanggal_realisasi)})` : ''}`
                      : '-'}
                  </td>
                  <td className="border border-slate-400 px-2 py-1.5">
                    {t.penanggung_jawab || '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <p className="text-[10px] text-slate-500">*) Tanda ✓ pada kolom kategori yang sesuai.</p>

        <div className="mt-10 flex justify-end">
          <div className="w-full max-w-xs text-center">
            <div className="no-print mb-2 flex items-center justify-end gap-2">
              <label className="text-xs text-slate-500">Tanggal:</label>
              <input type="date" className="input w-40 py-1 text-xs" value={tanggalCetak}
                onChange={(e) => setTanggalCetak(e.target.value)} />
            </div>
            <p className="print-only mb-1">Tegal, {tanggalID(tanggalCetak)}</p>
            <p className="mt-1">Lead Auditor</p>
            <div className="flex h-16 items-center justify-center">
              {ttd && (
                <img src={ttd.image_data} alt={`Tanda tangan ${ttd.nama}`}
                  className="max-h-14 object-contain" />
              )}
            </div>
            <p className="border-t border-slate-900 pt-1 font-semibold">
              {ttd ? ttd.nama : '( .............................. )'}
            </p>
          </div>
        </div>
      </div>

      <Modal
        open={ttdBuka} onClose={() => setTtdBuka(false)}
        title="Tanda Tangan Daftar PTK — Lead Auditor"
        footer={
          <>
            <button onClick={() => setTtdBuka(false)} className="btn-outline">Batal</button>
            <button onClick={simpanTtd} className="btn-primary">Tanda Tangani</button>
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
          <PadTandaTangan onChange={setGambar} />
        </div>
      </Modal>
    </>
  );
}
