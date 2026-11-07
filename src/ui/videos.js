// @ts-nocheck
/* Video tutorials: the SmartWealth YouTube channel previewed on the site. Videos play in YouTube's own player and always link back to YouTube. */
import { h } from './visuals.js';
import { VIDEOS, CHANNEL_URL } from '../data/videos.js';

const ID = /^[A-Za-z0-9_-]{11}$/;
export const watchUrl = id => `https://www.youtube.com/watch?v=${id}`;
export const embedUrl = id => `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&modestbranding=1`;
export const thumbUrl = id => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;

/** "SAFE MLO Exam Prep: LTV vs. CLTV" becomes { series: "SAFE MLO Exam Prep", title: "LTV vs. CLTV" }. */
export function splitTitle(full) {
  const i = full.indexOf(':');
  return i > 2 && i < 40 ? { series: full.slice(0, i).trim(), title: full.slice(i + 1).trim() } : { series: 'Other', title: full };
}

/* Calculators that go with a video, matched by words in its title. */
const RELATED = [
  [/time value|\btvm\b/i, '/tvm', 'Time value calculator'], [/dcf|discounted cash/i, '/dcf', 'DCF calculator'], [/amortization|mortgage interest|piti|payment/i, '/loan', 'Loan calculator'],
  [/financial model|projection|sensitivity/i, '/model3', 'Three-statement model'], [/financial statement|ratio/i, '/ratios', 'Ratios calculator'], [/capital budget|npv|irr/i, '/capbud', 'Capital budgeting'],
  [/wacc|cost of capital/i, '/wacc', 'Cost of capital'], [/bond/i, '/bond', 'Bond calculator'], [/option/i, '/strategies', 'Option strategies'], [/portfolio|diversif/i, '/frontier', 'Portfolio frontier']
];
export const relatedFor = title => { const r = RELATED.find(([re]) => re.test(title)); return r ? { href: r[1], label: r[2] } : null; };

const fmtDate = iso => { const d = new Date(iso); return Number.isNaN(+d) ? '' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); };
const fmtViews = n => (n >= 1e6 ? (n / 1e6).toFixed(1) + 'M views' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'K views' : n === 1 ? '1 view' : n + ' views');

export function renderVideos(main) {
  let list = VIDEOS.filter(v => ID.test(v.id)), filter = '', opener = null, modal = null;
  const grid = h('div', { class: 'vid-grid' }), chips = h('div', { class: 'picker vid-chips' }), count = h('p', { class: 'gl-count' });

  function close() {
    if (!modal) return;
    modal.remove(); modal = null; document.body.classList.remove('vid-lock');
    if (opener && opener.isConnected) opener.focus();
  }
  function open(v, from) {
    close(); opener = from;
    const { title } = splitTitle(v.title);
    const frame = h('iframe', { src: embedUrl(v.id), title, allow: 'accelerometer; autoplay; encrypted-media; picture-in-picture; fullscreen', allowfullscreen: '', referrerpolicy: 'strict-origin-when-cross-origin' });
    const closeBtn = h('button', { type: 'button', class: 'btn small', onclick: close }, 'Close');
    modal = h('div', { class: 'vid-modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': title, onclick: e => { if (e.target === modal) close(); } },
      h('div', { class: 'vid-box' }, h('div', { class: 'vid-frame' }, frame), h('div', { class: 'vid-bar' }, h('p', {}, title), h('div', {}, h('a', { class: 'btn small', href: watchUrl(v.id), target: '_blank', rel: 'noopener noreferrer' }, 'Watch on YouTube ↗'), closeBtn))));
    document.body.append(modal); document.body.classList.add('vid-lock'); closeBtn.focus();
  }
  const onKey = e => { if (!modal) return; if (e.key === 'Escape') close(); else if (e.key === 'Tab') { const f = [...modal.querySelectorAll('a,button')]; if (!f.length) return; const first = f[0], last = f[f.length - 1]; if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); } } };
  document.addEventListener('keydown', onKey);

  function draw() {
    const series = [...new Set(list.map(v => splitTitle(v.title).series))];
    chips.innerHTML = '';
    [['', 'All videos', list.length], ...series.map(s => [s, s, list.filter(v => splitTitle(v.title).series === s).length])].forEach(([val, label, n]) =>
      chips.append(h('button', { type: 'button', class: 'pick' + (filter === val ? ' on' : ''), onclick: () => { filter = val; draw(); } }, `${label} · ${n}`)));
    const shown = list.filter(v => !filter || splitTitle(v.title).series === filter);
    grid.innerHTML = '';
    shown.forEach(v => {
      const { series: s, title } = splitTitle(v.title), rel = relatedFor(v.title);
      const thumb = h('button', { type: 'button', class: 'vid-thumb', 'aria-label': `Preview: ${title}` }, h('img', { src: thumbUrl(v.id), alt: '', loading: 'lazy', width: 480, height: 360 }), h('span', { class: 'vid-play', 'aria-hidden': 'true' }, h('i')));
      thumb.addEventListener('click', () => open(v, thumb));
      grid.append(h('article', { class: 'card vid-card' }, thumb,
        h('div', { class: 'vid-info' }, h('p', { class: 'vid-series' }, s), h('h3', {}, title), h('p', { class: 'vid-meta' }, [fmtDate(v.published), v.views ? fmtViews(v.views) : ''].filter(Boolean).join(' · ')),
          v.description ? h('p', { class: 'vid-desc' }, v.description.replace(/\s+/g, ' ').slice(0, 150) + (v.description.length > 150 ? '…' : '')) : null,
          h('div', { class: 'vid-act' }, h('a', { class: 'btn small', href: watchUrl(v.id), target: '_blank', rel: 'noopener noreferrer' }, 'Watch on YouTube ↗'), rel ? h('a', { class: 'vid-rel', href: rel.href, 'data-link': true }, rel.label + ' →') : null))));
    });
    count.textContent = `${shown.length} video${shown.length === 1 ? '' : 's'}`;
  }

  main.innerHTML = '';
  main.append(
    h('header', { class: 'learn-hero reveal' }, h('p', { class: 'eyebrow' }, 'Video tutorials'), h('h1', { html: 'Watch and <em>learn</em>' }), h('p', { class: 'lead' }, 'Walkthroughs from the SmartWealth channel. Preview a video here and it plays in YouTube\'s own player.'),
      h('a', { class: 'btn', href: CHANNEL_URL + '?sub_confirmation=1', target: '_blank', rel: 'noopener noreferrer' }, 'Subscribe on YouTube ↗')),
    chips, count, grid);
  draw();
  /* refresh from the live channel feed; the built-in list stays if that fails */
  fetch('/api/videos').then(r => (r.headers.get('content-type') || '').includes('json') ? r.json() : null).then(d => { if (d && Array.isArray(d.videos) && d.videos.length && grid.isConnected) { list = d.videos.filter(v => ID.test(v.id)); draw(); } }).catch(() => { });
  return () => { document.removeEventListener('keydown', onKey); close(); };
}
