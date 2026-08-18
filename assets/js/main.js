/* ───────────────────────────────────────────────────────────────────────────
   NovaCase — entry point.

   Boots the motion engine, picks a hero, then mounts each module. Order
   matters in exactly one place: the configurator has to read the fit prices
   out of the markup before the bag can total anything.
   ─────────────────────────────────────────────────────────────────────────── */

import { boot, reduced, scrollTo } from './motion.js';
import * as sections from './sections.js';
import * as theme from './theme.js';
import * as configurator from './configurator.js';
import * as bag from './bag.js';

boot();

pickHero();
theme.mount();
configurator.mount();
bag.mount();
sections.mount();

photoFallbacks();
clock();
cursor();
smoothLinks();
intro();


/* ── Hero ────────────────────────────────────────────────────────────────────
   The constellation is the default, but it is also the most expensive thing
   on the page. Anyone who has asked for less motion, is on a coarse pointer at
   phone width, or is running four cores or fewer gets the poster instead —
   which is a designed alternative, not a degraded one. */
function pickHero() {
  const wanted = document.documentElement.dataset.hero || 'constellation';

  /* Two cores or fewer. Four was the first guess and it was wrong: plenty of
     ordinary desktops report four and run 2,200 points at 60fps without
     noticing. The guard is meant to catch genuinely weak hardware, not to
     hand half of all visitors the fallback. */
  const lowPower = (navigator.hardwareConcurrency || 8) <= 2;
  const smallTouch = window.matchMedia('(pointer: coarse) and (max-width: 640px)').matches;
  const forcePoster = reduced || lowPower || smallTouch;

  if (wanted === 'poster' || forcePoster) {
    import('./hero-poster.js').then((m) => m.mount());
    return;
  }

  if (wanted === 'darkroom') {
    import('./hero-darkroom.js').then((m) => m.mount());
    return;
  }

  import('./hero-constellation.js').then((m) => m.mount({
    onFallback: () => import('./hero-poster.js').then((p) => p.mount()),
  }));
}


/* ── Photographs ─────────────────────────────────────────────────────────────
   Any shot that has not been supplied yet is replaced in place by a tile drawn
   in that colourway's own tones, at exactly the frame's size. Dropping the real
   file in at the same path swaps it back with no reflow and no code change. */
function photoFallbacks() {
  document.querySelectorAll('.frame img').forEach((img) => {
    const fail = () => {
      if (img.dataset.replaced) return;
      img.dataset.replaced = 'true';

      const tile = document.createElement('div');
      tile.className = 'frame__ph';
      const label = document.createElement('span');
      label.textContent = img.src.split('/').pop();
      tile.append(label);
      tile.setAttribute('role', 'img');
      tile.setAttribute('aria-label', img.alt || 'Product photograph pending');
      img.replaceWith(tile);
    };

    if (img.complete && img.naturalWidth === 0) fail();
    img.addEventListener('error', fail);
  });
}


/* ── Clock ───────────────────────────────────────────────────────────────────
   A running local time rather than a founding date. Ticks on the minute
   instead of the second — a seconds readout in a nav pill is a distraction
   and repaints sixty times more often for nothing. */
function clock() {
  const el = document.querySelector('[data-clock]');
  if (!el) return;

  /* The visitor's own zone, named. A bare 05:13 could be anywhere and reads as
     decoration; "05:13 TORONTO" is visibly their clock, which is the point of
     putting one in the bar at all. */
  /* Browsers still report the tz database's historical spellings, and printing
     those back at the people who live there is worse than printing nothing —
     Chrome answers Asia/Calcutta for a clock set to Kolkata. Only the renamed
     cities need listing; everything else is already current. */
  const RENAMED = {
    Calcutta: 'Kolkata',
    Saigon: 'Ho Chi Minh City',
    Rangoon: 'Yangon',
    Kiev: 'Kyiv',
    Katmandu: 'Kathmandu',
    Ulan_Bator: 'Ulaanbaatar',
    Asmera: 'Asmara',
    Faeroe: 'Faroe',
  };

  const zone = () => {
    let tz = '';
    try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) { /* older engine */ }
    if (!tz) return '';
    /* "America/Argentina/Buenos_Aires" -> "BUENOS AIRES". The last segment is
       the city; the region prefix is the part nobody says out loud. */
    const last = tz.split('/').pop();
    return (RENAMED[last] || last).replace(/_/g, ' ').toUpperCase();
  };

  /* Formatter built once. Rebuilding it every minute is measurable work for a
     string that changes shape only when the visitor's locale does. */
  let fmt;
  try {
    fmt = new Intl.DateTimeFormat([], { hour: '2-digit', minute: '2-digit' });
  } catch (e) {
    fmt = null;
  }

  const place = zone();

  const write = () => {
    const now = new Date();
    const time = fmt ? fmt.format(now) : now.toTimeString().slice(0, 5);
    el.textContent = place ? `${time} · ${place}` : time;
    el.dateTime = now.toISOString();
    el.setAttribute('aria-label', place ? `Local time in ${place}: ${time}` : `Local time: ${time}`);
  };

  write();
  /* Align to the top of the minute, then tick once a minute — a seconds
     readout in a nav pill repaints sixty times more often to say nothing. */
  setTimeout(() => { write(); setInterval(write, 60000); }, (60 - new Date().getSeconds()) * 1000);
}


/* ── Cursor ──────────────────────────────────────────────────────────────────
   A fine-pointer affordance only. It swells over anything interactive so the
   ring reads as a state, not decoration. */
function cursor() {
  const el = document.querySelector('[data-cursor]');
  if (!el || reduced || !window.matchMedia('(pointer: fine)').matches) return;

  let x = 0, y = 0, cx = 0, cy = 0, running = false;

  const loop = () => {
    /* Trailing at 0.18 rather than pinning to the pointer: a ring locked to
       the cursor is invisible, a ring a few frames behind reads as a lens. */
    cx += (x - cx) * 0.18;
    cy += (y - cy) * 0.18;
    el.style.transform = `translate(${cx.toFixed(1)}px, ${cy.toFixed(1)}px)`;
    if (running) requestAnimationFrame(loop);
  };

  window.addEventListener('pointermove', (e) => {
    x = e.clientX; y = e.clientY;
    if (!running) { running = true; el.classList.add('is-on'); requestAnimationFrame(loop); }
    const over = e.target.closest('a, button, summary, [role="radio"]');
    el.classList.toggle('is-over', Boolean(over));
  }, { passive: true });

  document.addEventListener('pointerleave', () => el.classList.remove('is-on'));
}


/* Anchor links go through Lenis so they share the page's scrolling feel
   instead of jumping past it. */
function smoothLinks() {
  document.querySelectorAll('a[href^="#"]').forEach((a) => {
    a.addEventListener('click', (e) => {
      const id = a.getAttribute('href');
      if (id.length < 2 || !document.querySelector(id)) return;
      e.preventDefault();
      scrollTo(id);
    });
  });
}


/* ── Intro ───────────────────────────────────────────────────────────────────
   Shown once per session and never longer than it takes the fonts to settle.
   A returning visitor within the same session skips it entirely — a load
   animation you have already seen is just a delay. */
function intro() {
  const el = document.querySelector('[data-intro]');
  if (!el) return;

  let seen = false;
  try { seen = sessionStorage.getItem('nc-intro') === '1'; } catch (e) { /* private mode */ }

  let finished = false;
  const done = () => {
    if (finished) return;
    finished = true;
    el.classList.add('is-done');
    /* Outlast the 720ms shutter transition before pulling it from the DOM. */
    setTimeout(() => el.remove(), 780);
    try { sessionStorage.setItem('nc-intro', '1'); } catch (e) { /* private mode */ }
  };

  if (seen || reduced) { el.remove(); return; }

  /* 1250ms: the bar finishes at 1020 and the eye needs a beat on a completed
     state, otherwise the loader reads as having been interrupted. The shutters
     then take 720ms to part, so the plate is fully gone by ~2s. */
  const timer = setTimeout(done, 1250);
  el.addEventListener('click', () => { clearTimeout(timer); done(); });

  /* A tab restored from the back/forward cache re-runs none of this, and a
     loader frozen over the page is worse than no loader. */
  window.addEventListener('pageshow', (e) => { if (e.persisted) { clearTimeout(timer); done(); } });
}
