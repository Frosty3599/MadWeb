/* ───────────────────────────────────────────────────────────────────────────
   The configurator — colourway, fit, price, and the three live spec rows.

   All product truth for the browser lives in the markup's data- attributes,
   read once here. The server's own catalogue is what a customer is actually
   charged; these figures exist to be looked at, never to be trusted.
   ─────────────────────────────────────────────────────────────────────────── */

import { countTo, reduced } from './motion.js';

export const COLOURS = {
  'forest-green': 'Forest Green',
  'amber-red': 'Amber Red',
  'midnight-blue': 'Midnight Blue',
};

/* Populated from the fit buttons so a price only ever appears in one place in
   the source — the markup the shopper reads. */
export const FITS = {};

const root = document.documentElement;
const listeners = new Set();

export function onChange(fn) { listeners.add(fn); }
function emit() { listeners.forEach((fn) => fn(current())); }

export function current() {
  const fit = FITS[root.dataset.fit] || Object.values(FITS)[0];
  return {
    colour: root.dataset.colour,
    colourName: COLOURS[root.dataset.colour],
    fit: root.dataset.fit,
    fitName: fit?.name,
    price: fit?.price ?? 0,
    was: fit?.was ?? 0,
    unlocked: root.dataset.unlocked === 'true',
  };
}

export function mount() {
  const cwButtons = [...document.querySelectorAll('[data-cw]')];
  /* [data-fit-btn], not [data-fit]: <html> carries data-fit as the current
     state, so a bare [data-fit] selector matches the document element too and
     the first "fit button" in the list is the whole page. */
  const fitButtons = [...document.querySelectorAll('[data-fit-btn]')];

  fitButtons.forEach((b) => {
    FITS[b.dataset.fitBtn] = {
      key: b.dataset.fitBtn,
      name: b.dataset.name,
      price: parseFloat(b.dataset.price),
      was: parseFloat(b.dataset.was),
      dims: b.dataset.dims,
      weight: b.dataset.weight,
    };
  });

  setColour(root.dataset.colour, cwButtons, { silent: true });
  setFit(root.dataset.fit, fitButtons, { silent: true });

  cwButtons.forEach((b) => b.addEventListener('click', () => setColour(b.dataset.cw, cwButtons)));
  fitButtons.forEach((b) => b.addEventListener('click', () => setFit(b.dataset.fitBtn, fitButtons)));

  arrowKeys(cwButtons, (b) => setColour(b.dataset.cw, cwButtons));
  arrowKeys(fitButtons, (b) => setFit(b.dataset.fitBtn, fitButtons));

  /* Unlocking the price is the bag's business, but the odometer is ours. */
  new MutationObserver(() => paintPrice())
    .observe(root, { attributes: true, attributeFilter: ['data-unlocked'] });

  emit();
}


function setColour(key, buttons, { silent = false } = {}) {
  if (!COLOURS[key]) key = 'midnight-blue';
  root.dataset.colour = key;
  try { localStorage.setItem('nc-colour', key); } catch (e) { /* private mode */ }

  buttons.forEach((b) => b.setAttribute('aria-checked', String(b.dataset.cw === key)));
  document.querySelectorAll('[data-ticket-colour]').forEach((el) => { el.textContent = COLOURS[key]; });

  if (!silent) emit();
}


function setFit(key, buttons, { silent = false } = {}) {
  const fit = FITS[key] || Object.values(FITS)[0];
  if (!fit) return;
  root.dataset.fit = fit.key;

  buttons.forEach((b) => b.setAttribute('aria-checked', String(b.dataset.fitBtn === fit.key)));

  document.querySelectorAll('[data-ticket-fit]').forEach((el) => { el.textContent = fit.name; });
  setText('[data-spec-fit]', fit.name);
  setText('[data-spec-dims]', fit.dims);
  setText('[data-spec-weight]', fit.weight);
  setText('[data-was-price]', money(fit.was));

  paintPrice();
  if (!silent) emit();
}


/* Before an email is on file the launch price is masked rather than hidden:
   the shopper can see there is a number and see it is lower, which is the
   whole incentive. Once unlocked it rolls down instead of snapping. */
function paintPrice() {
  const fit = FITS[root.dataset.fit];
  if (!fit) return;
  const unlocked = root.dataset.unlocked === 'true';

  document.querySelectorAll('[data-odometer]').forEach((el) => {
    /* Masked, not hidden: the shopper can see there is a lower number and
       that it has the shape of a price. Same character count as the real
       figure, so nothing shifts when it resolves. */
    if (!unlocked) { el.textContent = '$--.--'; return; }

    const from = parseFloat(String(el.textContent).replace(/[^0-9.]/g, ''));
    if (!Number.isFinite(from)) {
      /* Coming straight off the mask, roll down from the list price so the
         discount is something the eye watches happen. */
      el.textContent = money(fit.was);
      if (reduced) { el.textContent = money(fit.price); return; }
    }
    countTo(el, fit.price, { decimals: 2, prefix: '$', duration: 0.75 });
  });
}


function arrowKeys(buttons, pick) {
  buttons.forEach((btn, i) => {
    btn.addEventListener('keydown', (e) => {
      const step = (e.key === 'ArrowRight' || e.key === 'ArrowDown') ? 1
                 : (e.key === 'ArrowLeft' || e.key === 'ArrowUp') ? -1 : 0;
      if (!step) return;
      e.preventDefault();
      const next = buttons[(i + step + buttons.length) % buttons.length];
      next.focus();
      pick(next);
    });
  });
}

function setText(sel, value) {
  document.querySelectorAll(sel).forEach((el) => { el.textContent = value; });
}

export function money(n) {
  return '$' + Number(n).toFixed(2);
}
