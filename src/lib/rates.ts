/** Pure logic for the interest-rate page: reading the shape of the yield curve and describing changes in plain words. */

export const TENORS = ['1M', '3M', '6M', '1Y', '2Y', '3Y', '5Y', '7Y', '10Y', '20Y', '30Y'] as const;
export type Tenor = (typeof TENORS)[number];
export type CurveShape = 'normal' | 'flat' | 'inverted' | 'humped' | 'unknown';

export interface CurveReading {
  shape: CurveShape;
  spread10y2y: number | null;
  spread10y3m: number | null;
  text: string;
}

/** Spreads closer to zero than this (in percentage points) are called flat. */
export const FLAT_BAND = 0.25;
/** A spread below minus this is an inversion. Small dips are noise. */
export const INVERT_BAND = 0.1;
/** The middle of the curve must stand this far above both ends to be called humped. */
export const HUMP_BAND = 0.15;

const ok = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const at = (values: ReadonlyArray<number | null | undefined>, t: Tenor): number | null => {
  const v = values[TENORS.indexOf(t)];
  return ok(v) ? v : null;
};
const diff = (a: number | null, b: number | null): number | null => (a != null && b != null ? Math.round((a - b) * 1e4) / 1e4 : null);
const pts = (x: number): string => Math.abs(x).toFixed(2);

const TEXT: Record<Exclude<CurveShape, 'unknown'>, string> = {
  normal: 'The curve slopes upward: lenders ask for more to lock money away for longer. This is the usual, healthy shape.',
  flat: 'The curve is nearly flat: short and long loans pay about the same. Markets are unsure which way growth and rates will go next.',
  inverted: 'The curve is inverted: short-term loans pay more than long-term ones. Investors are betting rates will fall later, often because they expect slower growth. It has come before past recessions, but it is not a forecast and the timing varies a lot.',
  humped: 'The curve rises in the middle and falls again at the long end. That means the market expects rates to peak within a few years.'
};

/** Reads a yield curve given as values in TENORS order (percent). Missing or non-numeric values are allowed. */
export function curveShape(values: ReadonlyArray<number | null | undefined> | null | undefined): CurveReading {
  const v = Array.isArray(values) ? values : [];
  const y10 = at(v, '10Y'), y2 = at(v, '2Y'), m3 = at(v, '3M');
  const spread10y2y = diff(y10, y2), spread10y3m = diff(y10, m3);
  const spreads = [spread10y2y, spread10y3m].filter((s): s is number => s != null);
  if (y10 == null || !spreads.length) return { shape: 'unknown', spread10y2y, spread10y3m, text: 'There is not enough data to read the shape of the curve right now.' };
  const detail = (s: number | null, name: string) => (s == null ? '' : ` The ${name} gap is ${s < 0 ? 'minus ' : ''}${pts(s)} points.`);
  const tail = detail(spread10y2y, '10-year minus 2-year') + detail(spread10y3m, '10-year minus 3-month');
  const done = (shape: Exclude<CurveShape, 'unknown'>): CurveReading => ({ shape, spread10y2y, spread10y3m, text: TEXT[shape] + tail });
  if (spreads.some(s => s < -INVERT_BAND)) return done('inverted');
  const front = at(v, '1M') ?? at(v, '3M');
  const middle = (['6M', '1Y', '2Y', '3Y', '5Y', '7Y'] as Tenor[]).map(t => at(v, t)).filter((x): x is number => x != null);
  if (front != null && middle.length && Math.max(...middle) - Math.max(front, y10) >= HUMP_BAND) return done('humped');
  if (spreads.every(s => Math.abs(s) < FLAT_BAND)) return done('flat');
  return done('normal');
}

export type Freq = 'daily' | 'weekly' | 'monthly';

/** "5 Nov 2026" for daily and weekly readings, "Sep 2026" for monthly ones. Empty when the date is unusable. */
export function asOfLabel(date: string | null | undefined, freq: Freq | string = 'daily'): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(date ?? ''));
  if (!m) return '';
  const mo = +m[2];
  if (mo < 1 || mo > 12) return '';
  const name = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][mo - 1];
  return freq === 'monthly' ? `${name} ${m[1]}` : `${+m[3]} ${name} ${m[1]}`;
}

/** A rate such as 4.35 becomes "4.35%". Anything not finite becomes an em dash. */
export function ratePct(x: number | null | undefined, d = 2): string {
  if (!ok(x)) return '—';
  const s = Math.abs(x).toFixed(d);
  return (x < 0 && Number(s) !== 0 ? '−' : '') + s + '%';
}

/** Plain-English change between two readings, in percentage points. Empty string when there is nothing to compare. */
export function changeWords(now: number | null | undefined, before: number | null | undefined, when = 'a year ago'): string {
  if (!ok(now) || !ok(before)) return '';
  const d = Math.round((now - before) * 100) / 100;
  if (d === 0) return `unchanged from ${when}`;
  return `${d > 0 ? 'up' : 'down'} ${Math.abs(d).toFixed(2)} points from ${when}`;
}
