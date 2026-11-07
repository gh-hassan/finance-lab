// @ts-nocheck
/* App shell: top pill navigation, topic menus, search palette, theme, routing, pointer effects. */
import { MODS } from '../lib/registry';
import { h, esc, store } from './visuals.js';
import { TOPICS, BEGINNER } from './beginner.js';
import { ICONS } from './icons.js';
import { mountModule } from './module.js';
import { renderHome } from './home.js';
import { renderLearn } from './learn.js';
import { renderScenarios } from './scenarios.js';
import { renderCompare } from './compare.js';
import { renderQuiz } from './quiz.js';
import { renderCases } from './cases.js';
import { renderVideos } from './videos.js';
import { renderCalculator } from './calculator.js';
import { renderGlossary, enhanceTerms } from './glossary.js';

let cleanup = () => { };
let view;

const CARET = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';

export function startApp(root) {
  const topics = Object.keys(TOPICS);
  const theme = () => document.documentElement.dataset.theme || 'light';
  const themeBtn = h('button', { class: 'iconbtn', type: 'button', 'aria-label': 'Toggle dark mode', html: theme() === 'dark' ? ICONS.sun : ICONS.moon, onclick: () => { const t = theme() === 'dark' ? 'light' : 'dark'; const root = document.documentElement; root.classList.add('theme-fade'); document.documentElement.dataset.theme = t; setTimeout(() => root.classList.remove('theme-fade'), 600); store.set('fl:theme', t); themeBtn.innerHTML = t === 'dark' ? ICONS.sun : ICONS.moon; } });
  const searchBtn = h('button', { class: 'iconbtn', type: 'button', 'aria-label': 'Search calculators (press /)', 'data-open-search': true, html: ICONS.search });

  const pop = h('div', { class: 'menu mega', hidden: true });
  const pop2 = h('div', { class: 'menu more', hidden: true });
  const calcBtn = h('button', { class: 'pill', type: 'button', 'data-id': 'calc', 'data-menu': 'calc', 'aria-haspopup': 'true' }, h('span', { html: ICONS.Valuation }), h('em', {}, 'Calculators'), h('span', { class: 'caret', html: CARET }));
  let calcGroup = '';
  const ask = m => (BEGINNER[m.id] || {}).ask || m.title;
  function drawCalc(q = '') {
    const term = q.trim().toLowerCase(), active = calcGroup || topics[0];
    const hit = term ? MODS.filter(m => (ask(m) + ' ' + m.title + ' ' + (m.blurb || '')).toLowerCase().includes(term)) : MODS.filter(m => m.group === active);
    const rail = topics.map(g => { const n = MODS.filter(m => m.group === g).length; return `<button type="button" class="mr tint-${TOPICS[g].tint}${!term && g === active ? ' on' : ''}" data-g="${esc(g)}"><i class="dot"></i><span>${esc(TOPICS[g].label)}</span><em>${n}</em></button>`; }).join('');
    const links = hit.map(m => `<a href="/${m.id}" data-link><b>${esc(ask(m))}</b>${term ? `<small>${esc(TOPICS[m.group] ? TOPICS[m.group].label : m.group)}</small>` : ''}</a>`).join('') || '<p class="mnone">No calculator matches that. Try a shorter word.</p>';
    pop.querySelector('.mrail').innerHTML = rail;
    const list = pop.querySelector('.mlist');
    list.innerHTML = `<h4>${term ? `${hit.length} match${hit.length === 1 ? '' : 'es'}` : esc(TOPICS[active].label)}</h4><div class="mlinks">${links}</div>`;
    list.classList.remove('swap'); void list.offsetWidth; list.classList.add('swap');
  }
  calcBtn.addEventListener('click', e => {
    e.stopPropagation();
    if (!pop.hidden) { pop.hidden = true; return; }
    pop2.hidden = true;
    const here = MODS.find(m => m.id === location.pathname.replace(/^\/+|\/+$/g, ''));
    calcGroup = here ? here.group : calcGroup || topics[0];
    pop.innerHTML = '<a class="mpin" href="/calculator" data-link><span class="mpi">' + ICONS.Valuation + '</span><span><b>Financial calculator</b><small>A working BA II Plus style calculator, free</small></span></a><div class="msearch"><input type="search" placeholder="Find a calculator…" aria-label="Find a calculator" autocomplete="off"></div><div class="mbody"><nav class="mrail" aria-label="Categories"></nav><div class="mlist"></div></div>';
    drawCalc();
    const inp = pop.querySelector('input');
    inp.addEventListener('input', () => drawCalc(inp.value));
    pop.querySelector('.mrail').addEventListener('click', ev => { const b = ev.target.closest('.mr'); if (b) { calcGroup = b.dataset.g; inp.value = ''; drawCalc(); } });
    pop.querySelector('.mrail').addEventListener('pointerover', ev => { const b = ev.target.closest('.mr'); if (b && ev.pointerType === 'mouse' && b.dataset.g !== calcGroup && !inp.value) { calcGroup = b.dataset.g; drawCalc(); } });
    pop.hidden = false;
  });
  /* close on any outside touch or press (iOS skips click on plain areas), Escape, scrolling and rotation */
  const closeMenu = () => { pop.hidden = true; pop2.hidden = true; };
  document.addEventListener('pointerdown', e => { if ((!pop.hidden || !pop2.hidden) && !e.target.closest('.menu') && !e.target.closest('[data-menu]')) closeMenu(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeMenu(); });
  addEventListener('resize', closeMenu); addEventListener('orientationchange', closeMenu);
  /* two small dropdowns: Learn (lessons, glossary) and Decide (scenarios, compare) */
  const MENUS = {
    learn: [['/learn', 'learn', 'Lessons', 'Short pictures of the big ideas'], ['/videos', 'video', 'Videos', 'Tutorials from our YouTube channel'], ['/quiz', 'quiz', 'Quiz', 'Test what you have learned'], ['/cases', 'cases', 'Cases', 'Real situations, step by step'], ['/glossary', 'glossary', 'Glossary', 'Every term in plain words']],
    decide: [['/scenarios', 'scenarios', 'Scenarios', 'Best case, worst case and risk'], ['/compare', 'compare', 'Compare', 'Two options side by side']]
  };
  let openKey = '';
  const dropBtn = (key, icon, label) => {
    const btn = h('button', { class: 'pill', type: 'button', 'data-id': key, 'data-menu': key, 'aria-haspopup': 'true' }, h('span', { html: icon }), h('em', {}, label), h('span', { class: 'caret', html: CARET }));
    btn.addEventListener('click', () => {
      if (!pop2.hidden && openKey === key) { pop2.hidden = true; return; }
      pop.hidden = true; openKey = key;
      pop2.innerHTML = MENUS[key].map(([href, ic, t, d]) => `<a href="${href}" data-link><span class="mi">${ICONS[ic]}</span><span><b>${t}</b><small>${d}</small></span></a>`).join('');
      const bb = btn.getBoundingClientRect(), r = bar.getBoundingClientRect();
      pop2.style.left = Math.max(8, Math.min(r.width - 336, bb.left - r.left - 20)) + 'px';
      pop2.hidden = false;
    });
    return btn;
  };
  const learnBtn = dropBtn('learn', ICONS.learn, 'Learn'), decideBtn = dropBtn('decide', ICONS.scenarios, 'Decide');
  const syncOpen = () => {
    calcBtn.setAttribute('aria-expanded', String(!pop.hidden));
    [learnBtn, decideBtn].forEach(b => b.setAttribute('aria-expanded', String(!pop2.hidden && openKey === b.dataset.menu)));
  };
  [pop, pop2].forEach(el => new MutationObserver(syncOpen).observe(el, { attributes: true, attributeFilter: ['hidden'] }));
  syncOpen();
  const navItems = [
    h('a', { class: 'pill on', href: '/', 'data-link': true, 'data-id': 'home' }, h('span', { html: ICONS.home }), h('em', {}, 'Home')),
    learnBtn,
    calcBtn,
    decideBtn
  ];

  const bar = h('header', { class: 'topbar' }, h('a', { class: 'brand', href: '/', 'data-link': true }, h('span', { class: 'logo', html: '<img src="/logo.png" alt="" width="38" height="38">' }), 'SmartWealth'), h('nav', { class: 'pillnav', 'aria-label': 'Topics' }, navItems), h('div', { class: 'tools' }, searchBtn, themeBtn), pop, pop2);
  view = h('main', { id: 'view', tabindex: '-1' });
  const foot = h('footer', { class: 'foot' }, h('p', {}, 'For study and practice. Results depend on your inputs and simplifying assumptions, and are not investment advice.'));
  const shell = h('div', { class: 'shell' }, bar, view, foot);
  root.append(shell);

  /* ----- search palette ----- */
  const input = h('input', { type: 'search', placeholder: 'What do you want to figure out?', 'aria-label': 'Search calculators', autocomplete: 'off' }), list = h('div', { class: 'plist', role: 'listbox' });
  const palette = h('div', { class: 'palette', hidden: true }, h('div', { class: 'pbox' }, h('div', { class: 'pin', html: ICONS.search }, input, h('kbd', {}, 'esc')), list));
  document.body.append(palette);
  let sel = 0, shown = [], extra = [];
  const renderList = () => {
    const q = input.value.trim().toLowerCase();
    extra = [{ id: 'learn', title: 'Learn the basics', blurb: 'lessons basics' , group: 'Foundations' }, { id: 'scenarios', title: 'Scenarios', blurb: 'what if best worst risk', group: 'Investments' }, { id: 'compare', title: 'Compare two options', blurb: 'side by side better which', group: 'Investments' }, { id: 'glossary', title: 'Glossary', blurb: 'words meaning terms dictionary', group: 'Foundations' }, { id: 'calculator', title: 'Financial calculator (BA II Plus style)', blurb: 'tvm npv irr bond amortization depreciation texas instruments ba2 handheld', group: 'Foundations' }, { id: 'videos', title: 'Video tutorials', blurb: 'youtube watch lessons channel', group: 'Foundations' }, { id: 'quiz', title: 'Quiz', blurb: 'test practice questions exam', group: 'Foundations' }, { id: 'cases', title: 'Cases', blurb: 'case studies business situations', group: 'Foundations' }].filter(x => !q || (x.title + ' ' + x.blurb).toLowerCase().includes(q));
    shown = [...extra, ...MODS.filter(m => !q || (m.title + ' ' + m.blurb + ' ' + ((BEGINNER[m.id] || {}).ask || '') + ' ' + TOPICS[m.group].label).toLowerCase().includes(q))];
    sel = Math.min(sel, Math.max(0, shown.length - 1));
    list.innerHTML = shown.length ? shown.map((m, i) => `<a href="/${m.id}" data-link class="${i === sel ? 'on' : ''} tint-${TOPICS[m.group].tint}"><i class="dot"></i><div><b>${esc((BEGINNER[m.id] || {}).ask || m.title)}</b><small>${m.blurb && !BEGINNER[m.id] ? esc(m.blurb) : esc(m.title) + ' · ' + esc(TOPICS[m.group].label)}</small></div></a>`).join('') : '<p class="none">No match. Try “loan”, “stock” or “risk”.</p>';
  };
  const openSearch = () => { palette.hidden = false; input.value = ''; sel = 0; renderList(); input.focus(); };
  const closeSearch = () => { palette.hidden = true; };
  input.addEventListener('input', () => { sel = 0; renderList(); });
  palette.addEventListener('click', e => { if (e.target === palette || e.target.closest('a')) closeSearch(); });
  document.addEventListener('keydown', e => {
    const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName);
    if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && !typing)) { e.preventDefault(); openSearch(); }
    else if (!palette.hidden) {
      if (e.key === 'Escape') closeSearch();
      else if (e.key === 'ArrowDown') { e.preventDefault(); sel = Math.min(shown.length - 1, sel + 1); renderList(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); sel = Math.max(0, sel - 1); renderList(); }
      else if (e.key === 'Enter' && shown[sel]) { navigate('/' + shown[sel].id); closeSearch(); }
    }
  });
  document.addEventListener('click', e => { if (e.target.closest('[data-open-search]')) openSearch(); });

  /* ----- routing ----- */
  document.addEventListener('click', e => {
    const a = e.target.closest('a[data-link]');
    if (!a || e.metaKey || e.ctrlKey || e.shiftKey || e.button) return;
    e.preventDefault(); pop.hidden = true; pop2.hidden = true; navigate(a.getAttribute('href'));
  });
  addEventListener('popstate', route);
  route();

  /* ----- pointer effects: tilt, parallax, glow ----- */
  let ticking = false;
  document.addEventListener('pointermove', e => {
    if (ticking || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      document.documentElement.style.setProperty('--mx', (e.clientX / innerWidth - 0.5).toFixed(3));
      document.documentElement.style.setProperty('--my', (e.clientY / innerHeight - 0.5).toFixed(3));
      document.documentElement.style.setProperty('--gx', e.clientX + 'px'); document.documentElement.style.setProperty('--gy', e.clientY + 'px');
      document.querySelectorAll('.tilt.hot').forEach(t => { if (t !== e.target.closest('.tilt')) { t.classList.remove('hot'); t.style.transform = ''; } });
      const t = e.target.closest && e.target.closest('.tilt');
      if (t) { const r = t.getBoundingClientRect(), px = (e.clientX - r.left) / r.width - 0.5, py = (e.clientY - r.top) / r.height - 0.5; t.classList.add('hot'); t.style.transform = `perspective(700px) rotateX(${(-py * 8).toFixed(2)}deg) rotateY(${(px * 10).toFixed(2)}deg) translateY(-3px)`; }
    });
  });
}

export function navigate(path) {
  if (path !== location.pathname) history.pushState({}, '', path);
  route();
}

function route() {
  const id = location.pathname.replace(/^\/+|\/+$/g, '') || 'home', m = MODS.find(x => x.id === id), isLearn = id === 'learn', isSc = id === 'scenarios', isCmp = id === 'compare', isGl = id === 'glossary', isQz = id === 'quiz', isCs = id === 'cases', isVd = id === 'videos', isBa = id === 'calculator';
  cleanup(); cleanup = () => { };
  document.querySelectorAll('.pill').forEach(p => p.classList.toggle('on', (m || isBa) ? p.dataset.id === 'calc' : p.dataset.id === ((isLearn || isGl || isQz || isCs || isVd) ? 'learn' : (isSc || isCmp) ? 'decide' : 'home')));
  const rerender = () => route();
  if (m) { document.title = `${m.title} · SmartWealth`; cleanup = mountModule(m, view, rerender); }
  else if (isSc) { document.title = 'Scenarios · SmartWealth'; cleanup = renderScenarios(view); }
  else if (isCmp) { document.title = 'Compare · SmartWealth'; cleanup = renderCompare(view); }
  else if (isBa) { document.title = 'Financial calculator · SmartWealth'; cleanup = renderCalculator(view); }
  else if (isVd) { document.title = 'Video tutorials · SmartWealth'; cleanup = renderVideos(view); }
  else if (isQz) { document.title = 'Quiz · SmartWealth'; cleanup = renderQuiz(view); }
  else if (isCs) { document.title = 'Cases · SmartWealth'; cleanup = renderCases(view); }
  else if (isGl) { document.title = 'Glossary · SmartWealth'; cleanup = renderGlossary(view); }
  else if (isLearn) { document.title = 'Learn the basics · SmartWealth'; cleanup = renderLearn(view); }
  else { document.title = 'SmartWealth · Learn money by playing with it'; renderHome(view, navigate); }
  if (!isGl && !isQz && !isBa) enhanceTerms(view);
  view.querySelectorAll('.reveal').forEach((el, i) => el.style.setProperty('--d', Math.min(i, 10) * 55 + 'ms'));
  if (location.hash && id === 'learn') setTimeout(() => { const el = document.getElementById(location.hash.slice(1)); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 600);
  else window.scrollTo({ top: 0 });
}
