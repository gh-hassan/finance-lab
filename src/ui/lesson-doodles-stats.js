// @ts-nocheck
/* The "Chance and numbers" lesson pictures, drawn by hand in the same style as the home page story.
   Each function is draw(t, p, W, H): t runs 0 to 1, p holds the sliders, and W x H is the real size in pixels. */
import { compact, corr, linreg, mean, median, money, ncdf, nf, stdev, sum } from '../lib/math';
import { box, ink, line, pen, poly, dot, track, tick, NAVY, GREEN, GOLD, GREY, RED } from './doodle-kit.js';
import { note } from './lesson-doodles.js';
import { rng, series } from './scene-random.js';

const M = x => (Math.abs(x) >= 1e6 ? compact(x) : money(x, 0));
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const lerp = (a, b, u) => a + (b - a) * u;
const ease = u => 1 - Math.pow(1 - clamp(u, 0, 1), 3);
const seg = (t, a, b) => clamp((t - a) / (b - a), 0, 1);
const f1 = x => x.toFixed(1);
const MUTE = { c: 'var(--mute)', hand: false };
const tickX = (x, base, label, o = {}) => line(x, base, x, base + 6, { k: 'tk' + Math.round(x), w: 2, c: 'var(--mute)' }) + ink(x, base + 22, label, { z: 12.5, c: o.bold ? 'var(--ink)' : 'var(--mute)', hand: false, w: o.bold ? 700 : 500 });
/** The outline of a bell, from z = a to b, as a filled shape down to the base line. */
const bellFill = (X, Y, base, a, b, fill, op = 1) => { let d = `M${f1(X(a))} ${f1(base)}`; for (let z = a; z <= b + 1e-9; z += 0.05) d += `L${f1(X(z))} ${f1(Y(z))}`; return `<path d="${d}L${f1(X(b))} ${f1(base)}Z" fill="${fill}" opacity="${op}"/>`; };

/** Ten values on a line: one huge value drags the average, the middle value stays put. */
export function average(t, p, W, H) {
  const own = !!(p.data && p.data.length), data = own ? p.data : [32, 35, 38, 40, 42, 45, 48, 52, 55, p.big], pre = own ? (p.pre || '') : '$', post = own ? (p.post || '') : 'k';
  const fmt = x => pre + nf(x, !own || Number.isInteger(x) ? 0 : Math.abs(x) < 10 ? 2 : 1) + post, n = data.length, mu = mean(data), md = median(data), lo = Math.min(...data), hi = Math.max(...data), pad = Math.max(30, W * 0.08), sp = (hi - lo) || 1;
  const X = v => pad + (W - 2 * pad) * (v - lo + sp * 0.04) / (sp * 1.08), baseY = H * 0.76, shown = Math.ceil(seg(t, 0.02, 0.6) * n), u = ease(seg(t, 0.62, 0.92));
  const stack = rr => { const placed = [], out = []; [...data].sort((a, b) => a - b).forEach(v => { const x = X(v); let k = 0; placed.forEach(q => { if (Math.abs(q - x) < 2 * rr) k++; }); placed.push(x); out.push({ x, k }); }); return out; };
  let r = 9; while (r > 4 && Math.max(...stack(r).map(o => o.k + 1)) * (2 * r + 1) > H * 0.36) r -= 1;
  let g = line(pad - 6, baseY, W - pad + 6, baseY, { k: 'axis', w: 2.6 }) + ink(pad, baseY + 22, fmt(lo), { a: 'start', z: 12.5, ...MUTE }) + ink(W - pad, baseY + 22, fmt(hi), { a: 'end', z: 12.5, ...MUTE });
  stack(r).forEach((o, i) => { if (i < shown) g += dot(o.x, baseY - r - 3 - o.k * (2 * r + 1), r, 'var(--pill-on)', { sw: 1.2 }); });
  const mark = (v, label, fill, y) => { const x = clamp(X(v), pad + 46, W - pad - 46); return `<g opacity="${u.toFixed(2)}">` + line(X(v), y + 16, X(v), baseY, { k: 'm' + label, dash: 5, c: 'var(--mute)', w: 2 }) + note(x, y, `${label} ${fmt(v)}`, { fill, k: 'n' + label, z: 13.5 }) + '</g>'; };
  if (u > 0) g += mark(md, 'Middle', GREEN, H * 0.22) + mark(mu, 'Average', GOLD, H * 0.08);
  const gap = Math.abs(mu - md) / (Math.abs(md) || 1);
  return { svg: g, cap: u < 0.5 ? 'Each dot is one value.' : gap > 0.2 ? `The average is ${fmt(mu)} but the middle value is ${fmt(md)}. One big value drags the average. The middle is a better picture of what is typical.` : `The average (${fmt(mu)}) and the middle (${fmt(md)}) are close, so the values are fairly even.` };
}

/** Two lanes with the same average: one calm, one bumpy. The shaded band is one spread either side. */
export function spread(t, p, W, H) {
  const lanes = [['Calm', 4, GREEN, 'var(--good)'], ['Bumpy', p.wild, GOLD, 'var(--c4)']], N = 20, avg = 7, pad = Math.max(24, W * 0.07), lh = (H - 96) / 2, k = Math.floor(t * N + 1e-9), sc = (lh / 2 - 8) / (Math.max(4, p.wild) * 2.4);
  let g = '';
  lanes.forEach(([name, sd, fill, c], i) => {
    const top = 14 + i * (lh + 34), mid = top + 22 + lh / 2, z = series((p.seed || 1) * 11 + i * 7, N), X = j => pad + (W - 2 * pad) * (j + 0.5) / N, Y = v => mid - (v - avg) * sc;
    g += ink(pad, top + 6, name, { a: 'start', z: 17 }) + ink(W - pad, top + 6, `Spread ±${sd}%`, { a: 'end', z: 15, c }) + box(pad, Y(avg + sd), W - 2 * pad, Math.max(3, 2 * sd * sc), { fill, fo: 0.55, k: 'band' + i, r: 8, w: 1.8 }) + line(pad, Y(avg), W - pad, Y(avg), { k: 'avg' + i, dash: 6, c: 'var(--mute)', w: 1.8 });
    const pts = []; for (let j = 0; j < Math.min(N, k + 1); j++) pts.push([X(j), clamp(Y(avg + sd * z[j]), top + 20, top + 24 + lh)]);
    g += poly(pts, { c, w: 2, op: 0.55 }) + pts.map(q => dot(q[0], q[1], 4.6, c, { sw: 1.2 })).join('');
  });
  return { svg: g + track(t, W, H, `Year ${Math.min(N, k + 1)} of ${N}`), cap: `Both average ${avg}% a year. The calm lane stays near it (±4%). The bumpy lane usually lands between ${nf(avg - p.wild, 0)}% and ${nf(avg + p.wild, 0)}% (about 2 years in 3). Spread is the bumpiness.` };
}

/** The bell curve and how much of the chance sits within one, two and three spreads. */
export function bell(t, p, W, H) {
  const pad = Math.max(24, W * 0.06), base = H - 62, top = 56, X = z => pad + (W - 2 * pad) * (z + 4) / 8, Y = z => base - (base - top) * Math.exp(-z * z / 2);
  let g = '';
  [[3, GREY, 0.9], [2, NAVY, 1], [1, GREEN, 1]].forEach(([k, c, op], i) => { const a = ease(seg(t, (2 - i) / 3, (3 - i) / 3)); if (a > 0) g += bellFill(X, Y, base, -k, k, c, (op * a).toFixed(2)); });
  const pts = []; for (let z = -4; z <= 4.001; z += 0.08) pts.push([X(z), Y(z)]);
  g += poly(pts, { w: 3 }) + line(pad, base, W - pad, base, { k: 'axis', c: 'var(--mute)', w: 2.2 });
  for (let z = -3; z <= 3; z++) g += tickX(X(z), base, nf(p.mean + z * p.sd, 0) + '%', { bold: z === 0 });
  const ph = t < 0.33 ? 1 : t < 0.66 ? 2 : 3, lab = ['68%', '95%', '99.7%'][ph - 1];
  g += note(W / 2, 22, `${lab} of years land between ${nf(p.mean - ph * p.sd, 0)}% and ${nf(p.mean + ph * p.sd, 0)}%`, { k: 'cap', z: W < 430 ? 12.5 : 14.5 });
  return { svg: g, cap: `Average ${p.mean}%, spread ±${p.sd}%. About ${['68 in 100', '95 in 100', '997 in 1,000'][ph - 1]} years land within ${ph} spread${ph > 1 ? 's' : ''} of the average, between ${nf(p.mean - ph * p.sd, 0)}% and ${nf(p.mean + ph * p.sd, 0)}%.` };
}

/** How likely a bad year is: the shaded tail to the left of a loss line. */
export function tail(t, p, W, H) {
  const pad = Math.max(24, W * 0.06), base = H - 62, top = 70, lo = p.mean - 4 * p.sd, hi = p.mean + 4 * p.sd, X = v => pad + (W - 2 * pad) * (v - lo) / (hi - lo), Y = v => base - (base - top) * Math.exp(-Math.pow((v - p.mean) / p.sd, 2) / 2), cutNow = lerp(p.mean, p.cut, ease(t));
  const lowEnd = Math.max(lo, Math.min(cutNow, hi)), prob = ncdf((cutNow - p.mean) / p.sd);
  let d = `M${f1(X(lo))} ${f1(base)}`; for (let v = lo; v <= lowEnd + 1e-9; v += (hi - lo) / 160) d += `L${f1(X(v))} ${f1(Y(v))}`;
  let g = `<path d="${d}L${f1(X(lowEnd))} ${f1(base)}Z" fill="${RED}"/>`;
  const pts = []; for (let v = lo; v <= hi + 1e-9; v += (hi - lo) / 100) pts.push([X(v), Y(v)]);
  g += poly(pts, { w: 3 }) + line(pad, base, W - pad, base, { k: 'axis', c: 'var(--mute)', w: 2.2 });
  for (let k = -3; k <= 3; k++) g += tickX(X(p.mean + k * p.sd), base, nf(p.mean + k * p.sd, 0) + '%');
  if (0 > lo && 0 < hi) g += line(X(0), top - 6, X(0), base, { k: 'zero', dash: 5, c: 'var(--mute)', w: 1.8 }) + ink(X(0), top - 18, 'break-even', { z: 12.5, ...MUTE });
  g += line(X(cutNow), top - 2, X(cutNow), base, { k: 'cut', c: 'var(--bad)', w: 3.2 }) + note(clamp(X(cutNow), pad + 54, W - pad - 54), 22, `Chance: ${prob < 0.001 ? '<0.1' : nf(prob * 100, prob < 0.1 ? 1 : 0)}%`, { k: 'chance', fill: RED, z: 15 });
  return { svg: g, cap: prob > 0.0005 ? `About ${nf(prob * 100, 1)}% chance of a year worse than ${nf(cutNow, 0)}%, roughly 1 year in ${nf(1 / prob, 0)}.` : 'Almost no chance of a year this bad.' };
}

/** Every outcome as a bar: wider is more likely, taller is bigger. The dashed line is the average result. */
export function expected(t, p, W, H) {
  const outs = p.outcomes && p.outcomes.length ? p.outcomes : [{ label: 'Win', prob: p.pwin / 100, value: p.win }, { label: 'Lose', prob: 1 - p.pwin / 100, value: -p.lose }], ev = sum(outs.map(o => o.prob * o.value)), maxA = Math.max(...outs.map(o => Math.abs(o.value)), 1);
  const pad = Math.max(24, W * 0.07), BW = W - 2 * pad, gap = 6, hasNeg = outs.some(o => o.value < 0), zero = hasNeg ? H * 0.52 : H - 70, up = zero - 46, down = H - 60 - zero, sc = Math.min(up / maxA, hasNeg ? down / maxA : 1e9);
  let x = pad, g = line(pad, zero, W - pad, zero, { k: 'zero', w: 2.4 });
  outs.forEach((o, i) => {
    const w = Math.max(10, (BW - gap * (outs.length - 1)) * o.prob), a = ease(seg(t, i * 0.18, i * 0.18 + 0.4)), hh = Math.abs(o.value) * sc * a, y = o.value >= 0 ? zero - hh : zero;
    g += box(x, y, w, hh, { fill: o.value >= 0 ? GREEN : GOLD, k: 'o' + i, r: 8, w: w < 14 ? 1.5 : 2.4 });
    if (a > 0.6) g += ink(x + w / 2, o.value >= 0 ? zero - Math.abs(o.value) * sc - 28 : zero + Math.abs(o.value) * sc + 14, (o.value >= 0 ? '+' : '−') + M(Math.abs(o.value)), { z: 16 }) + ink(x + w / 2, o.value >= 0 ? zero - Math.abs(o.value) * sc - 11 : zero + Math.abs(o.value) * sc + 31, `${nf(o.prob * 100, 0)}% chance`, { z: 12.5, ...MUTE });
    x += w + gap;
  });
  const u = ease(seg(t, 0.7, 0.95)), yEv = zero - ev * sc;
  g += `<g opacity="${u.toFixed(2)}">` + line(pad - 6, yEv, W - pad + 6, yEv, { k: 'ev', dash: 7, w: 2.6 }) + note(W - pad - 66, clamp(yEv, 22, H - 22) + (ev >= 0 ? -24 : 24), `Expected ${ev >= 0 ? '+' : '−'}${M(Math.abs(ev))}`, { k: 'evn', fill: 'var(--soft)', z: 14 }) + '</g>';
  return { svg: g, cap: u < 0.5 ? 'Each bar is one possible outcome. Wider means more likely.' : `Weighing each result by its chance gives ${ev >= 0 ? '+' : '−'}${M(Math.abs(ev))} per try on average. ${ev >= 0 ? 'Worth taking on average.' : 'A losing bet on average.'} Individual tries can still go either way.` };
}

/** Coin flips: the share of heads swings wildly at first, then settles on the true chance. */
export function lawlarge(t, p, W, H) {
  const N = 300, r = rng((p.seed || 1) * 13), flips = Array.from({ length: N }, () => (r() < p.p / 100 ? 1 : 0)), k = Math.max(1, Math.round(Math.pow(t, 1.7) * N)), pad = Math.max(34, W * 0.08), base = H - 76, top = 62;
  let cum = 0; const pts = [], X = j => pad + (W - 2 * pad - 8) * Math.log(j + 1) / Math.log(N + 1), Y = v => base - (base - top) * v;
  for (let j = 1; j <= k; j++) { cum += flips[j - 1]; pts.push([X(j), Y(cum / j)]); }
  const heads = cum, share = heads / k;
  let g = line(pad, base, W - pad, base, { k: 'axis', c: 'var(--mute)', w: 2.2 }) + line(pad, Y(p.p / 100), W - pad, Y(p.p / 100), { k: 'true', dash: 6, c: 'var(--mute)', w: 1.8 }) + ink(W - pad, Y(p.p / 100) - 13, `true chance ${p.p}%`, { a: 'end', z: 13, ...MUTE });
  [1, 10, 100, 300].forEach(v => { g += tickX(X(v), base, String(v)); });
  g += poly(pts, { c: 'var(--pill-on)', w: 3 }) + dot(X(k), Y(share), 6, 'var(--c4)', { sw: 1.6 }) + ink(pad, 24, `After ${k} flips: ${heads} heads = ${nf(share * 100, 0)}%`, { a: 'start', z: 17 }) + ink(W / 2, H - 14, 'number of flips', { z: 12.5, ...MUTE });
  return { svg: g, cap: k < 20 ? `After only ${k} flips, ${nf(share * 100, 0)}% heads is mostly luck.` : `After ${k} flips, ${nf(share * 100, 0)}% heads. The true chance is ${p.p}%. More flips, closer it gets.` };
}

/** Dots for two things that move together (or not): the score is how tight the line of dots is. */
export function correlation(t, p, W, H) {
  const ext = !!(p.xs && p.xs.length > 2), N = ext ? Math.min(p.xs.length, p.ys.length) : 45, z1 = series((p.seed || 1) * 5 + 1, N), z2 = series((p.seed || 1) * 5 + 2, N), rr = clamp(p.r == null ? 0 : p.r, -1, 1);
  const xs0 = ext ? p.xs.slice(0, N) : z1, ys0 = ext ? p.ys.slice(0, N) : z1.map((z, i) => rr * z + Math.sqrt(1 - rr * rr) * z2[i]), sx = stdev(xs0) || 1, sy = stdev(ys0) || 1, mx = mean(xs0), my = mean(ys0), xs = xs0.map(v => (v - mx) / sx), ys = ys0.map(v => (v - my) / sy);
  const r = corr(xs0, ys0), size = Math.min(H - 70, W * 0.54), x0 = Math.max(18, W * 0.05), y0 = 16, S = v => clamp(v, -3, 3), X = v => x0 + size * (S(v) + 3.2) / 6.4, Y = v => y0 + size - size * (S(v) + 3.2) / 6.4, k = Math.ceil(t * N);
  let g = box(x0, y0, size, size, { fill: 'var(--panel-solid)', k: 'plot', r: 14 }) + line(X(0), y0 + 12, X(0), y0 + size - 12, { k: 'vx', dash: 5, c: 'var(--line)', w: 1.8 }) + line(x0 + 12, Y(0), x0 + size - 12, Y(0), { k: 'vy', dash: 5, c: 'var(--line)', w: 1.8 }) + ink(x0 + 16, y0 + 18, 'B ↑', { a: 'start', z: 13, ...MUTE });
  for (let i = 0; i < k; i++) g += dot(X(xs[i]), Y(ys[i]), 5, 'var(--pill-on)', { sw: 1.2, op: 0.9 });
  const fa = ease(seg(t, 0.7, 1)); if (fa > 0 && Number.isFinite(r)) g += `<g opacity="${fa.toFixed(2)}">` + line(X(-2.9), Y(-2.9 * r), X(2.9), Y(2.9 * r), { k: 'fit', c: 'var(--c4)', w: 4 }) + '</g>';
  g += ink(x0 + size / 2, y0 + size + 22, 'A moves →', { z: 13, ...MUTE });
  const tx0 = x0 + size + Math.max(16, W * 0.04), room = W - tx0 - 8, bigZ = room < 125 ? 28 : 38, lab = Math.abs(r) > 0.7 ? 'strong' : Math.abs(r) > 0.3 ? 'moderate' : 'weak', dir = r > 0.1 ? (room < 125 ? 'together' : 'move together') : r < -0.1 ? (room < 125 ? 'opposite' : 'move opposite') : 'unrelated';
  const yc = y0 + size / 2 - 62;
  g += ink(tx0, yc, 'Score', { a: 'start', z: 14, ...MUTE }) + ink(tx0, yc + 40, (r >= 0 ? '+' : '−') + nf(Math.abs(r), 2), { a: 'start', z: bigZ, c: r >= 0 ? 'var(--pill-on)' : 'var(--warn)' }) + ink(tx0, yc + 82, Math.abs(r) < 0.1 ? 'none' : lab, { a: 'start', z: 17 }) + ink(tx0, yc + 104, dir, { a: 'start', z: 14.5, ...MUTE });
  return { svg: g, cap: `A correlation of ${r >= 0 ? '+' : '−'}${nf(Math.abs(r), 2)}: the two ${dir}. ${Math.abs(r) > 0.6 ? (r > 0 ? 'Mixing them does little to spread your risk.' : 'Mixing them calms the ride a lot.') : 'Mixing them helps calm the ride.'}` };
}

/** A stock's moves against the market's: the slope of the best-fit line is beta. */
export function regression(t, p, W, H) {
  const ext = !!(p.xs && p.xs.length > 2), N = ext ? Math.min(p.xs.length, p.ys.length) : 40, z1 = series((p.seed || 1) * 9 + 1, N), z2 = series((p.seed || 1) * 9 + 2, N);
  const xs = ext ? p.xs.slice(0, N) : z1.map(z => 3.5 * z), ys = ext ? p.ys.slice(0, N) : z1.map((z, i) => p.beta * 3.5 * z + 2.5 * z2[i]), fit = linreg(xs, ys), m = Math.max(1e-6, ...xs.map(Math.abs), ...ys.map(Math.abs)) * 1.1;
  const size = Math.min(H - 76, W * 0.54), x0 = Math.max(18, W * 0.05), y0 = 14, X = v => x0 + size * (clamp(v, -m, m) + m) / (2 * m), Y = v => y0 + size - size * (clamp(v, -m, m) + m) / (2 * m), k = Math.ceil(seg(t, 0, 0.7) * N);
  let g = box(x0, y0, size, size, { fill: 'var(--panel-solid)', k: 'plot', r: 14 }) + line(X(0), y0 + 12, X(0), y0 + size - 12, { k: 'vx', dash: 5, c: 'var(--line)', w: 1.8 }) + line(x0 + 12, Y(0), x0 + size - 12, Y(0), { k: 'vy', dash: 5, c: 'var(--line)', w: 1.8 }) + ink(x0 + 16, y0 + 18, 'Stock ↑', { a: 'start', z: 13, ...MUTE });
  for (let i = 0; i < k; i++) g += dot(X(xs[i]), Y(ys[i]), 5, 'var(--pill-on)', { sw: 1.2, op: 0.9 });
  const fa = ease(seg(t, 0.72, 0.95)), run = m * 0.6;
  if (fa > 0 && Number.isFinite(fit.slope)) {
    const ex = m * 0.97; g += `<g opacity="${fa.toFixed(2)}">` + line(X(-ex), Y(fit.intercept - fit.slope * ex), X(ex), Y(fit.intercept + fit.slope * ex), { k: 'fit', c: 'var(--c4)', w: 4 }) + line(X(0), Y(fit.intercept), X(run), Y(fit.intercept), { k: 'run', dash: 5, w: 2 }) + line(X(run), Y(fit.intercept), X(run), Y(fit.intercept + fit.slope * run), { k: 'rise', dash: 5, w: 2 }) + note(Math.min(X(run) + 32, x0 + size - 28), Y(fit.intercept + fit.slope * run / 2), 'rise', { k: 'nr', z: 13 }) + note(X(run / 2), Y(fit.intercept) + (fit.slope >= 0 ? 22 : -22), 'run', { k: 'nn', z: 13 }) + '</g>';
  }
  g += ink(x0 + size / 2, y0 + size + 20, 'Market moved →', { z: 13, ...MUTE });
  const tx0 = x0 + size + Math.max(16, W * 0.04), yc = y0 + size / 2 - 50;
  g += ink(tx0, yc, 'Slope = beta', { a: 'start', z: 14, ...MUTE }) + ink(tx0, yc + 42, fa > 0 ? nf(fit.slope, 2) : '…', { a: 'start', z: 34, c: 'var(--pill-on)' }) + ink(tx0, yc + 84, 'rise ÷ run', { a: 'start', z: 14.5, ...MUTE });
  return { svg: g, cap: fa > 0.5 ? `For every 1% the market moves, this stock tends to move ${nf(fit.slope, 2)}%. That slope is its beta.` : 'Each dot is one month: market move across, stock move up.' };
}

/** Fifty random futures for $100 and where they all end up. */
export function montecarlo(t, p, W, H) {
  const M_ = 50, N = 20, mu = 7, paths = Array.from({ length: M_ }, (_, i) => { const z = series((p.seed || 1) * 101 + i * 17, N); let v = 100; return [100, ...z.map(zz => (v *= Math.max(0.05, 1 + (mu + p.vol * zz) / 100)))]; });
  const finals = paths.map(a => a[N]), sorted = [...finals].sort((a, b) => a - b), q = f => sorted[Math.floor(f * (sorted.length - 1))], top = Math.max(150, q(0.95) * 1.15), pad = Math.max(16, W * 0.04), hw = Math.max(70, W * 0.2), cx0 = pad + 38, cx1 = W - pad - hw - 14, base = H - 70, ty = 38;
  const X = k => cx0 + (cx1 - cx0) * k / N, Y = v => base - (base - ty) * Math.min(v, top) / top, pos = t * N, k0 = Math.min(N - 1, Math.floor(pos));
  let g = ink(pad, 14, 'Each line is one possible future', { a: 'start', z: 14, ...MUTE }) + line(cx0, Y(100), cx1, Y(100), { k: 'start', dash: 6, c: 'var(--mute)', w: 1.8 }) + ink(cx0 - 6, Y(100), '$100', { a: 'end', z: 12.5, ...MUTE }) + line(cx0, base, cx1, base, { k: 'axis', c: 'var(--mute)', w: 2.2 });
  paths.forEach(a => { const pts = []; for (let k = 0; k <= k0; k++) pts.push([X(k), Y(a[k])]); pts.push([X(pos), Y(lerp(a[k0], a[k0 + 1], pos - k0))]); g += poly(pts, { c: 'var(--pill-on)', w: 1.5, op: 0.3 }); });
  const bins = 14, hist = Array(bins).fill(0); finals.forEach(v => { hist[Math.min(bins - 1, Math.floor(Math.min(v, top - 1e-6) / top * bins))]++; });
  const hx = W - pad - hw, rev = ease(seg(t, 0.7, 1)), hmax = Math.max(...hist, 1);
  g += ink(hx, 14, hw < 100 ? 'Ends' : 'Where they end', { a: 'start', z: 14, ...MUTE });
  hist.forEach((c, i) => { const y1 = Y((i + 1) * top / bins), y2 = Y(i * top / bins); g += box(hx, y1 + 1.5, (hw - 6) * c / hmax * rev, Math.max(1, y2 - y1 - 3), { fill: NAVY, k: 'h' + i, r: 4, w: 1.6 }); });
  if (rev > 0.8) {
    /* the three labels sit at their heights, pushed apart so they never overlap */
    const rows = [[0.9, 'good', GREEN], [0.5, 'typical', GREY], [0.1, 'bad', RED]].map(([f, lab, fill]) => ({ lab, fill, at: Y(q(f)), y: Y(q(f)), text: `${lab} ${M(q(f))}` }));
    rows.forEach((r, i) => { if (i && r.y - rows[i - 1].y < 30) r.y = rows[i - 1].y + 30; });
    rows.forEach(r => { g += line(cx0, r.at, hx - 6, r.at, { k: 'q' + r.lab, dash: 5, c: 'var(--mute)', w: 1.5 }) + note(cx1 - (r.text.length * 4.1 + 17), r.y, r.text, { k: 'qn' + r.lab, fill: r.fill, z: 13 }); });
  }
  return { svg: g + track(t, W, H, `Year ${Math.round(pos)} of ${N}`), cap: rev > 0.9 ? `${M_} random futures. After ${N} years a typical one ends near ${M(q(0.5))}, a bad one near ${M(q(0.1))}, a good one near ${M(q(0.9))}. That spread is the risk.` : 'Each line is one random future for $100 invested.' };
}

export const CHANCE_AND_NUMBERS = { average, spread, bell, tail, expected, lawlarge, correlation, regression, montecarlo };
