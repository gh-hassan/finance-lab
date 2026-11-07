/** Ratios worked out from a company's annual statements (the table returned by /api/edgar).
    Every function returns null instead of guessing when an input is missing or a division makes no sense. */
import { cagr } from './series';
import { money, pct, monthYear } from './format';

export type Row = (number | null)[];
export interface Statements { kind: 'standard' | 'financial'; periods: { end: string }[]; rows: Record<string, Row> }

const ok = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
export const div = (a: number | null | undefined, b: number | null | undefined): number | null => (ok(a) && ok(b) && b !== 0 ? a / b : null);
const sub = (a: number | null | undefined, b: number | null | undefined): number | null => (ok(a) && ok(b) ? a - b : null);
const add = (a: number | null | undefined, b: number | null | undefined): number | null => (ok(a) && ok(b) ? a + b : null);
const each = (n: number, f: (i: number) => number | null): Row => Array.from({ length: n }, (_, i) => f(i));

export interface Ratios { [k: string]: Row }

export function ratios(s: Statements): Ratios {
  const r = s.rows, n = s.periods.length, g = (k: string, i: number) => (r[k] ? r[k][i] : null);
  const ebitda = each(n, i => add(g('operatingIncome', i), g('da', i)));
  const fcf = each(n, i => sub(g('cfo', i), g('capex', i)));
  const taxRate = each(n, i => { const pre = add(g('netIncome', i), g('incomeTax', i)); const t = div(g('incomeTax', i), pre); return t != null && pre != null && pre > 0 && t >= 0 && t <= 0.6 ? t : null; });
  return {
    revenueGrowth: each(n, i => { const a = g('revenue', i - 1), b = g('revenue', i); return i && ok(a) && a > 0 && ok(b) ? b / a - 1 : null; }),
    grossMargin: each(n, i => div(g('grossProfit', i), g('revenue', i))),
    operatingMargin: each(n, i => div(g('operatingIncome', i), g('revenue', i))),
    ebitda, ebitdaMargin: each(n, i => div(ebitda[i], g('revenue', i))),
    netMargin: each(n, i => div(g('netIncome', i), g('revenue', i))),
    taxRate,
    roe: each(n, i => (ok(g('equity', i)) && (g('equity', i) as number) > 0 ? div(g('netIncome', i), g('equity', i)) : null)),
    roa: each(n, i => div(g('netIncome', i), g('assets', i))),
    assetTurnover: each(n, i => div(g('revenue', i), g('assets', i))),
    equityMultiplier: each(n, i => (ok(g('equity', i)) && (g('equity', i) as number) > 0 ? div(g('assets', i), g('equity', i)) : null)),
    debtToEquity: each(n, i => (ok(g('equity', i)) && (g('equity', i) as number) > 0 ? div(g('debt', i), g('equity', i)) : null)),
    netDebt: each(n, i => sub(g('debt', i), g('cash', i))),
    currentRatio: each(n, i => div(g('currentAssets', i), g('currentLiabilities', i))),
    interestCover: each(n, i => (ok(g('interestExpense', i)) && (g('interestExpense', i) as number) > 0 ? div(g('operatingIncome', i), g('interestExpense', i)) : null)),
    fcf, fcfMargin: each(n, i => div(fcf[i], g('revenue', i))),
    eps: each(n, i => div(g('netIncome', i), g('shares', i)))
  };
}

/** DuPont: ROE = net margin × asset turnover × equity multiplier, on year-end balances. Returns null if any part is missing, so the three always multiply to the ROE shown. */
export function dupont(s: Statements, i: number): { netMargin: number; assetTurnover: number; equityMultiplier: number; roe: number } | null {
  const q = ratios(s), nm = q.netMargin[i], at = q.assetTurnover[i], em = q.equityMultiplier[i], roe = q.roe[i];
  return ok(nm) && ok(at) && ok(em) && ok(roe) ? { netMargin: nm, assetTurnover: at, equityMultiplier: em, roe } : null;
}

/** Revenue growth over the whole table, per year, from the first to the last year that has revenue. */
export function revenueCagr(s: Statements): { cagr: number; years: number } | null {
  const rev = s.rows.revenue || [], first = rev.findIndex(ok), last = rev.length - 1 - [...rev].reverse().findIndex(ok);
  if (first < 0 || last <= first) return null;
  const yrs = (Date.parse(s.periods[last].end) - Date.parse(s.periods[first].end)) / (365.25 * 864e5), c = cagr(rev[first], rev[last], yrs);
  return c == null ? null : { cagr: c, years: yrs };
}

/** What a calculator needs, in $ millions, taken from the latest year. Fields we cannot support are left out, never defaulted. */
export function toCalculators(s: Statements): { dcf: Record<string, number>; comps: Record<string, number> } {
  const q = ratios(s), i = s.periods.length - 1, r = s.rows, M = (x: number | null | undefined) => (ok(x) ? Math.round(x / 1e5) / 10 : null);
  const put = (o: Record<string, number>, k: string, v: number | null) => { if (v != null && Number.isFinite(v)) o[k] = v; };
  const dcf: Record<string, number> = {}, comps: Record<string, number> = {};
  const rev = r.revenue ? r.revenue[i] : null;
  put(dcf, 'rev0', M(rev));
  const gr = q.revenueGrowth[i]; put(dcf, 'g1', gr != null ? Math.max(0, Math.min(40, Math.round(gr * 1000) / 10)) : null);
  const om = q.operatingMargin[i]; put(dcf, 'margin', om != null ? Math.max(2, Math.min(50, Math.round(om * 1000) / 10)) : null);
  const tr = q.taxRate[i]; put(dcf, 'tax', tr != null ? Math.round(tr * 100) : null);
  const da = div(r.da ? r.da[i] : null, rev); put(dcf, 'da', da != null ? Math.round(da * 1000) / 10 : null);
  const cx = div(r.capex ? r.capex[i] : null, rev); put(dcf, 'capex', cx != null ? Math.round(cx * 1000) / 10 : null);
  const nd = q.netDebt[i]; put(dcf, 'netdebt', M(nd)); put(comps, 'debt', M(nd));
  const sh = r.shares ? r.shares[i] : null; put(dcf, 'shares', ok(sh) ? Math.round(sh / 1e5) / 10 : null); put(comps, 'sh', ok(sh) ? Math.round(sh / 1e5) / 10 : null);
  put(comps, 'rev', M(rev)); put(comps, 'ni', M(r.netIncome ? r.netIncome[i] : null)); put(comps, 'ebitda', M(q.ebitda[i])); put(comps, 'book', M(r.equity ? r.equity[i] : null));
  return { dcf, comps };
}

const escHtml = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const b = (t: string) => `<b>${t}</b>`;

/** Which of the three DuPont parts moved ROE the most between the previous year and year i. Null if either year lacks a positive set of parts. */
export function dupontShift(s: Statements, i: number): { factor: 'netMargin' | 'assetTurnover' | 'equityMultiplier'; from: number; to: number; roeFrom: number; roeTo: number } | null {
  if (i < 1) return null;
  const a = dupont(s, i - 1), z = dupont(s, i);
  if (!a || !z || a.netMargin <= 0 || z.netMargin <= 0) return null;
  const keys = ['netMargin', 'assetTurnover', 'equityMultiplier'] as const;
  const move = keys.map(k => ({ k, m: Math.abs(Math.log(z[k] / a[k])) })).sort((x, y) => y.m - x.m)[0];
  return { factor: move.k, from: a[move.k], to: z[move.k], roeFrom: a.roe, roeTo: z.roe };
}

/** A few plain sentences about the latest year. Every number comes from the table; a sentence is skipped when its numbers are missing. */
export function plainWords(s: Statements, name: string): string[] {
  const out: string[] = [], n = s.periods.length;
  if (!n) return out;
  const i = n - 1, r = s.rows, q = ratios(s), nm = escHtml(name || 'The company'), yr = monthYear(s.periods[i].end);
  const rev = r.revenue ? r.revenue[i] : null, ni = r.netIncome ? r.netIncome[i] : null;
  if (ok(rev) && ok(ni)) {
    const m = q.netMargin[i];
    out.push(ni >= 0
      ? `In the year ended ${yr}, ${nm} had ${b(money(rev))} in sales and kept ${b(money(ni))} as profit${m != null ? `, ${m < 0.005 ? 'less than one cent' : b(Math.round(m * 100) + (Math.round(m * 100) === 1 ? ' cent' : ' cents'))} of every dollar of sales` : ''}.`
      : `In the year ended ${yr}, ${nm} had ${b(money(rev))} in sales but lost ${b(money(Math.abs(ni)))}.`);
  } else if (ok(ni)) out.push(`In the year ended ${yr}, ${nm} ${ni >= 0 ? 'earned' : 'lost'} ${b(money(Math.abs(ni)))}.`);
  const g = q.revenueGrowth[i], c = revenueCagr(s);
  if (g != null || c) out.push(`${g != null ? `Sales ${g >= 0 ? 'grew' : 'fell'} ${b(pct(Math.abs(g)))} in the latest year` : 'Sales'}${c ? `${g != null ? ' and' : ''} ${c.cagr >= 0 ? 'grew' : 'fell'} ${b(pct(Math.abs(c.cagr)))} a year on average over ${Math.round(c.years)} years` : ''}.`);
  if (s.kind === 'standard') {
    const cfo = r.cfo ? r.cfo[i] : null, cx = r.capex ? r.capex[i] : null, f = q.fcf[i];
    if (ok(cfo) && ok(cx) && f != null) out.push(`Its business brought in ${b(money(cfo))} of cash, and it spent ${b(money(cx))} on equipment and buildings. That leaves ${f >= 0 ? `${b(money(f))} of free cash flow to pay dividends, repay debt or invest` : `a shortfall of ${b(money(Math.abs(f)))}, so it needed other money to cover its spending`}.`);
    const debt = r.debt ? r.debt[i] : null, cash = r.cash ? r.cash[i] : null;
    if (ok(debt) && ok(cash)) out.push(`It owes ${b(money(debt))} in borrowings and holds ${b(money(cash))} in cash${debt > cash ? `, so net debt is ${b(money(debt - cash))}` : ', so it has more cash than debt'}.`);
    const cr = q.currentRatio[i]; if (cr != null) out.push(`Its short-term assets are ${b(cr.toFixed(2) + ' times')} its short-term bills${cr < 1 ? ', which is tight' : ''}.`);
  } else out.push('Banks, insurers and similar firms earn money by lending and investing, so margins and debt do not mean the same thing for them. We leave those out.');
  const roe = q.roe[i]; if (roe != null) out.push(`Owners earned ${b(pct(roe))} on the money they have tied up in the company (return on equity).`);
  return out;
}
