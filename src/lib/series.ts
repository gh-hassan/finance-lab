/** Small, pure helpers for time series: dates as decimal years, thinning for charts, growth and summary statistics. */

export type Pt = [number, number];

/** "2024-07-01" becomes 2024.5. Invalid dates give NaN. */
export function decimalYear(iso: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso));
  if (!m) return NaN;
  const y = +m[1], t = Date.UTC(y, +m[2] - 1, +m[3]);
  if (!Number.isFinite(t)) return NaN;
  return y + (t - Date.UTC(y, 0, 1)) / (Date.UTC(y + 1, 0, 1) - Date.UTC(y, 0, 1));
}

/** The reverse of decimalYear: 2024.5 becomes "2024-07-02". */
export function fromDecimalYear(x: number): string {
  if (!Number.isFinite(x)) return '';
  const y = Math.floor(x), a = Date.UTC(y, 0, 1), b = Date.UTC(y + 1, 0, 1), days = Math.round((x - y) * (b - a) / 864e5);
  return new Date(a + days * 864e5).toISOString().slice(0, 10);
}

/** Keeps at most `max` points, evenly spread, always including the first and the last. */
export function downsample<T>(pts: readonly T[], max = 500): T[] {
  if (!Array.isArray(pts) || pts.length <= max || max < 2) return pts.slice();
  const out: T[] = [], step = (pts.length - 1) / (max - 1);
  for (let i = 0; i < max; i++) out.push(pts[Math.round(i * step)]);
  return out;
}

/** Percent change over `lag` steps, as a fraction. Positions without a valid base are null. */
export function changeOver(values: readonly (number | null)[], lag: number): (number | null)[] {
  return values.map((v, i) => {
    const b = i >= lag ? values[i - lag] : null;
    return v != null && b != null && Number.isFinite(v) && Number.isFinite(b) && b !== 0 ? v / b - 1 : null;
  });
}

/** Compound annual growth. Null unless both ends are positive and the span is positive. */
export function cagr(first: number | null | undefined, last: number | null | undefined, years: number): number | null {
  if (first == null || last == null || !(first > 0) || !(last > 0) || !(years > 0)) return null;
  return Math.pow(last / first, 1 / years) - 1;
}

export interface Summary { n: number; mean: number; sd: number; min: number; max: number }
export function summary(values: readonly (number | null | undefined)[]): Summary | null {
  const v = values.filter((x): x is number => typeof x === 'number' && Number.isFinite(x));
  if (!v.length) return null;
  const mean = v.reduce((a, b) => a + b, 0) / v.length;
  const sd = v.length > 1 ? Math.sqrt(v.reduce((a, b) => a + (b - mean) ** 2, 0) / (v.length - 1)) : 0;
  return { n: v.length, mean, sd, min: Math.min(...v), max: Math.max(...v) };
}

/** Percentile rank of x within a list: the share of values at or below x, 0 to 1. */
export function percentRank(values: readonly number[], x: number): number | null {
  const v = values.filter(Number.isFinite);
  if (!v.length || !Number.isFinite(x)) return null;
  return v.filter(a => a <= x).length / v.length;
}
