// @ts-nocheck
/* Currency: a converter with daily market rates for about 165 currencies, a rate history chart and the major currencies, all explained for beginners. */
import '../styles/currency.css';
import { h, esc, head, api, scope, skeleton, errorBox, sourceLine } from './dataui.js';
import { enhanceTerms } from './glossary.js';
import { memo } from './timedata.js';
import { historyCard, majorsCard, mathCard, explainers } from './currency-view.js';
import { parseAmount, crossRate, invertRate, fmtRate, fmtAmount, TOP, isRange } from '../lib/currency';
import { longDate } from '../lib/format';

const CODE = /^[A-Z]{3}$/, HOUR = 36e5;
const MAX_TEXT = 'That is bigger than we can show. Try a smaller amount.';

function readUrl() {
  const q = new URLSearchParams(location.search), up = k => String(q.get(k) || '').toUpperCase();
  return { from: CODE.test(up('from')) ? up('from') : 'USD', to: CODE.test(up('to')) ? up('to') : 'EUR', range: isRange(q.get('range')) ? q.get('range') : '1y', amount: '1,000' };
}

const option = (c, names, sel) => h('option', { value: c, selected: c === sel }, `${c} · ${names[c]}`);
function currencySelect(id, label, codes, names, value, onChange) {
  const rest = codes.filter(c => !TOP.includes(c)).sort(), top = TOP.filter(c => codes.includes(c));
  const el = h('select', { class: 'd-in cu-sel', id, 'aria-label': label, onchange: e => onChange(e.target.value) },
    h('optgroup', { label: 'Popular' }, top.map(c => option(c, names, value))), h('optgroup', { label: 'All currencies' }, rest.map(c => option(c, names, value))));
  return el;
}

export function renderCurrency(main) {
  const S = scope(), SH = scope(), SM = scope(), out = h('div', { class: 'd-page' });
  let state = readUrl(), data = null, hist = null, majors = null, mathHost = null, result = null, amountEl = null, fromEl = null, toEl = null, histSeq = 0, majSeq = 0;

  const rateNow = () => crossRate(data.rates, state.from, state.to);
  const setState = patch => { state = { ...state, ...patch }; };
  const saveUrl = () => { try { history.replaceState(null, '', `/currency?from=${state.from}&to=${state.to}&range=${state.range}`); } catch (e) { /* ignore */ } };

  function drawResult() {
    const text = amountEl.value.trim(), n = parseAmount(text), r = rateNow();
    const line = (a, b, x) => `<span>1 ${esc(a)} = <b>${esc(fmtRate(x))}</b> ${esc(b)}</span>`;
    if (!text) { result.innerHTML = '<p class="cu-hint">Type an amount to convert.</p>'; return; }
    if (n == null) { result.innerHTML = `<p class="cu-hint warn">${/\d/.test(text) && /^[\d\s.,'−$€£¥₹()+-]+$/.test(text) ? MAX_TEXT : 'That does not look like a number. Try 1,000.50 or 1.000,50.'}</p>`; return; }
    if (r == null) { result.innerHTML = '<p class="cu-hint warn">No rate is available for that pair.</p>'; return; }
    result.innerHTML = `<p class="cu-eq">${esc(fmtAmount(n))} ${esc(state.from)} equals</p><p class="cu-big">${esc(fmtAmount(n * r))} <span>${esc(state.to)}</span></p><p class="cu-rates">${line(state.from, state.to, r)}${line(state.to, state.from, invertRate(r))}</p>`;
  }

  function drawMath() { mathHost.replaceChildren(mathCard(state.from, state.to, rateNow())); }

  async function loadHistory() {
    SH.reset(); const mine = ++histSeq, { from, to, range } = state;
    hist.loading(from, to);
    try {
      const d = await memo(`h|${from}|${to}|${range}`, 6 * HOUR, () => api('fx', { view: 'history', base: from, quote: to, range }, SH.signal));
      if (mine === histSeq) hist.show(d);
    } catch (e) { if (e.name !== 'AbortError' && mine === histSeq) hist.error(e.message, loadHistory); }
  }

  async function loadMajors() {
    SM.reset(); const mine = ++majSeq, base = state.from;
    majors.loading(base);
    try {
      const d = await memo(`m|${base}`, HOUR, () => api('fx', { view: 'moves', base }, SM.signal));
      if (mine === majSeq) majors.show(d, data.names);
    } catch (e) { if (e.name !== 'AbortError' && mine === majSeq) majors.error(e.message, loadMajors); }
  }

  function choose(patch) {
    const next = { ...state, ...patch };
    if (next.from === next.to) { if (patch.from) next.to = state.from; else next.from = state.to; }
    const fromChanged = next.from !== state.from;
    setState(next); fromEl.value = state.from; toEl.value = state.to;
    saveUrl(); drawResult(); drawMath(); loadHistory(); if (fromChanged) loadMajors();
  }

  function onRange(range) { setState({ range }); saveUrl(); loadHistory(); }

  function build() {
    const codes = Object.keys(data.names).filter(c => data.rates[c] != null);
    if (!codes.includes(state.from)) setState({ from: 'USD' });
    if (!codes.includes(state.to) || state.to === state.from) setState({ to: state.from === 'EUR' ? 'USD' : 'EUR' });
    amountEl = h('input', { class: 'd-in cu-amt', id: 'cu-amount', type: 'text', inputmode: 'decimal', autocomplete: 'off', spellcheck: 'false', maxlength: 24, value: state.amount, 'aria-describedby': 'cu-result', oninput: () => { setState({ amount: amountEl.value }); drawResult(); } });
    fromEl = currencySelect('cu-from', 'From currency', codes, data.names, state.from, v => choose({ from: v }));
    toEl = currencySelect('cu-to', 'To currency', codes, data.names, state.to, v => choose({ to: v }));
    result = h('div', { class: 'cu-result', id: 'cu-result', 'aria-live': 'polite' });
    const swap = h('button', { type: 'button', class: 'cu-swap d-btn', 'aria-label': 'Swap the two currencies', onclick: () => choose({ from: state.to, to: state.from }) }, h('span', { 'aria-hidden': 'true' }, '⇅'));
    const field = (id, label, el) => h('div', { class: 'cu-f' }, h('label', { for: id }, label), el);
    hist = historyCard({ onRange, range: state.range }); majors = majorsCard(); mathHost = h('div');
    out.replaceChildren(
      sourceLine({ source: 'open.er-api.com daily rates', asOf: data.asOf, url: data.url, extra: h('span', {}, `Rates dated ${longDate(data.date)}.`) }),
      h('section', { class: 'd-card' }, h('h2', { class: 'd-h' }, 'Convert'),
        h('div', { class: 'cu-grid' }, field('cu-amount', 'Amount', amountEl), field('cu-from', 'From', fromEl), swap, field('cu-to', 'To', toEl)), result),
      hist.el, majors.el, mathHost, explainers());
    enhanceTerms(out); drawResult(); drawMath(); saveUrl(); loadHistory(); loadMajors();
  }

  async function boot() {
    out.replaceChildren(skeleton('Loading exchange rates'));
    try { data = await memo('rates|USD', HOUR, () => api('fx', { view: 'rates', base: 'USD' }, S.signal)); build(); }
    catch (e) { if (e.name !== 'AbortError') out.replaceChildren(errorBox(e.message, boot)); }
  }

  main.replaceChildren(
    head({ eyebrow: 'Live data · about 165 currencies', title: 'Currency <em>converter</em>', lead: 'Convert between about 165 currencies, including the Pakistani rupee, the Indian rupee and the Bangladeshi taka. See how a rate has moved, and learn why the number at the bank is never quite the same.' }), out);
  boot();
  return () => { S.run(); SH.run(); SM.run(); if (hist) hist.destroy(); };
}
