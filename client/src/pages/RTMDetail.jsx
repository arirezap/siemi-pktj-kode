import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, tanggalID } from '../api.js';
import { useAuth } from '../auth.jsx';
import {
  Badge, Icon, JudulHalaman, Memuat, Modal, PadTandaTangan, useToast,
} from '../components/ui.jsx';

const KELUARAN = [
  { k: 'perubahan_smop',        l: 'Kebutuhan Perubahan untuk SMOP',            w: 'sky' },
  { k: 'kebutuhan_sumber_daya', l: 'Kebutuhan Sumber Daya',                     w: 'amber' },
  { k: 'peluang_perbaikan',     l: 'Peluang untuk Perbaikan yang Diprogramkan', w: 'emerald' },
];

const WARNA = {
  emerald: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  sky: 'border-sky-200 bg-sky-50 text-sky-900',
  amber: 'border-amber-200 bg-amber-50 text-amber-900',
};

export default function RTMDetail() {
  const { id } = useParams();
  const { user, bolehPimpinan, bolehSPM } = useAuth();
  const { tampil, Toast } = useToast();

  const [d, setD] = useState(null);
  const [units, setUnits] = useState([]);
  const [bahan, setBahan] = useState(null);
  const [edit, setEdit] = useState({});      // agenda_id -> {pembahasan, kesimpulan, data_pendukung}
  const [tab, setTab] = useState('agenda');
  const [modalKeluaran, setModalKeluaran] = useState(null);
  const [fk, setFk] = useState({ uraian: '', unit_id: '', penanggung_jawab: '', target_tanggal: '' });
  const [modalTtd, setModalTtd] = useState(null);   // 'notulen' | 'spm-setuju' | 'direktur' | null
  const [modalTolak, setModalTolak] = useState(false);
  const [catatanTolak, setCatatanTolak] = useState('');
  const [gambar, setGambar] = useState(null);

  async function muat() {
    const r = await api.get(`/rtm/${id}`);
    setD(r);
    const e = {};
    r.agenda.forEach((a) => {
      e[a.id] = {
        pembahasan: a.pembahasan || '',
        data_pendukung: a.data_pendukung || '',
        kesimpulan: a.kesimpulan || '',
        pic: a.pic || '',
      };
    });
    setEdit(e);
  }

  useEffect(() => { muat(); api.get('/master/units').then(setUnits).catch(() => {}); }, [id]);

  async function simpanAgenda(a) {
    try {
      await api.put(`/rtm/${id}/agenda/${a.id}`, edit[a.id]);
      tampil(`Butir agenda ${a.agenda_key} tersimpan`);
    } catch (e) { tampil(e.message, 'galat'); }
  }

  async function tarikBahan() {
    try {
      const b = await api.get(`/rtm/${id}/bahan`);
      setBahan(b);
      setTab('bahan');
      tampil('Bahan rapat berhasil ditarik dari Modul 1–4');
    } catch (e) { tampil(e.message, 'galat'); }
  }

  function sisipkanBahan(agendaId, teks) {
    setEdit((p) => ({
      ...p,
      [agendaId]: {
        ...p[agendaId],
        data_pendukung: (p[agendaId]?.data_pendukung ? p[agendaId].data_pendukung + '\n' : '') + teks,
      },
    }));
    setTab('agenda');
    tampil('Data pendukung disisipkan ke butir agenda');
  }

  async function tambahKeluaran() {
    if (!fk.uraian) return tampil('Uraian keluaran wajib diisi', 'galat');
    try {
      await api.post(`/rtm/${id}/keluaran`, { ...fk, kategori: modalKeluaran });
      tampil('Keluaran RTM ditambahkan');
      setModalKeluaran(null);
      setFk({ uraian: '', unit_id: '', penanggung_jawab: '', target_tanggal: '' });
      muat();
    } catch (e) { tampil(e.message, 'galat'); }
  }

  async function ubahStatusKeluaran(o, status_tindak_lanjut) {
    await api.put(`/rtm/${id}/keluaran/${o.id}`, { status_tindak_lanjut });
    muat();
  }

  async function hapusKeluaran(o) {
    if (!confirm('Hapus keluaran ini?')) return;
    await api.del(`/rtm/${id}/keluaran/${o.id}`);
    muat();
  }

  async function ubahHadir(p, hadir) {
    await api.put(`/rtm/${id}/peserta/${p.id}`, { hadir });
    muat();
  }

  function tutupModalTtd() { setModalTtd(null); setGambar(null); }

  async function sahkanNotulen() {
    if (!gambar) return tampil('Bubuhkan tanda tangan terlebih dahulu', 'galat');
    try {
      await api.post(`/rtm/${id}/tanda-tangan/notulen`, { image_data: gambar });
      tampil('Notulen disahkan, menunggu verifikasi Kepala SPM');
      tutupModalTtd(); muat();
    } catch (e) { tampil(e.message, 'galat'); }
  }

  async function tarikPengesahanNotulen() {
    if (!confirm('Tarik kembali pengesahan notulen? Notulen akan kembali berstatus draf untuk diperbaiki.'))
      return;
    try {
      await api.del(`/rtm/${id}/tanda-tangan/notulen`);
      tampil('Pengesahan notulen ditarik');
      muat();
    } catch (e) { tampil(e.message, 'galat'); }
  }

  async function setujuiSpm() {
    if (!gambar) return tampil('Bubuhkan tanda tangan terlebih dahulu', 'galat');
    try {
      await api.post(`/rtm/${id}/verifikasi-spm`, { keputusan: 'setuju', image_data: gambar });
      tampil('Notulen disetujui, menunggu tanda tangan Direktur');
      tutupModalTtd(); muat();
    } catch (e) { tampil(e.message, 'galat'); }
  }

  async function tolakSpm() {
    try {
      await api.post(`/rtm/${id}/verifikasi-spm`, { keputusan: 'tolak', catatan: catatanTolak });
      tampil('Notulen dikembalikan ke notulis untuk diperbaiki');
      setModalTolak(false); setCatatanTolak(''); muat();
    } catch (e) { tampil(e.message, 'galat'); }
  }

  async function tarikPersetujuanSpm() {
    if (!confirm('Tarik kembali persetujuan Kepala SPM? Status akan kembali menunggu verifikasi SPM.'))
      return;
    try {
      await api.del(`/rtm/${id}/verifikasi-spm`);
      tampil('Persetujuan Kepala SPM ditarik');
      muat();
    } catch (e) { tampil(e.message, 'galat'); }
  }

  async function tandaTanganDirektur() {
    if (!gambar) return tampil('Bubuhkan tanda tangan terlebih dahulu', 'galat');
    try {
      await api.post(`/rtm/${id}/tanda-tangan/direktur`, { image_data: gambar });
      tampil('Notulen RTM resmi ditandatangani');
      tutupModalTtd(); muat();
    } catch (e) { tampil(e.message, 'galat'); }
  }

  async function tarikTandaTanganDirektur() {
    if (!confirm('Tarik kembali tanda tangan final Direktur? Notulen akan terbuka kembali untuk ditandatangani ulang.'))
      return;
    try {
      await api.del(`/rtm/${id}/tanda-tangan/direktur`);
      tampil('Tanda tangan final Direktur ditarik');
      muat();
    } catch (e) { tampil(e.message, 'galat'); }
  }

  if (!d) return <Memuat />;

  const utama = d.agenda.filter((a) => !a.parent_key);
  const anak = (key) => d.agenda.filter((a) => a.parent_key === key);
  const terisi = d.agenda.filter((a) => a.pembahasan).length;

  const bisaEdit = ['rencana', 'ditolak_spm'].includes(d.status);
  const bolehNotulen = user.id === d.notulis_id || bolehSPM;
  // Sinkron dengan bolehVerifikasiSpm() di server/src/routes/rtm.js
  const bolehVerifikasiSpm =
    user.role === 'admin' || (user.role === 'spm' && /kepala|ketua/i.test(user.jabatan || ''));
  const bolehDirektur = user.id === d.pemimpin_id || ['pimpinan', 'admin'].includes(user.role);
  const ttd = (peran) => d.tanda_tangan.find((t) => t.peran === peran);

  const submitTtd = {
    notulen: sahkanNotulen,
    'spm-setuju': setujuiSpm,
    direktur: tandaTanganDirektur,
  }[modalTtd];
  const judulTtd = {
    notulen: 'Pengesahan Notulen — Notulen',
    'spm-setuju': 'Persetujuan Notulen — Kepala SPM',
    direktur: 'Tanda Tangan Final — Direktur',
  }[modalTtd];

  return (
    <>
      <Toast />
      <JudulHalaman
        ikon={<Icon.RTM width={20} height={20} />}
        judul={d.judul}
        deskripsi={`${d.nomor || ''} · ${tanggalID(d.tanggal)} · ${d.tempat || '-'} · dipimpin ${d.pemimpin_name || '-'}`}
        aksi={
          <>
            <Link to="/rtm" className="btn-outline">
              <Icon.Kembali width={16} height={16} /> Daftar RTM
            </Link>
            <Badge status={d.status} />
            {bolehPimpinan && (
              <button onClick={tarikBahan} className="btn-outline">
                <Icon.Segarkan width={16} height={16} /> Tarik Bahan Rapat
              </button>
            )}
            <Link to={`/rtm/${id}/cetak`} className="btn-primary">
              <Icon.Cetak width={16} height={16} /> Cetak Notulen
            </Link>
          </>
        }
      />

      {/* Tab */}
      <div className="no-print mb-5 flex flex-wrap gap-2">
        {[
          ['agenda', `Agenda & Keluaran RTM (${terisi}/${d.agenda.length})`],
          ['bahan', 'Bahan Rapat'],
          ['peserta', `Peserta (${d.peserta.filter((p) => p.hadir).length}/${d.peserta.length})`],
        ].map(([k, l]) => (
          <button key={k} onClick={() => k === 'bahan' && !bahan ? tarikBahan() : setTab(k)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              tab === k ? 'bg-pktj-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-100'
            }`}>
            {l}
          </button>
        ))}
      </div>

      {/* ------------------------------ AGENDA ------------------------------- */}
      {tab === 'agenda' && (
        <div className="space-y-4">
          {utama.map((a) => (
            <div key={a.id} className="card overflow-hidden">
              <div className="flex items-center gap-3 border-b border-slate-200 bg-slate-50 px-5 py-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-pktj-600 text-xs font-bold text-white">
                  {a.agenda_key}
                </span>
                <h3 className="text-sm font-semibold">{a.judul}</h3>
                {a.pembahasan && (
                  <span className="ml-auto badge bg-emerald-100 text-emerald-800">Terisi</span>
                )}
              </div>

              <div className="space-y-4 p-5">
                <ButirAgenda a={a} edit={edit} setEdit={setEdit} simpan={simpanAgenda}
                  boleh={bolehPimpinan && bisaEdit} />

                {anak(a.agenda_key).map((s) => (
                  <div key={s.id} className="ml-0 border-l-2 border-pktj-200 pl-4 sm:ml-4">
                    <div className="mb-2 flex items-center gap-2">
                      <span className="badge bg-pktj-100 font-mono text-pktj-800">
                        {s.agenda_key}
                      </span>
                      <p className="text-sm font-medium">{s.judul}</p>
                    </div>
                    <ButirAgenda a={s} edit={edit} setEdit={setEdit} simpan={simpanAgenda}
                      boleh={bolehPimpinan && bisaEdit} ringkas />
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* -------------------- KELUARAN RTM (di bawah agenda 7) ------------------- */}
          <div className="space-y-5">
            <h2 className="section-title">Keluaran RTM</h2>
            <p className="text-sm text-slate-600">
              Rapat Tinjauan Manajemen menghasilkan tiga kelompok keluaran wajib sesuai SMOP PKTJ.
            </p>
            {KELUARAN.map((k) => {
              const daftar = d.keluaran.filter((o) => o.kategori === k.k);
              return (
                <div key={k.k} className="card overflow-hidden">
                  <div className={`flex items-center justify-between border-b px-5 py-3 ${WARNA[k.w]}`}>
                    <h3 className="text-sm font-semibold">{k.l}</h3>
                    {bolehPimpinan && bisaEdit && (
                      <button onClick={() => setModalKeluaran(k.k)} className="btn-outline btn-sm">
                        <Icon.Plus width={14} height={14} /> Tambah
                      </button>
                    )}
                  </div>
                  {daftar.length === 0 ? (
                    <p className="px-5 py-6 text-center text-sm text-slate-400">
                      Belum ada keluaran pada kelompok ini.
                    </p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr>
                            <th className="th w-8">No</th>
                            <th className="th">Uraian</th>
                            <th className="th w-44">Unit Pelaksana</th>
                            <th className="th w-32">Penanggung Jawab</th>
                            <th className="th w-28">Target</th>
                            <th className="th w-36">Tindak Lanjut</th>
                            {bolehPimpinan && <th className="th w-12"></th>}
                          </tr>
                        </thead>
                        <tbody>
                          {daftar.map((o, i) => (
                            <tr key={o.id}>
                              <td className="td text-center text-xs">{i + 1}</td>
                              <td className="td whitespace-pre-line text-sm">{o.uraian}</td>
                              <td className="td text-xs">{o.unit_name || '-'}</td>
                              <td className="td whitespace-pre-line text-xs">{o.penanggung_jawab || '-'}</td>
                              <td className="td text-xs">{tanggalID(o.target_tanggal)}</td>
                              <td className="td">
                                {bolehPimpinan && bisaEdit ? (
                                  <select
                                    className="select py-1 text-xs"
                                    value={o.status_tindak_lanjut}
                                    onChange={(e) => ubahStatusKeluaran(o, e.target.value)}
                                  >
                                    <option value="direncanakan">Direncanakan</option>
                                    <option value="berjalan">Berjalan</option>
                                    <option value="selesai">Selesai</option>
                                    <option value="ditunda">Ditunda</option>
                                  </select>
                                ) : (
                                  <Badge status={o.status_tindak_lanjut} />
                                )}
                              </td>
                              {bolehPimpinan && (
                                <td className="td">
                                  {bisaEdit && (
                                    <button onClick={() => hapusKeluaran(o)}
                                      className="btn-ghost btn-sm text-rose-600">
                                      <Icon.Hapus width={14} height={14} />
                                    </button>
                                  )}
                                </td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ------------------------------- BAHAN ------------------------------- */}
      {tab === 'bahan' && (
        bahan ? (
          <div className="space-y-5">
            <TabelBahan
              judul="3f. Hasil Audit Mutu Internal"
              kolom={['Unit', 'Nomor BA', 'Rata Capaian', 'Temuan', 'Status']}
              baris={bahan.hasil_audit.map((r) => [
                r.unit_name, r.ba_number, r.rata_capaian != null ? `${r.rata_capaian}%` : '-',
                r.temuan, r.status,
              ])}
              onSisip={(teks) => {
                const ag = d.agenda.find((x) => x.agenda_key === '3f');
                ag && sisipkanBahan(ag.id, teks);
              }}
            />
            <TabelBahan
              judul="3d. Ketidaksesuaian dan Tindakan Koreksi"
              kolom={['Kategori', 'Jumlah', 'Ditutup', 'Efektif']}
              baris={bahan.ketidaksesuaian.map((r) => [
                r.kategori, r.jumlah, r.ditutup, r.efektif,
              ])}
              onSisip={(teks) => {
                const ag = d.agenda.find((x) => x.agenda_key === '3d');
                ag && sisipkanBahan(ag.id, teks);
              }}
            />
            <TabelBahan
              judul="3b. Pencapaian Sasaran Mutu per Kelompok Standar"
              kolom={['Kelompok Standar', 'Jumlah Indikator', 'Rata Capaian']}
              baris={bahan.sasaran_mutu.map((r) => [
                r.category, r.indikator, r.rata_capaian != null ? `${r.rata_capaian}%` : '-',
              ])}
              onSisip={(teks) => {
                const ag = d.agenda.find((x) => x.agenda_key === '3b');
                ag && sisipkanBahan(ag.id, teks);
              }}
            />
            <TabelBahan
              judul="1. Status Keluaran RTM Sebelumnya"
              kolom={['Rapat', 'Kategori', 'Uraian', 'Status']}
              baris={bahan.rtm_sebelumnya.map((r) => [
                r.rtm_judul, r.kategori.replace(/_/g, ' '), r.uraian, r.status_tindak_lanjut,
              ])}
              onSisip={(teks) => {
                const ag = d.agenda.find((x) => x.agenda_key === '1');
                ag && sisipkanBahan(ag.id, teks);
              }}
            />
            <TabelBahan
              judul="Progres Pelaksanaan Standar per Unit"
              kolom={['Unit', 'Total Indikator', 'Terisi']}
              baris={bahan.progres_unit.map((r) => [r.unit_name, r.total, r.terisi])}
              onSisip={(teks) => {
                const ag = d.agenda.find((x) => x.agenda_key === '2');
                ag && sisipkanBahan(ag.id, teks);
              }}
            />
          </div>
        ) : <Memuat teks="Menarik bahan rapat…" />
      )}

      {/* ------------------------------ PESERTA ------------------------------ */}
      {tab === 'peserta' && (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr>
                <th className="th w-8">No</th>
                <th className="th">Nama</th>
                <th className="th">Jabatan</th>
                <th className="th w-28">Kehadiran</th>
              </tr>
            </thead>
            <tbody>
              {d.peserta.map((p, i) => (
                <tr key={p.id}>
                  <td className="td text-center text-xs">{i + 1}</td>
                  <td className="td text-sm font-medium">{p.nama}</td>
                  <td className="td text-xs text-slate-600">{p.jabatan || '-'}</td>
                  <td className="td">
                    <label className="flex cursor-pointer items-center gap-2 text-xs">
                      <input type="checkbox" className="accent-pktj-600" checked={!!p.hadir}
                        disabled={!bolehPimpinan || !bisaEdit}
                        onChange={(e) => ubahHadir(p, e.target.checked)} />
                      {p.hadir ? 'Hadir' : 'Tidak hadir'}
                    </label>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Alur pengesahan notulen: Notulen -> Kepala SPM -> Direktur */}
      <div className="card-p mt-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="section-title">Alur Pengesahan Notulen</h2>
          <Badge status={d.status} />
        </div>

        {d.status === 'ditolak_spm' && d.catatan && (
          <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
            <p className="font-semibold">Notulen ditolak Kepala SPM:</p>
            <p>{d.catatan}</p>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-lg border border-slate-200 p-4 text-center">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
              1. Notulen
            </p>
            <KotakTtd data={ttd('Notulen')} />
            {bolehNotulen && ['rencana', 'ditolak_spm'].includes(d.status) && (
              <button onClick={() => setModalTtd('notulen')} className="btn-warn btn-sm mt-3 w-full">
                <Icon.Pena width={14} height={14} /> Sahkan Notulen
              </button>
            )}
            {bolehNotulen && d.status === 'menunggu_verifikasi_spm' && (
              <button onClick={tarikPengesahanNotulen}
                className="btn-outline btn-sm mt-3 w-full text-rose-600">
                Tarik Pengesahan
              </button>
            )}
          </div>

          <div className="rounded-lg border border-slate-200 p-4 text-center">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
              2. Kepala SPM
            </p>
            <KotakTtd data={ttd('Kepala SPM')} />
            {bolehVerifikasiSpm && d.status === 'menunggu_verifikasi_spm' && (
              <div className="mt-3 flex gap-2">
                <button onClick={() => setModalTtd('spm-setuju')} className="btn-primary btn-sm flex-1">
                  Setuju
                </button>
                <button onClick={() => setModalTolak(true)}
                  className="btn-outline btn-sm flex-1 text-rose-600">
                  Tolak
                </button>
              </div>
            )}
            {bolehVerifikasiSpm && d.status === 'menunggu_direktur' && (
              <button onClick={tarikPersetujuanSpm}
                className="btn-outline btn-sm mt-3 w-full text-rose-600">
                Tarik Persetujuan
              </button>
            )}
          </div>

          <div className="rounded-lg border border-slate-200 p-4 text-center">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
              3. Direktur
            </p>
            <KotakTtd data={ttd('Direktur')} />
            {bolehDirektur && d.status === 'menunggu_direktur' && (
              <button onClick={() => setModalTtd('direktur')} className="btn-warn btn-sm mt-3 w-full">
                <Icon.Pena width={14} height={14} /> Tanda Tangani Final
              </button>
            )}
            {bolehDirektur && d.status === 'ditandatangani' && (
              <button onClick={tarikTandaTanganDirektur}
                className="btn-outline btn-sm mt-3 w-full text-rose-600">
                Tarik Tanda Tangan
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Modal keluaran */}
      <Modal
        open={!!modalKeluaran} onClose={() => setModalKeluaran(null)}
        title={`Tambah — ${KELUARAN.find((k) => k.k === modalKeluaran)?.l || ''}`}
        footer={
          <>
            <button onClick={() => setModalKeluaran(null)} className="btn-outline">Batal</button>
            <button onClick={tambahKeluaran} className="btn-primary">Simpan</button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="label">Uraian keluaran *</label>
            <textarea className="textarea" value={fk.uraian}
              onChange={(e) => setFk((p) => ({ ...p, uraian: e.target.value }))}
              placeholder="Rumusan keputusan atau program yang ditetapkan dalam rapat" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Unit pelaksana</label>
              <select className="select" value={fk.unit_id}
                onChange={(e) => setFk((p) => ({ ...p, unit_id: e.target.value }))}>
                <option value="">Pilih unit…</option>
                {units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Penanggung jawab</label>
              <textarea className="textarea min-h-[50px]" value={fk.penanggung_jawab}
                onChange={(e) => setFk((p) => ({ ...p, penanggung_jawab: e.target.value }))} />
            </div>
            <div>
              <label className="label">Target penyelesaian</label>
              <input type="date" className="input" value={fk.target_tanggal}
                onChange={(e) => setFk((p) => ({ ...p, target_tanggal: e.target.value }))} />
            </div>
          </div>
        </div>
      </Modal>

      {/* Modal tanda tangan (Notulen / Kepala SPM / Direktur) */}
      <Modal
        open={!!modalTtd} onClose={tutupModalTtd} title={judulTtd || ''}
        footer={
          <>
            <button onClick={tutupModalTtd} className="btn-outline">Batal</button>
            <button onClick={submitTtd} className="btn-primary">Tanda Tangani</button>
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

      {/* Modal tolak (Kepala SPM) */}
      <Modal
        open={modalTolak} onClose={() => setModalTolak(false)} title="Tolak Notulen — Kepala SPM"
        footer={
          <>
            <button onClick={() => setModalTolak(false)} className="btn-outline">Batal</button>
            <button onClick={tolakSpm} className="btn-primary">Tolak &amp; Kembalikan</button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Notulen akan dikembalikan ke Notulis untuk diperbaiki dan disahkan ulang.
          </p>
          <div>
            <label className="label">Alasan penolakan</label>
            <textarea className="textarea" value={catatanTolak}
              onChange={(e) => setCatatanTolak(e.target.value)}
              placeholder="Jelaskan bagian yang perlu diperbaiki" />
          </div>
        </div>
      </Modal>
    </>
  );
}

/* --------------------------- Kotak tanda tangan --------------------------- */
function KotakTtd({ data }) {
  if (!data) return <p className="py-6 text-xs italic text-slate-400">Belum ditandatangani</p>;
  return (
    <div>
      <img src={data.image_data} alt={`Tanda tangan ${data.nama}`}
        className="mx-auto h-16 object-contain" />
      <p className="mt-1 border-t border-slate-900 pt-1 text-sm font-semibold">{data.nama}</p>
      <p className="text-xs text-slate-500">{data.jabatan || data.peran}</p>
    </div>
  );
}

/* ------------------------- Komponen butir agenda ------------------------- */
function ButirAgenda({ a, edit, setEdit, simpan, boleh, ringkas }) {
  const v = edit[a.id] || {};
  const ubah = (k, val) =>
    setEdit((p) => ({ ...p, [a.id]: { ...p[a.id], [k]: val } }));

  return (
    <div className="space-y-3">
      <div>
        <label className="label text-xs">Pembahasan</label>
        <textarea
          className={`textarea ${ringkas ? 'min-h-[70px]' : ''}`}
          value={v.pembahasan || ''} disabled={!boleh}
          onChange={(e) => ubah('pembahasan', e.target.value)}
          placeholder="Catatan pembahasan butir agenda ini"
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className="label text-xs">Data pendukung</label>
          <textarea className="textarea min-h-[70px] font-mono text-xs"
            value={v.data_pendukung || ''} disabled={!boleh}
            onChange={(e) => ubah('data_pendukung', e.target.value)}
            placeholder="Data dan angka pendukung (dapat ditarik dari tab Bahan Rapat)" />
        </div>
        <div>
          <label className="label text-xs">Kesimpulan / keputusan</label>
          <textarea className="textarea min-h-[70px]" value={v.kesimpulan || ''} disabled={!boleh}
            onChange={(e) => ubah('kesimpulan', e.target.value)} />
        </div>
        <div>
          <label className="label text-xs">PIC (penanggung jawab)</label>
          <textarea className="textarea min-h-[50px]" value={v.pic || ''} disabled={!boleh}
            onChange={(e) => ubah('pic', e.target.value)}
            placeholder="Unit atau nama orang yang bertanggung jawab" />
        </div>
      </div>
      {boleh && (
        <div className="flex justify-end">
          <button onClick={() => simpan(a)} className="btn-outline btn-sm">
            <Icon.Simpan width={14} height={14} /> Simpan butir {a.agenda_key}
          </button>
        </div>
      )}
    </div>
  );
}

/* --------------------------- Tabel bahan rapat --------------------------- */
function TabelBahan({ judul, kolom, baris, onSisip }) {
  const teks = [judul, ...baris.map((r) => r.join(' | '))].join('\n');
  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-5 py-3">
        <h3 className="text-sm font-semibold">{judul}</h3>
        <button onClick={() => onSisip(teks)} className="btn-outline btn-sm">
          Sisipkan ke agenda
        </button>
      </div>
      {baris.length === 0 ? (
        <p className="px-5 py-6 text-center text-sm text-slate-400">Belum ada data.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>{kolom.map((k) => <th key={k} className="th">{k}</th>)}</tr>
            </thead>
            <tbody>
              {baris.map((r, i) => (
                <tr key={i}>
                  {r.map((c, j) => (
                    <td key={j} className="td text-xs">{c ?? '-'}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
