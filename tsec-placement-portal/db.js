/**
 * db.js — Database layer
 * ----------------------------------------------------------------------------
 * We use SQLite through "sql.js" (SQLite compiled to WebAssembly).
 * Why sql.js instead of a native driver? It needs NO C++ build tools, so
 * `npm install` works on every Windows / Mac / Linux laptop and every Node
 * version. The whole database lives in ONE file: data/portal.db
 *
 * sql.js keeps the database in memory; after every write we save it back to
 * disk (atomically, via a temp file + rename) so nothing is ever lost.
 *
 * Helper API used everywhere in the routes:
 *   db.all(sql, params)  -> array of rows
 *   db.get(sql, params)  -> first row or undefined
 *   db.run(sql, params)  -> { id, changes }
 *   db.tx(() => { ... }) -> runs several statements as one transaction
 * Always use "?" placeholders — never build SQL with string concatenation.
 */
const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');

const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'portal.db');

let SQL = null;
let db = null;
let txDepth = 0;
let lastMtime = 0;

const SCHEMA = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('STUDENT','TPO')),
  name          TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS students (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id         INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  roll_no         TEXT NOT NULL UNIQUE COLLATE NOCASE,
  branch          TEXT NOT NULL,
  year            TEXT NOT NULL CHECK (year IN ('TE','BE')),
  gender          TEXT,
  dob             TEXT,
  phone           TEXT,
  cgpa            REAL,
  backlogs        INTEGER NOT NULL DEFAULT 0,
  tenth_pct       REAL,
  twelfth_pct     REAL,
  diploma_pct     REAL,
  skills          TEXT,
  linkedin        TEXT,
  github          TEXT,
  about           TEXT,
  resume_path     TEXT,
  resume_name     TEXT,
  resume_uploaded_at TEXT,
  is_verified     INTEGER NOT NULL DEFAULT 0,
  verified_at     TEXT,
  tpo_remark      TEXT,
  announcements_seen_at TEXT NOT NULL DEFAULT '1970-01-01 00:00:00',
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS companies (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT NOT NULL UNIQUE COLLATE NOCASE,
  sector        TEXT,
  website       TEXT,
  hq            TEXT,
  contact_name  TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  notes         TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS drives (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id       INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  role             TEXT NOT NULL,
  job_type         TEXT NOT NULL DEFAULT 'Full-time' CHECK (job_type IN ('Full-time','Internship','Internship + PPO')),
  ctc_lpa          REAL NOT NULL,
  location         TEXT,
  description      TEXT,
  min_cgpa         REAL NOT NULL DEFAULT 0,
  max_backlogs     INTEGER NOT NULL DEFAULT 0,
  min_tenth        REAL NOT NULL DEFAULT 0,
  min_twelfth      REAL NOT NULL DEFAULT 0,
  allowed_branches TEXT NOT NULL,          -- comma separated branch codes
  eligible_years   TEXT NOT NULL DEFAULT 'BE',
  rounds           TEXT NOT NULL,          -- JSON array of round names
  deadline         TEXT NOT NULL,          -- 'YYYY-MM-DD HH:MM'
  drive_date       TEXT,
  status           TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','CLOSED')),
  created_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

-- status: ACTIVE (still in process), SELECTED, REJECTED, WITHDRAWN
-- stage : 0 = Applied, 1..n = the drive's rounds, n+1 = Selected
CREATE TABLE IF NOT EXISTS applications (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id      INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  drive_id        INTEGER NOT NULL REFERENCES drives(id) ON DELETE CASCADE,
  status          TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','SELECTED','REJECTED','WITHDRAWN')),
  stage           INTEGER NOT NULL DEFAULT 0,
  assigned_by_tpo INTEGER NOT NULL DEFAULT 0,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (student_id, drive_id)
);

CREATE TABLE IF NOT EXISTS announcements (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  title          TEXT NOT NULL,
  body           TEXT NOT NULL,
  audience       TEXT NOT NULL DEFAULT 'ALL' CHECK (audience IN ('ALL','BRANCH','DRIVE')),
  audience_value TEXT,
  is_pinned      INTEGER NOT NULL DEFAULT 0,
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS notifications (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id  INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  message     TEXT NOT NULL,
  link        TEXT,
  is_read     INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- One-time passwords for email verification and password reset.
-- The code itself is never stored, only an HMAC of it.
CREATE TABLE IF NOT EXISTS otps (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  email        TEXT NOT NULL COLLATE NOCASE,
  purpose      TEXT NOT NULL CHECK (purpose IN ('REGISTER','RESET')),
  code_hash    TEXT NOT NULL,
  payload      TEXT,                     -- pending registration data (JSON)
  attempts     INTEGER NOT NULL DEFAULT 0,
  expires_at   INTEGER NOT NULL,         -- epoch milliseconds
  last_sent_at INTEGER NOT NULL,
  UNIQUE (email, purpose)
);

CREATE INDEX IF NOT EXISTS idx_app_student ON applications(student_id);
CREATE INDEX IF NOT EXISTS idx_app_drive   ON applications(drive_id);
CREATE INDEX IF NOT EXISTS idx_notif_student ON notifications(student_id, is_read);
`;

/** Convert JS values into something SQLite understands. */
function clean(params = []) {
  return params.map((v) => {
    if (v === undefined) return null;
    if (typeof v === 'boolean') return v ? 1 : 0;
    return v;
  });
}

function save() {
  if (!db || txDepth > 0) return;
  const data = db.export();
  // db.export() turns foreign keys off in sql.js — switch them back on.
  db.run('PRAGMA foreign_keys = ON');
  const tmp = DB_FILE + '.tmp';
  fs.writeFileSync(tmp, Buffer.from(data));
  fs.renameSync(tmp, DB_FILE);
  lastMtime = fs.statSync(DB_FILE).mtimeMs;
}

/**
 * If someone ran `npm run reset` while the server was running, the file on
 * disk is newer than our in-memory copy — reload it instead of overwriting it.
 */
function reloadIfChanged() {
  if (!db || txDepth > 0 || !fs.existsSync(DB_FILE)) return false;
  const m = fs.statSync(DB_FILE).mtimeMs;
  if (m === lastMtime) return false;
  db.close();
  db = new SQL.Database(fs.readFileSync(DB_FILE));
  db.run('PRAGMA foreign_keys = ON');
  lastMtime = m;
  return true;
}

function all(sql, params) {
  const stmt = db.prepare(sql);
  try {
    stmt.bind(clean(params));
    const rows = [];
    while (stmt.step()) rows.push(stmt.getAsObject());
    return rows;
  } finally {
    stmt.free();
  }
}

function get(sql, params) {
  return all(sql, params)[0];
}

function run(sql, params) {
  db.run(sql, clean(params));
  const changes = db.getRowsModified();
  const id = get('SELECT last_insert_rowid() AS id').id;
  save();
  return { id, changes };
}

/** Run fn() inside a transaction — all statements succeed, or none do. */
function tx(fn) {
  if (txDepth === 0) db.run('BEGIN');
  txDepth++;
  try {
    const result = fn();
    txDepth--;
    if (txDepth === 0) {
      db.run('COMMIT');
      save();
    }
    return result;
  } catch (err) {
    txDepth--;
    if (txDepth === 0) db.run('ROLLBACK');
    throw err;
  }
}

/**
 * Open (or create) the database file.
 * @param {{fresh?: boolean}} opts  fresh = delete the old DB and start empty
 * @returns {boolean} true if a brand-new database was created
 */
async function init(opts = {}) {
  if (!SQL) {
    SQL = await initSqlJs({
      locateFile: (f) => path.join(__dirname, 'node_modules', 'sql.js', 'dist', f),
    });
  }
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

  let created = false;
  if (!opts.fresh && fs.existsSync(DB_FILE)) {
    db = new SQL.Database(fs.readFileSync(DB_FILE));
  } else {
    db = new SQL.Database();
    created = true;
  }
  db.exec(SCHEMA);
  // Small migration for databases created by older versions.
  const userCols = all('PRAGMA table_info(users)').map((c) => c.name);
  if (!userCols.includes('is_demo')) db.run('ALTER TABLE users ADD COLUMN is_demo INTEGER NOT NULL DEFAULT 0');
  save();
  return created;
}

module.exports = { init, all, get, run, tx, reloadIfChanged, DB_FILE };
