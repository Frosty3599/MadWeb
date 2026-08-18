/* ───────────────────────────────────────────────────────────────────────────
   Hero — particle constellation (default).

   Points are sampled from the alpha channel of the real product cut-out, so
   the silhouette is the actual case rather than a shape someone drew to look
   like one. They arrive scattered, converge, then drift.

   Falls back to the poster hero if the image cannot be read — a hero that
   renders nothing is worse than a hero that renders differently.
   ─────────────────────────────────────────────────────────────────────────── */

import { reduced } from './motion.js';

const CONVERGE_MS = 1800;
const SRC = 'assets/images/hero-case.webp';

export function mount({ onFallback }) {
  const canvas = document.querySelector('[data-hero-canvas]');
  const stage = document.querySelector('[data-hero-stage]');
  if (!canvas || !stage) return;

  const ctx = canvas.getContext('2d', { alpha: true });
  const img = new Image();
  img.decoding = 'async';

  img.onerror = () => onFallback?.();
  img.onload = () => {
    let points;
    try {
      points = samplePoints(img);
    } catch (err) {
      /* A cross-origin or otherwise tainted canvas throws on getImageData.
         Nothing to recover from — hand the hero to the poster module. */
      onFallback?.();
      return;
    }
    /* No outline means no silhouette worth drawing — hand it to the poster. */
    if (!points.edges.length) { onFallback?.(); return; }
    run(canvas, ctx, stage, points);
  };

  img.src = SRC;
}


/* Read the cut-out at low resolution and sort its opaque pixels into edge and
   interior.

   Sampling the fill evenly was the first attempt and it produced a blob: a
   rounded rectangle filled with uniform noise reads as an oval, and the thing
   that makes the case recognisable — the hinge line, the lid curve, the ball
   chain — lives entirely on its boundary. So every edge pixel is kept and the
   interior is thinned to a haze behind it. */
function samplePoints(img) {
  const W = 240;
  const H = Math.round((img.naturalHeight / img.naturalWidth) * W);

  const off = document.createElement('canvas');
  off.width = W;
  off.height = H;
  const octx = off.getContext('2d', { willReadFrequently: true });
  octx.drawImage(img, 0, 0, W, H);

  const { data } = octx.getImageData(0, 0, W, H);
  const at = (x, y) => (y * W + x) * 4;
  const alphaAt = (x, y) => (x < 0 || y < 0 || x >= W || y >= H) ? 0 : data[at(x, y) + 3];
  const lumaAt = (x, y) => {
    if (x < 0 || y < 0 || x >= W || y >= H) return 0;
    const i = at(x, y);
    return data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
  };

  const edges = [];   // the silhouette
  const detail = [];  // internal contrast: the hinge seam, the lid curve
  const fill = [];    // faint interior haze

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (alphaAt(x, y) <= 130) continue;

      /* An opaque pixel with a transparent neighbour is on the silhouette.
         Four-way rather than eight — diagonals only thicken the outline. */
      const onEdge = alphaAt(x - 1, y) <= 130 || alphaAt(x + 1, y) <= 130
                  || alphaAt(x, y - 1) <= 130 || alphaAt(x, y + 1) <= 130;

      if (onEdge) { edges.push({ nx: x / W, ny: y / H, kind: 2 }); continue; }

      /* The outline alone renders a hollow bean. What makes it read as this
         product rather than any rounded rectangle is the hinge line and the
         lid seam, and those are luminance boundaries inside the silhouette,
         invisible to an alpha test. 26 is where the seam registers without
         the whole glossy top of the shell lighting up. */
      const gx = Math.abs(lumaAt(x + 1, y) - lumaAt(x - 1, y));
      const gy = Math.abs(lumaAt(x, y + 1) - lumaAt(x, y - 1));
      if (gx + gy > 26) detail.push({ nx: x / W, ny: y / H, kind: 1 });
      else if ((x % 3 === 0) && (y % 3 === 0)) fill.push({ nx: x / W, ny: y / H, kind: 0 });
    }
  }

  shuffle(edges);
  shuffle(detail);
  shuffle(fill);

  /* Outline first so the cap can never eat it, then the internal detail, then
     whatever haze the budget still allows. */
  return { edges, detail, fill, ratio: H / W };
}

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    [a[i], a[j]] = [a[j], a[i]];
  }
}


function run(canvas, ctx, stage, sampled) {
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  const budget = coarse ? 900 : 2600;

  /* Half outline, a third internal detail, the rest haze. Spend the budget
     where recognition lives. */
  const take = (arr, n) => arr.slice(0, Math.max(0, Math.round(n)));
  const chosen = [
    ...take(sampled.edges, budget * 0.5),
    ...take(sampled.detail, budget * 0.32),
    ...take(sampled.fill, budget * 0.18),
  ];

  const pts = chosen.map((p) => ({
    nx: p.nx,
    ny: p.ny,
    kind: p.kind,
    x: 0, y: 0,
    sx: 0, sy: 0,
    phase: Math.random() * Math.PI * 2,
    /* Outline points barely drift — the silhouette has to hold still enough to
       stay readable. Haze is free to wander. */
    drift: p.kind === 2 ? 0.22 + Math.random() * 0.3
         : p.kind === 1 ? 0.4 + Math.random() * 0.5
         : 0.7 + Math.random() * 1.1,
    /* A fifth of the field carries the colourway instead of the fixed cyan,
       so switching colourway visibly reaches the hero. */
    toned: Math.random() < 0.2,
    r: p.kind === 2 ? 0.9 + Math.random() * 0.5 : 0.55 + Math.random() * 0.45,
  }));
  const ratio = sampled.ratio || 1;
  const ALPHA = [0.32, 0.6, 0.95];   // haze, detail, outline

  let dpr = 1, w = 0, h = 0, box = null;
  const pointer = { x: -9999, y: -9999 };
  let started = 0;
  let raf = 0;
  let visible = true;
  let dispersal = 0;   // 0 at rest, 1 fully scattered upward by scroll

  function resize() {
    const rect = stage.getBoundingClientRect();
    w = rect.width;
    h = rect.height;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    /* Fit the silhouette inside the stage at its true aspect — squashing a
       case into a square is exactly the kind of thing nobody can name but
       everybody notices. */
    let bw = w * 0.94;
    let bh = bw * ratio;
    if (bh > h * 0.94) { bh = h * 0.94; bw = bh / ratio; }
    box = { x: (w - bw) / 2, y: (h - bh) / 2, w: bw, h: bh };

    pts.forEach((p) => {
      p.x = box.x + p.nx * box.w;
      p.y = box.y + p.ny * box.h;
      if (!p.sx) {
        /* Scatter origin: anywhere in the stage, biased outward so the
           convergence reads as a gathering rather than a settle. */
        const a = Math.random() * Math.PI * 2;
        const d = 0.55 + Math.random() * 0.75;
        p.sx = w / 2 + Math.cos(a) * w * d;
        p.sy = h / 2 + Math.sin(a) * h * d;
      }
    });
  }

  function colours() {
    const cs = getComputedStyle(document.documentElement);
    return {
      accent: cs.getPropertyValue('--accent').trim() || '#4fe8ff',
      tone: cs.getPropertyValue('--tone').trim() || '#4fcdf2',
    };
  }
  let palette = colours();

  function frame(now) {
    raf = requestAnimationFrame(frame);
    if (!visible) return;
    if (!started) started = now;

    const t = now - started;
    /* Eased convergence, then ambient drift. Same deceleration curve as every
       entrance elsewhere on the page. */
    const raw = Math.min(1, t / CONVERGE_MS);
    const conv = 1 - Math.pow(1 - raw, 3);

    ctx.clearRect(0, 0, w, h);

    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];

      let hx = p.x;
      let hy = p.y;

      if (conv < 1) {
        hx = p.sx + (p.x - p.sx) * conv;
        hy = p.sy + (p.y - p.sy) * conv;
      } else {
        const wob = Math.sin(now / 1400 + p.phase) * p.drift;
        hx += wob;
        hy += Math.cos(now / 1700 + p.phase) * p.drift;
      }

      /* Cursor repulsion — a soft push, not a physics simulation. */
      const dx = hx - pointer.x;
      const dy = hy - pointer.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < 12000) {
        const f = (12000 - d2) / 12000;
        hx += dx * f * 0.35;
        hy += dy * f * 0.35;
      }

      if (dispersal > 0) {
        hy -= dispersal * (60 + p.drift * 90);
      }

      ctx.globalAlpha = (conv * (1 - dispersal)) * ALPHA[p.kind];
      ctx.fillStyle = p.toned ? palette.tone : palette.accent;
      ctx.beginPath();
      ctx.arc(hx, hy, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  resize();
  window.addEventListener('resize', resize);

  /* Repaint the palette cache whenever the colourway or theme moves. */
  new MutationObserver(() => { palette = colours(); })
    .observe(document.documentElement, { attributes: true, attributeFilter: ['data-colour', 'data-theme'] });

  if (!coarse) {
    window.addEventListener('pointermove', (e) => {
      const rect = canvas.getBoundingClientRect();
      pointer.x = e.clientX - rect.left;
      pointer.y = e.clientY - rect.top;
    }, { passive: true });
    window.addEventListener('pointerleave', () => { pointer.x = pointer.y = -9999; });
  }

  /* Scrolling past the hero lifts the field away rather than letting it sit
     there burning frames behind the next section. */
  window.addEventListener('scroll', () => {
    const rect = stage.getBoundingClientRect();
    dispersal = Math.min(1, Math.max(0, -rect.top / Math.max(1, rect.height)));
  }, { passive: true });

  /* Stop entirely when off-screen. */
  new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; }, { threshold: 0 })
    .observe(stage);

  if (reduced) {
    /* Should not be reachable — main.js swaps in the poster hero first — but
       if it ever is, paint one static frame and stop. */
    frame(performance.now() + CONVERGE_MS);
    cancelAnimationFrame(raf);
    return;
  }

  raf = requestAnimationFrame(frame);
}
