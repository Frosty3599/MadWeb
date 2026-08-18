/* ───────────────────────────────────────────────────────────────────────────
   Hero — pinned dark-room reveal.

   The page opens almost black with only the case's edge-glow showing, and the
   first screen of scroll raises the exposure: the glowing shot crossfades to
   the lit one while the headline resolves.

   Not the default. It costs the visitor their first screen to a gesture, which
   is a real trade — kept built and one attribute away because the plan asked
   for it to be ready if the constellation does not land.
   ─────────────────────────────────────────────────────────────────────────── */

import { reduced, canPin, gsap, ScrollTrigger } from './motion.js';

export function mount() {
  document.documentElement.dataset.hero = 'darkroom';

  const hero = document.querySelector('.hero');
  const frame = document.querySelector('[data-hero-frame]');
  const img = frame?.querySelector('img');
  const copy = document.querySelector('.hero__copy');
  if (!hero || !img || !copy) return;

  /* Without pinning there is no reveal to scrub, so the section simply shows
     its finished state. The content is identical either way. */
  if (reduced || !canPin || !gsap) {
    img.src = 'assets/images/glow-off.jpg';
    return;
  }

  img.src = 'assets/images/glow-on.jpg';

  const lit = new Image();
  lit.src = 'assets/images/glow-off.jpg';

  const tl = gsap.timeline({
    scrollTrigger: {
      trigger: hero,
      start: 'top top',
      end: '+=100%',
      pin: true,
      scrub: 0.6,
      anticipatePin: 1,
    },
  });

  gsap.set(copy, { opacity: 0.06 });
  gsap.set(frame, { filter: 'brightness(0.35)' });

  tl.to(frame, { filter: 'brightness(1)', ease: 'none' }, 0)
    .to(copy, { opacity: 1, ease: 'none' }, 0.15)
    .add(() => { img.src = lit.src; }, 0.72);
}
