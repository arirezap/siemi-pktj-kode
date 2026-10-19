import { useEffect, useMemo, useState } from 'react';
import { api, tanggalWaktuID, tautanBukti } from '../api.js';
import { useAuth } from '../auth.jsx';
import {
  Badge, Icon, JudulHalaman, Kosong, Memuat, Modal, Progres, useToast,
} from '../components/ui.jsx';
import { adalahPeringkat, levelPeringkat, teksCapaian } from '../lib/peringkat.js';

const JENIS_LABEL = { utama: 'Kinerja Utama', tambahan: 'Kinerja Tambahan' };

// Sama seperti halaman Sasaran Mutu: program kerja hanya boleh disusun
// untuk tahun berjalan atau tahun sebelumnya, keduanya bisa aktif
// bersamaan — di sini unit memilih salah satu untuk difokuskan diisi.
const TAHUN_INI = new Date().getFullYear();
const TAHUN_PILIHAN_SM = [TAHUN_INI, TAHUN_INI - 1];

export default function Pelaksanaan() {
  const { user, periode, bolehSPM } = useAuth();
  const { tampil, Toast } = useToast();

  const [tab, setTab] = useState('sasaran_mutu');
  const [units, setUnits] = useState([]);
  const [unitId, setUnitId] = useState(user.unit_id || '');
  const [lembar, setLembar] = useState(null);
  const [rekap, setRekap] = useState([]);
  const [aktif, setAktif] = useState(null);
  const [form, setForm] = useState({});
  const [simpan, setSimpan] = useState(false);
  const [cari, setCari] = useState('');
  const [acuanFilter, setAcuanFilter] = useState('');

  const [sasaranMutu, setSasaranMutu] = useState([]); // daftar program_kerja (+ sasaran + rencana di dalamnya)
  const [tahunSM, setTahunSM] = useState(TAHUN_INI); // tahun program kerja yang sedang difokuskan
  const [aktifPkId, setAktifPkId] = useState(null); // id program kerja yang kartunya sedang dibuka (modal Kelola Capaian)
  const [sasaranAktifPK, setSasaranAktifPK] = useState(0); // indeks tab sasaran aktif dalam modal itu
  const [aktifSM, setAktifSM] = useState(null); // {sasaranMutuId, program_kerja, jenis, sasaran, periode_ke, label, ...capaian}
  const [formSM, setFormSM] = useState({});
  const [simpanSM, setSimpanSM] = useState(false);

  // Diturunkan dari sasaranMutu (bukan disimpan tersendiri) supaya modal
  // "Kelola Capaian" otomatis melihat data terbaru begitu muatSasaranMutuDiam()
  // memuat ulang setelah isian disimpan, tanpa perlu fetch ulang manual.
  const aktifPK = sasaranMutu.find((pk) => pk.id === aktifPkId) || null;

  const bolehPilihUnit = ['spm', 'admin', 'auditor', 'pimpinan'].includes(user.role);

  useEffect(() => {
    api.get('/master/units').then(setUnits);
  }, []);

  // diam=true dipakai saat memuat ulang setelah simpan/hapus isian — supaya
  // tabel yang sedang ditampilkan tidak dikosongkan dulu (yang akan memicu
  // tampilan <Memuat/> sesaat, mengempiskan tinggi halaman, dan membuat
  // posisi gulir melompat ke atas). Isian lama tetap tampil sampai data baru
  // datang, lalu ditukar langsung tanpa ada jeda kosong.
  async function muat({ diam = false } = {}) {
    if (!periode || !unitId) return;
    if (!diam) setLembar(null);
    const r = await api.get(
      `/pelaksanaan/lembar-kerja?unit_id=${unitId}&period_id=${periode.id}`
    );
    setLembar(r);
  }

  useEffect(() => { muat(); }, [unitId, periode?.id]);

  // Muat ulang lembar kerja tanpa mengosongkan tampilan dan tanpa memindahkan
  // posisi gulir — dipakai setelah menyimpan/menghapus/menyerahkan isian,
  // supaya pengguna tetap berada di baris yang baru saja dikerjakan alih-alih
  // terlempar ke atas halaman.
  async function muatDiam() {
    const posisi = window.scrollY;
    await muat({ diam: true });
    requestAnimationFrame(() => window.scrollTo(0, posisi));
  }

  // Rekap "Progres Pengisian Seluruh Unit" dipisah dari lembar kerja unit
  // yang sedang dibuka, jadi tidak ikut ter-refresh oleh muatDiam() — harus
  // dimuat ulang sendiri tiap kali ada isian yang disimpan/dihapus/diserahkan,
  // supaya kartu progres per unit tidak menampilkan angka basi sampai halaman
  // di-refresh manual.
  async function muatRekap() {
    if (bolehPilihUnit && periode)
      setRekap(await api.get(`/pelaksanaan/rekap?period_id=${periode.id}`));
  }
  useEffect(() => { muatRekap(); }, [periode?.id, bolehPilihUnit]);

  async function muatSasaranMutu() {
    if (!periode || !unitId) return;
    const r = await api.get(`/sasaran-mutu?unit_id=${unitId}&period_id=${periode.id}&tahun=${tahunSM}`);
    setSasaranMutu(r);
  }
  useEffect(() => { muatSasaranMutu(); }, [unitId, tahunSM, periode?.id]);

  async function muatSasaranMutuDiam() {
    const posisi = window.scrollY;
    await muatSasaranMutu();
    requestAnimationFrame(() => window.scrollTo(0, posisi));
  }

  const items = lembar?.items || [];

  // Daftar acuan mutu yang muncul pada indikator unit ini — dipakai untuk
  // mengisi pilihan filter (indikator tanpa acuan/manual dikelompokkan
  // sebagai "Manual (tanpa acuan)").
  const daftarAcuan = useMemo(() => {
    const peta = new Map();
    for (const i of items) {
      const kode = i.acuan_kode || '__manual__';
      if (!peta.has(kode)) peta.set(kode, { kode, nama: i.acuan_kode ? i.acuan_nama : 'Manual (tanpa acuan)' });
    }
    return [...peta.values()].sort((a, b) => a.nama.localeCompare(b.nama, 'id'));
  }, [items]);

  const tersaring = useMemo(() => {
    const q = cari.toLowerCase();
    return items.filter(
      (i) =>
        (!q ||
          i.indicator.toLowerCase().includes(q) ||
          i.standar_judul.toLowerCase().includes(q) ||
          i.standar_kode.toLowerCase().includes(q)) &&
        (!acuanFilter ||
          (acuanFilter === '__manual__' ? !i.acuan_kode : i.acuan_kode === acuanFilter))
    );
  }, [items, cari, acuanFilter]);

  const terisi = items.filter((i) => ['diserahkan', 'dinilai'].includes(i.status)).length;
  const persen = items.length ? Math.round((terisi / items.length) * 100) : 0;

  function bukaForm(it) {
    setAktif(it);
    setForm({
      realisasi: it.realisasi || '',
      capaian_nilai: it.capaian_nilai ?? '',
      skor: it.skor ?? '',
      bukti_uraian: it.bukti_uraian || '',
      bukti_url: it.bukti_url || '',
      kendala: it.kendala || '',
    });
  }

  async function simpanIsian(statusBaru) {
    if (!form.realisasi?.trim())
      return tampil('Uraian realisasi pelaksanaan wajib diisi', 'galat');
    setSimpan(true);
    try {
      await api.post('/pelaksanaan', {
        period_id: periode.id,
        standard_id: aktif.standard_id,
        indicator_id: aktif.indicator_id,
        unit_id: Number(aktif.untuk_unit_id || unitId),
        ...form,
        bukti_url: tautanBukti(form.bukti_url),
        capaian_nilai: form.capaian_nilai === '' ? null : Number(form.capaian_nilai),
        skor: form.skor === '' ? null : Number(form.skor),
        status: statusBaru,
      });
      tampil(statusBaru === 'diserahkan' ? 'Isian diserahkan untuk diaudit' : 'Draf tersimpan');
      setAktif(null);
      muatDiam();
      muatRekap();
    } catch (e) { tampil(e.message, 'galat'); }
    finally { setSimpan(false); }
  }

  async function hapusIsian() {
    if (!aktif?.implementation_id) return;
    if (!confirm('Hapus isian pelaksanaan indikator ini? Tindakan ini tidak dapat dibatalkan.'))
      return;
    setSimpan(true);
    try {
      await api.del(`/pelaksanaan/${aktif.implementation_id}`);
      tampil('Isian dihapus');
      setAktif(null);
      muatDiam();
      muatRekap();
    } catch (e) { tampil(e.message, 'galat'); }
    finally { setSimpan(false); }
  }

  async function unggah(file) {
    if (!file) return;
    const data = await new Promise((res) => {
      const r = new FileReader();
      r.onload = () => res(r.result);
      r.readAsDataURL(file);
    });
    try {
      const r = await api.post('/pelaksanaan/unggah-bukti', { filename: file.name, data });
      setForm((p) => ({ ...p, bukti_url: r.url }));
      tampil('Berkas bukti terunggah');
    } catch (e) { tampil(e.message, 'galat'); }
  }

  function bukaFormSM(pk, sm, r) {
    setAktifSM({
      ...r, sasaranMutuId: sm.id, program_kerja: pk.nama, jenis: pk.jenis,
      sasaran: sm.sasaran, target: sm.target, satuan: sm.satuan,
      tipe_nilai: sm.tipe_nilai, skala_peringkat: sm.skala_peringkat,
    });
    setFormSM({
      realisasi: r.realisasi || '',
      capaian_nilai: r.capaian_nilai ?? '',
      capaian_teks: r.capaian_teks || '',
      bukti_uraian: r.bukti_uraian || '',
      bukti_url: r.bukti_url || '',
      kendala: r.kendala || '',
      faktor_pendukung: r.faktor_pendukung || '',
    });
  }

  async function simpanCapaianSM(statusBaru) {
    if (!formSM.realisasi?.trim())
      return tampil('Uraian realisasi wajib diisi', 'galat');
    setSimpanSM(true);
    try {
      await api.post(`/sasaran-mutu/sasaran/${aktifSM.sasaranMutuId}/capaian`, {
        periode_ke: aktifSM.periode_ke,
        ...formSM,
        bukti_url: tautanBukti(formSM.bukti_url),
        capaian_nilai: adalahPeringkat(aktifSM) || formSM.capaian_nilai === '' ? null : Number(formSM.capaian_nilai),
        capaian_teks: adalahPeringkat(aktifSM) ? (formSM.capaian_teks || null) : null,
        status: statusBaru,
      });
      tampil(statusBaru === 'diserahkan' ? 'Capaian diserahkan' : 'Draf capaian tersimpan');
      setAktifSM(null);
      muatSasaranMutuDiam();
    } catch (e) { tampil(e.message, 'galat'); }
    finally { setSimpanSM(false); }
  }

  async function unggahSM(file) {
    if (!file) return;
    const data = await new Promise((res) => {
      const r = new FileReader();
      r.onload = () => res(r.result);
      r.readAsDataURL(file);
    });
    try {
      const r = await api.post('/pelaksanaan/unggah-bukti', { filename: file.name, data });
      setFormSM((p) => ({ ...p, bukti_url: r.url }));
      tampil('Berkas bukti terunggah');
    } catch (e) { tampil(e.message, 'galat'); }
  }

  async function serahkanSemua() {
    if (!confirm('Serahkan seluruh isian draf pada unit ini untuk diaudit?')) return;
    try {
      const r = await api.post('/pelaksanaan/serahkan', {
        period_id: periode.id, unit_id: Number(unitId),
      });
      tampil(`${r.jumlah} isian berhasil diserahkan`);
      muatDiam();
      muatRekap();
    } catch (e) { tampil(e.message, 'galat'); }
  }

  const grup = tersaring.reduce((a, i) => {
    (a[`${i.standar_kode} — ${i.standar_judul}`] ||= []).push(i);
    return a;
  }, {});

  return (
    <>
      <Toast />
      <JudulHalaman
        ikon={<Icon.Pelaksanaan width={20} height={20} />}
        judul="Modul 2 — Pelaksanaan Standar"
        deskripsi="Auditee mengisi realisasi pelaksanaan dan bukti pemenuhan setiap indikator standar yang telah ditetapkan"
        aksi={
          <>
            {bolehPilihUnit && (
              <select className="select w-auto" value={unitId}
                onChange={(e) => setUnitId(e.target.value)}>
                <option value="">Pilih unit…</option>
                {units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            )}
            {tab === 'standar' && (user.role === 'auditee' || bolehSPM) && items.length > 0 && (
              <button onClick={serahkanSemua} className="btn-primary">
                <Icon.Cek width={16} height={16} /> Serahkan Semua Draf
              </button>
            )}
          </>
        }
      />

      {/* Dua tab terpisah: Sasaran Mutu (capaian berkala) dan Pemenuhan
          Standar (isian indikator per acuan) — dulunya digabung satu
          halaman panjang, dipisah supaya masing-masing lebih fokus. */}
      <div className="mb-5 flex flex-wrap gap-2">
        {[
          ['sasaran_mutu', 'Sasaran Mutu'],
          ['standar', 'Pemenuhan Standar'],
        ].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              tab === k ? 'bg-pktj-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-100'
            }`}>
            {l}
          </button>
        ))}
      </div>

      {/* --------------------------- TAB: SASARAN MUTU ------------------------ */}
      {tab === 'sasaran_mutu' && (
      <>
      {/* Sasaran Mutu — capaian berkala per sub-periode (bulanan/triwulanan/
          semester). Ditampilkan sebagai tabel (bukan kartu) supaya program
          kerja, jumlah sasaran, dan progres pelaporan bisa dibandingkan
          sekilas dalam satu pandangan; klik "Kelola" untuk membuka pengisian
          capaian per sub-periode. */}
      {unitId && (
        <div className="mb-6">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="section-title">Capaian Sasaran Mutu</h2>
            <select className="select w-auto" value={tahunSM} onChange={(e) => setTahunSM(Number(e.target.value))}>
              {TAHUN_PILIHAN_SM.map((t) => <option key={t} value={t}>Tahun {t}</option>)}
            </select>
          </div>
          {sasaranMutu.filter((pk) => pk.status === 'ditetapkan').length === 0 ? (
            <p className="rounded-lg border border-dashed border-slate-300 px-4 py-6 text-center text-xs text-slate-400">
              Belum ada program kerja sasaran mutu yang ditetapkan untuk tahun {tahunSM}.
            </p>
          ) : (
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="th">Program Kerja</th>
                    <th className="th w-32">Jenis</th>
                    <th className="th w-24">Sasaran</th>
                    <th className="th w-52">Capaian Dilaporkan</th>
                    <th className="th w-40">Sub-Unit</th>
                    <th className="th w-28"></th>
                  </tr>
                </thead>
                <tbody>
                  {sasaranMutu.filter((pk) => pk.status === 'ditetapkan').map((pk) => {
                    const totalTerisi = pk.sasaran.reduce(
                      (a, sm) => a + sm.rencana.filter((r) => r.status === 'diserahkan').length, 0
                    );
                    const totalPeriode = pk.sasaran.reduce((a, sm) => a + sm.rencana.length, 0);
                    const persen = totalPeriode ? Math.round((totalTerisi / totalPeriode) * 100) : 0;
                    return (
                      <tr key={pk.id} className="hover:bg-slate-50/60">
                        <td className="td">
                          <p className="text-sm font-medium">{pk.nama}</p>
                          <p className="mt-0.5 text-xs text-slate-500">Tahun {pk.tahun}</p>
                        </td>
                        <td className="td">
                          <span className="badge bg-pktj-50 text-pktj-700">{JENIS_LABEL[pk.jenis] || pk.jenis}</span>
                        </td>
                        <td className="td text-xs tabular-nums text-slate-600">{pk.sasaran.length}</td>
                        <td className="td">
                          <div className="mb-1 flex justify-between text-[11px] text-slate-500">
                            <span className="tabular-nums">{totalTerisi}/{totalPeriode}</span>
                            <span className="font-semibold tabular-nums text-slate-700">{persen}%</span>
                          </div>
                          <Progres nilai={persen} />
                        </td>
                        <td className="td text-xs text-slate-500">{pk.sub_unit_name || '-'}</td>
                        <td className="td">
                          <button onClick={() => { setAktifPkId(pk.id); setSasaranAktifPK(0); }}
                            className="btn-outline btn-sm">
                            Kelola
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          )}
        </div>
      )}
      </>
      )}

      {/* Modal Kelola Capaian — dibuka dari kartu di atas. Berisi tab per
          sasaran + tabel rencana/capaian; tombol "Isi" pada tiap baris
          membuka form isian kecil (Modal terpisah di bawah, tumpang di atas
          modal ini). */}
      <Modal
        open={!!aktifPK} onClose={() => setAktifPkId(null)}
        title={aktifPK?.nama || ''} lebar="max-w-3xl"
      >
        {aktifPK && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-1.5 text-[11px]">
              <span className="badge bg-slate-100 text-slate-600">{JENIS_LABEL[aktifPK.jenis] || aktifPK.jenis}</span>
              <span className="badge bg-slate-100 text-slate-600">Tahun {aktifPK.tahun}</span>
              {aktifPK.sub_unit_name && (
                <span className="badge bg-slate-100 text-slate-600">{aktifPK.sub_unit_name}</span>
              )}
            </div>

            <div className="flex flex-wrap gap-1.5">
              {aktifPK.sasaran.map((sm, i) => (
                <button key={sm.id} onClick={() => setSasaranAktifPK(i)}
                  className={`rounded-full px-3 py-1 text-[11px] font-medium transition-colors ${
                    i === sasaranAktifPK ? 'bg-pktj-700 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}>
                  Sasaran {i + 1}
                </button>
              ))}
            </div>

            {aktifPK.sasaran[sasaranAktifPK] && (() => {
              const sm = aktifPK.sasaran[sasaranAktifPK];
              return (
                <>
                  <div className="rounded-lg bg-slate-50 p-4 text-xs">
                    <p className="mb-1"><span className="text-slate-500">Sasaran: </span>{sm.sasaran}</p>
                    <p><span className="text-slate-500">Target: </span>{sm.target}{sm.satuan ? ` ${sm.satuan}` : ''}</p>
                  </div>
                  <div className="overflow-x-auto rounded-lg border border-slate-200">
                    <table className="w-full">
                      <thead>
                        <tr>
                          <th className="th w-32">Sub-periode</th>
                          <th className="th w-32">Rencana</th>
                          <th className="th">Realisasi</th>
                          <th className="th w-24">Capaian</th>
                          <th className="th w-32">Status</th>
                          <th className="th w-24"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {sm.rencana.map((r) => (
                          <tr key={r.periode_ke} className="hover:bg-slate-50/60">
                            <td className="td font-medium">{r.label}</td>
                            <td className="td text-xs text-slate-600">{r.target_periode || '-'}</td>
                            <td className="td max-w-sm text-xs text-slate-600">
                              {r.realisasi
                                ? <span className="line-clamp-2">{r.realisasi}</span>
                                : <span className="text-slate-400">Belum diisi</span>}
                              {r.submitted_at && (
                                <p className="mt-1 text-[11px] text-slate-400">
                                  {tanggalWaktuID(r.submitted_at)}
                                </p>
                              )}
                            </td>
                            <td className="td text-sm tabular-nums">
                              {teksCapaian(sm, r) ?? '-'}
                            </td>
                            <td className="td">
                              <Badge status={r.status || 'draft'}>
                                {r.status ? undefined : 'Belum Diisi'}
                              </Badge>
                            </td>
                            <td className="td">
                              <button onClick={() => bukaFormSM(aktifPK, sm, r)} className="btn-outline btn-sm">
                                Isi
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              );
            })()}
          </div>
        )}
      </Modal>

      {/* --------------------------- TAB: PEMENUHAN STANDAR ------------------- */}
      {tab === 'standar' && (
      <>
      {/* Rekap progres seluruh unit */}
      {bolehPilihUnit && rekap.length > 0 && (
        <div className="card-p mb-6">
          <h2 className="mb-4 section-title">Progres Pengisian Seluruh Unit</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {rekap.map((r) => (
              <button
                key={r.unit_id}
                onClick={() => setUnitId(String(r.unit_id))}
                className={`rounded-lg border p-3 text-left transition-colors hover:border-pktj-400 ${
                  String(r.unit_id) === String(unitId)
                    ? 'border-pktj-500 bg-pktj-50' : 'border-slate-200'
                }`}
              >
                <div className="mb-1.5 flex items-baseline justify-between gap-2">
                  <span className="truncate text-xs font-medium">{r.name}</span>
                  <span className="shrink-0 text-xs font-bold tabular-nums">{r.persen}%</span>
                </div>
                <Progres nilai={r.persen} />
                <p className="mt-1 text-[11px] text-slate-500">
                  {r.terisi}/{r.total_indikator} indikator
                </p>
              </button>
            ))}
          </div>
        </div>
      )}

      {!unitId ? (
        <Kosong judul="Pilih unit terlebih dahulu"
          pesan="Pilih unit organisasi untuk menampilkan lembar kerja pelaksanaan standar." />
      ) : !lembar ? (
        <Memuat />
      ) : items.length === 0 ? (
        <Kosong judul="Belum ada standar untuk unit ini"
          pesan="Satuan Penjaminan Mutu belum menetapkan standar bagi unit ini pada periode aktif." />
      ) : (
        <>
          {/* Ringkasan unit */}
          <div className="card-p mb-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold">{lembar.unit?.name}</h2>
                <p className="text-xs text-slate-500">
                  {terisi} dari {items.length} indikator telah diserahkan
                </p>
              </div>
              <div className="w-full max-w-xs">
                <div className="mb-1 flex justify-between text-xs font-medium">
                  <span className="text-slate-500">Kelengkapan</span>
                  <span className="tabular-nums">{persen}%</span>
                </div>
                <Progres nilai={persen} />
              </div>
              <select className="select w-auto" value={acuanFilter}
                onChange={(e) => setAcuanFilter(e.target.value)}>
                <option value="">Semua acuan mutu</option>
                {daftarAcuan.map((a) => (
                  <option key={a.kode} value={a.kode}>{a.nama}</option>
                ))}
              </select>
              <input className="input max-w-xs" placeholder="Cari indikator…"
                value={cari} onChange={(e) => setCari(e.target.value)} />
            </div>
          </div>

          {tersaring.length === 0 ? (
            <Kosong judul="Tidak ada indikator yang cocok"
              pesan="Coba ubah kata kunci pencarian atau pilihan acuan mutu." />
          ) : (
          <div className="space-y-5">
            {Object.entries(grup).map(([judul, daftar]) => (
              <div key={judul} className="card overflow-hidden">
                <div className="border-b border-slate-200 bg-slate-50 px-5 py-3">
                  <h3 className="text-sm font-semibold">{judul}</h3>
                  {daftar[0].reference_iso && (
                    <p className="mt-0.5 text-[11px] text-slate-500">
                      ISO 21001 klausul {daftar[0].reference_iso}
                      {daftar[0].reference_lam && ` · ${daftar[0].reference_lam}`}
                    </p>
                  )}
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr>
                        <th className="th w-24">Kode</th>
                        <th className="th w-28">Acuan Mutu</th>
                        <th className="th">Indikator</th>
                        <th className="th w-32">Target</th>
                        <th className="th">Realisasi</th>
                        <th className="th w-24">Capaian</th>
                        <th className="th w-32">Status</th>
                        <th className="th w-24"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {daftar.map((it) => (
                        <tr key={`${it.indicator_id}-${it.untuk_unit_id}`} className="hover:bg-slate-50/60">
                          <td className="td font-mono text-xs text-slate-500">
                            {it.indikator_kode}
                          </td>
                          <td className="td">
                            {it.acuan_kode ? (
                              <>
                                <span className="badge"
                                  style={{ background: (it.acuan_warna || '#64748b') + '22', color: it.acuan_warna || '#475569' }}>
                                  {it.acuan_kode}
                                </span>
                                {it.butir_kode && (
                                  <p className="mt-1 font-mono text-[11px] text-slate-400">{it.butir_kode}</p>
                                )}
                              </>
                            ) : (
                              <span className="badge bg-slate-100 text-slate-500">manual</span>
                            )}
                          </td>
                          <td className="td max-w-xs">
                            {it.indicator}
                            {Number(it.untuk_unit_id) !== Number(unitId) && (
                              <p className="mt-1 text-[11px] font-medium text-pktj-600">
                                Untuk: {it.untuk_unit_nama}
                              </p>
                            )}
                          </td>
                          <td className="td text-xs text-slate-600">{it.target || '-'}</td>
                          <td className="td max-w-sm text-xs text-slate-600">
                            {it.realisasi
                              ? <span className="line-clamp-2">{it.realisasi}</span>
                              : <span className="text-slate-400">Belum diisi</span>}
                            {it.submitted_at && (
                              <p className="mt-1 text-[11px] text-slate-400">
                                {tanggalWaktuID(it.submitted_at)}
                              </p>
                            )}
                          </td>
                          <td className="td text-sm tabular-nums">
                            <span className="font-semibold">
                              {it.capaian_nilai != null
                                ? `${it.capaian_nilai}${it.satuan ? ` ${it.satuan}` : ''}`
                                : '-'}
                            </span>
                            {it.skor != null && (
                              <span className="ml-1 text-[11px] text-slate-500">
                                (skor {it.skor})
                              </span>
                            )}
                          </td>
                          <td className="td">
                            <Badge status={it.status || 'draft'}>
                              {it.status ? undefined : 'Belum Diisi'}
                            </Badge>
                          </td>
                          <td className="td">
                            <button onClick={() => bukaForm(it)} className="btn-outline btn-sm">
                              {it.status === 'dinilai' ? 'Lihat' : 'Isi'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
          )}
        </>
      )}
      </>
      )}

      {/* Formulir pengisian */}
      <Modal
        open={!!aktif}
        onClose={() => setAktif(null)}
        title="Isian Pelaksanaan Standar"
        lebar="max-w-3xl"
        footer={
          aktif?.status !== 'dinilai' && (
            <>
              {aktif?.implementation_id && (
                <button onClick={hapusIsian} className="btn-outline mr-auto text-red-600 hover:bg-red-50"
                  disabled={simpan}>
                  <Icon.Hapus width={16} height={16} /> Hapus Isian
                </button>
              )}
              <button onClick={() => setAktif(null)} className="btn-outline">Batal</button>
              <button onClick={() => simpanIsian('draft')} className="btn-outline" disabled={simpan}>
                Simpan Draf
              </button>
              <button onClick={() => simpanIsian('diserahkan')} className="btn-primary" disabled={simpan}>
                <Icon.Cek width={16} height={16} /> Serahkan
              </button>
            </>
          )
        }
      >
        {aktif && (
          <div className="space-y-4">
            <div className="rounded-lg bg-slate-50 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-mono text-xs text-pktj-600">{aktif.indikator_kode}</p>
                {aktif.acuan_kode && (
                  <span className="badge"
                    style={{ background: (aktif.acuan_warna || '#64748b') + '22', color: aktif.acuan_warna || '#475569' }}>
                    {aktif.acuan_kode}
                    {aktif.butir_kode && ` · ${aktif.butir_kode}`}
                  </span>
                )}
                {Number(aktif.untuk_unit_id) !== Number(unitId) && (
                  <span className="badge bg-pktj-50 text-pktj-700">
                    Untuk: {aktif.untuk_unit_nama}
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm font-semibold">{aktif.indicator}</p>
              <div className="mt-3 grid gap-3 text-xs sm:grid-cols-2">
                <div>
                  <span className="text-slate-500">Target: </span>
                  <span className="font-medium">{aktif.target || '-'}</span>
                </div>
                <div>
                  <span className="text-slate-500">Target Skor: </span>
                  <span className="font-medium">{aktif.target_skor || '-'}</span>
                </div>
                <div>
                  <span className="text-slate-500">Satuan: </span>
                  <span className="font-medium">{aktif.satuan || '-'}</span>
                </div>
                {aktif.strategy && (
                  <div className="sm:col-span-2">
                    <span className="text-slate-500">Strategi: </span>
                    <span>{aktif.strategy}</span>
                  </div>
                )}
              </div>
            </div>

            {aktif.status === 'dinilai' && (
              <div className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-2.5 text-xs text-violet-800">
                Isian ini sudah dinilai auditor sehingga tidak dapat diubah.
              </div>
            )}

            <fieldset disabled={aktif.status === 'dinilai'} className="space-y-4">
              <div>
                <label className="label">Uraian realisasi pelaksanaan *</label>
                <textarea className="textarea" value={form.realisasi}
                  onChange={(e) => setForm((p) => ({ ...p, realisasi: e.target.value }))}
                  placeholder="Jelaskan apa yang telah dilaksanakan unit untuk memenuhi indikator ini" />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="label">Capaian terhadap target</label>
                  <input type="number" step="any" className="input" value={form.capaian_nilai}
                    onChange={(e) => setForm((p) => ({ ...p, capaian_nilai: e.target.value }))}
                    placeholder="isi sesuai capaian target" />
                  <p className="mt-1 text-[11px] text-slate-400">
                    Jika kualitatif tuliskan dalam persen, jika kuantitatif isi angka capaiannya
                  </p>
                </div>
                <div>
                  <label className="label">
                    Skor {aktif.skor_min != null && aktif.skor_maks != null
                      ? `(skala ${aktif.skor_min}–${aktif.skor_maks}${aktif.skor_step && aktif.skor_step !== 1 ? `, kelipatan ${aktif.skor_step}` : ''})`
                      : aktif.target_skor ? `(skala ${aktif.target_skor})` : ''}
                  </label>
                  <input type="number"
                    min={aktif.skor_min ?? undefined} max={aktif.skor_maks ?? undefined}
                    step={aktif.skor_step || 'any'} className="input" value={form.skor}
                    onChange={(e) => setForm((p) => ({ ...p, skor: e.target.value }))}
                    placeholder={
                      aktif.skor_min != null && aktif.skor_maks != null
                        ? `${aktif.skor_min} s.d. ${aktif.skor_maks}`
                        : aktif.satuan?.toLowerCase().includes('pemenuhan') ? '0 atau 1' : 'mis. 3'
                    } />
                  {aktif.acuan_kode && (
                    <p className="mt-1 text-[11px] text-slate-400">
                      Sesuai skala resmi acuan {aktif.acuan_kode}
                    </p>
                  )}
                </div>
              </div>
              <div>
                <label className="label">Tautan bukti (Google Drive)</label>
                <input className="input" value={form.bukti_url}
                  onChange={(e) => setForm((p) => ({ ...p, bukti_url: e.target.value }))}
                  placeholder="Tempel tautan Google Drive di sini — https://drive.google.com/…" />
                <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[11px] text-slate-400">
                    Disarankan: unggah berkas ke Google Drive unit, bagikan aksesnya, lalu tempel tautannya di atas.
                  </p>
                  <label className="btn-ghost btn-sm shrink-0 cursor-pointer whitespace-nowrap text-[11px] text-slate-500">
                    atau unggah berkas (maks 10 MB)
                    <input type="file" className="hidden"
                      onChange={(e) => unggah(e.target.files?.[0])} />
                  </label>
                </div>
              </div>
              <div>
                <label className="label">Uraian dokumen bukti</label>
                <textarea className="textarea min-h-[70px]" value={form.bukti_uraian}
                  onChange={(e) => setForm((p) => ({ ...p, bukti_uraian: e.target.value }))}
                  placeholder="Sebutkan nama dokumen, nomor, dan tanggal bukti pendukung" />
              </div>
              <div>
                <label className="label">Kendala yang dihadapi</label>
                <textarea className="textarea min-h-[70px]" value={form.kendala}
                  onChange={(e) => setForm((p) => ({ ...p, kendala: e.target.value }))} />
              </div>
            </fieldset>
          </div>
        )}
      </Modal>

      {/* Formulir capaian sasaran mutu per sub-periode */}
      <Modal
        open={!!aktifSM}
        onClose={() => setAktifSM(null)}
        title="Capaian Sasaran Mutu"
        lebar="max-w-2xl"
        footer={
          <>
            <button onClick={() => setAktifSM(null)} className="btn-outline">Batal</button>
            <button onClick={() => simpanCapaianSM('draft')} className="btn-outline" disabled={simpanSM}>
              Simpan Draf
            </button>
            <button onClick={() => simpanCapaianSM('diserahkan')} className="btn-primary" disabled={simpanSM}>
              <Icon.Cek width={16} height={16} /> Serahkan
            </button>
          </>
        }
      >
        {aktifSM && (
          <div className="space-y-4">
            <div className="rounded-lg bg-slate-50 p-4">
              <p className="font-mono text-xs text-pktj-600">{aktifSM.label}</p>
              <p className="mt-1 text-sm font-semibold">{aktifSM.program_kerja}</p>
              <p className="mt-1 text-xs text-slate-500">
                {aktifSM.sasaran}
                {aktifSM.target && ` — target ${aktifSM.target}${aktifSM.satuan ? ` ${aktifSM.satuan}` : ''}`}
              </p>
              {aktifSM.target_periode && (
                <p className="mt-2 text-xs">
                  <span className="text-slate-500">Rencana capaian sub-periode ini: </span>
                  <span className="font-medium">{aktifSM.target_periode}</span>
                </p>
              )}
            </div>

            <div>
              <label className="label">Uraian realisasi *</label>
              <textarea className="textarea" value={formSM.realisasi}
                onChange={(e) => setFormSM((p) => ({ ...p, realisasi: e.target.value }))}
                placeholder="Jelaskan capaian pada sub-periode ini" />
            </div>
            <div>
              {adalahPeringkat(aktifSM) ? (
                <>
                  <label className="label">Capaian (peringkat)</label>
                  <select className="select w-full" value={formSM.capaian_teks}
                    onChange={(e) => setFormSM((p) => ({ ...p, capaian_teks: e.target.value }))}>
                    <option value="">— Pilih peringkat —</option>
                    {levelPeringkat(aktifSM).map((l) => <option key={l} value={l}>{l}</option>)}
                  </select>
                </>
              ) : (
                <>
                  <label className="label">Capaian (nilai)</label>
                  <input type="number" step="any" className="input" value={formSM.capaian_nilai}
                    onChange={(e) => setFormSM((p) => ({ ...p, capaian_nilai: e.target.value }))}
                    placeholder="isi sesuai capaian" />
                </>
              )}
            </div>
            <div>
              <label className="label">Tautan bukti (Google Drive)</label>
              <input className="input" value={formSM.bukti_url}
                onChange={(e) => setFormSM((p) => ({ ...p, bukti_url: e.target.value }))}
                placeholder="Tempel tautan Google Drive di sini — https://drive.google.com/…" />
              <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2">
                <p className="text-[11px] text-slate-400">
                  Disarankan: unggah berkas ke Google Drive unit, bagikan aksesnya, lalu tempel tautannya di atas.
                </p>
                <label className="btn-ghost btn-sm shrink-0 cursor-pointer whitespace-nowrap text-[11px] text-slate-500">
                  atau unggah berkas (maks 10 MB)
                  <input type="file" className="hidden"
                    onChange={(e) => unggahSM(e.target.files?.[0])} />
                </label>
              </div>
            </div>
            <div>
              <label className="label">Uraian dokumen bukti</label>
              <textarea className="textarea min-h-[70px]" value={formSM.bukti_uraian}
                onChange={(e) => setFormSM((p) => ({ ...p, bukti_uraian: e.target.value }))} />
            </div>

            <div className="rounded-lg border border-slate-200 p-3">
              <p className="mb-2 text-xs font-semibold text-slate-600">Evaluasi Ketercapaian</p>
              <div className="space-y-3">
                <div>
                  <label className="label text-rose-700">Kendala (jika gagal mencapai rencana target)</label>
                  <textarea className="textarea min-h-[70px]" value={formSM.kendala}
                    onChange={(e) => setFormSM((p) => ({ ...p, kendala: e.target.value }))}
                    placeholder="Jelaskan kendala/hambatan bila realisasi belum mencapai rencana target" />
                </div>
                <div>
                  <label className="label text-emerald-700">Faktor pendukung (jika melampaui rencana target)</label>
                  <textarea className="textarea min-h-[70px]" value={formSM.faktor_pendukung}
                    onChange={(e) => setFormSM((p) => ({ ...p, faktor_pendukung: e.target.value }))}
                    placeholder="Jelaskan faktor pendukung bila realisasi melampaui rencana target" />
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
