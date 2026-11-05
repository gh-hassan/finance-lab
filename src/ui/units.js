// @ts-nocheck
/* Units for money and share counts. The maths never changes (it only sees numbers), so a unit is a label: pick Thousands
   and every "$M" / "(M)" on the page reads "$K" / "(K)". Switching also converts what is already typed in. */
export const UNIT_LIST = [['1', '$', 'Dollars'], ['K', 'K', 'Thousands'], ['M', 'M', 'Millions'], ['B', 'B', 'Billions']];
const SCALE = { 1: 1, K: 1e3, M: 1e6, B: 1e9 };
const SFX = { 1: '', K: 'K', M: 'M', B: 'B' };
const WORD = { 1: 'dollars', K: 'thousands', M: 'millions', B: 'billions' };
const TOKEN = /\(\$?M\)/;

export const fieldsHaveUnits = fields => (fields || []).some(f => TOKEN.test(f.label || ''));
export const unitFactor = (from, to) => SCALE[from] / SCALE[to];
export const isUnitField = f => TOKEN.test(f.label || '');

/** Rewrite unit words in one string. Millions is the authored unit, so it is a no-op there. */
export function unitizeText(s, u) {
  if (u === 'M' || typeof s !== 'string') return s;
  const sfx = SFX[u];
  return s
    .replace(/\(\$M\)/g, `($${sfx})`)
    .replace(/\(M\)/g, u === '1' ? '(count)' : `(${sfx})`)
    .replace(/in millions/g, `in ${WORD[u]}`)
    .replace(/(\d)M\b/g, (_, d) => d + sfx);
}

/** Same, through any nested object, array or string. Functions and numbers pass through untouched. */
export function unitize(x, u) {
  if (u === 'M' || x == null) return x;
  if (typeof x === 'string') return unitizeText(x, u);
  if (Array.isArray(x)) return x.map(v => unitize(v, u));
  if (typeof x === 'object' && Object.getPrototypeOf(x) === Object.prototype) {
    const o = {};
    for (const k in x) o[k] = unitize(x[k], u);
    return o;
  }
  return x;
}
