import { useEffect, useState } from 'react';
import { api, tanggalID } from '../api.js';
import { useAuth } from '../auth.jsx';
import {
  Icon, JudulHalaman, Kosong, Memuat, Modal, useToast,
} from '../components/ui.jsx';

const JENIS_LABEL = {
  pelatihan_spmi: 'Sertifikat Pelatihan SPMI',
  sertifikat_auditor: 'Sertifikat Auditor',
  lainnya: 'Sertifikat / Pelatihan Lainnya',
};
const JENIS_WAJIB = ['pelatihan_spmi', 'sertifikat_auditor'];
const PEMENUHAN_CLS = {
  berlaku: 'bg-emerald-100 text-emerald-800',
  kedaluwarsa: 'bg-amber-100 text-amber-800',
  belum: 'bg-rose-100 text-rose-800',
};
const PEMENUHAN_LABEL = { berlaku: 'Berlaku', kedaluwarsa: 'Kedaluwarsa', belum: 'Belum Ada' };

const FORM_KOSONG = {
  jenis: 'pelatihan_spmi', nama: '', penyelenggara: '', nomor_sertifikat: '',
  tanggal_terbit: '', tanggal_kedaluwarsa: '', berkas_url: '', keterangan: '',
};

export default function KompetensiAuditor() {
  const { user, bolehSPM } = useAuth();
  const { tampil, Toast } = useToast();
  const isAuditor = user.role === 'auditor';

  const [sertifikatSaya, setSertifikatSaya] = useState(null);
  const [daftarAuditor, setDaftarAuditor] = useState(null);
  const [auditorAktif, setAuditorAktif] = useState(null);
  const [mSert, setMSert] = useState(null);
  const [simpan, setSimpan] = useState(false);

  async function muatSaya() {
    setSertifikatSaya(await api.get('/kompetensi/saya'));
  }

  async function muatSpm() {
    const d = await api.get('/kompetensi');
    setDaftarAuditor(d);
    setAuditorAktif((aktif) => (aktif ? d.find((a) => a.id === aktif.id) || null : null));
  }

  useEffect(() => {
    if (isAuditor) muatSaya();
    if (bolehSPM) muatSpm();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function unggah(file) {
    if (!file) return;
    const data = await new Promise((res) => {
      const r = new FileReader();
      r.onload = () => res(r.result);
      r.readAsDataURL(file);
    });
    try {
      const r = await api.post('/pelaksanaan/unggah-bukti', { filename: file.name, data });
      setMSert((p) => ({ ...p, berkas_url: r.url }));
      tampil('Berkas terunggah');
    } catch (e) { tampil(e.message, 'galat'); }
  }

  async function simpanSertifikat() {
    if (!mSert.nama?.trim())
      return tampil('Nama sertifikat/pelatihan wajib diisi', 'galat');
    setSimpan(true);
    try {
      if (mSert.id) await api.put(`/kompetensi/${mSert.id}`, mSert);
      else await api.post('/kompetensi', mSert);
      tampil('Sertifikat tersimpan');
      setMSert(null);
      if (isAuditor) await muatSaya();
      if (bolehSPM) await muatSpm();
    } catch (e) { tampil(e.message, 'galat'); }
    finally { setSimpan(false); }
  }

  async function hapusSertifikat(c) {
    if (!confirm(`Hapus sertifikat "${c.nama}"? Tindakan ini tidak dapat dibatalkan.`)) return;
    try {
      await api.del(`/kompetensi/${c.id}`);
      tampil('Sertifikat dihapus');
      if (isAuditor) await muatSaya();
      if (bolehSPM) await muatSpm();
    } catch (e) { tampil(e.message, 'galat'); }
  }

  if ((isAuditor && !sertifikatSaya) || (bolehSPM && !daftarAuditor)) return <Memuat />;

  return (
    <>
      <Toast />
      <JudulHalaman
        ikon={<Icon.Sertifikat width={20} height={20} />}
        judul="Manajemen Auditor"
        deskripsi="Kompetensi auditor: sertifikat pelatihan SPMI dan sertifikat auditor"
      />

      {isAuditor && (
        <div className="card mb-6 overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
            <h2 className="text-sm font-semibold">Sertifikat Saya</h2>
            <button onClick={() => setMSert({ ...FORM_KOSONG })} className="btn-primary btn-sm">
              <Icon.Plus width={14} height={14} /> Sertifikat Baru
            </button>
          </div>
          {sertifikatSaya.length === 0 ? (
            <div className="p-6">
              <Kosong judul="Belum ada sertifikat"
                pesan="Tambahkan sertifikat pelatihan SPMI dan sertifikat auditor yang Anda miliki agar dapat dipantau oleh SPM." />
            </div>
          ) : (
            <TabelSertifikat daftar={sertifikatSaya}
              onUbah={(c) => setMSert({ ...c })} onHapus={hapusSertifikat} />
          )}
        </div>
      )}

      {bolehSPM && (
        <div className="card overflow-hidden">
          <div className="border-b border-slate-200 px-5 py-3">
            <h2 className="text-sm font-semibold">Pemenuhan Kompetensi Auditor</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Auditor baru ditambahkan lewat Data Master → Pengguna.
            </p>
          </div>
          {daftarAuditor.length === 0 ? (
            <div className="p-6">
              <Kosong judul="Belum ada akun auditor"
                pesan="Tambahkan akun auditor terlebih dahulu lewat menu Data Master → Pengguna." />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="th">Nama</th>
                    <th className="th w-56">Jabatan / Unit</th>
                    {JENIS_WAJIB.map((j) => (
                      <th key={j} className="th w-44">{JENIS_LABEL[j]}</th>
                    ))}
                    <th className="th w-36"></th>
                  </tr>
                </thead>
                <tbody>
                  {daftarAuditor.map((a) => (
                    <tr key={a.id}>
                      <td className="td text-sm font-medium">{a.name}</td>
                      <td className="td text-xs text-slate-500">
                        {a.jabatan || '-'}{a.unit_name && ` · ${a.unit_name}`}
                      </td>
                      {JENIS_WAJIB.map((j) => (
                        <td key={j} className="td">
                          <span className={`badge ${PEMENUHAN_CLS[a.pemenuhan[j]]}`}>
                            {PEMENUHAN_LABEL[a.pemenuhan[j]]}
                          </span>
                        </td>
                      ))}
                      <td className="td">
                        <button onClick={() => setAuditorAktif(a)} className="btn-outline btn-sm">
                          Kelola Sertifikat
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Detail & kelola sertifikat satu auditor (SPM) */}
      <Modal
        open={!!auditorAktif} onClose={() => setAuditorAktif(null)}
        title={auditorAktif ? `Sertifikat — ${auditorAktif.name}` : ''}
        footer={<button onClick={() => setAuditorAktif(null)} className="btn-outline">Tutup</button>}
      >
        {auditorAktif && (
          <div className="space-y-4">
            <button
              onClick={() => setMSert({ ...FORM_KOSONG, user_id: auditorAktif.id })}
              className="btn-primary btn-sm">
              <Icon.Plus width={14} height={14} /> Tambah Sertifikat
            </button>
            {auditorAktif.sertifikat.length === 0 ? (
              <p className="text-sm text-slate-500">Belum ada sertifikat.</p>
            ) : (
              <TabelSertifikat daftar={auditorAktif.sertifikat}
                onUbah={(c) => setMSert({ ...c })} onHapus={hapusSertifikat} />
            )}
          </div>
        )}
      </Modal>

      {/* Form tambah/ubah sertifikat */}
      <Modal
        open={!!mSert} onClose={() => setMSert(null)}
        title={mSert?.id ? 'Ubah Sertifikat' : 'Sertifikat Baru'}
        footer={
          <>
            <button onClick={() => setMSert(null)} className="btn-outline">Batal</button>
            <button onClick={simpanSertifikat} className="btn-primary" disabled={simpan}>
              Simpan
            </button>
          </>
        }
      >
        {mSert && (
          <div className="space-y-4">
            <div>
              <label className="label">Jenis *</label>
              <select className="select" value={mSert.jenis}
                onChange={(e) => setMSert((p) => ({ ...p, jenis: e.target.value }))}>
                {Object.entries(JENIS_LABEL).map(([k, l]) => (
                  <option key={k} value={k}>{l}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Nama sertifikat / pelatihan *</label>
              <input className="input" value={mSert.nama}
                onChange={(e) => setMSert((p) => ({ ...p, nama: e.target.value }))}
                placeholder="mis. Pelatihan Auditor Mutu Internal Perguruan Tinggi" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label">Penyelenggara</label>
                <input className="input" value={mSert.penyelenggara || ''}
                  onChange={(e) => setMSert((p) => ({ ...p, penyelenggara: e.target.value }))} />
              </div>
              <div>
                <label className="label">Nomor sertifikat</label>
                <input className="input font-mono" value={mSert.nomor_sertifikat || ''}
                  onChange={(e) => setMSert((p) => ({ ...p, nomor_sertifikat: e.target.value }))} />
              </div>
              <div>
                <label className="label">Tanggal terbit</label>
                <input type="date" className="input" value={mSert.tanggal_terbit || ''}
                  onChange={(e) => setMSert((p) => ({ ...p, tanggal_terbit: e.target.value }))} />
              </div>
              <div>
                <label className="label">Berlaku sampai (kedaluwarsa)</label>
                <input type="date" className="input" value={mSert.tanggal_kedaluwarsa || ''}
                  onChange={(e) => setMSert((p) => ({ ...p, tanggal_kedaluwarsa: e.target.value }))} />
              </div>
            </div>
            <div>
              <label className="label">Berkas sertifikat</label>
              <div className="flex gap-2">
                <input className="input" value={mSert.berkas_url || ''}
                  onChange={(e) => setMSert((p) => ({ ...p, berkas_url: e.target.value }))}
                  placeholder="https:// atau unggah berkas" />
                <label className="btn-outline btn-sm cursor-pointer whitespace-nowrap">
                  Unggah
                  <input type="file" className="hidden"
                    onChange={(e) => unggah(e.target.files?.[0])} />
                </label>
              </div>
            </div>
            <div>
              <label className="label">Keterangan</label>
              <textarea className="textarea min-h-[60px]" value={mSert.keterangan || ''}
                onChange={(e) => setMSert((p) => ({ ...p, keterangan: e.target.value }))} />
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}

function TabelSertifikat({ daftar, onUbah, onHapus }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr>
            <th className="th w-48">Jenis</th>
            <th className="th">Nama</th>
            <th className="th w-28">Terbit</th>
            <th className="th w-28">Kedaluwarsa</th>
            <th className="th w-16">Berkas</th>
            <th className="th w-28"></th>
          </tr>
        </thead>
        <tbody>
          {daftar.map((c) => (
            <tr key={c.id}>
              <td className="td text-xs">
                <span className="badge bg-pktj-50 text-pktj-700">
                  {JENIS_LABEL[c.jenis] || c.jenis}
                </span>
              </td>
              <td className="td text-sm">
                <p className="font-medium">{c.nama}</p>
                {c.penyelenggara && <p className="text-xs text-slate-500">{c.penyelenggara}</p>}
              </td>
              <td className="td text-xs">{tanggalID(c.tanggal_terbit)}</td>
              <td className="td text-xs">{tanggalID(c.tanggal_kedaluwarsa)}</td>
              <td className="td">
                {c.berkas_url ? (
                  <a href={c.berkas_url} target="_blank" rel="noreferrer"
                    className="text-xs text-pktj-600 hover:underline">
                    Lihat
                  </a>
                ) : '-'}
              </td>
              <td className="td">
                <div className="flex gap-1">
                  <button onClick={() => onUbah(c)} className="btn-outline btn-sm">Ubah</button>
                  <button onClick={() => onHapus(c)}
                    className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600">
                    <Icon.Hapus width={14} height={14} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
