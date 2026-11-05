/** Pure finance and formatting helpers. No DOM access. */

export type Pt = [number, number] | [number, number, string];

/* ---------- formatting ---------- */
export const isNum = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);

function fx(x: number, d: number): { neg: boolean; s: string } {
  const r = Math.round(Math.abs(x) * Math.pow(10, d));
  return { neg: x < 0 && r > 0, s: Math.abs(x).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }) };
}
export const nf = (x: number, d = 2): string => { if (!isNum(x)) return '—'; const f = fx(x, d); return (f.neg ? '−' : '') + f.s; };
export const money = (x: number, d = 2): string => { if (!isNum(x)) return '—'; const f = fx(x, d); return (f.neg ? '−$' : '$') + f.s; };
export const pct = (x: number, d = 2): string => (isNum(x) ? nf(x * 100, d) + '%' : '—');
export const mult = (x: number, d = 2): string => (isNum(x) ? nf(x, d) + '×' : '—');
export const yrs = (x: number, d = 2): string => (isNum(x) ? nf(x, d) + ' yrs' : '—');
export const nfx = (x: number, d = 4): string => (isNum(x) ? x.toFixed(d) : '—');
export const compact = (x: number): string => {
  if (!isNum(x)) return '—';
  if (x < 0) return '−' + compact(-x);
  const a = Math.abs(x);
  if (a >= 1e9) return '$' + +(x / 1e9).toFixed(2) + 'B';
  if (a >= 1e6) return '$' + +(x / 1e6).toFixed(2) + 'M';
  if (a >= 1e4) return '$' + +(x / 1e3).toFixed(1) + 'K';
  return money(x, a >= 100 ? 0 : 2);
};
export const parseList = (s: string): number[] => String(s).split(/[,;\s]+/).filter(x => x !== '').map(Number).filter(Number.isFinite);
export const sum = (a: readonly number[]): number => a.reduce((s, x) => s + x, 0);
export const range = (a: number, b: number, step: number): number[] => { const o: number[] = []; for (let x = a; x <= b + step * 1e-9; x += step) o.push(+x.toFixed(10)); return o; };

/* ---------- core finance ---------- */
export const npv = (r: number, c: readonly number[]): number => c.reduce((s, x, t) => s + x / Math.pow(1 + r, t), 0);

export function findRoot(f: (x: number) => number, lo: number, hi: number, steps = 2000): number {
  let x0 = lo, f0 = f(x0);
  const dx = (hi - lo) / steps;
  for (let i = 1; i <= steps; i++) {
    const x1 = lo + dx * i, f1 = f(x1);
    if (Number.isFinite(f0) && Number.isFinite(f1) && (f0 === 0 || f0 * f1 < 0)) {
      let a = x0, b = x1, fa = f0;
      for (let k = 0; k < 100; k++) {
        const m = (a + b) / 2, fm = f(m);
        if (fa * fm <= 0) b = m; else { a = m; fa = fm; }
      }
      return (a + b) / 2;
    }
    x0 = x1; f0 = f1;
  }
  return NaN;
}
export const irr = (c: readonly number[]): number => findRoot(r => npv(r, c), -0.95, 10, 3000);
export const annF = (i: number, n: number): number => (Math.abs(i) < 1e-12 ? n : (1 - Math.pow(1 + i, -n)) / i);
export const fvF = (i: number, n: number): number => (Math.abs(i) < 1e-12 ? n : (Math.pow(1 + i, n) - 1) / i);
export const bondPrice = (F: number, cr: number, y: number, m: number, N: number): number => {
  const c = F * cr / m, i = y / m;
  return c * annF(i, N) + F / Math.pow(1 + i, N);
};

export function ncdf(x: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(x)), d = 0.3989422804014327 * Math.exp(-x * x / 2);
  const p = d * t * (0.31938153 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return x > 0 ? 1 - p : p;
}
export const npdf = (x: number): number => 0.3989422804014327 * Math.exp(-x * x / 2);

export interface BsResult {
  c: number; p: number; d1: number; d2: number; dc: number; dp: number; gamma: number; vega: number;
  thc: number; thp: number; rhoc: number; rhop: number;
}
export function bs(S: number, K: number, T: number, r: number, q: number, sg: number): BsResult {
  const eT = Math.exp(-q * T), eR = Math.exp(-r * T);
  if (T <= 1e-9 || sg <= 1e-9) {
    return { c: Math.max(0, S * eT - K * eR), p: Math.max(0, K * eR - S * eT), d1: NaN, d2: NaN, dc: S > K ? eT : 0, dp: S < K ? -eT : 0, gamma: 0, vega: 0, thc: 0, thp: 0, rhoc: 0, rhop: 0 };
  }
  const sq = sg * Math.sqrt(T), d1 = (Math.log(S / K) + (r - q + sg * sg / 2) * T) / sq, d2 = d1 - sq, ph = npdf(d1);
  return {
    c: S * eT * ncdf(d1) - K * eR * ncdf(d2), p: K * eR * ncdf(-d2) - S * eT * ncdf(-d1), d1, d2,
    dc: eT * ncdf(d1), dp: eT * (ncdf(d1) - 1), gamma: eT * ph / (S * sq), vega: S * eT * ph * Math.sqrt(T),
    thc: -S * eT * ph * sg / (2 * Math.sqrt(T)) - r * K * eR * ncdf(d2) + q * S * eT * ncdf(d1),
    thp: -S * eT * ph * sg / (2 * Math.sqrt(T)) + r * K * eR * ncdf(-d2) - q * S * eT * ncdf(-d1),
    rhoc: K * T * eR * ncdf(d2), rhop: -K * T * eR * ncdf(-d2)
  };
}
