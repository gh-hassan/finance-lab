import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseFacts } from '../api/_edgar.js';
import { ratios, dupont, dupontShift, plainWords, revenueCagr, toCalculators, div, type Statements } from '../src/lib/fin';
import { decimalYear, fromDecimalYear, downsample, changeOver, cagr, summary, percentRank } from '../src/lib/series';

const s = (rows: Record<string, (number | null)[]>, ends = ['2022-12-31', '2023-12-31', '2024-12-31'], kind: any = 'standard'): Statements => ({ kind, periods: ends.map(end => ({ end })), rows });
const real = (n: string) => parseFacts(JSON.parse(readFileSync(new URL(`./fixtures/edgar-${n}.json`, import.meta.url), 'utf8')))! as unknown as Statements;

describe('series helpers', () => {
  it('turns dates into decimal years', () => {
    expect(decimalYear('2024-01-01')).toBeCloseTo(2024, 9); expect(decimalYear('2024-07-02')).toBeCloseTo(2024.5, 2);
    expect(decimalYear('2023-12-31')).toBeLessThan(2024); expect(decimalYear('nope')).toBeNaN(); expect(decimalYear('')).toBeNaN();
  });
  it('turns decimal years back into dates and round-trips', () => {
    expect(fromDecimalYear(2024)).toBe('2024-01-01'); expect(fromDecimalYear(2024.5)).toBe('2024-07-02'); expect(fromDecimalYear(NaN)).toBe('');
    for (const d of ['1999-03-15', '2020-02-29', '2023-12-31']) expect(fromDecimalYear(decimalYear(d))).toBe(d);
  });
  it('thins a long series but keeps the ends', () => {
    const pts = Array.from({ length: 10000 }, (_, i) => [i, i * 2] as [number, number]), d = downsample(pts, 400);
    expect(d).toHaveLength(400); expect(d[0]).toEqual(pts[0]); expect(d[399]).toEqual(pts[9999]);
    expect(downsample(pts.slice(0, 50), 400)).toHaveLength(50); expect(downsample([], 10)).toEqual([]); expect(downsample(pts, 1)).toHaveLength(10000);
  });
  it('computes change over a lag and tolerates holes and zeros', () => {
    expect(changeOver([100, 110, null, 121], 1)).toEqual([null, expect.closeTo(0.1, 9), null, null]);
    expect(changeOver([0, 5], 1)).toEqual([null, null]); expect(changeOver([1, 2, 3], 5)).toEqual([null, null, null]);
  });
  it('computes CAGR only when it means something', () => {
    expect(cagr(100, 200, 5)).toBeCloseTo(0.1487, 4); expect(cagr(-5, 10, 3)).toBeNull(); expect(cagr(5, 0, 3)).toBeNull(); expect(cagr(5, 10, 0)).toBeNull(); expect(cagr(null, 10, 3)).toBeNull();
  });
  it('summarises numbers and ignores gaps', () => {
    const x = summary([1, 2, 3, null, NaN, 4])!; expect(x.n).toBe(4); expect(x.mean).toBe(2.5); expect(x.min).toBe(1); expect(x.max).toBe(4); expect(x.sd).toBeCloseTo(1.2910, 3);
    expect(summary([])).toBeNull(); expect(summary([null])).toBeNull(); expect(summary([7])!.sd).toBe(0);
  });
  it('ranks a value within a list', () => {
    expect(percentRank([1, 2, 3, 4], 3)).toBe(0.75); expect(percentRank([], 1)).toBeNull(); expect(percentRank([1], NaN)).toBeNull();
  });
});

describe('ratios', () => {
  const t = s({ revenue: [1000, 1100, 1210], grossProfit: [400, 440, 500], operatingIncome: [200, 220, 250], da: [50, 55, 60], netIncome: [120, 140, 160], incomeTax: [40, 45, 50], assets: [2000, 2200, 2500], equity: [800, 900, 1000], debt: [500, 500, 600], cash: [100, 150, 100], currentAssets: [600, 700, 800], currentLiabilities: [400, 400, 500], interestExpense: [20, 20, 25], cfo: [180, 200, 230], capex: [60, 70, 80], shares: [100, 100, 100] });
  const q = ratios(t);
  it('computes the basics', () => {
    expect(q.revenueGrowth[0]).toBeNull(); expect(q.revenueGrowth[1]).toBeCloseTo(0.1, 9); expect(q.grossMargin[2]).toBeCloseTo(500 / 1210, 9);
    expect(q.ebitda).toEqual([250, 275, 310]); expect(q.netDebt).toEqual([400, 350, 500]); expect(q.currentRatio[2]).toBeCloseTo(1.6, 9);
    expect(q.interestCover[2]).toBe(10); expect(q.fcf).toEqual([120, 130, 150]); expect(q.eps[2]).toBe(1.6); expect(q.debtToEquity[2]).toBe(0.6);
    expect(q.taxRate[0]).toBeCloseTo(40 / 160, 9);
  });
  it('DuPont parts multiply back to ROE exactly', () => {
    for (let i = 0; i < 3; i++) { const d = dupont(t, i)!; expect(d.netMargin * d.assetTurnover * d.equityMultiplier).toBeCloseTo(d.roe, 12); expect(d.roe).toBeCloseTo(t.rows.netIncome[i]! / t.rows.equity[i]!, 12); }
  });
  it('gives null, never NaN or Infinity, for missing or impossible inputs', () => {
    const z = ratios(s({ revenue: [0, null, 100], netIncome: [5, 5, 5], equity: [-50, 0, null], assets: [0, 10, 10], interestExpense: [0, null, 5], operatingIncome: [1, 1, 1] }));
    for (const row of Object.values(z)) for (const v of row) expect(v === null || Number.isFinite(v)).toBe(true);
    expect(z.roe).toEqual([null, null, null]); expect(z.debtToEquity).toEqual([null, null, null]); expect(z.netMargin[0]).toBeNull(); expect(z.assetTurnover[0]).toBeNull(); expect(z.interestCover[0]).toBeNull();
    expect(dupont(s({ revenue: [1], netIncome: [1], assets: [1], equity: [-1] }, ['2024-12-31']), 0)).toBeNull();
  });
  it('treats a negative tax rate or a loss year as unknown instead of reporting nonsense', () => {
    const z = ratios(s({ netIncome: [-100, 100], incomeTax: [-30, 200] }, ['2023-12-31', '2024-12-31']));
    expect(z.taxRate).toEqual([null, null]);
  });
  it('divides safely', () => { expect(div(1, 0)).toBeNull(); expect(div(null, 1)).toBeNull(); expect(div(NaN, 1)).toBeNull(); expect(div(6, 3)).toBe(2); });
  it('computes revenue CAGR over the real span and survives gaps', () => {
    const c = revenueCagr(t)!; expect(c.cagr).toBeCloseTo(Math.pow(1.21, 1 / 2) - 1, 3); expect(c.years).toBeCloseTo(2, 1);
    expect(revenueCagr(s({ revenue: [null, null, null] }))).toBeNull(); expect(revenueCagr(s({ revenue: [5, null, null] }))).toBeNull();
  });
});

describe('calculator handoff', () => {
  it('converts the latest year to $ millions and only fills what it knows', () => {
    const t = s({ revenue: [1e9, 2e9], operatingIncome: [1e8, 4e8], netIncome: [5e7, 3e8], incomeTax: [1e7, 1e8], da: [null, 5e7], capex: [null, 1e8], debt: [null, 6e8], cash: [null, 2e8], shares: [null, 1e8], equity: [null, 9e8] }, ['2023-12-31', '2024-12-31']);
    const { dcf, comps } = toCalculators(t);
    expect(dcf).toMatchObject({ rev0: 2000, margin: 20, netdebt: 400, shares: 100, capex: 5, da: 2.5, g1: 40 });
    expect(comps).toMatchObject({ rev: 2000, ni: 300, ebitda: 450, book: 900, debt: 400, sh: 100 });
    expect(Object.values(dcf).every(Number.isFinite)).toBe(true);
  });
  it('leaves fields out entirely when data is missing', () => {
    const { dcf, comps } = toCalculators(s({ revenue: [null], netIncome: [null] }, ['2024-12-31']));
    expect(dcf).toEqual({}); expect(comps).toEqual({});
  });
  it('clamps growth and margin into what the calculator accepts', () => {
    const { dcf } = toCalculators(s({ revenue: [10, 1000], operatingIncome: [1, 990] }, ['2023-12-31', '2024-12-31']));
    expect(dcf.g1).toBe(40); expect(dcf.margin).toBe(50);
    expect(toCalculators(s({ revenue: [1000, 500], operatingIncome: [1, -50] }, ['2023-12-31', '2024-12-31'])).dcf).toMatchObject({ g1: 0, margin: 2 });
  });
});

describe('ratios on real filings', () => {
  it('Apple 2026 numbers hang together', () => {
    const a = real('aapl'), q = ratios(a), i = a.periods.length - 1;
    expect(q.grossMargin[i]).toBeCloseTo(233602 / 478834, 4); expect(q.netMargin[i]).toBeGreaterThan(0.2); expect(q.roe[i]).toBeGreaterThan(1);
    const d = dupont(a, i)!; expect(d.netMargin * d.assetTurnover * d.equityMultiplier).toBeCloseTo(d.roe, 10);
    for (const row of Object.values(q)) for (const v of row) expect(v === null || Number.isFinite(v)).toBe(true);
  });
  it('a bank has no gross margin and the rest still computes', () => {
    const j = real('jpm'), q = ratios(j); expect(q.grossMargin.every(v => v == null)).toBe(true); expect(q.roa[q.roa.length - 1]).toBeGreaterThan(0);
  });
  it('Ford loses money in the latest year and the ratios say so', () => {
    const f = real('f'), q = ratios(f), i = f.periods.length - 1; expect(q.netMargin[i]).toBeLessThan(0); expect(q.roe[i]).toBeLessThan(0);
  });
});

describe('plain words and DuPont shift', () => {
  const t = s({ revenue: [1000, 1100, 1210], grossProfit: [400, 440, 500], operatingIncome: [200, 220, 250], da: [50, 55, 60], netIncome: [120, 140, 160], incomeTax: [40, 45, 50], assets: [2000, 2200, 2500], equity: [800, 900, 1000], debt: [500, 500, 600], cash: [100, 150, 100], currentAssets: [600, 700, 800], currentLiabilities: [400, 400, 500], interestExpense: [20, 20, 25], cfo: [180, 200, 230], capex: [60, 70, 80], shares: [100, 100, 100] });
  it('writes sentences from the numbers', () => {
    const w = plainWords(t, 'Acme').join(' ');
    expect(w).toContain('Acme'); expect(w).toContain('$1.2K'); expect(w).toMatch(/13 cents/); expect(w).toMatch(/free cash flow/); expect(w).toMatch(/net debt is <b>\$500<\/b>/); expect(w).toMatch(/return on equity/);
  });
  it('escapes the company name', () => { expect(plainWords(t, '<img src=x onerror=alert(1)>').join('')).not.toContain('<img'); });
  it('says a loss is a loss and a cash shortfall is a shortfall', () => {
    const w = plainWords(s({ revenue: [100, 90], netIncome: [5, -20], cfo: [10, 5], capex: [4, 30] }, ['2023-12-31', '2024-12-31']), 'Co').join(' ');
    expect(w).toMatch(/lost <b>\$20/); expect(w).toMatch(/fell <b>10/); expect(w).toMatch(/shortfall/);
  });
  it('words tiny and single-cent margins correctly', () => {
    const w = (n: number) => plainWords(s({ revenue: [1000], netIncome: [n] }, ['2024-12-31']), 'Co').join(' ');
    expect(w(2)).toMatch(/less than one cent/); expect(w(10)).toMatch(/1 cent<\/b>/); expect(w(10)).not.toMatch(/1 cents/); expect(w(50)).toMatch(/5 cents/);
  });
  it('skips sentences it cannot back up, and handles an empty table', () => {
    expect(plainWords(s({}, []), 'X')).toEqual([]);
    const w = plainWords(s({ revenue: [null], netIncome: [null] }, ['2024-12-31']), 'X'); expect(w.join(' ')).not.toMatch(/NaN|undefined|null/);
  });
  it('does not talk about margins or debt for a bank', () => {
    const w = plainWords(s({ revenue: [100], netIncome: [20], debt: [5], cash: [1], equity: [100] }, ['2024-12-31'], 'financial'), 'Bank').join(' ');
    expect(w).toMatch(/Banks, insurers/); expect(w).not.toMatch(/net debt|free cash/);
  });
  it('finds the DuPont part that moved most', () => {
    const x = s({ revenue: [1000, 1000], netIncome: [100, 100], assets: [1000, 1000], equity: [500, 250] }, ['2023-12-31', '2024-12-31']);
    const d = dupontShift(x, 1)!; expect(d.factor).toBe('equityMultiplier'); expect(d.roeFrom).toBeCloseTo(0.2, 9); expect(d.roeTo).toBeCloseTo(0.4, 9);
    expect(dupontShift(x, 0)).toBeNull(); expect(dupontShift(s({ revenue: [1, 1], netIncome: [-1, 1], assets: [1, 1], equity: [1, 1] }, ['2023-12-31', '2024-12-31']), 1)).toBeNull();
  });
});
