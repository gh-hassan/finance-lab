// @ts-nocheck
import { register } from '../lib/registry';
import { nf, nfx, money, pct, mult, yrs, compact, parseList, sum, range, npv, irr, findRoot, annF, fvF, bondPrice, ncdf, bs, isNum } from '../lib/math';
import { hbars } from '../ui/visuals.js';

/* ================= VALUATION ================= */
register({
  id: 'bond', group: 'Valuation', title: 'Bond Pricing & Duration',
  blurb: 'Price a bond or back out its yield, then measure interest-rate risk with duration and convexity.',
  fields: [
    { id: 'solve', label: 'Solve for', type: 'select', v: 'price', options: [['price', 'Price (given yield)'], ['ytm', 'Yield to maturity (given price)']] },
    { id: 'face', label: 'Face value', v: 1000, step: 100, pre: '$' },
    { id: 'cr', label: 'Annual coupon rate', v: 5, step: 0.125, unit: '%' },
    { id: 'ytm', label: 'Yield to maturity', v: 6, step: 0.125, unit: '%', slider: [0.5, 15, 0.125] },
    { id: 'price', label: 'Market price', v: 925, step: 1, pre: '$' },
    { id: 'yrs', label: 'Years to maturity', v: 10, step: 1, min: 0.5, slider: [1, 30, 1] },
    { id: 'm', label: 'Coupons per year', type: 'select', v: '2', options: [['1', 'Annual'], ['2', 'Semi-annual'], ['4', 'Quarterly'], ['12', 'Monthly']] },
    { id: 'shock', label: 'Yield shock for the risk test', v: 100, step: 25, unit: 'bps', slider: [-300, 300, 25] }
  ],
  concept: `<h4>The idea</h4>
<p>A bond is a stream of coupons plus a face value at maturity. Its price is the present value of those cash flows at the market yield. When yields rise, price falls, and the relationship is curved, not straight.</p>
<div class="formula">Price = Σ C ÷ (1+y/m)^t  +  F ÷ (1+y/m)^N</div>
<div class="formula">Macaulay duration = Σ [t · PV(CF_t)] ÷ Price ÷ m      Modified = Macaulay ÷ (1 + y/m)</div>
<div class="formula">ΔP/P ≈ − D_mod · Δy + ½ · Convexity · (Δy)²</div>
<ul><li><b>Coupon above yield</b> means the bond trades at a premium. Below yield means a discount. At par, coupon = yield.</li><li><b>Duration</b> is the balance point of the cash flows in time, and the first-order price sensitivity.</li><li><b>Convexity</b> is the curvature. It is always helpful to the holder: prices rise more than duration predicts when yields fall, and fall less when yields rise.</li></ul>`,
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
    const status = P > F + 0.005 ? 'premium' : P < F - 0.005 ? 'discount' : 'par';
    const lo = Math.max(0.0025, y - 0.04), grid = range(lo, y + 0.04, 0.0025);
    const charts = [
      {
        title: 'Price versus yield', sub: 'The true price curve bends. Duration alone draws a straight line; adding convexity hugs the curve.',
        series: [
          { name: 'Actual price', type: 'line', color: 'c1', pts: grid.map(z => [z * 100, bondPrice(F, cr, z, m, N)]) },
          { name: 'Duration estimate', type: 'line', color: 'c2', dash: true, pts: grid.map(z => [z * 100, P * (1 - mod * (z - y))]) },
          { name: 'Duration + convexity', type: 'line', color: 'c3', pts: grid.map(z => [z * 100, P * (1 - mod * (z - y) + 0.5 * conv * (z - y) * (z - y))]) },
          { name: 'Today', type: 'dots', color: 'c4', noRead: true, pts: [[y * 100, P, `${money(P)}`]] }
        ], hlines: [{ y: F, label: 'par' }], xlab: 'Yield to maturity', xFmt: x => x.toFixed(2) + '%', yFmt: x => '$' + nf(x, 0), yRead: money
      },
      {
        title: 'When the cash arrives', sub: 'Present value of each cash flow. The dashed line is Macaulay duration, the balance point.',
        series: [
          { name: 'Cash flow', type: 'bars', color: 'c2', pts: rows.map(r => [r.yr, r.cf]) },
          { name: 'Present value', type: 'bars', color: 'c1', pts: rows.map(r => [r.yr, r.pv]) }
        ], vlines: [{ x: mac, label: `duration ${nf(mac, 2)} yrs`, color: 'c4' }], xlab: 'Years from today', yFmt: compact, yRead: money, xFmt: x => nf(x, 1)
      }
    ];
    return {
      solved: v.solve === 'price' ? { id: 'price', value: P, dp: 4 } : { id: 'ytm', value: y * 100, dp: 5 },
      cards: [
        { key: true, label: 'Bond price', value: money(P), sub: `${nf(P / F * 100, 3)}% of par · ${status}` },
        { label: 'Yield to maturity', value: pct(y, 3), sub: `coupon ${pct(cr, 2)}` },
        { label: 'Current yield', value: pct(c * m / P, 3), sub: 'annual coupon ÷ price' },
        { label: 'Macaulay duration', value: yrs(mac, 3), sub: `maturity ${yrs(N / m, 1)}` },
        { label: 'Modified duration', value: nf(mod, 3), sub: `1% rate move ≈ ${nf(mod, 2)}% price move` },
        { label: 'Convexity', value: nf(conv, 2), sub: 'in years squared' },
        { label: `Price if yield ${v.shock >= 0 ? '+' : '−'}${Math.abs(v.shock)} bps`, value: money(Pa), sub: `duration ${money(Pd)} · with convexity ${money(Pdc)}`, tone: Pa >= P ? 'good' : 'bad' }
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
  id: 'ddm', group: 'Valuation', title: 'Stock Valuation (DDM)',
  blurb: 'Value a share from its dividends with Gordon growth or a two-stage model, and see how much of the price is growth opportunities.',
  fields: [
    { id: 'model', label: 'Model', type: 'select', v: 'gordon', options: [['gordon', 'Constant growth (Gordon)'], ['two', 'Two-stage growth']] },
    { id: 'd0', label: 'Dividend just paid (D₀)', v: 2, step: 0.1, pre: '$' },
    { id: 'ke', label: 'Required return', v: 10, step: 0.25, unit: '%', slider: [4, 20, 0.25] },
    { id: 'g', label: 'Stable growth rate', v: 4, step: 0.25, unit: '%', slider: [0, 9, 0.25] },
    { id: 'g1', label: 'High growth rate (stage 1)', v: 12, step: 0.5, unit: '%' },
    { id: 'n', label: 'Years of high growth', v: 5, step: 1, min: 1 },
    { id: 'e1', label: 'Expected EPS next year', v: 3.5, step: 0.1, pre: '$' },
    { id: 'mkt', label: 'Market price (optional)', v: 40, step: 1, pre: '$' }
  ],
  show: { g1: v => v.model === 'two', n: v => v.model === 'two' },
  concept: `<h4>The idea</h4>
<p>A share is worth the present value of the dividends it will pay. If dividends grow at a constant rate forever, the infinite sum collapses to a single fraction.</p>
<div class="formula">P₀ = D₁ ÷ (k − g)  with  D₁ = D₀(1 + g)</div>
<div class="formula">Two-stage: P₀ = Σ D_t ÷ (1+k)^t  +  [D_n(1+g) ÷ (k − g)] ÷ (1+k)^n</div>
<div class="formula">P₀ = EPS₁ ÷ k + PVGO</div>
<ul><li>The model is very sensitive to g. As g approaches k the price explodes, which is why stable growth must stay below the required return, usually at or below long-run GDP growth.</li><li><b>PVGO</b> (present value of growth opportunities) is the part of the price above what the firm would be worth if it paid out all earnings and never grew.</li><li>Flip the model around: given the market price, you can solve for the growth or return the market is implicitly expecting.</li></ul>`,
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
    if (!isNum(P0)) return { note: 'The required return must be greater than the stable growth rate for the model to give a finite value.', cards: [], charts: [], steps: [] };
    const H = Math.max(25, n + 15), ts = range(1, H, 1);
    let cum = 0; const pvs = ts.map(t => divs(t) / Math.pow(1 + ke, t)), cums = pvs.map(p => (cum += p));
    const dn = v.d0 * Math.pow(1 + g1, n);
    const pvHigh = two ? sum(pvs.slice(0, n)) : NaN, tv = two ? dn * (1 + g) / (ke - g) : NaN, pvTV = two ? tv / Math.pow(1 + ke, n) : NaN;
    const noGrowth = v.e1 / ke, pvgo = P0 - noGrowth, D1 = divs(1);
    const cards = [
      { key: true, label: 'Intrinsic value per share', value: money(P0), sub: two ? 'two-stage model' : 'Gordon growth' },
      { label: 'Dividend yield', value: pct(D1 / P0, 2), sub: `D₁ ${money(D1)} ÷ price` },
      { label: 'Value if no growth', value: money(noGrowth), sub: `EPS ${money(v.e1)} ÷ k` },
      { label: 'Growth opportunities (PVGO)', value: money(pvgo), sub: `${nf(pvgo / P0 * 100, 1)}% of the price`, tone: pvgo < 0 ? 'bad' : '' }
    ];
    if (two) cards.push({ label: 'Stage 1 dividends', value: money(pvHigh), sub: `years 1–${n}` }, { label: 'Terminal value today', value: money(pvTV), sub: `${nf(pvTV / P0 * 100, 1)}% of intrinsic value` });
    if (v.mkt > 0) {
      const gi = (v.mkt * ke - v.d0) / (v.mkt + v.d0), ki = v.d0 * (1 + g) / v.mkt + g, diff = P0 / v.mkt - 1;
      cards.push({ label: 'Versus market price', value: (diff >= 0 ? '+' : '') + pct(diff, 1), sub: diff >= 0 ? 'undervalued by this model' : 'overvalued by this model', tone: diff >= 0 ? 'good' : 'bad' },
        { label: 'Growth the market implies', value: pct(gi, 2), sub: 'Gordon model, your k' },
        { label: 'Return the market implies', value: pct(ki, 2), sub: 'Gordon model, your g' });
    }
    const gmax = ke - 0.0075, gs = gmax > 0 ? range(0, gmax, Math.max(0.0005, gmax / 40)) : [];
    const charts = [{
      title: 'Where the value comes from', sub: 'Each year\'s dividend discounted to today (amber), and the running total (teal) closing in on intrinsic value.',
      series: [{ name: 'PV of that year\'s dividend', type: 'bars', color: 'c2', pts: ts.map((t, k) => [t, pvs[k]]) }, { name: 'Running total', type: 'area', color: 'c1', pts: ts.map((t, k) => [t, cums[k]]) }],
      hlines: [{ y: P0, label: `intrinsic ${money(P0)}`, color: 'c4' }], xlab: 'Year', yFmt: x => '$' + nf(x, 0), yRead: money
    }];
    if (gs.length > 2) charts.push({
      title: 'Why growth assumptions matter so much', sub: 'Value per share as stable growth approaches the required return. The curve is steep near the right edge.',
      series: [{ name: 'Value per share', type: 'line', color: 'c1', pts: gs.map(x => [x * 100, value(x)]) }, { name: 'Your assumption', type: 'dots', color: 'c4', noRead: true, pts: [[g * 100, P0, money(P0)]] }],
      xlab: 'Stable growth g', xFmt: x => x.toFixed(1) + '%', yFmt: x => '$' + nf(x, 0), yRead: money
    });
    return {
      cards,
      steps: two ? [
        ['Stage 1 dividends', `D_t = D₀(1+g₁)^t, t = 1…${n}   (D₁ = ${money(D1)}, D_${n} = ${money(dn)})`],
        ['Discount stage 1', `Σ D_t ÷ (1+k)^t = ${money(pvHigh)}`],
        ['Terminal value at year ' + n, `TV = D_n(1+g) ÷ (k − g) = ${money(dn)} × ${nfx(1 + g, 4)} ÷ ${nfx(ke - g, 4)} = ${money(tv)}`],
        ['Discount the terminal value', `${money(tv)} ÷ (1 + ${pct(ke, 2)})^${n} = ${money(pvTV)}`],
        ['Intrinsic value', `${money(pvHigh)} + ${money(pvTV)} = ${money(P0)}`],
        ['Growth opportunities', `PVGO = P₀ − EPS₁ ÷ k = ${money(P0)} − ${money(noGrowth)} = ${money(pvgo)}`]
      ] : [
        ['Next dividend', `D₁ = D₀ × (1 + g) = ${money(v.d0)} × ${nfx(1 + g, 4)} = ${money(D1)}`],
        ['Gordon growth', `P₀ = D₁ ÷ (k − g) = ${money(D1)} ÷ (${pct(ke, 2)} − ${pct(g, 2)}) = ${money(P0)}`],
        ['Return decomposition', `k = dividend yield + growth = ${pct(D1 / P0, 2)} + ${pct(g, 2)} = ${pct(D1 / P0 + g, 2)}`],
        ['Growth opportunities', `PVGO = P₀ − EPS₁ ÷ k = ${money(P0)} − ${money(noGrowth)} = ${money(pvgo)}`]
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
  id: 'dcf', group: 'Valuation', title: 'DCF Valuation',
  blurb: 'Project free cash flow, discount it at WACC, add a terminal value and bridge from enterprise value to value per share.',
  fields: [
    { id: 'rev0', label: 'Current revenue ($M)', v: 1000, step: 50 },
    { id: 'g1', label: 'Revenue growth in year 1', v: 12, step: 0.5, unit: '%', slider: [0, 40, 0.5] },
    { id: 'fade', label: 'Growth pattern', type: 'select', v: 'fade', options: [['fade', 'Fades toward terminal growth'], ['flat', 'Stays constant']] },
    { id: 'years', label: 'Forecast years', v: 5, step: 1, min: 1, max: 10, slider: [3, 10, 1] },
    { id: 'margin', label: 'EBIT margin', v: 20, step: 0.5, unit: '%', slider: [2, 50, 0.5] },
    { id: 'tax', label: 'Tax rate', v: 25, step: 1, unit: '%' },
    { id: 'da', label: 'D&A (% of revenue)', v: 4, step: 0.5, unit: '%' },
    { id: 'capex', label: 'Capex (% of revenue)', v: 5, step: 0.5, unit: '%' },
    { id: 'nwc', label: 'NWC investment (% of revenue change)', v: 10, step: 1, unit: '%' },
    { id: 'wacc', label: 'WACC', v: 9, step: 0.25, unit: '%', slider: [4, 16, 0.25] },
    { id: 'tmethod', label: 'Terminal value method', type: 'select', v: 'gordon', options: [['gordon', 'Perpetual growth'], ['multiple', 'Exit EV/EBITDA multiple']] },
    { id: 'tg', label: 'Terminal growth rate', v: 3, step: 0.25, unit: '%', slider: [0, 5, 0.25] },
    { id: 'mult', label: 'Exit EV/EBITDA multiple', v: 10, step: 0.5, unit: '×' },
    { id: 'netdebt', label: 'Net debt ($M)', v: 400, step: 25 },
    { id: 'shares', label: 'Shares outstanding (M)', v: 100, step: 5 }
  ],
  show: { tg: v => v.tmethod === 'gordon' || v.fade === 'fade', mult: v => v.tmethod === 'multiple' },
  concept: `<h4>The idea</h4>
<p>A firm is worth the cash it can pay to all capital providers, discounted at the rate those providers require. Forecast free cash flow to the firm (FCFF), discount at WACC, and add a terminal value for everything after the forecast window.</p>
<div class="formula">FCFF = EBIT(1 − t) + D&A − Capex − ΔNWC</div>
<div class="formula">TV = FCFF_N(1+g) ÷ (WACC − g)    or    TV = EBITDA_N × multiple</div>
<div class="formula">Enterprise value = Σ FCFF_t ÷ (1+WACC)^t + TV ÷ (1+WACC)^N</div>
<div class="formula">Equity value = Enterprise value − Net debt</div>
<ul><li>For most companies the terminal value is well over half of enterprise value, so check the implied multiple or implied growth as a sanity test.</li><li>The sensitivity grid shows how much the answer moves with WACC and the terminal assumption. If it moves a lot, that is the honest range of the valuation.</li></ul>`,
  calc(v) {
    const W = v.wacc / 100, tg = v.tg / 100, base = dcfModel(v, W, tg, v.mult), { rows, N } = base;
    if (!isNum(base.ev)) return { note: 'WACC must be above terminal growth for a perpetuity terminal value.', cards: [], charts: [], steps: [] };
    const gordon = v.tmethod === 'gordon';
    const cards = [
      { key: true, label: 'Value per share', value: money(base.ps), sub: `${nf(v.shares, 1)}M shares` },
      { label: 'Enterprise value', value: money(base.ev, 1) + 'M', sub: `${nf(base.pvTV / base.ev * 100, 0)}% from terminal value` },
      { label: 'Equity value', value: money(base.eq, 1) + 'M', sub: `after ${money(v.netdebt, 0)}M net debt` },
      gordon ? { label: 'Implied exit multiple', value: mult(base.impMult, 1), sub: 'terminal value ÷ final-year EBITDA' } : { label: 'Implied perpetual growth', value: pct(base.impG, 2), sub: 'from your exit multiple' },
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
      { label: 'PV of forecast FCFF', from: 0, to: base.pvF, color: 'c1', text: money(base.pvF, 1) + 'M' },
      { label: 'PV of terminal value', from: base.pvF, to: base.ev, color: 'c3', text: money(base.pvTV, 1) + 'M' },
      { label: 'Enterprise value', from: 0, to: base.ev, color: 'ink', text: money(base.ev, 1) + 'M' },
      { label: 'Less: net debt', from: base.eq, to: base.ev, color: 'c4', text: '−' + money(v.netdebt, 1) + 'M' },
      { label: 'Equity value', from: 0, to: base.eq, color: 'good', text: money(base.eq, 1) + 'M' }
    ]);
    return {
      cards,
      charts: [
        { title: 'Free cash flow and its present value', sub: 'Cash flow each year (amber) and what it is worth today after discounting at WACC (teal).', series: [{ name: 'FCFF', type: 'bars', color: 'c2', pts: rows.map(r => [r.t, r.fcff]) }, { name: 'Present value', type: 'bars', color: 'c1', pts: rows.map(r => [r.t, r.pv]) }], xlab: 'Year', yFmt: x => nf(x, 0), yRead: x => money(x, 1) + 'M' },
        { type: 'html', title: 'From cash flows to value per share', sub: 'Enterprise value is built from two pieces, then net debt is removed.', html: hb }
      ],
      steps: [
        ['Year-by-year free cash flow', `FCFF = NOPAT + D&A − Capex − ΔNWC\nYear ${N}: ${m1(last(rows).nopat)} + ${m1(last(rows).da)} − ${m1(last(rows).capex)} − ${m1(last(rows).dnwc)} = ${m1(last(rows).fcff)}  ($M)`],
        ['Discount each year', `PV = FCFF ÷ (1 + ${pct(W, 2)})^t.  Sum of PVs = ${money(base.pvF, 1)}M`],
        ['Terminal value', gordon ? `TV = FCFF_${N} × (1 + g) ÷ (WACC − g) = ${m1(last(rows).fcff)} × ${nfx(1 + tg, 4)} ÷ ${nfx(W - tg, 4)} = ${money(base.tv, 1)}M` : `TV = EBITDA_${N} × multiple = ${m1(base.ebitda)} × ${nf(v.mult, 1)} = ${money(base.tv, 1)}M`],
        ['Discount the terminal value', `${money(base.tv, 1)}M × ${nfx(last(rows).df, 5)} = ${money(base.pvTV, 1)}M`],
        ['Enterprise to equity', `EV = ${money(base.pvF, 1)} + ${money(base.pvTV, 1)} = ${money(base.ev, 1)}M\nEquity = EV − net debt = ${money(base.ev, 1)} − ${money(v.netdebt, 1)} = ${money(base.eq, 1)}M`],
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
        { title: `Sensitivity: value per share (${gordon ? 'WACC × terminal growth' : 'WACC × exit multiple'})`, cols: ['', ...cols.map(c => (gordon ? 'g ' + pct(c, 1) : nf(c, 1) + '×'))], rows: sens }
      ]
    };
  }
});
function last(a) { return a[a.length - 1]; }

register({
  id: 'capbud', group: 'Corporate Finance', title: 'Capital Budgeting',
  blurb: 'NPV, IRR, MIRR, profitability index and payback for one or two projects, with the NPV profile and crossover rate.',
  fields: [
    { id: 'rate', label: 'Discount rate (hurdle)', v: 10, step: 0.25, unit: '%', slider: [0, 30, 0.25] },
    { id: 'rr', label: 'Reinvestment rate (for MIRR)', v: 10, step: 0.25, unit: '%' },
    { id: 'i0A', label: 'Project A · initial investment', v: 100000, step: 5000, pre: '$' },
    { id: 'cfA', label: 'Project A · cash flows, years 1…n', type: 'text', v: '30000, 35000, 40000, 40000, 30000', help: 'Separate with commas. Use a minus sign for outflows.' },
    { id: 'i0B', label: 'Project B · initial investment', v: 100000, step: 5000, pre: '$' },
    { id: 'cfB', label: 'Project B · cash flows (leave empty to skip)', type: 'text', v: '0, 0, 0, 0, 200000' }
  ],
  concept: `<h4>The idea</h4>
<p>Accept projects that create value. The cleanest measure is <b>NPV</b>, the value added in today's dollars. The other tools are useful, but each has a blind spot.</p>
<div class="formula">NPV = −I₀ + Σ CF_t ÷ (1+r)^t          Accept if NPV &gt; 0</div>
<div class="formula">IRR: the r that makes NPV = 0          Accept if IRR &gt; hurdle rate</div>
<div class="formula">PI = PV of future cash flows ÷ I₀        Payback = time to recover I₀</div>
<ul><li><b>IRR vs NPV:</b> for mutually exclusive projects they can disagree. When the NPV profiles cross, the project with the higher IRR is not necessarily the better one. Choose by NPV. The chart shows the crossover rate.</li><li><b>MIRR</b> fixes the assumption that interim cash flows are reinvested at the IRR, by using an explicit reinvestment rate.</li><li><b>Payback</b> ignores everything after recovery and the time value of money (discounted payback fixes the second flaw only).</li><li>Cash flows that change sign more than once can have several IRRs.</li></ul>`,
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
      { label: 'IRR', value: isNum(P.IRR) ? pct(P.IRR, 2) : 'n/a', sub: `hurdle ${pct(r, 1)}` + (P.sc > 1 ? ' · multiple IRRs possible' : '') },
      { label: 'MIRR', value: pct(P.MIRR, 2), sub: `reinvest at ${pct(rr, 1)}` },
      { label: 'Profitability index', value: nf(P.PI, 3), sub: P.PI >= 1 ? 'above 1 is good' : 'below 1 is bad' },
      { label: 'Payback', value: isNum(P.pb) ? yrs(P.pb, 2) : 'Never', sub: 'undiscounted' },
      { label: 'Discounted payback', value: isNum(P.dpb) ? yrs(P.dpb, 2) : 'Never', sub: `at ${pct(r, 1)}` }
    ];
    const cards = [...card('Project A', A), ...(B ? card('Project B', B) : [])];
    let cross = NaN;
    if (B) { const L = Math.max(A.c.length, B.c.length), d = Array.from({ length: L }, (_, k) => (A.c[k] || 0) - (B.c[k] || 0)); cross = irr(d); }
    const ir = [A.IRR, B && B.IRR].filter(isNum), R = Math.min(100, Math.max(20, Math.ceil((ir.length ? Math.max(...ir) * 100 : 20) / 5) * 5 + 10));
    const rs = range(0, R, R / 60), vl = [{ x: v.rate, label: `hurdle ${nf(v.rate, 1)}%`, color: 'c4' }];
    if (isNum(cross) && cross * 100 >= 0 && cross * 100 <= R) vl.push({ x: cross * 100, label: `crossover ${nf(cross * 100, 1)}%`, color: 'mute' });
    const series = [{ name: 'Project A', type: 'line', color: 'c1', pts: rs.map(x => [x, npv(x / 100, A.c)]) }];
    if (B) series.push({ name: 'Project B', type: 'line', color: 'c2', pts: rs.map(x => [x, npv(x / 100, B.c)]) });
    const dots = []; if (isNum(A.IRR) && A.IRR * 100 <= R) dots.push([A.IRR * 100, 0, 'IRR A']); if (B && isNum(B.IRR) && B.IRR * 100 <= R) dots.push([B.IRR * 100, 0, 'IRR B']);
    if (dots.length) series.push({ name: 'IRR', type: 'dots', color: 'c3', noRead: true, pts: dots });
    const note = B ? (A.NPV === B.NPV ? '' : `For mutually exclusive projects choose by NPV: Project ${A.NPV > B.NPV ? 'A' : 'B'} adds ${money(Math.abs(A.NPV - B.NPV), 0)} more value.` + (isNum(A.IRR) && isNum(B.IRR) && (A.IRR > B.IRR) !== (A.NPV > B.NPV) ? ' IRR ranks them the other way, which is the classic conflict.' : '')) : '';
    const trow = P => P.rows.map(x => [x.t, money(x.cf, 0), nfx(x.df, 4), money(x.pv, 0), money(x.cumC, 0), money(x.cumP, 0)]);
    const th = ['Year', 'Cash flow', 'Discount factor', 'PV', 'Cumulative', 'Cumulative PV'];
    return {
      cards, info: note,
      charts: [
        { title: 'NPV profile', sub: 'NPV as the discount rate changes. Where a line crosses zero is that project\'s IRR; where lines cross each other, the ranking flips.', series, vlines: vl, hlines: [{ y: 0 }], xlab: 'Discount rate', xFmt: x => nf(x, 0) + '%', yFmt: x => compact(x), yRead: x => money(x, 0) },
        { title: 'Payback: Project A', sub: 'Cumulative cash flow, with and without discounting. The payback year is where each line turns positive.', series: [{ name: 'Cumulative cash flow', type: 'line', color: 'c2', pts: A.rows.map(x => [x.t, x.cumC]) }, { name: 'Cumulative PV', type: 'line', color: 'c1', pts: A.rows.map(x => [x.t, x.cumP]) }], hlines: [{ y: 0 }], xlab: 'Year', yFmt: x => compact(x), yRead: x => money(x, 0) }
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
