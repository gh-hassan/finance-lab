/** Maths for the factor returns page. Monthly returns arrive as percent numbers (1.5 means 1.5%) and may be null. Results are fractions unless a name says percent. */

export type Ret = number | null;
export type Pt = [number, number];
export type FactorKey = 'MKT' | 'SMB' | 'HML' | 'RMW' | 'CMA' | 'MOM';
export interface FactorInfo { key: FactorKey; name: string; short: string; color: string; dash?: boolean; what: string }

export const FACTORS: FactorInfo[] = [
  { key: 'MKT', name: 'Market', short: 'Market', color: 'c1', what: 'The whole stock market, minus the safe interest rate. The reward for taking stock market risk at all.' },
  { key: 'SMB', name: 'Size (small minus big)', short: 'Size', color: 'c4', what: 'Small companies minus big companies. Do smaller firms beat larger ones?' },
  { key: 'HML', name: 'Value (high minus low)', short: 'Value', color: 'c3', what: 'Cheap stocks (high book value for the price) minus expensive ones. Do bargains beat glamour?' },
  { key: 'RMW', name: 'Profitability (robust minus weak)', short: 'Profit', color: 'var(--lav)', dash: true, what: 'Highly profitable companies minus weakly profitable ones. Do better businesses win?' },
  { key: 'CMA', name: 'Investment (conservative minus aggressive)', short: 'Invest', color: 'mute', dash: true, what: 'Firms that invest cautiously minus firms that expand fast. Does restraint pay?' },
  { key: 'MOM', name: 'Momentum (winners minus losers)', short: 'Momentum', color: 'ink', what: 'Last year\'s winners minus last year\'s losers. Do recent winners keep winning?' }
];
export const FACTOR_KEYS = FACTORS.map(f => f.key);
export const RANGES = [['10', '10 years'], ['20', '20 years'], ['30', '30 years'], ['max', 'All data']] as const;
export const isFactorKey = (k: unknown): k is FactorKey => typeof k === 'string' && (FACTOR_KEYS as string[]).includes(k);
export const isRange = (r: unknown): r is '10' | '20' | '30' | 'max' => RANGES.some(([k]) => k === r);

const ok = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
const clean = (r: readonly Ret[]): number[] => r.filter(ok);

/** Reads ?f=MKT,HML into a list of valid keys in page order. Unknown names are dropped; an empty result falls back to the default. */
export function parseFactorList(s: string | null | undefined, fallback: FactorKey[] = FACTOR_KEYS): FactorKey[] {
  const want = new Set(String(s ?? '').split(',').map(x => x.trim().toUpperCase()));
  const out = FACTOR_KEYS.filter(k => want.has(k));
  return out.length ? out : fallback;
}

/** Index of the first month to use: the last `years` years, or everything for 'max' or when the data is shorter. */
export function rangeStart(count: number, range: string): number {
  const y = Number(range);
  return range === 'max' || !Number.isFinite(y) || y <= 0 ? 0 : Math.max(0, count - Math.round(y) * 12);
}

const ym = (m: number) => ({ y: Math.floor(m / 100), mo: m % 100 });
/** A month as a decimal year at its start: 202401 is 2024, 202407 is 2024.5. */
export const monthX = (m: number): number => { const { y, mo } = ym(m); return y + (mo - 1) / 12; };
/** The month before a YYYYMM number. */
export const prevMonth = (m: number): number => { const { y, mo } = ym(m); return mo === 1 ? (y - 1) * 100 + 12 : m - 1; };

/** Growth of $1: one point before the first month, then one per month (a missing month leaves the value unchanged). */
export function growthPoints(months: readonly number[], returns: readonly Ret[]): Pt[] {
  if (!months.length) return [];
  let v = 1;
  const pts: Pt[] = [[monthX(prevMonth(months[0])), 1]];
  months.forEach((m, i) => { const r = returns[i]; if (ok(r)) v *= 1 + r / 100; pts.push([monthX(m), v]); });
  return pts;
}

/** Yearly growth rate from monthly percent returns by compounding, as a fraction. Null with no data. */
export function annualised(returns: readonly Ret[]): number | null {
  const v = clean(returns);
  if (!v.length) return null;
  const growth = v.reduce((a, r) => a * (1 + r / 100), 1);
  return growth > 0 ? Math.pow(growth, 12 / v.length) - 1 : -1;
}

/** Yearly volatility: the sample standard deviation of monthly returns times the square root of 12, as a fraction. */
export function annualVol(returns: readonly Ret[]): number | null {
  const v = clean(returns);
  if (v.length < 2) return null;
  const mean = v.reduce((a, b) => a + b, 0) / v.length;
  const sd = Math.sqrt(v.reduce((a, b) => a + (b - mean) ** 2, 0) / (v.length - 1));
  return sd < 1e-9 ? 0 : (sd * Math.sqrt(12)) / 100;
}

/** Average yearly return (monthly mean times 12) divided by yearly volatility. Null when volatility is zero or unknown. */
export function returnPerRisk(returns: readonly Ret[]): number | null {
  const v = clean(returns), vol = annualVol(returns);
  if (!v.length || vol == null || vol === 0) return null;
  return ((v.reduce((a, b) => a + b, 0) / v.length) * 12) / 100 / vol;
}

/** Share of months with a return above zero, as a fraction. */
export function shareUp(returns: readonly Ret[]): number | null {
  const v = clean(returns);
  return v.length ? v.filter(r => r > 0).length / v.length : null;
}

export interface Year { year: number; ret: number }
/** Calendar-year returns by compounding. Only years with all twelve months present are included, so partial first and last years drop out. */
export function calendarYears(months: readonly number[], returns: readonly Ret[]): Year[] {
  const by = new Map<number, Ret[]>();
  months.forEach((m, i) => { const y = ym(m).y; by.set(y, [...(by.get(y) ?? []), returns[i]]); });
  const out: Year[] = [];
  [...by.entries()].sort((a, b) => a[0] - b[0]).forEach(([year, r]) => {
    if (r.length === 12 && r.every(ok)) out.push({ year, ret: (r as number[]).reduce((a, x) => a * (1 + x / 100), 1) - 1 });
  });
  return out;
}

export const worstYear = (years: readonly Year[]): Year | null => years.reduce<Year | null>((w, y) => (!w || y.ret < w.ret ? y : w), null);

export interface Decade { label: string; from: number; to: number; n: number; avg: number }
/** Average calendar-year return per decade. Decades with fewer than 3 full years are left out. */
export function decadeAverages(years: readonly Year[]): Decade[] {
  const by = new Map<number, Year[]>();
  years.forEach(y => { const d = Math.floor(y.year / 10) * 10; by.set(d, [...(by.get(d) ?? []), y]); });
  return [...by.entries()].sort((a, b) => a[0] - b[0]).filter(([, ys]) => ys.length >= 3)
    .map(([d, ys]) => ({ label: `${d}s`, from: ys[0].year, to: ys[ys.length - 1].year, n: ys.length, avg: ys.reduce((a, y) => a + y.ret, 0) / ys.length }));
}

export interface Drawdown { depth: number; longestMonths: number }
/** Biggest fall from a peak (a negative fraction, 0 if never down) and the longest run of months spent below an earlier peak. */
export function drawdown(returns: readonly Ret[]): Drawdown {
  let v = 1, peak = 1, depth = 0, run = 0, longest = 0;
  returns.forEach(r => {
    if (ok(r)) v *= 1 + r / 100;
    if (v >= peak) { peak = v; run = 0; } else { run += 1; longest = Math.max(longest, run); depth = Math.min(depth, v / peak - 1); }
  });
  return { depth, longestMonths: longest };
}

export interface FactorStats { annual: number | null; vol: number | null; perRisk: number | null; worst: Year | null; up: number | null; fall: Drawdown | null }
export function factorStats(months: readonly number[], returns: readonly Ret[]): FactorStats {
  return { annual: annualised(returns), vol: annualVol(returns), perRisk: returnPerRisk(returns), worst: worstYear(calendarYears(months, returns)), up: shareUp(returns), fall: clean(returns).length ? drawdown(returns) : null };
}

/** The best factor in each of the last `n` full calendar years, newest first. */
export function recentYears(months: readonly number[], factors: Partial<Record<FactorKey, readonly Ret[]>>, n = 10) {
  const per = FACTOR_KEYS.map(k => ({ k, years: new Map(calendarYears(months, factors[k] ?? months.map(() => null)).map(y => [y.year, y.ret])) }));
  const all = [...new Set(per.flatMap(p => [...p.years.keys()]))].sort((a, b) => b - a).slice(0, n);
  return all.map(year => {
    const rets = Object.fromEntries(per.map(p => [p.k, p.years.get(year) ?? null])) as Record<FactorKey, number | null>;
    let best: FactorKey | null = null;
    FACTOR_KEYS.forEach(k => { const r = rets[k]; if (r != null && (best == null || r > (rets[best] as number))) best = k; });
    return { year, rets, best };
  });
}

const round1 = (x: number) => Math.round(x * 10) / 10;
/** Inputs for the CAPM calculator: the market's total yearly return (market excess plus the T-bill rate) and the T-bill rate, in percent with one decimal. */
export function capmInputs(mkt: readonly Ret[], rf: readonly Ret[]): { rm: number; rf: number } | null {
  const both = mkt.map((m, i) => (ok(m) && ok(rf[i]) ? (m as number) + (rf[i] as number) : null));
  const total = annualised(both), bill = annualised(rf.filter((_, i) => both[i] != null));
  return total == null || bill == null ? null : { rm: round1(total * 100), rf: round1(bill * 100) };
}
