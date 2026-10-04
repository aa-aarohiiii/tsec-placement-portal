/**
 * server.js — entry point of the TSEC Placement Portal
 * ----------------------------------------------------------------------------
 *   npm start       -> http://localhost:3000
 *   npm run reset   -> wipe the database (keeps only the TPO login)
 *   npm run demo    -> wipe the database and load sample data for practice
 *
 * Request pipeline:
 *   browser -> session cookie -> page guard -> static files (/public)
 *           -> /api/auth | /api/student | /api/tpo -> db.js -> data/portal.db
 */
// Settings from .env must be loaded before anything else reads process.env.
const [major] = process.versions.node.split('.').map(Number);
if (major < 20) {
  console.error(`\n  This portal needs Node.js 20 or newer. You have ${process.version}.\n  Install the LTS version from https://nodejs.org and try again.\n`);
  process.exit(1);
}
const setup = require('./lib/setup');
const envCreated = setup.loadEnv();

const express = require('express');
const session = require('express-session');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const db = require('./db');
const { BRANCHES, YEARS, JOB_TYPES } = require('./lib/constants');
const { requireLogin, requireRole, guardPages } = require('./middleware/auth');

const PORT = Number(process.env.PORT) || 3000;
const app = express();

// ---------- basic security headers
app.disable('x-powered-by');
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'same-origin');
  next();
});

app.use(express.json({ limit: '200kb' }));

// Pick up `npm run reset` even while the server is running.
app.use((req, res, next) => {
  if (db.reloadIfChanged()) console.log('  Database file changed on disk (reset?) — reloaded.');
  next();
});

// ---------- sessions (login cookie). A random secret is created once and kept in data/.
const secretFile = path.join(__dirname, 'data', '.session-secret');
function sessionSecret() {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  fs.mkdirSync(path.dirname(secretFile), { recursive: true });
  if (!fs.existsSync(secretFile)) fs.writeFileSync(secretFile, crypto.randomBytes(32).toString('hex'));
  return fs.readFileSync(secretFile, 'utf8');
}
app.use(session({
  name: 'tsec.sid',
  secret: sessionSecret(),
  resave: false,
  saveUninitialized: false,
  rolling: true,
  cookie: { httpOnly: true, sameSite: 'lax', maxAge: 1000 * 60 * 60 * 8 }, // 8 hours
}));

// ---------- pages & static assets
const noCache = { etag: true, lastModified: true, setHeaders: (res) => res.setHeader('Cache-Control', 'no-cache') };
app.use(guardPages);
app.get('/', (req, res, next) => {
  // Already logged in? Skip the login page.
  if (req.session.userId) return res.redirect(req.session.role === 'TPO' ? '/tpo/dashboard.html' : '/student/dashboard.html');
  next();
});
app.use(express.static(path.join(__dirname, 'public'), noCache));
app.use('/vendor/chart.js', (req, res) => res.sendFile(path.join(__dirname, 'node_modules/chart.js/dist/chart.umd.min.js')));
app.use('/fonts', express.static(path.join(__dirname, 'node_modules/@fontsource/ibm-plex-sans/files'), { maxAge: '30d' }));
app.use('/fonts', express.static(path.join(__dirname, 'node_modules/@fontsource/ibm-plex-mono/files'), { maxAge: '30d' }));

// ---------- API
app.get('/api/meta', (req, res) => res.json({ branches: BRANCHES, years: YEARS, jobTypes: JOB_TYPES, allowedDomain: (process.env.ALLOWED_EMAIL_DOMAIN || '').trim().replace(/^@/, '') || null }));
app.use('/api/auth', require('./routes/auth'));

/** Public headline numbers shown on the login page (no personal data). */
app.get('/api/public/summary', (req, res) => {
  const row = db.get(`SELECT
      (SELECT COUNT(*) FROM applications WHERE status = 'SELECTED') AS offers,
      (SELECT COUNT(*) FROM companies) AS companies,
      (SELECT MAX(d.ctc_lpa) FROM applications a JOIN drives d ON d.id = a.drive_id WHERE a.status = 'SELECTED') AS highest,
      (SELECT COUNT(*) FROM drives WHERE status = 'OPEN' AND deadline >= ?) AS live`, [require('./lib/eligibility').nowLocal()]);
  res.json(row);
});
app.use('/api/student', requireLogin, requireRole('STUDENT'), require('./routes/student'));
app.use('/api/tpo', requireLogin, requireRole('TPO'), require('./routes/tpo'));

/** Resumes are private: only the owner or the TPO may open them. */
app.get('/api/files/resume/:studentId', requireLogin, (req, res) => {
  const id = Number(req.params.studentId);
  if (req.session.role !== 'TPO' && req.session.studentId !== id) return res.status(403).json({ error: 'Not allowed.' });
  const s = db.get('SELECT name, roll_no, resume_path FROM students WHERE id = ?', [id]);
  if (!s || !s.resume_path) return res.status(404).json({ error: 'No resume uploaded.' });
  const file = path.join(__dirname, 'uploads', 'resumes', path.basename(s.resume_path));
  if (!fs.existsSync(file)) return res.status(404).json({ error: 'Resume file is missing on the server.' });
  const nice = `${s.roll_no}-${s.name}`.replace(/[^\w-]+/g, '_') + '-resume.pdf';
  res.setHeader('Content-Disposition', `${req.query.download ? 'attachment' : 'inline'}; filename="${nice}"`);
  res.setHeader('Content-Type', 'application/pdf');
  res.sendFile(file);
});

app.use('/api', (req, res) => res.status(404).json({ error: 'API route not found.' }));

// ---------- 404 page for everything else
app.use((req, res) => res.status(404).sendFile(path.join(__dirname, 'public', '404.html')));

// ---------- central error handler: friendly messages, no stack traces to users
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const status = err.status || err.statusCode || 500;
  if (status >= 500) console.error(err);
  const message = status >= 500 ? 'Something went wrong on the server. Please try again.' : err.message;
  if (req.path.startsWith('/api')) return res.status(status).json({ error: message });
  res.status(status).send(message);
});

// Keep the portal running even if one request hits an unexpected error.
process.on('uncaughtException', (err) => console.error('\n  Unexpected error (portal still running):', err.message, '\n'));
process.on('unhandledRejection', (err) => console.error('\n  Unexpected error (portal still running):', err && err.message, '\n'));

// ---------- start
(async () => {
  await db.init();
  require('./lib/otp').setSecret(sessionSecret());
  setup.ensureTpo();
  const tpo = setup.tpoConfig();
  const tpoRow = db.get('SELECT password_hash FROM users WHERE email = ?', [tpo.email]);
  const tpoUsesEnvPassword = !!tpoRow && require('bcryptjs').compareSync(tpo.password, tpoRow.password_hash);
  const mailer = require('./lib/mailer');
  const mail = await mailer.checkConnection();

  const server = app.listen(PORT, () => {
    const line = (t = '') => console.log('  │  ' + t.padEnd(56) + '│');
    console.log('\n  ┌' + '─'.repeat(58) + '┐');
    line('TSEC Placement Portal is running');
    line(`Open  →  http://localhost:${PORT}`);
    const lan = Object.values(require('os').networkInterfaces()).flat()
      .filter((n) => n && n.family === 'IPv4' && !n.internal).map((n) => n.address);
    if (lan[0]) line(`Other devices on same Wi-Fi → http://${lan[0]}:${PORT}`);
    line();
    line(`TPO login: ${tpo.email}`);
    if (tpoUsesEnvPassword) line(`Password:  ${tpo.password}   (change after login)`);
    line();
    if (!mail.enabled) { line('Email: NOT set up — OTP codes print in this window.'); line('       Add Gmail details in the .env file to send emails.'); }
    else if (mail.ok) line(`Email: ✔ sending from ${mailer.user}`);
    else { line('Email: ✖ could not connect to the mail server'); line('        ' + String(mail.error).slice(0, 52)); }
    line();
    line('Press Ctrl + C to stop');
    console.log('  └' + '─'.repeat(58) + '┘\n');
    if (envCreated) console.log('  Created a .env settings file for you. Open it to set the TPO login and Gmail.\n');
  });
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`\n  Port ${PORT} is already in use — the portal is probably already running in another window.`);
      console.error('  Close that window, or change PORT in the .env file.\n');
      process.exit(1);
    }
    throw err;
  });
})();
