// @ts-nocheck
/* Company financials: the full analysis at the end of the page. Plain by default: six scored questions, five facts, and a verdict.
   The detail sits in closed folds as cards, a gauge, a small trend line, and one bar that shows where each $1 of cash went.
   All numbers come from lib/analysis.ts. */
import '../styles/financials-analysis.css';
import { h, dataTable, chartBox, segmented } from './dataui.js';
import { col } from './visuals.js';
import { analyse } from '../lib/analysis';
import { money } from '../lib/format';

const TONE_WORD = { good: 'Strong', ok: 'Fair', warn: 'Weak', bad: 'Poor', info: '' };
const nan = v => (v == null ? NaN : v);

function scorecard(a) {
  return h('section', { class: 'd-card fa-card' }, h('h3', { class: 'd-h' }, 'How it scores'),
    h('p', { class: 'd-sub plain' }, 'Six simple questions. Each answer is scored from 0 to 100. Longer bar is better.'),
    h('div', { class: 'fa-score' }, a.categories.map(c => h('div', { class: 'fa-sr ' + c.tone },
      h('div', { class: 'fa-sl' }, h('b', {}, c.label), h('span', {}, c.blurb)),
      h('div', { class: 'fa-bar', role: 'img', 'aria-label': `${c.label} ${c.score == null ? 'no score' : c.score + ' out of 100'}` }, h('i', { style: `width:${c.score ?? 0}%` })),
      h('div', { class: 'fa-sn' }, h('b', {}, TONE_WORD[c.tone] || '—'), c.score == null ? null : h('small', {}, String(c.score)))))));
}

/** A tiny line of how a ratio has moved over the years. */
function spark(trend, tone) {
  const pts = trend.map((v, i) => [i, v]).filter(p => p[1] != null);
  if (pts.length < 3) return null;
  const W = 96, H = 30, xs = pts.map(p => p[0]), ys = pts.map(p => p[1]), x0 = Math.min(...xs), x1 = Math.max(...xs), lo = Math.min(...ys), hi = Math.max(...ys);
  const X = i => 3 + ((i - x0) / (x1 - x0 || 1)) * (W - 6), Y = v => (hi === lo ? H / 2 : H - 4 - ((v - lo) / (hi - lo)) * (H - 8));
  const d = pts.map(([i, v], k) => (k ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(v).toFixed(1)).join(' '), end = pts[pts.length - 1];
  return h('span', { class: 'fa-spark', 'aria-hidden': 'true', html: `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" class="${tone}"><path d="${d}" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="${X(end[0]).toFixed(1)}" cy="${Y(end[1]).toFixed(1)}" r="3"/></svg>` });
}

/** A bar from poor to strong with a marker where this company sits. */
const gauge = m => (m.score == null ? null : h('div', { class: 'fa-g', role: 'img', 'aria-label': `${m.label}: ${TONE_WORD[m.tone] || 'rated'}` }, h('i', { class: 'z1' }), h('i', { class: 'z2' }), h('i', { class: 'z3' }), h('i', { class: 'z4' }), h('b', { class: 'fa-pin', style: `left:${Math.min(98, Math.max(2, m.score))}%` })));

function card(m) {
  const trend = m.trend ? spark(m.trend, m.tone) : null;
  return h('details', { class: 'fa-m ' + m.tone },
    h('summary', {}, h('span', { class: 'fa-ml' }, m.label), h('b', { class: 'fa-mv' }, m.shown), m.say ? h('span', { class: 'fa-ms' }, m.say) : null, gauge(m), trend ? h('span', { class: 'fa-mt' }, trend, h('small', {}, 'over the years')) : null),
    h('div', { class: 'fa-mb plain' }, h('p', {}, m.what), m.read ? h('p', {}, h('b', {}, m.read)) : null));
}

function fold(title, hint, ...kids) {
  return h('details', { class: 'fa-fold' }, h('summary', {}, h('b', {}, title), h('span', {}, hint)), h('div', { class: 'fa-fb' }, ...kids.filter(Boolean)));
}

function ratios(a) {
  return fold('See the ratios', 'Each one on a gauge, with a short line for how it has moved.',
    h('p', { class: 'd-cap plain' }, 'The marker shows where this company sits, from poor on the left to strong on the right. Tap a card to see what the ratio means. Grey cards have no good or bad side.'),
    ...a.categories.map(c => h('div', { class: 'fa-cg' }, h('h4', {}, c.label, h('small', { class: c.tone }, c.score == null ? '' : `${TONE_WORD[c.tone]} · ${c.score}`)),
      h('div', { class: 'fa-cards' }, [...c.metrics].sort((x, y) => (y.score != null) - (x.score != null)).map(card)))));
}

const PART = { capex: 'p1', dividends: 'p2', buybacks: 'p3', acquisitions: 'p4', left: 'p5' };

/** One bar that shows where each $1 of operating cash went. */
function splitView(a) {
  const { all, last } = a.split;
  if (!all && !last) return null;
  const box = h('div', { class: 'fa-split' }), pick = key => {
    const s = a.split[key] || all || last, label = key === 'last' ? `the latest year (${a.split.lastYear})` : a.split.allYears;
    const sum = Math.max(1, s.parts.reduce((x, p) => x + p.cents, 0));
    box.replaceChildren(...[
      h('p', { class: 'fa-sq plain' }, `Of every $1 the business brought in over ${label}:`),
      h('div', { class: 'fa-sbw' },
        h('div', { class: 'fa-sb', role: 'img', 'aria-label': s.parts.map(p => `${Math.round(p.cents * 100)} cents ${p.label}`).join(', ') }, s.parts.map(p => h('span', { class: PART[p.key] || 'p5', style: `width:${(p.cents / sum) * 100}%` }, p.cents >= 0.08 ? Math.round(p.cents * 100) + '¢' : ''))),
        s.over != null ? h('div', { class: 'fa-edge', style: `left:${(1 / sum) * 100}%` }, h('span', {}, '$1 earned')) : null),
      h('ul', { class: 'fa-leg' }, s.parts.map(p => h('li', {}, h('i', { class: PART[p.key] || 'p5', 'aria-hidden': 'true' }), h('b', {}, Math.round(p.cents * 100) + '¢'), ' ' + p.label))),
      h('p', { class: 'd-cap plain' }, s.note)].filter(Boolean));
  };
  const seg = all && last ? segmented({ options: [['all', 'All years'], ['last', 'Latest year']], value: 'all', label: 'Choose the period', onChange: pick }) : null;
  pick(all ? 'all' : 'last');
  return h('div', { class: 'fa-block' }, h('h4', {}, 'Where each $1 of cash went'), seg ? seg.el : null, box);
}

/** One square for each year: green is healthy, gold needs watching, red is trouble. Tap or hover a square to read it. */
function yearSquares(a) {
  const cap = h('p', { class: 'fa-yc plain' }, 'Tap or hover a square to see what happened that year.'), show = y => { cap.replaceChildren(h('b', {}, y.year + ': '), y.label + '.'); };
  const sq = a.cashYears.map(y => h('button', { type: 'button', class: 'fa-sqr ' + y.tone, 'aria-label': `${y.year}: ${y.label}`, onmouseenter: () => show(y), onfocus: () => show(y), onclick: () => show(y) }, h('i', {}), h('small', {}, '’' + y.year.slice(2))));
  return h('div', { class: 'fa-block' }, h('h4', {}, 'Was each year healthy?'), h('div', { class: 'fa-sqs', role: 'group', 'aria-label': 'Cash flow health by year' }, sq),
    h('p', { class: 'fa-key d-cap' }, h('i', { class: 'good' }), ' healthy ', h('i', { class: 'ok' }), ' fine ', h('i', { class: 'warn' }), ' watch ', h('i', { class: 'bad' }), ' trouble'), cap);
}

/** Profit against cash, on one small chart. Cash at or above profit means the profit is real. */
function profitVsCash(a, scope) {
  const ys = a.cashYears, s = (name, color, pts) => ({ name, color, pts });
  const list = [s('Profit', 'c4', ys.map((y, i) => [i, nan(a.profit[i])])), s('Free cash', 'c1', ys.map((y, i) => [i, nan(y.fcf)]))].filter(x => x.pts.some(p => Number.isFinite(p[1])));
  if (list.length < 2) return null;
  const spec = { h: 260, hint: 'Slide across the chart to read each year.', title: 'Profit and free cash, by year', xLabels: ys.map(y => '’' + y.year.slice(2)), series: list, yZero: true, yFmt: v => money(v), yRead: v => money(v), readout: i => `<span class="rx">${ys[i].year}</span>` + list.map(x => `<span class="ri"><i style="background:${col(x.color)}"></i>${x.name} <b>${money(x.pts[i][1])}</b></span>`).join('') };
  const box = chartBox(spec);
  return { el: h('div', { class: 'fa-block' }, h('h4', {}, 'Profit against cash'), box.el, h('p', { class: 'd-cap plain' }, 'Profit is what the accounts say it earned. Free cash is what is really left after paying for equipment. When cash is at or above profit, the profit is real.')), destroy: box.destroy };
}

function cashTable(a) {
  const ys = a.cashYears, m = (label, key, title) => ({ label, title, cells: ys.map(y => ({ t: money(y[key]), tone: y[key] != null && y[key] < 0 ? 'neg' : '' })), raw: ys.map(y => y[key]) });
  const rows = [m('Cash from operations', 'cfo', 'Cash the business itself brought in'), m('Spent on equipment', 'capex'), m('Free cash flow', 'fcf', 'Operations minus equipment'), m('Investing cash flow', 'cfi', 'Negative means it spent on assets, buying companies or investments'), m('Financing cash flow', 'cff', 'Negative means it paid out or repaid more than it raised'), m('Paid to owners', 'returned', 'Dividends plus share buybacks')].filter(r => r.raw.some(v => v != null));
  return h('details', { class: 'fa-more' }, h('summary', {}, 'Show the cash flow table'), dataTable({ head: ['', ...ys.map(y => y.year)], rows, label: 'Cash flow statement review' }));
}

function cashReview(a, scope) {
  if (!a.cashYears.length) return null;
  const pv = profitVsCash(a), chart = pv ? pv.el : null;
  if (pv) scope.add(pv.destroy);
  return fold('See the cash, year by year', 'Where the cash went, and whether each year was healthy.',
    h('p', { class: 'd-cap plain' }, 'Cash is harder to dress up than profit, so it is the best test of a business. These pictures use the company\'s cash flow report.'),
    splitView(a), yearSquares(a), chart, cashTable(a));
}

const FIRST = 5;
function facts(a) {
  if (!a.facts.length) return null;
  const li = t => h('li', { html: t }), more = a.facts.slice(FIRST);
  return h('section', { class: 'd-card fa-card' }, h('h3', { class: 'd-h' }, 'Things worth knowing'),
    h('p', { class: 'd-sub plain' }, `Found by reading ${a.from} to ${a.to} line by line.`),
    h('ul', { class: 'fa-facts plain' }, a.facts.slice(0, FIRST).map(li)),
    more.length ? h('details', { class: 'fa-more' }, h('summary', {}, `Show ${more.length} more`), h('ul', { class: 'fa-facts plain' }, more.map(li))) : null);
}

function verdict(a) {
  const v = a.verdict, li = t => h('li', { html: t });
  return h('section', { class: 'd-card fa-card fa-verdict ' + v.tone, id: 'fa-verdict' }, h('h3', { class: 'd-h' }, 'So, is it a good company to invest in?'),
    h('div', { class: 'fa-vb' }, h('div', { class: 'fa-vs', 'aria-hidden': 'true' }, v.score == null ? '—' : String(v.score), h('small', {}, 'out of 100')), h('div', {}, h('b', { class: 'fa-vl' }, v.label), h('p', { class: 'plain', html: v.headline }))),
    h('div', { class: 'fa-two' },
      h('div', {}, h('h4', {}, 'Good signs'), v.yes.length ? h('ul', { class: 'plain fa-ul good' }, v.yes.map(li)) : h('p', { class: 'd-cap' }, 'Nothing stood out as a clear strength.')),
      h('div', {}, h('h4', {}, 'Worries'), v.no.length ? h('ul', { class: 'plain fa-ul bad' }, v.no.map(li)) : h('p', { class: 'd-cap' }, 'Nothing stood out as a clear worry.'))),
    h('div', { class: 'fa-bottom' }, h('h4', {}, 'In short'), h('p', { class: 'plain', html: v.bottom })),
    h('details', { class: 'd-ex' }, h('summary', {}, 'What this check cannot tell you'), h('ul', { class: 'plain d-cap', style: 'margin:10px 0 0;padding-left:20px;display:grid;gap:6px' }, v.blind.map(t => h('li', {}, t)))),
    h('p', { class: 'd-cap' }, 'This is a study tool, not investment advice. It runs the same tests on every company and does not know your goals.'));
}

/** The whole section, or null when the filings do not have enough years of profit to analyse. */
export function renderAnalysis(d, scope) {
  const a = analyse(d, d.name);
  if (!a) return null;
  a.profit = a.cashYears.map(y => { const i = d.periods.findIndex(p => p.end.slice(0, 4) === y.year); return i >= 0 && d.rows.netIncome ? d.rows.netIncome[i] : null; });
  return h('div', { class: 'fa', id: 'full-analysis' },
    h('div', { class: 'fa-head' }, h('p', { class: 'fa-kicker' }, 'Full analysis'), h('h2', {}, `${a.name}, ${a.from} to ${a.to}`),
      h('p', { class: 'plain' }, 'A plain-English check of this company, worked out from its own reports above. The answer is at the end.')),
    scorecard(a), facts(a), ratios(a), cashReview(a, scope), verdict(a));
}
