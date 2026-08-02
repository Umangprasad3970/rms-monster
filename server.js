'use strict';

/**
 * Neoserve Projects — website server.
 *
 * Zero external dependencies: uses only Node's built-in `http`, `fs`,
 * `path`, and (via lib/db.js) `node:sqlite`. Run with `node server.js`.
 *
 * Routes:
 *   GET  /...            static files from /public, clean fallback to 404.html
 *   POST /api/contact     validate + store a project lead
 *   GET  /api/leads       list stored leads (requires X-Admin-Key header)
 *   GET  /api/health      simple health check
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { addLead, listLeads, mode } = require('./lib/db');

const PORT = process.env.PORT || 3000;
const ADMIN_KEY = process.env.ADMIN_KEY || '';
const PUBLIC_DIR = path.join(__dirname, 'public');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
};

// ---------------------------------------------------------------------------
// Very small in-memory rate limiter for the contact form (per IP).
// ---------------------------------------------------------------------------
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const RATE_LIMIT_MAX = 6;
const submissionLog = new Map(); // ip -> [timestamps]

function isRateLimited(ip) {
  const now = Date.now();
  const timestamps = (submissionLog.get(ip) || []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  timestamps.push(now);
  submissionLog.set(ip, timestamps);
  return timestamps.length > RATE_LIMIT_MAX;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

function readBody(req, limitBytes = 1e6) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > limitBytes) {
        reject(new Error('Payload too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateLead(payload) {
  const errors = [];
  if (!payload.fullName || String(payload.fullName).trim().length < 2) errors.push('Full name is required.');
  if (!payload.email || !EMAIL_RE.test(String(payload.email).trim())) errors.push('A valid email is required.');
  if (!payload.phone || String(payload.phone).trim().length < 6) errors.push('A valid phone number is required.');
  if (!payload.projectType || String(payload.projectType).trim().length < 2) errors.push('Project type is required.');
  if (!payload.message || String(payload.message).trim().length < 5) errors.push('Please add a short project description.');
  return errors;
}

function getClientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (fwd) return String(fwd).split(',')[0].trim();
  return req.socket.remoteAddress || '';
}

function safeJoin(base, requestPath) {
  const decoded = decodeURIComponent(requestPath.split('?')[0]);
  const target = path.normalize(path.join(base, decoded));
  if (!target.startsWith(base)) return null; // path traversal guard
  return target;
}

function serveFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const type = MIME[ext] || 'application/octet-stream';
  const stream = fs.createReadStream(filePath);
  stream.on('open', () => {
    res.writeHead(200, { 'Content-Type': type });
    stream.pipe(res);
  });
  stream.on('error', () => serve404(res));
}

function serve404(res) {
  const notFoundPath = path.join(PUBLIC_DIR, '404.html');
  fs.readFile(notFoundPath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
      return;
    }
    res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(data);
  });
}

// ---------------------------------------------------------------------------
// Route handlers
// ---------------------------------------------------------------------------
async function handleContact(req, res) {
  let payload;
  try {
    const raw = await readBody(req);
    payload = JSON.parse(raw || '{}');
  } catch (err) {
    return sendJson(res, 400, { success: false, error: 'Invalid request body.' });
  }

  // Honeypot — bots fill every field, real users never see this one.
  if (payload.website) {
    return sendJson(res, 200, { success: true });
  }

  const ip = getClientIp(req);
  if (isRateLimited(ip)) {
    return sendJson(res, 429, { success: false, error: 'Too many submissions. Please try again later or call us directly.' });
  }

  const errors = validateLead(payload);
  if (errors.length) {
    return sendJson(res, 400, { success: false, error: errors[0] });
  }

  const record = addLead({
    fullName: String(payload.fullName).trim().slice(0, 200),
    email: String(payload.email).trim().slice(0, 200),
    phone: String(payload.phone).trim().slice(0, 60),
    company: String(payload.company || '').trim().slice(0, 200),
    projectType: String(payload.projectType).trim().slice(0, 100),
    location: String(payload.location || '').trim().slice(0, 200),
    message: String(payload.message).trim().slice(0, 4000),
    ip,
    userAgent: req.headers['user-agent'] || '',
  });

  return sendJson(res, 201, { success: true, id: record.id });
}

function handleLeads(req, res) {
  if (!ADMIN_KEY) {
    return sendJson(res, 501, { error: 'ADMIN_KEY is not configured on the server. Set it as an environment variable to enable this endpoint.' });
  }
  const providedKey = req.headers['x-admin-key'];
  if (!providedKey || providedKey !== ADMIN_KEY) {
    return sendJson(res, 401, { error: 'Unauthorized' });
  }
  const leads = listLeads();
  return sendJson(res, 200, { leads, count: leads.length });
}

// ---------------------------------------------------------------------------
// Server
// ---------------------------------------------------------------------------
const server = http.createServer(async (req, res) => {
  const urlPath = req.url.split('?')[0];

  // Security-ish baseline headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  try {
    if (req.method === 'POST' && urlPath === '/api/contact') {
      return await handleContact(req, res);
    }
    if (req.method === 'GET' && urlPath === '/api/leads') {
      return handleLeads(req, res);
    }
    if (req.method === 'GET' && urlPath === '/api/health') {
      return sendJson(res, 200, { ok: true, db: mode });
    }

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      return sendJson(res, 405, { error: 'Method not allowed' });
    }

    // Static file serving
    let requestPath = urlPath === '/' ? '/index.html' : urlPath;
    let filePath = safeJoin(PUBLIC_DIR, requestPath);
    if (!filePath) return serve404(res);

    fs.stat(filePath, (err, stats) => {
      if (!err && stats.isFile()) return serveFile(res, filePath);

      // Try adding .html for clean URLs like /about
      const htmlAttempt = filePath + '.html';
      fs.stat(htmlAttempt, (err2, stats2) => {
        if (!err2 && stats2.isFile()) return serveFile(res, htmlAttempt);
        return serve404(res);
      });
    });
  } catch (err) {
    console.error(err);
    sendJson(res, 500, { error: 'Internal server error' });
  }
});

server.listen(PORT, () => {
  console.log(`Neoserve Projects site running on http://localhost:${PORT}`);
  console.log(`Database mode: ${mode}${mode === 'json' ? ' (data/leads.json — upgrade to Node 22.5+ for SQLite)' : ' (data/neoserve.db)'}`);
  if (!ADMIN_KEY) {
    console.log('NOTE: ADMIN_KEY is not set — /admin.html will not be able to load leads until you set it.');
  }
});
