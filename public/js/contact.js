
/* Neoserve Projects — contact form submission
   Posts to /api/contact which validates the payload
   and stores it in the database.
*/

(function () {
  function showMsg(el, text, kind) {
    el.textContent = text;
    el.className = 'form-msg show ' + kind;
  }

  function setLoading(btn, loading) {
    btn.disabled = loading;
    btn.style.opacity = loading ? '0.65' : '1';

    if (loading) {
      btn.textContent = 'Sending…';
    } else {
      btn.textContent = 'Send message';

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

      // Honeypot check — if filled, silently pretend success.
      const honeypotField = form.querySelector('#website');
      const honeypot = honeypotField ? honeypotField.value.trim() : '';

      const payload = {
        fullName: form.fullName.value.trim(),
        email: form.email.value.trim(),
        phone: form.phone.value.trim(),
        company: form.company.value.trim(),
        projectType: form.projectType.value,
        location: form.location.value.trim(),
        message: form.message.value.trim(),
        website: honeypot
      };

      // Validate required fields
      if (
        !payload.fullName ||
        !payload.email ||
        !payload.phone ||
        !payload.projectType ||
        !payload.message
      ) {
        showMsg(
          msg,
          'Please fill in all required fields.',
          'err'
        );
        return;
      }

      setLoading(btn, true);
      msg.className = 'form-msg';

      try {
        const res = await fetch(
          'https://rms-monster-api.onrender.com/api/contact',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
          }
        );

        // IMPORTANT:
        // Read the API response BEFORE checking data.success.
        let data = {};

        try {
          data = await res.json();
        } catch (e) {
          data = {};
        }

        // Successful API submission
        if (res.ok && data.success === true) {
          window.location.assign('/thank-you.html');
          return;
        }

        // API returned an error
        showMsg(
          msg,
          data.error ||
            data.message ||
            'Something went wrong. Please try again or call us directly.',
          'err'
        );

      } catch (err) {
        // Network/API connection error
        showMsg(
          msg,
          'Network error — please check your connection and try again.',
          'err'
        );

      } finally {
        setLoading(btn, false);
      }
    });
  });
})();
```
