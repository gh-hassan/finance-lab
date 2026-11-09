/** Turns market numbers into understanding: sector lists, a risk-on / risk-off reading and short plain-English sentences. Pure functions over the rows from /api/pulse. */
import { signedPct, pct, num } from './format';

export interface UsItem { symbol: string; name: string; group: 'index' | 'sector' | 'gauge' | 'stock'; proxy?: boolean; price: number; prev: number; chg: number; abs: number; spark: number[] }
export interface PkItem { symbol: string; name: string; group: string; price: number; c1: number; c5: number; c20: number; spark: number[] }

const CYCLICAL = ['XLK', 'XLY', 'XLF', 'XLI', 'XLC'], DEFENSIVE = ['XLP', 'XLU', 'XLV', 'XLRE'];
const fin = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
const clamp = (x: number, lo = -1, hi = 1) => Math.max(lo, Math.min(hi, x));
const avg = (a: readonly number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
const by = (items: readonly UsItem[], sym: string) => items.find(i => i.symbol === sym);
const list = (items: readonly UsItem[], g: UsItem['group']) => items.filter(i => i.group === g);

export function appetite(items: readonly UsItem[]): { cyclical: number | null; defensive: number | null; spread: number | null } {
  const c = avg(items.filter(i => CYCLICAL.includes(i.symbol)).map(i => i.chg)), d = avg(items.filter(i => DEFENSIVE.includes(i.symbol)).map(i => i.chg));
  return { cyclical: c, defensive: d, spread: c != null && d != null ? c - d : null };
}

export type RiskLabel = 'Bold' | 'Cautious' | 'Undecided';
/** A rough reading of how investors feel, from four clues: the S&P 500, the fear gauge, growth-sensitive versus defensive sectors, and bond yields. Each clue is scored from -1 to +1. "Bold" is what traders call risk-on; "Cautious" is risk-off. */
export function riskMood(items: readonly UsItem[]): { label: RiskLabel; score: number; reasons: { text: string; score: number }[] } {
  const spx = by(items, '^GSPC'), vix = by(items, '^VIX'), tnx = by(items, '^TNX'), ap = appetite(items), reasons: { text: string; score: number }[] = [];
  const parts: [number, number | null][] = [];
  if (spx) { const s = clamp(spx.chg / 0.01); parts.push([0.4, s]); reasons.push({ text: `The S&P 500 is ${spx.chg >= 0 ? 'up' : 'down'} ${pct(Math.abs(spx.chg))}. ${spx.chg >= 0 ? 'When the biggest companies rise, investors are usually feeling confident.' : 'When the biggest companies fall, investors are usually feeling worried.'}`, score: s }); }
  if (vix) { const s = clamp(-vix.chg / 0.08); parts.push([0.25, s]); reasons.push({ text: `The "fear gauge" ${vix.chg <= 0 ? 'fell' : 'rose'} ${pct(Math.abs(vix.chg), 0)}, to ${num(vix.price, 1)}. ${vix.chg <= 0 ? 'Less fear is good news for share prices.' : 'More fear usually means falling share prices.'}`, score: s }); }
  if (ap.spread != null) { const s = clamp(ap.spread / 0.01); parts.push([0.25, s]); reasons.push({ text: ap.spread >= 0 ? 'Companies that grow when the economy is strong (technology, shops, banks) are doing better than steady ones (food, medicine, power). Investors are willing to take chances.' : 'Steady companies (food, medicine, power) are doing better than ones that need a strong economy (technology, shops, banks). Investors are playing it safe.', score: s }); }
  if (tnx) { const s = clamp(-tnx.abs / 0.1); parts.push([0.1, s * 0.5]); }
  const w = parts.reduce((a, [k]) => a + k, 0), score = w ? parts.reduce((a, [k, s]) => a + k * (s ?? 0), 0) / w : 0;
  return { label: score >= 0.25 ? 'Bold' : score <= -0.25 ? 'Cautious' : 'Undecided', score, reasons: reasons.sort((a, b) => Math.abs(b.score) - Math.abs(a.score)) };
}

/** Sectors, best first. */
export const sectorsByChange = (items: readonly UsItem[]): UsItem[] => list(items, 'sector').sort((a, b) => b.chg - a.chg);
/** The biggest gainers and losers among the large companies. */
export function movers(items: readonly UsItem[], n = 5): { up: UsItem[]; down: UsItem[] } {
  const s = list(items, 'stock').sort((a, b) => b.chg - a.chg);
  return { up: s.filter(x => x.chg > 0).slice(0, n), down: s.filter(x => x.chg < 0).slice(-n).reverse() };
}

/** A short plain-English story about the US market right now. `live` says whether the market is open. */
export function usStory(items: readonly UsItem[], live: boolean): { headline: string; bullets: string[]; takeaway: string } {
  const spx = by(items, '^GSPC'), bullets: string[] = [];
  if (!spx) return { headline: 'Not enough data to describe the market yet.', bullets, takeaway: '' };
  const dir = Math.abs(spx.chg) < 0.001 ? 'about the same' : spx.chg > 0 ? 'higher' : 'lower', when = live ? 'right now' : 'at the last close';
  const headline = `The US stock market is ${dir} ${when}. The S&P 500, a scoreboard of the 500 biggest US companies, is ${signedPct(spx.chg, 2)}.`;
  const sec = sectorsByChange(items), up = sec.filter(s => s.chg > 0).length;
  if (sec.length >= 4) bullets.push(`${up} of ${sec.length} parts of the economy are up. ${sec[0].name} is doing best (${signedPct(sec[0].chg, 1)}) and ${sec[sec.length - 1].name} worst (${signedPct(sec[sec.length - 1].chg, 1)}).`);
  const vix = by(items, '^VIX');
  if (vix) bullets.push(`Investor nervousness, called the "fear gauge" (or VIX), is ${num(vix.price, 1)}. Under 15 is calm and over 30 is panic. ${vix.chg < -0.03 ? 'It is falling, which usually calms share prices.' : vix.chg > 0.03 ? 'It is rising, which means people are getting more worried.' : 'It has not changed much.'}`);
  const tnx = by(items, '^TNX');
  if (tnx) bullets.push(`The US government pays ${num(tnx.price, 2)}% interest to borrow money for 10 years (the "10-year yield"). ${Math.abs(tnx.abs) < 0.005 ? 'It barely moved.' : tnx.abs > 0 ? `It rose by ${num(tnx.abs, 2)} percentage points. Higher rates make loans and mortgages dearer, which can pull share prices down.` : `It fell by ${num(Math.abs(tnx.abs), 2)} percentage points. Cheaper borrowing tends to help share prices.`}`);
  const oil = by(items, 'USO'), gold = by(items, 'GLD');
  if (oil && Math.abs(oil.chg) >= 0.01) bullets.push(`Oil prices are ${oil.chg > 0 ? 'up' : 'down'} ${pct(Math.abs(oil.chg))}. ${oil.chg > 0 ? 'Dearer fuel helps oil companies but costs airlines and drivers more.' : 'Cheaper fuel helps airlines and drivers but hurts oil companies.'}`);
  if (gold && Math.abs(gold.chg) >= 0.008) bullets.push(`Gold is ${gold.chg > 0 ? 'up' : 'down'} ${pct(Math.abs(gold.chg))}. ${gold.chg > 0 ? 'People often buy gold when they are worried about the future.' : 'Gold usually falls when people feel less need for a safe place to hide.'}`);
  const m = movers(items, 1);
  if (m.up[0] && m.down[0]) bullets.push(`Among well-known giants, ${m.up[0].name} is the biggest riser (${signedPct(m.up[0].chg, 1)}) and ${m.down[0].name} the biggest faller (${signedPct(m.down[0].chg, 1)}).`);
  const mood = riskMood(items), best = sec[0], worst = sec[sec.length - 1];
  const takeaway = mood.label === 'Bold' ? `In short: investors are feeling bold ${live ? 'today' : 'at the last close'}. More money is going into shares${best ? `, especially in ${best.name.toLowerCase()}` : ''}.` : mood.label === 'Cautious' ? `In short: investors are playing it safe ${live ? 'today' : 'at the last close'}. They are selling shares${worst ? `, especially in ${worst.name.toLowerCase()}` : ''}, and moving money to safer places.` : `In short: there is no clear direction ${live ? 'today' : 'at the last close'}. Buyers and sellers are about even.`;
  return { headline, bullets, takeaway };
}

/* ---- Pakistan (end of day) ---- */
export type Period = 'c1' | 'c5' | 'c20';
export const PERIODS: [Period, string][] = [['c1', 'Last day'], ['c5', 'Last week'], ['c20', 'Last month']];
export interface PkSector { sector: string; avg: number; count: number; up: number }

export function pkSectors(items: readonly PkItem[], p: Period): PkSector[] {
  const m = new Map<string, number[]>();
  for (const s of items) if (fin(s[p])) m.set(s.group, [...(m.get(s.group) || []), s[p]]);
  return [...m.entries()].map(([sector, v]) => ({ sector, avg: avg(v)!, count: v.length, up: v.filter(x => x > 0).length })).sort((a, b) => b.avg - a.avg);
}
export function pkBreadth(items: readonly PkItem[], p: Period): { up: number; down: number; flat: number; avg: number | null } {
  const v = items.map(i => i[p]).filter(fin);
  return { up: v.filter(x => x > 0.0005).length, down: v.filter(x => x < -0.0005).length, flat: v.filter(x => Math.abs(x) <= 0.0005).length, avg: avg(v) };
}
export function pkMovers(items: readonly PkItem[], p: Period, n = 6): { up: PkItem[]; down: PkItem[] } {
  const s = items.filter(i => fin(i[p])).sort((a, b) => b[p] - a[p]);
  return { up: s.filter(x => x[p] > 0).slice(0, n), down: s.filter(x => x[p] < 0).slice(-n).reverse() };
}
export function pkStory(items: readonly PkItem[], p: Period): { headline: string; bullets: string[]; takeaway: string } {
  const b = pkBreadth(items, p), span = p === 'c1' ? 'the last trading day' : p === 'c5' ? 'the last week' : 'the last month', bullets: string[] = [];
  if (b.avg == null) return { headline: 'Not enough data to describe the market yet.', bullets, takeaway: '' };
  const dir = Math.abs(b.avg) < 0.001 ? 'about the same' : b.avg > 0 ? 'higher' : 'lower';
  const headline = `Over ${span}, large Pakistani stocks are ${dir}. The average stock moved ${signedPct(b.avg, 1)}.`;
  bullets.push(`${b.up} stocks rose and ${b.down} fell${b.flat ? `, ${b.flat} unchanged` : ''}. ${b.up > b.down * 1.5 ? 'More risers than fallers means lots of people were buying, not just a few.' : b.down > b.up * 1.5 ? 'More fallers than risers means lots of people were selling.' : 'Risers and fallers were fairly balanced.'}`);
  const sec = pkSectors(items, p).filter(s => s.count >= 3);
  if (sec.length >= 3) bullets.push(`A sector is a group of similar companies. ${sec[0].sector} did best (${signedPct(sec[0].avg, 1)} on average) and ${sec[sec.length - 1].sector} did worst (${signedPct(sec[sec.length - 1].avg, 1)}).`);
  const m = pkMovers(items, p, 1);
  if (m.up[0] && m.down[0]) bullets.push(`The best single stock was ${m.up[0].name} (${signedPct(m.up[0][p], 1)}) and the weakest was ${m.down[0].name} (${signedPct(m.down[0][p], 1)}).`);
  const takeaway = b.up > b.down * 1.3 && b.avg > 0 ? `In short: most stocks rose over ${span}. Buyers were in charge.` : b.down > b.up * 1.3 && b.avg < 0 ? `In short: most stocks fell over ${span}. Sellers were in charge.` : `In short: no clear direction over ${span}. Buyers and sellers were about even.`;
  return { headline, bullets, takeaway };
}

/** Heat map colour strength for a change, from 0 (no move) to 1 (a big move). `full` is the move that counts as full strength. */
export const heat = (chg: number, full: number): number => (fin(chg) && full > 0 ? clamp(Math.abs(chg) / full, 0, 1) : 0);
/** Is the last bar recent enough that the market is probably open? */
export const isOpen = (lastBar: number | null | undefined, nowMs = Date.now()): boolean => fin(lastBar) && nowMs - lastBar * 1000 < 25 * 60e3;
