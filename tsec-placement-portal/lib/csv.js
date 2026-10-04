/**
 * Tiny CSV builder — no library needed.
 * Every value is quoted and inner quotes are doubled, so commas / newlines
 * inside values never break the file. A UTF-8 BOM is added so Excel opens
 * the file with the right encoding (₹ symbol, names, etc.).
 */
function toCsv(columns, rows) {
  const esc = (v) => {
    if (v === null || v === undefined) return '""';
    let s = String(v);
    // Protect against "CSV injection" when opened in Excel.
    if (/^[=+\-@]/.test(s)) s = "'" + s;
    return '"' + s.replace(/"/g, '""') + '"';
  };
  const header = columns.map((c) => esc(c.label)).join(',');
  const body = rows.map((r) => columns.map((c) => esc(typeof c.value === 'function' ? c.value(r) : r[c.key])).join(','));
  return '﻿' + [header, ...body].join('\r\n');
}

function sendCsv(res, filename, columns, rows) {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(toCsv(columns, rows));
}

module.exports = { toCsv, sendCsv };
