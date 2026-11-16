// @ts-nocheck
import { register } from '../lib/registry';
import { nf, nfx, money, pct, mult, yrs, compact, parseList, sum, range, npv, irr, findRoot, annF, fvF, bondPrice, ncdf, bs, isNum } from '../lib/math';
import { hbars } from '../ui/visuals.js';

/* ================= VALUATION ================= */
register({
  id: 'bond', group: 'Valuation', title: 'Bond Price & Risk (Duration)',
  blurb: 'Find a bond\'s price, or work out its yield from its price. Then see how rate changes move the price, using duration and convexity.',
  fields: [
    { id: 'solve', label: 'What do you want to find?', type: 'select', v: 'price', options: [['price', 'Price (you know the yield)'], ['ytm', 'Yield to maturity, YTM (you know the price)']] },
    { id: 'face', label: 'Face value (paid back at the end)', v: 1000, step: 100, pre: '$' },
    { id: 'cr', label: 'Yearly interest rate (coupon)', v: 5, step: 0.125, unit: '%' },
    { id: 'ytm', label: 'Yield to maturity (YTM: yearly return if held to the end)', v: 6, step: 0.125, unit: '%', slider: [0.5, 15, 0.125] },
    { id: 'price', label: 'Market price', v: 925, step: 1, pre: '$' },
    { id: 'yrs', label: 'Years to maturity', v: 10, step: 1, min: 0.5, slider: [1, 30, 1] },
    { id: 'm', label: 'Interest payments per year', type: 'select', v: '2', options: [['1', 'Annual'], ['2', 'Semi-annual'], ['4', 'Quarterly'], ['12', 'Monthly']] },
    { id: 'shock', label: 'Rate change to test (in bps; 100 bps = 1%)', v: 100, step: 25, unit: 'bps', slider: [-300, 300, 25] }
  ],
  concept: `<h4>The idea</h4>
<p>A bond pays regular interest (coupons) and then returns its face value at the end (maturity). Its price is what those payments are worth today at the market yield. When yields rise, the price falls. The link is curved, not straight.</p>
<div class="formula">Price = Σ C ÷ (1+y/m)^t  +  F ÷ (1+y/m)^N</div>
<div class="formula">Macaulay duration = Σ [t · PV(CF_t)] ÷ Price ÷ m      Modified = Macaulay ÷ (1 + y/m)</div>
<div class="formula">ΔP/P ≈ − D_mod · Δy + ½ · Convexity · (Δy)²</div>
<ul><li><b>Coupon above yield:</b> the bond sells for more than its face value (a premium). Below yield: it sells for less (a discount). When they are equal, it sells at face value (par).</li><li><b>Duration</b> is the balance point of the payments in time. It also shows how much the price moves when rates move.</li><li><b>Convexity</b> is the bend in the price curve. It helps the holder: prices rise more than duration says when yields fall, and fall less when yields rise.</li></ul>`,
  show: { price: v => v.solve === 'ytm', ytm: v => v.solve === 'price' },
  calc(v) {
    const F = v.face, cr = v.cr / 100, m = +v.m, N = Math.max(1, Math.round(v.yrs * m)), c = F * cr / m;
    let y = v.ytm / 100, P;
    if (v.solve === 'price') P = bondPrice(F, cr, y, m, N);
    else { P = v.price; y = findRoot(x => bondPrice(F, cr, x, m, N) - P, -0.05, 1, 4000); }
    if (!isNum(P) || !isNum(y)) return { solved: { id: v.solve === 'price' ? 'price' : 'ytm', value: NaN }, note: 'No yield found for that price. Check the price and coupon.', cards: [], charts: [], steps: [] };
    const i = y / m, rows = [];
    for (let t = 1; t <= N; t++) { const cf = c + (t === N ? F : 0), df = Math.pow(1 + i, -t); rows.push({ t, yr: t / m, cf, df, pv: cf * df }); }
    const pvSum = sum(rows.map(r => r.pv));
    const mac = sum(rows.map(r => r.t * r.pv)) / pvSum / m, mod = mac / (1 + i);
    const conv = sum(rows.map(r => r.t * (r.t + 1) * r.pv)) / (pvSum * Math.pow(1 + i, 2) * m * m);
    const dy = v.shock / 10000, Pd = P * (1 - mod * dy), Pdc = P * (1 - mod * dy + 0.5 * conv * dy * dy), Pa = bondPrice(F, cr, y + dy, m, N);
    const status = P > F + 0.005 ? 'sells for more' : P < F - 0.005 ? 'sells for less' : 'sells at face value';
    const lo = Math.max(0.0025, y - 0.04), grid = range(lo, y + 0.04, 0.0025);
    const charts = [
      {
        title: 'Price when yield changes', sub: 'The real price curve bends. Duration alone gives a straight line. Adding convexity follows the curve.',
        series: [
          { name: 'Actual price', type: 'line', color: 'c1', pts: grid.map(z => [z * 100, bondPrice(F, cr, z, m, N)]) },
          { name: 'Duration estimate', type: 'line', color: 'c2', dash: true, pts: grid.map(z => [z * 100, P * (1 - mod * (z - y))]) },
          { name: 'Duration + convexity', type: 'line', color: 'c3', pts: grid.map(z => [z * 100, P * (1 - mod * (z - y) + 0.5 * conv * (z - y) * (z - y))]) },
          { name: 'Today', type: 'dots', color: 'c4', noRead: true, pts: [[y * 100, P, `${money(P)}`]] }
        ], hlines: [{ y: F, label: 'face value' }], xlab: 'Yield to maturity', xFmt: x => x.toFixed(2) + '%', yFmt: x => '$' + nf(x, 0), yRead: money
      },
      {
        title: 'When the cash arrives', sub: 'Value today of each payment. The dashed line is Macaulay duration, the balance point in time.',
        series: [
          { name: 'Cash flow', type: 'bars', color: 'c2', pts: rows.map(r => [r.yr, r.cf]) },
          { name: 'Present value', type: 'bars', color: 'c1', pts: rows.map(r => [r.yr, r.pv]) }
        ], vlines: [{ x: mac, label: `duration ${nf(mac, 2)} yrs`, color: 'c4' }], xlab: 'Years from today', yFmt: compact, yRead: money, xFmt: x => nf(x, 1)
      }
    ];
    return {
      solved: v.solve === 'price' ? { id: 'price', value: P, dp: 4 } : { id: 'ytm', value: y * 100, dp: 5 },
      cards: [
        { key: true, label: 'Bond price', value: money(P), sub: `${nf(P / F * 100, 3)}% of face value · ${status}` },
        { label: 'Yield to maturity', value: pct(y, 3), sub: `coupon ${pct(cr, 2)}` },
        { label: 'Current yield', value: pct(c * m / P, 3), sub: 'yearly interest ÷ price' },
        { label: 'Macaulay duration', value: yrs(mac, 3), sub: `bond lasts ${yrs(N / m, 1)}` },
        { label: 'Modified duration', value: nf(mod, 3), sub: `1% rate move ≈ ${nf(mod, 2)}% price move` },
        { label: 'Convexity', value: nf(conv, 2), sub: 'in years squared' },
        { label: `Price if yield moves ${v.shock >= 0 ? '+' : '−'}${Math.abs(v.shock)} bps`, value: money(Pa), sub: `duration ${money(Pd)} · with convexity ${money(Pdc)}`, tone: Pa >= P ? 'good' : 'bad' }
      ],
      steps: [
        ['Cash flows', `Coupon per period = F × coupon ÷ m = ${money(F, 0)} × ${pct(cr, 3)} ÷ ${m} = ${money(c)}\nPeriods N = ${nf(v.yrs, 2)} × ${m} = ${N}     Yield per period = ${pct(i, 4)}`],
        ['Price', `PV(coupons) = ${money(c)} × [1 − (1+i)^−N] ÷ i = ${money(c * annF(i, N))}\nPV(face) = ${money(F, 0)} ÷ (1+i)^N = ${money(F / Math.pow(1 + i, N))}\nPrice = ${money(c * annF(i, N))} + ${money(F / Math.pow(1 + i, N))} = ${money(P)}`],
        ['Macaulay duration', `Σ t·PV(CF) ÷ Price ÷ m = ${nf(sum(rows.map(r => r.t * r.pv)), 2)} ÷ ${nf(pvSum, 2)} ÷ ${m} = ${nf(mac, 4)} years`],
        ['Modified duration', `D_mod = ${nf(mac, 4)} ÷ (1 + ${pct(i, 4)}) = ${nf(mod, 4)}`],
        ['Convexity', `Σ t(t+1)·PV ÷ [Price · (1+i)² · m²] = ${nf(conv, 4)}`],
        ['Shock test', `Duration only:  ${money(P)} × (1 − ${nf(mod, 3)} × ${nfx(dy, 4)}) = ${money(Pd)}\nWith convexity: adds ½ × ${nf(conv, 2)} × ${nfx(dy * dy, 6)} × ${money(P)} → ${money(Pdc)}\nActual repricing: ${money(Pa)}`]
      ],
      charts,
      tables: [{ title: 'Cash flow table', collapsed: true, cols: ['Period', 'Years', 'Cash flow', 'Discount factor', 'Present value', 't × PV'], rows: rows.slice(0, 400).map(r => [r.t, nf(r.yr, 2), money(r.cf), nfx(r.df, 5), money(r.pv), nf(r.t * r.pv, 2)]) }]
    };
  }
});

register({
  id: 'ddm', group: 'Valuation', title: 'Stock Value from Dividends (DDM)',
  blurb: 'Find what a share is worth from its dividends. Use steady growth (Gordon) or two growth stages. See how much of the price comes from future growth.',
  fields: [
    { id: 'model', label: 'Model', type: 'select', v: 'gordon', options: [['gordon', 'Steady growth (Gordon)'], ['two', 'Two-stage growth']] },
    { id: 'd0', label: 'Dividend just paid (D₀)', v: 2, step: 0.1, pre: '$' },
    { id: 'ke', label: 'Return you want', v: 10, step: 0.25, unit: '%', slider: [4, 20, 0.25] },
    { id: 'g', label: 'Long-run growth rate', v: 4, step: 0.25, unit: '%', slider: [0, 9, 0.25] },
    { id: 'g1', label: 'Fast growth rate (stage 1)', v: 12, step: 0.5, unit: '%' },
    { id: 'n', label: 'Years of fast growth', v: 5, step: 1, min: 1 },
    { id: 'e1', label: 'Expected profit per share next year (EPS)', v: 3.0, step: 0.1, pre: '$' },
    { id: 'mkt', label: 'Market price (optional)', v: 40, step: 1, pre: '$' }
  ],
  show: { g1: v => v.model === 'two', n: v => v.model === 'two' },
  concept: `<h4>The idea</h4>
<p>A share is worth what its future dividends are worth today. If dividends grow at a steady rate forever, that endless sum becomes one simple fraction.</p>
<div class="formula">P₀ = D₁ ÷ (k − g)  with  D₁ = D₀(1 + g)</div>
<div class="formula">Two-stage: P₀ = Σ D_t ÷ (1+k)^t  +  [D_n(1+g) ÷ (k − g)] ÷ (1+k)^n</div>
<div class="formula">P₀ = EPS₁ ÷ k + PVGO</div>
<ul><li>A small change in g changes the answer a lot. As g gets close to k, the price shoots up. So long-run growth must stay below the return you want, usually at or below the growth of the whole economy.</li><li><b>PVGO</b> (value of future growth) is the part of the price above what the firm would be worth if it paid out all its profit and never grew.</li><li>You can also work backwards. From the market price, find the growth or return the market is expecting.</li></ul>`,
  calc(v) {
    const ke = v.ke / 100, g = v.g / 100, g1 = v.g1 / 100, n = Math.max(1, Math.round(v.n)), two = v.model === 'two';
    const divs = t => (two ? (t <= n ? v.d0 * Math.pow(1 + g1, t) : v.d0 * Math.pow(1 + g1, n) * Math.pow(1 + g, t - n)) : v.d0 * Math.pow(1 + g, t));
    const value = gs => {
      if (ke <= gs) return NaN;
      if (!two) return v.d0 * (1 + gs) / (ke - gs);
      const dn = v.d0 * Math.pow(1 + g1, n);
      let s = 0; for (let t = 1; t <= n; t++) s += v.d0 * Math.pow(1 + g1, t) / Math.pow(1 + ke, t);
      return s + dn * (1 + gs) / (ke - gs) / Math.pow(1 + ke, n);
    };
    const P0 = value(g);
    if (!isNum(P0)) return { note: 'The return you want must be higher than the long-run growth rate. Otherwise the value has no limit.', cards: [], charts: [], steps: [] };
    const H = Math.max(25, n + 15), ts = range(1, H, 1);
    let cum = 0; const pvs = ts.map(t => divs(t) / Math.pow(1 + ke, t)), cums = pvs.map(p => (cum += p));
    const dn = v.d0 * Math.pow(1 + g1, n);
    const pvHigh = two ? sum(pvs.slice(0, n)) : NaN, tv = two ? dn * (1 + g) / (ke - g) : NaN, pvTV = two ? tv / Math.pow(1 + ke, n) : NaN;
    const noGrowth = v.e1 / ke, pvgo = P0 - noGrowth, D1 = divs(1);
    const cards = [
      { key: true, label: 'Fair value per share (intrinsic value)', value: money(P0), sub: two ? 'two-stage model' : 'Gordon growth' },
      { label: 'Dividend yield', value: pct(D1 / P0, 2), sub: `D₁ ${money(D1)} ÷ fair value` },
      { label: 'Value if no growth', value: money(noGrowth), sub: `EPS ${money(v.e1)} ÷ k` },
      { label: 'Value of future growth (PVGO)', value: money(pvgo), sub: `${nf(pvgo / P0 * 100, 1)}% of the price`, tone: pvgo < 0 ? 'bad' : '' }
    ];
    if (two) cards.push({ label: 'Dividends in fast-growth years', value: money(pvHigh), sub: `years 1–${n}` }, { label: 'Value after the fast years, in today\'s money', value: money(pvTV), sub: `${nf(pvTV / P0 * 100, 1)}% of fair value` });
    if (v.mkt > 0) {
      const gi = (v.mkt * ke - v.d0) / (v.mkt + v.d0), ki = v.d0 * (1 + g) / v.mkt + g, diff = P0 / v.mkt - 1;
      cards.push({ label: 'Versus market price', value: (diff >= 0 ? '+' : '') + pct(diff, 1), sub: diff >= 0 ? 'looks cheap: model value is higher' : 'looks expensive: model value is lower', tone: diff >= 0 ? 'good' : 'bad' },
        { label: 'Growth the market price implies', value: pct(gi, 2), sub: 'Gordon model, using your return' },
        { label: 'Return the market implies', value: pct(ki, 2), sub: 'Gordon model, using your growth' });
    }
    const gmax = ke - 0.0075, gs = gmax > 0 ? range(0, gmax, Math.max(0.0005, gmax / 40)) : [];
    const charts = [{
      title: 'Where the value comes from', sub: 'Each year\'s dividend in today\'s money (amber). The running total (teal) closes in on fair value.',
      series: [{ name: 'That year\'s dividend in today\'s money', type: 'bars', color: 'c2', pts: ts.map((t, k) => [t, pvs[k]]) }, { name: 'Running total', type: 'area', color: 'c1', pts: ts.map((t, k) => [t, cums[k]]) }],
      hlines: [{ y: P0, label: `fair value ${money(P0)}`, color: 'c4' }], xlab: 'Year', yFmt: x => '$' + nf(x, 0), yRead: money
    }];
    if (gs.length > 2) charts.push({
      title: 'Why the growth guess matters so much', sub: 'Value per share as long-run growth gets close to the return you want. The curve shoots up on the right.',
      series: [{ name: 'Value per share', type: 'line', color: 'c1', pts: gs.map(x => [x * 100, value(x)]) }, { name: 'Your assumption', type: 'dots', color: 'c4', noRead: true, pts: [[g * 100, P0, money(P0)]] }],
      xlab: 'Long-run growth (g)', xFmt: x => x.toFixed(1) + '%', yFmt: x => '$' + nf(x, 0), yRead: money
    });
    return {
      cards,
      steps: two ? [
        ['Stage 1 dividends', `D_t = D₀(1+g₁)^t, t = 1…${n}   (D₁ = ${money(D1)}, D_${n} = ${money(dn)})`],
        ['Bring stage 1 to today\'s value', `Σ D_t ÷ (1+k)^t = ${money(pvHigh)}`],
        ['Value after year ' + n + ' (terminal value)', `TV = D_n(1+g) ÷ (k − g) = ${money(dn)} × ${nfx(1 + g, 4)} ÷ ${nfx(ke - g, 4)} = ${money(tv)}`],
        ['Bring the terminal value to today\'s value', `${money(tv)} ÷ (1 + ${pct(ke, 2)})^${n} = ${money(pvTV)}`],
        ['Fair value', `${money(pvHigh)} + ${money(pvTV)} = ${money(P0)}`],
        ['Value of future growth', `PVGO = P₀ − EPS₁ ÷ k = ${money(P0)} − ${money(noGrowth)} = ${money(pvgo)}`]
      ] : [
        ['Next dividend', `D₁ = D₀ × (1 + g) = ${money(v.d0)} × ${nfx(1 + g, 4)} = ${money(D1)}`],
        ['Gordon growth', `P₀ = D₁ ÷ (k − g) = ${money(D1)} ÷ (${pct(ke, 2)} − ${pct(g, 2)}) = ${money(P0)}`],
        ['Where the return comes from', `k = dividend yield + growth = ${pct(D1 / P0, 2)} + ${pct(g, 2)} = ${pct(D1 / P0 + g, 2)}`],
        ['Value of future growth', `PVGO = P₀ − EPS₁ ÷ k = ${money(P0)} − ${money(noGrowth)} = ${money(pvgo)}`]
      ],
      charts
    };
  }
});

function dcfModel(v, wacc, tg, mlt) {
  const N = Math.max(1, Math.min(10, Math.round(v.years))), rows = [];
  let rev = v.rev0;
  for (let t = 1; t <= N; t++) {
    const gr = v.fade === 'fade' ? v.g1 / 100 - (v.g1 / 100 - tg) * (t - 1) / N : v.g1 / 100, prev = rev;
    rev = prev * (1 + gr);
    const ebit = rev * v.margin / 100, nopat = ebit * (1 - v.tax / 100), da = rev * v.da / 100, capex = rev * v.capex / 100, dnwc = (rev - prev) * v.nwc / 100;
    const fcff = nopat + da - capex - dnwc, df = Math.pow(1 + wacc, -t);
    rows.push({ t, gr, rev, ebit, nopat, da, capex, dnwc, fcff, df, pv: fcff * df });
  }
  const last = rows[N - 1], ebitda = last.ebit + last.da;
  const tv = v.tmethod === 'gordon' ? (wacc > tg ? last.fcff * (1 + tg) / (wacc - tg) : NaN) : ebitda * mlt;
  const pvTV = tv * last.df, pvF = sum(rows.map(r => r.pv)), ev = pvF + pvTV, eq = ev - v.netdebt;
  return { rows, N, tv, pvTV, pvF, ev, eq, ps: eq / v.shares, ebitda, last, impMult: tv / ebitda, impG: (tv * wacc - last.fcff) / (tv + last.fcff) };
}

register({
  id: 'dcf', group: 'Valuation', title: 'Company Value (DCF)',
  blurb: 'Forecast a company\'s free cash and bring it to today\'s value at WACC (its cost of funding). Add a terminal value (the years after the forecast). Then get value per share.',
  fields: [
    { id: 'rev0', label: 'Sales now ($M)', v: 1000, step: 50 },
    { id: 'g1', label: 'Sales growth in year 1', v: 12, step: 0.5, unit: '%', slider: [0, 40, 0.5] },
    { id: 'fade', label: 'Growth pattern', type: 'select', v: 'fade', options: [['fade', 'Slows toward long-run growth'], ['flat', 'Stays the same']] },
    { id: 'years', label: 'Forecast years', v: 5, step: 1, min: 1, max: 10, slider: [3, 10, 1] },
    { id: 'margin', label: 'Operating profit margin (EBIT margin)', v: 20, step: 0.5, unit: '%', slider: [2, 50, 0.5] },
    { id: 'tax', label: 'Tax rate', v: 25, step: 1, unit: '%' },
    { id: 'da', label: 'Wear-and-tear cost, D&A (% of sales)', v: 4, step: 0.5, unit: '%' },
    { id: 'capex', label: 'Spending on equipment, capex (% of sales)', v: 5, step: 0.5, unit: '%' },
    { id: 'nwc', label: 'Extra working cash needed, NWC (% of sales growth)', v: 10, step: 1, unit: '%' },
    { id: 'wacc', label: 'WACC (cost of funding)', v: 9, step: 0.25, unit: '%', slider: [4, 16, 0.25] },
    { id: 'tmethod', label: 'How to value the years after the forecast', type: 'select', v: 'gordon', options: [['gordon', 'Growth forever'], ['multiple', 'Sale multiple (EV/EBITDA)']] },
    { id: 'tg', label: 'Long-run growth rate', v: 3, step: 0.25, unit: '%', slider: [0, 5, 0.25] },
    { id: 'mult', label: 'Sale multiple (EV/EBITDA)', v: 10, step: 0.5, unit: '×' },
    { id: 'netdebt', label: 'Net debt ($M): debt minus cash', v: 400, step: 25 },
    { id: 'shares', label: 'Number of shares (M)', v: 100, step: 5 }
  ],
  show: { tg: v => v.tmethod === 'gordon' || v.fade === 'fade', mult: v => v.tmethod === 'multiple' },
  concept: `<h4>The idea</h4>
<p>A company is worth the cash it can pay to everyone who funds it, in today's money. Forecast the free cash (FCFF). Bring it back to today's value at WACC. Then add a terminal value (the value of all the years after your forecast).</p>
<div class="formula">FCFF = EBIT(1 − t) + D&A − Capex − ΔNWC</div>
<div class="formula">TV = FCFF_N(1+g) ÷ (WACC − g)    or    TV = EBITDA_N × multiple</div>
<div class="formula">Enterprise value = Σ FCFF_t ÷ (1+WACC)^t + TV ÷ (1+WACC)^N</div>
<div class="formula">Equity value = Enterprise value − Net debt</div>
<ul><li>For most companies, the terminal value is more than half of enterprise value. Check the implied multiple or growth to see if it is sensible.</li><li>The grid shows how much the answer moves when WACC and the long-run guess change. If it moves a lot, that is the honest range of the value.</li></ul>`,
  calc(v) {
    const W = v.wacc / 100, tg = v.tg / 100, base = dcfModel(v, W, tg, v.mult), { rows, N } = base;
    if (!isNum(base.ev)) return { note: 'WACC must be higher than the long-run growth rate.', cards: [], charts: [], steps: [] };
    const gordon = v.tmethod === 'gordon';
    const cards = [
      { key: true, label: 'Value per share', value: money(base.ps), sub: `${nf(v.shares, 1)}M shares` },
      { label: 'Enterprise value (whole business)', value: money(base.ev, 1) + 'M', sub: `${nf(base.pvTV / base.ev * 100, 0)}% from the years after the forecast` },
      { label: 'Equity value (owners\' share)', value: money(base.eq, 1) + 'M', sub: `after ${money(v.netdebt, 0)}M net debt` },
      gordon ? { label: 'Sale multiple this implies', value: mult(base.impMult, 1), sub: 'terminal value ÷ final-year EBITDA' } : { label: 'Growth forever this implies', value: pct(base.impG, 2), sub: 'from your sale multiple' },
      { label: 'Terminal value', value: money(base.tv, 1) + 'M', sub: `${money(base.pvTV, 1)}M in today's dollars` }
    ];
    const cols = gordon ? [-0.01, -0.005, 0, 0.005, 0.01].map(d => tg + d) : [-2, -1, 0, 1, 2].map(d => v.mult + d);
    const sens = [-0.02, -0.01, 0, 0.01, 0.02].map(dw => {
      const w = W + dw;
      return [`WACC ${pct(w, 1)}`, ...cols.map(c => {
        const r = dcfModel(v, w, gordon ? c : tg, gordon ? v.mult : c);
        if (!isNum(r.ps)) return '—';
        const diff = base.ps ? (r.ps - base.ps) / Math.abs(base.ps) : 0, a = Math.min(45, Math.abs(diff) * 120);
        return [money(r.ps), `background:color-mix(in srgb,var(${diff >= 0 ? '--good' : '--bad'}) ${a.toFixed(0)}%,transparent)${Math.abs(diff) < 1e-9 ? ';font-weight:700' : ''}`];
      })];
    });
    const m1 = x => nf(x, 1);
    const hb = hbars([
      { label: 'Forecast cash, in today\'s money', from: 0, to: base.pvF, color: 'c1', text: money(base.pvF, 1) + 'M' },
      { label: 'Later years, in today\'s money', from: base.pvF, to: base.ev, color: 'c3', text: money(base.pvTV, 1) + 'M' },
      { label: 'Enterprise value', from: 0, to: base.ev, color: 'ink', text: money(base.ev, 1) + 'M' },
      { label: 'Minus: net debt', from: base.eq, to: base.ev, color: 'c4', text: '−' + money(v.netdebt, 1) + 'M' },
      { label: 'Equity value', from: 0, to: base.eq, color: 'good', text: money(base.eq, 1) + 'M' }
    ]);
    return {
      cards,
      charts: [
        { title: 'Free cash and its value today', sub: 'Cash each year (amber) and what it is worth today at WACC (teal).', series: [{ name: 'FCFF', type: 'bars', color: 'c2', pts: rows.map(r => [r.t, r.fcff]) }, { name: 'Present value', type: 'bars', color: 'c1', pts: rows.map(r => [r.t, r.pv]) }], xlab: 'Year', yFmt: x => nf(x, 0), yRead: x => money(x, 1) + 'M' },
        { type: 'html', title: 'From cash flows to value per share', sub: 'Enterprise value has two parts. Then net debt is taken off.', html: hb }
      ],
      steps: [
        ['Year-by-year free cash flow', `FCFF = NOPAT + D&A − Capex − ΔNWC\nYear ${N}: ${m1(last(rows).nopat)} + ${m1(last(rows).da)} − ${m1(last(rows).capex)} − ${m1(last(rows).dnwc)} = ${m1(last(rows).fcff)}  ($M)`],
        ['Bring each year to today\'s value', `PV = FCFF ÷ (1 + ${pct(W, 2)})^t.  Sum of PVs = ${money(base.pvF, 1)}M`],
        ['Terminal value', gordon ? `TV = FCFF_${N} × (1 + g) ÷ (WACC − g) = ${m1(last(rows).fcff)} × ${nfx(1 + tg, 4)} ÷ ${nfx(W - tg, 4)} = ${money(base.tv, 1)}M` : `TV = EBITDA_${N} × multiple = ${m1(base.ebitda)} × ${nf(v.mult, 1)} = ${money(base.tv, 1)}M`],
        ['Bring the terminal value to today\'s value', `${money(base.tv, 1)}M × ${nfx(last(rows).df, 5)} = ${money(base.pvTV, 1)}M`],
        ['From whole business to owners', `EV = ${money(base.pvF, 1)} + ${money(base.pvTV, 1)} = ${money(base.ev, 1)}M\nEquity = EV − net debt = ${money(base.ev, 1)} − ${money(v.netdebt, 1)} = ${money(base.eq, 1)}M`],
        ['Per share', `${money(base.eq, 1)}M ÷ ${nf(v.shares, 1)}M shares = ${money(base.ps)}`]
      ],
      tables: [
        {
          title: 'Forecast ($M)', cols: ['', ...rows.map(r => 'Year ' + r.t)], rows: [
            ['Revenue growth', ...rows.map(r => pct(r.gr, 1))], ['Revenue', ...rows.map(r => m1(r.rev))], ['EBIT', ...rows.map(r => m1(r.ebit))], ['NOPAT', ...rows.map(r => m1(r.nopat))],
            ['+ D&A', ...rows.map(r => m1(r.da))], ['− Capex', ...rows.map(r => m1(r.capex))], ['− Change in NWC', ...rows.map(r => m1(r.dnwc))],
            ['Free cash flow', ...rows.map(r => [m1(r.fcff), 'font-weight:700'])], ['Discount factor', ...rows.map(r => nfx(r.df, 4))], ['Present value', ...rows.map(r => m1(r.pv))]
          ]
        },
        { title: `Sensitivity: value per share (${gordon ? 'WACC × long-run growth' : 'WACC × sale multiple'})`, cols: ['', ...cols.map(c => (gordon ? 'g ' + pct(c, 1) : nf(c, 1) + '×'))], rows: sens }
      ]
    };
  }
});
function last(a) { return a[a.length - 1]; }

register({
  id: 'capbud', group: 'Corporate Finance', title: 'Project Check (Capital Budgeting)',
  blurb: 'Test one or two projects with NPV, IRR, MIRR, profitability index and payback. See the NPV profile and where the two projects cross.',
  fields: [
    { id: 'rate', label: 'Return you need (discount rate)', v: 10, step: 0.25, unit: '%', slider: [0, 30, 0.25] },
    { id: 'rr', label: 'Rate for reinvested cash (for MIRR)', v: 10, step: 0.25, unit: '%' },
    { id: 'i0A', label: 'Project A · money put in at the start (enter as a positive number)', v: 100000, step: 5000, pre: '$' },
    { id: 'cfA', label: 'Project A · cash each year, years 1…n', type: 'text', v: '30000, 35000, 40000, 40000, 30000', help: 'Separate with commas. Use a minus sign for outflows.' },
    { id: 'i0B', label: 'Project B · money put in at the start (enter as a positive number)', v: 100000, step: 5000, pre: '$' },
    { id: 'cfB', label: 'Project B · cash each year (leave empty to skip)', type: 'text', v: '0, 0, 0, 0, 200000' }
  ],
  concept: `<h4>The idea</h4>
<p>Accept projects that create value. The clearest measure is <b>NPV</b> (what the project adds, in today's money). The other tools help, but each has a weak spot.</p>
<div class="formula">NPV = −I₀ + Σ CF_t ÷ (1+r)^t          Accept if NPV &gt; 0</div>
<div class="formula">IRR: the r that makes NPV = 0          Accept if IRR &gt; hurdle rate</div>
<div class="formula">PI = PV of future cash flows ÷ I₀        Payback = time to recover I₀</div>
<ul><li><b>IRR vs NPV:</b> if you can only pick one project, they can disagree. When the NPV lines cross, the higher IRR is not always the better project. Choose by NPV. The chart shows where they cross.</li><li><b>MIRR</b> fixes the IRR's wrong idea that cash is reinvested at the IRR. It uses a reinvestment rate you choose.</li><li><b>Payback</b> ignores everything after you get your money back, and ignores that money today is worth more. Discounted payback fixes only the second problem.</li><li>Cash that flips between in and out more than once can give several IRRs.</li></ul>`,
  calc(v) {
    const r = v.rate / 100, rr = v.rr / 100;
    const analyze = (i0, flows) => {
      const c = [-i0, ...flows], N = flows.length;
      const NPV = npv(r, c), IRR = irr(c), pvIn = sum(flows.map((x, k) => x / Math.pow(1 + r, k + 1)));
      const fvPos = sum(c.map((x, t) => (x > 0 ? x * Math.pow(1 + rr, N - t) : 0))), pvNeg = sum(c.map((x, t) => (x < 0 ? -x / Math.pow(1 + r, t) : 0)));
      const pb = arr => { let cum = 0; for (let t = 0; t < arr.length; t++) { const prev = cum; cum += arr[t]; if (t > 0 && cum >= 0 && prev < 0) return t - 1 + (-prev) / arr[t]; } return NaN; };
      let cumC = 0, cumP = 0;
      const rows = c.map((x, t) => { const pv = x / Math.pow(1 + r, t); cumC += x; cumP += pv; return { t, cf: x, df: Math.pow(1 + r, -t), pv, cumC, cumP }; });
      let sc = 0, prev = 0; c.forEach(x => { const s = Math.sign(x); if (s && prev && s !== prev) sc++; if (s) prev = s; });
      return { c, N, NPV, IRR, PI: i0 > 0 ? pvIn / i0 : NaN, MIRR: pvNeg > 0 && fvPos > 0 ? Math.pow(fvPos / pvNeg, 1 / N) - 1 : NaN, pb: pb(c), dpb: pb(c.map((x, t) => x / Math.pow(1 + r, t))), rows, sc, i0 };
    };
    const fa = parseList(v.cfA), fb = parseList(v.cfB);
    if (!fa.length) return { note: 'Enter at least one cash flow for Project A.', cards: [], charts: [], steps: [] };
    const A = analyze(v.i0A, fa), B = fb.length ? analyze(v.i0B, fb) : null;
    const card = (tag, P) => [
      { head: tag },
      { key: tag.endsWith('A'), label: 'NPV', value: money(P.NPV, 0), sub: P.NPV >= 0 ? 'adds value, accept' : 'destroys value, reject', tone: P.NPV >= 0 ? 'good' : 'bad' },
      { label: 'IRR', value: isNum(P.IRR) ? pct(P.IRR, 2) : 'n/a', sub: `you need ${pct(r, 1)}` + (P.sc > 1 ? ' · multiple IRRs possible' : '') },
      { label: 'MIRR', value: pct(P.MIRR, 2), sub: `reinvest at ${pct(rr, 1)}` },
      { label: 'Profitability index', value: nf(P.PI, 3), sub: P.PI >= 1 ? 'above 1 is good' : 'below 1 is bad' },
      { label: 'Payback', value: isNum(P.pb) ? yrs(P.pb, 2) : 'Never', sub: 'time to get your money back' },
      { label: 'Discounted payback', value: isNum(P.dpb) ? yrs(P.dpb, 2) : 'Never', sub: `at ${pct(r, 1)}` }
    ];
    const cards = [...card('Project A', A), ...(B ? card('Project B', B) : [])];
    let cross = NaN;
    if (B) { const L = Math.max(A.c.length, B.c.length), d = Array.from({ length: L }, (_, k) => (A.c[k] || 0) - (B.c[k] || 0)); cross = irr(d); }
    const ir = [A.IRR, B && B.IRR].filter(isNum), R = Math.min(100, Math.max(20, Math.ceil((ir.length ? Math.max(...ir) * 100 : 20) / 5) * 5 + 10));
    const rs = range(0, R, R / 60), vl = [{ x: v.rate, label: `your rate ${nf(v.rate, 1)}%`, color: 'c4' }];
    if (isNum(cross) && cross * 100 >= 0 && cross * 100 <= R) vl.push({ x: cross * 100, label: `crossover ${nf(cross * 100, 1)}%`, color: 'mute' });
    const series = [{ name: 'Project A', type: 'line', color: 'c1', pts: rs.map(x => [x, npv(x / 100, A.c)]) }];
    if (B) series.push({ name: 'Project B', type: 'line', color: 'c2', pts: rs.map(x => [x, npv(x / 100, B.c)]) });
    const dots = []; if (isNum(A.IRR) && A.IRR * 100 <= R) dots.push([A.IRR * 100, 0, 'IRR A']); if (B && isNum(B.IRR) && B.IRR * 100 <= R) dots.push([B.IRR * 100, 0, 'IRR B']);
    if (dots.length) series.push({ name: 'IRR', type: 'dots', color: 'c3', noRead: true, pts: dots });
    const note = B ? (A.NPV === B.NPV ? '' : `If you can only pick one project, choose by NPV: Project ${A.NPV > B.NPV ? 'A' : 'B'} adds ${money(Math.abs(A.NPV - B.NPV), 0)} more value.` + (isNum(A.IRR) && isNum(B.IRR) && (A.IRR > B.IRR) !== (A.NPV > B.NPV) ? ' IRR picks the other one. This is a well-known clash.' : '')) : '';
    const trow = P => P.rows.map(x => [x.t, money(x.cf, 0), nfx(x.df, 4), money(x.pv, 0), money(x.cumC, 0), money(x.cumP, 0)]);
    const th = ['Year', 'Cash flow', 'Discount factor', 'PV', 'Cumulative', 'Cumulative PV'];
    return {
      cards, info: note,
      charts: [
        { title: 'NPV profile', sub: 'NPV as the discount rate changes. Where a line crosses zero is that project\'s IRR. Where the lines cross each other, the better project switches.', series, vlines: vl, hlines: [{ y: 0 }], xlab: 'Discount rate', xFmt: x => nf(x, 0) + '%', yFmt: x => compact(x), yRead: x => money(x, 0) },
        { title: 'Payback: Project A', sub: 'Running total of cash, with and without discounting. Payback is where each line turns positive.', series: [{ name: 'Running total of cash', type: 'line', color: 'c2', pts: A.rows.map(x => [x.t, x.cumC]) }, { name: 'Running total in today\'s money', type: 'line', color: 'c1', pts: A.rows.map(x => [x.t, x.cumP]) }], hlines: [{ y: 0 }], xlab: 'Year', yFmt: x => compact(x), yRead: x => money(x, 0) }
      ],
      steps: [
        ['Discounted cash flows, Project A', `NPV = ${A.rows.map(x => (x.t === 0 ? money(x.cf, 0) : `${money(x.cf, 0)}/${nfx(1 / x.df, 4)}`)).join(' + ')}\n    = ${money(A.NPV, 2)}`],
        ['IRR', isNum(A.IRR) ? `Find r with NPV(r) = 0, which gives IRR = ${pct(A.IRR, 3)}. Check: NPV at that rate = ${nf(npv(A.IRR, A.c), 4)}` : 'No IRR exists in the search range (-95% to 1000%).'],
        ['MIRR', `FV of inflows at ${pct(rr, 1)} ÷ PV of outflows at ${pct(r, 1)}, then take the ${A.N}th root minus 1 = ${pct(A.MIRR, 3)}`],
        ['Profitability index', `PV of future cash flows ÷ initial investment = ${money(A.rows.slice(1).reduce((s, x) => s + x.pv, 0), 0)} ÷ ${money(v.i0A, 0)} = ${nf(A.PI, 3)}`],
        ['Payback', isNum(A.pb) ? `Full years before recovery + unrecovered fraction = ${nf(A.pb, 3)} years` : 'The investment is not recovered within the forecast.']
      ],
      tables: [{ title: 'Project A cash flow table', cols: th, rows: trow(A) }, ...(B ? [{ title: 'Project B cash flow table', cols: th, rows: trow(B), collapsed: true }] : [])]
    };
  }
});
