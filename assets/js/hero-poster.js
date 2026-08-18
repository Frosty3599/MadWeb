/* ───────────────────────────────────────────────────────────────────────────
   Hero — poster interlock.

   Type and product on the same plane: the shot overlaps the headline rather
   than sitting politely beside it. This is also the fallback the page lands
   on under reduced motion, on low-power devices, and if the constellation
   cannot read its source image — so it has to be complete on its own, with no
   motion at all.
   ─────────────────────────────────────────────────────────────────────────── */

import { reduced, gsap } from './motion.js';

export function mount() {
  document.documentElement.dataset.hero = 'poster';

  const frame = document.querySelector('[data-hero-frame]');
  if (!frame || reduced || !gsap) return;

  /* The shot settles a beat after the headline lines have risen, so the eye
     reads the words first and the product second. */
  gsap.from(frame, {
    scale: 0.93,
    opacity: 0,
    duration: 1.05,
    delay: 0.22,
    ease: 'power3.out',
  });

  /* A slow breathe on the bloom — the only looping animation on the page.
     4.6s rather than a round 4 or 5: at exactly five seconds it syncs with
     the eye and starts to read as a pulse rather than a glow. */
  gsap.to(frame, {
    '--bloom-scale': 1.06,
    duration: 4.6,
    repeat: -1,
    yoyo: true,
    ease: 'sine.inOut',
  });
}
