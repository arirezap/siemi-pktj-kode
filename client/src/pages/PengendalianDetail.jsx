import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, tanggalID, tanggalWaktuID } from '../api.js';
import { useAuth } from '../auth.jsx';
import { Badge, Icon, JudulHalaman, Memuat, useToast } from '../components/ui.jsx';

const EFEKTIVITAS = [
  { v: 'efektif',       l: 'Efektif',        ket: 'Akar masalah teratasi, temuan dapat ditutup' },
  { v: 'belum_efektif', l: 'Belum Efektif',  ket: 'Perlu tindakan lanjutan, temuan tetap terbuka' },
  { v: 'tidak_efektif', l: 'Tidak Efektif',  ket: 'Tindakan tidak menyelesaikan masalah' },
];

function Langkah({ nomor, judul, aktif, selesai, children }) {
  return (
    <div className="card overflow-hidden">
      <div className={`flex items-center gap-3 border-b px-5 py-3 ${
        selesai ? 'border-emerald-200 bg-emerald-50'
        : aktif ? 'border-pktj-200 bg-pktj-50' : 'border-slate-200 bg-slate-50'
      }`}>
        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
          selesai ? 'bg-emerald-600 text-white'
          : aktif ? 'bg-pktj-600 text-white' : 'bg-slate-300 text-white'
        }`}>
          {selesai ? '✓' : nomor}
        </span>
        <h2 className="text-sm font-semibold">{judul}</h2>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

export default function PengendalianDetail() {
  const { findingId } = useParams();
  const { user, bolehAuditor } = useAuth();
  const { tampil, Toast } = useToast();

  const [d, setD] = useState(null);
  const [a, setA] = useState({});   // bagian A — rencana
  const [b, setB] = useState({});   // bagian B — realisasi
  const [c, setC] = useState({});   // bagian C — verifikasi
  const [proses, setProses] = useState(false);

  async function muat() {
    const r = await api.get(`/pengendalian/${findingId}`);
    setD(r);
    setA({
      analisis_penyebab: r.analisis_penyebab || '',
      koreksi_sementara: r.koreksi_sementara || '',
      rencana_tindakan: r.rencana_tindakan || '',
      rencana_tanggal: r.rencana_tanggal || '',
      penanggung_jawab: r.penanggung_jawab || '',
    });
    setB({
      realisasi_tindakan: r.realisasi_tindakan || '',
      bukti_realisasi: r.bukti_realisasi || '',
      tanggal_realisasi: r.tanggal_realisasi || '',
    });
    setC({
      efektivitas: r.efektivitas || '',
      catatan_verifikasi: r.catatan_verifikasi || '',
      tanggal_penyelesaian: r.tanggal_penyelesaian || new Date().toISOString().slice(0, 10),
    });
  }
  useEffect(() => { muat(); }, [findingId]);

  const bolehIsiAuditee =
    ['auditee', 'spm', 'admin'].includes(user.role) &&
    (user.role !== 'auditee' || Number(user.unit_id) === Number(d?.unit_id));

  async function kirimA() {
    if (!a.analisis_penyebab || !a.rencana_tindakan || !a.rencana_tanggal)
      return tampil('Analisis penyebab, rencana tindakan, dan rencana tanggal wajib diisi', 'galat');
    setProses(true);
    try {
      await api.post(`/pengendalian/${findingId}/tindakan-koreksi`, a);
      tampil('Formulir tindakan koreksi tersimpan');
      muat();
    } catch (e) { tampil(e.message, 'galat'); }
    finally { setProses(false); }
  }

  async function kirimB() {
    if (!b.realisasi_tindakan) return tampil('Uraian realisasi wajib diisi', 'galat');
    setProses(true);
    try {
      await api.post(`/pengendalian/${findingId}/realisasi`, b);
      tampil('Realisasi tindakan koreksi dilaporkan');
      muat();
    } catch (e) { tampil(e.message, 'galat'); }
    finally { setProses(false); }
  }

  async function kirimC() {
    if (!c.efektivitas) return tampil('Pilih tingkat efektivitas tindakan koreksi', 'galat');
    setProses(true);
    try {
      const r = await api.post(`/pengendalian/${findingId}/verifikasi`, c);
      tampil(r.ditutup ? 'Tindakan koreksi efektif — temuan ditutup' : 'Hasil pemantauan tersimpan');
      muat();
    } catch (e) { tampil(e.message, 'galat'); }
    finally { setProses(false); }
  }

  if (!d) return <Memuat />;

  const status = d.status || 'menunggu_auditee';
  const adaRencana = !!d.rencana_tindakan;
  const adaRealisasi = !!d.realisasi_tindakan;
  const adaVerifikasi = !!d.efektivitas;
  const ditutup = status === 'ditutup';

  return (
    <>
      <Toast />
      <JudulHalaman
        ikon={<Icon.Kendali width={20} height={20} />}
        judul={`Tindakan Koreksi — ${d.finding_code}`}
        deskripsi={`${d.unit_name} · ${d.ba_number}`}
        aksi={
          <>
            <Link to="/pengendalian" className="btn-outline">
              <Icon.Kembali width={16} height={16} /> Daftar
            </Link>
            <Badge status={status} />
            <Link to={`/pengendalian/${findingId}/form-ptk`} className="btn-primary">
              <Icon.Cetak width={16} height={16} /> Formulir PTK
            </Link>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          {/* Bagian A */}
          <Langkah nomor="A" judul="Formulir Tindakan Koreksi (diisi Auditee)"
            aktif={!adaRencana} selesai={adaRencana}>
            <fieldset disabled={!bolehIsiAuditee || ditutup} className="space-y-4">
              <div>
                <label className="label">Analisis penyebab masalah (akar masalah) *</label>
                <textarea className="textarea" value={a.analisis_penyebab}
                  onChange={(e) => setA((p) => ({ ...p, analisis_penyebab: e.target.value }))}
                  placeholder="Uraikan akar penyebab terjadinya ketidaksesuaian, misalnya dengan metode 5 Why atau diagram sebab-akibat." />
              </div>
              <div>
                <label className="label">Koreksi sementara</label>
                <textarea className="textarea min-h-[70px]" value={a.koreksi_sementara}
                  onChange={(e) => setA((p) => ({ ...p, koreksi_sementara: e.target.value }))}
                  placeholder="Tindakan langsung untuk mengatasi dampak ketidaksesuaian saat ini." />
              </div>
              <div>
                <label className="label">Rencana tindakan koreksi *</label>
                <textarea className="textarea" value={a.rencana_tindakan}
                  onChange={(e) => setA((p) => ({ ...p, rencana_tindakan: e.target.value }))}
                  placeholder="Tindakan yang direncanakan untuk menghilangkan akar penyebab agar ketidaksesuaian tidak terulang." />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="label">Rencana tanggal penyelesaian *</label>
                  <input type="date" className="input" value={a.rencana_tanggal}
                    onChange={(e) => setA((p) => ({ ...p, rencana_tanggal: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Penanggung jawab</label>
                  <input className="input" value={a.penanggung_jawab}
                    onChange={(e) => setA((p) => ({ ...p, penanggung_jawab: e.target.value }))}
                    placeholder="Nama dan jabatan" />
                </div>
              </div>
              {bolehIsiAuditee && !ditutup && (
                <div className="flex justify-end">
                  <button onClick={kirimA} className="btn-primary" disabled={proses}>
                    <Icon.Simpan width={16} height={16} /> Simpan Rencana Tindakan
                  </button>
                </div>
              )}
            </fieldset>
            {d.diisi_at && (
              <p className="mt-3 border-t border-slate-100 pt-3 text-xs text-slate-500">
                Diisi oleh {d.pengisi_name} pada {tanggalWaktuID(d.diisi_at)}
              </p>
            )}
          </Langkah>

          {/* Bagian B */}
          <Langkah nomor="B" judul="Laporan Realisasi Tindakan Koreksi (diisi Auditee)"
            aktif={adaRencana && !adaRealisasi} selesai={adaRealisasi}>
            {!adaRencana ? (
              <p className="text-sm text-slate-500">
                Lengkapi formulir tindakan koreksi pada Bagian A terlebih dahulu.
              </p>
            ) : (
              <fieldset disabled={!bolehIsiAuditee || ditutup} className="space-y-4">
                <div>
                  <label className="label">Uraian realisasi tindakan yang telah dilakukan *</label>
                  <textarea className="textarea" value={b.realisasi_tindakan}
                    onChange={(e) => setB((p) => ({ ...p, realisasi_tindakan: e.target.value }))} />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="label">Bukti realisasi</label>
                    <input className="input" value={b.bukti_realisasi}
                      onChange={(e) => setB((p) => ({ ...p, bukti_realisasi: e.target.value }))}
                      placeholder="Nomor dokumen / tautan bukti" />
                  </div>
                  <div>
                    <label className="label">Tanggal realisasi</label>
                    <input type="date" className="input" value={b.tanggal_realisasi}
                      onChange={(e) => setB((p) => ({ ...p, tanggal_realisasi: e.target.value }))} />
                  </div>
                </div>
                {bolehIsiAuditee && !ditutup && (
                  <div className="flex justify-end">
                    <button onClick={kirimB} className="btn-primary" disabled={proses}>
                      <Icon.Cek width={16} height={16} /> Laporkan Realisasi
                    </button>
                  </div>
                )}
              </fieldset>
            )}
          </Langkah>

          {/* Bagian C */}
          <Langkah nomor="C" judul="Pemantauan Efektivitas (Auditor & Satuan Penjaminan Mutu)"
            aktif={adaRealisasi && !adaVerifikasi} selesai={adaVerifikasi}>
            {!adaRealisasi ? (
              <p className="text-sm text-slate-500">
                Menunggu auditee melaporkan realisasi tindakan koreksi.
              </p>
            ) : (
              <fieldset disabled={!bolehAuditor} className="space-y-4">
                <div>
                  <label className="label">Efektivitas tindakan koreksi *</label>
                  <div className="space-y-2">
                    {EFEKTIVITAS.map((e) => (
                      <label key={e.v}
                        className={`flex cursor-pointer items-start gap-2.5 rounded-lg border p-3 transition-colors ${
                          c.efektivitas === e.v ? 'border-pktj-500 bg-pktj-50'
                            : 'border-slate-200 hover:bg-slate-50'
                        }`}>
                        <input type="radio" name="efektivitas" className="mt-0.5 accent-pktj-600"
                          checked={c.efektivitas === e.v}
                          onChange={() => setC((p) => ({ ...p, efektivitas: e.v }))} />
                        <div>
                          <p className="text-sm font-medium">{e.l}</p>
                          <p className="text-xs text-slate-500">{e.ket}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="label">Catatan verifikasi</label>
                  <textarea className="textarea min-h-[70px]" value={c.catatan_verifikasi}
                    onChange={(e) => setC((p) => ({ ...p, catatan_verifikasi: e.target.value }))}
                    placeholder="Hasil verifikasi bukti dan pengamatan atas tindakan koreksi" />
                </div>
                <div className="sm:max-w-xs">
                  <label className="label">Tanggal penyelesaian</label>
                  <input type="date" className="input" value={c.tanggal_penyelesaian}
                    onChange={(e) => setC((p) => ({ ...p, tanggal_penyelesaian: e.target.value }))} />
                </div>
                {bolehAuditor && (
                  <div className="flex justify-end">
                    <button onClick={kirimC} className="btn-primary" disabled={proses}>
                      <Icon.Cek width={16} height={16} /> Simpan Hasil Pemantauan
                    </button>
                  </div>
                )}
              </fieldset>
            )}
            {d.diverifikasi_at && (
              <p className="mt-3 border-t border-slate-100 pt-3 text-xs text-slate-500">
                Diverifikasi oleh {d.verifikator_name} pada {tanggalWaktuID(d.diverifikasi_at)}
              </p>
            )}
          </Langkah>
        </div>

        {/* Panel temuan */}
        <div className="space-y-5">
          <div className="card-p">
            <h2 className="mb-3 section-title">Rincian Ketidaksesuaian</h2>
            <div className="space-y-3 text-sm">
              <div>
                <p className="text-xs text-slate-500">Kode temuan</p>
                <p className="font-mono font-semibold text-pktj-700">{d.finding_code}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Kategori</p>
                <span className={`badge ${
                  d.kategori === 'KTS Mayor' ? 'bg-rose-100 text-rose-800'
                  : d.kategori === 'KTS Minor' ? 'bg-amber-100 text-amber-800'
                  : 'bg-sky-100 text-sky-800'
                }`}>{d.kategori}</span>
              </div>
              <div>
                <p className="text-xs text-slate-500">Uraian</p>
                <p className="leading-relaxed">{d.uraian_temuan}</p>
              </div>
              {d.kriteria_acuan && (
                <div>
                  <p className="text-xs text-slate-500">Kriteria acuan</p>
                  <p className="text-xs leading-relaxed">{d.kriteria_acuan}</p>
                </div>
              )}
              {d.bukti_objektif && (
                <div>
                  <p className="text-xs text-slate-500">Bukti objektif</p>
                  <p className="text-xs leading-relaxed">{d.bukti_objektif}</p>
                </div>
              )}
              {d.indicator && (
                <div className="border-t border-slate-100 pt-3">
                  <p className="text-xs text-slate-500">Indikator terkait</p>
                  <p className="text-xs">{d.indicator}</p>
                  <p className="mt-1 text-xs text-slate-500">Target: {d.target || '-'}</p>
                </div>
              )}
            </div>
          </div>

          <div className="card-p">
            <h2 className="mb-3 section-title">Riwayat</h2>
            <ol className="space-y-3 text-xs">
              <li className="flex gap-2.5">
                <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-rose-500" />
                <div>
                  <p className="font-medium">Ketidaksesuaian ditetapkan</p>
                  <p className="text-slate-500">Audit {tanggalID(d.executed_date)}</p>
                </div>
              </li>
              {d.diisi_at && (
                <li className="flex gap-2.5">
                  <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-amber-500" />
                  <div>
                    <p className="font-medium">Rencana tindakan koreksi disusun</p>
                    <p className="text-slate-500">
                      Target selesai {tanggalID(d.rencana_tanggal)}
                    </p>
                  </div>
                </li>
              )}
              {d.realisasi_at && (
                <li className="flex gap-2.5">
                  <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-sky-500" />
                  <div>
                    <p className="font-medium">Realisasi dilaporkan</p>
                    <p className="text-slate-500">{tanggalID(d.tanggal_realisasi)}</p>
                  </div>
                </li>
              )}
              {d.diverifikasi_at && (
                <li className="flex gap-2.5">
                  <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${
                    d.efektivitas === 'efektif' ? 'bg-emerald-500' : 'bg-rose-500'
                  }`} />
                  <div>
                    <p className="font-medium">
                      Diverifikasi — {d.efektivitas?.replace('_', ' ')}
                    </p>
                    <p className="text-slate-500">{tanggalID(d.tanggal_penyelesaian)}</p>
                  </div>
                </li>
              )}
            </ol>
          </div>
        </div>
      </div>
    </>
  );
}
