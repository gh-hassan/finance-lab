import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseFredCsv, yearOverYear, shiftMonths, valueAt, rangeStart, thin, buildSnapshot, parseTreasury, splitLine, snapshotOf, CURVE_IDS } from '../api/_macro.js';
import handler from '../api/macro.js';
import { call, mockFetch } from './helpers';

afterEach(() => vi.unstubAllGlobals());

const csv = (id: string, rows: string[], eol = '\n') => [`observation_date,${id}`, ...rows].join(eol) + eol;
const thrown = (fn: () => unknown) => { try { fn(); } catch (e: any) { return e; } return null; };

describe('parseFredCsv', () => {
  it('reads normal rows', () => expect(parseFredCsv(csv('DGS10', ['2026-01-02,4.1', '2026-01-05,4.2']), 'DGS10')).toEqual([['2026-01-02', 4.1], ['2026-01-05', 4.2]]));
  it('drops "." and blank values', () => expect(parseFredCsv(csv('DGS10', ['2026-01-01,.', '2026-01-02,4.1', '2026-01-03,']), 'DGS10')).toEqual([['2026-01-02', 4.1]]));
  it('handles CRLF, BOM, blank lines and quotes', () => {
    const t = '﻿"observation_date","DGS10"\r\n\r\n"2026-01-02","4.1"\r\n\r\n2026-01-05,4.2\r\n';
    expect(parseFredCsv(t, 'DGS10')).toHaveLength(2);
  });
  it('skips junk rows and sorts by date', () => {
    const r = parseFredCsv(csv('UNRATE', ['2026-02-01,4.3', 'garbage', 'x,y', '2026-13,5', '2026-01-01,4.0', '2026-03-01,abc', '2026-04-01,1e99']), 'UNRATE');
    expect(r).toEqual([['2026-01-01', 4], ['2026-02-01', 4.3]]);
  });
  it('rejects empty, html, wrong header and all-junk files with a friendly 502', () => {
    for (const t of ['', '   \n', '<!DOCTYPE html><html><body>Error</body></html>', 'observation_date,OTHER\n2026-01-01,1', csv('DGS10', ['x,.', '2026-01-01,.']), null as any, 42 as any]) {
      const e = thrown(() => parseFredCsv(t, 'DGS10'));
      expect(e?.status).toBe(502);
      expect(e?.message).not.toMatch(/<|DOCTYPE/);
    }
  });
  it('splits quoted fields', () => expect(splitLine('a,"b,c","d""e"')).toEqual(['a', 'b,c', 'd"e']));
});

describe('inflation and dates', () => {
  it('computes year over year: 100 to 103 is 3%', () => {
    const pts: [string, number][] = [['2025-01-01', 100], ['2025-02-01', 100], ['2026-01-01', 103], ['2026-02-01', 105]];
    const r = yearOverYear(pts);
    expect(r).toHaveLength(2);
    expect(r[0][0]).toBe('2026-01-01'); expect(r[0][1]).toBeCloseTo(3, 6); expect(r[1][1]).toBeCloseTo(5, 6);
  });
  it('is not thrown off by a missing month', () => {
    const r = yearOverYear([['2024-10-01', 100], ['2024-11-01', 100], ['2025-11-01', 102]]);
    expect(r).toHaveLength(1); expect(r[0][1]).toBeCloseTo(2, 6);
  });
  it('shifts months safely', () => {
    expect(shiftMonths('2026-03-31', -1)).toBe('2026-02-28');
    expect(shiftMonths('2026-01-15', -2)).toBe('2025-11-15');
    expect(shiftMonths('2026-11-05', -12)).toBe('2025-11-05');
    expect(shiftMonths('2026-11-05', 3)).toBe('2027-02-05');
  });
  it('finds the last value on or before a date, within a staleness limit', () => {
    const p: [string, number][] = [['2026-01-02', 1], ['2026-01-09', 2]];
    expect(valueAt(p, '2026-01-09', 5)).toEqual({ date: '2026-01-09', value: 2 });
    expect(valueAt(p, '2026-01-05', 5)).toEqual({ date: '2026-01-02', value: 1 });
    expect(valueAt(p, '2026-02-01', 5)).toBeNull();
    expect(valueAt(p, '2025-12-31', 5)).toBeNull();
    expect(valueAt([], '2026-01-01', 5)).toBeNull();
  });
  it('picks range starts', () => {
    const now = Date.parse('2026-11-08T00:00:00Z');
    expect(rangeStart('1y', now)).toBe('2025-11-08');
    expect(rangeStart('30y', now)).toBe('1996-11-08');
    expect(rangeStart('1y', now, 13)).toBe('2024-10-08');
    expect(rangeStart('max', now)).toBeNull();
  });
  it('thins to a limit and keeps both ends', () => {
    const a = Array.from({ length: 5000 }, (_, i) => [i, i]);
    const t = thin(a, 600);
    expect(t).toHaveLength(600); expect(t[0]).toBe(a[0]); expect(t[599]).toBe(a[4999]);
    expect(thin(a.slice(0, 10), 600)).toHaveLength(10);
  });
});

describe('snapshot assembly', () => {
  const daily = (v: number): [string, number][] => [['2025-11-05', v - 1], ['2026-10-05', v - 0.5], ['2026-11-05', v]];
  it('builds latest, month-ago, year-ago and a three-date curve', () => {
    const maps: any = {}; CURVE_IDS.forEach((id, i) => (maps[id] = daily(4 + i / 10)));
    const s: any = buildSnapshot(maps, Date.parse('2026-11-08T00:00:00Z'));
    expect(s.series.DGS10.latest).toEqual({ date: '2026-11-05', value: 4.8 });
    expect(s.series.DGS10.monthAgo?.value).toBe(4.3);
    expect(s.series.DGS10.yearAgo?.value).toBe(3.8);
    expect(s.series.DFF.latest).toBeNull();
    expect(s.curve!.today.values).toHaveLength(11);
    expect(s.curve!.today.values[8]).toBe(4.8);
    expect(s.curve!.yearAgo.values[0]).toBe(3.0);
  });
  it('returns nulls for an empty series', () => expect(snapshotOf('UNRATE', [])).toMatchObject({ latest: null, monthAgo: null, yearAgo: null }));
  it('has no curve when nothing loaded', () => expect(buildSnapshot({}).curve).toBeNull());
});

describe('treasury parser', () => {
  const row = (d: string, type: string, name: string, v: any) => ({ record_date: d, security_type_desc: type, security_desc: name, avg_interest_rate_amt: v });
  it('keeps the newest month of marketable securities', () => {
    const r = parseTreasury({ data: [row('2026-10-31', 'Marketable', 'Treasury Bills', '4.014'), row('2026-10-31', 'Non-marketable', 'Savings', '3'), row('2026-10-31', 'Marketable', 'Treasury <b>Notes</b>', '3.399'), row('2026-09-30', 'Marketable', 'Treasury Bills', '3.8'), row('2026-10-31', 'Marketable', 'Bad', 'null')] });
    expect(r.recordDate).toBe('2026-10-31');
    expect(r.rows).toEqual([{ name: 'Treasury Bills', rate: 4.014 }, { name: 'Treasury bNotes/b', rate: 3.399 }]);
  });
  it('throws a friendly 502 for junk', () => {
    for (const j of [null, {}, { data: 'x' }, { data: [] }, { data: [row('2026-10-31', 'Marketable', 'X', '')] }]) expect(thrown(() => parseTreasury(j))?.status).toBe(502);
  });
});

const FRED_HOST = 'https://fred.stlouisfed.org/';
const answerAll = (url: string) => {
  const id = new URL(url).searchParams.get('id')!;
  if (id === 'CPIAUCSL') return { text: csv(id, ['2024-09-01,300', '2025-09-01,310', '2026-09-01,319.3']) };
  return { text: csv(id, ['2025-11-05,3.5', '2026-10-05,4.0', '2026-11-05,4.1']) };
};

describe('/api/macro snapshot', () => {
  it('calls only the allowed hosts, in parallel, each with a start date', async () => {
    const { calls } = mockFetch(answerAll);
    const r = await call(handler, { view: 'snapshot' });
    expect(r.status).toBe(200);
    expect(calls.length).toBeGreaterThanOrEqual(12);
    for (const u of calls) { expect(u.startsWith(FRED_HOST)).toBe(true); expect(new URL(u).searchParams.get('cosd')).toMatch(/^\d{4}-\d{2}-\d{2}$/); }
    expect(r.headers['cache-control']).toMatch(/s-maxage=3600/);
    expect(r.body.series.INFLATION.latest.value).toBeCloseTo(3, 4);
    expect(r.body.series.DGS10.latest.value).toBe(4.1);
    expect(r.text.length).toBeLessThan(150_000);
  });
  it('still answers when one series fails, but does not cache it for an hour', async () => {
    mockFetch(u => (u.includes('id=UNRATE') ? { status: 500, text: 'x' } : answerAll(u)));
    const r = await call(handler, { view: 'snapshot' });
    expect(r.status).toBe(200); expect(r.body.series.UNRATE.latest).toBeNull();
    expect(r.headers['cache-control']).toBe('s-maxage=60');
  });
  it('fails with no-store when the key series is missing or everything fails', async () => {
    mockFetch(() => ({ status: 500, text: 'x' }));
    const r = await call(handler, { view: 'snapshot' });
    expect(r.status).toBe(502); expect(r.headers['cache-control']).toBe('no-store');
    mockFetch(u => (u.includes('id=DGS10') ? { text: '<html>oops</html>' } : answerAll(u)));
    expect((await call(handler, { view: 'snapshot' })).status).toBe(502);
  });
});

describe('/api/macro history and treasury', () => {
  it('returns points for a series and range', async () => {
    const { calls } = mockFetch(u => ({ text: csv('DGS10', ['2020-01-01,1', '2024-01-02,2', '2026-01-02,.', '2026-01-05,4']) }));
    const r = await call(handler, { view: 'history', series: 'DGS10', range: '5y' });
    expect(r.status).toBe(200);
    expect(r.body.points).toEqual([['2024-01-02', 2], ['2026-01-05', 4]]);
    expect(r.body).toMatchObject({ series: 'DGS10', unit: 'percent', range: '5y', asOf: '2026-01-05' });
    expect(calls[0]).toMatch(/cosd=/);
  });
  it('defaults the range, returns max without cosd, and downsamples to 600', async () => {
    const rows = Array.from({ length: 3000 }, (_, i) => `${1970 + Math.floor(i / 250)}-${String(1 + Math.floor((i % 250) / 21)).padStart(2, '0')}-${String(1 + (i % 21)).padStart(2, '0')},${i % 7}`);
    const { calls } = mockFetch(() => ({ text: csv('DFF', rows) }));
    const r = await call(handler, { view: 'history', series: 'DFF', range: 'max' });
    expect(r.body.points.length).toBeLessThanOrEqual(600);
    expect(calls[0]).not.toMatch(/cosd/);
    mockFetch(() => ({ text: csv('DFF', ['2026-01-05,4']) }));
    expect((await call(handler, { view: 'history', series: 'DFF' })).body.range).toBe('5y');
  });
  it('builds inflation from the CPI index', async () => {
    const { calls } = mockFetch(() => ({ text: csv('CPIAUCSL', ['2024-09-01,100', '2025-09-01,102', '2026-09-01,105.06']) }));
    const r = await call(handler, { view: 'history', series: 'INFLATION', range: '5y' });
    expect(calls[0]).toMatch(/id=CPIAUCSL/);
    expect(r.body.points.map((p: any) => p[1])).toEqual([2, 3]);
  });
  it('404s when the range has no data', async () => {
    mockFetch(() => ({ text: csv('DGS10', ['1990-01-02,8']) }));
    expect((await call(handler, { view: 'history', series: 'DGS10', range: '1y' })).status).toBe(404);
  });
  it('serves treasury rates from FiscalData only', async () => {
    const { calls } = mockFetch(() => ({ json: { data: [{ record_date: '2026-10-31', security_type_desc: 'Marketable', security_desc: 'Treasury Bills', avg_interest_rate_amt: '4.014' }] } }));
    const r = await call(handler, { view: 'treasury' });
    expect(r.status).toBe(200); expect(r.body.rows[0].rate).toBe(4.014);
    expect(calls[0].startsWith('https://api.fiscaldata.treasury.gov/')).toBe(true);
    expect(r.headers['cache-control']).toMatch(/s-maxage/);
  });
});

describe('/api/macro validation and upstream failures', () => {
  it.each([
    [{}], [{ view: 'nope' }], [{ view: ['snapshot', 'x'] }], [{ view: 'snapshot', extra: '1' }], [{ view: 'history' }], [{ view: 'history', series: 'FOO' }],
    [{ view: 'history', series: 'DGS10', range: '2y' }], [{ view: 'history', series: 'DGS10;rm', range: '1y' }],
    [{ view: 'history', series: 'D'.repeat(500) }], [{ view: 'history', series: '../../etc' }], [{ view: 'history', series: 'DGS10&id=x' }]
  ] as any[])('rejects %j', async (query, expected = 400) => {
    mockFetch(u => answerAll(u));
    const r = await call(handler, query);
    expect(r.status).toBe(expected);
    if (expected === 400) { expect(r.body.error).toBeTruthy(); expect(r.headers['cache-control']).toBe('no-store'); }
  });
  it('refuses arrays and unknown options instead of guessing', async () => {
    mockFetch(u => answerAll(u));
    expect((await call(handler, { view: ['history'], series: ['DGS10'], range: ['1y'] })).status).toBe(400);
  });
  it('maps upstream failures to friendly errors with no-store', async () => {
    const cases: [any, number, string?][] = [[{ status: 404, text: '' }, 404], [{ status: 429, text: '' }, 503], [{ status: 500, text: 'secret <html>' }, 502], [new Error('ECONNRESET'), 502], [{ text: '<!doctype html><p>nope</p>' }, 502]];
    for (const [ans, status] of cases) {
      mockFetch(() => ans);
      const r = await call(handler, { view: 'history', series: 'DGS10', range: '1y' });
      expect(r.status).toBe(status);
      expect(r.headers['cache-control']).toBe(status === 404 ? 's-maxage=60' : 'no-store');
      expect(r.text).not.toMatch(/secret|<html|doctype|ECONNRESET/i);
    }
  });
  it('refuses POST with 405', async () => {
    const r = await call(handler, { view: 'snapshot' }, 'POST');
    expect(r.status).toBe(405); expect(r.headers['allow']).toBe('GET, HEAD');
  });
});
