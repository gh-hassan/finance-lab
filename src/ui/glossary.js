// @ts-nocheck
/* Glossary: every "word to know" from the lessons and calculators in one searchable place, plus hover cards
   that explain a term right where it appears in a sentence. */
import { MODS } from '../lib/registry';
import { BEGINNER } from './beginner.js';
import { SCENES, SCENE_ORDER } from './scenes.js';
import { h } from './visuals.js';

const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
/* common everyday words that would link too often to be useful */
const SKIP = new Set(['time', 'return', 'savings', 'positive', 'average', 'risk', 'stock', 'loan', 'price', 'profit', 'cost', 'value', 'range']);

let cache = null;

/** All terms: [{ term, key, def, where: [{ label, href }] }], merged by lower-case name and sorted A to Z. */
export function glossary() {
  if (cache) return cache;
  const map = new Map();
  const add = (term, def, where) => {
    const key = term.trim().toLowerCase();
    if (!key || !def) return;
    const e = map.get(key) || { term: term.trim(), key, def, where: [] };
    if (!e.where.some(w => w.href === where.href)) e.where.push(where);
    map.set(key, e);
  };
  MODS.forEach(m => ((BEGINNER[m.id] || {}).words || []).forEach(([t, d]) => add(t, d, { label: (BEGINNER[m.id] || {}).ask || m.title, href: '/' + m.id })));
  SCENE_ORDER.forEach(id => ((SCENES[id] || {}).words || []).forEach(([t, d]) => add(t, d, { label: SCENES[id].title, href: '/learn#idea-' + id })));
  cache = [...map.values()].sort((a, b) => a.term.localeCompare(b.term));
  return cache;
}

/** Match phrases for a term: the name itself and anything in brackets, e.g. "Stock (share)" matches "stock" and "share". */
function phrases(e) {
  const out = [], base = e.term.replace(/\s*\(.*?\)\s*/g, ' ').trim(), alt = /\((.*?)\)/.exec(e.term);
  [base, alt && alt[1]].filter(Boolean).forEach(p => { const k = p.toLowerCase(); if (k.length >= 4 && !SKIP.has(k)) out.push(k); });
  return out;
}

let matcher = null;
function buildMatcher() {
  if (matcher) return matcher;
  const byPhrase = new Map();
  glossary().forEach(e => phrases(e).forEach(p => { if (!byPhrase.has(p)) byPhrase.set(p, e); }));
  const keys = [...byPhrase.keys()].sort((a, b) => b.length - a.length).map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  matcher = { byPhrase, re: keys.length ? new RegExp(`(^|[^A-Za-z])(${keys.join('|')})(?![A-Za-z])`, 'gi') : null };
  return matcher;
}

/* ----- hover cards ----- */
let card = null, hideTimer = 0;
function showCard(el) {
  clearTimeout(hideTimer);
  const e = buildMatcher().byPhrase.get(el.dataset.gl);
  if (!e) return;
  if (!card) {
    card = h('div', { class: 'glcard', role: 'tooltip' });
    card.addEventListener('pointerenter', () => clearTimeout(hideTimer));
    card.addEventListener('pointerleave', () => hideCard());
    document.body.append(card);
  }
  card.innerHTML = '';
  card.append(h('b', {}, e.term), h('p', {}, e.def), h('a', { href: '/glossary#' + slug(e.term), 'data-link': true }, 'See in the glossary →'));
  card.classList.add('on');
  const r = el.getBoundingClientRect(), w = card.offsetWidth, hh = card.offsetHeight;
  let x = Math.min(innerWidth - w - 12, Math.max(12, r.left + r.width / 2 - w / 2)), y = r.bottom + 10;
  if (y + hh > innerHeight - 12 && r.top - hh - 10 > 12) y = r.top - hh - 10;
  card.style.left = x + 'px'; card.style.top = y + 'px';
}
function hideCard(now) { clearTimeout(hideTimer); hideTimer = setTimeout(() => card && card.classList.remove('on'), now ? 0 : 160); }

let wired = false;
function wire() {
  if (wired) return; wired = true;
  document.addEventListener('pointerover', e => { const t = e.target.closest && e.target.closest('.gl'); if (t && e.pointerType === 'mouse') showCard(t); });
  document.addEventListener('pointerout', e => { const t = e.target.closest && e.target.closest('.gl'); if (t && e.pointerType === 'mouse') hideCard(); });
  document.addEventListener('focusin', e => { if (e.target.classList && e.target.classList.contains('gl')) showCard(e.target); });
  document.addEventListener('focusout', e => { if (e.target.classList && e.target.classList.contains('gl')) hideCard(); });
  document.addEventListener('click', e => { const t = e.target.closest && e.target.closest('.gl'); if (t) { e.preventDefault(); card && card.classList.contains('on') && card._for === t ? hideCard(true) : (showCard(t), card._for = t); } else if (!e.target.closest || !e.target.closest('.glcard')) hideCard(true); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') hideCard(true); });
  addEventListener('scroll', () => hideCard(true), { passive: true });
}

/** Underline the first mention of each known term inside the given elements. Safe to call again. */
export function enhanceTerms(root, selector = '.plain, .how li, .blurb, .concept p, .lead') {
  const { byPhrase, re } = buildMatcher();
  if (!re) return;
  wire();
  const seen = new Set(); /* one underline per term per page keeps the text calm */
  root.querySelectorAll(selector).forEach(box => {
    if (box.dataset.gl) return; box.dataset.gl = '1';
    const walker = document.createTreeWalker(box, NodeFilter.SHOW_TEXT, { acceptNode: n => (n.parentElement.closest('a,button,summary,.gl,code,svg') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT) }), nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(n => {
      const text = n.nodeValue; re.lastIndex = 0; let m, last = 0; const frag = document.createDocumentFragment();
      while ((m = re.exec(text))) {
        const key = m[2].toLowerCase(), e = byPhrase.get(key);
        if (!e || seen.has(e.key)) continue; seen.add(e.key);
        const start = m.index + m[1].length;
        frag.append(text.slice(last, start));
        const span = h('span', { class: 'gl', tabindex: '0', role: 'button', 'aria-label': `${e.term}: ${e.def}` }, text.slice(start, start + m[2].length)); span.dataset.gl = key;
        frag.append(span); last = start + m[2].length;
      }
      if (last) { frag.append(text.slice(last)); n.replaceWith(frag); }
    });
  });
}

/* ----- the glossary page ----- */
export function renderGlossary(main) {
  const all = glossary(), letters = [...new Set(all.map(e => e.term[0].toUpperCase()))];
  const input = h('input', { type: 'search', class: 'gl-search', placeholder: 'Search a word, like “beta” or “discount”', 'aria-label': 'Search the glossary', autocomplete: 'off' });
  const count = h('p', { class: 'gl-count' }), list = h('div', { class: 'gl-list' }), jump = h('nav', { class: 'gl-jump', 'aria-label': 'Jump to a letter' });
  const draw = () => {
    const q = input.value.trim().toLowerCase(), rows = all.filter(e => !q || e.key.includes(q) || e.def.toLowerCase().includes(q));
    list.innerHTML = '';
    rows.sort((a, b) => (q ? (b.key.startsWith(q) - a.key.startsWith(q)) || (b.key.includes(q) - a.key.includes(q)) : 0) || a.term.localeCompare(b.term));
    rows.forEach(e => list.append(h('article', { class: 'card gl-item', id: slug(e.term) }, h('h3', {}, e.term), h('p', {}, e.def),
      h('div', { class: 'gl-where' }, h('span', {}, 'Where you will see it'), e.where.slice(0, 4).map(w => h('a', { href: w.href, 'data-link': true }, w.label))))));
    if (!rows.length) list.append(h('p', { class: 'gl-empty' }, 'No word matches that. Try a shorter search.'));
    count.textContent = q ? `${rows.length} match${rows.length === 1 ? '' : 'es'}` : `${all.length} words in plain English`;
    jump.hidden = !!q;
  };
  letters.forEach(l => jump.append(h('a', { href: '#', onclick: ev => { ev.preventDefault(); const t = all.find(e => e.term[0].toUpperCase() === l); const el = t && document.getElementById(slug(t.term)); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' }); } }, l)));
  input.addEventListener('input', draw);
  main.innerHTML = '';
  main.append(h('header', { class: 'learn-hero reveal' }, h('p', { class: 'eyebrow' }, 'Plain words'), h('h1', { html: 'Finance, <em>translated</em>' }), h('p', { class: 'lead' }, 'Every term from the lessons and calculators, explained the way you would to a friend.')),
    h('div', { class: 'gl-bar reveal' }, input, count), jump, list);
  draw();
  if (location.hash) setTimeout(() => { const el = document.getElementById(location.hash.slice(1)); if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.classList.add('flash'); } }, 400);
  return () => { };
}
