import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parseMarkets, parseChart, price, thin } from '../api/_crypto.js';
import handler, { resetCache } from '../api/crypto.js';
import { annualisedVolatility, badgeVar, bestWorstDay, BADGE_VARS, isDays, logReturns, maxDrawdown, riskLens, toDaily, toDays, validPoints, volVsStocks, whatIf, isoDate } from '../src/lib/crypto';
import { call, mockFetch } from './helpers';

const D = 864e5, T0 = Date.UTC(2026, 0, 1);
const daily = (...p: number[]) => p.map((v, i) => [T0 + i * D, v] as [number, number]);

describe('log returns, volatility, drawdown', () => {
  it('computes log returns by hand', () => {
    const r = logReturns([100, 110, 99]);
    expect(r[0]).toBeCloseTo(Math.log(1.1), 12); expect(r[1]).toBeCloseTo(Math.log(0.9), 12);
    expect(logReturns([1])).toEqual([]); expect(logReturns([100, NaN, null, undefined, 0, 110] as any)).toHaveLength(1);
  });
  it('is zero for a flat price and null for fewer than 3 points', () => {
    expect(annualisedVolatility(daily(5, 5, 5, 5))).toBe(0);
    expect(annualisedVolatility(daily(5, 6))).toBeNull(); expect(annualisedVolatility([])).toBeNull(); expect(annualisedVolatility(null)).toBeNull();
  });
  it('matches a hand calculation: returns +ln2 and -ln2', () => {
    /* prices 1,2,1: returns ln2, -ln2; mean 0; sample variance = 2*(ln2)^2/1 */
    const expected = Math.sqrt(2 * Math.log(2) ** 2) * Math.sqrt(365);
    expect(annualisedVolatility(daily(1, 2, 1))).toBeCloseTo(expected, 10);
    expect(annualisedVolatility(daily(1, 2, 1), 252)).toBeCloseTo(Math.sqrt(2 * Math.log(2) ** 2) * Math.sqrt(252), 10);
  });
  it('skips NaN, null and non-positive prices', () => {
    const pts: any[] = [[T0, 1], [T0 + D, NaN], [T0 + 2 * D, null], [T0 + 3 * D, 2], [T0 + 4 * D, -5], [T0 + 5 * D, 0], [T0 + 6 * D, 1]];
    expect(annualisedVolatility(pts)).toBeCloseTo(Math.sqrt(2 * Math.log(2) ** 2) * Math.sqrt(365), 10);
    expect(validPoints(pts)).toHaveLength(3); expect(validPoints(undefined)).toEqual([]); expect(validPoints([[1], 'x'] as any)).toEqual([]);
  });
  it('resamples hourly data to one price per day (the last)', () => {
    const hourly: [number, number][] = [[T0 + 1e6, 10], [T0 + 2e6, 11], [T0 + D + 1e6, 20], [T0 + 2 * D + 5, 30], [T0 + 2 * D + 1, 29]];
    expect(toDaily(hourly)).toEqual([[T0 + 2e6, 11], [T0 + D + 1e6, 20], [T0 + 2 * D + 5, 30]]);
    expect(annualisedVolatility(hourly.slice(0, 2))).toBeNull();
  });
  it('finds a 10 percent drawdown in 100, 110, 99', () => {
    const dd = maxDrawdown(daily(100, 110, 99))!;
    expect(dd.depth).toBeCloseTo(0.1, 12); expect(dd.peak).toBe(110); expect(dd.peakAt).toBe(T0 + D); expect(dd.troughAt).toBe(T0 + 2 * D); expect(dd.recovered).toBe(false);
  });
  it('picks the deepest fall and notices a recovery', () => {
    const dd = maxDrawdown(daily(100, 50, 200, 150, 160, 210))!;
    expect(dd.depth).toBeCloseTo(0.5, 12); expect(dd.recovered).toBe(true);
    expect(maxDrawdown(daily(1, 2, 3))!.depth).toBe(0); expect(maxDrawdown(daily(1, 2, 3))!.recovered).toBe(true);
    expect(maxDrawdown(daily(5))).toBeNull(); expect(maxDrawdown(null)).toBeNull();
  });
  it('finds the best and worst day', () => {
    const r = bestWorstDay(daily(100, 110, 99, 120))!;
    expect(r.best.change).toBeCloseTo(120 / 99 - 1, 12); expect(r.best.at).toBe(T0 + 3 * D);
    expect(r.worst.change).toBeCloseTo(-0.1, 12); expect(r.worst.at).toBe(T0 + 2 * D);
    expect(bestWorstDay(daily(1))).toBeNull();
  });
  it('works out what an amount would be worth', () => {
    const w = whatIf(daily(100, 80, 150), 1000)!;
    expect(w.value).toBeCloseTo(1500, 9); expect(w.gain).toBeCloseTo(500, 9); expect(w.change).toBeCloseTo(0.5, 12); expect(w.start).toBe(100); expect(w.end).toBe(150);
    expect(whatIf(daily(100, 50), 1000)!.gain).toBe(-500);
    expect(whatIf(daily(100, 50), NaN)).toBeNull(); expect(whatIf(daily(100, 50), -1)).toBeNull(); expect(whatIf(daily(100), 5)).toBeNull();
    expect(whatIf(daily(100, 50), 0)!.value).toBe(0);
  });
  it('bundles the risk lens', () => {
    const r = riskLens(daily(100, 110, 99))!;
    expect(r.drawdown!.depth).toBeCloseTo(0.1, 12); expect(r.vol).toBeGreaterThan(0); expect(r.days!.worst.change).toBeCloseTo(-0.1, 12);
    expect(riskLens(daily(1, 2))).toBeNull(); expect(riskLens([[1, NaN], [2, NaN], [3, NaN]])).toBeNull();
  });
  it('compares with the stock reference and builds chart helpers', () => {
    expect(volVsStocks(0.35)).toBeCloseTo(2, 10); expect(volVsStocks(null)).toBeNull();
    expect(toDays([[T0 + D / 2, 1], [T0 + 2 * D, 2]], T0)).toEqual([[0.5, 1], [2, 2]]);
    expect(isoDate(T0)).toBe('2026-01-01'); expect(isDays(30)).toBe(true); expect(isDays(31)).toBe(false);
  });
  it('picks the same badge colour for the same symbol', () => {
    expect(badgeVar('BTC')).toBe(badgeVar('BTC'));
    expect(BADGE_VARS).toContain(badgeVar('ETH') as any); expect(BADGE_VARS).toContain(badgeVar('') as any);
    expect(new Set(['BTC', 'ETH', 'SOL', 'XRP', 'ADA', 'DOGE', 'BNB'].map(badgeVar)).size).toBeGreaterThan(2);
  });
});

const coin = (o: any = {}) => ({ id: 'bitcoin', symbol: 'btc', name: 'Bitcoin', image: 'https://x/y.png', current_price: 75703.123, market_cap: 1.5e12, total_volume: 1.1e10, market_cap_rank: 1, price_change_percentage_24h_in_currency: -0.19902, price_change_percentage_7d_in_currency: -2.5182, price_change_percentage_30d_in_currency: -7.2905, price_change_percentage_1y_in_currency: -27.0536, ath: 126080, ath_change_percentage: -39.955, sparkline_in_7d: { price: Array.from({ length: 168 }, (_, i) => 70000 + i) }, ...o });

describe('reading CoinGecko', () => {
  it('trims a coin to the fields the page uses', () => {
    const [c] = parseMarkets([coin()]) as any[];
    expect(c).toMatchObject({ id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin', rank: 1, price: 75703.12, ch24: -0.2, ch7d: -2.52, ch30d: -7.29, ch1y: -27.05, ath: 126080, athChange: -40 });
    expect(c.spark).toHaveLength(42); expect(c.spark[0]).toBe(70000); expect(c.spark[41]).toBe(70167);
    expect(JSON.stringify(c)).not.toMatch(/https/);
  });
  it('keeps missing values as null and tiny prices readable', () => {
    const [c] = parseMarkets([coin({ current_price: 0.00001234567, market_cap: null, total_volume: NaN, price_change_percentage_1y_in_currency: null, ath: undefined, sparkline_in_7d: null, market_cap_rank: null })]) as any[];
    expect(c.price).toBe(0.0000123457); expect(c.cap).toBeNull(); expect(c.volume).toBeNull(); expect(c.ch1y).toBeNull(); expect(c.ath).toBeNull(); expect(c.spark).toEqual([]); expect(c.rank).toBeNull();
    expect(price(0)).toBe(0); expect(price(-1)).toBeNull(); expect(price(NaN)).toBeNull();
  });
  it('drops entries that are not coins, caps at 20 and refuses junk', () => {
    expect(parseMarkets([null, 5, coin({ id: 'Bad Id' }), coin({ name: '' }), coin()])).toHaveLength(1);
    expect(parseMarkets(Array.from({ length: 30 }, () => coin()))).toHaveLength(20);
    for (const bad of [null, 'html', {}, [], [null], { status: { error_code: 500 } }]) expect(() => parseMarkets(bad as any)).toThrow(/could not read/);
    expect(() => parseMarkets({ status: { error_code: 429 } } as any)).toThrow(/busy/);
  });
  it('reads a chart, sorting and skipping bad rows', () => {
    expect(parseChart({ prices: [[3000, 3], [1000, 1], [2000, NaN], [4000, null], 'x', [5000, -1], [NaN, 2], [2500, 2.5]] })).toEqual([[1000, 1], [2500, 2.5], [3000, 3]]);
    expect(() => parseChart({ prices: [[1000, 1]] })).toThrow(/no price history/);
    for (const bad of [null, [], {}, { prices: 'x' }]) expect(() => parseChart(bad as any)).toThrow(/could not read/);
    expect(() => parseChart({ status: { error_code: 429 } })).toThrow(/busy/);
  });
  it('thins to 400 points keeping both ends', () => {
    const pts = Array.from({ length: 2200 }, (_, i) => [i * 1000 + 1, i + 1]);
    const out = parseChart({ prices: pts });
    expect(out).toHaveLength(400); expect(out[0][0]).toBe(1); expect(out[399][0]).toBe(2199 * 1000 + 1);
    expect(thin([1, 2, 3], 400)).toHaveLength(3);
  });
});

describe('/api/crypto', () => {
  beforeEach(() => resetCache());
  afterEach(() => vi.unstubAllGlobals());
  const prices = Array.from({ length: 50 }, (_, i) => [1.7e12 + i * 3.6e6, 100 + i]);
  const answer = (url: string): any => (url.includes('/market_chart') ? { json: { prices } } : { json: [coin(), coin({ id: 'ethereum', symbol: 'eth', name: 'Ethereum', market_cap_rank: 2 })] });

  it('returns the markets with caching headers and only the allowed host', async () => {
    const f = mockFetch(answer);
    const r = await call(handler, { view: 'markets' });
    expect(r.status).toBe(200); expect(r.body.coins).toHaveLength(2); expect(r.body.stale).toBe(false); expect(r.body.source).toBe('CoinGecko');
    expect(r.headers['cache-control']).toBe('s-maxage=300, stale-while-revalidate=3600');
    expect(f.calls).toHaveLength(1); expect(f.calls[0]).toMatch(/^https:\/\/api\.coingecko\.com\/api\/v3\/coins\/markets\?/);
    expect((await call(handler, {})).status).toBe(200);
  });
  it('returns a chart', async () => {
    const f = mockFetch(answer);
    const r = await call(handler, { view: 'chart', id: 'bitcoin', days: '30' });
    expect(r.status).toBe(200); expect(r.body).toMatchObject({ id: 'bitcoin', days: 30 }); expect(r.body.points).toHaveLength(50);
    expect(r.headers['cache-control']).toBe('s-maxage=900, stale-while-revalidate=86400');
    expect(f.calls[0]).toBe('https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=30');
    expect((await call(handler, { view: 'chart', id: 'bitcoin' })).body.days).toBe(30);
  });
  it.each([
    [{ view: 'chart' }], [{ view: 'chart', id: 'Bitcoin' }], [{ view: 'chart', id: 'bit coin' }], [{ view: 'chart', id: '../etc' }], [{ view: 'chart', id: 'a'.repeat(51) }],
    [{ view: 'chart', id: 'bitcoin', days: '31' }], [{ view: 'chart', id: 'bitcoin', days: 'max' }], [{ view: 'chart', id: 'bitcoin&x=1' }], [{ view: 'chart', id: 'bitcoin?x' }],
    [{ view: 'chart', id: ['bitcoin;', 'x'] }], [{ view: 'nope' }], [{ view: 'chart', id: 'bit\ncoin' }]
  ])('answers 400 for %j without calling out', async q => {
    const f = mockFetch(answer);
    const r = await call(handler, q as any);
    expect(r.status).toBe(400); expect(r.headers['cache-control']).toBe('no-store'); expect(f.calls).toHaveLength(0);
  });
  it('refuses a repeated id and unknown options', async () => {
    const f = mockFetch(answer);
    expect((await call(handler, { view: 'chart', id: ['ethereum', 'x!'], days: '7' })).status).toBe(400);
    expect((await call(handler, { view: 'markets', x: '1' })).status).toBe(400);
    expect(f.calls).toHaveLength(0);
  });
  it('maps upstream failures to friendly errors', async () => {
    const cases: [any, number, string?][] = [[{ status: 404 }, 404, 'could not find'], [{ status: 429 }, 503, 'busy'], [{ status: 500 }, 502], [new Error('boom'), 502], [{ json: { prices: 'x' } }, 502], [{ text: '<html>x</html>', json: undefined }, 502]];
    for (const [bad, status, word] of cases) {
      resetCache();
      mockFetch(() => bad);
      const r = await call(handler, { view: 'chart', id: 'bitcoin', days: '7' });
      expect(r.status).toBe(status); expect(r.headers['cache-control']).toBe(status === 404 ? 's-maxage=60' : 'no-store');
      if (word) expect(r.body.error).toMatch(word);
      expect(r.text).not.toMatch(/html|boom/);
      resetCache();
      const m = await call(handler, { view: 'markets' });
      expect([404, 502, 503]).toContain(m.status);
    }
  });
  it('reuses the last good markets answer, marked stale, when the source is busy', async () => {
    mockFetch(answer);
    await call(handler, { view: 'markets' });
    mockFetch(() => ({ status: 429 }));
    const r = await call(handler, { view: 'markets' });
    expect(r.status).toBe(200); expect(r.body.stale).toBe(true); expect(r.body.coins).toHaveLength(2);
    expect(r.headers['cache-control']).toBe('s-maxage=60, stale-while-revalidate=600');
  });
  it('does not reuse an old answer after an hour, or for a 404', async () => {
    mockFetch(answer);
    await call(handler, { view: 'chart', id: 'bitcoin', days: '7' });
    mockFetch(() => ({ status: 404 }));
    expect((await call(handler, { view: 'chart', id: 'bitcoin', days: '7' })).status).toBe(404);
    const now = Date.now();
    const spy = vi.spyOn(Date, 'now').mockReturnValue(now + 2 * 3600e3);
    mockFetch(() => ({ status: 500 }));
    expect((await call(handler, { view: 'chart', id: 'bitcoin', days: '7' })).status).toBe(502);
    spy.mockRestore();
  });
  it('keeps the stale copy list small', async () => {
    mockFetch(answer);
    for (let i = 0; i < 65; i++) await call(handler, { view: 'chart', id: 'coin-' + i, days: '7' });
    mockFetch(() => ({ status: 500 }));
    expect((await call(handler, { view: 'chart', id: 'coin-0', days: '7' })).status).toBe(502);
    expect((await call(handler, { view: 'chart', id: 'coin-64', days: '7' })).status).toBe(200);
  });
  it('refuses POST', async () => {
    mockFetch(answer);
    const r = await call(handler, {}, 'POST');
    expect(r.status).toBe(405); expect(r.headers['cache-control']).toBe('no-store');
  });
});

describe('price text', () => {
  it('formats coin prices for tables', async () => {
    const { fmtUsd, fmtUsdExact } = await import('../src/lib/crypto');
    expect(fmtUsd(75703.4)).toBe('$75,703'); expect(fmtUsd(2.349)).toBe('$2.35'); expect(fmtUsd(0.5)).toBe('$0.5000'); expect(fmtUsd(0.00001234)).toBe('$0.00001234');
    expect(fmtUsd(0)).toBe('$0'); expect(fmtUsd(-1)).toBe('—'); expect(fmtUsd(NaN)).toBe('—'); expect(fmtUsd(null)).toBe('—'); expect(fmtUsd(1e-20)).toMatch(/^\$0\.0+/);
    expect(fmtUsdExact(1120.336)).toBe('$1,120.34'); expect(fmtUsdExact(-50)).toBe('−$50.00'); expect(fmtUsdExact(-0.001)).toBe('$0.00'); expect(fmtUsdExact(Infinity)).toBe('—'); expect(fmtUsdExact(undefined)).toBe('—');
  });
});
