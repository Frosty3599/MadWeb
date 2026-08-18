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

/* The feel of the field, in four numbers. Tuned together — raising PUSH
   without raising DAMP throws points off screen and they never come back.
   SPRING 0.010 gives a return of a little under a second, slow enough that you
   can see the field breathe back into shape. */
const SPRING = 0.015;   /* pull toward home — recovers in a little over half a second */
const DAMP = 0.90;      /* velocity retained per frame */
const PUSH = 1.0;       /* cursor repulsion at the centre of its radius */
const RADIUS = 108;     /* px of influence */
const RADIUS2 = RADIUS * RADIUS;

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
    hx: 0, hy: 0,      /* home — where this point belongs in the silhouette */
    x: 0, y: 0,        /* actual position, which physics moves */
    vx: 0, vy: 0,      /* velocity, which is what makes it feel like matter */
    sx: 0, sy: 0,      /* where it starts, before it converges */
    phase: Math.random() * Math.PI * 2,
    /* Outline points barely drift — the silhouette has to hold still enough to
       stay readable. Haze is free to wander. */
    drift: p.kind === 2 ? 0.22 + Math.random() * 0.3
         : p.kind === 1 ? 0.4 + Math.random() * 0.5
         : 0.7 + Math.random() * 1.1,
    /* Lighter points get flung further by the same push, which is what stops
       the field moving as one sheet. */
    mass: p.kind === 2 ? 1.35 : p.kind === 1 ? 1 : 0.72,
    /* A fifth of the field carries the colourway instead of the fixed cyan,
       so switching colourway visibly reaches the hero. */
    toned: Math.random() < 0.2,
    r: p.kind === 2 ? 1.5 + Math.random() * 0.7 : 1.05 + Math.random() * 0.6,
    rot: Math.random() * Math.PI * 2,
    spin: (Math.random() - 0.5) * 0.006,
  }));
  const ratio = sampled.ratio || 1;
  const ALPHA = [0.32, 0.6, 0.95];   // haze, detail, outline

  /* Reused every frame rather than reallocated — 60 allocations a second of a
     2,600-element array is a garbage collector pause you can see. */
  const accentPath = [];
  const tonePath = [];

  let dpr = 1, w = 0, h = 0, box = null;
  const pointer = { x: -9999, y: -9999, px: -9999, py: -9999, vx: 0, vy: 0, live: false };
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
      p.hx = box.x + p.nx * box.w;
      p.hy = box.y + p.ny * box.h;
      if (!p.sx) {
        /* Scatter origin: anywhere in the stage, biased outward so the
           convergence reads as a gathering rather than a settle. */
        const a = Math.random() * Math.PI * 2;
        const d = 0.55 + Math.random() * 0.75;
        p.sx = w / 2 + Math.cos(a) * w * d;
        p.sy = h / 2 + Math.sin(a) * h * d;
        p.x = p.sx;
        p.y = p.sy;
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

    /* The pointer's own velocity, decayed. A slow hover parts the field; a
       fast swipe throws it, and the difference is the whole reason this reads
       as a substance rather than a hover state. */
    pointer.vx *= 0.86;
    pointer.vy *= 0.86;

    /* Two paths, two fills — batching by colour keeps 2,600 triangles at one
       draw call each instead of 2,600, which is what makes per-particle
       physics affordable at all. */
    accentPath.length = 0;
    tonePath.length = 0;

    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];

      /* Home drifts; the particle chases home. Separating the two is what lets
         a point be pushed off its mark and still know where to return. */
      const hx = p.hx + Math.sin(now / 1400 + p.phase) * p.drift;
      const hy = p.hy + Math.cos(now / 1700 + p.phase) * p.drift
               - (dispersal > 0 ? dispersal * (60 + p.drift * 90) : 0);

      if (conv < 1) {
        /* During the gather, position is dictated rather than simulated —
           physics here would fight the choreography. */
        p.x = p.sx + (hx - p.sx) * conv;
        p.y = p.sy + (hy - p.sy) * conv;
      } else {
        /* Spring back toward home. Soft enough that the field takes a moment
           to reassemble — an instant snap looks like a CSS transition, not
           like something with weight. */
        let ax = (hx - p.x) * SPRING;
        let ay = (hy - p.y) * SPRING;

        if (pointer.live) {
          const dx = p.x - pointer.x;
          const dy = p.y - pointer.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < RADIUS2 && d2 > 0.001) {
            const d = Math.sqrt(d2);
            /* Squared falloff: a firm core that fades to nothing at the rim,
               so there is no visible circle edge sweeping the field. */
            const falloff = 1 - d2 / RADIUS2;
            const push = (PUSH * falloff * falloff) / p.mass;
            ax += (dx / d) * push;
            ay += (dy / d) * push;
            /* Drag from the cursor's own motion — the field is carried along
               the direction of travel, not only shoved outward from a point. */
            ax += pointer.vx * falloff * 0.13 / p.mass;
            ay += pointer.vy * falloff * 0.13 / p.mass;
          }
        }

        p.vx = (p.vx + ax) * DAMP;
        p.vy = (p.vy + ay) * DAMP;
        p.x += p.vx;
        p.y += p.vy;

        /* Glyphs turn with their own travel, so a disturbed field visibly
           tumbles instead of sliding. */
        p.rot += p.spin + (p.vx + p.vy) * 0.012;
      }

      (p.toned ? tonePath : accentPath).push(p);
    }

    const alphaScale = conv * (1 - dispersal);
    paint(accentPath, palette.accent, alphaScale);
    paint(tonePath, palette.tone, alphaScale);
    ctx.globalAlpha = 1;
  }

  /* Dala's field is built from small outlined triangles rather than dots.
     Filled here rather than stroked: at this size a 1px outline on a 3px glyph
     is mostly gap, and the shape stops reading as a triangle at all. */
  function paint(list, colour, alphaScale) {
    if (!list.length) return;
    ctx.fillStyle = colour;

    /* Grouped by kind so each opacity tier is still one path, not one per
       particle. */
    for (let kind = 0; kind < 3; kind++) {
      let opened = false;
      for (let i = 0; i < list.length; i++) {
        const p = list[i];
        if (p.kind !== kind) continue;
        if (!opened) { ctx.beginPath(); opened = true; }

        const r = p.r * 1.9;
        const a = p.rot;
        const c1 = Math.cos(a), s1 = Math.sin(a);
        const c2 = Math.cos(a + 2.0944), s2 = Math.sin(a + 2.0944);
        const c3 = Math.cos(a + 4.1888), s3 = Math.sin(a + 4.1888);

        ctx.moveTo(p.x + c1 * r, p.y + s1 * r);
        ctx.lineTo(p.x + c2 * r, p.y + s2 * r);
        ctx.lineTo(p.x + c3 * r, p.y + s3 * r);
      }
      if (opened) {
        ctx.globalAlpha = alphaScale * ALPHA[kind];
        ctx.fill();
      }
    }
  }

  resize();
  window.addEventListener('resize', resize);

  /* Repaint the palette cache whenever the colourway or theme moves. */
  new MutationObserver(() => { palette = colours(); })
    .observe(document.documentElement, { attributes: true, attributeFilter: ['data-colour', 'data-theme'] });

  if (!coarse) {
    window.addEventListener('pointermove', (e) => {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      if (pointer.live) {
        /* Clamped: a pointer jumping in from off-screen reports an enormous
           delta on its first frame and would fire the whole field at once. */
        pointer.vx = Math.max(-40, Math.min(40, x - pointer.px));
        pointer.vy = Math.max(-40, Math.min(40, y - pointer.py));
      }
      pointer.px = x;
      pointer.py = y;
      pointer.x = x;
      pointer.y = y;
      pointer.live = true;
    }, { passive: true });

    /* Leaving releases the field rather than teleporting the influence point
       to a corner and dragging everything with it. */
    window.addEventListener('pointerleave', () => { pointer.live = false; pointer.vx = pointer.vy = 0; });
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
