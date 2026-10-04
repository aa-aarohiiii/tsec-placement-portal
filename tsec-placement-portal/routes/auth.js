/**
 * /api/auth — sign-up with email OTP, login, forgot password, logout, me.
 *
 * Sign-up is two steps so only REAL, working email addresses get accounts:
 *   1. POST /register/start   → details checked, 6-digit code emailed
 *   2. POST /register/verify  → code checked, account created, logged in
 */
const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const v = require('../lib/validate');
const otp = require('../lib/otp');
const mailer = require('../lib/mailer');
const { BRANCHES } = require('../lib/constants');
const { requireLogin } = require('../middleware/auth');

const router = express.Router();
const ALLOWED_DOMAIN = (process.env.ALLOWED_EMAIL_DOMAIN || '').trim().toLowerCase().replace(/^@/, '');

function checkDomain(email) {
  if (ALLOWED_DOMAIN && !email.endsWith('@' + ALLOWED_DOMAIN)) {
    throw new v.ValidationError(`Please use your college email address (ending in @${ALLOWED_DOMAIN}).`);
  }
}

/**
 * Email the code. If sending fails (e.g. no internet on demo day), the code is
 * printed in the server window so the TPO can read it out, and the page says so.
 * Returns true when the email really went out.
 */
async function emailCode(email, code, purpose, name) {
  try {
    await mailer.sendOtp(email, code, purpose, name);
    return mailer.enabled;
  } catch (err) {
    console.error(`\n  ✖ Could not email the code to ${email}: ${err.message}`);
    console.error(`    Code for ${email}: ${code}   (valid 10 minutes)\n`);
    return false;
  }
}

function startSession(req, res, payload, body) {
  req.session.regenerate((err) => {
    if (err) return res.status(500).json({ error: 'Could not start session.' });
    Object.assign(req.session, payload);
    res.status(body.status || 200).json(body.json);
  });
}

// ------------------------------------------------------------- sign-up
router.post('/register/start', async (req, res) => {
  const b = req.body || {};
  const name = v.str(b.name, 'Full name', { required: true, max: 80 });
  const email = v.email(b.email);
  checkDomain(email);
  const password = v.password(b.password);
  const rollNo = v.str(b.roll_no, 'Roll number', { required: true, max: 20 }).toUpperCase();
  const branch = v.oneOf(b.branch, 'branch', Object.keys(BRANCHES));
  const year = v.oneOf(b.year, 'year', ['TE', 'BE']);

  if (db.get('SELECT 1 FROM users WHERE email = ?', [email])) {
    return res.status(409).json({ error: 'An account with this email already exists. Sign in, or use "Forgot password".' });
  }
  if (db.get('SELECT 1 FROM students WHERE roll_no = ?', [rollNo])) {
    return res.status(409).json({ error: 'This roll number is already registered. Contact the TPO office if this is a mistake.' });
  }

  const payload = { name, rollNo, branch, year, hash: bcrypt.hashSync(password, 10) };
  const code = otp.issue(email, 'REGISTER', payload);
  const sent = await emailCode(email, code, 'REGISTER', name);
  res.json({ ok: true, email, resendIn: otp.RESEND_SECONDS, emailSent: sent });
});

router.post('/register/verify', (req, res) => {
  const b = req.body || {};
  const email = v.email(b.email);
  const p = otp.verify(email, 'REGISTER', b.code);

  // Re-check: someone may have registered the same email/roll meanwhile.
  if (db.get('SELECT 1 FROM users WHERE email = ?', [email])) return res.status(409).json({ error: 'This email is already registered. Please sign in.' });
  if (db.get('SELECT 1 FROM students WHERE roll_no = ?', [p.rollNo])) return res.status(409).json({ error: 'This roll number was registered meanwhile. Contact the TPO office.' });

  const ids = db.tx(() => {
    const u = db.run('INSERT INTO users (email, password_hash, role, name) VALUES (?, ?, ?, ?)', [email, p.hash, 'STUDENT', p.name]);
    const s = db.run('INSERT INTO students (user_id, name, roll_no, branch, year) VALUES (?, ?, ?, ?, ?)', [u.id, p.name, p.rollNo, p.branch, p.year]);
    return { userId: u.id, studentId: s.id };
  });
  startSession(req, res, { userId: ids.userId, role: 'STUDENT', studentId: ids.studentId },
    { status: 201, json: { role: 'STUDENT', redirect: '/student/profile.html?welcome=1' } });
});

/** Re-send a code (sign-up or password reset). */
router.post('/otp/resend', async (req, res) => {
  const b = req.body || {};
  const email = v.email(b.email);
  const purpose = v.oneOf(b.purpose, 'purpose', ['REGISTER', 'RESET']);
  const row = otp.pending(email, purpose) || db.get('SELECT * FROM otps WHERE email = ? AND purpose = ?', [email, purpose]);
  if (!row) return res.status(400).json({ error: 'Your previous request expired. Please start again.' });
  const payload = row.payload ? JSON.parse(row.payload) : null;
  const code = otp.issue(email, purpose);
  const sent = await emailCode(email, code, purpose, payload ? payload.name : '');
  res.json({ ok: true, resendIn: otp.RESEND_SECONDS, emailSent: sent });
});

// ------------------------------------------------------------- forgot password
router.post('/forgot/start', async (req, res) => {
  const email = v.email((req.body || {}).email);
  const user = db.get('SELECT id, name FROM users WHERE email = ?', [email]);
  // Same reply whether or not the account exists, so emails can't be probed.
  let sent = true;
  if (user) {
    const code = otp.issue(email, 'RESET');
    sent = await emailCode(email, code, 'RESET', user.name);
  }
  res.json({ ok: true, email, resendIn: otp.RESEND_SECONDS, emailSent: sent });
});

router.post('/forgot/verify', (req, res) => {
  const b = req.body || {};
  const email = v.email(b.email);
  const password = v.password(b.password);
  otp.verify(email, 'RESET', b.code);
  const user = db.get('SELECT * FROM users WHERE email = ?', [email]);
  if (!user) return res.status(400).json({ error: 'Account not found.' });
  db.run('UPDATE users SET password_hash = ? WHERE id = ?', [bcrypt.hashSync(password, 10), user.id]);
  failures.delete(email);
  const student = user.role === 'STUDENT' ? db.get('SELECT id FROM students WHERE user_id = ?', [user.id]) : null;
  startSession(req, res, { userId: user.id, role: user.role, studentId: student ? student.id : null },
    { json: { role: user.role, redirect: user.role === 'TPO' ? '/tpo/dashboard.html' : '/student/dashboard.html' } });
});

// ------------------------------------------------------------- login (with brute-force lockout)
const failures = new Map(); // email -> { count, until }
const MAX_FAILS = 8;
const LOCK_MS = 10 * 60 * 1000;

router.post('/login', (req, res) => {
  const b = req.body || {};
  const email = String(b.email || '').trim().toLowerCase();
  const password = String(b.password || '');
  if (!email || !password) return res.status(400).json({ error: 'Enter your email and password.' });

  const f = failures.get(email);
  if (f && f.until > Date.now()) {
    return res.status(429).json({ error: `Too many failed attempts. Try again in ${Math.ceil((f.until - Date.now()) / 60000)} min, or use "Forgot password".` });
  }

  const user = db.get('SELECT * FROM users WHERE email = ?', [email]);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    let rec = failures.get(email);
    if (!rec || (rec.until && rec.until <= Date.now())) rec = { count: 0, until: 0 };
    rec.count += 1;
    if (rec.count >= MAX_FAILS) rec.until = Date.now() + LOCK_MS;
    failures.set(email, rec);
    return res.status(401).json({ error: 'Incorrect email or password.' });
  }
  if (b.role && b.role !== user.role) {
    const other = user.role === 'TPO' ? 'TPO' : 'Student';
    return res.status(403).json({ error: `This is a ${other} account. Switch to the ${other} tab to sign in.` });
  }
  failures.delete(email);
  const student = user.role === 'STUDENT' ? db.get('SELECT id FROM students WHERE user_id = ?', [user.id]) : null;
  startSession(req, res, { userId: user.id, role: user.role, studentId: student ? student.id : null },
    { json: { role: user.role, redirect: user.role === 'TPO' ? '/tpo/dashboard.html' : '/student/dashboard.html' } });
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('tsec.sid');
    res.json({ ok: true });
  });
});

router.get('/me', requireLogin, (req, res) => {
  const user = db.get('SELECT id, email, role, name FROM users WHERE id = ?', [req.session.userId]);
  const out = { ...user };
  if (user.role === 'STUDENT') {
    const s = db.get('SELECT id, roll_no, branch, year, is_verified FROM students WHERE id = ?', [req.session.studentId]);
    out.student = s;
    out.unreadNotifications = db.get('SELECT COUNT(*) AS n FROM notifications WHERE student_id = ? AND is_read = 0', [s.id]).n;
  }
  res.json(out);
});

router.post('/change-password', requireLogin, (req, res) => {
  const b = req.body || {};
  const user = db.get('SELECT * FROM users WHERE id = ?', [req.session.userId]);
  if (!bcrypt.compareSync(String(b.current || ''), user.password_hash)) {
    return res.status(400).json({ error: 'Your current password is incorrect.' });
  }
  const next = v.password(b.next);
  db.run('UPDATE users SET password_hash = ? WHERE id = ?', [bcrypt.hashSync(next, 10), user.id]);
  res.json({ ok: true });
});

module.exports = router;
