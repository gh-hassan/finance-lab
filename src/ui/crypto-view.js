// @ts-nocheck
/* The parts of the Crypto page: the markets table, the selected coin with its risk lens, the what-if card and the explainers. */
import { h, esc, segmented, statGrid, chartBox, errorBox, explainer, fill } from './dataui.js';
import { sparkline } from './visuals.js';
import { dayAxis } from './timedata.js';
import { DAYS, DAYS_LABEL, DAYS_WORDS, riskLens, whatIf, volVsStocks, badgeVar, fmtUsd, fmtUsdExact, isoDate, STOCK_VOL_LOW, STOCK_VOL_HIGH } from '../lib/crypto';
import { signedPct, pct, money, longDate } from '../lib/format';

const DAY = 864e5;
export const skel = label => h('div', { class: 'd-skel', role: 'status', 'aria-label': label }, h('i', { class: 'big' }), h('i'), h('i'));
export const badge = c => h('span', { class: 'cr-badge', style: `background:var(${badgeVar(c.symbol)})`, 'aria-hidden': 'true' }, (c.symbol || c.name || '?').charAt(0));
const tick = v => { const a = Math.abs(v); return (v < 0 ? '−' : '') + (a >= 1e3 ? '$' + Math.round(a).toLocaleString('en-US') : a >= 1 ? '$' + +a.toFixed(2) : '$' + +a.toPrecision(3)); };

const change = v => ({ t: v == null ? '—' : signedPct(v / 100), tone: v != null && v < 0 ? 'neg' : '' });
function sparkCell(c) {
  const s = c.spark || [];
  if (s.length < 2) return h('td', { class: 'na' }, '—');
  const up = s[s.length - 1] >= s[0];
  return h('td', { class: 'cr-sp', html: sparkline(s.map((v, i) => [i, v]), { w: 96, h: 34, color: up ? 'var(--good)' : 'var(--bad)' }) });
}
const cell = o => h('td', { class: [o.tone, o.t === '—' ? 'na' : ''].filter(Boolean).join(' ') || null }, o.t);

/** The markets table. rows are clickable, with a real button in the first cell for keyboards. */
export function marketsTable(coins, selected, onPick) {
  const head = ['Coin', 'Price', '24h', '7d', '30d', '1y', 'Market cap', 'Last 7 days'];
  const rows = coins.map(c => {
    const on = c.id === selected;
    const btn = h('button', { type: 'button', class: 'cr-pick', 'aria-pressed': String(on), 'aria-label': `Show ${c.name}`, onclick: e => { e.stopPropagation(); onPick(c.id); } },
      h('span', { class: 'cr-rank' }, c.rank == null ? '' : String(c.rank)), badge(c), h('span', { class: 'cr-nm' }, h('b', {}, c.name), h('small', {}, c.symbol)));
    return h('tr', { class: on ? 'on' : '', 'data-id': c.id, onclick: () => onPick(c.id) },
      h('th', { scope: 'row' }, btn), cell({ t: fmtUsd(c.price) }), cell(change(c.ch24)), cell(change(c.ch7d)), cell(change(c.ch30d)), cell(change(c.ch1y)), cell({ t: money(c.cap) }), sparkCell(c));
  });
  return h('div', { class: 'd-tw', role: 'region', 'aria-label': 'Top 20 cryptocurrencies by market value. Scroll sideways for more columns.', tabindex: '0' },
    h('table', { class: 'd-t cr-t' }, h('thead', {}, h('tr', {}, head.map(t => h('th', { scope: 'col' }, t)))), h('tbody', {}, rows)));
}

/** Marks which row is selected without rebuilding the table. */
export function markRow(root, id) {
  root.querySelectorAll('tbody tr').forEach(tr => { const on = tr.dataset.id === id; tr.classList.toggle('on', on); const b = tr.querySelector('.cr-pick'); if (b) b.setAttribute('aria-pressed', String(on)); });
}

const dayText = ms => longDate(isoDate(ms));

function riskTiles(pts, days) {
  const r = riskLens(pts), w = whatIf(pts, 1000);
  if (!r) return null;
  const x = volVsStocks(r.vol), dd = r.drawdown, d = r.days;
  return [
    { label: 'Volatility a year', value: r.vol == null ? '—' : pct(r.vol, 0), sub: x == null ? '' : `about ${x < 1.5 ? x.toFixed(1) : Math.round(x)}× a stock index` },
    { label: 'Worst fall from a peak', value: dd && dd.depth > 0 ? signedPct(-dd.depth) : dd ? '0%' : '—', sub: dd && dd.depth > 0 ? `${dayText(dd.peakAt)} to ${dayText(dd.troughAt)}` : 'no fall in this range', tone: dd && dd.depth > 0 ? 'bad' : '' },
    { label: 'Best day', value: d ? signedPct(d.best.change) : '—', sub: d ? dayText(d.best.at) : '' },
    { label: 'Worst day', value: d ? signedPct(d.worst.change) : '—', sub: d ? dayText(d.worst.at) : '', tone: d && d.worst.change < 0 ? 'bad' : '' },
    { label: `$1,000 from ${DAYS_WORDS[days]}`, value: w ? fmtUsdExact(w.value) : '—', sub: w ? signedPct(w.change) : '', tone: w && w.change < 0 ? 'bad' : '' }
  ];
}

/** The selected coin: price, range tabs, chart and risk lens. */
export function coinCard({ onDays, days }) {
  const titleBox = h('div', { class: 'cr-title' }), body = h('div', { class: 'cu-body' });
  const seg = segmented({ options: DAYS.map(d => [d, DAYS_LABEL[d]]), value: days, label: 'Time range', onChange: onDays });
  let chart = null;
  const kill = () => { if (chart) { chart.destroy(); chart = null; } };
  return {
    el: h('section', { class: 'd-card', id: 'cr-coin' }, titleBox, h('div', { class: 'd-row' }, seg.el), body),
    setDays: d => seg.set(d),
    title(coin, id) {
      const name = coin ? coin.name : id, sym = coin ? coin.symbol : '';
      const top = [h('h2', { class: 'd-h' }, name), sym ? h('span', { class: 'd-badge' }, sym) : null];
      const price = coin ? h('p', { class: 'cr-price' }, h('b', {}, fmtUsd(coin.price)), h('span', { class: coin.ch24 != null && coin.ch24 < 0 ? 'neg' : '' }, coin.ch24 == null ? '' : `${signedPct(coin.ch24 / 100)} in 24 hours`),
        coin.ath != null && coin.athChange != null ? h('small', {}, `Record high ${fmtUsd(coin.ath)}, now ${pct(Math.abs(coin.athChange) / 100, 0)} ${coin.athChange < 0 ? 'below' : 'above'} it`) : null) : null;
      fill(titleBox, h('div', { class: 'd-row' }, coin ? badge(coin) : null, ...top), price);
    },
    loading() { kill(); body.replaceChildren(skel('Loading price history')); },
    error(message, retry) { kill(); body.replaceChildren(errorBox(message, retry)); },
    show(d, name) {
      kill();
      const pts = d.points, t0 = pts[0][0], span = (pts[pts.length - 1][0] - t0) / DAY;
      chart = chartBox({
        title: `${name} price in US dollars`, h: 280, hint: 'Slide across the chart, or tap it, to read the price at any moment.',
        series: [{ name: `${name} in US dollars`, color: 'c1', pts: pts.map(p => [(p[0] - t0) / DAY, p[1]]) }],
        ...dayAxis(t0, span, d.days <= 90), yFmt: tick, yRead: fmtUsd
      });
      const tiles = riskTiles(pts, d.days), r = riskLens(pts), x = r && volVsStocks(r.vol);
      const words = r && r.vol != null ? h('p', { class: 'd-plain plain', html: `Over this period ${esc(name)} swung by about <b>${esc(pct(r.vol, 0))} a year</b>${x == null ? '' : `, roughly <b>${x < 1.5 ? esc(x.toFixed(1)) : Math.round(x)} times</b> as bumpy as a typical stock index`}. As a rough reference only (not live data), broad stock indexes have usually moved ${Math.round(STOCK_VOL_LOW * 100)} to ${Math.round(STOCK_VOL_HIGH * 100)}% a year.` }) : null;
      fill(body,
        d.stale ? h('p', { class: 'd-note warn', role: 'status' }, 'The free price source is busy, so this chart may be a little out of date.') : null,
        chart.el,
        h('h3', { class: 'cr-h3' }, 'Risk lens'),
        tiles ? statGrid(tiles) : h('p', { class: 'd-cap' }, 'Not enough price history to measure risk yet.'),
        words,
        h('p', { class: 'd-cap' }, 'Volatility is the size of the daily ups and downs, scaled to a year with √365 because crypto trades every day (stocks trade about 252 days). Short ranges are only a rough guide.'));
    },
    destroy: kill
  };
}

/** What a sum of money would have become. */
export function whatIfCard({ onDays, days, amount, onAmount }) {
  const input = h('input', { class: 'd-in cu-amt', id: 'cr-amount', type: 'text', inputmode: 'decimal', autocomplete: 'off', spellcheck: 'false', maxlength: 24, value: amount, 'aria-describedby': 'cr-wi', oninput: () => onAmount(input.value) });
  const seg = segmented({ options: DAYS.map(d => [d, DAYS_LABEL[d]]), value: days, label: 'How far back', onChange: onDays });
  const out = h('div', { class: 'cu-result', id: 'cr-wi', 'aria-live': 'polite' });
  return {
    el: h('section', { class: 'd-card' }, h('h2', { class: 'd-h' }, 'What if you had bought?'), h('p', { class: 'd-sub' }, 'Pick an amount and how far back. This uses the coin chosen above.'),
      h('div', { class: 'cr-wif' }, h('div', { class: 'cu-f' }, h('label', { for: 'cr-amount' }, 'Amount in US dollars'), input), h('div', { class: 'cu-f' }, h('label', {}, 'Bought'), seg.el)), out),
    setDays: d => seg.set(d),
    draw({ pts, n, name, days: dd, loading }) {
      if (loading) { out.innerHTML = '<p class="cu-hint">Loading…</p>'; return; }
      if (n == null) { out.innerHTML = `<p class="cu-hint warn">${input.value.trim() ? 'Enter an amount such as 1,000.' : 'Type an amount to see what it would be worth.'}</p>`; return; }
      const w = pts ? whatIf(pts, n) : null;
      if (!w) { out.innerHTML = '<p class="cu-hint warn">We need a positive amount and some price history.</p>'; return; }
      const up = w.gain >= 0, half = fmtUsdExact(w.value / 2);
      out.innerHTML = `<p class="cu-eq">${esc(fmtUsdExact(n))} in ${esc(name)} ${esc(DAYS_WORDS[dd])} would be worth</p><p class="cu-big">${esc(fmtUsdExact(w.value))}</p><p class="cu-hint">${up ? 'A gain' : 'A loss'} of <b class="${up ? '' : 'neg'}">${esc(fmtUsdExact(Math.abs(w.gain)))}</b> (${esc(signedPct(w.change))}). Past results do not predict the future: the price could just as easily go the other way, and a 50% fall from here would leave ${esc(half)}.</p>`;
    }
  };
}

export function explainers() {
  return h('div', { class: 'cu-ex' },
    explainer('What is a cryptocurrency?', '<p>A cryptocurrency is digital money that lives on a shared computer network rather than at a bank. <b>Bitcoin</b> was the first. Nobody issues it and no government backs it; its value comes only from what people are willing to pay.</p><p>It is not the same as a share in a company: there are no profits or dividends behind the price.</p>'),
    explainer('Why is crypto so volatile?', '<ul><li>There are <b>no earnings or cash flows</b> to anchor a fair price, so moods drive it.</li><li>The market is <b>young and thin</b>: a few big trades can move the price.</li><li>It trades <b>24 hours a day</b>, so news hits at once.</li><li>Many buyers are <b>speculators</b> who sell fast when prices drop.</li></ul>'),
    explainer('What is market cap?', '<p><b>Market cap</b> (market capitalisation) is the price of one coin times the number of coins in circulation. It is a way to compare size, like a company\'s market value. It is <b>not</b> money that was put in: a coin worth $1 trading thinly can show a large market cap.</p>'),
    explainer('What is volatility?', '<p><b>Volatility</b> measures how much a price jumps around. We take each day\'s percentage move, measure how spread out they are (the standard deviation), and scale it to a year. Higher means a bumpier ride.</p><p><b>Maximum drawdown</b> is the biggest fall from a high point to a later low, the pain an owner would have felt at the worst moment.</p>'));
}
