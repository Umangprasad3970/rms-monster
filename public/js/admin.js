/* Neoserve Projects — admin leads viewer
   Calls GET /api/leads with the admin key as a header. The key is never
   stored — it's kept in memory for the page session only. */

(function () {
  let adminKey = '';

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str == null ? '' : String(str);
    return div.innerHTML;
  }

  function formatDate(iso) {
    try {
      return new Date(iso).toLocaleString();
    } catch (e) {
      return iso;
    }
  }

  async function loadLeads() {
    const gateMsg = document.getElementById('gateMsg');
    gateMsg.className = 'form-msg';

    try {
      const res = await fetch('/api/leads', {
        headers: { 'X-Admin-Key': adminKey },
      });
      if (res.status === 401) {
        gateMsg.textContent = 'Incorrect admin key.';
        gateMsg.className = 'form-msg show err';
        return;
      }
      if (!res.ok) throw new Error('Request failed');

      const data = await res.json();
      document.getElementById('gate').style.display = 'none';
      document.getElementById('results').style.display = 'block';

      const body = document.getElementById('leadsBody');
      const empty = document.getElementById('emptyState');
      body.innerHTML = '';

      if (!data.leads || data.leads.length === 0) {
        empty.style.display = 'block';
        return;
      }
      empty.style.display = 'none';

      data.leads.forEach((lead) => {
        const tr = document.createElement('tr');
        tr.innerHTML =
          '<td>' + escapeHtml(formatDate(lead.createdAt)) + '</td>' +
          '<td>' + escapeHtml(lead.fullName) + '</td>' +
          '<td>' + escapeHtml(lead.email) + '<br>' + escapeHtml(lead.phone) + '</td>' +
          '<td>' + escapeHtml(lead.company) + '</td>' +
          '<td>' + escapeHtml(lead.projectType) + '</td>' +
          '<td>' + escapeHtml(lead.location) + '</td>' +
          '<td style="max-width:320px;">' + escapeHtml(lead.message) + '</td>';
        body.appendChild(tr);
      });
    } catch (err) {
      gateMsg.textContent = 'Could not load leads. Please try again.';
      gateMsg.className = 'form-msg show err';
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    const loadBtn = document.getElementById('loadBtn');
    const refreshBtn = document.getElementById('refreshBtn');
    const keyInput = document.getElementById('adminKey');

    loadBtn.addEventListener('click', function () {
      adminKey = keyInput.value.trim();
      if (!adminKey) return;
      loadLeads();
    });
    keyInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') loadBtn.click();
    });
    refreshBtn.addEventListener('click', loadLeads);
  });
})();
