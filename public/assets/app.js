(function () {
  'use strict';

  document.documentElement.classList.add('js');

  var nf = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 });
  var nf2 = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  function $(id) {
    return document.getElementById(id);
  }

  function setText(id, text) {
    var el = $(id);
    if (el) el.textContent = text;
  }

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

  /* ---------- switch date ---------- */
  var now = new Date();
  var switchDate = new Date(now.getFullYear(), now.getMonth() + 2, 0);
  var switchLabel = switchDate.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });
  Array.prototype.forEach.call(document.querySelectorAll('[data-switch-date]'), function (el) {
    el.textContent = switchLabel;
  });

  /* ---------- calculator ---------- */
  var calc = document.getElementById('calc');
  var tariffs = null;

  function clamp(n, min, max) {
    return Math.min(max, Math.max(min, n));
  }

  function currentCalcProduct() {
    var active = document.querySelector('.seg button[aria-pressed="true"]');
    return active ? active.getAttribute('data-produkt') : 'strom';
  }

  function priceFor(produkt, kwh) {
    var t = tariffs[produkt];
    var jahr = t.grundpreis_monat * 12 + (t.arbeitspreis_ct / 100) * kwh;
    var referenz = t.referenz_grundpreis_monat * 12 + (t.referenz_ct / 100) * kwh;
    return {
      jahr: jahr,
      referenz: referenz,
      ersparnis: Math.max(0, referenz - jahr)
    };
  }

  function renderPresets() {
    var wrap = $('presets');
    if (!wrap || !tariffs) return;
    var t = tariffs[currentCalcProduct()];
    wrap.innerHTML = '';
    t.presets.forEach(function (v) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'preset';
      b.textContent = nf.format(v) + ' kWh';
      b.addEventListener('click', function () {
        var input = $('calc-verbrauch');
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
    var input = $('calc-verbrauch');
    var parsed = parseInt(input && input.value ? input.value.replace(/\D/g, '') : '', 10);
    var kwh = Number.isFinite(parsed) ? clamp(parsed, t.min_verbrauch, t.max_verbrauch) : t.default_verbrauch;
    var p = priceFor(produkt, kwh);

    setText('out-jahr', nf.format(Math.round(p.jahr)));
    setText('out-saving', '≈ ' + nf.format(Math.round(p.ersparnis)) + ' € weniger');
    setText('out-monat', nf2.format(p.jahr / 12) + ' €');
    setText('out-sparen', '≈ ' + nf.format(Math.round(p.ersparnis)) + ' €');
    setText('out-ref', nf.format(Math.round(p.referenz)) + ' €');

    var plzInput = $('calc-plz');
    var plz = plzInput && /^\d{5}$/.test(plzInput.value.trim()) ? plzInput.value.trim() : '';
    setText('out-context', plz ? ' · ' + plz : '');

    if (input && !input.value) input.value = String(kwh);

    Array.prototype.forEach.call(document.querySelectorAll('.preset'), function (preset) {
      var n = parseInt(preset.textContent.replace(/\D/g, ''), 10);
      preset.classList.toggle('active', n === kwh);
    });
  }

  function fillExample() {
    if (!tariffs || !tariffs.strom) return;
    var box = document.querySelector('[data-example-kwh]');
    var kwh = box ? parseInt(box.getAttribute('data-example-kwh'), 10) : tariffs.strom.default_verbrauch;
    if (!Number.isFinite(kwh)) kwh = tariffs.strom.default_verbrauch;
    var p = priceFor('strom', kwh);
    setText('ex-ref', nf.format(Math.round(p.referenz)) + ' €');
    setText('ex-price', nf.format(Math.round(p.jahr)) + ' €');
    setText('ex-save', nf.format(Math.round(p.ersparnis)) + ' €');
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
            var produkt = btn.getAttribute('data-produkt');
            var t = tariffs[produkt];
            var input = $('calc-verbrauch');
            if (input) {
              input.value = '';
              input.placeholder = String(t.default_verbrauch);
            }
            var formProdukt = document.querySelector('form [name="produkt"]');
            if (formProdukt) formProdukt.value = produkt;
            renderPresets();
            updateCalc();
          });
        });
        var vi = $('calc-verbrauch');
        if (vi) vi.addEventListener('input', updateCalc);
        var pi = $('calc-plz');
        if (pi) pi.addEventListener('input', updateCalc);
        renderPresets();
        updateCalc();
        fillExample();
      })
      .catch(function () {
        setText('out-jahr', '—');
        setText('out-saving', 'Tarife nicht geladen');
      });
  }

  /* ---------- lead form ---------- */
  var form = document.getElementById('lead-form');

  if (form) {
    var step1 = form.querySelector('[data-step="1"]');
    var step2 = form.querySelector('[data-step="2"]');
    var indicator = form.querySelector('.steps-indicator');
    var caption = $('step-caption');
    var dots = Array.prototype.slice.call(form.querySelectorAll('.step-dot'));
    var isGewerbe = form.getAttribute('data-typ') === 'gewerbe';
    var submitBtn = form.querySelector('button[type="submit"]');
    var fileInput = document.getElementById('f-rechnung');
    var uploadIdInput = document.getElementById('f-upload-id');
    var uploadStatus = document.getElementById('upload-status');
    var uploadInProgress = false;

    if (fileInput) {
      fileInput.addEventListener('change', function () {
        var file = fileInput.files && fileInput.files[0];
        if (!file) return;
        if (uploadStatus) {
          uploadStatus.className = 'upload-status';
          uploadStatus.textContent = '';
        }
        var isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
        if (!isPdf) {
          if (uploadStatus) {
            uploadStatus.className = 'upload-status err';
            uploadStatus.textContent = 'Bitte eine PDF-Datei auswählen.';
          }
          fileInput.value = '';
          return;
        }
        if (file.size > 8 * 1024 * 1024) {
          if (uploadStatus) {
            uploadStatus.className = 'upload-status err';
            uploadStatus.textContent = 'Die Datei ist größer als 8 MB.';
          }
          fileInput.value = '';
          return;
        }
        uploadInProgress = true;
        if (uploadIdInput) uploadIdInput.value = '';
        if (uploadStatus) {
          uploadStatus.className = 'upload-status';
          uploadStatus.textContent = 'Wird hochgeladen …';
        }
        var fd = new FormData();
        fd.append('file', file);
        fetch('/api/uploads', { method: 'POST', body: fd })
          .then(function (r) {
            return r.json().then(function (j) { return { ok: r.ok, body: j }; });
          })
          .then(function (res) {
            if (res.ok && res.body.ok) {
              if (uploadIdInput) uploadIdInput.value = res.body.id;
              if (uploadStatus) {
                uploadStatus.className = 'upload-status ok';
                uploadStatus.textContent = 'Hochgeladen: ' + res.body.name;
              }
            } else if (uploadStatus) {
              uploadStatus.className = 'upload-status err';
              uploadStatus.textContent = res.body.error === 'datei_zu_gross'
                ? 'Die Datei ist größer als 8 MB.'
                : 'Upload fehlgeschlagen. Bitte erneut versuchen.';
            }
          })
          .catch(function () {
            if (uploadStatus) {
              uploadStatus.className = 'upload-status err';
              uploadStatus.textContent = 'Upload fehlgeschlagen. Bitte erneut versuchen.';
            }
          })
          .finally(function () {
            uploadInProgress = false;
          });
      });
    }

    function goStep(n) {
      if (!step1 || !step2) return;
      step1.hidden = n !== 1;
      step2.hidden = n !== 2;
      if (indicator) indicator.setAttribute('data-active', String(n));
      dots.forEach(function (dot) {
        var s = Number(dot.getAttribute('data-step-dot'));
        dot.classList.toggle('is-active', s === n);
        dot.classList.toggle('is-done', s < n);
      });
      if (caption) {
        caption.textContent = n === 1
          ? 'Schritt 1 von 2 · ' + (isGewerbe ? 'Dein Betrieb' : 'Dein Tarif')
          : 'Schritt 2 von 2 · Deine Kontaktdaten';
      }
    }

    function clearErrors(scope) {
      if (!scope) return;
      Array.prototype.forEach.call(scope.querySelectorAll('.err'), function (el) {
        el.textContent = '';
      });
    }

    function setErr(name, message) {
      var el = form.querySelector('[data-error-for="' + name + '"]');
      if (el) el.textContent = message;
    }

    function validStep1() {
      clearErrors(step1);
      var ok = true;
      var plz = form.elements.plz ? form.elements.plz.value.trim() : '';
      if (!/^\d{5}$/.test(plz)) {
        setErr('plz', 'Bitte 5-stellige PLZ angeben.');
        ok = false;
      }
      if (isGewerbe && form.elements.firma && !form.elements.firma.value.trim()) {
        setErr('firma', 'Bitte Firmennamen angeben.');
        ok = false;
      }
      var v = form.elements.verbrauch_kwh ? form.elements.verbrauch_kwh.value.trim() : '';
      if (v && !/^\d+$/.test(v)) {
        setErr('verbrauch_kwh', 'Bitte nur Zahlen.');
        ok = false;
      }
      var s = form.elements.anzahl_standorte ? form.elements.anzahl_standorte.value.trim() : '';
      if (s && !/^\d+$/.test(s)) {
        setErr('anzahl_standorte', 'Bitte nur Zahlen.');
        ok = false;
      }
      return ok;
    }

    function validStep2() {
      clearErrors(step2);
      var ok = true;
      if (!form.elements.vorname.value.trim()) {
        setErr('vorname', 'Bitte Vornamen angeben.');
        ok = false;
      }
      if (!form.elements.nachname.value.trim()) {
        setErr('nachname', 'Bitte Nachnamen angeben.');
        ok = false;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.elements.email.value.trim())) {
        setErr('email', 'Bitte gueltige E-Mail angeben.');
        ok = false;
      }
      if (!form.elements.consent.checked) {
        setErr('consent', 'Einwilligung erforderlich.');
        ok = false;
      }
      return ok;
    }

    var next = $('step-next');
    var back = $('step-back');
    if (next) {
      next.addEventListener('click', function () {
        if (!validStep1()) return;
        goStep(2);
        if (step2) step2.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    }
    if (back) {
      back.addEventListener('click', function () {
        goStep(1);
      });
    }

    var formProdukt = form.elements.produkt;
    if (formProdukt && calc) {
      formProdukt.addEventListener('change', function () {
        var target = document.querySelector('.seg button[data-produkt="' + formProdukt.value + '"]');
        if (target) target.click();
      });
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var status = $('form-status');
      if (status) {
        status.className = 'form-status';
        status.textContent = '';
      }

      var ok1 = validStep1();
      var ok2 = validStep2();
      if (!ok1) goStep(1);
      else if (!ok2) goStep(2);
      if (!ok1 || !ok2) return;

      if (uploadInProgress) {
        if (status) {
          status.className = 'form-status error';
          status.textContent = 'Der PDF-Upload läuft noch. Bitte kurz warten.';
        }
        return;
      }

      var data = {};
      Array.prototype.forEach.call(form.elements, function (el) {
        if (!el.name) return;
        if (el.type === 'checkbox') data[el.name] = el.checked;
        else data[el.name] = el.value;
      });
      data.typ = form.getAttribute('data-typ') || 'privat';

      var sp = new URLSearchParams(window.location.search);
      var src = sp.get('src') || sp.get('utm_source') || 'website';
      var camp = sp.get('utm_campaign');
      if (camp) src += ':' + camp;
      data.quelle = src.replace(/[^a-zA-Z0-9:_-]/g, '').slice(0, 60) || 'website';

      submitBtn.disabled = true;
      var oldLabel = submitBtn.textContent;
      submitBtn.textContent = 'Wird gesendet …';

      fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })
        .then(function (r) {
          return r.json().then(function (j) { return { ok: r.ok, body: j }; });
        })
        .then(function (res) {
          if (res.ok && res.body.ok) {
            window.location.href = '/danke.html';
            return;
          }
          var b = res.body || {};
          var step1Keys = ['plz', 'firma', 'verbrauch_kwh', 'anzahl_standorte'];
          var hasStep1 = false;
          if (b.errors) {
            Object.keys(b.errors).forEach(function (key) {
              setErr(key, b.errors[key]);
              if (step1Keys.indexOf(key) !== -1) hasStep1 = true;
            });
          }
          if (hasStep1) goStep(1);
          if (status) {
            status.className = 'form-status error';
            status.textContent = b.error === 'zu_viele_anfragen'
              ? 'Zu viele Anfragen in kurzer Zeit. Bitte in einigen Minuten erneut versuchen.'
              : 'Bitte prüfe die markierten Felder und sende erneut.';
          }
          submitBtn.disabled = false;
          submitBtn.textContent = oldLabel;
        })
        .catch(function () {
          if (status) {
            status.className = 'form-status error';
            status.textContent = 'Verbindung fehlgeschlagen. Bitte später erneut versuchen.';
          }
          submitBtn.disabled = false;
          submitBtn.textContent = oldLabel;
        });
    });
  }

  /* ---------- sticky CTA ---------- */
  var sticky = $('sticky-cta');
  if (sticky) {
    var updateSticky = function () {
      var y = window.scrollY || window.pageYOffset || 0;
      var formVisible = false;
      if (form) {
        var rect = form.getBoundingClientRect();
        formVisible = rect.top < window.innerHeight * 0.9 && rect.bottom > 0;
      }
      sticky.classList.toggle('show', y > 650 && !formVisible);
    };
    window.addEventListener('scroll', updateSticky, { passive: true });
    updateSticky();
  }

  /* ---------- year ---------- */
  Array.prototype.forEach.call(document.querySelectorAll('[data-year]'), function (el) {
    el.textContent = String(new Date().getFullYear());
  });
})();
