/** Pure logic for the extra home page features: the time machine, the Pakistan card and the ticker tape. No network, so tests can feed it numbers. */
import { signedPct, num } from './format';
import { monthX, prevMonth, type Ret, type Pt } from './factors';
import type { UsItem, PkItem } from './pulse';

const fin = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);

export interface TimeMachine {
  startMonth: number; endMonth: number; years: number; amount: number;
  stocks: Pt[]; cash: Pt[]; endStocks: number; endCash: number; multiple: number; yearly: number | null;
  prices: Pt[] | null; endPrices: number | null; worstDrop: number; worstYear: { year: number; ret: number } | null; usedMonths: number;
}

/** What `amount` dollars put into the whole US stock market at the start of `startYear` would be worth now, next to the same money held in cash (US Treasury bills).
 *  Monthly returns are percent numbers (1.5 means 1.5%); the stock return is the market's extra return plus the cash return. Null when there is too little data. */
export function timeMachine(months: readonly number[], mkt: readonly Ret[], rf: readonly Ret[], startYear: number, amount: number, cpi?: readonly (readonly [number, number])[] | null): TimeMachine | null {
  if (!fin(startYear) || !fin(amount) || amount <= 0 || months.length !== mkt.length || months.length !== rf.length) return null;
  const from = months.findIndex(m => m >= Math.round(startYear) * 100 + 1);
  if (from < 0) return null;
  let s = amount, c = amount, peak = amount, drop = 0, used = 0;
  const first = months[from];
  const stocks: Pt[] = [[monthX(prevMonth(first)), amount]], cash: Pt[] = [[monthX(prevMonth(first)), amount]];
  const yr = new Map<number, { g: number; n: number }>();
  for (let i = from; i < months.length; i++) {
    const a = mkt[i], b = rf[i];
    if (!fin(a) || !fin(b)) continue;
    used++;
    const before = s;
    s *= 1 + (a + b) / 100; c *= 1 + b / 100;
    const y = Math.floor(months[i] / 100);
    const cur = yr.get(y) ?? { g: 1, n: 0 }; yr.set(y, { g: cur.g * (s / before), n: cur.n + 1 });
    peak = Math.max(peak, s); drop = Math.min(drop, s / peak - 1);
    stocks.push([monthX(months[i]), s]); cash.push([monthX(months[i]), c]);
  }
  if (used < 12) return null;
  const last = months[months.length - 1], years = used / 12;
  let worst: { year: number; ret: number } | null = null;
  for (const [year, v] of yr) if (v.n === 12) { const ret = v.g - 1; if (!worst || ret < worst.ret) worst = { year, ret }; }
  const prices = priceLine(months.slice(from), cpi, amount);
  return { startMonth: first, endMonth: last, prices, endPrices: prices ? prices[prices.length - 1][1] : null, years, amount, stocks, cash, endStocks: s, endCash: c, multiple: s / amount, yearly: s > 0 ? Math.pow(s / amount, 1 / years) - 1 : -1, worstDrop: drop, worstYear: worst, usedMonths: used };
}

/** The cost of living: what `amount` at the start must grow to just to buy the same things, from the consumer price index ([YYYYMM, index] pairs). A month the index has not reached yet uses its latest value. Null without usable data. */
export function priceLine(months: readonly number[], cpi: readonly (readonly [number, number])[] | null | undefined, amount: number): Pt[] | null {
  if (!months.length || !cpi || cpi.length < 12) return null;
  const sorted = cpi.filter(p => fin(p[0]) && fin(p[1]) && p[1] > 0).sort((a, b) => a[0] - b[0]);
  if (sorted.length < 12) return null;
  const at = (m: number): number => { let lo = 0, hi = sorted.length - 1, r = sorted[0][1]; while (lo <= hi) { const mid = (lo + hi) >> 1; if (sorted[mid][0] <= m) { r = sorted[mid][1]; lo = mid + 1; } else hi = mid - 1; } return r; };
  const base = at(prevMonth(months[0]));
  return [[monthX(prevMonth(months[0])), amount], ...months.map((m): Pt => [monthX(m), amount * at(m) / base])];
}

/** The start years offered on the slider: from the first full year in the data to ten years ago. */
export function startYears(months: readonly number[]): { min: number; max: number } | null {
  if (!months.length) return null;
  const first = months[0], last = months[months.length - 1];
  const min = first % 100 === 1 ? Math.floor(first / 100) : Math.floor(first / 100) + 1, max = Math.floor(last / 100) - 10;
  return max > min ? { min, max } : null;
}

export interface PkToday { best: { name: string; chg: number } | null; worst: { name: string; chg: number } | null; up: number; down: number; avg: number | null; rate: number | null; rateChange: number | null; sentence: string }

/** A small card about Pakistan: the best and weakest large stock at the last close, how many rose, and the rupee. `fx` is the dollar rate and its change over the last month. */
export function pkToday(items: readonly PkItem[] | null | undefined, fx: { rate: number; change?: number | null } | null | undefined): PkToday | null {
  const rows = (items ?? []).filter(i => fin(i.c1));
  const rate = fx && fin(fx.rate) && fx.rate > 0 ? fx.rate : null, rateChange = rate != null && fx && fin(fx.change) ? fx.change : null;
  if (!rows.length && rate == null) return null;
  const sorted = [...rows].sort((a, b) => b.c1 - a.c1);
  const best = sorted.length && sorted[0].c1 > 0 ? { name: sorted[0].name, chg: sorted[0].c1 } : null;
  const w = sorted[sorted.length - 1], worst = sorted.length && w.c1 < 0 ? { name: w.name, chg: w.c1 } : null;
  const up = rows.filter(i => i.c1 > 0.0005).length, down = rows.filter(i => i.c1 < -0.0005).length, avg = rows.length ? rows.reduce((a, i) => a + i.c1, 0) / rows.length : null;
  const parts: string[] = [];
  if (avg != null) parts.push(up > down * 1.3 && avg > 0 ? 'Most large Pakistani stocks rose at the last close.' : down > up * 1.3 && avg < 0 ? 'Most large Pakistani stocks fell at the last close.' : 'Pakistani stocks had no clear direction at the last close.');
  if (rateChange != null && Math.abs(rateChange) >= 0.001) parts.push(`The rupee has ${rateChange > 0 ? 'weakened' : 'strengthened'} ${num(Math.abs(rateChange) * 100, 1)}% against the dollar over the last month.`);
  else if (rate != null) parts.push('The rupee has been steady against the dollar over the last month.');
  return { best, worst, up, down, avg, rate, rateChange, sentence: parts.join(' ') };
}

export interface TapeItem { label: string; value: string; change: number | null; href: string }
/** Items for the scrolling ticker tape: indices, nervousness, Bitcoin, gold, the dollar in rupees and the average Pakistani stock. Anything missing is left out. */
export function tapeItems(us: { items: UsItem[] } | null | undefined, pkAvg: number | null | undefined, pkr: number | null | undefined): TapeItem[] {
  const out: TapeItem[] = [], it = (s: string) => us?.items.find(i => i.symbol === s);
  for (const [s, label] of [['^GSPC', 'S&P 500'], ['^IXIC', 'Nasdaq'], ['^DJI', 'Dow'], ['^VIX', 'Fear gauge']] as const) { const i = it(s); if (i && fin(i.price)) out.push({ label, value: num(i.price, s === '^VIX' ? 1 : 0), change: fin(i.chg) ? i.chg : null, href: '/market-pulse' }); }
  const g = it('GLD'); if (g && fin(g.chg)) out.push({ label: 'Gold', value: signedPct(g.chg, 1), change: g.chg, href: '/market-pulse' });
  const b = it('BTC-USD'); if (b && fin(b.price)) out.push({ label: 'Bitcoin', value: '$' + num(b.price, b.price > 1000 ? 0 : 2), change: fin(b.chg) ? b.chg : null, href: '/crypto' });
  if (fin(pkr) && pkr > 0) out.push({ label: 'USD in rupees', value: 'Rs ' + num(pkr, 1), change: null, href: '/currency?from=USD&to=PKR' });
  if (fin(pkAvg)) out.push({ label: 'Pakistan stocks', value: signedPct(pkAvg, 1), change: pkAvg, href: '/market-pulse?m=pakistan' });
  return out;
}
