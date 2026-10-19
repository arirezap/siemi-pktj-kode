/**
 * Perender subset Markdown yang sangat terbatas, TANPA dependensi eksternal
 * dan TANPA dangerouslySetInnerHTML sama sekali — hasilnya selalu berupa
 * elemen React sungguhan (bukan string HTML), sehingga tidak ada permukaan
 * serangan XSS: teks apa pun yang diketik pengguna (termasuk tag <script>
 * literal) akan selalu diperlakukan sebagai teks biasa oleh React, tidak
 * pernah dieksekusi sebagai markup. Ini dipakai untuk isi berita/halaman
 * publik yang ditulis SPM lewat menu "Berita & Halaman".
 *
 * Sintaks yang didukung (sengaja minim, cukup untuk berita/pengumuman):
 *   ## Judul bagian     -> <h2>
 *   ### Sub judul        -> <h3>
 *   - butir daftar        -> <ul><li>
 *   **tebal**             -> <strong>
 *   *miring*               -> <em>
 *   [teks](https://...)  -> <a> (HANYA skema http/https, selain itu tautan
 *                            diabaikan dan hanya teksnya yang ditampilkan)
 *   baris kosong          -> pemisah paragraf
 *   baris baru tunggal    -> <br/> di dalam paragraf yang sama
 */

/** Ubah teks judul bagian (## .../### ...) jadi id anchor URL-aman, dipakai
 *  baik untuk atribut id heading di sini maupun untuk menyusun tautan
 *  #jangkar dari submenu navigasi publik (lihat LayoutPublik.jsx) — kedua
 *  sisi memakai fungsi yang sama persis supaya selalu cocok. */
export function idDariJudul(teks) {
  return String(teks || '')
    .toLowerCase()
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function simpulInline(teks, kunci) {
  const simpul = [];
  let n = 0;
  const re = /\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*|\*([^*]+)\*/g;
  let terakhir = 0;
  let m;
  while ((m = re.exec(teks))) {
    if (m.index > terakhir) simpul.push(teks.slice(terakhir, m.index));
    if (m[1] !== undefined) {
      const url = m[2].trim();
      if (/^https?:\/\//i.test(url)) {
        simpul.push(
          <a key={`${kunci}-${n++}`} href={url} target="_blank" rel="noreferrer"
            className="text-pktj-600 underline hover:no-underline">
            {m[1]}
          </a>
        );
      } else {
        simpul.push(m[1]); // tautan dgn skema tidak aman (mis. javascript:) -> tampilkan teksnya saja
      }
    } else if (m[3] !== undefined) {
      simpul.push(<strong key={`${kunci}-${n++}`}>{m[3]}</strong>);
    } else if (m[4] !== undefined) {
      simpul.push(<em key={`${kunci}-${n++}`}>{m[4]}</em>);
    }
    terakhir = re.lastIndex;
  }
  if (terakhir < teks.length) simpul.push(teks.slice(terakhir));
  return simpul;
}

export function RenderMarkdownRingan({ teks, className = 'space-y-4 text-[15px] leading-relaxed text-slate-700' }) {
  const blok = String(teks || '').replace(/\r\n/g, '\n').trim().split(/\n{2,}/);
  const elemen = [];
  let kunci = 0;

  for (const b of blok) {
    const baris = b.split('\n').filter((l) => l.trim() !== '');
    if (baris.length === 0) continue;

    if (baris.every((l) => /^\s*-\s+/.test(l))) {
      const k = kunci++;
      elemen.push(
        <ul key={k} className="list-disc space-y-1 pl-5">
          {baris.map((l, i) => (
            <li key={i}>{simpulInline(l.replace(/^\s*-\s+/, ''), `${k}-${i}`)}</li>
          ))}
        </ul>
      );
      continue;
    }

    const h = baris.length === 1 ? /^(#{2,3})\s+(.*)/.exec(baris[0]) : null;
    if (h) {
      const k = kunci++;
      const Tag = h[1].length === 2 ? 'h2' : 'h3';
      const kelas = h[1].length === 2
        ? 'mt-6 scroll-mt-24 text-xl font-bold text-slate-900'
        : 'mt-4 scroll-mt-24 text-lg font-semibold text-slate-900';
      // id dibuat dari teks judul (tanpa markdown) supaya bisa dituju lewat
      // tautan jangkar, mis. dari submenu navigasi publik (#kebijakan-...).
      elemen.push(<Tag key={k} id={idDariJudul(h[2])} className={kelas}>{simpulInline(h[2], k)}</Tag>);
      continue;
    }

    const k = kunci++;
    elemen.push(
      <p key={k}>
        {baris.map((l, i) => (
          <span key={i}>
            {i > 0 && <br />}
            {simpulInline(l, `${k}-${i}`)}
          </span>
        ))}
      </p>
    );
  }

  return <div className={className}>{elemen}</div>;
}
