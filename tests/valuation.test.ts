import { describe, it, expect } from 'vitest';
import { ownerEarnings, requiredReturn, marginOfSafety, growthPath, dcfValue, earningsPower, valueBusiness, verdictFor, dealView, sensitivity, MINORITY_DISCOUNT, type BusinessInputs, type Deal } from '../src/lib/valuation';

const biz = (o: Partial<BusinessInputs> = {}): BusinessInputs => ({ profit: 600_000, depreciation: 150_000, upkeep: 150_000, cash: 400_000, debt: 800_000, growth: 0.06, predictability: 'bumpy', edge: 'some', ...o });
const deal = (o: Partial<Deal> = {}): Deal => ({ kind: 'whole', stakePct: 25, newMoney: 0, offeredPct: 0, ask: 0, ...o });

describe('owner earnings and required return', () => {
  it('adds back depreciation and takes off upkeep', () => {
    expect(ownerEarnings(biz())).toBe(600_000);
    expect(ownerEarnings(biz({ upkeep: 300_000 }))).toBe(450_000);
  });
  it('riskier businesses must promise more', () => {
    expect(requiredReturn(biz({ predictability: 'steady', debt: 0 }))).toBeCloseTo(0.1);
    expect(requiredReturn(biz({ predictability: 'bumpy', debt: 0 }))).toBeCloseTo(0.12);
    expect(requiredReturn(biz({ predictability: 'risky', debt: 0 }))).toBeCloseTo(0.15);
  });
  it('heavy debt adds to the required return', () => {
    const calm = requiredReturn(biz({ debt: 0 })), some = requiredReturn(biz({ debt: 1_500_000 })), lots = requiredReturn(biz({ debt: 3_000_000 }));
    expect(some).toBeCloseTo(calm + 0.01);
    expect(lots).toBeCloseTo(calm + 0.02);
  });
  it('a stronger edge and steadier profits mean a smaller margin of safety', () => {
    expect(marginOfSafety({ predictability: 'steady', edge: 'strong' })).toBeLessThan(marginOfSafety({ predictability: 'risky', edge: 'none' }));
    expect(marginOfSafety({ predictability: 'risky', edge: 'none' })).toBeLessThanOrEqual(0.45);
  });
});

describe('growth path and cash-flow value', () => {
  it('holds growth, then fades to a modest long-run rate', () => {
    const p = growthPath(0.1, 'some');
    expect(p).toHaveLength(10);
    expect(p[0]).toBe(0.1);
    expect(p[4]).toBe(0.1);
    expect(p[9]).toBeCloseTo(0.025);
    for (let i = 5; i < 10; i++) expect(p[i]).toBeLessThanOrEqual(p[i - 1]);
  });
  it('never lets long-run growth beat the cap', () => {
    expect(growthPath(0.3, 'strong').at(-1)).toBeCloseTo(0.025);
    expect(growthPath(0.01, 'none').at(-1)).toBeCloseTo(0.01);
  });
  it('more growth, or a lower required return, is worth more', () => {
    const a = dcfValue(100, 0.03, 'some', 0.12, 0), b = dcfValue(100, 0.08, 'some', 0.12, 0), c = dcfValue(100, 0.03, 'some', 0.1, 0);
    expect(b).toBeGreaterThan(a);
    expect(c).toBeGreaterThan(a);
  });
  it('a business with no growth is worth the earnings power plus a little', () => {
    const flat = dcfValue(100, 0, 'some', 0.1, 0), power = earningsPower(100, 0.1, 0);
    expect(power).toBeCloseTo(1000);
    expect(Math.abs(flat - power) / power).toBeLessThan(0.1);
  });
  it('no earnings leaves only the cash', () => {
    expect(dcfValue(-5, 0.1, 'some', 0.12, 50)).toBe(50);
    expect(earningsPower(0, 0.1, 80)).toBe(80);
  });
});

describe('the valuation', () => {
  it('puts bargain below sweet spot below ceiling, and the ceiling at or below fair value', () => {
    for (const predictability of ['steady', 'bumpy', 'risky'] as const) for (const edge of ['none', 'some', 'strong'] as const) {
      const v = valueBusiness(biz({ predictability, edge }));
      expect(v.ok).toBe(true);
      expect(v.zones.bargain).toBeLessThan(v.zones.sweet);
      expect(v.zones.sweet).toBeLessThan(v.zones.ceiling);
      expect(v.zones.ceiling).toBeLessThanOrEqual(v.fair);
    }
  });
  it('fair value is the weighted mix of the three methods', () => {
    const v = valueBusiness(biz());
    expect(v.methods).toHaveLength(3);
    expect(v.methods.reduce((a, m) => a + m.weight, 0)).toBeCloseTo(1);
    const mix = v.methods.reduce((a, m) => a + m.mid * m.weight, 0);
    expect(Math.abs(v.fair - mix)).toBeLessThanOrEqual(1);
    for (const m of v.methods) { expect(m.low).toBeLessThanOrEqual(m.mid); expect(m.mid).toBeLessThanOrEqual(m.high); }
  });
  it('a better business is worth more than a worse one with the same numbers', () => {
    expect(valueBusiness(biz({ edge: 'strong', predictability: 'steady' })).fair).toBeGreaterThan(valueBusiness(biz({ edge: 'none', predictability: 'risky' })).fair);
  });
  it('more upkeep spending lowers the value', () => {
    expect(valueBusiness(biz({ upkeep: 400_000 })).fair).toBeLessThan(valueBusiness(biz()).fair);
  });
  it('refuses a price when there is no spare cash', () => {
    const v = valueBusiness(biz({ profit: 50_000, depreciation: 0, upkeep: 100_000 }));
    expect(v.ok).toBe(false);
    expect(v.reason).toMatch(/no spare cash/);
  });
  it('refuses bad numbers instead of returning NaN', () => {
    const v = valueBusiness(biz({ profit: NaN }));
    expect(v.ok).toBe(false);
  });
  it('flags wild growth, heavy debt and thin upkeep', () => {
    const v = valueBusiness(biz({ growth: 0.25, debt: 5_000_000, upkeep: 20_000 }));
    expect(v.warnings.length).toBeGreaterThanOrEqual(3);
  });
  it('does not change the numbers it was given', () => {
    const b = biz(), copy = { ...b };
    valueBusiness(b);
    expect(b).toEqual(copy);
  });
});

describe('verdicts', () => {
  const z = { bargain: 100, sweet: 150, ceiling: 200 };
  it('sorts a price into its zone', () => {
    expect(verdictFor(90, z)).toBe('bargain');
    expect(verdictFor(150, z)).toBe('good');
    expect(verdictFor(190, z)).toBe('stretch');
    expect(verdictFor(201, z)).toBe('toohigh');
  });
});

describe('deals', () => {
  const v = valueBusiness(biz());
  it('whole business: the zones are the valuation and the yield is earnings over price', () => {
    const d = dealView(v, deal({ ask: 4_000_000 }));
    expect(d.zones).toEqual(v.zones);
    expect(d.yield).toBeCloseTo(v.ownerEarnings / 4_000_000);
    expect(d.payback).toBeCloseTo(4_000_000 / v.ownerEarnings);
    expect(d.verdict).toBe(verdictFor(4_000_000, v.zones));
  });
  it('a part of the business: price scales with the share, less a discount for not being in control', () => {
    const d = dealView(v, deal({ kind: 'part', stakePct: 25 }));
    expect(d.discounted).toBe(true);
    expect(d.zones.sweet).toBeCloseTo(v.zones.sweet * 0.25 * (1 - MINORITY_DISCOUNT), -1);
    const big = dealView(v, deal({ kind: 'part', stakePct: 60 }));
    expect(big.discounted).toBe(false);
    expect(big.zones.sweet).toBeCloseTo(v.zones.sweet * 0.6, -1);
  });
  it('a part of the business: the asking price implies a value for the whole', () => {
    const d = dealView(v, deal({ kind: 'part', stakePct: 20, ask: 1_000_000 }));
    expect(d.impliedValue).toBeCloseTo(5_000_000);
    expect(d.yield).toBeCloseTo((v.ownerEarnings * 0.2) / 1_000_000);
  });
  it('new money: the share you get falls as the price rises', () => {
    const d = dealView(v, deal({ kind: 'new', newMoney: 500_000 }));
    expect(d.shareAt).not.toBeNull();
    expect(d.shareAt!.bargain).toBeGreaterThan(d.shareAt!.sweet);
    expect(d.shareAt!.sweet).toBeGreaterThan(d.shareAt!.ceiling);
    expect(d.shareAt!.sweet).toBeCloseTo(500_000 / (d.zones.sweet + 500_000));
  });
  it('new money: money for an offered share implies the value before the money', () => {
    const d = dealView(v, deal({ kind: 'new', newMoney: 500_000, offeredPct: 10 }));
    expect(d.impliedValue).toBeCloseTo(4_500_000);
    expect(d.verdict).not.toBeNull();
  });
  it('new money with no amount gives no numbers rather than NaN', () => {
    const d = dealView(v, deal({ kind: 'new', newMoney: 0 }));
    expect(d.shareAt).toBeNull();
    expect(d.share).toBe(0);
  });
  it('gives nothing when the valuation failed', () => {
    const bad = valueBusiness(biz({ profit: NaN }));
    expect(dealView(bad, deal({ ask: 5 })).verdict).toBeNull();
  });
});

describe('sensitivity grid', () => {
  it('is five by five, and the centre matches the base value', () => {
    const b = biz(), g = sensitivity(b);
    expect(g.values).toHaveLength(5);
    expect(g.values[0]).toHaveLength(5);
    const oe = ownerEarnings(b);
    expect(g.values[2][2]).toBe(Math.round(dcfValue(oe, b.growth, b.edge, requiredReturn(b), b.cash)));
  });
  it('values rise with growth and fall as the required return rises', () => {
    const g = sensitivity(biz());
    expect(g.values[2][4]).toBeGreaterThan(g.values[2][0]);
    expect(g.values[0][2]).toBeGreaterThan(g.values[4][2]);
  });
});
