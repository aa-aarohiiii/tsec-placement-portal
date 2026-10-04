/**
 * eligibility.js — THE single source of truth for "can this student apply?"
 * ----------------------------------------------------------------------------
 * It runs on the SERVER, so a student cannot bypass it from the browser.
 * It returns every individual check (not just yes/no) so the UI can show
 * exactly which criteria pass and which fail.
 *
 * TSEC-style "dream offer" rule: a student who already holds an offer may
 * only apply to drives paying at least DREAM_MULTIPLIER x their best offer.
 */
const { BRANCHES } = require('./constants');

const DREAM_MULTIPLIER = 1.5;

/** Current local time as 'YYYY-MM-DD HH:MM' (same format as drive deadlines). */
function nowLocal() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function splitList(s) {
  return String(s || '').split(',').map((x) => x.trim()).filter(Boolean);
}

/**
 * @param {object} student  row from `students`
 * @param {object} drive    row from `drives`
 * @param {object} ctx      { bestOfferCtc: number|null, ignoreDeadline?: boolean }
 */
function checkEligibility(student, drive, ctx = {}) {
  const checks = [];
  const add = (key, label, ok, detail) => checks.push({ key, label, ok: !!ok, detail });

  add('verified', 'Profile verified by TPO', student.is_verified === 1,
    student.is_verified === 1 ? 'Verified' : 'Not verified yet');

  const cgpa = student.cgpa ?? null;
  add('cgpa', `CGPA ≥ ${Number(drive.min_cgpa).toFixed(2)}`, cgpa !== null && cgpa >= drive.min_cgpa,
    cgpa === null ? 'CGPA not filled' : `CGPA ${Number(cgpa).toFixed(2)}${cgpa < drive.min_cgpa ? ` (needs ${drive.min_cgpa})` : ''}`);

  add('backlogs', drive.max_backlogs === 0 ? 'No active backlogs' : `Max ${drive.max_backlogs} active backlog(s)`,
    (student.backlogs ?? 0) <= drive.max_backlogs, `${student.backlogs ?? 0} active backlog${(student.backlogs ?? 0) === 1 ? '' : 's'}${(student.backlogs ?? 0) > drive.max_backlogs ? ` (max ${drive.max_backlogs})` : ''}`);

  const branches = splitList(drive.allowed_branches);
  add('branch', 'Branch allowed', branches.includes(student.branch),
    branches.includes(student.branch) ? BRANCHES[student.branch] || student.branch
      : `${student.branch} not allowed (open to ${branches.join(', ')})`);

  const years = splitList(drive.eligible_years);
  add('year', `Year: ${years.join(' / ')}`, years.includes(student.year), `Year ${student.year}${years.includes(student.year) ? '' : ` (open to ${years.join('/')})`}`);

  if (drive.min_tenth > 0) {
    add('tenth', `10th ≥ ${drive.min_tenth}%`, (student.tenth_pct ?? 0) >= drive.min_tenth,
      student.tenth_pct == null ? '10th % not filled' : `10th: ${student.tenth_pct}%${student.tenth_pct < drive.min_tenth ? ` (needs ${drive.min_tenth}%)` : ''}`);
  }
  if (drive.min_twelfth > 0) {
    // Diploma holders are evaluated on diploma % in place of 12th.
    const score = student.twelfth_pct ?? student.diploma_pct ?? 0;
    add('twelfth', `12th / Diploma ≥ ${drive.min_twelfth}%`, score >= drive.min_twelfth,
      score ? `12th/Diploma: ${score}%${score < drive.min_twelfth ? ` (needs ${drive.min_twelfth}%)` : ''}` : '12th / Diploma % not filled');
  }

  if (ctx.bestOfferCtc) {
    const need = +(ctx.bestOfferCtc * DREAM_MULTIPLIER).toFixed(2);
    add('dream', `Dream offer rule (≥ ₹${need} LPA)`, drive.ctc_lpa >= need,
      `Holds a ₹${ctx.bestOfferCtc} LPA offer${drive.ctc_lpa < need ? ` (dream drives need ≥ ₹${need} LPA)` : ''}`);
  }

  if (!ctx.ignoreDeadline) {
    const open = drive.status === 'OPEN' && drive.deadline >= nowLocal();
    add('open', 'Registrations open', open, drive.status !== 'OPEN' ? 'Drive closed by TPO' : open ? `Closes ${drive.deadline}` : 'Deadline has passed');
  }

  return { eligible: checks.every((c) => c.ok), checks, reasons: checks.filter((c) => !c.ok).map((c) => c.detail) };
}

module.exports = { checkEligibility, nowLocal, splitList, DREAM_MULTIPLIER };
