import { describe, it, expect } from 'vitest';
import { ownerEarnings, normalisedProfit, volatility, effectivePredictability, requiredReturn, marginOfSafety, growthPath, dcfValue, project, reinvestRate, earningsPower, valueBusiness, scenarios, impliedGrowth, earningsBridge, terminalCap, verdictFor, dealView, sensitivity, MINORITY_DISCOUNT, type BusinessInputs, type Deal } from '../src/lib/valuation';

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
    expect(g.values[2][2]).toBe(Math.round(dcfValue(oe, b.growth, b.edge, requiredReturn(b), b.cash, 'medium', terminalCap(0.04))));
  });
  it('values rise with growth and fall as the required return rises', () => {
    const g = sensitivity(biz());
    expect(g.values[2][4]).toBeGreaterThan(g.values[2][0]);
    expect(g.values[0][2]).toBeGreaterThan(g.values[4][2]);
  });
});

describe('normalising earnings', () => {
  it('averages the years given and removes one-offs', () => {
    expect(normalisedProfit(biz({ history: [300_000, 300_000] }))).toBe(400_000);
    expect(normalisedProfit(biz({ oneOffGains: 100_000 }))).toBe(500_000);
    expect(normalisedProfit(biz({ oneOffCosts: 50_000 }))).toBe(650_000);
  });
  it('replaces the owner\u2019s pay with the cost of a manager', () => {
    expect(normalisedProfit(biz({ ownerPay: 200_000, managerCost: 120_000 }))).toBe(680_000);
    expect(normalisedProfit(biz({ ownerPay: 0, managerCost: 120_000 }))).toBe(480_000);
  });
  it('treats a business whose profit swings as less steady', () => {
    const wild = biz({ predictability: 'steady', history: [100_000, 900_000] });
    expect(volatility(wild)).toBeGreaterThan(0.3);
    expect(effectivePredictability(wild)).not.toBe('steady');
    expect(effectivePredictability(biz({ predictability: 'steady', history: [590_000, 610_000] }))).toBe('steady');
    expect(effectivePredictability(biz({ predictability: 'risky', history: [600_000, 600_000] }))).toBe('risky');
  });
  it('one boom year is not enough to set the price', () => {
    const boom = valueBusiness(biz({ profit: 1_200_000 })), spread = valueBusiness(biz({ profit: 1_200_000, history: [400_000, 400_000] }));
    expect(spread.fair).toBeLessThan(boom.fair);
  });
  it('the bridge walks from profit to owner earnings', () => {
    const b = biz({ ownerPay: 200_000, managerCost: 120_000, oneOffGains: 50_000, history: [500_000] });
    const steps = earningsBridge(b);
    expect(steps[0].label).toBe('Profit last year');
    expect(steps.at(-1)!.final).toBe(true);
    expect(steps.at(-1)!.total).toBeCloseTo(ownerEarnings(b));
    expect(earningsBridge(biz()).map(x => x.label)).toEqual(['Profit last year', 'Add back depreciation (no cash leaves)', 'Subtract upkeep spending', 'Owner earnings']);
  });
});

describe('growth costs money', () => {
  it('heavier businesses keep less of their growth', () => {
    expect(reinvestRate(0.06, 'light')).toBeLessThan(reinvestRate(0.06, 'medium'));
    expect(reinvestRate(0.06, 'medium')).toBeLessThan(reinvestRate(0.06, 'heavy'));
    expect(reinvestRate(-0.05, 'heavy')).toBe(0);
    expect(reinvestRate(0.3, 'heavy')).toBeLessThanOrEqual(0.9);
  });
  it('with no growth the capital need does not matter', () => {
    expect(dcfValue(100, 0, 'some', 0.12, 0, 'light')).toBeCloseTo(dcfValue(100, 0, 'some', 0.12, 0, 'heavy'));
  });
  it('the same growth is worth less when the business needs lots of capital', () => {
    expect(dcfValue(100, 0.08, 'some', 0.12, 0, 'heavy')).toBeLessThan(dcfValue(100, 0.08, 'some', 0.12, 0, 'light'));
    expect(valueBusiness(biz({ capital: 'heavy' })).fair).toBeLessThan(valueBusiness(biz({ capital: 'light' })).fair);
  });
  it('the projection adds up to the cash-flow value', () => {
    const p = project(100, 0.06, 'some', 0.12, 20, 'medium');
    expect(p.rows).toHaveLength(10);
    expect(p.rows.reduce((a, r) => a + r.pv, 0) + p.terminalPv + p.cash).toBeCloseTo(p.total);
    for (const r of p.rows) expect(r.free).toBeLessThanOrEqual(r.earnings);
  });
});

describe('currency and interest rates', () => {
  it('a higher safe rate raises the return asked and lowers the value', () => {
    const usd = valueBusiness(biz({ riskFree: 0.04 })), pkr = valueBusiness(biz({ riskFree: 0.12 }));
    expect(pkr.required).toBeCloseTo(usd.required + 0.08);
    expect(pkr.fair).toBeLessThan(usd.fair);
    expect(pkr.multiple).toBeLessThan(usd.multiple);
  });
  it('long-run growth follows interest rates, within sensible limits', () => {
    expect(terminalCap(0.04)).toBeCloseTo(0.024);
    expect(terminalCap(0.12)).toBe(0.06);
    expect(terminalCap(0.01)).toBe(0.015);
  });
});

describe('asset floor', () => {
  it('adds a method that never drives the blend but sets a floor', () => {
    const none = valueBusiness(biz()), some = valueBusiness(biz({ assets: 2_000_000 }));
    expect(none.methods).toHaveLength(3);
    expect(some.methods).toHaveLength(4);
    expect(some.methods[3].weight).toBe(0);
    expect(some.fair).toBe(none.fair);
    const big = valueBusiness(biz({ assets: 50_000_000 }));
    expect(big.fair).toBe(big.methods[3].mid);
    expect(big.zones.bargain).toBeLessThan(big.zones.sweet);
  });
  it('subtracts debt from what the assets are worth', () => {
    const v = valueBusiness(biz({ assets: 1_000_000, debt: 600_000, cash: 0 }));
    expect(v.methods[3].mid).toBe(Math.round(1_000_000 * 0.7 - 600_000));
  });
});

describe('scenarios', () => {
  it('bear is below base, and base below bull', () => {
    const [bear, base, bull] = scenarios(biz());
    expect(bear.fair).toBeLessThan(base.fair);
    expect(base.fair).toBeLessThan(bull.fair);
    expect(base.fair).toBe(valueBusiness(biz()).fair);
  });
});

describe('what a price assumes', () => {
  it('finds the growth that gives the price back', () => {
    const b = biz({ growth: 0.06 }), v = valueBusiness(b);
    const r = impliedGrowth(b, v.methods[1].mid);
    expect(r.status).toBe('ok');
    if (r.status === 'ok') expect(r.growth).toBeCloseTo(0.06, 2);
  });
  it('a higher price needs more growth', () => {
    const b = biz(), mid = valueBusiness(b).methods[1].mid, a = impliedGrowth(b, mid), c = impliedGrowth(b, mid * 1.3);
    expect(a.status).toBe('ok');
    expect(c.status).toBe('ok');
    if (a.status === 'ok' && c.status === 'ok') expect(c.growth).toBeGreaterThan(a.growth);
  });
  it('says so when no growth could justify the price', () => {
    expect(impliedGrowth(biz(), 1_000_000_000)).toEqual({ status: 'none', why: 'too-high' });
    expect(impliedGrowth(biz(), 1)).toEqual({ status: 'none', why: 'too-low' });
  });
});
