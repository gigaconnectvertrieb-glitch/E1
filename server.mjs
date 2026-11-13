import http from 'node:http';
import path from 'node:path';
import crypto from 'node:crypto';
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, 'public');
const DATA_DIR = path.join(__dirname, 'data');
const CONFIG_FILE = path.join(__dirname, 'config', 'tariffs.json');
const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || '127.0.0.1';
const LEAD_WEBHOOK = process.env.E1_LEAD_WEBHOOK || '';
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const USE_POSTGRES = Boolean(process.env.DATABASE_URL);

await mkdir(DATA_DIR, { recursive: true });

const tariffs = JSON.parse(await readFile(CONFIG_FILE, 'utf8'));

let adminToken = process.env.E1_ADMIN_TOKEN || '';
if (!adminToken) {
  const tokenFile = path.join(DATA_DIR, 'admin-token.txt');
  try {
    adminToken = (await readFile(tokenFile, 'utf8')).trim();
  } catch {}
  if (!adminToken) {
    adminToken = crypto.randomBytes(24).toString('base64url');
    await writeFile(tokenFile, adminToken + '\n', { mode: 0o600 });
  }
}
if (adminToken.length < 16) {
  console.error('E1_ADMIN_TOKEN muss mindestens 16 Zeichen lang sein.');
  process.exit(1);
}

const LEAD_COLUMNS = [
  'created_at', 'typ', 'produkt', 'anrede', 'vorname', 'nachname', 'firma',
  'ustid', 'email', 'telefon', 'plz', 'ort', 'strasse', 'hausnummer',
  'verbrauch_kwh', 'anzahl_standorte', 'aktueller_anbieter', 'nachricht',
  'kalkulation_json', 'status', 'notiz', 'quelle', 'ip_hash', 'user_agent'
];

const CREATE_SQLITE = `
  CREATE TABLE IF NOT EXISTS leads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at TEXT NOT NULL,
    typ TEXT NOT NULL,
    produkt TEXT NOT NULL,
    anrede TEXT,
    vorname TEXT NOT NULL,
    nachname TEXT NOT NULL,
    firma TEXT,
    ustid TEXT,
    email TEXT NOT NULL,
    telefon TEXT,
    plz TEXT NOT NULL,
    ort TEXT,
    strasse TEXT,
    hausnummer TEXT,
    verbrauch_kwh INTEGER,
    anzahl_standorte INTEGER,
    aktueller_anbieter TEXT,
    nachricht TEXT,
    kalkulation_json TEXT,
    status TEXT NOT NULL DEFAULT 'neu',
    notiz TEXT,
    quelle TEXT,
    ip_hash TEXT,
    user_agent TEXT
  )
`;

const CREATE_PG = `
  CREATE TABLE IF NOT EXISTS leads (
    id SERIAL PRIMARY KEY,
    created_at TEXT NOT NULL,
    typ TEXT NOT NULL,
    produkt TEXT NOT NULL,
    anrede TEXT,
    vorname TEXT NOT NULL,
    nachname TEXT NOT NULL,
    firma TEXT,
    ustid TEXT,
    email TEXT NOT NULL,
    telefon TEXT,
    plz TEXT NOT NULL,
    ort TEXT,
    strasse TEXT,
    hausnummer TEXT,
    verbrauch_kwh INTEGER,
    anzahl_standorte INTEGER,
    aktueller_anbieter TEXT,
    nachricht TEXT,
    kalkulation_json TEXT,
    status TEXT NOT NULL DEFAULT 'neu',
    notiz TEXT,
    quelle TEXT,
    ip_hash TEXT,
    user_agent TEXT
  )
`;

function rowValues(value, kalkulation, meta) {
  return [
    new Date().toISOString(),
    value.typ,
    value.produkt,
    value.anrede,
    value.vorname,
    value.nachname,
    value.firma,
    value.ustid,
    value.email,
    value.telefon,
    value.plz,
    value.ort,
    value.strasse,
    value.hausnummer,
    value.verbrauch_kwh,
    value.anzahl_standorte,
    value.aktueller_anbieter,
    value.nachricht,
    JSON.stringify(kalkulation),
    'neu',
    null,
    value.quelle,
    meta.ipHash,
    meta.userAgent
  ];
}

async function createStore() {
  if (USE_POSTGRES) {
    const pg = await import('pg');
    const pool = new pg.default.Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_SSL === 'false' ? false : { rejectUnauthorized: false },
      max: 5
    });
    await pool.query(CREATE_PG);
    await pool.query('CREATE INDEX IF NOT EXISTS idx_leads_created ON leads(created_at DESC)');

    return {
      kind: 'postgres',
      async insert(values) {
        const placeholders = values.map((_, i) => '$' + (i + 1)).join(',');
        const res = await pool.query(
          'INSERT INTO leads (' + LEAD_COLUMNS.join(',') + ') VALUES (' + placeholders + ') RETURNING id',
          values
        );
        return res.rows[0].id;
      },
      async list(filters) {
        const where = [];
        const params = [];
        if (filters.status) {
          params.push(filters.status);
          where.push('status = $' + params.length);
        }
        if (filters.typ) {
          params.push(filters.typ);
          where.push('typ = $' + params.length);
        }
        if (filters.produkt) {
          params.push(filters.produkt);
          where.push('produkt = $' + params.length);
        }
        if (filters.q) {
          params.push('%' + filters.q + '%');
          const n = params.length;
          where.push(
            '(email ILIKE $' + n + ' OR vorname ILIKE $' + n + ' OR nachname ILIKE $' + n +
            ' OR firma ILIKE $' + n + ' OR plz ILIKE $' + n + ')'
          );
        }
        const sql =
          'SELECT * FROM leads' +
          (where.length ? ' WHERE ' + where.join(' AND ') : '') +
          ' ORDER BY id DESC LIMIT 1000';
        const res = await pool.query(sql, params);
        return res.rows;
      },
      async counts() {
        const res = await pool.query('SELECT status, COUNT(*) AS n FROM leads GROUP BY status');
        const out = {};
        for (const row of res.rows) out[row.status] = Number(row.n);
        return out;
      },
      async update(id, status, notiz) {
        const res = await pool.query(
          'UPDATE leads SET status = COALESCE($1, status), notiz = COALESCE($2, notiz) WHERE id = $3',
          [status || null, notiz, id]
        );
        return res.rowCount > 0;
      },
      async all() {
        const res = await pool.query('SELECT * FROM leads ORDER BY id DESC');
        return res.rows;
      },
      async close() {
        await pool.end();
      }
    };
  }

  const { DatabaseSync } = await import('node:sqlite');
  const db = new DatabaseSync(path.join(DATA_DIR, 'leads.db'));
  db.exec('PRAGMA journal_mode = WAL');
  db.exec(CREATE_SQLITE);
  db.exec('CREATE INDEX IF NOT EXISTS idx_leads_created ON leads(created_at DESC)');

  const insertSql =
    'INSERT INTO leads (' + LEAD_COLUMNS.join(',') + ') VALUES (' +
    LEAD_COLUMNS.map(() => '?').join(',') + ')';
  const insertStmt = db.prepare(insertSql);

  return {
    kind: 'sqlite',
    async insert(values) {
      return Number(insertStmt.run(...values).lastInsertRowid);
    },
    async list(filters) {
      const where = [];
      const params = [];
      if (filters.status) {
        where.push('status = ?');
        params.push(filters.status);
      }
      if (filters.typ) {
        where.push('typ = ?');
        params.push(filters.typ);
      }
      if (filters.produkt) {
        where.push('produkt = ?');
        params.push(filters.produkt);
      }
      if (filters.q) {
        const like = '%' + filters.q + '%';
        where.push('(email LIKE ? OR vorname LIKE ? OR nachname LIKE ? OR firma LIKE ? OR plz LIKE ?)');
        params.push(like, like, like, like, like);
      }
      const sql =
        'SELECT * FROM leads' +
        (where.length ? ' WHERE ' + where.join(' AND ') : '') +
        ' ORDER BY id DESC LIMIT 1000';
      return db.prepare(sql).all(...params);
    },
    async counts() {
      const rows = db.prepare('SELECT status, COUNT(*) AS n FROM leads GROUP BY status').all();
      const out = {};
      for (const row of rows) out[row.status] = Number(row.n);
      return out;
    },
    async update(id, status, notiz) {
      const res = db
        .prepare('UPDATE leads SET status = COALESCE(?, status), notiz = COALESCE(?, notiz) WHERE id = ?')
        .run(status || null, notiz, id);
      return res.changes > 0;
    },
    async all() {
      return db.prepare('SELECT * FROM leads ORDER BY id DESC').all();
    },
    async close() {
      db.close();
    }
  };
}

const store = await createStore();

const sessions = new Map();
const rateBuckets = new Map();

const STATUS_VALUES = new Set(['neu', 'kontaktiert', 'angebot', 'gewonnen', 'verloren', 'spam']);
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8',
  '.webmanifest': 'application/manifest+json'
};

function securityHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), camera=(), microphone=()');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; connect-src 'self'; form-action 'self'; base-uri 'self'; frame-ancestors 'none'; object-src 'none'"
  );
}

function json(res, status, payload, extraHeaders = {}) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...extraHeaders
  });
  res.end(body);
}

function readJson(req, limit = 64 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(Object.assign(new Error('payload_too_large'), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        reject(Object.assign(new Error('invalid_json'), { status: 400 }));
      }
    });
    req.on('error', reject);
  });
}

function clientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.length) return fwd.split(',')[0].trim();
  return req.socket.remoteAddress || 'unknown';
}

function rateLimit(key, max, windowMs) {
  const now = Date.now();
  const arr = (rateBuckets.get(key) || []).filter((t) => now - t < windowMs);
  if (arr.length >= max) {
    rateBuckets.set(key, arr);
    return false;
  }
  arr.push(now);
  rateBuckets.set(key, arr);
  return true;
}

setInterval(() => {
  const now = Date.now();
  for (const [key, arr] of rateBuckets) {
    const live = arr.filter((t) => now - t < 60 * 60 * 1000);
    if (live.length) rateBuckets.set(key, live);
    else rateBuckets.delete(key);
  }
  for (const [sid, exp] of sessions) if (exp < now) sessions.delete(sid);
}, 10 * 60 * 1000).unref();

function safeEqual(a, b) {
  const ab = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

function parseCookies(req) {
  const out = {};
  const header = req.headers.cookie;
  if (!header) return out;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    out[part.slice(0, idx).trim()] = part.slice(idx + 1).trim();
  }
  return out;
}

function sessionId(req) {
  const sid = parseCookies(req).e1_admin;
  if (!sid) return null;
  const exp = sessions.get(sid);
  if (!exp || exp < Date.now()) {
    sessions.delete(sid);
    return null;
  }
  return sid;
}

function sameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  try {
    return new URL(origin).host === req.headers.host;
  } catch {
    return false;
  }
}

function cookieFlags(req) {
  const secure = req.headers['x-forwarded-proto'] === 'https' || Boolean(req.socket.encrypted);
  return '; HttpOnly; SameSite=Strict; Path=/' + (secure ? '; Secure' : '');
}

function ipHash(req) {
  return crypto
    .createHash('sha256')
    .update(clientIp(req) + '|' + adminToken)
    .digest('hex')
    .slice(0, 32);
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

function calcKalkulation(produkt, kwh) {
  const t = tariffs[produkt];
  const grund = t.grundpreis_monat * 12;
  const arbeit = (t.arbeitspreis_ct / 100) * kwh;
  const referenz = t.referenz_grundpreis_monat * 12 + (t.referenz_ct / 100) * kwh;
  const jahrespreis = round2(grund + arbeit);
  return {
    produkt,
    verbrauch_kwh: kwh,
    jahrespreis,
    monatspreis: round2(jahrespreis / 12),
    referenz_jahrespreis: round2(referenz),
    ersparnis: round2(Math.max(0, referenz - jahrespreis))
  };
}

function asString(value, maxLen) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLen);
}

function validateLead(input) {
  const errors = {};
  const typ = input.typ === 'gewerbe' ? 'gewerbe' : 'privat';
  const produkt = input.produkt === 'gas' ? 'gas' : 'strom';
  const t = tariffs[produkt];

  const value = {
    typ,
    produkt,
    anrede: asString(input.anrede, 30),
    vorname: asString(input.vorname, 80),
    nachname: asString(input.nachname, 80),
    firma: asString(input.firma, 120),
    ustid: asString(input.ustid, 30),
    email: asString(input.email, 160).toLowerCase(),
    telefon: asString(input.telefon, 40),
    plz: asString(input.plz, 5),
    ort: asString(input.ort, 80),
    strasse: asString(input.strasse, 120),
    hausnummer: asString(input.hausnummer, 20),
    aktueller_anbieter: asString(input.aktueller_anbieter, 120),
    nachricht: asString(input.nachricht, 2000),
    quelle: asString(input.quelle, 60) || 'website',
    verbrauch_kwh: Number.parseInt(input.verbrauch_kwh, 10),
    anzahl_standorte: Number.parseInt(input.anzahl_standorte, 10)
  };

  if (!value.vorname) errors.vorname = 'Bitte Vornamen angeben.';
  if (!value.nachname) errors.nachname = 'Bitte Nachnamen angeben.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.email)) errors.email = 'Bitte gueltige E-Mail angeben.';
  if (!/^\d{5}$/.test(value.plz)) errors.plz = 'Bitte 5-stellige PLZ angeben.';
  if (typ === 'gewerbe' && !value.firma) errors.firma = 'Bitte Firmennamen angeben.';
  if (input.consent !== true) errors.consent = 'Einwilligung erforderlich.';

  if (!Number.isFinite(value.verbrauch_kwh)) {
    value.verbrauch_kwh = t.default_verbrauch;
  }
  if (value.verbrauch_kwh < t.min_verbrauch) value.verbrauch_kwh = t.min_verbrauch;
  if (value.verbrauch_kwh > t.max_verbrauch) value.verbrauch_kwh = t.max_verbrauch;

  if (typ === 'gewerbe') {
    if (!Number.isFinite(value.anzahl_standorte) || value.anzahl_standorte < 1) value.anzahl_standorte = 1;
    if (value.anzahl_standorte > 5000) value.anzahl_standorte = 5000;
  } else {
    value.anzahl_standorte = null;
    value.ustid = '';
  }

  return { errors, value };
}

async function handleApi(req, res, url, pathname) {
  if (pathname === '/api/tariffs' && req.method === 'GET') {
    return json(res, 200, { ok: true, tariffs });
  }

  if (pathname === '/api/leads' && req.method === 'POST') {
    if (!rateLimit('lead:' + clientIp(req), 5, 10 * 60 * 1000)) {
      return json(res, 429, { ok: false, error: 'zu_viele_anfragen' });
    }
    let body;
    try {
      body = await readJson(req);
    } catch (err) {
      return json(res, err.status || 400, { ok: false, error: err.message });
    }
    if (typeof body.website === 'string' && body.website.trim() !== '') {
      return json(res, 200, { ok: true, id: null });
    }
    const { errors, value } = validateLead(body);
    if (Object.keys(errors).length) {
      return json(res, 400, { ok: false, errors });
    }
    const kalkulation = calcKalkulation(value.produkt, value.verbrauch_kwh);
    const id = await store.insert(
      rowValues(value, kalkulation, {
        ipHash: ipHash(req),
        userAgent: asString(req.headers['user-agent'], 300)
      })
    );

    if (LEAD_WEBHOOK) {
      fetch(LEAD_WEBHOOK, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: 'lead.created', id, ...value, kalkulation }),
        signal: AbortSignal.timeout(4000)
      }).catch((err) => console.error('webhook:', err.message));
    }

    return json(res, 201, { ok: true, id, kalkulation });
  }

  if (pathname === '/api/admin/login' && req.method === 'POST') {
    if (!sameOrigin(req)) return json(res, 403, { ok: false, error: 'origin' });
    if (!rateLimit('login:' + clientIp(req), 10, 10 * 60 * 1000)) {
      return json(res, 429, { ok: false, error: 'zu_viele_anfragen' });
    }
    let body;
    try {
      body = await readJson(req);
    } catch {
      return json(res, 400, { ok: false, error: 'invalid_json' });
    }
    const token = typeof body.token === 'string' ? body.token.trim() : '';
    if (!safeEqual(token, adminToken)) {
      return json(res, 401, { ok: false, error: 'token' });
    }
    const sid = crypto.randomBytes(32).toString('base64url');
    sessions.set(sid, Date.now() + SESSION_TTL_MS);
    return json(res, 200, { ok: true, storage: store.kind }, {
      'Set-Cookie': 'e1_admin=' + sid + cookieFlags(req) + '; Max-Age=' + SESSION_TTL_MS / 1000
    });
  }

  if (pathname === '/api/admin/logout' && req.method === 'POST') {
    if (!sameOrigin(req)) return json(res, 403, { ok: false, error: 'origin' });
    const sid = sessionId(req);
    if (sid) sessions.delete(sid);
    return json(res, 200, { ok: true }, {
      'Set-Cookie': 'e1_admin=' + cookieFlags(req) + '; Max-Age=0'
    });
  }

  if (pathname === '/api/admin/session' && req.method === 'GET') {
    return json(res, 200, { ok: Boolean(sessionId(req)), storage: store.kind });
  }

  if (pathname === '/api/leads' && req.method === 'GET') {
    if (!sessionId(req)) return json(res, 401, { ok: false, error: 'auth' });
    const status = url.searchParams.get('status') || '';
    const typ = url.searchParams.get('typ') || '';
    const produkt = url.searchParams.get('produkt') || '';
    const q = (url.searchParams.get('q') || '').trim().replace(/[%_]/g, '').slice(0, 80);
    const rows = await store.list({
      status: STATUS_VALUES.has(status) ? status : '',
      typ: typ === 'privat' || typ === 'gewerbe' ? typ : '',
      produkt: produkt === 'strom' || produkt === 'gas' ? produkt : '',
      q
    });
    const counts = await store.counts();
    return json(res, 200, { ok: true, leads: rows, counts });
  }

  if (pathname === '/api/leads.csv' && req.method === 'GET') {
    if (!sessionId(req)) return json(res, 401, { ok: false, error: 'auth' });
    const rows = await store.all();
    const cols = [
      'id', 'created_at', 'typ', 'produkt', 'anrede', 'vorname', 'nachname',
      'firma', 'ustid', 'email', 'telefon', 'plz', 'ort', 'strasse',
      'hausnummer', 'verbrauch_kwh', 'anzahl_standorte', 'aktueller_anbieter',
      'nachricht', 'kalkulation_json', 'status', 'notiz', 'quelle', 'user_agent'
    ];
    const cell = (v) => {
      const s = v === null || v === undefined ? '' : String(v);
      return '"' + s.replace(/"/g, '""') + '"';
    };
    const csv =
      '\uFEFF' +
      cols.join(';') +
      '\r\n' +
      rows.map((r) => cols.map((c) => cell(r[c])).join(';')).join('\r\n');
    res.writeHead(200, {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="e1-leads-' + new Date().toISOString().slice(0, 10) + '.csv"',
      'Cache-Control': 'no-store'
    });
    return res.end(csv);
  }

  const leadMatch = pathname.match(/^\/api\/leads\/(\d+)$/);
  if (leadMatch && req.method === 'PATCH') {
    if (!sameOrigin(req)) return json(res, 403, { ok: false, error: 'origin' });
    if (!sessionId(req)) return json(res, 401, { ok: false, error: 'auth' });
    const id = Number(leadMatch[1]);
    let body;
    try {
      body = await readJson(req);
    } catch {
      return json(res, 400, { ok: false, error: 'invalid_json' });
    }
    const status = typeof body.status === 'string' ? body.status : '';
    const notiz = typeof body.notiz === 'string' ? body.notiz.slice(0, 5000) : null;
    if (status && !STATUS_VALUES.has(status)) {
      return json(res, 400, { ok: false, error: 'status' });
    }
    const updated = await store.update(id, status, notiz);
    if (!updated) return json(res, 404, { ok: false, error: 'not_found' });
    return json(res, 200, { ok: true });
  }

  return json(res, 404, { ok: false, error: 'not_found' });
}

async function serveStatic(req, res, pathname) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { Allow: 'GET, HEAD' });
    return res.end('Method Not Allowed');
  }
  if (pathname === '/healthz') {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
    return res.end('ok');
  }
  let rel = pathname === '/' ? '/index.html' : pathname;
  if (!path.extname(rel)) rel += '.html';
  const filePath = path.normalize(path.join(PUBLIC_DIR, rel));
  const relative = path.relative(PUBLIC_DIR, filePath);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('Forbidden');
  }

  let info;
  try {
    info = await stat(filePath);
  } catch {
    const notFound = path.join(PUBLIC_DIR, '404.html');
    try {
      const html = await readFile(notFound);
      res.writeHead(404, {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store'
      });
      return res.end(req.method === 'HEAD' ? undefined : html);
    } catch {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('Not Found');
    }
  }
  if (!info.isFile()) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('Not Found');
  }

  const ext = path.extname(filePath).toLowerCase();
  const isHtml = ext === '.html';
  res.writeHead(200, {
    'Content-Type': MIME[ext] || 'application/octet-stream',
    'Content-Length': info.size,
    'Cache-Control': isHtml ? 'no-store' : 'public, max-age=3600'
  });
  if (req.method === 'HEAD') return res.end();
  createReadStream(filePath).pipe(res);
}

const server = http.createServer(async (req, res) => {
  securityHeaders(res);
  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const pathname = decodeURIComponent(url.pathname);
    if (pathname.startsWith('/api/')) {
      await handleApi(req, res, url, pathname);
    } else {
      await serveStatic(req, res, pathname);
    }
  } catch (err) {
    console.error(err);
    if (!res.headersSent) json(res, 500, { ok: false, error: 'interner_fehler' });
    else res.end();
  }
});

server.listen(PORT, HOST, () => {
  console.log('');
  console.log('  E1 EnergyOne - Plattform laeuft');
  console.log('  Storage : ' + store.kind);
  console.log('  Website : http://' + HOST + ':' + PORT);
  console.log('  Admin   : http://' + HOST + ':' + PORT + '/admin');
  console.log('  Token   : ' + (process.env.E1_ADMIN_TOKEN ? '(aus E1_ADMIN_TOKEN)' : path.join(DATA_DIR, 'admin-token.txt')));
  console.log('');
});

function shutdown() {
  server.close(async () => {
    try { await store.close(); } catch {}
    process.exit(0);
  });
  setTimeout(() => process.exit(0), 3000).unref();
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
