import { describe, expect, it } from 'vitest';
import { annF, bondPrice, bs, compact, corr, findRoot, fvF, irr, linreg, mean, median, money, ncdf, nf, ninv, npv, parseList, pct, percentile, range, stdev } from '../src/lib/math';

describe('formatting', () => {
  it('formats money, numbers and percents', () => {
    expect(money(3108.934)).toBe('$3,108.93');
    expect(money(-0.001)).toBe('$0.00');
    expect(money(-12.5)).toBe('−$12.50');
    expect(pct(0.12683, 2)).toBe('12.68%');
    expect(nf(NaN)).toBe('—');
  });
  it('compacts large and negative amounts', () => {
    expect(compact(30300)).toBe('$30.3K');
    expect(compact(-30300)).toBe('−$30.3K');
    expect(compact(1250000)).toBe('$1.25M');
    expect(compact(NaN)).toBe('—');
  });
  it('parses lists and ranges', () => {
    expect(parseList('1, 2;3  -4 x')).toEqual([1, 2, 3, -4]);
    expect(range(0, 1, 0.25)).toEqual([0, 0.25, 0.5, 0.75, 1]);
  });
});

describe('time value of money', () => {
  it('computes annuity factors', () => {
    expect(annF(0.1, 5)).toBeCloseTo(3.790787, 5);
    expect(fvF(0.06, 10)).toBeCloseTo(13.180795, 5);
    expect(annF(0, 7)).toBe(7);
  });
  it('computes NPV and IRR', () => {
    const cf = [-100000, 30000, 35000, 40000, 40000, 30000];
    expect(npv(0.1, cf)).toBeCloseTo(32199.4, 0);
    expect(irr(cf)).toBeCloseTo(0.2168, 3);
    expect(irr([100, 100])).toBeNaN();
  });
  it('finds roots or returns NaN', () => {
    expect(findRoot(x => x * x - 4, 0, 5)).toBeCloseTo(2, 6);
    expect(findRoot(x => x * x + 1, -5, 5)).toBeNaN();
  });
});

describe('bonds and options', () => {
  it('prices a 10-year 5% semi-annual bond at 6% yield', () => {
    expect(bondPrice(1000, 0.05, 0.06, 2, 20)).toBeCloseTo(925.61, 2);
    expect(bondPrice(1000, 0.06, 0.06, 2, 20)).toBeCloseTo(1000, 6);
  });
  it('prices Black-Scholes options and keeps put-call parity', () => {
    const o = bs(100, 100, 1, 0.04, 0, 0.25);
    expect(o.c).toBeCloseTo(11.84, 2);
    expect(o.c - o.p).toBeCloseTo(100 - 100 * Math.exp(-0.04), 6);
    expect(bs(110, 100, 0, 0.04, 0, 0.25).c).toBeCloseTo(110 - 100, 0);
  });
});

describe('statistics helpers', () => {
  it('computes mean, median and sample standard deviation', () => {
    expect(mean([2, 4, 6])).toBe(4);
    expect(median([5, 1, 3])).toBe(3);
    expect(median([1, 2, 3, 4])).toBe(2.5);
    expect(stdev([2, 4, 4, 4, 5, 5, 7, 9])).toBeCloseTo(2.13809, 4);
    expect(stdev([5])).toBeNaN();
    expect(mean([])).toBeNaN();
  });
  it('shows one huge value drags the mean but not the median', () => {
    const base = [32, 35, 38, 40, 42, 45, 48, 52, 55];
    expect(median([...base, 400])).toBeCloseTo(43.5, 6);
    expect(mean([...base, 400])).toBeGreaterThan(75);
  });
  it('interpolates percentiles', () => {
    expect(percentile([1, 2, 3, 4, 5], 0.5)).toBe(3);
    expect(percentile([1, 2, 3, 4, 5], 0.1)).toBeCloseTo(1.4, 6);
    expect(percentile([1, 2, 3, 4, 5], 2)).toBe(5);
  });
  it('measures correlation and the best-fit line', () => {
    const x = [1, 2, 3, 4, 5], y = [2, 4, 6, 8, 10];
    expect(corr(x, y)).toBeCloseTo(1, 10);
    expect(corr(x, [10, 8, 6, 4, 2])).toBeCloseTo(-1, 10);
    expect(corr(x, [3, 3, 3, 3, 3])).toBeNaN();
    const f = linreg(x, y);
    expect(f.slope).toBeCloseTo(2, 10); expect(f.intercept).toBeCloseTo(0, 10); expect(f.r2).toBeCloseTo(1, 10);
  });
  it('inverts the normal CDF', () => {
    expect(ninv(0.5)).toBeCloseTo(0, 8);
    expect(ninv(0.975)).toBeCloseTo(1.959964, 5);
    expect(ninv(0.05)).toBeCloseTo(-1.644854, 5);
    expect(ncdf(ninv(0.3))).toBeCloseTo(0.3, 6);
    expect(ninv(0)).toBe(-Infinity);
    expect(ninv(1.5)).toBeNaN();
  });
});
