/**
 * pdf.js — generates simple one-page resume PDFs for the demo students.
 * Written by hand (no library) using the PDF text operators, so the seed
 * script has zero extra dependencies. Only used by seed.js.
 */

const esc = (s) => String(s).replace(/[^\x20-\x7E]/g, '-').replace(/([\\()])/g, '\\$1');

/** Word-wrap a line to roughly `max` characters. */
function wrap(text, max) {
  const words = String(text).split(/\s+/);
  const lines = [];
  let cur = '';
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > max) { lines.push(cur); cur = w; } else cur = (cur + ' ' + w).trim();
  }
  if (cur) lines.push(cur);
  return lines;
}

/**
 * @param {object} r resume data: { name, headline, contact, sections: [{ title, lines: [] }] }
 * @returns {Buffer}
 */
function resumePdf(r) {
  const ops = [];
  let y = 790;
  const text = (s, x, size, font = 'F1', color = '0.13 0.15 0.2') => {
    ops.push(`BT /${font} ${size} Tf ${color} rg ${x} ${y} Td (${esc(s)}) Tj ET`);
  };
  // Header band
  ops.push('0.55 0.11 0.16 rg 0 812 595 30 re f');
  text(r.name, 50, 22, 'F2'); y -= 20;
  text(r.headline, 50, 11, 'F1', '0.4 0.42 0.47'); y -= 16;
  text(r.contact, 50, 9, 'F1', '0.4 0.42 0.47'); y -= 14;
  ops.push(`0.8 0.8 0.82 RG 0.8 w 50 ${y} m 545 ${y} l S`); y -= 22;

  for (const sec of r.sections) {
    text(sec.title.toUpperCase(), 50, 10, 'F2', '0.55 0.11 0.16'); y -= 15;
    for (const line of sec.lines) {
      for (const part of wrap(line, 95)) {
        text(part, 58, 10); y -= 14;
        if (y < 60) break;
      }
    }
    y -= 10;
    if (y < 60) break;
  }
  const stream = ops.join('\n');

  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>',
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
  ];
  let out = '%PDF-1.4\n';
  const offsets = [];
  objs.forEach((o, i) => { offsets.push(Buffer.byteLength(out)); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = Buffer.byteLength(out);
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  offsets.forEach((off) => { out += `${String(off).padStart(10, '0')} 00000 n \n`; });
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
}

module.exports = { resumePdf };
