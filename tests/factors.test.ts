import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { deflateRawSync } from 'node:zlib';
import { unzipFirst, parseFrench, mergeFactors, MAX_UNZIPPED } from '../api/_french.js';
import handler, { FILES, resetCache } from '../api/factors.js';
import {
  annualised, annualVol, returnPerRisk, shareUp, calendarYears, worstYear, decadeAverages, drawdown, growthPoints, factorStats,
  recentYears, capmInputs, parseFactorList, rangeStart, monthX, prevMonth, isFactorKey, isRange
} from '../src/lib/factors';
import { call, mockFetch } from './helpers';

/* ---------- a tiny zip writer so the reader can be tested without files ---------- */
interface ZOpts { method?: number; descriptor?: boolean; name?: string; lie?: number }
function makeZip(content: string | Buffer, o: ZOpts = {}): Buffer {
  const raw = Buffer.from(content), method = o.method ?? 8, name = Buffer.from(o.name ?? 'data.csv');
  const body = method === 8 ? deflateRawSync(raw) : raw, usize = o.lie ?? raw.length;
  const local = Buffer.alloc(30); local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(o.descriptor ? 8 : 0, 6); local.writeUInt16LE(method, 8);
  if (!o.descriptor) { local.writeUInt32LE(body.length, 18); local.writeUInt32LE(usize, 22); }
  local.writeUInt16LE(name.length, 26);
  const central = Buffer.alloc(46); central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6); central.writeUInt16LE(o.descriptor ? 8 : 0, 8); central.writeUInt16LE(method, 10);
  central.writeUInt32LE(body.length, 20); central.writeUInt32LE(usize, 24); central.writeUInt16LE(name.length, 28); central.writeUInt32LE(0, 42);
  const cdOffset = local.length + name.length + body.length;
  const eocd = Buffer.alloc(22); eocd.writeUInt32LE(0x06054b50, 0); eocd.writeUInt16LE(1, 8); eocd.writeUInt16LE(1, 10); eocd.writeUInt32LE(central.length + name.length, 12); eocd.writeUInt32LE(cdOffset, 16);
  return Buffer.concat([local, name, body, central, name, eocd]);
}

const FIVE_CSV = [
  'This file was created using the 202609 CRSP database.', 'Second description line', '',
  ',Mkt-RF,SMB,HML,RMW,CMA,RF',
  '196307,   -0.39,   -0.48,   -0.84,    0.64,   -1.15,    0.27',
  '196308,    5.08,   -0.80,    1.72,    0.40,   -0.38,    0.25',
  '196309,   -1.57,   -0.43,   -0.02,   -0.78,    0.15,    0.27', '',
  ' Annual Factors: January-December ', ',Mkt-RF,SMB,HML,RMW,CMA,RF', '  1964,   12.59,    0.52,    9.72,   -2.76,    6.49,    3.54', '', 'Copyright 2026 Eugene F. Fama and Kenneth R. French'
].join('\r\n');
const MOM_CSV = [
  'This file was created using the 202609 CRSP database.', 'Missing data are indicated by -99.99 or -999.', '',
  ',Mom   ', '192701,  0.50', '196307,  1.01', '196308,  -99.99', '196309,   -999', '', 'Annual Factors:', ',Mom', '  1927,  24.52'
].join('\n');

describe('zip reader', () => {
  it('reads a deflated file', () => { const r = unzipFirst(makeZip('hello,world\n')); expect(r.name).toBe('data.csv'); expect(r.data.toString()).toBe('hello,world\n'); });
  it('reads a stored file', () => expect(unzipFirst(makeZip('plain', { method: 0 })).data.toString()).toBe('plain'));
  it('uses the central directory when a data descriptor is used', () => expect(unzipFirst(makeZip('abc,def', { descriptor: true })).data.toString()).toBe('abc,def'));
  it('skips folders', () => { const z = makeZip('x', { name: 'dir/' }); expect(() => unzipFirst(z)).toThrow(/could not be read/); });
  it('refuses garbage, tiny and non-buffer input', () => {
    expect(() => unzipFirst(Buffer.from('not a zip at all, just text padding here'))).toThrow();
    expect(() => unzipFirst(Buffer.alloc(5))).toThrow();
    expect(() => unzipFirst('x' as any)).toThrow();
  });
  it('refuses an unsupported compression method', () => { const z = makeZip('abc', { method: 0 }); z.writeUInt16LE(12, z.indexOf(Buffer.from([0x50, 0x4b, 1, 2])) + 10); expect(() => unzipFirst(z)).toThrow(); });
  it('refuses a corrupt deflate stream', () => { const z = makeZip('some longer text to compress '.repeat(10)); z[38] = 0xff; z[39] = 0xff; expect(() => unzipFirst(z)).toThrow(); });
  it('refuses a truncated file', () => { const z = makeZip('hello world, hello world'); expect(() => unzipFirst(z.subarray(0, z.length - 30))).toThrow(); });
  it('refuses a file whose real size differs from the declared size', () => expect(() => unzipFirst(makeZip('twelve bytes', { lie: 3 }))).toThrow());
  it('refuses oversized files by declared size and by real size', () => {
    expect(() => unzipFirst(makeZip('x', { lie: MAX_UNZIPPED + 1 }))).toThrow();
    expect(() => unzipFirst(makeZip(Buffer.alloc(MAX_UNZIPPED + 10, 97), { lie: 10 }))).toThrow();
  });
  it('refuses encrypted entries', () => { const z = makeZip('abc'); const c = z.indexOf(Buffer.from([0x50, 0x4b, 1, 2])); z.writeUInt16LE(1, c + 8); expect(() => unzipFirst(z)).toThrow(); });
  it('refuses a local header offset outside the file', () => { const z = makeZip('abc'); const c = z.indexOf(Buffer.from([0x50, 0x4b, 1, 2])); z.writeUInt32LE(99999, c + 42); expect(() => unzipFirst(z)).toThrow(); });
  it('refuses a broken central directory signature', () => { const z = makeZip('abc'); const c = z.indexOf(Buffer.from([0x50, 0x4b, 1, 2])); z[c] = 0; expect(() => unzipFirst(z)).toThrow(); });
});

describe('French CSV parser', () => {
  it('reads monthly rows and stops before the annual table', () => {
    const t = parseFrench(FIVE_CSV);
    expect(t.names).toEqual(['Mkt-RF', 'SMB', 'HML', 'RMW', 'CMA', 'RF']);
    expect([...t.rows.keys()]).toEqual([196307, 196308, 196309]);
    expect(t.rows.get(196308)).toEqual([5.08, -0.8, 1.72, 0.4, -0.38, 0.25]);
  });
  it('turns missing flags into null and trims header spaces (momentum)', () => {
    const t = parseFrench(MOM_CSV);
    expect(t.names).toEqual(['Mom']);
    expect(t.rows.get(196308)).toEqual([null]); expect(t.rows.get(196309)).toEqual([null]); expect(t.rows.get(196307)).toEqual([1.01]);
    expect(t.rows.has(1927)).toBe(false);
  });
  it('treats short rows and junk cells as missing', () => {
    const t = parseFrench(',A,B\n200001, 1.5\n200002, x, 2');
    expect(t.rows.get(200001)).toEqual([1.5, null]); expect(t.rows.get(200002)).toEqual([null, 2]);
  });
  it('ignores impossible months', () => expect([...parseFrench(',A\n200013, 1\n200001, 2').rows.keys()]).toEqual([200001]));
  it('rejects empty, html and huge text', () => {
    expect(() => parseFrench('')).toThrow();
    expect(() => parseFrench('<html><body>Not found</body></html>')).toThrow();
    expect(() => parseFrench(',A\nnothing here')).toThrow();
    expect(() => parseFrench('x'.repeat(MAX_UNZIPPED + 1))).toThrow();
    expect(() => parseFrench(null as any)).toThrow();
  });
});

describe('merging the two files', () => {
  const m = mergeFactors(parseFrench(FIVE_CSV), parseFrench(MOM_CSV));
  it('keeps the five-factor months and aligns momentum', () => {
    expect(m.months).toEqual([196307, 196308, 196309]);
    expect(m.factors.MKT).toEqual([-0.39, 5.08, -1.57]);
    expect(m.factors.RF).toEqual([0.27, 0.25, 0.27]);
    expect(m.factors.MOM).toEqual([1.01, null, null]);
  });
  it('leaves momentum null where it is absent', () => expect(mergeFactors(parseFrench(FIVE_CSV), parseFrench(',Mom\n192701, 1')).factors.MOM).toEqual([null, null, null]));
  it('rejects files with the wrong columns', () => {
    expect(() => mergeFactors(parseFrench(',A,B\n200001,1,2'), parseFrench(MOM_CSV))).toThrow();
    expect(() => mergeFactors(parseFrench(FIVE_CSV), parseFrench(',Other\n196307,1'))).toThrow();
  });
});

/* ---------- handler ---------- */
const months = Array.from({ length: 130 }, (_, i) => (1990 + Math.floor(i / 12)) * 100 + (i % 12) + 1);
const bigFive = [',Mkt-RF,SMB,HML,RMW,CMA,RF', ...months.map((m, i) => `${m}, ${(i % 7) - 2.123}, 0.5, -0.5, 1, 2, 0.3`)].join('\n');
const zipBytes = (csv: string) => new Uint8Array(makeZip(csv));
const happy = (url: string) => (url === FILES.five ? { bytes: zipBytes(bigFive) } : url === FILES.mom ? { bytes: zipBytes(',Mom\n199001, 2\n199002, -99.99\n') } : { status: 500 });

describe('GET /api/factors', () => {
  beforeEach(resetCache);
  afterEach(() => { (globalThis as any).fetch = undefined; });
  it('returns aligned, rounded monthly factors with a long cache', async () => {
    const { calls } = mockFetch(happy);
    const r = await call(handler);
    expect(r.status).toBe(200);
    expect(r.headers['cache-control']).toBe('s-maxage=86400, stale-while-revalidate=604800');
    expect(r.body.months).toHaveLength(130);
    for (const k of ['MKT', 'SMB', 'HML', 'RMW', 'CMA', 'MOM', 'RF']) expect(r.body.factors[k]).toHaveLength(130);
    expect(r.body.factors.MKT[0]).toBe(-2.12); expect(r.body.factors.MOM.slice(0, 3)).toEqual([2, null, null]);
    expect(r.body.source).toMatch(/French/); expect(Number.isNaN(Date.parse(r.body.updated))).toBe(false);
    expect(calls.sort()).toEqual([FILES.five, FILES.mom].sort());
    expect(calls.every(c => c.startsWith('https://mba.tuck.dartmouth.edu/'))).toBe(true);
  });
  it('reuses a fresh copy instead of calling the source again', async () => {
    const { calls } = mockFetch(happy);
    await call(handler); await call(handler);
    expect(calls).toHaveLength(2);
  });
  it('refuses any query values (nothing a user sends reaches the source)', async () => {
    const { calls } = mockFetch(happy);
    const r = await call(handler, { url: 'https://evil.example', x: ['a', 'b'] });
    expect(r.status).toBe(400); expect(calls).toHaveLength(0);
  });
  it('rejects POST', async () => { mockFetch(happy); const r = await call(handler, {}, 'POST'); expect(r.status).toBe(405); expect(r.headers['cache-control']).toBe('no-store'); });
  it.each([[404, 404], [429, 503], [500, 502]])('maps upstream %i to %i', async (up, mapped) => {
    mockFetch(() => ({ status: up }));
    const r = await call(handler);
    expect(r.status).toBe(mapped); expect(typeof r.body.error).toBe('string');
    if (mapped !== 404) expect(r.headers['cache-control']).toBe('no-store');
  });
  it('maps a network failure to 502', async () => { mockFetch(() => new Error('offline')); const r = await call(handler); expect(r.status).toBe(502); expect(r.headers['cache-control']).toBe('no-store'); });
  it('maps garbage and html answers to 502 without echoing them', async () => {
    mockFetch(() => ({ bytes: new TextEncoder().encode('<html>secret-token-123 oops</html>') }));
    const r = await call(handler);
    expect(r.status).toBe(502); expect(r.text).not.toMatch(/secret-token/); expect(r.headers['cache-control']).toBe('no-store');
  });
  it('rejects a data set that is too short', async () => {
    mockFetch(u => (u === FILES.five ? { bytes: zipBytes(',Mkt-RF,SMB,HML,RMW,CMA,RF\n200001,1,1,1,1,1,1') } : { bytes: zipBytes(',Mom\n200001,1') }));
    expect((await call(handler)).status).toBe(502);
  });
});

/* ---------- maths ---------- */
describe('factor maths', () => {
  const twelve = Array(12).fill(1);
  it('compounds 1% a month for a year to 12.6825%', () => expect(annualised(twelve)! * 100).toBeCloseTo(12.6825, 3));
  it('annualises a 6 month run of 1% (geometric, not doubled)', () => expect(annualised(Array(6).fill(1))! * 100).toBeCloseTo(12.6825, 3));
  it('skips nulls and returns null with no data', () => { expect(annualised([1, null, 1])).toBeCloseTo(annualised([1, 1])!, 12); expect(annualised([null, null])).toBeNull(); expect(annualised([])).toBeNull(); });
  it('survives a total wipe-out month', () => expect(annualised([-100, 5])).toBe(-1));
  it('has zero volatility for a constant series', () => { expect(annualVol(Array(24).fill(0.7))).toBe(0); expect(annualVol(Array(7).fill(0.1))).toBe(0); });
  it('computes volatility by hand: [1,3] has sd sqrt(2)', () => expect(annualVol([1, 3])! * 100).toBeCloseTo(Math.sqrt(2) * Math.sqrt(12), 9));
  it('needs two numbers for volatility', () => { expect(annualVol([1])).toBeNull(); expect(annualVol([1, null])).toBeNull(); });
  it('return per risk is mean over volatility, null when risk is zero', () => {
    expect(returnPerRisk([1, 3])).toBeCloseTo(((2 * 12) / 100) / ((Math.sqrt(2) * Math.sqrt(12)) / 100), 9);
    expect(returnPerRisk(twelve)).toBeNull(); expect(returnPerRisk([])).toBeNull();
  });
  it('counts months above zero', () => { expect(shareUp([1, -1, 0, 2, null])).toBe(0.5); expect(shareUp([])).toBeNull(); });
  it('compounds calendar years and drops partial ones', () => {
    const ms = [202411, 202412, ...Array.from({ length: 12 }, (_, i) => 202501 + i), 202601, 202602];
    const rs = [5, 5, ...twelve, 3, 3];
    const y = calendarYears(ms, rs);
    expect(y.map(a => a.year)).toEqual([2025]); expect(y[0].ret * 100).toBeCloseTo(12.6825, 3);
  });
  it('drops a year with a missing month', () => {
    const ms = Array.from({ length: 12 }, (_, i) => 202001 + i);
    expect(calendarYears(ms, [...twelve.slice(0, 11), null])).toEqual([]);
  });
  it('finds the worst year', () => { expect(worstYear([{ year: 1, ret: 0.1 }, { year: 2, ret: -0.3 }, { year: 3, ret: 0 }])!.year).toBe(2); expect(worstYear([])).toBeNull(); });
  it('averages by decade and leaves out thin decades', () => {
    const ys = [1999, 2000, 2001, 2002, 2005].map((year, i) => ({ year, ret: [0.1, 0.2, -0.1, 0.3, 0.1][i] }));
    const d = decadeAverages(ys);
    expect(d).toHaveLength(1); expect(d[0]).toMatchObject({ label: '2000s', from: 2000, to: 2005, n: 4 }); expect(d[0].avg).toBeCloseTo(0.125, 12);
  });
  it('measures drawdown depth and the longest time under water', () => {
    const d = drawdown([10, -20, -10, 5, 30, 1]);
    expect(d.depth).toBeCloseTo(1.1 * 0.8 * 0.9 / 1.1 - 1 , 9);
    expect(d.longestMonths).toBe(5);
    expect(drawdown([1, 2, 3])).toEqual({ depth: 0, longestMonths: 0 });
    expect(drawdown([])).toEqual({ depth: 0, longestMonths: 0 });
  });
  it('builds growth of $1 with a start point and carries missing months flat', () => {
    const g = growthPoints([202412, 202501, 202502], [10, null, -10]);
    expect(g.map(p => p[1])).toEqual([1, 1.1, 1.1, 1.1 * 0.9].map(x => expect.closeTo(x, 12)));
    expect(g[0][0]).toBeCloseTo(2024 + 10 / 12, 9); expect(g[1][0]).toBeCloseTo(2024 + 11 / 12, 9); expect(g[2][0]).toBe(2025);
    expect(growthPoints([], [])).toEqual([]);
  });
  it('month helpers', () => { expect(monthX(202407)).toBeCloseTo(2024.5, 9); expect(prevMonth(202501)).toBe(202412); expect(prevMonth(202405)).toBe(202404); });
  it('summarises one factor', () => {
    const ms = Array.from({ length: 24 }, (_, i) => 202001 + (i < 12 ? i : 88 + i));
    const s = factorStats(ms, [...twelve, ...Array(12).fill(-1)]);
    expect(s.annual).toBeCloseTo(0, 1); expect(s.worst!.year).toBe(2021); expect(s.up).toBe(0.5); expect(s.fall!.depth).toBeLessThan(0);
    expect(factorStats([], [])).toMatchObject({ annual: null, vol: null, worst: null, fall: null });
  });
  it('lists the last years with the best factor each year', () => {
    const ms = Array.from({ length: 24 }, (_, i) => 202401 + (i < 12 ? i : 88 + i));
    const mk = (a: number, b: number) => [...Array(12).fill(a), ...Array(12).fill(b)];
    const r = recentYears(ms, { MKT: mk(1, -1), SMB: mk(0, 2), HML: mk(0.5, 0.5), MOM: mk(null as any, null as any) }, 10);
    expect(r.map(x => x.year)).toEqual([2025, 2024]);
    expect(r[0].best).toBe('SMB'); expect(r[1].best).toBe('MKT'); expect(r[0].rets.MOM).toBeNull(); expect(r[0].rets.RMW).toBeNull();
  });
  it('limits recent years', () => {
    const ms = Array.from({ length: 36 }, (_, i) => (2020 + Math.floor(i / 12)) * 100 + (i % 12) + 1);
    expect(recentYears(ms, { MKT: Array(36).fill(1) }, 2).map(x => x.year)).toEqual([2022, 2021]);
  });
  it('prepares calculator inputs: market total return and T-bill rate', () => {
    const c = capmInputs(Array(12).fill(1), Array(12).fill(0.25))!;
    expect(c.rf).toBe(3); expect(c.rm).toBe(Math.round((Math.pow(1.0125, 12) - 1) * 1000) / 10);
    expect(capmInputs([null], [null])).toBeNull(); expect(capmInputs([], [])).toBeNull();
  });
  it('picks the data range', () => {
    expect(rangeStart(759, '10')).toBe(639); expect(rangeStart(759, 'max')).toBe(0); expect(rangeStart(60, '30')).toBe(0); expect(rangeStart(100, 'junk')).toBe(0);
  });
  it('validates URL input', () => {
    expect(parseFactorList('hml, MOM,bogus')).toEqual(['HML', 'MOM']); expect(parseFactorList('<script>')).toHaveLength(6); expect(parseFactorList(null, ['MKT'])).toEqual(['MKT']);
    expect(isFactorKey('SMB')).toBe(true); expect(isFactorKey('RF')).toBe(false); expect(isRange('20')).toBe(true); expect(isRange('5')).toBe(false);
  });
});
