// @ts-nocheck
import { register } from '../lib/registry';
import { nf, nfx, money, pct, mult, yrs, compact, parseList, sum, range, npv, irr, findRoot, annF, fvF, bondPrice, ncdf, bs, isNum } from '../lib/math';
import { hbars } from '../ui/visuals.js';

/* ================= CORPORATE FINANCE ================= */
register({
  id: 'wacc', group: 'Corporate Finance', title: 'Cost of Capital (CAPM & WACC)',
  blurb: 'Build the cost of equity with CAPM, blend it with after-tax debt, and see how leverage moves WACC.',
  fields: [
    { id: 'rf', label: 'Risk-free rate', v: 4.2, step: 0.1, unit: '%' },
    { id: 'beta', label: 'Equity beta (levered)', v: 1.15, step: 0.05, slider: [0.3, 2.5, 0.05] },
    { id: 'erp', label: 'Equity risk premium', v: 5.5, step: 0.1, unit: '%' },
    { id: 'extra', label: 'Size / specific premium', v: 0, step: 0.25, unit: '%' },
    { id: 'kd', label: 'Pre-tax cost of debt', v: 6, step: 0.1, unit: '%' },
    { id: 'tax', label: 'Tax rate', v: 25, step: 1, unit: '%' },
    { id: 'E', label: 'Market value of equity ($M)', v: 700, step: 50 },
    { id: 'D', label: 'Market value of debt ($M)', v: 300, step: 50 },
    { id: 'step', label: 'Debt cost rises per +10% debt weight', v: 50, step: 10, unit: 'bps' }
  ],
  concept: `<h4>The idea</h4>
<p>WACC is the average return investors require, weighted by how much of the firm each group funds. It is the discount rate for a project with the firm's average risk.</p>
<div class="formula">k_e = r_f + β · ERP (+ premium)          CAPM</div>
<div class="formula">WACC = E/V · k_e + D/V · k_d · (1 − t)</div>
<div class="formula">β_unlevered = β_levered ÷ [1 + (1 − t) · D/E]          Hamada</div>
<ul><li>Debt is cheaper than equity, and its interest is tax deductible, so some debt lowers WACC.</li><li>More debt makes equity riskier, so beta and k_e rise. Beyond a point, lenders also charge more. The curve below shows the trade-off and where WACC bottoms out.</li><li>Use <b>market</b> values for weights, not book values.</li></ul>`,
  calc(v) {
    const rf = v.rf / 100, erp = v.erp / 100, ex = v.extra / 100, kd = v.kd / 100, t = v.tax / 100, V = v.E + v.D;
    if (V <= 0) return { note: 'Enter positive equity and debt values.', cards: [], charts: [], steps: [] };
    const ke = rf + v.beta * erp + ex, kdat = kd * (1 - t), we = v.E / V, wd = v.D / V, W = we * ke + wd * kdat;
    const bu = v.beta / (1 + (1 - t) * (v.D / v.E));
    const at = w => {
      const bl = bu * (1 + (1 - t) * (w / (1 - w))), k = rf + bl * erp + ex, kdw = Math.max(0.001, kd + v.step / 10000 * ((w - wd) / 0.1));
      return { ke: k, kd: kdw * (1 - t), w: (1 - w) * k + w * kdw * (1 - t) };
    };
    const ws = range(0, 0.9, 0.025), curve = ws.map(w => at(w));
    let best = 0; curve.forEach((c, k) => { if (c.w < curve[best].w) best = k; });
    return {
      cards: [
        { key: true, label: 'WACC', value: pct(W, 2), sub: 'your capital structure' },
        { label: 'Cost of equity (CAPM)', value: pct(ke, 2), sub: `${pct(rf, 1)} + ${nf(v.beta, 2)} × ${pct(erp, 1)}` },
        { label: 'After-tax cost of debt', value: pct(kdat, 2), sub: `${pct(kd, 2)} × (1 − ${pct(t, 0)})` },
        { label: 'Weights', value: `${nf(we * 100, 1)}% / ${nf(wd * 100, 1)}%`, sub: 'equity / debt' },
        { label: 'Unlevered beta', value: nf(bu, 3), sub: 'business risk only' },
        { label: 'Lowest WACC on the curve', value: pct(curve[best].w, 2), sub: `at ${nf(ws[best] * 100, 1)}% debt`, tone: 'good' }
      ],
      charts: [
        { type: 'donut', title: 'Who funds the firm', sub: 'Capital structure by market value.', parts: [{ name: 'Equity', value: v.E, color: 'c1', note: pct(ke, 2) + ' required' }, { name: 'Debt', value: v.D, color: 'c2', note: pct(kdat, 2) + ' after tax' }], center: { big: pct(W, 2), small: 'WACC' } },
        {
          title: 'Leverage and the cost of capital', sub: 'Cost of equity rises with debt, but cheap after-tax debt pulls WACC down, until borrowing costs climb.',
          series: [{ name: 'WACC', type: 'line', color: 'c1', pts: ws.map((w, k) => [w * 100, curve[k].w * 100]) }, { name: 'Cost of equity', type: 'line', color: 'c4', pts: ws.map((w, k) => [w * 100, curve[k].ke * 100]) }, { name: 'After-tax debt', type: 'line', color: 'c3', pts: ws.map((w, k) => [w * 100, curve[k].kd * 100]) }],
          vlines: [{ x: wd * 100, label: 'today', color: 'c2' }], xlab: 'Debt as % of capital', xFmt: x => nf(x, 0) + '%', yFmt: x => nf(x, 0) + '%', yRead: x => nf(x, 2) + '%'
        }
      ],
      steps: [
        ['Cost of equity (CAPM)', `k_e = r_f + β × ERP${ex ? ' + premium' : ''} = ${pct(rf, 2)} + ${nf(v.beta, 3)} × ${pct(erp, 2)}${ex ? ' + ' + pct(ex, 2) : ''} = ${pct(ke, 3)}`],
        ['After-tax cost of debt', `k_d × (1 − t) = ${pct(kd, 2)} × (1 − ${pct(t, 0)}) = ${pct(kdat, 3)}`],
        ['Weights', `V = E + D = ${money(v.E, 0)}M + ${money(v.D, 0)}M = ${money(V, 0)}M\nE/V = ${pct(we, 2)}     D/V = ${pct(wd, 2)}`],
        ['WACC', `${pct(we, 2)} × ${pct(ke, 3)} + ${pct(wd, 2)} × ${pct(kdat, 3)} = ${pct(W, 3)}`],
        ['Unlever the beta', `β_u = ${nf(v.beta, 3)} ÷ [1 + (1 − ${pct(t, 0)}) × ${nf(v.D / v.E, 3)}] = ${nf(bu, 3)}`]
      ]
    };
  }
});

register({
  id: 'capstruct', group: 'Corporate Finance', title: 'Capital Structure & Leverage',
  blurb: 'Compare all-equity financing with a debt mix: EPS, the EBIT indifference point, financial leverage and the tax shield.',
  fields: [
    { id: 'cap', label: 'Capital to raise ($M)', v: 1000, step: 50 },
    { id: 'ebit', label: 'Expected EBIT ($M)', v: 150, step: 5, slider: [20, 400, 5] },
    { id: 'tax', label: 'Tax rate', v: 25, step: 1, unit: '%' },
    { id: 'price', label: 'Share price', v: 20, step: 1, pre: '$' },
    { id: 'rate', label: 'Interest rate on debt', v: 7, step: 0.25, unit: '%' },
    { id: 'dp', label: 'Plan B: debt share of capital', v: 40, step: 5, unit: '%', slider: [0, 90, 5] },
    { id: 'ku', label: 'Unlevered cost of equity (for M&M)', v: 10, step: 0.25, unit: '%' }
  ],
  concept: `<h4>The idea</h4>
<p>Borrowing replaces shares with fixed interest. When operating profit is high, there are fewer shares to split it among, so EPS jumps. When profit is low, the interest is still due, so EPS drops faster. That is financial leverage.</p>
<div class="formula">EPS = (EBIT − Interest) · (1 − t) ÷ Shares</div>
<div class="formula">Indifference EBIT* = Interest_B · Shares_A ÷ (Shares_A − Shares_B)</div>
<div class="formula">DFL = EBIT ÷ (EBIT − Interest)</div>
<div class="formula">M&M with taxes: V_L = V_U + t · D       k_e(L) = k_u + (k_u − k_d)(1 − t) D/E</div>
<ul><li>Above the indifference EBIT the debt plan has higher EPS, below it the equity plan does.</li><li>Higher EPS from leverage is not free value. Shareholders bear more risk, and the extra return is compensation. The only value created in M&amp;M (with taxes) is the interest tax shield.</li></ul>`,
  calc(v) {
    const t = v.tax / 100, dp = v.dp / 100, r = v.rate / 100, ku = v.ku / 100;
    const SA = v.cap / v.price, D = v.cap * dp, EB = v.cap - D, SB = EB / v.price, IB = D * r;
    const eps = (ebit, I, S) => { const ebt = ebit - I; return (ebt > 0 ? ebt * (1 - t) : ebt) / S; };
    const star = SA - SB > 1e-9 ? IB * SA / (SA - SB) : NaN;
    const epsA = eps(v.ebit, 0, SA), epsB = eps(v.ebit, IB, SB), dfl = v.ebit > IB ? v.ebit / (v.ebit - IB) : NaN;
    const VU = v.ebit * (1 - t) / ku, VL = VU + t * D, keL = EB > 0 ? ku + (ku - r) * (1 - t) * D / EB : ku;
    const xs = range(0, v.ebit * 2.5, v.ebit * 2.5 / 50);
    const vl = [{ x: v.ebit, label: 'expected EBIT', color: 'c4' }];
    if (isNum(star) && star > 0 && star <= v.ebit * 2.5) vl.push({ x: star, label: `indifference ${nf(star, 1)}`, color: 'mute' });
    const ds = range(0, 0.9, 0.05);
    const sc = [-0.5, -0.25, 0, 0.25, 0.5].map(d => { const e = v.ebit * (1 + d); return [`${d >= 0 ? '+' : '−'}${Math.abs(d * 100)}% EBIT`, nf(e, 1), money(eps(e, 0, SA)), money(eps(e, IB, SB)), pct(eps(e, 0, SA) * SA / v.cap, 1), pct(EB > 0 ? eps(e, IB, SB) * SB / EB : NaN, 1)]; });
    return {
      cards: [
        { key: true, label: 'EPS: all equity', value: money(epsA), sub: `${nf(SA, 1)}M shares` },
        { label: `EPS: ${nf(v.dp, 0)}% debt`, value: money(epsB), sub: `${nf(SB, 1)}M shares · interest ${money(IB, 1)}M`, tone: epsB >= epsA ? 'good' : 'bad' },
        { label: 'Indifference EBIT', value: isNum(star) ? money(star, 1) + 'M' : 'n/a', sub: 'EPS equal at this EBIT' },
        { label: 'Degree of financial leverage', value: isNum(dfl) ? nf(dfl, 3) : 'n/a', sub: '1% EBIT move → this % EPS move' },
        { label: 'Value if unlevered (V_U)', value: money(VU, 1) + 'M', sub: 'EBIT(1−t) ÷ k_u' },
        { label: 'Value with debt (V_L)', value: money(VL, 1) + 'M', sub: `+ ${money(t * D, 1)}M tax shield` },
        { label: 'Levered cost of equity', value: pct(keL, 2), sub: `up from ${pct(ku, 2)}` }
      ],
      charts: [
        { title: 'EPS across the EBIT range', sub: 'The steeper line is the levered plan. They cross at the indifference EBIT.', series: [{ name: 'All equity', type: 'line', color: 'c1', pts: xs.map(e => [e, eps(e, 0, SA)]) }, { name: `${nf(v.dp, 0)}% debt`, type: 'line', color: 'c2', pts: xs.map(e => [e, eps(e, IB, SB)]) }], vlines: vl, hlines: [{ y: 0 }], xlab: 'EBIT ($M)', xFmt: x => nf(x, 0), yFmt: x => '$' + nf(x, 1), yRead: money },
        { title: 'More debt widens the range of outcomes', sub: 'EPS at expected EBIT versus a 50% EBIT drop, as the debt share rises.', series: [{ name: 'EPS at expected EBIT', type: 'line', color: 'c1', pts: ds.map(w => [w * 100, eps(v.ebit, v.cap * w * r, v.cap * (1 - w) / v.price)]) }, { name: 'EPS if EBIT falls 50%', type: 'line', color: 'c4', pts: ds.map(w => [w * 100, eps(v.ebit * 0.5, v.cap * w * r, v.cap * (1 - w) / v.price)]) }], hlines: [{ y: 0 }], xlab: 'Debt as % of capital', xFmt: x => nf(x, 0) + '%', yFmt: x => '$' + nf(x, 1), yRead: money }
      ],
      steps: [
        ['Shares and interest', `Plan A shares = ${money(v.cap, 0)}M ÷ ${money(v.price, 2)} = ${nf(SA, 2)}M\nPlan B: debt ${money(D, 1)}M, equity ${money(EB, 1)}M → shares ${nf(SB, 2)}M, interest = ${money(D, 1)}M × ${pct(r, 2)} = ${money(IB, 2)}M`],
        ['EPS at expected EBIT', `A: ${nf(v.ebit, 1)} × (1 − ${pct(t, 0)}) ÷ ${nf(SA, 2)} = ${money(epsA)}\nB: (${nf(v.ebit, 1)} − ${nf(IB, 2)}) × (1 − ${pct(t, 0)}) ÷ ${nf(SB, 2)} = ${money(epsB)}`],
        ['Indifference point', isNum(star) ? `EBIT* = ${nf(IB, 2)} × ${nf(SA, 2)} ÷ (${nf(SA, 2)} − ${nf(SB, 2)}) = ${money(star, 2)}M` : 'Plans have identical share counts, so there is no crossover.'],
        ['Financial leverage', isNum(dfl) ? `DFL = EBIT ÷ (EBIT − I) = ${nf(v.ebit, 1)} ÷ ${nf(v.ebit - IB, 1)} = ${nf(dfl, 3)}` : 'Interest exceeds EBIT.'],
        ['M&M with taxes', `V_U = ${nf(v.ebit, 1)} × (1 − ${pct(t, 0)}) ÷ ${pct(ku, 1)} = ${money(VU, 1)}M\nV_L = V_U + t·D = ${money(VU, 1)} + ${pct(t, 0)} × ${money(D, 1)} = ${money(VL, 1)}M`]
      ],
      tables: [{ title: 'EPS scenarios', cols: ['Scenario', 'EBIT ($M)', 'EPS: equity', 'EPS: debt', 'ROE: equity', 'ROE: debt'], rows: sc }]
    };
  }
});

register({
  id: 'breakeven', group: 'Corporate Finance', title: 'Break-even & Operating Leverage',
  blurb: 'Contribution margin, break-even volume, margin of safety and how fixed costs magnify profit swings.',
  fields: [
    { id: 'p', label: 'Price per unit', v: 50, step: 1, pre: '$' },
    { id: 'vc', label: 'Variable cost per unit', v: 30, step: 1, pre: '$' },
    { id: 'fc', label: 'Fixed costs per period', v: 100000, step: 5000, pre: '$' },
    { id: 'q', label: 'Expected units sold', v: 8000, step: 250, slider: [500, 20000, 250] },
    { id: 'tp', label: 'Target operating profit', v: 50000, step: 5000, pre: '$' }
  ],
  concept: `<h4>The idea</h4>
<p>Each unit sold contributes its price minus variable cost toward covering fixed costs. Once fixed costs are covered, every extra unit adds contribution straight to profit.</p>
<div class="formula">Contribution margin = P − V          CM ratio = (P − V) ÷ P</div>
<div class="formula">Break-even units = Fixed ÷ (P − V)</div>
<div class="formula">Units for target profit = (Fixed + Target) ÷ (P − V)</div>
<div class="formula">DOL = Contribution ÷ EBIT = Q(P − V) ÷ [Q(P − V) − Fixed]</div>
<ul><li><b>Margin of safety</b> is how far sales can fall before you lose money.</li><li><b>DOL</b> says that a 1% change in sales changes operating profit by DOL percent. It is largest close to break-even and falls as volume grows.</li></ul>`,
  calc(v) {
    const cm = v.p - v.vc, ratio = v.p ? cm / v.p : NaN;
    if (cm <= 0) return { note: 'Price must be above variable cost, otherwise each sale loses money.', cards: [], charts: [], steps: [] };
    const be = v.fc / cm, ebit = v.q * cm - v.fc, mos = v.q - be, dol = ebit > 0 ? v.q * cm / ebit : NaN, tpu = (v.fc + v.tp) / cm;
    const U = Math.ceil(Math.max(be * 1.8, v.q * 1.4, 10) / 10) * 10, us = range(0, U, U / 40);
    const rev = us.map(u => u * v.p), tc = us.map(u => v.fc + u * v.vc);
    const pcs = range(-30, 30, 2);
    return {
      cards: [
        { key: true, label: 'Break-even volume', value: nf(be, 0) + ' units', sub: `${money(be * v.p, 0)} of revenue` },
        { label: 'Contribution per unit', value: money(cm), sub: `${pct(ratio, 1)} of price` },
        { label: 'Operating profit at expected sales', value: money(ebit, 0), sub: `${nf(v.q, 0)} units`, tone: ebit >= 0 ? 'good' : 'bad' },
        { label: 'Margin of safety', value: pct(mos / v.q, 1), sub: `${nf(mos, 0)} units above break-even`, tone: mos >= 0 ? 'good' : 'bad' },
        { label: 'Degree of operating leverage', value: isNum(dol) ? nf(dol, 2) : 'n/a', sub: isNum(dol) ? `+10% sales → +${nf(dol * 10, 1)}% profit` : 'needs positive profit' },
        { label: 'Units for target profit', value: nf(tpu, 0), sub: `to earn ${money(v.tp, 0)}` }
      ],
      charts: [
        {
          title: 'Revenue, cost and profit', sub: 'Profit is the gap between revenue and total cost. It turns positive at the break-even volume.',
          series: [{ name: 'Revenue', type: 'line', color: 'c1', pts: us.map((u, k) => [u, rev[k]]) }, { name: 'Total cost', type: 'line', color: 'c4', pts: us.map((u, k) => [u, tc[k]]) }, { name: 'Fixed cost', type: 'line', color: 'c3', dash: true, pts: us.map(u => [u, v.fc]) }],
          vlines: [{ x: be, label: 'break-even', color: 'c2' }, { x: v.q, label: 'expected', color: 'mute' }], xlab: 'Units sold', xFmt: x => nf(x, 0), yFmt: compact, yRead: money,
          readout: i => `<span class="rx">${nf(us[i], 0)} units</span><span class="ri"><i style="background:var(--c1)"></i>Revenue <b>${money(rev[i], 0)}</b></span><span class="ri"><i style="background:var(--c4)"></i>Total cost <b>${money(tc[i], 0)}</b></span><span class="ri">Profit <b class="${rev[i] - tc[i] >= 0 ? 'pos' : 'neg'}">${money(rev[i] - tc[i], 0)}</b></span>`
        },
        isNum(dol) ? { title: 'Operating leverage in action', sub: 'Profit changes by DOL times the change in sales. The dashed line is a 1-for-1 change.', series: [{ name: '% change in profit', type: 'line', color: 'c1', pts: pcs.map(x => [x, dol * x]) }, { name: '% change in sales', type: 'line', color: 'c2', dash: true, pts: pcs.map(x => [x, x]) }], hlines: [{ y: 0 }], xlab: 'Change in sales', xFmt: x => x + '%', yFmt: x => nf(x, 0) + '%', yRead: x => nf(x, 1) + '%' } : null
      ].filter(Boolean),
      steps: [
        ['Contribution margin', `CM = P − V = ${money(v.p)} − ${money(v.vc)} = ${money(cm)} per unit (${pct(ratio, 1)})`],
        ['Break-even', `Q* = Fixed ÷ CM = ${money(v.fc, 0)} ÷ ${money(cm)} = ${nf(be, 2)} units`],
        ['Operating profit', `EBIT = Q × CM − Fixed = ${nf(v.q, 0)} × ${money(cm)} − ${money(v.fc, 0)} = ${money(ebit, 0)}`],
        ['Margin of safety', `(${nf(v.q, 0)} − ${nf(be, 1)}) ÷ ${nf(v.q, 0)} = ${pct(mos / v.q, 2)}`],
        ['Operating leverage', isNum(dol) ? `DOL = ${money(v.q * cm, 0)} ÷ ${money(ebit, 0)} = ${nf(dol, 3)}` : 'Not defined while profit is zero or negative.'],
        ['Target profit', `Q = (${money(v.fc, 0)} + ${money(v.tp, 0)}) ÷ ${money(cm)} = ${nf(tpu, 1)} units`]
      ]
    };
  }
});

register({
  id: 'wc', group: 'Corporate Finance', title: 'Working Capital & Inventory',
  blurb: 'Cash conversion cycle and economic order quantity: how long cash is tied up, and the cheapest way to reorder.',
  fields: [
    { id: 'sales', label: 'Annual sales', v: 8000000, step: 100000, pre: '$' },
    { id: 'cogs', label: 'Annual cost of goods sold', v: 6000000, step: 100000, pre: '$' },
    { id: 'inv', label: 'Average inventory', v: 800000, step: 25000, pre: '$' },
    { id: 'ar', label: 'Average receivables', v: 1100000, step: 25000, pre: '$' },
    { id: 'ap', label: 'Average payables', v: 700000, step: 25000, pre: '$' },
    { id: 'days', label: 'Days in year', v: 365, step: 1 },
    { id: 'dem', label: 'EOQ · annual demand (units)', v: 12000, step: 500 },
    { id: 'S', label: 'EOQ · cost per order', v: 50, step: 5, pre: '$' },
    { id: 'H', label: 'EOQ · holding cost per unit per year', v: 2.5, step: 0.25, pre: '$' },
    { id: 'lead', label: 'Lead time (days)', v: 7, step: 1 },
    { id: 'ss', label: 'Safety stock (units)', v: 100, step: 10 }
  ],
  concept: `<h4>The idea</h4>
<p>Between paying suppliers and collecting from customers, cash is tied up. The cash conversion cycle (CCC) measures how many days that lasts. Shorter means less financing needed.</p>
<div class="formula">DIO = Inventory ÷ COGS × days     DSO = Receivables ÷ Sales × days     DPO = Payables ÷ COGS × days</div>
<div class="formula">CCC = DIO + DSO − DPO</div>
<div class="formula">EOQ = √(2 · D · S ÷ H)          Total cost = (D ÷ Q) · S + (Q ÷ 2) · H</div>
<ul><li>Stretching payables or collecting faster shortens the CCC, but may strain suppliers or customers.</li><li>At the EOQ, ordering cost and holding cost are equal, and total cost is lowest.</li></ul>`,
  calc(v) {
    const dio = v.inv / v.cogs * v.days, dso = v.ar / v.sales * v.days, dpo = v.ap / v.cogs * v.days, ccc = dio + dso - dpo;
    const eoq = Math.sqrt(2 * v.dem * v.S / v.H), orders = v.dem / eoq, oc = orders * v.S, hc = eoq / 2 * v.H, rop = v.dem / v.days * v.lead + v.ss;
    const qs = range(eoq * 0.2, eoq * 3, eoq * 2.8 / 60);
    const hb = hbars([
      { label: 'Days in inventory', from: 0, to: dio, color: 'c3', text: nf(dio, 1) + ' days' },
      { label: 'Days to collect', from: dio, to: dio + dso, color: 'c1', text: nf(dso, 1) + ' days' },
      { label: 'Days to pay suppliers', from: 0, to: dpo, color: 'c2', text: nf(dpo, 1) + ' days' },
      { label: 'Cash conversion cycle', from: Math.min(dpo, dio + dso), to: Math.max(dpo, dio + dso), color: ccc >= 0 ? 'c4' : 'good', text: nf(ccc, 1) + ' days' }
    ]);
    return {
      cards: [
        { key: true, label: 'Cash conversion cycle', value: nf(ccc, 1) + ' days', sub: 'DIO + DSO − DPO' },
        { label: 'Days inventory (DIO)', value: nf(dio, 1), sub: `turns ${nf(v.days / dio, 1)}× a year` },
        { label: 'Days sales outstanding', value: nf(dso, 1), sub: 'time to collect' },
        { label: 'Days payables (DPO)', value: nf(dpo, 1), sub: 'time to pay' },
        { label: 'Cash tied up in the cycle', value: money(ccc * v.cogs / v.days, 0), sub: 'CCC × daily COGS' },
        { head: 'Inventory ordering' },
        { key: true, label: 'Economic order quantity', value: nf(eoq, 0) + ' units', sub: `${nf(orders, 1)} orders a year, every ${nf(v.days / orders, 0)} days` },
        { label: 'Annual ordering cost', value: money(oc, 0), sub: 'orders × cost per order' },
        { label: 'Annual holding cost', value: money(hc, 0), sub: 'average stock × holding cost' },
        { label: 'Total inventory cost', value: money(oc + hc, 0), sub: 'lowest at the EOQ' },
        { label: 'Reorder point', value: nf(rop, 0) + ' units', sub: `${v.lead} days of demand + safety stock` }
      ],
      charts: [
        { type: 'html', title: 'The cash conversion cycle', sub: 'Cash goes out when inventory is bought and comes back when customers pay. Payables delay the outflow.', html: hb },
        { title: 'Order size and total cost', sub: 'Big orders mean fewer orders but more stock to carry. The best size sits where the two costs cross.', series: [{ name: 'Ordering cost', type: 'line', color: 'c2', pts: qs.map(q => [q, v.dem / q * v.S]) }, { name: 'Holding cost', type: 'line', color: 'c3', pts: qs.map(q => [q, q / 2 * v.H]) }, { name: 'Total cost', type: 'line', color: 'c1', pts: qs.map(q => [q, v.dem / q * v.S + q / 2 * v.H]) }], vlines: [{ x: eoq, label: `EOQ ${nf(eoq, 0)}`, color: 'c4' }], xlab: 'Units per order', xFmt: x => nf(x, 0), yFmt: x => '$' + nf(x, 0), yRead: money }
      ],
      steps: [
        ['Days inventory', `DIO = ${money(v.inv, 0)} ÷ ${money(v.cogs, 0)} × ${v.days} = ${nf(dio, 2)}`],
        ['Days sales outstanding', `DSO = ${money(v.ar, 0)} ÷ ${money(v.sales, 0)} × ${v.days} = ${nf(dso, 2)}`],
        ['Days payables', `DPO = ${money(v.ap, 0)} ÷ ${money(v.cogs, 0)} × ${v.days} = ${nf(dpo, 2)}`],
        ['Cycle', `CCC = ${nf(dio, 2)} + ${nf(dso, 2)} − ${nf(dpo, 2)} = ${nf(ccc, 2)} days`],
        ['EOQ', `√(2 × ${nf(v.dem, 0)} × ${money(v.S, 2)} ÷ ${money(v.H, 2)}) = ${nf(eoq, 2)} units`],
        ['Total cost at EOQ', `(${nf(v.dem, 0)} ÷ ${nf(eoq, 1)}) × ${money(v.S, 2)} + (${nf(eoq, 1)} ÷ 2) × ${money(v.H, 2)} = ${money(oc, 0)} + ${money(hc, 0)} = ${money(oc + hc, 0)}`],
        ['Reorder point', `Daily demand × lead time + safety = ${nf(v.dem / v.days, 2)} × ${v.lead} + ${v.ss} = ${nf(rop, 1)} units`]
      ]
    };
  }
});
