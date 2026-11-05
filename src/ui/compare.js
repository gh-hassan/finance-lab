// @ts-nocheck
/* Compare page: two versions of the same calculator side by side, with the better one highlighted. */
import { MODS } from '../lib/registry';
import { h, store } from './visuals.js';
import { tick } from './ticker.js';
import { fieldsHaveUnits, unitize } from './units.js';

/* Which calculators can be compared, and what "better" means for each measure (matched by the start of the card label). */
const METRICS = {
  loan: [['Payment each period', 'low'], ['Total interest', 'low'], ['Total paid', 'low']],
  tvm: [['Future value', 'high'], ['Interest earned', 'high']],
  capbud: [['NPV', 'high'], ['IRR', 'high'], ['Profitability index', 'high']],
  wacc: [['WACC', 'low']],
  breakeven: [['Break-even volume', 'low'], ['Margin of safety', 'high']],
  wc: [['Cash conversion cycle', 'low'], ['Cash tied up in the cycle', 'low']],
  portfolio: [['Portfolio expected return', 'high'], ['Portfolio risk', 'low'], ['Sharpe ratio', 'high']],
  returns: [['Geometric mean', 'high'], ['Standard deviation', 'low'], ['Sharpe ratio', 'high']],
  capm: [['Sharpe ratio', 'high'], ['Jensen', 'high']],
  merger: [['EPS accretion', 'high']],
  ratios: [['Return on equity', 'high'], ['Current ratio', 'high']]
};
const PLAIN = { loan: 'Compare two loans', tvm: 'Compare two savings plans', capbud: 'Compare two projects', wacc: 'Compare two funding mixes', breakeven: 'Compare two businesses', wc: 'Compare two cash cycles', portfolio: 'Compare two portfolios', returns: 'Compare two return histories', capm: 'Compare two stocks', merger: 'Compare two deal terms', ratios: 'Compare two companies' };

/** First number in a displayed value, as a plain number (handles $, commas, %, units and the true minus sign). */
export function parseValue(s) {
  const m = /([−-]?)\s*\$?\s*([−-]?)(\d[\d,]*\.?\d*)/.exec(String(s || ''));
  if (!m) return NaN;
  const neg = m[1] === '−' || m[1] === '-' || m[2] === '−' || m[2] === '-';
  const n = parseFloat(m[3].replace(/,/g, ''));
  return neg ? -n : n;
}

/** Pick the winner for one measure: 'a', 'b' or 'tie' (a tie also covers values we cannot read). */
export function winner(a, b, better) {
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 'tie';
  if (Math.abs(a - b) < 1e-9 * Math.max(1, Math.abs(a), Math.abs(b))) return 'tie';
  return (better === 'high') === (a > b) ? 'a' : 'b';
}

export const comparable = () => MODS.filter(m => METRICS[m.id]);

export function renderCompare(main) {
  const list = comparable();
  const U = x => (fieldsHaveUnits(cur.m.fields) ? unitize(x, store.get('fl:unit') || 'M') : x);
  const cur = { m: list.find(m => m.id === store.get('fl:cmp:id')) || list[0], a: null, b: null, names: ['Option A', 'Option B'] };
  let rowEls = [], banner, resultBox, legA, legB;

  const defaults = m => Object.fromEntries(m.fields.map(f => [f.id, f.v]));
  function load() {
    const saved = store.get('fl:cmp:' + cur.m.id) || {};
    cur.a = { ...defaults(cur.m), ...(saved.a || {}) };
    cur.b = { ...(saved.b || nudged(cur.m)) };
  }
  /* Option B starts a little different from A so the first comparison already shows something. */
  function nudged(m) {
    const o = defaults(m), first = m.fields.find(f => f.type !== 'select' && f.type !== 'text' && typeof f.v === 'number' && f.v !== 0);
    if (first) o[first.id] = +(first.v * 1.2).toPrecision(6);
    return o;
  }
  const save = () => store.set('fl:cmp:' + cur.m.id, { a: cur.a, b: cur.b });

  function calc(state) { try { return U(cur.m.calc(state)); } catch (e) { return { cards: [] }; } }
  function measure(out, label) { const c = (out.cards || []).find(x => !x.head && String(x.label || '').startsWith(label)); return c || null; }

  function fieldBox(side) {
    const st = cur[side], box = h('div', { class: 'cmp-fields' });
    const rows = [];
    cur.m.fields.forEach(f => {
      const id = `cmp_${side}_${f.id}`;
      let input;
      if (f.type === 'select') { input = h('select', { id }, f.options.map(([v, t]) => h('option', { value: v }, t))); input.value = st[f.id]; }
      else if (f.type === 'text') input = h('input', { id, type: 'text', value: st[f.id], spellcheck: 'false', autocomplete: 'off' });
      else input = h('input', { id, type: 'number', step: f.step || 'any', inputmode: 'decimal', value: st[f.id], autocomplete: 'off' });
      input.addEventListener('input', () => { st[f.id] = f.type === 'select' || f.type === 'text' ? input.value : (Number.isFinite(input.valueAsNumber) ? input.valueAsNumber : 0); save(); update(); applyShow(); });
      const wrap = h('div', { class: 'fld' }, h('div', { class: 'lrow' }, h('label', { for: id }, U(f.label))),
        f.type === 'select' ? input : h('div', { class: 'inp' }, f.pre && h('span', { class: 'u' }, f.pre), input, f.unit && h('span', { class: 'u' }, f.unit)));
      rows.push([f, wrap]); box.append(wrap);
    });
    box._apply = () => rows.forEach(([f, wrap]) => { const sh = cur.m.show && cur.m.show[f.id]; wrap.hidden = sh ? !sh(st) : false; });
    return box;
  }
  let boxes = [];
  const applyShow = () => boxes.forEach(b => b._apply());

  function buildResults() {
    resultBox.innerHTML = '';
    rowEls = METRICS[cur.m.id].map(([label, better]) => {
      const name = h('div', { class: 'cmp-name' }), a = h('b', { class: 'cmp-v' }), b = h('b', { class: 'cmp-v' }), diff = h('span', { class: 'cmp-diff' });
      const cellA = h('div', { class: 'cmp-cell' }, a), cellB = h('div', { class: 'cmp-cell' }, b);
      resultBox.append(h('div', { class: 'cmp-row' }, name, cellA, cellB, diff));
      return { label, better, name, a, b, cellA, cellB, diff };
    });
  }

  function update() {
    const oa = calc(cur.a), ob = calc(cur.b), score = { a: 0, b: 0 };
    rowEls.forEach((r, i) => {
      const ca = measure(oa, r.label), cb = measure(ob, r.label);
      r.name.textContent = (ca || cb || { label: r.label }).label;
      tick(r.a, ca ? ca.value : '—', `cmp:${cur.m.id}:${i}:a`); tick(r.b, cb ? cb.value : '—', `cmp:${cur.m.id}:${i}:b`);
      const va = ca ? parseValue(ca.value) : NaN, vb = cb ? parseValue(cb.value) : NaN, w = winner(va, vb, r.better);
      r.cellA.classList.toggle('win', w === 'a'); r.cellB.classList.toggle('win', w === 'b');
      if (w !== 'tie') score[w]++;
      r.diff.textContent = w === 'tie' ? (Number.isFinite(va) && Number.isFinite(vb) ? 'Same' : '') : `${cur.names[w === 'a' ? 0 : 1]} is ${r.better === 'high' ? 'higher' : 'lower'}`;
    });
    legA.textContent = cur.names[0]; legB.textContent = cur.names[1];
    const total = rowEls.length;
    banner.className = 'cmp-banner' + (score.a === score.b ? '' : ' has');
    banner.textContent = score.a === score.b ? (score.a === 0 ? 'No difference yet. Change a number to see which is better.' : 'A tie: each is better on the same number of measures.') :
      `${cur.names[score.a > score.b ? 0 : 1]} wins on ${Math.max(score.a, score.b)} of ${total} measure${total > 1 ? 's' : ''}.`;
  }

  function nameInput(i) {
    const input = h('input', { class: 'cmp-title', type: 'text', value: cur.names[i], 'aria-label': `Name of option ${i ? 'B' : 'A'}`, maxlength: 24 });
    input.addEventListener('input', () => { cur.names[i] = input.value.trim() || (i ? 'Option B' : 'Option A'); update(); });
    return input;
  }

  const picker = h('div', { class: 'picker reveal' });
  const body = h('div', { class: 'cmp-body' });
  function drawPicker() {
    picker.innerHTML = '';
    list.forEach(m => picker.append(h('button', { type: 'button', class: 'pick' + (m.id === cur.m.id ? ' on' : ''), onclick: () => { cur.m = m; store.set('fl:cmp:id', m.id); drawPicker(); drawBody(); } }, PLAIN[m.id] || m.title)));
  }
  function drawBody() {
    load(); body.innerHTML = '';
    boxes = [fieldBox('a'), fieldBox('b')];
    banner = h('div', { class: 'cmp-banner', role: 'status' }); legA = h('span', {}, cur.names[0]); legB = h('span', {}, cur.names[1]);
    resultBox = h('div', { class: 'cmp-table' });
    const copy = h('button', { class: 'btn small', type: 'button', onclick: () => { cur.b = { ...cur.a }; save(); drawBody(); } }, 'Copy A into B');
    const reset = h('button', { class: 'btn small', type: 'button', onclick: () => { store.del('fl:cmp:' + cur.m.id); drawBody(); } }, 'Reset');
    const cols = h('div', { class: 'cmp-cols' }, h('section', { class: 'card cmp-side a' }, nameInput(0), boxes[0]), h('section', { class: 'card cmp-side b' }, nameInput(1), boxes[1]));
    body.append(h('div', { class: 'cmp-tools' }, copy, reset), cols, h('section', { class: 'card cmp-result' }, banner, h('div', { class: 'cmp-legend' }, h('span', {}, 'Measure'), legA, legB, h('span', {})), resultBox));
    buildResults(); applyShow(); update();
  }

  main.innerHTML = '';
  main.append(h('header', { class: 'vhead reveal' }, h('div', { class: 'vtitle' }, h('p', { class: 'eyebrow' }, 'Side by side'), h('h1', { html: 'Which one is <em>better</em>?' }), h('p', { class: 'blurb' }, 'Change the numbers on each side. The better one lights up.'))), picker, body);
  drawPicker(); drawBody();
  return () => { };
}
