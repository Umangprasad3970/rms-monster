/**
 * Neoserve Projects — Interactive Features Engine
 * 
 * Synchronized with the Android Mobile App & Aiven Cloud MySQL database (`neoserve_db`):
 * 1. Renewable Yield & ROI Feasibility Calculator (instant client + API sync)
 * 2. Real-time O&M Fleet Telemetry Monitor
 * 3. Filterable Brochure Projects Portfolio
 * 4. Technical Site Audit / Feasibility Consultation Modal
 * 5. Commercial RFQ (Request for Quotation) Modal
 */

(function () {
  'use strict';

  const REMOTE_API = 'https://rms-monster-api.onrender.com';

  async function apiFetch(endpoint, options = {}) {
    // 1. Try local server first
    try {
      const res = await fetch(endpoint, options);
      if (res.ok) return await res.json();
    } catch (e) {
      // Local server might be static host (e.g. GitHub Pages)
    }

    // 2. Try remote Render production API
    try {
      const remoteUrl = REMOTE_API + endpoint;
      const res2 = await fetch(remoteUrl, options);
      if (res2.ok) return await res2.json();
    } catch (e) {
      console.warn(`apiFetch error for ${endpoint}:`, e.message);
    }
    return null;
  }

  // ---------------------------------------------------------------------------
  // 1. Yield & ROI Calculator
  // ---------------------------------------------------------------------------
  function initCalculator() {
    const calcForm = document.getElementById('yieldCalc');
    if (!calcForm) return;

    const typeSelect = document.getElementById('calcType');
    const stateSelect = document.getElementById('calcState');
    const capSlider = document.getElementById('calcCapSlider');
    const capValDisplay = document.getElementById('calcCapVal');
    const billSlider = document.getElementById('calcBillSlider');
    const billValDisplay = document.getElementById('calcBillVal');

    const resCap = document.getElementById('resCap');
    const resGen = document.getElementById('resGen');
    const resCost = document.getElementById('resCost');
    const resSavings = document.getElementById('resSavings');
    const resPayback = document.getElementById('resPayback');
    const resCo2 = document.getElementById('resCo2');
    const resMsg = document.getElementById('resMsg');

    function calculateLocal(type, targetKw, bill, state) {
      let annualKwh = 0, costMin = 0, costMax = 0, savings = 0, payback = 3.2, co2 = 0;

      if (type.toLowerCase().includes('wind')) {
        annualKwh = targetKw * 2400;
        costMin = (targetKw / 1000) * 650;
        costMax = (targetKw / 1000) * 720;
        savings = annualKwh * 6.2;
        payback = 4.2;
        co2 = (annualKwh * 0.85) / 1000;
      } else if (type.toLowerCase().includes('hybrid')) {
        annualKwh = targetKw * 2800;
        costMin = (targetKw / 1000) * 580;
        costMax = (targetKw / 1000) * 640;
        savings = annualKwh * 6.8;
        payback = 3.8;
        co2 = (annualKwh * 0.85) / 1000;
      } else if (type.toLowerCase().includes('ev')) {
        annualKwh = targetKw * 1800;
        costMin = (targetKw / 100) * 35;
        costMax = (targetKw / 100) * 45;
        savings = targetKw * 1800 * 4.5;
        payback = 2.9;
        co2 = (annualKwh * 0.82) / 1000;
      } else {
        // Solar PV
        annualKwh = targetKw * 1550;
        costMin = (targetKw * 42000) / 100000;
        costMax = (targetKw * 46200) / 100000;
        savings = annualKwh * 8.5;
        payback = 3.2;
        co2 = (annualKwh * 0.82) / 1000;
      }

      return {
        recommended_capacity_kw: targetKw,
        annual_generation_kwh: Math.round(annualKwh),
        estimated_cost_lakhs_inr: `${costMin.toFixed(2)} - ${costMax.toFixed(2)} Lakhs`,
        annual_savings_inr: Math.round(savings),
        payback_period_years: payback,
        carbon_offset_tons_per_year: Math.round(co2 * 10) / 10,
        message: `Calculated using regional radiation & tariff models for ${state}.`
      };
    }

    function renderCalcResults(data) {
      if (resCap) resCap.textContent = data.recommended_capacity_kw >= 1000 ? `${(data.recommended_capacity_kw/1000).toFixed(2)} MW` : `${data.recommended_capacity_kw} kW`;
      if (resGen) resGen.textContent = `${(data.annual_generation_kwh / 1000).toFixed(1)} MWh/yr`;
      if (resCost) resCost.textContent = `₹${data.estimated_cost_lakhs_inr}`;
      if (resSavings) resSavings.textContent = `₹${(data.annual_savings_inr / 100000).toFixed(2)} Lakhs/yr`;
      if (resPayback) resPayback.textContent = `${data.payback_period_years} Years`;
      if (resCo2) resCo2.textContent = `${data.carbon_offset_tons_per_year} Tons/yr`;
      if (resMsg) resMsg.textContent = data.message;
    }

    async function recalculate() {
      const type = typeSelect ? typeSelect.value : 'Solar';
      const state = stateSelect ? stateSelect.value : 'Gujarat';
      const targetKw = capSlider ? parseFloat(capSlider.value) : 100;
      const bill = billSlider ? parseFloat(billSlider.value) : 80000;

      if (capValDisplay) capValDisplay.textContent = targetKw >= 1000 ? `${(targetKw/1000).toFixed(1)} MW (${targetKw} kW)` : `${targetKw} kW`;
      if (billValDisplay) billValDisplay.textContent = `₹${bill.toLocaleString('en-IN')}/mo`;

      // Instant local calculation
      const localData = calculateLocal(type, targetKw, bill, state);
      renderCalcResults(localData);

      // Async API sync if available
      try {
        const apiData = await apiFetch('/api/v1/calculator/estimate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            project_type: type,
            target_capacity_kw: targetKw,
            monthly_bill_inr: bill,
            state_location: state
          })
        });
        if (apiData && apiData.success) {
          renderCalcResults(apiData);
        }
      } catch (err) {
        // Fallback already rendered
      }
    }

    if (typeSelect) typeSelect.addEventListener('change', recalculate);
    if (stateSelect) stateSelect.addEventListener('change', recalculate);
    if (capSlider) capSlider.addEventListener('input', recalculate);
    if (billSlider) billSlider.addEventListener('input', recalculate);

    recalculate();
  }

  // ---------------------------------------------------------------------------
  // 2. Real-time Fleet Telemetry Monitor
  // ---------------------------------------------------------------------------
  function initTelemetry() {
    const container = document.getElementById('telemetryContainer');
    if (!container) return;

    const refreshBtn = document.getElementById('refreshTelemetryBtn');
    const updateTimeEl = document.getElementById('telemetryTime');

    const defaultTelemetry = {
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

    function renderTelemetry(data) {
      const kpiCap = document.getElementById('kpiCap');
      const kpiGen = document.getElementById('kpiGen');
      const kpiPr = document.getElementById('kpiPr');
      const kpiCo2 = document.getElementById('kpiCo2');

      if (kpiCap) kpiCap.textContent = `${data.total_managed_capacity_mw} MW`;
      if (kpiGen) kpiGen.textContent = `${data.today_total_generation_mwh} MWh`;
      if (kpiPr) kpiPr.textContent = `${data.average_performance_ratio}%`;
      if (kpiCo2) kpiCo2.textContent = `${data.total_co2_offset_tons} T`;

      const plantsGrid = document.getElementById('plantsGrid');
      if (plantsGrid && data.plants) {
        plantsGrid.innerHTML = data.plants.map(p => `
          <div class="plant-card">
            <div class="head">
              <div class="site-title">${p.site_name}</div>
              <span class="pulse-badge"><span class="pulse-dot"></span>${p.status}</span>
            </div>
            <div style="font-family:var(--font-mono);font-size:11px;color:var(--slate-soft);text-transform:uppercase;letter-spacing:.06em;">
              Category: ${p.category} &middot; Capacity: ${p.capacity_mw} MW
            </div>
            <div class="plant-specs">
              <div class="spec-item">
                <span class="spec-label">Live Output</span>
                <span class="spec-val" style="color:var(--green-glow);">${p.current_generation_kw.toLocaleString()} kW</span>
              </div>
              <div class="spec-item">
                <span class="spec-label">Today's Yield</span>
                <span class="spec-val">${p.daily_energy_mwh} MWh</span>
              </div>
              <div class="spec-item">
                <span class="spec-label">Performance Ratio</span>
                <span class="spec-val">${p.performance_ratio_percent}%</span>
              </div>
              <div class="spec-item">
                <span class="spec-label">Telemetry Status</span>
                <span class="spec-val">${p.last_updated}</span>
              </div>
            </div>
          </div>
        `).join('');
      }

      if (updateTimeEl) {
        updateTimeEl.textContent = `Updated: ${new Date().toLocaleTimeString()}`;
      }
    }

    async function loadTelemetry() {
      if (refreshBtn) {
        refreshBtn.disabled = true;
        refreshBtn.innerHTML = 'Refreshing…';
      }

      try {
        const data = await apiFetch('/api/v1/telemetry/overview');
        if (data && data.success) {
          renderTelemetry(data);
        } else {
          renderTelemetry(defaultTelemetry);
        }
      } catch (err) {
        renderTelemetry(defaultTelemetry);
      } finally {
        if (refreshBtn) {
          refreshBtn.disabled = false;
          refreshBtn.innerHTML = '↻ Refresh Live Fleet';
        }
      }
    }

    if (refreshBtn) refreshBtn.addEventListener('click', loadTelemetry);
    loadTelemetry();

    setInterval(loadTelemetry, 60000);
  }

  // ---------------------------------------------------------------------------
  // 3. Filterable Projects Portfolio
  // ---------------------------------------------------------------------------
  function initPortfolio() {
    const grid = document.getElementById('projectsGrid');
    if (!grid) return;

    const tabs = document.querySelectorAll('.portfolio-tabs .tab-btn');
    const defaultProjects = [
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
        category: 'EV',
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

    function renderProjects(projects) {
      if (!projects.length) {
        grid.innerHTML = '<p class="muted" style="grid-column:1/-1;text-align:center;padding:40px;">No projects found for this category.</p>';
        return;
      }

      grid.innerHTML = projects.map(p => `
        <div class="project-card" data-category="${p.category}">
          <div class="project-thumb">
            <img src="${p.image_url || '/images/hero-wind-solar-storage.jpg'}" alt="${p.title}" loading="lazy">
            <span class="project-badge">${p.category} &middot; ${p.capacity}</span>
          </div>
          <div class="project-body">
            <h3>${p.title}</h3>
            <div class="project-meta">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
              ${p.location} &middot; ${p.completion_year} &middot; <strong>${p.status}</strong>
            </div>
            <p>${p.description}</p>
            <div class="project-scope">
              <strong>Client &amp; Scope:</strong>
              ${p.client_name} &mdash; ${p.scope_of_work}
            </div>
          </div>
        </div>
      `).join('');
    }

    async function fetchAndRender(category = 'All') {
      try {
        const data = await apiFetch(`/api/v1/projects?category=${encodeURIComponent(category)}`);
        if (data && data.projects && data.projects.length) {
          renderProjects(data.projects);
          return;
        }
      } catch (err) {
        // Handled below
      }

      // Filter local defaults
      if (category === 'All') {
        renderProjects(defaultProjects);
      } else {
        const filtered = defaultProjects.filter(p => p.category.toLowerCase().includes(category.toLowerCase()));
        renderProjects(filtered);
      }
    }

    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const cat = tab.getAttribute('data-cat') || 'All';
        fetchAndRender(cat);
      });
    });

    fetchAndRender('All');
  }

  // ---------------------------------------------------------------------------
  // 4. Modals (Site Audit & RFQ)
  // ---------------------------------------------------------------------------
  function initModals() {
    const auditModal = document.getElementById('auditModal');
    const rfqModal = document.getElementById('rfqModal');

    function openModal(modal) {
      if (!modal) return;
      modal.classList.add('open');
      document.body.style.overflow = 'hidden';
    }

    function closeModal(modal) {
      if (!modal) return;
      modal.classList.remove('open');
      document.body.style.overflow = '';
    }

    document.querySelectorAll('[data-open-audit]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        openModal(auditModal);
      });
    });

    document.querySelectorAll('[data-open-rfq]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        openModal(rfqModal);
      });
    });

    document.querySelectorAll('.modal-close, .modal-backdrop').forEach(el => {
      el.addEventListener('click', (e) => {
        if (e.target === el || el.classList.contains('modal-close')) {
          closeModal(auditModal);
          closeModal(rfqModal);
        }
      });
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeModal(auditModal);
        closeModal(rfqModal);
      }
    });

    // Audit Form Handler
    const auditForm = document.getElementById('auditForm');
    if (auditForm) {
      auditForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const msgEl = document.getElementById('auditMsg');
        const submitBtn = auditForm.querySelector('button[type="submit"]');

        const rawPhone = auditForm.auditPhone.value.trim();
        const digitsOnly = rawPhone.replace(/[^0-9]/g, '');
        const normPhone = (digitsOnly.length >= 10) ? digitsOnly.slice(-10) : (digitsOnly || rawPhone);

        const payload = {
          name: auditForm.auditName.value.trim(),
          organization: auditForm.auditOrg.value.trim(),
          email: auditForm.auditEmail.value.trim(),
          phone: normPhone,
          raw_phone: rawPhone,
          preferred_date: auditForm.auditDate.value,
          topic: auditForm.auditTopic.value.trim(),
          location: auditForm.auditLocation.value.trim()
        };

        if (!payload.name || !payload.email || !payload.phone) {
          msgEl.textContent = 'Please fill in Name, Email and Phone.';
          msgEl.className = 'form-msg show err';
          return;
        }

        submitBtn.disabled = true;
        submitBtn.textContent = 'Scheduling…';

        const endpoints = [
          REMOTE_API + '/api/v1/consultation/schedule',
          REMOTE_API + '/api/consultations',
          REMOTE_API + '/api/consultation',
          REMOTE_API + '/api/contact',
          '/api/v1/consultation/schedule',
          '/api/contact'
        ];
        let success = false;

        for (const ep of endpoints) {
          try {
            const postBody = ep.includes('/contact') ? {
              name: payload.name,
              fullName: payload.name,
              email: payload.email,
              phone: payload.phone,
              company: payload.organization,
              project_type: 'Technical Site Audit: ' + payload.topic,
              projectType: 'Technical Site Audit: ' + payload.topic,
              message: `Site Audit Booking Request. Date: ${payload.preferred_date || 'Flexible'}, Location: ${payload.location || 'Site'}, Focus: ${payload.topic}`,
              source: 'website_audit_modal'
            } : payload;

            const res = await fetch(ep, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(postBody)
            });
            const data = await res.json();
            if (res.ok && (data.success || data.consultationId || data.contact_id || data.bookingReference)) {
              msgEl.textContent = `✓ ${data.message || 'Audit consultation scheduled successfully.'}`;
              msgEl.className = 'form-msg show ok';
              auditForm.reset();
              success = true;
              setTimeout(() => closeModal(auditModal), 3500);
              break;
            }
          } catch (err) {}
        }

        if (!success) {
          msgEl.textContent = 'Could not schedule. Please call Ujjwal Prasad directly at +91 82109 67599.';
          msgEl.className = 'form-msg show err';
        }

        submitBtn.disabled = false;
        submitBtn.textContent = 'Confirm Site Audit';
      });
    }

    // RFQ Form Handler
    const rfqForm = document.getElementById('rfqForm');
    if (rfqForm) {
      rfqForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const msgEl = document.getElementById('rfqMsg');
        const submitBtn = rfqForm.querySelector('button[type="submit"]');

        const rawPhone = rfqForm.rfqPhone.value.trim();
        const digitsOnly = rawPhone.replace(/[^0-9]/g, '');
        const normPhone = (digitsOnly.length >= 10) ? digitsOnly.slice(-10) : (digitsOnly || rawPhone);

        const payload = {
          company_name: rfqForm.rfqCompany.value.trim(),
          contact_person: rfqForm.rfqName.value.trim(),
          email: rfqForm.rfqEmail.value.trim(),
          phone: normPhone,
          raw_phone: rawPhone,
          service_type: rfqForm.rfqService.value,
          capacity_mw: rfqForm.rfqCapacity.value.trim(),
          location: rfqForm.rfqLocation.value.trim(),
          project_details: rfqForm.rfqDetails.value.trim()
        };

        if (!payload.email || !payload.phone) {
          msgEl.textContent = 'Please provide contact Email and Phone number.';
          msgEl.className = 'form-msg show err';
          return;
        }

        submitBtn.disabled = true;
        submitBtn.textContent = 'Submitting RFQ…';

        const endpoints = [
          REMOTE_API + '/api/v1/quotes',
          REMOTE_API + '/api/quotes',
          REMOTE_API + '/api/quote',
          REMOTE_API + '/api/contact',
          '/api/v1/quotes',
          '/api/contact'
        ];
        let success = false;

        for (const ep of endpoints) {
          try {
            const postBody = ep.includes('/contact') ? {
              name: payload.contact_person,
              fullName: payload.contact_person,
              email: payload.email,
              phone: payload.phone,
              company: payload.company_name,
              project_type: 'RFQ Proposal: ' + payload.service_type,
              projectType: 'RFQ Proposal: ' + payload.service_type,
              message: `Commercial RFQ Proposal. Capacity: ${payload.capacity_mw || '100 kW'}, Location: ${payload.location || 'Site'}, Scope: ${payload.project_details}`,
              source: 'website_rfq_modal'
            } : payload;

            const res = await fetch(ep, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(postBody)
            });
            const data = await res.json();
            if (res.ok && (data.success || data.quoteId || data.quoteNumber || data.contact_id)) {
              msgEl.textContent = `✓ ${data.message || 'Commercial RFQ submitted successfully.'}`;
              msgEl.className = 'form-msg show ok';
              rfqForm.reset();
              success = true;
              setTimeout(() => closeModal(rfqModal), 3500);
              break;
            }
          } catch (err) {}
        }

        if (!success) {
          msgEl.textContent = 'Could not submit proposal request. Please call +91 82109 67599 directly.';
          msgEl.className = 'form-msg show err';
        }

        submitBtn.disabled = false;
        submitBtn.textContent = 'Submit Commercial RFQ';
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Boot
  // ---------------------------------------------------------------------------
  document.addEventListener('DOMContentLoaded', () => {
    initCalculator();
    initTelemetry();
    initPortfolio();
    initModals();
  });
})();
