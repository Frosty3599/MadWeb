# Quicksand QS·01 — Glow Edition

A single-product marketing site for quicksand glow-in-the-dark AirPods cases.
Static HTML, CSS and JavaScript. No build step, no dependencies, no framework.

**Open `index.html` in a browser.** That's the whole setup. It also deploys as-is
to GitHub Pages or any static host.

```
index.html                  markup and copy
assets/css/styles.css       design tokens + every section
assets/js/main.js           motion engine + configurator
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

- **The lamp switch** (nav, glow section, footer — all three stay in sync)
  flips the entire page between light and dark *and* crossfades the product
  between the lit photo and the glowing one. The choice persists in
  `localStorage`; first visit follows the OS `prefers-color-scheme`.
- **Three colourways** — swaps the shot, the accent colour, and the ambient
  glow across the whole page.
- **Four fits** — drives an odometer price roll and updates the nav pill, the
  ticket, the closing summary, and the three live rows in the specification
  table.

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

## Notes

- The 360° video is H.264/AAC and plays muted and looping. Chromium builds
  without proprietary codecs (including Playwright's bundled one) cannot decode
  it; Chrome, Safari, Edge and Firefox all can.
- Typography uses a system font stack so the page renders identically offline
  with no external requests.
