/**
 * mailer.js — sends real emails (OTP codes + placement notifications).
 * ----------------------------------------------------------------------------
 * Configure SMTP in the .env file (see .env.example). With Gmail you need an
 * "App password" (Google Account → Security → 2-Step Verification → App passwords).
 *
 * If SMTP is NOT configured, the portal still works: every email is printed
 * in the terminal instead (handy when there's no internet on demo day).
 */
const nodemailer = require('nodemailer');

const cfg = {
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: Number(process.env.SMTP_PORT) || 465,
  user: (process.env.SMTP_USER || '').trim(),
  pass: (process.env.SMTP_PASS || '').replace(/\s+/g, ''), // Gmail shows app passwords with spaces
};
const FROM = process.env.MAIL_FROM || (cfg.user ? `TSEC Placement Cell <${cfg.user}>` : 'TSEC Placement Cell <no-reply@localhost>');
const NOTIFY = String(process.env.EMAIL_NOTIFICATIONS || 'true').toLowerCase() !== 'false';

const enabled = !!(cfg.user && cfg.pass);
const transport = enabled
  ? nodemailer.createTransport({
    host: cfg.host, port: cfg.port, secure: cfg.port === 465, pool: true, maxConnections: 2,
    auth: { user: cfg.user, pass: cfg.pass },
    connectionTimeout: 15000, greetingTimeout: 15000, socketTimeout: 20000,
  })
  : null;

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** Branded HTML email (table layout = works in Gmail/Outlook). */
function layout({ heading, intro, code, body = '', button }) {
  return `<!doctype html><html><body style="margin:0;background:#f4f6f9;font-family:Arial,Helvetica,sans-serif;color:#0f1b2a">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:24px 12px"><tr><td align="center">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border:1px solid #dfe5ec;border-radius:8px">
    <tr><td style="padding:22px 28px 0">
      <div style="border-top:3px solid #0b416d;border-bottom:3px solid #0b416d;padding:6px 0;text-align:center">
        <div style="font-size:11px;letter-spacing:2px;color:#0b416d;font-weight:bold">THADOMAL SHAHANI</div>
        <div style="font-size:30px;font-weight:bold;color:#0b416d;letter-spacing:2px;line-height:1.1">TSEC</div>
        <div style="font-size:11px;letter-spacing:2px;color:#0b416d;font-weight:bold">ENGINEERING COLLEGE</div>
      </div></td></tr>
    <tr><td style="padding:22px 28px 6px"><h1 style="margin:0 0 10px;font-size:19px;color:#0f1b2a">${esc(heading)}</h1>
      <p style="margin:0;font-size:14px;line-height:1.55;color:#475569">${intro}</p></td></tr>
    ${code ? `<tr><td style="padding:16px 28px"><div style="background:#e6eef6;border-radius:8px;padding:16px;text-align:center;font-family:'Courier New',monospace;font-size:32px;letter-spacing:10px;font-weight:bold;color:#0b416d">${esc(code)}</div>
      <p style="margin:10px 0 0;font-size:12px;color:#7a8796;text-align:center">This code expires in 10 minutes. Never share it with anyone.</p></td></tr>` : ''}
    ${body ? `<tr><td style="padding:6px 28px;font-size:14px;line-height:1.55;color:#475569">${body}</td></tr>` : ''}
    ${button ? `<tr><td style="padding:14px 28px"><a href="${esc(button.href)}" style="display:inline-block;background:#0b416d;color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:6px;font-weight:bold;font-size:14px">${esc(button.label)}</a></td></tr>` : ''}
    <tr><td style="padding:18px 28px 22px;font-size:12px;color:#7a8796;border-top:1px solid #dfe5ec">Training &amp; Placement Cell, Thadomal Shahani Engineering College, Bandra (W), Mumbai.<br>You received this because of activity on the TSEC Placement Portal.</td></tr>
  </table></td></tr></table></body></html>`;
}

/**
 * Send one email. Returns true when sent (or printed in console mode).
 * Throws only when SMTP is configured but sending fails.
 */
async function send({ to, subject, html, text }) {
  if (!enabled) {
    console.log(`\n  ✉  [email not configured — printing instead]\n     To: ${to}\n     Subject: ${subject}\n     ${text.split('\n').join('\n     ')}\n`);
    return true;
  }
  await transport.sendMail({ from: FROM, to, subject, html, text });
  return true;
}

function sendOtp(to, code, purpose, name = '') {
  const reg = purpose === 'REGISTER';
  const subject = reg ? `${code} is your TSEC Placement Portal verification code` : `${code} is your TSEC password reset code`;
  const hi = name ? `Hi ${esc(name.split(' ')[0])}, ` : '';
  return send({
    to, subject,
    html: layout({
      heading: reg ? 'Verify your email' : 'Reset your password',
      intro: reg ? `${hi}use this code to finish creating your TSEC Placement Portal account.` : `${hi}use this code to set a new password for your TSEC Placement Portal account. If you didn't ask for this, you can ignore this email.`,
      code,
    }),
    text: `${reg ? 'Your verification code' : 'Your password reset code'} is ${code}. It expires in 10 minutes.`,
  });
}

/** Placement notification (verified, shortlisted, selected…). Never throws. */
function notifyEmail(to, name, message, link) {
  if (!NOTIFY || !to) return;
  const base = process.env.PUBLIC_URL || `http://localhost:${process.env.PORT || 3000}`;
  send({
    to, subject: `TSEC Placements: ${message.replace(/^🎉\s*/, '').slice(0, 70)}`,
    html: layout({ heading: 'Placement update', intro: `Hi ${esc(String(name).split(' ')[0])},`, body: esc(message), button: link ? { href: base + link, label: 'Open the portal' } : null }),
    text: `Hi ${name},\n${message}\n${link ? base + link : ''}`,
  }).catch((err) => console.error('  Email notification failed:', err.message));
}

/** Called once at startup so the terminal says whether email works. */
async function checkConnection() {
  if (!enabled) return { enabled: false };
  try { await transport.verify(); return { enabled: true, ok: true }; }
  catch (err) { return { enabled: true, ok: false, error: err.message }; }
}

module.exports = { send, sendOtp, notifyEmail, checkConnection, enabled, user: cfg.user };
