// @ts-nocheck
/* The "Owning things" and "Risk" lesson pictures, drawn by hand in the same style as the home page story.
   Each function is draw(t, p, W, H): t runs 0 to 1, p holds the sliders, and W x H is the real size in pixels. */
import { compact, money, nf, sum } from '../lib/math';
import { box, ink, line, pen, poly, dot, track, key, NAVY, GREEN, GOLD, GREY, RED } from './doodle-kit.js';
import { note } from './lesson-doodles.js';
import { series } from './scene-random.js';

const M = x => (Math.abs(x) >= 1e6 ? compact(x) : money(x, 0));
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const lerp = (a, b, u) => a + (b - a) * u;
const ease = u => 1 - Math.pow(1 - clamp(u, 0, 1), 3);
const seg = (t, a, b) => clamp((t - a) / (b - a), 0, 1);
const MUTE = { c: 'var(--mute)', hand: false };
const LIGHT = 'color-mix(in srgb,var(--pill-on) 12%,transparent)';

/** A pie cut into ten slices; you own some, and the profit paid out is shared slice by slice. */
export function stock(t, p, W, H) {
  const own = Math.round(p.own), R0 = Math.min(H * 0.34, W * 0.2), cx = Math.max(R0 + 24, W * 0.24), cy = H * 0.44, reveal = ease(seg(t, 0.05, 0.6)), pay = ease(seg(t, 0.55, 0.95)), share = p.profit * 0.5 / 10;
  let g = '';
  for (let k = 0; k < 10; k++) {
    const a0 = (k / 10) * 2 * Math.PI - Math.PI / 2, a1 = ((k + 1) / 10) * 2 * Math.PI - Math.PI / 2, rr = R0 * clamp(reveal * 1.4 - k * 0.04, 0, 1), pts = [[cx, cy]];
    for (let s = 0; s <= 6; s++) { const a = a0 + (a1 - a0) * s / 6; pts.push([cx + rr * Math.cos(a), cy + rr * Math.sin(a)]); }
    pts.push([cx, cy]); g += poly(pts, { fill: k < own ? GREEN : LIGHT, w: 2.4 });
  }
  g += ink(cx, cy + R0 + 26, `You own ${own} of 10 slices`, { z: 16 });
  const rx = cx + R0 + Math.max(30, W * 0.08), row = (y, label, value, c) => ink(rx, y, label, { a: 'start', z: 14, ...MUTE }) + ink(rx, y + 28, value, { a: 'start', z: 25, c });
  g += row(H * 0.14, 'The company earned', M(p.profit * reveal), 'var(--ink)') + row(H * 0.38, 'It pays half to its owners', M(p.profit / 2 * pay), 'var(--ink)') + row(H * 0.62, `Your ${own} slices get`, M(share * own * pay), 'var(--good)');
  return { svg: g, cap: pay < 0.02 ? 'The company makes a profit.' : pay < 0.99 ? 'Half the profit is paid out, shared equally between the 10 slices.' : `Each slice gets ${M(share)}. You own ${own} of 10 slices, so your dividend is ${M(share * own)}.` };
}

/** The same house bought with cash or with a loan: borrowing makes both the gain and the loss bigger. */
export function leverage(t, p, W, H) {
  const ch = p.change * ease(t), house = 100 * (1 + ch / 100), D = clamp(p.debt, 0, 95), E = 100 - D, interest = D * p.rate / 100 * ease(t), gain = house - 100, retCash = gain, retBorrow = (gain - interest) / E * 100;
  const base = H - 86, hmax = base - 58, sc = hmax / 140, bw = Math.min(120, W * 0.22), c1 = W * 0.27, c2 = W * 0.73, col = v => (v >= 0 ? 'var(--good)' : 'var(--warn)'), pad = Math.max(20, W * 0.06);
  const bar = (cx, debt, title, equity, ret, id) => {
    const he = equity * sc, hd = debt * sc, hg = Math.max(0, house - 100) * sc, hl = Math.max(0, 100 - house) * sc;
    let b = ink(cx, 16, title, { z: 16 }) + box(cx - bw / 2, base - he, bw, he, { fill: NAVY, k: 'e' + id, r: 8 }) + box(cx - bw / 2, base - he - hd, bw, hd, { fill: GOLD, k: 'd' + id, r: 8 }) + box(cx - bw / 2, base - he - hd - hg, bw, hg, { fill: GREEN, k: 'g' + id, r: 8 });
    if (hl > 1) b += box(cx - bw / 2, base - he - hd, bw, hl, { k: 'l' + id, r: 6, dash: 5, c: 'var(--bad)', w: 2 });
    return b + ink(cx, base - he / 2, 'your ' + M(equity), { z: 13.5 }) + (debt > 0 && hd > 24 ? ink(cx, base - he - hd / 2, 'borrowed ' + M(debt), { z: 13 }) : '') + ink(cx, base + 26, `${ret >= 0 ? '+' : '−'}${nf(Math.abs(ret), 0)}%`, { z: 29, c: col(ret) }) + ink(cx, base + 52, 'on your own money', { z: 12.5, ...MUTE });
  };
  const g = line(pad, base, W - pad, base, { k: 'floor', w: 2.4 }) + bar(c1, 0, 'All cash', 100, retCash, 1) + bar(c2, D, `Borrowing ${D}%`, E, retBorrow, 2);
  return { svg: g, cap: `The house is now worth ${M(house)} (${nf(ch, 0)}%). With cash only, you ${gain >= 0 ? 'gain' : 'lose'} ${nf(Math.abs(retCash), 0)}%. By borrowing, your ${M(E)} ${retBorrow >= 0 ? 'gains' : 'loses'} ${nf(Math.abs(retBorrow), 0)}%. Bigger swings both ways.` };
}

/** Three roads for $100: savings glide, bonds wobble, stocks zig-zag but climb higher. */
export function risk(t, p, W, H) {
  const lanes = [['Savings', 3, 0.6, 'var(--good)', GREEN], ['Bonds', 5, 5, 'var(--pill-on)', NAVY], ['Stocks', 9, 17, 'var(--c4)', GOLD]], N = 20, pad = Math.max(20, W * 0.06), rpad = Math.max(66, W * 0.14), top0 = 40;
  const data = lanes.map((l, i) => { const z = series((p.seed || 1) * 97 + i * 13, N); let v = 100; return [100, ...z.map(zz => (v *= 1 + (l[1] + l[2] * zz) / 100))]; });
  const top = Math.max(...data.flat()) * 1.06, bot = Math.min(...data.flat(), 100) * 0.94, base = H - 52, X = k => pad + (W - pad - rpad - pad) * k / N, Y = v => base - (base - top0) * (v - bot) / (top - bot), pos = t * N, k0 = Math.min(N - 1, Math.floor(pos)), fr = pos - k0;
  let g = key(lanes.map(l => [l[4], l[0]]), pad, 16, W - pad) + line(pad, Y(100), W - rpad, Y(100), { k: 'start', dash: 6, c: 'var(--mute)', w: 1.8 }) + ink(W - rpad + 6, Y(100), '$100', { a: 'start', z: 12.5, ...MUTE });
  const vals = data.map((arr, i) => { const pts = []; for (let k = 0; k <= k0; k++) pts.push([X(k), Y(arr[k])]); const cur = lerp(arr[k0], arr[k0 + 1], fr); pts.push([X(pos), Y(cur)]); g += poly(pts, { c: lanes[i][3], w: 3 }) + dot(X(pos), Y(cur), 5.5, lanes[i][3], { sw: 1.4 }); return cur; });
  const ys = vals.map((v, i) => ({ y: Y(v), i })).sort((a, b) => a.y - b.y); for (let k = 1; k < ys.length; k++) if (ys[k].y - ys[k - 1].y < 19) ys[k].y = ys[k - 1].y + 19;
  ys.forEach(o => { g += ink(X(pos) + 12, o.y, M(vals[o.i]), { a: 'start', z: 14.5, c: lanes[o.i][3] }); });
  return { svg: g + track(t, W, H, `Year ${Math.round(pos)} of ${N}`), cap: `Year ${Math.round(pos)}: savings ${M(vals[0])}, bonds ${M(vals[1])}, stocks ${M(vals[2])}. See how the stocks line zig-zags while savings glide.` };
}

/** The same $1,000 in one company or spread over many, and what happens when one company goes bust. */
export function diversify(t, p, W, H) {
  const nb = [1, 2, 3, 4, 6, 12][Math.round(p.n)], pad = Math.max(24, W * 0.08), bw = W - 2 * pad, crash = ease(seg(t, 0.4, 0.75)), laneH = (H - 70) / 2;
  const lane = (n, top, label, id) => {
    const gap = n > 6 ? 3 : 6, cw = (bw - gap * (n - 1)) / n, y0 = top + 32, bh = 46, left = 1000 - 1000 / n * crash;
    let g = ink(pad, top + 8, label, { a: 'start', z: 15.5 }) + ink(W - pad, top + 8, M(left), { a: 'end', z: 19, c: left < 1000 ? 'var(--warn)' : 'var(--good)' });
    for (let k = 0; k < n; k++) {
      const x = pad + k * (cw + gap), dead = k === 0 && crash > 0;
      g += box(x, y0 + (dead ? bh * crash : 0), cw, bh * (dead ? 1 - crash : 1), { fill: dead ? RED : GREEN, k: `bk${id}${k}`, r: 8, outline: false }) + box(x, y0, cw, bh, { k: `bo${id}${k}`, r: 8, w: 2, dash: dead && crash > 0.5 ? 5 : 0 });
      if (cw > 40) g += ink(x + cw / 2, y0 + bh / 2, dead && crash > 0.5 ? '✕' : 'Co. ' + (k + 1), { z: 14, c: dead && crash > 0.5 ? 'var(--bad)' : 'var(--ink)' });
    }
    return g;
  };
  const g = lane(1, 8, 'All in one company', 1) + lane(nb, 8 + laneH + 8, `Spread over ${nb} companies`, 2) + ink(W / 2, H - 22, crash > 0.05 ? 'One company goes bust' : 'Same $1,000 in both rows', { z: 16.5, c: crash > 0.05 ? 'var(--bad)' : 'var(--mute)' });
  return { svg: g, cap: crash < 0.05 ? `The same $1,000, either all in one company or spread over ${nb}.` : `One company fails. Top row: you lose 100% of your money. Bottom row: you lose ${nf(100 / nb, 0)}% and keep ${M(1000 - 1000 / nb)}.` };
}

/** The market and a stock with a beta: the stock exaggerates (or calms) every move of the market. */
export function beta(t, p, W, H) {
  const N = 24, z = series((p.seed || 1) * 31 + 5, N), mk = [100], st = [100], pad = Math.max(20, W * 0.06);
  z.forEach(zz => { const r = (1 + 4 * zz) / 100; mk.push(mk[mk.length - 1] * (1 + r)); st.push(st[st.length - 1] * (1 + r * p.beta)); });
  const lo = Math.min(...mk, ...st) * 0.95, hi = Math.max(...mk, ...st) * 1.05, base = H - 52, X = k => pad + (W - 2 * pad) * k / N, Y = v => base - (base - 44) * (v - lo) / (hi - lo), pos = t * N, k0 = Math.min(N - 1, Math.floor(pos));
  const path = (arr, c, w) => { const pts = []; for (let k = 0; k <= k0; k++) pts.push([X(k), Y(arr[k])]); const cur = lerp(arr[k0], arr[k0 + 1], pos - k0); pts.push([X(pos), Y(cur)]); return poly(pts, { c, w }) + dot(X(pos), Y(cur), 5.5, c, { sw: 1.4 }); };
  const g = key([[GREY, 'The market'], [GOLD, `Your stock (beta ${nf(p.beta, 1)})`]], pad, 16, W - pad) + line(pad, Y(100), W - pad, Y(100), { k: 'start', dash: 6, c: 'var(--mute)', w: 1.8 }) + path(mk, 'var(--mute)', 2.8) + path(st, 'var(--c4)', 3.4);
  const m1 = (mk[k0 + 1] / mk[k0] - 1) * 100, s1 = (st[k0 + 1] / st[k0] - 1) * 100;
  return { svg: g + track(t, W, H, `Month ${Math.round(pos)} of ${N}`), cap: `This month the market moved ${m1 >= 0 ? '+' : ''}${nf(m1, 1)}%, so a beta of ${nf(p.beta, 1)} moved ${s1 >= 0 ? '+' : ''}${nf(s1, 1)}%.` };
}

/** Two investments and your mix: the less they move together, the calmer the mix. */
export function mix2(t, p, W, H) {
  const N = 30, sdA = p.sdA || 20, sdB = p.sdB || 10, za = series((p.seed || 1) * 7 + 1, N), zc = series((p.seed || 1) * 7 + 2, N), w = p.wA / 100, rho = clamp(p.rho, -1, 1), pad = Math.max(20, W * 0.06);
  const A = za.map(z => sdA * z), B = za.map((z, k) => sdB * (rho * z + Math.sqrt(1 - rho * rho) * zc[k])), P = A.map((a, k) => w * a + (1 - w) * B[k]);
  const sd = a => { const m = sum(a) / a.length; return Math.sqrt(sum(a.map(x => (x - m) ** 2)) / (a.length - 1)); }, lim = Math.max(sdA, sdB) * 2.6, cy = 40 + (H - 150) / 2 + 10, hh = (H - 150) / 2, X = k => pad + (W - 2 * pad) * k / (N - 1), Y = v => cy - hh * v / lim, k0 = Math.floor(t * (N - 1));
  const pathOf = (arr, c, wd) => { const pts = []; for (let k = 0; k <= k0; k++) pts.push([X(k), Y(arr[k])]); return poly(pts, { c, w: wd }); };
  let g = key([[GOLD, 'A'], [NAVY, 'B'], ['var(--ink)', 'Your mix']], pad, 16) + line(pad, cy, W - pad, cy, { k: 'mid', dash: 6, c: 'var(--mute)', w: 1.8 }) + pathOf(A, 'var(--c4)', 2.6) + pathOf(B, 'var(--pill-on)', 2.6) + pathOf(P, 'var(--ink)', 4.2);
  const tw = (W - 2 * pad - 20) / 3, ty = H - 92;
  [['A', sd(A), 'var(--c4)'], ['B', sd(B), 'var(--pill-on)'], ['Your mix', sd(P), 'var(--ink)']].forEach((r, i) => { const x = pad + i * (tw + 10); g += box(x, ty, tw, 58, { fill: 'var(--soft)', k: 'st' + i, r: 12 }) + ink(x + tw / 2, ty + 16, r[0] + ' swings', { z: 13, ...MUTE }) + ink(x + tw / 2, ty + 41, '±' + nf(r[1], 1) + '%', { z: 22, c: r[2] }); });
  return { svg: g, cap: `A swings about ${nf(sd(A), 1)}% and B about ${nf(sd(B), 1)}%. Your mix swings only ${nf(sd(P), 1)}%${rho < 0 ? ', because one often rises when the other falls' : ''}.` };
}

/** Gain 50% then lose 50% and you are not even: the losses bite a bigger pile. */
export function journey(t, p, W, H) {
  const rets = p.rets && p.rets.length ? p.rets : [p.swing, -p.swing], N = rets.length, start = p.start || 100; let v = start; const vals = [v]; rets.forEach(r => vals.push((v *= 1 + r / 100)));
  const pad = Math.max(20, W * 0.06), base = H - 70, top = Math.max(...vals) * 1.12, slot = (W - 2 * pad) / (N + 1), bw = clamp(slot * 0.6, 12, 80), pos = t * N, k0 = Math.min(N - 1, Math.floor(pos)), z = N > 6 ? 12.5 : 15.5;
  let g = line(pad, base, W - pad, base, { k: 'floor', w: 2.4 });
  for (let k = 0; k <= N; k++) {
    if (k > k0 + 1) break;
    const part = k === k0 + 1 ? ease(pos - k0) : 1, val = k === k0 + 1 ? lerp(vals[k0], vals[k], part) : vals[k], hh = (base - 44) * val / top, cx = pad + (k + 0.5) * slot;
    g += box(cx - bw / 2, base - hh, bw, hh, { fill: k === 0 ? NAVY : rets[k - 1] >= 0 ? GREEN : GOLD, k: 'jb' + k, r: 8, w: bw < 20 ? 1.6 : 2.4 });
    if (bw > 26 || N <= 6) g += ink(cx, base - (base - 44) * vals[k] / top - 15, M(val), { z });
    g += ink(cx, base + 20, k === 0 ? 'Start' : (rets[k - 1] >= 0 ? '+' : '') + nf(rets[k - 1], 0) + '%', { z: 13.5, c: k === 0 ? 'var(--mute)' : rets[k - 1] >= 0 ? 'var(--good)' : 'var(--warn)' });
  }
  const avg = sum(rets) / N, done = pos >= N - 0.02;
  return { svg: g, cap: done ? `Average return: ${nf(avg, 1)}% a period. But you went from ${M(start)} to ${M(vals[N])} (${nf((vals[N] / start - 1) * 100, 0)}%). Ups and downs cost you.` : `Period ${Math.min(N, k0 + 1)}: ${rets[k0] >= 0 ? 'a gain' : 'a loss'} of ${nf(Math.abs(rets[k0]), 0)}%.` };
}

export const OWNING_AND_RISK = { stock, leverage, risk, diversify, beta, mix2, journey };
