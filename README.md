# NovaCase NC·01 — Glow Edition

A single-product storefront for the NovaCase quicksand glow-in-the-dark AirPods case.
Static HTML, CSS and JavaScript with two vendored libraries. No build step, no framework.

**Open `index.html` in a browser**, or serve the folder:

```
python3 -m http.server 8000
```

```
index.html                       markup and copy, one page
assets/css/tokens.css            palette, type scale, spacing, easing — every value the rest uses
assets/css/base.css              reset, typography, frames, buttons, nav, footer
assets/css/sections.css          one block per section, in page order
assets/css/fonts.css             Inter Variable, JetBrains Mono, Instrument Serif Italic
assets/js/main.js                entry — boots motion, picks a hero, mounts the modules
assets/js/motion.js              Lenis + ScrollTrigger, reduced-motion switch, shared primitives
assets/js/hero-*.js              three interchangeable hero devices
assets/js/theme.js               the lamp, and the page-wide crossfade it fires
assets/js/configurator.js        colourways, fits, price odometer, live spec rows
assets/js/bag.js                 email gate, price unlock, drawer, Stripe handoff
assets/js/sections.js            section registry — order, nav links, per-section motion
assets/js/vendor/                GSAP 3.12.5, ScrollTrigger, Lenis 1.1.18 — pinned, not from a CDN
api/create-checkout-session.js   Stripe Checkout session, server-side pricing
```

## What's interactive

- **The lamp** (in the nav and in the glow section, kept in sync) flips the whole page between
  lights-off and lights-on, crossfades every product shot at once, and sends a wavefront out from
  whichever switch you actually pressed. The choice persists; **the first visit is always dark**,
  whatever the OS prefers, because the product only exists in the dark.
- **Three colourways** move `--tone` across the entire page and re-tint a fifth of the hero
  particles.
- **Four fits** drive the price odometer, the ticket, the closing summary and the three live rows
  in the specification table.
- **The email gate.** Every price shows the list figure struck through with the launch price masked
  as `$--.--`. The first *Add to bag* asks for an address; giving one rolls every masked price down
  to its real figure and remembers it. Browsing is never blocked — only the price reveal and
  checkout.
- **A real bag** — slide-out drawer, quantity steppers capped at 10, free shipping over $25 else
  $3.99 flat, focus-trapped, Esc to close, surviving a reload.

| Fit | Launch | List |
|---|---|---|
| AirPods 1 & 2 | $15.99 | $25.99 |
| AirPods Pro 1 & 2 | $19.99 | $29.99 |
| AirPods 3 | $16.99 | $26.99 |
| AirPods 4 | $17.99 | $27.99 |

## Motion

Four primitives in `motion.js` — `reveal`, `splitLines`, `scrub`, `countTo` — and one shared set of
easing tokens, so nothing on the page moves to its own private curve. Entrances decelerate;
reversible states use the same curve in both directions; only the scroll-driven timelines are
linear, because there the easing is the reader's own scrolling.

Each section gets **one** choreographed gesture rather than animating everything at once: the
constellation, the switch, the colourway retint, the exploding cross-section, the drawing decay
curve, the price roll, the spec cascade.

Everything collapses under `prefers-reduced-motion: reduce` — the poster hero replaces the
constellation, nothing pins, Lenis is never constructed, and the page is fully visible and usable.

### Swapping the hero

Three hero devices are built. Change one attribute on `<html>`:

```html
<html data-hero="constellation">   <!-- default: particles sampled from the case cut-out -->
<html data-hero="poster">          <!-- type and product interlocked, no pinning -->
<html data-hero="darkroom">        <!-- pinned: the room lights come up as you scroll -->
```

The page falls back to `poster` on its own under reduced motion, on a coarse pointer below 640px,
on two cores or fewer, and if the constellation cannot read its source image.

### Removing or reordering a section

Delete the `<section>` from `index.html`. Its motion, its logic and its nav link go with it —
`sections.js` registers by id and every module queries null-safely, so nothing else needs editing.
Reordering is just moving the block.

## Photographs

Every shot sits in an identical **420 × 420** frame, `object-fit: contain`, with the same padding,
bloom and caption position in every section — which is what makes five source files of five
different shapes line up. Nothing is ever displayed above its native size.

Any file that is missing is replaced in place by a tile drawn in that colourway's own tones, at
exactly the frame's size, so the layout is complete and **nothing shifts when the real file lands**.

| Path | What it shows | Target size |
|---|---|---|
| `assets/images/forest-green.jpg` | Forest Green colourway, lit | 840×840 |
| `assets/images/amber-red.jpg` | Amber Red colourway, lit | 840×840 |
| `assets/images/midnight-blue.jpg` | Midnight Blue colourway, lit | 840×840 |
| `assets/images/glow-off.jpg` | The case in a **lit** room — the lights-on state | 840×840 |
| `assets/images/glow-on.jpg` | The case **glowing in the dark** — the lights-off state | 840×840 |
| `assets/images/hero-case.webp` | Cut-out case on transparency — the particle source | 1000×1000 |

The last two are named for the glow, not the room: `glow-on.jpg` is the shot where the case is
burning cyan.

**To add or replace one:** put the file in `assets/images/` under exactly the filename above and
reload. There is no code to change. Square or near-square, 840px or larger (they render at 420, so
2× keeps them crisp), JPEG under ~200 KB — or WebP/PNG with a real alpha channel for `hero-case`,
which the constellation samples for its silhouette.

Everything else on the page is hand-drawn vector and needs no upload: the four-layer cross-section,
the decay curve, the feature icons, the wordmark, the favicon and the Open Graph card.

## Weight

Measured on the built page, gzipped as a real host would serve it:

| | |
|---|---|
| HTML, CSS and JS (incl. GSAP + Lenis) | 88 KB |
| Fonts, three faces | 110 KB |
| Photographs | 205 KB |
| **Initial view** | **404 KB** |
| 360° video, loaded only when the spec section is reached | 138 KB |
| **Whole page** | **543 KB** |

First contentful paint 140 ms locally; no long tasks over 50 ms while scrolling the pinned sections.

## Turning on Stripe

The storefront ships in **demonstration mode**: the bag and checkout work end to end, but no payment
is taken and no card details are collected.

Stripe cannot be driven from a static page — a secret key in the browser is a secret given away — so
payment goes through one small server function that prices the bag, creates a Checkout Session and
returns a URL to redirect to. The page itself stays static and holds no key.

1. **Deploy the function.** `api/create-checkout-session.js` is a standard Node serverless handler.
   On Vercel the path works as-is. On Netlify move it to
   `netlify/functions/create-checkout-session.js`. Run `npm install` so `stripe` is available.

2. **Set two environment variables:** `STRIPE_SECRET_KEY` (`sk_test_…` or `sk_live_…`) and
   `SITE_URL` (`https://your-domain.example`, used for the return links).

3. **Point the page at it.** In `assets/js/bag.js`:

   ```js
   const PAYMENTS = { endpoint: '/api/create-checkout-session' };
   ```

   The button changes from "Place order" to "Pay with card" on its own.

4. **Test** with Stripe's `4242 4242 4242 4242`, any future expiry, any CVC.

GitHub Pages will serve everything here except that function, so checkout stays in demonstration
mode there permanently.

### What the server decides, not the browser

The page sends only a fit key, a colourway and a quantity. Prices live in the function's own
`CATALOGUE` and nowhere else, so a tampered client cannot invent a cheaper case. Quantities are
bounded, unknown fits and colourways are rejected, and Stripe errors are logged server-side rather
than returned to the browser.

Change a price in **both** places: the `data-price` attribute in `index.html` (what the shopper
sees) and `CATALOGUE` in the function (what they are charged). They are deliberately separate — the
browser's copy is never trusted.

## About the email

Pressing **Add to bag** asks for an address before the first item goes in. It is stored in
`localStorage`, shown in the nav, prefilled into checkout and passed to Stripe so the receipt lands
in the right place.

This is identity capture, **not authentication**. With no backend there is nobody to verify the
address against, and no password or magic link is involved. Treat it as "where should we email
this", never as proof of who someone is. Real accounts need a backend and a session store.

---

## ⚠ Before this page sells anything

Several things here are drafted, not verified. Each is marked `TODO` in the source.

- **Every specification figure** — 1.8 mm wall, 505 nm peak, 1.5 m drop rating, weights and
  dimensions per fit. These were drafted to give the table real shape. Check them against the actual
  product.
- **The ten-minutes-to-six-hours claim** that section 04 is built around.
- **FAQ answers, shipping and returns copy** — realistic drafts, not commitments you have made.
- **Contact address and social links** in the footer are `TODO` tokens, not real accounts.
- **The reviews section is switched off** and its quotes are labelled sample copy. Publishing
  invented reviews is dishonest and, in most jurisdictions, unlawful. Replace them with real ones,
  then set `data-reviews="on"` on `<html>`.
