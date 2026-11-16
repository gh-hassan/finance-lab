// @ts-nocheck
/* The Roadmap page: ten stops from Base Camp to the treasure, with what to learn and which tools to try at each. Progress is kept in this browser only. */
import '../styles/roadmap.css';
import { MODS } from '../lib/registry';
import { DATA_PAGES } from './datapages.js';
import { h, store } from './visuals.js';
import { STAGES, TREASURE, RANKS, mapProgress, currentIndex, rankFor, nextTool } from '../lib/roadmap';

const KEY = 'fl:seen';
export const seenTools = () => { const v = store.get(KEY); return Array.isArray(v) ? v.filter(x => typeof x === 'string') : []; };
/** Remember that a tool was opened, so the roadmap can tick it off. */
export function markSeen(id) { const s = seenTools(); if (id && !s.includes(id)) store.set(KEY, [...s, id]); }

const title = id => (MODS.find(m => m.id === id) || DATA_PAGES.find(p => p.id === id) || { title: id === 'scenarios' ? 'Scenarios' : id }).title;
const blurb = id => (MODS.find(m => m.id === id) || DATA_PAGES.find(p => p.id === id) || {}).blurb || '';
const slug = s => s.toLowerCase().replace(/[^a-z]+/g, '-');
const NS = 'http://www.w3.org/2000/svg';
const COLS = 6, DX = 132, X0 = 70, Y1 = 90, Y2 = 240, BEND = 235;
const pos = i => (i < 5 ? { x: X0 + i * DX, y: Y1, at: i * DX } : i < 10 ? { x: X0 + (10 - i) * DX, y: Y2, at: 5 * DX + BEND + (i - 5) * DX } : { x: X0, y: Y2, at: 5 * DX + BEND + 5 * DX });
const TOTAL = 5 * DX + BEND + 5 * DX;

function map(progress, cur, allDone) {
  const x5 = X0 + 5 * DX, d = `M${X0} ${Y1}H${x5}C${x5 + 55} ${Y1} ${x5 + 55} ${Y2} ${x5} ${Y2}H${X0}`;
  const target = allDone ? TOTAL : pos(cur).at;
  const nodes = progress.map((p, i) => {
    const { x, y } = pos(i), st = p.complete ? 'mp-done' : i === cur ? 'mp-cur' : 'mp-todo';
    return `<a href="#stage-${p.stage.n}" class="mp-n ${st}" data-go="${p.stage.n}"><circle cx="${x}" cy="${y}" r="24"/><text x="${x}" y="${y + 6}" text-anchor="middle" class="mp-t">${p.complete ? '✓' : p.stage.n}</text><text x="${x}" y="${y + (y === Y1 ? -36 : 46)}" text-anchor="middle" class="mp-l">${p.stage.place}</text></a>`;
  }).join('');
  const c = pos(10);
  return `<svg class="mp-svg" viewBox="0 0 ${X0 * 2 + (COLS - 1) * DX + 40} 310" role="img" aria-label="A trail with ten stops ending at the treasure"><path d="${d}" class="mp-base" pathLength="${TOTAL}"/><path d="${d}" class="mp-walked" pathLength="${TOTAL}" style="--len:${TOTAL};--to:${target}"/>${nodes}<a href="#treasure" class="mp-n chest ${allDone ? 'mp-done' : 'mp-todo'}" data-go="treasure"><rect x="${c.x - 24}" y="${c.y - 18}" width="48" height="36" rx="8"/><text x="${c.x}" y="${c.y + 7}" text-anchor="middle" class="mp-t">★</text><text x="${c.x}" y="${c.y + 46}" text-anchor="middle" class="mp-l">Treasure</text></a></svg>`;
}

function stageCard(p, i, cur) {
  const st = p.stage, state = p.complete ? 'done' : i === cur ? 'current' : 'todo', label = state === 'done' ? 'Finished' : state === 'current' ? 'You are here' : 'Up next';
  return h('article', { class: `stage ${state}`, id: `stage-${st.n}`, tabindex: '-1' },
    h('header', { class: 'st-head' }, h('span', { class: 'st-num' }, state === 'done' ? '✓' : String(st.n)),
      h('div', {}, h('p', { class: 'eyebrow' }, `${st.place} · ${st.rank} · about ${st.hours} hours`), h('h2', {}, st.title)), h('span', { class: 'st-state' }, label)),
    h('p', { class: 'st-why' }, st.why),
    h('p', { class: 'st-lesson' }, h('a', { href: `/learn#${slug(st.chapter)}`, 'data-link': true }, `Read the short lesson: ${st.chapter}`), ' first if this is new to you.'),
    h('div', { class: 'st-cols' },
      h('section', {}, h('h3', {}, 'You will be able to'), h('ul', { class: 'st-can' }, st.can.map(c => h('li', {}, c))), h('h3', {}, 'Ideas to learn'), h('div', { class: 'chips' }, st.ideas.map(c => h('span', { class: 'chip' }, c)))),
      h('section', {}, h('h3', {}, 'Tools to try, in this order'), h('ol', { class: 'st-tools' }, st.tools.map(id => h('li', { class: p.tried.has(id) ? 'tried' : '' }, h('a', { href: `/${id}`, 'data-link': true }, title(id)), h('small', {}, blurb(id)), p.tried.has(id) ? h('span', { class: 'tick', 'aria-label': 'tried' }, '✓') : null))))),
    h('div', { class: 'st-bottom' }, h('div', { class: 'quest' }, h('b', {}, 'Your quest'), h('p', {}, st.quest)), h('div', { class: 'reward' }, h('b', {}, 'Treasure from this stop'), h('p', {}, st.treasure))),
    h('div', { class: 'st-bar', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': String(p.total), 'aria-valuenow': String(p.done), 'aria-label': `${p.done} of ${p.total} tools tried` }, h('i', { style: `width:${Math.round(100 * p.done / p.total)}%` }), h('span', {}, `${p.done} of ${p.total} tools tried`)));
}

export function renderRoadmap(root) {
  const seen = seenTools(), progress = mapProgress(STAGES, seen), cur = currentIndex(progress), finished = progress.filter(p => p.complete).length, allDone = finished === STAGES.length, rank = rankFor(finished), next = nextTool(progress), fresh = !seen.length;
  const here = STAGES[cur];
  const head = h('header', { class: 'learn-hero rm-head reveal' }, h('p', { class: 'eyebrow' }, 'Roadmap'), h('h1', { html: 'Your path from <em>beginner</em> to analyst' }),
    h('p', { class: 'lead' }, 'Follow the trail from Base Camp. Each stop teaches a few ideas, lists tools to try in order, and gives you one small quest. Tools you open are ticked off in this browser. Nothing is sent anywhere.'),
    h('div', { class: 'rm-status' },
      h('div', { class: 'rm-box' }, h('span', { class: 'rk-label' }, 'Your rank'), h('b', {}, rank.name), h('small', {}, rank.blurb)),
      h('div', { class: 'rm-box' }, h('span', { class: 'rk-label' }, allDone ? 'Journey complete' : fresh ? 'Ready to begin' : 'You are at'), h('b', {}, allDone ? 'The Treasure' : here.place), h('small', {}, allDone ? 'You have tried every tool' : `Stop ${here.n} of ${STAGES.length}: ${here.title}`)),
      next ? h('a', { class: 'btn primary rm-go', href: `/${next}`, 'data-link': true }, fresh ? 'Start at Base Camp' : 'Continue your journey', ` → ${title(next)}`) : h('a', { class: 'btn primary rm-go', href: '#treasure', 'data-go': 'treasure' }, 'Open the treasure')));
  const ladder = h('ol', { class: 'rm-ranks', 'aria-label': 'Ranks you can earn' }, RANKS.filter(r => r.from > 0).map((r, i, a) => { const upto = a[i + 1] ? a[i + 1].from - 1 : STAGES.length; return h('li', { class: r.name === rank.name ? 'on' : finished >= r.from ? 'got' : '' }, h('b', {}, r.name), h('small', {}, r.from === upto ? `Finish stop ${r.from}` : `Finish ${r.from} of ${STAGES.length}`), h('span', {}, r.blurb)); }));
  const mapBox = h('figure', { class: 'rm-map' }, h('div', { class: 'mp-wrap', html: map(progress, cur, allDone) }), h('figcaption', {}, h('span', { class: 'lg lg-done' }, 'Finished'), h('span', { class: 'lg lg-cur' }, 'You are here'), h('span', { class: 'lg' }, 'Up next'), h('small', {}, 'A stop is finished when you have opened every tool in it.')));
  const dots = h('nav', { class: 'rm-dots', 'aria-label': 'Jump to a stop' }, progress.map((p, i) => h('a', { href: `#stage-${p.stage.n}`, 'data-go': p.stage.n, class: p.complete ? 'rd-done' : i === cur ? 'rd-cur' : '', 'aria-label': `Stop ${p.stage.n}: ${p.stage.place}` }, p.complete ? '✓' : String(p.stage.n))));
  const treasure = h('section', { class: `treasure-box ${allDone ? 'open' : ''}`, id: 'treasure', tabindex: '-1' }, h('p', { class: 'eyebrow' }, allDone ? 'Unlocked' : 'The end of the trail'), h('h2', {}, TREASURE.title), h('ul', { class: 'st-can' }, TREASURE.can.map(c => h('li', {}, c))),
    h('div', { class: 'quest' }, h('b', {}, 'The final quest'), h('p', {}, TREASURE.quest)), h('div', { class: 'cta' }, h('a', { class: 'btn ghost', href: '/learn', 'data-link': true }, 'Read the lessons'), h('a', { class: 'btn ghost', href: '/glossary', 'data-link': true }, 'Review the ideas')));
  root.replaceChildren(head, ladder, mapBox, dots, h('section', { class: 'stages', 'aria-label': 'The ten stops' }, progress.map((p, i) => stageCard(p, i, cur))), treasure);

  const go = n => { const el = document.getElementById(n === 'treasure' ? 'treasure' : `stage-${n}`); if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); el.focus({ preventScroll: true }); } };
  const click = e => { const a = e.target.closest('[data-go]'); if (a) { e.preventDefault(); go(a.dataset.go); } };
  root.addEventListener('click', click);
  return () => root.removeEventListener('click', click);
}
