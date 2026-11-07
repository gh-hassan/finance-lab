// @ts-nocheck
/* Countries compared: World Bank indicators for 100+ countries, side by side. Charts are live; the ranking table uses a yearly snapshot. */
import '../styles/countries.css';
import snapshot from '../data/countries-latest.json';
import { h, head, api, scope, skeleton, errorBox, segmented, explainer, debounce } from './dataui.js';
import { buildResults, colorOf } from './countries-view.js';
import { enhanceTerms } from './glossary.js';
import { flag } from './flags.js';
import { COUNTRIES, INDICATORS, MAX_SHOWN, indicatorOf, isIndicator, parseCountryList, countryName } from '../lib/countries';

const memo = new Map();
const INFLATION = 'FP.CPI.TOTL.ZG';
const POPULAR = ['US', 'CN', 'IN', 'PK', 'JP', 'DE', 'GB', 'BR', 'FR', 'CA', 'AU', 'KR', 'TR', 'SA'];
const REGIONS = [...new Set(COUNTRIES.map(c => c.region))];
const norm = s => s.toLowerCase().normalize('NFD').replace(/[^a-z0-9 ]+/g, '');
async function cachedApi(key, params, signal) {
  if (memo.has(key)) return memo.get(key);
  const d = await api('world', params, signal);
  memo.set(key, d);
  return d;
}
/** The ranking comes from the yearly snapshot: same shape the page used to get from the server. */
const rankingFor = id => ({ indicator: { id }, latest: snapshot.latest[id] || {}, source: snapshot.source, asOf: snapshot.asOf });

function readState() {
  const q = new URLSearchParams(location.search), i = q.get('i');
  return { id: isIndicator(i) ? i : INDICATORS[0].id, codes: parseCountryList(q.get('c')) };
}
function saveState({ id, codes }) {
  try { history.replaceState(null, '', '/countries?' + new URLSearchParams({ i: id, c: codes.join(',') })); } catch (e) { /* ignore */ }
}

export function renderCountries(main) {
  const S = scope(), st = readState(), out = h('div', { class: 'd-page' });
  const meaning = h('p', { class: 'd-plain plain' }), msg = h('p', { class: 'd-cap cty-msg', role: 'status', 'aria-live': 'polite' });
  const picked = h('div', { class: 'd-chips cty-picked', role: 'group', 'aria-label': 'Countries being compared' });
  const search = h('input', { class: 'd-in', type: 'search', placeholder: `Search ${COUNTRIES.length} countries, such as Pakistan`, 'aria-label': 'Search countries', autocomplete: 'off', maxlength: 40 });
  const found = h('div', { class: 'd-chips cty-found', role: 'group', 'aria-label': 'Matching countries', hidden: true });
  const popular = h('div', { class: 'd-chips cty-pop', role: 'group', 'aria-label': 'Popular countries' });
  const regions = h('div', { class: 'cty-regions' });
  let seq = 0, alive = true;

  const chip = c => h('button', { type: 'button', class: 'd-chip', 'data-k': c.code, 'aria-pressed': String(st.codes.includes(c.code)), onclick: () => toggle(c.code) }, flag(c.code), c.name);
  const byCode = code => COUNTRIES.find(c => c.code === code);
  const paintSelected = () => picked.replaceChildren(...st.codes.map(code => h('button', { type: 'button', class: 'd-chip cty-on', style: `--lc:${colorOf(st.codes, code)}`, title: 'The bar under the name is this country\'s line colour on the chart', 'aria-label': `Remove ${countryName(code)}`, onclick: () => { toggle(code); search.focus(); } }, flag(code), countryName(code), h('span', { class: 'cty-x', 'aria-hidden': 'true' }, '×'))));
  const markAll = () => main.querySelectorAll('.cty-pick [data-k]').forEach(b => b.setAttribute('aria-pressed', String(st.codes.includes(b.dataset.k))));
  popular.replaceChildren(...POPULAR.map(byCode).filter(Boolean).map(chip));
  regions.replaceChildren(...REGIONS.map(r => {
    const list = COUNTRIES.filter(c => c.region === r);
    return h('details', { class: 'cty-reg' }, h('summary', {}, r, h('em', {}, `${list.length} countries`)), h('div', { class: 'd-chips' }, list.map(chip)));
  }));
  const onSearch = debounce(() => {
    const q = norm(search.value.trim());
    if (!q) { found.hidden = true; found.replaceChildren(); return; }
    const hits = COUNTRIES.filter(c => norm(c.name).includes(q) || c.code.toLowerCase() === q);
    found.hidden = false;
    found.replaceChildren(...(hits.length ? hits.slice(0, 24).map(chip) : [h('p', { class: 'd-empty' }, `No country matches "${search.value.trim()}".`)]));
  }, 120);
  search.addEventListener('input', onSearch); S.add(onSearch.cancel);

  function toggle(code) {
    if (st.codes.includes(code)) { if (st.codes.length === 1) { msg.textContent = 'Keep at least one country selected.'; return; } st.codes = st.codes.filter(c => c !== code); }
    else { if (st.codes.length >= MAX_SHOWN) { msg.textContent = `You can compare up to ${MAX_SHOWN} countries. Remove one first.`; return; } st.codes = [...st.codes, code]; }
    msg.textContent = ''; paintSelected(); markAll(); update();
  }
  const seg = segmented({ options: INDICATORS.map(i => [i.id, i.short]), value: st.id, label: 'Measure', onChange: v => { st.id = v; update(); } });

  async function update() {
    S.reset(); const mine = ++seq, ind = indicatorOf(st.id);
    meaning.innerHTML = `<b>${ind.label}.</b> ${ind.means}`; saveState(st);
    out.replaceChildren(skeleton('Loading country data'));
    const ranking = rankingFor(st.id), inflation = st.codes.length > 1 ? rankingFor(INFLATION) : null;
    try {
      const series = await cachedApi(`s|${st.id}|${st.codes.join(';')}`, { indicator: st.id, countries: st.codes.join(';') }, S.signal);
      if (mine !== seq || !alive) return;
      out.replaceChildren(buildResults({ series, ranking, inflation }, st.codes, ind, S)); enhanceTerms(out);
    } catch (e) {
      if (e.name === 'AbortError' || mine !== seq) return;
      /* the live chart failed, but the ranking table comes from the snapshot and still works */
      out.replaceChildren(h('section', { class: 'd-card' }, h('h2', { class: 'd-h' }, `${ind.label} over time`), errorBox(`${e.message} The ranking below still works.`, update)), buildResults({ series: null, ranking, inflation }, st.codes, ind, S));
    }
  }

  paintSelected();
  main.replaceChildren(
    head({ eyebrow: 'Data · World Bank', title: 'Countries <em>compared</em>', lead: `Growth, inflation, jobs, debt and more for ${COUNTRIES.length} countries, including Pakistan, India, Bangladesh and the big economies. Pick a measure, pick up to ${MAX_SHOWN} countries, and see how they differ.` }),
    h('div', { class: 'd-page' },
      h('section', { class: 'd-card' }, h('h2', { class: 'd-h' }, 'Choose a measure'), seg.el, meaning),
      h('section', { class: 'd-card cty-pick' }, h('h2', { class: 'd-h' }, 'Choose countries'), h('p', { class: 'd-sub' }, `Comparing (up to ${MAX_SHOWN}):`), picked, search, found, h('p', { class: 'd-sub' }, 'Popular'), popular, h('p', { class: 'd-sub' }, 'All countries by region'), regions, msg),
      out,
      explainer('How to read this page', `<ul><li>Each line is one country. Hover or slide across the chart to read each year. The charts are fetched live from the World Bank.</li><li>The table ranks all ${COUNTRIES.length} countries on the latest figure available. <b>Rank 1 is the highest figure, not always the best one</b>: for inflation, unemployment and debt, a high rank is a warning sign.</li><li>The table uses a snapshot of the World Bank figures from ${snapshot.asOf}. Countries can report in different years, so check the Year column.</li><li>Rich countries and poor ones behave very differently, so compare like with like. <b>Inflation</b> and <b>GDP</b> are explained in the glossary.</li></ul>`)));
  enhanceTerms(main);
  update();
  return () => { alive = false; S.run(); };
}
