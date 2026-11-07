/** Fixed income, derivatives, risk, credit, buyout, retirement and factor maths. Pure functions, no DOM. */
import { ninv, npdf, percentile } from './math';

/* ---------------- yield curve ---------------- */
export interface CurveRow { t: number; par: number; spot: number; df: number; fwd: number }
/** Bootstrap spot rates and one-year forward rates from par yields on annual-pay bonds priced at par, for maturities 1, 2, 3 and so on. */
export function bootstrap(par: number[]): CurveRow[] {
  const rows: CurveRow[] = []; let annuity = 0;
  par.forEach((y, i) => {
    const t = i + 1, df = (1 - y * annuity) / (1 + y), spot = Math.pow(1 / df, 1 / t) - 1;
    const prev = rows[i - 1], fwd = prev ? Math.pow(1 + spot, t) / Math.pow(1 + prev.spot, t - 1) - 1 : spot;
    rows.push({ t, par: y, spot, df, fwd }); annuity += df;
  });
  return rows;
}
export interface Bond { price: number; macaulay: number; modified: number; flows: { t: number; cf: number; pv: number }[] }
/** Price an annual-coupon bond from the spot curve, with its Macaulay duration measured on the same discounting. */
export function priceOnCurve(curve: CurveRow[], face: number, coupon: number, years: number): Bond {
  const n = Math.min(Math.round(years), curve.length), flows = [] as Bond['flows'];
  for (let t = 1; t <= n; t++) { const cf = face * coupon + (t === n ? face : 0), pv = cf * curve[t - 1].df; flows.push({ t, cf, pv }); }
  const price = flows.reduce((s, f) => s + f.pv, 0), macaulay = flows.reduce((s, f) => s + f.t * f.pv, 0) / price;
  return { price, macaulay, modified: macaulay / (1 + curve[n - 1].spot), flows };
}
/** Weight in the shorter of two zero-coupon bonds so the portfolio duration equals the horizon. Null when the horizon is outside the two maturities. */
export function immunize(horizon: number, short: number, long: number): number | null {
  if (!(long > short) || horizon < short - 1e-12 || horizon > long + 1e-12) return null;
  return (long - horizon) / (long - short);
}

/* ---------------- forwards, futures, swaps ---------------- */
/** Cost-of-carry forward price with continuous rates: F = S·e^((r + storage − yield)·T). */
export const forwardPrice = (S: number, r: number, storage: number, yld: number, T: number): number => S * Math.exp((r + storage - yld) * T);
/** Minimum-variance hedge ratio and number of futures contracts. */
export const hedgeRatio = (rho: number, sdSpot: number, sdFut: number): number => (sdFut > 0 ? (rho * sdSpot) / sdFut : NaN);
export const contracts = (h: number, exposure: number, contractValue: number): number => (contractValue > 0 ? (h * exposure) / contractValue : NaN);
/** Par swap rate from discount factors: (1 − DF_n) ÷ ΣDF_t. */
export const swapRate = (df: number[]): number => (1 - df[df.length - 1]) / df.reduce((s, x) => s + x, 0);
/** Value to the fixed-rate payer of an existing swap per unit notional: (market rate − fixed rate) × annuity of discount factors. */
export const swapValue = (df: number[], fixed: number): number => (swapRate(df) - fixed) * df.reduce((s, x) => s + x, 0);

/* ---------------- value at risk ---------------- */
/** Parametric (normal) value at risk as a positive loss for a horizon in years: z·σ·√T − μ·T, times the portfolio value. */
export const varNormal = (value: number, mu: number, sd: number, T: number, conf: number): number => value * (ninv(conf) * sd * Math.sqrt(T) - mu * T);
/** Expected shortfall under normality: the average loss beyond the VaR. */
export const esNormal = (value: number, mu: number, sd: number, T: number, conf: number): number => value * ((sd * Math.sqrt(T) * npdf(ninv(conf))) / (1 - conf) - mu * T);
/** Historical VaR and expected shortfall from a list of period returns (as fractions). Returns positive losses. */
export function varHistorical(returns: number[], value: number, conf: number): { var: number; es: number } | null {
  if (returns.length < 5) return null;
  const sorted = [...returns].sort((a, b) => a - b), cut = percentile(sorted, 1 - conf), tail = sorted.filter(r => r <= cut);
  return { var: -cut * value, es: -(tail.reduce((s, x) => s + x, 0) / tail.length) * value };
}

/* ---------------- credit ---------------- */
export type ZModel = 'public' | 'private' | 'service';
export interface ZIn { wc: number; re: number; ebit: number; equity: number; liab: number; sales: number; assets: number }
export interface ZOut { z: number; zone: 'safe' | 'grey' | 'distress'; x: number[]; cut: [number, number] }
/** Altman Z-score: public manufacturers (market equity), private firms (book equity) or service and emerging-market firms. */
export function altman(m: ZIn, model: ZModel): ZOut {
  const A = m.assets, x = [m.wc / A, m.re / A, m.ebit / A, m.equity / m.liab, m.sales / A];
  if (model === 'public') { const z = 1.2 * x[0] + 1.4 * x[1] + 3.3 * x[2] + 0.6 * x[3] + 1.0 * x[4]; return { z, zone: z > 2.99 ? 'safe' : z >= 1.81 ? 'grey' : 'distress', x, cut: [1.81, 2.99] }; }
  if (model === 'private') { const z = 0.717 * x[0] + 0.847 * x[1] + 3.107 * x[2] + 0.42 * x[3] + 0.998 * x[4]; return { z, zone: z > 2.9 ? 'safe' : z >= 1.23 ? 'grey' : 'distress', x, cut: [1.23, 2.9] }; }
  const z = 6.56 * x[0] + 3.26 * x[1] + 6.72 * x[2] + 1.05 * x[3]; return { z, zone: z > 2.6 ? 'safe' : z >= 1.1 ? 'grey' : 'distress', x: x.slice(0, 4), cut: [1.1, 2.6] };
}

/* ---------------- leveraged buyout ---------------- */
export interface LboIn { ebitda: number; entry: number; debtX: number; fee: number; rate: number; growth: number; capex: number; tax: number; exit: number; years: number }
export interface LboYear { year: number; ebitda: number; interest: number; fcf: number; debt: number }
export interface LboOut {
  ev0: number; debt0: number; equity0: number; years: LboYear[]; evN: number; debtN: number; equityN: number; moic: number; irr: number;
  cash: number;
  bridge: { growth: number; multiple: number; paydown: number; cash: number; fees: number };
}
/** Simple buyout: all free cash after interest, tax and capital spending repays debt. Capital spending is set equal to depreciation so tax is on EBITDA less capex less interest. */
export function lbo(m: LboIn): LboOut {
  const ev0 = m.entry * m.ebitda, debt0 = Math.min(ev0, m.debtX * m.ebitda), fees = ev0 * m.fee, equity0 = ev0 + fees - debt0;
  let debt = debt0, cash = 0, e = m.ebitda; const years: LboYear[] = [];
  for (let y = 1; y <= m.years; y++) {
    e *= 1 + m.growth;
    const interest = debt * m.rate, capex = e * m.capex, taxable = Math.max(0, e - capex - interest), fcf = e - capex - interest - taxable * m.tax;
    const pay = Math.min(debt, Math.max(0, fcf)); debt -= pay; cash += fcf - pay; years.push({ year: y, ebitda: e, interest, fcf, debt });
  }
  const evN = m.exit * e, equityN = evN - debt + cash, moic = equityN / equity0, irr = moic > 0 ? Math.pow(moic, 1 / m.years) - 1 : -1;
  return { ev0, debt0, equity0, years, evN, debtN: debt, cash, equityN, moic, irr, bridge: { growth: (e - m.ebitda) * m.entry, multiple: (m.exit - m.entry) * e, paydown: debt0 - debt, cash, fees: -fees } };
}

/* ---------------- retirement ---------------- */
export interface RetireIn { age: number; retire: number; live: number; saved: number; add: number; addGrowth: number; pre: number; post: number; inflation: number; income: number }
export interface RetireOut { atRetire: number; need: number; gap: number; yearsSaving: number; yearsIncome: number; firstWithdrawal: number; extraPerYear: number; fundedUntil: number }
const fvSeries = (m: RetireIn, add: number): number => { let b = m.saved; for (let y = 0; y < Math.max(0, m.retire - m.age); y++) b = b * (1 + m.pre) + add * Math.pow(1 + m.addGrowth, y); return b; };
/** Balance at retirement and the nest egg needed to pay an inflation-linked income until the planning age. Withdrawals are taken at the start of each year. */
export function retirement(m: RetireIn): RetireOut {
  const yearsSaving = Math.max(0, m.retire - m.age), yearsIncome = Math.max(1, m.live - m.retire);
  const first = m.income * Math.pow(1 + m.inflation, yearsSaving), real = (1 + m.post) / (1 + m.inflation) - 1;
  const need = Math.abs(real) < 1e-12 ? first * yearsIncome : first * ((1 - Math.pow(1 + real, -yearsIncome)) / real) * (1 + real);
  const atRetire = fvSeries(m, m.add), gap = need - atRetire;
  const base = fvSeries(m, 0), unit = fvSeries(m, 1) - base, extra = unit > 0 ? Math.max(0, (need - atRetire) / unit) : NaN;
  let b = atRetire, w = first, age = m.retire;
  while (age < 120 && b - w >= 0) { b = (b - w) * (1 + m.post); w *= 1 + m.inflation; age++; }
  return { atRetire, need, gap, yearsSaving, yearsIncome, firstWithdrawal: first, extraPerYear: extra, fundedUntil: age };
}

/* ---------------- factor models ---------------- */
/** Expected return from a factor model: r_f plus the sum of loading × factor premium. */
export const factorReturn = (rf: number, loadings: number[], premia: number[]): number => rf + loadings.reduce((s, b, i) => s + b * (premia[i] ?? 0), 0);
