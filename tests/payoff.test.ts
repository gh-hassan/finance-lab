import { describe, it, expect } from 'vitest';
import { legPnl, positionPnl, positionToday, optionPrice, analyze, curve, buildStrategy, STRATEGIES, legLabel, type Leg } from '../src/lib/payoff';

const call = (side: 1 | -1, strike: number, premium: number): Leg => ({ kind: 'call', side, strike, premium });
const put = (side: 1 | -1, strike: number, premium: number): Leg => ({ kind: 'put', side, strike, premium });

describe('one leg at expiry', () => {
  it('a bought call loses its premium below the strike and gains above it', () => {
    const c = call(1, 100, 5);
    expect(legPnl(c, 90)).toBe(-5);
    expect(legPnl(c, 100)).toBe(-5);
    expect(legPnl(c, 120)).toBe(15);
  });
  it('a sold put keeps its premium above the strike and loses below it', () => {
    const p = put(-1, 100, 4);
    expect(legPnl(p, 110)).toBe(4);
    expect(legPnl(p, 90)).toBe(-6);
  });
  it('owned shares gain one dollar per dollar', () => {
    expect(legPnl({ kind: 'stock', side: 1, strike: 0, premium: 100 }, 112)).toBe(12);
  });
  it('a contract covers 100 shares', () => {
    expect(positionPnl([call(1, 100, 5)], 120)).toBe(1500);
  });
});

describe('analysis', () => {
  it('buy a call: loss capped at the premium, no profit limit, one break-even', () => {
    const a = analyze([call(1, 100, 5)]);
    expect(a.maxLoss).toBe(-500);
    expect(a.maxProfit).toBeNull();
    expect(a.breakevens).toEqual([105]);
  });
  it('buy a put: profit capped by the stock reaching zero', () => {
    const a = analyze([put(1, 100, 4)]);
    expect(a.maxLoss).toBe(-400);
    expect(a.maxProfit).toBe(9600);
    expect(a.breakevens).toEqual([96]);
  });
  it('bull call spread: both ends capped', () => {
    const a = analyze([call(1, 100, 5), call(-1, 110, 2)]);
    expect(a.maxLoss).toBe(-300);
    expect(a.maxProfit).toBe(700);
    expect(a.breakevens).toEqual([103]);
  });
  it('straddle: two break-evens and no profit limit', () => {
    const a = analyze([call(1, 100, 5), put(1, 100, 4)]);
    expect(a.maxLoss).toBe(-900);
    expect(a.maxProfit).toBeNull();
    expect(a.breakevens).toEqual([91, 109]);
  });
  it('iron condor: best case is the money collected, worst is the wing gap less that', () => {
    const legs = [put(1, 90, 0.5), put(-1, 95, 1.5), call(-1, 105, 1.5), call(1, 110, 0.5)];
    const a = analyze(legs);
    expect(a.maxProfit).toBe(200);
    expect(a.maxLoss).toBe(-300);
    expect(a.breakevens).toEqual([93, 107]);
  });
  it('covered call: profit capped, loss only if the stock falls', () => {
    const a = analyze([{ kind: 'stock', side: 1, strike: 0, premium: 100 }, call(-1, 105, 2)]);
    expect(a.maxProfit).toBe(700);
    expect(a.maxLoss).toBe(-9800);
    expect(a.breakevens).toEqual([98]);
  });
  it('a naked short call has unlimited loss', () => {
    const a = analyze([call(-1, 100, 3)]);
    expect(a.maxLoss).toBeNull();
    expect(a.maxProfit).toBe(300);
  });
  it('an empty position is flat', () => {
    expect(analyze([])).toEqual({ maxProfit: 0, maxLoss: 0, breakevens: [] });
  });
});

describe('pricing and curves', () => {
  it('an at-the-money 30 day call at 25% volatility is worth a sensible amount', () => {
    const p = optionPrice('call', 100, 100, 30, 0.25, 0.04);
    expect(p).toBeGreaterThan(2.5);
    expect(p).toBeLessThan(3.5);
  });
  it('put-call parity holds', () => {
    const c = optionPrice('call', 100, 105, 60, 0.3, 0.04), p = optionPrice('put', 100, 105, 60, 0.3, 0.04);
    expect(c - p).toBeCloseTo(100 - 105 * Math.exp(-0.04 * 60 / 365), 1);
  });
  it('with no days left the value today equals the profit at expiry', () => {
    const legs = [call(1, 100, 5), call(-1, 110, 2)];
    for (const s of [80, 100, 105, 120]) expect(positionToday(legs, s, 0, 0.25, 0.04)).toBeCloseTo(positionPnl(legs, s), 6);
  });
  it('curve returns matching lines', () => {
    const c = curve([call(1, 100, 5)], 50, 150, 30, 0.25, 0.04, 11);
    expect(c.prices).toHaveLength(11);
    expect(c.expiry).toHaveLength(11);
    expect(c.today).toHaveLength(11);
    expect(c.prices[0]).toBe(50);
    expect(c.prices[10]).toBe(150);
  });
  it('bad inputs give zero, not NaN', () => {
    expect(optionPrice('call', NaN, 100, 30, 0.2, 0.04)).toBe(0);
    expect(optionPrice('put', 100, 0, 30, 0.2, 0.04)).toBe(0);
  });
});

describe('ready-made strategies', () => {
  it('builds every strategy with prices already filled in', () => {
    for (const s of STRATEGIES) {
      const legs = buildStrategy(s.id, 100, 30, 0.25, 0.04);
      expect(legs.length).toBeGreaterThan(0);
      for (const l of legs) { expect(Number.isFinite(l.premium)).toBe(true); expect(l.premium).toBeGreaterThanOrEqual(0); }
      const a = analyze(legs);
      expect(a.maxLoss === null || Number.isFinite(a.maxLoss)).toBe(true);
    }
  });
  it('an iron condor is collected money with limited risk', () => {
    const a = analyze(buildStrategy('iron-condor', 100, 30, 0.25, 0.04));
    expect(a.maxProfit).toBeGreaterThan(0);
    expect(a.maxLoss).toBeLessThan(0);
    expect(a.breakevens).toHaveLength(2);
  });
  it('a bull spread costs less than a plain call', () => {
    const plain = analyze(buildStrategy('long-call', 100, 30, 0.25, 0.04)).maxLoss as number;
    const spread = analyze(buildStrategy('bull-spread', 100, 30, 0.25, 0.04)).maxLoss as number;
    expect(spread).toBeGreaterThan(plain);
  });
  it('labels read in plain English', () => {
    expect(legLabel(call(1, 105, 2))).toBe('Buy a call at $105');
    expect(legLabel(put(-1, 95, 2))).toBe('Sell a put at $95');
    expect(legLabel({ kind: 'stock', side: 1, strike: 0, premium: 100 })).toBe('Own 100 shares');
  });
});
