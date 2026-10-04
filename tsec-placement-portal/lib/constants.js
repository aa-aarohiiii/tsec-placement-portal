/**
 * Shared constants used by the server (and sent to the browser via /api/meta).
 */
const BRANCHES = {
  COMPS: 'Computer Engineering',
  IT: 'Information Technology',
  EXTC: 'Electronics & Telecommunication',
  AIDS: 'Artificial Intelligence & Data Science',
  CHEM: 'Chemical Engineering',
  BIOTECH: 'Biotechnology',
};

const YEARS = { TE: 'Third Year (TE)', BE: 'Final Year (BE)' };

const JOB_TYPES = ['Full-time', 'Internship', 'Internship + PPO'];

module.exports = { BRANCHES, YEARS, JOB_TYPES };
