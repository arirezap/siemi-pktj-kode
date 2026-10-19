/**
 * Perlindungan dasar untuk rute PUBLIK (tanpa login) — beranda kampus,
 * berita, halaman statis, rekap mutu. Sebelum fitur ini ditambahkan,
 * SELURUH API ada di belakang JWT sehingga lonjakan trafik otomatis
 * terbatas oleh proses login. Begitu sebagian rute dibuka tanpa token,
 * perlindungan itu hilang — dua middleware ini menggantikannya secara
 * minimal, tanpa dependensi eksternal (tidak ada akses registry npm dari
 * lingkungan pengembangan ini; lebih sedikit dependensi juga mengurangi
 * risiko gagal `npm install` di hosting bersama seperti cPanel).
 */

/** Header keamanan dasar (pengganti ringan paket "helmet"). Aman dipasang
 *  untuk semua respons, termasuk rute yang sudah berlogin — tidak mengubah
 *  perilaku aplikasi, hanya menambah header. */
export function headerKeamanan(_req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
}

/**
 * Pembatas laju in-memory sederhana (fixed window per alamat IP). Bukan
 * pengganti WAF/proksi keamanan, tapi cukup untuk mencegah scraping kasar
 * atau pembebanan tak sengaja pada situs kampus berskala kecil. Untuk
 * deployment multi-proses (cluster) pembatas ini tidak dibagi antar
 * proses — cukup untuk single-process seperti yang dipakai aplikasi ini
 * (lihat src/index.js, satu app.listen).
 */
export function batasiLajuPublik({ jendelaMs = 60_000, batas = 120 } = {}) {
  const hit = new Map(); // ip -> { count, resetAt }

  const bersihkan = setInterval(() => {
    const now = Date.now();
    for (const [ip, e] of hit) if (now > e.resetAt) hit.delete(ip);
  }, 5 * 60_000);
  bersihkan.unref?.();

  return (req, res, next) => {
    const ip = req.ip || req.socket?.remoteAddress || 'tanpa-ip';
    const now = Date.now();
    let e = hit.get(ip);
    if (!e || now > e.resetAt) {
      e = { count: 0, resetAt: now + jendelaMs };
      hit.set(ip, e);
    }
    e.count++;
    if (e.count > batas) {
      res.setHeader('Retry-After', Math.ceil((e.resetAt - now) / 1000));
      return res.status(429).json({ error: 'Terlalu banyak permintaan, coba lagi sebentar lagi.' });
    }
    next();
  };
}
