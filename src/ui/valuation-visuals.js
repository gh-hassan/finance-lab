// @ts-nocheck
/* The pictures on the "Value a business" page. Each takes plain numbers and a money formatter ($) and returns an element. */
import { h } from './dataui.js';
import { pct } from '../lib/format';

const scaleTo = (lo, hi) => x => Math.min(100, Math.max(0, ((x - lo) / (hi - lo || 1)) * 100));

/** The three prices on one ruler, with an optional marker for the price being asked. */
export function ruler(z, mark, label, $) {
  const lo = Math.min(z.bargain * 0.75, mark ? mark * 0.9 : Infinity), max = Math.max(z.ceiling * 1.25, (mark || 0) * 1.08), p = scaleTo(lo, max);
  const seg = (a, b, cls, text) => h('i', { class: 'bv-seg ' + cls, style: `left:${p(a)}%;width:${p(b) - p(a)}%` }, h('span', {}, text));
  const flag = mark ? h('div', { class: 'bv-mark', style: `left:${p(mark)}%` }, h('span', {}, label)) : null;
  return h('div', { class: 'bv-ruler', role: 'img', 'aria-label': `Price zones. Bargain up to ${$(z.bargain)}, good buy up to ${$(z.sweet)}, stretch up to ${$(z.ceiling)}, above that too expensive.${mark ? ` ${label} ${$(mark)}.` : ''}` },
    h('div', { class: 'bv-bar' }, seg(lo, z.bargain, 'z1', 'Bargain'), seg(z.bargain, z.sweet, 'z2', 'Good buy'), seg(z.sweet, z.ceiling, 'z3', 'Stretch'), seg(z.ceiling, max, 'z4', 'Too high'), flag));
}

/** Each way of valuing the business as a range, over the band of prices worth paying. */
export function football(v, ask, $) {
  const z = v.zones, max = Math.max(...v.methods.map(m => m.high), z.ceiling * 1.15, ask || 0) * 1.05, p = scaleTo(0, max);
  const rows = v.methods.map(m => h('div', { class: 'bv-ff' },
    h('div', { class: 'bv-ffn' }, h('b', {}, m.name), h('small', {}, m.note)),
    h('div', { class: 'bv-fft', 'aria-hidden': 'true' }, h('i', { class: 'bv-band', style: `left:${p(z.bargain)}%;width:${p(z.ceiling) - p(z.bargain)}%` }), h('i', { class: 'bv-rng' + (m.id === 'assets' ? ' floor' : ''), style: `left:${p(m.low)}%;width:${Math.max(0.6, p(m.high) - p(m.low))}%` }), h('i', { class: 'bv-mid', style: `left:${p(m.mid)}%` }), ask ? h('i', { class: 'bv-askline', style: `left:${p(ask)}%` }) : null),
    h('div', { class: 'bv-ffv' }, `${$(m.low)} to ${$(m.high)}`, h('small', {}, `Best guess ${$(m.mid)}`))));
  return [h('div', { class: 'bv-ffs' }, rows), h('p', { class: 'bv-legend' }, h('i', { class: 'k1' }), 'range from cautious to hopeful', h('i', { class: 'k2' }), 'best guess', h('i', { class: 'k3' }), 'the price range worth paying', ask ? h('i', { class: 'k4' }) : null, ask ? 'asking price' : null)];
}

/** Reported profit stepping down (or up) to owner earnings. */
export function bridge(steps, $) {
  const starts = steps.map((s, i) => (i === 0 || s.final ? 0 : steps[i - 1].total));
  const all = [0, ...steps.map(s => s.total), ...starts], lo = Math.min(...all), hi = Math.max(...all), p = scaleTo(lo, hi);
  return h('div', { class: 'bv-bridge', role: 'list' }, steps.map((s, i) => {
    const a = starts[i], b = s.total, total = i === 0 || s.final;
    const tone = total ? 'tot' : s.delta >= 0 ? 'up' : 'down';
    return h('div', { class: 'bv-br', role: 'listitem' }, h('span', { class: 'bv-brl' }, s.label),
      h('div', { class: 'bv-brt', 'aria-hidden': 'true' }, h('i', { class: 'bv-zero', style: `left:${p(0)}%` }), h('i', { class: 'bv-brb ' + tone, style: `left:${p(Math.min(a, b))}%;width:${Math.max(0.8, p(Math.max(a, b)) - p(Math.min(a, b)))}%` })),
      h('b', { class: 'bv-brv ' + tone }, total ? $(b) : (s.delta > 0 ? '+' : '') + $(s.delta)));
  }));
}

/** The value of the whole business in a worse, expected and better case, against the price being asked. */
export function scenarioBars(list, ask, $) {
  const max = Math.max(...list.map(s => s.fair), ask || 0) * 1.08 || 1, p = scaleTo(0, max);
  return h('div', { class: 'bv-sc' }, list.map(s => h('div', { class: 'bv-scr' },
    h('span', { class: 'bv-scl' }, s.name),
    h('div', { class: 'bv-sct', 'aria-hidden': 'true' }, h('i', { class: 'bv-scb ' + s.id, style: `width:${p(s.fair)}%` }), h('i', { class: 'bv-sctick', style: `left:${p(s.sweet)}%` }), ask ? h('i', { class: 'bv-askline', style: `left:${p(ask)}%` }) : null),
    h('span', { class: 'bv-scv' }, h('b', {}, $(s.fair)), h('small', {}, `Sweet spot ${$(s.sweet)}`)))));
}

/** Who owns the business before and after new money goes in. */
export function ownership(youShare, $, money) {
  const you = Math.min(1, Math.max(0, youShare)), row = (name, parts) => h('div', { class: 'bv-ow' }, h('span', { class: 'bv-scl' }, name),
    h('div', { class: 'bv-owt', role: 'img', 'aria-label': parts.map(x => `${x.name} ${pct(x.share, 1)}`).join(', ') }, parts.filter(x => x.share > 0).map(x => h('i', { class: 'bv-owp ' + x.cls, style: `width:${x.share * 100}%` }, h('span', { title: x.name }, x.share < 0.22 ? pct(x.share, 0) : `${x.name} ${pct(x.share, 0)}`)))));
  return h('div', { class: 'bv-owg' }, row('Today', [{ name: 'Current owners', share: 1, cls: 'old' }]), row(`After ${$(money)} goes in`, [{ name: 'Current owners', share: 1 - you, cls: 'old' }, { name: 'You', share: you, cls: 'you' }]));
}
