/**
 * dbview.js — look inside the database from cmd (READ-ONLY, never changes anything)
 *
 *   node dbview.js                    -> list all tables and how many rows each has
 *   node dbview.js students           -> show the rows of one table
 *   node dbview.js "SELECT ..."       -> run your own SELECT query
 */
const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');

const FILE = path.join(__dirname, 'data', 'portal.db');
// When showing a whole table, only the most useful columns are printed so it fits in cmd.
// (Use your own SELECT to see any other column.)
const COLUMNS = {
  users: 'id, email, role, name, created_at',
  students: 'id, name, roll_no, branch, year, cgpa, backlogs, phone, is_verified AS verified, resume_name',
  companies: 'id, name, sector, hq, contact_name, contact_email',
  drives: 'id, company_id, role, job_type, ctc_lpa, min_cgpa, allowed_branches, deadline, status',
  applications: 'id, student_id, drive_id, status, stage, assigned_by_tpo, created_at',
  announcements: 'id, title, audience, audience_value, is_pinned, created_at',
  notifications: 'id, student_id, message, is_read, created_at',
  otps: "id, email, purpose, attempts, datetime(expires_at / 1000, 'unixepoch') AS expires_utc",
};

function show(rows) {
  if (!rows.length) return console.log('\n  (no rows)\n');
  const cols = Object.keys(rows[0]);
  const cut = (v) => { const s = v === null ? '-' : String(v); return s.length > 28 ? s.slice(0, 26) + '..' : s; };
  const width = cols.map((c) => Math.max(c.length, ...rows.map((r) => cut(r[c]).length)));
  const line = (vals) => '  ' + vals.map((v, i) => String(v).padEnd(width[i])).join(' | ');
  console.log('\n' + line(cols));
  console.log('  ' + width.map((w) => '-'.repeat(w)).join('-+-'));
  rows.forEach((r) => console.log(line(cols.map((c) => cut(r[c])))));
  console.log(`\n  ${rows.length} row${rows.length === 1 ? '' : 's'}\n`);
}

(async () => {
  if (!fs.existsSync(FILE)) { console.log('\n  No database yet. Run "npm start" once first.\n'); return; }
  const SQL = await initSqlJs({ locateFile: (f) => path.join(__dirname, 'node_modules', 'sql.js', 'dist', f) });
  const db = new SQL.Database(fs.readFileSync(FILE)); // loaded into memory only — the file is never written
  const all = (sql) => { const r = db.exec(sql); return r.length ? r[0].values.map((v) => Object.fromEntries(r[0].columns.map((c, i) => [c, v[i]]))) : []; };

  const arg = process.argv.slice(2).join(' ').trim();
  try {
    if (!arg) {
      const tables = all("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name");
      console.log('\n  Tables in data\\portal.db');
      show(tables.map((t) => ({ table: t.name, rows: all(`SELECT COUNT(*) AS n FROM "${t.name}"`)[0].n })));
      console.log('  See a table:   node dbview.js students');
      console.log('  Own query:     node dbview.js "SELECT name, cgpa FROM students WHERE cgpa >= 8"\n');
    } else if (/^\w+$/.test(arg)) {
      show(all(`SELECT ${COLUMNS[arg] || '*'} FROM "${arg}" LIMIT 200`));
    } else {
      if (!/^\s*select\b/i.test(arg)) { console.log('\n  Only SELECT queries are allowed here (this tool never changes data).\n'); return; }
      show(all(arg));
    }
  } catch (err) {
    console.log('\n  Error: ' + err.message + '\n');
  }
})();
