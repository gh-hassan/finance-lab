// @ts-nocheck
/* Hand-drawn looking shapes for the home page story. Every function returns an SVG path string. The wobble comes from a seeded
   random number, so a drawing looks the same every time it is shown (and tests can check it). */

/** A small repeatable random number generator: the same seed always gives the same numbers between 0 and 1. */
export function rng(seed) {
  let s = (seed >>> 0) || 1;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
}
const f = n => Math.round(n * 10) / 10;

/** A line that is a little bit shaky, like it was drawn with a marker. */
export function wobblyLine(x1, y1, x2, y2, seed = 1, amt = 2.2) {
  const r = rng(seed), dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1, nx = -dy / len, ny = dx / len, n = Math.max(2, Math.round(len / 40));
  let d = `M${f(x1 + (r() - 0.5) * amt)} ${f(y1 + (r() - 0.5) * amt)}`;
  for (let i = 1; i <= n; i++) {
    const t = i / n, o = (r() - 0.5) * amt * 2, ct = (i - 0.5) / n, co = (r() - 0.5) * amt * 2;
    d += ` Q${f(x1 + dx * ct + nx * co)} ${f(y1 + dy * ct + ny * co)} ${f(x1 + dx * t + nx * (i === n ? o * 0.4 : o))} ${f(y1 + dy * t + ny * (i === n ? o * 0.4 : o))}`;
  }
  return d;
}

/** A rectangle drawn as four separate shaky sides, so the corners overshoot a little. */
export function wobblyRect(x, y, w, h, seed = 1, amt = 2) {
  return [wobblyLine(x, y, x + w, y, seed, amt), wobblyLine(x + w, y - 1, x + w + 1, y + h, seed + 1, amt), wobblyLine(x + w + 2, y + h, x, y + h + 1, seed + 2, amt), wobblyLine(x - 1, y + h + 2, x + 1, y - 2, seed + 3, amt)].join(' ');
}

/** A loop drawn by hand: it goes round slightly more than once and does not close perfectly. */
export function wobblyEllipse(cx, cy, rx, ry, seed = 1, amt = 1.6) {
  const r = rng(seed), steps = 20, pts = [];
  for (let i = 0; i <= steps; i++) { const a = (i / steps) * Math.PI * 2.1 - Math.PI / 2, k = 1 + (r() - 0.5) * 0.05; pts.push([cx + Math.cos(a) * rx * k + (r() - 0.5) * amt, cy + Math.sin(a) * ry * k + (r() - 0.5) * amt]); }
  return wobblyPath(pts, seed + 11, 0);
}

/** A smooth line through the given points, with an optional wobble. Needs at least two points. */
export function wobblyPath(points, seed = 1, amt = 1.4) {
  if (!points || points.length < 2) return '';
  const r = rng(seed), p = points.map(([x, y]) => [x + (r() - 0.5) * amt, y + (r() - 0.5) * amt]);
  let d = `M${f(p[0][0])} ${f(p[0][1])}`;
  for (let i = 1; i < p.length; i++) { const [px, py] = p[i - 1], [x, y] = p[i]; d += ` Q${f(px)} ${f(py)} ${f((px + x) / 2)} ${f((py + y) / 2)}`; }
  const last = p[p.length - 1]; return d + ` L${f(last[0])} ${f(last[1])}`;
}
