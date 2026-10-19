import { Fragment, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  Bar, BarChart, CartesianGrid, PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { api, tautanBukti } from '../api.js';
import { useAuth } from '../auth.jsx';
import {
  Icon, JudulHalaman, Kosong, Memuat, Modal, Progres, useToast,
} from '../components/ui.jsx';

export default function SPMEDetail() {
  const { kunci } = useParams();
  const { periode, bolehSPM } = useAuth();
  const { tampil, Toast } = useToast();

  const [d, setD] = useState(null);
  const [galat, setGalat] = useState('');
  const [komponen, setKomponen] = useState('penilaian'); // 'penilaian' | 'radar' | 'rekap'
  const [aktif, setAktif] = useState(null);   // butir yang sedang diedit
  const [nilai, setNilai] = useState('');
  const [capaian, setCapaian] = useState(''); // capaian target (khusus akreditasi prodi)
  const [buktiUrl, setBuktiUrl] = useState(''); // tautan berkas data dukung koreksi manual
  const [catatan, setCatatan] = useState('');
  const [kirim, setKirim] = useState(false);
  const [detailAuditee, setDetailAuditee] = useState(null); // null = memuat, [] = tidak ada unit ditugaskan


  async function muat() {
    if (!periode) return;
    setGalat('');
    try {
      setD(await api.get(`/spme/${kunci}?period_id=${periode.id}`));
    } catch (e) { setGalat(e.message); }
  }
  useEffect(() => { setD(null); muat(); }, [kunci, periode?.id]);

  function bukaEdit(b) {
    setAktif(b);
    setNilai(b.skor_manual ?? b.skor_otomatis ?? '');
    setCapaian(b.capaian_manual ?? b.capaian_otomatis ?? '');
    setBuktiUrl(b.bukti_url_manual ?? '');
    setCatatan(b.catatan_manual ?? '');
    setDetailAuditee(null);
    api.get(`/spme/${kunci}/butir/${b.id}/detail?period_id=${periode.id}`)
      .then(setDetailAuditee)
      .catch(() => setDetailAuditee([]));
  }

  function tutupEdit() {
    setAktif(null);
    setDetailAuditee(null);
  }

  async function simpanEdit() {
    if (nilai === '' || Number.isNaN(Number(nilai)))
      return tampil('Skor wajib diisi berupa angka', 'galat');
    if (capaian !== '' && Number.isNaN(Number(capaian)))
      return tampil('Capaian target harus berupa angka', 'galat');
    setKirim(true);
    try {
      await api.put(`/spme/${kunci}/butir/${aktif.id}`, {
        period_id: periode.id, skor: Number(nilai),
        ...(instrumenProdi ? { capaian: capaian === '' ? null : Number(capaian) } : {}),
        bukti_url: buktiUrl.trim() ? tautanBukti(buktiUrl.trim()) : '',
        catatan,
      });
      tampil('Koreksi skor tersimpan');
      tutupEdit();
      muat();
    } catch (e) { tampil(e.message, 'galat'); }
    finally { setKirim(false); }
  }

  async function kembalikanOtomatis(b) {
    if (!confirm('Kembalikan butir ini ke nilai otomatis dari hasil audit?')) return;
    try {
      await api.del(`/spme/${kunci}/butir/${b.id}?period_id=${periode.id}`);
      tampil('Dikembalikan ke nilai otomatis');
      muat();
    } catch (e) { tampil(e.message, 'galat'); }
  }

  if (!periode) return <Kosong judul="Belum ada periode aktif" />;
  if (galat) return <Kosong judul="Instrumen belum bisa ditampilkan" pesan={galat} />;
  if (!d) return <Memuat />;

  const {
    instrumen, acuan, unit, butir, ringkasan, radar,
    rekap_zi: rekapZi, hasil_capaian: hasilCapaian, hasil_akreditasi: hasilAkreditasi,
  } = d;
  const instrumenProdi = kunci.startsWith('akreditasi_prodi_');

  return (
    <>
      <Toast />
      <JudulHalaman
        ikon={<Icon.Global width={20} height={20} />}
        judul={instrumen.label}
        deskripsi={`${instrumen.keterangan}${unit ? ` · ${unit.name}` : ''}`}
        aksi={
          <Link to="/spme" className="btn-outline">
            <Icon.Kembali width={16} height={16} /> Sistem Penjaminan Mutu Eksternal
          </Link>
        }
      />

      {/* Ringkasan */}
      <div className="card-p mb-5">
        <div className={`grid gap-5 ${instrumenProdi || acuan.code === 'ZI' ? 'sm:grid-cols-2 lg:grid-cols-4' : 'sm:grid-cols-3'}`}>
          <div>
            <p className="text-xs uppercase tracking-wider text-slate-500">Butir Dinilai</p>
            <p className="mt-1 text-2xl font-bold tabular-nums">
              {ringkasan.butir_dinilai} / {ringkasan.total_butir}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-slate-500">Rata-rata Capaian</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-pktj-700">
              {ringkasan.rata_capaian != null ? `${ringkasan.rata_capaian}%` : '-'}
            </p>
          </div>
          {instrumen.berbobot ? (
            <div>
              <p className="text-xs uppercase tracking-wider text-slate-500">Skor Tertimbang</p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-emerald-700">
                {ringkasan.skor_tertimbang != null
                  ? `${ringkasan.skor_tertimbang} / ${Math.round(ringkasan.bobot_maksimal * instrumen.skorMaks * 100) / 100}`
                  : '-'}
                {ringkasan.persen_tertimbang != null && (
                  <span className="ml-1.5 text-sm font-medium text-slate-500">
                    ({ringkasan.persen_tertimbang}%)
                  </span>
                )}
              </p>
              <div className="mt-2"><Progres nilai={ringkasan.persen_tertimbang || 0} /></div>
            </div>
          ) : (
            <div>
              <p className="text-xs uppercase tracking-wider text-slate-500">Hasil Capaian</p>
              <p className={`mt-1 text-xl font-bold ${hasilCapaian?.terpenuhi ? 'text-emerald-700' : 'text-amber-600'}`}>
                {hasilCapaian
                  ? (hasilCapaian.terpenuhi ? hasilCapaian.label_terpenuhi : hasilCapaian.label_belum)
                  : '-'}
              </p>
            </div>
          )}
          {instrumenProdi && (
            <div>
              <p className="text-xs uppercase tracking-wider text-slate-500">Hasil Capaian Akreditasi</p>
              <HasilAkreditasiLAM data={hasilAkreditasi} />
            </div>
          )}
          {acuan.code === 'ZI' && (
            <div>
              <p className="text-xs uppercase tracking-wider text-slate-500">Hasil Evaluasi</p>
              <p className={`mt-1 text-xl font-bold ${warnaHasilEvaluasiZI(rekapZi?.total?.status)}`}>
                {rekapZi?.total?.status ?? '-'}
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="mb-3 rounded-lg bg-slate-50 px-4 py-2.5 text-xs text-slate-600">
        Skor tiap butir (skala {instrumen.skorMin}–{instrumen.skorMaks}) ditarik otomatis dari
        rata-rata skor penilaian auditor (Modul 3) atas indikator yang diadopsi dari butir acuan
        ini{unit ? ` khusus audit ${unit.name}` : ''}. Satuan Penjaminan Mutu dapat mengoreksi
        skor secara manual bila diperlukan.
      </div>

      {/* Pilihan komponen tampilan */}
      <div className="mb-4 inline-flex rounded-lg border border-slate-200 bg-white p-1">
        <button
          onClick={() => setKomponen('penilaian')}
          className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            komponen === 'penilaian' ? 'bg-pktj-700 text-white' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Icon.Tabel width={15} height={15} /> Penilaian
        </button>
        <button
          onClick={() => setKomponen('rekap')}
          className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            komponen === 'rekap' ? 'bg-pktj-700 text-white' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Icon.Rekap width={15} height={15} /> Rekap Nilai
        </button>
        <button
          onClick={() => setKomponen('radar')}
          className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            komponen === 'radar' ? 'bg-pktj-700 text-white' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Icon.Radar width={15} height={15} /> Grafik Radar
        </button>
      </div>

      {komponen === 'penilaian' ? (
        <div className="card overflow-hidden">
          <div className="border-b border-slate-200 bg-slate-50 px-5 py-3">
            <h2 className="text-sm font-semibold">{acuan.name}</h2>
          </div>
          {butir.length === 0 ? (
            <Kosong judul="Belum ada butir acuan" pesan="Lengkapi butir acuan ini pada menu Acuan Mutu." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="th">Kode / Uraian</th>
                    <th className="th w-20 text-center">Bobot</th>
                    {instrumenProdi && <th className="th w-28 text-center">Capaian Target</th>}
                    <th className="th w-32 text-center">
                      Skor <span className="font-normal text-slate-400">({instrumen.skorMin}–{instrumen.skorMaks})</span>
                    </th>
                    <th className="th w-40">Sumber</th>
                    {bolehSPM && <th className="th w-16"></th>}
                  </tr>
                </thead>
                <tbody>
                  {butir.map((b) => (
                    <BarisButir key={b.id} b={b} bolehSPM={bolehSPM} instrumenProdi={instrumenProdi}
                      onEdit={() => bukaEdit(b)} onKembalikan={() => kembalikanOtomatis(b)} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : komponen === 'rekap' ? (
        <RekapNilaiSheet kelompok={d.kelompok} instrumen={instrumen} acuan={acuan} ringkasan={ringkasan}
          rekapZi={rekapZi} instrumenProdi={instrumenProdi} hasilAkreditasi={hasilAkreditasi} />
      ) : (
        <GrafikRadarKelompok kelompok={d.kelompok} radar={radar} namaAcuan={acuan.name} acuanCode={acuan.code} />
      )}

      {/* Modal edit */}
      <Modal
        open={!!aktif} onClose={tutupEdit}
        title={`Koreksi Skor — ${aktif?.code || ''}`}
        footer={
          <>
            <button onClick={tutupEdit} className="btn-outline">Batal</button>
            <button onClick={simpanEdit} className="btn-primary" disabled={kirim}>
              {kirim ? 'Menyimpan…' : 'Simpan'}
            </button>
          </>
        }
      >
        {aktif && (
          <div className="space-y-4">
            <div className="rounded-lg bg-slate-50 p-3 text-sm">
              <p className="font-medium">{aktif.title}</p>
              {aktif.skor_otomatis != null && (
                <p className="mt-1 text-xs text-slate-500">
                  Nilai otomatis dari audit: {aktif.skor_otomatis}
                  ({aktif.jumlah_penilaian} penilaian)
                </p>
              )}
              {instrumenProdi && aktif.capaian_otomatis != null && (
                <p className="mt-1 text-xs text-slate-500">
                  Capaian otomatis dari audit: {aktif.capaian_otomatis}
                </p>
              )}
            </div>
            <div>
              <p className="label mb-2">Isian Auditee per Unit</p>
              {detailAuditee === null ? (
                <p className="text-xs text-slate-400">Memuat…</p>
              ) : detailAuditee.length === 0 ? (
                <p className="text-xs text-slate-400">Belum ada unit yang ditugaskan pada indikator ini.</p>
              ) : (
                <div className="space-y-2">
                  {detailAuditee.map((r) => (
                    <div key={`${r.indicator_id}-${r.unit_id}`}
                      className="rounded-lg border border-slate-200 p-2.5 text-xs">
                      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5">
                        <span className="font-medium text-slate-700">
                          {r.unit_name}
                          {r.peran && <span className="ml-1.5 text-[10px] font-normal uppercase text-slate-400">{r.peran}</span>}
                        </span>
                        <span className="text-slate-400">{r.code}</span>
                      </div>
                      {r.realisasi ? (
                        <>
                          <p className="mt-1 whitespace-pre-line text-slate-600">{r.realisasi}</p>
                          <p className="mt-1 flex flex-wrap gap-x-3 text-slate-500">
                            {r.capaian_nilai != null && <span>Capaian: {r.capaian_nilai}</span>}
                            {r.skor_auditor != null && <span>Skor auditor: {r.skor_auditor}</span>}
                            {r.verdict && <span>Verdict: {r.verdict}</span>}
                          </p>
                          {r.bukti_url && (
                            <a href={tautanBukti(r.bukti_url)} target="_blank" rel="noreferrer"
                              className="mt-1 inline-block text-pktj-600 hover:underline">
                              Lihat berkas bukti →
                            </a>
                          )}
                        </>
                      ) : (
                        <p className="mt-1 italic text-slate-400">Belum mengisi.</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
            {instrumenProdi && (
              <div>
                <label className="label">Capaian Target</label>
                <input type="number" step="any" className="input"
                  value={capaian} onChange={(e) => setCapaian(e.target.value)}
                  placeholder="isi sesuai capaian target" />
              </div>
            )}
            <div>
              <label className="label">
                Skor * (skala {instrumen.skorMin}–{instrumen.skorMaks}
                {instrumen.skorStep && instrumen.skorStep !== 1 ? `, kelipatan ${instrumen.skorStep}` : ''})
              </label>
              <input type="number" min={instrumen.skorMin} max={instrumen.skorMaks}
                step={instrumen.skorStep || 'any'} className="input"
                value={nilai} onChange={(e) => setNilai(e.target.value)} />
            </div>
            <div>
              <label className="label">Tautan Berkas Data Dukung</label>
              <input type="text" className="input" value={buktiUrl}
                onChange={(e) => setBuktiUrl(e.target.value)}
                placeholder="mis. tautan Google Drive berkas data dukung butir ini" />
              <p className="mt-1 text-[11px] text-slate-400">
                Opsional — tautan berkas (mis. Google Drive) yang mendukung skor/capaian butir ini.
              </p>
              {aktif.bukti_url_manual && (
                <a href={tautanBukti(aktif.bukti_url_manual)} target="_blank" rel="noreferrer"
                  className="mt-1 inline-block text-xs text-pktj-600 hover:underline">
                  Lihat tautan tersimpan saat ini →
                </a>
              )}
            </div>
            <div>
              <label className="label">Catatan</label>
              <textarea className="textarea min-h-[70px]" value={catatan}
                onChange={(e) => setCatatan(e.target.value)}
                placeholder="Alasan koreksi atau sumber bukti pendukung" />
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}

/** Status akreditasi LAM Teknik (kartu ringkasan atas), dihitung backend dari
 *  Nilai Akreditasi (skor tertimbang) + syarat perlu yang kini dihitung
 *  OTOMATIS dari nilai butir (lihat SyaratPerluSheet pada tab Rekap Nilai
 *  untuk rinciannya). Bila syarat dasar belum lengkap dinilai, status belum
 *  bisa ditentukan. */
function HasilAkreditasiLAM({ data }) {
  if (!data) return null;
  const lengkapDasar = data.syarat_perlu?.lengkap_dasar;
  const warna = !lengkapDasar ? 'text-slate-400'
    : data.status === 'Terakreditasi Unggul' ? 'text-emerald-700'
    : data.status === 'Terakreditasi' ? 'text-pktj-700'
    : 'text-rose-600';
  return (
    <div className="mt-1">
      {lengkapDasar ? (
        <>
          <p className={`text-xl font-bold ${warna}`}>{data.status}</p>
          {data.durasi && <p className="text-xs font-medium text-slate-500">Durasi {data.durasi}</p>}
        </>
      ) : (
        <p className="text-sm italic text-slate-400">Syarat perlu belum lengkap dinilai</p>
      )}
      <p className="mt-1 text-[11px] text-slate-400">Lihat rincian di tab Rekap Nilai</p>
    </div>
  );
}

/** Warna teks status Hasil Evaluasi Zona Integritas (kartu ringkasan atas). */
function warnaHasilEvaluasiZI(status) {
  return status === 'Memenuhi WBBM' ? 'text-emerald-700'
    : status === 'Memenuhi WBK' ? 'text-pktj-700'
    : 'text-amber-600';
}

/**
 * Sheet "Rekap Nilai" — setara Penilaian dan Grafik Radar, berisi tabel
 * skor per kategori. Skor tiap kategori = jumlah (bobot × skor) seluruh
 * butir/indikator pada kategori tersebut (Σ bobot×skor), dihitung langsung
 * dari daftar butir per kategori yang sama dipakai grafik radar (d.kelompok)
 * — bukan rata-rata maupun persen. Baris total menjumlahkan seluruh
 * kategori, harus sama dengan skor tertimbang keseluruhan instrumen.
 *
 * Untuk acuan tanpa bobot resmi pada dokumen sumber (BAN-PT, ISO 21001),
 * skor tertimbang tidak berlaku — sheet ini hanya menampilkan tabel
 * persentase pemenuhan per kategori (kartu status Hasil Capaian sudah ada
 * pada kartu ringkasan atas halaman, tidak diulang di sini).
 */
function RekapNilaiSheet({ kelompok, instrumen, acuan, ringkasan, rekapZi, instrumenProdi, hasilAkreditasi }) {
  if (acuan.code === 'ZI' && rekapZi) {
    return <RekapZISheet data={rekapZi} />;
  }

  if (!kelompok || kelompok.length === 0) {
    return (
      <div className="card-p">
        <Kosong judul="Belum cukup kategori untuk rekap nilai"
          pesan="Lengkapi struktur butir acuan (kelompok/payung) pada menu Acuan Mutu." />
      </div>
    );
  }

  if (!instrumen.berbobot) {
    // Persentase di sini menghitung langsung terhadap SELURUH butir kategori
    // (bukan hanya yang sudah dinilai) — butir yang belum diisi dianggap 0,
    // berbeda dari sumbu radar yang merata-ratakan hanya yang sudah dinilai.
    const barisPersen = kelompok.map((k) => {
      const totalSkor = (k.butir || []).reduce((a, b) => a + (b.skor ?? 0), 0);
      const persen = k.total_butir > 0
        ? Math.round((totalSkor / (instrumen.skorMaks * k.total_butir)) * 1000) / 10
        : null;
      return { kode: k.kode, label: k.label, butir_dinilai: k.butir_dinilai,
        total_butir: k.total_butir, persen };
    });

    return (
      <div className="space-y-4">
        <div className="card overflow-hidden">
          <div className="border-b border-slate-200 bg-slate-50 px-5 py-3">
            <h2 className="text-sm font-semibold">Pemenuhan per Kategori</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="th">Kategori</th>
                  <th className="th w-32 text-center">Butir Terpenuhi</th>
                  <th className="th w-28 text-center">Persentase</th>
                </tr>
              </thead>
              <tbody>
                {barisPersen.map((k) => (
                  <tr key={k.kode}>
                    <td className="td">
                      <span className="font-mono text-[11px] text-slate-500">{k.kode}</span>{' '}
                      {k.label}
                    </td>
                    <td className="td text-center tabular-nums">
                      {k.butir_dinilai} / {k.total_butir}
                    </td>
                    <td className="td text-center font-semibold tabular-nums">
                      {k.persen != null ? `${k.persen}%` : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  const baris = kelompok.map((k) => {
    const acc = (k.butir || []).reduce(
      (a, b) => {
        if (b.bobot != null) {
          a.bobot += b.bobot;
          if (b.skor != null) a.skorTertimbang += b.bobot * b.skor;
        }
        return a;
      },
      { bobot: 0, skorTertimbang: 0 }
    );
    const bobot = Math.round(acc.bobot * 100) / 100;
    const skorTertimbang = Math.round(acc.skorTertimbang * 100) / 100;
    const skorMaksimal = Math.round(bobot * instrumen.skorMaks * 100) / 100;
    return {
      kode: k.kode, label: k.label,
      butir_dinilai: k.butir_dinilai, total_butir: k.total_butir,
      bobot, skor_tertimbang: skorTertimbang, skor_maksimal: skorMaksimal,
      persentase_capaian: skorMaksimal > 0 ? Math.round((skorTertimbang / skorMaksimal) * 1000) / 10 : null,
    };
  });
  const totalBobot = Math.round(baris.reduce((a, b) => a + b.bobot, 0) * 100) / 100;
  const totalSkor = Math.round(baris.reduce((a, b) => a + b.skor_tertimbang, 0) * 100) / 100;
  const totalSkorMaksimal = Math.round(baris.reduce((a, b) => a + b.skor_maksimal, 0) * 100) / 100;
  const totalPersentase = totalSkorMaksimal > 0 ? Math.round((totalSkor / totalSkorMaksimal) * 1000) / 10 : null;

  return (
    <div className="space-y-4">
      <div className="card overflow-hidden">
        <div className="border-b border-slate-200 bg-slate-50 px-5 py-3">
          <h2 className="text-sm font-semibold">Skor per Kategori</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="th">Kategori</th>
                <th className="th w-24 text-center">Butir Dinilai</th>
                <th className="th w-20 text-center">Bobot</th>
                <th className="th w-32 text-center">Skor Tertimbang (Σ bobot×skor)</th>
                <th className="th w-28 text-center">Skor Maksimal</th>
                <th className="th w-24 text-center">% Capaian</th>
              </tr>
            </thead>
            <tbody>
              {baris.map((k) => (
                <tr key={k.kode}>
                  <td className="td">
                    <span className="font-mono text-[11px] text-slate-500">{k.kode}</span>{' '}
                    {k.label}
                  </td>
                  <td className="td text-center tabular-nums">
                    {k.butir_dinilai} / {k.total_butir}
                  </td>
                  <td className="td text-center tabular-nums">{k.bobot || '-'}</td>
                  <td className="td text-center font-semibold tabular-nums">
                    {k.skor_tertimbang}
                  </td>
                  <td className="td text-center tabular-nums text-slate-500">
                    {k.skor_maksimal}
                  </td>
                  <td className="td text-center font-semibold tabular-nums text-pktj-700">
                    {k.persentase_capaian != null ? `${k.persentase_capaian}%` : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-slate-50 font-semibold">
                <td className="td">Total</td>
                <td className="td text-center tabular-nums">
                  {ringkasan.butir_dinilai} / {ringkasan.total_butir}
                </td>
                <td className="td text-center tabular-nums">{totalBobot}</td>
                <td className="td text-center tabular-nums text-emerald-700">{totalSkor}</td>
                <td className="td text-center tabular-nums text-slate-500">{totalSkorMaksimal}</td>
                <td className="td text-center tabular-nums text-pktj-700">
                  {totalPersentase != null ? `${totalPersentase}%` : '-'}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
        <div className="border-t border-slate-200 bg-slate-50/60 px-5 py-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-600">Persen Tertimbang Keseluruhan</span>
            <span className="text-lg font-bold tabular-nums text-pktj-700">
              {ringkasan.persen_tertimbang != null ? `${ringkasan.persen_tertimbang}%` : '-'}
            </span>
          </div>
          <div className="mt-1.5"><Progres nilai={ringkasan.persen_tertimbang || 0} /></div>
        </div>
      </div>
      {instrumenProdi && hasilAkreditasi?.syarat_perlu && (
        <SyaratPerluSheet hasilAkreditasi={hasilAkreditasi} />
      )}
    </div>
  );
}

/**
 * Pengecekan syarat perlu akreditasi, ditampilkan di bagian paling bawah
 * tab Rekap Nilai instrumen akreditasi prodi. Baris "belum dinilai"
 * menandai item yang datanya belum lengkap, sehingga status di kartu
 * ringkasan atas juga belum bisa ditentukan.
 */
function SyaratPerluSheet({ hasilAkreditasi }) {
  const sp = hasilAkreditasi.syarat_perlu;
  const StatusSel = ({ v }) =>
    v == null ? (
      <span className="text-xs italic text-slate-400">belum dinilai</span>
    ) : v ? (
      <span className="text-emerald-600">✓</span>
    ) : (
      <span className="text-rose-500">✗</span>
    );

  return (
    <div className="card overflow-hidden">
      <div className="border-b border-slate-200 bg-slate-50 px-5 py-3">
        <h2 className="text-sm font-semibold">Syarat Perlu Akreditasi</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="th">Kriteria</th>
              <th className="th w-28 text-center">Nilai</th>
              <th className="th w-24 text-center">Ambang Dasar</th>
              <th className="th w-24 text-center">Unggul 3 Th</th>
              <th className="th w-24 text-center">Unggul 5 Th</th>
            </tr>
          </thead>
          <tbody>
            {sp.item.map((it) => (
              <tr key={it.kunci}>
                <td className="td">
                  <span className="font-mono text-[11px] text-slate-500">{it.kode.join(' / ')}</span> {it.label}
                </td>
                <td className="td text-center tabular-nums">
                  {it.nilai != null ? `${it.nilai} ${it.satuan}` : <span className="text-xs italic text-slate-400">-</span>}
                </td>
                <td className="td text-center">
                  {it.ambang_dasar != null ? <StatusSel v={it.memenuhi_dasar} /> : <span className="text-slate-300">—</span>}
                </td>
                <td className="td text-center"><StatusSel v={it.memenuhi_unggul_3} /></td>
                <td className="td text-center"><StatusSel v={it.memenuhi_unggul_5} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="border-t border-slate-200 bg-slate-50/60 px-5 py-3 space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-slate-600">Syarat Perlu Terakreditasi</span>
          <span className={`text-sm font-bold ${!sp.lengkap_dasar ? 'text-slate-400' : sp.syarat_terakreditasi ? 'text-emerald-700' : 'text-rose-600'}`}>
            {!sp.lengkap_dasar ? 'Belum lengkap dinilai' : sp.syarat_terakreditasi ? 'Memenuhi' : 'Tidak memenuhi'}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-slate-600">Syarat Perlu Terakreditasi Unggul</span>
          <span className={`text-sm font-bold ${!sp.lengkap_unggul ? 'text-slate-400' : sp.unggul_tier === 'tidak' ? 'text-rose-600' : 'text-emerald-700'}`}>
            {!sp.lengkap_unggul ? 'Belum lengkap dinilai'
              : sp.unggul_tier === 'lima' ? 'Memenuhi — durasi 5 Tahun'
              : sp.unggul_tier === 'tiga' ? 'Memenuhi — durasi 3 Tahun'
              : 'Tidak memenuhi'}
          </span>
        </div>
      </div>
    </div>
  );
}

/**
 * Rekap Nilai khusus Zona Integritas, mengikuti format resmi Lembar Kerja
 * Evaluasi (LKE) Reformasi Birokrasi: Area Perubahan | Bobot | Pemenuhan |
 * Reform | Nilai | % | Kelengkapan Penilaian, dengan struktur bertingkat
 * A. PENGUNGKIT (6 aspek, tiap aspek membawa dua kode — cabang Pemenuhan
 * dan Reform) dan B. HASIL (2 area, tiap area dirinci hingga butir/indikator
 * penyusunnya), ditutup baris total "NILAI EVALUASI REFORMASI BIROKRASI".
 * Status Hasil Evaluasi (WBK/WBBM) sudah ditampilkan pada kartu ringkasan
 * atas halaman, tidak diulang di sini.
 */
function RekapZISheet({ data }) {
  const { pengungkit, hasil, total } = data;
  const StatusBadge = ({ lengkap, butir_dinilai, total_butir }) =>
    lengkap ? (
      <span className="badge bg-emerald-100 text-emerald-800">Lengkap</span>
    ) : (
      <span className="badge bg-amber-100 text-amber-800">
        {butir_dinilai != null ? `${butir_dinilai}/${total_butir}` : 'Belum Lengkap'}
      </span>
    );

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="th">Area Perubahan</th>
              <th className="th w-16 text-center">Bobot</th>
              <th className="th w-24 text-center">Pemenuhan</th>
              <th className="th w-24 text-center">Reform</th>
              <th className="th w-20 text-center">Nilai</th>
              <th className="th w-16 text-center">%</th>
              <th className="th w-28 text-center">Kelengkapan Penilaian</th>
            </tr>
          </thead>
          <tbody>
            <tr className="bg-slate-100">
              <td className="td font-semibold" colSpan={7}>A. PENGUNGKIT</td>
            </tr>
            {pengungkit.aspek.map((a, i) => (
              <tr key={a.kode_pemenuhan}>
                <td className="td">
                  <span className="mr-1 text-slate-400">{i + 1}.</span>
                  {a.label}
                  <div className="mt-0.5 font-mono text-[10px] text-slate-400">
                    {a.kode_pemenuhan}{a.kode_reform ? ` / ${a.kode_reform}` : ''}
                  </div>
                </td>
                <td className="td text-center tabular-nums">{a.bobot}</td>
                <td className="td text-center tabular-nums">
                  {a.pemenuhan} <span className="text-slate-400">/ {a.pemenuhan_maks}</span>
                </td>
                <td className="td text-center tabular-nums">
                  {a.reform} <span className="text-slate-400">/ {a.reform_maks}</span>
                </td>
                <td className="td text-center font-semibold tabular-nums">{a.nilai}</td>
                <td className="td text-center tabular-nums">{a.persen != null ? `${a.persen}%` : '-'}</td>
                <td className="td text-center">
                  <StatusBadge lengkap={a.lengkap} butir_dinilai={a.butir_dinilai} total_butir={a.total_butir} />
                </td>
              </tr>
            ))}
            <tr className="bg-slate-50 font-semibold">
              <td className="td">TOTAL PENGUNGKIT</td>
              <td className="td text-center tabular-nums">{pengungkit.bobot}</td>
              <td className="td text-center text-slate-300" colSpan={2}>—</td>
              <td className="td text-center tabular-nums text-emerald-700">{pengungkit.nilai}</td>
              <td className="td text-center tabular-nums">
                {pengungkit.persen != null ? `${pengungkit.persen}%` : '-'}
              </td>
              <td className="td text-center"><StatusBadge lengkap={pengungkit.lengkap} /></td>
            </tr>

            <tr className="bg-slate-100">
              <td className="td font-semibold" colSpan={7}>B. HASIL</td>
            </tr>
            {hasil.area.map((ar) => (
              <Fragment key={ar.kode}>
                <tr className="font-medium">
                  <td className="td">{ar.romawi}. {ar.label}</td>
                  <td className="td text-center tabular-nums">{ar.bobot}</td>
                  <td className="td text-center text-slate-300" colSpan={2}>—</td>
                  <td className="td text-center font-semibold tabular-nums">{ar.nilai}</td>
                  <td className="td text-center tabular-nums">{ar.persen != null ? `${ar.persen}%` : '-'}</td>
                  <td className="td text-center">
                    <StatusBadge lengkap={ar.lengkap} butir_dinilai={ar.butir_dinilai} total_butir={ar.total_butir} />
                  </td>
                </tr>
                {ar.item.map((it, i) => (
                  <tr key={it.kode} className="text-slate-600">
                    <td className="td text-xs" style={{ paddingLeft: '2rem' }}>
                      <span className="mr-1">{String.fromCharCode(97 + i)}.</span>{it.label}
                      <span className="ml-1 font-mono text-[10px] text-slate-400">{it.kode}</span>
                    </td>
                    <td className="td text-center text-xs tabular-nums">{it.bobot ?? '-'}</td>
                    <td className="td text-center text-xs text-slate-300" colSpan={2}>—</td>
                    <td className="td text-center text-xs tabular-nums">{it.nilai ?? '-'}</td>
                    <td className="td text-center text-xs tabular-nums">{it.persen != null ? `${it.persen}%` : '-'}</td>
                    <td className="td text-center text-xs">
                      {it.dinilai ? '' : <span className="italic text-slate-400">Belum dinilai</span>}
                    </td>
                  </tr>
                ))}
              </Fragment>
            ))}
            <tr className="bg-slate-50 font-semibold">
              <td className="td">TOTAL HASIL</td>
              <td className="td text-center tabular-nums">{hasil.bobot}</td>
              <td className="td text-center text-slate-300" colSpan={2}>—</td>
              <td className="td text-center tabular-nums text-emerald-700">{hasil.nilai}</td>
              <td className="td text-center tabular-nums">{hasil.persen != null ? `${hasil.persen}%` : '-'}</td>
              <td className="td text-center"><StatusBadge lengkap={hasil.lengkap} /></td>
            </tr>
          </tbody>
          <tfoot>
            <tr className="bg-pktj-50 font-bold">
              <td className="td">NILAI EVALUASI REFORMASI BIROKRASI</td>
              <td className="td text-center tabular-nums">{total.bobot}</td>
              <td className="td text-center text-slate-300" colSpan={2}>—</td>
              <td className="td text-center tabular-nums text-pktj-700">{total.nilai}</td>
              <td className="td text-center tabular-nums">{total.persen != null ? `${total.persen}%` : '-'}</td>
              <td className="td text-center"><StatusBadge lengkap={total.lengkap} /></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

/** Label & pemformat nilai mengikuti tipe radar yang dipilih backend:
 *  - 'persen': acuan berskala biner (mis. BAN-PT/ISO 21001) → 0-100%
 *  - 'skor'  : acuan berskala rubrik (mis. LAM Teknik 1-4, GreenMetric 1-5)
 *              atau Zona Integritas (penjumlahan pemenuhan+reform) → skor mentah */
function formatNilaiRadar(v, tipe) {
  if (v == null) return '-';
  return tipe === 'persen' ? `${v}%` : `${v}`;
}

/** Pecah teks panjang menjadi beberapa baris pendek (dibungkus per kata),
 *  dipakai untuk label sumbu grafik radar/kolom supaya nama kategori/butir
 *  yang panjang tidak melebar dan tumpang tindih. */
function bungkusBaris(teks, maxKarakter = 22, maxBaris = 3) {
  const kata = (teks || '').split(/\s+/).filter(Boolean);
  if (kata.length === 0) return [];
  const baris = [];
  let saatIni = '';
  for (const w of kata) {
    const calon = saatIni ? `${saatIni} ${w}` : w;
    if (calon.length > maxKarakter && saatIni && baris.length < maxBaris - 1) {
      baris.push(saatIni);
      saatIni = w;
    } else {
      saatIni = calon;
    }
  }
  if (saatIni) baris.push(saatIni);
  return baris;
}

/**
 * Bungkus label sumbu kategori grafik radar menjadi 2-3 baris pendek supaya
 * nama panjang tidak melebar (lih. juga `bungkusBaris`). Tiga aturan khusus
 * sebelum jatuh ke pembungkusan generik:
 *  - ISO 21001: baris 1 "Klausul <kode>", baris 2 judul klausul.
 *  - Judul berformat "Nama — Terjemahan (keterangan)" (mis. UI GreenMetric):
 *    dipersingkat, cukup ambil segmen pertama sebelum tanda em dash.
 *  - Judul dengan keterangan dalam kurung (mis. LAM Teknik): teks sebelum
 *    kurung dan isi kurung dipisah jadi baris tersendiri.
 *  Dipakai juga untuk label sumbu butir (acuanCode tidak diisi → langsung
 *  memakai aturan em dash/kurung/generik).
 */
function bungkusLabelKategori(kode, label, acuanCode) {
  if (acuanCode === 'ISO21001') return [`Klausul ${kode}`, ...bungkusBaris(label, 20, 2)];
  const idxEmDash = (label || '').indexOf('—');
  if (idxEmDash > -1) {
    const singkat = label.slice(0, idxEmDash).trim();
    if (singkat) return bungkusBaris(singkat, 20, 2);
  }
  const idxKurung = (label || '').indexOf('(');
  if (idxKurung > 3) {
    const sebelum = label.slice(0, idxKurung).trim();
    const dalamKurung = label.slice(idxKurung).trim();
    const barisSebelum = bungkusBaris(sebelum, 22, 2);
    const sisaBaris = Math.max(1, 3 - barisSebelum.length);
    return [...barisSebelum, ...bungkusBaris(dalamKurung, 22, sisaBaris)];
  }
  return bungkusBaris(label, 22, 3);
}

/** Jumlah tick sumbu radial (PolarRadiusAxis) grafik radar. Bawaan recharts
 *  selalu 5 tick merata pada domain berapa pun — untuk skala kecil berupa
 *  bilangan bulat seperti 1-4 (LAM Teknik) itu menghasilkan tick pecahan
 *  jelek (1, 1.75, 2.5, 3.25, 4). Untuk domain bilangan bulat berjarak
 *  2-6 (mis. skor 1-4 atau 1-5), pakai satu tick tiap satuan supaya label
 *  bulat dan rapi (1,2,3,4) — domain lain (mis. 0-100% atau 0-1 ZI dengan
 *  kelipatan 0,25) tetap memakai bawaan 5 tick yang sudah rapi. */
function tickCountSumbuRadial(domain) {
  const rentang = domain[1] - domain[0];
  const bulat = Number.isInteger(domain[0]) && Number.isInteger(domain[1]);
  if (bulat && rentang >= 2 && rentang <= 6) return Math.round(rentang) + 1;
  return 5;
}

const RADIAN_TICK = Math.PI / 180;
/** Jarak ekstra (px) mendorong label sumbu polar lebih jauh dari garis grid
 *  radar, searah sumbu tick tersebut (di atas bawaan tickSize 8px recharts
 *  yang membuatnya terlalu mepet). */
const JARAK_LABEL_POLAR = 10;
const TINGGI_BARIS_TICK = 11;

/** Render teks tick sumbu polar (PolarAngleAxis) multi-baris dengan jarak
 *  ekstra dari garis grid, dan arah pertumbuhan baris yang MENJAUHI garis —
 *  bukan menengah pada titik tick seperti sebelumnya. Sebelumnya, label
 *  multi-baris selalu di-tengah-kan pada titik tick sehingga pada posisi
 *  atas sumbu baris terakhir, dan pada posisi bawah sumbu baris pertama,
 *  masuk ke area garis grafik. Posisi atas/bawah diketahui dari
 *  `payload.coordinate` (sudut tick dalam derajat) — recharts memakai
 *  polarToCartesian(cx,cy,r,sudut) = (cx+cos(-sudut·RADIAN)·r,
 *  cy+sin(-sudut·RADIAN)·r), jadi sin(-sudut·RADIAN) negatif berarti posisi
 *  ATAS (y<cy) dan positif berarti posisi BAWAH (y>cy); posisi kiri/kanan
 *  dikenali dari textAnchor ('end'/'start') dan cukup dipusatkan seperti
 *  semula karena jarak sudah terbantu oleh dorongan horizontal. */
function TickPolarBaris({ x, y, payload, textAnchor, baris }) {
  if (!baris || baris.length === 0) return null;
  const sudut = payload?.coordinate ?? 0;
  const dx = Math.cos(-sudut * RADIAN_TICK);
  const dy = Math.sin(-sudut * RADIAN_TICK);
  const xx = x + dx * JARAK_LABEL_POLAR;
  const yy = y + dy * JARAK_LABEL_POLAR;

  let dyAwal;
  if (textAnchor === 'middle') {
    // Posisi atas (dy<0): baris tumbuh ke ATAS, baris terakhir tetap di titik
    // acuan (yang sudah didorong menjauhi garis). Posisi bawah (dy>0): baris
    // tumbuh ke BAWAH, baris pertama di titik acuan.
    dyAwal = dy < 0 ? -((baris.length - 1) * TINGGI_BARIS_TICK) : 0;
  } else {
    dyAwal = -((baris.length - 1) * TINGGI_BARIS_TICK) / 2;
  }

  return (
    <text x={xx} y={yy} textAnchor={textAnchor} fontSize={10} fill="#475569">
      {baris.map((b, i) => (
        <tspan key={i} x={xx} dy={i === 0 ? dyAwal : TINGGI_BARIS_TICK}>{b}</tspan>
      ))}
    </text>
  );
}

/** Tick sumbu kategori (multi-baris) untuk PolarAngleAxis grafik radar
 *  kelompok — mengambil kode+label item asli lewat `payload.index` (bukan
 *  dari `payload.value` yang hanya berisi label). */
function TickLabelKategori({ x, y, payload, textAnchor, data, acuanCode }) {
  const item = data?.[payload.index];
  const baris = item ? bungkusLabelKategori(item.kode, item.label, acuanCode) : [payload.value];
  return <TickPolarBaris x={x} y={y} payload={payload} textAnchor={textAnchor} baris={baris} />;
}

/** Tick sumbu butir (multi-baris). Untuk Zona Integritas dan GreenMetric
 *  (`kodeSaja`), label sumbu cukup kode butirnya saja (satu baris, tanpa
 *  perlu dibungkus) — kode acuan lain tetap memakai label lengkap yang
 *  dibungkus per baris. */
function TickLabelButir({ x, y, payload, textAnchor, data, kodeSaja }) {
  const item = data?.[payload.index];
  const baris = item
    ? (kodeSaja ? [item.kode] : bungkusLabelKategori(item.kode, item.label))
    : [payload.value];
  return <TickPolarBaris x={x} y={y} payload={payload} textAnchor={textAnchor} baris={baris} />;
}

/** Sama seperti `TickLabelButir`, untuk sumbu-Y kartesian (grafik kolom
 *  horizontal) — rata kanan karena berada di sisi kiri grafik. */
function TickLabelButirY({ x, y, payload, data, kodeSaja }) {
  const item = data?.[payload.index];
  const baris = item
    ? (kodeSaja ? [item.kode] : bungkusLabelKategori(item.kode, item.label))
    : [payload.value];
  const dyAwal = -((baris.length - 1) * TINGGI_BARIS_TICK) / 2 + 3;
  return (
    <text x={x} y={y} textAnchor="end" fontSize={10} fill="#475569">
      {baris.map((b, i) => (
        <tspan key={i} x={x} dy={i === 0 ? dyAwal : TINGGI_BARIS_TICK}>{b}</tspan>
      ))}
    </text>
  );
}

function GrafikRadarKelompok({ kelompok, radar, namaAcuan, acuanCode }) {
  const [terbuka, setTerbuka] = useState(null); // kode kategori yang sedang dibuka, atau null

  if (!kelompok || kelompok.length === 0) {
    return (
      <div className="card-p">
        <Kosong judul="Belum cukup kategori untuk grafik radar"
          pesan="Lengkapi struktur butir acuan (kelompok/payung) pada menu Acuan Mutu." />
      </div>
    );
  }

  const tipe = radar?.tipe || 'persen';
  const domainKategori = radar?.domain_kategori || [0, 100];
  const domainButir = radar?.domain_butir || [0, 100];
  const greenMetric = acuanCode === 'GREENMETRIC';
  const labelNilai = greenMetric ? '% Capaian' : tipe === 'persen' ? 'Persentase Terpenuhi' : 'Skor Kategori';
  // Kategori yang belum ada butirnya sama sekali (tanpa bobot) tetap null —
  // sisanya sudah pasti berada dalam domain (nilai 0% pun terkonversi ke
  // domainKategori[0] oleh backend), fallback ini hanya jaring pengaman.
  const data = kelompok.map((k) => ({ ...k, tampil: k.nilai ?? domainKategori[0] }));

  return (
    <div className="card-p">
      <div className="mb-1 flex items-center justify-between">
        <h2 className="text-sm font-semibold">{namaAcuan}</h2>
        <span className="text-xs text-slate-500">
          {greenMetric
            ? `% capaian tertimbang per kategori (${domainKategori[0]}–${domainKategori[1]}%)`
            : tipe === 'persen'
            ? `Persentase indikator terpenuhi per kategori (${domainKategori[0]}–${domainKategori[1]}%)`
            : `Skor per kategori (skala ${domainKategori[0]}–${domainKategori[1]})`}
        </span>
      </div>
      <ResponsiveContainer width="100%" height={420}>
        <RadarChart data={data} outerRadius="65%">
          <PolarGrid stroke="#e2e8f0" />
          <PolarAngleAxis dataKey="label"
            tick={(props) => <TickLabelKategori {...props} data={data} acuanCode={acuanCode} />} />
          <PolarRadiusAxis angle={90} domain={domainKategori} tickCount={tickCountSumbuRadial(domainKategori)}
            tick={{ fontSize: 10 }} stroke="#94a3b8" />
          <Radar
            name={labelNilai}
            dataKey="tampil"
            stroke="#0e7490"
            fill="#0e7490"
            fillOpacity={0.35}
          />
          <Tooltip
            formatter={(v) => [formatNilaiRadar(v, tipe), labelNilai]}
            contentStyle={{ fontSize: 12, borderRadius: 8 }}
          />
        </RadarChart>
      </ResponsiveContainer>

      <p className="mb-1 text-xs text-slate-500">
        Klik salah satu kategori untuk melihat grafik radar tiap butir/indikator di dalamnya.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="th">Kategori</th>
              <th className="th w-24 text-center">Butir Dinilai</th>
              <th className="th w-28 text-center">{labelNilai}</th>
              <th className="th w-10"></th>
            </tr>
          </thead>
          <tbody>
            {kelompok.map((k) => (
              <Fragment key={k.kode}>
                <tr
                  onClick={() => setTerbuka(terbuka === k.kode ? null : k.kode)}
                  className="cursor-pointer hover:bg-slate-50"
                >
                  <td className="td">
                    <span className="font-mono text-[11px] text-slate-500">{k.kode}</span>{' '}
                    {k.label}
                  </td>
                  <td className="td text-center tabular-nums">
                    {k.butir_dinilai} / {k.total_butir}
                  </td>
                  <td className="td text-center font-semibold tabular-nums">
                    {formatNilaiRadar(k.nilai, tipe)}
                  </td>
                  <td className="td text-center text-slate-400">
                    {terbuka === k.kode ? '▲' : '▼'}
                  </td>
                </tr>
                {terbuka === k.kode && (
                  <tr>
                    <td colSpan={4} className="border-b border-slate-100 bg-slate-50/60 p-0">
                      <GrafikRadarButir kategori={k} domain={domainButir} acuanCode={acuanCode} />
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Grafik radar rinci per butir/indikator di dalam satu kategori (drill-down
 *  dari GrafikRadarKelompok). Nilai tiap sumbu selalu SKOR MENTAH pada skala
 *  asli acuan (tidak pernah dipersenkan), hanya menampilkan nama butir,
 *  bukan kode. Untuk kategori gabungan Zona Integritas (6 aspek pengungkit),
 *  butir cabang Pemenuhan dan Reform ditampilkan sebagai DUA grafik terpisah
 *  berdampingan — bukan satu grafik campuran — supaya kedua aspek mudah
 *  dibandingkan sendiri-sendiri. */
function GrafikRadarButir({ kategori, domain, acuanCode }) {
  const butir = kategori.butir || [];
  if (butir.length === 0) {
    return (
      <div className="p-4 text-xs italic text-slate-500">
        Kategori ini tidak memiliki butir/indikator.
      </div>
    );
  }
  const cabangSet = new Set(butir.map((b) => b.cabang).filter(Boolean));
  const terpisah = cabangSet.size >= 2;

  return (
    <div className="p-4">
      <p className="mb-2 text-xs font-semibold text-slate-600">
        Detail Butir — {kategori.label}
        <span className="ml-1.5 font-normal text-slate-400">(skala {domain[0]}–{domain[1]})</span>
      </p>
      {terpisah ? (
        <div className="grid gap-4 md:grid-cols-2">
          <MiniGrafikButir judul="Aspek Pemenuhan" acuanCode={acuanCode}
            butir={butir.filter((b) => b.cabang === 'Pemenuhan')} domain={domain} warna="#0e7490" />
          <MiniGrafikButir judul="Aspek Reform" acuanCode={acuanCode}
            butir={butir.filter((b) => b.cabang === 'Reform')} domain={domain} warna="#b45309" />
        </div>
      ) : (
        <MiniGrafikButir butir={butir} domain={domain} warna="#b45309" acuanCode={acuanCode} />
      )}
    </div>
  );
}

/** Satu blok grafik + tabel butir. Otomatis memilih grafik KOLOM (bar) bila
 *  jumlah butir kurang dari 3 — grafik radar tidak enak dibaca dengan
 *  kurang dari 3 sumbu (mis. area Hasil Zona Integritas yang hanya berisi
 *  1-2 indikator) — selain itu tetap memakai grafik radar seperti biasa.
 *  Untuk Zona Integritas dan GreenMetric, label sumbu grafik detail butir
 *  cukup memakai kode butirnya saja (`kodeSaja`) — nama lengkap tetap
 *  ditampilkan pada tabel di bawah grafik. */
function MiniGrafikButir({ judul, butir, domain, warna = '#b45309', acuanCode }) {
  if (!butir || butir.length === 0) {
    return judul ? (
      <div>
        <p className="mb-1.5 text-xs font-medium text-slate-500">{judul}</p>
        <p className="text-xs italic text-slate-400">Tidak ada butir/indikator pada cabang ini.</p>
      </div>
    ) : null;
  }
  const data = butir.map((b) => ({ ...b, tampil: b.skor ?? domain[0] }));
  const pakaiKolom = butir.length < 3;
  const kodeSaja = acuanCode === 'ZI' || acuanCode === 'GREENMETRIC';

  return (
    <div>
      {judul && <p className="mb-1.5 text-xs font-medium text-slate-500">{judul}</p>}
      <ResponsiveContainer width="100%" height={Math.max(220, butir.length * (pakaiKolom ? 44 : 24))}>
        {pakaiKolom ? (
          <BarChart data={data} layout="vertical" margin={{ top: 4, right: 20, bottom: 4, left: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
            <XAxis type="number" domain={domain} tick={{ fontSize: 10 }} stroke="#94a3b8" />
            <YAxis type="category" dataKey="label" width={140}
              tick={(props) => <TickLabelButirY {...props} data={data} kodeSaja={kodeSaja} />} />
            <Tooltip
              formatter={(v, _n, item) => [item.payload.dinilai ? `${v}` : 'Belum dinilai', item.payload.label]}
              contentStyle={{ fontSize: 12, borderRadius: 8 }}
            />
            <Bar dataKey="tampil" fill={warna} radius={[0, 4, 4, 0]} />
          </BarChart>
        ) : (
          <RadarChart data={data} outerRadius="65%">
            <PolarGrid stroke="#e2e8f0" />
            <PolarAngleAxis dataKey="label"
              tick={(props) => <TickLabelButir {...props} data={data} kodeSaja={kodeSaja} />} />
            <PolarRadiusAxis angle={90} domain={domain} tickCount={tickCountSumbuRadial(domain)}
              tick={{ fontSize: 10 }} stroke="#94a3b8" />
            <Radar name="Skor" dataKey="tampil" stroke={warna} fill={warna} fillOpacity={0.35} />
            <Tooltip
              formatter={(v, _n, item) => [item.payload.dinilai ? `${v}` : 'Belum dinilai', item.payload.label]}
              contentStyle={{ fontSize: 12, borderRadius: 8 }}
            />
          </RadarChart>
        )}
      </ResponsiveContainer>

      <div className="mt-2 overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr>
              <th className="th">Butir</th>
              <th className="th w-20 text-center">Bobot</th>
              <th className="th w-20 text-center">Skor</th>
            </tr>
          </thead>
          <tbody>
            {butir.map((b, i) => (
              <tr key={`${b.kode}-${i}`}>
                <td className="td">
                  <span className="font-mono text-[11px] text-slate-500">{b.kode}</span>{' '}
                  {b.label}
                </td>
                <td className="td text-center tabular-nums">{b.bobot ?? '-'}</td>
                <td className="td text-center font-semibold tabular-nums">{b.skor ?? '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function BarisButir({ b, bolehSPM, instrumenProdi, onEdit, onKembalikan }) {
  const indent = { paddingLeft: `${(b.level - 1) * 1.25 + 0.75}rem` };
  const jumlahKolom = 4 + (instrumenProdi ? 1 : 0) + (bolehSPM ? 1 : 0);

  if (b.wajib_petakan !== 1) {
    return (
      <tr className="bg-slate-50/70">
        <td colSpan={jumlahKolom} className="td font-semibold text-slate-700" style={indent}>
          <span className="font-mono text-[11px] text-slate-500">{b.code}</span>{' '}
          {b.title}
        </td>
      </tr>
    );
  }

  const adaOverride = b.skor_manual != null;
  const efektif = b.skor_efektif;
  const adaOverrideCapaian = b.capaian_manual != null;
  const capaianEfektif = b.capaian_efektif;

  return (
    <tr>
      <td className="td" style={indent}>
        <span className="font-mono text-[11px] text-slate-500">{b.code}</span>{' '}
        <span className="text-sm">{b.title}</span>
      </td>
      <td className="td text-center text-xs tabular-nums">{b.bobot ?? '-'}</td>
      {instrumenProdi && (
        <td className="td text-center">
          {capaianEfektif != null ? (
            <span className={`tabular-nums ${adaOverrideCapaian ? 'font-semibold text-amber-700' : ''}`}>
              {capaianEfektif}
            </span>
          ) : (
            <span className="text-xs italic text-slate-400">-</span>
          )}
        </td>
      )}
      <td className="td text-center">
        {efektif != null ? (
          <span className="font-semibold tabular-nums">{efektif}</span>
        ) : (
          <span className="text-xs italic text-slate-400">Belum dinilai</span>
        )}
      </td>
      <td className="td text-xs">
        <div className="flex items-center gap-1.5">
          {adaOverride ? (
            <span className="badge bg-amber-100 text-amber-800">
              Manual — {b.diedit_oleh || 'SPM'}
            </span>
          ) : b.skor_otomatis != null ? (
            <span className="badge bg-emerald-100 text-emerald-800">
              Otomatis · {b.jumlah_penilaian} penilaian
            </span>
          ) : (
            <span className="badge bg-slate-100 text-slate-600">Belum ada audit</span>
          )}
          {b.bukti_url_manual && (
            <a href={tautanBukti(b.bukti_url_manual)} target="_blank" rel="noreferrer"
              title="Lihat berkas data dukung" onClick={(e) => e.stopPropagation()}
              className="text-slate-400 hover:text-pktj-600">
              <Icon.Tautan width={14} height={14} />
            </a>
          )}
        </div>
      </td>
      {bolehSPM && (
        <td className="td">
          <div className="flex gap-1">
            <button onClick={onEdit} title="Koreksi manual"
              className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-pktj-600">
              <Icon.Pena width={14} height={14} />
            </button>
            {adaOverride && (
              <button onClick={onKembalikan} title="Kembalikan ke otomatis"
                className="rounded-md p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600">
                <Icon.Segarkan width={14} height={14} />
              </button>
            )}
          </div>
        </td>
      )}
    </tr>
  );
}
