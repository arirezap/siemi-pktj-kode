import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './auth.jsx';
import Layout from './components/Layout.jsx';
import { Memuat } from './components/ui.jsx';

import Masuk from './pages/Masuk.jsx';
import Beranda from './pages/Beranda.jsx';
import BerandaPublik from './pages/publik/BerandaPublik.jsx';
import Berita from './pages/publik/Berita.jsx';
import BeritaDetail from './pages/publik/BeritaDetail.jsx';
import HalamanStatis from './pages/publik/HalamanStatis.jsx';
import RekapitulasiMutu from './pages/publik/RekapitulasiMutu.jsx';
import KelolaKonten from './pages/KelolaKonten.jsx';
import Standar from './pages/Standar.jsx';
import StandarForm from './pages/StandarForm.jsx';
import Pelaksanaan from './pages/Pelaksanaan.jsx';
import SasaranMutu from './pages/SasaranMutu.jsx';
import SasaranMutuCetak from './pages/SasaranMutuCetak.jsx';
import EMI from './pages/EMI.jsx';
import EMIDetail from './pages/EMIDetail.jsx';
import BeritaAcara from './pages/BeritaAcara.jsx';
import AuditChecklist from './pages/AuditChecklist.jsx';
import Pengendalian from './pages/Pengendalian.jsx';
import PengendalianDetail from './pages/PengendalianDetail.jsx';
import FormPTK from './pages/FormPTK.jsx';
import DaftarPTK from './pages/DaftarPTK.jsx';
import JadwalAudit from './pages/JadwalAudit.jsx';
import RTM from './pages/RTM.jsx';
import RTMDetail from './pages/RTMDetail.jsx';
import NotulenRTM from './pages/NotulenRTM.jsx';
import Master from './pages/Master.jsx';
import Acuan from './pages/Acuan.jsx';
import Cakupan from './pages/Cakupan.jsx';
import KompetensiAuditor from './pages/KompetensiAuditor.jsx';
import ProfilSaya from './pages/ProfilSaya.jsx';
import SPME from './pages/SPME.jsx';
import SPMEDetail from './pages/SPMEDetail.jsx';

function Terlindungi({ children, peran }) {
  const { user, loading } = useAuth();
  const lokasi = useLocation();

  if (loading) return <Memuat teks="Menyiapkan aplikasi…" />;
  if (!user) return <Navigate to="/masuk" state={{ dari: lokasi }} replace />;
  if (peran && !peran.includes(user.role) && user.role !== 'admin')
    return <Navigate to="/beranda" replace />;
  return <Layout>{children}</Layout>;
}

/** Rute tak dikenal: pengguna yang sudah masuk diarahkan ke dashboard
 *  internal, pengunjung tanpa akun diarahkan ke beranda publik. */
function RuteTidakDitemukan() {
  const { user, loading } = useAuth();
  if (loading) return <Memuat teks="Menyiapkan aplikasi…" />;
  return <Navigate to={user ? '/beranda' : '/'} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/masuk" element={<Masuk />} />

      {/* ---------------------------- Publik (tanpa login) ------------------------------ */}
      <Route path="/" element={<BerandaPublik />} />
      <Route path="/berita" element={<Berita />} />
      <Route path="/berita/:slug" element={<BeritaDetail />} />
      <Route path="/rekapitulasi-mutu" element={<RekapitulasiMutu />} />
      <Route path="/halaman/:slug" element={<HalamanStatis />} />

      {/* ------------------------------- Dashboard internal ------------------------------ */}
      <Route path="/beranda" element={<Terlindungi><Beranda /></Terlindungi>} />
      <Route path="/konten" element={<Terlindungi peran={['spm']}><KelolaKonten /></Terlindungi>} />

      <Route path="/acuan" element={<Terlindungi><Acuan /></Terlindungi>} />
      <Route path="/cakupan" element={<Terlindungi><Cakupan /></Terlindungi>} />

      <Route path="/standar" element={<Terlindungi><Standar /></Terlindungi>} />
      <Route path="/standar/baru" element={<Terlindungi peran={['spm']}><StandarForm /></Terlindungi>} />
      <Route path="/standar/:id" element={<Terlindungi><StandarForm /></Terlindungi>} />

      <Route path="/pelaksanaan" element={<Terlindungi><Pelaksanaan /></Terlindungi>} />
      <Route path="/sasaran-mutu" element={<Terlindungi><SasaranMutu /></Terlindungi>} />
      <Route path="/sasaran-mutu/cetak" element={<Terlindungi><SasaranMutuCetak /></Terlindungi>} />

      <Route path="/emi" element={<Terlindungi><EMI /></Terlindungi>} />
      <Route path="/emi/cetak-jadwal" element={<Terlindungi><JadwalAudit /></Terlindungi>} />
      <Route path="/emi/:id" element={<Terlindungi><EMIDetail /></Terlindungi>} />
      <Route path="/emi/:id/berita-acara" element={<Terlindungi><BeritaAcara /></Terlindungi>} />
      <Route path="/emi/:id/checklist" element={<Terlindungi><AuditChecklist /></Terlindungi>} />

      <Route path="/pengendalian" element={<Terlindungi><Pengendalian /></Terlindungi>} />
      <Route path="/pengendalian/daftar-ptk" element={<Terlindungi><DaftarPTK /></Terlindungi>} />
      <Route path="/pengendalian/:findingId" element={<Terlindungi><PengendalianDetail /></Terlindungi>} />
      <Route path="/pengendalian/:findingId/form-ptk" element={<Terlindungi><FormPTK /></Terlindungi>} />

      <Route path="/rtm" element={<Terlindungi><RTM /></Terlindungi>} />
      <Route path="/rtm/:id/cetak" element={<Terlindungi><NotulenRTM /></Terlindungi>} />
      <Route path="/rtm/:id" element={<Terlindungi><RTMDetail /></Terlindungi>} />

      <Route path="/spme" element={<Terlindungi><SPME /></Terlindungi>} />
      <Route path="/spme/:kunci" element={<Terlindungi><SPMEDetail /></Terlindungi>} />

      <Route path="/master" element={<Terlindungi peran={['spm']}><Master /></Terlindungi>} />

      <Route path="/manajemen-auditor" element={
        <Terlindungi peran={['auditor', 'spm']}><KompetensiAuditor /></Terlindungi>
      } />

      <Route path="/profil" element={<Terlindungi><ProfilSaya /></Terlindungi>} />

      <Route path="*" element={<RuteTidakDitemukan />} />
    </Routes>
  );
}
