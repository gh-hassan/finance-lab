// @ts-nocheck
/* Share a calculation as a link, download its results as a spreadsheet file, or print it. */
import { h, store } from './visuals.js';

const enc = obj => btoa(unescape(encodeURIComponent(JSON.stringify(obj))));
const dec = s => JSON.parse(decodeURIComponent(escape(atob(s))));

/** Build a link that reopens a calculator with the same numbers. */
export function shareUrl(id, state, simple, mode, unit) {
  return `${location.origin}/${id}?s=${encodeURIComponent(enc({ v: 1, state, simple: !!simple, mode, unit }))}`;
}

/** Same link without the site address, for links inside the app. */
export const sharePath = (id, state, mode = 'pro', unit = 'M') => `/${id}?s=${encodeURIComponent(enc({ v: 1, state, simple: false, mode, unit }))}`;

/** Read numbers from a shared link, then clean the address bar so a refresh does not re-apply them. Returns null when there is nothing valid. */
export function readShared(id) {
  try {
    const q = new URLSearchParams(location.search).get('s');
    if (!q) return null;
    history.replaceState(null, '', location.pathname);
    const d = dec(q);
    if (!d || d.v !== 1 || typeof d.state !== 'object' || d.state === null) return null;
    const state = {};
    Object.keys(d.state).slice(0, 60).forEach(k => { const x = d.state[k]; if (typeof x === 'number' && Number.isFinite(x)) state[k] = x; else if (typeof x === 'string' && x.length < 600) state[k] = x; });
    return { state, simple: !!d.simple, mode: d.mode === 'pro' ? 'pro' : 'beginner', unit: ['1', 'K', 'M', 'B'].includes(d.unit) ? d.unit : null, id };
  } catch (e) { return null; }
}

const csvCell = x => { const s = String(x == null ? '' : x).replace(/\s+/g, ' ').trim(); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
/** Results as CSV text: the inputs, the headline figures, then each table. Opens in Excel or Sheets. */
export function toCsv(title, inputs, out) {
  const rows = [[title], [], ['Inputs'], ...inputs, [], ['Results'], ...(out.cards || []).filter(c => !c.head).map(c => [c.label, c.value, c.sub || ''])];
  (out.tables || []).forEach(t => { rows.push([], [t.title], t.cols); (t.rows || []).forEach(r => { if (!r.h) rows.push(r.map(c => (Array.isArray(c) ? c[0] : c))); }); });
  rows.push([], ['Made with SmartWealth. For study and practice, not investment advice.']);
  return rows.map(r => r.map(csvCell).join(',')).join('\n');
}
export function download(name, text, type = 'text/csv') {
  const url = URL.createObjectURL(new Blob([text], { type: type + ';charset=utf-8' })), a = h('a', { href: url, download: name });
  document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** A small row of buttons: copy link, download CSV, print or save as PDF. */
export function toolsBar({ id, title, getState, getSimple, getMode, getUnit, getInputs, getOut }) {
  const note = h('span', { class: 'xnote', role: 'status' });
  let timer = 0;
  const say = msg => { note.textContent = msg; clearTimeout(timer); timer = setTimeout(() => { note.textContent = ''; }, 2400); };
  const copy = async () => {
    const url = shareUrl(id, getState(), getSimple(), getMode(), getUnit());
    try { await navigator.clipboard.writeText(url); say('Link copied. Anyone who opens it sees your numbers.'); }
    catch (e) { window.prompt('Copy this link', url); }
  };
  const csv = () => { const out = getOut(); if (!out || !(out.cards || []).length) { say('Nothing to download yet.'); return; } download(`${id}-results.csv`, toCsv(title, getInputs(), out)); say('Downloaded. It opens in Excel or Google Sheets.'); };
  return h('div', { class: 'xtools' },
    h('button', { type: 'button', class: 'btn small', onclick: copy }, 'Copy link'),
    h('button', { type: 'button', class: 'btn small', onclick: csv }, 'Download CSV'),
    h('button', { type: 'button', class: 'btn small', onclick: () => { say('Choose "Save as PDF" in the print window.'); setTimeout(() => window.print(), 250); } }, 'Print or PDF'),
    note);
}
void store;
