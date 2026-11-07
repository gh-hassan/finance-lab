// @ts-nocheck
/* Company financials: the sections shown once a company has loaded. */
import { h, esc, statGrid, dataTable, chartBox, segmented, explainer, sourceLine, saveCsv } from './dataui.js';
import { col } from './visuals.js';
import { sharePath } from './sharing.js';
import { ratios, dupont, dupontShift, plainWords, toCalculators } from '../lib/fin';
import { money, pct, signedPct, mult, num, longDate, yy, monthYear } from '../lib/format';

const TABS = [['profit', 'Sales and profit'], ['margins', 'Margins'], ['cash', 'Cash'], ['balance', 'What it owns'], ['returns', 'Returns']];
const TAB_TITLE = { profit: 'Sales and net income by year', margins: 'Margins by year', cash: 'Cash flow by year', balance: 'Owed to others and owners\' money by year', returns: 'Return on equity and assets by year' };
const nan = v => (v == null ? NaN : v);
const pts = row => row.map((v, i) => [i, nan(v)]);
const any = row => row.some(v => v != null);

/** Which chart tabs have something to show for this company. */
export const tabsFor = (d, q) => TABS.filter(([k]) => ({ profit: () => any(d.rows.revenue) || any(d.rows.netIncome), margins: () => d.kind === 'standard' && (any(q.grossMargin) || any(q.operatingMargin) || any(q.netMargin)), cash: () => d.kind === 'standard' && (any(d.rows.cfo) || any(q.fcf)), balance: () => any(d.rows.assets) && any(d.rows.liabilities), returns: () => any(q.roe) || any(q.roa) }[k]()));

function chartSpec(tab, d, q) {
  const P = d.periods, S = (name, color, row, extra = {}) => ({ name, color, pts: pts(row), ...extra });
  const base = { xLabels: P.map(p => yy(p.end)), h: 300, hint: 'Slide across the chart to read each year.', title: TAB_TITLE[tab] };
  const withRead = (spec, fmt) => ({ ...spec, yFmt: fmt, yRead: fmt, readout: i => `<span class="rx">Year ended ${esc(longDate(P[i].end))}</span>` + spec.series.map(s => `<span class="ri"><i style="background:${col(s.color)}"></i>${esc(s.name)} <b>${esc(fmt(s.pts[i][1]))}</b></span>`).join('') });
  if (tab === 'profit') return withRead({ ...base, series: [S('Sales', 'c1', d.rows.revenue, { type: 'bars' }), S('Net income', 'c3', d.rows.netIncome, { type: 'bars' })].filter((_, k) => any(k ? d.rows.netIncome : d.rows.revenue)) }, v => money(v));
  if (tab === 'margins') return withRead({ ...base, series: [S('Gross margin', 'c1', q.grossMargin), S('Operating margin', 'c4', q.operatingMargin), S('Net margin', 'c3', q.netMargin)].filter(s => any(s.pts.map(p => (Number.isFinite(p[1]) ? 1 : null)))), yZero: true }, v => pct(v, 0));
  if (tab === 'cash') return withRead({ ...base, series: [S('Cash from operations', 'c1', d.rows.cfo, { type: 'bars' }), S('Spent on equipment', 'c4', d.rows.capex, { type: 'bars' }), S('Free cash flow', 'c3', q.fcf, { type: 'bars' })].filter(s => any(s.pts.map(p => (Number.isFinite(p[1]) ? 1 : null)))) }, v => money(v));
  if (tab === 'balance') return withRead({ ...base, bars: 'stack', series: [S('Owed to others', 'c4', d.rows.liabilities, { type: 'bars' }), S('Owners\' money', 'c3', d.rows.equity, { type: 'bars' })] }, v => money(v));
  return withRead({ ...base, series: [S('Return on equity', 'c1', q.roe), S('Return on assets', 'c4', q.roa)], yZero: true }, v => pct(v, 0));
}

const TAB_NOTE = {
  profit: 'Sales are what customers paid. Net income is what is left after every cost, interest and tax.',
  margins: 'A margin is profit as a share of sales. Higher and steadier is usually better.',
  cash: 'Free cash flow is the cash from the business minus what it spends keeping and growing its equipment.',
  balance: 'The two stacked parts add up to everything the company owns: it is paid for by what it owes plus what owners put in.',
  returns: 'Return on equity is profit per dollar of owners\' money. Return on assets is profit per dollar of everything the company owns.'
};

function chartCard(d, q, scope) {
  const tabs = tabsFor(d, q); if (!tabs.length) return null;
  let cur = tabs[0][0];
  const cap = h('p', { class: 'd-cap' }, TAB_NOTE[cur]), box = chartBox(chartSpec(cur, d, q));
  scope.add(box.destroy);
  const seg = segmented({ options: tabs.map(([k, l]) => [k, l]), value: cur, label: 'Choose a chart', onChange: v => { cur = v; box.update(chartSpec(v, d, q)); cap.textContent = TAB_NOTE[v]; } });
  return h('section', { class: 'd-card' }, h('h2', { class: 'd-h' }, 'Ten years at a glance'), seg.el, box.el, cap);
}

function dupontCard(d, q) {
  const n = d.periods.length, years = []; for (let i = Math.max(0, n - 6); i < n; i++) if (dupont(d, i)) years.push(i);
  if (!years.length) return null;
  const body = h('div', { class: 'fin-tabs' }), draw = i => {
    const x = dupont(d, i), sh = dupontShift(d, i), moved = sh ? sh.factor : '';
    const tile = (k, label, val, what) => h('div', { class: 't' + (moved === k ? ' moved' : '') }, h('small', {}, label), h('b', {}, val), h('span', {}, what));
    const txt = { netMargin: 'net margin', assetTurnover: 'asset turnover', equityMultiplier: 'equity multiplier' };
    const f = { netMargin: v => pct(v), assetTurnover: v => mult(v, 2), equityMultiplier: v => mult(v, 2) };
    body.replaceChildren(
      h('div', { class: 'fin-eq' }, tile('netMargin', 'Net margin', pct(x.netMargin), 'Profit kept from each $1 of sales'), h('div', { class: 'op', 'aria-hidden': 'true' }, '×'),
        tile('assetTurnover', 'Asset turnover', mult(x.assetTurnover, 2), 'Sales made from each $1 of assets'), h('div', { class: 'op', 'aria-hidden': 'true' }, '×'),
        tile('equityMultiplier', 'Equity multiplier', mult(x.equityMultiplier, 2), 'Assets funded by each $1 of owners\' money'), h('div', { class: 'op', 'aria-hidden': 'true' }, '='),
        h('div', { class: 't key' }, h('small', {}, 'Return on equity'), h('b', {}, pct(x.roe)), h('span', {}, 'Profit per $1 of owners\' money'))),
      sh ? h('p', { class: 'd-plain plain', html: `Compared with the year before, return on equity went from <b>${pct(sh.roeFrom)}</b> to <b>${pct(sh.roeTo)}</b>. The biggest change was <b>${txt[sh.factor]}</b>, which moved from ${f[sh.factor](sh.from)} to ${f[sh.factor](sh.to)} (outlined above).` }) : null);
  };
  const seg = segmented({ options: years.map(i => [String(i), yy(d.periods[i].end)]), value: String(years[years.length - 1]), label: 'Choose a year', onChange: v => draw(+v) });
  draw(years[years.length - 1]);
  return h('section', { class: 'd-card' }, h('h2', { class: 'd-h' }, 'Why is the return on equity what it is?'), h('p', { class: 'd-sub plain' }, 'DuPont analysis splits it into three simple parts. Multiply them and you get the return. Change any one and the return changes.'), h('div', { class: 'fin-yr' }, h('span', {}, 'Year'), seg.el), body);
}

function tableRows(d, q) {
  const r = d.rows, std = d.kind === 'standard', cell = (v, f, tone) => ({ t: f(v), tone: v != null && tone && v < 0 ? 'neg' : '' });
  const M = (label, row, title) => ({ label, title, cells: row.map(v => cell(v, money, true)), raw: row, fmt: 'money' });
  const P = (label, row, f = v => pct(v), title) => ({ label, title, cells: row.map(v => cell(v, f, false)), raw: row });
  const rows = [{ group: 'Income' }, M('Sales', r.revenue), ...(std ? [M('Gross profit', r.grossProfit, 'Sales minus the direct cost of what was sold'), M('Operating income', r.operatingIncome, 'Profit from running the business, before interest and tax')] : []), M('Net income', r.netIncome), { label: 'Earnings per share', title: 'Net income divided by diluted shares', cells: q.eps.map(v => ({ t: v == null ? '—' : money(v, { d: 2 }), tone: '' })), raw: q.eps }];
  if (std) rows.push({ group: 'Cash' }, M('Cash from operations', r.cfo), M('Spent on equipment (capex)', r.capex), M('Free cash flow', q.fcf, 'Cash from operations minus capex'));
  rows.push({ group: 'What it owns and owes' }, M('Cash', r.cash), M('Total assets', r.assets), M('Total liabilities', r.liabilities), M('Owners\' equity', r.equity), ...(std ? [M('Borrowings', r.debt, 'Long-term debt as the company reports it')] : []));
  rows.push({ group: 'Ratios' }, P('Sales growth', q.revenueGrowth, v => signedPct(v)));
  if (std) rows.push(P('Gross margin', q.grossMargin), P('Operating margin', q.operatingMargin), P('Net margin', q.netMargin));
  rows.push(P('Return on equity', q.roe), P('Return on assets', q.roa));
  if (std) rows.push(P('Borrowings to equity', q.debtToEquity, v => mult(v, 2)), P('Current ratio', q.currentRatio, v => mult(v, 2), 'Short-term assets divided by short-term bills'), P('Interest cover', q.interestCover, v => mult(v, 1), 'Operating income divided by interest paid'));
  const kept = rows.filter(x => x.group || any(x.raw));
  /* a heading with nothing under it is dropped */
  return kept.filter((x, i) => !x.group || (kept[i + 1] && !kept[i + 1].group));
}

const LABELS = { rev0: 'revenue', g1: 'growth', margin: 'operating margin', tax: 'tax rate', da: 'depreciation', capex: 'capex', netdebt: 'net debt', shares: 'share count', rev: 'revenue', ni: 'net income', ebitda: 'EBITDA', book: 'book value', debt: 'net debt', sh: 'share count' };
const NEEDED = { dcf: ['rev0', 'margin', 'netdebt', 'shares'], comps: ['rev', 'ni', 'ebitda', 'debt', 'sh'] };

function handoff(d) {
  if (d.kind !== 'standard') return null;
  const { dcf, comps } = toCalculators(d);
  if (Object.keys(dcf).length < 3) return null;
  const missing = (id, vals) => NEEDED[id].filter(k => vals[k] == null).map(k => LABELS[k]);
  const link = (id, label, vals) => h('a', { class: 'd-btn main', href: sharePath(id, vals), 'data-link': true, title: `Fills ${Object.keys(vals).length} inputs` }, label + ' →');
  const gaps = [['DCF', missing('dcf', dcf)], ['comps', missing('comps', comps)]].filter(([, m]) => m.length);
  const lowMargin = d.rows.operatingIncome && d.rows.operatingIncome[d.periods.length - 1] != null && d.rows.operatingIncome[d.periods.length - 1] <= 0;
  return h('section', { class: 'd-card fin-hand' }, h('h2', { class: 'd-h' }, 'Take these numbers to a calculator'), h('p', { class: 'd-sub plain' }, 'We fill in what the filing shows. The forecast is yours to change: growth, margin and the discount rate decide the answer.'),
    h('div', { class: 'd-row' }, link('dcf', 'Value it with a DCF', dcf), Object.keys(comps).length >= 4 ? link('comps', 'Compare with peers', comps) : null),
    gaps.length ? h('p', { class: 'd-note warn' }, gaps.map(([n, m]) => `The ${n} calculator will keep its sample values for ${m.join(', ')}, because the filing does not report ${m.length > 1 ? 'them' : 'it'} in a standard way. Type your own before you trust the answer.`).join(' ')) : null,
    lowMargin ? h('p', { class: 'd-note warn' }, 'This company lost money from operations in the latest year, so the margin and growth we pass on start at the calculators\' lowest settings. Set your own.') : null,
    h('p', { class: 'd-cap' }, 'Amounts are in $ millions. Past results do not predict the future.'));
}

export function renderResult(d, scope) {
  const q = ratios(d), n = d.periods.length, i = n - 1, std = d.kind === 'standard', r = d.rows, frag = h('div', { class: 'd-page' });
  const tone = v => (v == null ? '' : v < 0 ? 'bad' : '');
  const tiles = [
    { label: 'Sales', value: money(r.revenue[i]), sub: q.revenueGrowth[i] != null ? signedPct(q.revenueGrowth[i]) + ' vs last year' : '' },
    { label: 'Net income', value: money(r.netIncome[i]), sub: q.netMargin[i] != null && std ? pct(q.netMargin[i]) + ' of sales' : '', tone: tone(r.netIncome[i]) },
    std ? { label: 'Operating margin', value: pct(q.operatingMargin[i]), tone: tone(q.operatingMargin[i]) } : { label: 'Return on assets', value: pct(q.roa[i]) },
    { label: 'Return on equity', value: pct(q.roe[i]), tone: tone(q.roe[i]) },
    std ? { label: 'Free cash flow', value: money(q.fcf[i]), sub: q.fcfMargin[i] != null ? pct(q.fcfMargin[i]) + ' of sales' : '', tone: tone(q.fcf[i]) } : { label: 'Total assets', value: money(r.assets[i]) },
    std ? { label: 'Borrowings to equity', value: mult(q.debtToEquity[i], 2) } : { label: 'Owners\' equity', value: money(r.equity[i]) }
  ];
  const words = plainWords(d, d.name);
  frag.append(...[
    h('section', { class: 'd-card' },
      h('div', { class: 'd-row between' }, h('div', { class: 'd-title' }, h('h2', {}, d.name), h('p', { class: 'd-meta' }, `${d.ticker} · year ended ${longDate(d.periods[i].end)}${d.filed ? ' · filed ' + longDate(d.filed) : ''} · US dollars`)),
        h('div', { class: 'd-row' }, d.kind === 'financial' ? h('span', { class: 'd-badge' }, 'BANK / INSURER') : null, h('button', { type: 'button', class: 'd-btn', onclick: () => { const rows = tableRows(d, q).filter(x => !x.group); saveCsv(`${d.ticker}-financials.csv`, [[d.name + ' (' + d.ticker + '), annual figures from SEC 10-K filings'], ['Line item', ...d.periods.map(p => p.end)], ...rows.map(x => [x.label, ...x.raw.map(v => (v == null ? '' : v))]), [], ['Source: US SEC EDGAR. Made with SmartWealth. For study, not investment advice.']]); } }, 'Download CSV'))),
      sourceLine({ source: 'SEC EDGAR 10-K filings', asOf: d.asOf, url: d.filingsUrl }),
      statGrid(tiles, tiles.length % 3 === 0 ? 3 : 0)),
    words.length ? h('section', { class: 'd-card' }, h('h2', { class: 'd-h' }, 'In plain words'), ...words.map(w => h('p', { class: 'd-plain plain', html: w }))) : null,
    chartCard(d, q, scope), dupontCard(d, q),
    h('section', { class: 'd-card' }, h('h2', { class: 'd-h' }, 'All the numbers'), h('p', { class: 'd-sub' }, 'One column per fiscal year, oldest on the left. Scroll sideways for more years.'), dataTable({ head: ['', ...d.periods.map(p => monthYear(p.end))], rows: tableRows(d, q), label: `${d.name} annual figures` })),
    handoff(d),
    h('section', { class: 'd-card' }, h('h2', { class: 'd-h' }, 'Before you rely on these'), h('ul', { class: 'plain d-cap', style: 'margin:0;padding-left:20px;display:grid;gap:6px' },
      [...(d.notes || []), 'Companies label some items differently, so a line can be missing even when the company has it. When it matters, check the filing itself.', 'These are annual figures from 10-K filings. The latest quarters are not included. Each year is taken from the most recent filing that reports it, so a restated year can use a slightly different definition from its neighbours.', d.kind === 'financial' ? 'Banks, insurers and similar firms are shown with fewer measures because margins and debt mean something different for them.' : 'Debt is the long-term borrowing the company reports. Leases and short-term borrowing may or may not be included.'].map(t => h('li', {}, t))),
      explainer('What is a 10-K?', '<p>Every US-listed company files a 10-K once a year with the Securities and Exchange Commission. It has audited financial statements: the <b>income statement</b> (profit), the <b>balance sheet</b> (what it owns and owes) and the <b>cash flow statement</b> (where cash came from and went).</p><p>This page reads those filings directly, so the numbers are the company\'s own.</p>'))].filter(Boolean));
  return frag;
}
