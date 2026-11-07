// @ts-nocheck
/* Countries compared: World Bank indicators for 26 major economies, side by side. */
import '../styles/countries.css';
import { h, head, api, scope, skeleton, errorBox, segmented, explainer } from './dataui.js';
import { buildResults, colorOf } from './countries-view.js';
import { enhanceTerms } from './glossary.js';
import { COUNTRIES, INDICATORS, MAX_SHOWN, DEFAULT_COUNTRIES, indicatorOf, isIndicator, parseCountryList, countryName } from '../lib/countries';

const memo = new Map();
const INFLATION = 'FP.CPI.TOTL.ZG';
async function cachedApi(key, params, signal) {
  if (memo.has(key)) return memo.get(key);
  const d = await api('world', params, signal);
  memo.set(key, d);
  return d;
}

function readState() {
  const q = new URLSearchParams(location.search), i = q.get('i');
  return { id: isIndicator(i) ? i : INDICATORS[0].id, codes: parseCountryList(q.get('c')) };
}
function saveState({ id, codes }) {
  try { history.replaceState(null, '', '/countries?' + new URLSearchParams({ i: id, c: codes.join(',') })); } catch (e) { /* ignore */ }
}

export function renderCountries(main) {
  const S = scope(), st = readState(), out = h('div', { class: 'd-page' });
  const meaning = h('p', { class: 'd-plain plain' }), msg = h('p', { class: 'd-cap cty-msg', role: 'status', 'aria-live': 'polite' }), chips = h('div', { class: 'd-chips cty-chips', role: 'group', 'aria-label': 'Countries to compare' });
  let seq = 0, alive = true;

  const drawChips = () => { const had = chips.contains(document.activeElement) ? document.activeElement.dataset.k : null; paintChips(); if (had) { const b = chips.querySelector(`[data-k="${had}"]`); if (b) b.focus(); } };
  const paintChips = () => chips.replaceChildren(...COUNTRIES.map(c => {
    const on = st.codes.includes(c.code);
    return h('button', { type: 'button', class: 'd-chip', 'data-k': c.code, 'aria-pressed': String(on), onclick: () => toggle(c.code) }, on ? h('i', { class: 'cty-sw', style: `background:${colorOf(st.codes, c.code)}` }) : null, c.name);
  }));
  function toggle(code) {
    if (st.codes.includes(code)) { if (st.codes.length === 1) { msg.textContent = 'Keep at least one country selected.'; return; } st.codes = st.codes.filter(c => c !== code); }
    else { if (st.codes.length >= MAX_SHOWN) { msg.textContent = `You can compare up to ${MAX_SHOWN} countries. Remove one first.`; return; } st.codes = [...st.codes, code]; }
    msg.textContent = ''; drawChips(); update();
  }
  const seg = segmented({ options: INDICATORS.map(i => [i.id, i.short]), value: st.id, label: 'Measure', onChange: v => { st.id = v; update(); } });

  async function update() {
    S.reset(); const mine = ++seq, ind = indicatorOf(st.id);
    meaning.innerHTML = `<b>${ind.label}.</b> ${ind.means}`; saveState(st);
    out.replaceChildren(skeleton('Loading country data'));
    try {
      const [series, ranking, inflation] = await Promise.all([
        cachedApi(`s|${st.id}|${st.codes.join(';')}`, { indicator: st.id, countries: st.codes.join(';') }, S.signal),
        cachedApi(`r|${st.id}`, { indicator: st.id, view: 'ranking' }, S.signal),
        st.codes.length > 1 ? cachedApi(`r|${INFLATION}`, { indicator: INFLATION, view: 'ranking' }, S.signal).catch(e => { if (e.name === 'AbortError') throw e; return null; }) : null
      ]);
      if (mine !== seq || !alive) return;
      out.replaceChildren(buildResults({ series, ranking, inflation }, st.codes, ind, S)); enhanceTerms(out);
    } catch (e) { if (e.name === 'AbortError' || mine !== seq) return; out.replaceChildren(errorBox(e.message, update)); }
  }

  drawChips();
  main.replaceChildren(
    head({ eyebrow: 'Live data · World Bank', title: 'Countries <em>compared</em>', lead: 'Growth, inflation, jobs, debt and more for 26 major economies. Pick a measure, pick up to six countries, and see how they differ.' }),
    h('div', { class: 'd-page' },
      h('section', { class: 'd-card' }, h('h2', { class: 'd-h' }, 'Choose a measure'), seg.el, meaning, h('h2', { class: 'd-h' }, 'Choose countries'), chips, msg),
      out,
      explainer('How to read this page', '<ul><li>Each line is one country. Hover or slide across the chart to read each year.</li><li>The table ranks all 26 countries on the latest figure available. Rich countries and poor ones behave very differently, so compare like with like.</li><li>Figures are yearly and arrive with a delay, so the newest year may be a year or two old. <b>Inflation</b> and <b>GDP</b> are explained in the glossary.</li></ul>')));
  enhanceTerms(main);
  update();
  return () => { alive = false; S.run(); };
}
