'use strict';

/**
 * Neoserve Projects — lead storage.
 *
 * Primary path: Node's built-in `node:sqlite` module (ships with Node 22.5+,
 * no npm install required) gives a real SQLite database at data/neoserve.db.
 *
 * Fallback path: if `node:sqlite` isn't available (older Node runtimes),
 * leads are stored in data/leads.json instead. The public API (addLead /
 * listLeads) is identical either way, so the rest of the app doesn't care
 * which backend is active.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

let mode = 'json';
let sqliteDb = null;

try {
  // eslint-disable-next-line global-require
  const { DatabaseSync } = require('node:sqlite');
  sqliteDb = new DatabaseSync(path.join(DATA_DIR, 'neoserve.db'));
  sqliteDb.exec(`
    CREATE TABLE IF NOT EXISTS leads (
      id TEXT PRIMARY KEY,
      createdAt TEXT NOT NULL,
      fullName TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT NOT NULL,
      company TEXT,
      projectType TEXT NOT NULL,
      location TEXT,
      message TEXT NOT NULL,
      ip TEXT,
      userAgent TEXT
    );
  `);
  mode = 'sqlite';
} catch (err) {
  mode = 'json';
}

const JSON_FILE = path.join(DATA_DIR, 'leads.json');
function readJsonFile() {
  if (!fs.existsSync(JSON_FILE)) return [];
  try {
    const raw = fs.readFileSync(JSON_FILE, 'utf8');
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    return [];
  }
}
function writeJsonFile(leads) {
  fs.writeFileSync(JSON_FILE, JSON.stringify(leads, null, 2), 'utf8');
}

function addLead(lead) {
  const record = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    fullName: lead.fullName,
    email: lead.email,
    phone: lead.phone,
    company: lead.company || '',
    projectType: lead.projectType,
    location: lead.location || '',
    message: lead.message,
    ip: lead.ip || '',
    userAgent: lead.userAgent || '',
  };

  if (mode === 'sqlite') {
    const stmt = sqliteDb.prepare(`
      INSERT INTO leads (id, createdAt, fullName, email, phone, company, projectType, location, message, ip, userAgent)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      record.id,
      record.createdAt,
      record.fullName,
      record.email,
      record.phone,
      record.company,
      record.projectType,
      record.location,
      record.message,
      record.ip,
      record.userAgent
    );
  } else {
    const leads = readJsonFile();
    leads.push(record);
    writeJsonFile(leads);
  }

  return record;
}

function listLeads() {
  if (mode === 'sqlite') {
    const rows = sqliteDb.prepare('SELECT * FROM leads ORDER BY createdAt DESC').all();
    return rows;
  }
  return readJsonFile().sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

module.exports = { addLead, listLeads, mode };
