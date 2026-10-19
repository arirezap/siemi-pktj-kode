import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, tanggalID } from '../api.js';
import { Icon, Memuat } from '../components/ui.jsx';
import logoPTK from '../assets/logo-ptk-form.png';

const KELUARAN_LABEL = {
  perubahan_smop: 'Kebutuhan perubahan untuk SMOP',
  kebutuhan_sumber_daya: 'Kebutuhan sumber daya',
  peluang_perbaikan: 'Peluang untuk perbaikan yang diprogramkan',
};

/** Urutan tampil kelompok keluaran RTM sesuai FRM.13. */
const KELUARAN_URUTAN = ['perubahan_smop', 'kebutuhan_sumber_daya', 'peluang_perbaikan'];

const STATUS_LABEL = {
  direncanakan: 'Direncanakan',
  berjalan: 'Berjalan',
  selesai: 'Selesai',
  ditunda: 'Ditunda',
};

/** Notulen Rapat Tinjauan Manajemen — mengikuti format FRM.13 (Risalah Tinjauan Manajemen). */
export default function NotulenRTM() {
  const { id } = useParams();
  const [d, setD] = useState(null);

  useEffect(() => { api.get(`/rtm/${id}`).then(setD); }, [id]);

  if (!d) return <Memuat />;

  const hadir = d.peserta.filter((p) => p.hadir);
  const utama = d.agenda.filter((a) => !a.parent_key);
  const anak = (key) => d.agenda.filter((a) => a.parent_key === key);
  const ttd = (peran) => d.tanda_tangan.find((t) => t.peran === peran);
  const keluaranUrut = [...d.keluaran].sort(
    (a, b) => KELUARAN_URUTAN.indexOf(a.kategori) - KELUARAN_URUTAN.indexOf(b.kategori)
  );

  return (
    <>
      <div className="no-print mb-5 flex flex-wrap items-center justify-between gap-3">
        <Link to={`/rtm/${id}`} className="btn-outline">
          <Icon.Kembali width={16} height={16} /> Detail RTM
        </Link>
        <button onClick={() => window.print()} className="btn-primary">
          <Icon.Cetak width={16} height={16} /> Cetak / Simpan PDF
        </button>
      </div>

      <div className="print-area card mx-auto max-w-4xl bg-white p-10 text-[13px] leading-relaxed text-slate-900">
        {/* Kotak judul + logo, sesuai formulir FRM.13 */}
        <div className="mb-4 flex items-center justify-between border-2 border-slate-900 px-5 py-3">
          <h1 className="text-lg font-bold uppercase tracking-wide">
            Risalah Tinjauan Manajemen
          </h1>
          <img src={logoPTK} alt="Logo PKTJ" className="h-16 w-16 shrink-0 object-contain" />
        </div>

        <table className="mb-0 w-full border-collapse text-[12px]">
          <tbody>
            <tr>
              <td className="w-1/2 border border-slate-900 px-2 py-1.5 align-top">
                Tempat : {d.tempat || '-'}
              </td>
              <td className="w-1/4 border border-slate-900 px-2 py-1.5 align-top">
                Tgl : {tanggalID(d.tanggal)}
              </td>
              <td className="w-1/4 border border-slate-900 px-2 py-1.5 align-top">
                Waktu : {d.waktu || '-'}
              </td>
            </tr>
            <tr>
              <td className="border border-slate-900 px-2 py-1.5 align-top">Ketua Rapat:</td>
              <td colSpan={2} className="border border-slate-900 px-2 py-1.5 align-top">
                {d.pemimpin_name || '-'}{d.pemimpin_jabatan && ` (${d.pemimpin_jabatan})`}
              </td>
            </tr>
            <tr>
              <td className="border border-slate-900 px-2 py-1.5 align-top">Notulis:</td>
              <td colSpan={2} className="border border-slate-900 px-2 py-1.5 align-top">
                {d.notulis_name || '-'}{d.notulis_jabatan && ` (${d.notulis_jabatan})`}
              </td>
            </tr>
            <tr>
              <td className="border border-slate-900 px-2 py-1.5 align-top">Peserta rapat:</td>
              <td colSpan={2} className="border border-slate-900 px-2 py-1.5 align-top">
                {hadir.length > 0
                  ? hadir.map((p) => p.nama).join(', ')
                  : <span className="italic text-slate-500">Belum ada kehadiran tercatat.</span>}
              </td>
            </tr>
            <tr>
              <td colSpan={3} className="border border-slate-900 px-2 py-2 align-top">
                <p className="mb-1">Agenda Rapat:</p>
                <ol className="list-none space-y-0.5">
                  {utama.map((a) => (
                    <li key={a.id}>
                      <span>{a.agenda_key}. {a.judul}</span>
                      {anak(a.agenda_key).length > 0 && (
                        <ul className="ml-5 list-none">
                          {anak(a.agenda_key).map((s) => (
                            <li key={s.id}>{s.agenda_key}. {s.judul}</li>
                          ))}
                        </ul>
                      )}
                    </li>
                  ))}
                </ol>
              </td>
            </tr>
          </tbody>
        </table>

        <p className="mb-0 border border-b-0 border-slate-900 bg-slate-100 px-2 py-1.5 text-[12px] font-semibold">
          Hasil Rapat:
        </p>
        <table className="mb-8 w-full border-collapse text-[11px]">
          <thead>
            <tr className="bg-slate-100">
              <th className="border border-slate-900 px-2 py-1.5 w-8">No.</th>
              <th className="border border-slate-900 px-2 py-1.5">Uraian Hasil Rapat</th>
              <th className="border border-slate-900 px-2 py-1.5 w-40">Tindak Lanjut</th>
              <th className="border border-slate-900 px-2 py-1.5 w-28">PIC</th>
            </tr>
          </thead>
          <tbody>
            {d.agenda.map((a) => (
              <tr key={a.id}>
                <td className="border border-slate-900 px-2 py-1.5 text-center">{a.agenda_key}</td>
                <td className="border border-slate-900 px-2 py-1.5 whitespace-pre-line">
                  <span className="text-slate-500">{a.judul}:</span>{' '}
                  {a.pembahasan || <span className="text-slate-400">-</span>}
                </td>
                <td className="border border-slate-900 px-2 py-1.5 whitespace-pre-line">
                  {a.kesimpulan || <span className="text-slate-400">-</span>}
                </td>
                <td className="border border-slate-900 px-2 py-1.5 whitespace-pre-line">
                  {a.pic || <span className="text-slate-400">-</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <p className="mb-0 border border-b-0 border-slate-900 bg-slate-100 px-2 py-1.5 text-[12px] font-semibold">
          Keluaran RTM:
        </p>
        <table className="mb-8 w-full border-collapse text-[11px]">
          <thead>
            <tr className="bg-slate-100">
              <th className="border border-slate-900 px-2 py-1.5 w-8">No.</th>
              <th className="border border-slate-900 px-2 py-1.5">Uraian</th>
              <th className="border border-slate-900 px-2 py-1.5 w-40">Tindak Lanjut</th>
              <th className="border border-slate-900 px-2 py-1.5 w-28">PIC</th>
            </tr>
          </thead>
          <tbody>
            {keluaranUrut.length === 0 ? (
              <tr>
                <td colSpan={4} className="border border-slate-900 px-2 py-3 text-center italic text-slate-500">
                  Belum ada keluaran/keputusan rapat yang dicatat.
                </td>
              </tr>
            ) : (
              keluaranUrut.map((o, i) => (
                <tr key={o.id}>
                  <td className="border border-slate-900 px-2 py-1.5 text-center">{i + 1}</td>
                  <td className="border border-slate-900 px-2 py-1.5 whitespace-pre-line">
                    <span className="text-slate-500">{KELUARAN_LABEL[o.kategori] || o.kategori}:</span>{' '}
                    {o.uraian}
                  </td>
                  <td className="border border-slate-900 px-2 py-1.5">
                    {STATUS_LABEL[o.status_tindak_lanjut] || o.status_tindak_lanjut}
                    {o.target_tanggal && (
                      <><br /><span className="text-[10px] text-slate-500">
                        Target: {tanggalID(o.target_tanggal)}
                      </span></>
                    )}
                  </td>
                  <td className="border border-slate-900 px-2 py-1.5 whitespace-pre-line">
                    {o.penanggung_jawab || o.unit_name || '-'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        <div className="flex justify-end">
          <p>
            Tegal, {new Date().toLocaleDateString('id-ID', {
              day: 'numeric', month: 'long', year: 'numeric',
            })}
          </p>
        </div>

        <table className="mt-2 w-full border-collapse text-[12px]">
          <thead>
            <tr>
              <th className="border border-slate-900 px-3 py-2 font-semibold">Disiapkan oleh :</th>
              <th className="border border-slate-900 px-3 py-2 font-semibold">Diperiksa oleh</th>
              <th className="border border-slate-900 px-3 py-2 font-semibold">Disetujui oleh</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <SelPengesahan peran="Notulen" data={ttd('Notulen')} />
              <SelPengesahan peran="Kepala SPM" data={ttd('Kepala SPM')} />
              <SelPengesahan peran="Direktur" data={ttd('Direktur')} />
            </tr>
          </tbody>
        </table>

        <p className="mt-6 text-xs text-slate-500">FRM.13 Rev. 00</p>
      </div>
    </>
  );
}

/** Sel pengesahan: tampilkan tanda tangan digital bila sudah ditandatangani, atau kolom kosong. */
function SelPengesahan({ peran, data }) {
  return (
    <td className="border border-slate-900 px-3 py-2 align-top">
      <div className="flex h-16 items-center justify-center">
        {data && (
          <img src={data.image_data} alt={`Tanda tangan ${data.nama}`}
            className="max-h-14 object-contain" />
        )}
      </div>
      <p className="border-t border-slate-900 pt-1 text-center font-medium">
        {data ? data.nama : <>&nbsp;</>}
      </p>
      <p className="text-center text-[10px] text-slate-500">{peran}</p>
    </td>
  );
}
