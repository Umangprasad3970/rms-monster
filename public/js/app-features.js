/**
 * Neoserve Projects — Interactive Features Engine
 * 
 * Synchronized with the Android Mobile App & Aiven Cloud MySQL database (`neoserve_db`):
 * 1. Renewable Yield & ROI Feasibility Calculator
 * 2. Real-time O&M Fleet Telemetry Monitor
 * 3. Filterable Brochure Projects Portfolio
 * 4. Technical Site Audit / Feasibility Consultation Modal
 * 5. Commercial RFQ (Request for Quotation) Modal
 */

(function () {
  'use strict';

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

    async function recalculate() {
      const type = typeSelect ? typeSelect.value : 'Solar';
      const state = stateSelect ? stateSelect.value : 'Gujarat';
      const targetKw = capSlider ? parseFloat(capSlider.value) : 100;
      const bill = billSlider ? parseFloat(billSlider.value) : 80000;

      if (capValDisplay) capValDisplay.textContent = targetKw >= 1000 ? `${(targetKw/1000).toFixed(1)} MW (${targetKw} kW)` : `${targetKw} kW`;
      if (billValDisplay) billValDisplay.textContent = `₹${bill.toLocaleString('en-IN')}/mo`;

      try {
        const res = await fetch('/api/v1/calculator/estimate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            project_type: type,
            target_capacity_kw: targetKw,
            monthly_bill_inr: bill,
            state_location: state
          })
        });

        if (res.ok) {
          const data = await res.json();
          if (resCap) resCap.textContent = data.recommended_capacity_kw >= 1000 ? `${(data.recommended_capacity_kw/1000).toFixed(2)} MW` : `${data.recommended_capacity_kw} kW`;
          if (resGen) resGen.textContent = `${(data.annual_generation_kwh / 1000).toFixed(1)} MWh/yr`;
          if (resCost) resCost.textContent = `₹${data.estimated_cost_lakhs_inr}`;
          if (resSavings) resSavings.textContent = `₹${(data.annual_savings_inr / 100000).toFixed(2)} Lakhs/yr`;
          if (resPayback) resPayback.textContent = `${data.payback_period_years} Years`;
          if (resCo2) resCo2.textContent = `${data.carbon_offset_tons_per_year} Tons/yr`;
          if (resMsg) resMsg.textContent = data.message;
        }
      } catch (err) {
        console.warn('Calculator network fallback:', err.message);
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

    async function loadTelemetry() {
      if (refreshBtn) {
        refreshBtn.disabled = true;
        refreshBtn.innerHTML = 'Refreshing…';
      }

      try {
        const res = await fetch('/api/v1/telemetry/overview');
        if (res.ok) {
          const data = await res.json();

          // Update KPI counters
          const kpiCap = document.getElementById('kpiCap');
          const kpiGen = document.getElementById('kpiGen');
          const kpiPr = document.getElementById('kpiPr');
          const kpiCo2 = document.getElementById('kpiCo2');

          if (kpiCap) kpiCap.textContent = `${data.total_managed_capacity_mw} MW`;
          if (kpiGen) kpiGen.textContent = `${data.today_total_generation_mwh} MWh`;
          if (kpiPr) kpiPr.textContent = `${data.average_performance_ratio}%`;
          if (kpiCo2) kpiCo2.textContent = `${data.total_co2_offset_tons} T`;

          // Update Plants Grid
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
      } catch (err) {
        console.warn('Telemetry load error:', err.message);
      } finally {
        if (refreshBtn) {
          refreshBtn.disabled = false;
          refreshBtn.innerHTML = '↻ Refresh Live Fleet';
        }
      }
    }

    if (refreshBtn) refreshBtn.addEventListener('click', loadTelemetry);
    loadTelemetry();

    // Auto-refresh every 60 seconds
    setInterval(loadTelemetry, 60000);
  }

  // ---------------------------------------------------------------------------
  // 3. Filterable Projects Portfolio
  // ---------------------------------------------------------------------------
  function initPortfolio() {
    const grid = document.getElementById('projectsGrid');
    if (!grid) return;

    const tabs = document.querySelectorAll('.portfolio-tabs .tab-btn');
    let allProjects = [];

    async function fetchAndRender(category = 'All') {
      try {
        const res = await fetch(`/api/v1/projects?category=${encodeURIComponent(category)}`);
        if (res.ok) {
          const data = await res.json();
          allProjects = data.projects || [];
          renderProjects(allProjects);
        }
      } catch (err) {
        console.warn('Portfolio load error:', err.message);
      }
    }

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

    // Trigger buttons
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

    // Close buttons & backdrop clicks
    document.querySelectorAll('.modal-close, .modal-backdrop').forEach(el => {
      el.addEventListener('click', (e) => {
        if (e.target === el || el.classList.contains('modal-close')) {
          closeModal(auditModal);
          closeModal(rfqModal);
        }
      });
    });

    // Escape key
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

        const payload = {
          name: auditForm.auditName.value.trim(),
          organization: auditForm.auditOrg.value.trim(),
          email: auditForm.auditEmail.value.trim(),
          phone: auditForm.auditPhone.value.trim(),
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

        try {
          const res = await fetch('/api/v1/consultation/schedule', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          const data = await res.json();

          if (res.ok && data.success) {
            msgEl.textContent = `✓ ${data.message}`;
            msgEl.className = 'form-msg show ok';
            auditForm.reset();
            setTimeout(() => closeModal(auditModal), 3500);
          } else {
            msgEl.textContent = data.error || 'Failed to schedule. Please try again.';
            msgEl.className = 'form-msg show err';
          }
        } catch (err) {
          msgEl.textContent = 'Network error. Please try again.';
          msgEl.className = 'form-msg show err';
        } finally {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Confirm Site Audit';
        }
      });
    }

    // RFQ Form Handler
    const rfqForm = document.getElementById('rfqForm');
    if (rfqForm) {
      rfqForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const msgEl = document.getElementById('rfqMsg');
        const submitBtn = rfqForm.querySelector('button[type="submit"]');

        const payload = {
          company_name: rfqForm.rfqCompany.value.trim(),
          contact_person: rfqForm.rfqName.value.trim(),
          email: rfqForm.rfqEmail.value.trim(),
          phone: rfqForm.rfqPhone.value.trim(),
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

        try {
          const res = await fetch('/api/v1/quotes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          const data = await res.json();

          if (res.ok && data.success) {
            msgEl.textContent = `✓ ${data.message}`;
            msgEl.className = 'form-msg show ok';
            rfqForm.reset();
            setTimeout(() => closeModal(rfqModal), 3500);
          } else {
            msgEl.textContent = data.error || 'Submission failed. Please try again.';
            msgEl.className = 'form-msg show err';
          }
        } catch (err) {
          msgEl.textContent = 'Network error. Please try again.';
          msgEl.className = 'form-msg show err';
        } finally {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Submit Commercial RFQ';
        }
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
