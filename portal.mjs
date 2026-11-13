import { telegramEnabled, requestCode, sendMessage } from './telegram.mjs';

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
  let jar = null;

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
      if (!telegramEnabled()) throw new Error('mfa_required');
      const code = await requestCode(
        'E1 Portal (Versuch ' + attempt + '/2): Der Code geht an gigaconnectvertrieb@gmail.com (auch Spam prüfen). Bitte NUR die 6 Ziffern aus der neuesten Mail senden. Alte Codes sind ungültig.'
      );
      if (!code) throw new Error('mfa_timeout');
      await sendMessage('E1 Portal: Code empfangen, wird geprüft …').catch(function () {});

      const confirmed = await request(result.url || base + '/', {
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
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        return await loginAttempt(attempt);
      } catch (err) {
        lastError = err;
        if (err.message === 'mfa_rejected' && attempt === 1) {
          await sendMessage(
            'E1 Portal: Code abgelehnt. Neuer Code wird angefordert — bitte die neueste E-Mail nutzen.'
          ).catch(function () {});
          continue;
        }
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
      connected,
      connectedAt: await store.getSetting('portal_connected_at'),
      lastSync: await store.getSetting('portal_last_sync'),
      lastUrl: await store.getSetting('portal_last_url'),
      base,
      tariffPath: path
    };
  }

  return {
    status,
    ensure,
    fetchPage,
    login,
    hasMfa,
    isLoggedIn
  };
}
