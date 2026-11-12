// @ts-nocheck
/* A quiet credit line about who stands behind the lessons. Wording and link come from lib/brand.ts, so it is changed in one place. */
import { h } from './visuals.js';
import { BRAND } from '../lib/brand';

export function facultyNote() {
  const f = BRAND.faculty;
  return h('p', { class: 'fac-note' }, h('span', {}, `${BRAND.lessons} lessons, supporting the finance courses of `), h('a', { href: f.url, target: '_blank', rel: 'noopener noreferrer' }, f.name), h('small', {}, f.role));
}
