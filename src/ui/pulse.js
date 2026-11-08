// @ts-nocheck
/* Market pulse: a plain-English picture of what the market is doing, for the US (live while open) and Pakistan (end of day). */
import '../styles/pulse.css';
import snapshot from '../data/countries-latest.json';
import { h, head, api, scope, skeleton, errorBox, segmented, explainer, sourceLine, dataTable } from './dataui.js';
import { sparkline } from './visuals.js';
import { enhanceTerms } from './glossary.js';
import { riskMood, sectorsByChange, movers, usStory, appetite, pkSectors, pkBreadth, pkMovers, pkStory, heat, isOpen, PERIODS } from '../lib/pulse';
import { signedPct, num, longDate } from '../lib/format';

const MARKETS = [['us', 'US stocks'], ['pakistan', 'Pakistan']];
const readMarket = () => { const m = new URLSearchParams(location.search).get('m'); return MARKETS.some(x => x[0] === m) ? m : 'us'; };
const TELLS = { '^VIX': 'Investors\' fear. Under 15 is calm; over 30 means panic.', '^TNX': 'What the US government pays to borrow for 10 years. It steers mortgage and loan rates.', UUP: 'The dollar against other big currencies. A strong dollar squeezes exporters and poorer countries. Shown by the size of its move, through a fund.', GLD: 'A classic safe place to hide when people are worried. Shown by the size of its move, through a fund.', USO: 'Crude oil. It drives fuel prices, inflation and energy company profits. Shown by the size of its move, through a fund.', 'BTC-USD': 'The biggest cryptocurrency. It tends to rise when investors feel bold.' };
const priceText = it => (it.symbol === '^TNX' ? num(it.price, 2) + '%' : it.symbol === '^VIX' ? num(it.price, 2) : it.symbol === 'BTC-USD' ? '$' + num(it.price, it.price > 1000 ? 0 : 2) : num(it.price, 0));
const changeText = it => (it.symbol === '^TNX' ? `${it.abs >= 0 ? '+' : '−'}${num(Math.abs(it.abs) * 100, 0)} bp` : signedPct(it.chg, 2));
const dir = x => (x > 0.0001 ? 'up' : x < -0.0001 ? 'down' : '');
const spark = (arr, up) => h('span', { html: sparkline(arr.map((y, i) => [i, y]), { w: 120, h: 42, color: up ? 'var(--good)' : 'var(--bad)' }) });

export function renderPulse(main) {
  const S = scope(), out = h('div', { class: 'd-page' }), srcHost = h('div'), status = h('p', { class: 'd-vh', role: 'status', 'aria-live': 'polite' });
  let market = readMarket(), period = 'c1', data = null, fx = null, timer = 0, alive = true, first = true;

  const card = it => h('div', { class: 'pl-card' }, h('span', { class: 'pl-n' }, it.name), it.proxy ? null : h('span', { class: 'pl-p' }, priceText(it)), h('span', { class: 'pl-c ' + dir(it.chg) }, changeText(it)), spark(it.spark, it.chg >= 0), TELLS[it.symbol] ? h('small', {}, TELLS[it.symbol]) : null);
  const tile = (name, v, full, sub) => h('div', { class: 'pl-tile ' + dir(v), style: `--s:${heat(v, full)}` }, h('b', {}, name), h('span', {}, signedPct(v, 2)), sub ? h('small', {}, sub) : null);
  const row = (it, key, type) => h('li', { class: 'pl-row' }, h('div', {}, h('b', {}, it.symbol.replace('^', '')), h('small', {}, it.name)), spark(it.spark, (key ? it[key] : it.chg) >= 0), h('span', { class: 'pl-v ' + dir(key ? it[key] : it.chg) }, signedPct(key ? it[key] : it.chg, 1)));
  const section = (title, sub, ...kids) => h('section', { class: 'd-card' }, title ? h('h2', { class: 'd-h' }, title) : null, sub ? h('p', { class: 'd-sub' }, sub) : null, ...kids);
  const live = () => data && data.market === 'us' && isOpen(data.lastBar);

  function usView(d) {
    const items = d.items, g = x => items.filter(i => i.group === x), mood = riskMood(items), story = usStory(items, live()), ap = appetite(items), mv = movers(items, 6), sec = sectorsByChange(items);
    const meter = h('div', { class: 'pl-meter' }, h('div', { class: 'track', role: 'img', 'aria-label': `Mood meter: ${mood.label}` }, h('i', { class: 'dot', style: `left:${50 + mood.score * 50}%` })), h('div', { class: 'ends' }, h('span', {}, 'Risk-off (playing safe)'), h('span', {}, 'Risk-on (taking risk)')));
    return [
      section(null, null, h('div', { class: 'pl-bar' }, h('span', { class: 'pl-mood ' + (mood.label === 'Risk-on' ? 'on' : mood.label === 'Risk-off' ? 'off' : 'mix') }, `${mood.label === 'Risk-on' ? '▲' : mood.label === 'Risk-off' ? '▼' : '◆'} ${mood.label}`), h('span', { class: 'pl-live ' + (live() ? 'on' : '') }, h('i'), live() ? 'Market open' : 'Market closed, showing the last close')),
        h('h2', { class: 'pl-head' }, story.headline), h('ul', { class: 'pl-points plain' }, story.bullets.map(b => h('li', {}, b))), meter,
        h('details', { class: 'd-ex' }, h('summary', {}, 'Why does it say that?'), h('div', { class: 'd-exb plain' }, h('p', {}, 'The mood is a rough score from four clues: how the S&P 500 is moving, whether the fear gauge is rising or falling, whether growth-sensitive sectors are beating defensive ones, and bond yields. It is a description of today, not a prediction.'), h('ul', {}, mood.reasons.map(r => h('li', {}, r.text)))))),
      section('The big indexes', 'Baskets of companies that stand for the whole market.', h('div', { class: 'pl-grid wide' }, g('index').map(card))),
      section('Which sectors are leading?', `Each tile is a part of the economy. Green is up, red is down. ${ap.spread != null ? (ap.spread >= 0 ? 'Growth-sensitive sectors are ahead of the defensive ones.' : 'Defensive sectors are ahead of the growth-sensitive ones.') : ''}`, h('div', { class: 'pl-heat' }, sec.map(s => tile(s.name, s.chg, 0.02)))),
      section('Fear, money and safe havens', 'These show how nervous or bold investors feel.', h('div', { class: 'pl-grid wide' }, g('gauge').map(card))),
      h('div', { class: 'pl-cols' }, section('Biggest gainers', 'Among 24 of the largest US companies.', h('ul', { class: 'pl-list' }, mv.up.map(i => row(i)))), section('Biggest fallers', 'Among the same companies.', h('ul', { class: 'pl-list' }, mv.down.map(i => row(i)))))
    ];
  }

  function pkView(d) {
    const items = d.items, story = pkStory(items, period), b = pkBreadth(items, period), sec = pkSectors(items, period), mv = pkMovers(items, period, 6), label = PERIODS.find(p => p[0] === period)[1];
    const mood = b.avg == null ? 'mix' : b.up > b.down * 1.3 && b.avg > 0 ? 'on' : b.down > b.up * 1.3 && b.avg < 0 ? 'off' : 'mix', moodText = mood === 'on' ? '▲ Broad buying' : mood === 'off' ? '▼ Broad selling' : '◆ Mixed';
    const rate = fx && fx.rate, chgM = fx && fx.change, ctx = [
      h('div', { class: 'pl-card' }, h('span', { class: 'pl-n' }, 'Average large stock'), h('span', { class: 'pl-p' }, signedPct(b.avg, 1)), h('small', {}, `${b.up} up, ${b.down} down over ${label.toLowerCase()}`)),
      rate ? h('div', { class: 'pl-card' }, h('span', { class: 'pl-n' }, 'US dollar in rupees'), h('span', { class: 'pl-p' }, 'Rs ' + num(rate, 1)), h('span', { class: 'pl-c ' + (chgM > 0.003 ? 'down' : chgM < -0.003 ? 'up' : '') }, `${signedPct(chgM, 1)} in a month`), h('small', {}, Math.abs(chgM) < 0.003 ? 'The rupee was steady against the dollar this month.' : chgM > 0 ? 'The rupee got weaker against the dollar. Imports cost more.' : 'The rupee got stronger against the dollar. Imports cost less.')) : null,
      snapshot.latest['FP.CPI.TOTL.ZG'].PK ? h('div', { class: 'pl-card' }, h('span', { class: 'pl-n' }, `Inflation (${snapshot.latest['FP.CPI.TOTL.ZG'].PK.year})`), h('span', { class: 'pl-p' }, num(snapshot.latest['FP.CPI.TOTL.ZG'].PK.value, 1) + '%'), h('small', {}, 'How fast prices rose in a year (World Bank).')) : null,
      snapshot.latest['NY.GDP.MKTP.KD.ZG'].PK ? h('div', { class: 'pl-card' }, h('span', { class: 'pl-n' }, `Economic growth (${snapshot.latest['NY.GDP.MKTP.KD.ZG'].PK.year})`), h('span', { class: 'pl-p' }, num(snapshot.latest['NY.GDP.MKTP.KD.ZG'].PK.value, 1) + '%'), h('small', {}, 'How much the economy grew (World Bank).')) : null
    ];
    const sorted = items.slice().sort((a, c) => c[period] - a[period]);
    return [
      section(null, null, h('div', { class: 'pl-bar' }, h('span', { class: 'pl-mood ' + mood }, moodText), segmented({ options: PERIODS, value: period, label: 'Period', onChange: v => { period = v; render(); } }).el),
        h('h2', { class: 'pl-head' }, story.headline), h('ul', { class: 'pl-points plain' }, story.bullets.map(x => h('li', {}, x))),
        h('p', { class: 'd-cap' }, `Prices are from the last trading day, ${longDate(new Date(d.lastBar * 1000).toISOString().slice(0, 10))}. They are end-of-day, not live.`)),
      section('Around the numbers', 'The wider picture for Pakistan.', h('div', { class: 'pl-grid wide' }, ctx.filter(Boolean))),
      section('Which sectors are leading?', `Average move of the large stocks in each sector over ${label.toLowerCase()}.`, h('div', { class: 'pl-heat' }, sec.map(s => tile(s.sector, s.avg, period === 'c1' ? 0.02 : period === 'c5' ? 0.04 : 0.1, `${s.up} of ${s.count} up`)))),
      h('div', { class: 'pl-cols' }, section('Biggest gainers', `Over ${label.toLowerCase()}.`, h('ul', { class: 'pl-list' }, mv.up.map(i => row(i, period)))), section('Biggest fallers', `Over ${label.toLowerCase()}.`, h('ul', { class: 'pl-list' }, mv.down.map(i => row(i, period))))),
      section('All stocks we follow', 'Sorted by the period you chose. Scroll sideways for more columns.', dataTable({ head: ['Stock', 'Sector', 'Price (Rs)', 'Day', 'Week', 'Month'], label: 'Pakistani stocks', rows: sorted.map(i => ({ label: `${i.symbol} · ${i.name}`, cells: [i.group, num(i.price, 2), ...['c1', 'c5', 'c20'].map(k => ({ t: signedPct(i[k], 1), tone: i[k] < 0 ? 'neg' : '' }))] })) }))
    ];
  }

  const notes = d => [
    explainer('What do these words mean?', '<ul><li><b>Risk-on / risk-off</b>: when investors feel bold they buy stocks and riskier assets (risk-on). When they feel scared they sell and hide in safer things like bonds, gold and defensive sectors (risk-off).</li><li><b>Sector</b>: a group of similar companies, such as banks or energy. Looking at sectors shows <i>where</i> money is going, not just whether the market is up.</li><li><b>Fear gauge (VIX)</b>: a number that measures how much swing investors expect in the S&P 500. Higher means more fear.</li><li><b>Yield</b>: the interest a government pays to borrow. When yields rise, borrowing costs more and growth stocks often fall.</li></ul>'),
    h('p', { class: 'd-cap' }, d.market === 'us' ? 'US prices come from Yahoo Finance and can be delayed by up to 15 minutes. The page refreshes by itself while the market is open. For learning, not investment advice.' : 'Pakistan prices are end of day, taken from Yahoo Finance. The Pakistan Stock Exchange does not allow its live prices to be shown on other sites without a licence, so this page does not use them. For learning, not investment advice.')
  ];

  function render() {
    if (!data) return;
    const d = data;
    out.classList.toggle('pl-still', !first); first = false;
    srcHost.replaceChildren(sourceLine({ source: 'Yahoo Finance public chart data (delayed, unofficial)', asOf: d.asOf, live: d.market === 'us' && live() }));
    out.replaceChildren(...(d.market === 'us' ? usView(d) : pkView(d)), ...notes(d));
    enhanceTerms(out);
  }

  async function load(auto) {
    S.reset(); clearTimeout(timer);
    if (!auto) { first = true; out.replaceChildren(skeleton('Loading the market')); }
    status.textContent = 'Loading.';
    try {
      const [d, f] = await Promise.all([api('pulse', { market }, S.signal), market === 'pakistan' ? api('fx', { view: 'history', base: 'USD', quote: 'PKR', range: '1m' }, S.signal).then(r => ({ rate: r.last, change: r.change })).catch(e => { if (e.name === 'AbortError') throw e; return null; }) : null]);
      if (!alive || d.market !== market) return;
      data = d; fx = f; render(); status.textContent = `Showing the ${market === 'us' ? 'US' : 'Pakistan'} market.`;
      if (live()) timer = setTimeout(() => load(true), 45000);
    } catch (e) { if (e.name === 'AbortError' || !alive) return; if (auto && data) { timer = setTimeout(() => load(true), 90000); return; } out.replaceChildren(errorBox(e.message, () => load())); status.textContent = e.message; }
  }

  const picker = segmented({ options: MARKETS, value: market, label: 'Market', onChange: v => { market = v; try { history.replaceState(null, '', '/market-pulse?m=' + v); } catch (e) { /* ignore */ } load(); } });
  main.replaceChildren(head({ eyebrow: 'Live data · US market, Pakistan at end of day', title: 'Market <em>pulse</em>', lead: 'What is the market doing, and why? A plain-English read of the US and Pakistan markets: the mood, the sectors leading, the fear gauge, and the biggest movers.' }),
    h('div', { class: 'd-page' }, h('section', { class: 'd-card' }, picker.el, srcHost), out), status);
  S.add(() => { alive = false; clearTimeout(timer); });
  load();
  return () => S.run();
}
