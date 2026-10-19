import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, tanggalID, uraiWaktu, rangkaiWaktu } from '../api.js';
import { useAuth } from '../auth.jsx';
import {
  Badge, Icon, JudulHalaman, Kosong, Memuat, Modal, useToast,
} from '../components/ui.jsx';

/** Sinkron dengan STATUS_EDITABLE di server/src/routes/rtm.js */
const STATUS_BISA_EDIT = ['rencana', 'ditolak_spm'];

export default function RTM() {
  const { periode, bolehPimpinan } = useAuth();
  const { tampil, Toast } = useToast();

  const [data, setData] = useState(null);
  const [users, setUsers] = useState([]);
  const [buka, setBuka] = useState(false);
  const [editId, setEditId] = useState(null);
  const [f, setF] = useState({
    judul: '', tanggal: '', jamMulai: '', jamSelesai: '', tempat: '',
    pemimpin_id: '', notulis_id: '',
  });
  const kosongkanForm = () =>
    setF({
      judul: '', tanggal: '', jamMulai: '', jamSelesai: '', tempat: '',
      pemimpin_id: '', notulis_id: '',
    });

  async function muat() {
    if (!periode) return;
    setData(await api.get(`/rtm?period_id=${periode.id}`));
  }
  useEffect(() => { muat(); }, [periode?.id]);

  useEffect(() => {
    if (bolehPimpinan) api.get('/master/users').then(setUsers).catch(() => {});
  }, [bolehPimpinan]);

  async function buat(e) {
    e.preventDefault();
    if (!f.judul) return tampil('Judul rapat wajib diisi', 'galat');
    const { jamMulai, jamSelesai, ...sisa } = f;
    const payload = { ...sisa, waktu: rangkaiWaktu(jamMulai, jamSelesai) };
    try {
      if (editId) {
        await api.put(`/rtm/${editId}`, payload);
        tampil('Jadwal rapat berhasil diperbarui');
      } else {
        await api.post('/rtm', { ...payload, period_id: periode.id });
        tampil('Rapat Tinjauan Manajemen berhasil dibuat beserta 16 butir agenda');
      }
      setBuka(false);
      setEditId(null);
      kosongkanForm();
      muat();
    } catch (err) { tampil(err.message, 'galat'); }
  }

  function mulaiEdit(r) {
    setEditId(r.id);
    const { mulai, selesai } = uraiWaktu(r.waktu);
    setF({
      judul: r.judul ?? '', tanggal: r.tanggal ?? '',
      jamMulai: mulai, jamSelesai: selesai, tempat: r.tempat ?? '',
      pemimpin_id: r.pemimpin_id ?? '', notulis_id: r.notulis_id ?? '',
    });
    setBuka(true);
  }

  async function hapus(r) {
    if (!confirm(`Hapus jadwal rapat "${r.judul}"? Seluruh agenda, peserta, dan keluaran RTM terkait akan ikut terhapus. Tindakan ini tidak dapat dibatalkan.`))
      return;
    try {
      await api.del(`/rtm/${r.id}`);
      tampil('Jadwal rapat dihapus');
      muat();
    } catch (err) { tampil(err.message, 'galat'); }
  }

  if (!data) return <Memuat />;

  const pimpinanList = users.filter((u) => ['pimpinan', 'spm'].includes(u.role));

  return (
    <>
      <Toast />
      <JudulHalaman
        ikon={<Icon.RTM width={20} height={20} />}
        judul="Modul 5 — Rapat Tinjauan Manajemen"
        deskripsi="Dipimpin Direktur dan Wakil Direktur I, II, III untuk meninjau kinerja dan efektivitas SMOP serta menghasilkan keputusan peningkatan"
        aksi={
          bolehPimpinan && (
            <button onClick={() => { setEditId(null); kosongkanForm(); setBuka(true); }} className="btn-primary">
              <Icon.Plus width={16} height={16} /> Rapat Baru
            </button>
          )
        }
      />

      {data.length === 0 ? (
        <Kosong
          judul="Belum ada Rapat Tinjauan Manajemen"
          pesan="Buat agenda RTM untuk meninjau hasil evaluasi mutu internal dan menetapkan program peningkatan."
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {data.map((r) => (
            <div key={r.id} className="card-p flex flex-col">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  {r.nomor && (
                    <p className="font-mono text-[11px] font-semibold text-pktj-600">
                      {r.nomor}
                    </p>
                  )}
                  <h3 className="mt-0.5 text-sm font-semibold leading-snug">{r.judul}</h3>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <Badge status={r.status} />
                  {bolehPimpinan && STATUS_BISA_EDIT.includes(r.status) && (
                    <>
                      <button onClick={() => mulaiEdit(r)} title="Ubah jadwal"
                        className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-pktj-600">
                        <Icon.Pena width={15} height={15} />
                      </button>
                      <button onClick={() => hapus(r)} title="Hapus jadwal"
                        className="rounded-md p-1 text-slate-400 hover:bg-red-50 hover:text-red-600">
                        <Icon.Hapus width={15} height={15} />
                      </button>
                    </>
                  )}
                </div>
              </div>

              <dl className="mb-4 space-y-1.5 text-xs">
                <div className="flex gap-2">
                  <dt className="w-24 shrink-0 text-slate-500">Tanggal</dt>
                  <dd className="font-medium">{tanggalID(r.tanggal)} {r.waktu && `· ${r.waktu}`}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="w-24 shrink-0 text-slate-500">Tempat</dt>
                  <dd className="font-medium">{r.tempat || '-'}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="w-24 shrink-0 text-slate-500">Pemimpin</dt>
                  <dd className="font-medium">
                    {r.pemimpin_name || '-'}
                    {r.pemimpin_jabatan && (
                      <span className="text-slate-500"> — {r.pemimpin_jabatan}</span>
                    )}
                  </dd>
                </div>
              </dl>

              <div className="mb-4 grid grid-cols-2 gap-2 rounded-lg bg-slate-50 p-2.5 text-center">
                <div>
                  <p className="text-lg font-bold tabular-nums">{r.jumlah_hadir}</p>
                  <p className="text-[10px] uppercase tracking-wide text-slate-500">Peserta hadir</p>
                </div>
                <div>
                  <p className="text-lg font-bold tabular-nums text-pktj-700">{r.jumlah_keluaran}</p>
                  <p className="text-[10px] uppercase tracking-wide text-slate-500">Keluaran RTM</p>
                </div>
              </div>

              <Link to={`/rtm/${r.id}`} className="btn-primary btn-sm mt-auto">
                Buka Notulen & Agenda
              </Link>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={buka} onClose={() => { setBuka(false); setEditId(null); }}
        title={editId ? 'Ubah Jadwal Rapat Tinjauan Manajemen' : 'Rapat Tinjauan Manajemen Baru'}
        footer={
          <>
            <button onClick={() => { setBuka(false); setEditId(null); }} className="btn-outline">Batal</button>
            <button onClick={buat} className="btn-primary">
              {editId ? 'Simpan Perubahan' : 'Buat Rapat'}
            </button>
          </>
        }
      >
        <form onSubmit={buat} className="space-y-4">
          <div>
            <label className="label">Judul rapat *</label>
            <input className="input" value={f.judul}
              onChange={(e) => setF((p) => ({ ...p, judul: e.target.value }))}
              placeholder="Rapat Tinjauan Manajemen Semester Genap TA 2025/2026" />
          </div>
          {editId && (
            <p className="rounded-lg bg-slate-50 px-3 py-2.5 text-xs text-slate-600">
              <span className="font-medium">Nomor rapat: </span>
              <span className="font-mono">
                {data.find((r) => r.id === editId)?.nomor || '-'}
              </span>
              {' '}— dibuat otomatis, tidak dapat diubah.
            </p>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Tanggal</label>
              <input type="date" className="input" value={f.tanggal}
                onChange={(e) => setF((p) => ({ ...p, tanggal: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="label">Jam mulai</label>
                <input type="time" className="input" value={f.jamMulai}
                  onChange={(e) => setF((p) => ({ ...p, jamMulai: e.target.value }))} />
              </div>
              <div>
                <label className="label">Jam selesai</label>
                <input type="time" className="input" value={f.jamSelesai}
                  onChange={(e) => setF((p) => ({ ...p, jamSelesai: e.target.value }))} />
              </div>
            </div>
            <div>
              <label className="label">Tempat</label>
              <input className="input" value={f.tempat}
                onChange={(e) => setF((p) => ({ ...p, tempat: e.target.value }))}
                placeholder="Ruang Rapat Direktorat" />
            </div>
            <div>
              <label className="label">Pemimpin rapat</label>
              <select className="select" value={f.pemimpin_id}
                onChange={(e) => setF((p) => ({ ...p, pemimpin_id: e.target.value }))}>
                <option value="">Pilih…</option>
                {pimpinanList.map((u) => (
                  <option key={u.id} value={u.id}>{u.name} — {u.jabatan}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Notulis</label>
              <select className="select" value={f.notulis_id}
                onChange={(e) => setF((p) => ({ ...p, notulis_id: e.target.value }))}>
                <option value="">Pilih…</option>
                {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
          </div>
          <p className="rounded-lg bg-slate-50 px-3 py-2.5 text-xs text-slate-600">
            Verifikasi notulen pada tahap Kepala SPM otomatis dikelola sistem — cukup dilakukan
            oleh akun dengan jabatan Ketua/Kepala Satuan Penjaminan Mutu, tanpa perlu ditunjuk
            per rapat.
          </p>
          {!editId && (
            <p className="rounded-lg bg-pktj-50 px-3 py-2.5 text-xs text-pktj-800">
              16 butir agenda RTM sesuai SMOP PKTJ akan dibuat otomatis, meliputi status RTM
              sebelumnya, perubahan isu eksternal/internal, kinerja dan efektivitas SMOP
              (butir 3a–3h), kecukupan sumber daya, efektivitas risiko dan peluang, peluang
              perbaikan berkelanjutan, serta umpan balik staf.
            </p>
          )}
        </form>
      </Modal>
    </>
  );
}
