/**
 * Neoserve Projects — Enterprise Operations Admin Panel
 * Fetches and displays Leads, Quotes, Consultations, and SLA Tasks from Aiven MySQL (neoserve_db).
 */

(function () {
  'use strict';

  let adminKey = '';
  let activeData = null;

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str == null ? '' : String(str);
    return div.innerHTML;
  }

  function formatDate(iso) {
    if (!iso) return '-';
    try {
      return new Date(iso).toLocaleString();
    } catch (e) {
      return iso;
    }
  }

  async function loadData() {
    const gateMsg = document.getElementById('gateMsg');
    const refreshBtn = document.getElementById('refreshBtn');
    if (gateMsg) gateMsg.className = 'form-msg';
    if (refreshBtn) {
      refreshBtn.disabled = true;
      refreshBtn.textContent = 'Loading…';
    }

    try {
      const res = await fetch('/api/v1/admin/overview', {
        headers: { 'X-Admin-Key': adminKey }
      });

      if (res.status === 401) {
        if (gateMsg) {
          gateMsg.textContent = 'Incorrect admin key.';
          gateMsg.className = 'form-msg show err';
        }
        return;
      }

      if (!res.ok) throw new Error('Request failed with HTTP ' + res.status);

      const data = await res.json();
      activeData = data;

      document.getElementById('gate').style.display = 'none';
      document.getElementById('results').style.display = 'block';

      // KPI Counters
      document.getElementById('countLeads').textContent = data.summary.leadsCount;
      document.getElementById('countQuotes').textContent = data.summary.quotesCount;
      document.getElementById('countAudits').textContent = data.summary.consultationsCount;
      document.getElementById('countTasks').textContent = data.summary.tasksCount;

      renderLeads(data.leads || []);
      renderQuotes(data.quotes || []);
      renderConsultations(data.consultations || []);
      renderTasks(data.tasks || []);

    } catch (err) {
      if (gateMsg) {
        gateMsg.textContent = 'Could not load enterprise data from Aiven MySQL: ' + err.message;
        gateMsg.className = 'form-msg show err';
      }
    } finally {
      if (refreshBtn) {
        refreshBtn.disabled = false;
        refreshBtn.textContent = '↻ Refresh Data';
      }
    }
  }

  function renderLeads(leads) {
    const body = document.getElementById('leadsBody');
    body.innerHTML = '';
    if (!leads.length) {
      body.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:24px;">No leads recorded in Aiven MySQL yet.</td></tr>';
      return;
    }

    leads.forEach(l => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><span class="status-badge badge-${escapeHtml(l.status || 'NEW')}">${escapeHtml(l.status || 'NEW')}</span></td>
        <td><strong>${escapeHtml(l.id)}</strong><br><span style="font-size:11px;color:var(--slate-soft);">${escapeHtml(formatDate(l.createdAt))}</span></td>
        <td><strong>${escapeHtml(l.fullName)}</strong></td>
        <td>${escapeHtml(l.email)}<br>${escapeHtml(l.phone)}</td>
        <td>${escapeHtml(l.company || '-')}</td>
        <td><strong>${escapeHtml(l.projectType)}</strong></td>
        <td>${escapeHtml(l.location || '-')}</td>
        <td style="max-width:280px;font-size:12.5px;">${escapeHtml(l.message)}</td>
      `;
      body.appendChild(tr);
    });
  }

  function renderQuotes(quotes) {
    const body = document.getElementById('quotesBody');
    body.innerHTML = '';
    if (!quotes.length) {
      body.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:24px;">No RFQ quotes recorded in Aiven MySQL yet.</td></tr>';
      return;
    }

    quotes.forEach(q => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><span class="status-badge badge-${escapeHtml(q.status || 'SUBMITTED')}">${escapeHtml(q.status || 'SUBMITTED')}</span></td>
        <td><strong>${escapeHtml(q.quote_number)}</strong></td>
        <td><strong>${escapeHtml(q.company || '-')}</strong></td>
        <td>${escapeHtml(q.customer_name)}</td>
        <td>${escapeHtml(q.email)}<br>${escapeHtml(q.phone)}</td>
        <td><strong>${escapeHtml(q.project_type)}</strong></td>
        <td>${escapeHtml(q.capacity || '-')}</td>
        <td>${escapeHtml(formatDate(q.created_at))}</td>
      `;
      body.appendChild(tr);
    });
  }

  function renderConsultations(consultations) {
    const body = document.getElementById('consultationsBody');
    body.innerHTML = '';
    if (!consultations.length) {
      body.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:24px;">No site audit bookings recorded in Aiven MySQL yet.</td></tr>';
      return;
    }

    consultations.forEach(c => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><span class="status-badge badge-${escapeHtml(c.status || 'CONFIRMED')}">${escapeHtml(c.status || 'CONFIRMED')}</span></td>
        <td><strong>${escapeHtml(c.booking_reference)}</strong></td>
        <td><strong>${escapeHtml(c.full_name)}</strong></td>
        <td>${escapeHtml(c.organization || '-')}</td>
        <td>${escapeHtml(c.email)}<br>${escapeHtml(c.phone)}</td>
        <td><strong style="color:var(--green-deep);">${escapeHtml(c.preferred_date ? c.preferred_date.slice(0, 10) : '-')}</strong></td>
        <td>${escapeHtml(c.audit_topic || '-')}</td>
        <td>${escapeHtml(c.site_location || '-')}</td>
      `;
      body.appendChild(tr);
    });
  }

  function renderTasks(tasks) {
    const body = document.getElementById('tasksBody');
    body.innerHTML = '';
    if (!tasks.length) {
      body.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:24px;">No pending tasks in Aiven MySQL.</td></tr>';
      return;
    }

    tasks.forEach(t => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong style="color:${t.priority === 'HIGH' ? '#DC2626' : 'var(--slate)'};">${escapeHtml(t.priority)}</strong></td>
        <td><span class="status-badge badge-${escapeHtml(t.status)}">${escapeHtml(t.status)}</span></td>
        <td><strong>${escapeHtml(t.title)}</strong></td>
        <td>Entity: ${escapeHtml(t.entity_type || 'LEAD')} &middot; ${escapeHtml(t.entity_id || '-')}</td>
        <td><strong style="color:#B45309;">${escapeHtml(formatDate(t.due_at))}</strong></td>
        <td>${escapeHtml(formatDate(t.created_at))}</td>
      `;
      body.appendChild(tr);
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    const loadBtn = document.getElementById('loadBtn');
    const refreshBtn = document.getElementById('refreshBtn');
    const keyInput = document.getElementById('adminKey');
    const tabButtons = document.querySelectorAll('.admin-tab-btn');

    // Tab switching
    tabButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        tabButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const view = btn.getAttribute('data-view');
        document.querySelectorAll('.admin-view').forEach(v => v.style.display = 'none');
        const activeView = document.getElementById(`view-${view}`);
        if (activeView) activeView.style.display = 'block';
      });
    });

    if (loadBtn && keyInput) {
      loadBtn.addEventListener('click', function () {
        adminKey = keyInput.value.trim();
        if (!adminKey) return;
        loadData();
      });

      keyInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') loadBtn.click();
      });
    }

    if (refreshBtn) {
      refreshBtn.addEventListener('click', loadData);
    }
  });
})();
