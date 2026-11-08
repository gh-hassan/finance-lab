// @ts-nocheck
/* The parts of the Currency page below the converter: rate history, major currencies, calculator links and explainers. */
import { h, esc, segmented, statGrid, dataTable, chartBox, errorBox, explainer, fill } from './dataui.js';
import { sharePath } from './sharing.js';
import { dayAxis, tick } from './timedata.js';
import { RANGES, RANGE_LABEL, RANGE_WORDS, seriesStats, fmtRate, invertRate, calcSpot, rankWords } from '../lib/currency';
import { signedPct, pct, longDate } from '../lib/format';

const DAY = 864e5;
const skel = label => h('div', { class: 'd-skel', role: 'status', 'aria-label': label }, h('i', { class: 'big' }), h('i'), h('i'));

/** The chart card. Call loading(), show(data) or error() as results arrive; it owns and cleans up its chart. */
export function historyCard({ onRange, range }) {
  const title = h('h2', { class: 'd-h' }), body = h('div', { class: 'cu-body' });
  const seg = segmented({ options: RANGES.map(r => [r, RANGE_LABEL[r]]), value: range, label: 'Time range', onChange: onRange });
  let chart = null;
  const kill = () => { if (chart) { chart.destroy(); chart = null; } };
  return {
    el: h('section', { class: 'd-card' }, title, h('div', { class: 'd-row' }, seg.el), body),
    setRange: r => seg.set(r),
    loading(from, to) { kill(); title.textContent = `${from} to ${to}: how many ${to} one ${from} buys`; body.replaceChildren(skel('Loading rate history')); },
    error(message, retry) { kill(); body.replaceChildren(errorBox(message, retry)); },
    show(d) {
      kill();
      const s = seriesStats(d.points), change = d.change ?? s.change, high = d.high ?? s.high, low = d.low ?? s.low;
      const t0 = Date.parse(d.points[0][0]), span = (Date.parse(d.points[d.points.length - 1][0]) - t0) / DAY;
      const spec = {
        title: `${d.base} to ${d.quote} exchange rate`, h: 280, hint: 'Slide across the chart, or tap it, to read the rate on any day.',
        series: [{ name: `${d.quote} per 1 ${d.base}`, color: 'c1', pts: d.points.map(p => [(Date.parse(p[0]) - t0) / DAY, p[1]]) }],
        ...dayAxis(t0, span), yFmt: tick, yRead: fmtRate
      };
      chart = chartBox(spec);
      const dir = change == null ? '' : change >= 0 ? `1 ${d.base} buys more ${d.quote} than at the start` : `1 ${d.base} buys fewer ${d.quote} than at the start`;
      fill(body,
        statGrid([
          { label: `Change over ${RANGE_LABEL[d.range] || ''}`, value: signedPct(change), sub: dir, tone: change != null && change < 0 ? 'bad' : '' },
          { label: 'Highest', value: fmtRate(high), sub: `${d.quote} per ${d.base}` },
          { label: 'Lowest', value: fmtRate(low), sub: `${d.quote} per ${d.base}` },
          { label: 'Where it is now', value: s.rank == null ? '—' : pct(s.rank, 0), sub: rankWords(s.rank, RANGE_WORDS[d.range] || 'this range') }
        ]),
        chart.el,
        h('p', { class: 'd-cap' }, `Rates from ${longDate(d.points[0][0])} to ${longDate(d.points[d.points.length - 1][0])}. Weekends and bank holidays have no rate, so the line jumps over them.${d.points.length < 100 ? ' This chart uses one rate every few days.' : ''}`),
        d.limited ? h('p', { class: 'd-note' }, `History for this pair starts in March 2024, so longer ranges show less than 5 or 10 years. The European Central Bank, which keeps the long history, does not publish a rate for one of these currencies.`) : null);
    },
    destroy: kill
  };
}

/** The "major currencies against X" table. */
export function majorsCard() {
  const title = h('h2', { class: 'd-h' }), body = h('div', { class: 'cu-body' });
  return {
    el: h('section', { class: 'd-card cu-majors' }, title, body),
    loading(base) { title.textContent = `Major currencies against ${base}`; body.replaceChildren(skel('Loading major currencies')); },
    error(message, retry) { body.replaceChildren(errorBox(message, retry)); },
    show(d, names) {
      const rows = d.moves.map(m => ({
        label: `${m.code} · ${names[m.code] || m.code}`,
        cells: [fmtRate(m.rate), { t: signedPct(m.change), tone: m.change != null && m.change < 0 ? 'neg' : '' }]
      }));
      body.replaceChildren(
        h('p', { class: 'd-sub' }, `Sorted by the biggest move over the past year. A plus sign means 1 ${d.base} now buys more of that currency than a year ago.`),
        dataTable({ head: ['Currency', `1 ${d.base} buys`, '1-year change'], rows, label: `Major currencies against ${d.base}` }),
        h('p', { class: 'd-cap' }, `Compared with ${longDate(d.prevDate)}. Rates dated ${longDate(d.date)}.`));
    }
  };
}

/** Links that open the forward and parity calculator with the current rate filled in. S means home currency per 1 foreign. */
export function mathCard(from, to, rate) {
  const a = calcSpot(rate), b = calcSpot(invertRate(rate));
  const link = (foreign, home, s, r) => h('a', { class: 'd-btn main cu-link', href: sharePath('fx', { S: s }), 'data-link': true }, `Open in the forward and parity calculator with 1 ${foreign} = ${fmtRate(r)} ${home}`);
  return h('section', { class: 'd-card' },
    h('h2', { class: 'd-h' }, 'Try the currency maths'),
    h('p', { class: 'd-sub plain' }, 'The calculator wants the price of one foreign unit in your home currency. Pick which of your two currencies is home, then add the interest rates and the time to delivery.'),
    a == null || b == null ? h('p', { class: 'd-cap' }, 'Pick two currencies to get a link.')
      : h('div', { class: 'cu-links' }, link(from, to, a, rate), link(to, from, b, invertRate(rate))),
    h('p', { class: 'd-cap' }, 'You add the two interest rates yourself. The forward rate it gives is a calculation, not a quote you can trade at.'));
}

export function explainers() {
  const ex = (t, b) => explainer(t, b);
  return h('div', { class: 'cu-ex' },
    ex('What is an exchange rate?', '<p>An exchange rate is the <b>price of one currency in another</b>. If 1 USD = 0.90 EUR, one dollar buys ninety euro cents. Flip it and 1 EUR = 1.11 USD. Both say the same thing from two sides.</p><p>The rate is always quoted as "how much of the second currency for one unit of the first", so read the order carefully.</p>'),
    ex('Why do exchange rates move?', '<ul><li><b>Interest rates:</b> money tends to flow to where it earns more, which lifts that currency.</li><li><b>Inflation:</b> if prices rise faster in one country, its money buys less over time.</li><li><b>Trade and growth:</b> a country that sells a lot abroad creates demand for its currency.</li><li><b>Mood and news:</b> fear sends investors to "safe" currencies such as the US dollar, Swiss franc and yen.</li></ul>'),
    ex('Why is this not what my bank gives me?', '<p>These are <b>reference rates</b>: a fair midpoint, <b>updated once a day</b> from market data (the European Central Bank publishes its own set around 16:00 CET). Real exchange adds a <b>spread</b> (the bank buys cheaper than it sells) and often a <b>fee</b>, so you usually get a few percent less. Cards and airport kiosks are typically the most expensive.</p><p>Use this page to learn and to judge a quote, not to expect the exact number at the counter.</p>'),
    ex('Currency maths in one minute', '<p><b>Forward rate = Spot × (1 + home rate) ÷ (1 + foreign rate).</b> This is interest rate parity. With spot 1.10 home per foreign, home rate 5% and foreign rate 3%, a one-year forward is 1.10 × 1.05 ÷ 1.03 ≈ <b>1.1214</b>.</p><p>The currency with the higher interest rate trades at a <b>forward discount</b>: it is expected to buy less later. That removes the free lunch from borrowing cheap and lending dear.</p>'));
}
