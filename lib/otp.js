/**
 * otp.js — 6-digit one-time codes sent by email.
 *   • valid for 10 minutes          • max 5 wrong attempts
 *   • can be re-sent after 45 s     • stored only as an HMAC (never the code)
 */
const crypto = require('crypto');
const db = require('../db');

const TTL_MS = 10 * 60 * 1000;
const RESEND_MS = 45 * 1000;
const MAX_ATTEMPTS = 5;

let secret = null;
const setSecret = (s) => { secret = s; };
const hash = (email, code) => crypto.createHmac('sha256', secret || 'otp').update(`${email.toLowerCase()}:${code}`).digest('hex');

class OtpError extends Error { constructor(message, status = 400) { super(message); this.status = status; } }

/** Create (or replace) a code. Returns the plain code so it can be emailed. */
function issue(email, purpose, payload = null) {
  const existing = db.get('SELECT * FROM otps WHERE email = ? AND purpose = ?', [email, purpose]);
  const now = Date.now();
  if (existing && now - existing.last_sent_at < RESEND_MS) {
    const wait = Math.ceil((RESEND_MS - (now - existing.last_sent_at)) / 1000);
    throw new OtpError(`Please wait ${wait} seconds before requesting another code.`, 429);
  }
  const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
  const data = payload !== null ? JSON.stringify(payload) : existing ? existing.payload : null;
  db.run('DELETE FROM otps WHERE email = ? AND purpose = ?', [email, purpose]);
  db.run('INSERT INTO otps (email, purpose, code_hash, payload, expires_at, last_sent_at) VALUES (?, ?, ?, ?, ?, ?)',
    [email, purpose, hash(email, code), data, now + TTL_MS, now]);
  return code;
}

/** Check a code. On success the code is consumed and its payload returned. */
function verify(email, purpose, code) {
  const row = db.get('SELECT * FROM otps WHERE email = ? AND purpose = ?', [email, purpose]);
  if (!row) throw new OtpError('No code was requested for this email, or it was already used. Request a new code.');
  if (Date.now() > row.expires_at) { db.run('DELETE FROM otps WHERE id = ?', [row.id]); throw new OtpError('This code has expired. Request a new one.'); }
  if (row.attempts >= MAX_ATTEMPTS) throw new OtpError('Too many wrong attempts. Request a new code.', 429);
  const given = String(code || '').replace(/\D/g, '');
  const a = Buffer.from(hash(email, given)); const b = Buffer.from(row.code_hash);
  if (given.length !== 6 || !crypto.timingSafeEqual(a, b)) {
    db.run('UPDATE otps SET attempts = attempts + 1 WHERE id = ?', [row.id]);
    const left = MAX_ATTEMPTS - row.attempts - 1;
    throw new OtpError(left > 0 ? `Incorrect code. ${left} attempt${left === 1 ? '' : 's'} left.` : 'Too many wrong attempts. Request a new code.');
  }
  db.run('DELETE FROM otps WHERE id = ?', [row.id]);
  return row.payload ? JSON.parse(row.payload) : null;
}

function pending(email, purpose) {
  const row = db.get('SELECT * FROM otps WHERE email = ? AND purpose = ?', [email, purpose]);
  return row && Date.now() <= row.expires_at ? row : null;
}

module.exports = { issue, verify, pending, setSecret, OtpError, RESEND_SECONDS: RESEND_MS / 1000 };
