// @ts-nocheck
/* Factor returns: the sections shown once the monthly data has loaded. */
import { h, esc, statGrid, dataTable, chartBox, segmented, sourceLine, saveCsv } from './dataui.js';
import { sharePath } from './sharing.js';
import { FACTORS, FACTOR_KEYS, RANGES, rangeStart, growthPoints, prevMonth, factorStats, calendarYears, decadeAverages, recentYears, capmInputs } from '../lib/factors';
import { pct, num, monthYear } from '../lib/format';

const neg = v => (v != null && v < 0 ? 'neg' : '');
const monthLabel = m => monthYear(`${Math.floor(m / 100)}-${String(m % 100).padStart(2, '0')}-01`);
const usd = v => '$' + num(v, v >= 100 ? 0 : 2);
const cv = c => (c.startsWith('var') ? c : `var(--${c})`);
const info = k => FACTORS.find(f => f.key === k);

function chartSpec(d, keys, from) {
  const ms = d.months.slice(from), labels = [prevMonth(ms[0]), ...ms];
  const series = FACTORS.filter(f => keys.includes(f.key)).map(f => ({ name: f.short, color: f.color, dash: f.dash, pts: growthPoints(ms, d.factors[f.key].slice(from)) }));
  return {
    series, h: 320, title: 'Growth of one dollar invested in each factor', yFmt: v => '$' + num(v, v >= 20 ? 0 : 1), xFmt: v => String(Math.round(v)),
    hlines: [{ y: 1, label: '$1' }], hint: 'Slide across the chart to read each month.',
    readout: i => `<span class="rx">End of ${esc(monthLabel(labels[i]))}</span>` + series.map(s => `<span class="ri"><i style="background:${cv(s.color)}"></i>${esc(s.name)} <b>${esc(usd(s.pts[i][1]))}</b></span>`).join('')
  };
}

function statsRows(d, from) {
  const ms = d.months.slice(from), S = Object.fromEntries(FACTORS.map(f => [f.key, factorStats(ms, d.factors[f.key].slice(from))]));
  const row = (label, title, fn) => ({ label, title, cells: FACTORS.map(f => fn(S[f.key])) });
  const t = (txt, tone) => ({ t: txt, tone: tone || '' });
  return [
    row('Return per year', 'Compounded yearly growth rate (geometric)', s => t(pct(s.annual), neg(s.annual))),
    row('Ups and downs (volatility)', 'How much monthly returns swing, scaled to a year', s => t(pct(s.vol))),
    row('Return per risk', 'Average yearly return divided by volatility', s => t(num(s.perRisk, 2), neg(s.perRisk))),
    row('Worst calendar year', 'Full calendar years only', s => t(s.worst ? `${pct(s.worst.ret, 0)} (${s.worst.year})` : '—')),
    row('Months that were positive', '', s => t(pct(s.up, 0))),
    row('Biggest fall from a high', 'Largest drop from an earlier peak', s => t(s.fall ? pct(s.fall.depth, 0) : '—')),
    row('Longest time below a high', 'Longest stretch spent below an earlier peak', s => t(s.fall ? (s.fall.longestMonths ? num(s.fall.longestMonths / 12, 1) + ' yrs' : 'none') : '—'))
  ];
}

function words(d, from) {
  const ranked = FACTORS.map(f => ({ f, a: factorStats(d.months.slice(from), d.factors[f.key].slice(from)).annual })).filter(x => x.a != null).sort((a, b) => b.a - a.a);
  if (ranked.length < 2) return '';
  const best = ranked[0], worst = ranked[ranked.length - 1];
  return `In this period <b>${best.f.name.split(' (')[0]}</b> grew fastest at <b>${pct(best.a)}</b> a year, and <b>${worst.f.name.split(' (')[0]}</b> grew slowest at <b>${pct(worst.a)}</b> a year. A factor can lose money for a decade or more, which is why the table below also shows the worst years and the longest slumps.`;
}

function decadeCard(d) {
  const per = FACTORS.map(f => decadeAverages(calendarYears(d.months, d.factors[f.key])));
  const labels = [...new Set(per.flatMap(p => p.map(x => x.label)))].sort();
  if (!labels.length) return null;
  const partial = new Set(per.flatMap(p => p.filter(x => x.n < 10).map(x => x.label)));
  const rows = FACTORS.map((f, i) => ({ label: f.short, title: f.name, cells: labels.map(l => { const x = per[i].find(y => y.label === l); return x ? { t: pct(x.avg), tone: neg(x.avg) } : '—'; }) }));
  return h('section', { class: 'd-card' }, h('h2', { class: 'd-h' }, 'Decade by decade'), h('p', { class: 'd-sub' }, 'Average calendar-year return in each decade. Notice how a factor that shines in one decade can struggle in the next.'),
    dataTable({ head: ['', ...labels.map(l => l + (partial.has(l) ? '*' : ''))], rows, label: 'Average yearly return by decade' }),
    partial.size ? h('p', { class: 'd-cap' }, '* Fewer than ten full calendar years of data in this decade.') : null);
}

function yearsCard(d) {
  const recent = recentYears(d.months, d.factors, 10);
  if (!recent.length) return null;
  const rows = recent.map(r => ({ label: String(r.year), cells: [...FACTORS.map(f => { const v = r.rets[f.key]; return { t: pct(v), tone: neg(v) }; }), r.best ? info(r.best).short : '—'] }));
  return h('section', { class: 'd-card' }, h('h2', { class: 'd-h' }, 'Which factors worked each year?'), h('p', { class: 'd-sub' }, 'The last ten full calendar years. The last column names the best performer. There is rarely a clear winner two years in a row.'),
    dataTable({ head: ['Year', ...FACTORS.map(f => f.short), 'Best'], rows, label: 'Factor returns by calendar year' }));
}

export function buildView(d, init, save, scope) {
  let range = init.range, keys = init.keys.slice();
  const last = d.months[d.months.length - 1];
  const seg = segmented({ options: RANGES.map(([k, l]) => [k, l]), value: range, label: 'Time period', onChange: v => { range = v; refresh(); } });
  const box = chartBox(chartSpec(d, keys, rangeStart(d.months.length, range)));
  scope.add(box.destroy);
  const chips = h('div', { class: 'd-chips fac-chips', role: 'group', 'aria-label': 'Factors to show' });
  const drawChips = () => { const had = chips.contains(document.activeElement) ? document.activeElement.dataset.k : null; paintChips(); if (had) { const b = chips.querySelector(`[data-k="${had}"]`); if (b) b.focus(); } };
  const paintChips = () => chips.replaceChildren(...FACTORS.map(f => h('button', { type: 'button', class: 'd-chip', 'data-k': f.key, 'aria-pressed': String(keys.includes(f.key)), onclick: () => toggle(f.key) }, h('i', { class: 'fac-sw', style: `background:${cv(f.color)}` }), f.short)));
  const toggle = k => { const next = keys.includes(k) ? keys.filter(x => x !== k) : FACTOR_KEYS.filter(x => keys.includes(x) || x === k); if (!next.length) return; keys = next; refresh(); };
  const cap = h('p', { class: 'd-cap', 'aria-live': 'polite' }), summary = h('p', { class: 'd-plain plain' }), statsHost = h('div'), calcHost = h('div'), tip = h('p', { class: 'd-cap' });

  function refresh() {
    const from = rangeStart(d.months.length, range), ms = d.months.slice(from);
    const spec = chartSpec(d, keys, from);
    box.update(spec); drawChips();
    cap.textContent = `Value of $1 invested at the start (${monthLabel(prevMonth(ms[0]))}) and held to ${monthLabel(last)}: ` + spec.series.map(s => `${s.name} ${usd(s.pts[s.pts.length - 1][1])}`).join(', ') + '.';
    tip.textContent = keys.includes('MKT') && keys.length > 1 ? 'Tip: the stock market grows so much that the other lines look flat. Switch off Market to zoom in on the factors.' : '';
    summary.innerHTML = words(d, from);
    statsHost.replaceChildren(h('p', { class: 'd-sub' }, `Based on ${num(ms.length)} months, ${monthLabel(ms[0])} to ${monthLabel(last)}.`), dataTable({ head: ['', ...FACTORS.map(f => f.short)], rows: statsRows(d, from), label: 'Factor statistics for the chosen period' }));
    const c = capmInputs(d.factors.MKT.slice(from), d.factors.RF.slice(from));
    calcHost.replaceChildren(...(c ? [h('p', { class: 'd-plain plain', html: `Over this period the stock market returned about <b>${num(c.rm, 1)}%</b> a year and Treasury bills about <b>${num(c.rf, 1)}%</b>. The CAPM calculator turns those into the return you should demand from a stock with a given beta.` }), h('a', { class: 'd-btn main', href: sharePath('capm', { rm: c.rm, rf: c.rf }), 'data-link': true }, 'Open the CAPM calculator →')] : []));
    save({ range, keys });
  }
  const csv = () => saveCsv('factor-returns-monthly.csv', [['Monthly returns in percent. Source: Kenneth R. French Data Library'], ['Month', 'Market minus risk-free', 'Size (SMB)', 'Value (HML)', 'Profitability (RMW)', 'Investment (CMA)', 'Momentum', 'Risk-free rate'], ...d.months.map((m, i) => [m, ...['MKT', 'SMB', 'HML', 'RMW', 'CMA', 'MOM', 'RF'].map(k => d.factors[k][i])])]);

  const frag = h('div', { class: 'd-page' },
    h('section', { class: 'd-card' },
      h('div', { class: 'd-row between' }, h('div', { class: 'd-title' }, h('h2', {}, 'Growth of $1 in each factor'), h('p', { class: 'd-meta' }, `Monthly data, ${monthLabel(d.months[0])} to ${monthLabel(last)}`)), h('button', { type: 'button', class: 'd-btn', onclick: csv }, 'Download CSV')),
      sourceLine({ source: d.source, asOf: d.updated, url: 'https://mba.tuck.dartmouth.edu/pages/faculty/ken.french/data_library.html' }),
      h('div', { class: 'fac-ctl' }, seg.el, chips), box.el, cap, tip),
    h('section', { class: 'd-card' }, h('h2', { class: 'd-h' }, 'How did each factor do?'), summary, statsHost),
    decadeCard(d), yearsCard(d),
    h('section', { class: 'd-card' }, h('h2', { class: 'd-h' }, 'Take it to a calculator'), calcHost),
    h('section', { class: 'd-card' }, h('h2', { class: 'd-h' }, 'Before you rely on this'), h('ul', { class: 'plain d-cap', style: 'margin:0;padding-left:20px;display:grid;gap:6px' },
      h('li', {}, 'Factors are long-short portfolios on paper: buy one group of stocks and short another. You cannot buy "the value factor" directly, and real funds pay trading costs these numbers ignore.'),
      h('li', {}, 'Past performance does not predict the future. Several factors have had long stretches of losses, and some of the patterns may fade once many investors chase them.'),
      h('li', {}, 'Market here is the stock market\'s return above the Treasury bill rate. The line starts at $1 on the first day of the period you pick.'))));
  drawChips(); refresh();
  return frag;
}
