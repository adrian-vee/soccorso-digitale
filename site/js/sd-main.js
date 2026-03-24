/**
 * Soccorso Digitale — Main JS
 * Navbar, mobile menu, fade-in, counters, benefits active, FAQ
 */
(function () {
  'use strict';

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ── Navbar scroll blur ── */
  const navbar = document.querySelector('.navbar');
  if (navbar) {
    const onScroll = () => navbar.classList.toggle('scrolled', window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* ── Mobile hamburger ── */
  const hamburger = document.querySelector('.navbar__hamburger');
  const mobileMenu = document.querySelector('.mobile-menu');
  let menuOpen = false;

  function setMenu(open) {
    menuOpen = open;
    if (mobileMenu) mobileMenu.classList.toggle('open', open);
    document.body.style.overflow = open ? 'hidden' : '';
    if (hamburger) hamburger.setAttribute('aria-expanded', String(open));
    const spans = hamburger ? hamburger.querySelectorAll('span') : [];
    if (open) {
      if (spans[0]) spans[0].style.transform = 'rotate(45deg) translate(5px, 5px)';
      if (spans[1]) spans[1].style.opacity = '0';
      if (spans[2]) spans[2].style.transform = 'rotate(-45deg) translate(5px, -5px)';
    } else {
      spans.forEach(s => { s.style.transform = ''; s.style.opacity = ''; });
    }
  }

  if (hamburger && mobileMenu) {
    hamburger.addEventListener('click', () => setMenu(!menuOpen));
    mobileMenu.querySelectorAll('.mobile-menu__link, .btn').forEach(el =>
      el.addEventListener('click', () => setMenu(false))
    );
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && menuOpen) setMenu(false);
    });
  }

  /* ── Fade-in on scroll ── */
  if (!reducedMotion) {
    const fadeObs = new IntersectionObserver(
      entries => entries.forEach(e => {
        if (e.isIntersecting) {
          e.target.classList.add('visible');
          fadeObs.unobserve(e.target);
        }
      }),
      { threshold: 0.10, rootMargin: '0px 0px -48px 0px' }
    );
    document.querySelectorAll('.fade-in').forEach(el => fadeObs.observe(el));
  } else {
    document.querySelectorAll('.fade-in').forEach(el => el.classList.add('visible'));
  }

  /* ── Animated counters ── */
  function animateCount(el) {
    const target = parseFloat(el.dataset.target);
    const suffix = el.dataset.suffix || '';
    const decimals = el.dataset.decimals ? parseInt(el.dataset.decimals) : 0;
    const duration = 1800;
    const start = performance.now();

    function tick(now) {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3); // ease-out-cubic
      const val = target * eased;
      el.textContent = decimals > 0 ? val.toFixed(decimals) + suffix : Math.round(val) + suffix;
      if (t < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  const counterObs = new IntersectionObserver(
    entries => entries.forEach(e => {
      if (e.isIntersecting && !e.target.dataset.done) {
        e.target.dataset.done = '1';
        animateCount(e.target);
        counterObs.unobserve(e.target);
      }
    }),
    { threshold: 0.55 }
  );
  document.querySelectorAll('[data-counter]').forEach(el => counterObs.observe(el));

  /* ── Benefits — highlight visible card ── */
  const benefitCards = document.querySelectorAll('.benefit-card');
  if (benefitCards.length && !reducedMotion) {
    const bObs = new IntersectionObserver(
      entries => entries.forEach(e => e.target.classList.toggle('is-active', e.isIntersecting)),
      { threshold: 0.55, rootMargin: '0px 0px -10% 0px' }
    );
    benefitCards.forEach(c => bObs.observe(c));
  }

  /* ── FAQ accordion ── */
  document.querySelectorAll('.faq-trigger').forEach(trigger => {
    trigger.addEventListener('click', function () {
      const isOpen = this.getAttribute('aria-expanded') === 'true';

      // Close all
      document.querySelectorAll('.faq-trigger').forEach(t => {
        t.setAttribute('aria-expanded', 'false');
        const body = t.nextElementSibling;
        if (body) body.classList.remove('open');
      });

      // Open clicked if it was closed
      if (!isOpen) {
        this.setAttribute('aria-expanded', 'true');
        const body = this.nextElementSibling;
        if (body) body.classList.add('open');
      }
    });
  });

  /* ── Smooth scroll for anchor links ── */
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', e => {
      const target = document.querySelector(a.getAttribute('href'));
      if (!target) return;
      e.preventDefault();
      const offset = target.getBoundingClientRect().top + window.scrollY - 88;
      window.scrollTo({ top: offset, behavior: reducedMotion ? 'instant' : 'smooth' });
    });
  });

})();
