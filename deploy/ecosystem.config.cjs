// Konfigurasi PM2 untuk SIEMI PKTJ.
//   pm2 start deploy/ecosystem.config.cjs
// Rahasia (JWT_SECRET, dll.) dibaca dari server/.env, BUKAN ditulis di sini.
const path = require('node:path');

module.exports = {
  apps: [
    {
      name: 'siemi-pktj',
      cwd: path.join(__dirname, '..', 'server'),
      script: 'src/index.js',
      instances: 1,            // WAJIB 1: SQLite tidak boleh ditulis banyak proses sekaligus
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '500M',
      time: true,              // beri cap waktu di log
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
