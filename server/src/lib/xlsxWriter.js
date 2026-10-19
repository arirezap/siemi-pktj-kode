import zlib from 'node:zlib';

/**
 * Penulis .xlsx minimal tanpa dependensi eksternal (murni Node built-in:
 * zlib untuk CRC32). Dipakai untuk fitur ekspor Excel (Acuan Mutu, Matriks
 * Penetapan Standar, dsb.) supaya tidak perlu menambah paket npm baru pada
 * server. Mendukung: banyak sheet, sel teks/angka, lebar kolom, tinggi
 * baris (opsional — bila tidak diisi, Excel/LibreOffice menghitung sendiri
 * tinggi baris untuk sel yang wrapText saat berkas dibuka), warna latar
 * per baris, font (ukuran/tebal/miring/warna), garis tepi tipis, perataan
 * teks (termasuk wrap text), dan panel beku (freeze panes).
 *
 * Pemakaian:
 *   const buf = buatWorkbookXlsx([
 *     {
 *       nama: 'Sheet1',
 *       kolom: [{ lebar: 12 }, { lebar: 30 }],
 *       beku: { kolom: 1, baris: 1 },
 *       baris: [
 *         { nilai: ['Kode', 'Judul'], gaya: GAYA.header, tinggi: 24 },
 *         { nilai: ['A.1', 'Contoh'], gaya: GAYA.data('DBEAFE') },
 *       ],
 *     },
 *   ]);
 */

function crc32(buf) {
  return zlib.crc32(buf) >>> 0;
}

function dosDateTime(date = new Date()) {
  const dosTime =
    ((date.getHours() & 0x1f) << 11) |
    ((date.getMinutes() & 0x3f) << 5) |
    (Math.floor(date.getSeconds() / 2) & 0x1f);
  const dosDate =
    (((date.getFullYear() - 1980) & 0x7f) << 9) |
    (((date.getMonth() + 1) & 0xf) << 5) |
    (date.getDate() & 0x1f);
  return { dosTime, dosDate };
}

/** Bungkus daftar { name, data(Buffer) } jadi satu berkas .zip (metode STORED). */
function zipkan(entries) {
  const { dosTime, dosDate } = dosDateTime();
  const potonganLokal = [];
  const potonganSentral = [];
  let offset = 0;

  for (const { name, data } of entries) {
    const namaBuf = Buffer.from(name, 'utf8');
    const crc = crc32(data);
    const ukuran = data.length;

    const lokal = Buffer.alloc(30);
    lokal.writeUInt32LE(0x04034b50, 0);
    lokal.writeUInt16LE(20, 4);
    lokal.writeUInt16LE(0, 6);
    lokal.writeUInt16LE(0, 8);
    lokal.writeUInt16LE(dosTime, 10);
    lokal.writeUInt16LE(dosDate, 12);
    lokal.writeUInt32LE(crc, 14);
    lokal.writeUInt32LE(ukuran, 18);
    lokal.writeUInt32LE(ukuran, 22);
    lokal.writeUInt16LE(namaBuf.length, 26);
    lokal.writeUInt16LE(0, 28);
    potonganLokal.push(lokal, namaBuf, data);

    const sentral = Buffer.alloc(46);
    sentral.writeUInt32LE(0x02014b50, 0);
    sentral.writeUInt16LE(20, 4);
    sentral.writeUInt16LE(20, 6);
    sentral.writeUInt16LE(0, 8);
    sentral.writeUInt16LE(0, 10);
    sentral.writeUInt16LE(dosTime, 12);
    sentral.writeUInt16LE(dosDate, 14);
    sentral.writeUInt32LE(crc, 16);
    sentral.writeUInt32LE(ukuran, 20);
    sentral.writeUInt32LE(ukuran, 24);
    sentral.writeUInt16LE(namaBuf.length, 28);
    sentral.writeUInt16LE(0, 30);
    sentral.writeUInt16LE(0, 32);
    sentral.writeUInt16LE(0, 34);
    sentral.writeUInt16LE(0, 36);
    sentral.writeUInt32LE(0, 38);
    sentral.writeUInt32LE(offset, 42);
    potonganSentral.push(sentral, namaBuf);

    offset += lokal.length + namaBuf.length + ukuran;
  }

  const dirSentral = Buffer.concat(potonganSentral);
  const offsetDirSentral = offset;

  const akhir = Buffer.alloc(22);
  akhir.writeUInt32LE(0x06054b50, 0);
  akhir.writeUInt16LE(0, 4);
  akhir.writeUInt16LE(0, 6);
  akhir.writeUInt16LE(entries.length, 8);
  akhir.writeUInt16LE(entries.length, 10);
  akhir.writeUInt32LE(dirSentral.length, 12);
  akhir.writeUInt32LE(offsetDirSentral, 16);
  akhir.writeUInt16LE(0, 20);

  return Buffer.concat([...potonganLokal, dirSentral, akhir]);
}

function escapeXml(v) {
  return String(v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
    // Karakter kendali (selain tab/LF/CR) tidak valid di XML 1.0 — buang saja.
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
}

function kolomKe(n) {
  let s = '';
  let x = n;
  while (x > 0) {
    const sisa = (x - 1) % 26;
    s = String.fromCharCode(65 + sisa) + s;
    x = Math.floor((x - 1) / 26);
  }
  return s;
}

/* --------------------------- Gaya sel siap pakai -------------------------- */

/** Palet pastel dipakai untuk menandai baris data per kelompok (mis. per ranah). */
export const PALET_BARIS = ['DBEAFE', 'DCFCE7', 'FEF3C7', 'EDE9FE', 'FFE4E6', 'E2E8F0'];

export const GAYA = {
  judul: {
    font: { name: 'Arial', size: 14, bold: true, color: 'FFFFFF' },
    fill: '0F172A',
    align: { h: 'left', v: 'center', indent: 1 },
  },
  subjudul: {
    font: { name: 'Arial', size: 10, italic: true, color: 'FFFFFF' },
    fill: '0F172A',
    align: { h: 'left', v: 'center', indent: 1 },
  },
  header: {
    font: { name: 'Arial', size: 10, bold: true, color: 'FFFFFF' },
    fill: '1D4ED8',
    align: { h: 'left', v: 'center', wrap: true, indent: 1 },
    border: true,
  },
  /** Baris data berwarna — fillHex mis. salah satu dari PALET_BARIS. */
  data: (fillHex) => ({
    font: { name: 'Arial', size: 9 },
    fill: fillHex || null,
    align: { h: 'left', v: 'top', wrap: true, indent: 1 },
    border: true,
  }),
};

/* ----------------------------- Registri gaya ------------------------------ */

function buatRegistriGaya() {
  const fonts = [{ name: 'Calibri', size: 11, bold: false, italic: false, color: null }];
  const fills = [{ type: 'none' }, { type: 'gray125' }];
  const borders = [{ thin: false }];
  const xfs = [{ fontId: 0, fillId: 0, borderId: 0, align: null }];

  const fontIx = new Map([[JSON.stringify(fonts[0]), 0]]);
  const fillIx = new Map([[JSON.stringify(fills[0]), 0], [JSON.stringify(fills[1]), 1]]);
  const borderIx = new Map([[JSON.stringify(borders[0]), 0]]);
  const xfIx = new Map([[JSON.stringify(xfs[0]), 0]]);

  function idFont(f) {
    const norm = {
      name: f?.name || 'Calibri', size: f?.size || 11,
      bold: !!f?.bold, italic: !!f?.italic, color: f?.color || null,
    };
    const key = JSON.stringify(norm);
    if (!fontIx.has(key)) { fontIx.set(key, fonts.length); fonts.push(norm); }
    return fontIx.get(key);
  }
  function idFill(hex) {
    const norm = hex ? { type: 'solid', rgb: hex.toUpperCase() } : { type: 'none' };
    const key = JSON.stringify(norm);
    if (!fillIx.has(key)) { fillIx.set(key, fills.length); fills.push(norm); }
    return fillIx.get(key);
  }
  function idBorder(thin) {
    const norm = { thin: !!thin };
    const key = JSON.stringify(norm);
    if (!borderIx.has(key)) { borderIx.set(key, borders.length); borders.push(norm); }
    return borderIx.get(key);
  }
  function idXf(gaya) {
    if (!gaya) return 0;
    const norm = {
      fontId: idFont(gaya.font),
      fillId: idFill(gaya.fill),
      borderId: idBorder(gaya.border),
      align: gaya.align || null,
    };
    const key = JSON.stringify(norm);
    if (!xfIx.has(key)) { xfIx.set(key, xfs.length); xfs.push(norm); }
    return xfIx.get(key);
  }

  return { fonts, fills, borders, xfs, idXf };
}

function fontXml(f) {
  const bits = [`<sz val="${f.size}"/>`];
  if (f.color) bits.push(`<color rgb="FF${f.color}"/>`);
  bits.push(`<name val="${escapeXml(f.name)}"/>`);
  if (f.bold) bits.push('<b/>');
  if (f.italic) bits.push('<i/>');
  return `<font>${bits.join('')}</font>`;
}

function fillXml(f) {
  if (f.type === 'solid')
    return `<fill><patternFill patternType="solid"><fgColor rgb="FF${f.rgb}"/><bgColor indexed="64"/></patternFill></fill>`;
  if (f.type === 'gray125') return `<fill><patternFill patternType="gray125"/></fill>`;
  return `<fill><patternFill patternType="none"/></fill>`;
}

function borderXml(b) {
  if (!b.thin) return `<border><left/><right/><top/><bottom/><diagonal/></border>`;
  const sisi = `<color indexed="64"/>`;
  return (
    `<border>` +
    `<left style="thin">${sisi}</left><right style="thin">${sisi}</right>` +
    `<top style="thin">${sisi}</top><bottom style="thin">${sisi}</bottom><diagonal/>` +
    `</border>`
  );
}

function alignmentXml(a) {
  if (!a) return '';
  const attrs = [
    `horizontal="${a.h || 'left'}"`,
    `vertical="${a.v || 'top'}"`,
  ];
  if (a.wrap) attrs.push('wrapText="1"');
  if (a.indent) attrs.push(`indent="${a.indent}"`);
  return `<alignment ${attrs.join(' ')}/>`;
}

function xfXml(xf) {
  const align = alignmentXml(xf.align);
  const attrs =
    `numFmtId="0" fontId="${xf.fontId}" fillId="${xf.fillId}" borderId="${xf.borderId}" xfId="0"` +
    (xf.fontId ? ' applyFont="1"' : '') +
    (xf.fillId ? ' applyFill="1"' : '') +
    (xf.borderId ? ' applyBorder="1"' : '') +
    (align ? ' applyAlignment="1"' : '');
  return align ? `<xf ${attrs}>${align}</xf>` : `<xf ${attrs}/>`;
}

function buatStylesXml(registri) {
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
    `<fonts count="${registri.fonts.length}">${registri.fonts.map(fontXml).join('')}</fonts>` +
    `<fills count="${registri.fills.length}">${registri.fills.map(fillXml).join('')}</fills>` +
    `<borders count="${registri.borders.length}">${registri.borders.map(borderXml).join('')}</borders>` +
    `<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>` +
    `<cellXfs count="${registri.xfs.length}">${registri.xfs.map(xfXml).join('')}</cellXfs>` +
    `<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>` +
    `</styleSheet>`
  );
}

/* ------------------------------ Sheet XML ---------------------------------- */

function sheetXml(sheet, registri) {
  const jumlahKolom =
    sheet.kolom?.length || Math.max(1, ...sheet.baris.map((b) => (b.nilai || []).length));

  const colsXml = sheet.kolom?.length
    ? `<cols>${sheet.kolom
        .map((k, i) =>
          k?.lebar
            ? `<col min="${i + 1}" max="${i + 1}" width="${k.lebar}" customWidth="1"/>`
            : ''
        )
        .join('')}</cols>`
    : '';

  const rowsXml = sheet.baris
    .map((row, ri) => {
      const rNum = ri + 1;
      const s = registri.idXf(row.gaya);
      const nKolom = row.gaya ? jumlahKolom : (row.nilai || []).length;
      const cells = [];
      for (let ci = 0; ci < nKolom; ci++) {
        const val = row.nilai?.[ci];
        const ref = `${kolomKe(ci + 1)}${rNum}`;
        const sAttr = s ? ` s="${s}"` : '';
        if (val == null || val === '') {
          cells.push(s ? `<c r="${ref}"${sAttr}/>` : '');
        } else if (typeof val === 'number' && Number.isFinite(val)) {
          cells.push(`<c r="${ref}"${sAttr}><v>${val}</v></c>`);
        } else {
          cells.push(
            `<c r="${ref}" t="inlineStr"${sAttr} xml:space="preserve"><is><t xml:space="preserve">${escapeXml(
              val
            )}</t></is></c>`
          );
        }
      }
      const htAttr = row.tinggi ? ` ht="${row.tinggi}" customHeight="1"` : '';
      return `<row r="${rNum}"${htAttr}>${cells.join('')}</row>`;
    })
    .join('');

  const beku = sheet.beku;
  let sheetViewsXml = '';
  if (beku?.kolom || beku?.baris) {
    const xSplit = beku.kolom || 0;
    const ySplit = beku.baris || 0;
    const topLeft = `${kolomKe(xSplit + 1)}${ySplit + 1}`;
    const activePane = xSplit && ySplit ? 'bottomRight' : xSplit ? 'topRight' : 'bottomLeft';
    sheetViewsXml =
      `<sheetViews><sheetView workbookViewId="0">` +
      `<pane${xSplit ? ` xSplit="${xSplit}"` : ''}${ySplit ? ` ySplit="${ySplit}"` : ''} ` +
      `topLeftCell="${topLeft}" activePane="${activePane}" state="frozen"/>` +
      `</sheetView></sheetViews>`;
  }

  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
    sheetViewsXml +
    colsXml +
    `<sheetData>${rowsXml}</sheetData>` +
    `</worksheet>`
  );
}

/**
 * @param {Array<{
 *   nama: string,
 *   kolom?: Array<{lebar?: number}>,
 *   beku?: { kolom?: number, baris?: number },
 *   baris: Array<{ nilai: Array<string|number|null>, gaya?: object, tinggi?: number }>,
 * }>} sheets
 * @returns {Buffer}
 */
export function buatWorkbookXlsx(sheets) {
  const registri = buatRegistriGaya();
  // Pra-daftarkan semua gaya dulu supaya urutan index stabil & deterministik
  // sebelum XML sheet ditulis (idXf men-dedup, jadi aman dipanggil berulang).
  for (const sheet of sheets) for (const row of sheet.baris) registri.idXf(row.gaya);

  const namaAman = (s, i) =>
    String(s || `Sheet${i + 1}`)
      .replace(/[:\\/?*[\]]/g, ' ')
      .slice(0, 31) || `Sheet${i + 1}`;

  const contentTypes =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
    `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
    `<Default Extension="xml" ContentType="application/xml"/>` +
    `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
    `<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>` +
    sheets
      .map(
        (_s, i) =>
          `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`
      )
      .join('') +
    `</Types>`;

  const rootRels =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>` +
    `</Relationships>`;

  const workbookXml =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
    `<sheets>` +
    sheets
      .map(
        (s, i) =>
          `<sheet name="${escapeXml(namaAman(s.nama, i))}" sheetId="${i + 1}" r:id="rId${i + 2}"/>`
      )
      .join('') +
    `</sheets>` +
    `</workbook>`;

  const workbookRels =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
    sheets
      .map(
        (_s, i) =>
          `<Relationship Id="rId${i + 2}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`
      )
      .join('') +
    `</Relationships>`;

  const entries = [
    { name: '[Content_Types].xml', data: Buffer.from(contentTypes, 'utf8') },
    { name: '_rels/.rels', data: Buffer.from(rootRels, 'utf8') },
    { name: 'xl/workbook.xml', data: Buffer.from(workbookXml, 'utf8') },
    { name: 'xl/_rels/workbook.xml.rels', data: Buffer.from(workbookRels, 'utf8') },
    { name: 'xl/styles.xml', data: Buffer.from(buatStylesXml(registri), 'utf8') },
    ...sheets.map((s, i) => ({
      name: `xl/worksheets/sheet${i + 1}.xml`,
      data: Buffer.from(sheetXml(s, registri), 'utf8'),
    })),
  ];

  return zipkan(entries);
}
