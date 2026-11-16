// @ts-nocheck
/* Options payoff page: pick a strategy, see what it earns or loses at different stock prices. Everything is worked out in the browser. */
import '../styles/options.css';
import { h, head, segmented, statGrid, chartBox, explainer, fill } from './dataui.js';
import { rangeSlider } from './slider.js';
import { withNumberBox } from './slidebox.js';
import { store } from './visuals.js';
import { num } from '../lib/format';
import { STRATEGIES, buildStrategy, analyze, curve, positionPnl, optionPrice, legLabel } from '../lib/payoff';

const RATE = 0.04, TERM = 30;
const VOLS = [['0.15', 'Calm'], ['0.25', 'Normal'], ['0.45', 'Wild']];
const usd = x => (x < 0 ? '−$' : '$') + num(Math.abs(x), 0);
const px = x => '$' + num(x, 2);
const signed = x => (x > 0 ? '+' : '') + usd(x);
const posNum = v => { const n = parseFloat(String(v).replace(/,/g, '')); return Number.isFinite(n) && n > 0 ? n : null; };

export function renderOptions(main) {
  const saved = store.get('fl:opt') || {};
  const st = { id: STRATEGIES.some(s => s.id === saved.id) ? saved.id : 'long-call', spot: 100, iv: 0.25, left: 15, end: 100, legs: [] };
  const reset = () => { st.legs = buildStrategy(st.id, st.spot, TERM, st.iv, RATE); };
  reset();

  const chips = h('div', { class: 'd-chips op-chips', role: 'group', 'aria-label': 'Choose a strategy' });
  const story = h('div', { class: 'op-story' });
  const statsHost = h('div'), legsHost = h('div', { class: 'op-legs' }), result = h('p', { class: 'op-result', 'aria-live': 'polite' });
  const chart = chartBox({ series: [{ name: '', pts: [[0, 0], [1, 0]] }] });

  const spotIn = h('input', { class: 'd-in op-in', type: 'text', inputmode: 'decimal', value: String(st.spot), 'aria-label': 'Stock price today in dollars' });
  const vol = segmented({ options: VOLS, value: String(st.iv), label: 'How much the stock jumps around', onChange: v => { st.iv = +v; reset(); drawLegs(); update(); } });
  const endS = withNumberBox(rangeSlider({ min: 50, max: 150, step: 1, value: 100, label: 'Stock price at expiry', fmt: v => '$' + num(v, 0) }), { label: 'Stock price at expiry', unit: '$', decimals: 2 });
  const leftS = withNumberBox(rangeSlider({ min: 0, max: TERM, step: 1, value: st.left, label: 'Days left on the option', fmt: v => v + (v === 1 ? ' day' : ' days') }), { label: 'Days left on the option', unit: 'days' });

  const bounds = () => [Math.max(0.5, st.spot * 0.5), st.spot * 1.5];

  function drawChips() {
    chips.replaceChildren(...STRATEGIES.map(s => h('button', { type: 'button', class: 'd-chip', 'aria-pressed': String(s.id === st.id), onclick: () => { st.id = s.id; store.set('fl:opt', { id: s.id }); reset(); drawChips(); drawLegs(); update(); } }, s.name)));
  }

  function legRow(l, i) {
    const label = h('span', { class: 'op-ln' }, legLabel(l));
    if (l.kind === 'stock') return h('div', { class: 'op-row' }, label, h('span', { class: 'op-fixed' }, 'bought at ' + px(l.premium)));
    const strike = h('input', { class: 'd-in op-in', type: 'text', inputmode: 'decimal', value: String(l.strike), 'aria-label': `${legLabel(l)}: strike price` });
    const price = h('input', { class: 'd-in op-in', type: 'text', inputmode: 'decimal', value: l.premium.toFixed(2), 'aria-label': `${legLabel(l)}: price of the option per share` });
    strike.addEventListener('change', () => {
      const k = posNum(strike.value);
      if (k == null) { strike.value = String(l.strike); return; }
      const next = { ...l, strike: k, premium: +optionPrice(l.kind, st.spot, k, TERM, st.iv, RATE).toFixed(2) };
      st.legs = st.legs.map((x, j) => (j === i ? next : x)); drawLegs(); update();
    });
    price.addEventListener('change', () => {
      const p = parseFloat(price.value);
      if (!Number.isFinite(p) || p < 0) { price.value = l.premium.toFixed(2); return; }
      st.legs = st.legs.map((x, j) => (j === i ? { ...x, premium: p } : x)); drawLegs(); update();
    });
    return h('div', { class: 'op-row' }, label, h('label', { class: 'op-f' }, h('span', {}, 'Strike price'), strike), h('label', { class: 'op-f' }, h('span', {}, 'Price paid' + (l.side < 0 ? ' (received)' : '')), price));
  }
  function drawLegs() { legsHost.replaceChildren(...st.legs.map(legRow)); }

  function update() {
    const s = STRATEGIES.find(x => x.id === st.id), a = analyze(st.legs), [lo, hi] = bounds();
    story.replaceChildren(h('p', { class: 'op-view' }, s.view), h('p', { class: 'd-plain' }, s.blurb));
    fill(statsHost, statGrid([
      { label: 'Best case', value: a.maxProfit == null ? 'No limit' : usd(a.maxProfit), sub: s.best, tone: 'good' },
      { label: 'Worst case', value: a.maxLoss == null ? 'No limit' : usd(a.maxLoss), sub: s.worst, tone: 'bad' },
      { label: a.breakevens.length > 1 ? 'Break-even prices' : 'Break-even price', value: a.breakevens.length ? a.breakevens.map(b => '$' + num(b, 2)).join(' and ') : 'None', sub: 'The stock price where you neither gain nor lose' }
    ]));
    const c = curve(st.legs, lo, hi, st.left, st.iv, RATE);
    const dollars = x => usd(x);
    chart.update({
      title: 'Profit or loss for one option contract, by stock price',
      series: [
        { name: 'On the day the option expires', pts: c.prices.map((p, i) => [p, c.expiry[i]]), color: 'mute', dash: true },
        { name: `With ${st.left} ${st.left === 1 ? 'day' : 'days'} left`, pts: c.prices.map((p, i) => [p, c.today[i]]), color: 'c1' }
      ],
      hlines: [{ y: 0 }],
      vlines: [{ x: st.spot, label: 'Today', color: 'mute' }],
      xFmt: v => '$' + num(v, 0), xRead: v => 'Stock at $' + num(v, 2), yFmt: dollars, yRead: dollars,
      hint: 'Slide across the chart to read exact values.'
    });
    const end = Math.min(hi, Math.max(lo, st.end)), r = positionPnl(st.legs, end);
    result.replaceChildren('If the stock is at ', h('b', {}, '$' + num(end, 2)), ' when the option expires, you ', r >= 0 ? 'make ' : 'lose ', h('b', { class: r >= 0 ? 'good' : 'bad' }, usd(Math.abs(r))), '. ', h('span', { class: 'op-mute' }, Math.abs(end / st.spot - 1) < 0.0005 ? "That is the same as today's price." : `That is ${num(Math.abs(end / st.spot - 1) * 100, 1)}% ${end > st.spot ? 'above' : 'below'} today's price.`));
  }

  function setSpot(v) {
    const p = posNum(v);
    if (p == null || p < 1 || p > 100000) { spotIn.value = String(st.spot); return; }
    st.spot = p; st.end = p; spotIn.value = String(p);
    const [lo, hi] = bounds();
    endS.input.min = String(Math.floor(lo)); endS.input.max = String(Math.ceil(hi)); endS.input.step = p >= 200 ? '5' : p >= 20 ? '1' : '0.5';
    endS.input.value = String(p);
    endS.input.dispatchEvent(new Event('input'));
    reset(); drawLegs(); update();
  }
  spotIn.addEventListener('change', () => setSpot(spotIn.value));
  endS.input.addEventListener('input', () => { st.end = +endS.input.value; update(); });
  leftS.input.addEventListener('input', () => { st.left = +leftS.input.value; update(); });

  const ctl = (title, hint, node) => h('div', { class: 'op-ctl' }, h('div', { class: 'op-ct' }, h('b', {}, title), h('small', {}, hint)), node);
  main.replaceChildren(h('div', { class: 'd-page op-page' },
    head({ eyebrow: 'Options', title: 'How an <em>option</em> makes or loses money', lead: 'An option is a contract tied to a stock price. Pick a strategy, then slide the stock price to see what you would earn or lose. Nothing here is real money.' }),
    h('section', { class: 'd-card' }, h('h2', { class: 'd-h' }, '1. Pick a strategy'), chips, story),
    h('section', { class: 'd-card' }, h('h2', { class: 'd-h' }, '2. What could happen'), statsHost, chart.el, result,
      h('div', { class: 'op-ctls' },
        ctl('If the stock ends at', 'Slide to try a price', endS.el),
        ctl('Days left on the option', 'Time left is worth money, so the solid line bends toward the dashed one as days run out', leftS.el))),
    h('section', { class: 'd-card' }, h('h2', { class: 'd-h' }, '3. Change the details'),
      h('p', { class: 'd-sub' }, 'These start filled in with fair prices. Change them if you like, or leave them alone.'),
      h('div', { class: 'op-ctls' },
        ctl('Stock price today', 'In dollars', spotIn),
        ctl('How much the stock jumps around', 'Wilder stocks make options cost more', vol.el)),
      legsHost),
    explainer('What is an option?', '<p>An option is a contract. It gives you the <b>right, but not the duty</b>, to buy or sell a stock at a fixed price (the <b>strike price</b>) before a set date. A <b>call</b> is the right to buy. A <b>put</b> is the right to sell. You pay a price for that right, called the <b>premium</b>.</p><p>One contract covers 100 shares, so every dollar figure on this page is for 100 shares.</p>'),
    explainer('How are the prices worked out?', '<p>The starting prices come from the Black-Scholes formula, a standard way to price options. We assume 30 days to expiry, a 4% interest rate and no dividends. Real market prices differ a little, so treat this as a teaching tool, not a quote.</p><p>Taxes, trading fees and early exercise are left out. This page is for learning and is not financial advice.</p>')));
  drawChips(); drawLegs(); update();
  return () => chart.destroy();
}
