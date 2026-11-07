// @ts-nocheck
/* Batch 1: multi-asset portfolios, option strategies and the binomial tree. The maths lives in src/lib/invest.ts. */
import { register } from '../lib/registry';
import { nf, nfx, money, pct, parseList, range, isNum, bs } from '../lib/math';
import { STRATEGIES, binomial, covFrom, frontier, minVariance, parseCorr, portStats, priceLegs, profitAt, randomMixes, readStrategy, tangency } from '../lib/invest';

const NAMES = 'ABCDEF';

/* ================= Portfolio with several assets ================= */
register({
  id: 'frontier', group: 'Investments', title: 'Multi-Asset Portfolio & Efficient Frontier',
  blurb: 'Three to six assets: the efficient frontier, the minimum-variance mix, the tangency portfolio and the capital market line.',
  fields: [
    { id: 'mu', label: 'Expected returns (%)', type: 'text', v: '12, 9, 7, 4', help: 'One number per asset, separated by commas.' },
    { id: 'sd', label: 'Risk, standard deviations (%)', type: 'text', v: '24, 18, 12, 5', help: 'One per asset, in the same order.' },
    { id: 'corr', label: 'Correlations (rows split by ;)', type: 'text', v: '1, 0.5, 0.3, 0.1; 0.5, 1, 0.4, 0.1; 0.3, 0.4, 1, 0.2; 0.1, 0.1, 0.2, 1', help: 'A square table, for example 1, 0.3; 0.3, 1 for two assets.' },
    { id: 'w', label: 'Your weights (%)', type: 'text', v: '25, 25, 25, 25', help: 'How your money is split. They are scaled to add to 100%.' },
    { id: 'rf', label: 'Risk-free rate', v: 3, step: 0.25, unit: '%' }
  ],
  concept: `<h4>The idea</h4>
<p>With many assets there is a whole cloud of possible portfolios. For each level of risk, one mix earns the most: together those mixes form the <b>efficient frontier</b>. The best portfolio of risky assets is the one where a line from the risk-free rate just touches the frontier, the <b>tangency portfolio</b>.</p>
<div class="formula">E[R_p] = Σ wᵢμᵢ     σ_p² = wᵀΣw</div>
<div class="formula">Minimum variance: w = Σ⁻¹1 ÷ (1ᵀΣ⁻¹1)</div>
<div class="formula">Tangency: w ∝ Σ⁻¹(μ − r_f)</div>
<ul><li>Adding an asset never makes the frontier worse, and it usually moves it up and to the left.</li><li>The dots show random mixes with no short selling. The curve allows short selling, so it can sit above the cloud.</li><li>Everyone should hold the same risky mix. Only the split between that mix and cash changes with risk appetite.</li></ul>`,
  calc(v) {
    const mu = parseList(v.mu).map(x => x / 100), sd = parseList(v.sd).map(x => x / 100), rf = v.rf / 100, n = Math.min(mu.length, sd.length, 6);
    if (n < 2) return { note: 'Enter at least two assets: a return and a risk for each, separated by commas.', cards: [], charts: [], steps: [] };
    if (sd.slice(0, n).some(x => !(x > 0))) return { note: 'Every asset needs a risk above zero.', cards: [], charts: [], steps: [] };
    const m = mu.slice(0, n), s = sd.slice(0, n), cor = parseCorr(v.corr, n), cov = covFrom(s, cor);
    let wRaw = parseList(v.w).slice(0, n); while (wRaw.length < n) wRaw.push(0);
    const tot = wRaw.reduce((a, b) => a + b, 0), w = tot ? wRaw.map(x => x / tot) : m.map(() => 1 / n);
    const you = portStats(w, m, cov), mvw = minVariance(cov), mv = mvw && portStats(mvw, m, cov), tgw = tangency(m, rf, cov), tg = tgw && portStats(tgw, m, cov);
    if (!mvw) return { note: 'These correlations cannot all be true at once (the table is not consistent). Try smaller correlations.', cards: [], charts: [], steps: [] };
    const sharpe = x => (x.mu - rf) / x.sd, nm = i => NAMES[i], fmtW = ws => ws.map((x, i) => `${nm(i)} ${nf(x * 100, 0)}%`).join(' · ');
    const top = Math.max(...m, mv.mu), hi = top + Math.max(0.01, Math.abs(top) * 0.25);
    const front = frontier(m, cov, mv.mu, hi, 70).map(([a, b]) => [a * 100, b * 100]);
    const cloud = randomMixes(n, 260, 11).map(x => { const p = portStats(x, m, cov); return [p.sd * 100, p.mu * 100]; });
    const series = [
      { name: 'Random mixes (no short selling)', type: 'dots', color: 'c1', noRead: true, pts: cloud },
      { name: 'Efficient frontier', type: 'line', color: 'c2', pts: front }
    ];
    if (tg && sharpe(tg) > 0 && tg.sd > 0) series.push({ name: 'Capital market line', type: 'line', color: 'c3', dash: true, noRead: true, pts: [[0, rf * 100], [tg.sd * 165, (rf + sharpe(tg) * tg.sd * 1.65) * 100]] });
    const marks = s.map((x, i) => [x * 100, m[i] * 100, nm(i)]); marks.push([you.sd * 100, you.mu * 100, 'You'], [mv.sd * 100, mv.mu * 100, 'Min var']);
    if (tg && tg.sd > 0) marks.push([tg.sd * 100, tg.mu * 100, 'Best']);
    series.push({ name: 'Marked', type: 'dots', color: 'c4', noRead: true, pts: marks });
    const short = ws => (ws && ws.some(x => x < -1e-9) ? 'needs short selling' : 'no short selling');
    const rows = m.map((x, i) => [nm(i), pct(x, 1), pct(s[i], 1), pct(w[i], 1), pct(mvw[i], 1), tgw ? pct(tgw[i], 1) : 'n/a']);
    return {
      cards: [
        { key: true, label: 'Your portfolio return', value: pct(you.mu, 2), sub: fmtW(w) },
        { label: 'Your portfolio risk (σ)', value: pct(you.sd, 2), sub: `weighted average of risks would be ${pct(w.reduce((a, x, i) => a + x * s[i], 0), 2)}` },
        { label: 'Your Sharpe ratio', value: nf(sharpe(you), 3), sub: `vs risk-free ${pct(rf, 1)}` },
        { label: 'Minimum-variance mix', value: pct(mv.sd, 2) + ' risk', sub: `${fmtW(mvw)} · ${short(mvw)}` },
        { label: 'Tangency (best Sharpe) mix', value: tg ? nf(sharpe(tg), 3) + ' Sharpe' : 'n/a', sub: tg ? `${fmtW(tgw)} · ${short(tgw)}` : 'no mix beats the risk-free rate' },
        { label: 'Diversification benefit', value: pct(w.reduce((a, x, i) => a + x * s[i], 0) - you.sd, 2), sub: 'risk removed by mixing', tone: 'good' }
      ],
      info: !tg ? 'The risk-free rate is above the return of the minimum-variance mix, so no mix of these assets beats cash and there is no tangency portfolio.' : '',
      charts: [{
        title: 'Every mix you could hold', sub: 'Dots are random mixes with no short selling. The curve is the efficient frontier. The dashed line is the best you can do with the risk-free asset.',
        series, xlab: 'Risk (σ, %)', xFmt: x => nf(x, 0) + '%', yFmt: x => nf(x, 0) + '%', yRead: x => nf(x, 2) + '%', nearest: 'xy'
      }],
      tables: [{ title: 'Assets and weights', cols: ['Asset', 'Return', 'Risk', 'Your weight', 'Min variance', 'Tangency'], rows }],
      steps: [
        ['Portfolio return', `E[R_p] = ${w.map((x, i) => `${nf(x, 2)}×${pct(m[i], 1)}`).join(' + ')} = ${pct(you.mu, 3)}`],
        ['Portfolio risk', `σ_p = √(wᵀΣw) = ${pct(you.sd, 3)}, using the ${n}×${n} covariance matrix built from the risks and correlations.`],
        ['Minimum variance', `w = Σ⁻¹1 ÷ 1ᵀΣ⁻¹1 gives ${fmtW(mvw)} with risk ${pct(mv.sd, 3)}.`],
        ['Tangency', tg ? `w ∝ Σ⁻¹(μ − r_f) gives ${fmtW(tgw)} with Sharpe ratio ${nf(sharpe(tg), 3)}.` : 'No portfolio of these assets earns more than the risk-free rate.']
      ]
    };
  }
});

/* ================= Option strategies ================= */
register({
  id: 'strategies', group: 'Derivatives', title: 'Option Strategies',
  blurb: 'Ten standard option strategies: profit and loss at expiry, break-evens, maximum gain and loss, priced with Black-Scholes.',
  fields: [
    { id: 'strat', label: 'Strategy', type: 'select', v: 'straddle', options: STRATEGIES.map(s => [s.id, s.name]) },
    { id: 'S', label: 'Stock price today', v: 100, step: 1, pre: '$' },
    { id: 'K', label: 'Centre strike price', v: 100, step: 1, pre: '$' },
    { id: 'wd', label: 'Gap between strikes', v: 10, step: 1, pre: '$' },
    { id: 'T', label: 'Time to expiry', v: 0.5, step: 0.05, unit: 'yrs', slider: [0.05, 2, 0.05] },
    { id: 'vol', label: 'Volatility', v: 25, step: 1, unit: '%', slider: [5, 80, 1] },
    { id: 'r', label: 'Risk-free rate', v: 4, step: 0.25, unit: '%' },
    { id: 'q', label: 'Dividend yield', v: 0, step: 0.25, unit: '%' }
  ],
  concept: `<h4>The idea</h4>
<p>Calls, puts and the stock itself can be combined into positions with very different shapes. Each strategy is a bet on where the price goes, how far, or how much it will move. The chart shows profit at expiry for every possible final price.</p>
<div class="formula">Profit = Σ qty × (payoff at expiry − premium paid)</div>
<ul><li><b>Net debit</b> means you pay to enter. <b>Net credit</b> means you are paid.</li><li>Spreads cap both gain and loss to make the bet cheaper.</li><li>Straddles and strangles win from big moves; butterflies win from calm.</li><li>Premiums come from Black-Scholes with the volatility you enter.</li></ul>`,
  calc(v) {
    const st = STRATEGIES.find(x => x.id === v.strat) || STRATEGIES[0], S = v.S, K = v.K, w = Math.max(0.01, v.wd);
    if (!(S > 0) || !(K > 0) || !(v.T > 0) || !(v.vol > 0)) return { note: 'Stock price, strike, time and volatility must all be above zero.', cards: [], charts: [], steps: [] };
    const r = v.r / 100, q = v.q / 100, sg = v.vol / 100, legs = st.legs(K, w);
    if (legs.some(l => l.K != null && l.K <= 0)) return { note: 'The gap between strikes is too large for this strike. Lower it so every strike stays above zero.', cards: [], charts: [], steps: [] };
    const priced = priceLegs(legs, S, v.T, r, q, sg), rd = readStrategy(priced, S);
    const lo = Math.max(0, Math.min(S, K - 2 * w) * 0.6), hi = Math.max(S, K + 2 * w) * 1.4, grid = range(lo, hi, (hi - lo) / 80);
    const today = x => priced.reduce((s2, { leg, premium }) => { const val = leg.kind === 'stock' ? x : (leg.kind === 'call' ? bs(x, leg.K, v.T, r, q, sg).c : bs(x, leg.K, v.T, r, q, sg).p); return s2 + leg.qty * (val - premium); }, 0);
    const legName = l => `${l.qty > 0 ? 'Buy' : 'Sell'} ${Math.abs(l.qty) > 1 ? Math.abs(l.qty) + ' ' : ''}${l.kind === 'stock' ? 'the stock' : `${l.kind} at ${money(l.K, 2)}`}`;
    const fmtMax = (x, inf) => (inf ? 'Unlimited' : money(x, 2));
    const unit = rd.cost >= 0 ? 'Net cost (debit)' : 'Net credit received';
    return {
      cards: [
        { key: true, label: unit, value: money(Math.abs(rd.cost), 2), sub: 'per share, today' },
        { label: 'Maximum profit', value: fmtMax(rd.maxProfit, rd.unlimitedProfit), sub: 'at expiry', tone: 'good' },
        { label: 'Maximum loss', value: rd.unlimitedLoss ? 'Unlimited' : money(Math.abs(rd.maxLoss), 2), sub: 'at expiry', tone: 'bad' },
        { label: 'Break-even price' + (rd.breakevens.length > 1 ? 's' : ''), value: rd.breakevens.length ? rd.breakevens.map(b => money(b, 2)).join(' and ') : 'none', sub: 'where profit at expiry is zero' },
        { label: 'Profit if price is unchanged', value: money(profitAt(priced, S), 2), sub: `stock stays at ${money(S, 2)}` }
      ],
      info: st.plain,
      charts: [{
        title: `${st.name}: profit and loss`, sub: 'Profit at expiry (amber) and value today (teal) for each possible stock price.',
        series: [{ name: 'At expiry', type: 'line', color: 'c2', pts: grid.map(x => [x, profitAt(priced, x)]) }, { name: 'Today', type: 'line', color: 'c1', pts: grid.map(x => [x, today(x)]) }],
        vlines: [{ x: S, label: 'stock today', color: 'c4' }], hlines: [{ y: 0 }], xlab: 'Stock price at expiry', xFmt: x => '$' + nf(x, 0), yFmt: x => '$' + nf(x, 0), yRead: money, xRead: x => money(x, 2)
      }],
      tables: [{ title: 'The legs of this strategy', cols: ['Leg', 'Premium each', 'Quantity', 'Cash today'], rows: priced.map(p => [legName(p.leg), money(p.premium, 3), nf(p.leg.qty, 0), money(-p.leg.qty * p.premium, 2)]) }],
      steps: [
        ['Strategy', `${st.name}: ${legs.map(legName).join(', ')}.`],
        ['Premiums', priced.filter(p => p.leg.kind !== 'stock').map(p => `${p.leg.kind} at ${money(p.leg.K, 2)} costs ${money(p.premium, 3)} (Black-Scholes)`).join('\n') || 'Only the stock is held, so there are no premiums.'],
        ['Net cost', `${priced.map(p => `${p.leg.qty > 0 ? '+' : '−'}${money(p.premium, 2)}`).join(' ')} = ${money(rd.cost, 2)}`],
        ['Reading the chart', `The amber line is the profit at expiry: ${rd.unlimitedProfit ? 'it keeps rising, so profit is unlimited' : 'gain is capped at ' + money(rd.maxProfit, 2)}; ${rd.unlimitedLoss ? 'loss is unlimited' : 'loss is capped at ' + money(Math.abs(rd.maxLoss), 2)}.`]
      ]
    };
  }
});

/* ================= Binomial tree ================= */
register({
  id: 'binomial', group: 'Derivatives', title: 'Binomial Option Pricing',
  blurb: 'Price European and American options on a step-by-step tree, and compare with Black-Scholes.',
  fields: [
    { id: 'S', label: 'Stock price today', v: 100, step: 1, pre: '$' },
    { id: 'K', label: 'Strike price', v: 105, step: 1, pre: '$' },
    { id: 'T', label: 'Time to expiry', v: 1, step: 0.25, unit: 'yrs', slider: [0.1, 3, 0.05] },
    { id: 'vol', label: 'Volatility', v: 30, step: 1, unit: '%', slider: [5, 80, 1] },
    { id: 'r', label: 'Risk-free rate', v: 5, step: 0.25, unit: '%' },
    { id: 'q', label: 'Dividend yield', v: 0, step: 0.25, unit: '%' },
    { id: 'n', label: 'Steps in the tree', v: 4, step: 1, min: 1, max: 12, slider: [1, 12, 1] },
    { id: 'kind', label: 'Option', type: 'select', v: 'put', options: [['call', 'Call'], ['put', 'Put']] },
    { id: 'style', label: 'Style', type: 'select', v: 'american', options: [['american', 'American (exercise any time)'], ['european', 'European (only at expiry)']] }
  ],
  concept: `<h4>The idea</h4>
<p>Split the time to expiry into steps. At each step the stock either moves up by a factor u or down by a factor d. Work backwards from the final prices, discounting the expected value under the risk-neutral probability, and you reach today's price. With many steps this matches Black-Scholes.</p>
<div class="formula">u = e^(σ√Δt)     d = 1/u     p = (e^((r−q)Δt) − d) ÷ (u − d)</div>
<div class="formula">Value = e^(−rΔt) × [p × value_up + (1−p) × value_down]</div>
<ul><li>An American option can be exercised early, so at each node you take the larger of holding and exercising.</li><li>American puts are often worth more than European puts. American calls on non-dividend stocks are not.</li><li>Shaded nodes in the table mark where early exercise is best.</li></ul>`,
  calc(v) {
    if (!(v.S > 0) || !(v.K > 0) || !(v.T > 0) || !(v.vol > 0)) return { note: 'Stock price, strike, time and volatility must all be above zero.', cards: [], charts: [], steps: [] };
    const n = Math.max(1, Math.min(12, Math.round(v.n))), r = v.r / 100, q = v.q / 100, sg = v.vol / 100, call = v.kind === 'call', am = v.style === 'american';
    const t = binomial(v.S, v.K, v.T, r, q, sg, n, call, am), eu = binomial(v.S, v.K, v.T, r, q, sg, n, call, false), ref = bs(v.S, v.K, v.T, r, q, sg), bsp = call ? ref.c : ref.p;
    if (!(t.p > 0 && t.p < 1)) return { note: 'With these inputs the risk-neutral probability falls outside 0 to 1. Add steps or lower the rate or volatility.', cards: [], charts: [], steps: [] };
    const big = binomial(v.S, v.K, v.T, r, q, sg, 200, call, am).price, steps = range(2, 60, 2);
    const conv = steps.map(k => [k, binomial(v.S, v.K, v.T, r, q, sg, k, call, am).price]);
    const rows = [];
    for (let i = 0; i <= n; i++) rows.push([`Step ${i}`, ...Array.from({ length: n + 1 }, (_, j) => (j <= i ? [`${money(t.stock[i][j], 2)} → ${money(t.value[i][j], 2)}`, t.exercise[i][j] ? 'background:color-mix(in srgb,var(--c3) 22%,transparent)' : ''] : ''))]);
    const early = t.exercise.flat().filter(Boolean).length;
    return {
      cards: [
        { key: true, label: `${am ? 'American' : 'European'} ${call ? 'call' : 'put'} price (tree)`, value: money(t.price, 4), sub: `${n} step${n > 1 ? 's' : ''}` },
        { label: 'Black-Scholes (European)', value: money(bsp, 4), sub: 'the limit of the tree with many steps' },
        { label: 'Value of exercising early', value: am ? money(t.price - eu.price, 4) : '$0.0000', sub: am ? `American minus European on the same tree` : 'European options cannot be exercised early', tone: am && t.price - eu.price > 1e-9 ? 'good' : '' },
        { label: 'Up factor, down factor', value: `${nfx(t.u, 4)} / ${nfx(t.d, 4)}`, sub: `risk-neutral chance of up: ${pct(t.p, 1)}` },
        { label: `With 200 steps`, value: money(big, 4), sub: 'a finer tree for comparison' },
        { label: 'Nodes where exercising early wins', value: String(early), sub: am ? 'shaded in the tree table' : 'none for a European option' }
      ],
      info: am && !call && eu.price === t.price ? 'Early exercise does not pay here, so the American put equals the European put.' : '',
      charts: [{
        title: 'More steps, closer to Black-Scholes', sub: 'Tree price as the number of steps grows (even steps only). The dashed line is the Black-Scholes price for a European option.',
        series: [{ name: 'Tree price', type: 'line', color: 'c1', pts: conv }], hlines: am ? [] : [{ y: bsp, label: 'Black-Scholes', color: 'c2' }], xlab: 'Steps in the tree', xFmt: x => nf(x, 0), yFmt: x => '$' + nf(x, 2), yRead: x => money(x, 4)
      }],
      tables: [{ title: 'The tree: stock price → option value', cols: ['', ...Array.from({ length: n + 1 }, (_, j) => (j === 0 ? 'Top path' : j === n ? 'Bottom path' : `Down ${j}`))], rows, collapsed: n > 6 }],
      steps: [
        ['Step size', `Δt = ${nf(v.T, 3)} ÷ ${n} = ${nfx(v.T / n, 4)} years`],
        ['Up and down factors', `u = e^(${pct(sg, 1)}×√${nfx(v.T / n, 4)}) = ${nfx(t.u, 5)}     d = 1/u = ${nfx(t.d, 5)}`],
        ['Risk-neutral probability', `p = (e^((${pct(r, 2)}−${pct(q, 2)})×${nfx(v.T / n, 4)}) − ${nfx(t.d, 4)}) ÷ (${nfx(t.u, 4)} − ${nfx(t.d, 4)}) = ${nfx(t.p, 4)}`],
        ['Work backwards', `At each node: value = e^(−rΔt) × [p × up + (1−p) × down]${am ? ', then take the larger of that and the payoff from exercising now' : ''}. Starting from the payoffs at expiry this reaches ${money(t.price, 4)} today.`]
      ]
    };
  }
});
void isNum;
