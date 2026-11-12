// @ts-nocheck
/* A short, factual line about who stands behind the lessons. Wording and link come from lib/brand.ts, so it is changed in one place. */
import { h } from './visuals.js';
import { BRAND } from '../lib/brand';

export function facultyNote() {
  const f = BRAND.faculty;
  return h('p', { class: 'fac-note' }, h('b', {}, `${BRAND.lessons} lessons`), ' support the finance teaching of ',
    h('a', { href: f.url, target: '_blank', rel: 'noopener noreferrer' }, f.name), `, ${f.role}.`);
}
