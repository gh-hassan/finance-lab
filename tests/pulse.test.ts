import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseSpark, buildUs, buildPk, chunk, thin, US, PK, MARKETS, parseScreener } from '../api/_pulse.js';
import handler, { resetCache } from '../api/pulse.js';
import { appetite, riskMood, sectorsByChange, movers, usStory, pkSectors, pkBreadth, pkMovers, pkStory, heat, isOpen, type UsItem, type PkItem } from '../src/lib/pulse';
import { call, mockFetch } from './helpers';

const spark = (closes: (number | null)[], prev: number | null = closes[0] as number) => ({ timestamp: closes.map((_, i) => 1000 + i * 300), close: closes, previousClose: prev, chartPreviousClose: prev });
const it_ = (symbol: string, group: UsItem['group'], chg: number, price = 100, name = symbol): UsItem => ({ symbol, name, group, price, prev: price / (1 + chg), chg, abs: price - price / (1 + chg), spark: [1, 2] });

describe('parsing Yahoo batch answers', () => {
  it('keeps good prices and drops bad ones', () => {
    const p: any = parseSpark({ A: spark([10, null, 12, NaN as any, 14], 9), B: spark([5]), C: { close: 'x' }, D: null });
    expect(Object.keys(p)).toEqual(['A']); expect(p.A.closes).toEqual([10, 12, 14]); expect(p.A.prev).toBe(9);
  });
  it('refuses answers that are not objects', () => { for (const bad of [null, 5, 'x', []]) expect(() => parseSpark(bad as any)).toThrow(); });
  it('splits lists into groups of at most 20 and thins long lines', () => {
    expect(chunk(Array.from({ length: 45 }, (_, i) => i)).map(g => g.length)).toEqual([20, 20, 5]); expect(thin(Array.from({ length: 200 }, (_, i) => i), 10)).toHaveLength(10);
  });
  it('builds US rows with the change against yesterday and uses the S&P clock, not Bitcoin\'s', () => {
    const parsed = parseSpark({ '^GSPC': spark([100, 101, 102], 100), 'BTC-USD': { ...spark([1, 2, 3], 1), timestamp: [5000, 6000, 7000] } });
    const b = buildUs(parsed, US.filter((r: any) => ['^GSPC', 'BTC-USD'].includes(r.symbol)));
    expect(b.items.find(i => i.symbol === '^GSPC')).toMatchObject({ price: 102, prev: 100, chg: 0.02 }); expect(b.lastBar).toBe(1000 + 2 * 300);
  });
  it('builds Pakistan rows over 1 day, 5 days and the month', () => {
    const closes = Array.from({ length: 24 }, (_, i) => 100 + i), parsed = parseSpark({ 'OGDC.KA': spark(closes, 99) });
    const b = buildPk(parsed, PK.filter((r: any) => r.symbol === 'OGDC')); const r = b.items[0];
    expect(r.c1).toBeCloseTo(123 / 122 - 1, 5); expect(r.c5).toBeCloseTo(123 / 118 - 1, 5); expect(r.c20).toBeCloseTo(123 / 99 - 1, 5);
  });
  it('has no duplicate symbols and every Pakistani stock has a sector', () => {
    for (const m of Object.values(MARKETS)) { const s = m.symbols.map((x: any) => x.symbol); expect(new Set(s).size).toBe(s.length); }
    expect(PK.every((x: any) => x.group && x.yahoo.endsWith('.KA'))).toBe(true); expect(US.filter((x: any) => x.group === 'sector')).toHaveLength(11);
  });
});

describe('risk mood', () => {
  const calm = [it_('^GSPC', 'index', 0.012), it_('^VIX', 'gauge', -0.09, 18), it_('^TNX', 'gauge', 0.001, 4.2), ...['XLK', 'XLY', 'XLF', 'XLI', 'XLC'].map(s => it_(s, 'sector', 0.015)), ...['XLP', 'XLU', 'XLV', 'XLRE'].map(s => it_(s, 'sector', 0.002))];
  const scared = [it_('^GSPC', 'index', -0.02), it_('^VIX', 'gauge', 0.15, 32), it_('^TNX', 'gauge', -0.001, 4.2), ...['XLK', 'XLY', 'XLF', 'XLI', 'XLC'].map(s => it_(s, 'sector', -0.03)), ...['XLP', 'XLU', 'XLV', 'XLRE'].map(s => it_(s, 'sector', -0.004))];
  it('reads a calm rally as bold and a sell-off as cautious', () => {
    expect(riskMood(calm).label).toBe('Bold'); expect(riskMood(scared).label).toBe('Cautious'); expect(riskMood(calm).score).toBeGreaterThan(0.25); expect(riskMood(scared).score).toBeLessThan(-0.25);
  });
  it('says mixed when the clues disagree, and copes with missing data', () => {
    expect(riskMood([it_('^GSPC', 'index', 0.003), it_('^VIX', 'gauge', 0.02, 20)]).label).toBe('Undecided'); expect(riskMood([]).label).toBe('Undecided'); expect(riskMood([]).reasons).toEqual([]);
  });
  it('measures cyclical against defensive', () => { const a = appetite(calm); expect(a.spread).toBeCloseTo(0.013, 6); expect(appetite([]).spread).toBeNull(); });
  it('lists reasons strongest first', () => { const r = riskMood(scared).reasons; expect(Math.abs(r[0].score)).toBeGreaterThanOrEqual(Math.abs(r[r.length - 1].score)); });
});

describe('US story', () => {
  const items = [it_('^GSPC', 'index', 0.0031, 7376, 'S&P 500'), it_('^IXIC', 'index', 0.005, 20000, 'Nasdaq'), it_('^VIX', 'gauge', -0.09, 25.6), it_('^TNX', 'gauge', 0.0, 4.86), { ...it_('^TNX', 'gauge', 0, 4.86), abs: 0.022 }, it_('USO', 'gauge', 0.02, 80), it_('GLD', 'gauge', -0.01, 2000),
    ...[['XLK', 'Technology', 0.012], ['XLE', 'Energy', 0.004], ['XLU', 'Utilities', -0.006], ['XLV', 'Health care', -0.002]].map(([s, n, c]) => it_(s as string, 'sector', c as number, 100, n as string)), it_('NVDA', 'stock', 0.03, 100, 'Nvidia'), it_('TSLA', 'stock', -0.04, 100, 'Tesla')];
  it('writes a headline and clear bullets', () => {
    const s = usStory(items, true); expect(s.headline).toMatch(/higher right now.*500 biggest US companies.*\+0\.31%/); const t = s.bullets.join(' ');
    expect(t).toContain('2 of 4 parts of the economy'); expect(t).toContain('Technology is doing best'); expect(t).toContain('Utilities worst'); expect(t).toMatch(/fear gauge/); expect(t).toMatch(/Oil prices are up/); expect(t).toMatch(/Nvidia.*Tesla/); expect(s.takeaway).toMatch(/^In short:/);
    expect(usStory(items, false).headline).toContain('at the last close'); expect(JSON.stringify(usStory(items, true))).not.toMatch(/basis point|risk-on|risk-off/i);
  });
  it('never prints NaN or undefined and handles empty data', () => { expect(usStory([], true).headline).toMatch(/Not enough/); expect(JSON.stringify(usStory(items, true))).not.toMatch(/NaN|undefined/); });
  it('ranks sectors and movers', () => { expect(sectorsByChange(items)[0].symbol).toBe('XLK'); const m = movers(items, 1); expect(m.up[0].symbol).toBe('NVDA'); expect(m.down[0].symbol).toBe('TSLA'); });
});

describe('Pakistan', () => {
  const pk = (symbol: string, group: string, c1: number, c5 = c1, c20 = c1): PkItem => ({ symbol, name: symbol, group, price: 10, c1, c5, c20, spark: [1, 2] });
  const items = [pk('A', 'Banks', 0.02), pk('B', 'Banks', 0.01), pk('C', 'Banks', 0.03), pk('D', 'Cement', -0.02), pk('E', 'Cement', -0.01), pk('F', 'Cement', -0.03), pk('G', 'Energy', 0.0), pk('H', 'Energy', 0.04), pk('I', 'Energy', 0.01)];
  it('averages sectors, counts breadth and finds movers', () => {
    expect(pkSectors(items, 'c1')[0]).toMatchObject({ sector: 'Banks', count: 3, up: 3 }); expect(pkSectors(items, 'c1')[1]).toMatchObject({ sector: 'Energy', up: 2 }); expect(pkSectors(items, 'c1').at(-1)!.sector).toBe('Cement');
    expect(pkBreadth(items, 'c1')).toMatchObject({ up: 5, down: 3, flat: 1 }); expect(pkBreadth([], 'c1').avg).toBeNull();
    expect(pkMovers(items, 'c1', 1).up[0].symbol).toBe('H'); expect(pkMovers(items, 'c1', 1).down[0].symbol).toBe('F');
  });
  it('tells the story for a chosen period', () => {
    const s = pkStory(items, 'c5'); expect(s.headline).toMatch(/last week/); expect(s.bullets.join(' ')).toMatch(/5 stocks rose and 3 fell, 1 unchanged/); expect(s.takeaway).toMatch(/^In short:/); expect(pkStory([], 'c1').headline).toMatch(/Not enough/);
  });
});

describe('small helpers', () => {
  it('scales heat and knows when a market is open', () => { expect(heat(0.01, 0.02)).toBe(0.5); expect(heat(-0.5, 0.02)).toBe(1); expect(heat(NaN, 0.02)).toBe(0); expect(isOpen(1000, 1000 * 1000 + 60e3)).toBe(true); expect(isOpen(1000, 1000 * 1000 + 3600e3)).toBe(false); expect(isOpen(null)).toBe(false); });
});


describe('screener filtering', () => {
  const q = (symbol: string, o: any = {}) => ({ symbol, quoteType: 'EQUITY', exchange: 'NYQ', shortName: 'N ' + symbol, regularMarketPrice: 20, regularMarketChangePercent: 5, regularMarketVolume: 2e6, marketCap: 3e9, ...o });
  const wrap = (quotes: any[]) => ({ finance: { result: [{ quotes }] } });
  it('keeps only big, busy, real US shares and turns percents into fractions', () => {
    const r = parseScreener(wrap([q('OK'), q('SMALL', { marketCap: 1e9 }), q('QUIET', { regularMarketVolume: 10 }), q('PENNY', { regularMarketPrice: 1 }), q('ETF', { quoteType: 'ETF' }), q('FOREIGN', { exchange: 'LSE' }), q('lower'), q('TOOLONGSYMBOL'), null, q('NANCHG', { regularMarketChangePercent: undefined })]));
    expect(r.map((x: any) => x.symbol)).toEqual(['OK']); expect(r[0]).toMatchObject({ chg: 0.05, price: 20, volume: 2000000, cap: 3000000000 });
  });
  it('stops at the limit and refuses unreadable answers', () => {
    expect(parseScreener(wrap(Array.from({ length: 30 }, (_, i) => q('S' + String.fromCharCode(65 + (i % 26)) + (i > 25 ? 'A' : '')))), { limit: 5 })).toHaveLength(5);
    for (const bad of [null, {}, { finance: {} }, { finance: { result: [] } }, { finance: { result: [{}] } }]) expect(() => parseScreener(bad as any)).toThrow();
  });
});
describe('/api/pulse', () => {
  afterEach(() => { vi.unstubAllGlobals(); resetCache(); });
  const quote = (symbol: string, o: any = {}) => ({ symbol, quoteType: 'EQUITY', exchange: 'NMS', shortName: symbol + ' Inc', regularMarketPrice: 50, regularMarketChangePercent: 12.5, regularMarketVolume: 5e6, marketCap: 8e9, ...o });
  const screen = { finance: { result: [{ quotes: [quote('AAA'), quote('BBB', { marketCap: 5e8 }), quote('CCC', { regularMarketVolume: 1000 }), quote('DDD', { regularMarketPrice: 2 }), quote('EEE', { exchange: 'PNK' }), quote('FFF', { quoteType: 'ETF' }), quote('GGG', { regularMarketChangePercent: NaN }), quote('HHH')] }] } };
  const answerFor = (url: string) => {
    if (url.includes('/screener/')) return { json: screen };
    const syms = decodeURIComponent(/symbols=([^&]*)/.exec(url)![1]).split(',');
    return { json: Object.fromEntries(syms.map(s => [s, { symbol: s, ...spark(Array.from({ length: 24 }, (_, i) => 100 + i), 100) }])) };
  };
  it('serves the US market in a few batch calls with a short cache', async () => {
    const m = mockFetch(answerFor); const r = await call(handler, { market: 'us' });
    expect(r.status).toBe(200); expect(r.body.count).toBe(US.length); expect(m.calls.filter(u => u.includes('/spark?'))).toHaveLength(3); expect(m.calls.filter(u => u.includes('/screener/'))).toHaveLength(3); expect(m.calls.every(u => u.startsWith('https://query1.finance.yahoo.com/'))).toBe(true);
    expect(r.headers['cache-control']).toBe('s-maxage=30, stale-while-revalidate=120'); expect(r.body.items[0]).toHaveProperty('spark');
  });
  it('serves Pakistan with the Karachi suffix and a long cache', async () => {
    const m = mockFetch(answerFor); const r = await call(handler, { market: 'pakistan' });
    expect(r.status).toBe(200); expect(r.body.count).toBe(PK.length); expect(m.calls.every(u => /\.KA/.test(u) && u.includes('range=1mo&interval=1d'))).toBe(true); expect(r.headers['cache-control']).toBe('s-maxage=600, stale-while-revalidate=3600');
  });
  it('shares one fetch between simultaneous requests and remembers the answer', async () => {
    const m = mockFetch(answerFor); await Promise.all([call(handler, { market: 'us' }), call(handler, { market: 'us' })]); await call(handler, { market: 'us' }); expect(m.calls).toHaveLength(6);
  });
  it('adds the whole-market movers, and leaves them out if those lists fail', async () => {
    mockFetch(answerFor); const r = await call(handler, { market: 'us' });
    expect(Object.keys(r.body.wide).sort()).toEqual(['active', 'gainers', 'losers']); expect(r.body.wide.gainers.map((x: any) => x.symbol)).toEqual(['AAA', 'HHH']);
    resetCache(); mockFetch(url => (url.includes('/screener/') ? { status: 500, json: {} } : answerFor(url))); const r2 = await call(handler, { market: 'us' });
    expect(r2.status).toBe(200); expect(r2.body.wide).toBeUndefined(); expect(r2.body.count).toBe(US.length);
  });
  it('does not fetch the whole-market lists for Pakistan', async () => { const m = mockFetch(answerFor); await call(handler, { market: 'pakistan' }); expect(m.calls.some(u => u.includes('/screener/'))).toBe(false); });
  it('still answers when one batch fails, and fails kindly when most do', async () => {
    let n = 0; mockFetch(url => (url.includes('/spark?') && ++n === 2 ? { status: 500, json: {} } : answerFor(url))); const ok = await call(handler, { market: 'us' }); expect(ok.status).toBe(200); expect(ok.body.count).toBeLessThan(ok.body.requested);
    resetCache(); mockFetch(() => ({ status: 500, json: {} })); const bad = await call(handler, { market: 'us' }); expect(bad.status).toBe(502); expect(bad.headers['cache-control']).toBe('no-store');
  });
  it('rejects bad input before calling anyone', async () => {
    const m = mockFetch(answerFor);
    for (const q of [{}, { market: 'mars' }, { market: ['us', 'pakistan'] }, { market: 'us', x: '1' }, { market: 'US' }]) expect((await call(handler, q as any)).status, JSON.stringify(q)).toBe(400);
    expect(m.calls).toHaveLength(0);
  });
  it('only answers GET', async () => { mockFetch(answerFor); expect((await call(handler, { market: 'us' }, 'POST')).status).toBe(405); });
});
