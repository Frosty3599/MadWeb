/* ───────────────────────────────────────────────────────────────────────────
   Section registry.

   Every section is registered by id with the work it needs done. Each entry
   queries its own DOM and returns early if that DOM is absent — which is what
   makes a section genuinely removable: delete the <section> from index.html
   and its motion, its nav link and its logic all disappear with it, with no
   other edit anywhere.
   ─────────────────────────────────────────────────────────────────────────── */

import { reveal, splitLines, scrub, countersIn, reduced, gsap } from './motion.js';

export function mount() {
  const present = (id) => document.getElementById(id);

  /* A section that was deleted should not leave a dead nav link behind. */
  document.querySelectorAll('.nav__links a').forEach((a) => {
    if (!present(a.getAttribute('href').slice(1))) a.remove();
  });

  reviews();
  glow();
  build();
  science();
  fit();
  spec();
  faq();

  /* Headlines rise line by line wherever they appear. */
  document.querySelectorAll('.h2, .display').forEach((h) => {
    if (h.closest('.hero')) return;   // the hero module owns its own title
    if (reduced) return;
    revealHeading(h);
  });

  reveal(document);
}


/* 07 — off unless someone has explicitly turned it on. The quotes in the
   markup are labelled sample copy; publishing invented reviews on a live
   storefront is dishonest and, in most jurisdictions, unlawful. Set
   data-reviews="on" on <html> once they are real. */
function reviews() {
  const el = document.getElementById('reviews');
  if (!el) return;
  el.hidden = document.documentElement.dataset.reviews !== 'on';
}


/* 01 — the glow section is a band with no timeline of its own. Its gesture is
   the switch, which theme.js owns. All it needs is an entrance. */
function glow() {
  const el = document.getElementById('glow');
  if (!el) return;
  el.querySelectorAll('.glow__frame, .glow__copy').forEach((n) => n.setAttribute('data-reveal', ''));
}


/* 03 — the cross-section separates and labels itself across the pin. Without
   a pin (mobile, reduced motion) it paints the separated, fully-labelled
   state immediately, because that is the state that actually explains the
   product. */
function build() {
  const el = document.getElementById('build');
  const svg = el?.querySelector('[data-xsection]');
  if (!el || !svg) return;

  const layers = [...svg.querySelectorAll('.xs__layer')];
  const steps = [...el.querySelectorAll('.build__step')];
  const offsets = [-96, -32, 32, 96];   // final vertical separation, px in SVG units

  scrub(el, (tl) => {
    if (!tl || !gsap) {
      layers.forEach((g, i) => {
        g.style.transform = `translateY(${offsets[i]}px)`;
        g.classList.add('is-labelled');
      });
      steps.forEach((s) => s.classList.add('is-active'));
      return;
    }

    layers.forEach((g, i) => {
      tl.to(g, {
        y: offsets[i],
        ease: 'none',
        onStart: () => g.classList.add('is-labelled'),
        onReverseComplete: () => g.classList.remove('is-labelled'),
      }, i * 0.12);
    });

    /* The prose highlights in step with the drawing: the suspension while the
       outer layers part, the pigment as the glow core is exposed. */
    tl.add(() => setActive(steps, 0), 0.05)
      .add(() => setActive(steps, 1), 0.55);
  }, { end: '+=160%' });
}

function setActive(steps, i) {
  steps.forEach((s, n) => s.classList.toggle('is-active', n === i));
}


/* 04 — the decay curve draws itself and the readout counts down with it. */
function science() {
  const el = document.getElementById('science');
  const path = el?.querySelector('[data-curve-path]');
  const head = el?.querySelector('[data-curve-head]');
  const hours = el?.querySelector('[data-curve-hours]');
  if (!el || !path) return;

  countersIn(el);

  const area = el.querySelector('[data-curve-area]');
  const len = path.getTotalLength();
  path.style.strokeDasharray = String(len);

  /* The filled area is revealed by a clip rectangle that tracks the drawn
     length, so volume and stroke advance together instead of the fill sitting
     under a line that has not got there yet. */
  const svg = path.ownerSVGElement;
  let clipRect = null;
  if (area && svg) {
    const ns = 'http://www.w3.org/2000/svg';
    const defs = document.createElementNS(ns, 'defs');
    const clip = document.createElementNS(ns, 'clipPath');
    clip.setAttribute('id', 'nc-curve-clip');
    clipRect = document.createElementNS(ns, 'rect');
    clipRect.setAttribute('x', '0');
    clipRect.setAttribute('y', '0');
    clipRect.setAttribute('height', '240');
    clipRect.setAttribute('width', '0');
    clip.appendChild(clipRect);
    defs.appendChild(clip);
    svg.insertBefore(defs, svg.firstChild);
    area.setAttribute('clip-path', 'url(#nc-curve-clip)');
  }

  scrub(el, (tl) => {
    if (!tl || !gsap) {
      path.style.strokeDashoffset = '0';
      if (clipRect) clipRect.setAttribute('width', '420');
      if (hours) hours.textContent = '0.0';
      if (head) {
        const end = path.getPointAtLength(len);
        head.setAttribute('cx', end.x.toFixed(1));
        head.setAttribute('cy', end.y.toFixed(1));
      }
      return;
    }

    path.style.strokeDashoffset = String(len);
    const state = { p: 0 };

    tl.to(state, {
      p: 1,
      ease: 'none',
      onUpdate: () => {
        path.style.strokeDashoffset = String(len * (1 - state.p));
        const pt = path.getPointAtLength(len * state.p);
        if (head) { head.setAttribute('cx', pt.x.toFixed(1)); head.setAttribute('cy', pt.y.toFixed(1)); }
        if (clipRect) clipRect.setAttribute('width', pt.x.toFixed(1));
        if (hours) hours.textContent = (6 - state.p * 6).toFixed(1);
      },
    }, 0);
  }, { end: '+=150%' });
}


/* 05 — the four fits arrive in sequence, then the ticket. Staggered by an
   inline custom property rather than nth-child rules, so adding or removing a
   fit needs no CSS change. */
function fit() {
  const group = document.querySelector('.fits[data-stagger]');
  if (!group) return;

  const items = [...group.children];
  items.forEach((el, i) => {
    el.setAttribute('data-stagger-item', '');
    el.style.setProperty('--d', `${i * 70}ms`);
  });

  if (reduced) { group.classList.add('is-in'); return; }

  const io = new IntersectionObserver(([entry]) => {
    if (!entry.isIntersecting) return;
    group.classList.add('is-in');
    io.disconnect();
  }, { threshold: 0.25 });
  io.observe(group);
}


/* 06 — the video column is sticky in CSS, so all this does is stagger the
   rows past it and keep the video from playing to nobody. */
function spec() {
  const el = document.getElementById('specification');
  if (!el) return;

  el.querySelectorAll('.spec-row').forEach((r) => r.setAttribute('data-reveal', ''));

  const video = el.querySelector('video');
  if (!video) return;

  new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting) video.play().catch(() => { /* autoplay refused; the poster stands */ });
    else video.pause();
  }, { threshold: 0.2 }).observe(video);
}


/* 08 — only one answer open at a time. A stack of open answers turns the
   section back into the wall of text it exists to avoid. */
function faq() {
  const list = document.querySelector('.faq__list');
  if (!list) return;

  const items = [...list.querySelectorAll('details')];

  items.forEach((d) => {
    /* Everything after the summary goes in a wrapper we can measure. <details>
       itself cannot be animated — it snaps. */
    const body = document.createElement('div');
    body.className = 'qa__body';
    [...d.childNodes].filter((n) => n.nodeName !== 'SUMMARY').forEach((n) => body.appendChild(n));
    d.appendChild(body);
    if (!d.open) body.style.height = '0px';

    const summary = d.querySelector('summary');
    if (!summary) return;

    summary.addEventListener('click', (e) => {
      if (reduced) return;          /* let the native toggle happen instantly */
      e.preventDefault();           /* we drive open and closed ourselves */
      if (d.dataset.busy) return;
      toggle(d, body, !d.open, items);
    });
  });
}

/* The browser hides a closed <details>'s content the instant `open` flips to
   false, so a height transition started at the same moment plays to an
   invisible box — the answer appears to snap shut however carefully it is
   animated. Closing therefore keeps `open` true for the length of the
   animation and only flips it at the end. */
function toggle(d, body, opening, items) {
  d.dataset.busy = '1';

  if (opening) {
    items.forEach((o) => {
      if (o !== d && o.open) toggle(o, o.querySelector('.qa__body'), false, items);
    });
    d.open = true;
  }

  const from = body.getBoundingClientRect().height;
  body.style.height = 'auto';
  const to = opening ? body.getBoundingClientRect().height : 0;

  body.style.height = `${from}px`;
  body.setAttribute('data-animating', '');
  void body.offsetHeight;          /* one forced reflow, so there is a start value */
  body.style.height = `${to}px`;

  const end = (e) => {
    if (e && e.target !== body) return;
    body.removeEventListener('transitionend', end);
    clearTimeout(fallback);
    body.removeAttribute('data-animating');
    if (opening) {
      /* Never leave it at a fixed pixel height — the answer would clip if the
         window narrowed and the text rewrapped. */
      body.style.height = 'auto';
    } else {
      d.open = false;
      body.style.height = '0px';
    }
    delete d.dataset.busy;
  };

  body.addEventListener('transitionend', end);
  /* transitionend does not fire when the height does not actually change. */
  const fallback = setTimeout(end, 700);
}


function revealHeading(h) {
  const io = new IntersectionObserver(([entry]) => {
    if (!entry.isIntersecting) return;
    splitLines(h);
    io.disconnect();
  }, { threshold: 0.4 });
  io.observe(h);
}
