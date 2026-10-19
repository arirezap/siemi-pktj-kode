import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

import { initSchema, DATA_DIR } from './db.js';
import authRoutes from './routes/auth.js';
import masterRoutes from './routes/master.js';
import standarRoutes from './routes/standar.js';
import pelaksanaanRoutes from './routes/pelaksanaan.js';
import sasaranMutuRoutes from './routes/sasaranMutu.js';
import emiRoutes from './routes/emi.js';
import pengendalianRoutes from './routes/pengendalian.js';
import rtmRoutes from './routes/rtm.js';
import dashboardRoutes from './routes/dashboard.js';
import acuanRoutes from './routes/acuan.js';
import kompetensiRoutes from './routes/kompetensi.js';
import spmeRoutes from './routes/spme.js';
import publikRoutes from './routes/publik.js';
import kontenRoutes from './routes/konten.js';
import { headerKeamanan, batasiLajuPublik } from './lib/keamananPublik.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 4000;

initSchema();

const app = express();
app.set('trust proxy', 1); // di belakang reverse proxy (mis. cPanel/Passenger) — perlu utk req.ip yang benar pada pembatas laju
app.use(cors());
app.use(headerKeamanan);
app.use(express.json({ limit: '15mb' })); // besar: menampung data URL tanda tangan

// Berkas bukti yang diunggah
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
app.use('/uploads', express.static(UPLOAD_DIR));

app.get('/api/health', (_req, res) =>
  res.json({ ok: true, app: 'EMI PKTJ', time: new Date().toISOString() })
);

app.use('/api/auth', authRoutes);
app.use('/api/master', masterRoutes);
app.use('/api/standar', standarRoutes);
app.use('/api/pelaksanaan', pelaksanaanRoutes);
app.use('/api/sasaran-mutu', sasaranMutuRoutes);
app.use('/api/emi', emiRoutes);
app.use('/api/pengendalian', pengendalianRoutes);
app.use('/api/rtm', rtmRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/acuan', acuanRoutes);
app.use('/api/kompetensi', kompetensiRoutes);
app.use('/api/spme', spmeRoutes);
app.use('/api/konten', kontenRoutes);

// Rute PUBLIK — tanpa JWT (lihat routes/publik.js untuk aturan keamanan yang
// wajib dijaga di sana). Dibatasi laju khusus di sini karena satu-satunya
// bagian API yang bisa diakses tanpa login.
app.use('/api/publik', batasiLajuPublik(), publikRoutes);

// Sajikan hasil build frontend bila tersedia (mode produksi satu server)
const CLIENT_DIST = path.join(__dirname, '..', '..', 'client', 'dist');
if (fs.existsSync(CLIENT_DIST)) {
  app.use(express.static(CLIENT_DIST));
  app.get(/^(?!\/api).*/, (_req, res) =>
    res.sendFile(path.join(CLIENT_DIST, 'index.html'))
  );
}

// Penanganan galat terpusat
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Kesalahan server' });
});

app.listen(PORT, () => {
  console.log(`\n  EMI PKTJ API berjalan di http://localhost:${PORT}`);
  console.log(`  Basis data : ${path.join(DATA_DIR, 'emi-pktj.db')}\n`);
});
