// @ts-nocheck
/* Countries compared: the results shown once data has loaded (chart, ranking, notes, calculator link). */
import { h, esc, chartBox, sourceLine } from './dataui.js';
import { sharePath } from './sharing.js';
import { countryName, regionOf, indicatorOf, rankCountries, yearAxis, alignToYears, formatValue, fxInputs, CODES } from '../lib/countries';

export const PALETTE = ['c1', 'c4', 'c3', 'var(--lav)', 'ink', 'var(--coral)'];
export const cv = c => (c.startsWith('var') ? c : `var(--${c})`);
export const colorOf = (selected, code) => cv(PALETTE[Math.max(0, selected.indexOf(code)) % PALETTE.length]);

const axisFmt = kind => v => (kind === 'usd' ? '$' + (Math.abs(v) >= 1000 ? Math.round(v / 1000) + 'K' : Math.round(v)) : kind === 'people' ? formatValue('people', v) : Math.round(v * 10) / 10 + '%');

function chartSpec(data, selected, ind) {
  const years = yearAxis(data.series), fmt = v => formatValue(ind.kind, v);
  const series = selected.filter(c => (data.series[c] || []).length).map(c => ({ name: countryName(c), color: PALETTE[selected.indexOf(c) % PALETTE.length], pts: alignToYears(data.series[c], years) }));
  return {
    series, h: 320, title: `${ind.label} over time`, yFmt: axisFmt(ind.kind), xFmt: v => String(Math.round(v)), hint: 'Slide across the chart to read each year.',
    readout: i => `<span class="rx">${years[i]}</span>` + series.map(s => `<span class="ri"><i style="background:${cv(s.color)}"></i>${esc(s.name)} <b>${esc(fmt(s.pts[i][1]))}</b></span>`).join('')
  };
}

function chartCard(data, selected, ind, scope) {
  const spec = chartSpec(data, selected, ind), missing = selected.filter(c => !(data.series[c] || []).length);
  if (!spec.series.length) return h('section', { class: 'd-card' }, h('h2', { class: 'd-h' }, ind.label + ' over time'), h('p', { class: 'd-empty' }, 'The World Bank has no figures for these countries on this measure. Try different countries or another measure.'));
  const box = chartBox(spec); scope.add(box.destroy);
  return h('section', { class: 'd-card' }, h('h2', { class: 'd-h' }, `${ind.label} over time`),
    sourceLine({ source: 'World Bank open data', url: 'https://data.worldbank.org/indicator/' + ind.id }), box.el,
    missing.length ? h('p', { class: 'd-cap' }, `No figures for ${missing.map(countryName).join(', ')}.`) : null,
    h('p', { class: 'd-cap' }, 'Some countries report with a delay, so the newest year can be missing. Lines skip years without a figure.'));
}

const COLS = [['country', 'Country'], ['rank', 'Rank'], ['value', 'Latest'], ['year', 'Year'], ['region', 'Region']];
const cmp = (key, dir) => (a, b) => {
  const va = key === 'country' ? countryName(a.code) : key === 'region' ? regionOf(a.code) : key === 'rank' ? a.rank : a[key];
  const vb = key === 'country' ? countryName(b.code) : key === 'region' ? regionOf(b.code) : key === 'rank' ? b.rank : b[key];
  if (va == null && vb == null) return a.code.localeCompare(b.code);
  if (va == null) return 1;
  if (vb == null) return -1;
  return (typeof va === 'string' ? va.localeCompare(vb) : va - vb) * dir || a.code.localeCompare(b.code);
};

function rankingCard(ranking, selected, ind) {
  const rows = rankCountries(ranking.latest), have = rows.filter(r => r.value != null).length;
  let key = 'rank', dir = 1;
  const wrap = h('div', { class: 'd-tw', role: 'region', 'aria-label': `${ind.label}: latest figure for each country`, tabindex: '0' }), note = h('p', { class: 'd-cap', 'aria-live': 'polite' });
  const draw = () => {
    const sorted = rows.slice().sort(cmp(key, dir));
    const th = ([k, label]) => h('th', { scope: 'col', 'aria-sort': k === key ? (dir > 0 ? 'ascending' : 'descending') : 'none', class: k === 'country' ? '' : 'num' }, h('button', { type: 'button', class: 'cty-sort', onclick: () => { dir = k === key ? -dir : (k === 'value' ? -1 : 1); key = k; draw(); } }, label, h('span', { 'aria-hidden': 'true' }, k === key ? (dir > 0 ? ' ↑' : ' ↓') : '')));
    wrap.replaceChildren(h('table', { class: 'd-t cty-t' }, h('thead', {}, h('tr', {}, COLS.map(th))),
      h('tbody', {}, sorted.map(r => h('tr', { class: selected.includes(r.code) ? 'sel' : null },
        h('th', { scope: 'row' }, countryName(r.code), selected.includes(r.code) ? h('span', { class: 'cty-tag' }, 'selected') : null),
        h('td', {}, r.rank == null ? '—' : String(r.rank)), h('td', { class: r.value != null && r.value < 0 ? 'neg' : r.value == null ? 'na' : '' }, formatValue(ind.kind, r.value)),
        h('td', {}, r.year == null ? '—' : String(r.year)), h('td', { class: 'reg' }, regionOf(r.code)))))));
    note.textContent = `Sorted by ${COLS.find(c => c[0] === key)[1].toLowerCase()}, ${dir > 0 ? 'ascending' : 'descending'}.`;
  };
  draw();
  return h('section', { class: 'd-card' }, h('h2', { class: 'd-h' }, `Latest ${ind.label.toLowerCase()}, all ${CODES.length} countries`),
    h('p', { class: 'd-sub' }, `${have} of ${rows.length} countries have a figure from the last ten years. Tap a column heading to sort. Your chosen countries are highlighted.`), wrap, note);
}

function calcCard(inflation, selected) {
  if (selected.length < 2 || !inflation) return null;
  const [a, b] = selected, fx = fxInputs(inflation.latest[a], inflation.latest[b]);
  if (!fx) return null;
  return h('section', { class: 'd-card' }, h('h2', { class: 'd-h' }, 'Take it to a calculator'),
    h('p', { class: 'd-plain plain', html: `Latest inflation is <b>${esc(formatValue('pct', fx.pd))}</b> in ${esc(countryName(a))} and <b>${esc(formatValue('pct', fx.pf))}</b> in ${esc(countryName(b))}. Treat the first as home and the second as foreign, and the FX calculator shows what purchasing power parity says should happen to the exchange rate.` }),
    h('a', { class: 'd-btn main', href: sharePath('fx', { pd: fx.pd, pf: fx.pf }), 'data-link': true }, 'Open the FX calculator →'));
}

export function buildResults({ series, ranking, inflation }, selected, ind, scope) {
  return h('div', { class: 'd-page' }, chartCard(series, selected, ind, scope), rankingCard(ranking, selected, ind),
    h('section', { class: 'd-card' }, h('h2', { class: 'd-h' }, 'What this means for investors'), h('p', { class: 'd-plain plain' }, ind.investors)),
    calcCard(inflation, selected));
}
export { indicatorOf };
