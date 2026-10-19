import { useEffect, useState } from 'react';
import { api, ROLE_LABEL, tanggalID, tanggalWaktuID } from '../api.js';
import { useAuth } from '../auth.jsx';
import { Badge, Icon, JudulHalaman, Memuat, Modal, useToast } from '../components/ui.jsx';

const TIPE_UNIT = [
  ['pimpinan', 'Pimpinan'], ['senat', 'Senat'], ['satuan', 'Satuan'],
  ['pusat', 'Pusat'], ['bagian', 'Bagian'], ['prodi', 'Program Studi'], ['unit', 'Unit'],
  ['sub_unit', 'Sub-Unit Kerja'],
];

export default function Master() {
  const { user, setPeriode } = useAuth();
  const bolehKelolaPengguna = user?.role === 'admin';
  const { tampil, Toast } = useToast();
  const [tab, setTab] = useState('periode');

  const [periods, setPeriods] = useState([]);
  const [units, setUnits] = useState([]);
  const [users, setUsers] = useState([]);
  const [log, setLog] = useState([]);
  const [jenjangList, setJenjangList] = useState([]);

  const [mPeriode, setMPeriode] = useState(null);
  const [mUnit, setMUnit] = useState(null);
  const [unitJenjangManual, setUnitJenjangManual] = useState(false);
  const [mUser, setMUser] = useState(null);

  async function muat() {
    const [p, un, jj] = await Promise.all([
      api.get('/master/periods'), api.get('/master/units'), api.get('/master/jenjang'),
    ]);
    setPeriods(p); setUnits(un); setJenjangList(jj);
    if (bolehKelolaPengguna) {
      try { setUsers(await api.get('/master/users')); } catch { /* abaikan */ }
    }
    try { setLog(await api.get('/master/log')); } catch { /* abaikan */ }
  }
  useEffect(() => { muat(); }, []);

  // Hanya admin yang boleh membuka tab Pengguna — cegah tab tersangkut di
  // 'pengguna' bila peran berubah atau state lama tersisa.
  useEffect(() => {
    if (tab === 'pengguna' && !bolehKelolaPengguna) setTab('periode');
  }, [tab, bolehKelolaPengguna]);

  async function simpanPeriode() {
    try {
      if (mPeriode.id) await api.put(`/master/periods/${mPeriode.id}`, mPeriode);
      else await api.post('/master/periods', mPeriode);
      tampil('Periode tersimpan');
      setMPeriode(null);
      await muat();
      setPeriode(await api.get('/master/periods/aktif'));
    } catch (e) { tampil(e.message, 'galat'); }
  }

  async function simpanUnit() {
    try {
      if (mUnit.id) await api.put(`/master/units/${mUnit.id}`, mUnit);
      else await api.post('/master/units', mUnit);
      tampil('Unit tersimpan'); setMUnit(null); muat();
    } catch (e) { tampil(e.message, 'galat'); }
  }

  async function simpanUser() {
    try {
      if (mUser.id) await api.put(`/master/users/${mUser.id}`, mUser);
      else await api.post('/master/users', mUser);
      tampil('Pengguna tersimpan'); setMUser(null); muat();
    } catch (e) { tampil(e.message, 'galat'); }
  }

  if (!periods.length && !units.length) return <Memuat />;

  return (
    <>
      <Toast />
      <JudulHalaman
        ikon={<Icon.Master width={20} height={20} />}
        judul="Data Master"
        deskripsi="Pengelolaan periode siklus SPMI, struktur organisasi, dan pengguna aplikasi"
      />

      <div className="mb-5 flex flex-wrap gap-2">
        {[
          ['periode', `Periode (${periods.length})`],
          ['unit', `Unit Organisasi (${units.length})`],
          ...(bolehKelolaPengguna ? [['pengguna', `Pengguna (${users.length})`]] : []),
          ['log', 'Log Aktivitas'],
        ].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              tab === k ? 'bg-pktj-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-100'
            }`}>
            {l}
          </button>
        ))}
      </div>

      {/* PERIODE */}
      {tab === 'periode' && (
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
            <h2 className="text-sm font-semibold">Periode Siklus SPMI</h2>
            <button
              onClick={() => setMPeriode({ name: '', year: new Date().getFullYear(), start_date: '', end_date: '', status: 'draft' })}
              className="btn-primary btn-sm">
              <Icon.Plus width={14} height={14} /> Periode Baru
            </button>
          </div>
          <table className="w-full">
            <thead>
              <tr>
                <th className="th">Nama Periode</th>
                <th className="th w-20">Tahun</th>
                <th className="th w-32">Mulai</th>
                <th className="th w-32">Selesai</th>
                <th className="th w-28">Status</th>
                <th className="th w-20"></th>
              </tr>
            </thead>
            <tbody>
              {periods.map((p) => (
                <tr key={p.id}>
                  <td className="td font-medium">{p.name}</td>
                  <td className="td text-xs">{p.year}</td>
                  <td className="td text-xs">{tanggalID(p.start_date)}</td>
                  <td className="td text-xs">{tanggalID(p.end_date)}</td>
                  <td className="td">
                    <Badge cls={p.status === 'aktif' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'}>
                      {p.status}
                    </Badge>
                  </td>
                  <td className="td">
                    <button onClick={() => setMPeriode(p)} className="btn-outline btn-sm">Ubah</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* UNIT */}
      {tab === 'unit' && (
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
            <h2 className="text-sm font-semibold">Struktur Organisasi PKTJ</h2>
            <button
              onClick={() => {
                setMUnit({ code: '', name: '', type: 'unit', jenjang: null, parent_id: null });
                setUnitJenjangManual(false);
              }}
              className="btn-primary btn-sm">
              <Icon.Plus width={14} height={14} /> Unit Baru
            </button>
          </div>
          <table className="w-full">
            <thead>
              <tr>
                <th className="th w-32">Kode</th>
                <th className="th">Nama Unit</th>
                <th className="th w-40">Jenis</th>
                <th className="th w-44">Unit Induk / Jenjang</th>
                <th className="th w-20"></th>
              </tr>
            </thead>
            <tbody>
              {units.map((u) => (
                <tr key={u.id}>
                  <td className="td font-mono text-xs font-semibold text-pktj-700">{u.code}</td>
                  <td className="td text-sm">{u.name}</td>
                  <td className="td">
                    <span className="badge bg-slate-100 text-slate-700">
                      {TIPE_UNIT.find(([k]) => k === u.type)?.[1] || u.type}
                    </span>
                  </td>
                  <td className="td text-xs text-slate-600">
                    {u.type === 'prodi'
                      ? (u.jenjang || <span className="italic text-rose-500">belum diisi</span>)
                      : u.type === 'sub_unit'
                        ? (u.parent_name || <span className="italic text-rose-500">belum diisi</span>)
                        : '-'}
                  </td>
                  <td className="td">
                    <button
                      onClick={() => {
                        setMUnit(u);
                        setUnitJenjangManual(!!u.jenjang && !jenjangList.includes(u.jenjang));
                      }}
                      className="btn-outline btn-sm">Ubah</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* PENGGUNA — hanya terlihat dan dapat diakses oleh akun Administrator */}
      {tab === 'pengguna' && bolehKelolaPengguna && (
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
            <h2 className="text-sm font-semibold">Pengguna Aplikasi</h2>
            <button onClick={() => setMUser({ name: '', email: '', password: '', role: 'auditee', jabatan: '', unit_id: '' })}
              className="btn-primary btn-sm">
              <Icon.Plus width={14} height={14} /> Pengguna Baru
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="th">Nama</th>
                  <th className="th w-56">Surel</th>
                  <th className="th w-40">Peran</th>
                  <th className="th w-48">Unit</th>
                  <th className="th w-20">Aktif</th>
                  <th className="th w-20"></th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td className="td">
                      <p className="text-sm font-medium">{u.name}</p>
                      <p className="text-xs text-slate-500">{u.jabatan}</p>
                    </td>
                    <td className="td font-mono text-xs">{u.email}</td>
                    <td className="td">
                      <span className="badge bg-pktj-50 text-pktj-700">
                        {ROLE_LABEL[u.role]}
                      </span>
                    </td>
                    <td className="td text-xs">{u.unit_name || '-'}</td>
                    <td className="td text-center">{u.is_active ? '✓' : '—'}</td>
                    <td className="td">
                      {bolehKelolaPengguna && (
                        <button onClick={() => setMUser({ ...u, password: '' })}
                          className="btn-outline btn-sm">Ubah</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* LOG */}
      {tab === 'log' && (
        <div className="card overflow-hidden">
          <div className="border-b border-slate-200 px-5 py-3">
            <h2 className="text-sm font-semibold">200 Aktivitas Terakhir</h2>
          </div>
          <table className="w-full">
            <thead>
              <tr>
                <th className="th w-44">Waktu</th>
                <th className="th w-48">Pengguna</th>
                <th className="th w-48">Aksi</th>
                <th className="th">Keterangan</th>
              </tr>
            </thead>
            <tbody>
              {log.map((l) => (
                <tr key={l.id}>
                  <td className="td text-xs">{tanggalWaktuID(l.created_at)}</td>
                  <td className="td text-xs">{l.user_name || '-'}</td>
                  <td className="td text-xs font-medium">{l.aksi.replace(/_/g, ' ')}</td>
                  <td className="td text-xs text-slate-500">
                    {l.entity} #{l.entity_id} {l.keterangan || ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal periode */}
      <Modal open={!!mPeriode} onClose={() => setMPeriode(null)}
        title={mPeriode?.id ? 'Ubah Periode' : 'Periode Baru'}
        footer={
          <>
            <button onClick={() => setMPeriode(null)} className="btn-outline">Batal</button>
            <button onClick={simpanPeriode} className="btn-primary">Simpan</button>
          </>
        }>
        {mPeriode && (
          <div className="space-y-4">
            <div>
              <label className="label">Nama periode *</label>
              <input className="input" value={mPeriode.name}
                onChange={(e) => setMPeriode({ ...mPeriode, name: e.target.value })}
                placeholder="Siklus SPMI Tahun Akademik 2026/2027" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label">Tahun *</label>
                <input type="number" className="input" value={mPeriode.year}
                  onChange={(e) => setMPeriode({ ...mPeriode, year: Number(e.target.value) })} />
              </div>
              <div>
                <label className="label">Status</label>
                <select className="select" value={mPeriode.status}
                  onChange={(e) => setMPeriode({ ...mPeriode, status: e.target.value })}>
                  <option value="draft">Draf</option>
                  <option value="aktif">Aktif</option>
                  <option value="selesai">Selesai</option>
                </select>
              </div>
              <div>
                <label className="label">Tanggal mulai</label>
                <input type="date" className="input" value={mPeriode.start_date || ''}
                  onChange={(e) => setMPeriode({ ...mPeriode, start_date: e.target.value })} />
              </div>
              <div>
                <label className="label">Tanggal selesai</label>
                <input type="date" className="input" value={mPeriode.end_date || ''}
                  onChange={(e) => setMPeriode({ ...mPeriode, end_date: e.target.value })} />
              </div>
            </div>
            <p className="rounded-lg bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
              Hanya satu periode yang dapat berstatus aktif. Menetapkan periode ini aktif
              akan mengubah periode aktif sebelumnya menjadi selesai.
            </p>
          </div>
        )}
      </Modal>

      {/* Modal unit */}
      <Modal open={!!mUnit} onClose={() => setMUnit(null)}
        title={mUnit?.id ? 'Ubah Unit' : 'Unit Baru'}
        footer={
          <>
            <button onClick={() => setMUnit(null)} className="btn-outline">Batal</button>
            <button onClick={simpanUnit} className="btn-primary">Simpan</button>
          </>
        }>
        {mUnit && (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className="label">Kode *</label>
                <input className="input font-mono" value={mUnit.code}
                  onChange={(e) => setMUnit({ ...mUnit, code: e.target.value })} />
              </div>
              <div className="sm:col-span-2">
                <label className="label">Nama unit *</label>
                <input className="input" value={mUnit.name}
                  onChange={(e) => setMUnit({ ...mUnit, name: e.target.value })} />
              </div>
            </div>
            <div>
              <label className="label">Jenis unit *</label>
              <select className="select" value={mUnit.type}
                onChange={(e) => setMUnit({
                  ...mUnit, type: e.target.value,
                  parent_id: e.target.value === 'sub_unit' ? mUnit.parent_id : null,
                })}>
                {TIPE_UNIT.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
            </div>
            {mUnit.type === 'sub_unit' && (
              <div>
                <label className="label">Unit Induk *</label>
                <select className="select" value={mUnit.parent_id || ''}
                  onChange={(e) => setMUnit({ ...mUnit, parent_id: e.target.value ? Number(e.target.value) : null })}>
                  <option value="">Pilih unit induk…</option>
                  {units.filter((u) => u.type !== 'sub_unit' && u.id !== mUnit.id).map((u) => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
                <p className="mt-1 text-[11px] text-slate-400">
                  Sub-unit kerja ini akan tampil sebagai pilihan opsional saat unit induknya
                  menyusun program kerja pada modul Sasaran Mutu.
                </p>
              </div>
            )}
            {mUnit.type === 'prodi' && (() => {
              const custom = unitJenjangManual || (!!mUnit.jenjang && !jenjangList.includes(mUnit.jenjang));
              return (
                <div>
                  <label className="label">Jenjang *</label>
                  <select className="select" value={custom ? '__lain__' : (mUnit.jenjang || '')}
                    onChange={(e) => {
                      if (e.target.value === '__lain__') {
                        setUnitJenjangManual(true);
                        setMUnit({ ...mUnit, jenjang: '' });
                      } else {
                        setUnitJenjangManual(false);
                        setMUnit({ ...mUnit, jenjang: e.target.value });
                      }
                    }}>
                    <option value="">Pilih jenjang…</option>
                    {jenjangList.map((j) => <option key={j} value={j}>{j}</option>)}
                    <option value="__lain__">+ Jenjang baru…</option>
                  </select>
                  {custom && (
                    <input className="input mt-2" autoFocus
                      placeholder="Nama jenjang baru, mis. Magister Terapan"
                      value={mUnit.jenjang || ''}
                      onChange={(e) => setMUnit({ ...mUnit, jenjang: e.target.value })} />
                  )}
                  <p className="mt-1 text-xs text-slate-500">
                    Menentukan acuan LAM yang dipakai pada modul Penjaminan Mutu Eksternal.
                    Tulis persis sama dengan jenjang yang ditandai pada acuan terkait di menu
                    Acuan Mutu agar bisa saling ditemukan.
                  </p>
                </div>
              );
            })()}
          </div>
        )}
      </Modal>

      {/* Modal pengguna */}
      <Modal open={!!mUser} onClose={() => setMUser(null)}
        title={mUser?.id ? 'Ubah Pengguna' : 'Pengguna Baru'}
        footer={
          <>
            <button onClick={() => setMUser(null)} className="btn-outline">Batal</button>
            <button onClick={simpanUser} className="btn-primary">Simpan</button>
          </>
        }>
        {mUser && (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label">Nama lengkap *</label>
                <input className="input" value={mUser.name}
                  onChange={(e) => setMUser({ ...mUser, name: e.target.value })} />
              </div>
              <div>
                <label className="label">NIP</label>
                <input className="input font-mono" value={mUser.nip || ''}
                  onChange={(e) => setMUser({ ...mUser, nip: e.target.value })} />
              </div>
              <div>
                <label className="label">Surel *</label>
                <input type="email" className="input" value={mUser.email}
                  onChange={(e) => setMUser({ ...mUser, email: e.target.value })} />
              </div>
              <div>
                <label className="label">
                  Kata sandi {mUser.id && <span className="text-slate-400">(kosongkan bila tidak diubah)</span>}
                </label>
                <input type="password" className="input" value={mUser.password || ''}
                  onChange={(e) => setMUser({ ...mUser, password: e.target.value })} />
              </div>
              <div>
                <label className="label">Peran *</label>
                <select className="select" value={mUser.role}
                  onChange={(e) => setMUser({ ...mUser, role: e.target.value })}>
                  {Object.entries(ROLE_LABEL).map(([k, l]) => (
                    <option key={k} value={k}>{l}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Unit</label>
                <select className="select" value={mUser.unit_id || ''}
                  onChange={(e) => setMUser({ ...mUser, unit_id: e.target.value || null })}>
                  <option value="">Tanpa unit</option>
                  {units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="label">Jabatan</label>
                <input className="input" value={mUser.jabatan || ''}
                  onChange={(e) => setMUser({ ...mUser, jabatan: e.target.value })} />
              </div>
            </div>
            {mUser.id && (
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" className="accent-pktj-600" checked={!!mUser.is_active}
                  onChange={(e) => setMUser({ ...mUser, is_active: e.target.checked ? 1 : 0 })} />
                Akun aktif
              </label>
            )}
          </div>
        )}
      </Modal>
    </>
  );
}
