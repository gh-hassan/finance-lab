// @ts-nocheck
/* Shows a number in an element. The text changes at once, with a very short soft flash when the value really changes,
   so figures never keep rolling while someone drags a slider or types. `key` marks the same spot across renders. */
import { reduced } from './visuals.js';

/** Show `text` in `el`. Same text does nothing at all. */
export function tick(el, text, key) {
  text = String(text == null ? '' : text);
  if (el.textContent === text) return;
  el.textContent = text;
  el.removeAttribute('aria-label');
  el._tk = null;
  if (!key || reduced()) return;
  el.classList.remove('tk-pop');
  void el.offsetWidth; /* restart the flash */
  el.classList.add('tk-pop');
}
