/** Turns the live market data into the tiles and one-sentence summaries shown on the home page. Anything that is missing is simply left out. */
import { usStory, riskMood, pkStory, pkBreadth, isOpen, type UsItem, type PkItem } from './pulse';
import { signedPct, num } from './format';

export interface Tile { key: string; label: string; value: string; sub: string; change?: number | null; spark?: number[]; href: string; tone?: 'up' | 'down' | '' }
export interface Summary { market: 'us' | 'pakistan'; name: string; mood: string; tone: 'on' | 'off' | 'mix'; text: string; href: string; live: boolean }
export interface HomeLive { summaries: Summary[]; tiles: Tile[]; live: boolean }

type Macro = { series?: Record<string, { latest?: { value: number } | null; yearAgo?: { value: number } | null } | undefined> } | null | undefined;
const fin = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
const tone = (c: number | null | undefined): 'up' | 'down' | '' => (fin(c) ? (c > 0.0001 ? 'up' : c < -0.0001 ? 'down' : '') : '');
const vsYear = (now: number, ago: number | undefined, unit = 'points') => (fin(ago) ? (Math.abs(now - ago) < 0.005 ? 'about the same as a year ago' : `${now > ago ? 'up' : 'down'} ${num(Math.abs(now - ago), 2)} ${unit} from a year ago`) : '');

export function homeLive(us: { items: UsItem[]; lastBar: number | null } | null, pk: { items: PkItem[] } | null, fx: { rate: number } | null, macro: Macro, nowMs = Date.now()): HomeLive {
  const summaries: Summary[] = [], tiles: Tile[] = [], open = !!us && isOpen(us.lastBar, nowMs);
  const pick = (s: string) => us?.items.find(i => i.symbol === s);
  if (us && us.items.length) {
    const story = usStory(us.items, open), mood = riskMood(us.items);
    if (story.takeaway) summaries.push({ market: 'us', name: 'United States', mood: mood.label === 'Bold' ? 'Investors feel bold' : mood.label === 'Cautious' ? 'Investors are cautious' : 'Investors are undecided', tone: mood.label === 'Bold' ? 'on' : mood.label === 'Cautious' ? 'off' : 'mix', text: story.takeaway.replace(/^In short:\s*/, ''), href: '/market-pulse', live: open });
    for (const [sym, label] of [['^GSPC', 'S&P 500'], ['^IXIC', 'Nasdaq']] as const) { const i = pick(sym); if (i) tiles.push({ key: sym, label, value: num(i.price, 0), sub: 'US shares', change: i.chg, spark: i.spark, href: '/market-pulse', tone: tone(i.chg) }); }
    const v = pick('^VIX'); if (v) tiles.push({ key: 'vix', label: 'Investor nervousness', value: num(v.price, 1), sub: v.price >= 30 ? 'Panic' : v.price >= 20 ? 'A little worried' : 'Calm', change: v.chg, spark: v.spark, href: '/market-pulse', tone: tone(-v.chg) });
  }
  const t10 = macro?.series?.DGS10?.latest?.value, mort = macro?.series?.MORTGAGE30US?.latest?.value;
  if (fin(t10)) tiles.push({ key: 'dgs10', label: 'US government rate (10-year)', value: num(t10, 2) + '%', sub: vsYear(t10, macro?.series?.DGS10?.yearAgo?.value) || '10-year rate', href: '/economy' });
  if (fin(mort)) tiles.push({ key: 'mortgage', label: 'US mortgage rate', value: num(mort, 2) + '%', sub: vsYear(mort, macro?.series?.MORTGAGE30US?.yearAgo?.value) || '30-year fixed', href: '/economy' });
  const btc = pick('BTC-USD'); if (btc) tiles.push({ key: 'btc', label: 'Bitcoin', value: '$' + num(btc.price, btc.price > 1000 ? 0 : 2), sub: 'Last 24 hours', change: btc.chg, spark: btc.spark, href: '/crypto', tone: tone(btc.chg) });
  if (pk && pk.items.length) {
    const b = pkBreadth(pk.items, 'c1'), story = pkStory(pk.items, 'c1'), up = b.avg != null && b.up > b.down * 1.3 && b.avg > 0, down = b.avg != null && b.down > b.up * 1.3 && b.avg < 0;
    if (story.takeaway) summaries.push({ market: 'pakistan', name: 'Pakistan', mood: up ? 'Most stocks rising' : down ? 'Most stocks falling' : 'No clear direction', tone: up ? 'on' : down ? 'off' : 'mix', text: story.takeaway.replace(/^In short:\s*/, ''), href: '/market-pulse?m=pakistan', live: false });
    if (b.avg != null) tiles.push({ key: 'pk', label: 'Pakistan: average stock', value: signedPct(b.avg, 1), sub: `${b.up} up, ${b.down} down (last close)`, change: b.avg, href: '/market-pulse?m=pakistan', tone: tone(b.avg) });
  }
  if (fx && fin(fx.rate) && fx.rate > 0) tiles.push({ key: 'pkr', label: 'One US dollar costs', value: 'Rs ' + num(fx.rate, 1), sub: 'In Pakistani rupees', href: '/currency?from=USD&to=PKR' });
  return { summaries, tiles, live: open };
}
