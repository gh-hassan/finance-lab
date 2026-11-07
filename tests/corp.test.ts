import { describe, expect, it } from 'vitest';
import { depreciation, leaseVsBuy, multipleStats, payout, pvStream, threeStatement } from '../src/lib/corp';

const near = (a: number, b: number, d = 6) => expect(a).toBeCloseTo(b, d);
const sum = (a: number[]) => a.reduce((s, x) => s + x, 0);

describe('relative valuation', () => {
  it('summarises peer multiples and ignores bad values', () => {
    const s = multipleStats([8, 10, 12, 14, NaN, -3, 0])!;
    near(s.mid, 11, 9); near(s.mean, 11, 9); expect(s.n).toBe(4); expect(s.low).toBeLessThan(s.mid); expect(s.high).toBeGreaterThan(s.mid);
    expect(multipleStats([])).toBeNull(); expect(multipleStats([-1, 0])).toBeNull();
  });
});

describe('depreciation', () => {
  it('straight line splits cost less salvage evenly', () => { const d = depreciation(10000, 1000, 5, 'sl'); expect(d).toHaveLength(5); d.forEach(x => near(x, 1800, 9)); });
  it('sum-of-years-digits front-loads and totals cost less salvage', () => {
    const d = depreciation(10000, 1000, 5, 'syd'); near(d[0], 9000 * 5 / 15, 9); near(sum(d), 9000, 9); expect(d[0]).toBeGreaterThan(d[4]);
  });
  it('double declining never takes the asset below salvage and starts at twice the straight-line rate', () => {
    const d = depreciation(10000, 1000, 5, 'ddb'); near(d[0], 4000, 9); near(sum(d), 9000, 6); d.forEach(x => expect(x).toBeGreaterThanOrEqual(0));
  });
  it('MACRS tables add to 100% of cost and ignore salvage', () => {
    near(sum(depreciation(10000, 2000, 5, 'macrs5')), 10000, 4); near(sum(depreciation(10000, 0, 7, 'macrs7')), 10000, 2);
    near(depreciation(10000, 0, 5, 'macrs5')[0], 2000, 9);
  });
});

describe('lease versus buy', () => {
  it('discounts a stream at the end of each year', () => { near(pvStream([100, 100], 0.1), 100 / 1.1 + 100 / 1.21, 9); });
  it('matches a hand calculation for a simple case', () => {
    /* cost 1000, no salvage, 2 years, straight line 500/yr, tax 40%, rate 10%, lease 600/yr for 2 years */
    const r = leaseVsBuy(1000, 0, 2, 'sl', 0.4, 0.1, 600, 2);
    near(r.pvShield, 200 / 1.1 + 200 / 1.21, 9); near(r.pvLease, 360 / 1.1 + 360 / 1.21, 9);
    near(r.nal, -r.pvLease - (-1000 + r.pvShield + r.pvSalvage), 9);
    near(r.nal, 1000 - r.pvLease - r.pvShield - r.pvSalvage, 9);
  });
  it('favours leasing when payments are low and buying when they are high', () => {
    expect(leaseVsBuy(1000, 0, 5, 'sl', 0.3, 0.06, 150, 5).nal).toBeGreaterThan(0);
    expect(leaseVsBuy(1000, 0, 5, 'sl', 0.3, 0.06, 400, 5).nal).toBeLessThan(0);
  });
});

describe('three-statement model', () => {
  const base = { rev0: 1000, growth: [0.1, 0.08, 0.06, 0.05, 0.04], cogsPct: 0.6, opexPct: 0.15, daPct: 0.04, capexPct: 0.05, nwcPct: 0.1, tax: 0.25, rate: 0.06, repay: 20, payout: 0.3, cash0: 100, debt0: 300, ppe0: 500, nwc0: 100 };
  it('balances every year', () => { threeStatement(base).forEach(y => near(y.check, 0, 8)); });
  it('builds the income statement top to bottom', () => {
    const y = threeStatement(base)[0];
    near(y.rev, 1100, 9); near(y.gross, 440, 9); near(y.ebitda, 440 - 165, 9); near(y.ebit, 275 - 44, 9); near(y.interest, 18, 9);
    near(y.ni, (231 - 18) * 0.75, 9); near(y.fcf, y.cfo - y.capex, 9);
  });
  it('keeps balancing with losses, no dividends from a loss and debt fully repaid', () => {
    const bad = threeStatement({ ...base, cogsPct: 0.95, repay: 1000 });
    bad.forEach(y => { near(y.check, 0, 8); expect(y.div).toBe(0); expect(y.debt).toBeGreaterThanOrEqual(0); });
  });
});

describe('dividends versus buybacks', () => {
  const p = { earnings: 500, shares: 100, price: 60, cash: 200, taxDiv: 0.3, taxCg: 0.15, basis: 30, hold: 1000 };
  it('computes per-share figures', () => {
    const o = payout(p);
    near(o.eps, 5, 9); near(o.pe, 12, 9); near(o.dps, 2, 9); near(o.payoutRatio, 0.4, 9); near(o.bought, 200 / 60, 9); near(o.epsAfter, 500 / (100 - 200 / 60), 9);
  });
  it('shows the tax edge of a buyback when capital gains tax is lower', () => {
    const o = payout(p); expect(o.edge).toBeGreaterThan(0); near(o.divTotal, 1000 * 60 - 0.3 * 2000, 6);
    near(o.buyTotal, 1000 * 60 - (2000 / 60) * 30 * 0.15, 6);
  });
  it('is neutral with no taxes and favours the dividend when gains are taxed harder', () => {
    near(payout({ ...p, taxDiv: 0, taxCg: 0 }).edge, 0, 6);
    expect(payout({ ...p, taxDiv: 0.1, taxCg: 0.3 }).edge).toBeLessThan(0);
  });
});
