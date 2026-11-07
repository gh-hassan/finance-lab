// @ts-nocheck
/* Factor returns: the patterns that explain why some stocks beat others, from Prof. Kenneth French's data library. */
import '../styles/factors.css';
import { h, head, api, scope, skeleton, errorBox, explainer } from './dataui.js';
import { buildView } from './factors-view.js';
import { enhanceTerms } from './glossary.js';
import { FACTORS, FACTOR_KEYS, isRange, parseFactorList } from '../lib/factors';

const memo = new Map();
const cv = c => (c.startsWith('var') ? c : `var(--${c})`);

const defs = () => h('div', { class: 'fac-defs' }, FACTORS.map(f => h('div', { class: 'fac-def' }, h('i', { class: 'fac-sw', style: `background:${cv(f.color)}` }), h('div', {}, h('b', {}, f.name), h('span', {}, f.what)))));

/** The state kept in the address bar: ?r=20&f=MKT,HML (leave f out when every factor is shown). */
function readState() {
  const q = new URLSearchParams(location.search), r = q.get('r');
  return { range: isRange(r) ? r : '20', keys: parseFactorList(q.get('f')) };
}
function saveState({ range, keys }) {
  const q = new URLSearchParams({ r: range });
  if (keys.length !== FACTOR_KEYS.length) q.set('f', keys.join(','));
  try { history.replaceState(null, '', '/factor-returns?' + q); } catch (e) { /* ignore */ }
}

export function renderFactors(main) {
  const S = scope(), out = h('div', { class: 'd-page' }), intro = h('section', { class: 'd-card' },
    h('h2', { class: 'd-h' }, 'What is a factor?'),
    h('p', { class: 'd-plain plain', html: 'A <b>factor</b> is a pattern that helps explain why some stocks beat others. Researchers found that, over many decades, groups of stocks that share a trait (they are small, or cheap, or have been rising) have tended to earn different returns from the rest of the market. Each factor below is the <b>difference</b> between two such groups.' }),
    defs());
  let alive = true;

  async function load() {
    S.reset();
    out.replaceChildren(skeleton('Loading factor returns'));
    try {
      const d = memo.get('data') || await api('factors', {}, S.signal);
      memo.set('data', d);
      if (!alive) return;
      out.replaceChildren(buildView(d, readState(), saveState, S)); enhanceTerms(out);
    } catch (e) { if (e.name === 'AbortError') return; out.replaceChildren(errorBox(e.message, load)); }
  }
  main.replaceChildren(
    head({ eyebrow: 'Live data · Fama-French', title: 'Factor <em>returns</em>', lead: 'See which stock market patterns paid off over the last 60 years, and when they did not. Real monthly data from Professor Kenneth French\'s library.' }),
    h('div', { class: 'd-page' }, intro, out,
      explainer('How to read this page', '<ul><li><b>Growth of $1</b> shows what one dollar would have become if it earned each factor\'s return every month.</li><li><b>Return per risk</b> is the average yearly return divided by how much it swings. Higher means a smoother ride for the reward.</li><li><b>Biggest fall</b> is the largest drop from an earlier high. It shows how painful the bad times were.</li></ul>')));
  enhanceTerms(main);
  load();
  return () => { alive = false; S.run(); };
}
