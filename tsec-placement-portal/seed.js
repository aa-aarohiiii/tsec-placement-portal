/**
 * seed.js — loads realistic demo data.
 *   npm run reset   -> deletes EVERYTHING; keeps only the TPO login from .env
 *   npm run demo    -> deletes everything and loads this sample data (for practice)
 *
 * All dates are relative to "now", so live drives are always open during
 * your demo no matter when you run the reset.
 *
 * Sample student logins (demo mode only): student1@demo.tsec.edu / student123
 * Demo accounts are flagged is_demo = 1 so the portal never emails them.
 */
require('./lib/setup').loadEnv();
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const db = require('./db');
const { BRANCHES } = require('./lib/constants');
const { checkEligibility } = require('./lib/eligibility');
const { resumePdf } = require('./lib/pdf');

const UPLOAD_DIR = path.join(__dirname, 'uploads', 'resumes');

// Deterministic random numbers so every reset produces the same data.
let seedState = 20260930;
const rand = () => { seedState = (seedState * 1664525 + 1013904223) % 4294967296; return seedState / 4294967296; };
const pick = (arr) => arr[Math.floor(rand() * arr.length)];

const pad = (n) => String(n).padStart(2, '0');
/** Local 'YYYY-MM-DD HH:MM' offset by days (for deadlines). */
function localAt(days, hour = 23, min = 59) {
  const d = new Date(); d.setDate(d.getDate() + days); d.setHours(hour, min, 0, 0);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
/** UTC 'YYYY-MM-DD HH:MM:SS' offset by days (for created_at columns). */
function utcAt(days, hours = 0) {
  const d = new Date(Date.now() + days * 864e5 + hours * 36e5);
  return d.toISOString().slice(0, 19).replace('T', ' ');
}

const STUDENTS = [
  // name, gender, branch, year, cgpa, backlogs, 10th, 12th, diploma, skills, verified, resume
  ['Aarav Mehta', 'Male', 'COMPS', 'BE', 8.72, 0, 94.2, 88.5, null, 'Java, Spring Boot, React, SQL, DSA', 1, 1],
  ['Riya Shah', 'Female', 'COMPS', 'BE', 9.21, 0, 96.4, 92.0, null, 'Python, Machine Learning, Django, AWS', 1, 1],
  ['Kabir Nair', 'Male', 'COMPS', 'BE', 7.48, 1, 85.0, 78.6, null, 'C++, Node.js, MongoDB', 0, 1],
  ['Sneha Kulkarni', 'Female', 'COMPS', 'BE', 8.05, 0, 91.0, 84.2, null, 'JavaScript, React, Figma, Firebase', 1, 1],
  ['Yash Agarwal', 'Male', 'COMPS', 'BE', 6.92, 0, 82.4, 71.0, null, 'PHP, Laravel, MySQL', 1, 1],
  ['Ishita Joshi', 'Female', 'COMPS', 'BE', 8.44, 0, 93.8, 90.2, null, 'Go, Kubernetes, Docker, Linux', 1, 1],
  ['Aditya Iyer', 'Male', 'IT', 'BE', 8.91, 0, 95.0, 91.4, null, 'Java, Microservices, Kafka, SQL', 1, 1],
  ['Pooja Deshmukh', 'Female', 'IT', 'BE', 7.86, 0, 88.6, 80.0, null, 'Selenium, Java, Test Automation', 1, 1],
  ['Rohan Gupta', 'Male', 'IT', 'BE', 7.12, 2, 79.4, 70.8, null, 'HTML, CSS, JavaScript, WordPress', 1, 1],
  ['Tanvi Patil', 'Female', 'IT', 'BE', 8.33, 0, 90.2, 86.4, null, 'Power BI, SQL, Python, Excel', 1, 1],
  ['Harsh Vora', 'Male', 'IT', 'BE', 7.64, 0, 86.0, 0, 84.5, 'Networking, CCNA, Linux, Bash', 0, 1],
  ['Meera Pillai', 'Female', 'AIDS', 'BE', 9.05, 0, 97.0, 93.6, null, 'PyTorch, NLP, LLMs, Python', 1, 1],
  ['Siddharth Rao', 'Male', 'AIDS', 'BE', 8.18, 0, 89.4, 85.0, null, 'TensorFlow, OpenCV, Flask', 1, 1],
  ['Ananya Bhatt', 'Female', 'AIDS', 'BE', 7.95, 0, 92.4, 83.8, null, 'R, Statistics, Tableau, SQL', 1, 1],
  ['Varun Malhotra', 'Male', 'AIDS', 'BE', 6.78, 1, 80.0, 69.4, null, 'Python, Pandas, Scikit-learn', 1, 1],
  ['Nikhil Shetty', 'Male', 'EXTC', 'BE', 8.26, 0, 91.6, 87.0, null, 'Embedded C, ARM, IoT, PCB Design', 1, 1],
  ['Priya Menon', 'Female', 'EXTC', 'BE', 7.71, 0, 88.0, 82.2, null, 'VLSI, Verilog, MATLAB', 1, 1],
  ['Omkar Sawant', 'Male', 'EXTC', 'BE', 7.02, 0, 83.2, 0, 81.0, 'Arduino, Raspberry Pi, Python', 1, 1],
  ['Diya Chopra', 'Female', 'EXTC', 'BE', 8.58, 0, 94.0, 89.6, null, 'Signal Processing, Python, 5G', 0, 1],
  ['Kunal Jain', 'Male', 'EXTC', 'BE', 6.45, 3, 76.0, 66.0, null, 'Networking, C', 1, 1],
  ['Aditi Kamath', 'Female', 'CHEM', 'BE', 8.12, 0, 90.0, 86.8, null, 'Aspen Plus, Process Design, MATLAB', 1, 1],
  ['Rahul Tiwari', 'Male', 'CHEM', 'BE', 7.36, 0, 84.4, 76.2, null, 'Process Safety, AutoCAD, HAZOP', 1, 1],
  ['Shruti Naik', 'Female', 'CHEM', 'BE', 7.89, 0, 87.6, 81.0, null, 'Polymer Tech, Lab Analysis', 1, 1],
  ['Aryan Kapoor', 'Male', 'BIOTECH', 'BE', 7.58, 0, 86.0, 79.2, null, 'Bioinformatics, Python, PCR', 1, 1],
  ['Neha Reddy', 'Female', 'BIOTECH', 'BE', 8.4, 0, 92.0, 88.0, null, 'Genomics, R, Lab Techniques', 1, 1],
  ['Zoya Khan', 'Female', 'COMPS', 'BE', 7.25, 0, 84.0, 77.4, null, 'Flutter, Dart, Firebase', 0, 0],
  ['Arjun Desai', 'Male', 'IT', 'BE', null, 0, null, null, null, null, 0, 0],
  ['Krish Thakkar', 'Male', 'COMPS', 'TE', 8.85, 0, 95.4, 90.8, null, 'C++, DSA, Competitive Programming', 1, 1],
  ['Sara D\'Souza', 'Female', 'IT', 'TE', 8.62, 0, 93.0, 89.0, null, 'React, TypeScript, Node.js', 1, 1],
  ['Dev Bhandari', 'Male', 'AIDS', 'TE', 8.1, 0, 90.4, 85.6, null, 'Python, Data Analysis, SQL', 1, 1],
  ['Isha Sinha', 'Female', 'EXTC', 'TE', 7.9, 0, 89.0, 84.0, null, 'Embedded Systems, C', 1, 1],
  ['Manav Lodha', 'Male', 'COMPS', 'TE', 7.42, 0, 85.2, 80.6, null, 'Java, Android, Kotlin', 0, 1],
];

const COMPANIES = [
  ['Tata Consultancy Services', 'IT Services', 'https://www.tcs.com', 'Mumbai', 'Campus Hiring Team', 'campus.hiring@example.com'],
  ['Accenture', 'Consulting', 'https://www.accenture.com', 'Dublin / Bengaluru', 'Aparna Sen', 'india.campus@example.com'],
  ['Deloitte USI', 'Consulting & Audit', 'https://www2.deloitte.com', 'Hyderabad', 'Rakesh Menon', 'usi.campus@example.com'],
  ['L&T Technology Services', 'Engineering R&D', 'https://www.ltts.com', 'Vadodara', 'Priyanka Rao', 'ltts.campus@example.com'],
  ['Reliance Industries', 'Petrochemicals & Energy', 'https://www.ril.com', 'Mumbai', 'HR — Graduate Engineer Program', 'get.hiring@example.com'],
  ['JPMorgan Chase & Co.', 'Banking & Fintech', 'https://www.jpmorganchase.com', 'Mumbai', 'Early Careers India', 'early.careers@example.com'],
  ['Morgan Stanley', 'Investment Banking Tech', 'https://www.morganstanley.com', 'Mumbai', 'Campus Recruitment', 'ms.campus@example.com'],
  ['Media.net', 'Ad-tech', 'https://www.media.net', 'Mumbai', 'Tech Recruiting', 'recruit@example.com'],
  ['Barclays', 'Banking Technology', 'https://home.barclays', 'Pune', 'Graduate Programmes', 'grad.india@example.com'],
];

const ALL_TECH = 'COMPS,IT,AIDS,EXTC';
const DRIVES = [
  // company idx, role, type, ctc, location, minCgpa, maxBacklogs, branches, years, rounds, deadlineDays, driveDays, status, min10, min12
  [0, 'Assistant System Engineer (Ninja)', 'Full-time', 3.36, 'Pan India', 6.0, 1, 'COMPS,IT,AIDS,EXTC,CHEM,BIOTECH', 'BE', ['Online Test (NQT)', 'Technical Interview', 'HR Interview'], -48, -42, 'CLOSED', 60, 60],
  [0, 'Systems Engineer (Digital)', 'Full-time', 7.0, 'Mumbai / Pune', 7.0, 0, ALL_TECH, 'BE', ['Advanced Coding Test', 'Technical Interview', 'Managerial + HR'], -50, -44, 'CLOSED', 60, 60],
  [1, 'Associate Software Engineer', 'Full-time', 4.5, 'Mumbai / Bengaluru', 6.5, 0, 'COMPS,IT,AIDS,EXTC,CHEM', 'BE', ['Cognitive Assessment', 'Coding Round', 'Communication Test', 'Interview'], -40, -35, 'CLOSED', 0, 0],
  [2, 'Analyst — Technology Consulting', 'Full-time', 7.6, 'Hyderabad / Mumbai', 7.0, 0, ALL_TECH, 'BE', ['Aptitude Test', 'Group Discussion', 'Technical Interview', 'Partner Interview'], -30, -24, 'CLOSED', 60, 60],
  [3, 'Graduate Engineer Trainee — Embedded', 'Full-time', 5.0, 'Vadodara / Mumbai', 6.5, 0, 'EXTC,COMPS,IT', 'BE', ['Technical Test', 'Technical Interview', 'HR Interview'], -22, -18, 'CLOSED', 0, 0],
  [4, 'Graduate Engineer Trainee — Process', 'Full-time', 6.5, 'Jamnagar', 7.0, 0, 'CHEM,BIOTECH', 'BE', ['Aptitude Test', 'Technical Interview', 'HR Interview'], -16, -12, 'CLOSED', 60, 60],
  [5, 'Software Engineer Program', 'Full-time', 14.0, 'Mumbai', 8.0, 0, ALL_TECH, 'BE', ['Online Coding Assessment', 'Code for Good Hackathon', 'Technical Interview', 'HR Interview'], 5, 12, 'OPEN', 70, 70],
  [6, 'Technology Analyst', 'Full-time', 18.5, 'Mumbai', 8.5, 0, 'COMPS,IT,AIDS', 'BE', ['HackerRank Test', 'Technical Interview 1', 'Technical Interview 2', 'HR Interview'], 2, 8, 'OPEN', 75, 75],
  [7, 'Software Development Engineer', 'Full-time', 25.0, 'Mumbai', 8.0, 0, 'COMPS,IT,AIDS', 'BE', ['Online Test', 'DSA Interview', 'System Design', 'Culture Fit'], 9, 16, 'OPEN', 0, 0],
  [8, 'Summer Analyst — Technology', 'Internship + PPO', 12.0, 'Pune', 7.5, 0, ALL_TECH, 'TE', ['Online Assessment', 'Technical Interview', 'HR Interview'], 7, 14, 'OPEN', 0, 0],
  [2, 'Risk Advisory Analyst', 'Full-time', 8.2, 'Mumbai', 7.0, 0, 'COMPS,IT,AIDS,EXTC,CHEM,BIOTECH', 'BE', ['Aptitude Test', 'Case Interview', 'HR Interview'], 12, 18, 'OPEN', 60, 60],
];

const DESCRIPTIONS = {
  0: 'Join TCS as an Assistant System Engineer. Selected candidates go through the Initial Learning Program (ILP) before project allocation. Service agreement applicable as per company policy.',
  1: 'Digital cadre role for candidates with strong coding skills. Work on cloud, data and modern application stacks for global clients.',
  2: 'Associate Software Engineers work across application development, testing and maintenance for Accenture clients. Relocation may be required.',
  3: 'Work with Deloitte USI Technology Consulting teams on ERP, cloud and digital transformation projects. Strong communication skills are essential.',
  4: 'Design and validate embedded firmware for automotive and industrial products. Candidates must be comfortable with C and microcontrollers.',
  5: 'Graduate Engineer Trainees join the Jamnagar refinery complex and rotate across process units in their first year.',
  6: 'The Software Engineer Program places graduates in agile teams building banking platforms. Shortlisted students participate in the Code for Good hackathon.',
  7: 'Technology Analysts at Morgan Stanley build trading, risk and wealth-management systems. Expect a strong focus on DSA and problem solving.',
  8: 'SDEs at Media.net work on high-scale ad-tech systems serving billions of requests per day. Strong DSA and system-design fundamentals required.',
  9: 'Eight-week summer internship for third-year students with a Pre-Placement Offer (PPO) for strong performers.',
  10: 'Risk Advisory analysts help clients with cyber, regulatory and operational risk. Open to all branches.',
};

function resumeFor(s, roll, email) {
  const hasDiploma = s.diploma_pct != null;
  return resumePdf({
    name: s.name,
    headline: `${BRANCHES[s.branch]} | Thadomal Shahani Engineering College, Mumbai`,
    contact: `${email}  |  +91 98${Math.floor(10000000 + rand() * 89999999)}  |  linkedin.com/in/${s.name.toLowerCase().replace(/[^a-z]+/g, '-')}`,
    sections: [
      { title: 'Education', lines: [
        `B.E. ${BRANCHES[s.branch]} - TSEC, University of Mumbai (${s.year === 'BE' ? '2023 - 2027' : '2024 - 2028'})  |  CGPA: ${s.cgpa ?? '-'}`,
        hasDiploma ? `Diploma in Engineering - ${s.diploma_pct}%` : `HSC (Class XII) - ${s.twelfth_pct ?? '-'}%`,
        `SSC (Class X) - ${s.tenth_pct ?? '-'}%`,
      ] },
      { title: 'Technical Skills', lines: [s.skills || '-'] },
      { title: 'Projects', lines: [
        `Campus Placement Portal - full-stack web app with role-based login, resume uploads and analytics dashboards.`,
        `${(s.skills || 'Software').split(',')[0].trim()} mini-project - designed, built and documented as part of the semester curriculum.`,
      ] },
      { title: 'Achievements & Activities', lines: [
        'Member, TSEC technical council; volunteered at the annual technical festival.',
        'Completed online certifications relevant to the skills listed above.',
      ] },
    ],
  });
}

async function seed() {
  const hash = bcrypt.hashSync('student123', 10);
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  for (const f of fs.readdirSync(UPLOAD_DIR)) if (f.endsWith('.pdf')) fs.unlinkSync(path.join(UPLOAD_DIR, f));

  db.tx(() => {

    // ---- students
    const counters = {};
    const codes = { COMPS: 'CE', IT: 'IT', EXTC: 'ET', AIDS: 'AD', CHEM: 'CH', BIOTECH: 'BT' };
    const students = STUDENTS.map((row, i) => {
      const [name, gender, branch, year, cgpa, backlogs, tenth, twelfth, diploma, skills, verified, hasResume] = row;
      counters[branch + year] = (counters[branch + year] || 0) + 1;
      const roll = `${year === 'BE' ? '23' : '24'}${codes[branch]}${String(counters[branch + year] * 7 + 3).padStart(3, '0')}`;
      const email = `student${i + 1}@demo.tsec.edu`;
      const u = db.run('INSERT INTO users (email, password_hash, role, name, created_at, is_demo) VALUES (?, ?, ?, ?, ?, 1)', [email, hash, 'STUDENT', name, utcAt(-70 + i)]);
      const s = { name, gender, branch, year, cgpa, backlogs, tenth_pct: tenth, twelfth_pct: twelfth || null, diploma_pct: diploma, skills, is_verified: verified };
      const first = name.split(' ')[0].toLowerCase();
      const r = db.run(
        `INSERT INTO students (user_id, name, roll_no, branch, year, gender, dob, phone, cgpa, backlogs, tenth_pct, twelfth_pct, diploma_pct,
           skills, linkedin, github, about, is_verified, verified_at, updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [u.id, name, roll, branch, year, gender, `${year === 'BE' ? 2004 : 2005}-${pad(1 + (i % 12))}-${pad(3 + (i % 25))}`,
          cgpa == null ? null : `${[98, 99, 97, 88, 93][i % 5]}${String(31415926 + i * 7654321).slice(-8)}`, cgpa, backlogs, tenth, twelfth || null, diploma,
          skills, skills ? `https://www.linkedin.com/in/${first}-${codes[branch].toLowerCase()}` : null,
          skills && ['COMPS', 'IT', 'AIDS'].includes(branch) ? `https://github.com/${first}${i + 1}` : null,
          skills ? `${year === 'BE' ? 'Final-year' : 'Third-year'} ${BRANCHES[branch]} student interested in ${skills.split(',')[0].trim()} and building things that ship.` : null,
          verified, verified ? utcAt(-40 + i) : null, utcAt(-30 + (i % 20))]);
      s.id = r.id;
      if (hasResume) {
        const file = `student-${r.id}-seed.pdf`;
        fs.writeFileSync(path.join(UPLOAD_DIR, file), resumeFor(s, roll, email));
        db.run("UPDATE students SET resume_path = ?, resume_name = ?, resume_uploaded_at = ? WHERE id = ?",
          [file, `${name.replace(/[^\w]+/g, '_')}_Resume.pdf`, utcAt(-35 + (i % 20)), r.id]);
      }
      return s;
    });

    // ---- companies
    const companyIds = COMPANIES.map((c) => db.run(
      'INSERT INTO companies (name, sector, website, hq, contact_name, contact_email, contact_phone, notes, created_at) VALUES (?,?,?,?,?,?,?,?,?)',
      [...c, '+91 22 4000 ' + String(1000 + Math.floor(rand() * 8999)), 'Regular recruiter at TSEC.', utcAt(-90)]).id);

    // ---- drives + applications (processed in date order so the "dream offer" rule is respected)
    const bestOffer = {}; // studentId -> ctc
    DRIVES.forEach((d, idx) => {
      const [ci, role, type, ctc, loc, minCgpa, maxBl, branches, years, rounds, dl, dd, status, m10, m12] = d;
      const drive = { id: 0, role, job_type: type, ctc_lpa: ctc, min_cgpa: minCgpa, max_backlogs: maxBl, allowed_branches: branches,
        eligible_years: years, status, deadline: localAt(dl), min_tenth: m10, min_twelfth: m12 };
      drive.id = db.run(
        `INSERT INTO drives (company_id, role, job_type, ctc_lpa, location, description, min_cgpa, max_backlogs, min_tenth, min_twelfth,
           allowed_branches, eligible_years, rounds, deadline, drive_date, status, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [companyIds[ci], role, type, ctc, loc, DESCRIPTIONS[idx], minCgpa, maxBl, m10, m12, branches, years, JSON.stringify(rounds),
          drive.deadline, localAt(dd).slice(0, 10), status, utcAt(dl - 10)]).id;

      const past = dl < 0;
      for (const s of students) {
        if (s.id === students[0].id && past) continue; // student1's history is set by hand below
        const offer = type === 'Internship' ? null : bestOffer[s.id] || null;
        const e = checkEligibility(s, drive, { bestOfferCtc: offer, ignoreDeadline: true });
        if (!e.eligible) continue;
        const r = rand();
        if (!past) {
          // live drives: some students have already applied
          if (s.id !== students[0].id && (r < 0.45 || s.id === students[1].id)) {
            const assigned = rand() < 0.2 ? 1 : 0;
            db.run('INSERT INTO applications (student_id, drive_id, status, stage, assigned_by_tpo, created_at, updated_at) VALUES (?,?,?,?,?,?,?)',
              [s.id, drive.id, 'ACTIVE', 0, assigned, utcAt(-Math.floor(rand() * 4), -Math.floor(rand() * 20)), utcAt(-1)]);
          }
          continue;
        }
        // Toppers usually skip mass-recruiter drives; everyone else applies most of the time.
        if (ctc < 5 && s.cgpa >= 8.5 && r < 0.7) continue;
        if (r > 0.85) continue;
        // Past drive: decide how far each applicant got. Higher CGPA -> better odds.
        const odds = 0.28 + (s.cgpa - minCgpa) * 0.12;
        let statusOut; let stage;
        if (rand() < odds) { statusOut = 'SELECTED'; stage = rounds.length; bestOffer[s.id] = Math.max(bestOffer[s.id] || 0, ctc); }
        else { statusOut = 'REJECTED'; stage = Math.floor(rand() * rounds.length); }
        db.run('INSERT INTO applications (student_id, drive_id, status, stage, assigned_by_tpo, created_at, updated_at) VALUES (?,?,?,?,?,?,?)',
          [s.id, drive.id, statusOut, stage, 0, utcAt(dl - 3), utcAt(dd + 1)]);
      }
    });

    // Give student1 (the demo student) an interesting mix of stages on the live drives.
    const s1 = students[0].id;
    const jpm = db.get("SELECT d.id FROM drives d JOIN companies c ON c.id = d.company_id WHERE c.name LIKE 'JPMorgan%'");
    const risk = db.get("SELECT id FROM drives WHERE role = 'Risk Advisory Analyst'");
    const deloitte = db.get("SELECT id FROM drives WHERE role = 'Analyst — Technology Consulting'");
    const tcsDigital = db.get("SELECT id FROM drives WHERE role = 'Systems Engineer (Digital)'");
    db.run('DELETE FROM applications WHERE student_id = ? AND drive_id IN (?, ?)', [s1, jpm.id, risk.id]);
    db.run("INSERT INTO applications (student_id, drive_id, status, stage, created_at, updated_at) VALUES (?, ?, 'REJECTED', 3, ?, ?)", [s1, deloitte.id, utcAt(-33), utcAt(-23)]);
    db.run("INSERT INTO applications (student_id, drive_id, status, stage, created_at, updated_at) VALUES (?, ?, 'REJECTED', 2, ?, ?)", [s1, tcsDigital.id, utcAt(-53), utcAt(-43)]);
    db.run("INSERT INTO applications (student_id, drive_id, status, stage, created_at, updated_at) VALUES (?, ?, 'ACTIVE', 2, ?, ?)", [s1, jpm.id, utcAt(-3), utcAt(-1)]);
    db.run("INSERT INTO applications (student_id, drive_id, status, stage, assigned_by_tpo, created_at, updated_at) VALUES (?, ?, 'ACTIVE', 0, 1, ?, ?)", [s1, risk.id, utcAt(-1), utcAt(-1)]);
    // Also move a handful of other JPMorgan applicants forward so the pipeline looks alive.
    db.run("UPDATE applications SET stage = 1 WHERE drive_id = ? AND student_id != ? AND id % 2 = 0", [jpm.id, s1]);

    // ---- announcements
    const ann = [
      ['Placement Season 2026-27 is live', 'Welcome to the 2026-27 placement season. Keep your profile complete and your resume updated — the TPO verifies profiles before you can apply. Carry your college ID and two printed copies of your resume to every drive.', 'ALL', null, 1, -60],
      ['Code of conduct for drives', 'Students who are selected in a drive must accept the offer. Placed students can only apply to “dream” drives offering at least 1.5x their current CTC. Missing a drive you registered for without informing the TPO office may lead to debarment from the next two drives.', 'ALL', null, 1, -58],
      ['Resume review session — Thursday, 3 PM', 'The T&P cell is running a resume review session in the seminar hall. Bring a laptop with your latest resume. Seats are first come, first served.', 'ALL', null, 0, -6],
      ['JPMorgan Chase — Code for Good briefing', 'Shortlisted students for the JPMorgan Software Engineer Program must attend the Code for Good briefing on Google Meet this Friday at 5 PM. The link will be emailed to your registered address.', 'DRIVE', String(jpm.id), 0, -1],
      ['Computer Engineering: mock interview drive', 'Alumni from product companies will conduct mock technical interviews for BE Computer Engineering students next Saturday. Register at the T&P office by Wednesday.', 'BRANCH', 'COMPS', 0, -2],
    ];
    for (const [title, body, aud, val, pin, days] of ann) {
      db.run('INSERT INTO announcements (title, body, audience, audience_value, is_pinned, created_at) VALUES (?,?,?,?,?,?)', [title, body, aud, val, pin, utcAt(days)]);
    }
    // Student1 has "seen" older announcements, so the two newest show as unread.
    db.run('UPDATE students SET announcements_seen_at = ? WHERE id = ?', [utcAt(-5), s1]);

    // ---- notifications for the demo student
    const notes = [
      ['Your profile has been verified by the TPO. You can now apply to drives.', '/student/drives.html', -40, 1],
      ['You have been shortlisted for Online Coding Assessment — JPMorgan Chase & Co. — Software Engineer Program.', '/student/applications.html', -2, 1],
      ['You have been shortlisted for Code for Good Hackathon — JPMorgan Chase & Co. — Software Engineer Program. All the best!', '/student/applications.html', -1, 0],
      ['The TPO has registered you for Deloitte USI — Risk Advisory Analyst.', '/student/applications.html', -1, 0],
    ];
    for (const [m, l, d, read] of notes) db.run('INSERT INTO notifications (student_id, message, link, is_read, created_at) VALUES (?,?,?,?,?)', [s1, m, l, read, utcAt(d)]);
  });
}

module.exports = { seed };

// `npm run reset` — wipe and reseed
if (require.main === module) {
  (async () => {
    const demo = process.argv.includes('--demo');
    await db.init({ fresh: true });
    const setup = require('./lib/setup');
    setup.ensureTpo();
    const tpo = setup.tpoConfig();
    if (demo) await seed();
    const n = db.get('SELECT (SELECT COUNT(*) FROM students) s, (SELECT COUNT(*) FROM drives) d, (SELECT COUNT(*) FROM applications) a');
    if (demo) {
      console.log(`\n  ✔ Sample data loaded: ${n.s} students, ${n.d} drives, ${n.a} applications.`);
      console.log('  Sample student login: student1@demo.tsec.edu / student123  (sample accounts never receive emails)');
    } else {
      console.log('\n  ✔ Database reset. Everything was deleted except the TPO login.');
    }
    console.log(`  TPO login: ${tpo.email} / ${tpo.password}  (password from .env)\n`);
    console.log('  If the server is running, just refresh the browser.\n');
  })();
}
