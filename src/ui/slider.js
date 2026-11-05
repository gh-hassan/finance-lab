// @ts-nocheck
/* Custom range slider. A real <input type="range"> sits invisibly on top (so keyboard, touch and screen readers
   keep working) while a spring-animated track, fill, thumb and value bubble are drawn underneath. */
import { h } from './visuals.js';

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

export function rangeSlider({ min, max, step = 1, value, label = '', fmt = x => String(x) }) {
  const input = h('input', { type: 'range', class: 'rs-input', min, max, step, value, 'aria-label': label });
  const shine = h('i', { class: 'rs-shine' }), fill = h('i', { class: 'rs-fill' }, shine);
  const bubble = h('b', { class: 'rs-bubble', 'aria-hidden': 'true' }), thumb = h('div', { class: 'rs-thumb' });
  const el = h('div', { class: 'rs' }, h('div', { class: 'rs-track' }, fill), thumb, bubble, input);
  let last = null, calm = 0;
  const valueDesc = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');

  const sync = () => {
    const lo = +input.min, hi = +input.max, p = hi > lo ? clamp((+input.value - lo) / (hi - lo), 0, 1) : 0;
    el.style.setProperty('--p', p.toFixed(4));
    bubble.textContent = fmt(+input.value);
    if (last != null && p !== last) {
      const dp = p - last, a = Math.abs(dp);
      el.style.setProperty('--sx', (1 + Math.min(0.6, a * 16)).toFixed(3));
      el.style.setProperty('--sy', (1 - Math.min(0.28, a * 8)).toFixed(3));
      el.style.setProperty('--rot', clamp(dp * 70, -14, 14).toFixed(1) + 'deg');
      clearTimeout(calm);
      calm = setTimeout(() => { el.style.setProperty('--sx', '1'); el.style.setProperty('--sy', '1'); el.style.setProperty('--rot', '0deg'); }, 90);
    }
    last = p;
  };

  /* programmatic changes (for example typing in the number box) move the visuals too */
  Object.defineProperty(input, 'value', { get() { return valueDesc.get.call(this); }, set(v) { valueDesc.set.call(this, v); sync(); }, configurable: true });
  input.addEventListener('input', sync);
  const stop = () => el.classList.remove('drag');
  input.addEventListener('pointerdown', () => { el.classList.add('drag'); window.addEventListener('pointerup', stop, { once: true }); window.addEventListener('pointercancel', stop, { once: true }); });
  input.addEventListener('blur', stop);
  sync();
  return { el, input };
}
