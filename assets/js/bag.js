/* ───────────────────────────────────────────────────────────────────────────
   Bag, email gate and checkout.

   The gate is not a paywall on browsing: the whole page is readable without an
   address. What an address buys is the launch price — masked as $—— until it
   is given, then rolled down to the real figure and remembered.

   Nothing here is authentication. With no backend there is nobody to verify an
   address against; treat it as "where should we send this", never as proof of
   who someone is.
   ─────────────────────────────────────────────────────────────────────────── */

import { current, COLOURS, FITS, money } from './configurator.js';

const BAG_KEY = 'nc-bag';
const MAIL_KEY = 'nc-email';

const FREE_OVER = 25;
const FLAT_SHIP = 3.99;
const MAX_QTY = 10;

/* Demonstration mode by default: the bag and checkout work end to end, but no
   payment is taken and no card details are collected. Point this at the
   deployed function to go live — the server prices the order from its own
   catalogue, so this constant is the only change needed here. */
const PAYMENTS = { endpoint: null };   // e.g. '/api/create-checkout-session'

let bag = load();
let pendingAdd = false;   // an add that is waiting on the gate

export function mount() {
  document.querySelectorAll('[data-add]').forEach((b) => b.addEventListener('click', requestAdd));
  document.querySelector('[data-bag-open]')?.addEventListener('click', () => openDrawer(true));
  document.querySelectorAll('[data-drawer-close]').forEach((b) => b.addEventListener('click', () => openDrawer(false)));
  document.querySelector('[data-checkout]')?.addEventListener('click', checkout);

  gate();
  paint();

  if (readEmail()) showAccount(readEmail());

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && document.querySelector('[data-drawer]')?.classList.contains('is-open')) {
      openDrawer(false);
    }
  });
}


/* ── The gate ────────────────────────────────────────────────────────────── */

function gate() {
  const dialog = document.querySelector('[data-gate]');
  const form = document.querySelector('[data-gate-form]');
  const input = document.querySelector('[data-gate-input]');
  const error = document.querySelector('[data-gate-error]');
  if (!dialog || !form || !input) return;

  document.querySelector('[data-gate-cancel]')?.addEventListener('click', () => {
    pendingAdd = false;
    dialog.close();
  });

  form.addEventListener('submit', (e) => {
    const value = input.value.trim();
    if (!isEmail(value)) {
      e.preventDefault();
      if (error) error.hidden = false;
      input.setAttribute('aria-invalid', 'true');
      input.focus();
      return;
    }
    if (error) error.hidden = true;
    input.removeAttribute('aria-invalid');

    try { localStorage.setItem(MAIL_KEY, value); } catch (err) { /* private mode */ }
    document.documentElement.dataset.unlocked = 'true';
    showAccount(value);

    if (pendingAdd) { pendingAdd = false; add(); }
    toast('Email saved');
  });
}

function openGate() {
  const dialog = document.querySelector('[data-gate]');
  if (!dialog) { add(); return; }         // no gate in the DOM: never block a sale
  pendingAdd = true;
  if (typeof dialog.showModal === 'function') dialog.showModal();
  else dialog.setAttribute('open', '');
  document.querySelector('[data-gate-input]')?.focus();
}

function isEmail(v) {
  /* Deliberately loose. Anything stricter rejects real addresses, and there is
     no verification behind this anyway. */
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
}

function readEmail() {
  try { return localStorage.getItem(MAIL_KEY); } catch (e) { return null; }
}

function showAccount(value) {
  const el = document.querySelector('[data-account]');
  if (!el) return;
  el.hidden = false;
  el.textContent = value;
}


/* ── The bag ─────────────────────────────────────────────────────────────── */

function requestAdd() {
  if (!readEmail()) { openGate(); return; }
  add();
}

function add() {
  const { colour, fit } = current();
  const line = bag.find((l) => l.colour === colour && l.fit === fit);

  if (line) line.qty = Math.min(MAX_QTY, line.qty + 1);
  else bag.push({ colour, fit, qty: 1 });

  save();
  paint();
  openDrawer(true);
  toast('Added to bag');
}

function setQty(index, delta) {
  const line = bag[index];
  if (!line) return;
  line.qty += delta;
  if (line.qty < 1) bag.splice(index, 1);
  else line.qty = Math.min(MAX_QTY, line.qty);
  save();
  paint();
}

function priceOf(line) {
  return (FITS[line.fit]?.price ?? 0) * line.qty;
}

function totals() {
  const sub = bag.reduce((n, l) => n + priceOf(l), 0);
  const ship = bag.length === 0 ? 0 : (sub >= FREE_OVER ? 0 : FLAT_SHIP);
  return { sub, ship, total: sub + ship };
}

function paint() {
  const count = bag.reduce((n, l) => n + l.qty, 0);
  document.querySelectorAll('[data-bag-count]').forEach((el) => { el.textContent = String(count); });

  const list = document.querySelector('[data-bag-list]');
  if (list) {
    list.innerHTML = '';
    if (!bag.length) {
      const p = document.createElement('p');
      p.className = 'drawer__empty';
      p.textContent = 'Nothing in the bag yet.';
      list.appendChild(p);
    } else {
      bag.forEach((line, i) => list.appendChild(lineEl(line, i)));
    }
  }

  const { sub, ship, total } = totals();
  setText('[data-sum-sub]', money(sub));
  setText('[data-sum-ship]', bag.length === 0 ? '—' : (ship === 0 ? 'Free' : money(ship)));
  setText('[data-sum-total]', money(total));

  const pay = document.querySelector('[data-checkout]');
  if (pay) {
    pay.disabled = bag.length === 0;
    pay.textContent = PAYMENTS.endpoint ? 'Pay with card' : 'Place order';
  }
  const note = document.querySelector('[data-checkout-note]');
  if (note) {
    note.textContent = PAYMENTS.endpoint
      ? 'Secure checkout — prices are set by the server.'
      : 'Demonstration mode — no payment is taken.';
  }
}

function lineEl(line, i) {
  const el = document.createElement('div');
  el.className = 'line';

  const name = document.createElement('span');
  name.className = 'line__name';
  name.textContent = FITS[line.fit]?.name ?? line.fit;

  const price = document.createElement('span');
  price.className = 'line__price';
  price.textContent = money(priceOf(line));

  const meta = document.createElement('span');
  meta.className = 'line__meta';
  meta.textContent = COLOURS[line.colour] ?? line.colour;

  const qty = document.createElement('span');
  qty.className = 'qty';

  const less = document.createElement('button');
  less.type = 'button';
  less.textContent = '−';
  less.setAttribute('aria-label', `Remove one ${name.textContent}`);
  less.addEventListener('click', () => setQty(i, -1));

  const out = document.createElement('output');
  out.textContent = String(line.qty);

  const more = document.createElement('button');
  more.type = 'button';
  more.textContent = '+';
  more.setAttribute('aria-label', `Add one ${name.textContent}`);
  more.disabled = line.qty >= MAX_QTY;
  more.addEventListener('click', () => setQty(i, 1));

  qty.append(less, out, more);
  el.append(name, price, meta, qty);
  return el;
}


/* ── Drawer ──────────────────────────────────────────────────────────────── */

let lastFocus = null;

function openDrawer(open) {
  const drawer = document.querySelector('[data-drawer]');
  if (!drawer) return;

  if (open) {
    lastFocus = document.activeElement;
    drawer.hidden = false;
    /* One frame between unhiding and adding the class, or the panel is already
       in place when the transition starts and simply appears. */
    requestAnimationFrame(() => drawer.classList.add('is-open'));
    trapFocus(drawer.querySelector('.drawer__panel'));
    drawer.querySelector('.drawer__x')?.focus();
  } else {
    drawer.classList.remove('is-open');
    releaseTrap();
    lastFocus?.focus();
    /* Wait out the slide before pulling it from the accessibility tree. */
    setTimeout(() => { if (!drawer.classList.contains('is-open')) drawer.hidden = true; }, 520);
  }
}

let trapHandler = null;

function trapFocus(panel) {
  if (!panel) return;
  trapHandler = (e) => {
    if (e.key !== 'Tab') return;
    const focusable = [...panel.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')]
      .filter((el) => !el.disabled && el.offsetParent !== null);
    if (!focusable.length) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };
  document.addEventListener('keydown', trapHandler);
}

function releaseTrap() {
  if (trapHandler) document.removeEventListener('keydown', trapHandler);
  trapHandler = null;
}


/* ── Checkout ────────────────────────────────────────────────────────────── */

async function checkout() {
  if (!bag.length) return;

  if (!PAYMENTS.endpoint) {
    const ref = 'NC-' + Math.random().toString(36).slice(2, 8).toUpperCase();
    bag = [];
    save();
    paint();
    openDrawer(false);
    toast(`Demo order ${ref} confirmed`);
    return;
  }

  const button = document.querySelector('[data-checkout]');
  if (button) { button.disabled = true; button.textContent = 'Redirecting…'; }

  try {
    /* Only the shape of the order crosses the wire. Prices live in the
       function's own catalogue, so a tampered client cannot invent a
       cheaper case. */
    const res = await fetch(PAYMENTS.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: readEmail(),
        items: bag.map((l) => ({ fit: l.fit, colour: l.colour, qty: l.qty })),
      }),
    });
    const data = await res.json();
    if (data.url) { window.location.href = data.url; return; }
    throw new Error('no session url');
  } catch (err) {
    toast('Checkout is unavailable right now');
    if (button) { button.disabled = false; }
    paint();
  }
}


/* ── Storage and chrome ──────────────────────────────────────────────────── */

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(BAG_KEY) || '[]');
    return Array.isArray(raw)
      ? raw.filter((l) => l && typeof l.fit === 'string' && typeof l.colour === 'string')
           .map((l) => ({ ...l, qty: Math.min(MAX_QTY, Math.max(1, parseInt(l.qty, 10) || 1)) }))
      : [];
  } catch (e) { return []; }
}

function save() {
  try { localStorage.setItem(BAG_KEY, JSON.stringify(bag)); } catch (e) { /* private mode */ }
}

function setText(sel, value) {
  document.querySelectorAll(sel).forEach((el) => { el.textContent = value; });
}

let toastTimer = 0;
function toast(message) {
  const el = document.querySelector('[data-toast]');
  if (!el) return;
  el.textContent = message;
  el.classList.add('is-on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('is-on'), 2600);
}
