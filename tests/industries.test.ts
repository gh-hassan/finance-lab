import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { search, sortBy, rank, rankText, plainWords, toCalculators, csvRows, type Industry, type IndustryData } from '../src/lib/industries';

const data: IndustryData = JSON.parse(readFileSync(new URL('../src/data/industries.json', import.meta.url), 'utf8'));
const mk = (name: string, o: Partial<Industry> = {}): Industry => ({ name, firms: 10, beta: 1, unlevBeta: 0.8, de: 0.3, tax: 0.1, costEquity: 0.09, equityWeight: 0.75, costDebt: 0.05, debtWeight: 0.25, wacc: 0.08, evEbitda: 10, evEbit: 14, pe: 20, fwdPe: 18, losing: 0.2, growth: 0.1, grossMargin: 0.4, netMargin: 0.1, opMargin: 0.15, ebitdaMargin: 0.2, ...o });

describe('the Damodaran dataset itself', () => {
  it('has the expected shape and sane values', () => {
    expect(data.industries.length).toBeGreaterThanOrEqual(90); expect(data.asOf).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(new Set(data.industries.map(i => i.name)).size).toBe(data.industries.length);
    for (const i of data.industries) {
      expect(i.firms, i.name).toBeGreaterThan(0);
      for (const [k, v] of Object.entries(i)) if (k !== 'name') expect(v === null || Number.isFinite(v), `${i.name}.${k}`).toBe(true);
      expect(i.beta!, i.name).toBeGreaterThan(0); expect(i.beta!).toBeLessThan(4);
      expect(i.wacc!, i.name).toBeGreaterThan(0.01); expect(i.wacc!).toBeLessThan(0.2);
    }
  });
  it('is internally consistent: CAPM gives the cost of equity and the weights give WACC', () => {
    for (const i of data.industries) {
      expect(Math.abs(i.costEquity! - (data.rf + i.beta! * data.erp)), `CAPM ${i.name}`).toBeLessThan(0.003);
      expect(Math.abs(i.equityWeight! + i.debtWeight! - 1), `weights ${i.name}`).toBeLessThan(0.002);
      expect(Math.abs(i.wacc! - (i.equityWeight! * i.costEquity! + i.debtWeight! * i.costDebt! * (1 - data.marginalTax))), `WACC ${i.name}`).toBeLessThan(0.0015);
    }
  });
  it('has the spelling slips fixed and the market rows', () => {
    const names = data.industries.map(i => i.name); expect(names).toContain('Healthcare Information and Technology'); expect(names).toContain('Rubber & Tires'); expect(names.join('|')).not.toMatch(/Heathcare|Rubber&/);
    expect(data.market.all.firms).toBeGreaterThan(1000); expect(data.market.exFin.firms).toBeLessThan(data.market.all.firms);
  });
});

describe('search and sort', () => {
  const L = [mk('Banks (Regional)', { evEbitda: null }), mk('Bank (Money Center)', { evEbitda: null }), mk('Software (Internet)', { evEbitda: 30 }), mk('Software (System & Application)', { evEbitda: 25 }), mk('Steel', { evEbitda: 6 })];
  it('finds by words, ignoring case and punctuation, starts-with first', () => {
    expect(search(L, 'soft').map(i => i.name)).toEqual(['Software (Internet)', 'Software (System & Application)']);
    expect(search(L, 'system application').map(i => i.name)).toEqual(['Software (System & Application)']);
    expect(search(L, 'bank').map(i => i.name)).toHaveLength(2); expect(search(L, 'internet')[0].name).toBe('Software (Internet)'); expect(search(L, '')).toHaveLength(5); expect(search(L, '%%%zzz')).toEqual([]);
  });
  it('sorts with missing values last in both directions', () => {
    expect(sortBy(L, 'evEbitda', 'asc').map(i => i.evEbitda)).toEqual([6, 25, 30, null, null]); expect(sortBy(L, 'evEbitda', 'desc').map(i => i.evEbitda)).toEqual([30, 25, 6, null, null]);
    expect(sortBy(L, 'name', 'asc')[0].name).toBe('Bank (Money Center)'); expect(L[0].name).toBe('Banks (Regional)');
  });
  it('does not change the list it was given', () => { const copy = L.map(i => i.name); sortBy(L, 'beta', 'desc'); search(L, 'x'); expect(L.map(i => i.name)).toEqual(copy); });
});

describe('rank and words', () => {
  const L = [1, 2, 3, 4].map(n => mk('I' + n, { beta: n / 2 }));
  it('ranks within the list', () => { expect(rank(L, L[3], 'beta')).toBe(1); expect(rank(L, L[0], 'beta')).toBe(0); expect(rank(L, L[1], 'beta')).toBeCloseTo(1 / 3, 9); expect(rank([L[0]], L[0], 'beta')).toBeNull(); expect(rank(L, mk('x', { beta: null }), 'beta')).toBeNull(); });
  it('words the rank', () => { expect(rankText(0.7)).toMatch(/70%/); expect(rankText(0.3)).toMatch(/70% .*industries/); expect(rankText(1)).toMatch(/highest/); expect(rankText(0)).toMatch(/lowest/); expect(rankText(null)).toMatch(/Not enough/); });
  it('writes plain sentences and escapes the name', () => {
    const w = plainWords(mk('A <b>&</b> B', { beta: 1.3 }), mk('All')).join(' '); expect(w).toContain('30% more'); expect(w).not.toContain('<b>&</b> B'); expect(w).toContain('&lt;b&gt;');
    expect(plainWords(mk('Low', { beta: 0.7 }), mk('All')).join(' ')).toContain('30% less'); expect(plainWords(mk('Mid', { beta: 1 }), mk('All')).join(' ')).toContain('same as');
  });
  it('skips sentences when numbers are missing and never prints NaN or null', () => {
    const w = plainWords(mk('Empty', { beta: null, wacc: null, costEquity: null, evEbitda: null, opMargin: null, de: null }), mk('All')).join(' '); expect(w).toBe('');
    for (const i of data.industries) expect(plainWords(i, data.market.all).join(' ')).not.toMatch(/NaN|undefined|null|Infinity/);
  });
});

describe('calculator handoff', () => {
  it('builds WACC, DCF and comps starting points from real rows', () => {
    const i = data.industries.find(x => x.name === 'Software (System & Application)')!, c = toCalculators(i, data);
    expect(c.wacc.rf).toBeCloseTo(data.rf * 100, 2); expect(c.wacc.erp).toBeCloseTo(data.erp * 100, 2); expect(c.wacc.E + c.wacc.D).toBeGreaterThan(990); expect(c.wacc.E + c.wacc.D).toBeLessThan(1010);
    expect(c.dcf.wacc).toBeGreaterThanOrEqual(4); expect(c.dcf.wacc).toBeLessThanOrEqual(16); expect(c.dcf.margin).toBeGreaterThanOrEqual(2); expect(typeof c.comps.evE).toBe('string');
  });
  it('clamps beta and margin into what the calculators accept and omits missing fields', () => {
    const c = toCalculators(mk('X', { beta: 9, opMargin: -0.4, wacc: 0.3, evEbitda: null, pe: -5 }), data);
    expect(c.wacc.beta).toBe(2.5); expect(c.dcf.margin).toBe(2); expect(c.dcf.wacc).toBe(16); expect(c.comps.evE).toBeUndefined(); expect(c.comps.pe).toBeUndefined();
    const e = toCalculators(mk('Y', { beta: null, costDebt: null, equityWeight: null }), data); expect(e.wacc.beta).toBeUndefined(); expect(e.wacc.E).toBeUndefined();
  });
  it('exports a CSV with a header and one row per industry', () => {
    const r = csvRows(data.industries.slice(0, 3), data); expect(r[1][0]).toBe('Industry'); expect(r).toHaveLength(1 + 1 + 3 + 2); expect(r[2][0]).toBe(data.industries[0].name);
  });
});
