// @ts-nocheck
/* Batch 2: comparable-company valuation, a three-statement model, depreciation with lease-vs-buy, and dividends versus buybacks. */
import { register } from '../lib/registry';
import { nf, money, pct, parseList, isNum } from '../lib/math';
import { hbars } from '../ui/visuals.js';
import { multipleStats, depreciation, leaseVsBuy, threeStatement, payout } from '../lib/corp';

const M1 = x => money(x, 1);

/* ================= Comparable companies ================= */
register({
  id: 'comps', group: 'Valuation', title: 'Relative Valuation (Comps)',
  blurb: 'Value a company from the multiples that similar companies trade at: EV/EBITDA, P/E, P/B and EV/Sales.',
  fields: [
    { id: 'ebitda', label: 'EBITDA ($M)', v: 250, step: 10 },
    { id: 'ni', label: 'Net income ($M)', v: 120, step: 5 },
    { id: 'rev', label: 'Revenue ($M)', v: 1400, step: 50 },
    { id: 'book', label: 'Book value of equity ($M)', v: 600, step: 25 },
    { id: 'debt', label: 'Net debt ($M)', v: 400, step: 25 },
    { id: 'sh', label: 'Shares outstanding (M)', v: 80, step: 5 },
    { id: 'px', label: 'Current share price (optional)', v: 22, step: 1, pre: '$' },
    { id: 'evE', label: 'Peers: EV/EBITDA', type: 'text', v: '9.5, 11, 8.2, 12.4, 10.1', help: 'One multiple per peer company, separated by commas.' },
    { id: 'pe', label: 'Peers: P/E', type: 'text', v: '17, 21, 15, 19, 23' },
    { id: 'pb', label: 'Peers: P/B', type: 'text', v: '2.2, 3.1, 1.8, 2.6' },
    { id: 'evS', label: 'Peers: EV/Sales', type: 'text', v: '1.6, 2.1, 1.3, 1.9' }
  ],
  concept: `<h4>The idea</h4>
<p>Instead of forecasting cash flows, ask what the market pays for similar companies. Take their multiples, apply them to this company's own numbers, and read off a value. It is the fastest check on a DCF and how most analysts quote a price range.</p>
<div class="formula">Enterprise value = multiple × EBITDA (or Sales)     Equity = EV − net debt</div>
<div class="formula">Equity = P/E × net income     Equity = P/B × book value     Price = equity ÷ shares</div>
<ul><li>Use the <b>median</b>, not the mean: one odd peer can drag the average.</li><li>EV-based multiples ignore how the company is financed; P/E and P/B do not.</li><li>Peers must be genuinely alike in business, growth and risk, or the multiples mean little.</li></ul>`,
  calc(v) {
    if (!(v.sh > 0)) return { note: 'Shares outstanding must be above zero.', cards: [], charts: [], steps: [] };
    const methods = [
      { id: 'evE', name: 'EV / EBITDA', base: v.ebitda, ev: true, list: parseList(v.evE) },
      { id: 'pe', name: 'P / E', base: v.ni, ev: false, list: parseList(v.pe) },
      { id: 'pb', name: 'P / B', base: v.book, ev: false, list: parseList(v.pb) },
      { id: 'evS', name: 'EV / Sales', base: v.rev, ev: true, list: parseList(v.evS) }
    ].map(m => ({ ...m, st: multipleStats(m.list) })).filter(m => m.st && m.base > 0);
    if (!methods.length) return { note: 'Add peer multiples (positive numbers, separated by commas) and a matching company figure for at least one method.', cards: [], charts: [], steps: [] };
    const price = (m, x) => ((m.ev ? x * m.base - v.debt : x * m.base) / v.sh);
    const rows = methods.map(m => ({ ...m, lo: price(m, m.st.low), mid: price(m, m.st.mid), hi: price(m, m.st.high) }));
    const blended = rows.reduce((s, r) => s + r.mid, 0) / rows.length, lowB = rows.reduce((s, r) => s + r.lo, 0) / rows.length, highB = rows.reduce((s, r) => s + r.hi, 0) / rows.length;
    const up = v.px > 0 ? blended / v.px - 1 : NaN;
    const colors = ['c1', 'c2', 'c3', 'c4'];
    const hb = hbars([...rows.map((r, i) => ({ label: r.name, from: Math.max(0, r.lo), to: Math.max(0, r.hi), color: colors[i % 4], text: `${money(r.lo, 2)} to ${money(r.hi, 2)} · median ${money(r.mid, 2)}` })), { label: 'Blended range', from: Math.max(0, lowB), to: Math.max(0, highB), color: 'good', text: `${money(lowB, 2)} to ${money(highB, 2)} · ${money(blended, 2)}` }]);
    return {
      cards: [
        { key: true, label: 'Value per share (blended median)', value: money(blended, 2), sub: `average of ${rows.length} method${rows.length > 1 ? 's' : ''}` },
        { label: 'Likely range', value: `${money(lowB, 2)} to ${money(highB, 2)}`, sub: '25th to 75th percentile of peers' },
        ...(isNum(up) ? [{ label: 'Versus current price', value: `${up >= 0 ? '+' : ''}${nf(up * 100, 1)}%`, sub: `${money(v.px, 2)} today`, tone: up >= 0 ? 'good' : 'bad' }] : []),
        ...rows.map(r => ({ label: `${r.name} (median ${nf(r.st.mid, 1)}×)`, value: money(r.mid, 2), sub: `${r.st.n} peers` }))
      ],
      charts: [{ type: 'html', title: 'Football field: value per share by method', sub: 'Each bar spans the 25th to 75th percentile of the peer multiples applied to this company.', html: hb }],
      tables: [{ title: 'Multiples and implied values', cols: ['Method', 'Peers', 'Low (25th)', 'Median', 'High (75th)', 'Implied price low', 'median', 'high'], rows: rows.map(r => [r.name, r.st.n, nf(r.st.low, 2) + '×', nf(r.st.mid, 2) + '×', nf(r.st.high, 2) + '×', money(r.lo, 2), money(r.mid, 2), money(r.hi, 2)]) }],
      steps: rows.map(r => [r.name, r.ev ? `EV = ${nf(r.st.mid, 2)}× × ${M1(r.base)} = ${M1(r.st.mid * r.base)}M; equity = EV − net debt ${M1(v.debt)}M = ${M1(r.st.mid * r.base - v.debt)}M; ÷ ${nf(v.sh, 1)}M shares = ${money(r.mid, 2)}` : `Equity = ${nf(r.st.mid, 2)}× × ${M1(r.base)}M = ${M1(r.st.mid * r.base)}M; ÷ ${nf(v.sh, 1)}M shares = ${money(r.mid, 2)}`])
    };
  }
});

/* ================= Three-statement model ================= */
register({
  id: 'model3', group: 'Analysis', title: 'Three-Statement Model',
  blurb: 'Project the income statement, cash flow and balance sheet for five years, and watch the balance sheet balance.',
  fields: [
    { id: 'rev0', label: 'Revenue this year ($M)', v: 1000, step: 50 },
    { id: 'growth', label: 'Revenue growth, years 1 to 5 (%)', type: 'text', v: '10, 8, 6, 5, 4', help: 'Five numbers separated by commas.' },
    { id: 'cogs', label: 'Cost of goods (% of revenue)', v: 60, step: 1, unit: '%', slider: [20, 90, 1] },
    { id: 'opex', label: 'Operating expenses (% of revenue)', v: 15, step: 1, unit: '%', slider: [0, 50, 1] },
    { id: 'da', label: 'Depreciation (% of revenue)', v: 4, step: 0.5, unit: '%' },
    { id: 'capex', label: 'Capital spending (% of revenue)', v: 5, step: 0.5, unit: '%' },
    { id: 'nwc', label: 'Working capital (% of revenue growth)', v: 10, step: 1, unit: '%' },
    { id: 'tax', label: 'Tax rate', v: 25, step: 1, unit: '%' },
    { id: 'rate', label: 'Interest rate on debt', v: 6, step: 0.25, unit: '%' },
    { id: 'repay', label: 'Debt repaid each year ($M)', v: 20, step: 5 },
    { id: 'payout', label: 'Share of profit paid as dividends', v: 30, step: 5, unit: '%', slider: [0, 100, 5] },
    { id: 'cash0', label: 'Cash today ($M)', v: 100, step: 10 },
    { id: 'debt0', label: 'Debt today ($M)', v: 300, step: 25 },
    { id: 'ppe0', label: 'Plant and equipment today ($M)', v: 500, step: 25 },
    { id: 'nwc0', label: 'Working capital today ($M)', v: 100, step: 10 }
  ],
  concept: `<h4>The idea</h4>
<p>The three statements are one story told three ways. Profit from the income statement flows into the cash flow statement, which changes cash and debt on the balance sheet, which in turn sets next year's interest. If the balance sheet does not balance, something is wrong.</p>
<div class="formula">Net income = (Revenue − COGS − Opex − D&A − Interest) × (1 − tax)</div>
<div class="formula">Cash flow from operations = Net income + D&A − increase in working capital</div>
<div class="formula">Assets = Cash + Working capital + Plant   must equal   Debt + Equity</div>
<ul><li>Free cash flow = operating cash flow − capital spending.</li><li>Equity grows by retained profit: net income minus dividends.</li><li>The check row below the balance sheet should read zero in every year.</li></ul>`,
  calc(v) {
    const g = parseList(v.growth).slice(0, 5).map(x => x / 100); while (g.length < 5) g.push(g.length ? g[g.length - 1] : 0.05);
    if (!(v.rev0 > 0)) return { note: 'Revenue must be above zero.', cards: [], charts: [], steps: [] };
    const ys = threeStatement({ rev0: v.rev0, growth: g, cogsPct: v.cogs / 100, opexPct: v.opex / 100, daPct: v.da / 100, capexPct: v.capex / 100, nwcPct: v.nwc / 100, tax: v.tax / 100, rate: v.rate / 100, repay: v.repay, payout: v.payout / 100, cash0: v.cash0, debt0: v.debt0, ppe0: v.ppe0, nwc0: v.nwc0 });
    const last = ys[4], cagr = Math.pow(last.rev / v.rev0, 1 / 5) - 1, maxErr = Math.max(...ys.map(y => Math.abs(y.check))), fcf5 = ys.reduce((s, y) => s + y.fcf, 0);
    const cols = ['', 'Year 1', 'Year 2', 'Year 3', 'Year 4', 'Year 5'], row = (n, f, st) => [n, ...ys.map(y => [f(y), st || ''])];
    const bold = 'font-weight:700';
    const tbl = (title, rows) => ({ title, cols, rows, left: true });
    const neg = x => (x < -1e-9 ? 'color:var(--bad)' : '');
    return {
      cards: [
        { key: true, label: 'Year 5 net income', value: M1(last.ni) + 'M', sub: `${pct(last.ni / last.rev, 1)} of revenue` },
        { label: 'Revenue growth per year (CAGR)', value: pct(cagr, 1), sub: `${M1(v.rev0)}M to ${M1(last.rev)}M` },
        { label: 'Free cash flow, five years', value: M1(fcf5) + 'M', sub: 'operating cash flow less capital spending', tone: fcf5 >= 0 ? 'good' : 'bad' },
        { label: 'Year 5 cash', value: M1(last.cash) + 'M', sub: `debt ${M1(last.debt)}M`, tone: last.cash >= 0 ? '' : 'bad' },
        { label: 'Return on equity, year 5', value: pct(last.ni / last.equity, 1), sub: `equity ${M1(last.equity)}M` },
        { label: 'Balance sheet check', value: maxErr < 1e-6 ? 'Balances' : 'Off by ' + nf(maxErr, 4), sub: 'assets − debt − equity, every year', tone: maxErr < 1e-6 ? 'good' : 'bad' }
      ],
      info: ys.some(y => y.cash < 0) ? 'Cash goes negative in some year: the company would need to borrow more or pay less in dividends.' : '',
      charts: [{
        title: 'Revenue, profit and free cash flow', sub: 'Five-year projection in $M.',
        series: [{ name: 'Revenue', type: 'line', color: 'c2', pts: [[0, v.rev0], ...ys.map((y, i) => [i + 1, y.rev])] }, { name: 'Net income', type: 'line', color: 'c1', pts: ys.map((y, i) => [i + 1, y.ni]) }, { name: 'Free cash flow', type: 'line', color: 'c3', pts: ys.map((y, i) => [i + 1, y.fcf]) }],
        hlines: [{ y: 0 }], xlab: 'Year', xFmt: x => 'Y' + nf(x, 0), yFmt: x => '$' + nf(x, 0), yRead: x => '$' + nf(x, 1) + 'M'
      }],
      tables: [
        tbl('Income statement ($M)', [row('Revenue', y => nf(y.rev, 1)), row('Cost of goods', y => '−' + nf(y.cogs, 1)), row('Gross profit', y => nf(y.gross, 1), bold), row('Operating expenses', y => '−' + nf(y.opex, 1)), row('EBITDA', y => nf(y.ebitda, 1), bold), row('Depreciation', y => '−' + nf(y.da, 1)), row('EBIT', y => nf(y.ebit, 1), bold), row('Interest', y => '−' + nf(y.interest, 1)), row('Tax', y => '−' + nf(y.taxes, 1)), row('Net income', y => nf(y.ni, 1), bold)]),
        tbl('Cash flow statement ($M)', [row('Net income', y => nf(y.ni, 1)), row('Add back depreciation', y => nf(y.da, 1)), row('Cash flow from operations', y => nf(y.cfo, 1), bold), row('Capital spending', y => '−' + nf(y.capex, 1)), row('Free cash flow', y => nf(y.fcf, 1), bold), row('Debt repaid', y => '−' + nf(y.repay, 1)), row('Dividends', y => '−' + nf(y.div, 1)), row('Change in cash', y => nf(y.dcash, 1), bold)]),
        tbl('Balance sheet ($M)', [row('Cash', y => nf(y.cash, 1)), row('Working capital', y => nf(y.nwc, 1)), row('Plant and equipment', y => nf(y.ppe, 1)), row('Total assets', y => nf(y.assets, 1), bold), row('Debt', y => nf(y.debt, 1)), row('Equity', y => nf(y.equity, 1)), row('Debt + equity', y => nf(y.debt + y.equity, 1), bold), row('Check (should be 0)', y => nf(y.check, 6))].map(r => r))
      ],
      steps: [
        ['Revenue', `Year 1 = ${nf(v.rev0, 1)} × (1 + ${pct(g[0], 1)}) = ${nf(ys[0].rev, 1)}`],
        ['Profit', `EBIT = ${nf(ys[0].rev, 1)} × (1 − ${v.cogs}% − ${v.opex}% − ${v.da}%) = ${nf(ys[0].ebit, 1)}; less interest ${nf(ys[0].interest, 1)} and tax gives net income ${nf(ys[0].ni, 1)}`],
        ['Cash', `Operating cash flow = net income + depreciation − working capital build = ${nf(ys[0].cfo, 1)}; after capital spending, debt repayment and dividends cash changes by ${nf(ys[0].dcash, 1)}`],
        ['Balance', `Assets ${nf(ys[0].assets, 1)} = debt ${nf(ys[0].debt, 1)} + equity ${nf(ys[0].equity, 1)}. Equity = last year's equity + net income − dividends.`]
      ]
    };
  }
});

/* ================= Depreciation and lease versus buy ================= */
register({
  id: 'lease', group: 'Corporate Finance', title: 'Depreciation & Lease vs Buy',
  blurb: 'Compare depreciation methods and decide whether to lease or buy an asset by the net advantage to leasing.',
  fields: [
    { id: 'cost', label: 'Cost of the asset', v: 100000, step: 5000, pre: '$' },
    { id: 'salv', label: 'Value at the end (salvage)', v: 10000, step: 1000, pre: '$' },
    { id: 'life', label: 'Years of use', v: 5, step: 1, min: 1, max: 20, unit: 'yrs' },
    { id: 'method', label: 'Depreciation method', type: 'select', v: 'sl', options: [['sl', 'Straight line'], ['ddb', 'Double declining balance'], ['syd', 'Sum of the years digits'], ['macrs5', 'MACRS 5-year (US tax)'], ['macrs7', 'MACRS 7-year (US tax)']] },
    { id: 'tax', label: 'Tax rate', v: 25, step: 1, unit: '%' },
    { id: 'rate', label: 'After-tax cost of debt', v: 5, step: 0.25, unit: '%' },
    { id: 'pay', label: 'Lease payment each year', v: 24000, step: 1000, pre: '$' },
    { id: 'term', label: 'Lease term', v: 5, step: 1, min: 1, max: 20, unit: 'yrs' }
  ],
  concept: `<h4>The idea</h4>
<p>Depreciation spreads the cost of an asset over its life. It is not a cash cost, but it lowers taxable profit, so it creates a <b>tax shield</b>. Faster methods move the shield earlier, which is worth more in present value.</p>
<div class="formula">Tax shield each year = depreciation × tax rate</div>
<div class="formula">Net advantage to leasing = cost − PV(after-tax lease payments) − PV(depreciation tax shields) − PV(after-tax salvage)</div>
<ul><li>If the net advantage is positive, leasing is cheaper than buying with cash.</li><li>Discount at the <b>after-tax cost of debt</b>, because a lease is a substitute for borrowing.</li><li>Lease payments are tax deductible, so each payment costs only (1 − tax) of its size.</li></ul>`,
  calc(v) {
    if (!(v.cost > 0) || v.salv < 0 || v.salv >= v.cost) return { note: 'Cost must be above zero and the end value must be below the cost.', cards: [], charts: [], steps: [] };
    const t = v.tax / 100, r = v.rate / 100, res = leaseVsBuy(v.cost, v.salv, v.life, v.method, t, r, v.pay, v.term);
    const names = { sl: 'Straight line', ddb: 'Double declining', syd: 'Sum of years', macrs5: 'MACRS 5', macrs7: 'MACRS 7' };
    const all = Object.keys(names).map(k => ({ k, dep: depreciation(v.cost, v.salv, v.life, k) }));
    const pvs = all.map(a => a.dep.reduce((s, d, i) => s + (d * t) / Math.pow(1 + r, i + 1), 0));
    const book = dep => { let b = v.cost; return [[0, b], ...dep.map((d, i) => [i + 1, (b -= d)])]; };
    const dep = res.dep;
    return {
      cards: [
        { key: true, label: res.nal >= 0 ? 'Net advantage to leasing' : 'Net advantage to buying', value: money(Math.abs(res.nal), 0), sub: res.nal >= 0 ? 'leasing is cheaper in today\'s money' : 'buying is cheaper in today\'s money', tone: res.nal >= 0 ? 'good' : 'bad' },
        { label: 'PV of lease payments (after tax)', value: money(res.pvLease, 0), sub: `${nf(v.term, 0)} payments of ${money(v.pay, 0)}` },
        { label: 'PV of depreciation tax shield', value: money(res.pvShield, 0), sub: names[v.method] },
        { label: 'PV of salvage (after tax)', value: money(res.pvSalvage, 0), sub: `${money(v.salv, 0)} at the end` },
        { label: 'NPV of buying', value: money(res.buyNpv, 0), sub: 'cost less shields and salvage' },
        { label: 'Lease payment that breaks even', value: money((v.cost - res.pvShield - res.pvSalvage) / Math.max(1e-9, (1 - t) * (r === 0 ? Math.round(v.term) : (1 - Math.pow(1 + r, -Math.round(v.term))) / r)), 0), sub: 'above this, buying wins' }
      ],
      charts: [
        { title: 'Value left on the books', sub: 'Book value falls faster under accelerated methods.', series: all.map((a, i) => ({ name: names[a.k], type: 'line', color: ['c1', 'c2', 'c3', 'c4', 'c1'][i], dash: i === 4, pts: book(a.dep) })), xlab: 'Year', xFmt: x => 'Y' + nf(x, 0), yFmt: x => '$' + nf(x / 1000, 0) + 'K', yRead: x => money(x, 0) },
        { title: 'Present value of the tax shield by method', sub: 'Same asset, different timing. MACRS depreciates the full cost; the other methods stop at salvage.', series: [{ name: 'PV of tax shield', type: 'bars', color: 'c1', pts: pvs.map((p, i) => [i + 1, p]) }], xlab: 'Method (1 straight, 2 double declining, 3 sum of years, 4 MACRS 5, 5 MACRS 7)', xFmt: x => nf(x, 0), yFmt: x => '$' + nf(x / 1000, 0) + 'K', yRead: x => money(x, 0) }
      ],
      tables: [{ title: 'Depreciation schedule: ' + names[v.method], cols: ['Year', 'Depreciation', 'Tax shield', 'Present value of shield'], rows: dep.map((d, i) => [i + 1, money(d, 0), money(d * t, 0), money((d * t) / Math.pow(1 + r, i + 1), 0)]) }],
      steps: [
        ['Depreciation', `${names[v.method]} on ${money(v.cost, 0)} gives ${dep.map(d => money(d, 0)).join(', ')}.`],
        ['Tax shield', `Each year: depreciation × ${v.tax}% , discounted at ${v.rate}%. Total present value ${money(res.pvShield, 0)}.`],
        ['Lease payments', `${money(v.pay, 0)} × (1 − ${v.tax}%) = ${money(v.pay * (1 - t), 0)} a year for ${nf(v.term, 0)} years, discounted at ${v.rate}%: ${money(res.pvLease, 0)}.`],
        ['Net advantage', `${money(v.cost, 0)} − ${money(res.pvLease, 0)} − ${money(res.pvShield, 0)} − ${money(res.pvSalvage, 0)} = ${money(res.nal, 0)}. ${res.nal >= 0 ? 'Positive, so lease.' : 'Negative, so buy.'}`]
      ]
    };
  }
});
/* ================= Dividends versus buybacks ================= */
register({
  id: 'payout', group: 'Corporate Finance', title: 'Dividends vs Buybacks',
  blurb: 'Return cash to shareholders as a dividend or a share buyback, and see what each does to per-share numbers and to after-tax wealth.',
  fields: [
    { id: 'earn', label: 'Net income ($M)', v: 500, step: 25 },
    { id: 'sh', label: 'Shares outstanding (M)', v: 100, step: 5 },
    { id: 'px', label: 'Share price', v: 60, step: 1, pre: '$' },
    { id: 'cash', label: 'Cash to return ($M)', v: 200, step: 10 },
    { id: 'td', label: 'Tax on dividends', v: 30, step: 1, unit: '%' },
    { id: 'tg', label: 'Tax on capital gains', v: 15, step: 1, unit: '%' },
    { id: 'basis', label: 'What you paid per share', v: 30, step: 1, pre: '$' },
    { id: 'hold', label: 'Shares you own', v: 1000, step: 100 }
  ],
  concept: `<h4>The idea</h4>
<p>With no taxes, returning cash by dividend or buyback makes no difference to shareholders (Modigliani and Miller): the price drops by the dividend, or the share count drops by the buyback, and wealth is unchanged. Taxes break the tie.</p>
<div class="formula">Dividend: price falls by cash ÷ shares; you pay dividend tax on all of it</div>
<div class="formula">Buyback: price stays; you sell shares for the same cash and pay capital gains tax only on the gain</div>
<ul><li>Buybacks raise EPS because the same profit is shared by fewer shares.</li><li>If capital gains are taxed less than dividends, or you paid a high price already, a buyback leaves you better off.</li><li>A buyback makes sense only when the shares are not overpriced; a company cannot create value by buying at too high a price.</li></ul>`,
  calc(v) {
    if (!(v.sh > 0) || !(v.px > 0) || !(v.earn > 0)) return { note: 'Net income, shares and share price must all be above zero.', cards: [], charts: [], steps: [] };
    if (v.cash >= v.px * v.sh) return { note: 'The cash to return is as large as the whole company. Lower it.', cards: [], charts: [], steps: [] };
    const o = payout({ earnings: v.earn, shares: v.sh, price: v.px, cash: v.cash, taxDiv: v.td / 100, taxCg: v.tg / 100, basis: v.basis, hold: v.hold });
    const better = o.edge > 0.005 ? 'buyback' : o.edge < -0.005 ? 'dividend' : 'neither';
    return {
      cards: [
        { key: true, label: better === 'neither' ? 'Dividend and buyback are equal' : `After tax, a ${better} leaves you better off by`, value: money(Math.abs(o.edge), 2), sub: `on your ${nf(v.hold, 0)} shares`, tone: better === 'neither' ? '' : 'good' },
        { label: 'Dividend per share', value: money(o.dps, 2), sub: `yield ${pct(o.yieldPct, 2)}` },
        { label: 'EPS today', value: money(o.eps, 2), sub: `P/E ${nf(o.pe, 1)}` },
        { label: 'EPS after the buyback', value: money(o.epsAfter, 2), sub: `${nf(o.sharesAfter, 1)}M shares left (−${nf(o.bought, 2)}M)`, tone: 'good' },
        { label: 'Payout ratio', value: pct(o.payoutRatio, 1), sub: 'cash returned ÷ net income' },
        { label: 'Your after-tax cash: dividend', value: money(o.divCash, 0), sub: `buyback: ${money(o.buyCash, 0)}` }
      ],
      charts: [{ type: 'html', title: 'Your total after-tax wealth', sub: 'Cash received plus the value of the shares you still hold, for the same company cash.', html: hbars([{ label: 'Keep the cash', from: 0, to: o.retainTotal, color: 'c4', text: money(o.retainTotal, 0) }, { label: 'Pay a dividend', from: 0, to: o.divTotal, color: 'c2', text: money(o.divTotal, 0) }, { label: 'Buy back shares', from: 0, to: o.buyTotal, color: 'c1', text: money(o.buyTotal, 0) }]) }],
      tables: [{ title: 'What happens to you', cols: ['', 'Pay a dividend', 'Buy back shares'], rows: [['Cash before tax', money(o.dps * v.hold, 0), money(o.dps * v.hold, 0)], ['Tax paid', money(o.dps * v.hold - o.divCash, 0), money(o.dps * v.hold - o.buyCash, 0)], ['Cash after tax', money(o.divCash, 0), money(o.buyCash, 0)], ['Shares you still hold', nf(v.hold, 0), nf(v.hold - o.sold, 1)], ['Value of those shares', money(o.divKept, 0), money(o.buyKept, 0)], ['Total after tax', money(o.divTotal, 0), money(o.buyTotal, 0)]] }],
      steps: [
        ['Per share', `EPS = ${nf(v.earn, 0)} ÷ ${nf(v.sh, 0)} = ${money(o.eps, 2)}. Dividend per share = ${nf(v.cash, 0)} ÷ ${nf(v.sh, 0)} = ${money(o.dps, 2)}.`],
        ['Buyback', `${nf(v.cash, 0)}M ÷ ${money(v.px, 2)} = ${nf(o.bought, 2)}M shares retired, leaving ${nf(o.sharesAfter, 2)}M. EPS = ${nf(v.earn, 0)} ÷ ${nf(o.sharesAfter, 2)} = ${money(o.epsAfter, 2)}.`],
        ['Dividend holder', `Cash ${money(o.dps * v.hold, 0)} × (1 − ${v.td}%) = ${money(o.divCash, 0)}, plus shares worth ${money(o.divKept, 0)} at ${money(v.px - o.dps, 2)} each.`],
        ['Buyback holder', `Sell ${nf(o.sold, 1)} shares at ${money(v.px, 2)} for ${money(o.dps * v.hold, 0)}; tax ${v.tg}% of the gain over ${money(v.basis, 2)} costs ${money(o.dps * v.hold - o.buyCash, 0)}. Keep ${nf(v.hold - o.sold, 1)} shares worth ${money(o.buyKept, 0)}.`]
      ]
    };
  }
});
