(function () {
  var PRESETS = { strom: [1500, 2500, 3500, 4500, 6000], gas: [8000, 12000, 18000, 23000, 30000] };
  var euro = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

  var modeBtn = document.getElementById('mode');
  var locateBtn = document.getElementById('locate');
  var locateSub = document.getElementById('locate-sub');
  var plzEl = document.getElementById('plz');
  var ortEl = document.getElementById('ort');
  var kwhEl = document.getElementById('kwh');
  var aktuellEl = document.getElementById('aktuell');
  var abschlagEl = document.getElementById('abschlag');
  var presetsEl = document.getElementById('presets');
  var statusEl = document.getElementById('status');
  var heroEl = document.getElementById('hero');
  var heroLabel = document.getElementById('hero-label');
  var subsaveEl = document.getElementById('subsave');
  var kicker = document.getElementById('result-kicker');
  var compareEl = document.getElementById('compare');
  var nowEl = document.getElementById('now');
  var nextEl = document.getElementById('next');
  var deltaEl = document.getElementById('delta');
  var offerEl = document.getElementById('offer');
  var metaEl = document.getElementById('meta');
  var altsEl = document.getElementById('alts');
  var platzEl = document.getElementById('platz');
  var anbieterEl = document.getElementById('anbieter');

  var pickedId = '';
  var sparte = 'strom';
  var watchId = null;
  var standortOn = false;
  var lastFix = '';
  var lastPlz = '';
  var timer = null;

  function money(value) {
    var text = String(value || '').trim().replace(/\s/g, '').replace('€', '');
    if (!text) return null;
    if (text.indexOf(',') >= 0) text = text.replace(/\./g, '').replace(',', '.');
    var n = Number(text);
    return Number.isFinite(n) ? n : null;
  }

  function setStatus(text) {
    statusEl.textContent = text;
  }

  function renderPresets() {
    presetsEl.innerHTML = '';
    PRESETS[sparte].forEach(function (value) {
      var button = document.createElement('button');
      button.type = 'button';
      button.textContent = value.toLocaleString('de-DE');
      if (String(value) === kwhEl.value) button.className = 'is-on';
      button.addEventListener('click', function () {
        kwhEl.value = String(value);
        renderPresets();
        schedule();
      });
      presetsEl.appendChild(button);
    });
  }

  function paint(data, rate) {
    if (!rate) {
      platzEl.textContent = '';
      anbieterEl.textContent = '';
      heroEl.textContent = '—';
      heroEl.classList.add('is-flat');
      kicker.textContent = 'Ersparnis';
      heroLabel.textContent = data && data.scanned
        ? 'Kein Tarif mit 24 Monaten und mind. 150 € Provision.'
        : 'Noch kein Tarif';
      subsaveEl.textContent = '';
      compareEl.hidden = true;
      offerEl.textContent = data
        ? data.scanned + ' gelesen · ' + (data.ohne24 || 0) + ' ohne 24 Monate ausgeblendet · ' + (data.hidden || 0) + ' unter 150 €'
        : '';
      metaEl.textContent = data && data.felder && data.felder.length ? 'Felder: ' + data.felder.join(', ') : '';
      altsEl.innerHTML = '';
      return;
    }
    var list = tariffList(data);
    var platz = rate.platz || (list.findIndex(function (item) { return item.id === rate.id; }) + 1);
    var aktuell = money(aktuellEl.value);
    var abschlag = money(abschlagEl.value);
    var jahr = rate.jahrespreis;
    var neuMonat = jahr / 12;
    var jetztMonat = abschlag != null ? abschlag : (aktuell == null ? null : aktuell / 12);
    var save = aktuell == null ? null : aktuell - jahr;
    var month = save == null ? null : save / 12;
    var over24 = save == null ? null : save * 2;
    platzEl.textContent = 'Platz ' + platz + ' von ' + list.length;
    anbieterEl.textContent = rate.anbieter || rate.name;
    heroEl.classList.toggle('is-flat', save == null || save <= 0);
    kicker.textContent = save != null && save > 0 ? 'Ersparnis' : 'Neuer Preis';
    if (save != null && save > 0) {
      var pct = aktuell > 0 ? Math.round((save / aktuell) * 100) : 0;
      heroEl.textContent = euro.format(save);
      heroLabel.textContent = 'weniger im Jahr' + (pct ? ' · ' + pct + ' %' : '');
      subsaveEl.textContent = euro.format(month) + ' weniger im Monat · ' + euro.format(over24) + ' über 24 Monate';
    } else if (save != null) {
      heroEl.textContent = euro.format(jahr);
      heroLabel.textContent = 'kein Preisvorteil gegen die aktuellen Kosten';
      subsaveEl.textContent = euro.format(neuMonat) + ' im Monat';
    } else {
      heroEl.textContent = euro.format(jahr);
      heroLabel.textContent = 'im Jahr. Oben eintragen, was der Kunde jetzt zahlt.';
      subsaveEl.textContent = euro.format(neuMonat) + ' im Monat';
    }
    compareEl.hidden = false;
    nowEl.textContent = aktuell == null ? '—' : euro.format(aktuell);
    nextEl.textContent = euro.format(jahr);
    deltaEl.textContent = save == null ? '—' : euro.format(save);
    nowEl.parentNode.querySelector('span').textContent = jetztMonat == null ? 'Zahlt jetzt' : 'Zahlt jetzt · ' + euro.format(jetztMonat) + '/Monat';
    nextEl.parentNode.querySelector('span').textContent = 'Neuer Preis · ' + euro.format(neuMonat) + '/Monat';
    deltaEl.parentNode.querySelector('span').textContent = month == null ? 'Ersparnis' : 'Ersparnis · ' + euro.format(month) + '/Monat';
    offerEl.textContent = rate.name + ' · 24 Monate Preisgarantie';
    var bits = [];
    if (rate.arbeitspreisCt != null) bits.push(rate.arbeitspreisCt.toLocaleString('de-DE', { maximumFractionDigits: 2 }) + ' ct');
    if (rate.grundpreisJahr != null) bits.push(Math.round(rate.grundpreisJahr) + ' € Grundpreis/Jahr');
    if (rate.bonusEuro) bits.push(Math.round(rate.bonusEuro) + ' € Bonus');
    bits.push(Math.round(rate.provisionEuro) + ' € Provision');
    metaEl.textContent = bits.join(' · ');
    altsEl.innerHTML = '';
    list.forEach(function (alt) {
      var button = document.createElement('button');
      button.type = 'button';
      if (alt.id === rate.id) button.className = 'is-on';
      var altSave = aktuell == null ? '' : ' · ' + euro.format(aktuell - alt.jahrespreis);
      button.innerHTML = '<span>Platz ' + alt.platz + altSave + '</span>' + (alt.anbieter || alt.name) + ' · ' + euro.format(alt.jahrespreis);
      button.addEventListener('click', function () {
        pickedId = alt.id;
        paint(data, alt);
      });
      altsEl.appendChild(button);
    });
  }

  function tariffList(data) {
    if (!data) return [];
    if (data.tarife && data.tarife.length) return data.tarife;
    return data.best ? [data.best].concat(data.alternativen || []) : [];
  }

  function poll(force) {
    var plz = plzEl.value.trim();
    var kwh = Number(kwhEl.value);
    if (!/^\d{5}$/.test(plz) || !kwh) {
      setStatus('PLZ und Verbrauch fehlen noch.');
      return;
    }
    setStatus(force ? 'Tarife werden aus dem Portal geholt …' : 'Tarife werden geprüft …');
    var params = new URLSearchParams({
      sparte: sparte,
      plz: plz,
      kwh: String(Math.round(kwh)),
      ort: ortEl.value.trim()
    });
    var aktuell = money(aktuellEl.value);
    if (aktuell != null) params.set('aktuell', String(aktuell));
    if (force) params.set('frisch', '1');
    fetch('/api/tuer?' + params.toString())
      .then(function (r) { return r.json().then(function (body) { return { ok: r.ok, status: r.status, body: body }; }); })
      .then(function (res) {
        if (!res.ok || !res.body.ok) {
          setStatus(messageFor(res.body.error));
          paint(null, null);
          return;
        }
        var list = tariffList(res.body);
        var rate = list.filter(function (item) { return item.id === pickedId; })[0] || list[0];
        if (rate) pickedId = rate.id;
        paint(res.body, rate || null);
        var when = res.body.syncedAt ? new Date(res.body.syncedAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) : '';
        setStatus(
          (res.body.qualified || 0) + ' Tarife mit 24 Monaten und ab 150 €' +
          (res.body.ohne24 ? ' · ' + res.body.ohne24 + ' kürzere Garantie weg' : '') +
          (when ? ' · ' + when : '') +
          (standortOn ? ' · Standort läuft' : '')
        );
      })
      .catch(function () {
        setStatus('Portal gerade nicht erreichbar.');
      });
  }

  function messageFor(code) {
    var map = {
      mfa_required: 'Portal will einen Code. Im Admin auf Verbinden, Code in Telegram antworten.',
      mfa_timeout: 'Der Telegram-Code kam nicht rechtzeitig. Im Admin neu verbinden.',
      mfa_rejected: 'Portal-Code abgelehnt. Neueste Mail nutzen.',
      portal_credentials_missing: 'Im Server fehlen die Portal-Zugangsdaten.',
      login_failed: 'Portal-Login fehlgeschlagen.',
      portal_nicht_verbunden: 'Zuerst im Admin verbinden.',
      keine_plz: 'Zur Position wurde keine PLZ gefunden.',
      standort_lookup: 'Standort konnte nicht in eine PLZ übersetzt werden.',
      zu_viele_anfragen: 'Kurz warten, dann nochmal.'
    };
    return map[code] || 'Abruf fehlgeschlagen.';
  }

  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(function () { poll(false); }, 450);
  }

  function applyPlace(place) {
    if (!place || !place.plz) return;
    plzEl.value = place.plz;
    if (place.ort) ortEl.value = place.ort;
    if (place.plz !== lastPlz) {
      lastPlz = place.plz;
      pickedId = '';
      poll(true);
    }
  }

  function lookup(pos) {
    fetch('/api/tuer/standort', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lat: pos.coords.latitude, lon: pos.coords.longitude })
    })
      .then(function (r) { return r.json(); })
      .then(function (body) {
        if (!body.ok) {
          setStatus(messageFor(body.error));
          return;
        }
        applyPlace(body);
      })
      .catch(function () {
        setStatus('Standort-Dienst nicht erreichbar.');
      });
  }

  function onPosition(pos) {
    var key = pos.coords.latitude.toFixed(3) + ',' + pos.coords.longitude.toFixed(3);
    if (key === lastFix) return;
    lastFix = key;
    setStatus('Standort da, PLZ wird gesetzt …');
    lookup(pos);
  }

  function onPositionError() {
    setStatus('Standort abgelehnt. In den Tablet-Einstellungen Ortung für den Browser erlauben.');
    standortOn = false;
    locateBtn.classList.remove('is-on');
    locateSub.textContent = 'Tippen, dann läuft die Position mit';
  }

  locateBtn.addEventListener('click', function () {
    if (!navigator.geolocation) {
      setStatus('Dieses Tablet liefert keinen Standort.');
      return;
    }
    if (standortOn) {
      if (watchId != null) navigator.geolocation.clearWatch(watchId);
      watchId = null;
      standortOn = false;
      locateBtn.classList.remove('is-on');
      locateSub.textContent = 'Tippen, dann läuft die Position mit';
      return;
    }
    standortOn = true;
    locateBtn.classList.add('is-on');
    locateSub.textContent = 'Läuft mit. Nochmal tippen zum Stoppen.';
    setStatus('Standort wird geholt …');
    watchId = navigator.geolocation.watchPosition(onPosition, onPositionError, {
      enableHighAccuracy: true,
      maximumAge: 20000,
      timeout: 15000
    });
  });

  document.querySelectorAll('[data-sparte]').forEach(function (button) {
    button.addEventListener('click', function () {
      sparte = button.getAttribute('data-sparte');
      document.querySelectorAll('[data-sparte]').forEach(function (item) {
        item.classList.toggle('is-on', item === button);
      });
      if (!kwhEl.value || PRESETS[sparte === 'gas' ? 'strom' : 'gas'].indexOf(Number(kwhEl.value)) >= 0) {
        kwhEl.value = sparte === 'gas' ? '18000' : '3500';
      }
      renderPresets();
      pickedId = '';
      schedule();
    });
  });

  abschlagEl.addEventListener('input', function () {
    var month = money(abschlagEl.value);
    if (month != null) aktuellEl.value = String(Math.round(month * 12));
    schedule();
  });
  [plzEl, ortEl, kwhEl, aktuellEl].forEach(function (el) {
    el.addEventListener('input', schedule);
  });

  modeBtn.addEventListener('click', function () {
    var on = document.body.classList.toggle('is-kunde');
    modeBtn.textContent = on ? 'Berater' : 'Kunde zeigen';
  });

  renderPresets();
})();
