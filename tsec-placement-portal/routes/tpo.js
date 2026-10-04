/**
 * /api/tpo — everything the Training & Placement Officer can do.
 * The whole router is protected by requireRole('TPO') in server.js.
 */
const express = require('express');
const db = require('../db');
const v = require('../lib/validate');
const { BRANCHES, JOB_TYPES } = require('../lib/constants');
const { checkEligibility, nowLocal, splitList } = require('../lib/eligibility');
const { notify, bestOffer, rounds, stageLabel, profileCompletion } = require('../lib/helpers');
const { sendCsv } = require('../lib/csv');

const router = express.Router();

// A "placement" = selected in a Full-time or Internship+PPO drive (pure internships don't count).
const PLACED_SQL = `EXISTS (SELECT 1 FROM applications a JOIN drives d ON d.id = a.drive_id
                     WHERE a.student_id = s.id AND a.status = 'SELECTED' AND d.job_type != 'Internship')`;

const STUDENT_SELECT = `
  SELECT s.*, u.email, u.created_at AS registered_at,
    (SELECT COUNT(*) FROM applications a WHERE a.student_id = s.id AND a.status != 'WITHDRAWN') AS app_count,
    (SELECT MAX(d.ctc_lpa) FROM applications a JOIN drives d ON d.id = a.drive_id
      WHERE a.student_id = s.id AND a.status = 'SELECTED' AND d.job_type != 'Internship') AS best_ctc,
    (SELECT c.name FROM applications a JOIN drives d ON d.id = a.drive_id JOIN companies c ON c.id = d.company_id
      WHERE a.student_id = s.id AND a.status = 'SELECTED' AND d.job_type != 'Internship' ORDER BY d.ctc_lpa DESC LIMIT 1) AS placed_company
  FROM students s JOIN users u ON u.id = s.user_id`;

const DRIVE_SELECT = `
  SELECT d.*, c.name AS company_name, c.sector AS company_sector,
    (SELECT COUNT(*) FROM applications a WHERE a.drive_id = d.id AND a.status != 'WITHDRAWN') AS applicant_count,
    (SELECT COUNT(*) FROM applications a WHERE a.drive_id = d.id AND a.status = 'SELECTED') AS selected_count,
    (SELECT COUNT(*) FROM applications a WHERE a.drive_id = d.id AND a.status = 'ACTIVE') AS active_count
  FROM drives d JOIN companies c ON c.id = d.company_id`;

const getDrive = (id) => {
  const d = db.get(`${DRIVE_SELECT} WHERE d.id = ?`, [Number(id)]);
  if (!d) { const e = new Error('Drive not found.'); e.status = 404; throw e; }
  return d;
};

const median = (arr) => {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : +((s[m - 1] + s[m]) / 2).toFixed(2);
};

// ============================================================ DASHBOARD
router.get('/stats', (req, res) => {
  const now = nowLocal();
  const students = db.all(`${STUDENT_SELECT}`);
  const be = students.filter((s) => s.year === 'BE');
  const placedBE = be.filter((s) => s.best_ctc != null);
  const ctcs = students.filter((s) => s.best_ctc != null).map((s) => s.best_ctc);

  const branchStats = Object.keys(BRANCHES).map((code) => {
    const inBranch = be.filter((s) => s.branch === code);
    const placed = inBranch.filter((s) => s.best_ctc != null).length;
    return { code, name: BRANCHES[code], total: inBranch.length, placed, rate: inBranch.length ? Math.round((placed / inBranch.length) * 100) : 0 };
  });

  const bands = [['< 5', 0, 5], ['5 – 8', 5, 8], ['8 – 12', 8, 12], ['12 – 20', 12, 20], ['20+', 20, Infinity]]
    .map(([label, lo, hi]) => ({ label, count: ctcs.filter((c) => c >= lo && c < hi).length }));

  res.json({
    emailEnabled: require('../lib/mailer').enabled,
    totals: {
      students: students.length,
      verified: students.filter((s) => s.is_verified).length,
      pending: students.filter((s) => !s.is_verified).length,
      beStudents: be.length,
      placed: placedBE.length,
      placementRate: be.length ? Math.round((placedBE.length / be.length) * 100) : 0,
      offers: db.get("SELECT COUNT(*) AS n FROM applications WHERE status = 'SELECTED'").n,
      activeDrives: db.get("SELECT COUNT(*) AS n FROM drives WHERE status = 'OPEN' AND deadline >= ?", [now]).n,
      companies: db.get('SELECT COUNT(*) AS n FROM companies').n,
      highestCtc: ctcs.length ? Math.max(...ctcs) : 0,
      averageCtc: ctcs.length ? +(ctcs.reduce((a, b) => a + b, 0) / ctcs.length).toFixed(2) : 0,
      medianCtc: median(ctcs),
    },
    branchStats,
    ctcBands: bands,
    companyOffers: db.all(
      `SELECT c.name, COUNT(*) AS offers, MAX(d.ctc_lpa) AS ctc FROM applications a
         JOIN drives d ON d.id = a.drive_id JOIN companies c ON c.id = d.company_id
        WHERE a.status = 'SELECTED' GROUP BY c.id ORDER BY offers DESC, ctc DESC LIMIT 8`),
    pendingVerifications: students.filter((s) => !s.is_verified)
      .sort((a, b) => (b.updated_at > a.updated_at ? 1 : -1)).slice(0, 6)
      .map((s) => ({ id: s.id, name: s.name, roll_no: s.roll_no, branch: s.branch, cgpa: s.cgpa, has_resume: !!s.resume_path, completion: profileCompletion(s).percent })),
    closingSoon: db.all(`${DRIVE_SELECT} WHERE d.status = 'OPEN' AND d.deadline >= ? ORDER BY d.deadline LIMIT 5`, [now]),
    recentApplications: db.all(
      `SELECT a.id, a.created_at, a.assigned_by_tpo, s.id AS student_id, s.name, s.branch, c.name AS company_name, d.role, d.id AS drive_id
         FROM applications a JOIN students s ON s.id = a.student_id JOIN drives d ON d.id = a.drive_id JOIN companies c ON c.id = d.company_id
        WHERE a.status != 'WITHDRAWN' ORDER BY a.created_at DESC, a.id DESC LIMIT 7`),
  });
});

// ============================================================ STUDENTS
function studentFilters(q) {
  const where = [];
  const params = [];
  if (q.q) {
    where.push('(s.name LIKE ? OR s.roll_no LIKE ? OR u.email LIKE ? OR s.skills LIKE ?)');
    const like = `%${String(q.q).trim()}%`;
    params.push(like, like, like, like);
  }
  if (q.branch) { where.push('s.branch = ?'); params.push(q.branch); }
  if (q.year) { where.push('s.year = ?'); params.push(q.year); }
  if (q.minCgpa) { where.push('s.cgpa >= ?'); params.push(Number(q.minCgpa)); }
  if (q.maxCgpa) { where.push('s.cgpa <= ?'); params.push(Number(q.maxCgpa)); }
  if (q.maxBacklogs !== undefined && q.maxBacklogs !== '') { where.push('s.backlogs <= ?'); params.push(Number(q.maxBacklogs)); }
  if (q.verified === '1') where.push('s.is_verified = 1');
  if (q.verified === '0') where.push('s.is_verified = 0');
  if (q.placed === '1') where.push(PLACED_SQL);
  if (q.placed === '0') where.push('NOT ' + PLACED_SQL);
  if (q.resume === '1') where.push('s.resume_path IS NOT NULL');
  if (q.resume === '0') where.push('s.resume_path IS NULL');
  const sortMap = { name: 's.name', cgpa: 's.cgpa', roll: 's.roll_no', branch: 's.branch, s.name', updated: 's.updated_at' };
  const sort = sortMap[q.sort] || 's.name';
  const dir = q.dir === 'desc' ? 'DESC' : 'ASC';
  return { sql: `${STUDENT_SELECT} ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY ${sort} ${dir}`, params };
}

router.get('/students', (req, res) => {
  const { sql, params } = studentFilters(req.query);
  res.json(db.all(sql, params).map((s) => ({
    id: s.id, name: s.name, roll_no: s.roll_no, email: s.email, branch: s.branch, year: s.year, cgpa: s.cgpa,
    backlogs: s.backlogs, is_verified: s.is_verified, has_resume: !!s.resume_path, app_count: s.app_count,
    best_ctc: s.best_ctc, placed_company: s.placed_company, skills: s.skills,
  })));
});

router.get('/students/:id', (req, res) => {
  const s = db.get(`${STUDENT_SELECT} WHERE s.id = ?`, [Number(req.params.id)]);
  if (!s) return res.status(404).json({ error: 'Student not found.' });
  const offer = bestOffer(s.id);
  const applications = db.all(
    `SELECT a.*, d.role, d.ctc_lpa, d.job_type, d.rounds, c.name AS company_name
       FROM applications a JOIN drives d ON d.id = a.drive_id JOIN companies c ON c.id = d.company_id
      WHERE a.student_id = ? ORDER BY a.updated_at DESC`, [s.id]).map((a) => ({ ...a, stage_label: stageLabel(a, a), rounds: rounds(a) }));
  const applied = new Set(applications.filter((a) => a.status !== 'WITHDRAWN').map((a) => a.drive_id));
  const driveOptions = db.all(`${DRIVE_SELECT} WHERE d.status = 'OPEN' ORDER BY d.deadline`)
    .filter((d) => !applied.has(d.id))
    .map((d) => ({ id: d.id, company_name: d.company_name, role: d.role, ctc_lpa: d.ctc_lpa, deadline: d.deadline,
      eligibility: checkEligibility(s, d, { bestOfferCtc: offer ? offer.ctc_lpa : null, ignoreDeadline: true }) }));
  const { password_hash, ...safe } = s; // never send hashes
  res.json({ ...safe, completion: profileCompletion(s), applications, driveOptions, offer });
});

router.patch('/students/:id/verify', (req, res) => {
  const b = req.body || {};
  const s = db.get('SELECT * FROM students WHERE id = ?', [Number(req.params.id)]);
  if (!s) return res.status(404).json({ error: 'Student not found.' });
  const verified = !!b.verified;
  const remark = v.str(b.remark, 'Remark', { max: 300 });
  if (verified && (s.cgpa == null || !s.resume_path)) {
    return res.status(400).json({ error: 'Cannot verify: the student has not filled CGPA or uploaded a resume yet.' });
  }
  db.run(`UPDATE students SET is_verified = ?, verified_at = ${verified ? "datetime('now')" : 'NULL'}, tpo_remark = ? WHERE id = ?`,
    [verified ? 1 : 0, remark, s.id]);
  notify(s.id, verified ? 'Your profile has been verified by the TPO. You can now apply to drives.'
    : `Your profile was sent back for changes${remark ? ': ' + remark : '.'} Academic fields are unlocked.`, '/student/profile.html');
  res.json({ ok: true });
});

router.post('/students/verify-bulk', (req, res) => {
  const ids = v.idList((req.body || {}).ids);
  let done = 0; const skipped = [];
  db.tx(() => {
    for (const id of ids) {
      const s = db.get('SELECT * FROM students WHERE id = ?', [id]);
      if (!s || s.is_verified) continue;
      if (s.cgpa == null || !s.resume_path) { skipped.push(s.name); continue; }
      db.run("UPDATE students SET is_verified = 1, verified_at = datetime('now'), tpo_remark = NULL WHERE id = ?", [id]);
      notify(id, 'Your profile has been verified by the TPO. You can now apply to drives.', '/student/drives.html');
      done++;
    }
  });
  res.json({ verified: done, skipped });
});

// ============================================================ COMPANIES
function companyInput(b = {}) {
  return {
    name: v.str(b.name, 'Company name', { required: true, max: 80 }),
    sector: v.str(b.sector, 'Sector', { max: 60 }),
    website: v.url(b.website, 'Website'),
    hq: v.str(b.hq, 'Headquarters', { max: 80 }),
    contact_name: v.str(b.contact_name, 'Contact person', { max: 80 }),
    contact_email: b.contact_email ? v.email(b.contact_email) : null,
    contact_phone: v.str(b.contact_phone, 'Contact phone', { max: 20 }),
    notes: v.str(b.notes, 'Notes', { max: 500 }),
  };
}

router.get('/companies', (req, res) => {
  res.json(db.all(
    `SELECT c.*,
       (SELECT COUNT(*) FROM drives d WHERE d.company_id = c.id) AS drive_count,
       (SELECT COUNT(*) FROM applications a JOIN drives d ON d.id = a.drive_id WHERE d.company_id = c.id AND a.status = 'SELECTED') AS offer_count,
       (SELECT MAX(ctc_lpa) FROM drives d WHERE d.company_id = c.id) AS max_ctc
     FROM companies c ORDER BY c.name`));
});

router.post('/companies', (req, res) => {
  const c = companyInput(req.body);
  if (db.get('SELECT 1 FROM companies WHERE name = ?', [c.name])) return res.status(409).json({ error: 'A company with this name already exists.' });
  const cols = Object.keys(c);
  const r = db.run(`INSERT INTO companies (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`, cols.map((k) => c[k]));
  res.status(201).json({ id: r.id });
});

router.put('/companies/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!db.get('SELECT 1 FROM companies WHERE id = ?', [id])) return res.status(404).json({ error: 'Company not found.' });
  const c = companyInput(req.body);
  if (db.get('SELECT 1 FROM companies WHERE name = ? AND id != ?', [c.name, id])) return res.status(409).json({ error: 'Another company already has this name.' });
  const cols = Object.keys(c);
  db.run(`UPDATE companies SET ${cols.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`, [...cols.map((k) => c[k]), id]);
  res.json({ ok: true });
});

router.delete('/companies/:id', (req, res) => {
  const r = db.run('DELETE FROM companies WHERE id = ?', [Number(req.params.id)]);
  if (!r.changes) return res.status(404).json({ error: 'Company not found.' });
  res.json({ ok: true });
});

// ============================================================ DRIVES
function driveInput(b = {}) {
  const branches = (Array.isArray(b.allowed_branches) ? b.allowed_branches : splitList(b.allowed_branches)).filter((x) => BRANCHES[x]);
  if (!branches.length) throw new v.ValidationError('Select at least one eligible branch.');
  const years = (Array.isArray(b.eligible_years) ? b.eligible_years : splitList(b.eligible_years)).filter((x) => ['TE', 'BE'].includes(x));
  if (!years.length) throw new v.ValidationError('Select at least one eligible year.');
  const roundList = (Array.isArray(b.rounds) ? b.rounds : String(b.rounds || '').split(/\n|,/))
    .map((r) => String(r).trim()).filter(Boolean).slice(0, 8);
  if (!roundList.length) throw new v.ValidationError('Add at least one selection round.');
  const deadline = v.str(b.deadline, 'Deadline', { required: true, max: 16 }).replace('T', ' ');
  if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(deadline)) throw new v.ValidationError('Deadline must be a valid date and time.');
  const driveDate = v.str(b.drive_date, 'Drive date', { max: 10 });
  if (driveDate && !/^\d{4}-\d{2}-\d{2}$/.test(driveDate)) throw new v.ValidationError('Drive date is invalid.');
  return {
    company_id: v.num(b.company_id, 'Company', { required: true, int: true, min: 1 }),
    role: v.str(b.role, 'Job role', { required: true, max: 80 }),
    job_type: v.oneOf(b.job_type || 'Full-time', 'job type', JOB_TYPES),
    ctc_lpa: v.num(b.ctc_lpa, 'CTC (LPA)', { required: true, min: 0, max: 200 }),
    location: v.str(b.location, 'Location', { max: 80 }),
    description: v.str(b.description, 'Description', { max: 2000 }),
    min_cgpa: v.num(b.min_cgpa, 'Minimum CGPA', { min: 0, max: 10 }) ?? 0,
    max_backlogs: v.num(b.max_backlogs, 'Max backlogs', { min: 0, max: 30, int: true }) ?? 0,
    min_tenth: v.num(b.min_tenth, 'Minimum 10th %', { min: 0, max: 100 }) ?? 0,
    min_twelfth: v.num(b.min_twelfth, 'Minimum 12th %', { min: 0, max: 100 }) ?? 0,
    allowed_branches: branches.join(','),
    eligible_years: years.join(','),
    rounds: JSON.stringify(roundList),
    deadline,
    drive_date: driveDate,
  };
}

router.get('/drives', (req, res) => {
  const now = nowLocal();
  res.json(db.all(`${DRIVE_SELECT} ORDER BY (d.status = 'OPEN' AND d.deadline >= ?) DESC, d.deadline DESC`, [now])
    .map((d) => ({ ...d, rounds: rounds(d), is_live: d.status === 'OPEN' && d.deadline >= now })));
});

router.get('/drives/:id', (req, res) => {
  const d = getDrive(req.params.id);
  const r = rounds(d);
  const stageCounts = ['Applied', ...r].map((label, i) => ({
    label, count: db.get("SELECT COUNT(*) AS n FROM applications WHERE drive_id = ? AND status = 'ACTIVE' AND stage = ?", [d.id, i]).n,
  }));
  res.json({ ...d, rounds: r, stageCounts, rejected_count: db.get("SELECT COUNT(*) AS n FROM applications WHERE drive_id = ? AND status = 'REJECTED'", [d.id]).n, is_live: d.status === 'OPEN' && d.deadline >= nowLocal() });
});

router.post('/drives', (req, res) => {
  const d = driveInput(req.body);
  if (!db.get('SELECT 1 FROM companies WHERE id = ?', [d.company_id])) throw new v.ValidationError('Select a valid company.');
  const cols = Object.keys(d);
  const r = db.run(`INSERT INTO drives (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`, cols.map((k) => d[k]));
  res.status(201).json({ id: r.id });
});

router.put('/drives/:id', (req, res) => {
  const existing = getDrive(req.params.id);
  const d = driveInput(req.body);
  const newRounds = JSON.parse(d.rounds);
  const maxStage = db.get("SELECT MAX(stage) AS m FROM applications WHERE drive_id = ? AND status = 'ACTIVE'", [existing.id]).m || 0;
  if (maxStage > newRounds.length) {
    throw new v.ValidationError(`Some applicants are already in round ${maxStage}. Keep at least ${maxStage} rounds.`);
  }
  const cols = Object.keys(d);
  db.run(`UPDATE drives SET ${cols.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`, [...cols.map((k) => d[k]), existing.id]);
  res.json({ ok: true });
});

router.patch('/drives/:id/status', (req, res) => {
  const d = getDrive(req.params.id);
  const status = v.oneOf((req.body || {}).status, 'status', ['OPEN', 'CLOSED']);
  db.run('UPDATE drives SET status = ? WHERE id = ?', [status, d.id]);
  res.json({ ok: true });
});

router.delete('/drives/:id', (req, res) => {
  const d = getDrive(req.params.id);
  db.run('DELETE FROM drives WHERE id = ?', [d.id]);
  res.json({ ok: true });
});

/** Students who meet the criteria and have NOT already applied. */
router.get('/drives/:id/eligible', (req, res) => {
  const d = getDrive(req.params.id);
  const taken = new Set(db.all("SELECT student_id FROM applications WHERE drive_id = ? AND status != 'WITHDRAWN'", [d.id]).map((r) => r.student_id));
  const students = db.all(`${STUDENT_SELECT} ORDER BY s.cgpa DESC`).filter((s) => !taken.has(s.id));
  const out = { eligible: [], ineligible: [] };
  for (const s of students) {
    const e = checkEligibility(s, d, { bestOfferCtc: s.best_ctc, ignoreDeadline: true });
    const row = { id: s.id, name: s.name, roll_no: s.roll_no, branch: s.branch, year: s.year, cgpa: s.cgpa, backlogs: s.backlogs,
      is_verified: s.is_verified, has_resume: !!s.resume_path, best_ctc: s.best_ctc, reasons: e.reasons };
    (e.eligible ? out.eligible : out.ineligible).push(row);
  }
  res.json(out);
});

/**
 * Assign students to a drive (creates applications on their behalf).
 * Ineligible students are refused unless `force` is true (TPO override).
 */
router.post('/drives/:id/assign', (req, res) => {
  const d = getDrive(req.params.id);
  const b = req.body || {};
  const ids = v.idList(b.studentIds);
  const force = !!b.force;
  const result = { assigned: [], already: [], ineligible: [] };

  db.tx(() => {
    for (const id of ids) {
      const s = db.get(`${STUDENT_SELECT} WHERE s.id = ?`, [id]);
      if (!s) continue;
      const existing = db.get('SELECT * FROM applications WHERE student_id = ? AND drive_id = ?', [id, d.id]);
      if (existing && existing.status !== 'WITHDRAWN') { result.already.push(s.name); continue; }
      const e = checkEligibility(s, d, { bestOfferCtc: s.best_ctc, ignoreDeadline: true });
      if (!e.eligible && !force) { result.ineligible.push({ id, name: s.name, reasons: e.reasons }); continue; }
      if (existing) {
        db.run("UPDATE applications SET status = 'ACTIVE', stage = 0, assigned_by_tpo = 1, created_at = datetime('now'), updated_at = datetime('now') WHERE id = ?", [existing.id]);
      } else {
        db.run('INSERT INTO applications (student_id, drive_id, assigned_by_tpo) VALUES (?, ?, 1)', [id, d.id]);
      }
      notify(id, `The TPO has registered you for ${d.company_name} — ${d.role}.`, '/student/applications.html');
      result.assigned.push(s.name);
    }
  });
  res.json(result);
});

router.get('/drives/:id/applicants', (req, res) => {
  const d = getDrive(req.params.id);
  const rows = db.all(
    `SELECT a.*, s.name, s.roll_no, s.branch, s.year, s.cgpa, s.backlogs, s.phone, s.resume_path, u.email
       FROM applications a JOIN students s ON s.id = a.student_id JOIN users u ON u.id = s.user_id
      WHERE a.drive_id = ? ORDER BY CASE a.status WHEN 'SELECTED' THEN 0 WHEN 'ACTIVE' THEN 1 WHEN 'REJECTED' THEN 2 ELSE 3 END, a.stage DESC, s.cgpa DESC`, [d.id]);
  res.json(rows.map((r) => ({ ...r, has_resume: !!r.resume_path, resume_path: undefined, stage_label: stageLabel(r, d) })));
});

/**
 * Bulk status update for applications of ONE drive.
 * action: advance | set_stage | select | reject | reactivate | remove
 */
router.post('/applications/bulk', (req, res) => {
  const b = req.body || {};
  const ids = v.idList(b.ids);
  const action = v.oneOf(b.action, 'action', ['advance', 'set_stage', 'select', 'reject', 'reactivate', 'remove']);
  let changed = 0; const skipped = [];

  db.tx(() => {
    for (const id of ids) {
      const a = db.get(`SELECT a.*, s.name, d.rounds, d.role, c.name AS company_name, d.id AS d_id
                          FROM applications a JOIN students s ON s.id = a.student_id JOIN drives d ON d.id = a.drive_id
                          JOIN companies c ON c.id = d.company_id WHERE a.id = ?`, [id]);
      if (!a) continue;
      const r = rounds(a);
      const label = `${a.company_name} — ${a.role}`;
      const link = '/student/applications.html';

      if (action === 'remove') {
        db.run('DELETE FROM applications WHERE id = ?', [id]);
        notify(a.student_id, `Your registration for ${label} was removed by the TPO.`, link);
        changed++; continue;
      }
      if (a.status === 'WITHDRAWN') { skipped.push(`${a.name} (withdrawn)`); continue; }

      if (action === 'advance') {
        if (a.status !== 'ACTIVE') { skipped.push(`${a.name} (not in process)`); continue; }
        if (a.stage >= r.length) { skipped.push(`${a.name} (already in final round)`); continue; }
        db.run("UPDATE applications SET stage = stage + 1, updated_at = datetime('now') WHERE id = ?", [id]);
        notify(a.student_id, `You have been shortlisted for ${r[a.stage]} — ${label}. All the best!`, link);
      } else if (action === 'set_stage') {
        const stage = v.num(b.stage, 'Stage', { required: true, int: true, min: 0, max: r.length });
        db.run("UPDATE applications SET status = 'ACTIVE', stage = ?, updated_at = datetime('now') WHERE id = ?", [stage, id]);
        notify(a.student_id, `Your status for ${label} is now: ${stage === 0 ? 'Applied' : r[stage - 1]}.`, link);
      } else if (action === 'select') {
        db.run("UPDATE applications SET status = 'SELECTED', stage = ?, updated_at = datetime('now') WHERE id = ?", [r.length, id]);
        notify(a.student_id, `🎉 Congratulations! You have been SELECTED at ${label}.`, link);
      } else if (action === 'reject') {
        if (a.status === 'REJECTED') continue;
        db.run("UPDATE applications SET status = 'REJECTED', updated_at = datetime('now') WHERE id = ?", [id]);
        notify(a.student_id, `Your application for ${label} did not move forward this time. Keep going!`, link);
      } else if (action === 'reactivate') {
        db.run("UPDATE applications SET status = 'ACTIVE', stage = MIN(stage, ?), updated_at = datetime('now') WHERE id = ?", [r.length, id]);
        notify(a.student_id, `Your application for ${label} is back in process.`, link);
      }
      changed++;
    }
  });
  res.json({ changed, skipped });
});

// ============================================================ ANNOUNCEMENTS
router.get('/announcements', (req, res) => {
  res.json(db.all(
    `SELECT a.*, CASE WHEN a.audience = 'DRIVE' THEN (SELECT c.name || ' — ' || d.role FROM drives d JOIN companies c ON c.id = d.company_id WHERE d.id = CAST(a.audience_value AS INTEGER)) END AS drive_label
       FROM announcements a ORDER BY a.is_pinned DESC, a.created_at DESC`));
});

router.post('/announcements', (req, res) => {
  const b = req.body || {};
  const audience = v.oneOf(b.audience || 'ALL', 'audience', ['ALL', 'BRANCH', 'DRIVE']);
  let value = null;
  if (audience === 'BRANCH') value = v.oneOf(b.audience_value, 'branch', Object.keys(BRANCHES));
  if (audience === 'DRIVE') { value = String(getDrive(b.audience_value).id); }
  const r = db.run('INSERT INTO announcements (title, body, audience, audience_value, is_pinned) VALUES (?, ?, ?, ?, ?)', [
    v.str(b.title, 'Title', { required: true, max: 120 }), v.str(b.body, 'Message', { required: true, max: 3000 }),
    audience, value, !!b.is_pinned]);
  res.status(201).json({ id: r.id });
});

router.patch('/announcements/:id/pin', (req, res) => {
  const r = db.run('UPDATE announcements SET is_pinned = ? WHERE id = ?', [!!(req.body || {}).is_pinned, Number(req.params.id)]);
  if (!r.changes) return res.status(404).json({ error: 'Announcement not found.' });
  res.json({ ok: true });
});

router.delete('/announcements/:id', (req, res) => {
  const r = db.run('DELETE FROM announcements WHERE id = ?', [Number(req.params.id)]);
  if (!r.changes) return res.status(404).json({ error: 'Announcement not found.' });
  res.json({ ok: true });
});

// ============================================================ CSV EXPORTS
const stamp = () => new Date().toISOString().slice(0, 10);

router.get('/export/students.csv', (req, res) => {
  const { sql, params } = studentFilters(req.query);
  sendCsv(res, `tsec-students-${stamp()}.csv`, [
    { label: 'Roll No', key: 'roll_no' }, { label: 'Name', key: 'name' }, { label: 'Email', key: 'email' },
    { label: 'Phone', key: 'phone' }, { label: 'Branch', key: 'branch' }, { label: 'Year', key: 'year' },
    { label: 'CGPA', key: 'cgpa' }, { label: 'Active Backlogs', key: 'backlogs' }, { label: '10th %', key: 'tenth_pct' },
    { label: '12th %', key: 'twelfth_pct' }, { label: 'Diploma %', key: 'diploma_pct' }, { label: 'Skills', key: 'skills' },
    { label: 'Verified', value: (r) => (r.is_verified ? 'Yes' : 'No') }, { label: 'Resume Uploaded', value: (r) => (r.resume_path ? 'Yes' : 'No') },
    { label: 'Applications', key: 'app_count' }, { label: 'Placed At', key: 'placed_company' }, { label: 'Best CTC (LPA)', key: 'best_ctc' },
  ], db.all(sql, params));
});

router.get('/export/drive/:id.csv', (req, res) => {
  const d = getDrive(req.params.id);
  const rows = db.all(
    `SELECT a.*, s.name, s.roll_no, s.branch, s.year, s.cgpa, s.backlogs, s.phone, u.email
       FROM applications a JOIN students s ON s.id = a.student_id JOIN users u ON u.id = s.user_id
      WHERE a.drive_id = ? ORDER BY s.roll_no`, [d.id]);
  const safe = `${d.company_name}-${d.role}`.replace(/[^\w]+/g, '-').toLowerCase();
  sendCsv(res, `${safe}-applicants-${stamp()}.csv`, [
    { label: 'Roll No', key: 'roll_no' }, { label: 'Name', key: 'name' }, { label: 'Email', key: 'email' }, { label: 'Phone', key: 'phone' },
    { label: 'Branch', key: 'branch' }, { label: 'Year', key: 'year' }, { label: 'CGPA', key: 'cgpa' }, { label: 'Backlogs', key: 'backlogs' },
    { label: 'Status', value: (r) => stageLabel(r, d) }, { label: 'Assigned by TPO', value: (r) => (r.assigned_by_tpo ? 'Yes' : 'No') },
    { label: 'Applied On', key: 'created_at' },
  ], rows);
});

router.get('/export/placements.csv', (req, res) => {
  const rows = db.all(
    `SELECT s.roll_no, s.name, s.branch, s.year, s.cgpa, c.name AS company, d.role, d.job_type, d.ctc_lpa, d.location, a.updated_at
       FROM applications a JOIN students s ON s.id = a.student_id JOIN drives d ON d.id = a.drive_id JOIN companies c ON c.id = d.company_id
      WHERE a.status = 'SELECTED' ORDER BY s.branch, s.roll_no`);
  sendCsv(res, `tsec-placements-${stamp()}.csv`, [
    { label: 'Roll No', key: 'roll_no' }, { label: 'Name', key: 'name' }, { label: 'Branch', key: 'branch' }, { label: 'Year', key: 'year' },
    { label: 'CGPA', key: 'cgpa' }, { label: 'Company', key: 'company' }, { label: 'Role', key: 'role' }, { label: 'Type', key: 'job_type' },
    { label: 'CTC (LPA)', key: 'ctc_lpa' }, { label: 'Location', key: 'location' }, { label: 'Selected On', key: 'updated_at' },
  ], rows);
});

router.get('/export/branch-report.csv', (req, res) => {
  const students = db.all(STUDENT_SELECT).filter((s) => s.year === 'BE');
  const rows = Object.entries(BRANCHES).map(([code, name]) => {
    const all = students.filter((s) => s.branch === code);
    const placed = all.filter((s) => s.best_ctc != null);
    const ctcs = placed.map((s) => s.best_ctc);
    return { code, name, total: all.length, placed: placed.length, rate: all.length ? ((placed.length / all.length) * 100).toFixed(1) : '0.0',
      highest: ctcs.length ? Math.max(...ctcs) : '', average: ctcs.length ? (ctcs.reduce((a, b) => a + b, 0) / ctcs.length).toFixed(2) : '' };
  });
  sendCsv(res, `tsec-branch-report-${stamp()}.csv`, [
    { label: 'Code', key: 'code' }, { label: 'Branch', key: 'name' }, { label: 'BE Students', key: 'total' }, { label: 'Placed', key: 'placed' },
    { label: 'Placement %', key: 'rate' }, { label: 'Highest CTC (LPA)', key: 'highest' }, { label: 'Average CTC (LPA)', key: 'average' },
  ], rows);
});

module.exports = router;
