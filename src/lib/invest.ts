/** Investment maths used by the multi-asset portfolio, option strategy and binomial calculators. Pure functions, no DOM. */
import { bs } from './math';

export type Matrix = number[][];

/** Inverse of a square matrix by Gauss-Jordan with partial pivoting. Returns null when the matrix is singular. */
export function invert(m: Matrix): Matrix | null {
  const n = m.length;
  const a = m.map((row, i) => [...row, ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(a[r][c]) > Math.abs(a[p][c])) p = r;
    if (Math.abs(a[p][c]) < 1e-12) return null;
    [a[c], a[p]] = [a[p], a[c]];
    const d = a[c][c];
    for (let j = 0; j < 2 * n; j++) a[c][j] /= d;
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = a[r][c];
      if (f) for (let j = 0; j < 2 * n; j++) a[r][j] -= f * a[c][j];
    }
  }
  return a.map(row => row.slice(n));
}

export const matVec = (m: Matrix, v: number[]): number[] => m.map(row => row.reduce((s, x, j) => s + x * v[j], 0));
export const dot = (a: number[], b: number[]): number => a.reduce((s, x, i) => s + x * b[i], 0);

/** Covariance matrix from standard deviations and a correlation matrix. */
export const covFrom = (sd: number[], corr: Matrix): Matrix => sd.map((si, i) => sd.map((sj, j) => si * sj * corr[i][j]));

/** Parse "1, 0.3; 0.3, 1" style text into a correlation matrix of size n. Missing cells default to 0 off the diagonal. */
export function parseCorr(text: string, n: number): Matrix {
  const rows = String(text).split(/[;\n]/).map(r => r.split(/[,\s]+/).filter(x => x !== '').map(Number)).filter(r => r.length);
  const m: Matrix = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)));
  rows.slice(0, n).forEach((r, i) => r.slice(0, n).forEach((x, j) => { if (Number.isFinite(x) && i !== j) { m[i][j] = Math.max(-1, Math.min(1, x)); m[j][i] = m[i][j]; } }));
  return m;
}

export interface Stats { mu: number; sd: number }
export const portStats = (w: number[], mu: number[], cov: Matrix): Stats => ({ mu: dot(w, mu), sd: Math.sqrt(Math.max(0, dot(w, matVec(cov, w)))) });

/** Global minimum-variance weights (shorting allowed): w = Σ⁻¹1 / 1'Σ⁻¹1. */
export function minVariance(cov: Matrix): number[] | null {
  const inv = invert(cov); if (!inv) return null;
  const x = matVec(inv, cov.map(() => 1)), s = x.reduce((a, b) => a + b, 0);
  return Math.abs(s) < 1e-12 ? null : x.map(v => v / s);
}

/** Tangency (maximum Sharpe) weights: w ∝ Σ⁻¹(μ − r_f). Null when excess returns do not sum to a usable positive total. */
export function tangency(mu: number[], rf: number, cov: Matrix): number[] | null {
  const inv = invert(cov); if (!inv) return null;
  const x = matVec(inv, mu.map(m => m - rf)), s = x.reduce((a, b) => a + b, 0);
  return Math.abs(s) < 1e-12 ? null : x.map(v => v / s);
}

/** Efficient frontier (shorting allowed) as [σ, μ] points between two target returns, using the closed form σ² = (Cm² − 2Am + B)/D. */
export function frontier(mu: number[], cov: Matrix, from: number, to: number, steps = 60): [number, number][] {
  const inv = invert(cov); if (!inv) return [];
  const one = mu.map(() => 1), iu = matVec(inv, mu), i1 = matVec(inv, one);
  const A = dot(one, iu), B = dot(mu, iu), C = dot(one, i1), D = B * C - A * A;
  if (Math.abs(D) < 1e-14) return [];
  const pts: [number, number][] = [];
  for (let k = 0; k <= steps; k++) { const m = steps > 0 ? from + ((to - from) * k) / steps : from, v = (C * m * m - 2 * A * m + B) / D; pts.push([Math.sqrt(Math.max(0, v)), m]); }
  return pts;
}

/** Seeded random long-only portfolios, for the "every mix you could hold" cloud. */
export function randomMixes(n: number, count: number, seed: number): number[][] {
  let a = seed >>> 0;
  const rnd = () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  return Array.from({ length: count }, () => { const x = Array.from({ length: n }, () => -Math.log(1 - rnd())), s = x.reduce((p, q) => p + q, 0); return x.map(v => v / s); });
}

/* ---------------- option strategies ---------------- */
export type Leg = { kind: 'call' | 'put' | 'stock'; qty: number; K?: number };
export interface StrategyDef { id: string; name: string; plain: string; legs: (K: number, w: number) => Leg[] }

/** Strategy menu. K is the centre strike and w the width between strikes. Positive qty is long, negative is short. */
export const STRATEGIES: StrategyDef[] = [
  { id: 'longcall', name: 'Long call', plain: 'Bet that the price rises. You can only lose what you paid.', legs: K => [{ kind: 'call', qty: 1, K }] },
  { id: 'longput', name: 'Long put', plain: 'Bet that the price falls, or insure a stock you own.', legs: K => [{ kind: 'put', qty: 1, K }] },
  { id: 'covered', name: 'Covered call', plain: 'Own the stock and sell a call on it to earn income, giving up big gains.', legs: (K, w) => [{ kind: 'stock', qty: 1 }, { kind: 'call', qty: -1, K: K + w }] },
  { id: 'protective', name: 'Protective put', plain: 'Own the stock and buy a put, so a crash cannot hurt you below the strike.', legs: (K, w) => [{ kind: 'stock', qty: 1 }, { kind: 'put', qty: 1, K: K - w }] },
  { id: 'bullcall', name: 'Bull call spread', plain: 'Mild bet on a rise: buy a call, sell a higher call to cut the cost.', legs: (K, w) => [{ kind: 'call', qty: 1, K }, { kind: 'call', qty: -1, K: K + w }] },
  { id: 'bearput', name: 'Bear put spread', plain: 'Mild bet on a fall: buy a put, sell a lower put to cut the cost.', legs: (K, w) => [{ kind: 'put', qty: 1, K }, { kind: 'put', qty: -1, K: K - w }] },
  { id: 'straddle', name: 'Long straddle', plain: 'Bet on a big move either way: buy a call and a put at the same strike.', legs: K => [{ kind: 'call', qty: 1, K }, { kind: 'put', qty: 1, K }] },
  { id: 'strangle', name: 'Long strangle', plain: 'Like a straddle but cheaper: out-of-the-money call and put.', legs: (K, w) => [{ kind: 'call', qty: 1, K: K + w }, { kind: 'put', qty: 1, K: K - w }] },
  { id: 'collar', name: 'Collar', plain: 'Own the stock, buy a put below and sell a call above: a fenced-in outcome.', legs: (K, w) => [{ kind: 'stock', qty: 1 }, { kind: 'put', qty: 1, K: K - w }, { kind: 'call', qty: -1, K: K + w }] },
  { id: 'butterfly', name: 'Long butterfly', plain: 'Bet that the price stays put: profit peaks at the middle strike.', legs: (K, w) => [{ kind: 'call', qty: 1, K: K - w }, { kind: 'call', qty: -2, K }, { kind: 'call', qty: 1, K: K + w }] }
];

export interface Priced { leg: Leg; premium: number }
/** Premium paid (+) or received (−) per leg, using Black-Scholes. A stock leg costs the spot price. */
export function priceLegs(legs: Leg[], S: number, T: number, r: number, q: number, sg: number): Priced[] {
  return legs.map(leg => {
    if (leg.kind === 'stock') return { leg, premium: S };
    const o = bs(S, leg.K as number, T, r, q, sg);
    return { leg, premium: leg.kind === 'call' ? o.c : o.p };
  });
}
export const legPayoff = (leg: Leg, S: number): number => (leg.kind === 'stock' ? S : leg.kind === 'call' ? Math.max(0, S - (leg.K as number)) : Math.max(0, (leg.K as number) - S));
/** Profit at expiry for the whole position, per share, before financing costs. */
export const profitAt = (priced: Priced[], S: number): number => priced.reduce((s, { leg, premium }) => s + leg.qty * (legPayoff(leg, S) - premium), 0);

export interface StrategyRead { maxProfit: number; maxLoss: number; unlimitedProfit: boolean; unlimitedLoss: boolean; breakevens: number[]; cost: number }
/** Read maximum gain and loss and break-evens from the payoff line. The payoff is piecewise linear, so scanning the strikes plus both ends is exact. */
export function readStrategy(priced: Priced[], S: number): StrategyRead {
  const strikes = priced.filter(p => p.leg.K != null).map(p => p.leg.K as number), top = Math.max(S, ...strikes) * 4;
  const xs = [0, ...new Set(strikes), top].sort((a, b) => a - b), ys = xs.map(x => profitAt(priced, x));
  const slopeEnd = (profitAt(priced, top * 1.5) - profitAt(priced, top)) / (top * 0.5);
  const unlimitedProfit = slopeEnd > 1e-9, unlimitedLoss = slopeEnd < -1e-9;
  const bes: number[] = [];
  for (let i = 0; i < xs.length - 1; i++) {
    const y0 = ys[i], y1 = ys[i + 1];
    if (y0 === 0 && i === 0) bes.push(xs[i]);
    else if (y0 * y1 < 0) bes.push(xs[i] + ((0 - y0) * (xs[i + 1] - xs[i])) / (y1 - y0));
    else if (y1 === 0 && y0 !== 0) bes.push(xs[i + 1]);
  }
  if (!unlimitedProfit && !unlimitedLoss && Math.abs(slopeEnd) < 1e-9 && ys[ys.length - 1] === 0 && !bes.includes(xs[xs.length - 1])) { /* flat zero tail: no extra break-even */ }
  const cost = priced.reduce((s, p) => s + p.leg.qty * p.premium, 0);
  return { maxProfit: unlimitedProfit ? Infinity : Math.max(...ys), maxLoss: unlimitedLoss ? -Infinity : Math.min(...ys), unlimitedProfit, unlimitedLoss, breakevens: [...new Set(bes.map(b => +b.toFixed(6)))].filter(b => b > 0), cost };
}

/* ---------------- binomial tree ---------------- */
export interface Tree { price: number; stock: number[][]; value: number[][]; exercise: boolean[][]; u: number; d: number; p: number }
/** Cox-Ross-Rubinstein tree for a European or American option with continuous dividend yield q. */
export function binomial(S: number, K: number, T: number, r: number, q: number, sg: number, n: number, call: boolean, american: boolean): Tree {
  const dt = T / n, u = Math.exp(sg * Math.sqrt(dt)), d = 1 / u, disc = Math.exp(-r * dt), p = (Math.exp((r - q) * dt) - d) / (u - d);
  const stock: number[][] = [], value: number[][] = [], exercise: boolean[][] = [];
  for (let i = 0; i <= n; i++) stock.push(Array.from({ length: i + 1 }, (_, j) => S * Math.pow(u, i - j) * Math.pow(d, j)));
  const pay = (s: number) => (call ? Math.max(0, s - K) : Math.max(0, K - s));
  for (let i = 0; i <= n; i++) { value.push(new Array(i + 1).fill(0)); exercise.push(new Array(i + 1).fill(false)); }
  for (let j = 0; j <= n; j++) value[n][j] = pay(stock[n][j]);
  for (let i = n - 1; i >= 0; i--) for (let j = 0; j <= i; j++) {
    const hold = disc * (p * value[i + 1][j] + (1 - p) * value[i + 1][j + 1]), ex = pay(stock[i][j]);
    if (american && ex > hold + 1e-12) { value[i][j] = ex; exercise[i][j] = true; } else value[i][j] = hold;
  }
  return { price: value[0][0], stock, value, exercise, u, d, p };
}
