// @ts-nocheck
/* Home page extras: a live "markets right now" strip and a grid of the data pages. Loaded after the home page is shown, so a slow source never slows the page down. */
import '../styles/homelive.css';
import { h, api, scope } from './dataui.js';
import { sparkline } from './visuals.js';
import { ICONS } from './icons.js';
import { homeLive } from '../lib/homelive';
import { pkToday, tapeItems } from '../lib/homeplus';
import { sectorsByChange, heat } from '../lib/pulse';
import { signedPct, num, longDate } from '../lib/format';
import { VIDEOS } from '../data/videos.js';
import { thumbUrl } from './videos.js';

const SECTOR_INFO = { Technology: 'Apple, Microsoft, chips', Financials: 'Banks, Visa, insurers', Energy: 'Oil and gas', 'Health care': 'Medicine, hospitals', 'Consumer discretionary': 'Amazon, Tesla, shops', 'Consumer staples': 'Food, soap, drinks', Industrials: 'Planes, machines, trucks', Utilities: 'Electricity and water', Materials: 'Chemicals, metals', 'Real estate': 'Owners of buildings', Communication: 'Google, Meta, phone firms' };
const VID = /^[A-Za-z0-9_-]{11}$/;
const dir = c => (c > 0.0001 ? 'up' : c < -0.0001 ? 'down' : '');

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

export function mountHomeLive(host, { tape, hero } = {}) {
  const S = scope(); let timer = 0, alive = true, shown = false;
  const live = h('span', { class: 'hl-stat' }, h('i'), 'Loading'), strip = h('div', { class: 'hl-tiles' }, Array.from({ length: 8 }, () => h('div', { class: 'hl-sk' }))), sums = h('div', { class: 'hl-sum' });
  const grid = h('div', { class: 'hl-grid' }), heatBox = h('div', { class: 'hl-heat' }), heatSec = h('section', { class: 'hl', hidden: true, 'aria-label': 'Which parts of the economy are doing well' }, h('div', { class: 'hl-head' }, h('h2', {}, 'Which parts of the economy are doing well?'), h('a', { href: '/market-pulse', 'data-link': true }, 'What this means →')), heatBox);
  const pkBox = h('div', {}), vidBox = h('div', {}), duo = h('section', { class: 'hl hl-duo', 'aria-label': 'Pakistan today and our latest video' }, pkBox, vidBox);
  let video = (VIDEOS || []).find(v => VID.test(v.id)) || null;
  host.replaceChildren(
    h('section', { class: 'hl', 'aria-label': 'The markets right now' }, h('div', { class: 'hl-head' }, h('h2', {}, 'The markets right now'), live), sums, strip, h('div', { class: 'hl-head' }, h('a', { href: '/market-pulse', 'data-link': true }, 'See the full story in plain English →'))),
    heatSec, duo,
    h('section', { class: 'hl', 'aria-label': 'Explore the live data' }, h('div', { class: 'hl-head' }, h('h2', {}, 'Explore the live data'), h('span', { class: 'hl-stat' }, 'Real numbers, explained simply')), grid));

  const tile = t => h('a', { class: 'hl-t', href: t.href, 'data-link': true }, h('span', { class: 'l' }, t.label), h('span', { class: 'v' }, t.value), t.change != null ? h('span', { class: 'c ' + (t.tone || '') }, `${t.change >= 0 ? '+' : '−'}${(Math.abs(t.change) * 100).toFixed(t.key === 'pk' ? 1 : 2)}%`) : null,
    t.spark && t.spark.length > 2 ? h('span', { html: sparkline(t.spark.map((y, i) => [i, y]), { w: 140, h: 34, color: t.tone === 'down' ? 'var(--bad)' : 'var(--good)' }) }) : null, h('small', {}, t.sub));
  const summary = s => h('a', { class: 'hl-s', href: s.href, 'data-link': true }, h('span', { class: 'top' }, h('b', {}, s.name), h('span', { class: 'hl-pill ' + s.tone }, s.mood), s.live ? h('span', { class: 'hl-stat on' }, h('i'), 'Live') : null), h('p', {}, s.text.charAt(0).toUpperCase() + s.text.slice(1)));
  const dataCard = (id, title, text, extra) => h('a', { class: 'hl-d', href: '/' + id, 'data-link': true }, h('span', { class: 'ic', html: ICONS['d-' + id] || ICONS.coin }), h('b', {}, title), h('span', {}, text), extra ? h('em', {}, extra) : null);
  const drawGrid = r => grid.replaceChildren(...PAGES.map(([id, t, d]) => { const k = { 'market-pulse': r && r.summaries[0] ? r.summaries[0].mood : '', economy: (r && r.tiles.find(x => x.key === 'dgs10') || {}).value ? '10-year rate ' + r.tiles.find(x => x.key === 'dgs10').value : '', currency: (r && r.tiles.find(x => x.key === 'pkr') || {}).value ? '1 USD = ' + r.tiles.find(x => x.key === 'pkr').value : '', crypto: (r && r.tiles.find(x => x.key === 'btc') || {}).value ? 'Bitcoin ' + r.tiles.find(x => x.key === 'btc').value : '' }[id]; return dataCard(id, t, d, k); }));
  drawGrid(null);

  const heatTile = t => h('a', { class: 'hl-ht ' + dir(t.chg), href: '/market-pulse', 'data-link': true, style: `--s:${heat(t.chg, 0.02)}` }, h('b', {}, t.name), h('span', {}, signedPct(t.chg, 2)), h('small', {}, SECTOR_INFO[t.name] || ''));
  const drawHeat = us => { const sec = us ? sectorsByChange(us.items) : []; heatSec.hidden = sec.length < 4; if (!heatSec.hidden) heatBox.replaceChildren(...sec.map(heatTile)); };
  const drawPk = (pk, rate, change) => {
    const p = pkToday(pk && pk.items, rate ? { rate, change } : null);
    if (!p) { pkBox.replaceChildren(); return; }
    const row = (label, x) => x ? h('div', { class: 'hl-r' }, h('span', {}, label), h('div', { class: 'hl-rv' }, h('b', {}, x.name), h('em', { class: dir(x.chg) }, signedPct(x.chg, 1)))) : null;
    pkBox.replaceChildren(h('a', { class: 'hl-c', href: '/market-pulse?m=pakistan', 'data-link': true }, h('span', { class: 'hl-k' }, 'Pakistan today'), p.rate ? h('div', { class: 'hl-r hl-big' }, h('span', {}, 'One US dollar costs'), h('b', {}, 'Rs ' + num(p.rate, 1))) : null,
      row('Best stock at the last close', p.best), row('Weakest stock', p.worst), p.avg != null ? h('div', { class: 'hl-r' }, h('span', {}, 'Stocks that rose'), h('b', {}, `${p.up} of ${p.up + p.down}`)) : null, h('p', {}, p.sentence), h('small', {}, 'Pakistan prices are end of day, not live.')));
  };
  const drawVid = () => {
    if (!video) { vidBox.replaceChildren(); return; }
    vidBox.replaceChildren(h('a', { class: 'hl-c hl-v', href: '/videos', 'data-link': true }, h('span', { class: 'hl-k' }, 'New on SmartWealth'),
      h('span', { class: 'hl-th' }, h('img', { src: thumbUrl(video.id), alt: '', loading: 'lazy', width: 480, height: 360 })),
      h('b', {}, video.title.includes(':') ? video.title.slice(video.title.indexOf(':') + 1).trim() : video.title), video.published ? h('small', {}, longDate(String(video.published).slice(0, 10))) : null));
  };
  drawVid();
  fetch('/api/videos').then(r => ((r.headers.get('content-type') || '').includes('json') ? r.json() : null)).then(d => { const v = d && Array.isArray(d.videos) ? d.videos.find(x => VID.test(x.id) && x.title) : null; if (v && alive) { video = v; drawVid(); } }).catch(() => { });

  const drawTape = (us, avg, rate) => {
    if (!tape) return; const items = tapeItems(us, avg, rate); tape.hidden = items.length < 3; if (tape.hidden) return;
    const one = (k) => h('div', { class: 'hl-tp', 'aria-hidden': k ? 'true' : null }, items.map(i => h('a', { href: i.href, 'data-link': true, tabindex: k ? '-1' : null }, h('span', {}, i.label), h('b', {}, i.value), i.change != null && i.label !== 'Gold' && i.label !== 'Pakistan stocks' ? h('em', { class: dir(i.change) }, signedPct(i.change, 2)) : i.label === 'Gold' || i.label === 'Pakistan stocks' ? h('em', { class: dir(i.change) }, i.change > 0 ? '▲' : i.change < 0 ? '▼' : '–') : null)));
    tape.replaceChildren(h('div', { class: 'hl-tpi', role: 'region', 'aria-label': 'Market ticker' }, one(0), one(1)));
  };
  const drawHero = r => {
    if (!hero) return; const sp = r.tiles.find(t => t.key === '^GSPC'), pr = r.tiles.find(t => t.key === 'pkr'), a = hero.querySelector('#heroSpx'), b = hero.querySelector('#heroPkr');
    if (sp && a) { a.hidden = false; const n = hero.querySelector('#heroNpv'); if (n) n.hidden = true; a.querySelector('b').textContent = sp.value; const c = a.querySelector('small'); c.textContent = (sp.change >= 0 ? '+' : '−') + (Math.abs(sp.change) * 100).toFixed(2) + '% ' + (r.live ? 'today' : 'at last close'); c.className = dir(sp.change); }
    if (pr && b) { b.hidden = false; const r = hero.querySelector('#heroR72'); if (r) r.hidden = true; b.querySelector('b').textContent = pr.value; }
  };

  async function load() {
    S.reset(); clearTimeout(timer);
    const ok = p => p.catch(e => { if (e.name === 'AbortError') throw e; return null; });
    try {
      const [us, pk, fx, macro, hist] = await Promise.all([ok(api('pulse', { market: 'us' }, S.signal)), ok(api('pulse', { market: 'pakistan' }, S.signal)), ok(api('fx', { view: 'rates', base: 'USD' }, S.signal).then(r => ({ rate: r.rates && r.rates.PKR }))), ok(api('macro', { view: 'snapshot' }, S.signal)), ok(api('fx', { view: 'history', base: 'USD', quote: 'PKR', range: '1m' }, S.signal).then(r => ({ rate: r.last, change: r.change })))]);
      if (!alive) return;
      const r = homeLive(us, pk, fx, macro);
      const rate = (fx && fx.rate) || (hist && hist.rate) || null, avgPk = (r.tiles.find(t => t.key === 'pk') || {}).change;
      drawHeat(us); drawPk(pk, rate, hist && hist.change); drawTape(us, avgPk, rate); drawHero(r);
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
