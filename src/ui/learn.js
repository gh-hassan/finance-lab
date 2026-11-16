// @ts-nocheck
/* Learn page: every fundamental idea, explained in very simple words with a picture that plays on hover. */
import { facultyNote } from './faculty.js';
import { h, esc } from './visuals.js';
import { SCENES, SCENE_ORDER, SceneView } from './scenes.js';
import { ICONS } from './icons.js';
import '../styles/learnfold.css';

/* Ordered from the simplest ideas to the hardest. */
const CHAPTERS = [
  ['Money and time', 'Why money today is worth more than money later', 'coral'],
  ['Borrowing and lending', 'What happens when you borrow or lend money', 'sky'],
  ['Chance and numbers', 'The ideas behind risk and reward', 'pink'],
  ['Owning things', 'Shares, and what borrowing does to your results', 'mint'],
  ['Risk', 'Why returns jump up and down, and how to calm them', 'lav'],
  ['Making decisions', 'How to decide if something is worth doing', 'sun']
];

export function renderLearn(main) {
  const views = [];
  const slug = s => s.toLowerCase().replace(/[^a-z]+/g, '-');
  const hero = h('header', { class: 'learn-hero reveal' },
    h('p', { class: 'eyebrow' }, 'SmartWealth lessons'),
    h('h1', { html: 'Money, explained <em>in motion</em>' }),
    h('p', { class: 'lead' }, 'Short pictures of the basic ideas, in plain words. Pick one and watch it play.'), facultyNote());
  const toc = h('nav', { class: 'toc reveal', 'aria-label': 'Chapters' }, h('p', { class: 'eyebrow' }, 'Chapters'), CHAPTERS.map(([c, , tint]) => h('a', { class: `tint-${tint}`, href: '#' + slug(c) }, h('i', { class: 'dot' }), c)));
  const folds = [];
  const body = h('div', { class: 'chapters' }, CHAPTERS.map(([c, sub, tint], ci) => {
    const ids = SCENE_ORDER.filter(id => SCENES[id].chapter === c), pending = [];
    /* the pictures start only when a chapter is opened, so a closed chapter costs nothing */
    const start = () => { while (pending.length) { const [host, id] = pending.shift(); views.push(new SceneView(host, id, { mode: 'hover' })); } };
    const fold = h('details', Object.assign({ class: 'chapter lc', id: slug(c) }, ci === 0 ? { open: '' } : {}),
      h('summary', { class: `lc-sum tint-${tint}` }, h('span', { class: 'chap-n' }, String(ci + 1)), h('div', { class: 'lc-t' }, h('h2', {}, c), h('p', {}, sub)), h('span', { class: 'lc-k' }, `${ids.length} ideas`), h('span', { class: 'lc-c', html: ICONS.arrow })),
      h('div', { class: 'lgrid lc-body' }, ids.map(id => {
        const s = SCENES[id], host = h('div', { class: 'sv-wrap' });
        const card = h('article', { class: `card lcard tint-${tint}`, id: 'idea-' + id },
          h('header', {}, h('h3', {}, s.title), h('p', { class: 'plain' }, s.plain)),
          host,
          h('details', { class: 'more' }, h('summary', {}, 'Show me step by step'),
            h('div', { class: 'lcols' },
              h('div', {}, h('h4', {}, 'How it works'), h('ol', { class: 'how' }, s.how.map(x => h('li', {}, x)))),
              h('div', {}, h('h4', {}, 'Words to know'), h('dl', { class: 'wl' }, s.words.flatMap(([t, d]) => [h('dt', {}, t), h('dd', {}, d)]))))),
          s.link ? h('a', { class: 'btn lbtn', href: s.link, 'data-link': true }, 'Try it with real numbers →') : null);
        pending.push([host, id]);
        return card;
      })));
    fold.addEventListener('toggle', () => { if (fold.open) requestAnimationFrame(start); });
    fold._open = () => { fold.open = true; requestAnimationFrame(start); };
    folds.push(fold);
    if (ci === 0) requestAnimationFrame(start);
    return fold;
  }));
  /* open the chapter that a link points to (a chapter or a single idea), then scroll to it */
  const reveal = hash => {
    const el = hash && document.getElementById(hash.replace(/^#/, ''));
    const f = el && (el.closest('details.lc') || folds.find(x => x === el));
    if (f && !f.open) f._open();
    return el;
  };
  toc.addEventListener('click', e => { const a = e.target.closest('a[href^="#"]'); if (!a) return; e.preventDefault(); const el = reveal(a.getAttribute('href')); if (el) setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60); });
  main.innerHTML = '';
  main.append(hero, h('div', { class: 'learn-layout' }, toc, body));
  if (location.hash) requestAnimationFrame(() => reveal(location.hash));
  return () => views.forEach(v => v.destroy());
}
