import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, tanggalID } from '../api.js';
import { useAuth } from '../auth.jsx';
import {
  Icon, Memuat, Modal, PadTandaTangan, useToast,
} from '../components/ui.jsx';
import logoPTK from '../assets/logo-ptk-form.png';

const EFEKTIVITAS_LABEL = {
  efektif: 'Efektif — akar masalah teratasi, temuan dapat ditutup',
  belum_efektif: 'Belum Efektif — perlu tindakan lanjutan, temuan tetap terbuka',
  tidak_efektif: 'Tidak Efektif — tindakan tidak menyelesaikan masalah',
};

function Kotak({ aktif }) {
  return (
    <span
      className={`inline-flex h-3.5 w-3.5 shrink-0 align-middle items-center justify-center border border-slate-900 text-[10px] leading-none ${
        aktif ? 'bg-slate-900 text-white' : ''
      }`}
    >
      {aktif ? '✓' : ''}
    </span>
  );
}

export default function FormPTK() {
  const { findingId } = useParams();
  const { user } = useAuth();
  const { tampil, Toast } = useToast();

  const [d, setD] = useState(null);
  const [ttdPeran, setTtdPeran] = useState(null);
  const [gambar, setGambar] = useState(null);
  const [kirim, setKirim] = useState(false);

  async function muat() { setD(await api.get(`/pengendalian/${findingId}`)); }
  useEffect(() => { muat(); }, [findingId]);

  if (!d) return <Memuat />;

  const ttd = (peran) => d.tanda_tangan.find((t) => t.peran === peran);
  const ttdTemuan = ttd('Auditor (Temuan)');
  const ttdRencana = ttd('Teraudit (Rencana Tindakan)');
  const ttdEfektivitas = ttd('Auditor (Tinjauan Efektivitas)');

  const bolehAuditor = ['auditor', 'spm', 'admin'].includes(user.role);
  const bolehTeraudit =
    ['spm', 'admin'].includes(user.role) ||
    (user.role === 'auditee' && Number(user.unit_id) === Number(d.unit_id));

  async function simpanTtd() {
    if (!gambar) return tampil('Bubuhkan tanda tangan terlebih dahulu', 'galat');
    setKirim(true);
    try {
      await api.post(`/pengendalian/${findingId}/tanda-tangan`, {
        peran: ttdPeran, image_data: gambar,
      });
      tampil('Tanda tangan tersimpan');
      setTtdPeran(null);
      setGambar(null);
      muat();
    } catch (e) { tampil(e.message, 'galat'); }
    finally { setKirim(false); }
  }

  /** Baris "Tanda Tangan ___ | [kotak ttd] | Tanggal : | [tanggal]" — 4 sel, sama seperti baris Auditor/Tanggal Audit. */
  function BarisTandaTangan({ peran, label, tersedia, boleh, data }) {
    return (
      <tr>
        <td className="border border-slate-900 px-2 py-1.5 align-top">{label}</td>
        <td className="border border-slate-900 px-2 py-1 align-middle">
          <div className="flex min-h-[3.5rem] flex-col items-center justify-center">
            {data ? (
              <>
                <img src={data.image_data} alt={`Tanda tangan ${label}`}
                  className="max-h-14 object-contain" />
                <p className="mt-0.5 text-[10px] font-medium">{data.nama}</p>
              </>
            ) : (
              tersedia && boleh && (
                <button onClick={() => setTtdPeran(peran)}
                  className="no-print btn-outline btn-sm">
                  <Icon.Pena width={13} height={13} /> Tanda Tangani
                </button>
              )
            )}
          </div>
        </td>
        <td className="w-20 border border-slate-900 px-2 py-1.5 align-top">Tanggal :</td>
        <td className="border border-slate-900 px-2 py-1.5 align-top">
          {data ? tanggalID(data.signed_at) : ''}
        </td>
      </tr>
    );
  }

  return (
    <>
      <Toast />

      <div className="no-print mb-5 flex flex-wrap items-center justify-between gap-3">
        <Link to={`/pengendalian/${findingId}`} className="btn-outline">
          <Icon.Kembali width={16} height={16} /> Detail Tindakan Koreksi
        </Link>
        <button onClick={() => window.print()} className="btn-primary">
          <Icon.Cetak width={16} height={16} /> Cetak / Simpan PDF
        </button>
      </div>

      <div className="print-area card mx-auto max-w-4xl bg-white p-10 text-[13px] leading-relaxed text-slate-900">
        {/* Kotak judul + logo, sesuai formulir FRM.11 */}
        <div className="mb-4 flex items-center justify-between border-2 border-slate-900 px-5 py-3">
          <h1 className="text-lg font-bold uppercase tracking-wide">
            Permintaan Tindakan Koreksi (PTK)
          </h1>
          <img src={logoPTK} alt="Logo PKTJ" className="h-16 w-16 shrink-0 object-contain" />
        </div>

        <table className="mb-0 w-full border-collapse text-[12px]">
          <tbody>
            <tr>
              <td className="w-32 border border-slate-900 px-2 py-1.5 align-top">Kepada</td>
              <td colSpan={3} className="border border-slate-900 px-2 py-1.5 align-top">
                {d.auditee_name || '-'}{d.auditee_jabatan && ` (${d.auditee_jabatan})`}
              </td>
            </tr>
            <tr>
              <td className="border border-slate-900 px-2 py-1.5 align-top">Unit Kerja</td>
              <td colSpan={3} className="border border-slate-900 px-2 py-1.5 align-top">
                {d.unit_name}
              </td>
            </tr>
            <tr>
              <td className="border border-slate-900 px-2 py-1.5 align-top">Auditor</td>
              <td className="border border-slate-900 px-2 py-1.5 align-top">
                {d.lead_auditor_name || '-'}
              </td>
              <td className="w-28 border border-slate-900 px-2 py-1.5 align-top">
                Tanggal Audit
              </td>
              <td className="border border-slate-900 px-2 py-1.5 align-top">
                {tanggalID(d.executed_date || d.scheduled_date)}
              </td>
            </tr>
            <tr>
              <td className="border border-slate-900 px-2 py-1.5 align-top font-semibold">
                PTK No: <span className="font-mono font-normal">{d.finding_code}</span>
              </td>
              <td colSpan={3} className="border border-slate-900 px-2 py-1.5 align-top">
                <span className="inline-flex flex-wrap items-center gap-4 align-top">
                  <span className="font-semibold">Kategori :</span>
                  <span className="inline-flex items-center gap-1">
                    <Kotak aktif={d.kategori === 'KTS Mayor'} /> Mayor
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Kotak aktif={d.kategori === 'KTS Minor'} /> Minor
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Kotak aktif={d.kategori === 'Observasi'} /> Observasi
                  </span>
                </span>
              </td>
            </tr>
            <tr>
              <td className="border border-slate-900 px-2 py-1.5 align-top">
                Referensi (Butir Mutu)
              </td>
              <td colSpan={3} className="border border-slate-900 px-2 py-1.5 align-top">
                {d.kriteria_acuan || '-'}
              </td>
            </tr>

            <tr>
              <td colSpan={4} className="border border-slate-900 px-2 py-2 align-top">
                <p className="mb-1">
                  Uraian Temuan{' '}
                  <span className="italic text-slate-600">
                    (diisi oleh auditor &amp; ditandatangani)
                  </span>:
                </p>
                <p className="min-h-[4.5rem] text-justify">{d.uraian_temuan}</p>
                {d.bukti_objektif && (
                  <p className="mt-1 text-xs text-slate-600">
                    Bukti objektif: {d.bukti_objektif}
                  </p>
                )}
              </td>
            </tr>
            <BarisTandaTangan peran="Auditor (Temuan)" label="Tanda Tangan Auditor"
              tersedia boleh={bolehAuditor} data={ttdTemuan} />

            <tr>
              <td colSpan={4} className="border border-slate-900 px-2 py-2 align-top">
                <p className="mb-1">Analisa Penyebab Masalah :</p>
                <p className="min-h-[2.5rem] text-justify">{d.analisis_penyebab || '-'}</p>
              </td>
            </tr>
            <tr>
              <td colSpan={4} className="border border-slate-900 px-2 py-2 align-top">
                <p className="mb-1">Koreksi (tindakan sementara) :</p>
                <p className="min-h-[2.5rem] text-justify">{d.koreksi_sementara || '-'}</p>
              </td>
            </tr>
            <tr>
              <td colSpan={4} className="border border-slate-900 px-2 py-2 align-top">
                <p className="mb-1">
                  Rencana Tindakan Koreksi{' '}
                  <span className="italic text-slate-600">
                    (diisi oleh teraudit &amp; ditandatangani)
                  </span>:
                </p>
                <p className="min-h-[3rem] text-justify">{d.rencana_tindakan || '-'}</p>
                <p className="mt-1 text-xs text-slate-600">
                  Rencana selesai: {d.rencana_tanggal ? tanggalID(d.rencana_tanggal) : '-'}
                  {d.penanggung_jawab && ` · Penanggung jawab: ${d.penanggung_jawab}`}
                </p>
              </td>
            </tr>
            <BarisTandaTangan peran="Teraudit (Rencana Tindakan)" label="Tanda Tangan Teraudit"
              tersedia={!!d.rencana_tindakan} boleh={bolehTeraudit} data={ttdRencana} />

            <tr>
              <td colSpan={4} className="border border-slate-900 px-2 py-2 align-top">
                <p className="mb-1">
                  Tinjauan Efektifitas Tindakan Koreksi{' '}
                  <span className="italic text-slate-600">
                    (diisi oleh auditor pada audit berikutnya &amp; ditandatangani)
                  </span>:
                </p>
                {d.efektivitas ? (
                  <>
                    <p className="min-h-[3rem] text-justify">
                      {EFEKTIVITAS_LABEL[d.efektivitas] || d.efektivitas}
                    </p>
                    {d.catatan_verifikasi && (
                      <p className="text-xs text-slate-600">
                        Catatan verifikasi: {d.catatan_verifikasi}
                      </p>
                    )}
                    <p className="text-xs text-slate-600">
                      Tanggal penyelesaian: {tanggalID(d.tanggal_penyelesaian)}
                    </p>
                  </>
                ) : (
                  <p className="min-h-[3rem] italic text-slate-500">Belum ditinjau.</p>
                )}
              </td>
            </tr>
            <BarisTandaTangan peran="Auditor (Tinjauan Efektivitas)" label="Tanda Tangan Auditor"
              tersedia={!!d.efektivitas} boleh={bolehAuditor} data={ttdEfektivitas} />
          </tbody>
        </table>

        <p className="mt-4 text-xs text-slate-500">FRM.11 Rev. 00</p>
      </div>

      {/* Modal tanda tangan */}
      <Modal
        open={!!ttdPeran} onClose={() => setTtdPeran(null)}
        title={`Tanda Tangan Digital — ${ttdPeran || ''}`}
        footer={
          <>
            <button onClick={() => setTtdPeran(null)} className="btn-outline">Batal</button>
            <button onClick={simpanTtd} className="btn-primary" disabled={kirim}>
              {kirim ? 'Menyimpan…' : 'Bubuhkan Tanda Tangan'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="rounded-lg bg-slate-50 p-4 text-sm">
            <p><span className="text-slate-500">Nama: </span><span className="font-medium">{user.name}</span></p>
            <p><span className="text-slate-500">Jabatan: </span><span className="font-medium">{user.jabatan || '-'}</span></p>
            <p><span className="text-slate-500">Bertindak sebagai: </span><span className="font-medium">{ttdPeran}</span></p>
          </div>
          <p className="text-xs text-slate-600">
            Dengan membubuhkan tanda tangan, Anda menyatakan telah membaca dan menyetujui
            isi bagian formulir PTK ini.
          </p>
          <PadTandaTangan onChange={setGambar} />
        </div>
      </Modal>
    </>
  );
}
