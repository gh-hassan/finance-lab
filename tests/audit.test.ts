import { describe, expect, it } from 'vitest';
import '../src/modules/m1.js';
import '../src/modules/m2.js';
import '../src/modules/m3.js';
import '../src/modules/m4.js';
import '../src/modules/m5.js';
import '../src/modules/m6.js';
import '../src/modules/m7.js';
import '../src/modules/m8.js';
import '../src/modules/m9.js';
import { MODS } from '../src/lib/registry';
import { lbo, retirement } from '../src/lib/markets';
import { covFrom, tangency } from '../src/lib/invest';
import { relatedFor } from '../src/ui/videos.js';

const near = (a: number, b: number, d = 6) => expect(a).toBeCloseTo(b, d);
const calc = (id: string, over: Record<string, any>) => { const m = MODS.find(x => x.id === id)!; return m.calc({ ...Object.fromEntries(m.fields.map(f => [f.id, f.v])), ...over }) as any; };
const cardVal = (o: any, label: string) => (o.cards || []).find((c: any) => String(c.label).startsWith(label))?.value;

describe('regressions found in the pre-push audit', () => {
  it('retirement: a pot that is 99.5% of the need does not claim to last to the planning age', () => {
    const base = { age: 30, retire: 65, live: 90, saved: 0, add: 10000, addGrowth: 0, pre: 0.06, post: 0.04, inflation: 0.025, income: 60000 };
    const a0 = retirement(base), a1 = retirement({ ...base, saved: 100000 }), perSaved = (a1.atRetire - a0.atRetire) / 100000;
    const saved = (0.995 * a0.need - a0.atRetire) / perSaved, r = retirement({ ...base, saved });
    expect(r.gap).toBeGreaterThan(0); expect(r.fundedUntil).toBeLessThan(90);
    const full = retirement({ ...base, saved: (1.2 * a0.need - a0.atRetire) / perSaved }); expect(full.fundedUntil).toBeGreaterThanOrEqual(90);
  });
  it('LBO: free cash left after the debt is repaid still belongs to the buyer', () => {
    const m = { ebitda: 100, entry: 8, debtX: 0, fee: 0, rate: 0.08, growth: 0.05, capex: 0.2, tax: 0.25, exit: 8, years: 5 };
    const o = lbo(m); expect(o.debtN).toBe(0); expect(o.cash).toBeGreaterThan(100);
    near(o.equityN, o.evN + o.cash, 6); near(o.bridge.growth + o.bridge.multiple + o.bridge.paydown + o.bridge.cash + o.bridge.fees, o.equityN - o.equity0, 6);
    const hi = lbo({ ...m, debtX: 5, fee: 0.02 }); near(hi.bridge.growth + hi.bridge.multiple + hi.bridge.paydown + hi.bridge.cash + hi.bridge.fees, hi.equityN - hi.equity0, 6);
  });
  it('tangency: none exists when the risk-free rate is above the minimum-variance return', () => {
    const cov = covFrom([0.2, 0.1], [[1, 0.2], [0.2, 1]]);
    expect(tangency([0.12, 0.06], 0.03, cov)).not.toBeNull(); expect(tangency([0.12, 0.06], 0.07, cov)).toBeNull();
    const o = calc('frontier', { rf: 12 }); expect(o.info).toMatch(/no tangency/);
  });
  it('swaps and curve: a term below one year is treated as one year, not NaN', () => {
    ['swaps', 'curve'].forEach(id => { const o = calc(id, id === 'swaps' ? { term: 0.4 } : { yrs: 0.4 }); expect(cardVal(o, id === 'swaps' ? 'Fair' : 'Bond price')).not.toBe('—'); });
  });
  it('lease: the break-even payment is a real number at a 0% discount rate', () => {
    const o = calc('lease', { rate: 0 }); expect(cardVal(o, 'Lease payment that breaks even')).toMatch(/^\$[\d,]+$/);
  });
  it('videos: calculator links match whole words only', () => {
    expect(relatedFor('The Core Architecture of Corporate Finance: How Corporations Work')).toBeNull();
    expect(relatedFor('Why duration and optional features matter')).toBeNull();
    expect(relatedFor('Reading financial ratios')!.href).toBe('/ratios'); expect(relatedFor('Bonds explained')!.href).toBe('/bond'); expect(relatedFor('Options basics')!.href).toBe('/strategies');
  });
  it('oven case: Oven A has the higher IRR while Oven B has the higher NPV at 9%', () => {
    const o = calc('capbud', { rate: 9, rr: 9, i0A: 18000, cfA: '5000, 6000, 6500, 6500, 6000', i0B: 18000, cfB: '0, 0, 0, 0, 42000' });
    const vals = (o.cards as any[]).filter(c => !c.head).map(c => [c.label, c.value]);
    const num = (s: string) => parseFloat(String(s).replace(/[^\d.\-−]/g, '').replace('−', '-'));
    const npvs = vals.filter(v => String(v[0]).startsWith('NPV')).map(v => num(v[1])), irrs = vals.filter(v => String(v[0]).startsWith('IRR')).map(v => num(v[1]));
    expect(npvs[1]).toBeGreaterThan(npvs[0]); expect(irrs[0]).toBeGreaterThan(irrs[1]);
  });
});
