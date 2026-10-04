/**
 * Neoserve Projects — Contact Form Submission
 * 
 * Connected directly to Aiven MySQL database via /api/v1/leads
 * Generates RFC4122 Idempotency-Key and creates automated 24-hr SLA review tasks.
 */

(function () {
  'use strict';

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

      const payload = {
        fullName: form.fullName.value.trim(),
        email: form.email.value.trim(),
        phone: form.phone.value.trim(),
        company: form.company ? form.company.value.trim() : '',
        projectType: form.projectType.value,
        location: form.location ? form.location.value.trim() : '',
        message: form.message.value.trim(),
        source: 'website_contact_form',
        website: honeypot
      };

      if (!payload.fullName || !payload.email || !payload.phone || !payload.projectType || !payload.message) {
        showMsg(msg, 'Please fill in all required fields.', 'err');
        return;
      }

      setLoading(btn, true);
      msg.className = 'form-msg';

      const idempotencyKey = generateUUID();

      // Try local server first (/api/v1/leads -> Aiven MySQL), then fallback to /api/contact
      const endpoints = ['/api/v1/leads', '/api/contact', 'https://rms-monster-api.onrender.com/api/v1/leads'];
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

          if (res.ok && data.success === true) {
            submitted = true;
            window.location.assign('/thank-you.html');
            return;
          }

          if (res.status === 400 || res.status === 429) {
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
