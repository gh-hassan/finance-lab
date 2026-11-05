// @ts-nocheck
/* Odometer numbers. Each digit sits on a wheel that turns the short way round to the new digit, so figures roll like a
   clock ticker. The wheel box keeps the width and baseline of an ordinary digit, so it works inside sentences too. The
   DOM is kept between updates (same shape of text), so a number that changes every frame keeps rolling smoothly. */
import { reduced } from './visuals.js';

const last = new Map();
const DUR = 700;
const WHEEL = Array.from({ length: 40 }, (_, i) => `<i>${i % 10}</i>`).join('');
const isD = c => c >= '0' && c <= '9';
const TOKEN = /[$€£−+-]?\d[\d,.]*\d%?|[$€£−+-]?\d%?/g;

function spin(col, d, delay = 0) {
  const cur = col._idx % 10, delta = ((d - cur + 14) % 10) - 4; /* shortest way round, ties roll forward */
  let next = col._idx + delta;
  clearTimeout(col._snap);
  if (next < 4 || next > 35) { col.style.transition = 'none'; col._idx = 10 + d; col.style.transform = `translateY(-${col._idx * 2.5}%)`; return; }
  col._idx = next;
  col.style.transition = ''; col.style.transitionDelay = delay + 'ms';
  col.style.transform = `translateY(-${next * 2.5}%)`;
  col._snap = setTimeout(() => { col._idx = 10 + (col._idx % 10); col.style.transition = 'none'; col.style.transform = `translateY(-${col._idx * 2.5}%)`; }, DUR + delay + 80);
}

function wheel(from) {
  const box = document.createElement('span'); box.className = 'tk-d'; box.setAttribute('aria-hidden', 'true');
  const s = document.createElement('span'); s.className = 'tk-s'; s.textContent = '0';
  const col = document.createElement('span'); col.className = 'tk-c'; col.innerHTML = WHEEL;
  col._idx = 10 + from; col.style.transition = 'none'; col.style.transform = `translateY(-${col._idx * 2.5}%)`;
  box.append(s, col); return [box, col];
}

/** Show `text` in `el`. `key` links this spot to the same spot on the previous render so digits roll from the old value. */
export function tick(el, text, key) {
  text = String(text == null ? '' : text);
  const digits = [...text].filter(isD).map(Number), sig = text.replace(/\d/g, '#');
  if (reduced() || !digits.length) { el.textContent = text; el._tk = null; if (key) last.set(key, digits); return; }
  el.setAttribute('aria-label', text);
  const st = el._tk;
  if (st && st.sig === sig) { st.cols.forEach((c, i) => spin(c, digits[i], Math.min(i, 8) * 16)); if (key) last.set(key, digits); return; }
  const prev = key ? last.get(key) : st && st.digits;
  el.textContent = '';
  const cols = []; let di = 0, tok = null;
  const addTextRun = (parent, s) => { if (!s) return; const t = document.createElement('span'); t.className = 'tk-t'; t.setAttribute('aria-hidden', 'true'); t.textContent = s; parent.append(t); };
  let pos = 0;
  for (const m of text.matchAll(TOKEN)) {
    addTextRun(el, text.slice(pos, m.index)); pos = m.index + m[0].length;
    tok = document.createElement('span'); tok.className = 'tk-n'; tok.setAttribute('aria-hidden', 'true');
    let run = '';
    [...m[0]].forEach(ch => {
      if (isD(ch)) {
        addTextRun(tok, run); run = '';
        const pd = prev && prev[prev.length - (digits.length - di)];
        const [box, col] = wheel(pd == null ? 0 : pd); tok.append(box); cols.push(col); di++;
      } else run += ch;
    });
    addTextRun(tok, run); el.append(tok);
  }
  addTextRun(el, text.slice(pos));
  el._tk = { sig, cols, digits };
  void el.offsetWidth; /* commit the starting positions, then roll */
  cols.forEach((c, i) => spin(c, digits[i], Math.min(i, 8) * 16));
  if (key) last.set(key, digits);
}
