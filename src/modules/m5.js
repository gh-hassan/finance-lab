// @ts-nocheck
import { register } from '../lib/registry';
import { nf, nfx, money, pct, mult, yrs, compact, parseList, sum, range, npv, irr, findRoot, annF, fvF, bondPrice, ncdf, bs, isNum } from '../lib/math';
import { hbars } from '../ui/visuals.js';

/* ================= INTERNATIONAL & DEALS ================= */
register({
  id: 'fx', group: 'International', title: 'FX, Parity & Forwards',
  blurb: 'Forward rates from interest rate parity, expected spot from purchasing power parity, and a covered-interest arbitrage check.',
  fields: [
    { id: 'S', label: 'Spot rate (home currency per 1 foreign)', v: 1.08, step: 0.005 },
    { id: 'id', label: 'Home interest rate (annual)', v: 5, step: 0.1, unit: '%', slider: [0, 15, 0.1] },
    { id: 'if', label: 'Foreign interest rate (annual)', v: 3, step: 0.1, unit: '%', slider: [0, 15, 0.1] },
    { id: 'T', label: 'Time to delivery', v: 1, step: 0.25, unit: 'yrs', slider: [0.25, 5, 0.25] },
    { id: 'pd', label: 'Home inflation (annual)', v: 3, step: 0.1, unit: '%' },
    { id: 'pf', label: 'Foreign inflation (annual)', v: 2, step: 0.1, unit: '%' },
    { id: 'A', label: 'Amount to invest (home currency)', v: 1000000, step: 50000, pre: '$' },
    { id: 'Fm', label: 'Market forward quote (optional)', v: 1.1, step: 0.005, help: 'Enter your dealer\'s forward to test for arbitrage. Use 0 to skip.' }
  ],
  concept: `<h4>The idea</h4>
<p>Exchange rates are tied to interest rates and inflation by no-arbitrage arguments. The currency with the higher interest rate trades at a forward discount, so that investing abroad and hedging earns no more than investing at home.</p>
<div class="formula">Covered interest parity: F = S × (1 + r_home)^T ÷ (1 + r_foreign)^T</div>
<div class="formula">Purchasing power parity: E[S_T] = S × [(1 + π_home) ÷ (1 + π_foreign)]^T</div>
<div class="formula">Quote convention: rates are home currency per 1 unit of foreign currency</div>
<ul><li><b>Forward premium</b> (F above S) means the foreign currency is expected to be dearer, which happens when foreign interest rates are lower than home rates.</li><li>If the market forward differs from the parity forward, a riskless profit exists: borrow in the cheap side, lock in the exchange rate with a forward, and collect the difference.</li><li>PPP is a long-run tendency, not a short-run law. Parity-implied forwards are exact; PPP forecasts are approximate.</li></ul>`,
  calc(v) {
    const id = v.id / 100, ifr = v.if / 100, pd = v.pd / 100, pf = v.pf / 100, T = v.T, S = v.S;
    if (!(S > 0) || !(T > 0)) return { note: 'Spot rate and time must be positive.', cards: [], charts: [], steps: [] };
    const F = S * Math.pow((1 + id) / (1 + ifr), T), prem = Math.pow(F / S, 1 / T) - 1, ppp = S * Math.pow((1 + pd) / (1 + pf), T);
    const homeRet = v.A * Math.pow(1 + id, T), foreignUnits = v.A / S, foreignGrow = foreignUnits * Math.pow(1 + ifr, T);
    const hedged = foreignGrow * F;
    const cards = [
      { key: true, label: 'Parity forward rate', value: nfx(F, 4), sub: `${prem >= 0 ? 'premium' : 'discount'} of ${pct(Math.abs(prem), 2)} a year` },
      { label: 'Expected spot (PPP)', value: nfx(ppp, 4), sub: `${pct(ppp / S - 1, 2)} over ${T} yrs` },
      { label: 'Interest differential', value: pct(id - ifr, 2), sub: 'home − foreign' },
      { label: 'Inflation differential', value: pct(pd - pf, 2), sub: 'home − foreign' },
      { label: 'Hedged foreign investment', value: money(hedged, 0), sub: `vs ${money(homeRet, 0)} at home`, tone: Math.abs(hedged - homeRet) < 1 ? '' : 'warn' }
    ];
    let info = '';
    if (v.Fm > 0) {
      const R2 = foreignUnits * Math.pow(1 + ifr, T) * v.Fm, profit = R2 - homeRet;
      cards.push({ label: 'Arbitrage profit', value: money(profit, 0), sub: profit > 0.5 ? 'invest abroad, sell foreign forward' : profit < -0.5 ? 'borrow abroad, invest at home' : 'no arbitrage', tone: Math.abs(profit) > 0.5 ? 'good' : '' });
      info = Math.abs(profit) > 0.5 ? (profit > 0 ? `Your forward of ${nfx(v.Fm, 4)} is above the parity forward of ${nfx(F, 4)}. Convert at spot, invest abroad, and sell the proceeds forward at ${nfx(v.Fm, 4)}.` : `Your forward of ${nfx(v.Fm, 4)} is below the parity forward of ${nfx(F, 4)}. Borrow abroad, convert to home currency, invest at home, and buy foreign currency forward to repay.`) : 'The quoted forward matches parity, so there is no arbitrage.';
    }
    const Tm = Math.max(3, T), tg = range(0, Tm, Tm / 40), fg = range(S * 0.9, S * 1.1, S * 0.2 / 40);
    return {
      cards, info,
      charts: [
        { title: 'Forward rate and PPP over time', sub: 'The forward is pinned down by interest rates. The PPP path follows inflation differences.', series: [{ name: 'Forward (interest parity)', type: 'line', color: 'c1', pts: tg.map(t => [t, S * Math.pow((1 + id) / (1 + ifr), t)]) }, { name: 'Expected spot (PPP)', type: 'line', color: 'c2', dash: true, pts: tg.map(t => [t, S * Math.pow((1 + pd) / (1 + pf), t)]) }], hlines: [{ y: S, label: 'spot today' }], xlab: 'Years ahead', xFmt: x => nf(x, 1), yFmt: x => nf(x, 3), yRead: x => nfx(x, 4) },
        { title: 'The arbitrage test', sub: 'Return over the period from investing at home versus investing abroad and hedging at each possible forward quote. They are equal at the parity forward.', series: [{ name: 'Invest at home', type: 'line', color: 'c3', pts: fg.map(f => [f, (Math.pow(1 + id, T) - 1) * 100]) }, { name: 'Invest abroad, hedged', type: 'line', color: 'c1', pts: fg.map(f => [f, (Math.pow(1 + ifr, T) * f / S - 1) * 100]) }], vlines: [{ x: F, label: `parity ${nfx(F, 4)}`, color: 'c4' }], xlab: 'Forward rate quoted', xFmt: x => nf(x, 3), yFmt: x => nf(x, 1) + '%', yRead: x => nf(x, 2) + '%' }
      ],
      steps: [
        ['Parity forward', `F = S × [(1 + r_home) ÷ (1 + r_foreign)]^T = ${nfx(S, 4)} × [${nfx(1 + id, 4)} ÷ ${nfx(1 + ifr, 4)}]^${nf(T, 2)} = ${nfx(F, 4)}`],
        ['Annualized forward premium', `(F ÷ S)^(1/T) − 1 = ${pct(prem, 3)}`],
        ['Expected spot (PPP)', `S × [(1 + π_home) ÷ (1 + π_foreign)]^T = ${nfx(S, 4)} × [${nfx(1 + pd, 4)} ÷ ${nfx(1 + pf, 4)}]^${nf(T, 2)} = ${nfx(ppp, 4)}`],
        ['Invest at home', `${money(v.A, 0)} × (1 + ${pct(id, 2)})^${nf(T, 2)} = ${money(homeRet, 0)}`],
        ['Invest abroad and hedge', `Convert: ${money(v.A, 0)} ÷ ${nfx(S, 4)} = ${nf(foreignUnits, 0)} foreign units\nGrow at ${pct(ifr, 2)}: ${nf(foreignGrow, 0)} units\nSell forward at ${nfx(v.Fm > 0 ? v.Fm : F, 4)}: ${money(foreignGrow * (v.Fm > 0 ? v.Fm : F), 0)}`]
      ]
    };
  }
});

register({
  id: 'merger', group: 'Corporate Finance', title: 'M&A Accretion / Dilution',
  blurb: 'Does an acquisition raise or lower the buyer\'s EPS? Mix cash and stock, add synergies and find the break-even.',
  fields: [
    { id: 'aNI', label: 'Acquirer net income ($M)', v: 500, step: 25 },
    { id: 'aSh', label: 'Acquirer shares (M)', v: 100, step: 5 },
    { id: 'aPx', label: 'Acquirer share price', v: 60, step: 1, pre: '$' },
    { id: 'tNI', label: 'Target net income ($M)', v: 100, step: 5 },
    { id: 'tSh', label: 'Target shares (M)', v: 40, step: 5 },
    { id: 'tPx', label: 'Target share price (unaffected)', v: 30, step: 1, pre: '$' },
    { id: 'prem', label: 'Offer premium', v: 30, step: 1, unit: '%', slider: [0, 80, 1] },
    { id: 'stock', label: 'Paid in stock', v: 50, step: 5, unit: '%', slider: [0, 100, 5] },
    { id: 'rate', label: 'Interest rate on new debt', v: 6, step: 0.25, unit: '%' },
    { id: 'tax', label: 'Tax rate', v: 25, step: 1, unit: '%' },
    { id: 'syn', label: 'Annual pre-tax synergies ($M)', v: 20, step: 5, slider: [0, 150, 5] }
  ],
  concept: `<h4>The idea</h4>
<p>A deal is accretive if the buyer's earnings per share go up after the combination, dilutive if they go down. The answer depends on how the deal is paid for and how the target's earnings compare with what the buyer gives up.</p>
<div class="formula">Pro forma EPS = (NI_acquirer + NI_target + synergies × (1 − t) − new debt interest × (1 − t)) ÷ (shares_acquirer + new shares)</div>
<div class="formula">New shares = stock consideration ÷ acquirer share price          New debt = cash consideration</div>
<ul><li><b>Rule of thumb:</b> a stock deal is accretive when the acquirer's P/E is higher than the P/E it pays for the target. Cash and debt deals are accretive when the target's earnings yield beats the after-tax cost of debt.</li><li>Synergies are the usual reason a deal works on paper. The break-even synergy is how much you must believe in.</li><li>EPS accretion is not value creation. A deal can raise EPS and still destroy value if the price is too high.</li></ul>`,
  calc(v) {
    const t = v.tax / 100, rate = v.rate / 100, st = v.stock / 100, offer = v.tPx * (1 + v.prem / 100), price = offer * v.tSh;
    const eps0 = v.aNI / v.aSh;
    const pf = (stk, prem, syn) => {
      const pr = v.tPx * (1 + prem) * v.tSh, newSh = pr * stk / v.aPx, intAT = pr * (1 - stk) * rate * (1 - t);
      const ni = v.aNI + v.tNI + syn * (1 - t) - intAT, sh = v.aSh + newSh;
      return { pr, newSh, intAT, ni, sh, eps: ni / sh };
    };
    const d = pf(st, v.prem / 100, v.syn), acc = d.eps / eps0 - 1;
    const be = (eps0 * d.sh - v.aNI - v.tNI + d.intAT) / (1 - t);
    const aPE = v.aPx / eps0, tPE = offer / (v.tNI / v.tSh);
    const ss = range(0, 1, 0.05), ps = range(0, 0.8, 0.02);
    return {
      cards: [
        { key: true, label: acc >= 0 ? 'EPS accretion' : 'EPS dilution', value: (acc >= 0 ? '+' : '') + pct(acc, 2), sub: `${money(eps0)} → ${money(d.eps)}`, tone: acc >= 0 ? 'good' : 'bad' },
        { label: 'Purchase price', value: money(price, 0) + 'M', sub: `${money(offer)} a share` },
        { label: 'New shares issued', value: nf(d.newSh, 2) + 'M', sub: `${pct(d.newSh / v.aSh, 1)} of current shares` },
        { label: 'New debt raised', value: money(price * (1 - st), 0) + 'M', sub: `after-tax interest ${money(d.intAT, 1)}M` },
        { label: 'Break-even synergies', value: money(be, 1) + 'M', sub: be <= 0 ? 'deal is accretive even with none' : 'pre-tax, to leave EPS unchanged' },
        { label: 'P/E: acquirer vs price paid', value: `${nf(aPE, 1)}× vs ${nf(tPE, 1)}×`, sub: aPE > tPE ? 'favours paying in stock' : 'favours paying in cash' }
      ],
      charts: [
        { title: 'Accretion by payment mix', sub: 'Percent change in EPS as more of the price is paid in stock instead of debt.', series: [{ name: 'EPS accretion', type: 'line', color: 'c1', pts: ss.map(x => [x * 100, (pf(x, v.prem / 100, v.syn).eps / eps0 - 1) * 100]) }], vlines: [{ x: v.stock, label: 'your mix', color: 'c4' }], hlines: [{ y: 0 }], xlab: 'Share of price paid in stock', xFmt: x => nf(x, 0) + '%', yFmt: x => nf(x, 1) + '%', yRead: x => nf(x, 2) + '%' },
        { title: 'Accretion by offer premium', sub: 'A higher premium hands more of the value to target shareholders and eats into accretion.', series: [{ name: 'EPS accretion', type: 'line', color: 'c1', pts: ps.map(x => [x * 100, (pf(st, x, v.syn).eps / eps0 - 1) * 100]) }], vlines: [{ x: v.prem, label: 'your offer', color: 'c4' }], hlines: [{ y: 0 }], xlab: 'Premium to target price', xFmt: x => nf(x, 0) + '%', yFmt: x => nf(x, 1) + '%', yRead: x => nf(x, 2) + '%' }
      ],
      steps: [
        ['Price paid', `Offer = ${money(v.tPx)} × (1 + ${nf(v.prem, 0)}%) = ${money(offer)}\nPurchase price = ${money(offer)} × ${nf(v.tSh, 1)}M shares = ${money(price, 1)}M`],
        ['Funding', `Stock: ${nf(v.stock, 0)}% × ${money(price, 1)}M = ${money(price * st, 1)}M → ${nf(d.newSh, 3)}M new shares at ${money(v.aPx)}\nDebt: ${money(price * (1 - st), 1)}M × ${pct(rate, 2)} × (1 − ${pct(t, 0)}) = ${money(d.intAT, 2)}M after-tax interest`],
        ['Pro forma earnings', `${nf(v.aNI, 1)} + ${nf(v.tNI, 1)} + ${nf(v.syn, 1)} × (1 − ${pct(t, 0)}) − ${nf(d.intAT, 2)} = ${money(d.ni, 2)}M`],
        ['Pro forma shares', `${nf(v.aSh, 1)}M + ${nf(d.newSh, 3)}M = ${nf(d.sh, 3)}M`],
        ['EPS before and after', `Standalone: ${money(v.aNI, 0)}M ÷ ${nf(v.aSh, 1)}M = ${money(eps0)}\nPro forma: ${money(d.ni, 2)}M ÷ ${nf(d.sh, 3)}M = ${money(d.eps)}   →   ${pct(acc, 2)}`],
        ['Break-even synergies', `S* = (EPS₀ × pro forma shares − NI_acq − NI_target + interest) ÷ (1 − t) = ${money(be, 2)}M pre-tax`]
      ]
    };
  }
});
