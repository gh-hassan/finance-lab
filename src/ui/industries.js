// @ts-nocheck
/* Industry benchmarks: what is typical for companies in an industry (beta, cost of capital, multiples, margins). Data: Damodaran, NYU Stern. */
import '../styles/industries.css';
import data from '../data/industries.json';
import { h, head, sourceLine, statGrid, dataTable, explainer, saveCsv, segmented } from './dataui.js';
import { sharePath } from './sharing.js';
import { enhanceTerms } from './glossary.js';
import { search, sortBy, rank, rankText, plainWords, toCalculators, csvRows } from '../lib/industries';
import { pct, mult, num } from '../lib/format';

const ALL = data.industries, MKT = data.market.all, EXFIN = data.market.exFin, DEFAULT = 'Software (System & Application)';
const COLS = [['beta', 'Beta', v => num(v, 2)], ['wacc', 'Cost of capital', v => pct(v)], ['evEbitda', 'EV/EBITDA', v => mult(v)], ['pe', 'P/E', v => mult(v)], ['opMargin', 'Operating margin', v => pct(v)], ['netMargin', 'Net margin', v => pct(v)], ['de', 'Debt to equity', v => num(v, 2)]];
const BARS = [['wacc', 'Cost of capital', v => pct(v)], ['beta', 'Beta (risk vs the market)', v => num(v, 2)], ['evEbitda', 'Price paid per $1 of operating cash profit', v => mult(v)], ['opMargin', 'Operating margin', v => pct(v)], ['debtWeight', 'Share funded by borrowing', v => pct(v, 0)]];
const byName = name => ALL.find(i => i.name === name);
const cell = (v, f) => (v == null ? '—' : f(v));

export function renderIndustries(main) {
  const q = new URLSearchParams(location.search).get('i');
  let cur = byName(q) || byName(DEFAULT), sortKey = 'name', dir = 'asc', filter = '';
  const result = h('div', { class: 'd-page' }), tableHost = h('div'), input = h('input', { class: 'd-in', type: 'search', placeholder: 'Find an industry, such as software or banks', 'aria-label': 'Find an industry', autocomplete: 'off', maxlength: 40 }), sug = h('ul', { class: 'd-sug', id: 'ind-sug', role: 'listbox', 'aria-label': 'Matching industries', hidden: true }), count = h('p', { class: 'd-cap', role: 'status' });
  let hits = [], sel = -1;

  const choose = ind => { cur = ind; input.value = ''; filter = ''; hits = []; hideSug(); history.replaceState(null, '', '/industries?i=' + encodeURIComponent(ind.name)); drawResult(); drawTable(); };
  const hideSug = () => { sug.hidden = true; sel = -1; input.setAttribute('aria-expanded', 'false'); input.removeAttribute('aria-activedescendant'); };
  const drawSug = () => {
    const shown = hits.slice(0, 8);
    sug.replaceChildren(...shown.map((i, k) => h('li', { role: 'option', id: 'ind-s' + k, 'aria-selected': String(k === sel), onmousedown: e => { e.preventDefault(); choose(i); } }, h('span', {}, i.name))));
    sug.hidden = !shown.length; input.setAttribute('aria-expanded', String(!!shown.length));
    if (sel >= 0) input.setAttribute('aria-activedescendant', 'ind-s' + sel); else input.removeAttribute('aria-activedescendant');
  };
  input.setAttribute('role', 'combobox'); input.setAttribute('aria-autocomplete', 'list'); input.setAttribute('aria-expanded', 'false'); input.setAttribute('aria-controls', 'ind-sug');
  input.addEventListener('input', () => { filter = input.value; hits = filter.trim() ? search(ALL, filter) : []; sel = -1; drawSug(); drawTable(); });
  input.addEventListener('blur', () => setTimeout(hideSug, 120));
  input.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown' && hits.length) { e.preventDefault(); sel = (sel + 1) % Math.min(8, hits.length); drawSug(); }
    else if (e.key === 'ArrowUp' && hits.length) { e.preventDefault(); sel = (sel - 1 + Math.min(8, hits.length)) % Math.min(8, hits.length); drawSug(); }
    else if (e.key === 'Enter') { e.preventDefault(); const pickd = hits[Math.max(0, sel)]; if (pickd) choose(pickd); }
    else if (e.key === 'Escape') hideSug();
  });

  function drawResult() {
    const c = toCalculators(cur, data), words = plainWords(cur, MKT);
    const bar = ([k, label, f]) => { const r = rank(ALL, cur, k); return h('div', { class: 'ind-bar' }, h('div', { class: 'top' }, h('b', {}, label), h('span', {}, cell(cur[k], f))), h('div', { class: 'itrack', role: 'img', 'aria-label': `${label}: ${rankText(r)}` }, h('i', { style: `width:${r == null ? 0 : Math.max(3, Math.round(r * 100))}%` })), h('small', {}, rankText(r))); };
    const cmpRow = (label, k, f) => ({ label, cells: [cell(cur[k], f), cell(MKT[k], f), cell(EXFIN[k], f)] });
    const link = (id, label, st, extra) => (Object.keys(st).length >= 2 ? h('a', { class: 'd-btn main', href: sharePath(id, st), 'data-link': true, title: extra }, label + ' →') : null);
    result.replaceChildren(
      h('section', { class: 'd-card' }, h('div', { class: 'd-title' }, h('h2', {}, cur.name), h('p', { class: 'd-meta' }, `${cur.firms} US companies · data as of ${data.asOf.slice(0, 4)} update`)),
        statGrid([{ label: 'Cost of capital', value: cell(cur.wacc, v => pct(v)), sub: `vs ${pct(MKT.wacc)} all companies` }, { label: 'Beta', value: cell(cur.beta, v => num(v, 2)), sub: `vs ${num(MKT.beta, 2)} all companies` }, { label: 'EV/EBITDA', value: cell(cur.evEbitda, v => mult(v)), sub: cur.evEbitda == null ? 'Not used for banks, insurers and lenders' : `vs ${mult(MKT.evEbitda)} all companies` }, { label: 'P/E (trailing)', value: cell(cur.pe, v => mult(v)), sub: cur.losing != null ? `${pct(cur.losing, 0)} of firms lose money` : '' }, { label: 'Operating margin', value: cell(cur.opMargin, v => pct(v)), sub: `vs ${pct(MKT.opMargin)} all companies` }, { label: 'Debt to equity', value: cell(cur.de, v => num(v, 2)), sub: `vs ${num(MKT.de, 2)} all companies` }], 3)),
      words.length ? h('section', { class: 'd-card' }, h('h2', { class: 'd-h' }, 'In plain words'), ...words.map(w => h('p', { class: 'd-plain plain', html: w }))) : null,
      h('section', { class: 'd-card' }, h('h2', { class: 'd-h' }, 'Where it sits among all industries'), h('p', { class: 'd-sub' }, 'Each bar ranks this industry against the other ' + (ALL.length - 1) + '. A longer bar is a higher number, not necessarily a better one.'), h('div', { class: 'ind-bars' }, BARS.map(bar))),
      h('section', { class: 'd-card' }, h('h2', { class: 'd-h' }, 'Against the whole market'), dataTable({ head: ['', cur.name.length > 24 ? cur.name.slice(0, 22) + '…' : cur.name, 'All US companies', 'Excluding financials'], label: 'Industry against the market', rows: [cmpRow('Beta', 'beta', v => num(v, 2)), cmpRow('Unlevered beta', 'unlevBeta', v => num(v, 2)), cmpRow('Cost of equity', 'costEquity', v => pct(v)), cmpRow('Cost of capital', 'wacc', v => pct(v)), cmpRow('EV/EBITDA', 'evEbitda', v => mult(v)), cmpRow('P/E (trailing)', 'pe', v => mult(v)), cmpRow('Gross margin', 'grossMargin', v => pct(v)), cmpRow('Operating margin', 'opMargin', v => pct(v)), cmpRow('Net margin', 'netMargin', v => pct(v)), cmpRow('Debt to equity', 'de', v => num(v, 2))] })),
      h('section', { class: 'd-card' }, h('h2', { class: 'd-h' }, 'Use it as a starting point'), h('p', { class: 'd-sub plain' }, `When you value a company in ${cur.name}, these are sensible first guesses for its risk and cost of capital. Replace them with your own view.`),
        h('div', { class: 'd-row' }, link('wacc', 'Build the cost of capital', c.wacc, 'Fills beta, rates, debt cost and weights'), link('dcf', 'Start a DCF with these', c.dcf, 'Fills the discount rate, margin and tax'), link('comps', 'Use as peer multiples', c.comps, 'Fills EV/EBITDA and P/E')),
        h('p', { class: 'd-cap' }, `Risk-free rate ${pct(data.rf, 2)} and equity risk premium ${pct(data.erp, 2)} are the figures used in the same dataset, so the numbers fit together. The cost of capital calculator wants dollar amounts, so we enter the funding mix as 1,000 in total (for example 713 of equity and 287 of debt). Only the proportions matter.`)));
    enhanceTerms(result);
  }

  /* the table header is built once; only the rows are replaced, so focus and sideways scroll survive sorting and filtering */
  const heads = [['name', 'Industry'], ...COLS.map(([k, l]) => [k, l])], headCells = new Map(), tbody = h('tbody');
  const arrow = k => (sortKey === k ? (dir === 'asc' ? '▲' : '▼') : '↕');
  const pickRow = i => { choose(i); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const headRow = h('tr', {}, heads.map(([k, l]) => {
    const ar = h('span', { class: 'ar', 'aria-hidden': 'true' }), th = h('th', { scope: 'col', class: 'sort' }, h('button', { type: 'button', onclick: () => { if (sortKey === k) dir = dir === 'asc' ? 'desc' : 'asc'; else { sortKey = k; dir = k === 'name' ? 'asc' : 'desc'; } drawTable(); } }, l, ar));
    headCells.set(k, [th, ar]); return th;
  }));
  tableHost.append(h('div', { class: 'd-tw', role: 'region', 'aria-label': 'All industries', tabindex: '0' }, h('table', { class: 'd-t ind-t' }, h('thead', {}, headRow), tbody)));
  function drawTable() {
    const list = sortBy(filter.trim() ? search(ALL, filter) : ALL, sortKey, dir);
    count.textContent = `${list.length} of ${ALL.length} industries. Choose a name to see it above.`;
    heads.forEach(([k]) => { const [th, ar] = headCells.get(k); th.classList.toggle('on', sortKey === k); th.setAttribute('aria-sort', sortKey === k ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'); ar.textContent = arrow(k); });
    tbody.replaceChildren(...list.map(i => {
      const btn = h('button', { type: 'button', onclick: e => { e.stopPropagation(); pickRow(i); } }, i.name);
      if (i.name === cur.name) btn.setAttribute('aria-current', 'true');
      const tr = h('tr', { class: i.name === cur.name ? 'sel' : '' }, h('th', { scope: 'row' }, btn), COLS.map(([k, , f]) => h('td', { class: i[k] == null ? 'na' : null }, cell(i[k], f))));
      tr.addEventListener('click', () => pickRow(i)); return tr;
    }));
  }

  main.replaceChildren(
    head({ eyebrow: 'Benchmarks · US industries', title: 'Industry <em>benchmarks</em>', lead: 'How risky, how expensive and how profitable is a typical company in an industry? Use it to sanity-check your own numbers.' }),
    h('div', { class: 'd-page' },
      h('section', { class: 'd-card ind-pick' }, h('div', { class: 'd-search' }, h('form', { onsubmit: e => e.preventDefault(), role: 'search' }, input), sug),
        sourceLine({ source: 'Prof. Aswath Damodaran, NYU Stern (US companies, ' + data.asOf.slice(0, 4) + ' update)', url: 'https://pages.stern.nyu.edu/~adamodar/New_Home_Page/datacurrent.html', live: false, extra: h('span', {}, 'Updated once a year.') })),
      result,
      h('section', { class: 'd-card' }, h('div', { class: 'd-row between' }, h('h2', { class: 'd-h' }, 'Every industry'), h('button', { type: 'button', class: 'd-btn', onclick: () => saveCsv('industry-benchmarks.csv', csvRows(sortBy(filter.trim() ? search(ALL, filter) : ALL, sortKey, dir), data)) }, 'Download CSV')), count, tableHost),
      explainer('What do these numbers mean?', '<ul><li><b>Beta</b> measures how strongly a stock moves with the market. Above 1 means bigger swings than the market; below 1 means calmer.</li><li><b>Cost of capital</b> (WACC) is the average return investors and lenders require. A project should earn more than this.</li><li><b>EV/EBITDA</b> is the price of the whole business divided by its operating cash profit. Higher means investors are paying more for each dollar of profit.</li><li><b>P/E</b> is the share price divided by earnings per share. Averages here are simple averages and can be very high where many firms earn little.</li><li><b>Debt to equity</b> compares borrowed money with the market value of the owners\' shares.</li></ul><p>These are averages for large groups of companies. A single company can differ a lot. Use them as a starting point, not an answer.</p>')));
  drawResult(); drawTable(); enhanceTerms(main);
  return () => { input.removeAttribute('aria-activedescendant'); };
}
