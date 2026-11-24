// @ts-nocheck
/* Financial news. The front page shows one lead story, the best few from each group, and a few things to read and learn from.
   It opens at once from the copy saved on the last visit, then checks for anything newer, and checks again every two minutes while it is
   open. Stories that arrive later wait behind a button, so the page never jumps while someone reads. Every story opens at the publisher,
   in a new tab. We keep only a headline and a short summary. */
import '../styles/news.css';
import { h, head, api, scope, errorBox, explainer } from './dataui.js';
import { ago, kindOf, freshIds, frontPage, ofGroup, initials, hueOf, TABS, GROUP_LABEL } from '../lib/news';
import { readNewsCache, writeNewsCache, prefetchNews } from './newscache.js';

const POLL_MS = 120e3;
const STEP = 10;
/** The time of day in the reader's own time zone, such as "13:47 PKT". */
const clock = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZoneName: 'short' });
const stamp = ms => clock.format(new Date(ms)).replace(/^(\d{2}:\d{2})\s*/, '$1 ').replace('GMT', 'UTC');
const readTab = () => { const g = new URLSearchParams(location.search).get('g'); return TABS.some(t => t[0] === g) ? g : 'top'; };

export function renderNews(main) {
  const S = scope(), state = { data: null, items: [], known: new Set(), fresh: new Set(), pending: null, tab: readTab(), limit: STEP, last: 0, busy: false, touched: false };
  let timer = 0, tick = 0;

  const view = h('div', { class: 'nw-view', 'aria-live': 'off' }), live = h('span', { class: 'nw-live' }), say = h('p', { class: 'd-vh', role: 'status', 'aria-live': 'polite' });
  const pill = h('button', { type: 'button', class: 'nw-pill', hidden: true, onclick: () => showPending() }), srcBox = h('div', { class: 'nw-src' }), tabsEl = h('div', { class: 'nw-tabs', role: 'tablist', 'aria-label': 'Kinds of story' });
  const checkBtn = h('button', { type: 'button', class: 'nw-check', onclick: () => check(true) }, 'Refresh');

  const link = (cls, it, ...kids) => h('a', { class: cls, href: it.link, target: '_blank', rel: 'noopener noreferrer', 'aria-label': `${it.title}. ${it.source}, ${ago(it.published)}. Opens in a new tab.` }, ...kids);
  const meta = it => h('span', { class: 'nw-rm' }, it.source, h('i', { 'aria-hidden': 'true' }, '·'), h('time', { datetime: it.published }, ago(it.published)), state.fresh.has(it.id) ? h('b', { class: 'nw-new' }, 'New') : null);
  const avatar = it => h('span', { class: 'nw-av', style: `--h:${hueOf(it.sourceId)}`, 'aria-hidden': 'true' }, initials(it.source));

  const row = (it, withSummary) => link('nw-row', it, avatar(it), h('span', { class: 'nw-rb' }, meta(it), h('span', { class: 'nw-rt' }, it.title), withSummary && it.summary ? h('span', { class: 'nw-rs' }, it.summary) : null), h('span', { class: 'nw-go', 'aria-hidden': 'true' }, '↗'));
  const lead = it => link('nw-lead', it, h('span', { class: 'nw-lk' }, 'Top story', h('i', { 'aria-hidden': 'true' }, '·'), GROUP_LABEL[it.group]), h('span', { class: 'nw-lt' }, it.title), it.summary ? h('span', { class: 'nw-ls' }, it.summary) : null, h('span', { class: 'nw-lf' }, h('span', { class: 'nw-lm' }, it.source, h('i', { 'aria-hidden': 'true' }, '·'), h('time', { datetime: it.published }, ago(it.published)), state.fresh.has(it.id) ? h('b', { class: 'nw-new' }, 'New') : null), h('span', { class: 'nw-lgo' }, 'Read the story ↗')));
  const learnCard = it => link('nw-lcard', it, h('span', { class: 'nw-tag' }, kindOf(it)), h('span', { class: 'nw-lct' }, it.title), it.summary ? h('span', { class: 'nw-lcs' }, it.summary) : null, h('span', { class: 'nw-lcm' }, it.source, h('i', { 'aria-hidden': 'true' }, '·'), h('time', { datetime: it.published }, ago(it.published))));
  const section = (title, items, tab) => (items.length ? h('section', { class: 'nw-sec' }, h('div', { class: 'nw-sh' }, h('h2', {}, title), h('button', { type: 'button', class: 'nw-all', onclick: () => setTab(tab) }, 'See all')), h('div', { class: 'nw-rows' }, items.map(i => row(i)))) : null);

  function front() {
    const f = frontPage(state.items);
    if (!f.lead) return h('p', { class: 'nw-empty' }, 'No stories to show yet. Check again in a moment.');
    return h('div', { class: 'nw-front' },
      h('div', { class: 'nw-hero' }, lead(f.lead), h('div', { class: 'nw-next' }, h('h2', {}, 'Also making news'), h('div', { class: 'nw-rows' }, f.next.map(i => row(i))))),
      h('div', { class: 'nw-cols' }, section('World business', f.global, 'global'), section('Pakistan', f.local, 'local'), section('Central banks and regulators', f.policy, 'policy')),
      f.learn.length ? h('section', { class: 'nw-learn' }, h('div', { class: 'nw-sh' }, h('h2', {}, 'Read and learn'), h('button', { type: 'button', class: 'nw-all', onclick: () => setTab('learn') }, 'See all')), h('p', { class: 'nw-lede' }, 'Free articles, research notes and case studies from universities and central banks.'), h('div', { class: 'nw-lgrid' }, f.learn.map(learnCard))) : null);
  }
  function listing() {
    const all = ofGroup(state.items, state.tab), part = all.slice(0, state.limit);
    if (!all.length) return h('p', { class: 'nw-empty' }, 'No stories here yet.');
    return h('div', { class: 'nw-one' }, state.tab === 'learn' ? h('div', { class: 'nw-lgrid nw-wide' }, part.map(learnCard)) : h('div', { class: 'nw-rows nw-big' }, part.map(i => row(i, true))),
      all.length > part.length ? h('button', { type: 'button', class: 'nw-more', onclick: () => { state.limit += STEP; paint(); } }, 'Show more') : null);
  }

  function paint() {
    tabsEl.replaceChildren(...TABS.map(([v, l]) => h('button', { type: 'button', role: 'tab', 'aria-selected': String(v === state.tab), class: v === state.tab ? 'nw-on' : '', onclick: () => setTab(v) }, l)));
    view.replaceChildren(state.tab === 'top' ? front() : listing());
    drawStatus();
  }
  function setTab(t) { if (t === state.tab) return; state.tab = t; state.limit = STEP; state.touched = true; history.replaceState(null, '', t === 'top' ? '/news' : '/news?g=' + t); paint(); window.scrollTo({ top: Math.max(0, tabsEl.getBoundingClientRect().top + scrollY - 96), behavior: 'smooth' }); }

  function drawStatus() {
    if (!state.last) return;
    const secs = Math.round((Date.now() - state.last) / 1000);
    live.replaceChildren(h('span', { class: 'nw-lbl' }, 'Last updated'), h('time', { class: 'nw-stamp', datetime: new Date(state.last).toISOString() }, stamp(state.last)), h('span', { class: 'nw-sep', 'aria-hidden': 'true' }), h('span', { class: 'nw-every' }, 'Refreshes every 2 minutes'));
    view.querySelectorAll('time').forEach(t => { t.textContent = ago(t.getAttribute('datetime')); });
    void secs;
  }
  function drawSources() {
    const d = state.data; if (!d) return;
    const bad = d.sources.filter(s => !s.ok);
    srcBox.replaceChildren(...[bad.length ? h('p', { class: 'nw-warn' }, `Could not reach ${bad.map(s => s.name).join(', ')} just now. Their stories come back when they do.`) : null,
      h('p', { class: 'nw-from' }, 'From ', d.sources.filter(s => s.ok).map(s => s.name).join(', '), '. Each story opens at the publisher.')].filter(Boolean));
  }
  function drawPill() {
    const n = state.pending ? freshIds(state.known, state.pending.items).length : 0;
    pill.hidden = n === 0;
    if (n) { pill.textContent = `${n} new ${n === 1 ? 'story' : 'stories'}  ·  Show`; say.textContent = `${n} new ${n === 1 ? 'story is' : 'stories are'} available.`; }
  }

  function show(data, markNew) {
    if (markNew) freshIds(state.known, data.items).forEach(id => state.fresh.add(id));
    data.items.forEach(i => state.known.add(i.id));
    state.data = data; state.items = data.items; state.pending = null; state.last = Date.now();
    paint(); drawSources(); drawPill();
  }
  function showPending() { if (!state.pending) return; show(state.pending, true); window.scrollTo({ top: Math.max(0, tabsEl.getBoundingClientRect().top + scrollY - 96), behavior: 'smooth' }); }

  /** Applies fresh data. Right after opening, and before the reader has done anything, it simply replaces what was saved. After that, new stories wait behind the button. */
  function apply(data, manual) {
    writeNewsCache(data);
    if (!state.data) { show(data, false); return; }
    const fresh = freshIds(state.known, data.items);
    state.last = Date.now();
    if (!fresh.length) { state.items = data.items; state.data = data; state.pending = null; paint(); drawSources(); drawPill(); if (manual) say.textContent = 'You are up to date.'; return; }
    if (state.opening && !state.touched && scrollY < 80) { show(data, false); return; }
    state.pending = data; drawPill(); drawStatus();
  }

  async function check(manual) {
    if (state.busy) return;
    state.busy = true; checkBtn.disabled = true; if (manual) checkBtn.textContent = 'Refreshing';
    try {
      const warm = !manual && !state.data ? await prefetchNews() : null;
      apply(warm || await api('news', {}, S.signal), manual);
    } catch (e) {
      if (e.name === 'AbortError') return;
      if (!state.data) view.replaceChildren(errorBox(e.message, () => { view.replaceChildren(skeleton()); check(true); }));
      else live.replaceChildren(h('span', { class: 'nw-lbl' }, 'Could not refresh'), h('span', { class: 'nw-every' }, `Showing the news from ${stamp(state.last)}. Trying again soon.`));
    } finally { state.busy = false; checkBtn.disabled = false; checkBtn.textContent = 'Refresh'; state.opening = false; }
  }

  const skeleton = () => h('div', { class: 'nw-skel', 'aria-hidden': 'true' }, h('div', { class: 'nw-hero' }, h('i', { class: 'nw-sk nw-sk-lead' }), h('div', {}, [0, 1, 2, 3].map(() => h('i', { class: 'nw-sk nw-sk-row' })))), h('div', { class: 'nw-cols' }, [0, 1, 2].map(() => h('div', {}, [0, 1, 2, 3].map(() => h('i', { class: 'nw-sk nw-sk-row' }))))));

  const onVis = () => { if (!document.hidden && state.last && Date.now() - state.last > POLL_MS / 2) check(false); };
  const touch = () => { state.touched = true; };
  document.addEventListener('visibilitychange', onVis); addEventListener('pointerdown', touch, { passive: true }); addEventListener('keydown', touch);
  timer = setInterval(() => { if (!document.hidden) check(false); }, POLL_MS); tick = setInterval(() => { if (!document.hidden) drawStatus(); }, 30e3);
  S.add(() => { clearInterval(timer); clearInterval(tick); document.removeEventListener('visibilitychange', onVis); removeEventListener('pointerdown', touch); removeEventListener('keydown', touch); });

  main.replaceChildren(
    head({ eyebrow: 'Markets and economy', title: 'Financial <em>news</em>', lead: 'What is moving world markets and Pakistan, what central banks said, and articles and case studies to learn from. Every story opens at the publisher.' }),
    h('div', { class: 'd-page nw-page' },
      h('div', { class: 'nw-bar' }, tabsEl, h('div', { class: 'nw-liveb' }, live, checkBtn)), pill, view, srcBox, say,
      explainer('How this page works', '<ul><li>We read the public news feeds of well-known publishers, central banks and universities. Nothing is behind a login.</li><li>We rank stories by how recent they are and how clearly they are about money, markets or the economy, and show only the best few.</li><li>It opens at once with the stories from your last visit, then checks for newer ones, and checks again every two minutes while you stay. New stories wait behind a button, so the page does not jump while you read.</li><li>We show only a headline and a short summary. The full story is at the publisher and opens in a new tab.</li><li>News is not advice. A headline is a starting point, not a reason to buy or sell.</li></ul>')));

  /* open at once: the saved copy if there is one, otherwise a page-shaped placeholder that is replaced as soon as the news arrives */
  const saved = readNewsCache();
  state.opening = true;
  if (saved) { show(saved.data, false); } else { paint(); view.replaceChildren(skeleton()); }
  check(false);
  return () => { S.run(); };
}
