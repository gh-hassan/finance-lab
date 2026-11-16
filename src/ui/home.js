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
const PLACEHOLDERS = ['How much will my savings grow?', 'What will my loan really cost?', 'Is this share worth its price?', 'Should we take this project?'];

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
  const doodleHost = h('div', { class: 'hero-doodle' });
  const hero = h('section', { class: 'hero solo reveal' },
    h('div', { class: 'hero-copy' },
      h('p', { class: 'eyebrow' }, 'Suleman Dawood School of Business'),
      h('h1', { class: 'split', html: `${split('Finance,')}<br><em>${split('made clear.', 1)}</em>` })),
    doodleHost,
    h('div', { class: 'hero-ask' }, h('button', { class: 'ask', type: 'button', 'data-open-search': true }, h('span', { class: 'ask-icon', html: ICONS.search }), h('span', { class: 'ask-text', id: 'askText' }, PLACEHOLDERS[0]), h('kbd', {}, '/'))));

  const step = (n, title, text) => h('li', { class: 'hi-step' }, h('span', { class: 'hi-n' }, String(n)), h('b', {}, title), h('p', {}, text));
  const intro = h('section', { class: 'hi reveal', 'aria-labelledby': 'hiTitle' },
    h('h2', { id: 'hiTitle' }, 'Learn finance by trying it'),
    h('p', { class: 'hi-lead' }, 'Money ideas are easier when you can try them. Change a number and see what happens.'),
    h('ol', { class: 'hi-steps' },
      step(1, 'Pick a question', 'Start with a question you really have. For example: how much will my savings grow?'),
      step(2, 'Change the numbers', 'Move a slider. The answer, the chart and the picture change at once.'),
      step(3, 'See why', 'Short, simple notes explain every answer. Later, the Pro view shows all the steps.')));

  const qCards = QUESTIONS.map(id => MODS.find(m => m.id === id)).filter(Boolean).map(m => {
    const t = TOPICS[m.group];
    return h('a', { class: `qcard tint-${t.tint} tilt`, href: '/' + m.id, 'data-link': true }, h('small', {}, t.label), h('b', {}, (BEGINNER[m.id] || {}).ask || m.title), h('span', { class: 'go', html: ICONS.arrow }));
  });
  /** A section that can be opened and closed, so the page reads one idea at a time. Ordered from simplest to hardest. */
  const fold = (title, hint, body, open = false) => h('details', Object.assign({ class: 'hs reveal' }, open ? { open: '' } : {}),
    h('summary', {}, h('span', { class: 'hs-t' }, h('h2', {}, title), h('small', {}, hint)), h('span', { class: 'hs-c', html: ICONS.arrow })), h('div', { class: 'hs-body' }, body));
  const qrow = fold('Start with a question', 'Pick one and see the answer.', h('div', { class: 'qrow' }, qCards), true);

  const tiles = POPULAR.map(id => MODS.find(m => m.id === id)).filter(Boolean).map((m, i) => {
    const d = liveData(m), t = TOPICS[m.group], color = ['var(--c1)', 'var(--c2)', 'var(--c3)', 'var(--c4)'][i % 4];
    return h('a', { class: `tile tint-${t.tint} tilt`, href: '/' + m.id, 'data-link': true },
      h('div', { class: 'tile-top' }, h('span', { class: 'ticon', html: ICONS[m.group] || ICONS.coin }), h('div', {}, h('b', {}, m.title), h('small', {}, t.label))),
      h('div', { class: 'tile-val', 'data-count': d.key.value }, d.key.value), h('small', { class: 'tile-lbl' }, d.key.label),
      h('div', { class: 'tile-spark', html: sparkline(d.pts, { w: 220, h: 56, color }) }));
  });
  const popular = h('section', { class: 'sec' }, h('div', { class: 'sec-h' }, h('h2', {}, 'Popular calculators'), h('small', {}, 'With example numbers')), h('div', { class: 'tiles' }, tiles));

  /* try it live */
  let sav = 200, yrsN = 20;
  const out = h('div', { class: 'try-num' }, '$0'), sub = h('p', { class: 'try-sub' }), spark = h('div', { class: 'try-spark' });
  const calc = () => {
    const r = 0.07 / 12, n = yrsN * 12, fv = sav * ((Math.pow(1 + r, n) - 1) / r), put = sav * n;
    out.textContent = money(fv, 0); sub.innerHTML = `You paid in <b>${money(put, 0)}</b>. It grew by <b>${money(fv - put, 0)}</b>.`;
    spark.innerHTML = sparkline(range(0, yrsN, yrsN / 24).map(t => [t, sav * ((Math.pow(1 + r, t * 12) - 1) / r)]), { w: 360, h: 90, color: 'var(--c1)' }).replace('class="sp-line"', 'class="sp-line static"');
  };
  const slider = (label, min, max, step, val, fmt, on) => { const o = h('b', {}, fmt(val)); const rs = rangeSlider({ min, max, step, value: val, label, fmt }), i = rs.input; i.addEventListener('input', () => { on(+i.value); o.textContent = fmt(+i.value); calc(); }); return h('div', { class: 'tslider' }, h('span', {}, label, o), rs.el); };
  const tryIt = h('section', { class: 'card try tint-lav' }, h('div', { class: 'sec-h' }, h('h2', {}, 'Try it live'), h('small', {}, 'Saving every month, growing 7% a year')), slider('Save each month', 25, 1000, 25, sav, v => '$' + v, v => (sav = v)), slider('For how long', 5, 40, 1, yrsN, v => v + ' yrs', v => (yrsN = v)), out, sub, spark);
  calc();

  const grid2 = fold('Try it yourself', 'Play with the numbers and watch the answer change.', h('div', { class: 'cols2' }, popular, h('div', { class: 'stack' }, tryIt)), true);


  const liveHost = h('div', {}), exploreHost = h('div', {}), tape = h('div', { class: 'hl-tape', hidden: true }) /* kept off the page */, tmHost = h('div', {});
  let stopLive = () => { }, stopTm = () => { }, stopDoodle = () => { };
  const tmFold = fold('The time machine', 'What if you had put money in years ago?', tmHost), mkFold = fold('The markets right now', 'How share prices, interest rates and money are moving today.', liveHost), exFold = fold('Explore live numbers', 'Look deeper at real numbers, one topic at a time.', exploreHost);
  main.append(hero, intro, qrow, grid2, tmFold, mkFold, exFold);
  /* loaded after the page is shown, so a slow data source never delays it */
  import('./homelive.js').then(m => { if (liveHost.isConnected) { stopLive = m.mountHomeLive(liveHost, { tape, hero }) || stopLive; const last = liveHost.lastElementChild; if (last && liveHost.children.length > 1) exploreHost.append(last); } }).catch(() => { liveHost.hidden = true; });
  /* the story animation is for wider screens only; on a phone it is left out completely */
  const wide = matchMedia('(min-width: 701px)');
  const showDoodle = () => import('./doodle.js').then(m => { if (doodleHost.isConnected && !doodleHost.firstChild) stopDoodle = m.mountDoodle(doodleHost) || stopDoodle; }).catch(() => { doodleHost.hidden = true; });
  if (wide.matches) showDoodle(); else wide.addEventListener('change', e => { if (e.matches) showDoodle(); }, { once: true });
  import('./timemachine.js').then(m => { if (tmHost.isConnected) stopTm = m.mountTimeMachine(tmHost) || stopTm; }).catch(() => { tmHost.hidden = true; });

  /* motion */
  main.querySelectorAll('[data-count]').forEach(el => { if (el.dataset.count) countUp(el, el.dataset.count, 900); });
  const hn = main.querySelector('#heroNum'); if (hn) countUp(hn, money(heroFv(20), 0), 1200);
  let k = 0; const ask = main.querySelector('#askText');
  const timer = setInterval(() => { if (!ask.isConnected) { clearInterval(timer); return; } ask.classList.add('swap'); setTimeout(() => { k = (k + 1) % PLACEHOLDERS.length; ask.textContent = PLACEHOLDERS[k]; ask.classList.remove('swap'); }, 220); }, 2600);
  return () => { clearInterval(timer); stopLive(); stopTm(); stopDoodle(); };
}
