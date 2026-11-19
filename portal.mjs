import { telegramEnabled, requestCode, sendMessage } from './telegram.mjs';
import { rankRates, MIN_PROVISION } from './rates.mjs';

const DEFAULT_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'de-DE,de;q=0.9,en;q=0.6'
};

function parseSetCookie(header) {
  const first = header.split(';')[0];
  const idx = first.indexOf('=');
  if (idx < 1) return null;
  return [first.slice(0, idx).trim(), first.slice(idx + 1).trim()];
}

function cookieHeader(jar) {
  return Object.entries(jar)
    .map(function (entry) { return entry[0] + '=' + entry[1]; })
    .join('; ');
}

export function createPortal({ store, baseUrl, user, pass, tariffPath }) {
  const base = String(baseUrl || '').replace(/\/+$/, '');
  const path = tariffPath || '/tarifrechner/';
  const maxAttempts = Math.max(1, Number(process.env.TG_MFA_ATTEMPTS || 1));
  let jar = null;
  let pendingResolve = null;
  let pendingCode = null;

  function takePendingCode(code) {
    const clean = String(code || '').replace(/\D/g, '');
    if (!/^\d{6}$/.test(clean)) return false;
    if (pendingResolve) {
      const resolve = pendingResolve;
      pendingResolve = null;
      resolve(clean);
      return true;
    }
    pendingCode = clean;
    return true;
  }

  async function request(url, options) {
    const opts = options || {};
    let current = url;
    let method = opts.method || 'GET';
    let body = opts.body || null;
    const jarRef = opts.jar;
    const redirects = opts.redirects == null ? 6 : opts.redirects;

    for (let i = 0; i <= redirects; i += 1) {
      const headers = { ...DEFAULT_HEADERS };
      if (Object.keys(jarRef).length) headers.Cookie = cookieHeader(jarRef);
      if (body != null) headers['Content-Type'] = 'application/x-www-form-urlencoded';

      const res = await fetch(current, {
        method,
        headers,
        body,
        redirect: 'manual',
        signal: AbortSignal.timeout(30000)
      });

      const setCookies = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
      for (const header of setCookies) {
        const pair = parseSetCookie(header);
        if (pair) jarRef[pair[0]] = pair[1];
      }

      if ([301, 302, 303, 307, 308].includes(res.status)) {
        const location = res.headers.get('location');
        if (!location) {
          return { status: res.status, url: current, html: await res.text() };
        }
        current = new URL(location, current).toString();
        if (res.status === 303 || (res.status === 302 && method === 'POST')) {
          method = 'GET';
          body = null;
        }
        continue;
      }

      return { status: res.status, url: current, html: await res.text() };
    }
    throw new Error('too_many_redirects');
  }

  function hasMfa(html) {
    return /MFA-Authentication|Best(ä|ae)tigungscode/i.test(html || '');
  }

  function isLoggedIn(html) {
    return !hasMfa(html) && /Abmelden|Tarifrechner|B(ü|ue)ro/i.test(html || '');
  }

  async function saveJar(nextJar) {
    jar = nextJar;
    await store.setSetting('portal_cookies', JSON.stringify(nextJar));
    await store.setSetting('portal_connected_at', new Date().toISOString());
  }

  async function loadJar() {
    if (jar) return jar;
    const raw = await store.getSetting('portal_cookies');
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      if (parsed && Object.keys(parsed).length) {
        jar = parsed;
        return jar;
      }
    } catch {}
    return null;
  }

  async function loginAttempt(attempt) {
    if (!user || !pass) throw new Error('portal_credentials_missing');
    if (!base) throw new Error('portal_url_missing');

    const nextJar = {};
    await request(base + '/', { jar: nextJar });

    const form = new URLSearchParams({
      user,
      pass,
      submit: 'Anmelden',
      logintype: 'login',
      pid: '6',
      redirect_url: base + '/buero/',
      'tx_felogin_pi1[noredirect]': '0'
    });

    const result = await request(base + '/', {
      method: 'POST',
      body: form.toString(),
      jar: nextJar
    });

    if (hasMfa(result.html)) {
      const page = result;
      const note = 'Portal hat einen Code an gigaconnectvertrieb@gmail.com geschickt. Nur diese 6 Ziffern antworten oder im Admin eintragen.';

      const fromTelegram = telegramEnabled()
        ? requestCode(
            'E1: ' + note + ' Nur die 6 Ziffern aus der neuesten Mail an gigaconnectvertrieb@gmail.com antworten. Oder den Code im Admin eintragen.'
          ).catch(function () { return new Promise(function () {}); })
        : new Promise(function () {});
      const fromAdmin = pendingCode
        ? Promise.resolve(pendingCode)
        : new Promise(function (resolve) { pendingResolve = resolve; });
      pendingCode = null;
      const code = await Promise.race([
        fromTelegram,
        fromAdmin,
        new Promise(function (resolve) { setTimeout(function () { resolve(null); }, 10 * 60 * 1000); })
      ]);
      pendingResolve = null;
      if (!code) throw new Error('mfa_timeout');
      await sendMessage('E1 Portal: Code empfangen, wird geprüft …').catch(function () {});

      const confirmed = await request(page.url || result.url || base + '/', {
        method: 'POST',
        body: new URLSearchParams({ code }).toString(),
        jar: nextJar
      });

      if (hasMfa(confirmed.html)) {
        const errMatch = confirmed.html.match(/Der eingegebene[^<]{0,160}/i);
        console.error('portal mfa:', errMatch ? errMatch[0] : 'rejected');
        throw new Error('mfa_rejected');
      }
      if (!isLoggedIn(confirmed.html)) throw new Error('login_failed');

      await saveJar(nextJar);
      await sendMessage('E1 Portal verbunden.').catch(function () {});
      return { jar: nextJar, status: confirmed.status, url: confirmed.url, html: confirmed.html };
    }

    if (!isLoggedIn(result.html)) throw new Error('login_failed');

    await saveJar(nextJar);
    return { jar: nextJar, status: result.status, url: result.url, html: result.html };
  }

  async function login() {
    let lastError = null;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        return await loginAttempt(attempt);
      } catch (err) {
        lastError = err;
        if (err.message === 'mfa_rejected') {
          await sendMessage(
            'E1 Portal: Code abgelehnt. Bitte im Admin neu verbinden und die neueste E-Mail nutzen.'
          ).catch(function () {});
        }
        if (err.message === 'mfa_rejected' && attempt < maxAttempts) continue;
        throw err;
      }
    }
    throw lastError || new Error('login_failed');
  }

  async function ensure() {
    const existing = await loadJar();
    if (!existing) return login();

    const check = await request(base + path, { jar: existing });
    if (check.status === 200 && !hasMfa(check.html) && isLoggedIn(check.html)) {
      return { jar: existing, status: check.status, url: check.url, html: check.html };
    }

    jar = null;
    await store.setSetting('portal_cookies', '');
    return login();
  }

  async function importSession(nextJar) {
    if (!nextJar || typeof nextJar !== 'object' || !nextJar.fe_typo_user) {
      throw new Error('session_missing');
    }
    const check = await request(base + '/buero/', { jar: nextJar });
    if (hasMfa(check.html) || !isLoggedIn(check.html)) throw new Error('session_rejected');
    await saveJar(nextJar);
    return { url: check.url, status: check.status };
  }

  async function fetchPage(targetPath) {
    const session = await ensure();
    const page = await request(base + (targetPath || path), { jar: session.jar });
    if (hasMfa(page.html)) throw new Error('mfa_required');
    return page;
  }

  async function status() {
    const connected = Boolean(await loadJar());
    return {
      enabled: Boolean(base && user && pass),
      telegram: telegramEnabled(),
      awaitingCode: Boolean(pendingResolve),
      connected,
      connectedAt: await store.getSetting('portal_connected_at'),
      lastSync: await store.getSetting('portal_last_sync'),
      lastUrl: await store.getSetting('portal_last_url'),
      base,
      tariffPath: path
    };
  }

  function extractRequestParameter(html) {
    const match = String(html || '').match(/requestParameter["']?\s*[:=]\s*["']([A-Za-z0-9_]+)["']/);
    return match ? match[1] : null;
  }

  function extractCsrf(html) {
    const source = String(html || '');
    const named = source.match(/name=["']csrf-token["'][^>]*content=["']([^"']+)["']/i);
    if (named) return named[1];
    const reversed = source.match(/content=["']([^"']+)["'][^>]*name=["']csrf-token["']/i);
    return reversed ? reversed[1] : '';
  }

  function extractResellerHash(html) {
    const match = String(html || '').match(/reseller[_-]?hash["']?\s*[:=]\s*["']([A-Za-z0-9_-]+)["']/i);
    return match ? match[1] : '';
  }

  async function postEgon(jar, eID, fields, csrf) {
    const url =
      base +
      '/?eID=' +
      encodeURIComponent(eID) +
      (csrf ? '&HTTP_CSRFTOKEN=' + encodeURIComponent(csrf) : '');
    const body = new URLSearchParams();
    for (const [key, value] of Object.entries(fields)) {
      if (value == null) continue;
      body.set(key, String(value));
    }
    const result = await request(url, { method: 'POST', body: body.toString(), jar });
    let data = null;
    try {
      data = JSON.parse(result.html);
    } catch {}
    return { status: result.status, url: result.url, data, html: result.html };
  }

  async function discoverPortal(jar) {
    const candidates = [path, '/buero/', '/dashboard/', '/main-menu-right/dashboard/', '/'];
    const seen = new Set();
    let html = '';
    let pageUrl = '';
    for (const candidate of candidates) {
      if (!candidate || seen.has(candidate)) continue;
      seen.add(candidate);
      try {
        const page = await request(base + candidate, { jar });
        if (!page.html) continue;
        html = page.html;
        pageUrl = page.url;
        if (extractRequestParameter(page.html)) break;
      } catch {}
    }
    return { html, url: pageUrl };
  }

  async function calculateRates({ sparte, plz, kwh, city, minProvision }) {
    const session = await ensure();
    const found = await discoverPortal(session.jar);
    const csrf = extractCsrf(found.html);
    const hash = extractResellerHash(found.html);
    const parameter = extractRequestParameter(found.html);
    const eids = parameter
      ? [parameter, 'tx_egon_pi1', 'egon'].filter((item, index, all) => all.indexOf(item) === index)
      : ['tx_egon_pi1', 'egon', 'egon_pi1'];

    const payload = {
      todo: 'getRateData',
      order_type: sparte === 'gas' ? 'gas' : 'electric',
      customer_type: 'private',
      country_id: '81',
      zip: plz,
      city: city || '',
      street: '',
      street_number: '',
      consum: String(Math.round(kwh)),
      consum_nt: '0',
      netz_id: '',
      counter_type: '',
      rate_type: '0'
    };
    if (hash) payload.rHash = hash;

    let lastError = 'tarifrechner_unerreichbar';
    let sampleKeys = [];
    for (const eid of eids) {
      const res = await postEgon(session.jar, eid, payload, csrf);
      const data = res.data;
      if (!data || typeof data !== 'object') continue;
      const list = Array.isArray(data.getRateData) ? data.getRateData : null;
      if (list) {
        const ranked = rankRates(list, minProvision || MIN_PROVISION);
        await store.setSetting('portal_last_sync', new Date().toISOString());
        await store.setSetting('portal_last_url', res.url || found.url || '');
        return { ...ranked, eID: eid, error: null };
      }
      if (data.success === false || data.error) {
        const message = Array.isArray(data.error) ? data.error.join(' ') : String(data.error || data.message || '');
        lastError = message || 'tarifrechner_fehler';
        if (data.getRateData && typeof data.getRateData === 'object') {
          sampleKeys = Object.keys(data.getRateData).slice(0, 40);
        }
        if (/unknown|unbekannt|todo/i.test(lastError)) continue;
        break;
      }
    }

    return {
      qualified: [],
      hidden: 0,
      unknown: 0,
      scanned: 0,
      sampleKeys,
      eID: null,
      error: lastError
    };
  }

  return {
    status,
    ensure,
    fetchPage,
    login,
    importSession,
    submitCode: takePendingCode,
    hasMfa,
    isLoggedIn,
    calculateRates
  };
}
