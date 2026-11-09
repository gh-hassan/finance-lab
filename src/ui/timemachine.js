// @ts-nocheck
/* Home page "time machine": pick a start year and an amount, see what it would be worth today in the whole US stock market versus cash. Real monthly returns from Kenneth French's data library. */
import '../styles/timemachine.css';
import { h, api, scope, segmented } from './dataui.js';
import { rangeSlider } from './slider.js';
import { timeMachine, startYears } from '../lib/homeplus';
import { money, pct, num } from '../lib/format';

const AMOUNTS = [['1000', '$1,000'], ['10000', '$10,000'], ['100000', '$100,000']];
const W = 640, H = 240, PAD = { l: 8, r: 8, t: 14, b: 22 };
const NS = 'http://www.w3.org/2000/svg';
const reduced = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };

function chartPaths(t) {
  const all = [...t.stocks, ...t.cash, ...(t.pk ? t.pk.pts : [])], x0 = t.stocks[0][0], x1 = t.stocks[t.stocks.length - 1][0], y1 = Math.max(...all.map(p => p[1])) * 1.05;
  const X = v => PAD.l + (v - x0) / ((x1 - x0) || 1) * (W - PAD.l - PAD.r), Y = v => H - PAD.b - v / y1 * (H - PAD.t - PAD.b);
  const line = pts => pts.map((p, i) => (i ? 'L' : 'M') + X(p[0]).toFixed(1) + ' ' + Y(p[1]).toFixed(1)).join('');
  const s = line(t.stocks), c = line(t.cash), pr = t.pk ? line(t.pk.pts) : '', last = t.stocks[t.stocks.length - 1];
  return { s, c, pr, area: s + `L${X(last[0]).toFixed(1)} ${Y(0)}L${X(x0).toFixed(1)} ${Y(0)}Z`, x0, x1, dot: [X(last[0]), Y(last[1])], base: Y(0) };
}
const el = (tag, attrs = {}) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); return e; };

export function mountTimeMachine(host) {
  const S = scope(); let data = null, pk = null, year = 0, amount = 10000, played = false, io = null;
  const out = h('div', { class: 'tm-out' }), note = h('p', { class: 'tm-note' }), yv = h('b', {}, ''), chart = h('div', { class: 'tm-chart' });
  const body = h('div', { class: 'tm-body' }, h('div', { class: 'tm-sk' }));
  host.replaceChildren(h('section', { class: 'hl tm', 'aria-label': 'Time machine' }, h('div', { class: 'hl-head' }, h('h2', {}, 'The time machine'), h('span', { class: 'hl-stat' }, 'Real US market returns since 1963')), body));

  function draw(animate) {
    const t = timeMachine(data.months, data.factors.MKT, data.factors.RF, year, amount, pk);
    if (!t) { out.replaceChildren(h('p', { class: 'tm-note' }, 'There is not enough data for that start year. Try an earlier one.')); chart.replaceChildren(); return; }
    const p = chartPaths(t), svg = el('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': `$${num(t.amount)} invested in ${Math.floor(t.startMonth / 100)} would be worth ${money(t.endStocks)} today in US stocks, or ${money(t.endCash)} in cash.` });
    const grad = el('linearGradient', { id: 'tmg', x1: 0, y1: 0, x2: 0, y2: 1 }); grad.append(el('stop', { offset: 0, 'stop-color': 'var(--good)', 'stop-opacity': '.3' }), el('stop', { offset: 1, 'stop-color': 'var(--good)', 'stop-opacity': '0' }));
    const defs = el('defs'); defs.append(grad);
    const area = el('path', { d: p.area, fill: 'url(#tmg)', class: 'tm-area' }), cash = el('path', { d: p.c, class: 'tm-cash', fill: 'none' }), pkl = p.pr ? el('path', { d: p.pr, class: 'tm-pk', fill: 'none' }) : null, stocks = el('path', { d: p.s, class: 'tm-line', fill: 'none', pathLength: '1' });
    const axis = el('line', { x1: PAD.l, x2: W - PAD.r, y1: p.base, y2: p.base, class: 'tm-axis' });
    const dot = el('circle', { cx: p.dot[0], cy: p.dot[1], r: 5, class: 'tm-dot' });
    const t0 = el('text', { x: PAD.l, y: H - 5, class: 'tm-tx' }); t0.textContent = String(Math.floor(t.startMonth / 100));
    const t1 = el('text', { x: W - PAD.r, y: H - 5, class: 'tm-tx', 'text-anchor': 'end' }); t1.textContent = String(Math.floor(t.endMonth / 100));
    svg.append(defs, axis, area, cash); if (pkl) svg.append(pkl); svg.append(stocks, dot, t0, t1);
    chart.replaceChildren(svg);
    if (animate && !reduced()) { stocks.classList.add('go'); area.classList.add('go'); dot.classList.add('go'); }
    const worst = t.worstYear, x = t.multiple;
    out.replaceChildren(
      h('div', { class: 'tm-big' }, h('span', {}, `$${num(t.amount)} in ${Math.floor(t.startMonth / 100)} would be worth`), h('strong', {}, money(t.endStocks)), h('em', {}, `${num(x, x < 10 ? 1 : 0)}× your money, about ${pct(t.yearly, 1)} a year`)),
      h('div', { class: 'tm-vs' }, h('span', {}, h('i', { class: 'a' }), 'US stocks ', h('b', {}, money(t.endStocks))), h('span', {}, h('i', { class: 'b' }), 'Cash in a safe account ', h('b', {}, money(t.endCash))),
        t.pk ? h('span', {}, h('i', { class: 'c' }), 'Pakistan stocks ', h('b', {}, money(t.pk.endUsd))) : null,
        pk && !t.pk ? h('span', { class: 'tm-real' }, `Pakistan stocks join in when you start in ${Math.floor(pk.months[0] / 100) + 1} or later (the data begins in ${Math.floor(pk.months[0] / 100)}).`) : null));
    const pkNote = t.pk ? ` Pakistan stocks are shown in US dollars so the lines compare fairly. In rupees the same money grew ${num(t.pk.multiplePkr, 1)}×, but the rupee lost value against the dollar, which is why the dollar line is lower. It is an equal mix of 13 big companies that are listed today, so real results would have been lower.` : '';
    note.textContent = `The ride was not smooth: the biggest fall from a peak was ${pct(Math.abs(t.worstDrop), 0)}${worst ? `, and the worst full year was ${pct(worst.ret, 0)} (${worst.year})` : ''}. Dividends are included. Taxes, fees and inflation are not. The past does not promise the future.${pkNote}`;
  }

  function build() {
    const r = startYears(data.months);
    if (!r) { host.hidden = true; return; }
    year = Math.min(r.max, Math.max(r.min, 2010));
    const rs = rangeSlider({ min: r.min, max: r.max, step: 1, value: year, label: 'Start year', fmt: v => String(v) });
    rs.input.addEventListener('input', () => { year = +rs.input.value; yv.textContent = String(year); draw(false); });
    yv.textContent = String(year);
    const seg = segmented({ options: AMOUNTS, value: String(amount), label: 'Amount to invest', onChange: v => { amount = +v; draw(false); } });
    body.replaceChildren(h('div', { class: 'tm-ctl' }, h('div', { class: 'tm-f' }, h('span', {}, 'If you had invested in ', yv), rs.el), h('div', { class: 'tm-f' }, h('span', {}, 'The amount'), seg.el)),
      h('div', { class: 'tm-grid' }, out, chart), note,
      h('div', { class: 'hl-head' }, h('a', { href: '/factor-returns', 'data-link': true }, 'Explore all the data behind this →'), h('a', { href: '/tvm', 'data-link': true }, 'Try your own numbers →')));
    draw(false);
    io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting) && !played) { played = true; draw(true); io.disconnect(); } }, { threshold: 0.35 });
    io.observe(body);
  }

  api('pkhistory', {}, S.signal).then(d => { if (d && Array.isArray(d.months) && Array.isArray(d.usd) && Array.isArray(d.pkr)) { pk = d; if (data && host.isConnected) draw(false); } }).catch(() => { });
  api('factors', {}, S.signal).then(d => {
    if (!d || !Array.isArray(d.months) || !d.factors || !Array.isArray(d.factors.MKT) || !Array.isArray(d.factors.RF)) throw new Error('shape');
    data = d; build();
  }).catch(e => { if (e.name !== 'AbortError') host.hidden = true; });
  return () => { S.run(); if (io) io.disconnect(); };
}
