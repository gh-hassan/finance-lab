// @ts-nocheck
/* Crypto: top coins, one coin's chart with a risk lens, and a what-if, framed honestly for learners. */
import '../styles/currency.css';
import '../styles/crypto.css';
import { h, head, api, scope, errorBox, sourceLine } from './dataui.js';
import { reduced } from './visuals.js';
import { enhanceTerms } from './glossary.js';
import { memo } from './timedata.js';
import { marketsTable, markRow, coinCard, whatIfCard, explainers, skel } from './crypto-view.js';
import { isDays, validPoints } from '../lib/crypto';
import { parseAmount } from '../lib/currency';

const ID = /^[a-z0-9-]{1,50}$/, MIN = 6e4;

function readUrl() {
  const q = new URLSearchParams(location.search), coin = q.get('coin'), days = Number(q.get('days'));
  return { coin: coin && ID.test(coin) ? coin : 'bitcoin', days: isDays(days) ? days : 30, amount: '1,000' };
}

export function renderCrypto(main) {
  const SM = scope(), SC = scope(), out = h('div', { class: 'd-page' });
  let state = readUrl(), coins = [], chartData = null, table = null, coinEl = null, wif = null, tableHost = null, srcHost = null, status = null, seq = 0;

  const setState = patch => { state = { ...state, ...patch }; };
  const saveUrl = () => { try { history.replaceState(null, '', `/crypto?coin=${encodeURIComponent(state.coin)}&days=${state.days}`); } catch (e) { /* ignore */ } };
  const current = () => coins.find(c => c.id === state.coin) || null;
  const nameOf = () => (current() ? current().name : state.coin.replace(/-/g, ' '));

  function drawWhatIf(loading = false) {
    wif.draw({ pts: chartData && chartData.id === state.coin && chartData.days === state.days ? chartData.points : null, n: parseAmount(state.amount), name: nameOf(), days: state.days, loading });
  }

  async function loadChart() {
    SC.reset(); const mine = ++seq, { coin, days } = state;
    coinEl.title(current(), coin); coinEl.loading(); chartData = null; drawWhatIf(true);
    status.textContent = `Loading ${nameOf()}, ${days} days.`;
    try {
      const d = await memo(`c|${coin}|${days}`, 15 * MIN, () => api('crypto', { view: 'chart', id: coin, days }, SC.signal));
      if (mine !== seq) return;
      chartData = d; coinEl.show(d, nameOf()); drawWhatIf(); status.textContent = `Showing ${nameOf()}, ${days} days.`;
    } catch (e) { if (e.name !== 'AbortError' && mine === seq) { coinEl.error(e.message, loadChart); drawWhatIf(); status.textContent = ''; } }
  }

  function revealCoin() {
    const r = coinEl.el.getBoundingClientRect();
    if (r.top > innerHeight * 0.7 || r.top < 0) coinEl.el.scrollIntoView({ block: 'start', behavior: reduced() ? 'auto' : 'smooth' });
  }
  function pickCoin(id) { if (id === state.coin) { revealCoin(); return; } setState({ coin: id }); saveUrl(); if (table) markRow(tableHost, id); loadChart(); revealCoin(); }
  function setDays(days) { setState({ days }); coinEl.setDays(days); wif.setDays(days); saveUrl(); loadChart(); }

  async function loadMarkets() {
    SM.reset(); tableHost.replaceChildren(skel('Loading the top coins'));
    try {
      const d = await memo('markets', 5 * MIN, () => api('crypto', { view: 'markets' }, SM.signal));
      coins = d.coins || [];
      table = marketsTable(coins, state.coin, pickCoin);
      srcHost.replaceChildren(sourceLine({ source: 'CoinGecko', asOf: d.asOf, url: d.url }));
      tableHost.replaceChildren(...[d.stale ? h('p', { class: 'd-note warn', role: 'status' }, 'The free price source is busy, so these prices are a few minutes old. They will refresh on their own.') : null, table,
        h('p', { class: 'd-cap' }, 'Tap a coin to see its chart. Prices are in US dollars. Changes are shown as plus or minus percent.')].filter(Boolean));
      coinEl.title(current(), state.coin); if (chartData) { coinEl.show(chartData, nameOf()); drawWhatIf(); }
      enhanceTerms(out);
    } catch (e) { if (e.name !== 'AbortError') tableHost.replaceChildren(errorBox(e.message, loadMarkets)); }
  }

  const banner = h('div', { class: 'd-note warn cr-risk', role: 'note' },
    h('b', {}, 'Crypto is risky. '), 'Prices can fall by half or more, and some coins go to zero. Most people should not put money they need into it. This page is for learning, not advice, and nothing here is a recommendation to buy or sell.');
  status = h('p', { class: 'cr-sr', role: 'status', 'aria-live': 'polite' });
  srcHost = h('div'); tableHost = h('div', { class: 'cu-body' });
  coinEl = coinCard({ onDays: setDays, days: state.days });
  wif = whatIfCard({ onDays: setDays, days: state.days, amount: state.amount, onAmount: v => { setState({ amount: v }); drawWhatIf(); } });

  main.replaceChildren(
    head({ eyebrow: 'Live data · CoinGecko', title: 'Crypto <em>markets</em>', lead: 'See the biggest coins, how wildly their prices swing, and what that would have meant for your money. A tool for learning how risk looks, not for picking coins.' }),
    out);
  out.replaceChildren(banner, srcHost, h('section', { class: 'd-card' }, h('h2', { class: 'd-h' }, 'Top 20 by market value'), tableHost), coinEl.el, wif.el, explainers(), status);
  enhanceTerms(out); saveUrl(); loadMarkets(); loadChart();
  return () => { SM.run(); SC.run(); coinEl.destroy(); };
}
