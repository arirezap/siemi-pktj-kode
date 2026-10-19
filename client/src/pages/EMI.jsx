import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, tanggalID, uraiWaktu, rangkaiWaktu } from '../api.js';
import { useAuth } from '../auth.jsx';
import {
  Badge, Icon, JudulHalaman, Kosong, Memuat, Modal, useToast,
} from '../components/ui.jsx';

export default function EMI() {
  const { periode, bolehAuditor, bolehSPM } = useAuth();
  const { tampil, Toast } = useToast();

  const [audits, setAudits] = useState(null);
  const [units, setUnits] = useState([]);
  const [users, setUsers] = useState([]);
  const [buka, setBuka] = useState(false);
  const [editId, setEditId] = useState(null);
  const [f, setF] = useState({
    unit_id: '', lead_auditor_id: '', auditee_id: '',
    scheduled_date: '', jamMulai: '', jamSelesai: '', tempat: '', scope: '',
  });
  const [anggota, setAnggota] = useState([]); // array user_id anggota tim auditor
  const kosongkanForm = () => {
    setF({
      unit_id: '', lead_auditor_id: '', auditee_id: '',
      scheduled_date: '', jamMulai: '', jamSelesai: '', tempat: '', scope: '',
    });
    setAnggota([]);
  };

  async function muat() {
    if (!periode) return;
    setAudits(await api.get(`/emi?period_id=${periode.id}`));
  }

  useEffect(() => { muat(); }, [periode?.id]);

  useEffect(() => {
    api.get('/master/units').then(setUnits).catch(() => {});
    if (bolehAuditor) api.get('/master/users').then(setUsers).catch(() => {});
  }, [bolehAuditor]);

  async function buat(e) {
    e.preventDefault();
    if (!f.unit_id) return tampil('Unit yang diaudit wajib dipilih', 'galat');
    try {
      const { jamMulai, jamSelesai, ...sisa } = f;
      const payload = {
        ...sisa,
        scheduled_time: rangkaiWaktu(jamMulai, jamSelesai),
        anggota: anggota.map((user_id) => ({ user_id })),
      };
      if (editId) {
        await api.put(`/emi/${editId}`, payload);
        tampil('Jadwal audit berhasil diperbarui');
      } else {
        await api.post('/emi', { ...payload, period_id: periode.id });
        tampil('Jadwal audit berhasil dibuat');
      }
      setBuka(false);
      setEditId(null);
      kosongkanForm();
      muat();
    } catch (err) { tampil(err.message, 'galat'); }
  }

  async function mulaiEdit(a) {
    setEditId(a.id);
    const { mulai, selesai } = uraiWaktu(a.scheduled_time);
    setF({
      unit_id: a.unit_id ?? '', lead_auditor_id: a.lead_auditor_id ?? '',
      auditee_id: a.auditee_id ?? '', scheduled_date: a.scheduled_date ?? '',
      jamMulai: mulai, jamSelesai: selesai, tempat: a.tempat ?? '', scope: a.scope ?? '',
    });
    try {
      const daftar = await api.get(`/emi/${a.id}/anggota`);
      setAnggota(daftar.map((x) => x.user_id));
    } catch { setAnggota([]); }
    setBuka(true);
  }

  function toggleAnggota(userId) {
    setAnggota((p) =>
      p.includes(userId) ? p.filter((x) => x !== userId) : [...p, userId]
    );
  }

  async function hapus(a) {
    if (!confirm(`Hapus jadwal audit "${a.ba_number}" untuk unit ${a.unit_name}? Seluruh penilaian dan temuan terkait akan ikut terhapus. Tindakan ini tidak dapat dibatalkan.`))
      return;
    try {
      await api.del(`/emi/${a.id}`);
      tampil('Jadwal audit dihapus');
      muat();
    } catch (err) { tampil(err.message, 'galat'); }
  }

  const auditorList = users.filter((u) => ['auditor', 'spm'].includes(u.role));
  const auditeeList = users.filter(
    (u) => u.role === 'auditee' && String(u.unit_id) === String(f.unit_id)
  );

  if (!audits) return <Memuat />;

  return (
    <>
      <Toast />
      <JudulHalaman
        ikon={<Icon.Audit width={20} height={20} />}
        judul="Modul 3 — Evaluasi Mutu Internal"
        deskripsi="Auditor menilai pencapaian standar berdasarkan isian pelaksanaan, menetapkan ketidaksesuaian, dan menerbitkan berita acara"
        aksi={
          <>
            {audits.length > 0 && (
              <Link to="/emi/cetak-jadwal" className="btn-outline">
                <Icon.Cetak width={16} height={16} /> Cetak Jadwal Audit
              </Link>
            )}
            {(bolehAuditor || bolehSPM) && (
              <button onClick={() => { setEditId(null); kosongkanForm(); setBuka(true); }} className="btn-primary">
                <Icon.Plus width={16} height={16} /> Jadwalkan Audit
              </button>
            )}
          </>
        }
      />

      {audits.length === 0 ? (
        <Kosong
          judul="Belum ada audit terjadwal"
          pesan="Buat jadwal audit mutu internal untuk unit yang telah menyerahkan isian pelaksanaan standar."
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {audits.map((a) => (
            <div key={a.id} className="card-p flex flex-col">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-mono text-[11px] font-semibold text-pktj-600">
                    {a.ba_number}
                  </p>
                  <h3 className="mt-0.5 text-sm font-semibold leading-snug">
                    {a.unit_name}
                  </h3>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <Badge status={a.status} />
                  {(bolehAuditor || bolehSPM) && a.status !== 'ditandatangani' && (
                    <>
                      <button onClick={() => mulaiEdit(a)} title="Ubah jadwal"
                        className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-pktj-600">
                        <Icon.Pena width={15} height={15} />
                      </button>
                      <button onClick={() => hapus(a)} title="Hapus jadwal"
                        className="rounded-md p-1 text-slate-400 hover:bg-red-50 hover:text-red-600">
                        <Icon.Hapus width={15} height={15} />
                      </button>
                    </>
                  )}
                </div>
              </div>

              <dl className="mb-4 space-y-1.5 text-xs">
                <div className="flex gap-2">
                  <dt className="w-24 shrink-0 text-slate-500">Jadwal</dt>
                  <dd className="font-medium">{tanggalID(a.scheduled_date)}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="w-24 shrink-0 text-slate-500">Ketua auditor</dt>
                  <dd className="font-medium">{a.lead_auditor_name || '-'}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="w-24 shrink-0 text-slate-500">Auditee</dt>
                  <dd className="font-medium">{a.auditee_name || '-'}</dd>
                </div>
              </dl>

              <div className="mb-4 grid grid-cols-3 gap-2 rounded-lg bg-slate-50 p-2.5 text-center">
                <div>
                  <p className="text-lg font-bold tabular-nums text-slate-800">
                    {a.jumlah_dinilai}
                  </p>
                  <p className="text-[10px] uppercase tracking-wide text-slate-500">Dinilai</p>
                </div>
                <div>
                  <p className={`text-lg font-bold tabular-nums ${a.jumlah_temuan ? 'text-rose-600' : 'text-emerald-600'}`}>
                    {a.jumlah_temuan}
                  </p>
                  <p className="text-[10px] uppercase tracking-wide text-slate-500">Temuan</p>
                </div>
                <div>
                  <p className="text-lg font-bold tabular-nums text-slate-800">
                    {a.jumlah_ttd}
                  </p>
                  <p className="text-[10px] uppercase tracking-wide text-slate-500">Tanda tangan</p>
                </div>
              </div>

              <div className="mt-auto flex gap-2">
                <Link to={`/emi/${a.id}`} className="btn-outline btn-sm flex-1">
                  Lembar Penilaian
                </Link>
                <Link to={`/emi/${a.id}/berita-acara`} className="btn-primary btn-sm flex-1">
                  Berita Acara
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={buka} onClose={() => { setBuka(false); setEditId(null); }}
        title={editId ? 'Ubah Jadwal Audit Mutu Internal' : 'Jadwalkan Audit Mutu Internal'}
        footer={
          <>
            <button onClick={() => { setBuka(false); setEditId(null); }} className="btn-outline">Batal</button>
            <button onClick={buat} className="btn-primary">
              {editId ? 'Simpan Perubahan' : 'Simpan Jadwal'}
            </button>
          </>
        }
      >
        <form onSubmit={buat} className="space-y-4">
          <div>
            <label className="label">Unit yang diaudit *</label>
            <select className="select" value={f.unit_id}
              onChange={(e) => setF((p) => ({ ...p, unit_id: e.target.value, auditee_id: '' }))}>
              <option value="">Pilih unit…</option>
              {units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Ketua tim auditor</label>
              <select className="select" value={f.lead_auditor_id}
                onChange={(e) => setF((p) => ({ ...p, lead_auditor_id: e.target.value }))}>
                <option value="">Pilih auditor…</option>
                {auditorList.map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Wakil auditee</label>
              <select className="select" value={f.auditee_id}
                onChange={(e) => setF((p) => ({ ...p, auditee_id: e.target.value }))}>
                <option value="">Pilih auditee…</option>
                {auditeeList.map((u) => (
                  <option key={u.id} value={u.id}>{u.name} — {u.jabatan}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Tanggal pelaksanaan</label>
              <input type="date" className="input" value={f.scheduled_date}
                onChange={(e) => setF((p) => ({ ...p, scheduled_date: e.target.value }))} />
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
                placeholder="Ruang rapat unit" />
            </div>
          </div>
          <div>
            <label className="label">Lingkup audit</label>
            <textarea className="textarea min-h-[70px]" value={f.scope}
              onChange={(e) => setF((p) => ({ ...p, scope: e.target.value }))}
              placeholder="Seluruh standar mutu yang ditugaskan kepada unit pada periode berjalan" />
            <p className="mt-1 text-xs text-slate-500">
              Kolom "Persyaratan Standar" pada cetak Jadwal Audit terisi otomatis dari
              standar yang ditugaskan ke unit ini pada lembar penilaian — tidak perlu diisi manual.
            </p>
          </div>
          <div>
            <label className="label">Anggota tim auditor</label>
            <div className="max-h-40 space-y-1.5 overflow-y-auto rounded-lg border border-slate-200 p-3">
              {auditorList.filter((u) => String(u.id) !== String(f.lead_auditor_id)).length === 0 ? (
                <p className="text-xs text-slate-400">Tidak ada auditor lain selain ketua tim.</p>
              ) : (
                auditorList
                  .filter((u) => String(u.id) !== String(f.lead_auditor_id))
                  .map((u) => (
                    <label key={u.id} className="flex cursor-pointer items-center gap-2 text-sm">
                      <input type="checkbox" className="accent-pktj-600"
                        checked={anggota.includes(u.id)}
                        onChange={() => toggleAnggota(u.id)} />
                      {u.name}
                    </label>
                  ))
              )}
            </div>
          </div>
        </form>
      </Modal>
    </>
  );
}
