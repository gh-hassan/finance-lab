// @ts-nocheck
/* App shell: top pill navigation, topic menus, search palette, theme, routing, pointer effects. */
import { MODS } from '../lib/registry';
import { h, esc, store } from './visuals.js';
import { TOPICS, BEGINNER } from './beginner.js';
import { ICONS } from './icons.js';
import { mountModule } from './module.js';
import { renderHome } from './home.js';
import { renderLearn } from './learn.js';

let cleanup = () => { };
let view;

export function startApp(root) {
  const topics = Object.keys(TOPICS);
  const theme = () => document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  const themeBtn = h('button', { class: 'iconbtn', type: 'button', 'aria-label': 'Toggle dark mode', html: theme() === 'dark' ? ICONS.sun : ICONS.moon, onclick: () => { const t = theme() === 'dark' ? 'light' : 'dark'; document.documentElement.dataset.theme = t; store.set('fl:theme', t); themeBtn.innerHTML = t === 'dark' ? ICONS.sun : ICONS.moon; } });
  const searchBtn = h('button', { class: 'iconbtn', type: 'button', 'aria-label': 'Search calculators (press /)', 'data-open-search': true, html: ICONS.search });

  const pop = h('div', { class: 'menu', hidden: true });
  const navItems = [h('a', { class: 'pill on', href: '/', 'data-link': true, 'data-id': 'home' }, h('span', { html: ICONS.home }), h('em', {}, 'Home'))];
  navItems.push(h('a', { class: 'pill', href: '/learn', 'data-link': true, 'data-id': 'learn' }, h('span', { html: ICONS.learn }), h('em', {}, 'Learn the basics')));
  topics.forEach(g => {
    const b = h('button', { class: 'pill', type: 'button', 'data-topic': g, 'aria-haspopup': 'true' }, h('span', { html: ICONS[g] }), h('em', {}, TOPICS[g].label));
    b.addEventListener('click', e => {
      e.stopPropagation();
      if (!pop.hidden && pop.dataset.g === g) { pop.hidden = true; return; }
      pop.dataset.g = g; pop.className = `menu tint-${TOPICS[g].tint}`;
      pop.innerHTML = `<p>${esc(TOPICS[g].blurb)}</p>` + MODS.filter(m => m.group === g).map(m => `<a href="/${m.id}" data-link><b>${esc(m.title)}</b><small>${esc((BEGINNER[m.id] || {}).ask || m.blurb)}</small></a>`).join('');
      const r = b.getBoundingClientRect(), pr = pop.parentElement.getBoundingClientRect();
      pop.style.left = Math.max(0, Math.min(r.left - pr.left, pr.width - 320)) + 'px'; pop.hidden = false;
    });
    navItems.push(b);
  });
  document.addEventListener('click', e => { if (!e.target.closest('.menu')) pop.hidden = true; });

  const bar = h('header', { class: 'topbar' }, h('a', { class: 'brand', href: '/', 'data-link': true }, h('span', { class: 'logo', html: '<i></i><i></i><i></i>' }), 'SmartWealth'), h('nav', { class: 'pillnav', 'aria-label': 'Topics' }, navItems), h('div', { class: 'tools' }, searchBtn, themeBtn), pop);
  view = h('main', { id: 'view', tabindex: '-1' });
  const foot = h('footer', { class: 'foot' }, h('p', {}, 'For study and practice. Results depend on your inputs and simplifying assumptions, and are not investment advice.'));
  const shell = h('div', { class: 'shell' }, bar, view, foot);
  root.append(shell);

  /* ----- search palette ----- */
  const input = h('input', { type: 'search', placeholder: 'What do you want to figure out?', 'aria-label': 'Search calculators', autocomplete: 'off' }), list = h('div', { class: 'plist', role: 'listbox' });
  const palette = h('div', { class: 'palette', hidden: true }, h('div', { class: 'pbox' }, h('div', { class: 'pin', html: ICONS.search }, input, h('kbd', {}, 'esc')), list));
  document.body.append(palette);
  let sel = 0, shown = [];
  const renderList = () => {
    const q = input.value.trim().toLowerCase();
    shown = MODS.filter(m => !q || (m.title + ' ' + m.blurb + ' ' + ((BEGINNER[m.id] || {}).ask || '') + ' ' + TOPICS[m.group].label).toLowerCase().includes(q));
    sel = Math.min(sel, Math.max(0, shown.length - 1));
    list.innerHTML = shown.length ? shown.map((m, i) => `<a href="/${m.id}" data-link class="${i === sel ? 'on' : ''} tint-${TOPICS[m.group].tint}"><i class="dot"></i><div><b>${esc((BEGINNER[m.id] || {}).ask || m.title)}</b><small>${esc(m.title)} · ${esc(TOPICS[m.group].label)}</small></div></a>`).join('') : '<p class="none">No match. Try “loan”, “stock” or “risk”.</p>';
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
    e.preventDefault(); pop.hidden = true; navigate(a.getAttribute('href'));
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
  const id = location.pathname.replace(/^\/+|\/+$/g, '') || 'home', m = MODS.find(x => x.id === id), isLearn = id === 'learn';
  cleanup(); cleanup = () => { };
  document.querySelectorAll('.pill').forEach(p => p.classList.toggle('on', m ? p.dataset.topic === m.group : p.dataset.id === (isLearn ? 'learn' : 'home')));
  const rerender = () => route();
  if (m) { document.title = `${m.title} · SmartWealth`; cleanup = mountModule(m, view, rerender); }
  else if (isLearn) { document.title = 'Learn the basics · SmartWealth'; cleanup = renderLearn(view); }
  else { document.title = 'SmartWealth · Learn money by playing with it'; renderHome(view, navigate); }
  view.querySelectorAll('.reveal').forEach((el, i) => el.style.setProperty('--d', Math.min(i, 10) * 55 + 'ms'));
  window.scrollTo({ top: 0 });
}
