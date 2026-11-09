import { describe, it, expect } from 'vitest';
import { timeMachine, startYears, pkToday, tapeItems } from '../src/lib/homeplus';

const mk = (n: number, start = 200001) => { const m: number[] = []; let y = Math.floor(start / 100), mo = start % 100; for (let i = 0; i < n; i++) { m.push(y * 100 + mo); if (++mo > 12) { mo = 1; y++; } } return m; };

describe('timeMachine', () => {
  const months = mk(240), flat = months.map(() => 0);
  it('grows money by market plus cash return', () => {
    const t = timeMachine(months, months.map(() => 1), flat, 2000, 1000)!;
    expect(t.endStocks).toBeCloseTo(1000 * 1.01 ** 240, 3);
    expect(t.endCash).toBeCloseTo(1000, 6);
    expect(t.years).toBe(20);
    expect(t.yearly).toBeCloseTo(1.01 ** 12 - 1, 6);
    expect(t.stocks).toHaveLength(241);
  });
  it('adds the cash rate to the market excess return', () => {
    const t = timeMachine(months, flat, months.map(() => 0.5), 2000, 100)!;
    expect(t.endStocks).toBeCloseTo(t.endCash, 6);
  });
  it('starts at the requested year', () => {
    const t = timeMachine(months, flat, flat, 2010, 100)!;
    expect(t.startMonth).toBe(201001); expect(t.years).toBe(10);
  });
  it('reports the worst drop and worst full year', () => {
    const r = months.map((_, i) => (i === 5 ? -50 : 0));
    const t = timeMachine(months, r, flat, 2000, 100)!;
    expect(t.worstDrop).toBeCloseTo(-0.5, 6);
    expect(t.worstYear!.year).toBe(2000); expect(t.worstYear!.ret).toBeCloseTo(-0.5, 6);
  });
  it('skips missing months and refuses bad input', () => {
    const r = months.map((_, i) => (i === 3 ? null : 0));
    expect(timeMachine(months, r, flat, 2000, 100)!.usedMonths).toBe(239);
    expect(timeMachine(months, flat, flat, 2000, 0)).toBeNull();
    expect(timeMachine(months, flat, flat, 2000, NaN)).toBeNull();
    expect(timeMachine(months, flat, flat, 2090, 100)).toBeNull();
    expect(timeMachine(months, flat, flat.slice(1), 2000, 100)).toBeNull();
    expect(timeMachine(mk(11), mk(11).map(() => 0), mk(11).map(() => 0), 2000, 100)).toBeNull(); // under 12 months of data
    expect(timeMachine([], [], [], 2000, 100)).toBeNull();
  });
  it('handles a total wipe-out without NaN', () => {
    const t = timeMachine(months, months.map(() => -100), flat, 2000, 100)!;
    expect(t.endStocks).toBe(0); expect(t.yearly).toBe(-1);
  });
});

describe('startYears', () => {
  it('gives a range ending ten years back', () => { expect(startYears(mk(300, 196307))).toEqual({ min: 1964, max: 1978 }); });
  it('uses the first year when data starts in January', () => { expect(startYears(mk(300, 196401))!.min).toBe(1964); });
  it('is null for short data', () => { expect(startYears(mk(60))).toBeNull(); expect(startYears([])).toBeNull(); });
});

describe('pkToday', () => {
  const row = (name: string, c1: number) => ({ symbol: name, name, group: 'x', price: 1, c1, c5: 0, c20: 0, spark: [] });
  it('names best and weakest and reads the rupee', () => {
    const p = pkToday([row('A', 0.03), row('B', -0.02), row('C', 0.01)], { rate: 280, change: 0.002 })!;
    expect(p.best).toEqual({ name: 'A', chg: 0.03 }); expect(p.worst).toEqual({ name: 'B', chg: -0.02 });
    expect(p.up).toBe(2); expect(p.down).toBe(1); expect(p.sentence).toContain('weakened');
  });
  it('leaves out a best or worst that is not really up or down', () => {
    const p = pkToday([row('A', -0.01), row('B', -0.02)], null)!;
    expect(p.best).toBeNull(); expect(p.sentence).toContain('fell');
  });
  it('works with only the rupee, or nothing', () => {
    expect(pkToday([], { rate: 280, change: -0.01 })!.sentence).toContain('strengthened');
    expect(pkToday(null, null)).toBeNull();
    expect(pkToday([row('A', NaN as number)], { rate: 0 })).toBeNull();
  });
});

describe('tapeItems', () => {
  const it_ = (symbol: string, price: number, chg: number) => ({ symbol, name: symbol, group: 'index' as const, price, prev: price, chg, abs: 0, spark: [] });
  it('builds items and skips what is missing', () => {
    const t = tapeItems({ items: [it_('^GSPC', 5000, 0.01), it_('BTC-USD', 60000, -0.02)] }, 0.004, 280);
    expect(t.map(x => x.label)).toEqual(['S&P 500', 'Bitcoin', 'USD in rupees', 'Pakistan stocks']);
    expect(t[0].value).toBe('5,000');
  });
  it('is empty with nothing', () => { expect(tapeItems(null, null, null)).toEqual([]); expect(tapeItems({ items: [] }, NaN, 0)).toEqual([]); });
});

describe('cost of living line', () => {
  const months = mk(240), flat = months.map(() => 0);
  const cpi: [number, number][] = mk(260, 199901).map((m, i) => [m, 100 * 1.003 ** i]);
  it('follows the price index from the start month', () => {
    const t = timeMachine(months, flat, flat, 2000, 1000, cpi)!;
    expect(t.prices![0][1]).toBe(1000);
    expect(t.endPrices).toBeCloseTo(1000 * 1.003 ** 240, 3);
  });
  it('carries the last value when the index has not reached a month', () => {
    const t = timeMachine(months, flat, flat, 2000, 1000, cpi.slice(0, 120))!;
    expect(t.endPrices).toBeCloseTo(1000 * 1.003 ** (119 - 12 + 1) / 1, 0);
  });
  it('is null without enough index data', () => {
    expect(timeMachine(months, flat, flat, 2000, 1000)!.prices).toBeNull();
    expect(timeMachine(months, flat, flat, 2000, 1000, cpi.slice(0, 5))!.endPrices).toBeNull();
    expect(timeMachine(months, flat, flat, 2000, 1000, [[200001, 0], ...cpi.slice(0, 5)] as any)!.prices).toBeNull();
  });
});
