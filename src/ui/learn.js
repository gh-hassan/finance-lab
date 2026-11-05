// @ts-nocheck
/* Learn page: every fundamental idea, explained in very simple words with a picture that plays on hover. */
import { h, esc } from './visuals.js';
import { SCENES, SCENE_ORDER, SceneView } from './scenes.js';

const CHAPTERS = [
  ['Money and time', 'Why a dollar today beats a dollar tomorrow', 'coral'],
  ['Borrowing and lending', 'What happens when money changes hands', 'sky'],
  ['Owning things', 'Shares, and what borrowing does to results', 'mint'],
  ['Risk', 'Why returns jump around and how to calm them', 'lav'],
  ['Making decisions', 'How to tell if something is worth doing', 'sun'],
  ['Chance and numbers', 'The ideas behind risk and return', 'pink']
];

export function renderLearn(main) {
  const views = [];
  const slug = s => s.toLowerCase().replace(/[^a-z]+/g, '-');
  const hero = h('header', { class: 'learn-hero reveal' },
    h('p', { class: 'eyebrow' }, 'Start here'),
    h('h1', { html: 'Money, explained <em>in motion</em>' }),
    h('p', { class: 'lead' }, 'Hover over a picture to play it. On a phone, tap it.'));
  const toc = h('nav', { class: 'toc reveal', 'aria-label': 'Chapters' }, h('p', { class: 'eyebrow' }, 'Chapters'), CHAPTERS.map(([c, , tint]) => h('a', { class: `tint-${tint}`, href: '#' + slug(c) }, h('i', { class: 'dot' }), c)));
  const body = h('div', { class: 'chapters' }, CHAPTERS.map(([c, sub, tint], ci) => {
    const ids = SCENE_ORDER.filter(id => SCENES[id].chapter === c);
    return h('section', { class: 'chapter', id: slug(c) },
      h('div', { class: `chap-h tint-${tint}` }, h('span', { class: 'chap-n' }, String(ci + 1)), h('div', {}, h('h2', {}, c), h('p', {}, sub))),
      h('div', { class: 'lgrid' }, ids.map(id => {
        const s = SCENES[id], host = h('div', { class: 'sv-wrap' });
        const card = h('article', { class: `card lcard tint-${tint}`, id: 'idea-' + id },
          h('header', {}, h('h3', {}, s.title), h('p', { class: 'plain' }, s.plain)),
          host,
          h('details', { class: 'more' }, h('summary', {}, 'Explain it step by step'),
            h('div', { class: 'lcols' },
              h('div', {}, h('h4', {}, 'How it works'), h('ol', { class: 'how' }, s.how.map(x => h('li', {}, x)))),
              h('div', {}, h('h4', {}, 'Words to know'), h('dl', { class: 'wl' }, s.words.flatMap(([t, d]) => [h('dt', {}, t), h('dd', {}, d)]))))),
          s.link ? h('a', { class: 'btn lbtn', href: s.link, 'data-link': true }, 'Try it with real numbers →') : null);
        requestAnimationFrame(() => views.push(new SceneView(host, id, { mode: 'hover' })));
        return card;
      })));
  }));
  main.innerHTML = '';
  main.append(hero, h('div', { class: 'learn-layout' }, toc, body));
  return () => views.forEach(v => v.destroy());
}
