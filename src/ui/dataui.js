// @ts-nocheck
/* Building blocks shared by the live data pages: fetching, loading and error states, tables, charts and small controls. */
import '../styles/data.css';
import { h, esc, XY } from './visuals.js';
import { csvCell, download } from './sharing.js';
import { fromDecimalYear } from '../lib/series';
import { longDate, monthYear } from '../lib/format';

/** GET /api/<name>?params and return the JSON, or throw an Error whose message is safe to show a student. */
export async function api(name, params = {}, signal) {
  const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')).toString();
  let res;
  try { res = await fetch('/api/' + name + (qs ? '?' + qs : ''), { signal }); }
  catch (e) { if (e && e.name === 'AbortError') throw e; throw new Error('Could not reach the data service. Check your connection and try again.'); }
  if (!(res.headers.get('content-type') || '').includes('json')) throw new Error('Live data is only available on the published site.');
  let body;
  try { body = await res.json(); } catch (e) { if (e && e.name === 'AbortError') throw e; throw new Error('The data service sent something unreadable. Try again in a moment.'); }
  if (!res.ok) throw new Error((body && body.error) || 'Could not load that data. Try again in a moment.');
  return body;
}

/** Groups clean-up work so a page can stop its requests and charts when you leave it. */
export function scope() {
  const fns = []; let ctl = new AbortController();
  return {
    get signal() { return ctl.signal; },
    add: fn => { fns.push(fn); return fn; },
    /** Cancels in-flight requests and starts a fresh signal, for when a new search replaces an old one. */
    reset() { ctl.abort(); ctl = new AbortController(); },
    run() { ctl.abort(); fns.splice(0).forEach(f => { try { f(); } catch (e) { /* ignore */ } }); }
  };
}

export const head = ({ eyebrow, title, lead }) => h('header', { class: 'learn-hero reveal' }, h('p', { class: 'eyebrow' }, eyebrow), h('h1', { html: title }), h('p', { class: 'lead' }, lead));

const whenText = iso => { const d = new Date(iso); return Number.isNaN(+d) ? '' : d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }); };
/** "Live from <source>, checked <time>. Where this comes from." */
export const sourceLine = ({ source, asOf, url, live = true, extra }) => h('p', { class: 'd-src' + (live ? '' : ' off') },
  h('span', { class: 'd-dot', 'aria-hidden': 'true' }),
  h('span', { class: 'd-srct' }, `${live ? 'Live from' : 'From'} ${source}${asOf ? ', checked ' + whenText(asOf) : ''}.`, extra ? ' ' : null, extra || null, url && /^https:\/\//.test(url) ? ' ' : null, url && /^https:\/\//.test(url) ? h('a', { href: url, target: '_blank', rel: 'noopener noreferrer' }, 'Source ↗') : null));

export const skeleton = (label = 'Loading') => h('div', { class: 'd-card', role: 'status', 'aria-live': 'polite', 'aria-label': label }, h('div', { class: 'd-skel' }, h('span', { class: 'd-vh' }, label), h('i', { class: 'd-big' }), h('i'), h('i'), h('i'), h('i')));

export const errorBox = (message, retry) => h('div', { class: 'd-err', role: 'alert' }, h('p', {}, message), retry ? h('button', { type: 'button', class: 'd-btn', onclick: retry }, 'Try again') : null);

/** A row of buttons where exactly one is selected. options: [[value, label], ...]. The buttons are built once, so keyboard focus stays where it is after a choice. */
export function segmented({ options, value, label, onChange }) {
  let cur = value;
  const el = h('div', { class: 'd-seg', role: 'group', 'aria-label': label || 'Choose' });
  const btns = options.map(([v, text]) => [v, h('button', { type: 'button', 'aria-pressed': String(v === value) }, text)]);
  const paint = () => btns.forEach(([v, b]) => b.setAttribute('aria-pressed', String(v === cur)));
  btns.forEach(([v, b]) => { b.addEventListener('click', () => { if (v === cur) return; cur = v; paint(); onChange(v); }); el.append(b); });
  return { el, set(v) { cur = v; paint(); }, get value() { return cur; } };
}

/** Compact stat tiles. items: [{ label, value, sub, tone: 'good' | 'bad' }] */
export const statGrid = (items, cols) => h('div', { class: 'd-stats', 'data-cols': cols || null, style: cols ? `--cols:${cols}` : null }, items.map(it => h('div', { class: 'stat' + (it.tone ? ' ' + it.tone : '') }, h('div', { class: 'sl' }, it.label), h('div', { class: 'sv' }, it.value), it.sub ? h('small', {}, it.sub) : null)));

/** Table with a sticky first column. head: ['', '2024', ...]  rows: [{ group: 'Income' } | { label, cells: [{ t, tone } | string], title }] */
export function dataTable({ head, rows, label }) {
  const thead = h('thead', {}, h('tr', {}, head.map((t, i) => h('th', { scope: 'col' }, i === 0 && !t ? h('span', { class: 'd-vh' }, 'Line item') : t))));
  const tbody = h('tbody', {}, rows.map(r => r.group
    ? h('tr', { class: 'grp' }, h('th', { colspan: head.length, scope: 'colgroup' }, r.group))
    : h('tr', {}, h('th', { scope: 'row', title: r.title || null }, r.label), r.cells.map(c => { const o = typeof c === 'string' ? { t: c } : c; return h('td', { class: [o.tone, o.t === '—' ? 'na' : ''].filter(Boolean).join(' ') || null }, o.t); }))));
  return h('div', { class: 'd-tw', role: 'region', 'aria-label': label || 'Data table', tabindex: '0' }, h('table', { class: 'd-t' }, thead, tbody));
}

/** A line, area or bar chart using the site's interactive chart. It redraws itself when it is attached or resized. Returns { el, update(spec), destroy() }. */
export function chartBox(spec) {
  const host = h('div', { class: 'd-chart' }), xy = new XY(host, spec);
  return { el: host, update: next => xy.setSpec(next), destroy: () => xy.destroy() };
}

/** Axis labels for charts whose x values are decimal years: whole years on long spans, month and year on short ones. Spread into a chart spec. */
export const timeAxis = spanYears => ({ xFmt: v => (spanYears <= 6 ? monthYear(fromDecimalYear(v)).replace(/ 20/, ' \u2019') : String(Math.round(v))), xRead: v => longDate(fromDecimalYear(v)) });

/** Replaces an element's children, skipping null and false (the DOM would print them as the words "null" and "false"). */
export const fill = (el, ...kids) => el.replaceChildren(...kids.flat().filter(k => k != null && k !== false));

export const explainer = (title, body) => h('details', { class: 'd-ex' }, h('summary', {}, title), h('div', { class: 'd-exb plain', html: body }));

/** Offer rows as a CSV download. rows is an array of arrays. */
export const saveCsv = (name, rows) => download(name, rows.map(r => r.map(csvCell).join(',')).join('\n'));

export const debounce = (fn, ms = 200) => { let t = 0; const f = (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; f.cancel = () => clearTimeout(t); return f; };
export { h, esc };
