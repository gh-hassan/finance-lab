/** Pure risk maths for the crypto page. Prices are [milliseconds, price] pairs. Bad numbers (NaN, null, zero, negative) are skipped, never guessed. */

export type Pt = readonly [number, number];
const finite = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
const DAY_MS = 864e5;
/** Crypto trades every day of the year, so a year is 365 daily returns (stocks use about 252). */
export const PERIODS_PER_YEAR = 365;
/** A rough reference, not live data: broad stock indexes have typically swung about 15 to 20 percent a year. */
export const STOCK_VOL_LOW = 0.15;
export const STOCK_VOL_HIGH = 0.2;

export const DAYS = [7, 30, 90, 365] as const;
export type Days = (typeof DAYS)[number];
export const DAYS_LABEL: Record<Days, string> = { 7: '7D', 30: '30D', 90: '90D', 365: '1Y' };
export const DAYS_WORDS: Record<Days, string> = { 7: 'a week ago', 30: '30 days ago', 90: '90 days ago', 365: 'a year ago' };
export const isDays = (x: unknown): x is Days => (DAYS as readonly unknown[]).includes(x);

export const validPoints = (pts: ReadonlyArray<readonly unknown[]> | null | undefined): [number, number][] =>
  (Array.isArray(pts) ? pts : []).filter((p): p is [number, number] => Array.isArray(p) && finite(p[0]) && finite(p[1]) && p[1] > 0).map(p => [p[0], p[1]]);

export const isoDate = (ms: number): string => new Date(ms).toISOString().slice(0, 10);

/** One price per UTC day (the last one seen that day), oldest first. Lets hourly and daily data be treated alike. */
export function toDaily(pts: ReadonlyArray<readonly unknown[]> | null | undefined): [number, number][] {
  const byDay = new Map<number, [number, number]>();
  for (const p of validPoints(pts)) {
    const day = Math.floor(p[0] / DAY_MS), prev = byDay.get(day);
    if (!prev || p[0] >= prev[0]) byDay.set(day, p);
  }
  return [...byDay.entries()].sort((a, b) => a[0] - b[0]).map(e => e[1]);
}

/** ln(p[i] / p[i-1]) for consecutive prices. */
export function logReturns(prices: ReadonlyArray<number | null | undefined>): number[] {
  const v = prices.filter((x): x is number => finite(x) && x > 0), out: number[] = [];
  for (let i = 1; i < v.length; i++) out.push(Math.log(v[i] / v[i - 1]));
  return out;
}

/** Sample standard deviation of daily log returns, scaled by sqrt(365). Null with fewer than 3 prices. 0 when the price never moves. */
export function annualisedVolatility(pts: ReadonlyArray<readonly unknown[]> | null | undefined, periods = PERIODS_PER_YEAR): number | null {
  const daily = toDaily(pts);
  if (daily.length < 3) return null;
  const r = logReturns(daily.map(p => p[1])), mean = r.reduce((a, b) => a + b, 0) / r.length;
  const sd = Math.sqrt(r.reduce((a, b) => a + (b - mean) ** 2, 0) / (r.length - 1));
  return finite(sd) ? sd * Math.sqrt(periods) : null;
}

export interface Drawdown { depth: number; peak: number; peakAt: number; troughAt: number; recovered: boolean }
/** The biggest fall from a high to a later low, as a positive fraction (0.1 is a 10% fall). Null with fewer than 2 prices. */
export function maxDrawdown(pts: ReadonlyArray<readonly unknown[]> | null | undefined): Drawdown | null {
  const v = validPoints(pts);
  if (v.length < 2) return null;
  let peak = v[0], best: Drawdown = { depth: 0, peak: v[0][1], peakAt: v[0][0], troughAt: v[0][0], recovered: true };
  for (const p of v) {
    if (p[1] > peak[1]) peak = p;
    const d = 1 - p[1] / peak[1];
    if (d > best.depth) best = { depth: d, peak: peak[1], peakAt: peak[0], troughAt: p[0], recovered: false };
  }
  if (best.depth > 0) best.recovered = v[v.length - 1][1] >= best.peak;
  return best;
}

export interface DayMove { at: number; change: number }
/** The best and worst single-day price changes (simple, as fractions). Null with fewer than 2 daily prices. */
export function bestWorstDay(pts: ReadonlyArray<readonly unknown[]> | null | undefined): { best: DayMove; worst: DayMove } | null {
  const d = toDaily(pts);
  if (d.length < 2) return null;
  let best: DayMove | null = null, worst: DayMove | null = null;
  for (let i = 1; i < d.length; i++) {
    const m = { at: d[i][0], change: d[i][1] / d[i - 1][1] - 1 };
    if (!best || m.change > best.change) best = m;
    if (!worst || m.change < worst.change) worst = m;
  }
  return best && worst ? { best, worst } : null;
}

export interface WhatIf { start: number; end: number; value: number; gain: number; change: number }
/** What `amount` put in at the first price would be worth at the last one. Null for a bad amount or fewer than 2 prices. */
export function whatIf(pts: ReadonlyArray<readonly unknown[]> | null | undefined, amount: number): WhatIf | null {
  const v = validPoints(pts);
  if (v.length < 2 || !finite(amount) || amount < 0) return null;
  const start = v[0][1], end = v[v.length - 1][1], change = end / start - 1, value = amount * (1 + change);
  return finite(value) ? { start, end, value, gain: value - amount, change } : null;
}

/** All the risk numbers in one go. Null when there are fewer than 3 usable prices. */
export function riskLens(pts: ReadonlyArray<readonly unknown[]> | null | undefined) {
  if (validPoints(pts).length < 3) return null;
  const vol = annualisedVolatility(pts), dd = maxDrawdown(pts), bw = bestWorstDay(pts);
  return vol == null && !dd && !bw ? null : { vol, drawdown: dd, days: bw };
}

/** How many times as bumpy as a typical stock index (using the middle of the 15 to 20 percent reference). Null if unknown. */
export const volVsStocks = (vol: number | null): number | null => (vol == null ? null : vol / ((STOCK_VOL_LOW + STOCK_VOL_HIGH) / 2));

/** Time as days since `startMs`, so a chart axis can label hours and days exactly. */
export const toDays = (pts: ReadonlyArray<Pt>, startMs: number): [number, number][] => pts.map(p => [(p[0] - startMs) / DAY_MS, p[1]]);

/** Picks a colour variable for a coin letter badge from its symbol, the same every time. */
export const BADGE_VARS = ['--c1', '--c2', '--c3', '--c4', '--good', '--warn'] as const;
export function badgeVar(symbol: string): string {
  let hash = 0;
  for (const ch of String(symbol || '?')) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return BADGE_VARS[hash % BADGE_VARS.length];
}

const MINUS = '−';
const group = (s: string) => s.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
/** A coin price for tables: "$75,703", "$2.35", "$0.00001234". Never NaN. */
export function fmtUsd(x: number | null | undefined): string {
  if (!finite(x) || x < 0) return '—';
  if (x >= 1000) return '$' + group(String(Math.round(x)));
  if (x >= 1) return '$' + x.toFixed(2);
  if (x === 0) return '$0';
  return '$' + x.toFixed(Math.min(12, 3 - Math.floor(Math.log10(x))));
}
/** Dollars and cents with commas and a proper minus sign: "$1,120.34", "−$50.00". */
export function fmtUsdExact(x: number | null | undefined): string {
  if (!finite(x) || Math.abs(x) >= 1e15) return '—';
  const s = Math.abs(x).toFixed(2), [w, f] = s.split('.');
  return (x < 0 && Number(s) > 0 ? MINUS : '') + '$' + group(w) + '.' + f;
}
