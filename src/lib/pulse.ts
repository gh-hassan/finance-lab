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

export type RiskLabel = 'Risk-on' | 'Risk-off' | 'Mixed';
/** A rough reading of the market's mood from four clues: the S&P 500, the fear gauge, cyclical versus defensive sectors, and bond yields. Each clue is scored from -1 to +1. */
export function riskMood(items: readonly UsItem[]): { label: RiskLabel; score: number; reasons: { text: string; score: number }[] } {
  const spx = by(items, '^GSPC'), vix = by(items, '^VIX'), tnx = by(items, '^TNX'), ap = appetite(items), reasons: { text: string; score: number }[] = [];
  const parts: [number, number | null][] = [];
  if (spx) { const s = clamp(spx.chg / 0.01); parts.push([0.4, s]); reasons.push({ text: `The S&P 500 is ${spx.chg >= 0 ? 'up' : 'down'} ${pct(Math.abs(spx.chg))}.`, score: s }); }
  if (vix) { const s = clamp(-vix.chg / 0.08); parts.push([0.25, s]); reasons.push({ text: `The fear gauge (VIX) ${vix.chg <= 0 ? 'fell' : 'rose'} ${pct(Math.abs(vix.chg), 0)}, to ${num(vix.price, 1)}.`, score: s }); }
  if (ap.spread != null) { const s = clamp(ap.spread / 0.01); parts.push([0.25, s]); reasons.push({ text: ap.spread >= 0 ? 'Growth-sensitive sectors are beating the defensive ones: investors are willing to take risk.' : 'Defensive sectors are beating growth-sensitive ones: investors are playing it safe.', score: s }); }
  if (tnx) { const s = clamp(-tnx.abs / 0.1); parts.push([0.1, s * 0.5]); }
  const w = parts.reduce((a, [k]) => a + k, 0), score = w ? parts.reduce((a, [k, s]) => a + k * (s ?? 0), 0) / w : 0;
  return { label: score >= 0.25 ? 'Risk-on' : score <= -0.25 ? 'Risk-off' : 'Mixed', score, reasons: reasons.sort((a, b) => Math.abs(b.score) - Math.abs(a.score)) };
}

/** Sectors, best first. */
export const sectorsByChange = (items: readonly UsItem[]): UsItem[] => list(items, 'sector').sort((a, b) => b.chg - a.chg);
/** The biggest gainers and losers among the large companies. */
export function movers(items: readonly UsItem[], n = 5): { up: UsItem[]; down: UsItem[] } {
  const s = list(items, 'stock').sort((a, b) => b.chg - a.chg);
  return { up: s.filter(x => x.chg > 0).slice(0, n), down: s.filter(x => x.chg < 0).slice(-n).reverse() };
}

/** A short plain-English story about the US market right now. `live` says whether the market is open. */
export function usStory(items: readonly UsItem[], live: boolean): { headline: string; bullets: string[] } {
  const spx = by(items, '^GSPC'), ixic = by(items, '^IXIC'), bullets: string[] = [];
  if (!spx) return { headline: 'Not enough data to describe the market yet.', bullets };
  const dir = Math.abs(spx.chg) < 0.001 ? 'flat' : spx.chg > 0 ? 'higher' : 'lower', when = live ? 'now' : 'at the last close';
  const headline = `US stocks are ${dir} ${when}: the S&P 500 is ${signedPct(spx.chg, 2)}${ixic ? ` and the Nasdaq ${signedPct(ixic.chg, 2)}` : ''}.`;
  const sec = sectorsByChange(items), up = sec.filter(s => s.chg > 0).length;
  if (sec.length >= 4) bullets.push(`${up} of ${sec.length} sectors are up. ${sec[0].name} leads (${signedPct(sec[0].chg, 1)}) and ${sec[sec.length - 1].name} lags (${signedPct(sec[sec.length - 1].chg, 1)}).`);
  const vix = by(items, '^VIX');
  if (vix) bullets.push(vix.price >= 30 ? `The fear gauge is high at ${num(vix.price, 1)}: investors are nervous and prices swing a lot.` : vix.price >= 20 ? `The fear gauge is ${num(vix.price, 1)}, a little above calm. ${vix.chg < -0.03 ? 'It is easing, which usually helps stocks.' : vix.chg > 0.03 ? 'It is climbing, which signals more worry.' : ''}`.trim() : `The fear gauge is calm at ${num(vix.price, 1)}.`);
  const tnx = by(items, '^TNX');
  if (tnx) bullets.push(`The 10-year Treasury yield is ${num(tnx.price, 2)}%, ${Math.abs(tnx.abs) < 0.005 ? 'little changed' : tnx.abs > 0 ? `up ${num(tnx.abs * 100, 0)} basis points. Higher yields make borrowing dearer and can weigh on growth stocks.` : `down ${num(Math.abs(tnx.abs) * 100, 0)} basis points. Falling yields tend to support stocks and bond prices.`}`);
  const oil = by(items, 'USO'), gold = by(items, 'GLD');
  if (oil && Math.abs(oil.chg) >= 0.01) bullets.push(`Oil is ${oil.chg > 0 ? 'up' : 'down'} ${pct(Math.abs(oil.chg))}. ${oil.chg > 0 ? 'Dearer fuel lifts energy companies but squeezes airlines and shoppers.' : 'Cheaper fuel helps airlines and shoppers but hurts energy companies.'}`);
  if (gold && Math.abs(gold.chg) >= 0.008) bullets.push(`Gold is ${gold.chg > 0 ? 'up' : 'down'} ${pct(Math.abs(gold.chg))}. ${gold.chg > 0 ? 'People often buy gold when they are worried about the future.' : 'Gold falls when investors feel less need for a safe place to hide.'}`);
  const m = movers(items, 1);
  if (m.up[0] && m.down[0]) bullets.push(`Among big companies, ${m.up[0].name} is the top gainer (${signedPct(m.up[0].chg, 1)}) and ${m.down[0].name} the biggest faller (${signedPct(m.down[0].chg, 1)}).`);
  return { headline, bullets };
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
export function pkStory(items: readonly PkItem[], p: Period): { headline: string; bullets: string[] } {
  const b = pkBreadth(items, p), span = p === 'c1' ? 'the last trading day' : p === 'c5' ? 'the last week' : 'the last month', bullets: string[] = [];
  if (b.avg == null) return { headline: 'Not enough data to describe the market yet.', bullets };
  const dir = Math.abs(b.avg) < 0.001 ? 'little changed' : b.avg > 0 ? 'higher' : 'lower';
  const headline = `Over ${span}, large Pakistani stocks are ${dir}: the average stock moved ${signedPct(b.avg, 1)}.`;
  bullets.push(`${b.up} stocks rose and ${b.down} fell${b.flat ? `, ${b.flat} unchanged` : ''}. ${b.up > b.down * 1.5 ? 'More winners than losers means buying was broad, not just a few names.' : b.down > b.up * 1.5 ? 'More losers than winners means selling was broad.' : 'Winners and losers were fairly balanced.'}`);
  const sec = pkSectors(items, p).filter(s => s.count >= 3);
  if (sec.length >= 3) bullets.push(`${sec[0].sector} led (${signedPct(sec[0].avg, 1)} on average) and ${sec[sec.length - 1].sector} lagged (${signedPct(sec[sec.length - 1].avg, 1)}).`);
  const m = pkMovers(items, p, 1);
  if (m.up[0] && m.down[0]) bullets.push(`The best stock was ${m.up[0].name} (${signedPct(m.up[0][p], 1)}) and the weakest ${m.down[0].name} (${signedPct(m.down[0][p], 1)}).`);
  return { headline, bullets };
}

/** Heat map colour strength for a change, from 0 (no move) to 1 (a big move). `full` is the move that counts as full strength. */
export const heat = (chg: number, full: number): number => (fin(chg) && full > 0 ? clamp(Math.abs(chg) / full, 0, 1) : 0);
/** Is the last bar recent enough that the market is probably open? */
export const isOpen = (lastBar: number | null | undefined, nowMs = Date.now()): boolean => fin(lastBar) && nowMs - lastBar * 1000 < 25 * 60e3;
