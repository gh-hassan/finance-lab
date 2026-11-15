// @ts-nocheck
/* Puts a number box beside a slider, so a value can be dragged or typed. Both stay in step. Typing past the ends is held at the ends, and the allowed range is shown. */
import '../styles/slidebox.css';
import { h } from './dataui.js';

const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

/** slider: the object from rangeSlider. unit: a short suffix such as '%'. decimals: places to show. Returns { el, input } so existing code keeps working. */
export function withNumberBox(slider, { label, unit = '', decimals = 0 } = {}) {
  const input = slider.input;
  const box = h('input', { class: 'd-in sb-in', type: 'text', inputmode: 'decimal', 'aria-label': `${label || 'Value'}: type a number` });
  const range = h('small', { class: 'sb-range' });
  const show = () => { box.value = (+input.value).toFixed(decimals).replace(/\.0+$/, ''); box.removeAttribute('aria-invalid'); };
  const note = () => { range.textContent = `From ${(+input.min).toFixed(decimals)}${unit} to ${(+input.max).toFixed(decimals)}${unit}`; };
  const commit = () => {
    const n = parseFloat(String(box.value).replace(/[,%$\s]/g, '').replace('−', '-'));
    if (!Number.isFinite(n)) { show(); return; }
    const c = clamp(n, +input.min, +input.max);
    input.value = String(c);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    show();
    if (c !== n) { box.setAttribute('aria-invalid', 'true'); note(); }
  };
  input.addEventListener('input', () => { if (document.activeElement !== box) show(); });
  box.addEventListener('change', commit);
  box.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); commit(); } });
  box.addEventListener('focus', () => box.select());
  show(); note();
  const el = h('div', { class: 'sb' }, slider.el, h('label', { class: 'sb-box' }, box, unit ? h('span', { 'aria-hidden': 'true' }, unit) : null), range);
  return { el, input };
}
