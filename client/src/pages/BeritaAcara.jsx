import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, tanggalID, tanggalWaktuID } from '../api.js';
import { useAuth } from '../auth.jsx';
import {
  Badge, Icon, Memuat, Modal, PadTandaTangan, useToast,
} from '../components/ui.jsx';
import kopPKTJ from '../assets/kop-pktj.png';

export default function BeritaAcara() {
  const { id } = useParams();
  const { user } = useAuth();
  const { tampil, Toast } = useToast();

  const [d, setD] = useState(null);
  const [ttdBuka, setTtdBuka] = useState(false);
  const [gambar, setGambar] = useState(null);
  const [kirim, setKirim] = useState(false);

  async function muat() { setD(await api.get(`/emi/${id}/berita-acara`)); }
  useEffect(() => { muat(); }, [id]);

  if (!d) return <Memuat />;
  const { audit: a, anggota, temuan, total, ringkasan_skor: ringkasanSkor = [], tanda_tangan } = d;

  const peranSaya =
    user.role === 'auditee' ? 'Auditee'
    : ['auditor', 'spm', 'admin'].includes(user.role) ? 'Auditor' : null;

  const sudahTtd = tanda_tangan.some((t) => t.user_id === user.id);
  const ttdAuditor = tanda_tangan.filter((t) => t.peran.toLowerCase().includes('auditor'));
  const ttdAuditee = tanda_tangan.filter((t) => t.peran.toLowerCase().includes('auditee'));

  const bolehTtd =
    peranSaya &&
    !sudahTtd &&
    (user.role !== 'auditee' || Number(user.unit_id) === Number(a.unit_id));

  async function simpanTtd() {
    if (!gambar) return tampil('Bubuhkan tanda tangan terlebih dahulu', 'galat');
    setKirim(true);
    try {
      const r = await api.post(`/emi/${id}/tanda-tangan`, {
        peran: peranSaya, image_data: gambar,
      });
      tampil(
        r.lengkap
          ? 'Berita acara telah ditandatangani kedua pihak dan berkekuatan sah'
          : 'Tanda tangan tersimpan'
      );
      setTtdBuka(false);
      setGambar(null);
      muat();
    } catch (e) { tampil(e.message, 'galat'); }
    finally { setKirim(false); }
  }

  async function tarikTtd() {
    if (!confirm('Tarik kembali tanda tangan Anda pada berita acara ini?')) return;
    try {
      await api.del(`/emi/${id}/tanda-tangan`);
      tampil('Tanda tangan ditarik');
      muat();
    } catch (e) { tampil(e.message, 'galat'); }
  }

  const KTS = temuan.filter((t) => t.kategori.startsWith('KTS'));
  const OBS = temuan.filter((t) => t.kategori === 'Observasi');

  return (
    <>
      <Toast />

      {/* Bilah aksi */}
      <div className="no-print mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link to={`/emi/${id}`} className="btn-outline">
            <Icon.Kembali width={16} height={16} /> Lembar Penilaian
          </Link>
          <Badge status={a.status} />
        </div>
        <div className="flex gap-2">
          {bolehTtd && (
            <button onClick={() => setTtdBuka(true)} className="btn-warn">
              <Icon.Pena width={16} height={16} /> Tanda Tangani sebagai {peranSaya}
            </button>
          )}
          {sudahTtd && (
            <button onClick={tarikTtd} className="btn-outline text-rose-600">
              Tarik Tanda Tangan
            </button>
          )}
          <button onClick={() => window.print()} className="btn-primary">
            <Icon.Cetak width={16} height={16} /> Cetak / Simpan PDF
          </button>
        </div>
      </div>

      {a.status !== 'ditandatangani' && (
        <div className="no-print mb-5 flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <Icon.Peringatan width={18} height={18} />
          <p>
            Berita acara belum sah. Diperlukan tanda tangan auditor
            {ttdAuditor.length ? ' (sudah)' : ' (belum)'} dan auditee
            {ttdAuditee.length ? ' (sudah)' : ' (belum)'}.
          </p>
        </div>
      )}

      {/* ------------------------- Dokumen berita acara ------------------------ */}
      <div className="print-area card mx-auto max-w-4xl bg-white p-10 text-[13px] leading-relaxed text-slate-900">
        {/* Kop */}
        <div className="mb-6">
          <img src={kopPKTJ} alt="Kop Surat Politeknik Keselamatan Transportasi Jalan"
            className="w-full" />
        </div>

        <div className="mb-6 text-center">
          <h1 className="text-base font-bold uppercase tracking-wide underline">
            Berita Acara Evaluasi Mutu Internal
          </h1>
          <p className="mt-1 font-mono text-xs">Nomor: {a.ba_number}</p>
        </div>

        <p className="mb-4 text-justify">
          Pada hari ini, {tanggalID(a.executed_date || a.scheduled_date)}, bertempat di{' '}
          {a.tempat || 'lingkungan Politeknik Keselamatan Transportasi Jalan'}, telah
          dilaksanakan Evaluasi Mutu Internal (Audit Mutu Internal) dalam rangka
          pelaksanaan Sistem Penjaminan Mutu Internal pada {a.period_name}, terhadap:
        </p>

        <table className="mb-5 w-full text-[13px]">
          <tbody>
            <tr>
              <td className="w-44 py-1 align-top">Unit / Struktur</td>
              <td className="w-3 py-1 align-top">:</td>
              <td className="py-1 font-semibold">{a.unit_name}</td>
            </tr>
            <tr>
              <td className="py-1 align-top">Lingkup audit</td>
              <td className="py-1 align-top">:</td>
              <td className="py-1">
                {a.scope ||
                  'Seluruh standar mutu internal yang ditugaskan kepada unit pada periode berjalan'}
              </td>
            </tr>
            <tr>
              <td className="py-1 align-top">Kriteria audit</td>
              <td className="py-1 align-top">:</td>
              <td className="py-1">
                Standar Mutu Internal PKTJ, ISO 21001:2018, dan Instrumen Akreditasi
                LAM Teknik 2025
              </td>
            </tr>
            <tr>
              <td className="py-1 align-top">Tim auditor</td>
              <td className="py-1 align-top">:</td>
              <td className="py-1">
                {a.lead_auditor_name || '-'}
                {anggota.length > 0 && `, ${anggota.map((m) => m.name).join(', ')}`}
              </td>
            </tr>
            <tr>
              <td className="py-1 align-top">Wakil auditee</td>
              <td className="py-1 align-top">:</td>
              <td className="py-1">
                {a.auditee_name || '-'}
                {a.auditee_jabatan && ` (${a.auditee_jabatan})`}
              </td>
            </tr>
          </tbody>
        </table>

        {/* A. Ringkasan */}
        <h2 className="mb-2 font-bold">A. Ringkasan Hasil Penilaian</h2>
        <table className="mb-5 w-full border-collapse border border-slate-400 text-[12px]">
          <thead>
            <tr className="bg-slate-100">
              <th className="border border-slate-400 px-2 py-1.5 text-left">Uraian</th>
              <th className="border border-slate-400 px-2 py-1.5 text-center w-32">Jumlah</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border border-slate-400 px-2 py-1.5">Indikator yang dinilai</td>
              <td className="border border-slate-400 px-2 py-1.5 text-center tabular-nums">
                {total?.total || 0}
              </td>
            </tr>
            {ringkasanSkor.length > 0 ? (
              ringkasanSkor.map((r, idx) => (
                <tr key={idx}>
                  <td className="border border-slate-400 px-2 py-1.5">
                    {r.tipe === 'persen'
                      ? `Persentase indikator terpenuhi${r.acuan_nama ? ` (${r.acuan_nama})` : ''}`
                      : `Rerata skor${r.acuan_nama ? ` (${r.acuan_nama})` : ' (indikator tanpa acuan eksternal)'}`}
                  </td>
                  <td className="border border-slate-400 px-2 py-1.5 text-center tabular-nums">
                    {r.tipe === 'persen'
                      ? `${r.nilai}%`
                      : `${r.nilai}${r.skor_maks != null ? ` / ${r.skor_maks}` : ''}`}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td className="border border-slate-400 px-2 py-1.5">Rata-rata skor</td>
                <td className="border border-slate-400 px-2 py-1.5 text-center tabular-nums">-</td>
              </tr>
            )}
            <tr>
              <td className="border border-slate-400 px-2 py-1.5">
                Ketidaksesuaian Mayor (KTS Mayor)
              </td>
              <td className="border border-slate-400 px-2 py-1.5 text-center tabular-nums">
                {temuan.filter((t) => t.kategori === 'KTS Mayor').length}
              </td>
            </tr>
            <tr>
              <td className="border border-slate-400 px-2 py-1.5">
                Ketidaksesuaian Minor (KTS Minor)
              </td>
              <td className="border border-slate-400 px-2 py-1.5 text-center tabular-nums">
                {temuan.filter((t) => t.kategori === 'KTS Minor').length}
              </td>
            </tr>
            <tr>
              <td className="border border-slate-400 px-2 py-1.5">Observasi</td>
              <td className="border border-slate-400 px-2 py-1.5 text-center tabular-nums">
                {OBS.length}
              </td>
            </tr>
          </tbody>
        </table>

        {/* B. Ketidaksesuaian */}
        <h2 className="mb-2 font-bold">B. Daftar Ketidaksesuaian</h2>
        {KTS.length === 0 ? (
          <p className="mb-5 italic text-slate-600">
            Tidak ditemukan ketidaksesuaian pada audit ini.
          </p>
        ) : (
          <table className="mb-5 w-full border-collapse border border-slate-400 text-[12px]">
            <thead>
              <tr className="bg-slate-100">
                <th className="border border-slate-400 px-2 py-1.5 w-8">No</th>
                <th className="border border-slate-400 px-2 py-1.5 w-32 text-left">Kode</th>
                <th className="border border-slate-400 px-2 py-1.5 w-24">Kategori</th>
                <th className="border border-slate-400 px-2 py-1.5 text-left">
                  Uraian Ketidaksesuaian
                </th>
                <th className="border border-slate-400 px-2 py-1.5 text-left">
                  Kriteria Acuan
                </th>
              </tr>
            </thead>
            <tbody>
              {KTS.map((t, i) => (
                <tr key={t.id}>
                  <td className="border border-slate-400 px-2 py-1.5 text-center">{i + 1}</td>
                  <td className="border border-slate-400 px-2 py-1.5 font-mono text-[11px]">
                    {t.code}
                  </td>
                  <td className="border border-slate-400 px-2 py-1.5 text-center">
                    {t.kategori.replace('KTS ', '')}
                  </td>
                  <td className="border border-slate-400 px-2 py-1.5">
                    {t.uraian}
                    {t.bukti_objektif && (
                      <p className="mt-1 text-[11px] text-slate-600">
                        Bukti objektif: {t.bukti_objektif}
                      </p>
                    )}
                  </td>
                  <td className="border border-slate-400 px-2 py-1.5 text-[11px]">
                    {t.kriteria_acuan}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* C. Observasi */}
        {OBS.length > 0 && (
          <>
            <h2 className="mb-2 font-bold">C. Observasi / Saran Perbaikan</h2>
            <ol className="mb-5 list-decimal space-y-1 pl-6">
              {OBS.map((t) => (
                <li key={t.id}>
                  <span className="font-mono text-[11px] text-slate-500">{t.code}</span>{' '}
                  — {t.uraian}
                </li>
              ))}
            </ol>
          </>
        )}

        {/* D. Kesimpulan */}
        <h2 className="mb-2 font-bold">{OBS.length > 0 ? 'D' : 'C'}. Kesimpulan</h2>
        <p className="mb-6 text-justify">
          {a.kesimpulan ||
            (KTS.length === 0
              ? 'Berdasarkan hasil evaluasi mutu internal, unit yang diaudit telah melaksanakan standar mutu internal sesuai ketentuan yang ditetapkan.'
              : `Berdasarkan hasil evaluasi mutu internal, ditemukan ${KTS.length} ketidaksesuaian yang wajib ditindaklanjuti melalui formulir tindakan koreksi pada Modul Pengendalian sesuai batas waktu yang disepakati.`)}
        </p>

        <p className="mb-8 text-justify">
          Demikian berita acara ini dibuat dengan sebenar-benarnya untuk dipergunakan
          sebagaimana mestinya. Auditee bersedia menindaklanjuti seluruh ketidaksesuaian
          yang tercantum di atas melalui tindakan koreksi yang terdokumentasi.
        </p>

        {/* Tanda tangan */}
        <div className="grid grid-cols-2 gap-8 pt-2">
          <div className="text-center">
            <p className="mb-1">Auditee,</p>
            <div className="flex h-24 items-center justify-center">
              {ttdAuditee[0] ? (
                <img src={ttdAuditee[0].image_data} alt="Tanda tangan auditee"
                  className="max-h-24 object-contain" />
              ) : (
                <span className="text-[11px] italic text-slate-400">
                  (belum ditandatangani)
                </span>
              )}
            </div>
            <p className="border-t border-slate-900 pt-1 font-semibold">
              {ttdAuditee[0]?.nama || a.auditee_name || '..........................'}
            </p>
            <p className="text-[11px]">
              {ttdAuditee[0]?.jabatan || a.auditee_jabatan || ''}
            </p>
            {a.auditee_nip && <p className="text-[11px]">NIP. {a.auditee_nip}</p>}
            {ttdAuditee[0] && (
              <p className="mt-1 text-[10px] text-slate-500">
                Ditandatangani secara elektronik {tanggalWaktuID(ttdAuditee[0].signed_at)}
              </p>
            )}
          </div>

          <div className="text-center">
            <p className="mb-1">Auditor,</p>
            <div className="flex h-24 items-center justify-center">
              {ttdAuditor[0] ? (
                <img src={ttdAuditor[0].image_data} alt="Tanda tangan auditor"
                  className="max-h-24 object-contain" />
              ) : (
                <span className="text-[11px] italic text-slate-400">
                  (belum ditandatangani)
                </span>
              )}
            </div>
            <p className="border-t border-slate-900 pt-1 font-semibold">
              {ttdAuditor[0]?.nama || a.lead_auditor_name || '..........................'}
            </p>
            <p className="text-[11px]">
              {ttdAuditor[0]?.jabatan || a.lead_auditor_jabatan || ''}
            </p>
            {a.lead_auditor_nip && <p className="text-[11px]">NIP. {a.lead_auditor_nip}</p>}
            {ttdAuditor[0] && (
              <p className="mt-1 text-[10px] text-slate-500">
                Ditandatangani secara elektronik {tanggalWaktuID(ttdAuditor[0].signed_at)}
              </p>
            )}
          </div>
        </div>

        {a.status === 'ditandatangani' && (
          <p className="mt-8 border-t border-slate-300 pt-3 text-center text-[10px] text-slate-500">
            Dokumen ini ditandatangani secara elektronik melalui Sistem Evaluasi Mutu
            Internal PKTJ dan sah tanpa memerlukan tanda tangan basah.
          </p>
        )}
      </div>

      {/* Modal tanda tangan */}
      <Modal
        open={ttdBuka} onClose={() => setTtdBuka(false)}
        title={`Tanda Tangan Digital — ${peranSaya}`}
        footer={
          <>
            <button onClick={() => setTtdBuka(false)} className="btn-outline">Batal</button>
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
            <p><span className="text-slate-500">Bertindak sebagai: </span><span className="font-medium">{peranSaya}</span></p>
          </div>
          <p className="text-xs text-slate-600">
            Dengan membubuhkan tanda tangan, Anda menyatakan telah membaca dan menyetujui
            seluruh isi berita acara evaluasi mutu internal ini.
          </p>
          <PadTandaTangan onChange={setGambar} />
        </div>
      </Modal>
    </>
  );
}
