import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { startDate, parseRates, parseNames, parseSeries, summarise, parseMoves, thin, parseErRates, parseFawaz, currencyName, sampleDates, fawazSeries } from '../api/_fx.js';
import handler, { resetCache } from '../api/fx.js';
import { parseAmount, invertRate, crossRate, fmtRate, fmtAmount, seriesStats, calcSpot, rankWords, isRange } from '../src/lib/currency';
import { call, mockFetch } from './helpers';

const NAMES = { USD: 'United States Dollar', EUR: 'Euro', GBP: 'British Pound', JPY: 'Japanese Yen', CHF: 'Swiss Franc', CAD: 'Canadian Dollar', AUD: 'Australian Dollar', CNY: 'Chinese Renminbi Yuan', INR: 'Indian Rupee', MXN: 'Mexican Peso', BRL: 'Brazilian Real' };
const latest = (base = 'USD') => ({ amount: 1, base, date: '2026-11-06', rates: Object.fromEntries(Object.keys(NAMES).filter(c => c !== base).map((c, i) => [c, 1 + i / 10])) });
const series = { amount: 1, base: 'USD', rates: { '2026-10-05': { EUR: 0.9 }, '2026-10-06': { EUR: 0.92 }, '2026-10-07': { EUR: 0.88 }, '2026-10-08': { EUR: 0.9 } } };

describe('start dates', () => {
  const now = new Date('2026-11-08T10:00:00Z');
  it('counts back from today in UTC', () => {
    expect(startDate('1m', now)).toBe('2026-10-08');
    expect(startDate('3m', now)).toBe('2026-08-08');
    expect(startDate('1y', now)).toBe('2025-11-08');
    expect(startDate('5y', now)).toBe('2021-11-08');
    expect(startDate('10y', now)).toBe('2016-11-08');
  });
  it('keeps month ends inside the month and crosses year ends', () => {
    expect(startDate('1m', new Date('2026-03-31T00:00:00Z'))).toBe('2026-02-28');
    expect(startDate('1y', new Date('2024-02-29T00:00:00Z'))).toBe('2023-02-28');
    expect(startDate('3m', new Date('2026-01-15T23:59:59Z'))).toBe('2025-10-15');
  });
  it('rejects an unknown range or an invalid date', () => {
    expect(() => startDate('2y', now)).toThrow(/range/);
    expect(() => startDate('1m', new Date('nope'))).toThrow();
  });
  it('defaults to the real clock', () => { expect(startDate('1m')).toMatch(/^\d{4}-\d{2}-\d{2}$/); });
});

describe('reading the source', () => {
  it('adds the base as 1 and drops junk rates', () => {
    const r = parseRates({ date: '2026-11-06', rates: { EUR: 0.9, XXX: NaN, JPY: -1, bad: 3, GBP: '0.7' } }, 'USD');
    expect(r).toEqual({ base: 'USD', date: '2026-11-06', rates: { EUR: 0.9, USD: 1 } });
  });
  it.each([null, 'html', [], {}, { date: 'x', rates: {} }, { date: '2026-11-06', rates: [] }, { date: '2026-11-06', rates: { EUR: NaN } }])('refuses %j', bad => {
    expect(() => parseRates(bad as any, 'USD')).toThrow(/could not read/);
  });
  it('trims and caps currency names', () => {
    expect(parseNames({ EUR: ' Euro ', X: 'no', USD: 5, GBP: 'a'.repeat(200) })).toEqual({ EUR: 'Euro', GBP: 'a'.repeat(60) });
    expect(() => parseNames([] as any)).toThrow();
    expect(() => parseNames({ x: 1 } as any)).toThrow();
  });
  it('sorts a series, skips gaps and needs two points', () => {
    expect(parseSeries({ rates: { '2026-01-03': { EUR: 3 }, '2026-01-01': { EUR: 1 }, '2026-01-02': {}, '2026-01-04': { EUR: NaN }, bad: { EUR: 9 } } }, 'EUR')).toEqual([['2026-01-01', 1], ['2026-01-03', 3]]);
    expect(() => parseSeries({ rates: { '2026-01-01': { EUR: 1 } } }, 'EUR')).toThrow(/not enough/);
    expect(() => parseSeries(null as any, 'EUR')).toThrow(/could not read/);
    expect(() => parseSeries({ rates: [] } as any, 'EUR')).toThrow();
  });
  it('summarises on hand-checked numbers', () => {
    const s = summarise([['a', 0.9], ['b', 0.92], ['c', 0.88], ['d', 0.99]]);
    expect(s.first).toBe(0.9); expect(s.last).toBe(0.99); expect(s.high).toBe(0.99); expect(s.low).toBe(0.88);
    expect(s.change).toBeCloseTo(0.1, 10);
  });
  it('thins evenly and keeps both ends', () => {
    const pts = Array.from({ length: 1001 }, (_, i) => [i, i]);
    const t = thin(pts, 500);
    expect(t).toHaveLength(500); expect(t[0]).toEqual([0, 0]); expect(t[499]).toEqual([1000, 1000]);
    expect(thin(pts.slice(0, 3), 500)).toHaveLength(3);
  });
  it('builds the majors list, biggest mover first, without the base', () => {
    const now = { date: '2026-11-06', rates: { EUR: 0.9, GBP: 0.8, JPY: 150 } };
    const then = { date: '2025-11-07', rates: { EUR: 0.9, GBP: 0.64, JPY: 100 } };
    const m = parseMoves(now, then, 'USD');
    expect(m.moves.map(x => x.code)).toEqual(['JPY', 'GBP', 'EUR']);
    expect(m.moves[0].change).toBeCloseTo(0.5, 10);
    expect(m.moves.find(x => x.code === 'USD')).toBeUndefined();
    expect(parseMoves(now, { date: '2025-11-07', rates: { EUR: 1 } }, 'USD').moves.map(x => x.code)).toEqual(['EUR', 'GBP', 'JPY']);
  });
});

describe('ambiguous or malformed amounts are refused, not guessed', () => {
  it.each(['1..5', '1,,5', '1,234,56', '1.500', '1.2.3,4', ',', '.', '1,2,3'])('refuses %j', raw => { expect(parseAmount(raw)).toBeNull(); });
  it.each([['1,500', 1500], ['1.500,25', 1500.25], ['1,500.25', 1500.25], ['1.5', 1.5], ['1500', 1500], ['12,3456', 12.3456]])('still reads %j', (raw, n) => { expect(parseAmount(raw as string)).toBe(n); });
});

describe('currency maths', () => {
  it.each([
    ['1234.56', 1234.56], ['1,234.56', 1234.56], ['1.234,56', 1234.56], ['1,234', 1234], ['1,5', 1.5], ['1.234.567', 1234567],
    ['1,234,567.89', 1234567.89], ['12,34,567', 1234567], ['$ 2 500', 2500], ['-50', -50], ['(75.5)', -75.5], ['−20', -20], ['.5', 0.5], ['5.', 5], ['0', 0], ['-0', 0], ['  42  ', 42], ['1\'234', 1234]
  ])('reads %s as %s', (text, n) => { expect(parseAmount(text)).toBe(n); });
  it.each(['', '   ', 'abc', '-', '1.2.3,4,5x', '1e5', '..', ',', '1,23,45.6.7', '99999999999999999', 'NaN', null, undefined, {}, NaN, Infinity])('refuses %j', bad => { expect(parseAmount(bad as any)).toBeNull(); });
  it('accepts plain numbers within limits', () => { expect(parseAmount(12.5)).toBe(12.5); expect(parseAmount(1e14)).toBeNull(); });
  it('inverts exactly and refuses nonsense', () => {
    expect(invertRate(0.8957)).toBe(1 / 0.8957);
    expect(invertRate(invertRate(0.8957)!)).toBeCloseTo(0.8957, 12);
    expect(invertRate(0)).toBeNull(); expect(invertRate(-1)).toBeNull(); expect(invertRate(NaN)).toBeNull(); expect(invertRate(null)).toBeNull();
  });
  it('makes cross rates through the base', () => {
    const rates = { USD: 1, EUR: 0.9, JPY: 150 };
    expect(crossRate(rates, 'EUR', 'JPY')).toBeCloseTo(150 / 0.9, 10);
    expect(crossRate(rates, 'USD', 'USD')).toBe(1);
    expect(crossRate(rates, 'EUR', 'XXX')).toBeNull(); expect(crossRate(null, 'EUR', 'USD')).toBeNull();
    expect(crossRate({ A: 0, B: 1 }, 'A', 'B')).toBeNull();
  });
  it('formats rates and amounts without NaN', () => {
    expect(fmtRate(0.89566)).toBe('0.8957'); expect(fmtRate(1.11650)).toBe('1.1165'); expect(fmtRate(158.33)).toBe('158.33');
    expect(fmtRate(0.006316)).toBe('0.006316'); expect(fmtRate(18100)).toBe('18,100.00');
    ['x', NaN, null, 0, -2, Infinity].forEach(v => expect(fmtRate(v as any)).toBe('—'));
    expect(fmtAmount(1234567.891)).toBe('1,234,567.89'); expect(fmtAmount(0.5)).toBe('0.5000'); expect(fmtAmount(0)).toBe('0.00');
    expect(fmtAmount(-1500)).toBe('−1,500.00'); expect(fmtAmount(-0.00001)).toBe('−<0.0001'); expect(fmtAmount(0.00004)).toBe('<0.0001'); expect(fmtAmount(0)).toBe('0.00'); expect(fmtAmount(1.2e20)).toMatch(/× 10\^/);
    expect(fmtAmount(1e16)).toBe('1.00 × 10^16'); expect(fmtAmount(NaN)).toBe('—'); expect(fmtAmount(undefined)).toBe('—');
  });
  it('computes range statistics by hand', () => {
    const s = seriesStats([['a', 100], ['b', 120], ['c', 80], ['d', 110]]);
    expect(s.change).toBeCloseTo(0.1, 10); expect(s.high).toBe(120); expect(s.low).toBe(80); expect(s.rank).toBe(0.75);
    expect(seriesStats([['a', 1]]).change).toBeNull(); expect(seriesStats(null).rank).toBeNull();
    expect(seriesStats([['a', NaN], ['b', 2], ['c', 3]] as any).change).toBeCloseTo(0.5, 10);
  });
  it('prepares the calculator spot and words', () => {
    expect(calcSpot(1.116498765)).toBe(1.1165); expect(calcSpot(0)).toBeNull(); expect(calcSpot(null)).toBeNull();
    expect(rankWords(0.99, 'the last year')).toMatch(/highest/); expect(rankWords(0.01, 'the last year')).toMatch(/lowest/);
    expect(rankWords(0.5, 'the last year')).toBe('higher than 50% of the days in the last year'); expect(rankWords(null, 'x')).toBe('—');
    expect(isRange('1y')).toBe(true); expect(isRange('2y')).toBe(false);
  });
});

describe('/api/fx', () => {
  beforeEach(() => resetCache());
  afterEach(() => vi.unstubAllGlobals());
  const ER_RATES: Record<string, number> = { USD: 1, EUR: 0.9, GBP: 0.8, JPY: 150, CHF: 0.88, CAD: 1.4, AUD: 1.5, CNY: 7.1, INR: 83, MXN: 17, BRL: 5.2, PKR: 276.4, BDT: 124.5 };
  const erBody = (rates = ER_RATES) => ({ result: 'success', time_last_update_unix: 1793923200, rates });
  const fawazBody = (base: string, version: string) => ({ date: version === 'latest' ? '2026-11-07' : version, [base]: Object.fromEntries(Object.entries(ER_RATES).filter(([c]) => c.toLowerCase() !== base).map(([c, v], i) => [c.toLowerCase(), v * (1 + (version === 'latest' ? 0 : 0.05)) + i / 1e3])) });
  const answer = (url: string): any => {
    if (url.startsWith('https://open.er-api.com/v6/latest/')) return { json: erBody() };
    if (url.endsWith('/currencies')) return { json: NAMES };
    if (url.startsWith('https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@')) { const m = /@([\w-]+)\/v1\/currencies\/(\w+)\.json$/.exec(url)!; return { json: fawazBody(m[2], m[1]) }; }
    if (url.includes('/latest')) return { json: latest(/base=(\w+)/.exec(url)![1]) };
    if (url.includes('..')) return { json: series };
    return { json: { ...latest(/base=(\w+)/.exec(url)![1]), date: '2025-11-07' } };
  };
  const HOSTS = /^https:\/\/(open\.er-api\.com|api\.frankfurter\.dev|cdn\.jsdelivr\.net)\//;

  it('returns rates for every currency we price, including the Pakistani rupee, with names', async () => {
    const f = mockFetch(answer);
    const r = await call(handler, { view: 'rates', base: 'USD' });
    expect(r.status).toBe(200);
    expect(r.body.base).toBe('USD'); expect(r.body.rates.USD).toBe(1); expect(r.body.rates.PKR).toBe(276.4); expect(r.body.names.PKR).toBe('Pakistani Rupee'); expect(r.body.names.EUR).toBe('Euro');
    expect(r.body.date).toBe('2026-11-06'); expect(r.headers['cache-control']).toBe('s-maxage=3600, stale-while-revalidate=86400');
    expect(f.calls.every(u => HOSTS.test(u))).toBe(true);
  });
  it('accepts a base the ECB does not publish (PKR) and keeps the currency list in memory', async () => {
    const f = mockFetch(answer);
    expect((await call(handler, { base: 'PKR' })).status).toBe(200); expect((await call(handler, { view: 'rates', base: 'BDT' })).status).toBe(200);
    expect(f.calls.filter(u => u.endsWith('/currencies'))).toHaveLength(1);
    expect(f.calls.filter(u => u === 'https://open.er-api.com/v6/latest/USD')).toHaveLength(1);
  });
  it('uses the ECB for history when both currencies are published there', async () => {
    const f = mockFetch(answer);
    const r = await call(handler, { view: 'history', base: 'USD', quote: 'EUR', range: '1m' });
    expect(r.status).toBe(200); expect(r.body.points).toHaveLength(4); expect(r.body.limited).toBe(false);
    expect(r.body).toMatchObject({ base: 'USD', quote: 'EUR', first: 0.9, last: 0.9, high: 0.92, low: 0.88 }); expect(r.body.change).toBeCloseTo(0, 10);
    expect(r.headers['cache-control']).toBe('s-maxage=21600, stale-while-revalidate=86400');
    expect(f.calls.some(u => /frankfurter\.dev\/v1\/\d{4}-\d{2}-\d{2}\.\.\?base=USD&symbols=EUR$/.test(u))).toBe(true);
    expect(f.calls.some(u => u.includes('jsdelivr'))).toBe(false);
  });
  it('uses dated community data for history when a currency is not on the ECB list (PKR)', async () => {
    const f = mockFetch(answer);
    const r = await call(handler, { view: 'history', base: 'USD', quote: 'PKR', range: '3m' });
    expect(r.status).toBe(200); expect(r.body.limited).toBe(false);
    expect(r.body.points.length).toBeGreaterThan(20); expect(r.body.points.length).toBeLessThanOrEqual(32);
    const dates = r.body.points.map((p: any) => p[0]); expect([...dates].sort()).toEqual(dates); expect(new Set(dates).size).toBe(dates.length);
    expect(f.calls.some(u => /currency-api@\d{4}-\d{2}-\d{2}\/v1\/currencies\/usd\.json$/.test(u))).toBe(true);
    expect(r.body.high).toBeGreaterThanOrEqual(r.body.low);
  });
  it('says so when history for a pair only goes back to March 2024', async () => {
    mockFetch(answer);
    const r = await call(handler, { view: 'history', base: 'PKR', quote: 'USD', range: '10y' });
    expect(r.status).toBe(200); expect(r.body.limited).toBe(true); expect(r.body.earliest).toBe('2024-03-02'); expect(r.body.firstDate >= '2024-03-02').toBe(true);
  });
  it('skips days the community dataset is missing instead of failing', async () => {
    let n = 0;
    mockFetch(url => { if (url.includes('currency-api@') && ++n % 5 === 0) return { status: 404, json: {} }; return answer(url); });
    const r = await call(handler, { view: 'history', base: 'USD', quote: 'PKR', range: '3m' });
    expect(r.status).toBe(200); expect(r.body.points.length).toBeGreaterThan(15);
  });
  it('gives a 404 when the community dataset has no days at all', async () => {
    mockFetch(url => (url.includes('currency-api@') ? { status: 404, json: {} } : answer(url)));
    expect((await call(handler, { view: 'history', base: 'USD', quote: 'PKR', range: '1m' })).status).toBe(404);
  });
  it('thins a long ECB series to 500 points', async () => {
    const rows: any = {};
    for (let i = 0; i < 2600; i++) rows[new Date(Date.UTC(2016, 0, 1 + i)).toISOString().slice(0, 10)] = { EUR: 1 + i / 1e4 };
    mockFetch(url => (url.includes('..') ? { json: { rates: rows } } : answer(url)));
    const r = await call(handler, { view: 'history', base: 'USD', quote: 'EUR', range: '10y' });
    expect(r.body.points).toHaveLength(500);
  });
  it('returns the majors for an ECB base with two ECB calls', async () => {
    const f = mockFetch(answer);
    const r = await call(handler, { view: 'moves', base: 'USD' });
    expect(r.status).toBe(200); expect(r.body.moves.length).toBeGreaterThan(5); expect(r.body.moves.find((m: any) => m.code === 'USD')).toBeUndefined();
    expect(f.calls.filter(u => u.includes('frankfurter') && u.includes('symbols=') && !u.includes('..'))).toHaveLength(2);
    expect(r.headers['cache-control']).toBe('s-maxage=3600, stale-while-revalidate=86400');
  });
  it('returns the majors for a base the ECB does not publish (PKR) from the community data', async () => {
    const f = mockFetch(answer);
    const r = await call(handler, { view: 'moves', base: 'PKR' });
    expect(r.status).toBe(200); expect(r.body.moves.length).toBeGreaterThan(5); expect(r.body.moves.find((m: any) => m.code === 'PKR')).toBeUndefined();
    expect(f.calls.filter(u => u.includes('currency-api@') && u.endsWith('/pkr.json'))).toHaveLength(2);
    expect(r.body.moves.every((m: any) => m.change == null || Number.isFinite(m.change))).toBe(true);
  });
  it.each([
    [{ view: 'rates', base: 'usd' }], [{ view: 'rates', base: 'USDX' }], [{ view: 'rates', base: 'ZZZ' }], [{ view: 'rates', base: '<script>' }],
    [{ view: 'rates', base: 'U'.repeat(500) }], [{ view: 'rates' }], [{ view: 'history', base: 'USD', quote: 'USD' }], [{ view: 'history', base: 'USD' }],
    [{ view: 'history', base: 'USD', quote: 'EUR', range: '2y' }], [{ view: 'nope', base: 'USD' }], [{ view: ['rates', 'history'], base: ['U', 'S'] }], [{ view: 'rates', base: 'US\u0000D' }]
  ])('answers 400 for %j', async q => {
    const f = mockFetch(answer);
    const r = await call(handler, q as any);
    expect(r.status).toBe(400); expect(r.headers['cache-control']).toBe('no-store'); expect(typeof r.body.error).toBe('string');
    expect(f.calls.every(u => HOSTS.test(u))).toBe(true);
  });
  it('refuses a repeated parameter and unknown options', async () => {
    const f = mockFetch(answer);
    expect((await call(handler, { view: 'rates', base: ['EUR', 'USD'] })).status).toBe(400);
    expect((await call(handler, { view: 'rates', cachebust: '1' })).status).toBe(400);
    expect(f.calls).toHaveLength(0);
  });
  it('maps upstream failures to friendly errors', async () => {
    const cases: [any, number][] = [[{ status: 404 }, 404], [{ status: 429 }, 503], [{ status: 500 }, 502], [new Error('net down'), 502], [{ text: '<html>oops</html>', json: undefined, status: 200 }, 502]];
    for (const [bad, status] of cases) {
      resetCache();
      mockFetch(url => (url.startsWith('https://open.er-api.com/') ? bad : answer(url)));
      const r = await call(handler, { view: 'rates', base: 'USD' });
      expect(r.status).toBe(status);
      expect(r.headers['cache-control']).toBe(status === 404 ? 's-maxage=60' : 'no-store');
      expect(r.text).not.toMatch(/html|oops|net down/);
    }
  });
  it('still works when the ECB list is down (history falls back to the community data)', async () => {
    mockFetch(url => (url.endsWith('/currencies') && url.includes('frankfurter') ? { status: 500, json: {} } : answer(url)));
    const r = await call(handler, { view: 'history', base: 'USD', quote: 'EUR', range: '1m' });
    expect(r.status).toBe(200); expect(r.body.points.length).toBeGreaterThan(15);
  });
  it('maps wrong shapes from the rates call to 502', async () => {
    for (const json of [null, 'x', [], {}, { result: 'error' }, { result: 'success', rates: 'no' }, { result: 'success', rates: {} }]) {
      mockFetch(url => (url.startsWith('https://open.er-api.com/') ? { json } : answer(url)));
      resetCache();
      const r = await call(handler, { view: 'rates', base: 'USD' });
      expect(r.status).toBe(502); expect(r.headers['cache-control']).toBe('no-store');
    }
  });
  it('maps an ECB history with no rows to 404', async () => {
    mockFetch(url => (url.includes('..') ? { json: { rates: {} } } : answer(url)));
    expect((await call(handler, { view: 'history', base: 'USD', quote: 'EUR', range: '1m' })).status).toBe(404);
  });
  it('refuses POST', async () => {
    mockFetch(answer);
    const r = await call(handler, { base: 'USD' }, 'POST');
    expect(r.status).toBe(405); expect(r.headers.allow).toBe('GET, HEAD'); expect(r.headers['cache-control']).toBe('no-store');
  });
});

describe('extra currency sources', () => {
  it('reads open.er-api answers defensively', () => {
    const r = parseErRates({ result: 'success', time_last_update_unix: 1793923200, rates: { USD: 1, PKR: 276.4, bad: 3, XXX: -1, YYY: 'a', ZZZ: Infinity } }, 'USD');
    expect(r).toEqual({ base: 'USD', date: '2026-11-06', rates: { USD: 1, PKR: 276.4 } });
    for (const bad of [null, 5, {}, { result: 'error' }, { result: 'success', rates: [] }, { result: 'success', rates: {} }]) expect(() => parseErRates(bad as any, 'USD')).toThrow();
  });
  it('reads currency-api answers defensively and upper-cases codes', () => {
    expect(parseFawaz({ date: '2026-11-07', usd: { pkr: 276.4, eur: 0.9, bad1: 1, nan: NaN } }, 'USD')).toEqual({ date: '2026-11-07', rates: { PKR: 276.4, EUR: 0.9, USD: 1 } });
    for (const bad of [null, {}, { date: 'x', usd: { eur: 1 } }, { date: '2026-11-07' }, { date: '2026-11-07', usd: [] }, { date: '2026-11-07', usd: {} }]) expect(() => parseFawaz(bad as any, 'USD')).toThrow();
  });
  it('names currencies from the runtime, with the code as a fallback', () => {
    expect(currencyName('PKR')).toBe('Pakistani Rupee'); expect(currencyName('EUR')).toBe('Euro'); expect(currencyName('QQQ')).toBe('QQQ'); expect(currencyName('')).toBe('');
  });
  it('picks sample dates: daily, 3-daily, weekly and never before the dataset starts', () => {
    const now = new Date('2026-11-08T10:00:00Z');
    expect(sampleDates('1m', now)).toHaveLength(32); expect(sampleDates('3m', now).length).toBeGreaterThan(28); expect(sampleDates('1y', now)).toHaveLength(53);
    const long = sampleDates('10y', now); expect(long[0] >= '2024-03-02').toBe(true); expect(long[long.length - 1]).toBe('2026-11-08'); expect([...long].sort()).toEqual(long);
  });
  it('builds a sorted, de-duplicated series and refuses too little data', () => {
    const a = (d: string, v: number) => ({ date: d, rates: { PKR: v } });
    expect(fawazSeries([a('2026-01-03', 3), a('2026-01-01', 1), a('2026-01-01', 9), null as any, { date: 'x', rates: { PKR: 5 } } as any, a('2026-01-02', NaN)], 'PKR')).toEqual([['2026-01-01', 1], ['2026-01-03', 3]]);
    expect(() => fawazSeries([a('2026-01-01', 1)], 'PKR')).toThrow(/enough/);
  });
});
