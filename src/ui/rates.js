// @ts-nocheck
/* Interest rates and the economy: live US Treasury and Federal Reserve data, explained for beginners. */
import '../styles/rates.css';
import { h, esc, head, api, scope, skeleton, errorBox, segmented, chartBox, timeAxis, sourceLine } from './dataui.js';
import { col } from './visuals.js';
import { tilesCard, curveCard, calcCard, treasuryCard, explainers } from './rates-view.js';
import { enhanceTerms } from './glossary.js';
import { decimalYear, summary } from '../lib/series';
import { ratePct, asOfLabel } from '../lib/rates';
import { longDate } from '../lib/format';

const PICK = [
  ['DGS10', '10-year', 'The yield on 10-year US Treasuries, the benchmark for long-term borrowing.'],
  ['DGS2', '2-year', 'The 2-year yield tracks what investors expect the Fed to do over the next couple of years.'],
  ['DFF', 'Fed funds', 'The rate the Federal Reserve targets for overnight bank lending.'],
  ['MORTGAGE30US', '30-yr mortgage', 'The average rate on a 30-year fixed mortgage, from a weekly survey.'],
  ['INFLATION', 'Inflation', 'How much consumer prices rose compared with the same month a year earlier.'],
  ['UNRATE', 'Unemployment', 'The share of people in the labor force who are looking for work and cannot find it.'],
  ['BAA10Y', 'Credit spread', 'The extra yield riskier companies (rated BAA) pay over the 10-year Treasury. It widens when investors get nervous.']
];
const RANGES = [['1y', '1Y'], ['5y', '5Y'], ['10y', '10Y'], ['30y', '30Y'], ['max', 'Max']];
const NAME = Object.fromEntries(PICK.map(([id, label]) => [id, label]));
const NOTE = Object.fromEntries(PICK.map(([id, , note]) => [id, note]));

/** Chart spec and high/low/average chips for one loaded history. */
function historySpec(d) {
  const dates = d.points.map(p => p[0]), xs = d.points.map(p => decimalYear(p[0]));
  const span = xs.length > 1 ? xs[xs.length - 1] - xs[0] : 1, label = NAME[d.series] || d.series;
  const spec = {
    series: [{ name: label, color: 'c1', type: 'area', pts: d.points.map((p, i) => [xs[i], p[1]]) }], h: 300, title: `${label} over time`, hint: 'Slide across the chart to read exact values.',
    yFmt: v => `${+v.toFixed(2)}%`, yRead: v => ratePct(v), ...timeAxis(span),
    readout: i => `<span class="rx">${esc(longDate(dates[i]))}</span><span class="ri"><i style="background:${col('c1')}"></i>${esc(label)} <b>${esc(ratePct(d.points[i][1]))}</b></span>`
  };
  return spec;
}

function chips(d) {
  const vals = d.points.map(p => p[1]), s = summary(vals);
  if (!s) return [];
  const when = v => asOfLabel(d.points[vals.indexOf(v)][0], d.freq);
  const chip = (k, v, sub) => h('span', { class: 'rt-chip' }, h('small', {}, k), h('b', {}, ratePct(v)), sub ? h('em', {}, sub) : null);
  return [chip('Latest', vals[vals.length - 1], asOfLabel(d.asOf, d.freq)), chip('High', s.max, when(s.max)), chip('Low', s.min, when(s.min)), chip('Average', s.mean, '')];
}

function historyCard(scopeH, owner) {
  const cache = new Map(), state = { series: 'DGS10', range: '5y' };
  let box = null, token = 0;
  const stage = h('div', { class: 'rt-stage', 'aria-busy': 'false' }), chipRow = h('div', { class: 'rt-chips', 'aria-label': 'Summary of the visible range', role: 'group' });
  const note = h('p', { class: 'd-cap' }, NOTE[state.series]), status = h('p', { class: 'rt-vh', role: 'status', 'aria-live': 'polite' });
  const key = () => `${state.series}|${state.range}`;

  const draw = d => {
    if (box) box.destroy();
    stage.replaceChildren(); box = null;
    if (!d.points || d.points.length < 2) { stage.append(h('p', { class: 'd-empty' }, 'Not enough data to draw this range.')); chipRow.replaceChildren(); return; }
    box = chartBox(historySpec(d)); owner.add(box.destroy); stage.append(box.el);
    chipRow.replaceChildren(...chips(d));
  };
  const busy = on => { stage.setAttribute('aria-busy', String(on)); stage.classList.toggle('loading', on); status.textContent = on ? 'Loading chart' : ''; };

  async function load() {
    const k = key(), mine = ++token;
    note.textContent = NOTE[state.series]; scopeH.reset();
    if (cache.has(k)) { busy(false); draw(cache.get(k)); return; }
    busy(true);
    if (!box) stage.replaceChildren(h('div', { class: 'rt-skel' }));
    try {
      const d = await api('macro', { view: 'history', series: state.series, range: state.range }, scopeH.signal);
      if (mine !== token) return;
      cache.set(k, d); busy(false); draw(d);
    } catch (e) {
      if (e.name === 'AbortError' || mine !== token) return;
      busy(false); if (box) box.destroy(); box = null; chipRow.replaceChildren(); stage.replaceChildren(errorBox(e.message, load));
    }
  }
  const seriesSeg = segmented({ label: 'Choose a rate', value: state.series, options: PICK.map(([id, label]) => [id, label]), onChange: v => { state.series = v; load(); } });
  const rangeSeg = segmented({ label: 'Choose a time range', value: state.range, options: RANGES, onChange: v => { state.range = v; load(); } });
  load();
  return h('section', { class: 'd-card' }, h('h2', { class: 'd-h' }, 'History'), h('p', { class: 'd-sub' }, 'Pick a rate and a time span to see how it has moved.'),
    seriesSeg.el, rangeSeg.el, stage, chipRow, note, status);
}

export function renderRates(main) {
  const S = scope(), H = scope(), page = h('div', { class: 'd-page rt-page' }), live = h('p', { class: 'rt-vh', role: 'status', 'aria-live': 'polite' });
  S.add(() => H.run());
  const lead = 'Interest rates are the price of money. They set what you earn on savings, what a mortgage costs and how companies value their future profits. Here is where they stand today, and how they got here.';

  async function load() {
    S.reset(); H.reset();
    page.replaceChildren(skeleton('Loading interest rate data')); live.textContent = 'Loading interest rate data';
    const [snapR, trR] = await Promise.allSettled([api('macro', { view: 'snapshot' }, S.signal), api('macro', { view: 'treasury' }, S.signal)]);
    if (S.signal.aborted) return;
    if (snapR.status !== 'fulfilled' || !snapR.value || !snapR.value.series) {
      const aborted = snapR.reason && snapR.reason.name === 'AbortError';
      if (aborted) return;
      live.textContent = 'Could not load interest rate data';
      page.replaceChildren(errorBox((snapR.reason && snapR.reason.message) || 'Could not load the interest rate data. Try again in a moment.', load)); return;
    }
    const snap = snapR.value, tr = h('div', { class: 'rt-tr' });
    const drawTr = r => tr.replaceChildren(treasuryCard(r, retryTr));
    async function retryTr() {
      tr.replaceChildren(skeleton('Loading Treasury table'));
      try { drawTr({ status: 'fulfilled', value: await api('macro', { view: 'treasury' }, S.signal) }); } catch (e) { if (e.name !== 'AbortError') drawTr({ status: 'rejected', reason: e }); }
    }
    drawTr(trR);
    page.replaceChildren(
      ...[tilesCard(snap), curveCard(snap, S), historyCard(H, S), calcCard(snap), tr, explainers(),
        sourceLine({ source: 'FRED (Federal Reserve Bank of St. Louis) and US Treasury', asOf: snap.asOf, url: 'https://fred.stlouisfed.org' }),
        h('p', { class: 'd-cap' }, 'Data can be revised and is shown as published. For study, not advice.')].filter(Boolean));
    enhanceTerms(page); live.textContent = 'Interest rate data loaded';
  }

  main.replaceChildren(head({ eyebrow: 'Live data · US Treasury and Federal Reserve data', title: 'Interest rates and <em>the economy</em>', lead }), live, page);
  load();
  return () => S.run();
}
