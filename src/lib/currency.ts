/** Pure currency helpers: reading typed amounts, cross rates, inverting, chart statistics. */
import { percentRank } from './series';

const finite = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
export const MAX_AMOUNT = 1e13;
export const TOP = ['USD', 'EUR', 'GBP', 'JPY'];
export const RANGES = ['1m', '3m', '1y', '5y', '10y'] as const;
export type Range = (typeof RANGES)[number];
export const RANGE_LABEL: Record<Range, string> = { '1m': '1M', '3m': '3M', '1y': '1Y', '5y': '5Y', '10y': '10Y' };
export const RANGE_WORDS: Record<Range, string> = { '1m': 'the last month', '3m': 'the last 3 months', '1y': 'the last year', '5y': 'the last 5 years', '10y': 'the last 10 years' };
export const isRange = (x: unknown): x is Range => typeof x === 'string' && (RANGES as readonly string[]).includes(x);

/** Reads a number a person typed or pasted, in either "1,234.56" or "1.234,56" style. Null when it is not a usable number. */
export function parseAmount(input: unknown): number | null {
  if (typeof input === 'number') return finite(input) && Math.abs(input) <= MAX_AMOUNT ? input : null;
  if (typeof input !== 'string') return null;
  let s = input.trim().replace(/[\s  ']/g, '').replace(/[$€£¥₹]/g, '');
  const paren = /^\(.*\)$/.test(s);
  if (paren) s = s.slice(1, -1);
  const neg = paren || /^[-−]/.test(s);
  s = s.replace(/^[-+−]/, '');
  if (!s || !/^[\d.,]+$/.test(s) || !/\d/.test(s)) return null;
  const lastDot = s.lastIndexOf('.'), lastComma = s.lastIndexOf(',');
  let decimalAt = -1;
  if (lastDot >= 0 && lastComma >= 0) decimalAt = Math.max(lastDot, lastComma);
  else if (lastComma >= 0) decimalAt = (s.match(/,/g) || []).length > 1 || /^\d{1,3}(,\d{3})+$/.test(s) ? -1 : lastComma;
  else if (lastDot >= 0) decimalAt = (s.match(/\./g) || []).length > 1 ? -1 : lastDot;
  const whole = decimalAt < 0 ? s : s.slice(0, decimalAt), frac = decimalAt < 0 ? '' : s.slice(decimalAt + 1);
  if (/[.,]/.test(frac) || (decimalAt >= 0 && whole.includes(s[decimalAt]))) return null;
  const n = Number(`${whole.replace(/[.,]/g, '') || '0'}${frac ? '.' + frac : ''}`);
  if (!finite(n) || n > MAX_AMOUNT) return null;
  return neg && n !== 0 ? -n : n;
}

/** The exact opposite rate: if 1 USD buys 0.8957 EUR, 1 EUR buys 1 / 0.8957 USD. */
export const invertRate = (r: number | null | undefined): number | null => (finite(r) && r > 0 ? 1 / r : null);

/** How many `to` one `from` buys, given rates against a common base (the base itself is 1). */
export function crossRate(rates: Record<string, number> | null | undefined, from: string, to: string): number | null {
  if (!rates) return null;
  const a = rates[from], b = rates[to];
  return finite(a) && finite(b) && a > 0 && b > 0 ? b / a : null;
}

const group = (s: string) => s.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
/** An exchange rate with sensible digits: 158.33, 0.8957, 0.006316. */
export function fmtRate(x: number | null | undefined): string {
  if (!finite(x) || x <= 0) return '—';
  const d = x >= 100 ? 2 : x >= 0.1 ? 4 : 6;
  const [w, f = ''] = x.toFixed(d).split('.');
  return group(w) + (f ? '.' + f : '');
}

/** A converted amount: two decimals, or four for amounts under 1, with thousands commas. Beyond a quadrillion it gives up. */
export function fmtAmount(x: number | null | undefined): string {
  if (!finite(x) || Math.abs(x) >= 1e16) return '—';
  const a = Math.abs(x), [w, f = ''] = a.toFixed(a > 0 && a < 1 ? 4 : 2).split('.');
  return (x < 0 && Number(a.toFixed(a < 1 ? 4 : 2)) > 0 ? '−' : '') + group(w) + (f ? '.' + f : '');
}

export interface Stats { change: number | null; high: number | null; low: number | null; first: number | null; last: number | null; rank: number | null }
/** Change over the range, highest, lowest, and where the latest value sits in the range (0 is the lowest, 1 the highest). */
export function seriesStats(pts: ReadonlyArray<readonly [string, number]> | null | undefined): Stats {
  const v = (pts || []).map(p => p[1]).filter(x => finite(x) && x > 0);
  if (v.length < 2) return { change: null, high: null, low: null, first: null, last: null, rank: null };
  const first = v[0], last = v[v.length - 1];
  return { change: last / first - 1, high: Math.max(...v), low: Math.min(...v), first, last, rank: percentRank(v, last) };
}

/** The number the forward and parity calculator wants: home currency per 1 foreign currency, kept to six significant digits. */
export const calcSpot = (r: number | null | undefined): number | null => (finite(r) && r > 0 ? Number(r.toPrecision(6)) : null);

/** Where today's rate sits in the range, in words a beginner can use. */
export function rankWords(rank: number | null, rangeWords: string): string {
  if (rank == null) return '—';
  if (rank >= 0.95) return `near the highest of ${rangeWords}`;
  if (rank <= 0.05) return `near the lowest of ${rangeWords}`;
  return `higher than ${Math.round(rank * 100)}% of the days in ${rangeWords}`;
}
