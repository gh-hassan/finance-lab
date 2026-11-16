// @ts-nocheck
/* The "Money and time" lesson pictures, drawn in the same hand-drawn style as the home page story.
   Each function is draw(t, p, W, H) like every scene: t runs 0 to 1, p holds the sliders, and W x H is the real size in pixels. */
import { compact, money, nf, sum } from '../lib/math';
import { box, ink, line, curve, ring, arrow, coin, bill, person, track, key, tick, pen, clamp01, NAVY, GREEN, GOLD, GREY, RED } from './doodle-kit.js';

const M = x => (Math.abs(x) >= 1e6 ? compact(x) : money(x, 0));
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const lerp = (a, b, u) => a + (b - a) * u;
const ease = u => 1 - Math.pow(1 - clamp(u, 0, 1), 3);
const seg = (t, a, b) => clamp((t - a) / (b - a), 0, 1);
export const note = (cx, cy, s, o = {}) => { const w = s.length * 8.2 + 26; return box(cx - w / 2, cy - 15, w, 30, { fill: 'var(--panel-solid)', outline: false, r: 10 }) + box(cx - w / 2, cy - 15, w, 30, { fill: o.fill || 'var(--soft)', k: o.k || 'note', r: 10, w: 2 }) + ink(cx, cy, s, { z: o.z || 14.5 }); };

/** Sam lends money to Alex, who pays it back with a fee: the fee is the interest. */
export function rent(t, p, W, H) {
  const fee = p.amount * p.rate / 100, pad = Math.max(26, W * 0.08), a = seg(t, 0.04, 0.3), b = seg(t, 0.3, 0.58), c = seg(t, 0.6, 0.94);
  const k = clamp(H / 330, 0.7, 1.05), feet = H * 0.57, ax = pad + 30, bx = W - pad - 30, topY = H * 0.26, x0 = ax + 78, x1 = bx - 78;
  let g = line(pad, feet, W - pad, feet, { k: 'ground', c: 'var(--mute)', w: 2.2 });
  g += curve([[x0 - 10, topY + 24], [(x0 + x1) / 2, topY - 6], [x1 + 10, topY + 24]], { k: 'arc', dash: 6, c: 'var(--mute)', w: 2 });
  g += person(ax, feet, k, { id: 'sam', mood: c > 0 ? 'happy' : 'neutral', arms: a > 0 && a < 1 ? 'point' : 'down' }) + person(bx, feet, k, { id: 'alex', mood: b > 0 && c === 0 ? 'happy' : 'neutral', arms: 'down' });
  g += ink(ax, feet + 22, 'Sam', { z: 17 }) + ink(ax, feet + 40, 'lender', { z: 12.5, c: 'var(--mute)', hand: false }) + ink(bx, feet + 22, 'Alex', { z: 17 }) + ink(bx, feet + 40, 'borrower', { z: 12.5, c: 'var(--mute)', hand: false });
  if (c === 0) g += bill(a < 1 ? lerp(x0, x1, ease(a)) : x1, topY + 4, 78, 32, M(p.amount), { k: 'money' });
  else { const x = lerp(x1, x0, ease(c)); g += bill(x, topY + 4, 78, 32, M(p.amount), { k: 'money' }) + bill(x, topY - 34, 104, 30, '+ ' + M(fee) + ' fee', { k: 'fee', fill: GREEN, z: 13 }); }
  const lab = c > 0 ? 'Alex pays it back, plus a fee' : b > 0 ? 'Alex uses the money for a year' : a > 0 ? 'Sam lends the money' : 'Sam has money to lend';
  g += ink(W / 2, H * 0.8, lab, { z: 17 }) + note(W / 2, H * 0.925, `${p.rate}% of ${M(p.amount)} = ${M(fee)} interest`, { k: 'eq' });
  return { svg: g, cap: c >= 1 ? `Done. Sam gets ${M(p.amount + fee)} back. The extra ${M(fee)} is the interest: ${p.rate}% of ${M(p.amount)}.` : c > 0 ? `Alex pays back ${M(p.amount)} plus ${M(fee)} extra.` : b > 0 ? 'Alex uses the money for a year, maybe to buy tools for his shop.' : a > 0 ? `Sam hands over ${M(p.amount)}.` : `Sam has ${M(p.amount)} to lend.` };
}

/** A jar that only keeps money, next to a bank that adds interest. */
export function growth(t, p, W, H) {
  const m = p.mpy || 1, im = p.rate / 100 / m, val = y => { const g = Math.pow(1 + im, m * y); return p.start * g + (p.add / m) * (im ? (g - 1) / im : m * y); };
  const y = t * p.years, dep = p.start + p.add * y, bank = val(y), top = Math.max(val(p.years), 1), base = H - 100, hmax = base - 50, sc = hmax / top, bw = Math.min(120, W * 0.24), c1 = W * 0.27, c2 = W * 0.73, pad = Math.max(20, W * 0.06);
  let g = line(pad, base, W - pad, base, { k: 'floor', w: 2.4 });
  g += box(c1 - bw / 2, base - dep * sc, bw, dep * sc, { fill: GREY, k: 'jar', r: 10 }) + box(c2 - bw / 2, base - dep * sc, bw, dep * sc, { fill: GREY, k: 'bk0', r: 10, outline: false }) + box(c2 - bw / 2, base - bank * sc, bw, bank * sc, { fill: GREEN, k: 'bk1', r: 10 });
  g += line(c1 - bw / 2 - 6, base - dep * sc - 2, c1 + bw / 2 + 6, base - dep * sc - 2, { k: 'lid', w: 3 });
  g += ink(c1, base - hmax - 14, M(dep), { z: 21 }) + ink(c2, base - hmax - 14, M(bank), { z: 21, c: 'var(--good)' });
  /* little pictures of a jar and a bank next to the labels (left out on a narrow screen, where the words need the room) */
  const wide = W >= 430;
  if (wide) {
    g += box(c1 - 62, base + 11, 20, 22, { k: 'ji', r: 4, w: 2 }) + line(c1 - 65, base + 9, c1 - 39, base + 9, { k: 'jl', w: 2.4 });
    g += pen(`M${c2 - 66} ${base + 17} L${c2 - 52} ${base + 8} L${c2 - 38} ${base + 17} Z`, { w: 2 }) + [0, 1, 2].map(i => line(c2 - 63 + i * 10, base + 19, c2 - 63 + i * 10, base + 32, { k: 'pil' + i, w: 2 })).join('');
  }
  g += ink(wide ? c1 + 12 : c1, base + 22, 'In a jar', { z: 16, a: wide ? 'start' : 'middle' }) + ink(c1, base + 44, 'no interest', { z: 12.5, c: 'var(--mute)', hand: false }) + ink(wide ? c2 + 8 : c2, base + 22, 'In the bank', { z: 16, a: wide ? 'start' : 'middle' }) + ink(c2, base + 44, `${M(Math.max(0, bank - dep))} from interest`, { z: 12.5, c: 'var(--good)', hand: false });
  g += track(t, W, H, `Year ${Math.round(y)} of ${p.years}`);
  return { svg: g, cap: `Year ${Math.round(y)}: the jar has ${M(dep)}. The bank has ${M(bank)}. That is ${M(bank - dep)} of interest earned.` };
}

/** Interest that earns interest, drawn as a pile that climbs faster every year. */
export function snowball(t, p, W, H) {
  const N = Math.max(2, Math.round(p.years)), r = p.rate / 100, m = p.m || 1, fv = k => p.start * Math.pow(1 + r / m, m * k), top = fv(N), pad = Math.max(20, W * 0.06), base = H - 62, hmax = base - 92, sc = hmax / top, cw = (W - 2 * pad) / N, bw = Math.max(3, cw * 0.74), pos = t * N, n = Math.floor(pos + 1e-9);
  let g = key([[NAVY, 'Your money'], [GREEN, 'Interest'], [GOLD, 'Interest on interest']], pad, 16, W - pad) + line(pad, base, W - pad, base, { k: 'floor', w: 2.4 });
  for (let k = 1; k <= Math.min(N, n + 1); k++) {
    const grow = k <= n ? 1 : ease(pos - n), x = pad + (k - 0.5) * cw - bw / 2, own = p.start * sc, simple = p.start * r * k * sc, rest = Math.max(0, fv(k) - p.start - p.start * r * k) * sc;
    const hs = [own, simple, rest].map(v => v * grow); let yy = base;
    [[NAVY, hs[0]], [GREEN, hs[1]], [GOLD, hs[2]]].forEach(([c, hh]) => { yy -= hh; if (hh > 0.4) g += `<rect x="${x.toFixed(1)}" y="${yy.toFixed(1)}" width="${bw.toFixed(1)}" height="${hh.toFixed(1)}" fill="${c}"/>`; });
    g += box(x, base - (hs[0] + hs[1] + hs[2]), bw, hs[0] + hs[1] + hs[2], { k: 'sb' + k, r: 2, w: bw < 10 ? 1.4 : 2.1, amt: Math.min(1.2, bw / 5) });
  }
  const k = clamp(Math.round(pos), 0, N), now = fv(k), simple = p.start * r * k, rad = lerp(11, 30, clamp(now / top, 0, 1));
  g += ring(W - pad - 38, 66, rad, rad, { k: 'ball', w: 2.4 }) + `<circle cx="${W - pad - 38}" cy="66" r="${rad.toFixed(1)}" fill="var(--soft)"/>` + line(W - pad - 38 - rad - 20, 62, W - pad - 38 - rad - 8, 62, { k: 'sp1', w: 2, c: 'var(--mute)' }) + line(W - pad - 38 - rad - 16, 72, W - pad - 38 - rad - 6, 72, { k: 'sp2', w: 2, c: 'var(--mute)' });
  g += ink(pad, 50, `Year ${k}: ${M(now)}`, { a: 'start', z: 22 }) + ink(pad, base + 20, '0', { a: 'start', z: 12.5, c: 'var(--mute)', hand: false }) + ink(W / 2, base + 20, `Year ${Math.round(N / 2)}`, { z: 12.5, c: 'var(--mute)', hand: false }) + ink(W - pad, base + 20, `Year ${N}`, { a: 'end', z: 12.5, c: 'var(--mute)', hand: false });
  return { svg: g, cap: `Year ${k}: ${M(now)}. Of the growth, ${M(simple)} is interest on your starting money and ${M(Math.max(0, now - p.start - simple))} is interest on earlier interest.` };
}

/** A basket of shopping that costs more each year, so the same money buys fewer things. */
export function inflation(t, p, W, H) {
  const y = t * p.years, f = Math.pow(1 + p.infl / 100, y), power = 1 / f, pad = Math.max(24, W * 0.08), bw = W - 2 * pad, cy = H * 0.5;
  const items = 6, shown = Math.ceil(power * items - 1e-6), gap = Math.min(54, bw / items), x0 = W / 2 - gap * (items - 1) / 2;
  let g = ink(W / 2, H * 0.08, 'A basket of groceries that cost $100 today', { z: 14.5, c: 'var(--mute)', hand: false }) + ink(W / 2, H * 0.2, `now costs ${M(100 * f)}`, { z: 32, c: 'var(--ink)' });
  /* the basket and what is left that your $100 can still buy */
  const tops = [(x, yy, d) => { const g1 = ring(x, yy, 11, 11, { k: 'ap' + d, w: 2.2, fill: d ? 'none' : RED, dash: d }); return g1 + line(x, yy - 11, x + 3, yy - 17, { k: 'st' + d, w: 2, op: d ? 0.4 : 1 }); },
    (x, yy, d) => box(x - 8, yy - 14, 16, 26, { k: 'mk' + d, fill: d ? undefined : NAVY, r: 3, w: 2.2, dash: d }), (x, yy, d) => ring(x, yy, 14, 9, { k: 'br' + d, w: 2.2, fill: d ? 'none' : GOLD, dash: d }),
    (x, yy, d) => ring(x, yy, 9, 12, { k: 'eg' + d, w: 2.2, fill: d ? 'none' : 'var(--soft)', dash: d }), (x, yy, d) => pen(`M${x - 6} ${yy - 12} L${x + 6} ${yy - 12} L${x} ${yy + 14} Z`, { w: 2.2, fill: d ? 'none' : GREEN, dash: d }), (x, yy, d) => box(x - 10, yy - 11, 20, 22, { k: 'cn' + d, fill: d ? undefined : GREY, r: 5, w: 2.2, dash: d })];
  const zoom = clamp(W / 440, 1, 1.7); let bsk = '';
  for (let i = 0; i < items; i++) bsk += tops[i](x0 + i * gap, cy - 8, i < shown ? 0 : 4);
  bsk += pen(`M${x0 - gap * 0.6} ${cy + 6} L${x0 + gap * (items - 1) + gap * 0.6} ${cy + 6} L${x0 + gap * (items - 1) + gap * 0.42} ${cy + 36} L${x0 - gap * 0.42} ${cy + 36} Z`, { w: 2.6, fill: 'var(--panel-solid)', k: 'bsk' });
  g += `<g transform="translate(${W / 2} ${cy}) scale(${zoom.toFixed(2)}) translate(${-W / 2} ${-cy})">${bsk}</g>`;
  g += ink(W / 2, H * 0.75, `Your $100 now buys ${nf(power * 100, 0)}% of the basket`, { z: 17, c: power < 0.7 ? 'var(--bad)' : 'var(--ink)' });
  g += box(pad, H * 0.8, bw, 20, { fill: 'var(--soft)', k: 'sbar', r: 10, w: 2 }) + box(pad, H * 0.8, bw * power, 20, { fill: GREEN, k: 'fbar', r: 10, w: 2 });
  g += track(t, W, H, `Year ${Math.round(y)} of ${p.years}`);
  return { svg: g, cap: `Year ${Math.round(y)}: the basket costs ${M(100 * f)}. Your $100 buys ${nf(power * 100, 0)}% of it, so your money lost ${nf((1 - power) * 100, 0)}% of its buying power.` };
}

/** What a promise of money later is worth today: a dashed bar for the promise, a solid bar for today's worth. */
export function present(t, p, W, H) {
  const flows = p.flows && p.flows.length ? p.flows : [{ y: p.years, a: p.amount }], r = p.rate / 100, N = Math.max(...flows.map(f => f.y)), u = ease(t), pad = Math.max(20, W * 0.05), base = H - 82, hmax = base - 72;
  const nominal = sum(flows.map(f => f.a)), maxCol = Math.max(nominal, ...flows.map(f => f.a), 1), sc = hmax / maxCol, slot = (W - 2 * pad) / (N + 1), bw = clamp(slot * 0.62, 6, 46);
  let g = line(pad, base, W - pad, base, { k: 'floor', w: 2.4 }) + ink(pad, 14, 'Dashed = promised. Solid = worth today.', { a: 'start', z: 13.5, c: 'var(--mute)', hand: false });
  let now = 0, pv = 0; const few = flows.length <= 8;
  flows.forEach((f, i) => {
    const val = f.a / Math.pow(1 + r, f.y * u); now += val; pv += f.a / Math.pow(1 + r, f.y); const cx = pad + (f.y + 0.5) * slot;
    g += box(cx - bw / 2, base - f.a * sc, bw, f.a * sc, { k: 'pr' + i, dash: 5, w: 1.8, r: 6, c: 'var(--mute)' }) + box(cx - bw / 2, base - val * sc, bw, val * sc, { k: 'wv' + i, fill: GREEN, r: 6, w: bw < 12 ? 1.5 : 2.2 });
    if (few) g += ink(cx, base - f.a * sc - 14, M(val), { z: 14.5 });
  });
  const px = pad + 0.5 * slot, pw = clamp(slot * 0.8, 10, 60);
  g += box(px - pw / 2, base - now * sc, pw, now * sc, { fill: NAVY, k: 'today', r: 6 }) + ink(px, base - Math.max(nominal, 1) * sc - 18, M(now), { z: 19, c: 'var(--pill-on)' }) + ink(px, base + 16, 'Today', { z: 13.5 });
  const step = Math.max(N <= 12 ? 1 : Math.ceil(N / 6), Math.ceil(40 / slot));
  for (let k = step; k <= N; k += step) g += ink(pad + (k + 0.5) * slot, base + 16, slot * step > 50 ? 'Yr ' + k : '' + k, { z: 12.5, c: 'var(--mute)', hand: false });
  const cap = u < 0.03 ? `These payments add up to ${M(nominal)} on paper.` : u < 0.999 ? `Bringing them back to today at ${p.rate}% a year, each one shrinks.` : `Worth ${p.result || M(pv)} today, not ${M(nominal)}. Waiting costs money.`;
  return { svg: g + track(t, W, H, 'Bringing the money back to today'), cap };
}

/** Swapping money into another country's money and back leaves you where staying home would: no free money. */
export function exchange(t, p, W, H) {
  const A = 1000, fgn = A / p.S, home = A * Math.pow(1 + p.id / 100, p.T), F = p.S * Math.pow((1 + p.id / 100) / (1 + p.if / 100), p.T), abroad = fgn * Math.pow(1 + p.if / 100, p.T) * F;
  const b = ease(seg(t, 0.12, 0.7)), c = ease(seg(t, 0.72, 0.98)), top = Math.max(home, abroad) * 1.08, base = H - 82, hmax = base - 74, sc = hmax / top, bw = Math.min(116, W * 0.22), c1 = W * 0.28, c2 = W * 0.72, pad = Math.max(20, W * 0.06);
  const hv = lerp(A, home, b), av = lerp(A, abroad, b);
  let g = ink(W / 2, 16, `Start: ${M(A)} = ${nf(fgn, 0)} foreign money at ${nf(p.S, 2)}`, { z: 14, c: 'var(--mute)', hand: false }) + line(pad, base, W - pad, base, { k: 'floor', w: 2.4 });
  g += box(c1 - bw / 2, base - hv * sc, bw, hv * sc, { fill: NAVY, k: 'home', r: 10 }) + box(c2 - bw / 2, base - av * sc, bw, av * sc, { fill: GOLD, k: 'away', r: 10 });
  g += ink(c1, base - home * sc - 16, M(hv), { z: 21 }) + ink(c2, base - abroad * sc - 16, M(av), { z: 21 });
  g += arrow(c1 + bw / 2 + 8, base - hmax * 0.55, c2 - bw / 2 - 8, base - hmax * 0.55, { k: 'swap', u: ease(seg(t, 0.02, 0.14)), c: 'var(--mute)', w: 2.2 }) + (c > 0 ? arrow(c2 - bw / 2 - 8, base - hmax * 0.4, c1 + bw / 2 + 8, base - hmax * 0.4, { k: 'back', u: c, c: 'var(--mute)', w: 2.2 }) : '');
  g += ink(c1, base + 20, 'Stay home', { z: 16 }) + ink(c1, base + 40, `earns ${p.id}%`, { z: 12.5, c: 'var(--mute)', hand: false }) + ink(c2, base + 20, 'Swap, earn abroad, swap back', { z: 14.5 }) + ink(c2, base + 40, `earns ${p.if}%, swaps back at ${nf(lerp(p.S, F, c), 3)}`, { z: 12.5, c: 'var(--mute)', hand: false });
  return { svg: g, cap: t < 0.7 ? `Both piles grow: home at ${p.id}%, foreign at ${p.if}%.` : `After ${p.T} yr the foreign pile is swapped back at the fair future rate of ${nf(F, 3)}. Both end at about ${M(home)}: no free money.` };
}

export const MONEY_AND_TIME = { rent, growth, snowball, inflation, present, exchange };

/** Paying off a loan: the tank of what you owe empties, and each payment is split between the bank's fee and the loan itself. */
export function loan(t, p, W, H) {
  const i = p.apr / 1200, n = Math.round(p.years * 12), base = i ? p.amt * i / (1 - Math.pow(1 + i, -n)) : p.amt / n, pay = base + (p.extra || 0), mth = Math.max(1, Math.min(n, Math.ceil(t * n)));
  let bal = p.amt, iPaid = 0, pPaid = 0, int = 0, pr = 0;
  for (let k = 1; k <= mth && bal > 0.01; k++) { int = bal * i; const pay2 = Math.min(pay, bal + int); pr = pay2 - int; bal = Math.max(0, bal - pr); iPaid += int; pPaid += pr; }
  const pad = Math.max(20, W * 0.06), tw = Math.min(110, W * 0.22), ty = 40, th = H - 108, lvl = bal / p.amt, rx = pad + tw + Math.max(22, W * 0.06), rw = W - pad - rx, share = int / Math.max(0.01, int + pr);
  let g = ink(pad + tw / 2, 16, 'You still owe', { z: 14.5, c: 'var(--mute)' }) + box(pad, ty, tw, th, { fill: 'var(--soft)', k: 'tank', r: 14 }) + box(pad, ty + th * (1 - lvl), tw, th * lvl, { fill: GOLD, k: 'water', r: 12, outline: false });
  g += box(pad, ty, tw, th, { k: 'tank2', r: 14 }) + ink(pad + tw / 2, ty + th / 2, M(bal), { z: clamp(tw / (M(bal).length * 0.64), 11, 19) });
  g += ink(rx, 22, W < 430 ? `Payment: ${M(pay)}` : `Your monthly payment: ${M(pay)}`, { a: 'start', z: W < 430 ? 15 : 17 }) + box(rx, 44, rw, 34, { fill: GREEN, k: 'payb', r: 10 }) + box(rx, 44, rw * share, 34, { fill: GOLD, k: 'intb', r: 10 });
  if (rw * share > 70) g += ink(rx + (rw * share) / 2, 61, 'interest', { z: 14 });
  if (rw * (1 - share) > 90) g += ink(rx + rw * share + (rw * (1 - share)) / 2, 61, 'pays the loan', { z: 14 });
  g += ink(rx, 100, `Fee ${M(int)}`, { a: 'start', z: 15, c: 'var(--warn)' }) + ink(rx + rw, 100, `Loan ${M(pr)}`, { a: 'end', z: 15, c: 'var(--good)' });
  g += line(rx, 118, rx + rw, 118, { k: 'sep', c: 'var(--line)', w: 2 }) + ink(rx, 140, 'Paid so far', { a: 'start', z: 14, c: 'var(--mute)' }) + ink(rx, 166, `${M(iPaid)} in interest`, { a: 'start', z: W < 430 ? 14.5 : 17, c: 'var(--warn)' }) + ink(rx, 192, `${M(pPaid)} on the loan`, { a: 'start', z: W < 430 ? 14.5 : 17, c: 'var(--good)' });
  return { svg: g + track(t, W, H, `Year ${nf(mth / 12, 1)} of ${p.years}`), cap: `Month ${mth}: out of ${M(pay)}, ${M(int)} is interest and ${M(pr)} reduces what you owe. You still owe ${M(bal)}.` };
}

/** A bond: you lend money, a coupon drops into your pocket each year, and at the end you get the loan back. */
export function bond(t, p, W, H) {
  const N = Math.round(p.years), c = p.face * p.cr / 100, cy = t * N, pad = Math.max(20, W * 0.06), pw = Math.min(100, W * 0.2), px = W - pad - pw, narrow = W < 430, tlw = narrow ? W - 2 * pad : px - pad - 100, base = H - (narrow ? 66 : 80), hmax = base - (narrow ? 158 : 66), top = p.face + c * N, sc = hmax / top;
  let got = 0; for (let k = 1; k <= N; k++) if (cy >= k) got += c + (k === N ? p.face : 0);
  const lineY = narrow ? 78 : 124, X = k => pad + 26 + (tlw - 52) * (k - 1) / Math.max(1, N - 1), gapX = (tlw - 52) / Math.max(1, N - 1), rr = clamp(gapX * 0.42, 14, 21), wide = gapX > 62;
  let g = note(pad + 78, 18, `You lend ${M(p.face)}`, { k: 'lend', fill: GOLD }) + line(pad + 8, lineY, narrow ? W - pad - 4 : px - 88, lineY, { k: 'tl', c: 'var(--line)', w: 4 });
  for (let k = 1; k <= N; k++) {
    const a = clamp(cy - k + 1, 0, 1), last = k === N, lab = last ? M(c + p.face) : M(c), r = last ? Math.max(rr + 6, lab.length * 3.9 + 8) : rr, yy = lineY - (1 - ease(a)) * 40;
    g += ink(X(k), lineY + 42, wide ? (last ? 'Final year' : 'Year ' + k) : (last ? 'End' : 'Y' + k), { z: 13, c: 'var(--mute)', hand: false });
    if (a > 0) g += `<g opacity="${a.toFixed(2)}"><circle cx="${X(k).toFixed(1)}" cy="${yy.toFixed(1)}" r="${r.toFixed(1)}" fill="${GOLD}"/>` + ring(X(k), yy, r, r, { k: 'cn' + k, w: 2.3 }) + ink(X(k), yy, lab, { z: Math.min(14, (2 * r - 5) / (lab.length * 0.6)) }) + '</g>';
    else g += `<circle cx="${X(k).toFixed(1)}" cy="${lineY}" r="4" fill="var(--mute)"/>`;
  }
  g += line(px - 8, base - p.face * sc, px + pw + 8, base - p.face * sc, { k: 'lent', dash: 5, c: 'var(--mute)', w: 1.8 }) + ink(px - 12, base - p.face * sc, `lent ${M(p.face)}`, { a: 'end', z: 13, c: 'var(--mute)' }) + box(px, base - got * sc, pw, got * sc, { fill: GREEN, k: 'pocket', r: 10 });
  g += ink(px + pw / 2, base - hmax - 16, M(got), { z: 20, c: 'var(--good)' }) + ink(px + pw / 2, base + 20, 'In your pocket', { z: 14.5 });
  return { svg: g + track(t, W, H, `Year ${Math.min(N, Math.floor(cy))} of ${N}`), cap: cy < 0.05 ? `You lend ${M(p.face)} by buying the bond.` : cy < N - 0.02 ? `Year ${Math.floor(cy)}: another ${M(c)} drops into your pocket (${p.cr}% of ${M(p.face)}).` : `Finished. You got ${M(c * N)} in payments plus your ${M(p.face)} back = ${M(c * N + p.face)}.${p.result ? ' Today it is worth ' + p.result + ' to buyers.' : ''}` };
}

export const BORROWING_AND_LENDING = { loan, bond };
