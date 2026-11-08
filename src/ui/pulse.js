// @ts-nocheck
/* Market pulse: a plain-English picture of what the market is doing, for the US (live while open) and Pakistan (end of day). Written for people who know nothing about stocks. */
import '../styles/pulse.css';
import snapshot from '../data/countries-latest.json';
import { h, head, api, scope, skeleton, errorBox, segmented, explainer, sourceLine, dataTable } from './dataui.js';
import { sparkline, store } from './visuals.js';
import { enhanceTerms } from './glossary.js';
import { riskMood, sectorsByChange, movers, usStory, appetite, pkSectors, pkBreadth, pkMovers, pkStory, heat, isOpen, PERIODS } from '../lib/pulse';
import { signedPct, num, longDate } from '../lib/format';

const MARKETS = [['us', 'US stocks'], ['pakistan', 'Pakistan']];
const readMarket = () => { const m = new URLSearchParams(location.search).get('m'); return MARKETS.some(x => x[0] === m) ? m : 'us'; };
const INDEX_INFO = { '^GSPC': ['S&P 500', 'The 500 biggest US companies'], '^IXIC': ['Nasdaq', 'Mostly technology companies'], '^DJI': ['Dow Jones', '30 famous giant companies'], '^RUT': ['Russell 2000', '2,000 smaller US companies'] };
const SECTOR_INFO = { Technology: 'Apple, Microsoft, chips', Financials: 'Banks, Visa, insurers', Energy: 'Oil and gas', 'Health care': 'Medicine, hospitals', 'Consumer discretionary': 'Amazon, Tesla, shops', 'Consumer staples': 'Food, soap, drinks', Industrials: 'Planes, machines, trucks', Utilities: 'Electricity and water', Materials: 'Chemicals, metals', 'Real estate': 'Owners of buildings', Communication: 'Google, Meta, phone firms' };
const GAUGE = {
  '^VIX': ['Investor nervousness', 'Called the "fear gauge" (VIX). Under 15 is calm. Over 30 means panic.'],
  '^TNX': ['What the US government pays to borrow', 'The "10-year yield". It steers what banks charge you for loans and mortgages.'],
  UUP: ['The US dollar', 'A strong dollar makes imports cheap but hurts companies that sell abroad. Shown as how much it moved.'],
  GLD: ['Gold', 'People buy gold when they are worried. Shown as how much it moved.'],
  USO: ['Oil', 'Oil drives fuel prices and inflation. Shown as how much it moved.'],
  'BTC-USD': ['Bitcoin', 'The biggest cryptocurrency. It tends to jump when investors feel bold.']
};
const GLOSSARY = [['Share (or stock)', 'A tiny piece of ownership in a company. If the company does well, the share usually becomes worth more.'], ['Stock market', 'A place where people buy and sell shares. Prices move all day: up when more people want to buy than sell, down when more want to sell.'], ['Index', 'A scoreboard that tracks a group of companies together, so you can see how "the market" is doing in one number.'], ['Sector', 'A group of similar companies, such as banks or energy firms.'], ['Percent change', 'How much a price moved since yesterday\'s close. +1% means it is 1% higher than yesterday.'], ['Fear gauge (VIX)', 'A number showing how nervous US investors are. Higher means more worry.'], ['Interest rate / yield', 'What a borrower pays to borrow money. When the government\'s rate goes up, loans cost more for everyone.'], ['Bold or cautious', 'When investors are bold they buy shares and other risky things. When they are cautious they sell and move money somewhere safer.']];

const priceText = it => (it.symbol === '^TNX' ? num(it.price, 2) + '%' : it.symbol === '^VIX' ? num(it.price, 2) : it.symbol === 'BTC-USD' ? '$' + num(it.price, it.price > 1000 ? 0 : 2) : num(it.price, 0));
const changeText = it => (it.symbol === '^TNX' ? `${it.abs >= 0 ? '+' : '−'}${num(Math.abs(it.abs), 2)} points` : signedPct(it.chg, 2));
const dir = x => (x > 0.0001 ? 'up' : x < -0.0001 ? 'down' : '');
const spark = (arr, up) => h('span', { html: sparkline(arr.map((y, i) => [i, y]), { w: 120, h: 42, color: up ? 'var(--good)' : 'var(--bad)' }) });
const MOOD = { Bold: ['on', '▲ Investors feel bold'], Cautious: ['off', '▼ Investors are cautious'], Undecided: ['mix', '◆ Investors are undecided'] };

export function renderPulse(main) {
  const S = scope(), out = h('div', { class: 'd-page' }), srcHost = h('div'), status = h('p', { class: 'd-vh', role: 'status', 'aria-live': 'polite' });
  let market = readMarket(), period = 'c1', data = null, fx = null, timer = 0, alive = true, first = true;

  const card = it => { const [name, note] = INDEX_INFO[it.symbol] || GAUGE[it.symbol] || [it.name, '']; return h('div', { class: 'pl-card' }, h('span', { class: 'pl-n' }, name), it.proxy ? null : h('span', { class: 'pl-p' }, priceText(it)), h('span', { class: 'pl-c ' + dir(it.chg) }, changeText(it)), spark(it.spark, it.chg >= 0), note ? h('small', {}, note) : null); };
  const tile = (name, v, full, sub) => h('div', { class: 'pl-tile ' + dir(v), style: `--s:${heat(v, full)}` }, h('b', {}, name), h('span', {}, signedPct(v, 2)), sub ? h('small', {}, sub) : null);
  const row = (it, key, note) => h('li', { class: 'pl-row' }, h('div', {}, h('b', {}, it.name), h('small', {}, note || it.symbol.replace('^', ''))), it.spark ? spark(it.spark, (key ? it[key] : it.chg) >= 0) : h('span'), h('span', { class: 'pl-v ' + dir(key ? it[key] : it.chg) }, signedPct(key ? it[key] : it.chg, 1)));
  const section = (title, sub, ...kids) => h('section', { class: 'd-card' }, title ? h('h2', { class: 'd-h' }, title) : null, sub ? h('p', { class: 'd-sub' }, sub) : null, ...kids);
  const live = () => data && data.market === 'us' && isOpen(data.lastBar);

  function intro(d) {
    const us = d.market === 'us', key = 'fl:pulse:intro', seen = store.get(key) === true;
    const steps = us
      ? [['A share is a piece of a company', 'When you buy a share you own a tiny part of that company. Companies like Apple and Tesla have shares you can buy.'], ['The market is where shares are traded', 'Prices go up when more people want to buy than sell, and down when more want to sell. They change all day.'], ['An index is a scoreboard', 'The S&P 500 follows the 500 biggest US companies together. If it is up, the big companies are mostly up.'], ['Green means up, red means down', 'Percentages show the change since yesterday\'s close. This page explains what is happening and why it matters.']]
      : [['A share is a piece of a company', 'When you buy a share you own a tiny part of that company, such as Lucky Cement or Meezan Bank.'], ['The PSX is Pakistan\'s stock market', 'The Pakistan Stock Exchange in Karachi is where Pakistani shares are traded. Its main scoreboard is the KSE-100.'], ['This page follows 77 large stocks', 'It is not the whole market and not the official KSE-100 (that data needs a licence). It shows the large, busy stocks.'], ['Green means up, red means down', 'Prices here are from the last trading day, not live. Percentages show how much they moved over the period you choose.']];
    const el = h('details', { class: 'd-ex' }, h('summary', {}, us ? 'New to the stock market? Start here (60 seconds)' : 'New to the Pakistani stock market? Start here (60 seconds)'),
      h('div', { class: 'd-exb pl-intro' }, h('ol', { class: 'pl-steps' }, steps.map(([t, b]) => h('li', {}, h('b', {}, t), b))), h('div', { class: 'pl-legend', 'aria-label': 'Colour guide' }, h('span', {}, h('i', { class: 'g' }), 'Green = rising'), h('span', {}, h('i', { class: 'r' }), 'Red = falling'), h('span', {}, 'Bigger colour = bigger move'))));
    if (!seen) el.open = true;
    el.addEventListener('toggle', () => { if (!el.open) store.set(key, true); });
    return el;
  }

  function usView(d) {
    const items = d.items, g = x => items.filter(i => i.group === x), mood = riskMood(items), story = usStory(items, live()), ap = appetite(items), mv = movers(items, 5), sec = sectorsByChange(items), [mc, mt] = MOOD[mood.label];
    const meter = h('div', { class: 'pl-meter' }, h('div', { class: 'track', role: 'img', 'aria-label': `Mood meter: ${mt}` }, h('i', { class: 'dot', style: `left:${50 + mood.score * 50}%` })), h('div', { class: 'ends' }, h('span', {}, 'Playing it safe'), h('span', {}, 'Feeling bold')));
    const w = d.wide, whole = w ? h('section', { class: 'd-card' }, h('h2', { class: 'd-h' }, 'Biggest movers across the whole US market'), h('p', { class: 'd-sub' }, 'Not just famous names: any US company worth over $2 billion that traded over a million shares. Tiny, thinly traded stocks are left out because their prices jump around for no real reason.'),
      h('div', { class: 'pl-sub3' }, [['gainers', 'Rising the most'], ['losers', 'Falling the most'], ['active', 'Most traded']].filter(([k]) => w[k]).map(([k, t]) => h('div', {}, h('h3', {}, t), h('ul', { class: 'pl-list' }, w[k].slice(0, 6).map(i => row(i, null, k === 'active' ? `${num(i.volume / 1e6, 0)}M shares traded` : `Worth $${num(i.cap / 1e9, 0)}B`))))))) : null;
    return [
      section(null, null, h('div', { class: 'pl-bar' }, h('span', { class: 'pl-mood ' + mc }, mt), h('span', { class: 'pl-live ' + (live() ? 'on' : '') }, h('i'), live() ? 'Market open, updating live' : 'Market closed, showing the last close')),
        h('h2', { class: 'pl-head' }, story.headline), h('p', { class: 'pl-short' }, story.takeaway), h('ul', { class: 'pl-points plain' }, story.bullets.map(b => h('li', {}, b))), meter,
        h('details', { class: 'd-ex' }, h('summary', {}, 'How do you know how investors feel?'), h('div', { class: 'd-exb plain' }, h('p', {}, 'Nobody can read investors\' minds, so this page looks at four clues: how the S&P 500 is moving, whether the fear gauge is rising or falling, whether growth-hungry companies are beating steady ones, and what is happening to interest rates. It describes today. It does not predict tomorrow.'), h('ul', {}, mood.reasons.map(r => h('li', {}, r.text)))))),
      section('How are the big companies doing?', 'These four scoreboards each follow a different group of US companies.', h('div', { class: 'pl-grid wide' }, g('index').map(card))),
      section('Which parts of the economy are doing well?', `Each box is a group of similar companies. ${ap.spread != null ? (ap.spread >= 0 ? 'Companies that thrive in a strong economy are ahead of the steady ones.' : 'Steady companies are ahead of the ones that need a strong economy.') : ''} Together these 11 groups cover almost every big US company.`, h('div', { class: 'pl-heat' }, sec.map(s => tile(s.name, s.chg, 0.02, SECTOR_INFO[s.name])))),
      section('Nervousness, interest rates and safe places', 'These show how worried or confident people are, and where they put money when they feel unsure.', h('div', { class: 'pl-grid wide' }, g('gauge').map(card))),
      whole,
      h('div', { class: 'pl-cols' }, section('Well-known companies rising', 'Among 24 giants such as Apple, Amazon and Nvidia.', h('ul', { class: 'pl-list' }, mv.up.map(i => row(i)))), section('Well-known companies falling', 'Among the same 24 giants.', h('ul', { class: 'pl-list' }, mv.down.map(i => row(i)))))
    ];
  }

  function pkView(d) {
    const items = d.items, story = pkStory(items, period), b = pkBreadth(items, period), sec = pkSectors(items, period), mv = pkMovers(items, period, 6), label = PERIODS.find(p => p[0] === period)[1];
    const mood = b.avg == null ? 'mix' : b.up > b.down * 1.3 && b.avg > 0 ? 'on' : b.down > b.up * 1.3 && b.avg < 0 ? 'off' : 'mix', moodText = mood === 'on' ? '▲ Most stocks are rising' : mood === 'off' ? '▼ Most stocks are falling' : '◆ No clear direction';
    const rate = fx && fx.rate, chgM = fx && fx.change, cpi = snapshot.latest['FP.CPI.TOTL.ZG'].PK, gdp = snapshot.latest['NY.GDP.MKTP.KD.ZG'].PK;
    const ctx = [
      h('div', { class: 'pl-card' }, h('span', { class: 'pl-n' }, 'The average stock'), h('span', { class: 'pl-p' }, signedPct(b.avg, 1)), h('small', {}, `${b.up} rose and ${b.down} fell over ${label.toLowerCase()}.`)),
      rate ? h('div', { class: 'pl-card' }, h('span', { class: 'pl-n' }, 'One US dollar costs'), h('span', { class: 'pl-p' }, 'Rs ' + num(rate, 1)), h('span', { class: 'pl-c ' + (chgM > 0.003 ? 'down' : chgM < -0.003 ? 'up' : '') }, `${signedPct(chgM, 1)} in a month`), h('small', {}, Math.abs(chgM) < 0.003 ? 'The rupee was steady against the dollar this month.' : chgM > 0 ? 'The rupee got weaker against the dollar. Imported goods cost more.' : 'The rupee got stronger against the dollar. Imported goods cost less.')) : null,
      cpi ? h('div', { class: 'pl-card' }, h('span', { class: 'pl-n' }, `How fast prices rose (${cpi.year})`), h('span', { class: 'pl-p' }, num(cpi.value, 1) + '%'), h('small', {}, 'This is inflation: how much more things cost than a year before (World Bank).')) : null,
      gdp ? h('div', { class: 'pl-card' }, h('span', { class: 'pl-n' }, `How fast the economy grew (${gdp.year})`), h('span', { class: 'pl-p' }, num(gdp.value, 1) + '%'), h('small', {}, 'A growing economy usually means companies earn more (World Bank).')) : null
    ];
    const sorted = items.slice().sort((a, c) => c[period] - a[period]);
    return [
      section(null, null, h('div', { class: 'pl-bar' }, h('span', { class: 'pl-mood ' + mood }, moodText), segmented({ options: PERIODS, value: period, label: 'Period', onChange: v => { period = v; render(); } }).el),
        h('h2', { class: 'pl-head' }, story.headline), h('p', { class: 'pl-short' }, story.takeaway), h('ul', { class: 'pl-points plain' }, story.bullets.map(x => h('li', {}, x))),
        h('p', { class: 'pl-cover' }, `What this covers: ${d.count} of the largest and most traded stocks on the Pakistan Stock Exchange, not every company and not the official KSE-100 scoreboard. Prices are from the last trading day, ${longDate(new Date(d.lastBar * 1000).toISOString().slice(0, 10))}. They are end-of-day, not live.`)),
      section('The wider picture', 'Things outside the stock market that shape how companies do.', h('div', { class: 'pl-grid wide' }, ctx.filter(Boolean))),
      section('Which parts of the economy are doing well?', `Each box is a group of similar companies, with the average move over ${label.toLowerCase()}.`, h('div', { class: 'pl-heat' }, sec.map(s => tile(s.sector, s.avg, period === 'c1' ? 0.02 : period === 'c5' ? 0.04 : 0.1, `${s.up} of ${s.count} rising`)))),
      h('div', { class: 'pl-cols' }, section('Rising the most', `Best stocks over ${label.toLowerCase()}.`, h('ul', { class: 'pl-list' }, mv.up.map(i => row(i, period, i.group)))), section('Falling the most', `Weakest stocks over ${label.toLowerCase()}.`, h('ul', { class: 'pl-list' }, mv.down.map(i => row(i, period, i.group))))),
      section('Every stock we follow', 'Sorted by the period you chose. Scroll sideways to see more columns.', dataTable({ head: ['Stock', 'Sector', 'Price (Rs)', 'Day', 'Week', 'Month'], label: 'Pakistani stocks', rows: sorted.map(i => ({ label: `${i.symbol} · ${i.name}`, cells: [i.group, num(i.price, 2), ...['c1', 'c5', 'c20'].map(k => ({ t: signedPct(i[k], 1), tone: i[k] < 0 ? 'neg' : '' }))] })) }))
    ];
  }

  const notes = d => [
    section('Words used on this page', 'In plain English.', h('dl', { class: 'pl-dl' }, GLOSSARY.flatMap(([t, def]) => [h('dt', {}, t), h('dd', {}, def)]))),
    h('p', { class: 'd-cap' }, d.market === 'us' ? 'US prices come from Yahoo Finance and can be up to 15 minutes late. The page refreshes by itself while the market is open. This is for learning, not advice on what to buy or sell.' : 'Pakistan prices are end-of-day, taken from Yahoo Finance. The Pakistan Stock Exchange does not allow its live prices to be shown on other sites without a licence, so this page does not use them. This is for learning, not advice on what to buy or sell.')
  ];

  function render() {
    if (!data) return;
    const d = data;
    out.classList.toggle('pl-still', !first); first = false;
    srcHost.replaceChildren(sourceLine({ source: 'Yahoo Finance public chart data (delayed, unofficial)', asOf: d.asOf, live: d.market === 'us' && live() }));
    out.replaceChildren(intro(d), ...(d.market === 'us' ? usView(d) : pkView(d)), ...notes(d));
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
  main.replaceChildren(head({ eyebrow: 'Live US market · Pakistan at end of day', title: 'What is the market <em>doing today?</em>', lead: 'No finance knowledge needed. See in plain English whether stocks are rising or falling, which parts of the economy are leading, and how investors feel, for the US and for Pakistan.' }),
    h('div', { class: 'd-page' }, h('section', { class: 'd-card' }, picker.el, srcHost), out), status);
  S.add(() => { alive = false; clearTimeout(timer); });
  load();
  return () => S.run();
}
