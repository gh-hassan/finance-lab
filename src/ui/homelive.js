// @ts-nocheck
/* Home page extras: a live "markets right now" strip and a grid of the data pages. Loaded after the home page is shown, so a slow source never slows the page down. */
import '../styles/homelive.css';
import { h, api, scope } from './dataui.js';
import { sparkline } from './visuals.js';
import { ICONS } from './icons.js';
import { homeLive } from '../lib/homelive';

const PAGES = [
  ['market-pulse', 'Market today', 'Are stocks up or down, and why? In plain English.'],
  ['financials', 'Company financials', 'Ten years of any US company\'s real numbers.'],
  ['economy', 'Rates and economy', 'Interest rates, inflation, jobs and the yield curve.'],
  ['currency', 'Currency converter', 'About 165 currencies, with history.'],
  ['crypto', 'Crypto prices', 'Top coins and how risky they have been.'],
  ['countries', 'Countries compared', '104 countries: growth, inflation, debt and more.'],
  ['industries', 'Industry benchmarks', 'What is normal for risk and profit in an industry.'],
  ['factor-returns', 'Factor returns', 'What has beaten the market since 1963.']
];

export function mountHomeLive(host) {
  const S = scope(); let timer = 0, alive = true, shown = false;
  const live = h('span', { class: 'hl-stat' }, h('i'), 'Loading'), strip = h('div', { class: 'hl-tiles' }, Array.from({ length: 8 }, () => h('div', { class: 'hl-sk' }))), sums = h('div', { class: 'hl-sum' });
  const grid = h('div', { class: 'hl-grid' });
  host.replaceChildren(
    h('section', { class: 'hl', 'aria-label': 'The markets right now' }, h('div', { class: 'hl-head' }, h('h2', {}, 'The markets right now'), live), sums, strip, h('div', { class: 'hl-head' }, h('a', { href: '/market-pulse', 'data-link': true }, 'See the full story in plain English →'))),
    h('section', { class: 'hl', 'aria-label': 'Explore the live data' }, h('div', { class: 'hl-head' }, h('h2', {}, 'Explore the live data'), h('span', { class: 'hl-stat' }, 'Real numbers, explained simply')), grid));

  const tile = t => h('a', { class: 'hl-t', href: t.href, 'data-link': true }, h('span', { class: 'l' }, t.label), h('span', { class: 'v' }, t.value), t.change != null ? h('span', { class: 'c ' + (t.tone || '') }, `${t.change >= 0 ? '+' : '−'}${(Math.abs(t.change) * 100).toFixed(t.key === 'pk' ? 1 : 2)}%`) : null,
    t.spark && t.spark.length > 2 ? h('span', { html: sparkline(t.spark.map((y, i) => [i, y]), { w: 140, h: 34, color: t.tone === 'down' ? 'var(--bad)' : 'var(--good)' }) }) : null, h('small', {}, t.sub));
  const summary = s => h('a', { class: 'hl-s', href: s.href, 'data-link': true }, h('span', { class: 'top' }, h('b', {}, s.name), h('span', { class: 'hl-pill ' + s.tone }, s.mood), s.live ? h('span', { class: 'hl-stat on' }, h('i'), 'Live') : null), h('p', {}, s.text.charAt(0).toUpperCase() + s.text.slice(1)));
  const dataCard = (id, title, text, extra) => h('a', { class: 'hl-d', href: '/' + id, 'data-link': true }, h('span', { class: 'ic', html: ICONS['d-' + id] || ICONS.coin }), h('b', {}, title), h('span', {}, text), extra ? h('em', {}, extra) : null);
  const drawGrid = r => grid.replaceChildren(...PAGES.map(([id, t, d]) => { const k = { 'market-pulse': r && r.summaries[0] ? r.summaries[0].mood : '', economy: (r && r.tiles.find(x => x.key === 'dgs10') || {}).value ? '10-year rate ' + r.tiles.find(x => x.key === 'dgs10').value : '', currency: (r && r.tiles.find(x => x.key === 'pkr') || {}).value ? '1 USD = ' + r.tiles.find(x => x.key === 'pkr').value : '', crypto: (r && r.tiles.find(x => x.key === 'btc') || {}).value ? 'Bitcoin ' + r.tiles.find(x => x.key === 'btc').value : '' }[id]; return dataCard(id, t, d, k); }));
  drawGrid(null);

  async function load() {
    S.reset(); clearTimeout(timer);
    const ok = p => p.catch(e => { if (e.name === 'AbortError') throw e; return null; });
    try {
      const [us, pk, fx, macro] = await Promise.all([ok(api('pulse', { market: 'us' }, S.signal)), ok(api('pulse', { market: 'pakistan' }, S.signal)), ok(api('fx', { view: 'rates', base: 'USD' }, S.signal).then(r => ({ rate: r.rates && r.rates.PKR }))), ok(api('macro', { view: 'snapshot' }, S.signal))]);
      if (!alive) return;
      const r = homeLive(us, pk, fx, macro);
      if (!r.tiles.length && !r.summaries.length) { if (!shown) host.firstElementChild.hidden = true; return; }
      shown = true; host.firstElementChild.hidden = false;
      sums.replaceChildren(...r.summaries.map(summary)); strip.replaceChildren(...r.tiles.map(tile)); drawGrid(r);
      live.className = 'hl-stat' + (r.live ? ' on' : ''); live.replaceChildren(h('i'), r.live ? 'Live, US market open' : 'Last close');
      if (r.live) timer = setTimeout(load, 60000);
    } catch (e) { if (e.name !== 'AbortError' && alive && !shown) host.firstElementChild.hidden = true; }
  }
  load();
  return () => { alive = false; clearTimeout(timer); S.run(); };
}
