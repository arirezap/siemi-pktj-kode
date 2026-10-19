import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';

export default function Masuk() {
  const { user, masuk, loading } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState('');
  const [sandi, setSandi] = useState('');
  const [galat, setGalat] = useState('');
  const [proses, setProses] = useState(false);

  if (loading) return null;
  if (user) return <Navigate to="/beranda" replace />;

  async function kirim(e) {
    e.preventDefault();
    setGalat('');
    setProses(true);
    try {
      await masuk(email, sandi);
      nav('/beranda', { replace: true });
    } catch (err) {
      setGalat(err.message);
    } finally {
      setProses(false);
    }
  }

  return (
    <div className="flex min-h-screen">
      {/* Panel kiri */}
      <div className="hidden flex-1 flex-col justify-between bg-pktj-800 p-12 text-white lg:flex">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-aksen-500 text-base font-extrabold text-pktj-900">
            MI
          </div>
          <div>
            <p className="font-bold tracking-wide">SIEMI PKTJ</p>
            <p className="text-xs text-pktj-200">Sistem Evaluasi Mutu Internal</p>
          </div>
        </div>

        <div className="max-w-lg">
          <h1 className="text-3xl font-bold leading-tight">
            Penjaminan mutu internal dalam satu siklus terpadu
          </h1>
          <p className="mt-4 leading-relaxed text-pktj-100">
            Aplikasi ini menaungi siklus PPEPP Politeknik Keselamatan Transportasi
            Jalan: penetapan standar oleh Satuan Penjaminan Mutu, pelaksanaan oleh
            seluruh unit, evaluasi oleh auditor, pengendalian melalui tindakan
            koreksi, hingga Rapat Tinjauan Manajemen.
          </p>

          <div className="mt-8 grid grid-cols-5 gap-2 text-center text-[11px]">
            {['Penetapan', 'Pelaksanaan', 'Evaluasi', 'Pengendalian', 'Peningkatan'].map(
              (t, i) => (
                <div key={t} className="rounded-lg bg-white/10 px-2 py-3">
                  <p className="text-lg font-bold text-aksen-400">{i + 1}</p>
                  <p className="mt-1 text-pktj-100">{t}</p>
                </div>
              )
            )}
          </div>
        </div>

        <p className="text-xs text-pktj-300">
          Mengacu pada ISO 21001:2018 dan Instrumen Akreditasi LAM Teknik 2025
        </p>
      </div>

      {/* Formulir */}
      <div className="flex flex-1 items-center justify-center bg-slate-50 p-6">
        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-pktj-700 text-base font-extrabold text-white">
              MI
            </div>
            <div>
              <p className="font-bold text-slate-900">SIEMI PKTJ</p>
              <p className="text-xs text-slate-500">Sistem Evaluasi Mutu Internal</p>
            </div>
          </div>

          <h2 className="text-2xl font-bold">Masuk</h2>
          <p className="mt-1 text-sm text-slate-500">
            Gunakan akun institusi PKTJ Anda.
          </p>

          <form onSubmit={kirim} className="mt-6 space-y-4">
            <div>
              <label className="label">Alamat surel</label>
              <input
                type="email" className="input" value={email} autoComplete="username"
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nama@pktj.ac.id" required
              />
            </div>
            <div>
              <label className="label">Kata sandi</label>
              <input
                type="password" className="input" value={sandi} autoComplete="current-password"
                onChange={(e) => setSandi(e.target.value)}
                placeholder="••••••••" required
              />
            </div>

            {galat && (
              <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-700">
                {galat}
              </div>
            )}

            <button className="btn-primary w-full" disabled={proses}>
              {proses ? 'Memproses…' : 'Masuk'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
