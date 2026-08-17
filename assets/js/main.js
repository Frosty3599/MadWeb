/* ═══════════════════════════════════════════════════════════════════
   QUICKSAND QS·01 — motion engine + configurator

   Three shared primitives do all the animation work:
     1. one IntersectionObserver driving every reveal
     2. one rAF scroll loop writing --page-progress / --sec-progress
     3. one text splitter feeding the line-rise transitions

   Everything below is gated on prefers-reduced-motion.
   ═══════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  var root  = document.documentElement;
  var $     = function (sel, ctx) { return (ctx || document).querySelector(sel); };
  var $$    = function (sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); };
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ─────────────────────────  PRODUCT DATA  ───────────────────────── */

  var COLOURS = {
    'forest-green':  { name: 'Forest Green',  note: 'High-saturation green over graphite. The most legible glow of the three.' },
    'amber-red':     { name: 'Amber Red',     note: 'Molten red bleeding into black. The warmest of the three by daylight.' },
    'midnight-blue': { name: 'Midnight Blue', note: 'Deep teal fading to ink. Closest to the colour it turns in the dark.' }
  };

  var money = function (n) { return '$' + Number(n).toFixed(2); };


  /* ═════════════════════  1. THE LAMP / THEME  ═════════════════════ */

  var lamps = $$('[data-lamp]');

  function paintLamps(dark) {
    lamps.forEach(function (btn) {
      btn.setAttribute('aria-pressed', String(dark));
      btn.setAttribute('aria-label', dark ? 'Turn the lights on' : 'Turn the lights off');
      var t = $('[data-lamp-text]', btn);
      if (t) t.textContent = dark ? 'Lights off' : 'Lights on';
    });
  }

  function setTheme(dark, remember) {
    root.dataset.theme = dark ? 'dark' : 'light';
    paintLamps(dark);
    if (remember) { try { localStorage.setItem('qs-theme', dark ? 'dark' : 'light'); } catch (e) {} }
  }

  /* The inline head script already picked the theme — sync the buttons to it. */
  paintLamps(root.dataset.theme === 'dark');

  lamps.forEach(function (btn) {
    btn.addEventListener('click', function () {
      setTheme(root.dataset.theme !== 'dark', true);
    });
  });


  /* ═══════════════════════  2. COLOURWAY  ══════════════════════════ */

  var cwButtons = $$('[data-cw-btn]');
  var cwName    = $('[data-cw-name]');
  var cwNote    = $('[data-cw-note]');

  function rollText(el, next) {
    if (!el || el.textContent === next) { if (el) el.textContent = next; return; }
    if (reduce) { el.textContent = next; return; }
    el.classList.remove('roll-in');
    el.classList.add('roll-out');
    window.setTimeout(function () {
      el.textContent = next;
      el.classList.remove('roll-out');
      el.classList.add('roll-in');
    }, 320);
  }

  function setColour(key) {
    var data = COLOURS[key];
    if (!data) return;

    root.dataset.color = key;
    cwButtons.forEach(function (b) {
      b.setAttribute('aria-checked', String(b.dataset.cwBtn === key));
    });

    rollText(cwName, data.name);
    if (cwNote) cwNote.textContent = data.note;
    $$('[data-summary-colour]').forEach(function (el) { el.textContent = data.name; });
  }

  cwButtons.forEach(function (btn) {
    btn.addEventListener('click', function () { setColour(btn.dataset.cwBtn); });
  });

  /* Arrow-key traversal inside the radiogroup */
  wireRovingRadios(cwButtons, function (btn) { setColour(btn.dataset.cwBtn); });


  /* ═════════════════  3. FIT — the price roll  ═════════════════════ */

  var fitButtons = $$('[data-fit-btn]');
  var odometer   = $('[data-odometer]');

  /* Build the odometer once, then only ever swap the characters inside. */
  function buildOdometer(text) {
    if (!odometer) return;
    odometer.textContent = '';
    text.split('').forEach(function (ch, i) {
      var d = document.createElement('span');
      d.className = 'od-d';
      d.style.setProperty('--di', i);
      var inner = document.createElement('span');
      inner.className = 'od-i';
      inner.textContent = ch;
      d.appendChild(inner);
      odometer.appendChild(d);
    });
  }

  function rollOdometer(text) {
    if (!odometer) return;
    var cells = $$('.od-d', odometer);

    if (reduce || cells.length !== text.length) { buildOdometer(text); return; }

    cells.forEach(function (cell, i) {
      var inner = $('.od-i', cell);
      if (!inner || inner.textContent === text[i]) return;

      cell.classList.add('is-out');
      window.setTimeout(function () {
        inner.textContent = text[i];
        cell.classList.remove('is-out');
        cell.classList.add('is-primed');
        /* force a reflow so the primed position is committed before we release */
        void cell.offsetWidth;
        cell.classList.remove('is-primed');
      }, 300 + i * 34);
    });
  }

  function flashLiveRows() {
    if (reduce) return;
    $$('.spec-row.is-live').forEach(function (row, i) {
      window.setTimeout(function () {
        row.classList.add('is-flash');
        window.setTimeout(function () { row.classList.remove('is-flash'); }, 520);
      }, i * 70);
    });
  }

  function setFit(key) {
    var btn = fitButtons.filter(function (b) { return b.dataset.fitBtn === key; })[0];
    if (!btn) return;

    root.dataset.fit = key;
    fitButtons.forEach(function (b) {
      var on = b === btn;
      b.classList.toggle('is-active', on);
      b.setAttribute('aria-checked', String(on));
    });

    var name  = btn.dataset.name;
    var price = money(btn.dataset.price);
    var was   = money(btn.dataset.was);

    rollOdometer(price);
    $$('[data-price-mini]').forEach(function (el) { el.textContent = price; });
    $$('[data-was-out]').forEach(function (el) { el.textContent = was; });
    $$('[data-summary-fit]').forEach(function (el) { el.textContent = name; });
    $$('[data-spec-fit]').forEach(function (el) { el.textContent = name; });
    $$('[data-spec-dims]').forEach(function (el) { el.textContent = btn.dataset.dims; });
    $$('[data-spec-weight]').forEach(function (el) { el.textContent = btn.dataset.weight; });

    flashLiveRows();
  }

  fitButtons.forEach(function (btn) {
    btn.addEventListener('click', function () { setFit(btn.dataset.fitBtn); });
  });

  wireRovingRadios(fitButtons, function (btn) { setFit(btn.dataset.fitBtn); });

  if (odometer) buildOdometer(odometer.textContent.trim());

  /* Shared roving-tabindex behaviour for both radiogroups */
  function wireRovingRadios(items, onPick) {
    if (!items.length) return;
    items.forEach(function (item, i) {
      item.addEventListener('keydown', function (e) {
        var step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1
                 : e.key === 'ArrowLeft'  || e.key === 'ArrowUp'   ? -1 : 0;
        if (!step) return;
        e.preventDefault();
        var next = items[(i + step + items.length) % items.length];
        next.focus();
        onPick(next);
      });
    });
  }


  /* ════════════════  4. PHOTOGRAPH FALLBACK  ══════════════════════ */

  /* Every shot sits over a CSS stand-in. If the photograph is missing,
     flag the figure and the stand-in shows through — no layout shift.
     Drop the real files into assets/images/ and this never fires.     */
  $$('[data-shot]').forEach(function (fig) {
    var img = $('img', fig);
    if (!img) return;

    var fail = function () { fig.classList.add('is-missing'); };
    if (img.complete && img.naturalWidth === 0) fail();
    img.addEventListener('error', fail);
    img.addEventListener('load', function () {
      if (img.naturalWidth === 0) fail();
      else fig.classList.remove('is-missing');
    });
  });


  /* ═══════════════════  5. TEXT SPLITTING  ════════════════════════ */

  /* [data-split] — wrap each word so it can rise out of its own mask. */
  $$('[data-split]').forEach(function (el) {
    var words = el.textContent.trim().split(/\s+/);
    el.textContent = '';
    words.forEach(function (w, i) {
      var span = document.createElement('span');
      span.className = 'word';
      span.style.setProperty('--wi', i);
      var inner = document.createElement('i');
      inner.textContent = w;
      span.appendChild(inner);
      el.appendChild(span);
      if (i < words.length - 1) el.appendChild(document.createTextNode(' '));
    });
  });

  /* [data-stack] — already split in the markup, just needs its indices. */
  $$('[data-stack]').forEach(function (el) {
    $$('.hero__line', el).forEach(function (line, i) { line.style.setProperty('--wi', i); });
  });


  /* ═══════════  6. REVEALS — one moment per section  ══════════════ */

  /* Curated, not blanket: the swipe file is explicit that animating
     everything at once reads as unfinished. Each section gets one
     choreographed gesture plus a quiet fade for its supporting text. */
  function tag(sel, kind, stagger) {
    $$(sel).forEach(function (el, i) {
      if (el.hasAttribute('data-reveal')) return;
      el.setAttribute('data-reveal', kind);
      if (stagger) el.style.setProperty('--i', i);
    });
  }

  tag('.section__head .label', 'fade');
  tag('.section__head .section__lede', 'up');

  tag('.lights__stage', 'scale');
  tag('.claims > div', 'up', true);

  tag('.colourways__stage', 'clip');
  tag('.colourways__side > *', 'up', true);

  tag('.fit-card', 'up', true);
  tag('.ticket', 'up');

  tag('.spec-row', 'up', true);          /* the cascade */
  tag('.specs__media', 'clip');

  tag('.mech__cols > article', 'up', true);
  tag('.stat', 'up', true);

  tag('.qa', 'up', true);

  tag('.closer__lede', 'up');
  tag('.closer__build', 'up');
  tag('.closer .btn', 'up');

  /* Pending reveals + counters are swept from the scroll loop rather than
     watched by an IntersectionObserver: an element that is blurred, scaled
     or clipped can report a zero-area intersection rect and then never fire,
     which would leave real content permanently invisible. A geometry check
     against the viewport cannot fail that way. */
  var pending  = $$('[data-reveal], [data-split], [data-stack]');
  var counters = $$('[data-count]');

  function sweep() {
    var vh = window.innerHeight;

    pending = pending.filter(function (el) {
      var box = el.getBoundingClientRect();
      if (box.top > vh * 0.88) return true;          /* still below the fold */
      el.classList.add('is-in');
      return false;
    });

    counters = counters.filter(function (el) {
      var box = el.getBoundingClientRect();
      if (box.top > vh * 0.85 || box.bottom < 0) return true;
      runCounter(el);
      return false;
    });
  }

  if (reduce) {
    pending.forEach(function (el) { el.classList.add('is-in'); });
    pending = [];
  }


  /* ══════════════════════  7. COUNTERS  ═══════════════════════════ */

  function runCounter(el) {
    var target   = parseFloat(el.dataset.count);
    var decimals = parseInt(el.dataset.decimals || '0', 10);
    var suffix   = el.dataset.suffix || '';

    if (reduce || isNaN(target)) {
      el.textContent = target.toFixed(decimals) + suffix;
      return;
    }

    var start = null;
    var span  = 1500;

    function frame(now) {
      if (start === null) start = now;
      var t = Math.min((now - start) / span, 1);
      var eased = 1 - Math.pow(1 - t, 4);           /* expo-ish out */
      el.textContent = (target * eased).toFixed(decimals) + suffix;
      if (t < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  if (reduce) {
    counters.forEach(runCounter);
    counters = [];
  }


  /* ════════════════════  8. THE SCROLL LOOP  ══════════════════════ */

  /* One listener, one rAF, custom properties only — the CSS does the work. */
  var nav      = $('#nav');
  var sections = $$('[data-section]');
  var ticking  = false;

  function onScroll() {
    var scrolled = window.scrollY;
    var doc      = document.documentElement.scrollHeight - window.innerHeight;

    root.style.setProperty('--page-progress', doc > 0 ? (scrolled / doc).toFixed(4) : '0');
    if (nav) nav.classList.toggle('is-stuck', scrolled > 12);

    var vh = window.innerHeight;
    sections.forEach(function (sec) {
      var box  = sec.getBoundingClientRect();
      var span = box.height - vh;
      var p    = span > 0 ? (-box.top) / span            /* tall/pinned sections */
                          : (vh - box.top) / (vh + box.height);
      sec.style.setProperty('--sec-progress', Math.min(Math.max(p, 0), 1).toFixed(4));
    });

    sweep();
    ticking = false;
  }

  function requestTick() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(onScroll);
  }

  window.addEventListener('scroll', requestTick, { passive: true });
  window.addEventListener('resize', requestTick);
  window.addEventListener('load', requestTick);
  onScroll();


  /* ═════════════════════  9. MAGNETIC BUTTONS  ════════════════════ */

  if (!reduce && window.matchMedia('(hover: hover)').matches) {
    $$('[data-magnetic]').forEach(function (el) {
      el.addEventListener('pointermove', function (e) {
        var b = el.getBoundingClientRect();
        var x = (e.clientX - b.left - b.width  / 2) * 0.28;
        var y = (e.clientY - b.top  - b.height / 2) * 0.34;
        el.style.transform = 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px)';
      });
      el.addEventListener('pointerleave', function () { el.style.transform = ''; });
    });
  }


  /* ═══════════════════════  10. TICKER  ═══════════════════════════ */

  /* Duplicate the run so the -50% marquee loops without a seam. */
  var track = $('.ticker__track');
  if (track && !reduce) track.innerHTML += track.innerHTML;

})();
