// @ts-nocheck
/* Company financials: type a US-listed company, see ten years of its real numbers from SEC filings. */
import '../styles/financials.css';
import { h, head, api, scope, skeleton, errorBox, debounce, explainer } from './dataui.js';
import { renderResult } from './financials-view.js';
import { enhanceTerms } from './glossary.js';

const EXAMPLES = [['Apple', 'AAPL'], ['Microsoft', 'MSFT'], ['Walmart', 'WMT'], ['Ford', 'F'], ['Tesla', 'TSLA'], ['JPMorgan', 'JPM']];
const TICKER = /^[A-Za-z][A-Za-z0-9.\-]{0,9}$/;
/** The search service accepts letters, digits, spaces and . , & ' - only, so anything else is turned into a space first. */
const clean = t => t.replace(/[^\w .,&'\-]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 40);

export function renderFinancials(main) {
  const S = scope(), out = h('div', { class: 'd-page' }), status = h('p', { class: 'd-vh', role: 'status', 'aria-live': 'polite' });
  const input = h('input', { class: 'd-in', type: 'search', placeholder: 'Company name or ticker, such as Apple or AAPL', 'aria-label': 'Company name or ticker', autocomplete: 'off', spellcheck: 'false', maxlength: 40, role: 'combobox', 'aria-expanded': 'false', 'aria-autocomplete': 'list', 'aria-controls': 'fin-sug' });
  const sug = h('ul', { class: 'd-sug', id: 'fin-sug', role: 'listbox', 'aria-label': 'Matching companies', hidden: true }), go = h('button', { type: 'submit', class: 'd-go' }, 'Show financials');
  const chips = h('div', { class: 'd-chips', role: 'group', 'aria-label': 'Examples' }, h('span', { class: 'fin-chips-l' }, 'Try:'), ...EXAMPLES.map(([n, t]) => h('button', { type: 'button', class: 'd-chip', 'data-t': t, onclick: () => pick(t) }, n)));
  let sel = -1, list = [], seq = 0, current = '', findCtl = null, alive = true, cleanups = [];

  const markChips = t => chips.querySelectorAll('.d-chip').forEach(c => (c.dataset.t === t ? c.setAttribute('aria-current', 'true') : c.removeAttribute('aria-current')));
  const hide = () => { sug.hidden = true; input.setAttribute('aria-expanded', 'false'); input.removeAttribute('aria-activedescendant'); sel = -1; };
  const drawSug = () => {
    sug.replaceChildren(...list.map((c, i) => h('li', { role: 'option', id: 'fin-s' + i, 'aria-selected': String(i === sel), onmousedown: e => { e.preventDefault(); pick(c.ticker); } }, h('b', {}, c.ticker), h('span', {}, c.name))));
    sug.hidden = !list.length; input.setAttribute('aria-expanded', String(!!list.length));
    if (sel >= 0) input.setAttribute('aria-activedescendant', 'fin-s' + sel); else input.removeAttribute('aria-activedescendant');
  };
  const find = debounce(async () => {
    const text = clean(input.value); if (!text) { list = []; hide(); return; }
    if (findCtl) findCtl.abort(); findCtl = new AbortController(); const mine = ++seq;
    try { const r = await api('edgar', { find: text }, findCtl.signal); if (alive && mine === seq) { list = r.results || []; sel = -1; drawSug(); } } catch (e) { if (e.name !== 'AbortError') { list = []; hide(); } }
  }, 180);
  S.add(find.cancel); S.add(() => { alive = false; if (findCtl) findCtl.abort(); cleanups.splice(0).forEach(f => f()); });

  async function load(ticker) {
    S.reset(); cleanups.splice(0).forEach(f => f());
    current = ticker; markChips(ticker); hide(); input.value = ticker; go.disabled = true; status.textContent = `Loading ${ticker}.`;
    out.replaceChildren(skeleton('Loading company financials'));
    history.replaceState(null, '', '/financials?t=' + encodeURIComponent(ticker));
    try {
      const d = await api('edgar', { ticker }, S.signal);
      if (!alive || current !== ticker) return;
      out.replaceChildren(renderResult(d, { add: f => cleanups.push(f) })); enhanceTerms(out); status.textContent = `Showing ${d.name}.`;
    } catch (e) { if (e.name === 'AbortError' || !alive) return; out.replaceChildren(errorBox(e.message, () => load(ticker))); status.textContent = e.message; }
    finally { if (alive && current === ticker) go.disabled = false; }
  }
  function pick(ticker) { find.cancel(); seq++; load(ticker); }
  async function submit() {
    const text = clean(input.value); if (!text) { input.focus(); return; }
    if (sel >= 0 && list[sel]) return pick(list[sel].ticker);
    find.cancel(); go.disabled = true; const mine = ++seq;
    try {
      const r = await api('edgar', { find: text }, S.signal); if (!alive || mine !== seq) return;
      const hit = (r.results || [])[0];
      if (hit) pick(hit.ticker); else { out.replaceChildren(errorBox(`No US-listed company matches "${text}". Try the ticker symbol, such as AAPL.`)); go.disabled = false; }
    } catch (e) { if (e.name === 'AbortError' || !alive) return; out.replaceChildren(errorBox(e.message, submit)); go.disabled = false; }
  }
  input.addEventListener('input', find);
  input.addEventListener('blur', () => setTimeout(hide, 120));
  input.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown' && list.length) { e.preventDefault(); sel = (sel + 1) % list.length; drawSug(); }
    else if (e.key === 'ArrowUp' && list.length) { e.preventDefault(); sel = (sel - 1 + list.length) % list.length; drawSug(); }
    else if (e.key === 'Escape') hide();
  });

  const form = h('form', { onsubmit: e => { e.preventDefault(); submit(); }, role: 'search' }, input, go);
  main.replaceChildren(
    head({ eyebrow: 'Live data · SEC filings', title: 'Company <em>financials</em>', lead: 'Pick any US-listed company and see ten years of its real numbers, explained in plain words. Straight from the filings every company must make.' }),
    h('div', { class: 'd-page' },
      h('section', { class: 'd-card' }, h('div', { class: 'd-search' }, form, sug), chips),
      out, status,
      explainer('How to read this page', '<ul><li><b>Sales</b> is what customers paid. <b>Net income</b> is what the company kept after all costs.</li><li><b>Free cash flow</b> is real cash left after the business pays to keep itself running.</li><li><b>Return on equity</b> shows how well the owners\' money is working. The DuPont panel shows why it moved.</li><li>Use the buttons at the bottom to send the latest numbers into the DCF or comps calculator.</li></ul>')));
  const t = new URLSearchParams(location.search).get('t');
  load(t && TICKER.test(t) ? t.toUpperCase() : 'AAPL');
  return () => { S.run(); };
}
