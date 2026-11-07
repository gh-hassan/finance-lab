/* World Bank helpers: the lists of countries and indicators we allow, and a defensive reader for its answers. */
import { HttpError } from './_http.js';

export const COUNTRIES = ['US', 'CA', 'MX', 'BR', 'AR', 'CL', 'GB', 'DE', 'FR', 'IT', 'ES', 'NL', 'CH', 'SE', 'TR', 'ZA', 'NG', 'EG', 'SA', 'IN', 'CN', 'JP', 'KR', 'ID', 'AU', 'SG'];
export const INDICATORS = {
  'NY.GDP.MKTP.KD.ZG': { label: 'Economic growth (GDP growth per year)', unit: '%' },
  'FP.CPI.TOTL.ZG': { label: 'Inflation (consumer prices, per year)', unit: '%' },
  'SL.UEM.TOTL.ZS': { label: 'Unemployment (share of the workforce)', unit: '%' },
  'NY.GDP.PCAP.CD': { label: 'GDP per person (US dollars)', unit: 'USD' },
  'GC.DOD.TOTL.GD.ZS': { label: 'Government debt (share of GDP)', unit: '%' },
  'FR.INR.RINR': { label: 'Real interest rate (after inflation)', unit: '%' },
  'BN.CAB.XOKA.GD.ZS': { label: 'Current account balance (share of GDP)', unit: '%' },
  'SP.POP.TOTL': { label: 'Population', unit: 'people' }
};
export const MAX_COUNTRIES = 8;
export const MAX_AGE = 10;
export const FIRST_YEAR = 2000;

/** "us;de,JP" becomes ['US','DE','JP']. Throws a 400 for unknown codes, duplicates collapse, and more than 8 is refused. */
export function parseCountries(text) {
  const out = [];
  for (const raw of String(text || '').split(/[;,]/)) {
    const c = raw.trim().toUpperCase();
    if (!COUNTRIES.includes(c)) throw new HttpError(400, 'Choose countries from the list we offer.');
    if (!out.includes(c)) out.push(c);
  }
  if (!out.length) throw new HttpError(400, 'Choose at least one country.');
  if (out.length > MAX_COUNTRIES) throw new HttpError(400, `Choose at most ${MAX_COUNTRIES} countries at a time.`);
  return out;
}

const bad = () => new HttpError(502, 'The World Bank sent data we could not read. Try again in a moment.');

/** Reads a World Bank answer into { CODE: [[year, value], ...] } (oldest first, no gaps). Throws 502 on anything unexpected. */
export function parseWorldBank(json) {
  if (!Array.isArray(json) || !json[0] || typeof json[0] !== 'object') throw bad();
  if (json[0].message || json.length < 2) {
    if (Array.isArray(json[0].message)) throw new HttpError(404, 'The World Bank has no data for that request.');
    throw bad();
  }
  const rows = json[1];
  if (rows === null) return {};
  if (!Array.isArray(rows) || rows.length > 5000) throw bad();
  const out = {};
  for (const r of rows) {
    if (!r || typeof r !== 'object') continue;
    const code = r.country && r.country.id, year = /^\d{4}$/.test(String(r.date)) ? +r.date : NaN;
    if (!COUNTRIES.includes(code) || !Number.isFinite(year) || typeof r.value !== 'number' || !Number.isFinite(r.value)) continue;
    (out[code] = out[code] || []).push([year, Math.round(r.value * 1000) / 1000]);
  }
  for (const k of Object.keys(out)) out[k].sort((a, b) => a[0] - b[0]);
  return out;
}

/** Newest value no older than MAX_AGE years, or null. */
export function latestOf(points, nowYear) {
  if (!Array.isArray(points)) return null;
  for (let i = points.length - 1; i >= 0; i--) { const [y, v] = points[i]; if (Number.isFinite(v) && y >= nowYear - MAX_AGE) return { year: y, value: v }; }
  return null;
}
