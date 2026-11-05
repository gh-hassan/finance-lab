/** Scenario analysis engine: best/base/worst cases, sensitivity (tornado), two-way grids and Monte Carlo risk.
 *  Pure functions, no DOM. Each model turns a few business drivers into a few outputs. */
import { compact, irr, isNum, money, nf, pct } from './math';

export type Vals = Record<string, number>;
export interface Range { worst: number; base: number; best: number }
export type Ranges = Record<string, Range>;

export interface Driver {
  id: string; label: string; step: number; pre?: string; unit?: string; int?: boolean; r: Range;
}
export interface Risk { text: string; kind: 'below' | 'above'; at: (base: number) => number }
export interface Output {
  id: string; label: string; better: 'high' | 'low'; fmt: (x: number) => string; short: (x: number) => string;
  calc: (v: Vals) => number; risk?: Risk;
}
export interface Model { id: string; title: string; pitch: string; main: string; drivers: Driver[]; outputs: Output[] }

const m0 = (x: number): string => money(x, 0);
const yrsFmt = (x: number): string => (isNum(x) ? `${nf(x, 1)} yrs` : 'Never');
const dr = (id: string, label: string, worst: number, base: number, best: number, step: number, extra: Partial<Driver> = {}): Driver => ({ id, label, step, r: { worst, base, best }, ...extra });

/* ----- model 1: a project (NPV) ----- */
const project: Model = {
  id: 'project', title: 'A new project', pitch: 'Is it worth the money?', main: 'npv',
  drivers: [
    dr('cost', 'What it costs today', 120000, 100000, 90000, 5000, { pre: '$' }),
    dr('cash', 'Cash it brings in each year', 22000, 30000, 38000, 1000, { pre: '$' }),
    dr('years', 'Years it lasts', 4, 5, 7, 1, { unit: 'yrs', int: true }),
    dr('rate', 'Return you need', 13, 10, 8, 0.5, { unit: '%' })
  ],
  outputs: [
    { id: 'npv', label: 'Value it adds (NPV)', better: 'high', fmt: m0, short: compact, risk: { text: 'losing money', kind: 'below', at: () => 0 },
      calc: v => { let s = -v.cost; for (let t = 1; t <= v.years; t++) s += v.cash / Math.pow(1 + v.rate / 100, t); return s; } },
    { id: 'irr', label: 'Its own yearly return (IRR)', better: 'high', fmt: x => (isNum(x) ? pct(x, 1) : '—'), short: x => pct(x, 0),
      calc: v => irr([-v.cost, ...Array.from({ length: Math.max(1, Math.round(v.years)) }, () => v.cash)]) },
    { id: 'pay', label: 'Time to get your money back', better: 'low', fmt: yrsFmt, short: x => nf(x, 1), calc: v => (v.cash * v.years >= v.cost ? v.cost / v.cash : NaN) }
  ]
};

/* ----- model 2: a company (simple DCF) ----- */
const company: Model = {
  id: 'company', title: 'A company\'s value', pitch: 'What is one share worth?', main: 'ps',
  drivers: [
    dr('g', 'Sales growth per year', 3, 8, 13, 0.5, { unit: '%' }),
    dr('margin', 'Profit on each sale', 10, 18, 24, 0.5, { unit: '%' }),
    dr('wacc', 'Return investors want', 11, 9, 8, 0.25, { unit: '%' }),
    dr('tg', 'Growth after year 5', 1.5, 2.5, 3.5, 0.25, { unit: '%' })
  ],
  outputs: [
    { id: 'ps', label: 'Value per share', better: 'high', fmt: x => money(x, 2), short: x => money(x, 0), risk: { text: 'a value 20% below the base case', kind: 'below', at: b => b * 0.8 },
      calc: v => { const w = v.wacc / 100, g = v.tg / 100; if (w <= g) return NaN; let ev = 0, f = 0; for (let t = 1; t <= 5; t++) { f = 1000 * Math.pow(1 + v.g / 100, t) * (v.margin / 100) * 0.75 * 0.7; ev += f / Math.pow(1 + w, t); } ev += (f * (1 + g) / (w - g)) / Math.pow(1 + w, 5); return (ev - 300) / 100; } },
    { id: 'ev', label: 'Whole company ($M)', better: 'high', fmt: x => money(x, 0) + 'M', short: x => nf(x, 0),
      calc: v => { const w = v.wacc / 100, g = v.tg / 100; if (w <= g) return NaN; let ev = 0, f = 0; for (let t = 1; t <= 5; t++) { f = 1000 * Math.pow(1 + v.g / 100, t) * (v.margin / 100) * 0.75 * 0.7; ev += f / Math.pow(1 + w, t); } return ev + (f * (1 + g) / (w - g)) / Math.pow(1 + w, 5); } }
  ]
};

/* ----- model 3: a loan ----- */
function loanRun(v: Vals): { pay: number; interest: number; years: number } {
  const i = v.rate / 1200, n = 360, base = i ? v.amount * i / (1 - Math.pow(1 + i, -n)) : v.amount / n, pay = base + v.extra;
  let bal = v.amount, paid = 0, k = 0;
  while (bal > 0.005 && k < 600) { const int = bal * i, p = Math.min(pay, bal + int); bal -= p - int; paid += int; k++; }
  return { pay: base, interest: paid, years: k / 12 };
}
const loan: Model = {
  id: 'loan', title: 'A home loan', pitch: 'What will it cost me?', main: 'interest',
  drivers: [
    dr('amount', 'Amount you borrow', 300000, 250000, 200000, 5000, { pre: '$' }),
    dr('rate', 'Interest rate', 8.5, 6.5, 5, 0.25, { unit: '%' }),
    dr('extra', 'Extra you pay each month', 0, 0, 300, 50, { pre: '$' })
  ],
  outputs: [
    { id: 'interest', label: 'Total fees to the bank', better: 'low', fmt: m0, short: compact, risk: { text: 'fees 20% above the base case', kind: 'above', at: b => b * 1.2 }, calc: v => loanRun(v).interest },
    { id: 'pay', label: 'Monthly payment', better: 'low', fmt: m0, short: compact, calc: v => loanRun(v).pay },
    { id: 'years', label: 'Time to be debt-free', better: 'low', fmt: yrsFmt, short: x => nf(x, 0), calc: v => loanRun(v).years }
  ]
};

/* ----- model 4: saving for the future ----- */
const savings: Model = {
  id: 'savings', title: 'Saving for later', pitch: 'How much will I have?', main: 'real',
  drivers: [
    dr('monthly', 'Saved each month', 150, 300, 450, 25, { pre: '$' }),
    dr('rate', 'Yearly return', 3, 6.5, 9, 0.5, { unit: '%' }),
    dr('years', 'Years of saving', 20, 25, 30, 1, { unit: 'yrs', int: true }),
    dr('infl', 'Price rises per year', 5, 3, 2, 0.5, { unit: '%' })
  ],
  outputs: [
    { id: 'real', label: 'Worth in today\'s money', better: 'high', fmt: m0, short: compact, risk: { text: 'ending with 20% less than planned', kind: 'below', at: b => b * 0.8 },
      calc: v => { const i = v.rate / 1200, n = v.years * 12, fv = 5000 * Math.pow(1 + i, n) + v.monthly * (i ? (Math.pow(1 + i, n) - 1) / i : n); return fv / Math.pow(1 + v.infl / 100, v.years); } },
    { id: 'final', label: 'Pile of money at the end', better: 'high', fmt: m0, short: compact,
      calc: v => { const i = v.rate / 1200, n = v.years * 12; return 5000 * Math.pow(1 + i, n) + v.monthly * (i ? (Math.pow(1 + i, n) - 1) / i : n); } }
  ]
};

/* ----- model 5: a small business ----- */
const business: Model = {
  id: 'business', title: 'A small business', pitch: 'Will it make a profit?', main: 'profit',
  drivers: [
    dr('price', 'Price per item', 8.5, 10, 11.5, 0.5, { pre: '$' }),
    dr('sold', 'Items sold each month', 600, 1000, 1400, 50),
    dr('vc', 'Cost to make each item', 5, 4, 3.5, 0.25, { pre: '$' }),
    dr('fixed', 'Fixed bills each month', 4500, 4000, 3500, 100, { pre: '$' })
  ],
  outputs: [
    { id: 'profit', label: 'Profit each month', better: 'high', fmt: m0, short: compact, risk: { text: 'making a loss', kind: 'below', at: () => 0 }, calc: v => v.sold * (v.price - v.vc) - v.fixed },
    { id: 'be', label: 'Items to sell to break even', better: 'low', fmt: x => (isNum(x) ? nf(x, 0) : 'Never'), short: x => nf(x, 0), calc: v => (v.price > v.vc ? v.fixed / (v.price - v.vc) : NaN) }
  ]
};

/* ----- model 6: a stock ----- */
const stock: Model = {
  id: 'stock', title: 'A stock', pitch: 'What is a fair price?', main: 'price',
  drivers: [
    dr('d0', 'Yearly payout per share', 1.6, 2, 2.4, 0.1, { pre: '$' }),
    dr('g', 'Payout growth per year', 3, 4, 5, 0.25, { unit: '%' }),
    dr('k', 'Return you want', 10, 9, 8.5, 0.25, { unit: '%' })
  ],
  outputs: [
    { id: 'price', label: 'Fair price per share', better: 'high', fmt: x => money(x, 2), short: x => money(x, 0), risk: { text: 'a price 20% below the base case', kind: 'below', at: b => b * 0.8 }, calc: v => (v.k > v.g ? v.d0 * (1 + v.g / 100) / ((v.k - v.g) / 100) : NaN) }
  ]
};

export const MODELS: Model[] = [project, company, loan, savings, business, stock];

/* ----- helpers ----- */
export const defaultRanges = (m: Model): Ranges => Object.fromEntries(m.drivers.map(d => [d.id, { ...d.r }]));
export const valuesAt = (m: Model, ranges: Ranges, which: keyof Range): Vals => Object.fromEntries(m.drivers.map(d => [d.id, ranges[d.id][which]]));
export const findOutput = (m: Model, id: string): Output => m.outputs.find(o => o.id === id) ?? m.outputs[0];

export interface Outcome { worst: number; base: number; best: number; expected: number }
export function outcome(m: Model, outId: string, ranges: Ranges, probs: readonly [number, number, number]): Outcome {
  const o = findOutput(m, outId), w = o.calc(valuesAt(m, ranges, 'worst')), b = o.calc(valuesAt(m, ranges, 'base')), g = o.calc(valuesAt(m, ranges, 'best'));
  const tot = probs[0] + probs[1] + probs[2], ok = tot > 0 && [w, b, g].every(isNum);
  return { worst: w, base: b, best: g, expected: ok ? (w * probs[0] + b * probs[1] + g * probs[2]) / tot : NaN };
}

export interface TornadoRow { id: string; label: string; worstIn: number; bestIn: number; worstOut: number; bestOut: number; low: number; high: number; swing: number }
export function tornado(m: Model, outId: string, ranges: Ranges): TornadoRow[] {
  const o = findOutput(m, outId), base = valuesAt(m, ranges, 'base'), b = o.calc(base);
  return m.drivers.map(d => {
    const worstOut = o.calc({ ...base, [d.id]: ranges[d.id].worst }), bestOut = o.calc({ ...base, [d.id]: ranges[d.id].best });
    const w = isNum(worstOut) ? worstOut : b, g = isNum(bestOut) ? bestOut : b;
    return { id: d.id, label: d.label, worstIn: ranges[d.id].worst, bestIn: ranges[d.id].best, worstOut: w, bestOut: g, low: Math.min(w, g, b), high: Math.max(w, g, b), swing: Math.abs(g - w) };
  }).sort((a, c) => c.swing - a.swing);
}

export interface Grid { xs: number[]; ys: number[]; z: number[][]; base: number }
export function grid(m: Model, outId: string, xId: string, yId: string, ranges: Ranges, n = 7): Grid {
  const o = findOutput(m, outId), base = valuesAt(m, ranges, 'base');
  const axis = (id: string): number[] => {
    const d = m.drivers.find(x => x.id === id) as Driver, r = ranges[id], lo = Math.min(r.worst, r.best), hi = Math.max(r.worst, r.best);
    const vals = Array.from({ length: n }, (_, k) => lo + (hi - lo) * k / (n - 1)).map(x => (d.int ? Math.round(x) : +x.toFixed(6)));
    return [...new Set(vals)];
  };
  const xs = axis(xId), ys = axis(yId);
  return { xs, ys, base: o.calc(base), z: ys.map(y => xs.map(x => o.calc({ ...base, [xId]: x, [yId]: y }))) };
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
/** Triangular sample between the worst and best values, peaking at the base value. */
export function triangular(r: Range, u: number): number {
  const a = Math.min(r.worst, r.best), b = Math.max(r.worst, r.best), c = clampTo(r.base, a, b);
  if (b === a) return a;
  const fc = (c - a) / (b - a);
  return u < fc ? a + Math.sqrt(u * (b - a) * (c - a)) : b - Math.sqrt((1 - u) * (b - a) * (b - c));
}
const clampTo = (x: number, a: number, b: number): number => Math.min(b, Math.max(a, x));

export interface Risked { samples: number[]; sorted: number[]; mean: number; p10: number; p50: number; p90: number; base: number; threshold: number | null; probBad: number | null; riskText: string }
export function monteCarlo(m: Model, outId: string, ranges: Ranges, n = 3000, seed = 1): Risked {
  const o = findOutput(m, outId), rnd = mulberry32(seed), samples: number[] = [], baseOut = o.calc(valuesAt(m, ranges, 'base'));
  for (let i = 0; i < n; i++) {
    const v: Vals = {};
    for (const d of m.drivers) { const x = triangular(ranges[d.id], rnd()); v[d.id] = d.int ? Math.round(x) : x; }
    const y = o.calc(v);
    if (isNum(y)) samples.push(y);
  }
  const sorted = [...samples].sort((a, b) => a - b), q = (p: number): number => sorted[Math.floor(p * (sorted.length - 1))] ?? NaN;
  const threshold = o.risk ? o.risk.at(baseOut) : null;
  const bad = threshold == null || !o.risk ? null : samples.filter(x => (o.risk?.kind === 'below' ? x < threshold : x > threshold)).length / Math.max(1, samples.length);
  return { samples, sorted, mean: samples.reduce((s, x) => s + x, 0) / Math.max(1, samples.length), p10: q(0.1), p50: q(0.5), p90: q(0.9), base: baseOut, threshold, probBad: bad, riskText: o.risk ? o.risk.text : '' };
}

/** Histogram of the first `k` samples over [lo, hi]. */
export function histogram(samples: readonly number[], k: number, lo: number, hi: number, bins = 30): number[] {
  const h = Array<number>(bins).fill(0), span = hi - lo || 1;
  for (let i = 0; i < Math.min(k, samples.length); i++) { const b = Math.min(bins - 1, Math.max(0, Math.floor((samples[i] - lo) / span * bins))); h[b]++; }
  return h;
}
