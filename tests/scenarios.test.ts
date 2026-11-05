import { describe, expect, it } from 'vitest';
import { MODELS, defaultRanges, findOutput, grid, histogram, monteCarlo, mulberry32, outcome, tornado, triangular, valuesAt } from '../src/lib/scenarios';

const model = (id: string) => MODELS.find(m => m.id === id)!;

describe('scenario models', () => {
  it('ships six situations with a valid main output and ordered worst/best cases', () => {
    expect(MODELS).toHaveLength(6);
    for (const m of MODELS) {
      expect(m.outputs.some(o => o.id === m.main), m.id).toBe(true);
      const r = defaultRanges(m), main = findOutput(m, m.main);
      const w = main.calc(valuesAt(m, r, 'worst')), b = main.calc(valuesAt(m, r, 'base')), g = main.calc(valuesAt(m, r, 'best'));
      expect([w, b, g].every(Number.isFinite), m.id).toBe(true);
      if (main.better === 'high') { expect(w, m.id).toBeLessThan(b); expect(b, m.id).toBeLessThan(g); }
      else { expect(w, m.id).toBeGreaterThan(b); expect(b, m.id).toBeGreaterThan(g); }
    }
  });
  it('matches hand calculations', () => {
    const p = model('project'), r = defaultRanges(p);
    expect(findOutput(p, 'npv').calc(valuesAt(p, r, 'base'))).toBeCloseTo(13723.6, 0);
    const l = model('loan');
    expect(findOutput(l, 'pay').calc(valuesAt(l, defaultRanges(l), 'base'))).toBeCloseTo(1580.17, 1);
    const s = model('stock');
    expect(findOutput(s, 'price').calc(valuesAt(s, defaultRanges(s), 'base'))).toBeCloseTo(2 * 1.04 / 0.05, 6);
    const b = model('business');
    expect(findOutput(b, 'profit').calc(valuesAt(b, defaultRanges(b), 'base'))).toBe(2000);
  });
  it('computes a weighted likely result', () => {
    const p = model('project'), o = outcome(p, 'npv', defaultRanges(p), [25, 50, 25]);
    expect(o.expected).toBeCloseTo(o.worst * 0.25 + o.base * 0.5 + o.best * 0.25, 6);
    expect(outcome(p, 'npv', defaultRanges(p), [0, 0, 0]).expected).toBeNaN();
  });
});

describe('sensitivity and grids', () => {
  it('ranks drivers by impact, biggest first', () => {
    for (const m of MODELS) {
      const rows = tornado(m, m.main, defaultRanges(m));
      expect(rows).toHaveLength(m.drivers.length);
      for (let i = 1; i < rows.length; i++) expect(rows[i - 1].swing).toBeGreaterThanOrEqual(rows[i].swing);
      rows.forEach(r => { expect(r.low).toBeLessThanOrEqual(r.high); });
    }
  });
  it('builds a two-way grid whose centre matches the base case', () => {
    const p = model('project'), r = defaultRanges(p), g = grid(p, 'npv', 'cash', 'rate', r, 7);
    expect(g.xs).toHaveLength(7); expect(g.ys).toHaveLength(7); expect(g.z).toHaveLength(7);
    const cashBase = r.cash.base, i = g.xs.findIndex(x => Math.abs(x - cashBase) < 1500);
    expect(i).toBeGreaterThanOrEqual(0);
  });
  it('removes duplicate steps on whole-number drivers', () => {
    const p = model('project'), g = grid(p, 'npv', 'years', 'cost', defaultRanges(p), 7);
    expect(g.xs).toEqual([4, 5, 6, 7]);
  });
});

describe('risk simulation', () => {
  it('is repeatable for the same seed and differs for another', () => {
    const p = model('project'), r = defaultRanges(p);
    const a = monteCarlo(p, 'npv', r, 500, 7), b = monteCarlo(p, 'npv', r, 500, 7), c = monteCarlo(p, 'npv', r, 500, 8);
    expect(a.samples).toEqual(b.samples);
    expect(a.samples).not.toEqual(c.samples);
  });
  it('gives ordered percentiles and a sensible chance of a bad outcome', () => {
    for (const m of MODELS) {
      const mc = monteCarlo(m, m.main, defaultRanges(m), 1500, 3);
      expect(mc.samples.length, m.id).toBeGreaterThan(1000);
      expect(mc.p10, m.id).toBeLessThanOrEqual(mc.p50);
      expect(mc.p50, m.id).toBeLessThanOrEqual(mc.p90);
      if (mc.probBad != null) { expect(mc.probBad).toBeGreaterThanOrEqual(0); expect(mc.probBad).toBeLessThanOrEqual(1); }
    }
  });
  it('samples inside the range and peaks near the base value', () => {
    const r = { worst: 10, base: 12, best: 20 }, rnd = mulberry32(5), xs = Array.from({ length: 4000 }, () => triangular(r, rnd()));
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(10); expect(Math.max(...xs)).toBeLessThanOrEqual(20);
    expect(xs.reduce((s, x) => s + x, 0) / xs.length).toBeCloseTo((10 + 12 + 20) / 3, 0);
    expect(triangular({ worst: 5, base: 5, best: 5 }, 0.4)).toBe(5);
  });
  it('bins samples into a histogram that keeps every sample', () => {
    const h = histogram([1, 2, 2, 3, 9], 5, 0, 10, 10);
    expect(h.reduce((s, x) => s + x, 0)).toBe(5); expect(h[2]).toBe(2);
    expect(histogram([1, 2, 3], 2, 0, 10, 5).reduce((s, x) => s + x, 0)).toBe(2);
  });
});
