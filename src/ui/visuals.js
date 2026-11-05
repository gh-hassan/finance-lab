// @ts-nocheck
/* DOM helpers, interactive charts and small visuals. */
import { nf, sum } from '../lib/math';

export const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
export const h = (tag, props = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const k in props) {
    const val = props[k];
    if (k === 'class') e.className = val;
    else if (k === 'html') e.innerHTML = val;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), val);
    else if (val === true) e.setAttribute(k, '');
    else if (val !== false && val != null) e.setAttribute(k, val);
  }
  kids.flat().forEach(c => { if (c != null && c !== false) e.append(c.nodeType ? c : document.createTextNode(c)); });
  return e;
};
export const col = c => (c ? (/^(c[1-4]|good|bad|warn|mute|accent|ink)$/.test(c) ? `var(--${c})` : c) : 'var(--c1)');
export const reduced = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
export const store = {
  get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } },
  del(k) { try { localStorage.removeItem(k); } catch (e) { /* storage unavailable */ } }
};
const ease = p => 1 - Math.pow(1 - p, 3);

/* ---------- axis helpers ---------- */
export function niceScale(lo, hi, n = 5) {
  if (!(hi > lo)) { const p = Math.abs(lo) || 1; lo -= p * 0.5; hi += p * 0.5; }
  const raw = (hi - lo) / n, mag = Math.pow(10, Math.floor(Math.log10(raw))), nr = raw / mag;
  const step = (nr < 1.5 ? 1 : nr < 3 ? 2 : nr < 7 ? 5 : 10) * mag;
  const min = Math.floor(lo / step + 1e-9) * step, max = Math.ceil(hi / step - 1e-9) * step, ticks = [];
  for (let t = min; t <= max + step / 2; t += step) ticks.push(+t.toFixed(10));
  return { min, max, step, ticks };
}
export const tickFmt = step => x => {
  const a = Math.abs(x);
  if (a >= 1e6) return +(x / 1e6).toFixed(2) + 'M';
  if (a >= 1e4) return +(x / 1e3).toFixed(1) + 'K';
  const d = step >= 1 ? 0 : Math.min(4, Math.ceil(-Math.log10(step)));
  return x.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
};

/* ---------- interactive xy chart ---------- */
let uid = 0;
export class XY {
  constructor(host, spec) {
    this.idx = null; this.playing = false; this.raf = 0; this.spec = spec; this.uid = ++uid;
    host.innerHTML = '<div class="legend"></div><div class="readout"></div><div class="plot"></div>';
    [this.lg, this.ro, this.plot] = host.children;
    this.plot.addEventListener('pointermove', e => this.hover(e));
    this.plot.addEventListener('pointerleave', () => { if (!this.playing) { this.idx = null; this.draw(); } });
    this.ob = new ResizeObserver(() => this.draw());
    this.ob.observe(this.plot);
    this.setSpec(spec);
  }
  destroy() { cancelAnimationFrame(this.raf); this.ob.disconnect(); }
  n0() { return this.spec.series[0].pts.length; }
  setSpec(spec) {
    this.spec = spec;
    this.lg.innerHTML = spec.series.filter(s => s.name && !s.noLegend).map(s => `<span class="lg"><i style="background:${col(s.color)}"></i>${esc(s.name)}</span>`).join('');
    if (this.idx != null && this.idx >= this.n0()) this.idx = null;
    this.draw();
  }
  play() {
    const n = this.n0();
    if (n < 2) return;
    cancelAnimationFrame(this.raf);
    if (reduced()) { this.playing = false; this.idx = n - 1; this.draw(); return; }
    this.playing = true;
    const dur = this.spec.dur || Math.min(1500, Math.max(900, n * 16)), t0 = performance.now();
    const step = t => {
      const p = Math.max(0, Math.min(1, (t - t0) / dur)), last = this.n0() - 1;
      this.idx = Math.max(0, Math.min(last, Math.floor(ease(p) * (last + 1))));
      if (p < 1) { this.draw(); this.raf = requestAnimationFrame(step); }
      else { this.playing = false; this.idx = last; this.draw(); }
    };
    this.raf = requestAnimationFrame(step);
  }
  hover(e) {
    if (this.playing || !this.sc) return;
    const r = this.plot.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top, pts = this.spec.series[0].pts, xy = this.spec.nearest === 'xy';
    let best = 0, bd = Infinity;
    pts.forEach((p, i) => { const dx = this.sc.X(p[0]) - x, dy = xy ? this.sc.Y(p[1]) - y : 0, d = dx * dx + dy * dy; if (d < bd) { bd = d; best = i; } });
    if (best !== this.idx) { this.idx = best; this.draw(); }
  }
  draw() {
    const s = this.spec, W = Math.max(280, Math.floor(this.plot.clientWidth) || 600), narrow = W < 520;
    const H = s.h || (narrow ? 250 : 310), M = { l: narrow ? 48 : 58, r: 14, t: 12, b: s.xLabels ? 40 : s.xlab ? 44 : 30 };
    const pw = W - M.l - M.r, ph = H - M.t - M.b, ser = s.series, s0 = ser[0], n0 = s0.pts.length, isBar = x => x.type === 'bars';
    let xmin = Infinity, xmax = -Infinity, ymin = Infinity, ymax = -Infinity;
    const grow = (x, y) => { if (x != null && isFinite(x)) { xmin = Math.min(xmin, x); xmax = Math.max(xmax, x); } if (y != null && isFinite(y)) { ymin = Math.min(ymin, y); ymax = Math.max(ymax, y); } };
    ser.forEach(S => S.pts.forEach(p => grow(p[0], p[1])));
    const bars = ser.filter(isBar), stack = s.bars === 'stack';
    if (stack) for (let i = 0; i < n0; i++) { let pos = 0, neg = 0; bars.forEach(S => { const y = S.pts[i][1]; if (y >= 0) pos += y; else neg += y; }); grow(null, pos); grow(null, neg); }
    if (ser.some(x => x.type === 'area' || isBar(x)) || s.yZero) grow(null, 0);
    (s.hlines || []).forEach(l => grow(null, l.y));
    (s.vlines || []).forEach(l => grow(l.x, null));
    if (!isFinite(xmin)) { xmin = 0; xmax = 1; }
    if (!isFinite(ymin)) { ymin = 0; ymax = 1; }
    const xs = [...new Set(bars.flatMap(S => S.pts.map(p => p[0])))].sort((a, b) => a - b);
    let dx = 1; for (let i = 1; i < xs.length; i++) dx = i === 1 ? xs[1] - xs[0] : Math.min(dx, xs[i] - xs[i - 1]);
    if (s.xLabels) { xmin = -0.5; xmax = s.xLabels.length - 0.5; dx = 1; } else if (bars.length) { xmin -= dx * 0.6; xmax += dx * 0.6; }
    if (s.xDomain) { xmin = s.xDomain[0]; xmax = s.xDomain[1]; }
    if (xmax === xmin) xmax = xmin + 1;
    const Yn = s.yDomain ? Object.assign(niceScale(s.yDomain[0], s.yDomain[1], 5), { min: s.yDomain[0], max: s.yDomain[1] }) : niceScale(ymin, ymax, narrow ? 4 : 5);
    Yn.ticks = Yn.ticks.filter(t => t >= Yn.min - 1e-9 && t <= Yn.max + 1e-9);
    const xt = s.xLabels ? s.xLabels.map((_, i) => i) : niceScale(xmin, xmax, narrow ? 4 : 6).ticks.filter(t => t >= xmin - 1e-9 && t <= xmax + 1e-9);
    const X = v => M.l + (v - xmin) / (xmax - xmin) * pw, Y = v => M.t + ph - (v - Yn.min) / (Yn.max - Yn.min) * ph;
    this.sc = { X, Y };
    const yF = s.yFmt || tickFmt(Yn.step), xF = s.xFmt || tickFmt(niceScale(xmin, xmax).step), yR = s.yRead || s.yFmt || (v => nf(v, 2)), xR = s.xRead || s.xFmt || (v => nf(v, 2));
    let defs = '', g = '';
    Yn.ticks.forEach(t => { const y = Y(t); g += `<line class="gl" x1="${M.l}" x2="${W - M.r}" y1="${y.toFixed(1)}" y2="${y.toFixed(1)}"/><text class="tl" x="${M.l - 7}" y="${(y + 3.5).toFixed(1)}" text-anchor="end">${esc(yF(t))}</text>`; });
    xt.forEach((t, i) => { g += `<text class="tl" x="${X(t).toFixed(1)}" y="${H - M.b + 15}" text-anchor="middle">${esc(s.xLabels ? s.xLabels[i] : xF(t))}</text>`; });
    if (s.xlab) g += `<text class="al" x="${M.l + pw / 2}" y="${H - 6}" text-anchor="middle">${esc(s.xlab)}</text>`;
    if (Yn.min < 0 && Yn.max > 0) g += `<line class="zl" x1="${M.l}" x2="${W - M.r}" y1="${Y(0).toFixed(1)}" y2="${Y(0).toFixed(1)}"/>`;
    const vis = this.playing && this.idx != null ? this.idx + 1 : Infinity, trim = S => (S.pts.length === n0 ? S.pts.slice(0, vis) : S.pts);
    const base = Math.max(Yn.min, Math.min(0, Yn.max)), path = pts => pts.map((p, i) => (i ? 'L' : 'M') + X(p[0]).toFixed(1) + ' ' + Y(p[1]).toFixed(1)).join('');
    if (bars.length) {
      const nb = bars.length, slot = pw * dx / (xmax - xmin), bw = Math.max(2, slot * 0.72 / (stack ? 1 : nb)), posRun = Array(n0).fill(0), negRun = Array(n0).fill(0);
      bars.forEach((S, bi) => {
        trim(S).forEach((p, i) => {
          if (!isFinite(p[1])) return;
          let y0 = 0, y1 = p[1];
          if (stack) { if (p[1] >= 0) { y0 = posRun[i]; y1 = y0 + p[1]; posRun[i] = y1; } else { y0 = negRun[i]; y1 = y0 + p[1]; negRun[i] = y1; } }
          const cx = X(p[0]), left = stack ? cx - bw / 2 : cx - nb * bw / 2 + bi * bw, top = Math.min(Y(y0), Y(y1)), hh = Math.max(0.6, Math.abs(Y(y0) - Y(y1)));
          g += `<rect x="${left.toFixed(1)}" y="${top.toFixed(1)}" width="${Math.max(1, bw - (nb > 1 && !stack ? 1 : 0)).toFixed(1)}" height="${hh.toFixed(1)}" rx="${Math.min(5, bw / 2).toFixed(1)}" fill="${col(S.color)}"/>`;
        });
      });
    }
    ser.forEach((S, si) => {
      const pts = trim(S).filter(p => isFinite(p[1]));
      if (!pts.length || isBar(S)) return;
      if (S.type === 'dots') {
        pts.forEach(p => { const x = X(p[0]), y = Y(p[1]); g += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="6" fill="${col(S.color)}" stroke="var(--panel-solid)" stroke-width="2.5"/>`; if (p[2]) g += `<text class="dl" x="${Math.min(W - M.r - 4, x + 9).toFixed(1)}" y="${(y - 9).toFixed(1)}" ${x > W - 90 ? 'text-anchor="end" dx="-16"' : ''}>${esc(p[2])}</text>`; });
        return;
      }
      if (S.type === 'area') {
        const id = `ag${this.uid}_${si}`;
        defs += `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${col(S.color)}" stop-opacity=".42"/><stop offset="1" stop-color="${col(S.color)}" stop-opacity="0"/></linearGradient>`;
        g += `<path d="${path(pts)}L${X(pts[pts.length - 1][0]).toFixed(1)} ${Y(base).toFixed(1)}L${X(pts[0][0]).toFixed(1)} ${Y(base).toFixed(1)}Z" fill="url(#${id})"/>`;
      }
      g += `<path class="ln" d="${path(pts)}" stroke="${col(S.color)}" ${S.dash ? 'stroke-dasharray="6 5"' : ''}/>`;
    });
    (s.hlines || []).forEach(l => { const y = Y(l.y).toFixed(1); g += `<line class="ref" x1="${M.l}" x2="${W - M.r}" y1="${y}" y2="${y}" ${l.color ? `style="stroke:${col(l.color)}"` : ''}/>`; if (l.label) g += `<text class="rt" x="${W - M.r - 4}" y="${(Y(l.y) - 5).toFixed(1)}" text-anchor="end" ${l.color ? `style="fill:${col(l.color)}"` : ''}>${esc(l.label)}</text>`; });
    (s.vlines || []).forEach(l => { const x = X(l.x); if (x < M.l - 1 || x > W - M.r + 1) return; g += `<line class="ref" x1="${x.toFixed(1)}" x2="${x.toFixed(1)}" y1="${M.t}" y2="${H - M.b}" ${l.color ? `style="stroke:${col(l.color)}"` : ''}/>`; if (l.label) { const end = x > W - 130; g += `<text class="rt" x="${(x + (end ? -5 : 5)).toFixed(1)}" y="${M.t + 11}" text-anchor="${end ? 'end' : 'start'}" ${l.color ? `style="fill:${col(l.color)}"` : ''}>${esc(l.label)}</text>`; } });
    const i = this.idx;
    if (i != null && i < n0) {
      const p0 = s0.pts[i];
      if (isFinite(p0[0])) {
        g += `<line class="cur" x1="${X(p0[0]).toFixed(1)}" x2="${X(p0[0]).toFixed(1)}" y1="${M.t}" y2="${H - M.b}"/>`;
        ser.forEach(S => { if (!isBar(S) && S.type !== 'dots' && !S.noRead && S.pts.length === n0 && isFinite(S.pts[i][1])) g += `<circle class="halo" cx="${X(S.pts[i][0]).toFixed(1)}" cy="${Y(S.pts[i][1]).toFixed(1)}" r="9" fill="${col(S.color)}" opacity=".22"/><circle cx="${X(S.pts[i][0]).toFixed(1)}" cy="${Y(S.pts[i][1]).toFixed(1)}" r="5" fill="${col(S.color)}" stroke="var(--panel-solid)" stroke-width="2.5"/>`; });
      }
    }
    this.plot.innerHTML = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(s.title || 'chart')}"><defs>${defs}</defs>${g}</svg>`;
    if (i != null && i < n0) {
      this.ro.innerHTML = s.readout ? s.readout(i) : `<span class="rx">${esc(s.xLabels ? s.xLabels[i] : (s.xlab ? s.xlab + ' ' : '') + xR(s0.pts[i][0]))}</span>` + ser.filter(S => !S.noRead && S.type !== 'dots' && S.pts.length === n0).map(S => `<span class="ri"><i style="background:${col(S.color)}"></i>${esc(S.name)} <b>${esc(yR(S.pts[i][1]))}</b></span>`).join('');
    } else this.ro.innerHTML = `<span class="hint">${s.hint || 'Press Play, or slide across the chart to read exact values.'}</span>`;
  }
}

/* ---------- html visuals ---------- */
export function hbars(items) {
  const M = Math.max(...items.map(i => Math.max(i.from || 0, i.to))) || 1;
  return '<div class="hb">' + items.map((it, k) => {
    const a = Math.min(it.from || 0, it.to), b = Math.max(it.from || 0, it.to);
    return `<div class="hrow"><div class="hl">${it.label}</div><div class="ht"><div class="hf" style="left:${(a / M * 100).toFixed(2)}%;width:${Math.max(0.6, (b - a) / M * 100).toFixed(2)}%;background:${col(it.color || 'c1')};--i:${k}"></div></div><div class="hv">${it.text}</div></div>`;
  }).join('') + '</div>';
}
export function donutHtml(spec) {
  const tot = sum(spec.parts.map(p => p.value)) || 1, C = 2 * Math.PI * 70;
  let off = 0;
  const segs = spec.parts.map((p, k) => {
    const len = p.value / tot * C, o = off; off += len;
    return `<circle class="seg" cx="100" cy="100" r="70" fill="none" stroke="${col(p.color)}" stroke-width="28" transform="rotate(-90 100 100)" style="--C:${C.toFixed(2)};--len:${len.toFixed(2)};--rest:${(C - len).toFixed(2)};--i:${k};stroke-dasharray:${len.toFixed(2)} ${(C - len).toFixed(2)};stroke-dashoffset:${(-o).toFixed(2)}"/>`;
  }).join('');
  const leg = spec.parts.map(p => `<div class="dli"><i style="background:${col(p.color)}"></i><div><b>${esc(p.name)}</b><span>${nf(p.value / tot * 100, 1)}%${p.note ? ' · ' + esc(p.note) : ''}</span></div></div>`).join('');
  return `<div class="donut"><svg viewBox="0 0 200 200" width="190" height="190" role="img" aria-label="${esc(spec.title)}"><circle cx="100" cy="100" r="70" fill="none" stroke="var(--soft)" stroke-width="28"/>${segs}<text x="100" y="102" text-anchor="middle" class="dbig">${esc(spec.center.big)}</text><text x="100" y="120" text-anchor="middle" class="dsmall">${esc(spec.center.small)}</text></svg><div class="dleg">${leg}</div></div>`;
}

/** Tiny animated sparkline from [x,y] points. */
export function sparkline(pts, { w = 160, h: hh = 54, color = 'var(--c1)' } = {}) {
  const p = pts.filter(q => isFinite(q[1]));
  if (p.length < 2) return '';
  const xs = p.map(q => q[0]), ys = p.map(q => q[1]), x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const X = v => 4 + (v - x0) / ((x1 - x0) || 1) * (w - 8), Y = v => hh - 6 - (v - y0) / ((y1 - y0) || 1) * (hh - 14);
  const d = p.map((q, i) => (i ? 'L' : 'M') + X(q[0]).toFixed(1) + ' ' + Y(q[1]).toFixed(1)).join('');
  const id = 'sp' + (++uid);
  return `<svg class="spark" viewBox="0 0 ${w} ${hh}" aria-hidden="true"><defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${color}" stop-opacity=".35"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient></defs><path d="${d}L${X(p[p.length - 1][0]).toFixed(1)} ${hh}L${X(p[0][0]).toFixed(1)} ${hh}Z" fill="url(#${id})" class="sp-fill"/><path d="${d}" pathLength="1" class="sp-line" stroke="${color}"/></svg>`;
}

/** Counts the first number in `text` up from zero inside `el`. */
export function countUp(el, text, dur = 650) {
  el.textContent = text;
  if (reduced()) return;
  const m = /(\d[\d,]*\.?\d*)/.exec(text);
  if (!m) return;
  const target = parseFloat(m[1].replace(/,/g, '')), dec = (m[1].split('.')[1] || '').length;
  if (!isFinite(target) || target === 0) return;
  const pre = text.slice(0, m.index), post = text.slice(m.index + m[1].length), t0 = performance.now();
  const step = t => {
    const p = Math.min(1, (t - t0) / dur), val = target * (1 - Math.pow(1 - p, 4));
    el.textContent = pre + val.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec }) + post;
    if (p < 1 && el.isConnected) requestAnimationFrame(step); else el.textContent = text;
  };
  requestAnimationFrame(step);
}

/** Confetti-style burst from the centre of `el`. */
export function burst(el) {
  if (reduced() || !el.isConnected) return;
  const r = el.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  const colors = ['#FF8A7A', '#A79BFF', '#FFD45C', '#8BD66F', '#7CC4FF', '#FF9EC7'];
  for (let k = 0; k < 22; k++) {
    const p = document.createElement('i'), a = Math.random() * Math.PI * 2, d = 60 + Math.random() * 110;
    p.className = 'confetti'; p.style.cssText = `left:${cx}px;top:${cy}px;background:${colors[k % colors.length]}`;
    document.body.append(p);
    p.animate([{ transform: 'translate(0,0) rotate(0) scale(1)', opacity: 1 }, { transform: `translate(${Math.cos(a) * d}px,${Math.sin(a) * d + 40}px) rotate(${Math.random() * 540}deg) scale(.4)`, opacity: 0 }], { duration: 700 + Math.random() * 300, easing: 'cubic-bezier(.2,.7,.3,1)' }).onfinish = () => p.remove();
  }
}
