/**
 * /api/student — everything a logged-in STUDENT can do.
 * Every query is filtered by req.session.studentId, so a student can only
 * ever read or change their OWN data.
 */
const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const db = require('../db');
const v = require('../lib/validate');
const { checkEligibility, nowLocal } = require('../lib/eligibility');
const { bestOffer, rounds, stageLabel, profileCompletion } = require('../lib/helpers');

const router = express.Router();
const UPLOAD_DIR = path.join(__dirname, '..', 'uploads', 'resumes');

const me = (req) => db.get('SELECT * FROM students WHERE id = ?', [req.session.studentId]);

const DRIVE_SELECT = `
  SELECT d.*, c.name AS company_name, c.sector AS company_sector, c.website AS company_website
    FROM drives d JOIN companies c ON c.id = d.company_id`;

/** Announcements this student is allowed to see (everyone / their branch / their drives). */
function visibleAnnouncements(student, limit = 200) {
  return db.all(
    `SELECT a.*, CASE WHEN a.audience = 'DRIVE' THEN (SELECT c.name || ' — ' || d.role FROM drives d JOIN companies c ON c.id = d.company_id WHERE d.id = CAST(a.audience_value AS INTEGER)) END AS drive_label
       FROM announcements a
      WHERE a.audience = 'ALL'
         OR (a.audience = 'BRANCH' AND a.audience_value = ?)
         OR (a.audience = 'DRIVE' AND CAST(a.audience_value AS INTEGER) IN
               (SELECT drive_id FROM applications WHERE student_id = ? AND status != 'WITHDRAWN'))
      ORDER BY a.is_pinned DESC, a.created_at DESC LIMIT ?`,
    [student.branch, student.id, limit]
  );
}

function decorateDrive(d, student, offer, appsByDrive) {
  const app = appsByDrive[d.id];
  const elig = checkEligibility(student, d, { bestOfferCtc: offer ? offer.ctc_lpa : null });
  return {
    ...d,
    rounds: rounds(d),
    eligibility: elig,
    application: app ? { id: app.id, status: app.status, stage: app.stage, stage_label: stageLabel(app, d), assigned_by_tpo: app.assigned_by_tpo } : null,
    applicant_count: db.get("SELECT COUNT(*) AS n FROM applications WHERE drive_id = ? AND status != 'WITHDRAWN'", [d.id]).n,
  };
}

// ---------------------------------------------------------------- dashboard
router.get('/dashboard', (req, res) => {
  const s = me(req);
  const offer = bestOffer(s.id);
  const apps = db.all('SELECT * FROM applications WHERE student_id = ?', [s.id]);
  const appsByDrive = Object.fromEntries(apps.map((a) => [a.drive_id, a]));
  const openDrives = db.all(`${DRIVE_SELECT} WHERE d.status = 'OPEN' AND d.deadline >= ? ORDER BY d.deadline`, [nowLocal()])
    .map((d) => decorateDrive(d, s, offer, appsByDrive));

  const offers = db.all(
    `SELECT a.id, a.updated_at, d.role, d.ctc_lpa, d.job_type, d.location, c.name AS company_name
       FROM applications a JOIN drives d ON d.id = a.drive_id JOIN companies c ON c.id = d.company_id
      WHERE a.student_id = ? AND a.status = 'SELECTED' ORDER BY d.ctc_lpa DESC`, [s.id]);

  res.json({
    student: { name: s.name, roll_no: s.roll_no, branch: s.branch, year: s.year, cgpa: s.cgpa, is_verified: s.is_verified, tpo_remark: s.tpo_remark, has_resume: !!s.resume_path },
    completion: profileCompletion(s),
    stats: {
      eligibleOpen: openDrives.filter((d) => d.eligibility.eligible && !d.application).length,
      applications: apps.filter((a) => a.status !== 'WITHDRAWN').length,
      inProcess: apps.filter((a) => a.status === 'ACTIVE').length,
      offers: offers.length,
    },
    upcoming: openDrives.filter((d) => !d.application).slice(0, 5),
    offers,
    announcements: visibleAnnouncements(s, 4),
  });
});

// ---------------------------------------------------------------- profile
router.get('/profile', (req, res) => {
  const s = me(req);
  const user = db.get('SELECT email FROM users WHERE id = ?', [s.user_id]);
  res.json({ ...s, email: user.email, completion: profileCompletion(s) });
});

/**
 * Academic fields are LOCKED once the TPO verifies the profile — the TPO has
 * checked them against marksheets. The student must ask the TPO to unlock.
 */
const ACADEMIC = ['roll_no', 'cgpa', 'backlogs', 'tenth_pct', 'twelfth_pct', 'diploma_pct'];

router.put('/profile', (req, res) => {
  const s = me(req);
  const b = req.body || {};
  const data = {
    name: v.str(b.name, 'Full name', { required: true, max: 80 }),
    gender: v.oneOf(b.gender || null, 'gender', ['Male', 'Female', 'Other', null], { required: false }),
    dob: v.str(b.dob, 'Date of birth', { max: 10 }),
    phone: v.phone(b.phone),
    skills: v.str(b.skills, 'Skills', { max: 400 }),
    linkedin: v.url(b.linkedin, 'LinkedIn URL'),
    github: v.url(b.github, 'GitHub URL'),
    about: v.str(b.about, 'About', { max: 600 }),
  };
  if (data.dob) {
    // Date of birth must be a real date, and the student must be between 16 and 40 years old.
    const born = new Date(data.dob + 'T00:00:00');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data.dob) || Number.isNaN(born.getTime())) throw new v.ValidationError('Date of birth is invalid.');
    const age = (Date.now() - born.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
    if (age < 16) throw new v.ValidationError('Date of birth cannot be in the future, and you must be at least 16 years old.');
    if (age > 40) throw new v.ValidationError('Please check your date of birth — the year looks too old.');
  }

  if (!s.is_verified) {
    Object.assign(data, {
      roll_no: v.str(b.roll_no, 'Roll number', { required: true, max: 20 }).toUpperCase(),
      cgpa: v.num(b.cgpa, 'CGPA', { min: 0, max: 10 }),
      backlogs: v.num(b.backlogs, 'Active backlogs', { min: 0, max: 30, int: true }) ?? 0,
      tenth_pct: v.num(b.tenth_pct, '10th percentage', { min: 0, max: 100 }),
      twelfth_pct: v.num(b.twelfth_pct, '12th percentage', { min: 0, max: 100 }),
      diploma_pct: v.num(b.diploma_pct, 'Diploma percentage', { min: 0, max: 100 }),
    });
    const clash = db.get('SELECT id FROM students WHERE roll_no = ? AND id != ?', [data.roll_no, s.id]);
    if (clash) throw new v.ValidationError('That roll number belongs to another student.');
  }

  const cols = Object.keys(data);
  db.tx(() => {
    db.run(`UPDATE students SET ${cols.map((c) => `${c} = ?`).join(', ')}, updated_at = datetime('now') WHERE id = ?`, [...cols.map((c) => data[c]), s.id]);
    db.run('UPDATE users SET name = ? WHERE id = ?', [data.name, s.user_id]);
  });
  const locked = s.is_verified && ACADEMIC.some((k) => b[k] !== undefined && String(b[k] ?? '') !== String(s[k] ?? ''));
  res.json({ ok: true, lockedIgnored: !!locked, completion: profileCompletion(me(req)) });
});

// ---------------------------------------------------------------- resume upload
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => { fs.mkdirSync(UPLOAD_DIR, { recursive: true }); cb(null, UPLOAD_DIR); },
    filename: (req, file, cb) => cb(null, `student-${req.session.studentId}-${Date.now()}.pdf`),
  }),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = file.mimetype === 'application/pdf' || /\.pdf$/i.test(file.originalname);
    cb(ok ? null : new v.ValidationError('Only PDF files are allowed for resumes.'), ok);
  },
});

router.post('/resume', (req, res, next) => {
  upload.single('resume')(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: 'Resume must be smaller than 2 MB.' });
      if (err.status === 400) return res.status(400).json({ error: err.message });
      console.error('  Resume upload error:', err.message);
      return res.status(500).json({ error: 'Could not save the file on the server: ' + err.message });
    }
    if (!req.file) return res.status(400).json({ error: 'Please choose a PDF file to upload.' });
    // Everything below runs in a callback, so errors must be caught here or the server would stop.
    try {
      // Check it is a real PDF ("%PDF" near the start), not a renamed Word/image file.
      const fd = fs.openSync(req.file.path, 'r');
      const head = Buffer.alloc(1024); const n = fs.readSync(fd, head, 0, 1024, 0); fs.closeSync(fd);
      if (!head.subarray(0, n).toString('latin1').includes('%PDF')) {
        try { fs.unlinkSync(req.file.path); } catch { /* ignore */ }
        return res.status(400).json({ error: 'That file is not a valid PDF. Export/save it as PDF and try again.' });
      }

      const s = me(req);
      if (s.resume_path) {
        // Delete the old resume. If Windows has it locked (open in a viewer), just leave it.
        try { fs.unlinkSync(path.join(UPLOAD_DIR, path.basename(s.resume_path))); } catch { /* ignore */ }
      }
      const original = req.file.originalname.replace(/[^\w.\- ()]/g, '_').slice(0, 100);
      db.run("UPDATE students SET resume_path = ?, resume_name = ?, resume_uploaded_at = datetime('now'), updated_at = datetime('now') WHERE id = ?",
        [req.file.filename, original, s.id]);
      res.json({ ok: true, resume_name: original });
    } catch (e) {
      console.error('  Resume upload error:', e.message);
      res.status(500).json({ error: 'Could not save the resume: ' + e.message });
    }
  });
});

// ---------------------------------------------------------------- drives
router.get('/drives', (req, res) => {
  const s = me(req);
  const offer = bestOffer(s.id);
  const apps = db.all('SELECT * FROM applications WHERE student_id = ?', [s.id]);
  const appsByDrive = Object.fromEntries(apps.map((a) => [a.drive_id, a]));
  const drives = db.all(`${DRIVE_SELECT} ORDER BY (d.status = 'OPEN' AND d.deadline >= ?) DESC, d.deadline ASC`, [nowLocal()])
    .map((d) => decorateDrive(d, s, offer, appsByDrive));
  res.json({ drives, offer, now: nowLocal() });
});

router.post('/drives/:id/apply', (req, res) => {
  const s = me(req);
  const d = db.get(`${DRIVE_SELECT} WHERE d.id = ?`, [Number(req.params.id)]);
  if (!d) return res.status(404).json({ error: 'Drive not found.' });

  const existing = db.get('SELECT * FROM applications WHERE student_id = ? AND drive_id = ?', [s.id, d.id]);
  if (existing && existing.status !== 'WITHDRAWN') return res.status(409).json({ error: 'You have already applied to this drive.' });
  if (!s.resume_path) return res.status(400).json({ error: 'Upload your resume on the Profile page before applying.' });

  const offer = bestOffer(s.id);
  const elig = checkEligibility(s, d, { bestOfferCtc: offer ? offer.ctc_lpa : null });
  if (!elig.eligible) return res.status(403).json({ error: 'You are not eligible: ' + elig.reasons.join('; ') + '.' });

  if (existing) {
    db.run("UPDATE applications SET status = 'ACTIVE', stage = 0, assigned_by_tpo = 0, updated_at = datetime('now'), created_at = datetime('now') WHERE id = ?", [existing.id]);
  } else {
    db.run('INSERT INTO applications (student_id, drive_id) VALUES (?, ?)', [s.id, d.id]);
  }
  res.status(201).json({ ok: true, message: `Applied to ${d.company_name} — ${d.role}.` });
});

// ---------------------------------------------------------------- applications
router.get('/applications', (req, res) => {
  const rows = db.all(
    `SELECT a.*, d.role, d.ctc_lpa, d.job_type, d.location, d.rounds, d.drive_date, d.deadline, d.status AS drive_status,
            c.name AS company_name
       FROM applications a JOIN drives d ON d.id = a.drive_id JOIN companies c ON c.id = d.company_id
      WHERE a.student_id = ? ORDER BY a.updated_at DESC`, [req.session.studentId]);
  res.json(rows.map((r) => ({ ...r, rounds: rounds(r), stage_label: stageLabel(r, r) })));
});

/** Students can withdraw only while still at the "Applied" stage. */
router.post('/applications/:id/withdraw', (req, res) => {
  const a = db.get('SELECT * FROM applications WHERE id = ? AND student_id = ?', [Number(req.params.id), req.session.studentId]);
  if (!a) return res.status(404).json({ error: 'Application not found.' });
  if (a.status !== 'ACTIVE' || a.stage > 0) {
    return res.status(400).json({ error: 'You can only withdraw before you are shortlisted. Contact the TPO office.' });
  }
  db.run("UPDATE applications SET status = 'WITHDRAWN', updated_at = datetime('now') WHERE id = ?", [a.id]);
  res.json({ ok: true });
});

// ---------------------------------------------------------------- announcements & notifications
router.get('/announcements', (req, res) => {
  const s = me(req);
  const list = visibleAnnouncements(s).map((a) => ({ ...a, is_new: a.created_at > s.announcements_seen_at }));
  db.run("UPDATE students SET announcements_seen_at = datetime('now') WHERE id = ?", [s.id]);
  res.json(list);
});

router.get('/notifications', (req, res) => {
  const s = me(req);
  const newAnnouncements = visibleAnnouncements(s).filter((a) => a.created_at > s.announcements_seen_at).length;
  res.json({
    items: db.all('SELECT * FROM notifications WHERE student_id = ? ORDER BY created_at DESC, id DESC LIMIT 30', [s.id]),
    unread: db.get('SELECT COUNT(*) AS n FROM notifications WHERE student_id = ? AND is_read = 0', [s.id]).n,
    newAnnouncements,
  });
});

router.post('/notifications/read-all', (req, res) => {
  db.run('UPDATE notifications SET is_read = 1 WHERE student_id = ?', [req.session.studentId]);
  res.json({ ok: true });
});

module.exports = router;
