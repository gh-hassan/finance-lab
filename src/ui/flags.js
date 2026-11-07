// @ts-nocheck
/* Country flags: SVGs from the open-source flag-icons set (MIT), bundled with the site and loaded only when shown. */
import { h } from './visuals.js';

const URLS = import.meta.glob('../assets/flags/*.svg', { query: '?url', import: 'default', eager: true });
const byCode = {};
for (const [path, url] of Object.entries(URLS)) byCode[path.split('/').pop().replace('.svg', '').toUpperCase()] = url;

/** A small flag image for a two-letter country code, or nothing when we have no flag for it. */
export function flag(code, size = 'md') {
  const src = byCode[String(code).toUpperCase()];
  return src ? h('img', { class: 'cty-flag' + (size === 'sm' ? ' sm' : ''), src, alt: '', width: size === 'sm' ? 18 : 22, height: size === 'sm' ? 14 : 16, loading: 'lazy', decoding: 'async' }) : null;
}
