import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { COUNTRIES as SERVER_COUNTRIES, INDICATORS as SERVER_INDICATORS, parseCountries, parseWorldBank, latestOf, MAX_AGE } from '../api/_world.js';
import handler from '../api/world.js';
import {
  COUNTRIES, CODES, INDICATORS, INDICATOR_IDS, DEFAULT_COUNTRIES, countryName, regionOf, indicatorOf, isCountry, isIndicator, parseCountryList,
  formatValue, latestValue, rankCountries, yearAxis, alignToYears, fxInputs
} from '../src/lib/countries';
import { call, mockFetch } from './helpers';

const NOW = new Date().getFullYear();
const row = (code: string, date: number | string, value: any) => ({ country: { id: code, value: code }, countryiso3code: code, date: String(date), value });
const wb = (rows: any[]) => [{ page: 1, pages: 1, total: rows.length }, rows];

describe('lists stay in step with the server', () => {
  it('same countries and indicators', () => {
    expect([...CODES].sort()).toEqual([...SERVER_COUNTRIES].sort());
    expect([...INDICATOR_IDS].sort()).toEqual(Object.keys(SERVER_INDICATORS).sort());
  });
  it('every country has a name and region, and defaults are valid', () => {
    expect(COUNTRIES.every(c => c.name && c.region && /^[A-Z]{2}$/.test(c.code))).toBe(true);
    expect(new Set(CODES).size).toBe(CODES.length);
    expect(DEFAULT_COUNTRIES.every(isCountry)).toBe(true);
    expect(INDICATORS.every(i => i.means && i.investors)).toBe(true);
  });
  it('looks things up with safe fallbacks', () => {
    expect(countryName('DE')).toBe('Germany'); expect(countryName('ZZ')).toBe('ZZ'); expect(regionOf('JP')).toBe('Asia-Pacific'); expect(regionOf('ZZ')).toBe('');
    expect(indicatorOf('SP.POP.TOTL').kind).toBe('people'); expect(indicatorOf('nope').id).toBe(INDICATOR_IDS[0]);
    expect(isIndicator('FP.CPI.TOTL.ZG')).toBe(true); expect(isIndicator('x')).toBe(false); expect(isCountry(5)).toBe(false);
  });
});

describe('client helpers', () => {
  it('parses a country list safely', () => {
    expect(parseCountryList('us, de;xx,US,<b>')).toEqual(['US', 'DE']);
    expect(parseCountryList('')).toEqual(DEFAULT_COUNTRIES); expect(parseCountryList(null)).toEqual(DEFAULT_COUNTRIES); expect(parseCountryList('zz')).toEqual(DEFAULT_COUNTRIES);
    expect(parseCountryList(CODES.join(','))).toHaveLength(6); expect(parseCountryList(CODES.join(','), 3)).toHaveLength(3);
  });
  it('formats values and never prints NaN', () => {
    expect(formatValue('pct', 3.14159)).toBe('3.1%'); expect(formatValue('pct', -0.04)).toBe('0.0%'); expect(formatValue('pct', -2.5)).toBe('−2.5%');
    expect(formatValue('usd', 65123.4)).toBe('$65,123'); expect(formatValue('usd', -5)).toBe('−$5'); expect(formatValue('people', 1.41e9)).toBe('1.4B');
    for (const bad of [null, undefined, NaN, Infinity]) expect(formatValue('pct', bad as any)).toBe('—');
  });
  it('picks the newest real value and skips nulls', () => {
    expect(latestValue([[2022, 1], [2024, 3], [2023, 2]])).toEqual({ year: 2024, value: 3 });
    expect(latestValue([[2022, 1], [2024, NaN], [2023, null as any]])).toEqual({ year: 2022, value: 1 });
    expect(latestValue([])).toBeNull(); expect(latestValue(null)).toBeNull(); expect(latestValue([null as any, [NaN, 1]])).toBeNull();
  });
  it('ranks high to low, shares ties, puts missing last', () => {
    const r = rankCountries({ US: { year: 2024, value: 5 }, DE: { year: 2024, value: 5 }, JP: { year: 2023, value: 1 }, CN: { year: 2024, value: 9 }, IN: null, FR: { year: 2024, value: NaN } });
    expect(r.slice(0, 4).map(x => [x.code, x.rank])).toEqual([['CN', 1], ['DE', 2], ['US', 2], ['JP', 4]]);
    expect(r).toHaveLength(CODES.length);
    expect(r.slice(4).every(x => x.rank == null && x.value == null && x.year == null)).toBe(true);
    expect(r[4].code < r[5].code).toBe(true);
  });
  it('ranks low to high and handles three-way ties', () => {
    const r = rankCountries({ US: { year: 1, value: 2 }, DE: { year: 1, value: 2 }, JP: { year: 1, value: 2 }, CN: { year: 1, value: 1 } }, true);
    expect(r.slice(0, 4).map(x => x.rank)).toEqual([1, 2, 2, 2]);
    expect(rankCountries({}).every(x => x.rank == null)).toBe(true);
  });
  it('builds a shared year axis with gaps as NaN', () => {
    const s = { US: [[2000, 1], [2002, 3]], DE: [[2001, 2]] } as any;
    const years = yearAxis(s);
    expect(years).toEqual([2000, 2001, 2002]);
    const a = alignToYears(s.US, years);
    expect(a.map(p => p[0])).toEqual(years); expect(a[1][1]).toBeNaN(); expect(a[2][1]).toBe(3);
    expect(alignToYears(undefined, years).every(p => Number.isNaN(p[1]))).toBe(true);
  });
  it('prepares calculator inputs from two inflation figures', () => {
    expect(fxInputs({ value: 2.349 }, { value: 7.86 })).toEqual({ pd: 2.3, pf: 7.9 });
    expect(fxInputs(null, { value: 1 })).toBeNull(); expect(fxInputs({ value: NaN }, { value: 1 })).toBeNull(); expect(fxInputs({ value: 1 }, undefined)).toBeNull();
  });
});

describe('server helpers', () => {
  it('validates country lists', () => {
    expect(parseCountries('us;DE,jp;US')).toEqual(['US', 'DE', 'JP']);
    for (const bad of ['', 'XX', 'US;', 'US;XX', 'US;DE;JP;CN;IN;BR;GB;FR;IT', ';']) expect(() => parseCountries(bad), bad).toThrow();
  });
  it('reads World Bank rows, drops nulls and strangers, sorts by year, rounds', () => {
    const out = parseWorldBank(wb([row('US', 2002, 2.123456), row('US', 2001, 1), row('US', 2003, null), row('XX', 2001, 5), row('DE', 'abc', 1), row('DE', 2001, 'x'), row('DE', 2001, Infinity), null, 7, row('DE', 2000, 0)]));
    expect(out).toEqual({ US: [[2001, 1], [2002, 2.123]], DE: [[2000, 0]] });
  });
  it('handles empty, error and strange shapes', () => {
    expect(parseWorldBank([{ page: 0, total: 0 }, null])).toEqual({});
    expect(() => parseWorldBank([{ message: [{ id: '120', value: 'Invalid value' }] }])).toThrow(/no data/);
    for (const bad of [null, undefined, {}, 'x', 5, [], [null, []], [{}], [{}, 'x'], [{}, {}], [{ message: 'odd' }], [{}, new Array(5001).fill(null)]]) expect(() => parseWorldBank(bad), JSON.stringify(bad)).toThrow();
  });
  it('picks the latest value that is recent enough', () => {
    expect(latestOf([[NOW - 3, 1], [NOW - 1, 2]], NOW)).toEqual({ year: NOW - 1, value: 2 });
    expect(latestOf([[NOW - MAX_AGE - 1, 1]], NOW)).toBeNull(); expect(latestOf([], NOW)).toBeNull(); expect(latestOf(null as any, NOW)).toBeNull();
    expect(latestOf([[NOW - 1, NaN], [NOW - 2, 4]], NOW)).toEqual({ year: NOW - 2, value: 4 });
  });
});

describe('GET /api/world', () => {
  afterEach(() => vi.unstubAllGlobals());
  const ok = () => mockFetch(() => ({ json: wb([row('US', NOW - 1, 3.1), row('US', NOW - 2, 2.5), row('DE', NOW - 1, null), row('DE', NOW - 2, 1.9), row('JP', NOW - 20, 0.5)]) }));

  it('returns series and latest for chosen countries with a day-long cache', async () => {
    const m = ok();
    const r = await call(handler, { indicator: 'FP.CPI.TOTL.ZG', countries: 'US;DE;JP' });
    expect(r.status).toBe(200);
    expect(r.headers['cache-control']).toBe('s-maxage=86400, stale-while-revalidate=604800');
    expect(r.body.indicator).toEqual({ id: 'FP.CPI.TOTL.ZG', label: expect.any(String), unit: '%' });
    expect(r.body.series.US).toEqual([[NOW - 2, 2.5], [NOW - 1, 3.1]]);
    expect(r.body.series.DE).toEqual([[NOW - 2, 1.9]]);
    expect(r.body.latest.US).toEqual({ year: NOW - 1, value: 3.1 }); expect(r.body.latest.DE).toEqual({ year: NOW - 2, value: 1.9 }); expect(r.body.latest.JP).toBeNull();
    expect(m.calls).toHaveLength(1);
    expect(m.calls[0]).toMatch(/^https:\/\/api\.worldbank\.org\/v2\/country\/US;DE;JP\/indicator\/FP\.CPI\.TOTL\.ZG\?format=json/);
  });
  it('accepts commas and lower case', async () => { ok(); const r = await call(handler, { indicator: 'SP.POP.TOTL', countries: 'us,de' }); expect(r.status).toBe(200); expect(Object.keys(r.body.series)).toEqual(['US', 'DE']); });
  it('abandons a stalled World Bank request and tries once more', async () => {
    vi.useFakeTimers();
    try {
      let n = 0;
      vi.stubGlobal('fetch', (_url: string, init: any) => {
        n++;
        if (n === 1) return new Promise((_, reject) => init.signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' }))));
        return Promise.resolve({ ok: true, status: 200, headers: { get: () => null }, json: async () => wb([row('PK', NOW - 1, 3.5)]) });
      });
      const pending = call(handler, { indicator: 'FP.CPI.TOTL.ZG', countries: 'PK' });
      await vi.advanceTimersByTimeAsync(6100);
      const r = await pending;
      expect(r.status).toBe(200); expect(n).toBe(2); expect(r.body.latest.PK.value).toBe(3.5);
    } finally { vi.useRealTimers(); }
  });
  it('gives a friendly error when it stalls twice', async () => {
    vi.useFakeTimers();
    try {
      vi.stubGlobal('fetch', (_url: string, init: any) => new Promise((_, reject) => init.signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })))));
      const pending = call(handler, { indicator: 'FP.CPI.TOTL.ZG', countries: 'PK' });
      await vi.advanceTimersByTimeAsync(18000);
      const r = await pending;
      expect(r.status).toBe(502); expect(r.body.error).toMatch(/slow|too long/); expect(r.headers['cache-control']).toBe('no-store');
    } finally { vi.useRealTimers(); }
  });
  it('no longer offers a whole-world ranking request (that comes from a snapshot)', async () => {
    const m = ok();
    expect((await call(handler, { indicator: 'FP.CPI.TOTL.ZG', view: 'ranking' })).status).toBe(400);
    expect((await call(handler, { indicator: 'FP.CPI.TOTL.ZG' })).status).toBe(400);
    expect(m.calls).toHaveLength(0);
  });
  it('offers Pakistan and a hundred other countries', async () => {
    const m = ok(); const r = await call(handler, { indicator: 'FP.CPI.TOTL.ZG', countries: 'PK;BD;LK' });
    expect(r.status).toBe(200); expect(Object.keys(r.body.series)).toEqual(['PK', 'BD', 'LK']); expect(m.calls[0]).toContain('/country/PK;BD;LK/');
    expect(SERVER_COUNTRIES.length).toBeGreaterThanOrEqual(100);
  });
  it('returns empty series when the source has nothing', async () => {
    mockFetch(() => ({ json: [{ page: 0, total: 0 }, null] }));
    const r = await call(handler, { indicator: 'GC.DOD.TOTL.GD.ZS', countries: 'AR' });
    expect(r.status).toBe(200); expect(r.body.series.AR).toEqual([]); expect(r.body.latest.AR).toBeNull();
  });
  it('rejects bad input before calling anyone', async () => {
    const m = ok();
    const qs: any[] = [{}, { indicator: 'bad' }, { indicator: 'FP.CPI.TOTL.ZG' }, { indicator: 'FP.CPI.TOTL.ZG', countries: '' }, { indicator: 'FP.CPI.TOTL.ZG', countries: 'XX' },
      { indicator: 'FP.CPI.TOTL.ZG', countries: 'US;DE;JP;CN;IN;BR;GB;FR;IT' }, { indicator: 'FP.CPI.TOTL.ZG', countries: 'US/../x' }, { indicator: 'FP.CPI.TOTL.ZG', countries: 'U'.repeat(41) },
      { indicator: 'FP.CPI.TOTL.ZG', countries: '<b>' }, { indicator: 'FP.CPI.TOTL.ZG', countries: 'US', view: 'all' }, { indicator: 'A'.repeat(500), countries: 'US' }, { indicator: ['bad', 'FP.CPI.TOTL.ZG'], countries: 'US' }, { indicator: 'FP.CPI.TOTL.ZG', countries: ['XX', 'US'] }];
    for (const q of qs) { const r = await call(handler, q); expect(r.status, JSON.stringify(q)).toBe(400); expect(r.headers['cache-control']).toBe('no-store'); }
    expect(m.calls).toHaveLength(0);
  });
  it('refuses repeated parameters and unknown ones', async () => { const m = ok(); for (const q of [{ indicator: ['FP.CPI.TOTL.ZG', 'x'], countries: 'US' }, { indicator: 'FP.CPI.TOTL.ZG', countries: 'US', extra: '1' }]) { const r = await call(handler, q); expect(r.status).toBe(400); } expect(m.calls).toHaveLength(0); });
  it.each([[404, 404], [429, 503], [500, 502], [503, 502]])('maps upstream %i to %i', async (up, mapped) => {
    mockFetch(() => ({ status: up, json: {} }));
    const r = await call(handler, { indicator: 'FP.CPI.TOTL.ZG', countries: 'US' });
    expect(r.status).toBe(mapped); expect(r.body.error).toBeTruthy(); if (mapped !== 404) expect(r.headers['cache-control']).toBe('no-store');
  });
  it('maps network failure, garbage and error bodies without echoing them', async () => {
    mockFetch(() => new Error('down')); let r = await call(handler, { indicator: 'FP.CPI.TOTL.ZG', countries: 'US' }); expect(r.status).toBe(502); expect(r.headers['cache-control']).toBe('no-store');
    mockFetch(() => ({ text: '<html>secret-xyz</html>' })); r = await call(handler, { indicator: 'FP.CPI.TOTL.ZG', countries: 'US' }); expect(r.status).toBe(502); expect(r.text).not.toMatch(/secret-xyz/);
    mockFetch(() => ({ json: [{ message: [{ id: '120', value: 'secret-abc' }] }] })); r = await call(handler, { indicator: 'FP.CPI.TOTL.ZG', countries: 'US' }); expect(r.status).toBe(404); expect(r.text).not.toMatch(/secret-abc/);
    mockFetch(() => ({ json: { weird: true } })); r = await call(handler, { indicator: 'FP.CPI.TOTL.ZG', countries: 'US' }); expect(r.status).toBe(502);
  });
  it('rejects POST', async () => { ok(); const r = await call(handler, { indicator: 'FP.CPI.TOTL.ZG', countries: 'US' }, 'POST'); expect(r.status).toBe(405); });
});

describe('countries snapshot', () => {
  const snap = JSON.parse(readFileSync(new URL('../src/data/countries-latest.json', import.meta.url), 'utf8'));
  it('has every indicator, every country and sane values', () => {
    const NOWY = new Date().getFullYear();
    expect(Object.keys(snap.latest).sort()).toEqual([...INDICATOR_IDS].sort());
    for (const id of INDICATOR_IDS) {
      expect(Object.keys(snap.latest[id]).sort(), id).toEqual([...SERVER_COUNTRIES].sort());
      for (const v of Object.values<any>(snap.latest[id])) if (v) { expect(Number.isFinite(v.value)).toBe(true); expect(v.year).toBeGreaterThanOrEqual(NOWY - 10); expect(v.year).toBeLessThanOrEqual(NOWY); }
    }
  });
  it('includes Pakistan with the main measures', () => {
    for (const id of ['NY.GDP.MKTP.KD.ZG', 'FP.CPI.TOTL.ZG', 'SP.POP.TOTL']) expect(snap.latest[id].PK, id).not.toBeNull();
    expect(snap.latest['SP.POP.TOTL'].PK.value).toBeGreaterThan(2e8);
  });
});
