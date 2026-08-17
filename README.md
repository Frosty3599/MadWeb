# NovaCase NC·01 — Glow Edition

A single-product storefront for NovaCase quicksand glow-in-the-dark AirPods cases.
Static HTML, CSS and JavaScript. No build step, no dependencies, no framework.

**Open `index.html` in a browser.** That's the whole setup. It also deploys as-is
to GitHub Pages or any static host.

```
index.html                  markup and copy
api/create-checkout-session.js  Stripe Checkout session (server-side pricing)
assets/css/styles.css       design tokens + every section
assets/css/fonts.css        Anton / Inter / JetBrains Mono, inlined as data URIs
assets/js/main.js           motion engine, configurator, bag + checkout
assets/video/360-airpod.mp4 the 360° spin loop (silent)
assets/images/              product photography — see below
```

## Dropping in the photographs

The five product shots are **not committed yet**. Until they are, every shot
falls back to a CSS-drawn stand-in in that colourway's own tones, so the layout
is complete and nothing shifts.

Commit files with exactly these names and they appear automatically — there is
no code to change:

| File | What it shows |
|---|---|
| `assets/images/forest-green.jpg` | Forest Green colourway |
| `assets/images/amber-red.jpg` | Amber Red colourway |
| `assets/images/midnight-blue.jpg` | Midnight Blue colourway |
| `assets/images/glow-off.jpg` | The case in a **lit** room — lights-on state |
| `assets/images/glow-on.jpg` | The case **glowing in the dark** — lights-off state |

The last two are named for the glow, not the room: `glow-on.jpg` is the shot
where the case is burning cyan.

## What's interactive

- **The lamp switch** (nav and glow section, kept in sync) flips the entire page
  between light and dark *and* crossfades the product between the lit photo and the
  glowing one, with a wavefront that leaves from the switch you pressed. The choice
  persists in `localStorage`; first visit follows the OS `prefers-color-scheme`.
- **Three colourways** — swaps the colourway stage *and the hero shot*, the accent
  colour, and the ambient glow across the whole page.
- **Four fits** — drives an odometer price roll and updates the ticket, the closing
  summary, and the three live rows in the specification table.
- **A real bag and checkout** — "Add to bag" adds the configured item, the nav count
  bumps, quantities step up and down, the summary recomputes subtotal, shipping
  (free over $25, otherwise $3.99) and total, and the order form validates before
  confirming with a reference. The bag survives a reload via `localStorage`.

| Fit | Launch | List |
|---|---|---|
| AirPods 1 & 2 | $15.99 | $25.99 |
| AirPods Pro 1 & 2 | $19.99 | $29.99 |
| AirPods 3 | $16.99 | $26.99 |
| AirPods 4 | $17.99 | $27.99 |

## Motion

Three shared primitives drive everything: one rAF scroll loop that writes
`--page-progress` and `--sec-progress` for CSS to consume, one geometry sweep
that releases reveals, and one text splitter for the line-rise headlines.

Each section gets **one** choreographed gesture rather than animating
everything at once — the hero interlock, the switch, the crossfade, the price
roll, the spec cascade, the counters.

Every animation collapses under `prefers-reduced-motion: reduce`, which leaves
the page fully usable and fully visible.

## Turning on Stripe

The storefront ships in **demonstration mode**: the bag and checkout work
end to end, but no payment is taken and no card details are collected.

Stripe cannot be driven from a static page — a secret key in the browser is a
secret given away. So payment goes through one small server function that
prices the bag, creates a Checkout Session and hands back a URL to redirect
to. The site itself stays static and holds no key.

1. **Deploy the function.** `api/create-checkout-session.js` is a standard
   Node serverless handler. On Vercel the path works as-is. On Netlify move it
   to `netlify/functions/create-checkout-session.js`; on Cloudflare Workers
   wrap it in a `fetch` handler. Run `npm install` so `stripe` is available.

2. **Set two environment variables** on the host:

   | Variable | Value |
   |---|---|
   | `STRIPE_SECRET_KEY` | `sk_test_…` while testing, `sk_live_…` in production |
   | `SITE_URL` | `https://your-domain.example` — used for the return links |

3. **Point the page at it.** In `assets/js/main.js`, set the endpoint:

   ```js
   var PAYMENTS = { endpoint: '/api/create-checkout-session' };
   ```

   The button changes from "Place order" to "Pay with card" on its own.

4. **Test** with Stripe's `4242 4242 4242 4242`, any future expiry, any CVC.

### What the server decides, not the browser

The page sends only a fit key, a colourway and a quantity. Prices live in the
function's own `CATALOGUE` and nowhere else, so a tampered client cannot
invent a cheaper case — this is covered by a test that sends `price: 0.01`
and confirms the session is still built at $19.99. Quantities are bounded,
unknown fits and colourways are rejected, and Stripe errors are logged
server-side rather than returned to the browser.

Change a price in **both** places: the `data-price` attribute in `index.html`
(what the shopper sees) and `CATALOGUE` in the function (what they are
charged). They are deliberately separate — the browser copy is never trusted.

## Signing in

Pressing **Add to bag** asks for an email before the first item goes in. The
address is stored in `localStorage`, shown in the nav, prefilled into
checkout, and passed to Stripe so the receipt goes to the right place.

This is identity capture, not authenticated login: with no backend there is
nobody to verify the address against and no password or magic link involved.
Treat it as "where should we email this", not as proof of who someone is. If
you need real accounts, that needs a backend and a session store.

## Notes

- The 360° video is H.264, muted and looping, with the audio track stripped —
  466 KB down to 138 KB at SSIM 0.991 against the original.
- Typography is Anton (display), Inter (body) and JetBrains Mono (utility),
  inlined as woff2 data URIs — the page makes zero network requests and
  renders identically offline.
- The specification figures are drafted placeholders. Check them against the
  real product before publishing.
