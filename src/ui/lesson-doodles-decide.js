// @ts-nocheck
/* The "Making decisions" lesson pictures, drawn by hand in the same style as the home page story.
   Each function is draw(t, p, W, H): t runs 0 to 1, p holds the sliders, and W x H is the real size in pixels. */
import { compact, money, nf, sum } from '../lib/math';
import { box, ink, line, pen, poly, dot, track, NAVY, GREEN, GOLD, GREY, RED } from './doodle-kit.js';
import { note } from './lesson-doodles.js';

const M = x => (Math.abs(x) >= 1e6 ? compact(x) : money(x, 0));
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const lerp = (a, b, u) => a + (b - a) * u;
const ease = u => 1 - Math.pow(1 - clamp(u, 0, 1), 3);
const seg = (t, a, b) => clamp((t - a) / (b - a), 0, 1);
const MUTE = { c: 'var(--mute)', hand: false };
const PALE_GREEN = 'color-mix(in srgb,var(--good) 24%,transparent)';

/** What you pay today against what each future payment is worth today, stacked up. */
export function npv(t, p, W, H) {
  const flows = (p.flows && p.flows.length ? p.flows : [p.pay, p.pay, p.pay, p.pay]).slice(0, 10), n = flows.length, r = p.rate / 100, pvs = flows.map((f, k) => f / Math.pow(1 + r, k + 1)), total = sum(pvs), top = Math.max(p.cost, total) * 1.15, base = H - 80, hmax = base - 60, sc = hmax / top, bw = Math.min(130, W * 0.24), c1 = W * 0.27, c2 = W * 0.73, pad = Math.max(20, W * 0.06);
  let g = line(pad, base, W - pad, base, { k: 'floor', w: 2.4 }) + box(c1 - bw / 2, base - p.cost * sc, bw, p.cost * sc, { fill: GOLD, k: 'cost', r: 10 }) + ink(c1, base - p.cost * sc - 17, M(p.cost), { z: 21, c: 'var(--warn)' }) + ink(c1, base + 20, 'You pay today', { z: 16 });
  let y = base, landed = 0;
  pvs.forEach((pv, k) => { const a = ease(seg(t, k / (n + 0.6), (k + 1) / (n + 0.6))), hh = pv * sc * a; landed += pv * a; y -= hh; g += box(c2 - bw / 2, y, bw, hh, { fill: k % 2 ? PALE_GREEN : GREEN, k: 'pv' + k, r: 4, w: 2 }); if (hh > 18 && bw > 60) g += ink(c2, y + hh / 2, `Year ${k + 1}`, { z: 13 }); });
  g += line(c1 - bw / 2 - 10, base - p.cost * sc, c2 + bw / 2 + 10, base - p.cost * sc, { k: 'costline', dash: 7, w: 2.4 }) + ink(c2, base - sum(pvs) * sc - 17, M(landed), { z: 21, c: 'var(--good)' }) + ink(c2, base + 20, 'Worth today', { z: 16 }) + ink(c2, base + 40, 'of what you get', { z: 12.5, ...MUTE });
  const done = t > 0.96, good = total > p.cost;
  if (done) g += note(W / 2, 18, good ? `Worth it: +${M(total - p.cost)}` : `Not worth it: −${M(p.cost - total)}`, { k: 'verdict', fill: good ? GREEN : RED, z: 15.5 });
  return { svg: g, cap: done ? (good ? `Worth ${M(total)} today for a cost of ${M(p.cost)}. You gain ${M(total - p.cost)}. Do it! (That gain is the NPV.)` : `Worth only ${M(total)} today for a cost of ${M(p.cost)}. You lose ${M(p.cost - total)}. Skip it. (Negative NPV.)`) : `Each payment is worth less today than on the day you get it. The green bar holds ${M(landed)} so far against ${M(p.cost)} paid.` };
}

/** Owners and lenders each want a return; the company must earn the weighted average of the two. */
export function blend(t, p, W, H) {
  const w = p.wE / 100, avg = w * p.ke + (1 - w) * p.kd, u = ease(seg(t, 0.05, 0.6)), a = ease(seg(t, 0.6, 0.95)), pad = Math.max(24, W * 0.08), BW = W - 2 * pad, base = H - 82, hmax = base - 60, hi = Math.max(p.ke, p.kd) * 1.1, sc = hmax / hi, gap = 4;
  const wE = BW * w - gap / 2, wD = BW * (1 - w) - gap / 2;
  let g = line(pad, base, W - pad, base, { k: 'floor', w: 2.4 }) + box(pad, base - p.ke * sc * u, wE, p.ke * sc * u, { fill: NAVY, k: 'own', r: 10 }) + box(pad + BW * w + gap / 2, base - p.kd * sc * u, wD, p.kd * sc * u, { fill: GOLD, k: 'lend', r: 10 });
  g += ink(pad + wE / 2, base - p.ke * sc - 17, `${nf(p.ke * u, 1)}%`, { z: 20 }) + (wD > 40 ? ink(pad + BW * w + gap / 2 + wD / 2, base - p.kd * sc - 17, `${nf(p.kd * u, 1)}%`, { z: 20 }) : '');
  g += ink(pad + wE / 2, base + 20, `Owners ${p.wE}%`, { z: 16 }) + (wD > 70 ? ink(pad + BW * w + gap / 2 + wD / 2, base + 20, `Lenders ${100 - p.wE}%`, { z: 16 }) : '') + ink(pad + wE / 2, base + 40, 'want this return', { z: 12.5, ...MUTE });
  g += line(pad - 6, base - avg * sc * a, W - pad + 6, base - avg * sc * a, { k: 'avg', dash: 7, c: 'var(--c4)', w: 3 }) + note(W / 2, 20, `Company must earn ${nf(avg * a, 2)}%`, { k: 'must', fill: GOLD, z: 15.5 });
  return { svg: g, cap: a < 0.99 ? 'Owners and lenders each want a different return.' : `Blend: ${p.wE}% × ${nf(p.ke, 1)}% + ${100 - p.wE}% × ${nf(p.kd, 1)}% = ${nf(avg, 2)}%. A new project must earn more than this to be worth it.` };
}

/** Lemonade: first each cup pays off the rent, then every cup is profit. */
export function breakeven(t, p, W, H) {
  if (p.price <= p.cost) return { svg: ink(W / 2, H * 0.4, 'Every cup loses money', { z: 27, c: 'var(--bad)' }) + ink(W / 2, H * 0.58, `Cost $${p.cost} is not below price $${p.price}`, { z: 16, ...MUTE }), cap: `The cost per cup ($${p.cost}) is at or above the price ($${p.price}), so every cup loses money and the rent is never paid. Lower the cost or raise the price.` };
  const mg = Math.max(0.01, p.price - p.cost), be = Math.ceil(p.fixed / mg), maxC = Math.ceil(be * 2.2), cups = Math.round(t * maxC), paid = Math.min(p.fixed, cups * mg), profit = Math.max(0, cups * mg - p.fixed), pad = Math.max(24, W * 0.08), BW = W - 2 * pad, pmax = Math.max(1, maxC * mg - p.fixed);
  const cx = W / 2 - 78;
  let g = pen(`M${cx - 12} 14 L${cx + 12} 14 L${cx + 8} 42 L${cx - 8} 42 Z`, { w: 2.4, fill: GOLD }) + line(cx + 6, 14, cx + 14, 4, { k: 'straw', w: 2.4 }) + ink(W / 2 + 14, 30, `${cups} cups sold`, { z: 29 });
  g += ink(pad, 84, 'Step 1: pay the rent', { a: 'start', z: 16 }) + ink(W - pad, 84, `${M(paid)} of ${M(p.fixed)}`, { a: 'end', z: 15, ...MUTE }) + box(pad, 98, BW, 28, { fill: 'var(--soft)', k: 'rent0', r: 14 }) + box(pad, 98, BW * paid / p.fixed, 28, { fill: paid >= p.fixed ? GREEN : NAVY, k: 'rent1', r: 14 });
  g += ink(pad, 164, 'Step 2: keep the profit', { a: 'start', z: 16, c: paid >= p.fixed ? 'var(--ink)' : 'var(--mute)' }) + ink(W - pad, 164, M(profit), { a: 'end', z: 16, c: 'var(--good)' }) + box(pad, 178, BW, 28, { fill: 'var(--soft)', k: 'prof0', r: 14 }) + box(pad, 178, BW * profit / pmax, 28, { fill: GREEN, k: 'prof1', r: 14 });
  return { svg: g + track(t, W, H, `Each cup adds ${M(mg)} after its own cost`), cap: cups < be ? `Each cup adds ${M(mg)} toward the rent. ${M(p.fixed - paid)} still to cover. Not profitable yet.` : cups === be ? `Break-even! The rent is paid with cup number ${be}.` : `Rent is paid. Every extra cup is ${M(mg)} of pure profit. You made ${M(profit)} so far.` };
}

/** Shelf days, customer days and supplier days on one timeline: the gap is how long your cash is stuck. */
export function cycle(t, p, W, H) {
  const total = Math.max(p.dio + p.dso, p.dpo) * 1.05, pad = Math.max(20, W * 0.05), X = d => pad + (W - 2 * pad) * d / total, day = t * total, stuck = p.dio + p.dso - p.dpo, bh = 30;
  const bar = (a, b, y, fill, label, id) => { const w = X(b) - X(a), fw = clamp(X(Math.min(b, Math.max(a, day))) - X(a), 0, w); return ink(pad, y - 15, label, { a: 'start', z: 14.5 }) + box(X(a), y, w, bh, { fill: 'var(--soft)', k: 'cy' + id, r: 9 }) + box(X(a), y, fw, bh, { fill, k: 'cf' + id, r: 9 }); };
  let g = line(X(day), 40, X(day), 240, { k: 'now', dash: 6, c: 'var(--mute)', w: 2 }) + bar(0, p.dio, 58, NAVY, `Goods sit on the shelf: ${p.dio} days`, 1) + bar(p.dio, p.dio + p.dso, 114, GREEN, `Customers take to pay: ${p.dso} days`, 2) + bar(0, p.dpo, 170, GOLD, `You pay your supplier: day ${p.dpo}`, 3);
  if (stuck > 0) g += box(X(p.dpo), 212, X(p.dio + p.dso) - X(p.dpo), 24, { fill: RED, fo: day >= p.dio + p.dso ? 1 : 0.4, k: 'stuck', r: 8 }) + ink((X(p.dpo) + X(p.dio + p.dso)) / 2, 224, X(p.dio + p.dso) - X(p.dpo) > 110 ? `Stuck ${stuck} days` : `${stuck}d`, { z: 13.5 });
  return { svg: g + track(t, W, H, `Day ${Math.round(day)}`), cap: stuck > 0 ? `You pay your supplier on day ${p.dpo} but customers only pay you by day ${p.dio + p.dso}. Your cash is stuck for ${stuck} days.` : 'Customers pay you before you must pay suppliers. No cash is stuck, which is great.' };
}

/** Profit, shares and profit per share before and after a takeover. */
export function merge(t, p, W, H) {
  const d = (k, v) => (p[k] != null ? p[k] : v), aNI = d('aNI', 500), aSh = d('aSh', 100), aPx = d('aPx', 60), tNI = d('tNI', 100), tSh = d('tSh', 40), tPx = d('tPx', 30), prem = d('prem', 30), rate = d('rate', 6), tax = d('tax', 25), syn = d('syn', 20), st = d('stock', 50) / 100;
  const price = tPx * (1 + prem / 100) * tSh, newSh = price * st / aPx, intAT = price * (1 - st) * rate / 100 * (1 - tax / 100), ni = aNI + tNI + syn * (1 - tax / 100) - intAT, sh = aSh + newSh, e0 = aNI / aSh, e1 = ni / sh;
  const pad = Math.max(16, W * 0.04), gap = 14, pw = (W - 2 * pad - 2 * gap) / 3, base = H - 78, hmax = base - 76;
  const panel = (i, title, v0, v1, fmt, fill1, a) => {
    const x = pad + i * (pw + gap), top = Math.max(v0, v1) * 1.1, bw = Math.min(54, pw * 0.3), h0 = hmax * v0 / top, h1 = hmax * v1 / top * a, x0 = x + pw * 0.27, x1 = x + pw * 0.73;
    return box(x, 30, pw, base + 2, { fill: 'var(--soft)', fo: 0.6, k: 'pn' + i, r: 14, w: 2 }) + ink(x + pw / 2, 48, title, { z: pw < 95 ? 12.5 : 15 }) + box(x0 - bw / 2, base - h0, bw, h0, { fill: NAVY, k: 'b0' + i, r: 8 }) + box(x1 - bw / 2, base - h1, bw, h1, { fill: fill1, k: 'b1' + i, r: 8 }) + ink(x0, base - h0 - 13, fmt(v0), { z: pw < 95 ? 12 : 14 }) + ink(x1, base - hmax * v1 / top - 13, fmt(v1 * a), { z: pw < 95 ? 12 : 14 }) + (pw < 95 ? '' : ink(x0, base + 17, 'Before', { z: 12.5, ...MUTE }) + ink(x1, base + 17, 'After', { z: 12.5, ...MUTE }));
  };
  const a1 = ease(seg(t, 0.05, 0.4)), a2 = ease(seg(t, 0.35, 0.7)), a3 = ease(seg(t, 0.65, 0.98));
  const nar = pw < 95, g = panel(0, nar ? 'Profit' : 'Profit ($M)', aNI, ni, x => nf(x, 0), GREEN, a1) + panel(1, nar ? 'Shares' : 'Shares (M)', aSh, sh, x => nf(x, 0), GOLD, a2) + panel(2, nar ? 'Per share' : 'Profit per share', e0, e1, x => money(x, 2), e1 >= e0 ? GREEN : RED, a3);
  return { svg: g + track(t, W, H, nar ? 'Left bar before, right bar after' : 'Profit ÷ shares'), cap: a3 < 0.99 ? 'Profit grows when the two companies join, and new shares may be created to pay for the deal.' : `Profit per share moves from ${money(e0, 2)} to ${money(e1, 2)}: ${e1 >= e0 ? 'a good deal for existing owners (accretive)' : 'a bad deal for existing owners (dilutive)'}, ${nf((e1 / e0 - 1) * 100, 1)}%.` };
}

/** What an option ticket is worth at the end: nothing below the strike, the difference above it, less the fee. */
export function option(t, p, W, H) {
  const S = p.K * lerp(0.6, 1.4, ease(t)), profit = Math.max(0, S - p.K) - p.prem, lo = p.K * 0.6, hi = p.K * 1.4, pad = Math.max(34, W * 0.08), X = s => pad + (W - 2 * pad) * (s - lo) / (hi - lo), top = 84, bot = H - 78, maxP = Math.max(10, hi - p.K - p.prem), span = maxP + p.prem, zero = top + (bot - top) * (maxP / span), Y = v => zero - (bot - top) * v / span;
  const col = profit >= 0 ? 'var(--good)' : 'var(--warn)';
  let g = ink(pad, 18, 'Your profit or loss at the end', { a: 'start', z: 14.5, ...MUTE }) + ink(W - pad, 20, `${profit >= 0 ? '+' : '−'}${M(Math.abs(profit))}`, { a: 'end', z: 28, c: col }) + line(pad, zero, W - pad, zero, { k: 'zero', c: 'var(--mute)', w: 2.2 });
  g += poly([[X(lo), Y(-p.prem)], [X(p.K), Y(-p.prem)], [X(hi), Y(hi - p.K - p.prem)]], { w: 4, c: 'var(--pill-on)' }) + line(X(p.K), 64, X(p.K), bot + 6, { k: 'strike', dash: 6, c: 'var(--mute)', w: 1.8 }) + ink(X(p.K), 52, `Strike ${M(p.K)}`, { z: 13.5, ...MUTE });
  g += line(X(S), Y(profit), X(S), bot + 6, { k: 'now', dash: 5, c: col, w: 2 }) + dot(X(S), Y(profit), 8, profit >= 0 ? 'var(--good)' : 'var(--c4)', { sw: 2 }) + ink(clamp(X(S), pad + 30, W - pad - 30), bot + 22, `Stock ${M(S)}`, { z: 16 });
  return { svg: g + track(t, W, H, 'Stock price at the end'), cap: S <= p.K ? `The stock is at ${M(S)}, below the strike of ${M(p.K)}. The ticket is worthless. You lose only the ${M(p.prem)} fee.` : `The stock is at ${M(S)}. Your ticket lets you buy at ${M(p.K)}, worth ${M(S - p.K)}. After the ${M(p.prem)} fee, you ${profit >= 0 ? 'profit' : 'lose'} ${M(Math.abs(profit))}.` };
}

export const MAKING_DECISIONS = { npv, blend, breakeven, cycle, merge, option };
