import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import {
  Badge, Icon, JudulHalaman, Kosong, Memuat, Modal, Progres, useToast,
} from '../components/ui.jsx';
import { SKALA_PERINGKAT, adalahPeringkat, levelPeringkat } from '../lib/peringkat.js';

const PERIODE_EVALUASI_LABEL = {
  bulanan: 'Bulanan (12 sub-periode)',
  triwulanan: 'Triwulanan (4 sub-periode)',
  semester: 'Semester (2 sub-periode)',
};

const JENIS_LABEL = { utama: 'Kinerja Utama', tambahan: 'Kinerja Tambahan' };
const JENIS_URUTAN = ['utama', 'tambahan'];

const SASARAN_KOSONG = () => ({
  sasaran: '', target: '', satuan: '', periode_evaluasi: 'bulanan', tipe_nilai: 'angka', skala_peringkat: '',
});

/** Pilihan tipe nilai + skala untuk satu sasaran: Angka, atau Peringkat
 *  (huruf/predikat) dengan skala A/B/C, Unggul/Baik Sekali/Baik, WTP/WDP. */
function PilihTipeNilai({ s, onUbah }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <select className="select" value={s.tipe_nilai || 'angka'}
        onChange={(e) => onUbah({ tipe_nilai: e.target.value, skala_peringkat: '', target: '', satuan: e.target.value === 'peringkat' ? '' : s.satuan })}>
        <option value="angka">Tipe nilai: Angka</option>
        <option value="peringkat">Tipe nilai: Peringkat (huruf/predikat)</option>
      </select>
      {s.tipe_nilai === 'peringkat' && (
        <select className="select" value={s.skala_peringkat || ''}
          onChange={(e) => onUbah({ skala_peringkat: e.target.value, target: '' })}>
          <option value="">— Pilih skala —</option>
          {Object.entries(SKALA_PERINGKAT).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      )}
    </div>
  );
}

// Sasaran mutu hanya boleh disusun untuk tahun berjalan atau tahun
// sebelumnya — keduanya boleh aktif bersamaan, terlepas dari siklus SPMI.
const TAHUN_INI = new Date().getFullYear();
const TAHUN_PILIHAN = [TAHUN_INI, TAHUN_INI - 1];

export default function SasaranMutu() {
  const { user, periode, bolehSPM } = useAuth();
  const { tampil, Toast } = useToast();

  const [units, setUnits] = useState([]);
  const [unitId, setUnitId] = useState(user.unit_id || '');
  const [tahun, setTahun] = useState(TAHUN_INI);
  const [daftar, setDaftar] = useState(null);
  const [mBaruBuka, setMBaruBuka] = useState(false);
  const [mDuplikasiBuka, setMDuplikasiBuka] = useState(false);
  const [aktif, setAktif] = useState(null); // program kerja yang sedang dikelola

  const bolehPilihUnit = ['spm', 'admin', 'auditor', 'pimpinan'].includes(user.role);
  const bolehKelola = (pk) =>
    bolehSPM || (user.role === 'auditee' && Number(user.unit_id) === Number(pk?.unit_id ?? unitId));

  // Sub-unit kerja yang terdaftar di bawah unit terpilih (mis. Akademik,
  // Ketarunaan, Pokja Diklat di bawah BAAK) — dikelola lewat Data Master.
  // Kosong bila unit ini tidak punya sub-unit (paling umum), sehingga
  // pilihan sub-unit di form pembuatan hanya muncul bila relevan.
  const subUnitUnit = units.filter((u) => u.type === 'sub_unit' && String(u.parent_id) === String(unitId));

  useEffect(() => { api.get('/master/units').then(setUnits); }, []);

  async function muat({ diam = false } = {}) {
    if (!periode || !unitId) return;
    if (!diam) setDaftar(null);
    const r = await api.get(`/sasaran-mutu?unit_id=${unitId}&period_id=${periode.id}&tahun=${tahun}`);
    setDaftar(r);
  }
  useEffect(() => { muat(); }, [unitId, tahun, periode?.id]);

  async function muatDiam() {
    const posisi = window.scrollY;
    await muat({ diam: true });
    requestAnimationFrame(() => window.scrollTo(0, posisi));
  }

  async function hapus(pk) {
    if (!confirm(`Hapus program kerja "${pk.nama}" beserta seluruh sasaran di dalamnya? Tindakan ini tidak dapat dibatalkan.`)) return;
    try {
      await api.del(`/sasaran-mutu/${pk.id}`);
      tampil('Program kerja dihapus');
      setAktif(null);
      muatDiam();
    } catch (e) { tampil(e.message, 'galat'); }
  }

  async function tetapkan(pk) {
    try {
      await api.post(`/sasaran-mutu/${pk.id}/tetapkan`);
      tampil('Program kerja ditetapkan');
      muatDiam();
    } catch (e) { tampil(e.message, 'galat'); }
  }

  async function batalTetapkan(pk) {
    if (!confirm('Batalkan penetapan program kerja ini agar bisa diubah lagi?')) return;
    try {
      await api.post(`/sasaran-mutu/${pk.id}/batal-tetapkan`);
      tampil('Penetapan dibatalkan');
      muatDiam();
    } catch (e) { tampil(e.message, 'galat'); }
  }

  const kelompok = JENIS_URUTAN.map((j) => ({
    jenis: j,
    daftar: (daftar || []).filter((pk) => pk.jenis === j),
  })).filter((k) => k.daftar.length > 0);

  const tautanCetak = unitId && periode
    ? `/sasaran-mutu/cetak?unit_id=${unitId}&period_id=${periode.id}&tahun=${tahun}` : null;

  if (!daftar) return (
    <>
      <JudulHalaman
        ikon={<Icon.Radar width={20} height={20} />}
        judul="Sasaran Mutu"
        deskripsi="Program kerja, sasaran, dan target setiap unit/bagian — dipantau capaiannya berkala di Modul Pelaksanaan"
      />
      {!unitId ? (
        <Kosong judul="Pilih unit terlebih dahulu" pesan="Pilih unit organisasi untuk menampilkan sasaran mutunya." />
      ) : <Memuat />}
    </>
  );

  return (
    <>
      <Toast />
      <JudulHalaman
        ikon={<Icon.Radar width={20} height={20} />}
        judul="Sasaran Mutu"
        deskripsi="Program kerja, sasaran, dan target setiap unit/bagian — dipantau capaiannya berkala di Modul Pelaksanaan"
        aksi={
          <>
            {bolehPilihUnit && (
              <select className="select w-auto" value={unitId} onChange={(e) => setUnitId(e.target.value)}>
                <option value="">Pilih unit…</option>
                {units.filter((u) => u.type !== 'sub_unit').map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            )}
            <select className="select w-auto" value={tahun} onChange={(e) => setTahun(Number(e.target.value))}>
              {TAHUN_PILIHAN.map((t) => <option key={t} value={t}>Tahun {t}</option>)}
            </select>
            {tautanCetak && daftar.length > 0 && (
              <Link to={tautanCetak} className="btn-outline">
                <Icon.Cetak width={16} height={16} /> Cetak Formulir
              </Link>
            )}
            {unitId && (user.role === 'auditee' || bolehSPM) && (
              <button onClick={() => setMDuplikasiBuka(true)} className="btn-outline">
                <Icon.Segarkan width={16} height={16} /> Duplikasi dari Tahun Sebelumnya
              </button>
            )}
            {unitId && (user.role === 'auditee' || bolehSPM) && (
              <button onClick={() => setMBaruBuka(true)} className="btn-primary">
                <Icon.Plus width={16} height={16} /> Program Kerja Baru
              </button>
            )}
          </>
        }
      />

      {!unitId ? (
        <Kosong judul="Pilih unit terlebih dahulu" pesan="Pilih unit organisasi untuk menampilkan sasaran mutunya." />
      ) : daftar.length === 0 ? (
        <Kosong judul="Belum ada program kerja"
          pesan="Unit ini belum menyusun program kerja & sasaran mutu untuk periode aktif." />
      ) : (
        <div className="space-y-6">
          {kelompok.map(({ jenis, daftar: list }) => (
            <div key={jenis} className="card overflow-hidden">
              <div className="border-b border-slate-200 bg-slate-50 px-5 py-3">
                <h2 className="text-sm font-semibold">{JENIS_LABEL[jenis]}</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr>
                      <th className="th">Program Kerja</th>
                      <th className="th w-32">Status</th>
                      <th className="th w-48">Capaian Dilaporkan</th>
                      <th className="th w-40">Unit</th>
                      <th className="th w-52"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((pk) => {
                      const totalTerisi = pk.sasaran.reduce((a, s) => a + s.terisi, 0);
                      const totalPeriode = pk.sasaran.reduce((a, s) => a + s.total_periode, 0);
                      const persen = totalPeriode ? Math.round((totalTerisi / totalPeriode) * 100) : 0;
                      const adaPenilaian = pk.sasaran.some((s) => s.penilaian);
                      const bolehHapus = bolehKelola(pk) && pk.status === 'draft';
                      return (
                        <tr key={pk.id}>
                          <td className="td">
                            <p className="text-sm font-medium">{pk.nama}</p>
                            <p className="mt-0.5 text-xs text-slate-500">
                              {pk.sasaran.length} sasaran
                              {pk.sub_unit_name && ` · ${pk.sub_unit_name}`}
                              {` · Tahun ${pk.tahun}`}
                            </p>
                            {adaPenilaian && (
                              <span className="badge mt-1.5 bg-violet-50 text-violet-700">
                                Sudah dinilai auditor
                              </span>
                            )}
                          </td>
                          <td className="td"><Badge status={pk.status} /></td>
                          <td className="td">
                            {pk.status === 'ditetapkan' ? (
                              <div>
                                <div className="mb-1 flex justify-between text-[11px] text-slate-500">
                                  <span className="tabular-nums">{totalTerisi}/{totalPeriode}</span>
                                  <span className="font-semibold tabular-nums text-slate-700">{persen}%</span>
                                </div>
                                <Progres nilai={persen} />
                              </div>
                            ) : (
                              <span className="text-xs text-slate-400">-</span>
                            )}
                          </td>
                          <td className="td text-xs text-slate-500">{pk.unit_name}</td>
                          <td className="td">
                            <div className="flex items-center justify-end gap-1.5">
                              {bolehKelola(pk) && pk.status === 'draft' && (
                                <button onClick={() => tetapkan(pk)} className="btn-success btn-sm">Tetapkan</button>
                              )}
                              <button onClick={() => setAktif(pk)} className="btn-outline btn-sm">
                                {bolehKelola(pk) ? 'Kelola' : 'Lihat'}
                              </button>
                              {bolehHapus && (
                                <button onClick={() => hapus(pk)}
                                  className="rounded-md p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                                  title="Hapus">
                                  <Icon.Hapus width={14} height={14} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      <ModalBaru
        open={mBaruBuka}
        onClose={() => setMBaruBuka(false)}
        unitId={unitId}
        periodeId={periode?.id}
        subUnitPilihan={subUnitUnit}
        tahunAwal={tahun}
        tampil={tampil}
        onSelesai={() => { tampil('Program kerja berhasil dibuat'); muatDiam(); }}
      />

      <ModalDuplikasi
        open={mDuplikasiBuka}
        onClose={() => setMDuplikasiBuka(false)}
        unitId={unitId}
        periodeId={periode?.id}
        targetTahun={tahun}
        tampil={tampil}
        onSelesai={muatDiam}
      />

      <ModalKelola
        programKerja={aktif}
        bolehEdit={bolehKelola(aktif)}
        tampil={tampil}
        onClose={() => setAktif(null)}
        onHapus={hapus}
        onTetapkan={tetapkan}
        onBatalTetapkan={batalTetapkan}
        onUbah={() => { muatDiam(); }}
      />
    </>
  );
}

function ModalBaru({ open, onClose, unitId, periodeId, subUnitPilihan, tahunAwal, tampil, onSelesai }) {
  const [nama, setNama] = useState('');
  const [jenis, setJenis] = useState('utama');
  const [subUnitId, setSubUnitId] = useState('');
  const [tahun, setTahun] = useState(TAHUN_INI);
  const [sasaran, setSasaran] = useState([SASARAN_KOSONG()]);
  const [simpan, setSimpan] = useState(false);

  useEffect(() => {
    if (open) {
      setNama(''); setJenis('utama'); setSubUnitId(''); setTahun(tahunAwal || TAHUN_INI);
      setSasaran([SASARAN_KOSONG()]);
    }
  }, [open, tahunAwal]);

  function ubahSasaran(idx, patch) {
    setSasaran((list) => list.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  }
  function tambahSasaran() { setSasaran((list) => [...list, SASARAN_KOSONG()]); }
  function hapusSasaran(idx) { setSasaran((list) => list.filter((_, i) => i !== idx)); }

  async function simpanForm() {
    if (!nama.trim()) return tampil('Nama program kerja wajib diisi', 'galat');
    if (sasaran.length === 0) return tampil('Minimal satu sasaran wajib diisi', 'galat');
    for (const s of sasaran) {
      if (!s.sasaran.trim() || !s.target.trim())
        return tampil('Setiap sasaran wajib memiliki uraian sasaran dan target', 'galat');
      if (s.tipe_nilai === 'peringkat' && !SKALA_PERINGKAT[s.skala_peringkat])
        return tampil('Pilih skala peringkat untuk sasaran bertipe Peringkat', 'galat');
    }
    setSimpan(true);
    try {
      await api.post('/sasaran-mutu', {
        unit_id: Number(unitId), sub_unit_id: subUnitId ? Number(subUnitId) : null,
        period_id: periodeId, tahun, nama, jenis, sasaran,
      });
      onSelesai();
      onClose();
    } catch (e) { tampil(e.message, 'galat'); }
    finally { setSimpan(false); }
  }

  return (
    <Modal
      open={open} onClose={onClose} title="Program Kerja Baru" lebar="max-w-2xl"
      footer={
        <>
          <button onClick={onClose} className="btn-outline">Batal</button>
          <button onClick={simpanForm} className="btn-primary" disabled={simpan}>
            {simpan ? 'Menyimpan…' : 'Simpan'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-[11px] text-slate-400">
          Ingin menyalin program kerja dari tahun sebelumnya? Tutup jendela ini dan gunakan tombol
          "Duplikasi dari Tahun Sebelumnya" di halaman Sasaran Mutu.
        </p>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <label className="label">Program Kerja *</label>
            <input className="input" value={nama} onChange={(e) => setNama(e.target.value)}
              placeholder="mis. Peningkatan Layanan Akademik" />
          </div>
          <div>
            <label className="label">Jenis *</label>
            <select className="select w-full" value={jenis} onChange={(e) => setJenis(e.target.value)}>
              <option value="utama">Kinerja Utama</option>
              <option value="tambahan">Kinerja Tambahan</option>
            </select>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Tahun *</label>
            <select className="select w-full" value={tahun} onChange={(e) => setTahun(Number(e.target.value))}>
              {TAHUN_PILIHAN.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          {subUnitPilihan.length > 0 && (
            <div>
              <label className="label">Sub-Unit Kerja (opsional)</label>
              <select className="select w-full" value={subUnitId} onChange={(e) => setSubUnitId(e.target.value)}>
                <option value="">— Tidak ada —</option>
                {subUnitPilihan.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
          )}
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="label mb-0">Sasaran *</label>
            <button type="button" onClick={tambahSasaran} className="btn-outline btn-sm">
              <Icon.Plus width={14} height={14} /> Tambah Sasaran
            </button>
          </div>
          <div className="space-y-3">
            {sasaran.map((s, idx) => (
              <div key={idx} className="rounded-lg border border-slate-200 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs font-semibold text-slate-500">Sasaran #{idx + 1}</p>
                  {sasaran.length > 1 && (
                    <button type="button" onClick={() => hapusSasaran(idx)}
                      className="text-xs text-rose-600 hover:underline">
                      Hapus
                    </button>
                  )}
                </div>
                <div className="space-y-2">
                  <textarea className="textarea" rows={2} value={s.sasaran}
                    onChange={(e) => ubahSasaran(idx, { sasaran: e.target.value })}
                    placeholder="Uraian sasaran yang ingin dicapai" />
                  <PilihTipeNilai s={s} onUbah={(patch) => ubahSasaran(idx, patch)} />
                  <div className="grid grid-cols-3 gap-2">
                    {s.tipe_nilai === 'peringkat' ? (
                      <select className="select" value={s.target}
                        onChange={(e) => ubahSasaran(idx, { target: e.target.value })}
                        disabled={!s.skala_peringkat}>
                        <option value="">— Target —</option>
                        {levelPeringkat(s).map((l) => <option key={l} value={l}>{l}</option>)}
                      </select>
                    ) : (
                      <input className="input" value={s.target}
                        onChange={(e) => ubahSasaran(idx, { target: e.target.value })}
                        placeholder="Target" />
                    )}
                    <input className="input" value={s.satuan}
                      onChange={(e) => ubahSasaran(idx, { satuan: e.target.value })}
                      placeholder={s.tipe_nilai === 'peringkat' ? 'Satuan (mis. Peringkat)' : 'Satuan'} />
                    <select className="select" value={s.periode_evaluasi}
                      onChange={(e) => ubahSasaran(idx, { periode_evaluasi: e.target.value })}>
                      {Object.entries(PERIODE_EVALUASI_LABEL).map(([k, l]) => (
                        <option key={k} value={k}>{l.split(' (')[0]}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-slate-400">
            Rencana per sub-periode (mis. tiap bulan) dibuat otomatis kosong — isi rencananya lewat "Kelola" setelah tersimpan.
          </p>
        </div>
      </div>
    </Modal>
  );
}

function ModalKelola({ programKerja, bolehEdit, tampil, onClose, onHapus, onTetapkan, onBatalTetapkan, onUbah }) {
  const [detail, setDetail] = useState(null);
  const [sasaran, setSasaran] = useState([]);
  const [simpan, setSimpan] = useState(false);
  const [sasaranAktif, setSasaranAktif] = useState(0);

  useEffect(() => {
    if (!programKerja) { setDetail(null); return; }
    api.get(`/sasaran-mutu/${programKerja.id}`).then((d) => {
      setDetail(d);
      setSasaran(d.sasaran.map((s) => ({ ...s, rencana: s.rencana.map((r) => ({ ...r })) })));
      setSasaranAktif(0);
    });
  }, [programKerja?.id]);

  function ubahSasaranAktif(patch) {
    setSasaran((list) => list.map((x, i) => (i === sasaranAktif ? { ...x, ...patch } : x)));
  }

  function ubahTargetPeriode(smIdx, periode_ke, nilai) {
    setSasaran((list) => list.map((s, i) => (
      i !== smIdx ? s : { ...s, rencana: s.rencana.map((r) => (r.periode_ke === periode_ke ? { ...r, target_periode: nilai } : r)) }
    )));
  }

  async function simpanRencana() {
    setSimpan(true);
    try {
      await api.put(`/sasaran-mutu/${programKerja.id}`, {
        sasaran: sasaran.map((s) => ({
          id: s.id, sasaran: s.sasaran, target: s.target, satuan: s.satuan,
          periode_evaluasi: s.periode_evaluasi, rencana: s.rencana,
          tipe_nilai: s.tipe_nilai, skala_peringkat: s.skala_peringkat,
        })),
      });
      tampil('Rencana capaian tersimpan');
      onUbah();
    } catch (e) { tampil(e.message, 'galat'); }
    finally { setSimpan(false); }
  }

  if (!programKerja) return null;
  const s = sasaran[sasaranAktif];

  return (
    <Modal
      open={!!programKerja} onClose={onClose} title={programKerja?.nama || ''} lebar="max-w-3xl"
      footer={
        programKerja && (
          <>
            {bolehEdit && programKerja.status === 'draft' && (
              <button onClick={() => onHapus(programKerja)} className="btn-outline mr-auto text-red-600 hover:bg-red-50">
                <Icon.Hapus width={16} height={16} /> Hapus
              </button>
            )}
            <button onClick={onClose} className="btn-outline">Tutup</button>
            {bolehEdit && programKerja.status === 'draft' && (
              <>
                <button onClick={simpanRencana} className="btn-outline" disabled={simpan}>
                  Simpan Rencana
                </button>
                <button onClick={() => { onTetapkan(programKerja); onClose(); }} className="btn-primary">
                  <Icon.Cek width={16} height={16} /> Tetapkan
                </button>
              </>
            )}
            {bolehEdit && programKerja.status === 'ditetapkan' && (
              <button onClick={() => { onBatalTetapkan(programKerja); onClose(); }} className="btn-outline">
                Batalkan Penetapan
              </button>
            )}
          </>
        )
      }
    >
      {!detail ? <Memuat /> : (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-1.5 text-[11px]">
            <span className="badge bg-slate-100 text-slate-600">Tahun {detail.tahun}</span>
            {detail.sub_unit_name && (
              <span className="badge bg-slate-100 text-slate-600">{detail.sub_unit_name}</span>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {sasaran.map((x, i) => (
              <button key={x.id} onClick={() => setSasaranAktif(i)}
                className={`rounded-full px-3 py-1 text-[11px] font-medium transition-colors ${
                  i === sasaranAktif ? 'bg-pktj-700 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}>
                Sasaran {i + 1}
              </button>
            ))}
          </div>

          {s && (
            <>
              <div className="rounded-lg bg-slate-50 p-4 text-xs">
                <p className="mb-1"><span className="text-slate-500">Sasaran: </span>{s.sasaran}</p>
                <p><span className="text-slate-500">Target: </span>{s.target}{s.satuan ? ` ${s.satuan}` : ''}
                  {' · '}{PERIODE_EVALUASI_LABEL[s.periode_evaluasi] || s.periode_evaluasi}
                  {adalahPeringkat(s) && ` · Skala ${SKALA_PERINGKAT[s.skala_peringkat].level.join(' / ')}`}
                </p>
                {bolehEdit && detail.status === 'draft' && (
                  <div className="mt-2 space-y-2 border-t border-slate-200 pt-2">
                    <PilihTipeNilai s={s} onUbah={(patch) => {
                      // ganti tipe/skala: target & rencana lama tidak berlaku lagi
                      ubahSasaranAktif({
                        ...patch,
                        rencana: s.rencana.map((r) => ({ ...r, target_periode: '' })),
                      });
                    }} />
                    {s.tipe_nilai === 'peringkat' && s.skala_peringkat && (
                      <select className="select w-full" value={s.target}
                        onChange={(e) => ubahSasaranAktif({ target: e.target.value })}>
                        <option value="">— Pilih target —</option>
                        {levelPeringkat(s).map((l) => <option key={l} value={l}>{l}</option>)}
                      </select>
                    )}
                    {s.tipe_nilai !== 'peringkat' && (
                      <input className="input" value={s.target} placeholder="Target"
                        onChange={(e) => ubahSasaranAktif({ target: e.target.value })} />
                    )}
                  </div>
                )}
                {s.penilaian && (
                  <p className="mt-2 border-t border-slate-200 pt-2">
                    <span className="text-slate-500">Penilaian auditor: </span>
                    <span className="font-medium">{s.penilaian.capaian_persen != null ? `${s.penilaian.capaian_persen}%` : '-'}</span>
                    {s.penilaian.verdict && ` · ${s.penilaian.verdict}`}
                  </p>
                )}
              </div>

              <div>
                <h4 className="mb-2 text-xs font-semibold text-slate-600">
                  Rencana &amp; Capaian per Sub-periode
                </h4>
                <div className="overflow-x-auto rounded-lg border border-slate-200">
                  <table className="w-full text-xs">
                    <thead>
                      <tr>
                        <th className="th">Sub-periode</th>
                        <th className="th">Rencana Capaian</th>
                        <th className="th">Realisasi</th>
                        <th className="th w-24">Capaian</th>
                        <th className="th">Kendala / Faktor Pendukung</th>
                        <th className="th w-28">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {s.rencana.map((r) => (
                        <tr key={r.periode_ke}>
                          <td className="td font-medium">{r.label}</td>
                          <td className="td">
                            {bolehEdit && detail.status === 'draft' ? (
                              adalahPeringkat(s) ? (
                                <select className="select" value={r.target_periode || ''}
                                  onChange={(e) => ubahTargetPeriode(sasaranAktif, r.periode_ke, e.target.value)}>
                                  <option value="">—</option>
                                  {levelPeringkat(s).map((l) => <option key={l} value={l}>{l}</option>)}
                                </select>
                              ) : (
                                <input className="input" value={r.target_periode || ''}
                                  onChange={(e) => ubahTargetPeriode(sasaranAktif, r.periode_ke, e.target.value)}
                                  placeholder="rencana capaian" />
                              )
                            ) : (r.target_periode || '-')}
                          </td>
                          <td className="td max-w-[10rem]">
                            {r.realisasi
                              ? <span className="line-clamp-2 text-slate-600">{r.realisasi}</span>
                              : <span className="text-slate-400">Belum diisi</span>}
                          </td>
                          <td className="td tabular-nums">
                            {adalahPeringkat(s)
                              ? (r.capaian_teks
                                  ? <>{r.capaian_teks}{r.capaian_persen != null && <span className="text-slate-400"> ({r.capaian_persen}%)</span>}</>
                                  : '-')
                              : (r.capaian_nilai ?? '-')}
                          </td>
                          <td className="td max-w-[12rem]">
                            {r.kendala && <p className="text-rose-600"><span className="font-medium">Kendala:</span> {r.kendala}</p>}
                            {r.faktor_pendukung && <p className="text-emerald-600"><span className="font-medium">Faktor pendukung:</span> {r.faktor_pendukung}</p>}
                            {!r.kendala && !r.faktor_pendukung && <span className="text-slate-400">-</span>}
                          </td>
                          <td className="td">
                            <Badge status={r.status || 'draft'}>
                              {r.status ? undefined : 'Belum Diisi'}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="mt-2 text-[11px] text-slate-400">
                  Realisasi dan capaian diisi berkala oleh unit di halaman Pelaksanaan Standar, bukan di sini.
                </p>
              </div>
            </>
          )}
        </div>
      )}
    </Modal>
  );
}

/** Duplikasi program kerja + sasaran dari tahun lain ke tahun yang sedang
 *  dipilih di halaman ini. Hanya struktur (nama, jenis, sub-unit, sasaran
 *  beserta target/satuan/periode evaluasi) yang disalin — rencana per
 *  sub-periode dibuat baru kosong dan capaian tidak ikut disalin, jadi
 *  unit tetap perlu menyusun ulang rencana & capaian untuk tahun ini. */
function ModalDuplikasi({ open, onClose, unitId, periodeId, targetTahun, tampil, onSelesai }) {
  const [tahunTersedia, setTahunTersedia] = useState([]);
  const [sourceTahun, setSourceTahun] = useState('');
  const [daftarSumber, setDaftarSumber] = useState(null);
  const [dipilih, setDipilih] = useState(new Set());
  const [proses, setProses] = useState(false);

  useEffect(() => {
    if (!open || !unitId) return;
    setSourceTahun(''); setDaftarSumber(null); setDipilih(new Set());
    api.get(`/sasaran-mutu/laporan/tahun-tersedia?unit_id=${unitId}`)
      .then((rows) => setTahunTersedia(rows.filter((t) => t !== targetTahun)))
      .catch(() => setTahunTersedia([]));
  }, [open, unitId, targetTahun]);

  useEffect(() => {
    if (!sourceTahun) { setDaftarSumber(null); setDipilih(new Set()); return; }
    api.get(`/sasaran-mutu?unit_id=${unitId}&period_id=${periodeId}&tahun=${sourceTahun}`)
      .then((rows) => { setDaftarSumber(rows); setDipilih(new Set(rows.map((pk) => pk.id))); })
      .catch(() => setDaftarSumber([]));
  }, [sourceTahun, unitId, periodeId]);

  function toggle(id) {
    setDipilih((s) => {
      const baru = new Set(s);
      if (baru.has(id)) baru.delete(id); else baru.add(id);
      return baru;
    });
  }

  async function duplikasi() {
    if (!dipilih.size) return tampil('Pilih minimal satu program kerja', 'galat');
    setProses(true);
    try {
      const r = await api.post('/sasaran-mutu/duplikasi', {
        unit_id: Number(unitId), source_tahun: Number(sourceTahun), target_tahun: targetTahun,
        period_id: periodeId, program_kerja_ids: [...dipilih],
      });
      tampil(
        `${r.diduplikasi.length} program kerja diduplikasi ke tahun ${targetTahun}` +
        (r.dilewati.length ? `, ${r.dilewati.length} dilewati (sudah ada)` : '')
      );
      onSelesai();
      onClose();
    } catch (e) { tampil(e.message, 'galat'); }
    finally { setProses(false); }
  }

  return (
    <Modal
      open={open} onClose={onClose} title="Duplikasi dari Tahun Sebelumnya" lebar="max-w-xl"
      footer={
        <>
          <button onClick={onClose} className="btn-outline">Batal</button>
          <button onClick={duplikasi} className="btn-primary" disabled={proses || !dipilih.size}>
            {proses ? 'Menduplikasi…' : `Duplikasi ${dipilih.size || ''} ke Tahun ${targetTahun}`}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="label">Tahun Sumber *</label>
          <select className="select w-full" value={sourceTahun} onChange={(e) => setSourceTahun(e.target.value)}>
            <option value="">Pilih tahun sumber…</option>
            {tahunTersedia.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          {tahunTersedia.length === 0 && (
            <p className="mt-1 text-[11px] text-slate-400">
              Unit ini belum punya program kerja di tahun lain yang bisa diduplikasi.
            </p>
          )}
        </div>

        {daftarSumber && (
          daftarSumber.length === 0 ? (
            <p className="text-xs text-slate-500">Tidak ada program kerja pada tahun {sourceTahun}.</p>
          ) : (
            <div className="space-y-2">
              <p className="label mb-0">Pilih Program Kerja *</p>
              <div className="max-h-64 space-y-1.5 overflow-y-auto rounded-lg border border-slate-200 p-2">
                {daftarSumber.map((pk) => (
                  <label key={pk.id} className="flex items-start gap-2 rounded-lg p-2 text-sm hover:bg-slate-50">
                    <input type="checkbox" className="mt-1" checked={dipilih.has(pk.id)}
                      onChange={() => toggle(pk.id)} />
                    <span>
                      <span className="font-medium">{pk.nama}</span>
                      <span className="ml-1 text-xs text-slate-500">
                        ({JENIS_LABEL[pk.jenis]}{pk.sub_unit_name ? ` · ${pk.sub_unit_name}` : ''}) — {pk.sasaran.length} sasaran
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )
        )}

        <p className="rounded-lg bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
          Yang disalin hanya nama program kerja, jenis, sub-unit, dan daftar sasaran (uraian, target,
          satuan, periode evaluasi). Rencana per sub-periode dan capaian TIDAK ikut disalin — selalu
          disusun baru untuk tahun {targetTahun}. Hasil duplikasi selalu berstatus draft.
        </p>
      </div>
    </Modal>
  );
}
