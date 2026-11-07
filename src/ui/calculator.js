// @ts-nocheck
/* Financial calculator page: a BA II Plus Professional style handheld that works in the browser, with a short how-to guide.
   Independent training tool. Not affiliated with or endorsed by Texas Instruments. */
import { h, store } from './visuals.js';
import { initial, press, view } from '../lib/ba2';

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

const GUIDE = [
  ['Loan payment', ['Press 2ND then P/Y (the I/Y key). Make P/Y = 12 and C/Y = 12, pressing ENTER after each (↓ moves between them). Press 2ND then QUIT (CPT key).', 'Type 30, press 2ND then xP/Y (the N key): N = 360.', 'Type 6.5 I/Y, 250000 PV, 0 FV.', 'Press CPT then PMT: −1,580.17. Negative means money you pay.']],
  ['Savings growth', ['Set P/Y = 1 and C/Y = 1 (2ND P/Y). QUIT.', 'Type 10 N, 5 I/Y, 1000 then +/− then PV (money you put in is negative), 0 PMT.', 'Press CPT then FV: 1,628.89.']],
  ['NPV and IRR', ['Press CF. Type 1000, +/−, ENTER, then ↓. Type 300 ENTER, ↓ (this is F01, the repeat count, usually 1), ↓. Continue for each cash flow.', 'Press NPV, type the rate (10), ENTER, ↓, then CPT for NPV. ↓ shows NFV, PI, PB and DPB.', 'Press IRR then CPT.']],
  ['Bond price', ['Press 2ND then BOND (the 4 key). Enter settlement date SDT as MM.DDYY, for example 2.1508 for 15 Feb 2008, then ↓.', 'Enter CPN (coupon %), RDT (maturity date), RV (100). Use 2ND SET on the ACT and 2/Y lines to switch day count or yearly coupons.', 'Enter YLD, press ↓ to PRI and CPT for the price. Or enter PRI and CPT on YLD for the yield.']],
  ['Amortization', ['First compute the payment as in the loan example.', 'Press 2ND then AMORT (the PV key). Type 1 ENTER ↓ 12 ENTER ↓ to see the balance, principal and interest for payments 1 to 12 (↓ moves on).']],
  ['Depreciation', ['Press 2ND then DEPR (the 5 key). Use 2ND SET on the first line to choose SL, SYD or DB.', 'Enter LIF, CST, SAL and the year YR. DEP, RBV (book value) and RDV (left to depreciate) are shown as you move down.']],
  ['Good to know', ['The calculator remembers your numbers on this device. 2ND then +/− (RESET) clears everything.', 'Money you receive is positive and money you pay is negative, just like the handheld.', 'P/Y starts at 12, as on the handheld. Change it for yearly problems.', 'Keyboard: digits, + − × ÷, Enter, Backspace, Esc (clear), arrow keys. Letters: N, I (I/Y), V (PV), P (PMT), F (FV), C (CPT), S (2ND).']]
];

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
  const body = h('div', { class: 'ba' }, h('div', { class: 'ba-brand' }, h('b', {}, 'Financial calculator'), h('span', {}, 'BA II Plus Professional style')), screen, grid);

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

  const guide = h('div', { class: 'ba-guide' }, h('h2', {}, 'How to use it'), h('p', { class: 'ba-lead' }, 'Same keys, second functions and worksheets as the BA II Plus Professional, so tutorials and textbook key sequences carry over. Gold labels above a key are its 2ND function: press 2ND first.'),
    GUIDE.map(([t, steps], k) => h('details', { class: 'card ba-ex', open: k === 0 }, h('summary', {}, h('h3', {}, t)), h('ol', {}, steps.map(x => h('li', {}, x))))),
    h('p', { class: 'ba-fine' }, 'An independent practice tool built for students. It is not made, endorsed or approved by Texas Instruments, and "BA II Plus" is a trademark of Texas Instruments. Check what your exam allows: you may need the physical calculator on test day.'));

  main.innerHTML = '';
  main.append(h('header', { class: 'learn-hero reveal' }, h('p', { class: 'eyebrow' }, 'Free for every student'), h('h1', { html: 'Financial <em>calculator</em>' }), h('p', { class: 'lead' }, 'A working BA II Plus style calculator for time value of money, cash flows, bonds, amortization, depreciation and statistics.')),
    h('div', { class: 'ba-layout' }, body, guide));
  draw();
  return () => document.removeEventListener('keydown', onKey);
}
