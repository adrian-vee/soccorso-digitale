/* =============================================================
   SOCCORSO DIGITALE — Global JS
   GSAP 3.13 + Lenis 1.3.4 animations
   ============================================================= */

/* ─── 1. GSAP Setup ─────────────────────────────────────────── */
if (typeof gsap !== 'undefined') {
  // Safe: typeof never throws ReferenceError for undeclared variables
  const plugins = [
    typeof ScrollTrigger !== 'undefined' && ScrollTrigger,
    typeof TextPlugin !== 'undefined' && TextPlugin,
    typeof CustomEase !== 'undefined' && CustomEase,
    typeof Flip !== 'undefined' && Flip,
    typeof Draggable !== 'undefined' && Draggable,
    typeof InertiaPlugin !== 'undefined' && InertiaPlugin,
  ];
  const available = plugins.filter(Boolean);
  if (available.length) gsap.registerPlugin(...available);

  if (typeof SplitText !== 'undefined') gsap.registerPlugin(SplitText);

  if (typeof CustomEase !== 'undefined') {
    CustomEase.create('mdx-smooth', '0.6, 0.08, 0.02, 0.99');
  }
}

/* ─── 2. Lenis Smooth Scroll ────────────────────────────────── */
let lenis;
if (typeof Lenis !== 'undefined') {
  lenis = new Lenis({ wheelMultiplier: 0.8, duration: 1.2 });
  if (typeof ScrollTrigger !== 'undefined') {
    lenis.on('scroll', ScrollTrigger.update);
  }
  if (typeof gsap !== 'undefined') {
    gsap.ticker.add(time => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);
  }
}

/* ─── 3. Loader ─────────────────────────────────────────────── */
function initLoader() {
  const loader = document.getElementById('loader');
  if (!loader || typeof gsap === 'undefined') {
    document.getElementById('loader')?.remove();
    document.body.classList.remove('loading');
    initPageAnimations();
    return;
  }

  // Safety: if GSAP animation stalls, force reveal after 3s
  const safetyTimer = setTimeout(() => {
    loader.style.display = 'none';
    document.body.classList.remove('loading');
    initHeroEntrance();
    initPageAnimations();
  }, 3000);

  const ease = typeof CustomEase !== 'undefined' ? 'mdx-smooth' : 'power3.inOut';
  const tl = gsap.timeline({
    onComplete: () => {
      clearTimeout(safetyTimer);
      loader.style.display = 'none';
      document.body.classList.remove('loading');
      initHeroEntrance();
      initPageAnimations();
    }
  });

  tl.set('.loader-logo', { opacity: 0, y: 20 })
    .set('.loader-bar', { opacity: 0 })
    .to('.loader-logo', { opacity: 1, y: 0, duration: 0.7, ease })
    .to('.loader-bar', { opacity: 1, duration: 0.3 }, '-=0.3')
    .to('.loader-bar-fill', { width: '100%', duration: 0.9, ease: 'power2.inOut' }, '-=0.1')
    .to('.loader-logo', { opacity: 0, y: -16, duration: 0.35, ease: 'power2.in' }, '+=0.25')
    .to(loader, { clipPath: 'inset(0 0 100% 0)', duration: 0.85, ease }, '-=0.1');
}

/* ─── 4. Navbar ─────────────────────────────────────────────── */
function initNavbar() {
  const nav = document.querySelector('.nav');
  if (!nav) return;

  // Scroll state
  let scrolled = false;
  const check = () => {
    const s = window.scrollY > 60;
    if (s !== scrolled) { scrolled = s; nav.classList.toggle('scrolled', s); }
  };
  window.addEventListener('scroll', check, { passive: true });
  check();

  // Active link
  const path = window.location.pathname.replace(/\/$/, '') || '/';
  nav.querySelectorAll('.nav-links a').forEach(a => {
    const href = (a.getAttribute('href') || '').replace(/\/$/, '') || '/';
    if (href === path) a.classList.add('active');
  });
  // same for menu overlay
  document.querySelectorAll('.menu-overlay-links a').forEach(a => {
    const href = (a.getAttribute('href') || '').replace(/\/$/, '') || '/';
    if (href === path) a.style.color = '#FF6B35';
  });
}

/* ─── 5. Full-Screen Menu ───────────────────────────────────── */
function initMenu() {
  const ham = document.querySelector('.nav-ham');
  const overlay = document.querySelector('.menu-overlay');
  if (!ham || !overlay) return;

  let open = false;

  function openMenu() {
    open = true;
    overlay.classList.add('is-open');
    document.body.style.overflow = 'hidden';

    // hamburger → X
    const s = ham.querySelectorAll('span');
    if (typeof gsap !== 'undefined') {
      gsap.to(s[0], { rotation: 45, y: 6.5, duration: 0.28, ease: 'power2.inOut' });
      gsap.to(s[1], { opacity: 0, duration: 0.18 });
      gsap.to(s[2], { rotation: -45, y: -6.5, duration: 0.28, ease: 'power2.inOut' });

      const links = overlay.querySelectorAll('.menu-overlay-links a');
      gsap.to(links, { opacity: 1, y: 0, stagger: 0.07, duration: 0.55,
        ease: typeof CustomEase !== 'undefined' ? 'mdx-smooth' : 'power2.out',
        delay: 0.3 });
    }
  }

  function closeMenu() {
    open = false;
    overlay.classList.remove('is-open');
    document.body.style.overflow = '';

    const s = ham.querySelectorAll('span');
    if (typeof gsap !== 'undefined') {
      gsap.to(s[0], { rotation: 0, y: 0, duration: 0.28, ease: 'power2.inOut' });
      gsap.to(s[1], { opacity: 1, duration: 0.18, delay: 0.08 });
      gsap.to(s[2], { rotation: 0, y: 0, duration: 0.28, ease: 'power2.inOut' });

      const links = overlay.querySelectorAll('.menu-overlay-links a');
      gsap.set(links, { opacity: 0, y: 20 });
    }
  }

  ham.addEventListener('click', () => open ? closeMenu() : openMenu());
  overlay.querySelectorAll('a').forEach(a => a.addEventListener('click', closeMenu));
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && open) closeMenu(); });
}

/* ─── 6. Hero Entrance (on first page load, post-loader) ────── */
function initHeroEntrance() {
  if (typeof gsap === 'undefined') return;
  const ease = typeof CustomEase !== 'undefined' ? 'mdx-smooth' : 'power3.out';

  const badge   = document.querySelector('.hero-badge');
  const title   = document.querySelector('.hero-title');
  const sub     = document.querySelector('.hero-sub');
  const actions = document.querySelector('.hero-actions');
  const visual  = document.querySelector('.hero-visual');

  const tl = gsap.timeline({ delay: 0.05 });

  if (badge) tl.from(badge, { opacity: 0, y: 18, duration: 0.55, ease }, 0);

  if (title && typeof SplitText !== 'undefined') {
    const split = new SplitText(title, { type: 'chars,words,lines' });
    tl.from(split.chars, {
      opacity: 0, y: 55, rotateX: -75,
      stagger: 0.014, duration: 0.78, ease
    }, 0.15);
  } else if (title) {
    tl.from(title, { opacity: 0, y: 30, duration: 0.8, ease }, 0.15);
  }

  if (sub)     tl.from(sub,     { opacity: 0, y: 20, duration: 0.6, ease }, 0.65);
  if (actions) tl.from(actions, { opacity: 0, y: 20, duration: 0.6, ease }, 0.82);
  if (visual)  tl.from(visual,  { opacity: 0, x: 40, duration: 0.95, ease }, 0.25);
}

/* ─── 7. SplitText Scroll Animations ───────────────────────── */
function initSplitText() {
  if (typeof gsap === 'undefined' || typeof SplitText === 'undefined' || typeof ScrollTrigger === 'undefined') return;
  const ease = typeof CustomEase !== 'undefined' ? 'mdx-smooth' : 'power3.out';

  document.querySelectorAll('[data-split]').forEach(el => {
    const split = new SplitText(el, { type: 'chars,words,lines' });
    gsap.from(split.chars, {
      opacity: 0, y: 50, rotateX: -75,
      stagger: 0.016, duration: 0.82, ease,
      scrollTrigger: { trigger: el, start: 'top 83%', once: true }
    });
  });
}

/* ─── 8. Scroll Fade-In ─────────────────────────────────────── */
function initScrollFade() {
  if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') {
    document.querySelectorAll('[data-anim]').forEach(el => {
      el.style.opacity = '1'; el.style.transform = 'none';
    });
    return;
  }
  const ease = typeof CustomEase !== 'undefined' ? 'mdx-smooth' : 'power2.out';

  document.querySelectorAll('[data-anim]').forEach(el => {
    const type = el.dataset.anim || '';
    const delay = parseFloat(el.dataset.delay || 0);
    const fromVars = { opacity: 0, duration: 0.75, ease, delay };

    if (!type || type === 'up')    fromVars.y = 28;
    else if (type === 'left')      fromVars.x = -28;
    else if (type === 'right')     fromVars.x = 28;
    else if (type === 'scale')   { fromVars.scale = 0.96; }

    gsap.from(el, {
      ...fromVars,
      scrollTrigger: { trigger: el, start: 'top 86%', once: true }
    });
  });
}

/* ─── 9. Stagger Card Groups ────────────────────────────────── */
function initStaggerGroups() {
  if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') return;
  const ease = typeof CustomEase !== 'undefined' ? 'mdx-smooth' : 'power2.out';

  document.querySelectorAll('[data-stagger-group]').forEach(group => {
    const children = group.querySelectorAll('[data-stagger-item]');
    if (!children.length) return;
    gsap.from(children, {
      opacity: 0, y: 30,
      stagger: 0.08, duration: 0.7, ease,
      scrollTrigger: { trigger: group, start: 'top 80%', once: true }
    });
  });
}

/* ─── 10. Char Stagger Button Hover ─────────────────────────── */
function initButtonHover() {
  if (typeof gsap === 'undefined') return;

  document.querySelectorAll('.btn-animate').forEach(btn => {
    const label = btn.querySelector('.btn-lbl') || btn;
    const orig  = label.textContent.trim();
    if (!orig) return;

    const spans = orig.split('').map(c => {
      const s = document.createElement('span');
      s.textContent = c === ' ' ? '\u00A0' : c;
      s.style.display = 'inline-block';
      return s;
    });
    label.textContent = '';
    spans.forEach(s => label.appendChild(s));

    btn.addEventListener('mouseenter', () => {
      gsap.to(spans, { y: -3, stagger: { each: 0.022, from: 'start' }, duration: 0.22, ease: 'back.out(2.5)' });
    });
    btn.addEventListener('mouseleave', () => {
      gsap.to(spans, { y: 0, stagger: { each: 0.018, from: 'start' }, duration: 0.28, ease: 'power2.out' });
    });
  });
}

/* ─── 11. Counters ──────────────────────────────────────────── */
function initCounters() {
  document.querySelectorAll('[data-counter]').forEach(el => {
    const target  = parseInt(el.dataset.counter, 10);
    const suffix  = el.dataset.suffix  || '';
    const prefix  = el.dataset.prefix  || '';

    // Always show final value immediately — animation is progressive enhancement
    el.textContent = prefix + target + suffix;

    if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') return;

    // Reset to 0 just before animating — only when GSAP is confirmed available
    const obj = { v: 0 };
    el.textContent = prefix + '0' + suffix;

    ScrollTrigger.create({
      trigger: el, start: 'top 82%', once: true,
      onEnter: () => gsap.to(obj, {
        v: target, duration: 1.8, ease: 'power3.out',
        onUpdate: () => { el.textContent = prefix + Math.round(obj.v) + suffix; },
        onComplete: () => { el.textContent = prefix + target + suffix; }
      })
    });
  });
}

/* ─── 12. Logo Wall (Draggable + Inertia) ───────────────────── */
function initLogoWall() {
  const outer = document.querySelector('.logos-track-outer');
  const track = document.querySelector('.logos-track');
  if (!outer || !track || typeof Draggable === 'undefined') return;

  const minX = -(track.scrollWidth - outer.offsetWidth);

  if (typeof InertiaPlugin !== 'undefined') {
    Draggable.create(track, {
      type: 'x',
      edgeResistance: 0.65,
      inertia: true,
      bounds: { minX: Math.min(minX, 0), maxX: 0 },
      throwProps: true
    });
  } else {
    Draggable.create(track, {
      type: 'x',
      edgeResistance: 0.65,
      bounds: { minX: Math.min(minX, 0), maxX: 0 }
    });
  }
}

/* ─── 13. Card 3D Tilt ──────────────────────────────────────── */
function initCardTilt() {
  if (typeof gsap === 'undefined') return;
  const ease = 'power2.out';

  document.querySelectorAll('[data-tilt]').forEach(card => {
    card.addEventListener('mousemove', e => {
      const r  = card.getBoundingClientRect();
      const cx = r.width  / 2;
      const cy = r.height / 2;
      const rx = -((e.clientY - r.top  - cy) / cy) * 5;
      const ry =  ((e.clientX - r.left - cx) / cx) * 7;
      gsap.to(card, { rotateX: rx, rotateY: ry, transformPerspective: 900, duration: 0.35, ease });
    });
    card.addEventListener('mouseleave', () => {
      gsap.to(card, { rotateX: 0, rotateY: 0, duration: 0.65, ease: 'elastic.out(1,.5)' });
    });
  });
}

/* ─── 14. Scroll To Top ─────────────────────────────────────── */
function initScrollTop() {
  document.querySelectorAll('.footer-scroll-top').forEach(btn => {
    btn.addEventListener('click', () => {
      if (lenis) lenis.scrollTo(0, { duration: 1.5, easing: t => 1 - Math.pow(1 - t, 4) });
      else window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  });
}

/* ─── 15. Contact Form ──────────────────────────────────────── */
function initContactForm() {
  const form = document.getElementById('contact-form');
  if (!form) return;

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const btn = form.querySelector('.btn-submit');
    const orig = btn.innerHTML;
    btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg> Invio...';
    btn.disabled = true;

    try {
      const data = Object.fromEntries(new FormData(form));
      // Collect checkboxes
      const checks = [...form.querySelectorAll('input[type=checkbox]:checked')].map(c => c.value);
      data.interests = checks.join(', ');

      // Fire and forget — backend endpoint (can be added later)
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      }).catch(() => null);

      btn.innerHTML = '✓ Messaggio Inviato!';
      btn.style.background = '#10b981';
      form.reset();
      setTimeout(() => { btn.innerHTML = orig; btn.style.background = ''; btn.disabled = false; }, 4000);
    } catch {
      btn.innerHTML = orig;
      btn.disabled = false;
    }
  });
}

/* ─── 16. CTA Email Form ────────────────────────────────────── */
function initCtaForm() {
  const form = document.querySelector('.cta-form');
  if (!form) return;
  form.addEventListener('submit', e => {
    e.preventDefault();
    const input = form.querySelector('.cta-input');
    const btn   = form.querySelector('.btn-cta');
    if (!input?.value) return;
    btn.textContent = '✓ Ricevuto!';
    btn.style.background = '#10b981';
    input.value = '';
    setTimeout(() => { btn.textContent = 'Richiedi Demo →'; btn.style.background = ''; }, 3500);
  });
}

/* ─── 17. Init ──────────────────────────────────────────────── */
function initPageAnimations() {
  initSplitText();
  initScrollFade();
  initStaggerGroups();
  initButtonHover();
  initCounters();
  initLogoWall();
  initCardTilt();
  initScrollTop();
  initContactForm();
  initCtaForm();
}

document.addEventListener('DOMContentLoaded', () => {
  document.body.classList.add('loading');
  initNavbar();
  initMenu();

  if (document.getElementById('loader')) {
    initLoader();
  } else {
    document.body.classList.remove('loading');
    initHeroEntrance();
    initPageAnimations();
  }
});
