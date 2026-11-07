/** Financial maths behind the BA II Plus style calculator. Pure functions with the same conventions as the handheld:
 *  cash you receive is positive, cash you pay is negative, rates are entered in percent. */
import { findRoot, irr as irrOf, mean, stdev } from './math';

/* ---------------- time value of money ---------------- */
export interface Tvm { N: number; IY: number; PV: number; PMT: number; FV: number }
export type TvmKey = keyof Tvm;

/** Rate per payment period from the yearly rate (percent), payments per year and compounding periods per year. */
export const periodRate = (iy: number, py: number, cy: number): number => Math.pow(1 + iy / 100 / cy, cy / py) - 1;
/** Yearly rate (percent) from a rate per payment period. */
export const yearlyRate = (i: number, py: number, cy: number): number => 100 * cy * (Math.pow(1 + i, py / cy) - 1);

/** Annuity factor for N payments: ((1+i)^N − 1) ÷ i, times (1+i) when payments are at the start of each period. */
const annFactor = (i: number, N: number, bgn: boolean): number => (Math.abs(i) < 1e-14 ? N : ((Math.pow(1 + i, N) - 1) / i) * (bgn ? 1 + i : 1));

/** The balance equation that every TVM problem satisfies: PV(1+i)^N + PMT·factor + FV = 0. */
export const tvmResidual = (t: Tvm, py: number, cy: number, bgn: boolean, iOverride?: number): number => {
  const i = iOverride ?? periodRate(t.IY, py, cy);
  return t.PV * Math.pow(1 + i, t.N) + t.PMT * annFactor(i, t.N, bgn) + t.FV;
};

/** Solve one TVM variable. Returns null when there is no solution (the handheld shows Error 5). */
export function solveTvm(t: Tvm, key: TvmKey, py: number, cy: number, bgn: boolean): number | null {
  const i = periodRate(t.IY, py, cy), g = Math.pow(1 + i, t.N);
  let v: number;
  switch (key) {
    case 'FV': v = -(t.PV * g + t.PMT * annFactor(i, t.N, bgn)); break;
    case 'PV': v = -(t.FV + t.PMT * annFactor(i, t.N, bgn)) / g; break;
    case 'PMT': { const f = annFactor(i, t.N, bgn); v = f === 0 ? NaN : -(t.PV * g + t.FV) / f; break; }
    case 'N': {
      if (Math.abs(i) < 1e-14) { v = t.PMT === 0 ? NaN : -(t.PV + t.FV) / t.PMT; break; }
      const k = (t.PMT * (bgn ? 1 + i : 1)) / i, num = k - t.FV, den = k + t.PV;
      v = num / den > 0 && 1 + i > 0 ? Math.log(num / den) / Math.log(1 + i) : NaN; break;
    }
    default: { /* IY: search the periodic rate, then convert back */
      const f = (r: number) => tvmResidual(t, py, cy, bgn, r);
      let r = findRoot(f, -0.99, 5, 4000);
      if (!Number.isFinite(r)) r = findRoot(f, -0.99, 100, 8000);
      v = Number.isFinite(r) ? yearlyRate(r, py, cy) : NaN;
    }
  }
  return Number.isFinite(v) ? v : null;
}

/* ---------------- cash flows ---------------- */
export interface Flow { c: number; f: number }
/** Expand cash flows with repeat counts into one value per period, starting with CF0. */
export const expandFlows = (cf0: number, flows: Flow[]): number[] => [cf0, ...flows.flatMap(x => Array(Math.max(0, Math.min(9999, Math.round(x.f)))).fill(x.c))];
export const npvAt = (rate: number, series: number[]): number => series.reduce((s, x, t) => s + x / Math.pow(1 + rate / 100, t), 0);
export const irrPercent = (series: number[]): number | null => { const r = irrOf(series); return Number.isFinite(r) ? r * 100 : null; };
export const nfvAt = (rate: number, series: number[]): number => npvAt(rate, series) * Math.pow(1 + rate / 100, series.length - 1);
/** Profitability index: 1 + PV of later flows ÷ initial outlay. */
export const piAt = (rate: number, series: number[]): number | null => (series[0] === 0 ? null : 1 + (npvAt(rate, series) - series[0]) / Math.abs(series[0]));
/** Payback period in years, interpolated inside the year it happens. Pass a rate for discounted payback. Null if never repaid. */
export function paybackPeriod(series: number[], rate?: number): number | null {
  let cum = series[0];
  if (cum >= 0) return 0;
  for (let t = 1; t < series.length; t++) {
    const flow = rate === undefined ? series[t] : series[t] / Math.pow(1 + rate / 100, t);
    if (cum + flow >= 0) return t - 1 + (flow === 0 ? 0 : -cum / flow);
    cum += flow;
  }
  return null;
}

/* ---------------- amortization ---------------- */
export interface Amort { bal: number; prn: number; int: number }
/** Balance, principal and interest between payments p1 and p2 inclusive. The payment is rounded to `dec` places as the handheld does. */
export function amortize(t: Tvm, py: number, cy: number, bgn: boolean, p1: number, p2: number, dec: number | null): Amort | null {
  const i = periodRate(t.IY, py, cy), n = Math.round(t.N);
  if (!(p1 >= 1) || !(p2 >= p1) || p2 > n) return null;
  const rnd = (x: number) => (dec === null ? x : Math.round(x * Math.pow(10, dec)) / Math.pow(10, dec));
  const pmt = rnd(t.PMT);
  let bal = t.PV, prn = 0, int = 0;
  for (let k = 1; k <= p2; k++) {
    const interest = bgn && k === 1 ? 0 : -rnd(bal * i), principal = pmt - interest;
    bal += principal;
    if (k >= p1) { prn += principal; int += interest; }
  }
  return { bal, prn, int };
}

/* ---------------- dates ---------------- */
const DAY = 86400000;
/** MM.DDYY number to a UTC date. Years 50 to 99 mean 1950 to 1999, 00 to 49 mean 2000 to 2049. Null if it is not a real date. */
export function toDate(v: number): Date | null {
  const m = Math.floor(v + 1e-9), frac = Math.round((v - m) * 10000), dd = Math.floor(frac / 100), yy = frac % 100, yr = yy >= 50 ? 1900 + yy : 2000 + yy;
  const d = new Date(Date.UTC(yr, m - 1, dd));
  return m >= 1 && m <= 12 && dd >= 1 && d.getUTCMonth() === m - 1 && d.getUTCDate() === dd ? d : null;
}
export const fromDate = (d: Date): number => d.getUTCMonth() + 1 + (d.getUTCDate() * 100 + (d.getUTCFullYear() % 100)) / 10000;
export const addDays = (d: Date, n: number): Date => new Date(d.getTime() + n * DAY);
export const daysActual = (a: Date, b: Date): number => Math.round((b.getTime() - a.getTime()) / DAY);
/** 30/360 US day count. */
export function days360(a: Date, b: Date): number {
  let d1 = a.getUTCDate(), d2 = b.getUTCDate();
  if (d1 === 31) d1 = 30;
  if (d2 === 31 && d1 >= 30) d2 = 30;
  return (b.getUTCFullYear() - a.getUTCFullYear()) * 360 + (b.getUTCMonth() - a.getUTCMonth()) * 30 + (d2 - d1);
}
export function addMonths(d: Date, k: number): Date {
  const y = d.getUTCFullYear(), m = d.getUTCMonth() + k, last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m, Math.min(d.getUTCDate(), last)));
}
export const fmtDate = (d: Date): string => `${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}-${d.getUTCFullYear()}`;

/* ---------------- bonds ---------------- */
export interface BondIn { sdt: number; cpn: number; rdt: number; rv: number; act: boolean; semi: boolean }
interface Sched { n: number; A: number; E: number; DSC: number; c: number }
function schedule(b: BondIn): Sched | null {
  const s = toDate(b.sdt), r = toDate(b.rdt);
  if (!s || !r || s >= r) return null;
  const f = b.semi ? 2 : 1, step = 12 / f;
  let j = 0;
  while (addMonths(r, -(j + 1) * step) > s) j++;
  const pcd = addMonths(r, -(j + 1) * step), ncd = addMonths(r, -j * step);
  const A = b.act ? daysActual(pcd, s) : days360(pcd, s), E = b.act ? daysActual(pcd, ncd) : 360 / f;
  return { n: j + 1, A, E, DSC: E - A, c: b.cpn / f };
}
/** Accrued interest per 100 of face since the last coupon. */
export function accrued(b: BondIn): number | null { const s = schedule(b); return s ? s.c * (s.A / s.E) : null; }
/** Clean price per 100 of face for a yield (percent). */
export function bondPriceFromYield(b: BondIn, yld: number): number | null {
  const s = schedule(b); if (!s) return null;
  const f = b.semi ? 2 : 1, y = yld / 100 / f, w = s.DSC / s.E;
  let pv = b.rv / Math.pow(1 + y, s.n - 1 + w);
  for (let k = 1; k <= s.n; k++) pv += s.c / Math.pow(1 + y, k - 1 + w);
  return pv - s.c * (s.A / s.E);
}
/** Yield (percent) that gives a clean price. */
export function bondYieldFromPrice(b: BondIn, price: number): number | null {
  if (!schedule(b)) return null;
  const r = findRoot(y => (bondPriceFromYield(b, y) as number) - price, -50, 400, 4000);
  return Number.isFinite(r) ? r : null;
}

/* ---------------- depreciation ---------------- */
export interface DeprIn { method: 'SL' | 'SYD' | 'DB'; life: number; m: number; cst: number; sal: number; yr: number; db: number }
/** Depreciation for year `yr` and the book value left. `m` is the month the asset enters service (1 = January, a full first year). */
export function depreciate(d: DeprIn): { dep: number; rbv: number; rdv: number } | null {
  const L = d.life, first = (13 - d.m) / 12, base = d.cst - d.sal;
  if (!(L > 0) || !(d.yr >= 1) || d.m < 1 || d.m > 12) return null;
  const years = Math.ceil(L - 1e-9) + (first < 1 ? 1 : 0), dep: number[] = [];
  let book = d.cst;
  for (let y = 1; y <= years; y++) {
    let x = 0;
    if (d.method === 'SL') { const a = base / L; x = y === 1 ? a * first : Math.min(a, Math.max(0, base - dep.reduce((s, q) => s + q, 0))); }
    else if (d.method === 'DB') { const rate = d.db / 100 / L; x = Math.min(book * rate * (y === 1 ? first : 1), Math.max(0, book - d.sal)); }
    else { /* sum of years digits over remaining life, with a partial first year */
      const n = Math.ceil(L), tot = (n * (n + 1)) / 2, w = (k: number) => (k >= 1 && k <= n ? (n - k + 1) / tot : 0);
      x = base * (y === 1 ? w(1) * first : (y <= n ? w(y - 1) * (1 - first) + w(y) * first : w(y - 1) * (1 - first)));
      if (first >= 1) x = base * w(y);
    }
    dep.push(x); book -= x;
  }
  const dy = dep[Math.min(d.yr, dep.length) - 1] ?? 0, spent = dep.slice(0, Math.min(d.yr, dep.length)).reduce((s, q) => s + q, 0);
  return { dep: d.yr > dep.length ? 0 : dy, rbv: d.cst - spent, rdv: d.cst - spent - d.sal };
}

/* ---------------- statistics ---------------- */
export interface Pt { x: number; y: number }
export interface Stats { n: number; xbar: number; sx: number; sigx: number; ybar: number; sy: number; sigy: number; a: number; b: number; r: number; sumx: number; sumx2: number; sumy: number; sumy2: number; sumxy: number }
export function statistics(pts: Pt[]): Stats | null {
  const n = pts.length; if (n < 1) return null;
  const xs = pts.map(p => p.x), ys = pts.map(p => p.y), sum = (a: number[]) => a.reduce((s, v) => s + v, 0);
  const sumx = sum(xs), sumy = sum(ys), sumx2 = sum(xs.map(v => v * v)), sumy2 = sum(ys.map(v => v * v)), sumxy = sum(xs.map((v, i) => v * ys[i]));
  const sx = n > 1 ? stdev(xs) : NaN, sy = n > 1 ? stdev(ys) : NaN, sigx = Math.sqrt(sumx2 / n - (sumx / n) ** 2), sigy = Math.sqrt(sumy2 / n - (sumy / n) ** 2);
  const den = n * sumx2 - sumx * sumx, b = den === 0 ? NaN : (n * sumxy - sumx * sumy) / den, a = (sumy - b * sumx) / n;
  const rd = Math.sqrt((n * sumx2 - sumx * sumx) * (n * sumy2 - sumy * sumy)), r = rd === 0 ? NaN : (n * sumxy - sumx * sumy) / rd;
  return { n, xbar: mean(xs), sx, sigx, ybar: mean(ys), sy, sigy, a, b, r, sumx, sumx2, sumy, sumy2, sumxy };
}

/* ---------------- small worksheets ---------------- */
export interface Be { fc: number; vc: number; p: number; pft: number; q: number }
/** Break-even identity: PFT = Q·(P − VC) − FC. Solve the named field from the others. */
export function solveBreakeven(b: Be, key: keyof Be): number | null {
  let v: number;
  switch (key) {
    case 'pft': v = b.q * (b.p - b.vc) - b.fc; break;
    case 'q': v = b.p === b.vc ? NaN : (b.fc + b.pft) / (b.p - b.vc); break;
    case 'p': v = b.q === 0 ? NaN : (b.fc + b.pft) / b.q + b.vc; break;
    case 'vc': v = b.q === 0 ? NaN : b.p - (b.fc + b.pft) / b.q; break;
    default: v = b.q * (b.p - b.vc) - b.pft;
  }
  return Number.isFinite(v) ? v : null;
}
export interface Prft { cst: number; sel: number; mar: number }
/** Margin on selling price: MAR = (SEL − CST) ÷ SEL × 100. */
export function solveProfit(p: Prft, key: keyof Prft): number | null {
  let v: number;
  if (key === 'mar') v = p.sel === 0 ? NaN : ((p.sel - p.cst) / p.sel) * 100;
  else if (key === 'sel') v = 1 - p.mar / 100 === 0 ? NaN : p.cst / (1 - p.mar / 100);
  else v = p.sel * (1 - p.mar / 100);
  return Number.isFinite(v) ? v : null;
}
/** Nominal to effective annual rate (percent) and back, for `cy` compounding periods a year. */
export const effFromNom = (nom: number, cy: number): number => (Math.pow(1 + nom / 100 / cy, cy) - 1) * 100;
export const nomFromEff = (eff: number, cy: number): number => cy * (Math.pow(1 + eff / 100, 1 / cy) - 1) * 100;
