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
import { chanceAhead, listNote, parseList } from '../src/lib/math';
import { varHistorical } from '../src/lib/markets';
import { MODELS, findOutput, valuesAt, defaultRanges } from '../src/lib/scenarios';
import { winner } from '../src/ui/compare.js';

const calc = (id: string, over: Record<string, any> = {}) => { const m = MODS.find(x => x.id === id)!; return m.calc({ ...Object.fromEntries(m.fields.map(f => [f.id, f.v])), ...over }) as any; };
const card = (o: any, label: string) => (o.cards || []).find((c: any) => String(c.label).startsWith(label));
const num = (s: string) => parseFloat(String(s).replace(/[^\d.\-−]/g, '').replace('−', '-'));

describe('audit fixes: typed lists', () => {
  it('strips % and $ and warns about thousands separators', () => {
    expect(parseList('12%, $5, -3')).toEqual([12, 5, -3]);
    expect(parseList('30,000')).toEqual([30, 0]);
    expect(listNote('30,000, 35,000')).toMatch(/Did you mean 30000/);
    expect(listNote('1, 2, 3')).toBe('Read 3 numbers: 1, 2, 3.');
    expect(listNote('1, abc, 3')).toMatch(/1 entry was not a number/);
  });
});

describe('audit fixes: HIGH numeric bugs', () => {
  it('capstruct: levered cost of equity uses market equity (V_L − D)', () => {
    const o = calc('capstruct');
    expect(num(card(o, 'Return shareholders want with debt').value)).toBeCloseTo(11.09, 2);
  });
  it('capm: M² = rf + asset Sharpe × market σ', () => {
    const m = MODS.find(x => x.id === 'capm')!, d = Object.fromEntries(m.fields.map(f => [f.id, f.v])) as any;
    const rf = d.rf / 100, sh = (d.er / 100 - rf) / (d.sd / 100), want = rf + sh * d.sm / 100;
    expect(num(card(calc('capm'), 'M²').value) / 100).toBeCloseTo(want, 3);
    expect(want).toBeCloseTo(0.0982, 3);
  });
  it('prob: chance of being ahead is the exact binomial answer', () => {
    expect(chanceAhead(1, 0.4, 100, 50)).toBeCloseTo(0.4, 10);
    expect(chanceAhead(10, 0.4, 100, 50)).toBeCloseTo(0.6177, 3); // wins >= 4 of 10
    expect(num(card(calc('prob'), 'Chance of being ahead').value)).toBe(62);
  });
  it('varcalc: historical VaR is labelled as one period of the data, not scaled', () => {
    const o = calc('varcalc'), hist = parseList('1.2, -0.8, 2.1, -3.4, 0.6, 1.9, -1.1, 0.4, -2.2, 3.0, -0.5, 1.4, -4.8, 2.6, 0.9, -1.7, 1.1, 0.2, -0.9, 1.6').map(x => x / 100);
    const c = card(o, 'Historical VaR');
    expect(c.label).toMatch(/one period of your data/);
    expect(num(c.value)).toBeCloseTo(Math.round(varHistorical(hist, 1e6, 0.95)!.var), 0);
  });
  it('compare: the merger measure row matches both accretion and dilution cards', () => {
    const dil = calc('merger', { prem: 60, stock: 100 }), acc = calc('merger');
    const labels = [dil, acc].map(o => (o.cards || []).find((c: any) => /^EPS (accretion|dilution)/.test(c.label))?.label);
    expect(labels.every(Boolean)).toBe(true);
    expect(winner(1, 2, 'high')).toBe('b');
  });
});

describe('audit fixes: MED items', () => {
  it('ddm: default example shows growth adding value (PVGO > 0)', () => {
    const o = calc('ddm'); expect(num(card(o, 'Value of future growth').value)).toBeGreaterThan(0);
  });
  it('futures: default market price is clearly off fair value', () => {
    const o = calc('futures'); expect(card(o, 'Arbitrage').value).toBe('Cash and carry');
  });
  it('altman: default Z sits clearly inside a zone', () => {
    const z = num(card(calc('altman'), 'Z-score').value); expect(Math.abs(z - 2.99)).toBeGreaterThan(0.05);
  });
  it('fx: hedged card only appears when a market forward is entered', () => {
    expect(card(calc('fx', { Fm: 0 }), 'Hedged foreign investment')).toBeUndefined();
    expect(card(calc('fx', { Fm: 1.2 }), 'Hedged foreign investment')).toBeDefined();
  });
  it('scenarios: new drivers keep the old numbers', () => {
    const loan = MODELS.find(m => m.id === 'loan')!, sav = MODELS.find(m => m.id === 'savings')!;
    const v = (m: any) => valuesAt(m, defaultRanges(m), 'base');
    expect(loan.drivers.some(d => d.id === 'term')).toBe(true);
    expect(findOutput(loan, 'years').calc(v(loan))).toBeCloseTo(30, 1);
    expect(findOutput(sav, 'final').calc(v(sav))).toBeGreaterThan(5000);
  });
});
