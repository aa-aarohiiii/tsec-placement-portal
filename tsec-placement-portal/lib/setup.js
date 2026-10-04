/**
 * setup.js — runs before anything else:
 *   • creates .env from .env.example on the very first start
 *   • loads .env into process.env
 *   • makes sure the TPO account (from .env) exists
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const ENV = path.join(ROOT, '.env');
const EXAMPLE = path.join(ROOT, '.env.example');

function loadEnv() {
  let created = false;
  if (!fs.existsSync(ENV) && fs.existsSync(EXAMPLE)) { fs.copyFileSync(EXAMPLE, ENV); created = true; }
  require('dotenv').config({ path: ENV, quiet: true });
  return created;
}

const TPO_DEFAULT_PASSWORD = 'Tsec@2026';

function tpoConfig() {
  return {
    email: (process.env.TPO_EMAIL || 'tpo@tsec.edu').trim().toLowerCase(),
    name: (process.env.TPO_NAME || 'Training & Placement Cell').trim(),
    password: process.env.TPO_PASSWORD || TPO_DEFAULT_PASSWORD,
  };
}

/** Create the TPO login from .env if it doesn't exist yet. Returns true if created. */
function ensureTpo() {
  const db = require('../db');
  const bcrypt = require('bcryptjs');
  const t = tpoConfig();
  const existing = db.get('SELECT id, role FROM users WHERE email = ?', [t.email]);
  if (existing) {
    if (existing.role !== 'TPO') console.warn(`  ⚠ TPO_EMAIL ${t.email} belongs to a student account. Use a different TPO_EMAIL in .env.`);
    return false;
  }
  db.run('INSERT INTO users (email, password_hash, role, name) VALUES (?, ?, ?, ?)', [t.email, bcrypt.hashSync(t.password, 10), 'TPO', t.name]);
  return true;
}

module.exports = { loadEnv, ensureTpo, tpoConfig, TPO_DEFAULT_PASSWORD };
