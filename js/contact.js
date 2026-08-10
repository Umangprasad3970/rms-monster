/*
 * Neoserve Projects — contact form submission
 * Posts to the Flask API /api/contact hosted on Render.
 * The Flask API validates the payload and stores the submission
 * in the Supabase PostgreSQL database.
 */

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
      arrow.innerHTML = '→';

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


      // --------------------------------------------------
      // Honeypot check
      // --------------------------------------------------

      const honeypotField = form.querySelector('#website');

      const honeypot = honeypotField
        ? honeypotField.value.trim()
        : '';


      // --------------------------------------------------
      // Get form values
      // --------------------------------------------------

      const fullName = form.fullName.value.trim();

      const email = form.email.value.trim();

      const phone = form.phone.value.trim();

      const company = form.company.value.trim();

      const projectType = form.projectType.value;

      const location = form.location.value.trim();

      const message = form.message.value.trim();


      // --------------------------------------------------
      // Client-side validation
      // --------------------------------------------------

      if (
        !fullName ||
        !email ||
        !phone ||
        !projectType ||
        !message
      ) {

        showMsg(
          msg,
          'Please fill in all required fields.',
          'err'
        );

        return;
      }


      // --------------------------------------------------
      // Honeypot protection
      //
      // If a bot fills the hidden website field,
      // pretend the submission was successful.
      // --------------------------------------------------

      if (honeypot) {

        window.location.href = '/thank-you.html';

        return;
      }


      // --------------------------------------------------
      // Payload for Flask API
      //
      // Existing HTML field names are mapped to the
      // names expected by the Flask backend.
      // --------------------------------------------------

      const payload = {

        name: fullName,

        email: email,

        phone: phone,

        company: company,

        project_type: projectType,

        message: message,

        // Sent for future backend support.
        // Your current database/API can ignore this field.
        location: location

      };


      // --------------------------------------------------
      // Start loading state
      // --------------------------------------------------

      setLoading(btn, true);

      msg.className = 'form-msg';


      try {

        // ------------------------------------------------
        // IMPORTANT:
        // Replace this URL with your actual Render URL.
        // ------------------------------------------------

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


        // ------------------------------------------------
        // Read API response
        // ------------------------------------------------

        let data = {};

        try {
          data = await res.json();
        } catch (jsonError) {
          data = {};
        }


        // ------------------------------------------------
        // Successful submission
        // ------------------------------------------------

        if (res.ok && data.success) {

          window.location.href = '/thank-you.html';

          return;
        }


        // ------------------------------------------------
        // API returned an error
        // ------------------------------------------------

        showMsg(
          msg,
          data.message ||
          data.error ||
          'Something went wrong. Please try again or call us directly.',
          'err'
        );


      } catch (err) {

        // ------------------------------------------------
        // Network/API connection error
        // ------------------------------------------------

        console.error(
          'Contact API error:',
          err
        );

        showMsg(
          msg,
          'Network error — please check your connection and try again.',
          'err'
        );

      } finally {

        // ------------------------------------------------
        // Restore button
        // ------------------------------------------------

        setLoading(btn, false);

      }

    });

  });

})();
```
