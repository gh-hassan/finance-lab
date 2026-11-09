import { describe, expect, it } from 'vitest';
import { homeLive } from '../src/lib/homelive';
import type { UsItem, PkItem } from '../src/lib/pulse';

const u = (symbol: string, group: UsItem['group'], chg: number, price = 100): UsItem => ({ symbol, name: symbol, group, price, prev: price, chg, abs: 0, spark: [1, 2, 3] });
const us = { lastBar: 1000, items: [u('^GSPC', 'index', 0.012, 7377), u('^IXIC', 'index', 0.02, 24579), u('^VIX', 'gauge', -0.09, 18), u('^TNX', 'gauge', 0, 4.8), u('BTC-USD', 'gauge', 0.01, 75000), ...['XLK', 'XLY', 'XLF', 'XLI', 'XLC'].map(s => u(s, 'sector', 0.015)), ...['XLP', 'XLU', 'XLV', 'XLRE'].map(s => u(s, 'sector', 0.002))] };
const pk = (c: number): PkItem => ({ symbol: 'A' + c, name: 'A', group: 'Banks', price: 10, c1: c, c5: c, c20: c, spark: [1, 2] });
const pks = { items: [pk(0.01), pk(0.02), pk(0.015), pk(-0.005)] };
const macro = { series: { DGS10: { latest: { value: 4.84 }, yearAgo: { value: 4.17 } }, MORTGAGE30US: { latest: { value: 7.18 }, yearAgo: { value: 6.17 } } } };

describe('home live summary', () => {
  it('builds summaries and tiles from complete data', () => {
    const r = homeLive(us, pks, { rate: 276.8 }, macro, 1000 * 1000 + 60e3);
    expect(r.live).toBe(true); expect(r.summaries.map(s => s.market)).toEqual(['us', 'pakistan']);
    expect(r.summaries[0]).toMatchObject({ mood: 'Investors feel bold', tone: 'on', live: true }); expect(r.summaries[0].text).not.toMatch(/^In short/); expect(r.summaries[1].mood).toBe('Most stocks rising');
    const k = r.tiles.map(t => t.key); expect(k).toEqual(['^GSPC', '^IXIC', 'vix', 'dgs10', 'mortgage', 'btc', 'pk', 'pkr']);
    expect(r.tiles.find(t => t.key === 'dgs10')).toMatchObject({ value: '4.84%', sub: 'up 0.67 points from a year ago', href: '/economy' });
    expect(r.tiles.find(t => t.key === 'pkr')!.value).toBe('Rs 276.8'); expect(r.tiles.find(t => t.key === 'vix')!.sub).toBe('Calm');
  });
  it('says the market is closed when the last bar is old', () => { expect(homeLive(us, null, null, null, 1000 * 1000 + 3600e3).live).toBe(false); });
  it('leaves out whatever is missing and never throws', () => {
    for (const args of [[null, null, null, null], [us, null, null, null], [null, pks, null, null], [null, null, { rate: 280 }, null], [null, null, null, macro], [{ items: [], lastBar: null }, { items: [] }, { rate: NaN }, {}]] as any[]) {
      const r = homeLive(args[0], args[1], args[2], args[3]); expect(Array.isArray(r.tiles)).toBe(true); expect(JSON.stringify(r)).not.toMatch(/NaN|undefined|null,|Infinity/);
    }
    expect(homeLive(null, null, null, null).tiles).toEqual([]); expect(homeLive(null, null, { rate: 280 }, null).tiles.map(t => t.key)).toEqual(['pkr']);
  });
  it('marks falling Pakistan as cautious', () => { const r = homeLive(null, { items: [pk(-0.02), pk(-0.01), pk(-0.03), pk(0.001)] }, null, null); expect(r.summaries[0]).toMatchObject({ tone: 'off', mood: 'Most stocks falling' }); });
  it('describes an unchanged rate honestly', () => { const r = homeLive(null, null, null, { series: { DGS10: { latest: { value: 4.5 }, yearAgo: { value: 4.5 } } } }); expect(r.tiles[0].sub).toBe('about the same as a year ago'); });
});
