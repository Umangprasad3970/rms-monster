/* Neoserve Projects — contact form submission
   Posts to /api/contact (vanilla Node server, see server.js) which validates
   the payload and stores it in the SQLite database at data/neoserve.db. */

(function () {
  function showMsg(el, text, kind) {
    el.textContent = text;
    el.className = 'form-msg show ' + kind;
  }

  function setLoading(btn, loading) {
    btn.disabled = loading;
    btn.style.opacity = loading ? '0.65' : '1';
    btn.textContent = loading ? 'Sending…' : 'Send message';
    if (!loading) {
      const arrow = document.createElement('span');
      arrow.className = 'btn-arrow';
      arrow.innerHTML = '&rarr;';
      btn.appendChild(document.createTextNode(' '));
      btn.appendChild(arrow);
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    const form = document.getElementById('contactForm');
    if (!form) return;
    const msg = document.getElementById('formMsg');
    const btn = document.getElementById('submitBtn');

    form.addEventListener('submit', async function (e) {
      e.preventDefault();

      // Honeypot check — if filled, silently pretend success (likely a bot).
      const honeypot = form.querySelector('#website').value;

      const payload = {
        fullName: form.fullName.value.trim(),
        email: form.email.value.trim(),
        phone: form.phone.value.trim(),
        company: form.company.value.trim(),
        projectType: form.projectType.value,
        location: form.location.value.trim(),
        message: form.message.value.trim(),
        website: honeypot,
      };

      if (!payload.fullName || !payload.email || !payload.phone || !payload.projectType || !payload.message) {
        showMsg(msg, 'Please fill in all required fields.', 'err');
        return;
      }

      setLoading(btn, true);
      msg.className = 'form-msg';

      try {
        const res = await fetch('https://formspree.io/f/xgogjjpz', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          window.location.href = '/thank-you.html';
          return;
        }
        let data = {};
        try { data = await res.json(); } catch (e) {}
        showMsg(msg, data.error || 'Something went wrong. Please try again or call us directly.', 'err');
      } catch (err) {
        showMsg(msg, 'Network error — please check your connection and try again.', 'err');
      } finally {
        setLoading(btn, false);
      }
    });
  });
})();
