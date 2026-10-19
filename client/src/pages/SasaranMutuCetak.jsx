import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { Icon, Memuat, Modal, PadTandaTangan } from '../components/ui.jsx';
import logoPTK from '../assets/logo-ptk-form.png';
import { teksCapaian } from '../lib/peringkat.js';

const JENIS_LABEL = { utama: 'Kinerja Utama', tambahan: 'Kinerja Tambahan' };
const PERIODE_EVALUASI_LABEL = {
  bulanan: 'Bulanan', triwulanan: 'Triwulanan', semester: 'Semester',
};
const PERIODE_EVALUASI_URUTAN = ['bulanan', 'triwulanan', 'semester'];
// Label kolom singkat untuk tabel rencana target yang disusun ke samping —
// sasaran dengan jenis periode evaluasi berbeda dipisah ke tabelnya sendiri
// karena jumlah kolomnya beda (12 vs 4 vs 2), lihat LembarRencanaTarget.
const LABEL_KOLOM_RENCANA = {
  bulanan: ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'],
  triwulanan: ['TW I', 'TW II', 'TW III', 'TW IV'],
  semester: ['Smt I', 'Smt II'],
};

/** Ratakan { programKerja: [{ ..., sasaran: [...] }] } menjadi daftar sasaran
 *  datar, masing-masing membawa info program kerja induknya — dipakai oleh
 *  ketiga tabel formulir di bawah. */
function ratakanSasaran(programKerja) {
  const baris = [];
  for (const pk of programKerja) {
    for (const s of pk.sasaran) {
      baris.push({ pk, s });
    }
  }
  return baris;
}

/** Formulir cetak Sasaran Mutu: Penetapan, Rencana Target, dan Monitoring
 *  Pencapaian — tiga lembar terpisah (page-break) mengikuti format Excel
 *  "Sasaran Mutu" yang dipakai satuan penjaminan mutu. */
export default function SasaranMutuCetak() {
  const [params] = useSearchParams();
  const unitId = params.get('unit_id') || '';
  const periodId = params.get('period_id') || '';
  const tahun = params.get('tahun') || '';

  const [data, setData] = useState(null);
  const [tanggalCetak, setTanggalCetak] = useState(new Date().toISOString().slice(0, 10));

  useEffect(() => {
    if (!unitId || !periodId) return;
    const q = new URLSearchParams({ unit_id: unitId, period_id: periodId });
    if (tahun) q.set('tahun', tahun);
    api.get(`/sasaran-mutu/laporan/cetak?${q}`).then(setData);
  }, [unitId, periodId, tahun]);

  if (!unitId || !periodId) return <Memuat teks="Parameter unit/periode tidak lengkap" />;
  if (!data) return <Memuat />;

  const baris = ratakanSasaran(data.programKerja);
  const tglIndo = new Date(tanggalCetak).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <>
      <div className="no-print mb-5 flex flex-wrap items-center justify-between gap-3">
        <Link to="/sasaran-mutu" className="btn-outline">
          <Icon.Kembali width={16} height={16} /> Sasaran Mutu
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-xs text-slate-500">Tanggal:</label>
          <input type="date" className="input w-40 py-1 text-xs" value={tanggalCetak}
            onChange={(e) => setTanggalCetak(e.target.value)} />
          <button onClick={() => window.print()} className="btn-primary">
            <Icon.Cetak width={16} height={16} /> Cetak / Simpan PDF
          </button>
        </div>
      </div>

      {data.programKerja.length === 0 ? (
        <p className="card-p text-sm text-slate-500">
          Belum ada program kerja yang ditetapkan untuk unit dan periode ini.
        </p>
      ) : (
        <div className="space-y-8">
          <LembarPenetapan data={data} baris={baris} tglIndo={tglIndo} unitId={unitId} tahun={tahun || data.tahun} />
          <LembarRencanaTarget data={data} baris={baris} tglIndo={tglIndo} unitId={unitId} tahun={tahun || data.tahun} pageBreak />
          <LembarMonitoring data={data} baris={baris} tglIndo={tglIndo} unitId={unitId} tahun={tahun || data.tahun} pageBreak />
        </div>
      )}
    </>
  );
}

function KepalaFormulir({ judul, data }) {
  return (
    <>
      <div className="mb-6 flex items-center justify-between border-2 border-slate-900 px-5 py-3">
        <h1 className="text-lg font-bold uppercase tracking-wide">{judul}</h1>
        <img src={logoPTK} alt="Logo PKTJ" className="h-16 w-16 shrink-0 object-contain" />
      </div>
      <p className="mb-4 text-xs text-slate-600">
        {data.unit?.name}
        {data.tahun && ` · Tahun ${data.tahun}`}
      </p>
    </>
  );
}

/** Tanda tangan pengesahan formulir — satu tanda tangan berlaku untuk
 *  ketiga lembar (Penetapan, Rencana Target, Monitoring Pencapaian) sekaligus
 *  karena disimpan per unit + tahun. Dapat digambar langsung atau diunggah
 *  sebagai berkas gambar (lihat PadTandaTangan), dan hanya dapat
 *  dibubuhkan/diubah oleh Kepala Unit/Bagian pemilik program kerja (atau SPM). */
function TandaTangan({ tglIndo, kode, unitId, tahun }) {
  const { user, bolehSPM } = useAuth();
  const [ttd, setTtd] = useState(undefined); // undefined = memuat, null = belum ada
  const [modalBuka, setModalBuka] = useState(false);
  const [gambar, setGambar] = useState(null);
  const [proses, setProses] = useState(false);
  const [galat, setGalat] = useState('');

  const bolehTtd = !!user && (bolehSPM || (user.role === 'auditee' && String(user.unit_id) === String(unitId)));

  useEffect(() => {
    if (!unitId || !tahun) return;
    api.get(`/sasaran-mutu/tanda-tangan?unit_id=${unitId}&tahun=${tahun}`)
      .then(setTtd)
      .catch(() => setTtd(null));
  }, [unitId, tahun]);

  async function simpan() {
    if (!gambar) { setGalat('Silakan gambar atau unggah tanda tangan terlebih dahulu'); return; }
    setProses(true);
    setGalat('');
    try {
      await api.post('/sasaran-mutu/tanda-tangan', { unit_id: unitId, tahun, image_data: gambar });
      setTtd(await api.get(`/sasaran-mutu/tanda-tangan?unit_id=${unitId}&tahun=${tahun}`));
      setModalBuka(false);
      setGambar(null);
    } catch (e) {
      setGalat(e.message);
    } finally {
      setProses(false);
    }
  }

  async function hapus() {
    if (!confirm('Hapus tanda tangan ini?')) return;
    await api.del(`/sasaran-mutu/tanda-tangan?unit_id=${unitId}&tahun=${tahun}`);
    setTtd(null);
  }

  return (
    <>
      <div className="mt-8 flex justify-end">
        <div className="w-full max-w-xs text-center">
          <p className="print-only mb-10 text-right">Tegal, {tglIndo}</p>
          <p>Ditetapkan oleh:</p>
          <div className="flex h-16 items-center justify-center">
            {ttd?.image_data ? (
              <img src={ttd.image_data} alt="Tanda tangan" className="max-h-16 object-contain" />
            ) : bolehTtd ? (
              <button type="button" onClick={() => setModalBuka(true)} className="no-print btn-outline btn-sm">
                <Icon.Pena width={14} height={14} /> Tanda Tangan
              </button>
            ) : null}
          </div>
          <p className="border-t border-slate-900 pt-1 font-bold">{ttd?.nama || 'Kepala Unit/Bagian'}</p>
          {ttd?.jabatan && <p className="text-[11px] text-slate-500">{ttd.jabatan}</p>}
        </div>
      </div>
      {ttd?.image_data && bolehTtd && (
        <div className="no-print mt-2 flex justify-end gap-3 text-xs">
          <button type="button" onClick={() => setModalBuka(true)} className="text-blue-600 hover:underline">
            Ubah tanda tangan
          </button>
          <button type="button" onClick={hapus} className="text-rose-600 hover:underline">
            Hapus
          </button>
        </div>
      )}
      {kode && <p className="mt-6 text-xs text-slate-500">{kode}</p>}

      <Modal
        open={modalBuka}
        onClose={() => setModalBuka(false)}
        title="Tanda Tangan Pengesahan"
        footer={
          <>
            <button type="button" onClick={() => setModalBuka(false)} className="btn-outline">Batal</button>
            <button type="button" onClick={simpan} disabled={proses} className="btn-primary">
              {proses ? 'Menyimpan…' : 'Simpan'}
            </button>
          </>
        }
      >
        <PadTandaTangan onChange={setGambar} nilaiAwal={ttd?.image_data} />
        {galat && <p className="mt-2 text-xs text-rose-600">{galat}</p>}
      </Modal>
    </>
  );
}

/* ------------------------ 1. Penetapan Sasaran Mutu ---------------------- */
function LembarPenetapan({ data, baris, tglIndo, unitId, tahun }) {
  return (
    <div className="print-area card mx-auto max-w-5xl bg-white p-10 text-[13px] leading-relaxed text-slate-900">
      <KepalaFormulir judul="Penetapan Sasaran Mutu" data={data} />
      <table className="mb-6 w-full border-collapse border border-slate-900 text-[11px]">
        <thead>
          <tr className="bg-slate-100">
            <th className="border border-slate-900 px-2 py-1.5 w-8">No</th>
            <th className="border border-slate-900 px-2 py-1.5 w-28">Jenis</th>
            <th className="border border-slate-900 px-2 py-1.5 w-40">Program Kerja</th>
            <th className="border border-slate-900 px-2 py-1.5 w-16">Tahun</th>
            <th className="border border-slate-900 px-2 py-1.5">Sasaran</th>
            <th className="border border-slate-900 px-2 py-1.5 w-24">Target</th>
            <th className="border border-slate-900 px-2 py-1.5 w-20">Satuan</th>
            <th className="border border-slate-900 px-2 py-1.5 w-24">Periode Evaluasi</th>
          </tr>
        </thead>
        <tbody>
          {baris.map(({ pk, s }, i) => (
            <tr key={s.id}>
              <td className="border border-slate-900 px-2 py-1.5 text-center">{i + 1}</td>
              <td className="border border-slate-900 px-2 py-1.5">{JENIS_LABEL[pk.jenis] || pk.jenis}</td>
              <td className="border border-slate-900 px-2 py-1.5">
                {pk.nama}
                {pk.sub_unit_name && <span className="block text-[10px] text-slate-500">{pk.sub_unit_name}</span>}
              </td>
              <td className="border border-slate-900 px-2 py-1.5 text-center">{pk.tahun}</td>
              <td className="border border-slate-900 px-2 py-1.5">{s.sasaran}</td>
              <td className="border border-slate-900 px-2 py-1.5 text-center">{s.target}</td>
              <td className="border border-slate-900 px-2 py-1.5 text-center">{s.satuan || '-'}</td>
              <td className="border border-slate-900 px-2 py-1.5 text-center">
                {PERIODE_EVALUASI_LABEL[s.periode_evaluasi] || s.periode_evaluasi}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <TandaTangan tglIndo={tglIndo} kode="FRM — Penetapan Sasaran Mutu" unitId={unitId} tahun={tahun} />
    </div>
  );
}

/* --------------------- 2. Rencana Target Sasaran Mutu --------------------- */
function LembarRencanaTarget({ data, baris, tglIndo, unitId, tahun, pageBreak }) {
  // Sub-periode disusun ke SAMPING (kolom), bukan ke bawah — sasaran dengan
  // periode evaluasi berbeda (bulanan/triwulanan/semester) dipisah ke
  // tabelnya sendiri karena jumlah kolomnya berbeda (12 vs 4 vs 2 kolom).
  const kelompok = PERIODE_EVALUASI_URUTAN
    .map((pe) => ({ pe, list: baris.filter(({ s }) => s.periode_evaluasi === pe) }))
    .filter((k) => k.list.length > 0);

  return (
    <div className={`print-area card mx-auto max-w-6xl bg-white p-10 text-[13px] leading-relaxed text-slate-900 ${pageBreak ? 'print-break' : ''}`}>
      <KepalaFormulir judul="Rencana Target Sasaran Mutu" data={data} />
      {kelompok.map(({ pe, list }, idx) => (
        <div key={pe} className={idx > 0 ? 'mt-6' : ''}>
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-600">
            Evaluasi {PERIODE_EVALUASI_LABEL[pe]}
          </p>
          <table className="w-full border-collapse border border-slate-900 text-[9.5px]">
            <thead>
              <tr className="bg-slate-100">
                <th className="border border-slate-900 px-1.5 py-1.5 w-6">No</th>
                <th className="border border-slate-900 px-1.5 py-1.5 w-36">Sasaran</th>
                <th className="border border-slate-900 px-1.5 py-1.5 w-16">Target Akhir</th>
                {LABEL_KOLOM_RENCANA[pe].map((l) => (
                  <th key={l} className="border border-slate-900 px-1 py-1.5">{l}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {list.map(({ pk, s }, i) => (
                <tr key={s.id}>
                  <td className="border border-slate-900 px-1.5 py-1.5 text-center align-top">{i + 1}</td>
                  <td className="border border-slate-900 px-1.5 py-1.5 align-top">
                    <p className="font-medium">{s.sasaran}</p>
                    <p className="text-[9px] text-slate-500">
                      {pk.nama}{pk.sub_unit_name ? ` · ${pk.sub_unit_name}` : ''} · {pk.tahun}
                    </p>
                  </td>
                  <td className="border border-slate-900 px-1.5 py-1.5 text-center align-top">
                    {s.target}{s.satuan ? ` ${s.satuan}` : ''}
                  </td>
                  {s.rencana.map((r) => (
                    <td key={r.periode_ke} className="border border-slate-900 px-1 py-1.5 text-center align-top">
                      {r.target_periode || '-'}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
      <TandaTangan tglIndo={tglIndo} kode="FRM — Rencana Target Sasaran Mutu" unitId={unitId} tahun={tahun} />
    </div>
  );
}

/* ------------------- 3. Monitoring Pencapaian Sasaran Mutu --------------- */
function LembarMonitoring({ data, baris, tglIndo, unitId, tahun, pageBreak }) {
  return (
    <div className={`print-area card mx-auto max-w-6xl bg-white p-10 text-[13px] leading-relaxed text-slate-900 ${pageBreak ? 'print-break' : ''}`}>
      <KepalaFormulir judul="Monitoring Pencapaian Sasaran Mutu" data={data} />
      <table className="mb-6 w-full border-collapse border border-slate-900 text-[10.5px]">
        <thead>
          <tr className="bg-slate-100">
            <th className="border border-slate-900 px-2 py-1.5 w-8">No</th>
            <th className="border border-slate-900 px-2 py-1.5 w-40">Sasaran</th>
            <th className="border border-slate-900 px-2 py-1.5 w-24">Sub-periode</th>
            <th className="border border-slate-900 px-2 py-1.5 w-20">Rencana</th>
            <th className="border border-slate-900 px-2 py-1.5 w-16">Capaian</th>
            <th className="border border-slate-900 px-2 py-1.5 w-20">Status</th>
            <th className="border border-slate-900 px-2 py-1.5">Evaluasi Ketercapaian (Kendala / Faktor Pendukung)</th>
          </tr>
        </thead>
        <tbody>
          {baris.map(({ pk, s }, i) => s.rencana.map((r, j) => (
            <tr key={`${s.id}-${r.periode_ke}`}>
              {j === 0 && (
                <>
                  <td className="border border-slate-900 px-2 py-1.5 text-center align-top" rowSpan={s.rencana.length}>{i + 1}</td>
                  <td className="border border-slate-900 px-2 py-1.5 align-top" rowSpan={s.rencana.length}>
                    <p className="font-medium">{s.sasaran}</p>
                    <p className="text-[10px] text-slate-500">{pk.nama}{pk.sub_unit_name ? ` · ${pk.sub_unit_name}` : ''} · {pk.tahun}</p>
                  </td>
                </>
              )}
              <td className="border border-slate-900 px-2 py-1.5">{r.label}</td>
              <td className="border border-slate-900 px-2 py-1.5">{r.target_periode || '-'}</td>
              <td className="border border-slate-900 px-2 py-1.5 text-center">{teksCapaian(s, r) ?? '-'}</td>
              <td className="border border-slate-900 px-2 py-1.5 text-center">
                {r.status === 'diserahkan' ? 'Diserahkan' : r.status === 'draft' ? 'Draft' : 'Belum Diisi'}
              </td>
              <td className="border border-slate-900 px-2 py-1.5">
                {r.kendala && <p className="text-rose-700"><span className="font-medium">Kendala:</span> {r.kendala}</p>}
                {r.faktor_pendukung && <p className="text-emerald-700"><span className="font-medium">Faktor pendukung:</span> {r.faktor_pendukung}</p>}
                {!r.kendala && !r.faktor_pendukung && '-'}
              </td>
            </tr>
          )))}
        </tbody>
      </table>
      <TandaTangan tglIndo={tglIndo} kode="FRM — Monitoring Pencapaian Sasaran Mutu" unitId={unitId} tahun={tahun} />
    </div>
  );
}
