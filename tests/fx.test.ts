import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { startDate, parseRates, parseNames, parseSeries, summarise, parseMoves, thin } from '../api/_fx.js';
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
    expect(fmtAmount(-1500)).toBe('−1,500.00'); expect(fmtAmount(-0.00001)).toBe('0.0000');
    expect(fmtAmount(1e16)).toBe('—'); expect(fmtAmount(NaN)).toBe('—'); expect(fmtAmount(undefined)).toBe('—');
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
  const answer = (url: string): any => {
    if (url.endsWith('/currencies')) return { json: NAMES };
    if (url.includes('/latest')) return { json: latest(/base=(\w+)/.exec(url)![1]) };
    if (url.includes('..')) return { json: series };
    return { json: { ...latest(/base=(\w+)/.exec(url)![1]), date: '2025-11-07' } };
  };

  it('returns rates with names and long caching', async () => {
    const f = mockFetch(answer);
    const r = await call(handler, { view: 'rates', base: 'USD' });
    expect(r.status).toBe(200);
    expect(r.body.base).toBe('USD'); expect(r.body.rates.USD).toBe(1); expect(r.body.names.EUR).toBe('Euro'); expect(r.body.date).toBe('2026-11-06');
    expect(r.headers['cache-control']).toBe('s-maxage=3600, stale-while-revalidate=86400');
    expect(f.calls.every(u => u.startsWith('https://api.frankfurter.dev/v1/'))).toBe(true);
  });
  it('defaults to the rates view and caches the name list in memory', async () => {
    const f = mockFetch(answer);
    await call(handler, { base: 'EUR' }); await call(handler, { view: 'rates', base: 'GBP' });
    expect(f.calls.filter(u => u.endsWith('/currencies'))).toHaveLength(1);
  });
  it('returns thinned history with its summary', async () => {
    const f = mockFetch(answer);
    const r = await call(handler, { view: 'history', base: 'USD', quote: 'EUR', range: '1m' });
    expect(r.status).toBe(200);
    expect(r.body.points).toHaveLength(4);
    expect(r.body).toMatchObject({ base: 'USD', quote: 'EUR', first: 0.9, last: 0.9, high: 0.92, low: 0.88 });
    expect(r.body.change).toBeCloseTo(0, 10);
    expect(r.headers['cache-control']).toBe('s-maxage=21600, stale-while-revalidate=86400');
    expect(f.calls.some(u => /\/v1\/\d{4}-\d{2}-\d{2}\.\.\?base=USD&symbols=EUR$/.test(u))).toBe(true);
  });
  it('thins a long series to 500 points', async () => {
    const rows: any = {};
    for (let i = 0; i < 2600; i++) rows[new Date(Date.UTC(2016, 0, 1 + i)).toISOString().slice(0, 10)] = { EUR: 1 + i / 1e4 };
    mockFetch(url => (url.endsWith('/currencies') ? { json: NAMES } : { json: { rates: rows } }));
    const r = await call(handler, { view: 'history', base: 'USD', quote: 'EUR', range: '10y' });
    expect(r.body.points).toHaveLength(500);
  });
  it('returns the majors with two upstream calls for the rates', async () => {
    const f = mockFetch(answer);
    const r = await call(handler, { view: 'moves', base: 'USD' });
    expect(r.status).toBe(200);
    expect(r.body.moves.length).toBeGreaterThan(5); expect(r.body.moves.find((m: any) => m.code === 'USD')).toBeUndefined();
    expect(f.calls.filter(u => u.includes('symbols=') && !u.includes('..'))).toHaveLength(2);
    expect(r.headers['cache-control']).toBe('s-maxage=3600, stale-while-revalidate=86400');
  });
  it.each([
    [{ view: 'rates', base: 'usd' }], [{ view: 'rates', base: 'USDX' }], [{ view: 'rates', base: 'ZZZ' }], [{ view: 'rates', base: '<script>' }],
    [{ view: 'rates', base: 'U'.repeat(500) }], [{ view: 'rates' }], [{ view: 'history', base: 'USD', quote: 'USD' }], [{ view: 'history', base: 'USD' }],
    [{ view: 'history', base: 'USD', quote: 'EUR', range: '2y' }], [{ view: 'nope', base: 'USD' }], [{ view: ['rates', 'history'], base: ['U', 'S'] }], [{ view: 'rates', base: 'US\u0000D' }]
  ])('answers 400 for %j', async q => {
    const f = mockFetch(answer);
    const r = await call(handler, q as any);
    expect(r.status).toBe(400); expect(r.headers['cache-control']).toBe('no-store'); expect(typeof r.body.error).toBe('string');
    expect(f.calls.every(u => u.startsWith('https://api.frankfurter.dev/'))).toBe(true);
  });
  it('refuses a repeated parameter and unknown options', async () => {
    const f = mockFetch(answer);
    expect((await call(handler, { view: 'rates', base: ['EUR', 'USD'] })).status).toBe(400);
    expect((await call(handler, { view: 'rates', cachebust: '1' })).status).toBe(400);
    expect(f.calls.some(u => u.includes('/latest'))).toBe(false);
  });
  it('maps upstream failures to friendly errors', async () => {
    const cases: [any, number][] = [[{ status: 404 }, 404], [{ status: 429 }, 503], [{ status: 500 }, 502], [new Error('net down'), 502], [{ text: '<html>oops</html>', json: undefined, status: 200 }, 502]];
    for (const [bad, status] of cases) {
      resetCache();
      mockFetch(url => (url.endsWith('/currencies') ? bad : answer(url)));
      const r = await call(handler, { view: 'rates', base: 'USD' });
      expect(r.status).toBe(status);
      expect(r.headers['cache-control']).toBe(status === 404 ? 's-maxage=60' : 'no-store');
      expect(r.text).not.toMatch(/html|oops|net down/);
    }
  });
  it('maps wrong shapes from the rates call to 502', async () => {
    for (const json of [null, 'x', [], {}, { date: '2026-11-06', rates: 'no' }]) {
      mockFetch(url => (url.endsWith('/currencies') ? { json: NAMES } : { json }));
      const r = await call(handler, { view: 'rates', base: 'USD' });
      expect(r.status).toBe(502); expect(r.headers['cache-control']).toBe('no-store');
    }
  });
  it('maps a history with no rows to 404', async () => {
    mockFetch(url => (url.endsWith('/currencies') ? { json: NAMES } : { json: { rates: {} } }));
    const r = await call(handler, { view: 'history', base: 'USD', quote: 'EUR', range: '1m' });
    expect(r.status).toBe(404);
  });
  it('refuses POST', async () => {
    mockFetch(answer);
    const r = await call(handler, { base: 'USD' }, 'POST');
    expect(r.status).toBe(405); expect(r.headers.allow).toBe('GET, HEAD'); expect(r.headers['cache-control']).toBe('no-store');
  });
});
