'use strict';

/**
 * Neoserve Projects — Database Integration Layer
 * 
 * Direct connection to Aiven Cloud MySQL database (`neoserve_db`).
 * Matches the exact schema of the Flask REST API & Android Mobile Application.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const mysql = require('mysql2/promise');

// Load environment variables from .env
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx > 0) {
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim();
      if (!process.env[key]) process.env[key] = val;
    }
  });
}

// Aiven MySQL Configuration
const DB_HOST = process.env.MYSQL_HOST || 'rms-db-umangprasad3970-a391.g.aivencloud.com';
const DB_PORT = parseInt(process.env.MYSQL_PORT || '10469', 10);
const DB_USER = process.env.MYSQL_USER || 'avnadmin';
const DB_PASSWORD = process.env.MYSQL_PASSWORD || '';
const DB_NAME = process.env.MYSQL_DATABASE || 'neoserve_db';

let pool = null;
let mode = 'mysql';

try {
  pool = mysql.createPool({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_NAME,
    ssl: { rejectUnauthorized: false },
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000
  });
  console.log(`[Database] Connected to Aiven MySQL (${DB_HOST}:${DB_PORT}/${DB_NAME})`);
} catch (err) {
  console.error('[Database] Failed to initialize MySQL pool, using fallback:', err.message);
  mode = 'fallback';
}

const DATA_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
const JSON_FILE = path.join(DATA_DIR, 'leads.json');

function readJsonFile() {
  if (!fs.existsSync(JSON_FILE)) return [];
  try {
    const raw = fs.readFileSync(JSON_FILE, 'utf8');
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function writeJsonFile(leads) {
  fs.writeFileSync(JSON_FILE, JSON.stringify(leads, null, 2), 'utf8');
}

// ---------------------------------------------------------------------------
// Lead Operations
// ---------------------------------------------------------------------------

async function checkDuplicateLead(email, phone) {
  if (!pool) return { duplicateFound: false };
  try {
    const [rows] = await pool.query(
      `SELECT id, status, created_at FROM leads 
       WHERE (email = ? OR (phone = ? AND phone != '')) 
         AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) 
       LIMIT 1`,
      [email, phone || '']
    );
    if (rows && rows.length > 0) {
      return {
        duplicateFound: true,
        leadId: rows[0].id,
        existingStatus: rows[0].status,
        submittedAt: rows[0].created_at,
        message: 'An active enquiry already exists with this contact information.'
      };
    }
    return { duplicateFound: false };
  } catch (err) {
    console.error('[Database] checkDuplicateLead error:', err.message);
    return { duplicateFound: false };
  }
}

async function addLead(lead) {
  const leadId = 'ld_' + crypto.randomBytes(5).toString('hex');
  const idempotencyKey = lead.idempotencyKey || null;

  // Check idempotency if key provided
  if (pool && idempotencyKey) {
    try {
      const [existing] = await pool.query(
        'SELECT id, created_at, status FROM leads WHERE idempotency_key = ? LIMIT 1',
        [idempotencyKey]
      );
      if (existing && existing.length > 0) {
        return {
          id: existing[0].id,
          createdAt: existing[0].created_at,
          status: existing[0].status,
          isReplay: true
        };
      }
    } catch (e) {
      console.warn('[Database] Idempotency lookup error:', e.message);
    }
  }

  const record = {
    id: leadId,
    fullName: lead.fullName,
    email: lead.email,
    phone: lead.phone,
    company: lead.company || '',
    serviceId: lead.serviceId || 'general',
    projectType: lead.projectType || 'General Renewable Energy Inquiry',
    location: lead.location || '',
    capacity: lead.capacity || null,
    timeline: lead.timeline || 'Immediate',
    budgetRange: lead.budgetRange || null,
    message: lead.message || '',
    status: 'NEW',
    score: 50,
    source: lead.source || 'website',
    campaign: lead.campaign || 'direct',
    idempotencyKey: idempotencyKey,
    createdAt: new Date().toISOString()
  };

  if (pool) {
    try {
      // 1. Insert into leads table
      await pool.query(
        `INSERT INTO leads (
          id, full_name, email, phone, company, service_id, project_type, location,
          capacity, timeline, budget_range, message, status, score, source, campaign,
          idempotency_key, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [
          record.id,
          record.fullName,
          record.email,
          record.phone,
          record.company,
          record.serviceId,
          record.projectType,
          record.location,
          record.capacity,
          record.timeline,
          record.budgetRange,
          record.message,
          record.status,
          record.score,
          record.source,
          record.campaign,
          record.idempotencyKey
        ]
      );

      // 2. Also register in contacts table
      try {
        await pool.query(
          `INSERT INTO contacts (id, name, email, phone, company, project_type, message, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
          ['ct_' + crypto.randomBytes(5).toString('hex'), record.fullName, record.email, record.phone, record.company, record.projectType, record.message]
        );
      } catch (cErr) {
        // Ignored
      }

      // 3. Auto-generate 24-hr SLA follow-up task
      const taskId = 'tsk_' + crypto.randomBytes(5).toString('hex');
      const dueSql = new Date(Date.now() + 24 * 3600 * 1000).toISOString().slice(0, 19).replace('T', ' ');
      await pool.query(
        `INSERT INTO tasks (id, entity_type, entity_id, title, due_at, priority, status, created_at)
         VALUES (?, 'LEAD', ?, ?, ?, 'HIGH', 'PENDING', NOW())`,
        [taskId, record.id, `24h SLA Review: ${record.fullName} (${record.projectType})`, dueSql]
      );

      // 4. Log initial activity
      const actId = 'act_' + crypto.randomBytes(5).toString('hex');
      await pool.query(
        `INSERT INTO lead_activities (id, lead_id, activity_type, subject, notes, outcome, created_by, created_at)
         VALUES (?, ?, 'LEAD_CREATED', 'Web Enquiry Submitted', 'Captured via website portal. SLA task auto-generated.', 'SUCCESS', 'SYSTEM', NOW())`,
        [actId, record.id]
      );

      console.log(`[Database] Stored Lead ${record.id} and Task ${taskId} in Aiven MySQL.`);
      return record;
    } catch (err) {
      console.error('[Database] MySQL addLead error, falling back to JSON:', err.message);
    }
  }

  // JSON Fallback
  const leads = readJsonFile();
  leads.push(record);
  writeJsonFile(leads);
  return record;
}

async function listLeads() {
  if (pool) {
    try {
      const [rows] = await pool.query(
        `SELECT 
          id, full_name AS fullName, email, phone, company, 
          project_type AS projectType, location, message, 
          status, score, created_at AS createdAt
         FROM leads 
         ORDER BY created_at DESC`
      );
      return rows;
    } catch (err) {
      console.error('[Database] listLeads error from MySQL:', err.message);
    }
  }
  return readJsonFile().sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

// ---------------------------------------------------------------------------
// Services Catalog
// ---------------------------------------------------------------------------

async function getServices() {
  if (pool) {
    try {
      const [rows] = await pool.query('SELECT * FROM services ORDER BY title ASC');
      if (rows && rows.length > 0) {
        return rows.map(r => ({
          id: r.id,
          title: r.title,
          category: r.category,
          capacityRange: r.capacity_range,
          description: r.description,
          deliverables: typeof r.deliverables === 'string' ? JSON.parse(r.deliverables) : r.deliverables,
          icon: r.icon
        }));
      }
    } catch (err) {
      console.error('[Database] getServices error:', err.message);
    }
  }

  // Built-in brochure services fallback
  return [
    {
      id: 'solar-power',
      title: 'Solar Power Plant Projects (Utility, C&I, Rooftop)',
      category: 'Solar',
      capacityRange: '100 kW to 250 MW+',
      description: 'Turnkey civil foundation, tracker/fixed MMS racking, DC/AC cabling, inverter duty transformers, and SCADA grid synchronization.',
      deliverables: ['Site radiation study', 'MMS installation', 'Inverter stations', 'Net metering / Grid CEIG approvals'],
      icon: 'ic_solar'
    },
    {
      id: 'wind-energy',
      title: 'Wind Power Project (Erection & Commissioning)',
      category: 'Wind',
      capacityRange: '2.1 MW to 4.2 MW Class Turbines',
      description: 'Heavy-lift crane mobilization, multi-section tower hoisting, nacelle & rotor assembly, high-tension torqueing, and 33kV bay integration.',
      deliverables: ['Foundation civil works', 'Tower erection', 'Rotor hoisting', 'Commissioning support'],
      icon: 'ic_wind'
    },
    {
      id: 'hybrid-energy',
      title: 'Hybrid Wind-Solar, BESS & Green Hydrogen Plants',
      category: 'Hybrid',
      capacityRange: '10 MW to 100 MW+',
      description: 'Optimal land footprint utilization blending wind and solar profiles with common pooling substations and battery/green hydrogen auxiliary systems.',
      deliverables: ['Complementary generation study', 'Common pooling substation', 'Battery Storage (BESS) integration', 'Green hydrogen electrolyzer aux integration'],
      icon: 'ic_hybrid'
    },
    {
      id: 'peb-structures',
      title: 'Pre-Engineered Building (PEB) Constructions',
      category: 'PEB',
      capacityRange: '10,000 to 500,000+ Sq Ft',
      description: 'High-tensile structural steel fabrication, rapid on-site erection, standing seam roofing engineered for rooftop solar load compliance.',
      deliverables: ['Structural engineering design', 'Fabrication & delivery', 'Erection & cladding', 'Solar-ready roof certification'],
      icon: 'ic_peb'
    },
    {
      id: 'ev-charging',
      title: 'EV Charging Stations Installation & Commissioning',
      category: 'EV Charging',
      capacityRange: '60 kW to 360 kW DC Fast Chargers',
      description: 'Complete highway & fleet depot EV charging infrastructure with HT transformers, CCS2 guns, and OCPP 1.6/2.0 CMS integration.',
      deliverables: ['Discom transformer step-down', 'Dual-gun DC fast chargers', 'Payment kiosk & app CMS integration'],
      icon: 'ic_ev'
    }
  ];
}

// ---------------------------------------------------------------------------
// Projects Portfolio
// ---------------------------------------------------------------------------

async function getProjects(category, query) {
  if (pool) {
    try {
      let sql = 'SELECT * FROM projects WHERE 1=1';
      const params = [];

      if (category && category !== 'All') {
        sql += ' AND (category LIKE ? OR title LIKE ?)';
        params.push(`%${category}%`, `%${category}%`);
      }
      if (query) {
        sql += ' AND (title LIKE ? OR location LIKE ? OR client_name LIKE ? OR description LIKE ?)';
        params.push(`%${query}%`, `%${query}%`, `%${query}%`, `%${query}%`);
      }
      sql += ' ORDER BY completion_year DESC, id ASC';

      const [rows] = await pool.query(sql, params);
      if (rows && rows.length > 0) {
        return rows.map(r => ({
          id: r.id,
          title: r.title,
          category: r.category,
          capacity: r.capacity,
          location: r.location,
          client_name: r.client_name,
          scope_of_work: r.scope_of_work,
          completion_year: r.completion_year,
          status: r.status,
          description: r.description,
          image_url: r.image_url
        }));
      }
    } catch (err) {
      console.error('[Database] getProjects error:', err.message);
    }
  }

  // Built-in brochure 6 projects fallback
  return [
    {
      id: 'p1',
      title: 'Kutch Mega Wind Energy Park (Phase I & II)',
      category: 'Wind',
      capacity: '25 MW',
      location: 'Kutch, Gujarat',
      client_name: 'Senvion Wind Technology & Clean Energy Partners',
      scope_of_work: 'Erection & Commissioning of 2.3M120 Wind Turbine Generators',
      completion_year: '2023',
      status: 'Operational',
      description: 'Full heavy-lift erection and 33kV pooling substation synchronization for multi-megawatt WTGs in harsh coastal wind regimes.',
      image_url: '/images/hero-wind-solar-storage.jpg'
    },
    {
      id: 'p2',
      title: 'Bhadla Solar Power Mega Farm',
      category: 'Solar',
      capacity: '50 MWp',
      location: 'Bhadla, Rajasthan',
      client_name: 'Tata Power Renewable Energy',
      scope_of_work: 'MMS Racking, Inverter Stations, DC/AC Cabling, SCADA Sync',
      completion_year: '2024',
      status: 'Operational',
      description: 'Turnkey mechanical mounting, high-efficiency bifacial module installation, and complete 33kV pooling line evacuation.',
      image_url: '/images/solar-farm-aerial.jpg'
    },
    {
      id: 'p3',
      title: 'Charanka Co-located Wind-Solar Hybrid Facility',
      category: 'Hybrid',
      capacity: '45 MW',
      location: 'Tirunelveli, Tamil Nadu',
      client_name: 'ReNew Power Infrastructure',
      scope_of_work: 'Co-located Solar-Wind Inverter Station & Pooling Substation',
      completion_year: '2024',
      status: 'Operational',
      description: 'Pioneering hybrid park integrating high-yield wind generation with solar PV arrays sharing a single high-voltage transmission bay.',
      image_url: '/images/hero-wind-solar-storage.jpg'
    },
    {
      id: 'p4',
      title: 'Sanand Mega PEB Industrial Logistics Complex',
      category: 'PEB',
      capacity: '120,000 Sq Ft',
      location: 'Sanand Auto Hub, Gujarat',
      client_name: 'Industrial Logistics & Warehousing Corp',
      scope_of_work: 'Design, Fabrication, Erection, Roofing & Solar-Ready Integration',
      completion_year: '2023',
      status: 'Operational',
      description: 'Pre-engineered steel portal frames with clear span trusses and standing seam roof pre-engineered for rooftop solar load bearing.',
      image_url: '/images/peb-construction.jpg'
    },
    {
      id: 'p5',
      title: 'Delhi-Mumbai Expressway Multi-Gun EV Charging Hubs',
      category: 'EV Charging',
      capacity: '12 x 180 kW DC Guns',
      location: 'Bengaluru-Mysuru & Delhi-Mumbai Expressway Corridors',
      client_name: 'National Clean Mobility Network',
      scope_of_work: 'HT Step-down Transformers, DC Ultra-Fast CCS2 Chargers, CMS Cloud',
      completion_year: '2024',
      status: 'Operational',
      description: 'Turnkey green mobility corridor with high-speed DC charging bays, dedicated HT substation, canopy roofing, and automated billing.',
      image_url: '/images/solar-panels-field.jpg'
    },
    {
      id: 'p6',
      title: 'Dahej Green Hydrogen Auxiliary Solar & BESS Plant',
      category: 'Hybrid',
      capacity: '10 MW Solar + 5 MWh BESS',
      location: 'Dahej Petroleum & Chemical PCPIR, Gujarat',
      client_name: 'Decarbonized Industrial Chemicals Ltd',
      scope_of_work: 'Dedicated Captive Solar, BESS Step-up, Auxiliary Power Delivery',
      completion_year: '2024',
      status: 'Operational',
      description: 'Clean energy captive generation plant powering industrial electrolyzer stacks toward India\'s Green Hydrogen Decarbonization Mission.',
      image_url: '/images/solar-farm-aerial.jpg'
    }
  ];
}

// ---------------------------------------------------------------------------
// Consultations / Technical Site Audits
// ---------------------------------------------------------------------------

async function scheduleConsultation(data) {
  const consultationId = 'cns_' + crypto.randomBytes(5).toString('hex');
  const bookingRef = 'AUD-' + crypto.randomBytes(3).toString('hex').toUpperCase();

  const record = {
    id: consultationId,
    booking_reference: bookingRef,
    full_name: data.name || data.fullName,
    organization: data.organization || data.company || '',
    email: data.email,
    phone: data.phone,
    preferred_date: data.preferred_date || data.preferredDate || new Date().toISOString().slice(0, 10),
    audit_topic: data.topic || data.audit_topic || 'Renewable Energy Site Feasibility Assessment',
    site_location: data.location || data.site_location || '',
    status: 'CONFIRMED'
  };

  if (pool) {
    try {
      await pool.query(
        `INSERT INTO consultations (
          id, booking_reference, full_name, email, phone, organization, preferred_date, audit_topic, site_location, status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          record.id,
          record.booking_reference,
          record.full_name,
          record.email,
          record.phone,
          record.organization,
          record.preferred_date,
          record.audit_topic,
          record.site_location,
          record.status
        ]
      );
      console.log(`[Database] Created Site Audit Consultation ${bookingRef} in Aiven MySQL.`);
    } catch (err) {
      console.error('[Database] Failed saving consultation into Aiven MySQL:', err.message);
    }
  }

  return record;
}

async function listConsultations() {
  if (pool) {
    try {
      const [rows] = await pool.query('SELECT * FROM consultations ORDER BY created_at DESC');
      return rows;
    } catch (err) {
      console.error('[Database] listConsultations error:', err.message);
    }
  }
  return [];
}

// ---------------------------------------------------------------------------
// Request for Quotations (RFQ)
// ---------------------------------------------------------------------------

async function createQuote(data) {
  const quoteId = 'qt_' + crypto.randomBytes(5).toString('hex');
  const quoteNumber = 'RFQ-' + crypto.randomBytes(3).toString('hex').toUpperCase();

  const record = {
    id: quoteId,
    quote_number: quoteNumber,
    customer_name: data.contact_person || data.contactPerson || data.name || data.fullName || '',
    email: data.email,
    phone: data.phone,
    company: data.company_name || data.company || '',
    project_type: data.service_type || data.project_type || data.serviceType || 'EPC Turnkey Project',
    capacity: data.capacity_mw || data.capacity || 'Custom MW',
    estimated_amount_inr: data.estimated_amount || 0,
    breakdown_json: JSON.stringify(data.breakdown || { scope: data.project_details || data.message || 'Turnkey EPC' }),
    validity_days: 30,
    status: 'SUBMITTED'
  };

  if (pool) {
    try {
      await pool.query(
        `INSERT INTO quotes (
          id, quote_number, customer_name, email, phone, company, project_type, capacity, estimated_amount_inr, breakdown_json, validity_days, status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          record.id,
          record.quote_number,
          record.customer_name,
          record.email,
          record.phone,
          record.company,
          record.project_type,
          record.capacity,
          record.estimated_amount_inr,
          record.breakdown_json,
          record.validity_days,
          record.status
        ]
      );
      console.log(`[Database] Created Quote ${quoteNumber} in Aiven MySQL.`);
    } catch (err) {
      console.error('[Database] Failed saving quote into Aiven MySQL:', err.message);
    }
  }

  return record;
}

async function listQuotes() {
  if (pool) {
    try {
      const [rows] = await pool.query('SELECT * FROM quotes ORDER BY created_at DESC');
      return rows;
    } catch (err) {
      console.error('[Database] listQuotes error:', err.message);
    }
  }
  return [];
}

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------

async function listTasks() {
  if (pool) {
    try {
      const [rows] = await pool.query(
        `SELECT t.*, l.full_name AS lead_name, l.project_type 
         FROM tasks t 
         LEFT JOIN leads l ON t.entity_id = l.id 
         ORDER BY t.created_at DESC`
      );
      return rows;
    } catch (err) {
      console.error('[Database] listTasks error:', err.message);
    }
  }
  return [];
}

module.exports = {
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
};
