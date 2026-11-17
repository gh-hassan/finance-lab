// @ts-nocheck
/* The hand-drawn toolkit for the lesson pictures. It gives every lesson the same look as the home page story: ink lines that wobble a
   little, soft coloured fills, a handwriting font and a stick-figure student. All functions return SVG text, so a scene can join them
   together. Pass `k` (a short name) to keep a shape's wobble steady while it moves or grows; shapes that stay in place need no name. */
import { wobblyLine, wobblyRect, wobblyEllipse, wobblyPath } from './doodle-shapes.js';

export const HAND = "'Caveat','Bradley Hand','Segoe Print',cursive";
export const NAVY = 'color-mix(in srgb,var(--pill-on) 26%,transparent)';
export const GREEN = 'color-mix(in srgb,var(--good) 42%,transparent)';
export const GOLD = 'rgba(242,193,78,.62)';
export const GREY = 'color-mix(in srgb,var(--mute) 30%,transparent)';
export const RED = 'color-mix(in srgb,var(--bad) 34%,transparent)';

const f1 = n => Math.round(n * 10) / 10;
export const clamp01 = u => Math.min(1, Math.max(0, u));
const seedOf = k => { let a = 7; for (const ch of String(k)) a = (Math.imul(a, 31) + ch.charCodeAt(0)) >>> 0; return a || 1; };
const keyOf = (o, ...nums) => o.k || nums.map(n => Math.round(n)).join('_');
const safe = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');

/** Draw a path with the marker. u is how much is drawn (0 to 1), so a line can draw itself while time runs. */
export function pen(d, o = {}) {
  const { u = 1, c = 'var(--ink)', w = 2.6, fill = 'none', dash = 0, op = 1 } = o;
  if (u <= 0 || !d) return '';
  const partial = u < 1 && !dash;
  return `<path d="${d}" fill="${fill}" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" opacity="${dash ? f1(op * Math.min(1, u * 3)) : op}"${partial ? ` pathLength="1" stroke-dasharray="1" stroke-dashoffset="${(1 - u).toFixed(3)}"` : ''}${dash ? ` stroke-dasharray="${dash} ${dash}"` : ''}/>`;
}
export const line = (x1, y1, x2, y2, o = {}) => pen(wobblyLine(x1, y1, x2, y2, seedOf(keyOf(o, x1, y1, x2, y2)), o.amt ?? 1.6), o);
export const curve = (pts, o = {}) => pen(wobblyPath(pts, seedOf(o.k || pts.map(p => p.join(',')).join(';')), o.amt ?? 1.2), o);
export const ring = (cx, cy, rx, ry, o = {}) => (rx < 0.5 ? '' : pen(wobblyEllipse(cx, cy, rx, ry, seedOf(keyOf(o, cx, cy, rx, ry)), o.amt ?? 1.2), o));
/** A box with an optional soft fill. */
export function box(x, y, w, h, o = {}) {
  if (w < 0.8 || h < 0.8) return '';
  const { fill, fo = 1, u = 1, r = 8, outline = true } = o;
  const f = fill ? `<rect x="${f1(x)}" y="${f1(y)}" width="${f1(w)}" height="${f1(h)}" rx="${f1(Math.min(r, w / 2, h / 2))}" fill="${fill}" opacity="${f1(fo * clamp01(u * 2))}"/>` : '';
  return f + (outline ? pen(wobblyRect(x, y, w, h, seedOf(keyOf(o, x, y, w, h)), o.amt ?? Math.min(1.8, w / 6, h / 6)), o) : '');
}
/** Handwriting (or plain) text. y is the middle of the line. */
export function ink(x, y, s, o = {}) {
  const { z = 15, a = 'middle', c = 'var(--ink)', hand = true, w = 600, op = 1 } = o;
  return `<text x="${f1(x)}" y="${f1(y)}" dy=".35em" text-anchor="${a}" font-size="${z}" font-weight="${w}" fill="${c}" opacity="${op}" font-family="${hand ? HAND : 'var(--body)'}">${safe(s)}</text>`;
}
/** A hand-drawn arrow from one point to another. */
export function arrow(x1, y1, x2, y2, o = {}) {
  const ang = Math.atan2(y2 - y1, x2 - x1), s = o.head || 9;
  const hd = [Math.PI * 0.82, -Math.PI * 0.82].map(d => `M${f1(x2)} ${f1(y2)} L${f1(x2 + Math.cos(ang + d) * s)} ${f1(y2 + Math.sin(ang + d) * s)}`).join(' ');
  return line(x1, y1, x2, y2, o) + pen(hd, { ...o, dash: 0, u: o.u >= 1 || o.u == null ? 1 : 0 });
}
/** A coin with a dollar sign. */
export const coin = (cx, cy, r, o = {}) => (r < 1 ? '' : `<circle cx="${f1(cx)}" cy="${f1(cy)}" r="${f1(r)}" fill="${o.fill || GOLD}" opacity="${o.op ?? 1}"/>` + ring(cx, cy, r, r, { k: o.k, w: 2.4, op: o.op ?? 1 }) + (r > 9 ? ink(cx, cy, o.sign || '$', { z: r * 1.1, op: o.op ?? 1 }) : ''));
/** A paper note with a label, like a banknote. */
export const bill = (x, y, w, h, label, o = {}) => box(x - w / 2, y - h / 2, w, h, { fill: o.fill || GOLD, k: o.k, r: 6, w: 2.4 }) + ink(x, y, label, { z: o.z || 14 });
/** A tick mark. */
export const tick = (x, y, s, o = {}) => pen(wobblyPath([[x - s * 0.5, y], [x - s * 0.1, y + s * 0.45], [x + s * 0.6, y - s * 0.5]], seedOf(o.k || 'tick' + Math.round(x)), 0.8), { c: 'var(--good)', w: 4.5, ...o });

/** The stick-figure student, standing on `feet`. k scales it. arms: down, point or raised. It has no face, so it stays calm. */
export function person(x, feet, k, o = {}) {
  const { arms = 'down', u = 1, id = 'p' } = o, P = (a, b) => [f1(x + a * k), f1(feet + b * k)];
  const L = (a, b, c, e, n) => line(...P(a, b), ...P(c, e), { k: id + n, u, w: 2.8 });
  const head = P(0, -98);
  const arm = arms === 'cheer' ? [[-24, -84], [24, -84]] : arms === 'point' ? [[-24, -46], [34, -88]] : [[-24, -46], [24, -46]];
  let g = ring(head[0], head[1], 18 * k, 18 * k, { k: id + 'h', u, w: 2.8 }) + L(0, -80, 0, -36, 'b') + L(0, -36, -16, 0, 'l1') + L(0, -36, 16, 0, 'l2') + L(0, -70, arm[0][0], arm[0][1], 'a1') + L(0, -70, arm[1][0], arm[1][1], 'a2');
  return g;
}

/** A progress line with handwriting, in place of a bar. */
export function track(t, W, H, label) {
  const pad = Math.max(20, W * 0.07), y = H - 16, x = pad + (W - 2 * pad) * clamp01(t);
  return line(pad, y, W - pad, y, { k: 'trk', c: 'var(--line)', w: 3 }) + line(pad, y, Math.max(pad + 1, x), y, { k: 'trk2', c: 'var(--pill-on)', w: 3.4 }) + `<circle cx="${f1(x)}" cy="${y}" r="5" fill="var(--pill-on)"/>` + ink(pad, y - 18, label, { a: 'start', z: 13.5, c: 'var(--mute)' });
}
/** A little colour key. */
export function key(items, x, y, maxW = 1e9) {
  let g = '', cx = x, cy = y;
  items.forEach(([fill, s]) => { const w = 28 + s.length * 7.6 + 14; if (cx + w - 14 > maxW && cx > x) { cx = x; cy += 20; } g += box(cx, cy - 7, 14, 14, { fill, fo: 1, r: 3, w: 1.8 }) + ink(cx + 22, cy, s, { a: 'start', z: 13, c: 'var(--mute)' }); cx += w; });
  return g;
}

/** A straight-sided line through points (for charts), drawn with the marker. */
export const poly = (pts, o = {}) => (pts.length < 2 ? '' : pen('M' + pts.map(q => f1(q[0]) + ' ' + f1(q[1])).join(' L'), o));
/** A filled dot with a thin ink edge. */
export const dot = (x, y, r, fill, o = {}) => `<circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(r)}" fill="${fill}" stroke="${o.edge || 'var(--ink)'}" stroke-width="${o.sw || 1.4}" opacity="${o.op ?? 1}"/>`;
