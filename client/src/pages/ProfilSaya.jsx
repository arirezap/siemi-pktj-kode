import { useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { Icon, JudulHalaman, useToast } from '../components/ui.jsx';

/**
 * Halaman "Profil Saya" — akun MILIK SENDIRI, terbuka untuk semua peran yang
 * sudah login (beda dari Data Master > Pengguna yang khusus admin mengelola
 * akun ORANG LAIN). Dua form terpisah:
 *  - Ubah Surel: lewat PUT /auth/surel, wajib konfirmasi kata sandi saat ini
 *    supaya sesi yang dibajak tidak bisa mengganti surel pemulihan akun.
 *  - Ubah Kata Sandi: memakai endpoint yang sudah ada, POST /auth/ubah-sandi.
 */
const BAGIAN = [
  { kunci: 'surel', label: 'Surel', ikon: 'Pengguna' },
  { kunci: 'sandi', label: 'Kata Sandi', ikon: 'Kunci' },
];

export default function ProfilSaya() {
  const { user, setUser } = useAuth();
  const { tampil, Toast } = useToast();
  const [bagian, setBagian] = useState('surel'); // 'surel' | 'sandi'

  const [emailBaru, setEmailBaru] = useState(user?.email || '');
  const [sandiKonfirmasiSurel, setSandiKonfirmasiSurel] = useState('');
  const [simpanSurel, setSimpanSurel] = useState(false);

  const [sandiLama, setSandiLama] = useState('');
  const [sandiBaru, setSandiBaru] = useState('');
  const [sandiBaruUlang, setSandiBaruUlang] = useState('');
  const [simpanSandi, setSimpanSandi] = useState(false);

  async function simpanEmail() {
    if (!emailBaru.trim()) return tampil('Surel wajib diisi', 'galat');
    if (!sandiKonfirmasiSurel) return tampil('Masukkan kata sandi saat ini untuk konfirmasi', 'galat');
    setSimpanSurel(true);
    try {
      const r = await api.put('/auth/surel', {
        email: emailBaru.trim(), sandi_saat_ini: sandiKonfirmasiSurel,
      });
      setUser((u) => ({ ...u, email: r.email }));
      setSandiKonfirmasiSurel('');
      tampil('Surel berhasil diperbarui');
    } catch (e) { tampil(e.message, 'galat'); }
    finally { setSimpanSurel(false); }
  }

  async function simpanKataSandi() {
    if (!sandiLama) return tampil('Masukkan kata sandi lama', 'galat');
    if (sandiBaru.length < 6) return tampil('Kata sandi baru minimal 6 karakter', 'galat');
    if (sandiBaru !== sandiBaruUlang) return tampil('Konfirmasi kata sandi baru tidak cocok', 'galat');
    setSimpanSandi(true);
    try {
      await api.post('/auth/ubah-sandi', { sandi_lama: sandiLama, sandi_baru: sandiBaru });
      setSandiLama(''); setSandiBaru(''); setSandiBaruUlang('');
      tampil('Kata sandi berhasil diperbarui');
    } catch (e) { tampil(e.message, 'galat'); }
    finally { setSimpanSandi(false); }
  }

  return (
    <>
      <Toast />
      <JudulHalaman
        ikon={<Icon.Pengguna width={20} height={20} />}
        judul="Profil Saya"
        deskripsi="Kelola surel dan kata sandi akun Anda sendiri"
      />

      <div className="flex flex-col gap-6 lg:flex-row">
        {/* Menu kiri */}
        <nav className="flex gap-1 overflow-x-auto lg:w-56 lg:shrink-0 lg:flex-col lg:overflow-visible">
          {BAGIAN.map((b) => {
            const Ik = Icon[b.ikon];
            return (
              <button key={b.kunci} onClick={() => setBagian(b.kunci)}
                className={`flex shrink-0 items-center gap-2.5 rounded-lg px-3.5 py-2.5 text-sm font-medium transition-colors ${
                  bagian === b.kunci ? 'bg-pktj-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}>
                <Ik width={16} height={16} />
                {b.label}
              </button>
            );
          })}
        </nav>

        {/* Form kanan */}
        <div className="card-p flex-1">
          {bagian === 'surel' ? (
            <>
              <h2 className="mb-1 text-sm font-semibold">Ubah Surel</h2>
              <p className="mb-4 text-xs text-slate-500">
                Surel saat ini: <span className="font-medium text-slate-700">{user?.email}</span>
              </p>
              <div className="max-w-md space-y-4">
                <div>
                  <label className="label">Surel baru *</label>
                  <input type="email" className="input" value={emailBaru}
                    onChange={(e) => setEmailBaru(e.target.value)} />
                </div>
                <div>
                  <label className="label">Kata sandi saat ini *</label>
                  <input type="password" className="input" value={sandiKonfirmasiSurel}
                    onChange={(e) => setSandiKonfirmasiSurel(e.target.value)}
                    placeholder="untuk konfirmasi identitas" />
                </div>
                <button onClick={simpanEmail} className="btn-primary" disabled={simpanSurel}>
                  {simpanSurel ? 'Menyimpan…' : 'Simpan Surel'}
                </button>
              </div>
            </>
          ) : (
            <>
              <h2 className="mb-1 text-sm font-semibold">Ubah Kata Sandi</h2>
              <p className="mb-4 text-xs text-slate-500">Minimal 6 karakter.</p>
              <div className="max-w-md space-y-4">
                <div>
                  <label className="label">Kata sandi lama *</label>
                  <input type="password" className="input" value={sandiLama}
                    onChange={(e) => setSandiLama(e.target.value)} />
                </div>
                <div>
                  <label className="label">Kata sandi baru *</label>
                  <input type="password" className="input" value={sandiBaru}
                    onChange={(e) => setSandiBaru(e.target.value)} />
                </div>
                <div>
                  <label className="label">Ulangi kata sandi baru *</label>
                  <input type="password" className="input" value={sandiBaruUlang}
                    onChange={(e) => setSandiBaruUlang(e.target.value)} />
                </div>
                <button onClick={simpanKataSandi} className="btn-primary" disabled={simpanSandi}>
                  {simpanSandi ? 'Menyimpan…' : 'Simpan Kata Sandi'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
