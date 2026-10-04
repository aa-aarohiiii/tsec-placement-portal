/**
 * Reusable database helpers shared by the student and TPO routes.
 */
const db = require('../db');
const mailer = require('./mailer');

/** Add an in-app notification (the bell icon in the student portal). */
function notify(studentId, message, link = null) {
  db.run('INSERT INTO notifications (student_id, message, link) VALUES (?, ?, ?)', [studentId, message, link]);
  // Also email the student (skipped for demo accounts, which have fake addresses).
  const u = db.get('SELECT u.email, u.name, u.is_demo FROM students s JOIN users u ON u.id = s.user_id WHERE s.id = ?', [studentId]);
  if (u && !u.is_demo) mailer.notifyEmail(u.email, u.name, message, link);
}

/** Highest CTC offer a student currently holds (null if not placed). */
function bestOffer(studentId) {
  return db.get(
    `SELECT d.ctc_lpa, c.name AS company, d.role
       FROM applications a JOIN drives d ON d.id = a.drive_id JOIN companies c ON c.id = d.company_id
      WHERE a.student_id = ? AND a.status = 'SELECTED' AND d.job_type != 'Internship'
      ORDER BY d.ctc_lpa DESC LIMIT 1`,
    [studentId]
  ) || null;
}

/** Parse the JSON rounds column safely. */
function rounds(drive) {
  try { const r = JSON.parse(drive.rounds); return Array.isArray(r) ? r : []; } catch { return []; }
}

/** Human-readable stage name, e.g. "Technical Interview" or "Selected". */
function stageLabel(app, drive) {
  const r = rounds(drive);
  if (app.status === 'SELECTED') return 'Selected';
  if (app.status === 'WITHDRAWN') return 'Withdrawn';
  const here = app.stage === 0 ? 'Applied' : r[app.stage - 1] || `Round ${app.stage}`;
  return app.status === 'REJECTED' ? `Rejected at ${here}` : here;
}

/**
 * Percentage of the profile that is filled in, plus the list of what's missing.
 * Used for the progress meter on the student dashboard.
 */
function profileCompletion(s) {
  const items = [
    ['Phone number', s.phone], ['Date of birth', s.dob], ['CGPA', s.cgpa != null],
    ['10th percentage', s.tenth_pct != null], ['12th / Diploma percentage', s.twelfth_pct != null || s.diploma_pct != null],
    ['Skills', s.skills], ['LinkedIn profile', s.linkedin], ['About you', s.about], ['Resume (PDF)', s.resume_path],
  ];
  const missing = items.filter(([, v]) => !v).map(([k]) => k);
  return { percent: Math.round(((items.length - missing.length) / items.length) * 100), missing };
}

module.exports = { notify, bestOffer, rounds, stageLabel, profileCompletion };
