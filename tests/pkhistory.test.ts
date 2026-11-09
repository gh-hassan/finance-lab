import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseBars, monthlyReturns, buildIndex } from '../api/_pkhistory.js';
import handler, { resetCache } from '../api/pkhistory.js';
import { call, mockFetch } from './helpers';
import { pakistanLine, timeMachine } from '../src/lib/homeplus';

afterEach(() => { vi.unstubAllGlobals(); resetCache(); });

const ts = (y: number, m: number) => Date.UTC(y, m - 1, 1, 0, 0) / 1000 - 5 * 3600; // 00:00 Pakistan time on the 1st is the day before in UTC
const chart = (vals: (number | null)[], start = 200801) => ({ chart: { result: [{ meta: { gmtoffset: 18000 }, timestamp: vals.map((_, i) => { const m = start % 100 - 1 + i; return ts(Math.floor(start / 100) + Math.floor(m / 12), m % 12 + 1); }), indicators: { adjclose: [{ adjclose: vals }] } }] } });
const mk = (n: number, start = 200801) => Array.from({ length: n }, (_, i) => { const m = start % 100 - 1 + i; return (Math.floor(start / 100) + Math.floor(m / 12)) * 100 + (m % 12) + 1; });

describe('parseBars', () => {
  it('labels bars by local month and skips bad prices', () => {
    const b = parseBars(chart([10, null, 12, NaN as any, -1, 20]));
    expect(b.map(x => x[0])).toEqual([200801, 200803, 200806]);
  });
  it('survives junk', () => { for (const j of [null, {}, { chart: {} }, { chart: { result: [{}] } }]) expect(parseBars(j as any)).toEqual([]); });
});

describe('monthlyReturns and buildIndex', () => {
  it('only returns months that follow a present month', () => {
    const r = monthlyReturns([[200801, 100], [200802, 110], [200804, 121]]);
    expect([...r]).toEqual([[200802, 0.1 + 0]].map(([m, v]) => [m, expect.closeTo(v as number, 6)]));
  });
  it('averages stocks and converts to dollars with the rupee move', () => {
    const a = mk(30).map((m, i) => [m, 100 * 1.02 ** i] as [number, number]), fx = mk(30).map((m, i) => [m, 100 * 1.01 ** i] as [number, number]);
    const idx = buildIndex([a, a, a, a, a], fx, 5);
    expect(idx.months[0]).toBe(200802); expect(idx.pkr[0]).toBeCloseTo(2, 3);
    expect(idx.usd[0]).toBeCloseTo((1.02 / 1.01 - 1) * 100, 3);
  });
  it('skips months with too few stocks or no rate', () => {
    const a = mk(30).map((m, i) => [m, 100 + i] as [number, number]);
    expect(buildIndex([a, a], a, 5).months).toEqual([]);
    expect(buildIndex([a, a, a, a, a], [], 5).months).toEqual([]);
  });
  it('ignores absurd single-stock moves', () => {
    const a = mk(30).map((m, i) => [m, 100 + i] as [number, number]), wild = a.map(([m, v], i) => [m, i === 5 ? v * 50 : v] as [number, number]);
    const idx = buildIndex([a, a, a, a, wild], a, 5);
    expect((idx.months as number[]).includes(200806)).toBe(false); // the wild stock is dropped, leaving too few stocks that month
    expect(buildIndex([a, a, a, a, a, wild], a, 5).pkr.every((x: number) => x < 5)).toBe(true);
  });
});

describe('/api/pkhistory', () => {
  const series = (g: number) => chart(Array.from({ length: 80 }, (_, i) => 100 * g ** i));
  it('builds the index from Yahoo only', async () => {
    const { calls } = mockFetch(u => ({ json: series(String(u).includes('PKR') ? 1.005 : 1.01) }));
    const r = await call(handler, {});
    expect(r.status).toBe(200); expect(r.body.stocks).toBe(13); expect(r.body.months.length).toBeGreaterThan(60);
    expect(calls.every((c: string) => c.startsWith('https://query1.finance.yahoo.com/'))).toBe(true);
  });
  it('fails with a friendly 502 when too little loads', async () => {
    mockFetch(() => ({ json: { chart: { result: null } } }));
    const r = await call(handler, {}); expect(r.status).toBe(502); expect(r.headers['cache-control']).toBe('no-store');
  });
  it('refuses unknown options', async () => { mockFetch(() => ({ json: {} })); expect((await call(handler, { x: '1' })).status).toBe(400); });
});

describe('pakistanLine', () => {
  const months = mk(24, 201001), pk = { months: mk(120, 200802), pkr: mk(120, 200802).map(() => 1), usd: mk(120, 200802).map(() => 0.5) };
  it('grows the dollars by the dollar returns and reports the rupee multiple', () => {
    const l = pakistanLine(months, pk, 1000)!;
    expect(l.endUsd).toBeCloseTo(1000 * 1.005 ** 24, 4); expect(l.multiplePkr).toBeCloseTo(1.01 ** 24, 6); expect(l.pts).toHaveLength(25);
  });
  it('is null when the start is before the data, or the data is broken', () => {
    expect(pakistanLine(mk(24, 200501), pk, 1000)).toBeNull();
    expect(pakistanLine(months, null, 1000)).toBeNull();
    expect(pakistanLine(months, { ...pk, usd: [1] }, 1000)).toBeNull();
    expect(pakistanLine([], pk, 1000)).toBeNull();
  });
  it('rides along in the time machine', () => {
    const z = mk(240, 200601).map(() => 0);
    expect(timeMachine(mk(240, 200601), z, z, 2012, 1000, pk)!.pk).not.toBeNull();
    expect(timeMachine(mk(240, 200601), z, z, 2006, 1000, pk)!.pk).toBeNull();
  });
});
