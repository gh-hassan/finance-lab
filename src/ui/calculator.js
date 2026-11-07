// @ts-nocheck
/* Financial calculator page: a BA II Plus Professional handheld that works in the browser, with a short how-to guide.
   Independent training tool. Not affiliated with or endorsed by Texas Instruments. */
import { h, store } from './visuals.js';
import { initial, press, view } from '../lib/ba2';
import { BASICS, EXAMPLES, TIPS, stepKeys } from './ba2guide.js';

const KEY = 'fl:ba2';
/* [id, label, second-function label, style] in the order they sit on the handheld */
const ROWS = [
  [['2ND', '2ND', '', 'k-2nd'], ['CPT', 'CPT', 'QUIT', 'k-main'], ['ENTER', 'ENTER', 'SET', 'k-main'], ['UP', '↑', 'INS', 'k-fn'], ['DOWN', '↓', 'DEL', 'k-fn']],
  [['N', 'N', 'xP/Y', 'k-tvm'], ['IY', 'I/Y', 'P/Y', 'k-tvm'], ['PV', 'PV', 'AMORT', 'k-tvm'], ['PMT', 'PMT', 'BGN', 'k-tvm'], ['FV', 'FV', 'CLR TVM', 'k-tvm']],
  [['CF', 'CF', '', 'k-fn'], ['NPV', 'NPV', '', 'k-fn'], ['IRR', 'IRR', '', 'k-fn'], ['STO', 'STO', '', 'k-fn'], ['RCL', 'RCL', '', 'k-fn']],
  [['PCT', '%', 'nPr', 'k-fn'], ['7', '7', 'DATA', 'k-num'], ['8', '8', 'STAT', 'k-num'], ['9', '9', 'BRKEVN', 'k-num'], ['DIV', '÷', '', 'k-op']],
  [['SQRT', '√x', 'x²', 'k-fn'], ['4', '4', 'BOND', 'k-num'], ['5', '5', 'DEPR', 'k-num'], ['6', '6', 'ICONV', 'k-num'], ['MUL', '×', '', 'k-op']],
  [['YX', 'yˣ', '1/x', 'k-fn'], ['1', '1', 'PRFT', 'k-num'], ['2', '2', 'DATE', 'k-num'], ['3', '3', 'nCr', 'k-num'], ['SUB', '−', '', 'k-op']],
  [['LN', 'LN', 'eˣ', 'k-fn'], ['0', '0', 'MEM', 'k-num'], ['.', '.', 'FORMAT', 'k-num'], ['NEG', '+/−', 'RESET', 'k-num'], ['ADD', '+', '', 'k-op']],
  [['CLR', 'CE|C', 'CLR WORK', 'k-fn'], ['BACK', '←', 'x!', 'k-fn'], ['EQ', '=', '', 'k-eq k-wide']]
];
const LETTERS = { n: 'N', i: 'IY', v: 'PV', p: 'PMT', f: 'FV', c: 'CPT', s: '2ND' };
const OPS = { '+': 'ADD', '-': 'SUB', '*': 'MUL', '/': 'DIV', '%': 'PCT', '=': 'EQ' };

function load() {
  try {
    const raw = store.get(KEY), base = initial();
    if (!raw || typeof raw !== 'object') return base;
    const out = { ...base };
    for (const k of Object.keys(base)) if (k in raw && typeof raw[k] === typeof base[k] && Array.isArray(raw[k]) === Array.isArray(base[k])) out[k] = raw[k];
    out.second = false; out.cpt = false; out.pend = ''; out.error = null; out.typing = false; out.entry = ''; out.op = null; out.ws = null; out.label = '';
    if (!Array.isArray(out.mem) || out.mem.length !== 10) out.mem = base.mem;
    return out;
  } catch (e) { return initial(); }
}

export function renderCalculator(main) {
  let st = load();
  const ind = {}, screen = h('div', { class: 'ba-screen', role: 'status', 'aria-live': 'polite' });
  const lab = h('span', { class: 'ba-lab' }), valEl = h('span', { class: 'ba-val' });
  const flags = h('div', { class: 'ba-flags' }, ['2ND', 'BGN', 'CPT', 'STO', 'RCL'].map(n => (ind[n] = h('span', {}, n))));
  const sheet = h('span', { class: 'ba-ws' });
  screen.append(flags, h('div', { class: 'ba-line' }, lab, valEl), sheet);

  function draw() {
    const v = view(st);
    lab.textContent = v.label; valEl.textContent = v.value; sheet.textContent = v.ws ? ({ NPV: 'NPV', IRR: 'IRR', PY: 'P/Y', BGN: 'BGN', FORMAT: 'FORMAT' }[v.ws] || v.ws) : '';
    ind['2ND'].classList.toggle('on', v.second); ind.BGN.classList.toggle('on', v.bgn); ind.CPT.classList.toggle('on', v.busy === 'CPT'); ind.STO.classList.toggle('on', v.busy === 'STO'); ind.RCL.classList.toggle('on', v.busy === 'RCL');
    valEl.classList.toggle('err', /^Error/.test(v.value)); valEl.classList.toggle('small', v.value.length > 13);
    keyEls['2ND'].classList.toggle('armed', v.second);
    const persist = { ...st, ws: null, second: false, cpt: false, pend: '', typing: false, entry: '', op: null, error: null };
    store.set(KEY, persist);
  }
  const keyEls = {};
  const tap = id => { st = press(st, id); draw(); };
  const grid = h('div', { class: 'ba-keys' }, ROWS.flat().map(([id, label, sec, cls]) => {
    const b = h('button', { type: 'button', class: 'ba-key ' + cls, 'aria-label': sec ? `${label}, second function ${sec}` : label, 'data-k': id },
      sec ? h('small', {}, sec) : null, h('span', {}, label));
    b.addEventListener('click', () => tap(id));
    keyEls[id] = b; return b;
  }));
  const body = h('div', { class: 'ba' }, h('div', { class: 'ba-brand' }, h('b', {}, 'Financial calculator'), h('span', {}, 'BA II Plus Professional')), screen, grid);

  const onKey = e => {
    if (!body.isConnected || e.ctrlKey || e.metaKey || e.altKey) return;
    const t = e.target; if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
    let id = null;
    if (/^[0-9.]$/.test(e.key)) id = e.key; else if (OPS[e.key]) id = OPS[e.key];
    else if (e.key === 'Enter') id = st.ws ? 'ENTER' : 'EQ';
    else if (e.key === 'Backspace') id = 'BACK'; else if (e.key === 'Escape') id = 'CLR';
    else if (e.key === 'ArrowUp') id = 'UP'; else if (e.key === 'ArrowDown') id = 'DOWN';
    else if (LETTERS[e.key.toLowerCase()] && !(t && t.tagName === 'BUTTON' && e.key === ' ')) id = LETTERS[e.key.toLowerCase()];
    if (!id) return;
    if (e.key === 'Enter' && t && t.tagName === 'BUTTON') return; /* let a focused button handle its own Enter */
    e.preventDefault(); const b = keyEls[id]; if (b) { b.classList.add('hit'); setTimeout(() => b.classList.remove('hit'), 110); } tap(id);
  };
  document.addEventListener('keydown', onKey);

  /* one lesson step: words and key chips, then the screen the calculator really shows after it */
  const part = p => {
    if (p.text) return p.text;
    if (p.type) return h('span', { class: 'kt' }, p.type);
    if (p.chip2) return h('span', { class: 'kk' }, h('kbd', { class: 'kb kb2' }, '2ND'), h('kbd', { class: 'kb kb3' }, p.chip2), p.above ? h('em', { class: 'kh' }, '(' + p.above + ')') : null);
    return h('kbd', { class: 'kb' }, p.chip);
  };
  const lesson = (ex, n) => {
    let s2 = initial();
    const items = ex.steps.map(stp => {
      stepKeys(stp).forEach(k => { s2 = press(s2, k); });
      const v = view(s2), shown = (v.label + ' ' + v.value).trim();
      return h('li', {}, h('div', { class: 'gs-line' }, stp.parts.map(part)), h('div', { class: 'gs-see' }, h('i', {}, 'Screen'), h('b', {}, shown)));
    });
    return h('details', { class: 'card ba-ex', open: n === 0 }, h('summary', {}, h('h3', {}, ex.title), h('span', { class: 'lvl' }, ex.level)),
      h('p', { class: 'gs-intro' }, ex.intro), h('ol', { class: 'gs' }, items), h('p', { class: 'gs-after' }, h('b', {}, 'You get: '), ex.after));
  };
  const guide = h('div', { class: 'ba-guide' }, h('h2', {}, 'How to use it'),
    h('p', { class: 'ba-lead' }, 'Follow a lesson key by key. Each step shows the screen you should see, so you always know you are on track. The same key presses work on a real BA II Plus.'),
    h('div', { class: 'card ba-basics' }, h('h3', {}, 'Read this first'), h('ul', {}, BASICS.map(([t, d]) => h('li', {}, h('b', {}, t), ' ', d))),
      h('p', { class: 'gs-key' }, 'A key you press looks like ', h('kbd', { class: 'kb' }, 'N'), '. A yellow label looks like ', h('span', { class: 'kk' }, h('kbd', { class: 'kb kb2' }, '2ND'), h('kbd', { class: 'kb kb3' }, 'P/Y')), ': press 2ND, then the key under that yellow word. A number you type looks like ', h('span', { class: 'kt' }, '6.5'), '.')),
    EXAMPLES.map(lesson),
    h('div', { class: 'card ba-tips' }, h('h3', {}, 'Handy things to know'), h('dl', {}, TIPS.flatMap(([t, d]) => [h('dt', {}, t), h('dd', {}, d)]))),
    h('p', { class: 'ba-fine' }, 'An independent practice tool built for students. It is not made, endorsed or approved by Texas Instruments, and "BA II Plus" is a trademark of Texas Instruments. Check what your exam allows: you may need the physical calculator on test day.'));

  main.innerHTML = '';
  main.append(h('header', { class: 'learn-hero reveal' }, h('p', { class: 'eyebrow' }, 'Free for every student'), h('h1', { html: 'Financial <em>calculator</em>' }), h('p', { class: 'lead' }, 'A working BA II Plus calculator for time value of money, cash flows, bonds, amortization, depreciation and statistics.')),
    h('div', { class: 'ba-layout' }, body, guide));
  draw();
  return () => document.removeEventListener('keydown', onKey);
}
