// @ts-nocheck
/* "Look up a stock": fetch a real price, beta and dividend and drop them into a calculator's inputs. */
import { h } from './visuals.js';

const r = (x, d) => (Number.isFinite(x) ? +x.toFixed(d) : null);
/** Which inputs each calculator can fill from a quote. */
export const LIVE = {
  capm: [{ label: 'Use in this calculator', map: q => ({ beta: r(q.beta, 2), sd: r(q.vol * 100, 1), er: r(q.avgReturn * 100, 1) }) }],
  wacc: [{ label: 'Use the beta', map: q => ({ beta: r(q.beta, 2) }) }],
  ddm: [{ label: 'Use dividend and price', map: q => ({ d0: r(q.dividend, 2), mkt: r(q.price, 2) }) }],
  portfolio: [{ label: 'Use as Asset A', map: q => ({ muA: r(q.avgReturn * 100, 1), sdA: r(q.vol * 100, 1) }) }, { label: 'Use as Asset B', map: q => ({ muB: r(q.avgReturn * 100, 1), sdB: r(q.vol * 100, 1) }) }]
};

export async function fetchQuote(symbol) {
  let res;
  try { res = await fetch('/api/quote?symbol=' + encodeURIComponent(symbol)); } catch (e) { throw new Error('Could not reach the data service. Check your connection.'); }
  const type = res.headers.get('content-type') || '';
  if (!type.includes('json')) throw new Error('Live data is only available on the published site.');
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || 'Could not load market data.');
  return body;
}

/** The card shown above a calculator's inputs. `apply(values)` receives { fieldId: value } and returns how many inputs it filled. */
export function liveCard(id, apply) {
  const actions = LIVE[id]; if (!actions) return null;
  const input = h('input', { type: 'text', class: 'lv-in', placeholder: 'Ticker, for example AAPL', 'aria-label': 'Ticker symbol', maxlength: 12, autocomplete: 'off', spellcheck: 'false' });
  const go = h('button', { type: 'button', class: 'btn small' }, 'Look up');
  const status = h('p', { class: 'lv-st', role: 'status' }), out = h('div', { class: 'lv-out', hidden: true });
  let q = null, busy = false;
  const show = data => {
    q = data; out.hidden = false; out.innerHTML = '';
    const pct = x => (x * 100).toFixed(1) + '%';
    out.append(h('p', { class: 'lv-name' }, `${data.name} (${data.symbol})`),
      h('dl', { class: 'lv-grid' }, ...[['Price', `${data.currency === 'USD' ? '$' : ''}${data.price.toFixed(2)}`], ['Beta', data.beta == null ? 'n/a' : data.beta.toFixed(2)], ['Dividend, last year', `$${data.dividend.toFixed(2)} (${pct(data.dividendYield)})`], ['Risk (5 yr)', pct(data.vol)], ['Average return (5 yr)', pct(data.avgReturn)]].flatMap(([k, v]) => [h('dt', {}, k), h('dd', {}, v)])),
      h('div', { class: 'lv-act' }, actions.map(a => h('button', { type: 'button', class: 'btn small', onclick: () => { const n = apply(a.map(q)); status.textContent = n ? `Filled ${n} input${n > 1 ? 's' : ''}. Past data, not a forecast.` : 'This view has no matching inputs. Switch to Pro mode to see them.'; } }, a.label))),
      h('p', { class: 'lv-note' }, `Beta and risk come from ${data.months} months of returns against the S&P 500. History is not a forecast. ${data.source}.`));
  };
  const run = async () => {
    const s = input.value.trim().toUpperCase(); if (!s || busy) return;
    busy = true; go.disabled = true; status.textContent = 'Looking up ' + s + '…'; out.hidden = true;
    try { show(await fetchQuote(s)); status.textContent = ''; } catch (e) { status.textContent = e.message; } finally { busy = false; go.disabled = false; }
  };
  go.addEventListener('click', run); input.addEventListener('keydown', e => { if (e.key === 'Enter') run(); });
  return h('div', { class: 'live' }, h('p', { class: 'lv-t' }, 'Use a real stock'), h('div', { class: 'lv-row' }, input, go), status, out);
}
