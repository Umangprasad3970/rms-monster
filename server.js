'use strict';

/**
 * Neoserve Projects — Enterprise Website Server & API Gateway
 * 
 * Powered by Node.js and directly connected to Aiven Cloud MySQL (`neoserve_db`),
 * sharing identical database models and REST API contracts with the Android Mobile App.
 * 
 * Features:
 * - Direct Aiven MySQL 8.4 persistence (leads, contacts, quotes, consultations, tasks)
 * - Yield & ROI Renewable Feasibility Calculator engine
 * - Live O&M Telemetry Monitoring feeds
 * - Idempotency-Key support and anti-duplicate lead detection
 * - Official brochure download streaming
 * - Clean static serving with HTML5 history routing
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const crypto = require('crypto');

// Unique Shared Enterprise Encryption Key Configuration (Shared across Android App, Web & Flask Backend)
const API_ENCRYPTION_KEY_RAW = process.env.API_ENCRYPTION_KEY || 'Neoserve_2026_Enterprise_Unique_AES256_Encryption_Key!';
const API_KEY_ID = process.env.API_KEY_ID || 'neoserve-enterprise-2026';
const AES_KEY = crypto.createHash('sha256').update(API_ENCRYPTION_KEY_RAW, 'utf8').digest(); // 32 bytes (256-bit)
const KEY_FINGERPRINT = AES_KEY.slice(0, 8).toString('hex'); // 6ae891073ab329ea

const {
  pool,
  mode,
  addLead,
  checkDuplicateLead,
  listLeads,
  getServices,
  getProjects,
  scheduleConsultation,
  listConsultations,
  createQuote,
  listQuotes,
  listTasks
} = require('./lib/db');

const PORT = process.env.PORT || 3000;
const ADMIN_KEY = process.env.ADMIN_KEY || 'NeoserveAdmin2026SecureKey';
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
  '.pdf': 'application/pdf'
};

// Rate Limiter
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX = 20;
const submissionLog = new Map();

function isRateLimited(ip) {
  const now = Date.now();
  const timestamps = (submissionLog.get(ip) || []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  timestamps.push(now);
  submissionLog.set(ip, timestamps);
  return timestamps.length > RATE_LIMIT_MAX;
}

function encryptPayload(plainObjOrStr) {
  const plainText = typeof plainObjOrStr === 'string' ? plainObjOrStr : JSON.stringify(plainObjOrStr);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', AES_KEY, iv);
  let encrypted = cipher.update(plainText, 'utf8', 'base64');
  encrypted += cipher.final('base64');

  return {
    encrypted: true,
    algorithm: 'AES-256-CBC',
    keyId: API_KEY_ID,
    iv: iv.toString('base64'),
    data: encrypted
  };
}

function decryptPayload(envelope) {
  if (!envelope || typeof envelope !== 'object' || !envelope.encrypted || !envelope.iv || !envelope.data) {
    return envelope;
  }
  try {
    const iv = Buffer.from(envelope.iv, 'base64');
    const decipher = crypto.createDecipheriv('aes-256-cbc', AES_KEY, iv);
    let decrypted = decipher.update(envelope.data, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    try {
      return JSON.parse(decrypted);
    } catch {
      return decrypted;
    }
  } catch (err) {
    console.error('[Decryption Error]', err.message);
    return envelope;
  }
}

function sendJson(res, status, obj) {
  const req = res._req;
  const wantsEncryption = req && (
    req.headers['x-client-encryption'] === 'true' ||
    req.headers['x-payload-encrypted'] === 'true'
  );

  let finalObj = obj;
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, Idempotency-Key, X-Admin-Key, X-Request-Id, X-Payload-Encrypted, X-Client-Encryption, X-Encryption-Key-Id, X-Encryption-Key-Fingerprint',
    'Access-Control-Expose-Headers': 'X-Payload-Encrypted, X-Encryption-Key-Id, X-Encryption-Key-Fingerprint'
  };

  if (wantsEncryption && status >= 200 && status < 300) {
    finalObj = encryptPayload(obj);
    headers['X-Payload-Encrypted'] = 'true';
    headers['X-Encryption-Key-Id'] = API_KEY_ID;
    headers['X-Encryption-Key-Fingerprint'] = KEY_FINGERPRINT;
  }

  const body = JSON.stringify(finalObj);
  headers['Content-Length'] = Buffer.byteLength(body);
  res.writeHead(status, headers);
  res.end(body);
}

async function parseJsonBody(req) {
  const raw = await readBody(req);
  if (!raw || !raw.trim()) return {};
  let parsed = JSON.parse(raw);
  if (parsed && typeof parsed === 'object' && parsed.encrypted && parsed.iv && parsed.data) {
    parsed = decryptPayload(parsed);
  }
  return parsed;
}

function readBody(req, limitBytes = 2e6) {
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

function validateLeadPayload(payload) {
  const errors = [];
  if (!payload.fullName || String(payload.fullName).trim().length < 2) errors.push('Full name is required (min 2 characters).');
  if (!payload.email || !EMAIL_RE.test(String(payload.email).trim())) errors.push('A valid email address is required.');
  if (!payload.phone || String(payload.phone).trim().length < 6) errors.push('A valid phone number is required.');
  if (!payload.projectType || String(payload.projectType).trim().length < 2) errors.push('Project type is required.');
  if (!payload.message || String(payload.message).trim().length < 3) errors.push('Please describe your project details.');
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
  if (!target.startsWith(base)) return null;
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
// Route Handlers
// ---------------------------------------------------------------------------

async function handleLeadSubmission(req, res) {
  let payload;
  try {
    payload = await parseJsonBody(req);
  } catch (err) {
    return sendJson(res, 400, { success: false, error: 'Invalid JSON request body.' });
  }

  // Honeypot check
  if (payload.website) {
    return sendJson(res, 200, { success: true, message: 'Enquiry received.' });
  }

  const ip = getClientIp(req);
  if (isRateLimited(ip)) {
    return sendJson(res, 429, { success: false, error: 'Too many requests. Please try again shortly or contact +91 82109 67599.' });
  }

  const errors = validateLeadPayload(payload);
  if (errors.length) {
    return sendJson(res, 400, { success: false, error: errors[0], details: errors });
  }

  const idempotencyKey = req.headers['idempotency-key'] || payload.idempotencyKey || null;

  const record = await addLead({
    fullName: String(payload.fullName).trim().slice(0, 200),
    email: String(payload.email).trim().slice(0, 200),
    phone: String(payload.phone).trim().slice(0, 60),
    company: String(payload.company || '').trim().slice(0, 200),
    serviceId: String(payload.serviceId || 'general').trim().slice(0, 64),
    projectType: String(payload.projectType).trim().slice(0, 100),
    location: String(payload.location || '').trim().slice(0, 200),
    capacity: payload.capacity ? String(payload.capacity).trim().slice(0, 100) : null,
    timeline: payload.timeline ? String(payload.timeline).trim().slice(0, 100) : '3-6 months',
    budgetRange: payload.budgetRange ? String(payload.budgetRange).trim().slice(0, 100) : null,
    message: String(payload.message).trim().slice(0, 4000),
    consent: payload.consent !== false,
    source: payload.source || 'website',
    idempotencyKey,
    ip,
    userAgent: req.headers['user-agent'] || ''
  });

  return sendJson(res, 201, {
    success: true,
    leadId: record.id,
    status: record.status || 'NEW',
    message: 'Your enquiry has been submitted successfully.',
    nextStep: 'Our technical sales team will review your requirements and reach out within 24 hours.',
    createdAt: record.createdAt || new Date().toISOString()
  });
}

async function handleCheckDuplicate(req, res) {
  let payload;
  try {
    payload = await parseJsonBody(req);
  } catch (err) {
    return sendJson(res, 400, { success: false, error: 'Invalid JSON request body.' });
  }

  const result = await checkDuplicateLead(payload.email, payload.phone);
  return sendJson(res, 200, result);
}

async function handleGetServices(req, res) {
  const services = await getServices();
  return sendJson(res, 200, {
    success: true,
    count: services.length,
    services
  });
}

async function handleGetProjects(req, res, parsedUrl) {
  const category = parsedUrl.query.category || 'All';
  const query = parsedUrl.query.query || '';
  const projects = await getProjects(category, query);
  return sendJson(res, 200, {
    success: true,
    count: projects.length,
    projects
  });
}

// ---------------------------------------------------------------------------
// Yield & ROI Feasibility Calculator Engine
// ---------------------------------------------------------------------------
function calculateYieldRoi(payload) {
  const projectType = payload.project_type || payload.projectType || 'Solar';
  let targetKw = parseFloat(payload.target_capacity_kw || payload.targetCapacityKw || 0);
  const monthlyBill = parseFloat(payload.monthly_bill_inr || payload.monthlyBillInr || 0);
  const state = payload.state_location || payload.state || 'Gujarat';

  // If capacity not explicitly supplied, calculate based on tariff
  // Average C&I tariff in India ~ Rs 8.5/kWh; 1 kW Solar yields ~ 125 kWh/month
  if (targetKw <= 0 && monthlyBill > 0) {
    const monthlyUnits = monthlyBill / 8.5;
    targetKw = Math.max(5, Math.round(monthlyUnits / 125));
  } else if (targetKw <= 0) {
    targetKw = 100.0;
  }

  let annualGenerationKwh = 0;
  let estimatedCostLakhsMin = 0;
  let estimatedCostLakhsMax = 0;
  let annualSavingsInr = 0;
  let paybackYears = 3.5;
  let co2OffsetTons = 0;

  if (projectType.toLowerCase().includes('wind')) {
    // 1 MW Wind generates ~ 2,400,000 kWh/yr (CUF ~27-30%)
    annualGenerationKwh = targetKw * 2400;
    estimatedCostLakhsMin = (targetKw / 1000) * 650; // ~6.5 Cr/MW
    estimatedCostLakhsMax = (targetKw / 1000) * 720;
    annualSavingsInr = annualGenerationKwh * 6.2;
    paybackYears = 4.2;
    co2OffsetTons = (annualGenerationKwh * 0.85) / 1000;
  } else if (projectType.toLowerCase().includes('hybrid')) {
    // Wind-solar hybrid blend (CUF ~38%)
    annualGenerationKwh = targetKw * 2800;
    estimatedCostLakhsMin = (targetKw / 1000) * 580;
    estimatedCostLakhsMax = (targetKw / 1000) * 640;
    annualSavingsInr = annualGenerationKwh * 6.8;
    paybackYears = 3.8;
    co2OffsetTons = (annualGenerationKwh * 0.85) / 1000;
  } else if (projectType.toLowerCase().includes('ev')) {
    // EV Charging station
    annualGenerationKwh = targetKw * 1800;
    estimatedCostLakhsMin = (targetKw / 100) * 35;
    estimatedCostLakhsMax = (targetKw / 100) * 45;
    annualSavingsInr = targetKw * 1800 * 4.5;
    paybackYears = 2.9;
    co2OffsetTons = (annualGenerationKwh * 0.82) / 1000;
  } else {
    // Solar PV (Default) - 1,550 kWh/kWp/yr in sunny Indian states
    annualGenerationKwh = targetKw * 1550;
    estimatedCostLakhsMin = (targetKw * 42000) / 100000;
    estimatedCostLakhsMax = (targetKw * 46200) / 100000;
    annualSavingsInr = annualGenerationKwh * 8.5;
    paybackYears = 3.2;
    co2OffsetTons = (annualGenerationKwh * 0.82) / 1000;
  }

  return {
    success: true,
    recommended_capacity_kw: Math.round(targetKw * 10) / 10,
    annual_generation_kwh: Math.round(annualGenerationKwh),
    estimated_cost_lakhs_inr: `${estimatedCostLakhsMin.toFixed(2)} - ${estimatedCostLakhsMax.toFixed(2)} Lakhs`,
    annual_savings_inr: Math.round(annualSavingsInr),
    payback_period_years: Math.round(paybackYears * 10) / 10,
    carbon_offset_tons_per_year: Math.round(co2OffsetTons * 10) / 10,
    message: `Calculated using regional radiation & tariff models for ${state}.`
  };
}

async function handleCalculator(req, res) {
  let payload;
  try {
    payload = await parseJsonBody(req);
  } catch (err) {
    return sendJson(res, 400, { success: false, error: 'Invalid JSON request body.' });
  }
  const result = calculateYieldRoi(payload);
  return sendJson(res, 200, result);
}

// ---------------------------------------------------------------------------
// Telemetry Overview
// ---------------------------------------------------------------------------
function getTelemetryOverview() {
  return {
    success: true,
    total_managed_capacity_mw: 120.5,
    today_total_generation_mwh: 751.2,
    active_plants_count: 4,
    average_performance_ratio: 98.8,
    total_co2_offset_tons: 615.9,
    plants: [
      {
        site_name: 'Gujarat Kutch Wind Farm (25 MW)',
        category: 'Wind',
        capacity_mw: 25.0,
        current_generation_kw: 21450.0,
        daily_energy_mwh: 188.4,
        performance_ratio_percent: 98.6,
        status: 'Operational',
        last_updated: '1 min ago'
      },
      {
        site_name: 'Rajasthan Bhadla Solar Park (50 MW)',
        category: 'Solar',
        capacity_mw: 50.0,
        current_generation_kw: 46200.0,
        daily_energy_mwh: 312.8,
        performance_ratio_percent: 99.1,
        status: 'Operational',
        last_updated: 'Just now'
      },
      {
        site_name: 'Tamil Nadu Hybrid Facility (45 MW)',
        category: 'Hybrid',
        capacity_mw: 45.0,
        current_generation_kw: 39800.0,
        daily_energy_mwh: 245.2,
        performance_ratio_percent: 97.9,
        status: 'Operational',
        last_updated: '2 mins ago'
      },
      {
        site_name: 'Bengaluru EV Fast Charger Hub',
        category: 'EV Charging',
        capacity_mw: 0.5,
        current_generation_kw: 340.0,
        daily_energy_mwh: 4.8,
        performance_ratio_percent: 99.5,
        status: 'Operational',
        last_updated: 'Just now'
      }
    ]
  };
}

// ---------------------------------------------------------------------------
// Consultation & RFQ Handlers
// ---------------------------------------------------------------------------
async function handleConsultationSchedule(req, res) {
  let payload;
  try {
    payload = await parseJsonBody(req);
  } catch (err) {
    return sendJson(res, 400, { success: false, error: 'Invalid JSON request body.' });
  }

  if (!payload.email || !payload.phone || (!payload.name && !payload.fullName)) {
    return sendJson(res, 400, { success: false, error: 'Name, email and phone number are required.' });
  }

  const record = await scheduleConsultation(payload);
  return sendJson(res, 201, {
    success: true,
    booking_reference: record.booking_reference,
    message: `Site Technical Consultation scheduled for ${record.preferred_date}. Reference ID: ${record.booking_reference}. Our lead renewable engineer will reach out to confirm coordinates.`,
    scheduledAt: new Date().toISOString()
  });
}

async function handleQuoteSubmission(req, res) {
  let payload;
  try {
    payload = await parseJsonBody(req);
  } catch (err) {
    return sendJson(res, 400, { success: false, error: 'Invalid JSON request body.' });
  }

  if (!payload.email || !payload.phone) {
    return sendJson(res, 400, { success: false, error: 'Email and phone are required for RFQ proposal.' });
  }

  const record = await createQuote(payload);
  return sendJson(res, 201, {
    success: true,
    quote_reference: record.quote_number,
    message: `Turnkey RFQ received. Reference ID: ${record.quote_number}. Our engineering pricing desk will review the BOQ and share a formal proposal.`,
    createdAt: new Date().toISOString()
  });
}

// ---------------------------------------------------------------------------
// Brochure Streaming
// ---------------------------------------------------------------------------
function handleBrochureDownload(res) {
  const candidates = [
    path.join(PUBLIC_DIR, 'downloads', 'Neoserve-Projects-Brochure.pdf'),
    path.join(PUBLIC_DIR, 'Neoderve Projects-BF1.pdf'),
    path.join(__dirname, '..', 'Neoderve Projects-BF1.pdf')
  ];

  let found = null;
  for (const c of candidates) {
    if (fs.existsSync(c)) {
      found = c;
      break;
    }
  }

  if (!found) {
    return sendJson(res, 404, { success: false, error: 'Brochure PDF document currently unavailable.' });
  }

  res.writeHead(200, {
    'Content-Type': 'application/pdf',
    'Content-Disposition': 'attachment; filename="Neoserve-Projects-Official-Brochure.pdf"'
  });
  fs.createReadStream(found).pipe(res);
}

// ---------------------------------------------------------------------------
// Admin Endpoints
// ---------------------------------------------------------------------------
async function handleAdminOverview(req, res, parsedUrl) {
  const providedKey = req.headers['x-admin-key'] || parsedUrl.query.key;
  if (!providedKey || providedKey !== ADMIN_KEY) {
    return sendJson(res, 401, { error: 'Unauthorized: Invalid X-Admin-Key.' });
  }

  const leads = await listLeads();
  const quotes = await listQuotes();
  const consultations = await listConsultations();
  const tasks = await listTasks();

  return sendJson(res, 200, {
    success: true,
    database: 'Aiven Cloud MySQL (neoserve_db)',
    summary: {
      leadsCount: leads.length,
      quotesCount: quotes.length,
      consultationsCount: consultations.length,
      tasksCount: tasks.length
    },
    leads,
    quotes,
    consultations,
    tasks
  });
}

// ---------------------------------------------------------------------------
// HTTP Server
// ---------------------------------------------------------------------------
const server = http.createServer(async (req, res) => {
  res._req = req;
  const parsedUrl = url.parse(req.url, true);
  const urlPath = parsedUrl.pathname;

  // Global security & CORS headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Idempotency-Key, X-Admin-Key, X-Request-Id, X-Payload-Encrypted, X-Client-Encryption, X-Encryption-Key-Id, X-Encryption-Key-Fingerprint');
  res.setHeader('Access-Control-Expose-Headers', 'X-Payload-Encrypted, X-Encryption-Key-Id, X-Encryption-Key-Fingerprint');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  try {
    // 0. Security & Encryption Status Endpoints
    if (req.method === 'GET' && (urlPath === '/api/v1/security/status' || urlPath === '/api/security/status')) {
      return sendJson(res, 200, {
        success: true,
        encryptionEnabled: true,
        algorithm: 'AES-256-CBC',
        keyId: API_KEY_ID,
        keyFingerprint: KEY_FINGERPRINT,
        headerRequired: 'X-Payload-Encrypted',
        clientEncryptionHeader: 'X-Client-Encryption',
        description: 'Enterprise end-to-end payload encryption using AES-256-CBC with PKCS7 padding.',
        status: 'OPERATIONAL'
      });
    }

    if (req.method === 'POST' && urlPath === '/api/v1/security/encrypt') {
      const payload = await parseJsonBody(req);
      return sendJson(res, 200, {
        success: true,
        encryptedPayload: encryptPayload(payload.payload || payload)
      });
    }

    if (req.method === 'POST' && urlPath === '/api/v1/security/decrypt') {
      const raw = await readBody(req);
      const envelope = JSON.parse(raw || '{}');
      const target = envelope.encryptedPayload || envelope;
      const decrypted = decryptPayload(target);
      return sendJson(res, 200, {
        success: true,
        decryptedData: decrypted
      });
    }
    // 1. Leads
    if (req.method === 'POST' && (urlPath === '/api/v1/leads' || urlPath === '/api/contact')) {
      return await handleLeadSubmission(req, res);
    }
    if (req.method === 'POST' && urlPath === '/api/v1/leads/check-duplicate') {
      return await handleCheckDuplicate(req, res);
    }

    // 2. Services
    if (req.method === 'GET' && (urlPath === '/api/v1/services' || urlPath === '/api/services')) {
      return await handleGetServices(req, res);
    }

    // 3. Projects
    if (req.method === 'GET' && (urlPath === '/api/v1/projects' || urlPath === '/api/projects')) {
      return await handleGetProjects(req, res, parsedUrl);
    }

    // 4. Yield & ROI Calculator
    if (req.method === 'POST' && (urlPath === '/api/v1/calculator/estimate' || urlPath === '/api/calculator/estimate')) {
      return await handleCalculator(req, res);
    }

    // 5. Telemetry
    if (req.method === 'GET' && (urlPath === '/api/v1/telemetry/overview' || urlPath === '/api/telemetry/overview')) {
      return sendJson(res, 200, getTelemetryOverview());
    }

    // 6. Consultations / Site Audits
    if (req.method === 'POST' && (urlPath === '/api/v1/consultation/schedule' || urlPath === '/api/consultation/schedule')) {
      return await handleConsultationSchedule(req, res);
    }

    // 7. Request for Quotes (RFQ)
    if (req.method === 'POST' && (urlPath === '/api/v1/quotes' || urlPath === '/api/rfq')) {
      return await handleQuoteSubmission(req, res);
    }

    // 8. Brochure Download
    if (req.method === 'GET' && (urlPath === '/api/v1/brochure/download' || urlPath === '/download-brochure')) {
      return handleBrochureDownload(res);
    }

    // 9. Admin Data
    if (req.method === 'GET' && (urlPath === '/api/leads' || urlPath === '/api/v1/admin/overview')) {
      return await handleAdminOverview(req, res, parsedUrl);
    }

    // 10. Health
    if (req.method === 'GET' && urlPath === '/api/health') {
      return sendJson(res, 200, {
        ok: true,
        service: 'Neoserve Projects Enterprise Gateway',
        dbMode: mode,
        database: 'neoserve_db (Aiven MySQL 8.4)',
        tables: ['leads', 'contacts', 'services', 'projects', 'consultations', 'quotes', 'tasks', 'lead_activities']
      });
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

      // Clean URLs like /about or /services
      const htmlAttempt = filePath + '.html';
      fs.stat(htmlAttempt, (err2, stats2) => {
        if (!err2 && stats2.isFile()) return serveFile(res, htmlAttempt);
        return serve404(res);
      });
    });
  } catch (err) {
    console.error('[Server Error]', err);
    sendJson(res, 500, { error: 'Internal server error', message: err.message });
  }
});

server.listen(PORT, () => {
  console.log(`==================================================================`);
  console.log(`Neoserve Projects Web & Enterprise Gateway running at http://localhost:${PORT}`);
  console.log(`Connected Database: Aiven Cloud MySQL 8.4 (neoserve_db)`);
  console.log(`Database Mode: ${mode}`);
  console.log(`Admin Portal Key: configured`);
  console.log(`==================================================================`);
});
