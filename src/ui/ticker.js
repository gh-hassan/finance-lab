// @ts-nocheck
/* Odometer numbers. Every digit sits in a column of 0-9 that slides to the new digit, so figures roll like a clock
   ticker instead of jumping. Elements are rebuilt on each render, so the last digits are remembered by key. */
import { reduced } from './visuals.js';

const last = new Map();
const COLUMN = '0123456789'.split('').map(d => `<i>${d}</i>`).join('');

/** Show `text` in `el`. `key` links this spot to the same spot on the previous render so digits roll from the old value. */
export function tick(el, text, key) {
  text = String(text == null ? '' : text);
  const prev = key ? last.get(key) : el._digits;
  const digits = [...text].filter(c => c >= '0' && c <= '9').map(Number);
  if (reduced() || !digits.length) { el.textContent = text; if (key) last.set(key, digits); el._digits = digits; return; }
  el.setAttribute('aria-label', text);
  el.textContent = '';
  const cols = []; let run = '', di = 0;
  const flush = () => { if (run) { const s = document.createElement('span'); s.className = 'tk-t'; s.setAttribute('aria-hidden', 'true'); s.textContent = run; el.append(s); run = ''; } };
  [...text].forEach(ch => {
    if (ch >= '0' && ch <= '9') {
      flush();
      const box = document.createElement('span'); box.className = 'tk-d'; box.setAttribute('aria-hidden', 'true');
      const col = document.createElement('span'); col.className = 'tk-c'; col.innerHTML = COLUMN;
      /* right-align with the previous number so the ones, tens, hundreds keep their own wheels */
      const from = prev && prev[prev.length - (digits.length - di)] != null ? prev[prev.length - (digits.length - di)] : 0;
      col.style.transition = 'none'; col.style.transform = `translateY(-${from * 10}%)`;
      box.append(col); el.append(box); cols.push([col, digits[di]]); di++;
    } else run += ch;
  });
  flush();
  void el.offsetWidth; /* commit the starting positions, then roll */
  cols.forEach(([col, d], i) => { col.style.transition = ''; col.style.transitionDelay = `${Math.min(i, 8) * 18}ms`; col.style.transform = `translateY(-${d * 10}%)`; });
  if (key) last.set(key, digits); el._digits = digits;
}
