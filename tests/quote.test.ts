import { afterEach, describe, expect, it, vi } from 'vitest';
import { computeStats, monthKey, monthlyReturns, trailingDividends } from '../api/_stats.js';
import handler from '../api/quote.js';

const DAY = 86400, start = Date.UTC(2021, 0, 1) / 1000;
const months = (n: number) => Array.from({ length: n }, (_, i) => start + i * 31 * DAY);
const walk = (n: number, f: (i: number) => number) => { const c = [100]; for (let i = 1; i < n; i++) c.push(c[i - 1] * (1 + f(i))); return c; };
const mkt = (i: number) => 0.01 + 0.04 * Math.sin(i * 1.7);

describe('quote statistics', () => {
  it('turns closes into monthly returns', () => {
    const r = monthlyReturns([start, start + 31 * DAY, start + 62 * DAY], [100, 110, NaN]);
    expect(r).toHaveLength(1); expect(r[0].r).toBeCloseTo(0.1, 9); expect(monthKey(start)).toBe('2021-01');
  });
  it('recovers the beta of a stock built as 1.5 times the market', () => {
    const n = 61, ts = months(n), mc = walk(n, mkt), sc = walk(n, i => 1.5 * mkt(i));
    const m = monthlyReturns(ts, mc), s = monthlyReturns(ts, sc), st = computeStats(s, m);
    expect(st!.months).toBe(60);
    const exact = computeStats(m.map((x: any) => ({ key: x.key, r: 1.5 * x.r })), m);
    expect(exact!.beta).toBeCloseTo(1.5, 9);
    expect(st!.vol).toBeGreaterThan(0);
  });
  it('needs at least a year of shared months', () => {
    const ts = months(8); expect(computeStats(monthlyReturns(ts, walk(8, mkt)), monthlyReturns(ts, walk(8, mkt)))).toBeNull();
  });
  it('adds up only the last twelve months of dividends', () => {
    const now = start + 800 * DAY, ev = { a: { amount: 0.2, date: now - 30 * DAY }, b: { amount: 0.2, date: now - 120 * DAY }, c: { amount: 0.2, date: now - 500 * DAY } };
    expect(trailingDividends(ev, now)).toBeCloseTo(0.4, 9); expect(trailingDividends(undefined, now)).toBe(0);
  });
});

describe('quote endpoint', () => {
  afterEach(() => vi.unstubAllGlobals());
  const call = async (query: any) => { const out: any = { headers: {} }; const res = { statusCode: 0, setHeader: (k: string, v: string) => { out.headers[k] = v; }, end: (b: string) => { out.body = JSON.parse(b); } }; await handler({ query }, res); out.status = res.statusCode; return out; };
  it('rejects a bad symbol without calling out', async () => {
    const f = vi.fn(); vi.stubGlobal('fetch', f);
    const r = await call({ symbol: 'drop table;' }); expect(r.status).toBe(400); expect(f).not.toHaveBeenCalled();
  });
  it('returns price, beta and dividends from the data source', async () => {
    const n = 61, ts = months(n), mc = walk(n, mkt), sc = walk(n, i => 1.2 * mkt(i));
    vi.stubGlobal('fetch', vi.fn(async (url: string) => ({ ok: true, json: async () => ({ chart: { result: [{ meta: { regularMarketPrice: 150, longName: 'Test Co', currency: 'USD' }, timestamp: ts, indicators: { quote: [{ close: url.includes('GSPC') ? mc : sc }] }, events: { dividends: { x: { amount: 1.5, date: Math.floor(Date.now() / 1000) - 10 * DAY } } } }] } }) })));
    const r = await call({ symbol: 'tst' });
    expect(r.status).toBe(200); expect(r.body.symbol).toBe('TST'); expect(r.body.price).toBe(150); expect(r.body.dividend).toBeCloseTo(1.5, 9); expect(r.body.dividendYield).toBeCloseTo(0.01, 9);
    expect(r.body.beta).toBeGreaterThan(0.5); expect(r.body.beta).toBeLessThan(2); expect(r.headers['Cache-Control']).toContain('s-maxage');
  });
  it('reports a clear error when the source fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 404, json: async () => ({}) })));
    const r = await call({ symbol: 'ZZZZ' }); expect(r.status).toBe(502); expect(r.body.error).toMatch(/404|No data/);
  });
});

// @ts-ignore plain JavaScript modules
import { decode, parseFeed, VIDEO_ID } from '../api/_videos.js';
import { relatedFor, splitTitle, watchUrl, embedUrl, thumbUrl } from '../src/ui/videos.js';

const FEED = `<feed><entry><yt:videoId>abcdefghijk</yt:videoId><title>SmartWealth: Time Value of Money &amp; Interest</title><published>2026-10-23T10:00:00+00:00</published><media:group><media:description>Learn PV &amp; FV.
Second line</media:description><media:community><media:statistics views="42"/></media:community></media:group></entry>
<entry><yt:videoId>zzzzzzzzzzz</yt:videoId><title>SAFE MLO Exam Prep: PITI</title><published>2026-11-01T10:00:00+00:00</published></entry>
<entry><yt:videoId>bad id!</yt:videoId><title>Broken</title><published>2026-11-02T10:00:00+00:00</published></entry></feed>`;
describe('video feed', () => {
  it('decodes entities and keeps only valid videos, newest first', () => {
    expect(decode('A &amp; B &quot;x&quot; &#39;y&#39;')).toBe('A & B "x" \'y\'');
    const v = parseFeed(FEED);
    expect(v.map((x: any) => x.id)).toEqual(['zzzzzzzzzzz', 'abcdefghijk']);
    expect(v[1].title).toBe('SmartWealth: Time Value of Money & Interest'); expect(v[1].views).toBe(42); expect(v[1].description).toContain('PV & FV');
    expect(parseFeed('')).toEqual([]); expect(VIDEO_ID.test('abcdefghijk')).toBe(true); expect(VIDEO_ID.test('x')).toBe(false);
  });
  it('splits series from title and links related calculators', () => {
    expect(splitTitle('SAFE MLO Exam Prep: LTV vs. CLTV')).toEqual({ series: 'SAFE MLO Exam Prep', title: 'LTV vs. CLTV' });
    expect(splitTitle('No prefix here').series).toBe('Other');
    expect(relatedFor('Time Value of Money (TVM) Introduction')!.href).toBe('/tvm'); expect(relatedFor('Mastering DCF Valuation')!.href).toBe('/dcf'); expect(relatedFor('Something unrelated')).toBeNull();
  });
  it('builds YouTube links that always play on YouTube', () => {
    expect(watchUrl('abcdefghijk')).toBe('https://www.youtube.com/watch?v=abcdefghijk'); expect(embedUrl('abcdefghijk')).toContain('youtube-nocookie.com/embed/abcdefghijk'); expect(thumbUrl('abcdefghijk')).toContain('i.ytimg.com/vi/abcdefghijk');
  });
});
