/** Pure maths for the options payoff page: what a position earns or loses, with no network and no page. Prices are per share; one contract covers 100 shares. */
import { bs } from './math';

export const CONTRACT = 100;
export type Kind = 'call' | 'put' | 'stock';
/** One part of a position. side is +1 for bought (long) and -1 for sold (short). For stock, `premium` is the price paid per share. */
export interface Leg { kind: Kind; side: 1 | -1; strike: number; premium: number }

const fin = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);

/** Profit or loss per share at expiry for one leg when the stock ends at `s`. */
export function legPnl(leg: Leg, s: number): number {
  const v = leg.kind === 'stock' ? s - leg.premium : leg.kind === 'call' ? Math.max(s - leg.strike, 0) - leg.premium : Math.max(leg.strike - s, 0) - leg.premium;
  return leg.side * v;
}

/** Total profit or loss in dollars for one contract (100 shares) at expiry. */
export const positionPnl = (legs: readonly Leg[], s: number): number => CONTRACT * legs.reduce((a, l) => a + legPnl(l, s), 0);

/** The option's price per share from Black-Scholes. `days` to expiry, `iv` and `rate` as fractions. Never negative. */
export function optionPrice(kind: 'call' | 'put', spot: number, strike: number, days: number, iv: number, rate: number): number {
  if (!fin(spot) || !fin(strike) || spot <= 0 || strike <= 0) return 0;
  const r = bs(spot, strike, Math.max(0, days) / 365, rate, 0, iv);
  return Math.max(0, kind === 'call' ? r.c : r.p);
}

/** Dollar value of the whole position today (before expiry), for one contract: each option at its fair price with `days` left. */
export function positionToday(legs: readonly Leg[], s: number, days: number, iv: number, rate: number): number {
  let t = 0;
  for (const l of legs) {
    const value = l.kind === 'stock' ? s - l.premium : optionPrice(l.kind, s, l.strike, days, iv, rate) - l.premium;
    t += l.side * value;
  }
  return CONTRACT * t;
}

export interface Analysis {
  /** Best result in dollars, or null when there is no limit. */
  maxProfit: number | null;
  /** Worst result in dollars (a negative number), or null when there is no limit. */
  maxLoss: number | null;
  /** Prices at which the position neither gains nor loses, lowest first. */
  breakevens: number[];
}

/** Best case, worst case and break-even prices at expiry. The profit line only bends at the strikes (and at zero), so those points are enough. */
export function analyze(legs: readonly Leg[]): Analysis {
  if (!legs.length) return { maxProfit: 0, maxLoss: 0, breakevens: [] };
  const kinks = [...new Set([0, ...legs.filter(l => l.kind !== 'stock').map(l => l.strike)])].sort((a, b) => a - b);
  const top = kinks[kinks.length - 1];
  const slopeAbove = CONTRACT * legs.reduce((a, l) => a + l.side * (l.kind === 'stock' ? 1 : l.kind === 'call' ? 1 : 0), 0);
  const far = top + Math.max(10, top);
  const xs = [...kinks, far], ys = xs.map(x => positionPnl(legs, x));
  const kinkYs = ys.slice(0, kinks.length);
  const eps = 1e-9;
  const maxProfit = slopeAbove > eps ? null : Math.max(...kinkYs, ys[ys.length - 1]);
  const maxLoss = slopeAbove < -eps ? null : Math.min(...kinkYs, ys[ys.length - 1]);
  const be: number[] = [];
  for (let i = 0; i < xs.length - 1; i++) {
    const a = ys[i], b = ys[i + 1], x0 = xs[i], x1 = xs[i + 1];
    if (Math.abs(a) < eps) { be.push(x0); continue; }
    if ((a < 0 && b > 0) || (a > 0 && b < 0)) be.push(x0 + (x1 - x0) * (-a / (b - a)));
  }
  const last = ys[ys.length - 1];
  if (Math.abs(last) < eps && slopeAbove === 0) { /* flat at zero beyond the last strike: no extra break-even */ }
  const out: number[] = [];
  for (const x of be.sort((a, b) => a - b)) if (x > 0.005 && (!out.length || Math.abs(out[out.length - 1] - x) > 1e-6)) out.push(+x.toFixed(6));
  return { maxProfit: maxProfit == null ? null : round2(maxProfit), maxLoss: maxLoss == null ? null : round2(maxLoss), breakevens: out };
}
const round2 = (x: number): number => Math.round(x * 100) / 100;

export interface Curve { prices: number[]; expiry: number[]; today: number[] }
/** The chart's two lines: profit at expiry, and the position's value today with `days` left. */
export function curve(legs: readonly Leg[], lo: number, hi: number, days: number, iv: number, rate: number, n = 121): Curve {
  const prices: number[] = [], expiry: number[] = [], today: number[] = [];
  for (let i = 0; i < n; i++) {
    const s = lo + (hi - lo) * i / (n - 1);
    prices.push(s); expiry.push(positionPnl(legs, s)); today.push(positionToday(legs, s, days, iv, rate));
  }
  return { prices, expiry, today };
}

export interface Strategy { id: string; name: string; view: string; blurb: string; best: string; worst: string }
export const STRATEGIES: readonly Strategy[] = [
  { id: 'long-call', name: 'Buy a call', view: 'You think the stock will rise a lot', blurb: 'You pay a small fee now for the right to buy the stock at a fixed price. If the stock jumps, you gain a lot. If not, you lose only what you paid.', best: 'No limit if the stock keeps rising', worst: 'Only what you paid for the option' },
  { id: 'long-put', name: 'Buy a put', view: 'You think the stock will fall', blurb: 'You pay a small fee for the right to sell the stock at a fixed price. If the stock drops, you gain. If it rises, you lose only what you paid.', best: 'Large if the stock falls a long way', worst: 'Only what you paid for the option' },
  { id: 'covered-call', name: 'Covered call', view: 'You own the stock and expect it to stay about the same', blurb: 'You own 100 shares. You sell someone the right to buy them at a higher price. You get money now, but you give up gains above that price.', best: 'Limited: the money you got plus gains up to the strike', worst: 'Large if the stock falls, a little softer because of the money you got' },
  { id: 'protective-put', name: 'Protective put', view: 'You own the stock and want insurance', blurb: 'You own 100 shares and buy a put. If the stock crashes, the put pays you, so your loss is limited. The put costs money, like an insurance fee.', best: 'No limit if the stock keeps rising (less the cost)', worst: 'Limited to the gap to the strike, plus the cost' },
  { id: 'bull-spread', name: 'Bull call spread', view: 'You think the stock will rise a little', blurb: 'You buy one call and sell a higher one to pay for part of it. It costs less than a plain call, but your gain has a limit.', best: 'Limited to the gap between the strikes, minus the cost', worst: 'Only the net cost' },
  { id: 'straddle', name: 'Straddle', view: 'You expect a big move but not which way', blurb: 'You buy a call and a put at the same strike price. You gain if the stock moves far in either direction. You lose if it stays still.', best: 'No limit if the stock rises a lot, and large if it falls', worst: 'Both costs, if the stock stays at the strike price' },
  { id: 'iron-condor', name: 'Iron condor', view: 'You expect the stock to stay in a range', blurb: 'You get money by selling two options. You limit your risk by buying two more, further out. You keep the money if the stock stays between your two middle prices.', best: 'The net money you got', worst: 'Limited: the gap between strikes, minus the money you got' }
];

const grid = (spot: number): number => (spot >= 200 ? 5 : spot >= 50 ? 1 : 0.5);
const snap = (x: number, g: number): number => Math.max(g, Math.round(x / g) * g);

/** A ready-made position for the chosen strategy. Strikes sit near the stock price and premiums come from Black-Scholes, so a beginner never has to guess them. */
export function buildStrategy(id: string, spot: number, days: number, iv: number, rate: number): Leg[] {
  const g = grid(spot), atm = snap(spot, g), up = snap(spot * 1.05, g), up2 = snap(spot * 1.1, g), dn = snap(spot * 0.95, g), dn2 = snap(spot * 0.9, g);
  const px = (kind: 'call' | 'put', k: number): number => round2(optionPrice(kind, spot, k, days, iv, rate));
  const call = (side: 1 | -1, k: number): Leg => ({ kind: 'call', side, strike: k, premium: px('call', k) });
  const put = (side: 1 | -1, k: number): Leg => ({ kind: 'put', side, strike: k, premium: px('put', k) });
  const stock: Leg = { kind: 'stock', side: 1, strike: 0, premium: round2(spot) };
  switch (id) {
    case 'long-put': return [put(1, atm)];
    case 'covered-call': return [stock, call(-1, up)];
    case 'protective-put': return [stock, put(1, dn)];
    case 'bull-spread': return [call(1, atm), call(-1, up)];
    case 'straddle': return [call(1, atm), put(1, atm)];
    case 'iron-condor': return [put(1, dn2), put(-1, dn), call(-1, up), call(1, up2)];
    default: return [call(1, atm)];
  }
}

/** A plain-English name for one leg, such as "Bought a call at $105". */
export function legLabel(l: Leg): string {
  if (l.kind === 'stock') return `${l.side > 0 ? 'Own' : 'Short'} 100 shares`;
  return `${l.side > 0 ? 'Buy' : 'Sell'} a ${l.kind} at $${l.strike}`;
}
