// @ts-nocheck
/* Home page: hero, question cards, live tiles, try-it widget and learning map. */
import { MODS } from '../lib/registry';
import { money, nf, range } from '../lib/math';
import { h, esc, sparkline, countUp } from './visuals.js';
import { BEGINNER, TOPICS, keyCard } from './beginner.js';
import { ICONS } from './icons.js';
import { rangeSlider } from './slider.js';
import '../styles/homeintro.css';

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

/** What $190 saved every month grows to after `years` at 7% a year (the hero card's example). */
const heroFv = years => { const r = 0.07 / 12, n = years * 12; return n ? 190 * ((Math.pow(1 + r, n) - 1) / r) : 0; };
const split = (text, start = 0) => text.split(' ').map((w, k) => `<span class="w"><span style="--i:${start + k}">${esc(w)}</span></span>`).join(' ');

export function renderHome(main, go) {
  main.innerHTML = '';
  const hero = h('section', { class: 'hero solo reveal' },
    h('div', { class: 'hero-copy' },
      h('p', { class: 'eyebrow' }, 'Suleman Dawood School of Business'),
      h('h1', { class: 'split', html: `${split('Finance,')}<br><em>${split('made clear.', 1)}</em>` }),
      h('button', { class: 'ask', type: 'button', 'data-open-search': true }, h('span', { class: 'ask-icon', html: ICONS.search }), h('span', { class: 'ask-text', id: 'askText' }, PLACEHOLDERS[0]), h('kbd', {}, '/'))));

  const step = (n, title, text) => h('li', { class: 'hi-step' }, h('span', { class: 'hi-n' }, String(n)), h('b', {}, title), h('p', {}, text));
  const intro = h('section', { class: 'hi reveal', 'aria-labelledby': 'hiTitle' },
    h('h2', { id: 'hiTitle' }, 'Learn finance by doing it'),
    h('p', { class: 'hi-lead' }, 'Finance is far easier to understand when you can touch it. Every topic here is something you can play with: change a number and watch the result move.'),
    h('ol', { class: 'hi-steps' },
      step(1, 'Ask a real question', 'Start from something you actually wonder about, such as how much your savings will grow or what a loan really costs.'),
      step(2, 'Move the numbers', 'Slide the controls and the answer, the chart and the animation change straight away. There are no formulas to type first.'),
      step(3, 'See why it happened', 'Short notes in plain words explain each result. When you are ready, the Pro view shows the full working.')));

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

  const grid2 = h('div', { class: 'cols2 reveal' }, popular, h('div', { class: 'stack' }, tryIt));


  const liveHost = h('div', { class: 'reveal home-gap' }), tape = h('div', { class: 'hl-tape', hidden: true }) /* kept off the page */, tmHost = h('div', { class: 'reveal home-gap' });
  let stopLive = () => { }, stopTm = () => { };
  main.append(hero, intro, tmHost, liveHost, qrow, grid2);
  /* loaded after the page is shown, so a slow data source never delays it */
  import('./homelive.js').then(m => { if (liveHost.isConnected) stopLive = m.mountHomeLive(liveHost, { tape, hero }) || stopLive; }).catch(() => { liveHost.hidden = true; });
  import('./timemachine.js').then(m => { if (tmHost.isConnected) stopTm = m.mountTimeMachine(tmHost) || stopTm; }).catch(() => { tmHost.hidden = true; });

  /* motion */
  main.querySelectorAll('[data-count]').forEach(el => { if (el.dataset.count) countUp(el, el.dataset.count, 900); });
  const hn = main.querySelector('#heroNum'); if (hn) countUp(hn, money(heroFv(20), 0), 1200);
  let k = 0; const ask = main.querySelector('#askText');
  const timer = setInterval(() => { if (!ask.isConnected) { clearInterval(timer); return; } ask.classList.add('swap'); setTimeout(() => { k = (k + 1) % PLACEHOLDERS.length; ask.textContent = PLACEHOLDERS[k]; ask.classList.remove('swap'); }, 220); }, 2600);
  return () => { clearInterval(timer); stopLive(); stopTm(); };
}
