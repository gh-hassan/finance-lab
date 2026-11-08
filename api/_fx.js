/* Pure helpers for the currency function: dates, and defensive readers for what Frankfurter (ECB reference rates) sends back. */
import { HttpError } from './_http.js';

export const RANGES = ['1m', '3m', '1y', '5y', '10y'];
const MONTHS = { '1m': 1, '3m': 3, '1y': 12, '5y': 60, '10y': 120 };
/** The currencies the "Major currencies" table compares against. The base currency is dropped from the list. */
export const MAJORS = ['USD', 'EUR', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD', 'CNY', 'INR', 'MXN', 'BRL'];
export const MAX_POINTS = 500;
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const bad = () => new HttpError(502, 'The exchange rate source sent something we could not read.');

export const isoDay = d => d.toISOString().slice(0, 10);
const daysIn = (y, m) => new Date(Date.UTC(y, m + 1, 0)).getUTCDate();

/** The first day of a chart range, counted back from `now` (UTC). Month ends are kept inside the target month (31 Mar minus 1 month is 28 Feb). */
export function startDate(range, now = new Date()) {
  const months = MONTHS[range];
  if (!months) throw new HttpError(400, 'Choose a range: 1m, 3m, 1y, 5y or 10y.');
  const t = now instanceof Date ? now : new Date(now);
  if (Number.isNaN(+t)) throw new HttpError(400, 'The date is not valid.');
  const total = t.getUTCFullYear() * 12 + t.getUTCMonth() - months;
  const y = Math.floor(total / 12), m = total - y * 12;
  return isoDay(new Date(Date.UTC(y, m, Math.min(t.getUTCDate(), daysIn(y, m)))));
}

const goodRate = x => typeof x === 'number' && Number.isFinite(x) && x > 0 && x < 1e12;

/** @returns {{ base: string, date: string, rates: Record<string, number> }} */
export function parseRates(json, base) {
  if (!json || typeof json !== 'object' || !ISO.test(String(json.date)) || !json.rates || typeof json.rates !== 'object' || Array.isArray(json.rates)) throw bad();
  const rates = {};
  for (const [k, v] of Object.entries(json.rates)) if (/^[A-Z]{3}$/.test(k) && goodRate(v)) rates[k] = v;
  if (!Object.keys(rates).length) throw bad();
  return { base, date: json.date, rates: { ...rates, [base]: 1 } };
}

/** The currency list as { CODE: 'Name' }. Names are trimmed and capped because they come from the network. */
export function parseNames(json) {
  if (!json || typeof json !== 'object' || Array.isArray(json)) throw bad();
  const out = {};
  for (const [k, v] of Object.entries(json)) if (/^[A-Z]{3}$/.test(k) && typeof v === 'string' && v.trim()) out[k] = v.trim().slice(0, 60);
  if (!Object.keys(out).length) throw bad();
  return out;
}

/** Keeps at most `max` points, evenly spread, always including the first and the last. */
export function thin(pts, max = MAX_POINTS) {
  if (pts.length <= max || max < 2) return pts.slice();
  const out = [], step = (pts.length - 1) / (max - 1);
  for (let i = 0; i < max; i++) out.push(pts[Math.round(i * step)]);
  return out;
}

/** Turns { date: { QUOTE: rate } } into sorted [date, rate] pairs, skipping holes and bad numbers. */
export function parseSeries(json, quote) {
  const rows = json && typeof json === 'object' && json.rates;
  if (!rows || typeof rows !== 'object' || Array.isArray(rows)) throw bad();
  const pts = [];
  for (const [d, r] of Object.entries(rows)) {
    const v = r && typeof r === 'object' ? r[quote] : undefined;
    if (ISO.test(d) && goodRate(v)) pts.push([d, v]);
  }
  pts.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  if (pts.length < 2) throw new HttpError(404, 'There is not enough rate history for that pair.');
  return pts;
}

/** Change over the range and the highest and lowest rate, computed on the full series before thinning. */
export function summarise(pts) {
  const first = pts[0][1], last = pts[pts.length - 1][1];
  let high = -Infinity, low = Infinity;
  for (const p of pts) { if (p[1] > high) high = p[1]; if (p[1] < low) low = p[1]; }
  return { first, last, change: last / first - 1, high, low, firstDate: pts[0][0], lastDate: pts[pts.length - 1][0] };
}

/** Joins today's and last year's rates for the major currencies into one list, biggest mover first. */
export function parseMoves(now, then, base) {
  const a = parseRates(now, base), b = parseRates(then, base);
  const moves = [];
  for (const code of MAJORS) {
    if (code === base) continue;
    const rate = a.rates[code], prev = b.rates[code];
    if (rate == null) continue;
    moves.push({ code, rate, prev: prev == null ? null : prev, change: prev == null ? null : rate / prev - 1 });
  }
  const size = m => (m.change == null ? -1 : Math.abs(m.change));
  moves.sort((x, y) => size(y) - size(x));
  return { date: a.date, prevDate: b.date, moves: moves.slice(0, 10) };
}

/* ---- sources beyond the ECB (it publishes only about 30 currencies) ---- */

/** The oldest date the community currency-api dataset has. */
export const FAWAZ_FIRST = '2024-03-02';

/** open.er-api.com answer: { result, time_last_update_unix, rates:{ CODE: n } } becomes { date, rates } with the base included. */
export function parseErRates(json, base) {
  if (!json || typeof json !== 'object' || json.result !== 'success' || !json.rates || typeof json.rates !== 'object' || Array.isArray(json.rates)) throw bad();
  const unix = Number(json.time_last_update_unix), date = Number.isFinite(unix) && unix > 0 ? isoDay(new Date(unix * 1000)) : isoDay(new Date());
  const rates = {};
  for (const [k, v] of Object.entries(json.rates)) if (/^[A-Z]{3}$/.test(k) && goodRate(v)) rates[k] = v;
  if (!Object.keys(rates).length) throw bad();
  return { base, date, rates: { ...rates, [base]: 1 } };
}

/** currency-api answer: { date, <base>: { code: rate } } with lower-case codes becomes { date, rates } with upper-case codes. */
export function parseFawaz(json, base) {
  const row = json && typeof json === 'object' && json[base.toLowerCase()];
  if (!json || !ISO.test(String(json.date)) || !row || typeof row !== 'object' || Array.isArray(row)) throw bad();
  const rates = {};
  for (const [k, v] of Object.entries(row)) if (/^[a-z]{3}$/.test(k) && goodRate(v)) rates[k.toUpperCase()] = v;
  if (!Object.keys(rates).length) throw bad();
  return { date: json.date, rates: { ...rates, [base]: 1 } };
}

/** English currency names from the runtime itself (no network). Unknown codes keep their code as the name. */
const NAMER = typeof Intl !== 'undefined' && Intl.DisplayNames ? new Intl.DisplayNames(['en'], { type: 'currency' }) : null;
export function currencyName(code) {
  try { const n = NAMER && NAMER.of(code); return n && n !== code ? n.slice(0, 60) : code; } catch (e) { return code; }
}

/** Dates to sample for a range, newest last, never earlier than the dataset starts. Daily for a month, every 3 days for 3 months, weekly for a year, every 2 weeks beyond. */
export function sampleDates(range, now = new Date()) {
  const t = now instanceof Date ? now : new Date(now), end = Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate());
  const start = Math.max(Date.parse(startDate(range, t)), Date.parse(FAWAZ_FIRST)), step = { '1m': 1, '3m': 3, '1y': 7, '5y': 14, '10y': 14 }[range] * 864e5;
  const out = [];
  for (let d = end; d >= start; d -= step) out.push(isoDay(new Date(d)));
  return out.reverse();
}

/** Turns dated currency-api answers into sorted [date, rate] points for one quote currency. Missing days are simply skipped. */
export function fawazSeries(answers, quote) {
  const pts = [];
  for (const a of answers) { const v = a && a.rates && a.rates[quote]; if (a && ISO.test(String(a.date)) && goodRate(v)) pts.push([a.date, v]); }
  pts.sort((x, y) => (x[0] < y[0] ? -1 : x[0] > y[0] ? 1 : 0));
  const seen = new Set(), uniq = pts.filter(p => (seen.has(p[0]) ? false : seen.add(p[0])));
  if (uniq.length < 2) throw new HttpError(404, 'There is not enough rate history for that pair.');
  return uniq;
}
