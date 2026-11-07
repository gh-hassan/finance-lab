/** Industry benchmarks from Prof. Aswath Damodaran's US industry data (NYU Stern). Pure helpers over the table in src/data/industries.json. */
import { pct, mult } from './format';

export interface Industry {
  name: string; firms: number;
  beta: number | null; unlevBeta: number | null; de: number | null; tax: number | null;
  costEquity: number | null; equityWeight: number | null; costDebt: number | null; debtWeight: number | null; wacc: number | null;
  evEbitda: number | null; evEbit: number | null; pe: number | null; fwdPe: number | null; losing: number | null; growth: number | null;
  grossMargin: number | null; netMargin: number | null; opMargin: number | null; ebitdaMargin: number | null;
}
export interface IndustryData { asOf: string; rf: number; erp: number; marginalTax: number; source: string; market: { all: Industry; exFin: Industry }; industries: Industry[] }
export type Metric = Exclude<keyof Industry, 'name'>;

const ok = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);

/** Industries whose name contains the text (case and punctuation insensitive), best matches first. */
export function search(list: readonly Industry[], text: string): Industry[] {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(), q = norm(text);
  if (!q) return list.slice();
  const starts = list.filter(i => norm(i.name).startsWith(q)), has = list.filter(i => !norm(i.name).startsWith(q) && norm(i.name).includes(q));
  return [...starts, ...has];
}

/** Sorts by a metric (or by name). Industries with no value always go last, in either direction. */
export function sortBy(list: readonly Industry[], key: Metric | 'name', dir: 'asc' | 'desc'): Industry[] {
  const s = dir === 'asc' ? 1 : -1;
  return list.slice().sort((a, b) => {
    if (key === 'name') return s * a.name.localeCompare(b.name);
    const x = a[key] as number | null, y = b[key] as number | null;
    if (!ok(x) && !ok(y)) return a.name.localeCompare(b.name);
    if (!ok(x)) return 1; if (!ok(y)) return -1;
    return x === y ? a.name.localeCompare(b.name) : s * (x - y);
  });
}

/** Share of the OTHER industries that this one is higher than on a metric (0 to 1), or null when it has no value. The top industry is 1 and the bottom is 0. */
export function rank(list: readonly Industry[], ind: Industry, key: Metric): number | null {
  const v = ind[key] as number | null;
  if (!ok(v)) return null;
  const all = list.map(i => i[key] as number | null).filter(ok);
  return all.length < 2 ? null : all.filter(a => a < v).length / (all.length - 1);
}

/** "Higher than 70% of industries" style wording for a rank. */
export function rankText(r: number | null): string {
  if (r == null) return 'Not enough data';
  const p = Math.round(r * 100);
  return p >= 99 ? 'Among the highest of all industries' : p <= 1 ? 'Among the lowest of all industries' : p >= 50 ? `Higher than about ${p}% of industries` : `Lower than about ${100 - p}% of industries`;
}

const b = (t: string) => `<b>${t}</b>`;
const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** A few plain sentences about an industry. A sentence is skipped when its numbers are missing. */
export function plainWords(i: Industry, all: Industry): string[] {
  const out: string[] = [], n = esc(i.name);
  if (ok(i.beta)) out.push(`Across ${b(String(i.firms))} US companies in ${n}, the typical stock has a beta of ${b(i.beta.toFixed(2))}. ${i.beta > 1.05 ? `That means it tends to move ${Math.round((i.beta - 1) * 100)}% more than the overall market, up or down.` : i.beta < 0.95 ? `That means it tends to move ${Math.round((1 - i.beta) * 100)}% less than the overall market.` : 'That is about the same as the overall market.'}`);
  if (ok(i.costEquity) && ok(i.wacc)) out.push(`Investors in this industry typically want about ${b(pct(i.costEquity))} a year on shares. After blending in the cheaper cost of borrowing, the whole business needs to earn about ${b(pct(i.wacc))} a year to be worth the risk (cost of capital)${ok(all.wacc) ? `, compared with ${pct(all.wacc)} for all US companies` : ''}.`);
  if (ok(i.evEbitda)) out.push(`Companies here are priced at about ${b(mult(i.evEbitda))} their operating cash profit (EV/EBITDA)${ok(all.evEbitda) ? `, against ${mult(all.evEbitda)} across the market` : ''}.`);
  if (ok(i.opMargin) && ok(i.netMargin)) out.push(`Of every $1 of sales, about ${b(pct(i.opMargin, 0))} is left after running costs and ${b(pct(i.netMargin, 0))} after interest and tax.`);
  if (ok(i.de) && ok(i.debtWeight)) out.push(`They fund themselves with about ${b(pct(i.debtWeight, 0))} borrowed money (${b(i.de.toFixed(2))} of debt for every $1 of shareholder value).`);
  return out;
}

/** Calculator starting points from an industry. Only fields we really have are included. Percent fields are in percent. */
export function toCalculators(i: Industry, d: IndustryData): { wacc: Record<string, number>; dcf: Record<string, number>; comps: Record<string, string | number> } {
  const r1 = (x: number, p = 1) => Math.round(x * 10 ** p) / 10 ** p, put = (o: Record<string, number>, k: string, v: number | null | undefined, f: (x: number) => number) => { if (ok(v)) o[k] = f(v); };
  const wacc: Record<string, number> = { rf: r1(d.rf * 100, 2), erp: r1(d.erp * 100, 2), tax: Math.round(d.marginalTax * 100) };
  put(wacc, 'beta', i.beta, x => r1(Math.max(0.3, Math.min(2.5, x)), 2)); put(wacc, 'kd', i.costDebt, x => r1(x * 100, 2));
  if (ok(i.equityWeight) && ok(i.debtWeight)) { wacc.E = Math.round(i.equityWeight * 1000); wacc.D = Math.round(i.debtWeight * 1000); }
  const dcf: Record<string, number> = { tax: Math.round(d.marginalTax * 100) };
  put(dcf, 'wacc', i.wacc, x => r1(Math.max(4, Math.min(16, x * 100)), 2)); put(dcf, 'margin', i.opMargin, x => r1(Math.max(2, Math.min(50, x * 100)), 1));
  const comps: Record<string, string | number> = {};
  if (ok(i.evEbitda)) comps.evE = r1(i.evEbitda, 1).toString(); if (ok(i.pe) && i.pe > 0) comps.pe = r1(i.pe, 1).toString();
  return { wacc, dcf, comps };
}

/** Rows for the CSV download. */
export function csvRows(list: readonly Industry[], d: IndustryData): (string | number)[][] {
  const f = (x: number | null) => (ok(x) ? x : '');
  return [[`US industry benchmarks, ${d.source}, data as of ${d.asOf}`], ['Industry', 'Firms', 'Beta', 'Unlevered beta', 'Debt to equity', 'Cost of equity', 'Cost of capital (WACC)', 'EV/EBITDA', 'P/E (trailing)', 'Operating margin', 'Net margin'],
    ...list.map(i => [i.name, i.firms, f(i.beta), f(i.unlevBeta), f(i.de), f(i.costEquity), f(i.wacc), f(i.evEbitda), f(i.pe), f(i.opMargin), f(i.netMargin)]), [], ['Made with SmartWealth. For study, not investment advice.']];
}
