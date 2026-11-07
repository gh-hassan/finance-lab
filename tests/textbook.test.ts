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
import { parseValue } from '../src/ui/compare.js';

/** Run a calculator with changed inputs and read one card by the start of its label. */
function card(id: string, over: Record<string, any>, label: string): number {
  const m = MODS.find(x => x.id === id)!, v = { ...Object.fromEntries(m.fields.map(f => [f.id, f.v])), ...over }, o = m.calc(v);
  const c = (o.cards || []).find((x: any) => !x.head && String(x.label).startsWith(label));
  if (!c) throw new Error(`${id}: no card starting "${label}"`);
  return parseValue(c.value as string);
}

/* Worked examples from standard corporate finance and investments textbooks. */
describe('textbook answers', () => {
  it('time value: $1,000 at 5% for 10 years is $1,628.89', () => {
    expect(card('tvm', { solve: 'fv', pv: -1000, pmt: 0, iy: 5, n: 10, py: 1, cy: 1 }, 'Future value')).toBeCloseTo(1628.89, 1);
  });
  it('loan: $250,000 at 6.5% over 30 years costs $1,580.17 a month', () => {
    expect(card('loan', { amt: 250000, apr: 6.5, years: 30, ppy: 12, extra: 0 }, 'Payment each period')).toBeCloseTo(1580.17, 1);
  });
  it('effective annual rate: 12% compounded monthly is 12.683%', () => {
    expect(card('rates', { apr: 12, m: 12 }, 'Effective annual rate')).toBeCloseTo(12.683, 2);
  });
  it('bond: 5% coupon, 6% yield, 10 years, semi-annual is $925.61', () => {
    expect(card('bond', { solve: 'price', face: 1000, cr: 5, ytm: 6, yrs: 10, m: 2 }, 'Bond price')).toBeCloseTo(925.61, 1);
  });
  it('capital budgeting: -1000 then 400, 400, 400 at 10% has NPV $0.74', () => {
    const m = MODS.find(x => x.id === 'capbud')!, v = Object.fromEntries(m.fields.map(f => [f.id, f.v]));
    const idInit = m.fields.find((f: any) => /initial investment/.test(f.label))!.id, idCf = m.fields.find((f: any) => /cash flows/.test(f.label))!.id, idRate = m.fields.find((f: any) => /Discount rate/.test(f.label))!.id;
    const o = m.calc({ ...v, [idInit]: 1000, [idCf]: '400, 400, 400', [idRate]: 10 });
    const npv = parseValue((o.cards || []).find((c: any) => String(c.label).startsWith('NPV'))!.value as string);
    expect(npv).toBeCloseTo(400 * (1 - Math.pow(1.1, -3)) / 0.1 - 1000, 0);
  });
  it('Black-Scholes: S=100, K=100, T=1, r=5%, σ=20% gives a call of $10.45 and a put of $5.57', () => {
    expect(card('options', { S: 100, K: 100, T: 1, vol: 20, r: 5, q: 0 }, 'Call price')).toBeCloseTo(10.45, 1);
    expect(card('options', { S: 100, K: 100, T: 1, vol: 20, r: 5, q: 0 }, 'Put price')).toBeCloseTo(5.57, 1);
  });
  it('EOQ: demand 10,000, $50 an order, $2 holding is 707 units', () => {
    expect(card('wc', { dem: 10000, S: 50, H: 2 }, 'Economic order quantity')).toBeCloseTo(Math.sqrt((2 * 10000 * 50) / 2), 0);
  });
  it('break-even: $50 price, $30 variable cost, $100,000 fixed costs is 5,000 units', () => {
    expect(card('breakeven', { p: 50, vc: 30, fc: 100000 }, 'Break-even volume')).toBeCloseTo(5000, 0);
  });
  it('futures: spot 100, 5% rate, one year is 105.13', () => {
    expect(card('futures', { S: 100, r: 5, u: 0, y: 0, T: 1 }, 'Fair forward price')).toBeCloseTo(105.127, 2);
  });
  it('value at risk: $1M, 10% a year, one year, 95% is about $164,485', () => {
    expect(card('varcalc', { val: 1_000_000, mu: 0, sd: 10, days: 252, conf: 95 }, '95.0% value at risk')).toBeCloseTo(164485, -2);
  });
  it('Z-score and swap rate read sensibly', () => {
    expect(card('altman', {}, 'Z-score')).toBeGreaterThan(0);
    expect(card('swaps', { par: '4, 4.5, 5', term: 3 }, 'Fair 3-year swap rate')).toBeCloseTo(5, 2);
  });
});
