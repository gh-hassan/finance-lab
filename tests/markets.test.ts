import { describe, expect, it } from 'vitest';
import { altman, bootstrap, contracts, esNormal, factorReturn, forwardPrice, hedgeRatio, immunize, lbo, priceOnCurve, retirement, swapRate, swapValue, varHistorical, varNormal } from '../src/lib/markets';

const near = (a: number, b: number, d = 6) => expect(a).toBeCloseTo(b, d);

describe('yield curve', () => {
  it('returns a flat curve for flat par yields', () => {
    bootstrap([0.05, 0.05, 0.05, 0.05]).forEach(r => { near(r.spot, 0.05, 9); near(r.fwd, 0.05, 9); });
  });
  it('bootstraps a rising curve with spot above par and forwards above spot', () => {
    const c = bootstrap([0.04, 0.045, 0.05, 0.055]);
    near(c[0].spot, 0.04, 9);
    near(c[1].spot, Math.pow((1.045) / (1 - 0.045 / 1.04), 0.5) - 1, 9);
    for (let i = 1; i < c.length; i++) { expect(c[i].spot).toBeGreaterThan(c[i].par); expect(c[i].fwd).toBeGreaterThan(c[i].spot); }
  });
  it('prices a par bond at par off its own curve and gives the textbook duration', () => {
    const c = bootstrap([0.04, 0.045, 0.05, 0.055, 0.06]);
    near(priceOnCurve(c, 100, 0.06, 5).price, 100, 8);
    const z = priceOnCurve(c, 100, 0, 5); near(z.macaulay, 5, 9); near(z.price, 100 * c[4].df, 9);
  });
  it('immunises with the right weight and refuses a horizon outside the two bonds', () => {
    near(immunize(5, 3, 8)!, 0.6, 9); expect(immunize(2, 3, 8)).toBeNull(); expect(immunize(5, 8, 3)).toBeNull();
  });
});

describe('forwards, hedging and swaps', () => {
  it('prices a forward by cost of carry', () => {
    near(forwardPrice(100, 0.05, 0, 0, 1), 100 * Math.exp(0.05), 9);
    near(forwardPrice(100, 0.05, 0.02, 0.03, 0.5), 100 * Math.exp(0.02), 9);
  });
  it('computes the minimum-variance hedge', () => {
    near(hedgeRatio(0.9, 0.2, 0.15), 1.2, 9); near(contracts(1.2, 1_000_000, 100_000), 12, 9); expect(Number.isNaN(hedgeRatio(0.9, 0.2, 0))).toBe(true);
  });
  it('finds the par swap rate and is worth zero at that rate', () => {
    const df = bootstrap([0.04, 0.045, 0.05, 0.055]).map(r => r.df), s = swapRate(df);
    near(s, 0.055, 9); near(swapValue(df, s), 0, 12); expect(swapValue(df, 0.04)).toBeGreaterThan(0); expect(swapValue(df, 0.07)).toBeLessThan(0);
  });
});

describe('value at risk', () => {
  it('matches the normal tables', () => {
    near(varNormal(1_000_000, 0, 0.1, 1, 0.95), 164485.36, 0);
    near(varNormal(1_000_000, 0, 0.1, 1, 0.99), 232634.8, 0);
    near(esNormal(1_000_000, 0, 0.1, 1, 0.95), 206271, -2);
  });
  it('scales with the square root of time and falls with expected return', () => {
    near(varNormal(1, 0, 0.2, 0.25, 0.95), varNormal(1, 0, 0.2, 1, 0.95) / 2, 9); expect(varNormal(1, 0.1, 0.2, 1, 0.95)).toBeLessThan(varNormal(1, 0, 0.2, 1, 0.95));
  });
  it('reads historical VaR and ES from returns', () => {
    const r = Array.from({ length: 100 }, (_, i) => (i - 50) / 100), h = varHistorical(r, 1000, 0.95)!;
    expect(h.var).toBeGreaterThan(0); expect(h.es).toBeGreaterThanOrEqual(h.var); expect(varHistorical([0.1], 1000, 0.95)).toBeNull();
  });
});

describe('Altman Z-score', () => {
  const m = { wc: 100, re: 200, ebit: 150, equity: 800, liab: 400, sales: 1000, assets: 1000 };
  it('matches the published formula for public manufacturers', () => {
    const z = altman(m, 'public'); near(z.z, 1.2 * 0.1 + 1.4 * 0.2 + 3.3 * 0.15 + 0.6 * 2 + 1.0 * 1, 9); expect(z.zone).toBe('safe');
  });
  it('flags a distressed firm and uses the other two models', () => {
    expect(altman({ wc: -200, re: -300, ebit: -50, equity: 50, liab: 900, sales: 400, assets: 1000 }, 'public').zone).toBe('distress');
    near(altman(m, 'private').z, 0.717 * 0.1 + 0.847 * 0.2 + 3.107 * 0.15 + 0.42 * 2 + 0.998, 9);
    near(altman(m, 'service').z, 6.56 * 0.1 + 3.26 * 0.2 + 6.72 * 0.15 + 1.05 * 2, 9);
  });
});

describe('leveraged buyout', () => {
  const m = { ebitda: 100, entry: 8, debtX: 5, fee: 0.02, rate: 0.08, growth: 0.05, capex: 0.2, tax: 0.25, exit: 8, years: 5 };
  it('sets up the deal and builds the value bridge that adds to the equity gain', () => {
    const o = lbo(m); near(o.ev0, 800, 9); near(o.debt0, 500, 9); near(o.equity0, 800 + 16 - 500, 9);
    near(o.bridge.growth + o.bridge.multiple + o.bridge.paydown + o.bridge.fees, o.equityN - o.equity0, 6);
    near(o.irr, Math.pow(o.moic, 1 / 5) - 1, 9);
  });
  it('repays debt over time and never lets it go negative', () => {
    const o = lbo(m); expect(o.debtN).toBeLessThan(o.debt0); o.years.forEach(y => expect(y.debt).toBeGreaterThanOrEqual(0));
    expect(lbo({ ...m, exit: 11 }).irr).toBeGreaterThan(o.irr);
  });
});

describe('retirement', () => {
  const base = { age: 30, retire: 65, live: 90, saved: 50000, add: 10000, addGrowth: 0, pre: 0.06, post: 0.04, inflation: 0.025, income: 60000 };
  it('matches the future value of savings with a flat contribution', () => {
    const o = retirement(base), g = Math.pow(1.06, 35);
    near(o.atRetire, 50000 * g + 10000 * (g - 1) / 0.06 * 1, 2);
  });
  it('sizes the nest egg for a growing income stream', () => {
    const o = retirement({ ...base, post: 0.025 }); near(o.need, o.firstWithdrawal * 25, 4);
    expect(o.firstWithdrawal).toBeCloseTo(60000 * Math.pow(1.025, 35), 4);
  });
  it('closes the gap with the extra saving it reports', () => {
    const o = retirement(base);
    if (o.gap > 0) { const after = retirement({ ...base, add: base.add + o.extraPerYear }); near(after.atRetire, o.need, 2); }
    expect(o.fundedUntil).toBeGreaterThan(65);
  });
});

describe('factor models', () => {
  it('adds loading times premium to the risk-free rate', () => { near(factorReturn(0.03, [1.1, 0.4, -0.2], [0.055, 0.02, 0.03]), 0.03 + 1.1 * 0.055 + 0.4 * 0.02 - 0.2 * 0.03, 9); });
});
