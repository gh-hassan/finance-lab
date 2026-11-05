// @ts-nocheck
/* Scenarios page: three futures, what matters most, two-way what-if grid, and a risk simulation. */
import { MODELS, defaultRanges, findOutput, grid, histogram, monteCarlo, outcome, tornado, valuesAt } from '../lib/scenarios';
import { isNum, nf, pct } from '../lib/math';
import { h, esc, store, reduced } from './visuals.js';

const fmtDriver = (d, v) => (d.pre || '') + nf(v, d.step < 1 ? (d.step < 0.5 ? 2 : 1) : 0) + (d.unit === '%' ? '%' : d.unit ? ' ' + d.unit : '');
const delta = (x, b) => (isNum(x) && isNum(b) && b !== 0 ? (x - b) / Math.abs(b) : null);
const deltaChip = (o, x, b) => { const d = delta(x, b); if (d == null || Math.abs(d) < 0.0005) return ''; const good = (o.better === 'high') === (d > 0); return `<span class="dchip ${good ? 'good' : 'bad'}">${d > 0 ? '+' : '−'}${Math.min(999, Math.abs(d) * 100).toFixed(0)}%</span>`; };

export function renderScenarios(main) {
  const st = { id: store.get('fl:sc:model') || 'project', ranges: {}, probs: [25, 50, 25], out: null, x: null, y: null, seed: 1 };
  let raf = 0, ro = null, sim = null;
  const model = () => MODELS.find(m => m.id === st.id) || MODELS[0];
  const ranges = () => (st.ranges[model().id] ||= defaultRanges(model()));
  const outId = () => { const m = model(); return m.outputs.some(o => o.id === st.out) ? st.out : m.main; };

  const head = h('header', { class: 'vhead reveal' }, h('div', { class: 'vtitle' }, h('p', { class: 'eyebrow' }, 'What if?'), h('h1', { html: 'Try the <em>future</em>' }), h('p', { class: 'blurb' }, 'Pick a situation. Change the numbers. See what could happen.')));
  const picker = h('div', { class: 'picker reveal' });
  const body = h('div', { class: 'scbody' });
  main.innerHTML = '';
  main.append(head, picker, body);

  function drawPicker() {
    picker.innerHTML = '';
    MODELS.forEach(m => picker.append(h('button', { type: 'button', class: 'pick' + (m.id === st.id ? ' on' : ''), onclick: () => { st.id = m.id; st.out = null; st.x = null; st.y = null; store.set('fl:sc:model', m.id); drawPicker(); build(); } }, h('b', {}, m.title), h('small', {}, m.pitch))));
  }

  /* ----- sections ----- */
  let tableRes, tornEl, gridEl, riskEl, measureEl;
  function build() {
    cancelAnimationFrame(raf); if (ro) ro.disconnect();
    const m = model(), r = ranges();
    body.innerHTML = '';
    /* 1. three futures */
    const t = h('table', { class: 'sct' });
    t.append(h('thead', {}, h('tr', {}, h('th', {}), h('th', { class: 'w' }, 'Worst'), h('th', {}, 'Base'), h('th', { class: 'b' }, 'Best'), h('th', {}, 'Likely'))));
    const tb = h('tbody');
    m.drivers.forEach(d => {
      const tr = h('tr', {}, h('th', {}, d.label));
      ['worst', 'base', 'best'].forEach(k => {
        const inp = h('input', { type: 'number', step: d.step, value: r[d.id][k], 'aria-label': `${d.label}, ${k}` });
        inp.addEventListener('input', () => { const v = inp.valueAsNumber; if (Number.isFinite(v)) { r[d.id][k] = d.int ? Math.round(v) : v; refresh(); } });
        tr.append(h('td', {}, h('div', { class: 'inp sm' }, d.pre && h('span', { class: 'u' }, d.pre), inp, d.unit && h('span', { class: 'u' }, d.unit === 'yrs' ? 'yrs' : d.unit))));
      });
      tr.append(h('td', { class: 'dim' }, ''));
      tb.append(tr);
    });
    const probTr = h('tr', { class: 'probs' }, h('th', {}, 'How likely is each?'));
    st.probs.forEach((p, i) => { const inp = h('input', { type: 'number', min: 0, max: 100, step: 5, value: p, 'aria-label': 'Chance ' + ['worst', 'base', 'best'][i] }); inp.addEventListener('input', () => { st.probs[i] = Math.max(0, inp.valueAsNumber || 0); refresh(); }); probTr.append(h('td', {}, h('div', { class: 'inp sm' }, inp, h('span', { class: 'u' }, '%')))); });
    probTr.append(h('td', { class: 'dim' }, ''));
    tb.append(probTr);
    tableRes = h('tbody', { class: 'res' });
    t.append(tb, tableRes);
    const sec1 = h('section', { class: 'card scsec reveal' }, h('div', { class: 'sec-h2' }, h('h2', {}, 'Three possible futures'), h('p', {}, 'Edit any number.')), h('div', { class: 'tw2' }, t));

    /* measure picker */
    measureEl = h('div', { class: 'measure reveal' });
    if (m.outputs.length > 1) {
      const sel = h('select', { 'aria-label': 'What to measure' }, m.outputs.map(o => h('option', { value: o.id }, o.label)));
      sel.value = outId(); sel.addEventListener('change', () => { st.out = sel.value; refreshLower(true); });
      measureEl.append(h('span', {}, 'Measure'), sel);
    }
    tornEl = h('section', { class: 'card scsec reveal' });
    gridEl = h('section', { class: 'card scsec reveal' });
    riskEl = h('section', { class: 'card scsec reveal' });
    body.append(sec1, measureEl, tornEl, gridEl, riskEl);
    refresh(true);
  }

  function refresh(first) { renderResults(); refreshLower(first); }
  function refreshLower(first) { renderTornado(); renderGrid(); renderRisk(first || false); }

  function renderResults() {
    const m = model(), r = ranges();
    tableRes.innerHTML = '';
    m.outputs.forEach(o => {
      const oc = outcome(m, o.id, r, st.probs);
      const cell = (x, cls) => `<td class="${cls || ''}"><b>${isNum(x) ? esc(o.fmt(x)) : '—'}</b>${cls === 'base' ? '' : deltaChip(o, x, oc.base)}</td>`;
      const tr = h('tr', { html: `<th>${esc(o.label)}</th>${cell(oc.worst, 'wc')}${cell(oc.base, 'base')}${cell(oc.best, 'bc')}<td class="lk"><b>${isNum(oc.expected) ? esc(o.fmt(oc.expected)) : '—'}</b></td>` });
      tableRes.append(tr);
    });
  }

  function renderTornado() {
    const m = model(), o = findOutput(m, outId()), rows = tornado(m, o.id, ranges()), base = o.calc(valuesAt(m, ranges(), 'base'));
    const lo = Math.min(...rows.map(x => x.low)), hi = Math.max(...rows.map(x => x.high)), pos = v => ((v - lo) / ((hi - lo) || 1)) * 100, bp = pos(base);
    const leftC = o.better === 'high' ? 'bad' : 'good', rightC = o.better === 'high' ? 'good' : 'bad';
    tornEl.innerHTML = `<div class="sec-h2"><h2>What matters most</h2><p>${rows[0] && rows[0].swing > 0 ? `<b>${esc(rows[0].label)}</b> moves the result the most.` : 'Nothing moves the result.'}</p></div>
      <div class="torn">${rows.map((r, i) => `<div class="trow" style="--i:${i}"><div class="tlab">${esc(r.label)}</div><div class="tval l ${leftC}">${esc(o.short(r.low))}</div>
        <div class="ttrack"><i class="seg l ${leftC}" style="left:${pos(r.low)}%;width:${Math.max(0, bp - pos(r.low))}%"></i><i class="seg r ${rightC}" style="left:${bp}%;width:${Math.max(0, pos(r.high) - bp)}%"></i><i class="bline" style="left:${bp}%"></i></div>
        <div class="tval r ${rightC}">${esc(o.short(r.high))}</div></div>`).join('')}</div>
      <p class="legend2"><i class="bad"></i>worse than base <i class="good"></i>better than base <span>Line = base case</span></p>`;
    requestAnimationFrame(() => tornEl.querySelector('.torn') && tornEl.querySelector('.torn').classList.add('play'));
  }

  function renderGrid() {
    const m = model(), o = findOutput(m, outId()), r = ranges(), rows = tornado(m, o.id, r);
    if (!m.drivers.some(d => d.id === st.x)) st.x = (rows[0] || m.drivers[0]).id;
    if (!m.drivers.some(d => d.id === st.y) || st.y === st.x) st.y = (rows.find(x => x.id !== st.x) || m.drivers.find(d => d.id !== st.x)).id;
    const g = grid(m, o.id, st.x, st.y, r, 7), dx = m.drivers.find(d => d.id === st.x), dy = m.drivers.find(d => d.id === st.y);
    const maxAbs = Math.max(1e-9, ...g.z.flat().filter(isNum).map(z => Math.abs(delta(z, g.base) ?? 0)));
    const near = (arr, v) => arr.reduce((b, x, i) => (Math.abs(x - v) < Math.abs(arr[b] - v) ? i : b), 0), bx = near(g.xs, r[st.x].base), by = near(g.ys, r[st.y].base);
    const sel = (cur, other, key) => `<select data-k="${key}" aria-label="${key === 'x' ? 'Across' : 'Down'}">${m.drivers.filter(d => d.id !== other).map(d => `<option value="${d.id}" ${d.id === cur ? 'selected' : ''}>${esc(d.label)}</option>`).join('')}</select>`;
    gridEl.innerHTML = `<div class="sec-h2"><h2>What if two things change?</h2><p>Each square is one combination.</p></div>
      <div class="pair"><label><span>Across</span>${sel(st.x, st.y, 'x')}</label><label><span>Down</span>${sel(st.y, st.x, 'y')}</label></div>
      <div class="tw2"><table class="hm"><thead><tr><th></th>${g.xs.map(x => `<th>${esc(fmtDriver(dx, x))}</th>`).join('')}</tr></thead><tbody>${g.z.map((row, yi) => `<tr><th>${esc(fmtDriver(dy, g.ys[yi]))}</th>${row.map((z, xi) => { const d = delta(z, g.base) ?? 0, good = (o.better === 'high') === (d > 0), a = Math.round(Math.min(1, Math.abs(d) / maxAbs) * 58); return `<td class="${xi === bx && yi === by ? 'basecell' : ''}" style="background:${isNum(z) ? `color-mix(in srgb, var(--${good ? 'good' : 'bad'}) ${a}%, transparent)` : 'transparent'}" title="${esc(isNum(z) ? o.fmt(z) : '—')}">${isNum(z) ? esc(o.short(z)) : '—'}</td>`; }).join('')}</tr>`).join('')}</tbody></table></div>`;
    gridEl.querySelectorAll('select').forEach(s => s.addEventListener('change', () => { st[s.dataset.k] = s.value; renderGrid(); }));
  }

  function renderRisk(animate) {
    const m = model(), o = findOutput(m, outId());
    sim = monteCarlo(m, o.id, ranges(), 3000, st.seed);
    const bad = o.better === 'high' ? ['Bad day', sim.p10] : ['Bad day', sim.p90], good = o.better === 'high' ? ['Good day', sim.p90] : ['Good day', sim.p10];
    riskEl.innerHTML = `<div class="sec-h2"><h2>How risky is it?</h2><p>3,000 what-ifs, each with random numbers inside your ranges.</p><button type="button" class="btn play" data-run>Run again</button></div>
      <div class="hist"></div><div class="rcount"></div>
      <div class="rstats"><div><span>Typical</span><b>${esc(o.fmt(sim.p50))}</b></div><div><span>${bad[0]}</span><b class="bad">${esc(o.fmt(bad[1]))}</b></div><div><span>${good[0]}</span><b class="good">${esc(o.fmt(good[1]))}</b></div>${sim.probBad != null ? `<div class="chance"><span>Chance of ${esc(sim.riskText)}</span><b class="${sim.probBad > 0.25 ? 'bad' : sim.probBad > 0.1 ? 'warn' : 'good'}">${pct(sim.probBad, 0)}</b></div>` : ''}</div>`;
    riskEl.querySelector('[data-run]').addEventListener('click', () => { st.seed++; renderRisk(true); });
    const host = riskEl.querySelector('.hist'), cnt = riskEl.querySelector('.rcount');
    const lo = Math.min(...sim.samples), hi = Math.max(...sim.samples), full = histogram(sim.samples, sim.samples.length, lo, hi, 32), ymax = Math.max(...full, 1);
    const draw = frac => {
      const W = Math.max(280, Math.floor(host.clientWidth) || 600), H = W < 480 ? 220 : 260, padL = 14, padR = 14, top = 24, base = H - 34, bw = (W - padL - padR) / 32, k = Math.round(sim.samples.length * frac), hs = histogram(sim.samples, k, lo, hi, 32);
      const X = v => padL + (W - padL - padR) * (v - lo) / ((hi - lo) || 1);
      let g = `<line x1="${padL}" x2="${W - padR}" y1="${base}" y2="${base}" stroke="var(--line)" stroke-width="2"/>`;
      hs.forEach((c, i) => { const mid = lo + (i + 0.5) * (hi - lo) / 32, isBad = sim.threshold == null ? null : (o.risk.kind === 'below' ? mid < sim.threshold : mid > sim.threshold), col = isBad == null ? 'var(--c2)' : isBad ? 'var(--bad)' : 'var(--good)', hh = (base - top) * c / ymax; g += `<rect x="${(padL + i * bw + 1).toFixed(1)}" y="${(base - hh).toFixed(1)}" width="${Math.max(1, bw - 2).toFixed(1)}" height="${Math.max(0, hh).toFixed(1)}" rx="3" fill="${col}" opacity=".9"/>`; });
      const mark = (v, label, c, dy) => (v >= lo && v <= hi ? `<line x1="${X(v)}" x2="${X(v)}" y1="${top - 6}" y2="${base}" stroke="${c}" stroke-width="1.6" stroke-dasharray="5 4"/><text x="${Math.min(W - padR - 2, Math.max(padL + 2, X(v)))}" y="${top - 10 + dy}" text-anchor="${X(v) > W - 90 ? 'end' : X(v) < 90 ? 'start' : 'middle'}" font-size="12.5" font-weight="600" fill="${c}">${label}</text>` : '');
      g += mark(sim.base, 'Base case', 'var(--ink)', 0) + (sim.threshold != null && Math.abs(X(sim.threshold) - X(sim.base)) > 70 ? mark(sim.threshold, 'Risk line', 'var(--bad)', 0) : '');
      g += `<text x="${padL}" y="${H - 12}" font-size="12.5" fill="var(--mute)" font-weight="600">${esc(o.short(lo))}</text><text x="${W - padR}" y="${H - 12}" text-anchor="end" font-size="12.5" fill="var(--mute)" font-weight="600">${esc(o.short(hi))}</text>`;
      host.innerHTML = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Spread of possible results">${g}</svg>`;
      cnt.textContent = `${k.toLocaleString('en-US')} what-ifs run`;
    };
    cancelAnimationFrame(raf);
    if (ro) ro.disconnect();
    ro = new ResizeObserver(() => { if (!sim.running) draw(1); }); ro.observe(host);
    if (animate && !reduced()) {
      sim.running = true; const t0 = performance.now(), dur = 1500;
      const step = now => { const p = Math.min(1, (now - t0) / dur); draw(1 - Math.pow(1 - p, 3)); if (p < 1) raf = requestAnimationFrame(step); else { sim.running = false; draw(1); } };
      raf = requestAnimationFrame(step);
    } else draw(1);
  }

  drawPicker();
  build();
  return () => { cancelAnimationFrame(raf); if (ro) ro.disconnect(); };
}
