/* ───────────────────────────────────────────────────────────────────────────
   Motion engine.

   Four primitives, one Lenis instance, one reduced-motion decision. Sections
   never touch GSAP directly — they ask for a reveal, a split, a scrub or a
   count, and this file decides whether that means a timeline or an instant
   final state. That is what keeps the whole page moving to the same rhythm.
   ─────────────────────────────────────────────────────────────────────────── */

const gsap = window.gsap;
const ScrollTrigger = window.ScrollTrigger;

/* Read once at boot. Someone flipping the OS setting mid-session gets the old
   behaviour until reload, which is the same trade every site makes and beats
   tearing down live timelines underneath them. */
export const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* Pinned scrubbing is a desktop affordance. On a phone it fights the browser's
   own scroll handling and the address-bar resize, so the same content lands as
   plain stacked reveals instead. */
/* Wide enough to lay out in two columns, and tall enough to actually hold a
   pinned section. Without the height floor a 1280x600 laptop pins a section
   taller than its own screen, so the bottom of the diagram is below the fold
   for the entire scrub and the reader never sees it. */
export const canPin = window.matchMedia('(min-width: 901px) and (min-height: 700px)').matches && !reduced;

let lenis = null;

export function boot() {
  if (gsap && ScrollTrigger) gsap.registerPlugin(ScrollTrigger);

  if (!reduced && window.Lenis) {
    /* 0.09 is smooth enough to take the step out of a wheel notch without the
       laggy, detached feeling that heavier smoothing gives — the point where
       the page stops feeling like it is being dragged behind the cursor. */
    lenis = new window.Lenis({ lerp: 0.09, wheelMultiplier: 0.9, smoothWheel: true });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
  }

  trackProgress();
  return lenis;
}

export function scrollTo(target) {
  if (lenis) lenis.scrollTo(target, { offset: -80 });
  else document.querySelector(target)?.scrollIntoView();
}

/* The nav's hairline progress rail. Written as a CSS custom property so the
   rail is styled entirely in CSS and JS only reports a number. */
function trackProgress() {
  const fill = document.querySelector('.nav__rail span');
  if (!fill) return;
  const write = () => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const p = max > 0 ? Math.min(1, window.scrollY / max) : 0;
    fill.style.setProperty('--page-progress', p.toFixed(4));
  };
  write();
  window.addEventListener('scroll', write, { passive: true });
  window.addEventListener('resize', write);
}


/* ── reveal ────────────────────────────────────────────────────────────────
   The entrance every section gets for free. Space is reserved by CSS before
   the class lands, so a reveal can never reflow what sits below it. */

export function reveal(scope = document) {
  const items = [...scope.querySelectorAll('[data-reveal]')];
  if (!items.length) return;

  if (reduced) {
    items.forEach((el) => el.classList.add('is-in'));
    return;
  }

  /* IntersectionObserver rather than a ScrollTrigger each: a hundred cheap
     reveals should not cost a hundred scroll listeners. */
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry, i) => {
      if (!entry.isIntersecting) return;
      /* 70ms stagger — past about 90 the page reads as slow rather than
         considered, and below 50 the group lands as one lump. */
      setTimeout(() => entry.target.classList.add('is-in'), i * 70);
      io.unobserve(entry.target);
    });
  }, { rootMargin: '0px 0px -12% 0px', threshold: 0.15 });

  items.forEach((el) => io.observe(el));
}


/* ── splitLines ────────────────────────────────────────────────────────────
   Masked line-rise for headlines. Each line is wrapped once and translated
   inside its own overflow-hidden box, so the text appears to rise out of the
   rule above it rather than fading in place. */

export function splitLines(el) {
  if (!el) return;
  const lines = [...el.querySelectorAll('.hero__line')];
  const targets = lines.length ? lines : [el];

  targets.forEach((line) => {
    if (line.querySelector(':scope > span')) return;   // already split
    const inner = document.createElement('span');
    inner.innerHTML = line.innerHTML;
    line.textContent = '';
    line.appendChild(inner);
    line.style.overflow = 'hidden';
    line.style.display = 'block';
  });

  const inners = targets.map((l) => l.querySelector(':scope > span')).filter(Boolean);
  if (reduced || !gsap) {
    targets.forEach((l) => { l.style.overflow = ''; });
    return;
  }

  gsap.from(inners, {
    yPercent: 108,
    duration: 0.9,
    ease: 'power3.out',
    stagger: 0.09,
    /* The mask is only needed while the line is travelling. Left in place it
       clips the descenders of the italic serif accent word, which sits lower
       than anything Inter draws. */
    onComplete: () => targets.forEach((l) => { l.style.overflow = ''; }),
  });
}


/* ── scrub ─────────────────────────────────────────────────────────────────
   Pin a section and drive a timeline from scroll position. The only place on
   the page allowed to use a linear feel, because the "easing" is the reader's
   own scrolling. Returns null when pinning is off, and callers must cope with
   that — the content is always complete without it. */

export function scrub(el, build, { end = '+=140%' } = {}) {
  if (!el || !canPin || !gsap) {
    build?.(null);          // let the section paint its finished state
    return null;
  }

  const tl = gsap.timeline({
    scrollTrigger: {
      trigger: el,
      start: 'top top',
      end,
      pin: true,
      scrub: 0.6,           // a touch of catch-up so the scrub is not brittle
      anticipatePin: 1,
    },
  });

  build?.(tl);
  return tl;
}


/* ── countTo ───────────────────────────────────────────────────────────────
   Counters and the price odometer. Rolls rather than snaps — a price that
   changes instantly reads as a different price; one that rolls reads as the
   same price moving. */

export function countTo(el, to, { decimals = 0, prefix = '', suffix = '', duration = 0.9 } = {}) {
  if (!el) return;
  const format = (v) => prefix + v.toFixed(decimals) + suffix;

  if (reduced || !gsap) {
    el.textContent = format(to);
    return;
  }

  const from = parseFloat(String(el.textContent).replace(/[^0-9.]/g, '')) || 0;
  const state = { v: from };
  gsap.to(state, {
    v: to,
    duration,
    ease: 'power2.out',
    onUpdate: () => { el.textContent = format(state.v); },
  });
}

/* Counters declared in markup: <dd data-count="6" data-suffix=" hr">. Fired
   once, when the block carrying them first comes into view. */
export function countersIn(scope) {
  const nodes = [...scope.querySelectorAll('[data-count]')];
  if (!nodes.length) return;

  const run = () => nodes.forEach((n) => countTo(n, parseFloat(n.dataset.count), {
    decimals: Number(n.dataset.decimals || 0),
    suffix: n.dataset.suffix || '',
    duration: 1.1,
  }));

  if (reduced) { run(); return; }

  const io = new IntersectionObserver((entries) => {
    if (entries.some((e) => e.isIntersecting)) { run(); io.disconnect(); }
  }, { threshold: 0.35 });
  io.observe(nodes[0].closest('[data-section]') || nodes[0]);
}

export { gsap, ScrollTrigger };
