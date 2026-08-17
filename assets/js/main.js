/* ═══════════════════════════════════════════════════════════════════
   NOVACASE NC·01 — motion engine, configurator, bag and checkout

   Shared primitives:
     1. one rAF scroll loop publishing --page-progress / --sec-progress
     2. one geometry sweep that releases reveals and counters
     3. one text splitter feeding the line-rise transitions
   All of it gated on prefers-reduced-motion.
   ═══════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  var root   = document.documentElement;
  var $      = function (s, c) { return (c || document).querySelector(s); };
  var $$     = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var COLOURS = {
    'forest-green':  { name: 'Forest Green',  swatch: 'linear-gradient(150deg,#6EE85A,#0B2A10)',
                       note: 'High-saturation green over graphite. The most legible glow of the three.' },
    'amber-red':     { name: 'Amber Red',     swatch: 'linear-gradient(150deg,#FF4A2E,#1A0605)',
                       note: 'Molten red bleeding into black. The warmest of the three by daylight.' },
    'midnight-blue': { name: 'Midnight Blue', swatch: 'linear-gradient(150deg,#2FB6E0,#061A24)',
                       note: 'Deep teal fading to ink. Closest to the colour it turns in the dark.' }
  };

  var FREE_SHIPPING_OVER = 25;
  var SHIPPING_FLAT      = 3.99;

  var money = function (n) { return '$' + Number(n).toFixed(2); };


  /* ═══════════  1. PHOTOGRAPH FALLBACK  ═══════════ */

  /* Each shot sits over a CSS stand-in. Missing photograph → flag the figure
     and the stand-in shows through, with no layout shift. */
  function watchShot(fig) {
    var img = $('img', fig);
    if (!img) return;
    var fail = function () { fig.classList.add('is-missing'); };
    if (img.complete && img.naturalWidth === 0) fail();
    img.addEventListener('error', fail);
    img.addEventListener('load', function () {
      if (img.naturalWidth === 0) fail(); else fig.classList.remove('is-missing');
    });
  }
  $$('[data-shot]').forEach(watchShot);


  /* ═══════════  2. THE LAMP / THEME  ═══════════ */

  var lamps = $$('[data-lamp]');
  var sweep = $('.sweep');

  function paintLamps(dark) {
    lamps.forEach(function (btn) {
      btn.setAttribute('aria-pressed', String(dark));
      btn.setAttribute('aria-label', dark ? 'Turn the lights on' : 'Turn the lights off');
      var t = $('[data-lamp-text]', btn);
      if (t) t.textContent = dark ? 'Lights off' : 'Lights on';
    });
  }

  /* The one orchestrated flourish: the room changes from where you flipped it. */
  function runSweep(origin) {
    if (reduce || !sweep) return;
    sweep.style.setProperty('--sx', origin.x + 'px');
    sweep.style.setProperty('--sy', origin.y + 'px');
    sweep.classList.remove('is-running');
    void sweep.offsetWidth;
    sweep.classList.add('is-running');
  }

  paintLamps(root.dataset.theme === 'dark');

  lamps.forEach(function (btn) {
    btn.addEventListener('click', function () {
      var box  = btn.getBoundingClientRect();
      var dark = root.dataset.theme !== 'dark';
      runSweep({ x: box.left + box.width / 2, y: box.top + box.height / 2 });
      root.dataset.theme = dark ? 'dark' : 'light';
      paintLamps(dark);
      try { localStorage.setItem('nc-theme', dark ? 'dark' : 'light'); } catch (e) {}
    });
  });


  /* ═══════════  3. COLOURWAY  ═══════════ */

  var cwButtons = $$('[data-cw-btn]');
  var cwName    = $('[data-cw-name]');
  var cwNote    = $('[data-cw-note]');

  function rollText(el, next) {
    if (!el) return;
    if (reduce || el.textContent === next) { el.textContent = next; return; }
    el.classList.remove('roll-in');
    el.classList.add('roll-out');
    window.setTimeout(function () {
      el.textContent = next;
      el.classList.remove('roll-out');
      el.classList.add('roll-in');
    }, 300);
  }

  function setColour(key) {
    var data = COLOURS[key];
    if (!data) return;

    root.dataset.color = key;
    cwButtons.forEach(function (b) { b.setAttribute('aria-checked', String(b.dataset.cwBtn === key)); });

    rollText(cwName, data.name);
    if (cwNote) cwNote.textContent = data.note;
    $$('[data-summary-colour]').forEach(function (el) { el.textContent = data.name; });
  }

  cwButtons.forEach(function (btn) {
    btn.addEventListener('click', function () { setColour(btn.dataset.cwBtn); });
  });


  /* ═══════════  4. FIT — the price roll  ═══════════ */

  var fitButtons = $$('[data-fit-btn]');
  var odometer   = $('[data-odometer]');

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
        void cell.offsetWidth;
        cell.classList.remove('is-primed');
      }, 290 + i * 32);
    });
  }

  function flashLiveRows() {
    if (reduce) return;
    $$('.spec-row.is-live').forEach(function (row, i) {
      window.setTimeout(function () {
        row.classList.add('is-flash');
        window.setTimeout(function () { row.classList.remove('is-flash'); }, 500);
      }, i * 70);
    });
  }

  function currentFitButton() {
    return fitButtons.filter(function (b) { return b.dataset.fitBtn === root.dataset.fit; })[0] || fitButtons[0];
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

    var price = money(btn.dataset.price);
    rollOdometer(price);
    $$('[data-price-mini]').forEach(function (el) { el.textContent = price; });
    $$('[data-was-out]').forEach(function (el) { el.textContent = money(btn.dataset.was); });
    $$('[data-summary-fit]').forEach(function (el) { el.textContent = btn.dataset.name; });
    $$('[data-spec-fit]').forEach(function (el) { el.textContent = btn.dataset.name; });
    $$('[data-spec-dims]').forEach(function (el) { el.textContent = btn.dataset.dims; });
    $$('[data-spec-weight]').forEach(function (el) { el.textContent = btn.dataset.weight; });

    flashLiveRows();
  }

  fitButtons.forEach(function (btn) {
    btn.addEventListener('click', function () { setFit(btn.dataset.fitBtn); });
  });

  if (odometer) buildOdometer(odometer.textContent.trim());

  /* Arrow-key traversal for both radiogroups */
  [cwButtons, fitButtons].forEach(function (group) {
    var pick = group === cwButtons
      ? function (b) { setColour(b.dataset.cwBtn); }
      : function (b) { setFit(b.dataset.fitBtn); };
    group.forEach(function (item, i) {
      item.addEventListener('keydown', function (e) {
        var step = (e.key === 'ArrowRight' || e.key === 'ArrowDown') ? 1
                 : (e.key === 'ArrowLeft'  || e.key === 'ArrowUp')   ? -1 : 0;
        if (!step) return;
        e.preventDefault();
        var next = group[(i + step + group.length) % group.length];
        next.focus();
        pick(next);
      });
    });
  });


  /* ═══════════  5. THE BAG  ═══════════ */

  var bagList   = $('[data-bag-list]');
  var bagEmpty  = $('[data-bag-empty]');
  var orderForm = $('[data-order-form]');
  var orderDone = $('[data-order-done]');
  var toastEl   = $('[data-toast]');
  var bag       = [];

  try {
    var stored = JSON.parse(localStorage.getItem('nc-bag') || '[]');
    if (Array.isArray(stored)) bag = stored;
  } catch (e) { bag = []; }

  function saveBag() {
    try { localStorage.setItem('nc-bag', JSON.stringify(bag)); } catch (e) {}
  }

  function toast(msg) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.add('is-up');
    window.clearTimeout(toastEl._t);
    toastEl._t = window.setTimeout(function () { toastEl.classList.remove('is-up'); }, 2600);
  }

  function bagCount() {
    return bag.reduce(function (n, it) { return n + it.qty; }, 0);
  }

  function subtotal() {
    return bag.reduce(function (n, it) { return n + it.qty * it.price; }, 0);
  }

  function renderBag() {
    var count = bagCount();

    $$('[data-bag-count]').forEach(function (el) {
      var changed = el.textContent !== String(count);
      el.textContent = count;
      if (changed && !reduce) {
        el.classList.remove('is-bumped');
        void el.offsetWidth;
        el.classList.add('is-bumped');
      }
    });

    if (bagEmpty) bagEmpty.hidden = bag.length > 0;
    if (orderForm && orderDone.hidden) orderForm.hidden = bag.length === 0;

    if (bagList) {
      bagList.textContent = '';
      bag.forEach(function (it, i) {
        var li = document.createElement('li');
        li.className = 'bag-item';

        var sw = document.createElement('span');
        sw.className = 'bag-item__swatch';
        sw.style.background = COLOURS[it.colour] ? COLOURS[it.colour].swatch : 'transparent';

        var text = document.createElement('div');
        var nm = document.createElement('div');
        nm.className = 'bag-item__name';
        nm.textContent = it.colourName + ' — ' + it.fitName;
        var mt = document.createElement('div');
        mt.className = 'bag-item__meta';
        mt.textContent = money(it.price) + ' each';
        text.appendChild(nm); text.appendChild(mt);

        var qty = document.createElement('div');
        qty.className = 'qty';
        var minus = document.createElement('button');
        minus.type = 'button'; minus.textContent = '−';
        minus.setAttribute('aria-label', 'Remove one ' + it.colourName + ' ' + it.fitName);
        var out = document.createElement('output');
        out.textContent = it.qty;
        var plus = document.createElement('button');
        plus.type = 'button'; plus.textContent = '+';
        plus.setAttribute('aria-label', 'Add one ' + it.colourName + ' ' + it.fitName);
        minus.addEventListener('click', function () { changeQty(i, -1); });
        plus.addEventListener('click',  function () { changeQty(i,  1); });
        qty.appendChild(minus); qty.appendChild(out); qty.appendChild(plus);

        var line = document.createElement('div');
        line.className = 'bag-item__line';
        line.textContent = money(it.qty * it.price);

        li.appendChild(sw); li.appendChild(text); li.appendChild(qty); li.appendChild(line);
        bagList.appendChild(li);
      });
    }

    var sub  = subtotal();
    var ship = bag.length === 0 ? 0 : (sub >= FREE_SHIPPING_OVER ? 0 : SHIPPING_FLAT);

    var setTxt = function (sel, v) { $$(sel).forEach(function (el) { el.textContent = v; }); };
    setTxt('[data-sum-subtotal]', money(sub));
    setTxt('[data-sum-shipping]', bag.length === 0 ? '—' : (ship === 0 ? 'Free' : money(ship)));
    setTxt('[data-sum-total]',    money(sub + ship));

    var hint = $('[data-ship-hint]');
    if (hint) {
      hint.textContent = bag.length === 0 ? 'Free shipping over ' + money(FREE_SHIPPING_OVER) + '.'
        : sub >= FREE_SHIPPING_OVER ? 'Shipping is on us.'
        : 'Add ' + money(FREE_SHIPPING_OVER - sub) + ' more for free shipping.';
    }

    saveBag();
  }

  function changeQty(index, delta) {
    var it = bag[index];
    if (!it) return;
    it.qty += delta;
    if (it.qty <= 0) bag.splice(index, 1);
    renderBag();
  }

  function addToBag(button) {
    var fitBtn = currentFitButton();
    if (!fitBtn) return;

    var colour = root.dataset.color;
    var fit    = fitBtn.dataset.fitBtn;
    var found  = bag.filter(function (it) { return it.colour === colour && it.fit === fit; })[0];

    if (found) found.qty += 1;
    else bag.push({
      colour: colour,
      colourName: COLOURS[colour] ? COLOURS[colour].name : colour,
      fit: fit,
      fitName: fitBtn.dataset.name,
      price: parseFloat(fitBtn.dataset.price),
      qty: 1
    });

    renderBag();
    toast((COLOURS[colour] ? COLOURS[colour].name : colour) + ' · ' + fitBtn.dataset.name + ' added');

    if (button) {
      var label = $('[data-add-label]', button);
      if (label && !button.classList.contains('is-done')) {
        var was = label.textContent;
        button.classList.add('is-done');
        label.textContent = 'Added to bag ✓';
        window.setTimeout(function () {
          button.classList.remove('is-done');
          label.textContent = was;
        }, 1800);
      }
    }
  }

  $$('[data-add-to-bag]').forEach(function (btn) {
    btn.addEventListener('click', function () { addToBag(btn); });
  });


  /* ═══════════  6. CHECKOUT  ═══════════ */

  var FIELD_MSG = {
    email:   'Enter an email we can send the confirmation to.',
    name:    'Enter the name for the parcel.',
    address: 'Enter a street address.',
    city:    'Enter a city.',
    zip:     'Enter a postcode.'
  };

  function markField(input, message) {
    var wrap = input.closest('.field');
    var err  = $('[data-err-for="' + input.name + '"]');
    if (wrap) wrap.classList.toggle('is-bad', !!message);
    if (err) err.textContent = message || '';
    input.setAttribute('aria-invalid', message ? 'true' : 'false');
  }

  function validate(form) {
    var bad = null;
    $$('input', form).forEach(function (input) {
      var v  = input.value.trim();
      var ok = v.length > 0 && (input.type !== 'email' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v));
      markField(input, ok ? '' : FIELD_MSG[input.name] || 'Required.');
      if (!ok && !bad) bad = input;
    });
    return bad;
  }

  if (orderForm) {
    $$('input', orderForm).forEach(function (input) {
      input.addEventListener('input', function () {
        if (input.closest('.field').classList.contains('is-bad')) markField(input, '');
      });
    });

    orderForm.addEventListener('submit', function (e) {
      e.preventDefault();

      if (bag.length === 0) { toast('Your bag is empty'); return; }

      var bad = validate(orderForm);
      if (bad) { bad.focus(); toast('Check the highlighted fields'); return; }

      var ref = 'NC-' + String(Math.floor(100000 + Math.random() * 900000));
      $$('[data-order-ref]').forEach(function (el) { el.textContent = ref; });
      $$('[data-order-email]').forEach(function (el) { el.textContent = $('#of-email').value.trim(); });

      bag = [];
      renderBag();
      orderForm.hidden = true;
      if (bagEmpty) bagEmpty.hidden = true;
      if (orderDone) orderDone.hidden = false;
      toast('Order ' + ref + ' placed');
    });
  }

  var resetBtn = $('[data-order-reset]');
  if (resetBtn) {
    resetBtn.addEventListener('click', function () {
      if (orderDone) orderDone.hidden = true;
      if (orderForm) { orderForm.reset(); $$('input', orderForm).forEach(function (i) { markField(i, ''); }); }
      renderBag();
      var fit = $('#fit');
      if (fit) fit.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' });
    });
  }


  /* ═══════════  7. TEXT SPLITTING  ═══════════ */

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

  $$('[data-stack]').forEach(function (el) {
    $$('.hero__line', el).forEach(function (line, i) { line.style.setProperty('--wi', i); });
  });


  /* ═══════════  8. REVEALS — one moment per section  ═══════════ */

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

  tag('.fit-card', 'rise', true);
  tag('.fit__finder', 'up');
  tag('.ticket', 'up');

  tag('.feature', 'rise', true);
  tag('.spec-row', 'up', true);
  tag('.specs__media', 'clip');

  tag('.mech__cols > article', 'up', true);
  tag('.stat', 'up', true);

  tag('.checkout__main > *', 'up', true);
  tag('.summary', 'clip');

  tag('.qa', 'up', true);

  tag('.closer__lede', 'up');
  tag('.closer__build', 'up');
  tag('.closer .btn', 'up');
  tag('.closer__reassure', 'fade');

  /* Swept by geometry rather than IntersectionObserver: a blurred or scaled
     element can report a zero-area intersection rect and then never fire,
     which would leave real content permanently invisible. */
  var pending  = $$('[data-reveal], [data-split], [data-stack]');
  var counters = $$('[data-count]');

  function runCounter(el) {
    var target   = parseFloat(el.dataset.count);
    var decimals = parseInt(el.dataset.decimals || '0', 10);
    var suffix   = el.dataset.suffix || '';

    if (reduce || isNaN(target)) { el.textContent = target.toFixed(decimals) + suffix; return; }

    var start = null;
    function frame(now) {
      if (start === null) start = now;
      var t = Math.min((now - start) / 1500, 1);
      el.textContent = (target * (1 - Math.pow(1 - t, 4))).toFixed(decimals) + suffix;
      if (t < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  function sweepReveals() {
    var vh = window.innerHeight;
    pending = pending.filter(function (el) {
      if (el.getBoundingClientRect().top > vh * 0.88) return true;
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
    counters.forEach(runCounter);
    pending = []; counters = [];
  }


  /* ═══════════  9. THE SCROLL LOOP  ═══════════ */

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
      var p    = span > 0 ? (-box.top) / span : (vh - box.top) / (vh + box.height);
      sec.style.setProperty('--sec-progress', Math.min(Math.max(p, 0), 1).toFixed(4));
    });

    sweepReveals();
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


  /* ═══════════  10. MAGNETIC BUTTONS + TICKER  ═══════════ */

  if (!reduce && window.matchMedia('(hover: hover)').matches) {
    $$('[data-magnetic]').forEach(function (el) {
      el.addEventListener('pointermove', function (e) {
        var b = el.getBoundingClientRect();
        el.style.transform = 'translate(' +
          ((e.clientX - b.left - b.width  / 2) * 0.26).toFixed(1) + 'px,' +
          ((e.clientY - b.top  - b.height / 2) * 0.32).toFixed(1) + 'px)';
      });
      el.addEventListener('pointerleave', function () { el.style.transform = ''; });
    });
  }

  var track = $('.ticker__track');
  if (track && !reduce) track.innerHTML += track.innerHTML;


  /* ═══════════  11. BOOT  ═══════════ */

  setColour(root.dataset.color || 'forest-green');
  setFit(root.dataset.fit || 'pods12');
  renderBag();
  onScroll();

})();
