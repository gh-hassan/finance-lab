// @ts-nocheck
/* Batch 3: yield curve, futures and hedging, swaps, value at risk, credit score, leveraged buyout, retirement and factor models. */
import { register } from '../lib/registry';
import { nf, nfx, money, pct, parseList, range, ninv, npdf, ncdf } from '../lib/math';
import { hbars } from '../ui/visuals.js';
import { altman, bootstrap, contracts, esNormal, factorReturn, forwardPrice, hedgeRatio, immunize, lbo, priceOnCurve, retirement, swapRate, swapValue, varHistorical, varNormal } from '../lib/markets';

const P = (x, d = 2) => pct(x, d);
const CURVE_DEFAULT = '4.0, 4.2, 4.4, 4.55, 4.7, 4.8, 4.9, 4.95, 5.0, 5.05';
const curveFrom = text => bootstrap(parseList(text).map(x => x / 100));

/* ================= Yield curve ================= */
register({
  id: 'curve', group: 'Valuation', title: 'Yield Curve & Forward Rates',
  blurb: 'Turn par yields into spot rates and forward rates, price a bond off the curve, and match duration to a goal date.',
  fields: [
    { id: 'par', label: 'Par yields for years 1, 2, 3 and so on (%)', type: 'text', v: CURVE_DEFAULT, help: 'Yields on bonds priced at par, one per year, separated by commas.' },
    { id: 'face', label: 'Bond to price: face value', v: 1000, step: 100, pre: '$' },
    { id: 'cpn', label: 'Bond to price: coupon rate', v: 5, step: 0.25, unit: '%' },
    { id: 'yrs', label: 'Bond to price: years', v: 5, step: 1, min: 1, max: 30, unit: 'yrs' },
    { id: 'hor', label: 'Goal date for duration matching (years)', v: 5, step: 0.5, unit: 'yrs' },
    { id: 'short', label: 'Short zero-coupon bond (years)', v: 3, step: 1, unit: 'yrs' },
    { id: 'long', label: 'Long zero-coupon bond (years)', v: 8, step: 1, unit: 'yrs' }
  ],
  concept: `<h4>The idea</h4>
<p>Different maturities earn different rates. The <b>spot rate</b> is the rate for money locked up from today to year n. The <b>forward rate</b> is the rate the curve implies for one year starting in the future. Bootstrapping builds the spot curve one maturity at a time from par yields.</p>
<div class="formula">DF_n = (1 − y_n × Σ DF_t) ÷ (1 + y_n)     spot_n = DF_n^(−1/n) − 1</div>
<div class="formula">Forward(n−1 to n) = (1 + spot_n)ⁿ ÷ (1 + spot_{n−1})ⁿ⁻¹ − 1</div>
<ul><li>A rising curve means forward rates are above spot rates.</li><li>A bond is a bundle of zero-coupon bonds, so it is priced by discounting each cash flow at its own spot rate.</li><li><b>Immunisation</b>: match the bond portfolio's duration to the goal date so rate moves roughly cancel out.</li></ul>`,
  calc(v) {
    const par = parseList(v.par).map(x => x / 100);
    if (par.length < 2) return { note: 'Enter at least two par yields, one per year, separated by commas.', cards: [], charts: [], steps: [] };
    if (par.some(y => !(y > -0.02) || y > 0.5)) return { note: 'A par yield looks out of range. Enter percentages such as 4.5.', cards: [], charts: [], steps: [] };
    const c = bootstrap(par);
    if (c.some(r => !(r.df > 0))) return { note: 'These par yields cannot come from a sensible curve. Check for a typo.', cards: [], charts: [], steps: [] };
    const n = Math.min(Math.round(v.yrs), c.length), bond = priceOnCurve(c, v.face, v.cpn / 100, n);
    const w = immunize(v.hor, v.short, v.long), inverted = c[c.length - 1].spot < c[0].spot;
    return {
      cards: [
        { key: true, label: `Bond price off the curve`, value: money(bond.price, 2), sub: `${nf(n, 0)} years, ${v.cpn}% coupon, ${bond.price > v.face ? 'above' : 'below'} face` },
        { label: `${c.length}-year spot rate`, value: P(c[c.length - 1].spot, 3), sub: `${c.length}-year par yield ${P(c[c.length - 1].par, 3)}` },
        { label: 'Curve shape', value: inverted ? 'Inverted' : 'Upward sloping', sub: `1-year ${P(c[0].spot, 2)} to ${c.length}-year ${P(c[c.length - 1].spot, 2)}`, tone: inverted ? 'bad' : '' },
        { label: 'Macaulay duration of your bond', value: nf(bond.macaulay, 3) + ' yrs', sub: `modified ${nf(bond.modified, 3)}` },
        { label: 'Duration match', value: w == null ? 'Not possible' : `${nf(w * 100, 1)}% short / ${nf((1 - w) * 100, 1)}% long`, sub: w == null ? 'the goal date must lie between the two bonds' : `${nf(v.short, 0)}-year and ${nf(v.long, 0)}-year zeros, average duration ${nf(v.hor, 2)}` }
      ],
      charts: [{
        title: 'Par, spot and forward rates', sub: 'Spot rates come from bootstrapping the par yields. Forward rates are the one-year rates the curve implies for later years.',
        series: [{ name: 'Par yield', type: 'line', color: 'c4', pts: c.map(r => [r.t, r.par * 100]) }, { name: 'Spot rate', type: 'line', color: 'c1', pts: c.map(r => [r.t, r.spot * 100]) }, { name: 'One-year forward', type: 'line', color: 'c2', dash: true, pts: c.map(r => [r.t, r.fwd * 100]) }],
        xlab: 'Years', xFmt: x => nf(x, 0), yFmt: x => nf(x, 1) + '%', yRead: x => nf(x, 3) + '%'
      }],
      tables: [
        { title: 'The curve', cols: ['Year', 'Par yield', 'Spot rate', 'Discount factor', 'Forward rate'], rows: c.map(r => [r.t, P(r.par, 3), P(r.spot, 3), nfx(r.df, 5), P(r.fwd, 3)]) },
        { title: 'Your bond, cash flow by cash flow', cols: ['Year', 'Cash flow', 'Spot rate', 'Present value'], rows: bond.flows.map(f => [f.t, money(f.cf, 2), P(c[f.t - 1].spot, 3), money(f.pv, 2)]), collapsed: n > 8 }
      ],
      steps: [
        ['Discount factors', c.slice(0, 3).map(r => `Year ${r.t}: DF = ${nfx(r.df, 5)}`).join('   ') + (c.length > 3 ? ' …' : '')],
        ['Spot rates', `spot_n = DF_n^(−1/n) − 1, for example year 2 = ${P(c[1].spot, 3)}.`],
        ['Forward rates', `Year 1 to 2: (1 + ${P(c[1].spot, 3)})² ÷ (1 + ${P(c[0].spot, 3)}) − 1 = ${P(c[1].fwd, 3)}.`],
        ['Bond price', `Each cash flow × its discount factor, added up: ${money(bond.price, 2)}.`],
        ['Duration match', w == null ? 'The goal date must lie between the two zero-coupon maturities.' : `w × ${nf(v.short, 0)} + (1 − w) × ${nf(v.long, 0)} = ${nf(v.hor, 2)} gives w = ${nf(w, 4)} in the short bond.`]
      ]
    };
  }
});

/* ================= Futures and hedging ================= */
register({
  id: 'futures', group: 'Derivatives', title: 'Futures, Forwards & Hedging',
  blurb: 'Price a forward by cost of carry, spot an arbitrage, and work out how many futures contracts hedge an exposure.',
  fields: [
    { id: 'S', label: 'Spot price today', v: 100, step: 1, pre: '$' },
    { id: 'r', label: 'Risk-free rate', v: 5, step: 0.25, unit: '%' },
    { id: 'u', label: 'Storage cost (% a year)', v: 1, step: 0.25, unit: '%' },
    { id: 'y', label: 'Yield or convenience benefit (% a year)', v: 2, step: 0.25, unit: '%' },
    { id: 'T', label: 'Time to delivery', v: 0.5, step: 0.25, unit: 'yrs', slider: [0.1, 3, 0.05] },
    { id: 'mkt', label: 'Futures price in the market', v: 102, step: 0.5, pre: '$' },
    { id: 'expo', label: 'Value to hedge ($)', v: 2000000, step: 100000, pre: '$' },
    { id: 'cv', label: 'Value of one futures contract ($)', v: 250000, step: 10000, pre: '$' },
    { id: 'rho', label: 'Correlation of spot and futures', v: 0.9, step: 0.05, min: -1, max: 1, slider: [0, 1, 0.01] },
    { id: 'sdS', label: 'Risk of your exposure (% a year)', v: 22, step: 1, unit: '%' },
    { id: 'sdF', label: 'Risk of the futures (% a year)', v: 18, step: 1, unit: '%' }
  ],
  concept: `<h4>The idea</h4>
<p>A forward price is set by what it would cost to buy the asset now and hold it until delivery: you pay interest and storage, and you earn any dividend or convenience yield. If the market price differs from that, a riskless profit exists.</p>
<div class="formula">F = S × e^((r + storage − yield) × T)</div>
<div class="formula">Hedge ratio h = ρ × σ_spot ÷ σ_futures     Contracts = h × exposure ÷ contract value</div>
<ul><li>If the market futures price is above F, sell the future and buy the asset (cash and carry). If below, do the reverse.</li><li>The hedge ratio is the slope of spot changes on futures changes. Perfect correlation does not mean a ratio of one: risks differ.</li></ul>`,
  calc(v) {
    if (!(v.S > 0) || !(v.T > 0)) return { note: 'Spot price and time to delivery must be above zero.', cards: [], charts: [], steps: [] };
    const r = v.r / 100, u = v.u / 100, y = v.y / 100, F = forwardPrice(v.S, r, u, y, v.T), diff = v.mkt - F;
    const h = hedgeRatio(v.rho, v.sdS / 100, v.sdF / 100), nC = contracts(h, v.expo, v.cv), basis = F - v.S;
    const ts = range(0.05, Math.max(1, v.T * 2), Math.max(0.05, v.T / 10));
    return {
      cards: [
        { key: true, label: 'Fair forward price', value: money(F, 3), sub: `${diff > 0 ? 'market is ' + money(diff, 3) + ' too high' : diff < 0 ? 'market is ' + money(-diff, 3) + ' too low' : 'market price is fair'}` },
        { label: 'Arbitrage', value: Math.abs(diff) < 0.005 ? 'None' : diff > 0 ? 'Cash and carry' : 'Reverse cash and carry', sub: Math.abs(diff) < 0.005 ? 'the futures price matches' : diff > 0 ? 'buy the asset, sell the future, borrow' : 'sell the asset short, buy the future, lend', tone: Math.abs(diff) < 0.005 ? '' : 'good' },
        { label: 'Basis (forward − spot)', value: money(basis, 3), sub: 'closes to zero by delivery' },
        { label: 'Hedge ratio', value: nf(h, 3), sub: `ρ ${nf(v.rho, 2)} × ${v.sdS}% ÷ ${v.sdF}%` },
        { label: 'Contracts to sell', value: nf(nC, 1), sub: `to hedge ${money(v.expo, 0)}` }
      ],
      charts: [{ title: 'Forward price over time', sub: 'Fair forward price for each delivery date, against the market price you entered.', series: [{ name: 'Fair forward price', type: 'line', color: 'c1', pts: ts.map(t => [t, forwardPrice(v.S, r, u, y, t)]) }], hlines: [{ y: v.S, label: 'spot', color: 'c4' }], vlines: [{ x: v.T, label: 'your date', color: 'c2' }], xlab: 'Years to delivery', xFmt: x => nf(x, 1), yFmt: x => '$' + nf(x, 0), yRead: x => money(x, 3) }],
      steps: [
        ['Cost of carry', `F = ${nf(v.S, 2)} × e^((${P(r, 2)} + ${P(u, 2)} − ${P(y, 2)}) × ${nf(v.T, 2)}) = ${money(F, 3)}`],
        ['Compare with the market', `${money(v.mkt, 3)} − ${money(F, 3)} = ${money(diff, 3)}`],
        ['Hedge ratio', `h = ${nf(v.rho, 2)} × ${P(v.sdS / 100, 1)} ÷ ${P(v.sdF / 100, 1)} = ${nf(h, 3)}`],
        ['Contracts', `${nf(h, 3)} × ${money(v.expo, 0)} ÷ ${money(v.cv, 0)} = ${nf(nC, 2)}`]
      ]
    };
  }
});

/* ================= Interest rate swaps ================= */
register({
  id: 'swaps', group: 'Derivatives', title: 'Interest Rate Swaps',
  blurb: 'Find the fair fixed rate of a swap from the yield curve, and value an existing swap when rates have moved.',
  fields: [
    { id: 'par', label: 'Par yields for years 1, 2, 3 and so on (%)', type: 'text', v: CURVE_DEFAULT },
    { id: 'term', label: 'Swap term', v: 5, step: 1, min: 1, max: 30, unit: 'yrs' },
    { id: 'notional', label: 'Notional amount', v: 10000000, step: 500000, pre: '$' },
    { id: 'fixed', label: 'Fixed rate you pay on an existing swap', v: 4.2, step: 0.05, unit: '%' }
  ],
  concept: `<h4>The idea</h4>
<p>In a plain swap one side pays a fixed rate and the other pays a floating rate on the same notional. At the start the fixed rate is set so the deal is worth zero to both. Later, if market rates rise, the fixed payer is ahead, because they lock in a lower rate than the market now demands.</p>
<div class="formula">Fair swap rate = (1 − DF_n) ÷ Σ DF_t</div>
<div class="formula">Value to fixed payer = (market swap rate − your fixed rate) × Σ DF_t × notional</div>
<ul><li>The floating leg is worth par at every reset date, so only discount factors matter.</li><li>A swap turns a floating loan into a fixed one (pay fixed) or the reverse (receive fixed).</li></ul>`,
  calc(v) {
    const c = curveFrom(v.par), n = Math.min(Math.round(v.term), c.length);
    if (c.length < 2 || c.some(r => !(r.df > 0))) return { note: 'Enter at least two sensible par yields, separated by commas.', cards: [], charts: [], steps: [] };
    const df = c.slice(0, n).map(r => r.df), s = swapRate(df), ann = df.reduce((a, b) => a + b, 0), val = swapValue(df, v.fixed / 100) * v.notional;
    return {
      cards: [
        { key: true, label: `Fair ${n}-year swap rate`, value: P(s, 3), sub: 'fixed rate that makes the swap worth zero' },
        { label: 'Value of your swap (to fixed payer)', value: money(val, 0), sub: `${P(v.fixed / 100, 2)} fixed against ${P(s, 2)} today`, tone: val >= 0 ? 'good' : 'bad' },
        { label: 'Value to the floating payer', value: money(-val, 0), sub: 'the other side of the same swap', tone: val <= 0 ? 'good' : 'bad' },
        { label: 'Annuity factor', value: nfx(ann, 4), sub: 'sum of the discount factors' },
        { label: 'Fixed payment each year', value: money(v.notional * v.fixed / 100, 0), sub: `on ${money(v.notional, 0)}` }
      ],
      charts: [{ title: 'Discount factors and the fair rate', sub: 'Each year the swap is worth less today because of discounting.', series: [{ name: 'Discount factor', type: 'bars', color: 'c1', pts: c.slice(0, n).map(r => [r.t, r.df]) }], xlab: 'Year', xFmt: x => nf(x, 0), yFmt: x => nf(x, 2), yRead: x => nfx(x, 4) }],
      tables: [{ title: 'Cash flows of your swap', cols: ['Year', 'Fixed payment', 'Discount factor', 'Present value of fixed leg'], rows: c.slice(0, n).map(r => [r.t, money(v.notional * v.fixed / 100, 0), nfx(r.df, 5), money(v.notional * v.fixed / 100 * r.df, 0)]) }],
      steps: [
        ['Discount factors', `From the par curve: ${c.slice(0, Math.min(3, n)).map(r => nfx(r.df, 4)).join(', ')}${n > 3 ? ' …' : ''}`],
        ['Fair rate', `(1 − ${nfx(df[df.length - 1], 5)}) ÷ ${nfx(ann, 5)} = ${P(s, 4)}`],
        ['Value', `(${P(s, 3)} − ${P(v.fixed / 100, 3)}) × ${nfx(ann, 4)} × ${money(v.notional, 0)} = ${money(val, 0)}`]
      ]
    };
  }
});

/* ================= Value at risk ================= */
register({
  id: 'varcalc', group: 'Investments', title: 'Value at Risk',
  blurb: 'How much could you lose in a bad period? Parametric VaR, expected shortfall, and historical VaR from your own returns.',
  fields: [
    { id: 'val', label: 'Portfolio value', v: 1000000, step: 50000, pre: '$' },
    { id: 'mu', label: 'Expected return (% a year)', v: 8, step: 0.5, unit: '%' },
    { id: 'sd', label: 'Risk (% a year)', v: 18, step: 0.5, unit: '%', slider: [2, 60, 0.5] },
    { id: 'days', label: 'Holding period', v: 10, step: 1, unit: 'days', slider: [1, 250, 1] },
    { id: 'conf', label: 'Confidence', v: 95, step: 0.5, unit: '%', slider: [80, 99.9, 0.1] },
    { id: 'hist', label: 'Your past returns per period (%)', type: 'text', v: '1.2, -0.8, 2.1, -3.4, 0.6, 1.9, -1.1, 0.4, -2.2, 3.0, -0.5, 1.4, -4.8, 2.6, 0.9, -1.7, 1.1, 0.2, -0.9, 1.6', help: 'Optional. Used for historical VaR, over the same length of period.' }
  ],
  concept: `<h4>The idea</h4>
<p>Value at risk answers: "With a given confidence, what is the most I can lose over this period?" At 95% over 10 days, the loss should be larger than the VaR only on about one day in twenty of those periods. It says nothing about how bad the rare worse case is, which is what <b>expected shortfall</b> adds.</p>
<div class="formula">VaR = Value × (z × σ × √T − μ × T)</div>
<div class="formula">Expected shortfall = Value × (σ√T × φ(z) ÷ (1 − confidence) − μT)</div>
<ul><li>Risk grows with the square root of time, not in proportion to it.</li><li>The normal curve understates fat tails, so historical VaR is often larger in real markets.</li><li>Expected shortfall is always larger than VaR at the same confidence.</li></ul>`,
  calc(v) {
    const conf = v.conf / 100;
    if (!(v.val > 0) || !(v.sd > 0) || !(v.days > 0) || !(conf > 0.5 && conf < 1)) return { note: 'Value, risk and holding period must be above zero, and confidence between 50% and 100%.', cards: [], charts: [], steps: [] };
    const T = v.days / 252, mu = v.mu / 100, sd = v.sd / 100, vn = varNormal(v.val, mu, sd, T, conf), es = esNormal(v.val, mu, sd, T, conf), z = ninv(conf), s = sd * Math.sqrt(T), m = mu * T;
    const h = varHistorical(parseList(v.hist).map(x => x / 100), v.val, conf);
    const xs = range(m - 4 * s, m + 4 * s, (8 * s) / 80), line = xs.map(x => [x * 100, (npdf((x - m) / s) / s) / 100]);
    return {
      cards: [
        { key: true, label: `${nf(v.conf, 1)}% value at risk, ${nf(v.days, 0)} days`, value: money(vn, 0), sub: `${pct(vn / v.val, 2)} of the portfolio`, tone: 'bad' },
        { label: 'Expected shortfall', value: money(es, 0), sub: `average loss in the worst ${nf(100 - v.conf, 1)}% of cases`, tone: 'bad' },
        { label: 'Chance of any loss', value: pct(ncdf(-m / s), 1), sub: 'over the same period' },
        { label: 'Historical VaR', value: h ? money(h.var, 0) : 'Need 5+ returns', sub: h ? `expected shortfall ${money(h.es, 0)}` : 'enter your past returns' },
        { label: 'Risk over the period', value: pct(s, 2), sub: `${pct(sd, 1)} a year × √(${nf(v.days, 0)}/252)` }
      ],
      charts: [{ title: 'Where the loss line sits', sub: 'The bell curve is the spread of possible returns over your holding period. Losses beyond the line happen about as often as the confidence level allows.', series: [{ name: 'Possible returns', type: 'line', color: 'c1', pts: line }], vlines: [{ x: -(vn / v.val) * 100, label: 'VaR', color: 'c4' }, { x: m * 100, label: 'expected', color: 'c2' }], xlab: 'Return over the period (%)', xFmt: x => nf(x, 1) + '%', yFmt: x => nf(x, 2), yRead: x => nf(x, 3) }],
      steps: [
        ['Scale to the period', `T = ${nf(v.days, 0)} ÷ 252 = ${nfx(T, 4)} years; σ√T = ${P(s, 3)}; μT = ${P(m, 3)}`],
        ['Normal cutoff', `z for ${nf(v.conf, 1)}% = ${nf(z, 4)}`],
        ['Value at risk', `${money(v.val, 0)} × (${nf(z, 4)} × ${P(s, 3)} − ${P(m, 3)}) = ${money(vn, 0)}`],
        ['Expected shortfall', `${money(v.val, 0)} × (${P(s, 3)} × ${nfx(npdf(z), 4)} ÷ ${nf(1 - conf, 3)} − ${P(m, 3)}) = ${money(es, 0)}`]
      ]
    };
  }
});

/* ================= Credit health ================= */
register({
  id: 'altman', group: 'Analysis', title: 'Credit Health (Altman Z-Score)',
  blurb: 'Score how close a company is to financial distress from five ratios, with the safe, grey and distress zones.',
  fields: [
    { id: 'model', label: 'Type of company', type: 'select', v: 'public', options: [['public', 'Listed manufacturer'], ['private', 'Private company'], ['service', 'Service or emerging market']] },
    { id: 'wc', label: 'Working capital ($M)', v: 180, step: 10 },
    { id: 're', label: 'Retained earnings ($M)', v: 420, step: 10 },
    { id: 'ebit', label: 'EBIT ($M)', v: 210, step: 10 },
    { id: 'eq', label: 'Equity value ($M)', v: 1500, step: 50 },
    { id: 'liab', label: 'Total liabilities ($M)', v: 900, step: 25 },
    { id: 'sales', label: 'Sales ($M)', v: 2100, step: 50 },
    { id: 'assets', label: 'Total assets ($M)', v: 1800, step: 50 }
  ],
  concept: `<h4>The idea</h4>
<p>The Altman Z-score combines five financial ratios into one number that predicted bankruptcies well in the sample it was built from. Higher is safer.</p>
<div class="formula">Z = 1.2·(WC/A) + 1.4·(RE/A) + 3.3·(EBIT/A) + 0.6·(Equity/Liabilities) + 1.0·(Sales/A)</div>
<ul><li>Listed manufacturers: safe above 2.99, distress below 1.81.</li><li>Private companies use book equity and different weights; the zones are 2.9 and 1.23.</li><li>Service and emerging-market firms drop the sales ratio; the zones are 2.6 and 1.1.</li><li>It is a screen, not a verdict. Always look at cash flow and debt maturities too.</li></ul>`,
  calc(v) {
    if (!(v.assets > 0) || !(v.liab > 0)) return { note: 'Total assets and total liabilities must be above zero.', cards: [], charts: [], steps: [] };
    const o = altman({ wc: v.wc, re: v.re, ebit: v.ebit, equity: v.eq, liab: v.liab, sales: v.sales, assets: v.assets }, v.model);
    const zone = { safe: 'Safe zone', grey: 'Grey zone', distress: 'Distress zone' }[o.zone], tone = o.zone === 'safe' ? 'good' : o.zone === 'distress' ? 'bad' : '';
    const labels = ['Working capital ÷ assets', 'Retained earnings ÷ assets', 'EBIT ÷ assets', 'Equity ÷ liabilities', 'Sales ÷ assets'].slice(0, o.x.length);
    const W = { public: [1.2, 1.4, 3.3, 0.6, 1.0], private: [0.717, 0.847, 3.107, 0.42, 0.998], service: [6.56, 3.26, 6.72, 1.05] }[v.model];
    const top = Math.max(o.cut[1] * 1.6, o.z * 1.2, 1);
    return {
      cards: [
        { key: true, label: 'Z-score', value: nf(o.z, 2), sub: zone, tone },
        { label: 'Distress below', value: nf(o.cut[0], 2), sub: 'high risk of failure' },
        { label: 'Safe above', value: nf(o.cut[1], 2), sub: 'low risk of failure' },
        { label: 'Leverage', value: nf(v.liab / v.assets * 100, 0) + '% of assets', sub: `liabilities ${money(v.liab, 0)}M` }
      ],
      info: o.zone === 'grey' ? 'The grey zone means it is hard to call: watch the trend and look at cash flow.' : '',
      charts: [{ type: 'html', title: 'Where the score sits', sub: 'Red is distress, amber is grey, green is safe.', html: hbars([{ label: 'Distress', from: 0, to: o.cut[0], color: 'bad', text: `below ${nf(o.cut[0], 2)}` }, { label: 'Grey zone', from: o.cut[0], to: o.cut[1], color: 'c4', text: `${nf(o.cut[0], 2)} to ${nf(o.cut[1], 2)}` }, { label: 'Safe', from: o.cut[1], to: top, color: 'good', text: `above ${nf(o.cut[1], 2)}` }, { label: 'This company', from: 0, to: Math.max(0.02, o.z), color: 'c2', text: nf(o.z, 2) }]) }],
      tables: [{ title: 'What builds the score', cols: ['Ratio', 'Value', 'Weight', 'Contribution'], rows: o.x.map((x, i) => [labels[i], nf(x, 3), nf(W[i], 3), nf(x * W[i], 3)]) }],
      steps: [['Ratios', labels.map((l, i) => `${l} = ${nf(o.x[i], 3)}`).join('\n')], ['Score', `Z = ${o.x.map((x, i) => `${nf(W[i], 3)}×${nf(x, 3)}`).join(' + ')} = ${nf(o.z, 3)}`], ['Zone', `${zone}: distress below ${nf(o.cut[0], 2)}, safe above ${nf(o.cut[1], 2)}.`]]
    };
  }
});

/* ================= Leveraged buyout ================= */
register({
  id: 'lbo', group: 'Corporate Finance', title: 'Leveraged Buyout (LBO)',
  blurb: 'Buy a company with mostly borrowed money, repay the debt from its cash flow, sell, and see the return to the buyer.',
  fields: [
    { id: 'ebitda', label: 'EBITDA today ($M)', v: 100, step: 5 },
    { id: 'entry', label: 'Price paid (× EBITDA)', v: 8, step: 0.25, unit: '×', slider: [3, 15, 0.25] },
    { id: 'debtX', label: 'Debt used (× EBITDA)', v: 5, step: 0.25, unit: '×', slider: [0, 8, 0.25] },
    { id: 'fee', label: 'Deal fees (% of price)', v: 2, step: 0.25, unit: '%' },
    { id: 'rate', label: 'Interest rate on the debt', v: 8, step: 0.25, unit: '%' },
    { id: 'g', label: 'EBITDA growth per year', v: 5, step: 0.5, unit: '%', slider: [-5, 20, 0.5] },
    { id: 'capex', label: 'Capital spending (% of EBITDA)', v: 20, step: 1, unit: '%' },
    { id: 'tax', label: 'Tax rate', v: 25, step: 1, unit: '%' },
    { id: 'exit', label: 'Sale price (× EBITDA)', v: 8, step: 0.25, unit: '×', slider: [3, 15, 0.25] },
    { id: 'yrs', label: 'Years held', v: 5, step: 1, min: 1, max: 10, unit: 'yrs' }
  ],
  concept: `<h4>The idea</h4>
<p>A buyout fund puts in a small slice of equity and borrows the rest. If the business grows and pays down the debt, the equity grows much faster than the company. The return comes from three sources: <b>earnings growth</b>, <b>multiple expansion</b> and <b>debt paydown</b>.</p>
<div class="formula">Equity in = Price + fees − debt     Equity out = Exit multiple × EBITDA − remaining debt</div>
<div class="formula">MOIC = Equity out ÷ Equity in     IRR = MOIC^(1/years) − 1</div>
<ul><li>More debt raises the return when things go well and magnifies the loss when they do not.</li><li>All free cash after interest and tax repays debt (a "cash sweep").</li><li>Buying and selling at the same multiple isolates the return from operations and debt paydown.</li></ul>`,
  calc(v) {
    if (!(v.ebitda > 0) || !(v.entry > 0) || v.debtX < 0) return { note: 'EBITDA and the price multiple must be above zero.', cards: [], charts: [], steps: [] };
    if (v.debtX >= v.entry * (1 + v.fee / 100)) return { note: 'The debt would pay for the whole purchase, leaving no equity. Lower the debt multiple.', cards: [], charts: [], steps: [] };
    const o = lbo({ ebitda: v.ebitda, entry: v.entry, debtX: v.debtX, fee: v.fee / 100, rate: v.rate / 100, growth: v.g / 100, capex: v.capex / 100, tax: v.tax / 100, exit: v.exit, years: Math.round(v.yrs) });
    const b = o.bridge, M = x => money(x, 1) + 'M';
    return {
      cards: [
        { key: true, label: 'Buyer return (IRR)', value: pct(o.irr, 1), sub: `${nf(o.moic, 2)}× money back over ${Math.round(v.yrs)} years`, tone: o.irr >= 0.2 ? 'good' : o.irr < 0.08 ? 'bad' : '' },
        { label: 'Equity put in', value: M(o.equity0), sub: `${pct(o.equity0 / (o.ev0 + o.ev0 * v.fee / 100), 0)} of the total cost` },
        { label: 'Equity out at the sale', value: M(o.equityN), sub: `sale price ${M(o.evN)} less debt ${M(o.debtN)}` },
        { label: 'Debt repaid', value: M(o.debt0 - o.debtN), sub: `from ${M(o.debt0)} to ${M(o.debtN)}`, tone: 'good' },
        { label: 'Debt at the start (× EBITDA)', value: nf(v.debtX, 2) + '×', sub: `interest ${M(o.debt0 * v.rate / 100)} in year 1` }
      ],
      info: o.equityN <= 0 ? 'The sale price does not cover the debt, so the equity is wiped out.' : '',
      charts: [{ type: 'html', title: 'Where the gain comes from', sub: 'The gain to the buyer, split into its three sources (and the cost of fees).', html: hbars([{ label: 'Earnings growth', from: 0, to: Math.max(0, b.growth), color: 'c1', text: M(b.growth) }, { label: 'Debt paydown', from: 0, to: Math.max(0, b.paydown), color: 'c3', text: M(b.paydown) }, { label: 'Multiple change', from: 0, to: Math.abs(b.multiple), color: b.multiple >= 0 ? 'c2' : 'bad', text: (b.multiple >= 0 ? '+' : '−') + M(Math.abs(b.multiple)) }, { label: 'Fees', from: 0, to: Math.abs(b.fees), color: 'bad', text: '−' + M(Math.abs(b.fees)) }]) }, {
        title: 'The debt comes down', sub: 'Debt at the end of each year as the cash sweep repays it.', series: [{ name: 'Debt', type: 'bars', color: 'c2', pts: [[0, o.debt0], ...o.years.map(y => [y.year, y.debt])] }], xlab: 'Year', xFmt: x => 'Y' + nf(x, 0), yFmt: x => '$' + nf(x, 0), yRead: x => '$' + nf(x, 1) + 'M'
      }],
      tables: [{ title: 'Year by year ($M)', cols: ['Year', 'EBITDA', 'Interest', 'Free cash to repay debt', 'Debt at year end'], rows: o.years.map(y => [y.year, nf(y.ebitda, 1), nf(y.interest, 1), nf(y.fcf, 1), nf(y.debt, 1)]) }],
      steps: [
        ['The deal', `Price = ${nf(v.entry, 2)} × ${M(v.ebitda)} = ${M(o.ev0)}; debt = ${nf(v.debtX, 2)}× = ${M(o.debt0)}; fees ${M(o.ev0 * v.fee / 100)}; equity = ${M(o.equity0)}.`],
        ['Each year', 'Free cash = EBITDA − capital spending − interest − tax. All of it repays debt.'],
        ['The sale', `${nf(v.exit, 2)} × ${M(o.years[o.years.length - 1].ebitda)} = ${M(o.evN)}; less debt ${M(o.debtN)} = equity ${M(o.equityN)}.`],
        ['Return', `MOIC = ${M(o.equityN)} ÷ ${M(o.equity0)} = ${nf(o.moic, 3)}×; IRR = ${nf(o.moic, 3)}^(1/${Math.round(v.yrs)}) − 1 = ${pct(o.irr, 2)}`]
      ]
    };
  }
});

/* ================= Retirement ================= */
register({
  id: 'retire', group: 'Foundations', title: 'Retirement Planner',
  blurb: 'Will your savings last? Project your pot to retirement and compare it with what an inflation-linked income needs.',
  fields: [
    { id: 'age', label: 'Your age today', v: 30, step: 1, min: 18, max: 80, unit: 'yrs' },
    { id: 'ret', label: 'Retirement age', v: 65, step: 1, min: 40, max: 85, unit: 'yrs' },
    { id: 'live', label: 'Plan to age', v: 90, step: 1, min: 60, max: 110, unit: 'yrs' },
    { id: 'saved', label: 'Saved so far', v: 50000, step: 5000, pre: '$' },
    { id: 'add', label: 'Saved each year', v: 10000, step: 500, pre: '$' },
    { id: 'ag', label: 'Savings rise each year by', v: 2, step: 0.5, unit: '%' },
    { id: 'pre', label: 'Return before retirement', v: 6, step: 0.25, unit: '%' },
    { id: 'post', label: 'Return in retirement', v: 4, step: 0.25, unit: '%' },
    { id: 'inf', label: 'Inflation', v: 2.5, step: 0.25, unit: '%' },
    { id: 'inc', label: 'Yearly income wanted (in today\'s money)', v: 60000, step: 1000, pre: '$' }
  ],
  concept: `<h4>The idea</h4>
<p>Work out two numbers: what you will have when you stop working, and what you will need. Your pot grows with returns and your contributions. The need is the present value of an income that rises with inflation until the age you plan for.</p>
<div class="formula">Pot at retirement = savings grown at the pre-retirement return, plus contributions</div>
<div class="formula">Need = first withdrawal × annuity at the real return, where first withdrawal = income × (1 + inflation)^years to go</div>
<ul><li>The real return is (1 + return) ÷ (1 + inflation) − 1. Inflation matters as much as the return.</li><li>The extra saving shown closes the gap exactly, if you started it today and raised it with your other savings.</li><li>Living longer, spending more or earning less all widen the gap.</li></ul>`,
  calc(v) {
    if (v.ret <= v.age || v.live <= v.ret) return { note: 'Retirement age must be after your age today, and the planning age after retirement.', cards: [], charts: [], steps: [] };
    const m = { age: v.age, retire: v.ret, live: v.live, saved: v.saved, add: v.add, addGrowth: v.ag / 100, pre: v.pre / 100, post: v.post / 100, inflation: v.inf / 100, income: v.inc };
    const o = retirement(m), ok = o.gap <= 0;
    let b = v.saved; const path = [[v.age, b]]; for (let a = v.age; a < v.ret; a++) { b = b * (1 + m.pre) + v.add * Math.pow(1 + m.addGrowth, a - v.age); path.push([a + 1, b]); }
    let w = o.firstWithdrawal; for (let a = v.ret; a < v.live; a++) { b = (b - w) * (1 + m.post); w *= 1 + m.inflation; path.push([a + 1, Math.max(0, b)]); }
    return {
      cards: [
        { key: true, label: ok ? 'You are on track' : 'Shortfall at retirement', value: ok ? money(-o.gap, 0) + ' spare' : money(o.gap, 0), sub: ok ? 'pot above what you need' : 'pot below what you need', tone: ok ? 'good' : 'bad' },
        { label: 'Pot at retirement', value: money(o.atRetire, 0), sub: `at age ${v.ret}` },
        { label: 'Needed at retirement', value: money(o.need, 0), sub: `to pay ${money(o.firstWithdrawal, 0)} in the first year (${money(v.inc, 0)} in today's money)` },
        { label: ok ? 'Money lasts until' : 'Money runs out at age', value: nf(Math.min(o.fundedUntil, 120), 0), sub: `plan is to age ${v.live}`, tone: o.fundedUntil >= v.live ? 'good' : 'bad' },
        { label: 'Extra to save each year', value: ok ? '$0' : money(o.extraPerYear, 0), sub: ok ? 'nothing more is needed' : 'starting now, rising with your savings' }
      ],
      charts: [{ title: 'Your savings pot over life', sub: 'The pot grows while you save and then shrinks as you take your income.', series: [{ name: 'Savings pot', type: 'line', color: 'c1', pts: path }], vlines: [{ x: v.ret, label: 'retire', color: 'c4' }], hlines: [{ y: 0 }], xlab: 'Age', xFmt: x => nf(x, 0), yFmt: x => '$' + nf(x / 1000, 0) + 'K', yRead: x => money(x, 0) }],
      steps: [
        ['Pot at retirement', `${money(v.saved, 0)} grown ${nf(o.yearsSaving, 0)} years at ${v.pre}% plus ${money(v.add, 0)} a year (rising ${v.ag}%) = ${money(o.atRetire, 0)}`],
        ['First withdrawal', `${money(v.inc, 0)} × (1 + ${v.inf}%)^${nf(o.yearsSaving, 0)} = ${money(o.firstWithdrawal, 0)}`],
        ['Amount needed', `Present value of ${nf(o.yearsIncome, 0)} years of income rising with inflation, at a ${v.post}% return = ${money(o.need, 0)}`],
        ['Gap', `${money(o.need, 0)} − ${money(o.atRetire, 0)} = ${money(o.gap, 0)}`]
      ]
    };
  }
});

/* ================= Factor models ================= */
register({
  id: 'factors', group: 'Investments', title: 'Factor Models (APT & Fama-French)',
  blurb: 'Explain an expected return with several risk factors, not just the market, and compare with CAPM.',
  fields: [
    { id: 'rf', label: 'Risk-free rate', v: 3, step: 0.25, unit: '%' },
    { id: 'names', label: 'Factor names', type: 'text', v: 'Market, Size, Value, Momentum', help: 'Separated by commas.' },
    { id: 'prem', label: 'Factor premiums (% a year)', type: 'text', v: '5.5, 2.0, 3.0, 4.0', help: 'The extra return each factor has earned, one per name.' },
    { id: 'beta', label: 'Your asset\'s loadings (betas)', type: 'text', v: '1.1, 0.4, -0.2, 0.3', help: 'How strongly the asset moves with each factor.' },
    { id: 'actual', label: 'Return the asset actually earned', v: 9.5, step: 0.25, unit: '%' }
  ],
  concept: `<h4>The idea</h4>
<p>CAPM says only market risk earns a premium. Factor models say several kinds of risk do: being small, being cheap (value), having recently risen (momentum). An asset's expected return is the risk-free rate plus each loading times that factor's premium.</p>
<div class="formula">E[R] = r_f + β₁λ₁ + β₂λ₂ + … + βₖλₖ</div>
<div class="formula">Alpha = actual return − expected return</div>
<ul><li>The first factor is the market, so a one-factor model is CAPM.</li><li>A negative loading earns a negative contribution: the asset behaves like the opposite of that factor.</li><li>Alpha is what the factors cannot explain. Positive alpha means the asset earned more than its risks justify.</li></ul>`,
  calc(v) {
    const names = String(v.names).split(',').map(s => s.trim()).filter(Boolean), prem = parseList(v.prem).map(x => x / 100), beta = parseList(v.beta), k = Math.min(names.length, prem.length, beta.length);
    if (k < 1) return { note: 'Give at least one factor: a name, a premium and a loading for each, separated by commas.', cards: [], charts: [], steps: [] };
    const rf = v.rf / 100, nm = names.slice(0, k), pr = prem.slice(0, k), bt = beta.slice(0, k), er = factorReturn(rf, bt, pr), capm = rf + bt[0] * pr[0], alpha = v.actual / 100 - er;
    const contrib = bt.map((b, i) => b * pr[i]);
    return {
      cards: [
        { key: true, label: 'Expected return (factor model)', value: P(er, 2), sub: `${k} factor${k > 1 ? 's' : ''} plus the risk-free rate` },
        { label: 'CAPM expected return', value: P(capm, 2), sub: `${nm[0]} factor only`, tone: '' },
        { label: 'Alpha versus the factor model', value: (alpha >= 0 ? '+' : '') + P(alpha, 2), sub: `actual ${P(v.actual / 100, 2)}`, tone: alpha >= 0 ? 'good' : 'bad' },
        { label: 'What the extra factors add', value: (er - capm >= 0 ? '+' : '') + P(er - capm, 2), sub: 'versus CAPM alone' }
      ],
      charts: [{ type: 'html', title: 'What builds the expected return', sub: 'Each bar is a loading times its factor premium, on top of the risk-free rate.', html: hbars([{ label: 'Risk-free rate', from: 0, to: Math.max(0, rf) * 100, color: 'c4', text: P(rf, 2) }, ...nm.map((n, i) => ({ label: n, from: 0, to: Math.abs(contrib[i]) * 100, color: contrib[i] >= 0 ? 'c1' : 'bad', text: `${contrib[i] >= 0 ? '+' : '−'}${P(Math.abs(contrib[i]), 2)} (${nf(bt[i], 2)} × ${P(pr[i], 1)})` }))]) }],
      tables: [{ title: 'Factors', cols: ['Factor', 'Premium', 'Loading', 'Contribution'], rows: nm.map((n, i) => [n, P(pr[i], 2), nf(bt[i], 2), P(contrib[i], 2)]) }],
      steps: [['Expected return', `E[R] = ${P(rf, 2)} + ${nm.map((n, i) => `${nf(bt[i], 2)}×${P(pr[i], 1)}`).join(' + ')} = ${P(er, 3)}`], ['CAPM', `${P(rf, 2)} + ${nf(bt[0], 2)}×${P(pr[0], 1)} = ${P(capm, 3)}`], ['Alpha', `${P(v.actual / 100, 2)} − ${P(er, 2)} = ${P(alpha, 3)}`]]
    };
  }
});
