// @ts-nocheck
/* Home page: playful hero, question cards, live tiles, try-it widget and learning map. */
import { MODS } from '../lib/registry';
import { money, nf, range } from '../lib/math';
import { h, esc, sparkline, countUp } from './visuals.js';
import { BEGINNER, TOPICS, keyCard } from './beginner.js';
import { ICONS } from './icons.js';
import { rangeSlider } from './slider.js';

const POPULAR = ['tvm', 'loan', 'bond', 'capbud', 'portfolio', 'options'];
const QUESTIONS = ['tvm', 'loan', 'bond', 'ddm', 'capbud', 'breakeven', 'portfolio', 'options', 'fx', 'merger', 'wacc', 'ratios'];
const PLACEHOLDERS = ['How much will my savings grow?', 'What will my loan really cost?', 'Is this stock worth its price?', 'Should we take this project?'];

function liveData(m) {
  try {
    const v = Object.fromEntries(m.fields.map(f => [f.id, f.v])), o = m.calc({ ...v, ...((BEGINNER[m.id] || {}).force || {}) });
    const ch = (o.charts || []).find(c => c.series && c.series[0] && c.series[0].pts.length > 3);
    const s = ch && (ch.series.find(x => x.type !== 'dots' && x.type !== 'bars') || ch.series[0]);
    return { key: keyCard(o), pts: s ? s.pts : [] };
  } catch (e) { return { key: { label: '', value: '' }, pts: [] }; }
}

const split = (text, start = 0) => text.split(' ').map((w, k) => `<span class="w"><span style="--i:${start + k}">${esc(w)}</span></span>`).join(' ');

export function renderHome(main, go) {
  const groups = Object.keys(TOPICS);
  main.innerHTML = '';
  const hero = h('section', { class: 'hero reveal' },
    h('div', { class: 'hero-copy' },
      h('h1', { class: 'split', html: `${split('Money math,')}<br><em>${split('made playful.', 2)}</em>` }),
      h('button', { class: 'ask', type: 'button', 'data-open-search': true }, h('span', { class: 'ask-icon', html: ICONS.search }), h('span', { class: 'ask-text', id: 'askText' }, PLACEHOLDERS[0]), h('kbd', {}, '/'))),
    h('div', { class: 'hero-art', 'aria-hidden': 'true' },
      h('div', { class: 'float f1' }, h('span', {}, 'Rule of 72'), h('b', { id: 'r72' }, '12 yrs'), h('small', {}, 'to double at 6%')),
      h('div', { class: 'float f2', html: `<span>Your savings</span><b id="heroNum">$0</b>${sparkline(range(0, 20, 1).map(t => [t, 100 * Math.pow(1.07, t)]), { w: 180, h: 60, color: 'var(--c3)' })}` }),
      h('div', { class: 'float f3' }, h('span', {}, 'NPV'), h('b', { class: 'pos' }, '+$32,199')),
      h('div', { class: 'coin c-a' }), h('div', { class: 'coin c-b' }), h('div', { class: 'coin c-c' })));

  const learnBand = h('a', { class: 'learnband tilt reveal', href: '/learn', 'data-link': true },
    h('div', {}, h('p', { class: 'eyebrow' }, 'New to money? Start here'), h('h2', { html: 'Start with the <em>basics</em>' }), h('p', {}, 'Interest, risk, loans, stocks and more, in plain words.')),
    h('span', { class: 'go', html: ICONS.arrow }));
  const scBand = h('a', { class: 'learnband sc tilt reveal', href: '/scenarios', 'data-link': true },
    h('div', {}, h('p', { class: 'eyebrow' }, 'Test your plan'), h('h2', { html: 'Run <em>what-if</em> scenarios' }), h('p', {}, 'Best case, worst case and risk, in one place.')),
    h('span', { class: 'go', html: ICONS.arrow }));
  const bands = h('div', { class: 'bands' }, learnBand, scBand);
  const qCards = QUESTIONS.map(id => MODS.find(m => m.id === id)).filter(Boolean).map(m => {
    const t = TOPICS[m.group];
    return h('a', { class: `qcard tint-${t.tint} tilt`, href: '/' + m.id, 'data-link': true }, h('small', {}, t.label), h('b', {}, (BEGINNER[m.id] || {}).ask || m.title), h('span', { class: 'go', html: ICONS.arrow }));
  });
  const qrow = h('section', { class: 'sec reveal' }, h('div', { class: 'sec-h' }, h('h2', {}, 'Start with a question')), h('div', { class: 'qrow' }, qCards));

  const tiles = POPULAR.map(id => MODS.find(m => m.id === id)).filter(Boolean).map((m, i) => {
    const d = liveData(m), t = TOPICS[m.group], color = ['var(--c1)', 'var(--c2)', 'var(--c3)', 'var(--c4)'][i % 4];
    return h('a', { class: `tile tint-${t.tint} tilt`, href: '/' + m.id, 'data-link': true },
      h('div', { class: 'tile-top' }, h('span', { class: 'ticon', html: ICONS[m.group] || ICONS.coin }), h('div', {}, h('b', {}, m.title), h('small', {}, t.label))),
      h('div', { class: 'tile-val', 'data-count': d.key.value }, d.key.value), h('small', { class: 'tile-lbl' }, d.key.label),
      h('div', { class: 'tile-spark', html: sparkline(d.pts, { w: 220, h: 56, color }) }));
  });
  const popular = h('section', { class: 'sec' }, h('div', { class: 'sec-h' }, h('h2', {}, 'Popular tools'), h('small', {}, 'Live with example numbers')), h('div', { class: 'tiles' }, tiles));

  /* try it live */
  let sav = 200, yrsN = 20;
  const out = h('div', { class: 'try-num' }, '$0'), sub = h('p', { class: 'try-sub' }), spark = h('div', { class: 'try-spark' });
  const calc = () => {
    const r = 0.07 / 12, n = yrsN * 12, fv = sav * ((Math.pow(1 + r, n) - 1) / r), put = sav * n;
    out.textContent = money(fv, 0); sub.innerHTML = `You put in <b>${money(put, 0)}</b>. Growth added <b>${money(fv - put, 0)}</b>.`;
    spark.innerHTML = sparkline(range(0, yrsN, yrsN / 24).map(t => [t, sav * ((Math.pow(1 + r, t * 12) - 1) / r)]), { w: 360, h: 90, color: 'var(--c1)' }).replace('class="sp-line"', 'class="sp-line static"');
  };
  const slider = (label, min, max, step, val, fmt, on) => { const o = h('b', {}, fmt(val)); const rs = rangeSlider({ min, max, step, value: val, label, fmt }), i = rs.input; i.addEventListener('input', () => { on(+i.value); o.textContent = fmt(+i.value); calc(); }); return h('div', { class: 'tslider' }, h('span', {}, label, o), rs.el); };
  const tryIt = h('section', { class: 'card try tint-lav' }, h('div', { class: 'sec-h' }, h('h2', {}, 'Try it live'), h('small', {}, 'Investing monthly at 7% a year')), slider('Save each month', 25, 1000, 25, sav, v => '$' + v, v => (sav = v)), slider('For how long', 5, 40, 1, yrsN, v => v + ' yrs', v => (yrsN = v)), out, sub, spark);
  calc();

  const total = MODS.length;
  const map = h('section', { class: 'card map' }, h('div', { class: 'sec-h' }, h('h2', {}, 'Your learning map'), h('small', {}, `${total} tools`)),
    h('div', { class: 'mapbar' }, groups.map(g => { const n = MODS.filter(m => m.group === g).length; return h('a', { class: `seg tint-${TOPICS[g].tint}`, style: `flex:${n}`, href: '/' + MODS.find(m => m.group === g).id, 'data-link': true, title: TOPICS[g].label }, String(n)); })),
    h('div', { class: 'maplist' }, groups.map(g => h('div', { class: 'mrow' }, h('i', { class: `dot tint-${TOPICS[g].tint}` }), h('div', {}, h('b', {}, TOPICS[g].label), h('small', {}, TOPICS[g].blurb)), h('span', {}, String(MODS.filter(m => m.group === g).length))))));
  const grid2 = h('div', { class: 'cols2 reveal' }, popular, h('div', { class: 'stack' }, tryIt, map));

  const all = h('section', { class: 'sec reveal' }, h('div', { class: 'sec-h' }, h('h2', {}, 'Every tool')),
    groups.map(g => h('div', { class: 'agroup' }, h('h3', { class: `tint-${TOPICS[g].tint}` }, TOPICS[g].label), h('div', { class: 'chips' }, MODS.filter(m => m.group === g).map(m => h('a', { class: `chip2 tint-${TOPICS[g].tint}`, href: '/' + m.id, 'data-link': true }, m.title))))));

  main.append(hero, bands, qrow, grid2, all);

  /* motion */
  main.querySelectorAll('[data-count]').forEach(el => { if (el.dataset.count) countUp(el, el.dataset.count, 900); });
  const hn = main.querySelector('#heroNum'); if (hn) countUp(hn, '$98,420', 1200);
  let k = 0; const ask = main.querySelector('#askText');
  const timer = setInterval(() => { if (!ask.isConnected) { clearInterval(timer); return; } ask.classList.add('swap'); setTimeout(() => { k = (k + 1) % PLACEHOLDERS.length; ask.textContent = PLACEHOLDERS[k]; ask.classList.remove('swap'); }, 220); }, 2600);
}
