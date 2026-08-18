/* ───────────────────────────────────────────────────────────────────────────
   The lamp.

   One switch, two copies of it (nav and glow section), kept in sync. Pressing
   either flips the whole page between lights-off and lights-on and crossfades
   every product shot at once — not just the one in the glow section. The
   wavefront leaves from whichever switch was actually pressed, which is the
   detail that makes it feel like a light being turned on rather than a theme
   toggle being clicked.
   ─────────────────────────────────────────────────────────────────────────── */

import { reduced } from './motion.js';

const KEY = 'nc-theme';

/* Both glow shots, keyed by the state they belong to. glow-on is the case
   burning cyan (so: lights off); glow-off is the case in a lit room. The
   filenames describe the product, the states describe the room — worth saying
   out loud, because they read as inverted. */
const SHOTS = {
  dark: 'assets/images/glow-on.jpg',
  lit: 'assets/images/glow-off.jpg',
};

export function mount() {
  const root = document.documentElement;
  const switches = [...document.querySelectorAll('[data-lamp]')];
  const wave = document.querySelector('[data-wavefront]');
  /* Lived in the glow section, which no longer exists. Kept null-safe rather
     than assumed absent: if a glow shot is ever put back on the page under the
     same hooks, the lamp picks it up again with no change here. */
  const cap = document.querySelector('[data-glow-cap]');

  /* Preload the state we are not in, so the crossfade has something to fade
     to on the very first press. */
  const warm = new Image();
  warm.src = SHOTS[root.dataset.theme === 'lit' ? 'dark' : 'lit'];

  function paint() {
    const lit = root.dataset.theme === 'lit';

    switches.forEach((b) => {
      b.setAttribute('aria-pressed', String(lit));
      const text = b.querySelector('[data-lamp-text]');
      if (text) text.textContent = lit ? 'Lights off' : 'Lights on';
      b.setAttribute('aria-label', lit ? 'Turn the lights off' : 'Turn the lights on');
    });

    document.querySelectorAll('[data-shot="glow"]').forEach((img) => {
      img.src = SHOTS[lit ? 'lit' : 'dark'];
      img.alt = lit
        ? 'The case in a lit room, its quicksand shell visible.'
        : 'The case glowing cyan in a dark room.';
    });

    if (cap) cap.textContent = lit ? 'lights on · 14:20' : 'lights off · 03:14';
  }

  function flip(origin) {
    const lit = root.dataset.theme === 'lit';
    root.dataset.theme = lit ? 'dark' : 'lit';
    try { localStorage.setItem(KEY, root.dataset.theme); } catch (e) { /* private mode */ }

    if (wave && origin && !reduced) {
      wave.style.left = `${origin.x}px`;
      wave.style.top = `${origin.y}px`;
      wave.classList.remove('is-firing');
      void wave.offsetWidth;           // restart the animation
      wave.classList.add('is-firing');
    }

    paint();
  }

  switches.forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const rect = btn.getBoundingClientRect();
      flip({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
      /* Keyboard activation reports 0,0 for clientX — the button's own centre
         is the honest origin either way. */
      e.preventDefault();
    });
  });

  paint();
}
