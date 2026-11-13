(function () {
  'use strict';

  var STATUS = ['neu', 'kontaktiert', 'angebot', 'gewonnen', 'verloren', 'spam'];
  var STATUS_LABEL = {
    neu: 'Neu',
    kontaktiert: 'Kontaktiert',
    angebot: 'Angebot',
    gewonnen: 'Gewonnen',
    verloren: 'Verloren',
    spam: 'Spam'
  };
  var nf = new Intl.NumberFormat('de-DE');
  var eur = new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0
  });

  var loginEl = document.getElementById('login');
  var dashEl = document.getElementById('dashboard');
  var loginForm = document.getElementById('login-form');
  var loginStatus = document.getElementById('login-status');
  var filtersForm = document.getElementById('filters');
  var tbody = document.getElementById('leads-body');
  var emptyEl = document.getElementById('empty');
  var storageInfo = document.getElementById('storage-info');
  var dialog = document.getElementById('lead-dialog');
  var dialogTitle = document.getElementById('dialog-title');
  var dialogDetails = document.getElementById('dialog-details');
  var dialogNote = document.getElementById('dialog-note');
  var dialogStatusSel = document.getElementById('dialog-status-sel');
  var dialogStatus = document.getElementById('dialog-status');
  var dialogSave = document.getElementById('dialog-save');
  var currentLead = null;

  function showLogin() {
    loginEl.hidden = false;
    dashEl.hidden = true;
  }

  function showDash() {
    loginEl.hidden = true;
    dashEl.hidden = false;
    loadPortalStatus();
  }

  function currentFilters() {
    var fd = new FormData(filtersForm);
    var p = new URLSearchParams();
    ['status', 'typ', 'produkt', 'q'].forEach(function (key) {
      var v = (fd.get(key) || '').toString().trim();
      if (v) p.set(key, v);
    });
    return p;
  }

  function loadLeads() {
    var p = currentFilters();
    return fetch('/api/leads?' + p.toString(), { credentials: 'same-origin' })
      .then(function (r) {
        if (r.status === 401) {
          showLogin();
          throw new Error('auth');
        }
        return r.json();
      })
      .then(function (data) {
        if (!data.ok) throw new Error('load');
        renderStats(data.counts || {});
        renderTable(data.leads || []);
      })
      .catch(function (err) {
        if (err.message !== 'auth') {
          emptyEl.hidden = false;
          emptyEl.textContent = 'Leads konnten nicht geladen werden.';
        }
      });
  }

  function renderStats(counts) {
    var total = 0;
    Object.keys(counts).forEach(function (k) { total += counts[k]; });
    document.getElementById('stat-total').textContent = String(total);
    STATUS.forEach(function (s) {
      if (s === 'spam') return;
      var el = document.getElementById('stat-' + s);
      if (el) el.textContent = String(counts[s] || 0);
    });
  }

  function cell(text, className) {
    var td = document.createElement('td');
    if (className) td.className = className;
    td.textContent = text === null || text === undefined ? '' : String(text);
    return td;
  }

  function priceOf(lead) {
    try {
      var k = JSON.parse(lead.kalkulation_json || '{}');
      if (typeof k.jahrespreis === 'number') return eur.format(k.jahrespreis);
    } catch (e) {}
    return '—';
  }

  function renderTable(leads) {
    tbody.innerHTML = '';
    emptyEl.hidden = leads.length > 0;
    emptyEl.textContent = 'Keine Leads für diese Filter.';

    leads.forEach(function (lead) {
      var tr = document.createElement('tr');
      tr.appendChild(cell(lead.id, 'muted'));
      tr.appendChild(cell(new Date(lead.created_at).toLocaleString('de-DE')));
      tr.appendChild(cell(lead.typ === 'gewerbe' ? 'Gewerbe' : 'Privat'));
      tr.appendChild(cell(lead.produkt === 'gas' ? 'Gas' : 'Strom'));

      var name = [lead.vorname, lead.nachname].filter(Boolean).join(' ');
      var nameCell = document.createElement('td');
      var strong = document.createElement('div');
      strong.textContent = name;
      nameCell.appendChild(strong);
      if (lead.firma) {
        var firm = document.createElement('div');
        firm.className = 'tiny';
        firm.textContent = lead.firma;
        nameCell.appendChild(firm);
      }
      if (lead.upload_id) {
        var tag = document.createElement('span');
        tag.className = 'pdf-tag';
        tag.textContent = 'PDF';
        nameCell.appendChild(tag);
      }
      tr.appendChild(nameCell);

      var contact = document.createElement('td');
      var mail = document.createElement('a');
      mail.href = 'mailto:' + lead.email;
      mail.textContent = lead.email;
      contact.appendChild(mail);
      if (lead.telefon) {
        var tel = document.createElement('div');
        tel.className = 'tiny';
        tel.textContent = lead.telefon;
        contact.appendChild(tel);
      }
      tr.appendChild(contact);

      tr.appendChild(cell([lead.plz, lead.ort].filter(Boolean).join(' ')));
      tr.appendChild(cell(lead.verbrauch_kwh ? nf.format(lead.verbrauch_kwh) + ' kWh' : '—'));
      tr.appendChild(cell(priceOf(lead)));

      var statusCell = document.createElement('td');
      var sel = document.createElement('select');
      sel.className = 'row-status';
      STATUS.forEach(function (s) {
        var opt = document.createElement('option');
        opt.value = s;
        opt.textContent = STATUS_LABEL[s];
        if (s === lead.status) opt.selected = true;
        sel.appendChild(opt);
      });
      sel.addEventListener('change', function () {
        patchLead(lead.id, { status: sel.value }).then(loadLeads).catch(function () {
          sel.value = lead.status;
        });
      });
      statusCell.appendChild(sel);
      tr.appendChild(statusCell);

      var actionCell = document.createElement('td');
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn btn-ghost btn-sm';
      btn.textContent = 'Details';
      btn.addEventListener('click', function () { openDialog(lead); });
      actionCell.appendChild(btn);
      tr.appendChild(actionCell);

      tbody.appendChild(tr);
    });
  }

  function detail(label, value) {
    var wrap = document.createElement('div');
    wrap.className = 'detail';
    var l = document.createElement('span');
    l.textContent = label;
    var v = document.createElement('div');
    v.textContent = value === null || value === undefined || value === '' ? '—' : String(value);
    wrap.appendChild(l);
    wrap.appendChild(v);
    return wrap;
  }

  function openDialog(lead) {
    currentLead = lead;
    dialogTitle.textContent = 'Lead #' + lead.id;
    dialogDetails.innerHTML = '';

    var pairs = [
      ['Erstellt', new Date(lead.created_at).toLocaleString('de-DE')],
      ['Typ', lead.typ === 'gewerbe' ? 'Gewerbe' : 'Privat'],
      ['Produkt', lead.produkt === 'gas' ? 'Gas' : 'Strom'],
      ['Anrede', lead.anrede],
      ['Vorname', lead.vorname],
      ['Nachname', lead.nachname],
      ['Firma', lead.firma],
      ['USt-IdNr.', lead.ustid],
      ['E-Mail', lead.email],
      ['Telefon', lead.telefon],
      ['PLZ', lead.plz],
      ['Ort', lead.ort],
      ['Straße', lead.strasse],
      ['Hausnummer', lead.hausnummer],
      ['Verbrauch', lead.verbrauch_kwh ? nf.format(lead.verbrauch_kwh) + ' kWh' : ''],
      ['Standorte', lead.anzahl_standorte],
      ['Aktueller Anbieter', lead.aktueller_anbieter],
      ['Preis / Jahr', priceOf(lead)],
      ['Quelle', lead.quelle],
      ['Nachricht', lead.nachricht]
    ];
    pairs.forEach(function (p) {
      dialogDetails.appendChild(detail(p[0], p[1]));
    });

    if (lead.upload_id) {
      var uploadWrap = document.createElement('div');
      uploadWrap.className = 'detail';
      var uploadLabel = document.createElement('span');
      uploadLabel.textContent = 'Rechnung';
      var uploadValue = document.createElement('div');
      var uploadLink = document.createElement('a');
      uploadLink.href = '/api/uploads/' + encodeURIComponent(lead.upload_id);
      uploadLink.target = '_blank';
      uploadLink.rel = 'noopener';
      uploadLink.textContent = lead.upload_name || 'PDF öffnen';
      uploadValue.appendChild(uploadLink);
      uploadWrap.appendChild(uploadLabel);
      uploadWrap.appendChild(uploadValue);
      dialogDetails.appendChild(uploadWrap);
    }

    dialogNote.value = lead.notiz || '';
    dialogStatusSel.value = lead.status || 'neu';
    dialogStatus.className = 'form-status';
    dialogStatus.textContent = '';
    dialog.showModal();
  }

  function patchLead(id, body) {
    return fetch('/api/leads/' + id, {
      method: 'PATCH',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }).then(function (r) {
      if (r.status === 401) {
        showLogin();
        throw new Error('auth');
      }
      if (!r.ok) throw new Error('patch');
      return r.json();
    });
  }

  if (loginForm) {
    loginForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var token = document.getElementById('admin-token').value;
      loginStatus.className = 'form-status';
      loginStatus.textContent = '';
      fetch('/api/admin/login', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: token })
      })
        .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, body: j }; }); })
        .then(function (res) {
          if (res.ok && res.body.ok) {
            showDash();
            storageInfo.textContent = 'Storage: ' + (res.body.storage || 'postgres');
            loadLeads();
          } else {
            loginStatus.className = 'form-status error';
            loginStatus.textContent = 'Token ungültig.';
          }
        })
        .catch(function () {
          loginStatus.className = 'form-status error';
          loginStatus.textContent = 'Verbindung fehlgeschlagen.';
        });
    });
  }

  filtersForm.addEventListener('submit', function (e) {
    e.preventDefault();
    loadLeads();
  });

  var searchTimer = null;
  filtersForm.addEventListener('input', function (e) {
    if (e.target.name !== 'q') return;
    clearTimeout(searchTimer);
    searchTimer = setTimeout(loadLeads, 300);
  });

  document.getElementById('refresh').addEventListener('click', loadLeads);

  document.getElementById('logout').addEventListener('click', function () {
    fetch('/api/admin/logout', { method: 'POST', credentials: 'same-origin' }).finally(function () {
      showLogin();
    });
  });

  document.getElementById('dialog-close').addEventListener('click', function () {
    dialog.close();
  });

  dialogSave.addEventListener('click', function () {
    if (!currentLead) return;
    dialogSave.disabled = true;
    dialogStatus.className = 'form-status';
    dialogStatus.textContent = '';
    patchLead(currentLead.id, {
      status: dialogStatusSel.value,
      notiz: dialogNote.value
    })
      .then(function () {
        dialogStatus.className = 'form-status success';
        dialogStatus.textContent = 'Gespeichert.';
        return loadLeads();
      })
      .then(function () {
        setTimeout(function () { dialog.close(); }, 400);
      })
      .catch(function () {
        dialogStatus.className = 'form-status error';
        dialogStatus.textContent = 'Speichern fehlgeschlagen.';
      })
      .finally(function () {
        dialogSave.disabled = false;
      });
  });

  /* ---------- portal ---------- */
  var portalStatusEl = document.getElementById('portal-status');
  var portalConnect = document.getElementById('portal-connect');
  var portalSync = document.getElementById('portal-sync');
  var portalPage = document.getElementById('portal-page');

  function fmtDate(iso) {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleString('de-DE');
    } catch (e) {
      return iso;
    }
  }

  function loadPortalStatus() {
    if (!portalStatusEl) return Promise.resolve();
    return fetch('/api/admin/portal/status', { credentials: 'same-origin' })
      .then(function (r) {
        if (r.status === 401) {
          showLogin();
          throw new Error('auth');
        }
        return r.json();
      })
      .then(function (data) {
        if (!data.ok) return;
        if (!data.enabled) {
          portalStatusEl.textContent = 'Zugangsdaten fehlen (TG_PORTAL_USER / TG_PORTAL_PASS).';
          if (portalConnect) portalConnect.disabled = true;
          if (portalSync) portalSync.disabled = true;
          return;
        }
        if (portalConnect) portalConnect.disabled = false;
        if (portalSync) portalSync.disabled = !data.connected;
        portalStatusEl.textContent = data.connected
          ? 'Verbunden seit ' + fmtDate(data.connectedAt) + ' · letzter Abruf: ' + fmtDate(data.lastSync)
          : 'Nicht verbunden · Telegram-MFA: ' + (data.telegram ? 'aktiv' : 'fehlt');
        if (portalPage) portalPage.hidden = !data.lastSync;
      })
      .catch(function () {});
  }

  if (portalConnect) {
    portalConnect.addEventListener('click', function () {
      portalConnect.disabled = true;
      if (portalSync) portalSync.disabled = true;
      portalStatusEl.textContent = 'Anmeldung läuft. Falls MFA verlangt wird, kommt der Code per Telegram.';
      fetch('/api/admin/portal/connect', { method: 'POST', credentials: 'same-origin' })
        .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, body: j }; }); })
        .then(function (res) {
          portalStatusEl.textContent = res.ok && res.body.ok
            ? 'Verbunden: ' + (res.body.title || res.body.url)
            : 'Fehler: ' + (res.body.error || 'unbekannt');
          return loadPortalStatus();
        })
        .catch(function () {
          portalStatusEl.textContent = 'Verbindung fehlgeschlagen.';
          portalConnect.disabled = false;
        });
    });
  }

  if (portalSync) {
    portalSync.addEventListener('click', function () {
      portalSync.disabled = true;
      portalStatusEl.textContent = 'Portal-Seite wird geladen …';
      fetch('/api/admin/portal/sync', { method: 'POST', credentials: 'same-origin' })
        .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, body: j }; }); })
        .then(function (res) {
          portalStatusEl.textContent = res.ok && res.body.ok
            ? 'Geladen: ' + (res.body.title || res.body.url) + ' · ' + res.body.bytes + ' Bytes'
            : 'Fehler: ' + (res.body.error || 'unbekannt');
          return loadPortalStatus();
        })
        .catch(function () {
          portalStatusEl.textContent = 'Abruf fehlgeschlagen.';
          portalSync.disabled = false;
        });
    });
  }

  fetch('/api/admin/session', { credentials: 'same-origin' })
    .then(function (r) { return r.json(); })
    .then(function (data) {
      if (data.ok) {
        showDash();
        storageInfo.textContent = 'Storage: ' + (data.storage || 'sqlite');
        loadLeads();
      } else {
        showLogin();
      }
    })
    .catch(function () {
      showLogin();
    });
})();
