/** Corporate finance maths for relative valuation, the three-statement model, depreciation, leasing and payouts. Pure functions. */
import { percentile, mean, median } from './math';

/* ---------------- relative valuation ---------------- */
export interface MultipleStats { low: number; mid: number; high: number; mean: number; n: number }
/** Spread of a list of peer multiples: 25th percentile, median, 75th percentile and mean. Non-positive and non-finite values are ignored. */
export function multipleStats(xs: number[]): MultipleStats | null {
  const a = xs.filter(x => Number.isFinite(x) && x > 0).sort((p, q) => p - q);
  if (!a.length) return null;
  return { low: percentile(a, 0.25), mid: median(a), high: percentile(a, 0.75), mean: mean(a), n: a.length };
}

/* ---------------- depreciation ---------------- */
export type DeprMethod = 'sl' | 'ddb' | 'syd' | 'macrs5' | 'macrs7';
export const MACRS: Record<string, number[]> = {
  macrs5: [0.2, 0.32, 0.192, 0.1152, 0.1152, 0.0576],
  macrs7: [0.1429, 0.2449, 0.1749, 0.1249, 0.0893, 0.0892, 0.0893, 0.0446]
};
/** Depreciation expense for each year. Straight line and sum-of-years-digits stop at salvage; double declining switches to straight line when that is larger; MACRS ignores salvage by law. */
export function depreciation(cost: number, salvage: number, life: number, method: DeprMethod): number[] {
  if (method === 'macrs5' || method === 'macrs7') return MACRS[method].map(r => cost * r);
  const n = Math.max(1, Math.round(life)), base = Math.max(0, cost - salvage), out: number[] = [];
  if (method === 'sl') return Array.from({ length: n }, () => base / n);
  if (method === 'syd') { const tot = (n * (n + 1)) / 2; return Array.from({ length: n }, (_, k) => (base * (n - k)) / tot); }
  let book = cost;
  for (let k = 0; k < n; k++) {
    const ddb = (2 / n) * book, sl = (book - salvage) / (n - k), d = Math.max(0, Math.min(Math.max(ddb, sl), book - salvage));
    out.push(d); book -= d;
  }
  return out;
}

/** Present value of a stream received at the end of years 1..n. */
export const pvStream = (flows: number[], rate: number): number => flows.reduce((s, x, k) => s + x / Math.pow(1 + rate, k + 1), 0);

export interface LeaseResult { pvLease: number; pvShield: number; pvSalvage: number; nal: number; buyNpv: number; leaseNpv: number; dep: number[] }
/** Net advantage to leasing for an asset bought with cash. Lease payments are tax deductible and paid at the end of each year; the discount rate is the after-tax cost of debt. */
export function leaseVsBuy(cost: number, salvage: number, life: number, method: DeprMethod, tax: number, rate: number, payment: number, term: number): LeaseResult {
  const dep = depreciation(cost, salvage, life, method), shield = dep.map(d => d * tax);
  const pvShield = pvStream(shield, rate), pvLease = pvStream(Array.from({ length: Math.round(term) }, () => payment * (1 - tax)), rate);
  const bookEnd = Math.max(0, cost - dep.reduce((s, x) => s + x, 0));
  const salvageAfterTax = salvage - tax * (salvage - bookEnd), pvSalvage = salvageAfterTax / Math.pow(1 + rate, Math.max(1, Math.round(life)));
  const buyNpv = -cost + pvShield + pvSalvage, leaseNpv = -pvLease;
  return { pvLease, pvShield, pvSalvage, nal: leaseNpv - buyNpv, buyNpv, leaseNpv, dep };
}

/* ---------------- three-statement model ---------------- */
export interface ModelIn {
  rev0: number; growth: number[]; cogsPct: number; opexPct: number; daPct: number; capexPct: number; nwcPct: number;
  tax: number; rate: number; repay: number; payout: number; cash0: number; debt0: number; ppe0: number; nwc0: number;
}
export interface YearOut {
  rev: number; cogs: number; gross: number; opex: number; ebitda: number; da: number; ebit: number; interest: number; ebt: number; taxes: number; ni: number;
  cfo: number; capex: number; fcf: number; repay: number; div: number; dcash: number;
  cash: number; nwc: number; ppe: number; assets: number; debt: number; equity: number; check: number;
}
/** Project the income statement, cash flow and balance sheet. Equity at the start is the balancing figure, so a correct model keeps `check` at zero every year. */
export function threeStatement(m: ModelIn): YearOut[] {
  let cash = m.cash0, debt = m.debt0, ppe = m.ppe0, nwc = m.nwc0, equity = cash + nwc + ppe - debt, rev = m.rev0;
  return m.growth.map(g => {
    const prev = rev; rev = prev * (1 + g);
    const cogs = rev * m.cogsPct, gross = rev - cogs, opex = rev * m.opexPct, ebitda = gross - opex, da = rev * m.daPct, ebit = ebitda - da;
    const interest = debt * m.rate, ebt = ebit - interest, taxes = Math.max(0, ebt) * m.tax, ni = ebt - taxes;
    const dNwc = (rev - prev) * m.nwcPct, capex = rev * m.capexPct, cfo = ni + da - dNwc, fcf = cfo - capex;
    const repay = Math.min(debt, m.repay), div = Math.max(0, ni) * m.payout, dcash = cfo - capex - repay - div;
    cash += dcash; ppe += capex - da; nwc += dNwc; debt -= repay; equity += ni - div;
    const assets = cash + nwc + ppe;
    return { rev, cogs, gross, opex, ebitda, da, ebit, interest, ebt, taxes, ni, cfo, capex, fcf, repay, div, dcash, cash, nwc, ppe, assets, debt, equity, check: assets - debt - equity };
  });
}

/* ---------------- dividends and buybacks ---------------- */
export interface PayoutIn { earnings: number; shares: number; price: number; cash: number; taxDiv: number; taxCg: number; basis: number; hold: number }
export interface PayoutOut {
  eps: number; pe: number; payoutRatio: number; dps: number; yieldPct: number;
  bought: number; sharesAfter: number; epsAfter: number;
  /** Holder under a dividend: after-tax cash, value of shares kept, total after tax. */
  divCash: number; divKept: number; divTotal: number;
  /** Holder under a buyback who sells enough shares to raise the same cash before tax. */
  sold: number; buyCash: number; buyKept: number; buyTotal: number;
  /** Holder when the cash is simply kept in the company. */
  retainTotal: number; edge: number;
}
/** Compare one holder of `hold` shares when the company has `cash` to return: dividend, buyback, or keep it. Perfect markets apart from tax: the price drops by the dividend per share; a buyback leaves the price unchanged. */
export function payout(p: PayoutIn): PayoutOut {
  const eps = p.earnings / p.shares, pe = p.price / eps, dps = p.cash / p.shares;
  const bought = p.cash / p.price, sharesAfter = p.shares - bought, epsAfter = p.earnings / sharesAfter;
  const gross = p.hold * dps, divCash = gross * (1 - p.taxDiv), divKept = p.hold * (p.price - dps), divTotal = divCash + divKept;
  const sold = gross / p.price, tax = sold * Math.max(0, p.price - p.basis) * p.taxCg, buyCash = gross - tax, buyKept = (p.hold - sold) * p.price, buyTotal = buyCash + buyKept;
  const retainTotal = p.hold * p.price;
  return { eps, pe, payoutRatio: p.cash / p.earnings, dps, yieldPct: dps / p.price, bought, sharesAfter, epsAfter, divCash, divKept, divTotal, sold, buyCash, buyKept, buyTotal, retainTotal, edge: buyTotal - divTotal };
}
