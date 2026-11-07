/* Pure parsing and shaping for the interest-rate page. No network here, so every rule can be tested with plain strings.
   FRED's CSV is tiny and strict: "observation_date,SERIES" then "YYYY-MM-DD,value" rows, with "." for a missing value. */
import { HttpError } from './_http.js';

export const TENORS = ['1M', '3M', '6M', '1Y', '2Y', '3Y', '5Y', '7Y', '10Y', '20Y', '30Y'];
export const CURVE_IDS = ['DGS1MO', 'DGS3MO', 'DGS6MO', 'DGS1', 'DGS2', 'DGS3', 'DGS5', 'DGS7', 'DGS10', 'DGS20', 'DGS30'];

/** Every series we will ever ask FRED for. `freq` decides how stale a value may be before we ignore it. */
export const SERIES = {
  DGS1MO: { label: '1-month Treasury yield', freq: 'daily' },
  DGS3MO: { label: '3-month Treasury yield', freq: 'daily' },
  DGS6MO: { label: '6-month Treasury yield', freq: 'daily' },
  DGS1: { label: '1-year Treasury yield', freq: 'daily' },
  DGS2: { label: '2-year Treasury yield', freq: 'daily' },
  DGS3: { label: '3-year Treasury yield', freq: 'daily' },
  DGS5: { label: '5-year Treasury yield', freq: 'daily' },
  DGS7: { label: '7-year Treasury yield', freq: 'daily' },
  DGS10: { label: '10-year Treasury yield', freq: 'daily' },
  DGS20: { label: '20-year Treasury yield', freq: 'daily' },
  DGS30: { label: '30-year Treasury yield', freq: 'daily' },
  DFF: { label: 'Federal funds rate', freq: 'daily' },
  MORTGAGE30US: { label: '30-year fixed mortgage rate', freq: 'weekly' },
  UNRATE: { label: 'Unemployment rate', freq: 'monthly' },
  BAA10Y: { label: 'Credit spread (Baa corporate bonds over 10-year Treasury)', freq: 'daily' },
  INFLATION: { label: 'Inflation (CPI, year over year)', freq: 'monthly', source: 'CPIAUCSL' }
};
export const HISTORY_IDS = ['DGS10', 'DGS2', 'DFF', 'MORTGAGE30US', 'INFLATION', 'UNRATE', 'BAA10Y', ...CURVE_IDS.filter(i => !['DGS10', 'DGS2'].includes(i))];
export const RANGES = ['1y', '5y', '10y', '30y', 'max'];
export const MAX_POINTS = 600;
const STALE_DAYS = { daily: 10, weekly: 14, monthly: 45 };
const DAY = 864e5;

const bad = msg => new HttpError(502, msg);
const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** Splits one CSV line, honouring double quotes. */
export function splitLine(line) {
  const out = []; let cur = '', q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) { if (c === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
    else if (c === '"') q = true;
    else if (c === ',') { out.push(cur); cur = ''; }
    else cur += c;
  }
  out.push(cur);
  return out.map(s => s.trim());
}

/** @returns {[string, number][]} ascending by date; missing and junk rows are dropped. Throws a friendly 502 for anything that is not a FRED CSV. */
export function parseFredCsv(text, id) {
  if (typeof text !== 'string' || !text.trim()) throw bad('The data source sent an empty file. Try again in a moment.');
  const lines = text.replace(/^﻿/, '').split(/\r?\n/);
  const first = lines.findIndex(l => l.trim());
  const header = splitLine(lines[first]);
  if (header.length < 2 || !/^(observation_date|date)$/i.test(header[0]) || header[1] !== id) throw bad('The data source sent a file we did not expect. Try again in a moment.');
  const pts = [];
  for (let i = first + 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const [d, raw] = splitLine(lines[i]);
    if (!ISO.test(d || '') || !raw || raw === '.') continue;
    const v = Number(raw);
    if (Number.isFinite(v) && Math.abs(v) < 1e6) pts.push([d, v]);
  }
  if (!pts.length) throw bad('The data source had no readable values for that series.');
  return pts.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
}

/** Year-over-year percent change of a monthly index. Matches each month with the same month a year earlier, so a missing month (it happens) never shifts the maths. */
export function yearOverYear(points) {
  const byMonth = new Map(points.map(([d, v]) => [d.slice(0, 7), v]));
  const out = [];
  for (const [d, v] of points) {
    const prev = byMonth.get(`${+d.slice(0, 4) - 1}-${d.slice(5, 7)}`);
    if (prev != null && prev > 0 && v > 0) out.push([d, (v / prev - 1) * 100]);
  }
  return out;
}

const toIso = ms => new Date(ms).toISOString().slice(0, 10);
const toMs = iso => Date.parse(iso + 'T00:00:00Z');

/** Moves an ISO date by whole months, keeping the day inside the month (31 Mar minus a month is 28 Feb). */
export function shiftMonths(iso, n) {
  const y = +iso.slice(0, 4), m = +iso.slice(5, 7) - 1, day = +iso.slice(8, 10);
  const t = y * 12 + m + n, ny = Math.floor(t / 12), nm = ((t % 12) + 12) % 12;
  const last = new Date(Date.UTC(ny, nm + 1, 0)).getUTCDate();
  return toIso(Date.UTC(ny, nm, Math.min(day, last)));
}

/** The last observation on or before `iso`, as long as it is not older than `maxDays`. */
export function valueAt(points, iso, maxDays) {
  let lo = 0, hi = points.length - 1, ans = -1;
  while (lo <= hi) { const mid = (lo + hi) >> 1; if (points[mid][0] <= iso) { ans = mid; lo = mid + 1; } else hi = mid - 1; }
  if (ans < 0) return null;
  const [date, value] = points[ans];
  if ((toMs(iso) - toMs(date)) / DAY > maxDays) return null;
  return { date, value };
}

/** First date to ask FRED for, per range. `extraMonths` pads it (inflation needs a year of history before the first point). */
export function rangeStart(range, now = Date.now(), extraMonths = 0) {
  const years = { '1y': 1, '5y': 5, '10y': 10, '30y': 30 }[range];
  if (!years) return null;
  return shiftMonths(toIso(now), -(years * 12 + extraMonths));
}

/** Keeps at most `max` points, evenly spread, always including the first and last. */
export function thin(pts, max = MAX_POINTS) {
  if (pts.length <= max) return pts;
  const out = [], step = (pts.length - 1) / (max - 1);
  for (let i = 0; i < max; i++) out.push(pts[Math.round(i * step)]);
  return out;
}

const rd = v => Math.round(v * 1e4) / 1e4;
const obs = o => (o ? { date: o.date, value: rd(o.value) } : null);

/** One series in the snapshot: newest value, and the values about a month and a year before it. */
export function snapshotOf(id, points) {
  const meta = SERIES[id];
  if (!points || !points.length) return { id, label: meta.label, freq: meta.freq, latest: null, monthAgo: null, yearAgo: null };
  const [date, value] = points[points.length - 1], stale = STALE_DAYS[meta.freq];
  return {
    id, label: meta.label, freq: meta.freq, latest: obs({ date, value }),
    monthAgo: obs(valueAt(points, shiftMonths(date, -1), stale)),
    yearAgo: obs(valueAt(points, shiftMonths(date, -12), stale))
  };
}

/** The whole yield curve at one date: a value per maturity, null where that maturity has no recent reading. */
export function curveAt(maps, iso) {
  return { date: iso, values: CURVE_IDS.map(id => { const o = maps[id] ? valueAt(maps[id], iso, STALE_DAYS.daily) : null; return o ? rd(o.value) : null; }) };
}

/** @param {Record<string, [string, number][]>} maps points by series id (INFLATION already converted) */
export function buildSnapshot(maps, now = Date.now()) {
  const series = {};
  for (const id of Object.keys(SERIES)) series[id] = snapshotOf(id, maps[id]);
  const ten = maps.DGS10 && maps.DGS10.length ? maps.DGS10[maps.DGS10.length - 1][0] : (CURVE_IDS.map(i => maps[i] && maps[i].length ? maps[i][maps[i].length - 1][0] : '').sort().pop() || '');
  const curve = ten ? { tenors: TENORS, today: curveAt(maps, ten), monthAgo: curveAt(maps, shiftMonths(ten, -1)), yearAgo: curveAt(maps, shiftMonths(ten, -12)) } : null;
  return { asOf: new Date(now).toISOString(), series, curve };
}

/** FiscalData "average interest rates" -> the newest month of marketable securities. */
export function parseTreasury(json) {
  const rows = json && Array.isArray(json.data) ? json.data : null;
  if (!rows) throw bad('The Treasury data could not be read. Try again in a moment.');
  const ok = rows.filter(r => r && r.security_type_desc === 'Marketable' && ISO.test(String(r.record_date)) && Number.isFinite(Number(r.avg_interest_rate_amt)) && r.avg_interest_rate_amt !== '' && r.avg_interest_rate_amt !== null);
  if (!ok.length) throw bad('The Treasury data had no readable rows. Try again in a moment.');
  const recordDate = ok.map(r => r.record_date).sort().pop();
  const clean = s => String(s || '').replace(/[^\w .,()&'\-/]/g, '').trim().slice(0, 80);
  const list = ok.filter(r => r.record_date === recordDate).map(r => ({ name: clean(r.security_desc), rate: rd(Number(r.avg_interest_rate_amt)) })).filter(r => r.name && r.rate >= 0 && r.rate < 30);
  if (!list.length) throw bad('The Treasury data had no readable rows. Try again in a moment.');
  return { recordDate, rows: list };
}
