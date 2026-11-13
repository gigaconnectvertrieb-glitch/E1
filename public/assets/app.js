(function () {
  'use strict';

  document.documentElement.classList.add('js');

  var nf = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 });
  var nf2 = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  /* ---------- nav ---------- */
  var navToggle = document.querySelector('.nav-toggle');
  var navLinks = document.querySelector('.nav-links');
  if (navToggle && navLinks) {
    navToggle.addEventListener('click', function () {
      var open = navLinks.classList.toggle('open');
      navToggle.setAttribute('aria-expanded', String(open));
    });
    navLinks.addEventListener('click', function (e) {
      if (e.target.tagName === 'A') {
        navLinks.classList.remove('open');
        navToggle.setAttribute('aria-expanded', 'false');
      }
    });
  }

  /* ---------- reveal ---------- */
  var revealEls = Array.prototype.slice.call(document.querySelectorAll('.reveal'));
  if ('IntersectionObserver' in window && revealEls.length) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('in');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });
    revealEls.forEach(function (el) { io.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add('in'); });
  }

  /* ---------- calculator ---------- */
  var calc = document.getElementById('calc');
  var tariffs = null;

  function clamp(n, min, max) {
    return Math.min(max, Math.max(min, n));
  }

  function setText(id, text) {
    var el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  function currentCalcProduct() {
    var active = document.querySelector('.seg button[aria-pressed="true"]');
    return active ? active.getAttribute('data-produkt') : 'strom';
  }

  function renderPresets() {
    var wrap = document.getElementById('presets');
    if (!wrap || !tariffs) return;
    var t = tariffs[currentCalcProduct()];
    wrap.innerHTML = '';
    t.presets.forEach(function (v) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'preset';
      b.textContent = nf.format(v) + ' kWh';
      b.addEventListener('click', function () {
        var input = document.getElementById('calc-verbrauch');
        if (input) input.value = String(v);
        updateCalc();
      });
      wrap.appendChild(b);
    });
  }

  function updateCalc() {
    if (!tariffs) return;
    var produkt = currentCalcProduct();
    var t = tariffs[produkt];
    var input = document.getElementById('calc-verbrauch');
    var parsed = parseInt(input && input.value ? input.value.replace(/\D/g, '') : '', 10);
    var kwh = Number.isFinite(parsed) ? clamp(parsed, t.min_verbrauch, t.max_verbrauch) : t.default_verbrauch;

    var jahr = t.grundpreis_monat * 12 + (t.arbeitspreis_ct / 100) * kwh;
    var referenz = t.referenz_grundpreis_monat * 12 + (t.referenz_ct / 100) * kwh;
    var ersparnis = Math.max(0, referenz - jahr);

    setText('out-jahr', nf.format(Math.round(jahr)));
    setText('out-monat', nf2.format(jahr / 12) + ' €');
    setText('out-ref', nf2.format(referenz) + ' €');
    setText('out-saving', '≈ ' + nf.format(Math.round(ersparnis)) + ' € sparen');

    var hidden = document.querySelector('[name="produkt"]');
    if (hidden) hidden.value = produkt;

    if (input && !input.value) input.value = String(kwh);

    // preset highlight
    var presets = document.querySelectorAll('.preset');
    presets.forEach(function (p) {
      var n = parseInt(p.textContent.replace(/\D/g, ''), 10);
      p.classList.toggle('active', n === kwh);
    });
  }

  if (calc) {
    fetch('/api/tariffs')
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (!data || !data.tariffs) throw new Error('tariffs');
        tariffs = data.tariffs;
        var seg = document.querySelectorAll('.seg button');
        seg.forEach(function (btn) {
          btn.addEventListener('click', function () {
            seg.forEach(function (b) { b.setAttribute('aria-pressed', 'false'); });
            btn.setAttribute('aria-pressed', 'true');
            var input = document.getElementById('calc-verbrauch');
            var t = tariffs[btn.getAttribute('data-produkt')];
            if (input) input.value = '';
            if (input) input.placeholder = String(t.default_verbrauch);
            renderPresets();
            updateCalc();
          });
        });
        var vi = document.getElementById('calc-verbrauch');
        if (vi) vi.addEventListener('input', updateCalc);
        renderPresets();
        updateCalc();
        document.body.setAttribute('data-calc-ready', '1');
      })
      .catch(function () {
        setText('out-jahr', '—');
        setText('out-saving', 'Tarife nicht geladen');
      });
  }

  /* ---------- lead form ---------- */
  var form = document.getElementById('lead-form');
  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var status = document.getElementById('form-status');
      var submit = form.querySelector('button[type="submit"]');
      var data = {};

      Array.prototype.forEach.call(form.elements, function (el) {
        if (!el.name) return;
        if (el.type === 'checkbox') {
          data[el.name] = el.checked;
        } else {
          data[el.name] = el.value;
        }
      });

      data.typ = form.getAttribute('data-typ') || data.typ || 'privat';

      var sp = new URLSearchParams(window.location.search);
      var src = sp.get('src') || sp.get('utm_source') || 'website';
      var camp = sp.get('utm_campaign');
      if (camp) src += ':' + camp;
      data.quelle = src.replace(/[^a-zA-Z0-9:_-]/g, '').slice(0, 60) || 'website';

      form.querySelectorAll('.err').forEach(function (el) { el.textContent = ''; });

      if (status) {
        status.className = 'form-status';
        status.textContent = '';
      }

      submit.disabled = true;
      var oldLabel = submit.textContent;
      submit.textContent = 'Wird gesendet …';

      fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })
        .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, body: j }; }); })
        .then(function (res) {
          if (res.ok && res.body.ok) {
            window.location.href = '/danke.html';
            return;
          }
          var b = res.body || {};
          if (b.errors) {
            Object.keys(b.errors).forEach(function (key) {
              var el = form.querySelector('[data-error-for="' + key + '"]');
              if (el) el.textContent = b.errors[key];
            });
          }
          if (status) {
            status.className = 'form-status error';
            status.textContent = b.error === 'zu_viele_anfragen'
              ? 'Zu viele Anfragen in kurzer Zeit. Bitte in einigen Minuten erneut versuchen.'
              : 'Bitte prüfe die markierten Felder und sende erneut.';
          }
          submit.disabled = false;
          submit.textContent = oldLabel;
        })
        .catch(function () {
          if (status) {
            status.className = 'form-status error';
            status.textContent = 'Verbindung fehlgeschlagen. Bitte später erneut versuchen.';
          }
          submit.disabled = false;
          submit.textContent = oldLabel;
        });
    });
  }

  /* ---------- year ---------- */
  var years = document.querySelectorAll('[data-year]');
  years.forEach(function (el) { el.textContent = String(new Date().getFullYear()); });
})();
