/**
 * Neoserve Projects — Contact Form Submission
 * 
 * Connected directly to Aiven MySQL database via /api/v1/leads and /api/contact
 * Generates RFC4122 Idempotency-Key and creates automated 24-hr SLA review tasks.
 */

(function () {
  'use strict';

  const REMOTE_API = 'https://rms-monster-api.onrender.com';

  function showMsg(el, text, kind) {
    el.textContent = text;
    el.className = 'form-msg show ' + kind;
  }

  function setLoading(btn, loading) {
    btn.disabled = loading;
    btn.style.opacity = loading ? '0.65' : '1';

    if (loading) {
      btn.textContent = 'Submitting Enquiry…';
    } else {
      btn.textContent = 'Send message';
      const arrow = document.createElement('span');
      arrow.className = 'btn-arrow';
      arrow.innerHTML = ' &rarr;';
      btn.appendChild(arrow);
    }
  }

  function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    const form = document.getElementById('contactForm');
    if (!form) return;

    const msg = document.getElementById('formMsg');
    const btn = document.getElementById('submitBtn');

    form.addEventListener('submit', async function (e) {
      e.preventDefault();

      // Honeypot check
      const honeypotField = form.querySelector('#website');
      const honeypot = honeypotField ? honeypotField.value.trim() : '';

      const fullName = (form.fullName ? form.fullName.value : (form.name ? form.name.value : '')).trim();
      const email = form.email.value.trim();
      const phone = form.phone.value.trim();
      const company = form.company ? form.company.value.trim() : '';
      const projectType = form.projectType ? form.projectType.value : (form.project_type ? form.project_type.value : 'Clean Energy EPC');
      const location = form.location ? form.location.value.trim() : '';
      const message = form.message.value.trim();

      if (!fullName || !email || !phone || !message) {
        showMsg(msg, 'Please fill in all required fields (Name, Email, Phone, Scope).', 'err');
        return;
      }

      const payload = {
        fullName: fullName,
        name: fullName,
        full_name: fullName,
        email: email,
        phone: phone,
        company: company,
        projectType: projectType,
        project_type: projectType,
        service: projectType,
        serviceId: projectType,
        location: location,
        message: message,
        source: 'website_contact_form',
        website: honeypot
      };

      setLoading(btn, true);
      msg.className = 'form-msg';

      const idempotencyKey = generateUUID();

      // Determine endpoints order: on static domains like rms.monster, call Render API first
      const isStaticHost = window.location.hostname.includes('rms.monster') || 
                           window.location.hostname.includes('github.io') ||
                           window.location.protocol === 'file:';

      const endpoints = isStaticHost ? [
        `${REMOTE_API}/api/v1/leads`,
        `${REMOTE_API}/api/contact`,
        '/api/v1/leads',
        '/api/contact'
      ] : [
        '/api/v1/leads',
        '/api/contact',
        `${REMOTE_API}/api/v1/leads`,
        `${REMOTE_API}/api/contact`
      ];

      let submitted = false;

      for (const endpoint of endpoints) {
        try {
          const res = await fetch(endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Idempotency-Key': idempotencyKey,
              'Accept': 'application/json'
            },
            body: JSON.stringify(payload)
          });

          let data = {};
          try {
            data = await res.json();
          } catch (e) {
            data = {};
          }

          if (res.ok && (data.success === true || data.contact_id || data.contactId || data.leadId || data.status === 'NEW')) {
            submitted = true;
            window.location.assign('/thank-you.html');
            return;
          }

          if (res.status === 400 || res.status === 422 || res.status === 429) {
            showMsg(msg, data.error || data.message || 'Validation error. Please verify your details.', 'err');
            submitted = true;
            break;
          }
        } catch (netErr) {
          console.warn(`Attempt at ${endpoint} failed, trying next...`);
        }
      }

      if (!submitted) {
        showMsg(msg, 'Could not connect to server. Please call Dinesh Ahirwar directly at +91 63756 96762.', 'err');
      }

      setLoading(btn, false);
    });
  });
})();
