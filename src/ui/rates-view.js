// @ts-nocheck
/* Interest rates page: the sections built from the snapshot and the Treasury table. */
import { h, esc, statGrid, dataTable, chartBox, segmented, explainer } from './dataui.js';
import { col } from './visuals.js';
import { sharePath } from './sharing.js';
import { curveShape, asOfLabel, ratePct, changeWords, TENORS } from '../lib/rates';
import { longDate } from '../lib/format';

const TILES = [
  ['DGS10', '10-year Treasury'], ['DGS2', '2-year Treasury'], ['DGS3MO', '3-month Treasury'], ['DFF', 'Fed funds rate'],
  ['MORTGAGE30US', '30-year mortgage rate'], ['INFLATION', 'Inflation (CPI, year over year)'], ['UNRATE', 'Unemployment'], ['BAA10Y', 'Credit spread (BAA over 10-yr)']
];

/** Stat tiles for the key rates. A series with no reading shows an em dash, never a blank or "null". */
export function tilesCard(snap) {
  const items = TILES.map(([id, label]) => {
    const s = snap.series && snap.series[id], now = s && s.latest;
    if (!now) return { label, value: '—', sub: 'No recent reading' };
    const move = changeWords(now.value, s.yearAgo && s.yearAgo.value);
    return { label, value: ratePct(now.value), sub: [move, asOfLabel(now.date, s.freq)].filter(Boolean).join(' · ') };
  });
  return h('section', { class: 'd-card', 'aria-label': 'Key rates today' }, statGrid(items, 4));
}

const SHAPE_LABEL = { normal: 'Normal', flat: 'Flat', inverted: 'Inverted', humped: 'Humped', unknown: 'Unclear' };
const TENOR_LONG = ['1 month', '3 months', '6 months', '1 year', '2 years', '3 years', '5 years', '7 years', '10 years', '20 years', '30 years'];
const LINES = [['today', 'today', 'Today', 'c1', false], ['month', 'monthAgo', '1 month ago', 'c4', true], ['year', 'yearAgo', '1 year ago', 'mute', true]];
const SHOWS = { today: ['today'], month: ['today', 'month'], year: ['today', 'year'], all: ['today', 'month', 'year'] };
const num = v => (typeof v === 'number' && Number.isFinite(v) ? v : NaN);
const signed = x => (x == null ? '—' : (x > 0 ? '+' : x < 0 ? '−' : '') + Math.abs(x).toFixed(2));

export function curveSpec(curve, mode) {
  const series = LINES.filter(([k]) => SHOWS[mode].includes(k))
    .map(([, prop, name, color, dash]) => ({ name, color, dash, pts: (curve[prop] ? curve[prop].values : []).map((v, i) => [i, num(v)]) }))
    .filter(s => s.pts.some(p => Number.isFinite(p[1])));
  const fmt = v => (Number.isFinite(v) ? ratePct(v) : '—');
  return {
    series, xLabels: TENORS.slice(), h: 300, title: 'US Treasury yield curve: yield by length of loan', hint: 'Slide across the chart to read each maturity.',
    yFmt: v => `${+v.toFixed(2)}%`, yRead: fmt,
    readout: i => `<span class="rx">${esc(TENOR_LONG[i])}</span>` + series.map(s => `<span class="ri"><i style="background:${col(s.color)}"></i>${esc(s.name)} <b>${esc(fmt(s.pts[i][1]))}</b></span>`).join('')
  };
}

function readingParagraph(curve) {
  const now = curveShape(curve.today.values), past = [['monthAgo', 'a month ago'], ['yearAgo', 'a year ago']]
    .map(([k, w]) => [w, curveShape(curve[k] ? curve[k].values : []).shape]).filter(([, s]) => s !== 'unknown' && s !== now.shape);
  const then = past.length ? ` For comparison, the curve was ${past.map(([w, s]) => `${SHAPE_LABEL[s].toLowerCase()} ${w}`).join(' and ')}.` : '';
  return { now, html: esc(now.text + then) };
}

export function curveCard(snap, scope) {
  const curve = snap.curve;
  if (!curve || !curve.today.values.some(v => v != null)) return h('section', { class: 'd-card' }, h('h2', { class: 'd-h' }, 'The yield curve'), h('p', { class: 'd-empty' }, 'The yield curve is not available right now.'));
  const read = readingParagraph(curve), box = chartBox(curveSpec(curve, 'all'));
  scope.add(box.destroy);
  const seg = segmented({ label: 'Compare with', value: 'all', options: [['all', 'All three'], ['today', 'Today only'], ['month', 'vs 1 month ago'], ['year', 'vs 1 year ago']], onChange: m => box.update(curveSpec(curve, m)) });
  const dates = `Today is ${longDate(curve.today.date)}; a month ago is ${longDate(curve.monthAgo.date)}; a year ago is ${longDate(curve.yearAgo.date)}. Each point is the yield for a loan of that length.`;
  const s = read.now;
  return h('section', { class: 'd-card' },
    h('h2', { class: 'd-h' }, 'The yield curve'),
    h('p', { class: 'd-sub' }, 'What the government pays to borrow, from 1 month to 30 years.'),
    seg.el, box.el, h('p', { class: 'd-cap' }, dates),
    statGrid([
      { label: 'Shape of the curve', value: SHAPE_LABEL[s.shape], tone: s.shape === 'inverted' ? 'bad' : '', sub: 'Compare short and long rates' },
      { label: '10-year minus 2-year', value: signed(s.spread10y2y), tone: s.spread10y2y != null && s.spread10y2y < 0 ? 'bad' : '', sub: 'Percentage points' },
      { label: '10-year minus 3-month', value: signed(s.spread10y3m), tone: s.spread10y3m != null && s.spread10y3m < 0 ? 'bad' : '', sub: 'Percentage points' }
    ], 3),
    h('p', { class: 'd-plain plain', html: read.html }));
}

/** Buttons that open a calculator already filled with today's rates. Only fields that exist are set. */
export function calcCard(snap) {
  const val = id => { const o = snap.series && snap.series[id] && snap.series[id].latest; return o && Number.isFinite(o.value) ? Math.round(o.value * 100) / 100 : null; };
  const ten = val('DGS10'), mort = val('MORTGAGE30US');
  const link = (id, label, state, what) => h('a', { class: 'd-btn main', href: sharePath(id, state), 'data-link': true, title: what }, label + ' →');
  const links = [
    ten != null ? link('wacc', 'Cost of capital (WACC)', { rf: ten }, `Sets the risk-free rate to ${ratePct(ten)}`) : null,
    ten != null ? link('capm', 'CAPM expected return', { rf: ten }, `Sets the risk-free rate to ${ratePct(ten)}`) : null,
    ten != null ? link('bond', 'Bond pricing', { ytm: ten }, `Sets the yield to ${ratePct(ten)}`) : null,
    mort != null ? link('loan', 'Loan calculator', { apr: mort, years: 30 }, `Sets the rate to ${ratePct(mort)} over 30 years`) : null
  ].filter(Boolean);
  if (!links.length) return null;
  return h('section', { class: 'd-card rt-calc' },
    h('h2', { class: 'd-h' }, 'Use today’s rates in a calculator'),
    h('p', { class: 'd-sub plain' }, `Finance models need a risk-free rate. The 10-year Treasury yield${ten != null ? ` (${ratePct(ten)})` : ''} is the usual choice. Mortgages are priced off the 30-year rate${mort != null ? ` (${ratePct(mort)})` : ''}.`),
    h('div', { class: 'd-row' }, links));
}

/** The table of average rates on US government debt. A failure here shows a small message and nothing else breaks. */
export function treasuryCard(result, retry) {
  const head = h('h2', { class: 'd-h' }, 'What the US government pays');
  if (result.status !== 'fulfilled' || !result.value || !Array.isArray(result.value.rows)) {
    const msg = result.reason && result.reason.message ? result.reason.message : 'Could not load the Treasury table.';
    return h('section', { class: 'd-card' }, head, h('div', { class: 'd-err', role: 'alert' }, h('p', {}, msg), h('button', { type: 'button', class: 'd-btn', onclick: retry }, 'Try again')));
  }
  const d = result.value;
  return h('section', { class: 'd-card' }, head,
    h('p', { class: 'd-sub' }, `Average interest rate on all US government debt outstanding, as of ${longDate(d.recordDate)}. Older, cheaper borrowing pulls these below today’s yields.`),
    dataTable({ label: 'Average interest rates on US Treasury securities', head: ['Security', 'Average rate'], rows: d.rows.map(r => ({ label: r.name, cells: [ratePct(r.rate, 3)] })) }),
    h('p', { class: 'd-cap' }, 'Bills mature in a year or less, notes in 2 to 10 years and bonds in 20 to 30 years. TIPS rise with inflation. Floating rate notes reset as short-term rates move.'));
}

export const explainers = () => h('div', { class: 'd-page' },
  explainer('What is a Treasury yield?', '<p class="plain">When the US government needs money it sells <b>Treasury securities</b>, which are IOUs. The <b>yield</b> is the yearly return an investor earns by lending to the government for that length of time. A 10-year yield of 4.5% means lending for ten years earns about 4.5% a year.</p><p class="plain">Because the US government is seen as very safe, its yield is treated as the <b>risk-free rate</b>. Everything riskier, from company bonds to mortgages, is priced as that rate plus extra for the risk.</p>'),
  explainer('What is the Fed funds rate?', '<p class="plain">It is the rate banks charge each other for overnight loans. The <b>Federal Reserve</b> sets a target range for it to speed up or cool down the economy. Lower rates make borrowing cheaper and encourage spending. Higher rates do the opposite.</p><p class="plain">It moves short-term rates directly, such as savings accounts and credit cards, and long-term rates only indirectly.</p>'),
  explainer('What does inflation mean for my money?', '<p class="plain"><b>Inflation</b> is how fast prices rise. If inflation is 3%, something that cost $100 last year costs $103 now, so $100 in cash buys less.</p><p class="plain">What matters is the <b>real return</b>: the interest rate minus inflation. A 4% savings rate with 3% inflation grows your buying power by only about 1%.</p>'),
  explainer('Why does the yield curve matter?', '<p class="plain">The yield curve plots yields for short to long loans. Usually longer loans pay more. When short-term rates rise above long-term ones the curve is <b>inverted</b>.</p><p class="plain">An inverted curve has come before many past US recessions, which is why people watch it. It is a warning sign, not a forecast: the delay has varied from months to years, and sometimes there was no recession.</p>'));
