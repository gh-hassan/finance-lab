import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseFacts, findCompanies } from '../api/_edgar.js';
import handler, { resetCache } from '../api/edgar.js';
import { call, mockFetch } from './helpers';

const fx = (n: string) => JSON.parse(readFileSync(new URL(`./fixtures/edgar-${n}.json`, import.meta.url), 'utf8'));
const fact = (rows: any[], unit = 'USD') => ({ units: { [unit]: rows } });
const yr = (end: string, val: number, filed = end.slice(0, 4) + '-12-31', extra: any = {}) => ({ start: String(+end.slice(0, 4) - 1) + end.slice(4), end, val, form: '10-K', filed, ...extra });
const inst = (end: string, val: number, filed = end) => ({ end, val, form: '10-K', filed });
const co = (gaap: any, name = 'Test Co') => ({ cik: 1, entityName: name, facts: { 'us-gaap': gaap } });

describe('SEC annual statements, real filings', () => {
  it('reads Apple: tag changes, restated years and the latest numbers', () => {
    const r = parseFacts(fx('aapl'))!;
    expect(r.periods).toHaveLength(10);
    expect(r.periods.map((p: any) => p.end)).toEqual([...r.periods.map((p: any) => p.end)].sort());
    const last = r.periods.length - 1;
    expect(r.rows.revenue[last]).toBe(478834000000);
    expect(r.rows.netIncome[last]).toBe(132175000000);
    expect(r.rows.assets[last]).toBe(404548000000);
    expect(r.rows.debt[last]).toBe(78114000000);
    expect(r.kind).toBe('standard'); expect(r.currency).toBe('USD');
    expect(r.rows.revenue.every((v: any) => v != null && v > 0)).toBe(true);
  });
  it('hides share counts that stock splits made unreliable, but keeps the recent ones', () => {
    const r = parseFacts(fx('aapl'))!;
    expect(r.rows.shares[0]).toBeNull();
    expect(r.rows.shares[r.rows.shares.length - 1]).toBeGreaterThan(1e10);
    expect(r.notes.join(' ')).toMatch(/stock splits/);
  });
  it('rebuilds liabilities and equity when a company tags them differently (ITW)', () => {
    const r = parseFacts(fx('itw'))!, i = r.periods.length - 1;
    expect(r.rows.equity[i]).toBe(3226000000);
    expect(r.rows.liabilities[i]).toBe(r.rows.assets[i] - 3226000000);
    expect(r.rows.grossProfit[i]).toBeGreaterThan(0);
  });
  it('recognises a bank and does not invent margins for it', () => {
    const r = parseFacts(fx('jpm'))!;
    expect(r.kind).toBe('financial');
    expect(r.rows.grossProfit.every((v: any) => v == null)).toBe(true);
    expect(r.rows.assets[r.rows.assets.length - 1]).toBeGreaterThan(4e12);
  });
  it('treats a company with a finance arm but normal gross profit and operating income as ordinary (GM)', () => {
    const base = { Revenues: fact([yr('2024-12-31', 100)]), LoansAndLeasesReceivableNetReportedAmount: fact([inst('2024-12-31', 50)]) };
    expect(parseFacts(co(base))!.kind).toBe('financial');
    expect(parseFacts(co({ ...base, GrossProfit: fact([yr('2024-12-31', 20)]), OperatingIncomeLoss: fact([yr('2024-12-31', 10)]) }))!.kind).toBe('standard');
  });
  it('drops a debt figure that cannot be right instead of showing it (Ford)', () => {
    const r = parseFacts(fx('f'))!;
    expect(r.rows.debt.slice(2).every((v: any) => v == null)).toBe(true);
    expect(r.notes.join(' ')).toMatch(/sanity/);
  });
});

describe('SEC annual statements, awkward data', () => {
  it('ignores quarterly figures that appear inside a 10-K', () => {
    const r = parseFacts(co({ Revenues: fact([{ start: '2024-10-01', end: '2024-12-31', val: 999, form: '10-K', filed: '2025-02-01' }, yr('2024-12-31', 400)]) }))!;
    expect(r.rows.revenue).toEqual([400]);
  });
  it('ignores 10-Q and other non-annual forms', () => {
    const r = parseFacts(co({ Revenues: fact([{ ...yr('2024-12-31', 5), form: '10-Q' }, yr('2023-12-31', 7)]) }))!;
    expect(r.rows.revenue).toEqual([7]);
  });
  it('uses the most recently filed value when a year was restated', () => {
    const r = parseFacts(co({ Revenues: fact([yr('2023-12-31', 100, '2024-02-01'), yr('2023-12-31', 90, '2025-02-01'), yr('2024-12-31', 120, '2025-02-01')]) }))!;
    expect(r.rows.revenue).toEqual([90, 120]);
  });
  it('accepts 52 and 53 week years and rejects odd durations', () => {
    const wk = (start: string, end: string, val: number) => ({ start, end, val, form: '10-K', filed: end });
    const r = parseFacts(co({ Revenues: fact([wk('2022-01-03', '2023-01-01', 1), wk('2023-01-02', '2024-01-07', 2), wk('2024-01-08', '2025-02-20', 99)]) }))!;
    expect(r.rows.revenue).toEqual([1, 2]);
  });
  it('fills a year from the next tag when the first tag stopped being used', () => {
    const r = parseFacts(co({ Revenues: fact([yr('2022-12-31', 10)]), RevenueFromContractWithCustomerExcludingAssessedTax: fact([yr('2022-12-31', 11), yr('2023-12-31', 12)]) }))!;
    expect(r.rows.revenue).toEqual([10, 12]);
  });
  it('collapses two year ends less than a year apart (a changed fiscal year)', () => {
    const r = parseFacts(co({ Assets: fact([inst('2022-06-30', 5), inst('2022-12-31', 6), inst('2023-12-31', 7)]) }))!;
    expect(r.rows.assets).toEqual([6, 7]);
  });
  it('makes capex and interest positive whatever the sign convention', () => {
    const r = parseFacts(co({ Revenues: fact([yr('2024-12-31', 1)]), PaymentsToAcquirePropertyPlantAndEquipment: fact([yr('2024-12-31', -50)]), InterestExpense: fact([yr('2024-12-31', -3)]) }))!;
    expect(r.rows.capex).toEqual([50]); expect(r.rows.interestExpense).toEqual([3]);
  });
  it('rebuilds gross profit from revenue and cost only when both exist', () => {
    const a = parseFacts(co({ Revenues: fact([yr('2024-12-31', 100)]), CostOfRevenue: fact([yr('2024-12-31', 60)]) }))!;
    const b = parseFacts(co({ Revenues: fact([yr('2024-12-31', 100)]) }))!;
    expect(a.rows.grossProfit).toEqual([40]); expect(b.rows.grossProfit).toEqual([null]);
  });
  it('returns null instead of crashing on empty or malformed input', () => {
    for (const bad of [null, undefined, {}, [], 'x', 5, { facts: {} }, { facts: { 'us-gaap': null } }, { facts: { 'us-gaap': {} } }, co({ Revenues: {} }), co({ Revenues: { units: { USD: 'nope' } } }), co({ Revenues: fact([{ start: '2023-01-01', end: '2023-12-31', val: 'abc', form: '10-K' }]) }), co({ Revenues: fact([null, undefined, 5] as any) })])
      expect(() => parseFacts(bad as any)).not.toThrow();
    expect(parseFacts(null as any)).toBeNull(); expect(parseFacts({ facts: { 'us-gaap': {} } } as any)).toBeNull();
  });
  it('keeps at most the requested number of years', () => {
    const rows = Array.from({ length: 15 }, (_, i) => yr(`${2010 + i}-12-31`, i + 1));
    expect(parseFacts(co({ Revenues: fact(rows) }), { years: 5 })!.periods).toHaveLength(5);
    expect(parseFacts(co({ Revenues: fact(rows) }))!.rows.revenue).toHaveLength(10);
  });
});

describe('company search', () => {
  const list = { 0: { cik_str: 1, ticker: 'AAPL', title: 'Apple Inc.' }, 1: { cik_str: 2, ticker: 'APLE', title: 'Apple Hospitality REIT' }, 2: { cik_str: 3, ticker: 'MSFT', title: 'MICROSOFT CORP' }, 3: { cik_str: 4, ticker: 'GOOGL', title: 'Alphabet Inc.' }, 4: { cik_str: 4, ticker: 'GOOG', title: 'Alphabet Inc.' }, 5: { cik_str: 9, ticker: 'PINE', title: 'Pineapple Co' } };
  it('puts the exact ticker first, then ticker prefixes, then names', () => {
    expect(findCompanies(list, 'aapl').map(c => c.ticker)[0]).toBe('AAPL');
    expect(findCompanies(list, 'ap').map(c => c.ticker)).toEqual(['APLE', 'AAPL', 'PINE']);
    expect(findCompanies(list, 'apple').map(c => c.ticker)).toContain('PINE');
  });
  it('lists every share class so the right one can be picked, and respects the limit', () => {
    expect(findCompanies(list, 'alphabet').map(c => c.ticker).sort()).toEqual(['GOOG', 'GOOGL']);
    expect(findCompanies(list, 'a', 2)).toHaveLength(2);
  });
  it('handles empty, odd and hostile text', () => {
    expect(findCompanies(list, '')).toEqual([]); expect(findCompanies(null as any, 'x')).toEqual([]); expect(findCompanies(list, '<script>')).toEqual([]);
    expect(findCompanies({ 0: null, 1: { ticker: 'X' } } as any, 'x')).toEqual([]);
  });
});

describe('/api/edgar', () => {
  const tickers = { 0: { cik_str: 320193, ticker: 'AAPL', title: 'Apple Inc.' }, 1: { cik_str: 1067983, ticker: 'BRK-B', title: 'BERKSHIRE HATHAWAY INC' } };
  beforeEach(() => resetCache());
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });
  const ok = () => mockFetch(url => url.includes('company_tickers') ? { json: tickers } : { json: fx('aapl') });

  it('returns statements for a ticker, with source, filing link and a cache header', async () => {
    const m = ok(); const r = await call(handler, { ticker: 'aapl' });
    expect(r.status).toBe(200); expect(r.body.ticker).toBe('AAPL'); expect(r.body.rows.revenue.length).toBe(10);
    expect(r.body.filingsUrl).toContain('CIK=0000320193'); expect(r.body.source).toMatch(/SEC/);
    expect(r.headers['cache-control']).toMatch(/s-maxage=21600/);
    expect(m.calls.every(u => /^https:\/\/(www|data)\.sec\.gov\//.test(u))).toBe(true);
  });
  it('turns BRK.B into the SEC spelling', async () => {
    const m = ok(); await call(handler, { ticker: 'brk.b' });
    expect(m.calls.some(u => u.includes('CIK0001067983'))).toBe(true);
  });
  it('searches by name', async () => {
    ok(); const r = await call(handler, { find: 'apple' });
    expect(r.status).toBe(200); expect(r.body.results[0].ticker).toBe('AAPL');
  });
  it('rejects bad input before calling anyone', async () => {
    const m = ok();
    for (const q of [{}, { ticker: '' }, { ticker: 'A'.repeat(11) }, { ticker: 'AA PL' }, { ticker: '../etc' }, { ticker: 'AAPL;DROP' }, { find: '<img src=x>' }, { find: 'x'.repeat(41) }]) {
      const r = await call(handler, q); expect(r.status, JSON.stringify(q)).toBe(400); expect(r.headers['cache-control']).toBe('no-store');
    }
    expect(m.calls).toHaveLength(0);
  });
  it('refuses a repeated parameter and any unknown option (no cache-busting)', async () => {
    const m = ok();
    expect((await call(handler, { ticker: ['AAPL', 'MSFT'] })).status).toBe(400);
    expect((await call(handler, { ticker: 'AAPL', x: '1' })).status).toBe(400);
    expect((await call(handler, { ticker: { a: 'b' } as any })).status).toBe(400);
    expect(m.calls).toHaveLength(0);
  });
  it('shares one download of the company list between simultaneous requests', async () => {
    const m = ok(); await Promise.all([call(handler, { find: 'app' }), call(handler, { find: 'micro' }), call(handler, { ticker: 'AAPL' })]);
    expect(m.calls.filter(u => u.includes('company_tickers'))).toHaveLength(1);
  });
  it('refuses a company number that is not a plain positive integer', async () => {
    mockFetch(url => url.includes('company_tickers') ? { json: { 0: { cik_str: '1/../../x?', ticker: 'EVIL', title: 'Evil' } } } : { json: {} });
    const r = await call(handler, { ticker: 'EVIL' }); expect(r.status).toBe(502);
  });
  it('turns a dotted ticker into the SEC spelling for every dot', async () => {
    const m = ok(); await call(handler, { ticker: 'brk.b' }); expect(m.calls.some(u => u.includes('CIK0001067983'))).toBe(true);
  });
  it('says plainly when a ticker is unknown', async () => {
    ok(); const r = await call(handler, { ticker: 'ZZZZ' });
    expect(r.status).toBe(404); expect(r.body.error).toMatch(/ZZZZ/);
  });
  it('says plainly when a company has no readable filings', async () => {
    mockFetch(url => url.includes('company_tickers') ? { json: tickers } : { json: { cik: 1, entityName: 'X', facts: {} } });
    const r = await call(handler, { ticker: 'AAPL' }); expect(r.status).toBe(404); expect(r.body.error).toMatch(/annual/);
  });
  it('explains that funds and ETFs have no statements', async () => {
    mockFetch(url => url.includes('company_tickers') ? { json: tickers } : { status: 404, json: {} });
    const r = await call(handler, { ticker: 'AAPL' }); expect(r.status).toBe(404); expect(r.body.error).toMatch(/ETFs/);
  });
  it('turns upstream failures into friendly errors and never caches them', async () => {
    mockFetch(() => ({ status: 500, json: {} })); resetCache();
    let r = await call(handler, { ticker: 'AAPL' }); expect(r.status).toBe(502); expect(r.headers['cache-control']).toBe('no-store'); expect(r.body.error).not.toMatch(/stack|undefined/i);
    mockFetch(() => ({ status: 429, json: {} })); resetCache();
    r = await call(handler, { ticker: 'AAPL' }); expect(r.status).toBe(503); expect(r.body.error).toMatch(/busy/);
    mockFetch(() => new Error('network down')); resetCache();
    r = await call(handler, { ticker: 'AAPL' }); expect(r.status).toBe(502);
  });
  it('survives a data source that sends garbage', async () => {
    mockFetch(() => ({ text: '<html>not json</html>' })); resetCache();
    const r = await call(handler, { ticker: 'AAPL' }); expect(r.status).toBe(502); expect(r.body.error).toBeTruthy();
  });
  it('only answers GET', async () => {
    ok(); const r = await call(handler, { ticker: 'AAPL' }, 'POST'); expect(r.status).toBe(405);
  });
});
