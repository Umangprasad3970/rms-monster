/* Neoserve Projects — shared site behaviour
   Loads header/footer partials, wires the mobile menu, marks the active
   nav link, and runs a light scroll-reveal for elements tagged [data-reveal]. */

(function () {
  async function includePartial(selector, url) {
    const host = document.querySelector(selector);
    if (!host) return;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error('partial fetch failed: ' + url);
      host.innerHTML = await res.text();
    } catch (err) {
      console.error(err);
    }
  }

  function setActiveNav() {
    const path = window.location.pathname === '/' ? '/' : window.location.pathname.replace(/\/index\.html$/, '/');
    document.querySelectorAll('.nav-links a[data-path]').forEach((a) => {
      if (a.getAttribute('data-path') === path) a.classList.add('active');
    });
  }

  function wireMobileNav() {
    const toggle = document.getElementById('navToggle');
    const links = document.getElementById('navLinks');
    if (!toggle || !links) return;
    toggle.addEventListener('click', () => {
      const open = links.classList.toggle('open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    links.querySelectorAll('a').forEach((a) =>
      a.addEventListener('click', () => {
        links.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
      })
    );
  }

  function setYear() {
    const y = document.getElementById('year');
    if (y) y.textContent = new Date().getFullYear();
  }

  function wireReveal() {
    const items = document.querySelectorAll('[data-reveal]');
    if (!items.length) return;
    if (!('IntersectionObserver' in window)) {
      items.forEach((el) => el.classList.add('is-visible'));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 }
    );
    items.forEach((el) => io.observe(el));
  }

  async function boot() {
    await includePartial('#site-header', '/partials/header.html');
    setActiveNav();
    wireMobileNav();
    await includePartial('#site-footer', '/partials/footer.html');
    setYear();
    wireReveal();
  }

  document.addEventListener('DOMContentLoaded', boot);
})();
