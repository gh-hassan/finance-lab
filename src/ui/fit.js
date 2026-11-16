// @ts-nocheck
/* Keeps big numbers inside their boxes. A number that is too wide for its box has its font made smaller until it fits, so nothing is ever cut off.
   It watches the page for changes, so it covers every tool, whatever code put the number there. */
const SEL = '.big, .sv';
const MIN = 15;
let queued = 0;

function fit(el) {
  const box = el.parentElement;
  if (!box || !el.isConnected) return;
  const room = Math.floor(Math.min(el.clientWidth || box.clientWidth, box.clientWidth));
  if (room < 20) return; /* hidden or not laid out yet */
  const key = el.textContent + '|' + room;
  if (el._fit === key) return;
  el.style.fontSize = '';
  const natural = parseFloat(getComputedStyle(el).fontSize), need = el.scrollWidth;
  if (need > room + 1) el.style.fontSize = Math.max(MIN, Math.floor(natural * (room / need) * 0.97 * 10) / 10) + 'px';
  el._fit = key;
}

function run() { queued = 0; document.querySelectorAll(SEL).forEach(fit); }
const later = () => { if (!queued) queued = requestAnimationFrame(run); };

if (typeof window !== 'undefined' && typeof MutationObserver !== 'undefined') {
  new MutationObserver(later).observe(document.documentElement, { subtree: true, childList: true, characterData: true });
  window.addEventListener('resize', later);
  window.addEventListener('load', later);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(later);
}

export const fitAll = run;
