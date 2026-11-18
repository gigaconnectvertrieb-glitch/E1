export const MIN_PROVISION = 150;
export const PREISGARANTIE_MONATE = 24;

export function rankRates(rows, minProvision = MIN_PROVISION, garantieMonate = PREISGARANTIE_MONATE) {
  const normalized = scaleProvision(rows.map(normalizeRate));
  const withPrice = normalized.filter((r) => r.jahrespreis != null && r.jahrespreis > 0);
  const guaranteeOk = withPrice.filter((r) => r.garantieMonate === garantieMonate);
  const qualified = guaranteeOk
    .filter((r) => r.provisionEuro != null && r.provisionEuro >= minProvision)
    .sort((a, b) => a.jahrespreis - b.jahrespreis || b.provisionEuro - a.provisionEuro);
  const hidden = guaranteeOk.filter(
    (r) => r.provisionEuro != null && r.provisionEuro < minProvision
  ).length;
  const unknown = guaranteeOk.filter((r) => r.provisionEuro == null).length;
  const sampleKeys = rows[0] && typeof rows[0] === 'object' ? Object.keys(rows[0]).slice(0, 40) : [];
  return {
    qualified,
    hidden,
    unknown,
    droppedGuarantee: withPrice.length - guaranteeOk.length,
    scanned: normalized.length,
    sampleKeys
  };
}

export function parseDeNumber(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (value == null) return null;
  let s = String(value).trim();
  if (!s || s === '-' || s === '–') return null;
  s = s.replace(/\s/g, '').replace(/€|eur/gi, '').replace(/ct.*$/i, '');
  if (s.includes(',') && s.includes('.')) s = s.replace(/\./g, '').replace(',', '.');
  else if (s.includes(',')) s = s.replace(',', '.');
  const n = Number(s.replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? n : null;
}

const PROV_EXACT = [
  'reseller_prov',
  'provision',
  'provision_euro',
  'prov',
  'vp',
  'rate_provision',
  'courtage',
  'commission'
];

export function provisionEuro(row) {
  if (!row || typeof row !== 'object') return null;
  const keys = Object.keys(row).filter((key) => {
    const lower = key.toLowerCase();
    if (PROV_EXACT.includes(lower)) return true;
    if (!/prov|courtage|commission/i.test(key)) return false;
    if (/follow|percent|type|text|info|storno|interval|month/i.test(key)) return false;
    return true;
  });
  keys.sort((a, b) => {
    const ia = PROV_EXACT.indexOf(a.toLowerCase());
    const ib = PROV_EXACT.indexOf(b.toLowerCase());
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  });
  for (const key of keys) {
    const n = parseDeNumber(row[key]);
    if (n != null && n >= 0) return n;
  }
  return null;
}

export function yearlyEuro(row) {
  const bonus = parseDeNumber(row.total_price_bonus);
  const plain = parseDeNumber(row.total_price);
  if (bonus != null && bonus > 0) return bonus;
  if (plain != null && plain > 0) return plain;
  const work = parseDeNumber(row.price_work ?? row.work_price);
  const base = parseDeNumber(row.base_price_year ?? row.price_base);
  const kwh = parseDeNumber(row.consum);
  if (work != null && base != null && kwh) {
    const opt = parseDeNumber(row.opt_bonus ?? row.price_bonus) || 0;
    return (kwh * work) / 100 + base - opt;
  }
  return null;
}

export function normalizeRate(row, index) {
  return {
    id: String(row.rate_id || row.api_rate_id || index),
    name: String(row.rate_name || row.name || 'Tarif').replace(/\s+/g, ' ').trim() || 'Tarif',
    anbieter: String(row.provider_name || row.provider || '').replace(/\s+/g, ' ').trim(),
    provisionEuro: provisionEuro(row),
    jahrespreis: yearlyEuro(row),
    arbeitspreisCt: parseDeNumber(row.price_work ?? row.work_price),
    grundpreisJahr: parseDeNumber(row.base_price_year ?? row.price_base),
    bonusEuro: parseDeNumber(row.opt_bonus ?? row.price_bonus),
    garantieMonate: parseDeNumber(row.opt_guarantee ?? row.guarantee),
    laufzeitMonate: parseDeNumber(row.opt_term)
  };
}

/** egON liefert die Provision manchmal in Cent. */
export function scaleProvision(rates) {
  const vals = rates.map((r) => r.provisionEuro).filter((n) => n != null && n > 0).sort((a, b) => a - b);
  if (vals.length < 3) return rates;
  const mid = vals[Math.floor(vals.length / 2)];
  if (mid < 5000) return rates;
  return rates.map((r) => ({
    ...r,
    provisionEuro: r.provisionEuro == null ? null : Math.round(r.provisionEuro) / 100
  }));
}
