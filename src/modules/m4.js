// @ts-nocheck
import { register } from '../lib/registry';
import { nf, nfx, money, pct, mult, yrs, compact, parseList, sum, range, npv, irr, findRoot, annF, fvF, bondPrice, ncdf, bs, isNum } from '../lib/math';
import { hbars } from '../ui/visuals.js';

/* ================= INVESTMENTS ================= */
register({
  id: 'capm', group: 'Investments', title: 'CAPM & Performance',
  blurb: 'Required return on the security market line, Jensen\'s alpha, Sharpe, Treynor and how much of the risk is diversifiable.',
  fields: [
    { id: 'rf', label: 'Risk-free rate', v: 4, step: 0.1, unit: '%' },
    { id: 'rm', label: 'Expected market return', v: 9.5, step: 0.1, unit: '%' },
    { id: 'sm', label: 'Market standard deviation', v: 16, step: 0.5, unit: '%' },
    { id: 'beta', label: 'Asset beta', v: 1.2, step: 0.05, slider: [0, 2.5, 0.05] },
    { id: 'er', label: 'Asset expected return', v: 12, step: 0.1, unit: '%' },
    { id: 'sd', label: 'Asset standard deviation', v: 22, step: 0.5, unit: '%' }
  ],
  concept: `<h4>The idea</h4>
<p>Investors are paid for risk they cannot diversify away. In CAPM that risk is beta, the asset's sensitivity to the market. Expected return is a straight line in beta, the security market line (SML).</p>
<div class="formula">E[R] = r_f + β · (E[R_m] − r_f)</div>
<div class="formula">Jensen's α = actual (or forecast) return − CAPM return</div>
<div class="formula">Sharpe = (R − r_f) ÷ σ          Treynor = (R − r_f) ÷ β</div>
<div class="formula">Total variance = β²σ_m² (systematic) + idiosyncratic</div>
<ul><li>An asset above the SML (positive alpha) earns more than its risk justifies.</li><li><b>Sharpe</b> judges a whole portfolio, using total risk. <b>Treynor</b> judges an asset inside a diversified portfolio, using beta.</li><li>The idiosyncratic share of variance is what diversification can remove.</li></ul>`,
  calc(v) {
    const rf = v.rf / 100, rm = v.rm / 100, sm = v.sm / 100, b = v.beta, er = v.er / 100, sd = v.sd / 100;
    const req = rf + b * (rm - rf), alpha = er - req, sh = sd ? (er - rf) / sd : NaN, tr = b ? (er - rf) / b : NaN, shm = sm ? (rm - rf) / sm : NaN;
    const m2 = rf + shm * sd, rho = sd ? b * sm / sd : NaN, sys = b * b * sm * sm, tot = sd * sd, r2 = tot ? sys / tot : NaN;
    const bs_ = range(0, 2.5, 0.05);
    return {
      cards: [
        { key: true, label: 'Required return (CAPM)', value: pct(req, 2), sub: `${pct(rf, 1)} + ${nf(b, 2)} × ${pct(rm - rf, 1)}` },
        { label: 'Jensen\'s alpha', value: (alpha >= 0 ? '+' : '') + pct(alpha, 2), sub: alpha >= 0 ? 'above the SML: undervalued' : 'below the SML: overvalued', tone: alpha >= 0 ? 'good' : 'bad' },
        { label: 'Sharpe ratio', value: nf(sh, 3), sub: `market ${nf(shm, 3)}` },
        { label: 'Treynor ratio', value: pct(tr, 2), sub: `market ${pct(rm - rf, 2)}` },
        { label: 'M² (Modigliani)', value: pct(m2, 2), sub: `return at market risk ${pct(sm, 0)}` },
        { label: 'Implied correlation', value: nf(rho, 3), sub: rho > 1 ? 'above 1: inputs are inconsistent' : 'β · σ_m ÷ σ', tone: rho > 1 ? 'bad' : '' },
        { label: 'Risk you can diversify', value: pct(1 - r2, 1), sub: `R² with the market = ${pct(r2, 1)}` }
      ],
      charts: [
        { title: 'Security market line', sub: 'Required return rises one-for-one with beta. Your asset is the dot; above the line means a positive alpha.', series: [{ name: 'Required return', type: 'line', color: 'c1', pts: bs_.map(x => [x, (rf + x * (rm - rf)) * 100]) }, { name: 'Your asset', type: 'dots', color: 'c4', noRead: true, pts: [[b, er * 100, 'Asset']] }, { name: 'Market', type: 'dots', color: 'c2', noRead: true, pts: [[1, rm * 100, 'Market']] }, { name: 'Risk-free', type: 'dots', color: 'c3', noRead: true, pts: [[0, rf * 100, 'Risk-free']] }], xlab: 'Beta', xFmt: x => nf(x, 1), yFmt: x => nf(x, 0) + '%', yRead: x => nf(x, 2) + '%' },
        { type: 'donut', title: 'Where the risk comes from', sub: 'Share of the asset\'s variance explained by the market (cannot be diversified) versus its own events.', parts: [{ name: 'Market (systematic)', value: Math.min(1, r2) || 0, color: 'c3', note: pct(r2, 1) }, { name: 'Own events (diversifiable)', value: Math.max(0, 1 - r2) || 0, color: 'c2', note: pct(1 - r2, 1) }], center: { big: pct(Math.sqrt(tot), 1), small: 'total σ' } }
      ],
      steps: [
        ['CAPM required return', `r_f + β(R_m − r_f) = ${pct(rf, 2)} + ${nf(b, 3)} × (${pct(rm, 2)} − ${pct(rf, 2)}) = ${pct(req, 3)}`],
        ['Alpha', `α = ${pct(er, 2)} − ${pct(req, 3)} = ${pct(alpha, 3)}`],
        ['Sharpe', `(${pct(er, 2)} − ${pct(rf, 2)}) ÷ ${pct(sd, 2)} = ${nf(sh, 4)}`],
        ['Treynor', `(${pct(er, 2)} − ${pct(rf, 2)}) ÷ ${nf(b, 3)} = ${pct(tr, 3)}`],
        ['Variance split', `Systematic = β²σ_m² = ${nfx(sys, 5)}     Total = σ² = ${nfx(tot, 5)}     R² = ${pct(r2, 2)}`]
      ]
    };
  }
});

register({
  id: 'portfolio', group: 'Investments', title: 'Portfolio Theory',
  blurb: 'Two-asset portfolios: risk, return, the minimum-variance mix, the tangency portfolio and the power of correlation.',
  fields: [
    { id: 'muA', label: 'Asset A · expected return', v: 12, step: 0.5, unit: '%' },
    { id: 'sdA', label: 'Asset A · standard deviation', v: 20, step: 0.5, unit: '%' },
    { id: 'muB', label: 'Asset B · expected return', v: 6, step: 0.5, unit: '%' },
    { id: 'sdB', label: 'Asset B · standard deviation', v: 10, step: 0.5, unit: '%' },
    { id: 'rho', label: 'Correlation between A and B', v: 0.2, step: 0.05, min: -1, max: 1, slider: [-1, 1, 0.05] },
    { id: 'wA', label: 'Weight in A', v: 60, step: 5, unit: '%', slider: [0, 100, 1] },
    { id: 'rf', label: 'Risk-free rate', v: 3, step: 0.25, unit: '%' }
  ],
  concept: `<h4>The idea</h4>
<p>Combining assets that do not move in lockstep lowers risk without lowering expected return in the same proportion. That free lunch is diversification, and it comes entirely from correlation below +1.</p>
<div class="formula">E[R_p] = w_A·μ_A + w_B·μ_B</div>
<div class="formula">σ_p² = w_A²σ_A² + w_B²σ_B² + 2·w_A·w_B·ρ·σ_A·σ_B</div>
<div class="formula">Minimum variance: w_A = (σ_B² − ρσ_Aσ_B) ÷ (σ_A² + σ_B² − 2ρσ_Aσ_B)</div>
<ul><li>At ρ = +1 risk is just the weighted average. At ρ = −1 you can eliminate risk entirely.</li><li>Only the upper branch of the curve above the minimum-variance point is efficient. The lower branch is dominated.</li><li>With a risk-free asset, the best risky mix is the one with the highest Sharpe ratio (the tangency portfolio). Every investor holds it, scaled with borrowing or lending along the capital allocation line.</li></ul>`,
  calc(v) {
    const mA = v.muA / 100, sA = v.sdA / 100, mB = v.muB / 100, sB = v.sdB / 100, rho = v.rho, rf = v.rf / 100, w = v.wA / 100;
    const port = (x, r = rho) => ({ mu: x * mA + (1 - x) * mB, sd: Math.sqrt(Math.max(0, x * x * sA * sA + (1 - x) * (1 - x) * sB * sB + 2 * x * (1 - x) * r * sA * sB)) });
    const cur = port(w), cov = rho * sA * sB;
    const den = sA * sA + sB * sB - 2 * cov, wmv = den ? (sB * sB - cov) / den : NaN, mv = port(wmv);
    const a = mA - rf, b2 = mB - rf, dt = a * sB * sB + b2 * sA * sA - (a + b2) * cov, wt = dt ? (a * sB * sB - b2 * cov) / dt : NaN, tg = port(wt), shT = (tg.mu - rf) / tg.sd;
    const ws = range(0, 1, 0.02), pts = ws.map(x => { const p = port(x); return [p.sd * 100, p.mu * 100]; });
    const series = [{ name: 'Opportunity set', type: 'line', color: 'c1', pts }];
    if (isNum(shT) && isNum(wt)) series.push({ name: 'Capital allocation line', type: 'line', color: 'c2', dash: true, noRead: true, pts: [[0, rf * 100], [tg.sd * 160, (rf + shT * tg.sd * 1.6) * 100]] });
    const dots = [[sA * 100, mA * 100, 'A'], [sB * 100, mB * 100, 'B'], [cur.sd * 100, cur.mu * 100, 'You']];
    if (isNum(wmv) && wmv >= 0 && wmv <= 1) dots.push([mv.sd * 100, mv.mu * 100, 'Min var']);
    if (isNum(wt) && wt >= 0 && wt <= 1) dots.push([tg.sd * 100, tg.mu * 100, 'Tangency']);
    series.push({ name: 'Marked portfolios', type: 'dots', color: 'c4', noRead: true, pts: dots });
    const wsx = range(0, 100, 2);
    const warn = (x, nm) => (isNum(x) && (x < -1e-9 || x > 1 + 1e-9) ? `${nm} needs shorting (weight ${pct(x, 1)})` : '');
    return {
      cards: [
        { key: true, label: 'Portfolio expected return', value: pct(cur.mu, 2), sub: `${nf(v.wA, 0)}% A / ${nf(100 - v.wA, 0)}% B` },
        { label: 'Portfolio risk (σ)', value: pct(cur.sd, 2), sub: `weighted average would be ${pct(w * sA + (1 - w) * sB, 2)}` },
        { label: 'Diversification benefit', value: pct(w * sA + (1 - w) * sB - cur.sd, 2), sub: 'risk removed by correlation', tone: 'good' },
        { label: 'Sharpe ratio', value: nf((cur.mu - rf) / cur.sd, 3), sub: `vs risk-free ${pct(rf, 1)}` },
        { label: 'Minimum-variance mix', value: isNum(wmv) ? `${nf(wmv * 100, 1)}% A` : 'n/a', sub: isNum(wmv) ? `σ ${pct(mv.sd, 2)} · return ${pct(mv.mu, 2)}` : '' },
        { label: 'Tangency (max Sharpe) mix', value: isNum(wt) ? `${nf(wt * 100, 1)}% A` : 'n/a', sub: isNum(wt) ? `Sharpe ${nf(shT, 3)} · σ ${pct(tg.sd, 2)}` : '' },
        { label: 'Covariance of A and B', value: nfx(cov, 5), sub: `ρ = ${nf(rho, 2)}` }
      ],
      info: [warn(wmv, 'Minimum variance'), warn(wt, 'Tangency')].filter(Boolean).join('. '),
      charts: [
        {
          title: 'Risk and return of every mix', sub: 'Slide your weight with Play to trace the curve. The dashed line is the best you can do when you can also hold the risk-free asset.', series, nearest: 'xy', xlab: 'Risk (σ, %)', xFmt: x => nf(x, 0) + '%', yFmt: x => nf(x, 0) + '%',
          readout: i => { const x = ws[i], p = port(x); return `<span class="rx">${nf(x * 100, 0)}% in A</span><span class="ri">Return <b>${pct(p.mu, 2)}</b></span><span class="ri">Risk <b>${pct(p.sd, 2)}</b></span><span class="ri">Sharpe <b>${nf((p.mu - rf) / p.sd, 3)}</b></span>`; }
        },
        {
          title: 'Correlation is what diversifies', sub: 'Portfolio risk for each mix. The lower the correlation, the deeper the dip.', series: [{ name: 'ρ = +1', type: 'line', color: 'c4', pts: wsx.map(x => [x, port(x / 100, 1).sd * 100]) }, { name: 'ρ = 0', type: 'line', color: 'c2', pts: wsx.map(x => [x, port(x / 100, 0).sd * 100]) }, { name: 'ρ = −1', type: 'line', color: 'c3', pts: wsx.map(x => [x, port(x / 100, -1).sd * 100]) }, { name: `Your ρ = ${nf(rho, 2)}`, type: 'line', color: 'c1', pts: wsx.map(x => [x, port(x / 100).sd * 100]) }],
          xlab: 'Weight in Asset A', xFmt: x => x + '%', yFmt: x => nf(x, 0) + '%', yRead: x => nf(x, 2) + '%'
        }
      ],
      steps: [
        ['Expected return', `E[R_p] = ${nf(w, 2)} × ${pct(mA, 1)} + ${nf(1 - w, 2)} × ${pct(mB, 1)} = ${pct(cur.mu, 3)}`],
        ['Covariance', `Cov = ρ·σ_A·σ_B = ${nf(rho, 2)} × ${nfx(sA, 3)} × ${nfx(sB, 3)} = ${nfx(cov, 5)}`],
        ['Variance', `σ_p² = ${nf(w, 2)}²×${nfx(sA * sA, 4)} + ${nf(1 - w, 2)}²×${nfx(sB * sB, 4)} + 2×${nf(w, 2)}×${nf(1 - w, 2)}×${nfx(cov, 5)} = ${nfx(cur.sd * cur.sd, 6)}`],
        ['Standard deviation', `σ_p = √${nfx(cur.sd * cur.sd, 6)} = ${pct(cur.sd, 3)}`],
        ['Minimum variance weight', isNum(wmv) ? `w_A = (σ_B² − Cov) ÷ (σ_A² + σ_B² − 2Cov) = ${nfx(sB * sB - cov, 5)} ÷ ${nfx(den, 5)} = ${pct(wmv, 2)}` : 'Both assets are identical in risk, so no unique answer.'],
        ['Tangency weight', isNum(wt) ? `w_A = [(μ_A−r_f)σ_B² − (μ_B−r_f)Cov] ÷ [(μ_A−r_f)σ_B² + (μ_B−r_f)σ_A² − (μ_A+μ_B−2r_f)Cov] = ${pct(wt, 2)}` : 'n/a']
      ]
    };
  }
});

register({
  id: 'returns', group: 'Investments', title: 'Return Statistics',
  blurb: 'Paste a return series to get arithmetic and geometric averages, volatility, Sharpe, drawdown and value at risk.',
  fields: [
    { id: 'rets', label: 'Returns per period (%)', type: 'text', v: '12, -5, 8, 15, -2, 9, 4, -8, 20, 6', help: 'Separate with commas. Enter percentages, for example 12 for 12%.' },
    { id: 'start', label: 'Starting investment', v: 10000, step: 1000, pre: '$' },
    { id: 'rf', label: 'Risk-free return per period', v: 1, step: 0.1, unit: '%' },
    { id: 'ppy', label: 'Periods per year', v: 1, step: 1, min: 1 }
  ],
  concept: `<h4>The idea</h4>
<p>The arithmetic mean is the best guess of next period's return. The geometric mean is what you actually earned per period, because returns compound. Volatility makes the geometric mean lower.</p>
<div class="formula">Arithmetic mean = Σ r ÷ n          Geometric mean = [Π(1 + r)]^(1/n) − 1</div>
<div class="formula">Volatility drag ≈ σ² ÷ 2          Sharpe = (mean − r_f) ÷ σ</div>
<div class="formula">Annualize: return × periods per year (arithmetic), σ × √periods</div>
<ul><li>A +50% year followed by −50% averages 0%, but leaves you down 25%. That gap is volatility drag.</li><li><b>Maximum drawdown</b> is the worst peak-to-trough fall, which often matters more to investors than volatility.</li><li><b>Value at risk</b> is a loss level you expect to exceed only 5% of the time.</li></ul>`,
  calc(v) {
    const r = parseList(v.rets).map(x => x / 100), n = r.length;
    if (n < 2) return { note: 'Enter at least two returns, separated by commas.', cards: [], charts: [], steps: [] };
    const rf = v.rf / 100, ppy = Math.max(1, v.ppy), mean = sum(r) / n, geo = Math.pow(r.reduce((p, x) => p * (1 + x), 1), 1 / n) - 1;
    const varr = sum(r.map(x => (x - mean) ** 2)) / (n - 1), sd = Math.sqrt(varr), sh = sd ? (mean - rf) / sd : NaN;
    const skew = n > 2 && sd ? n / ((n - 1) * (n - 2)) * sum(r.map(x => ((x - mean) / sd) ** 3)) : NaN;
    let val = v.start, peak = val, mdd = 0; const path = [val], arith = [val], dd = [0];
    r.forEach(x => { val *= 1 + x; peak = Math.max(peak, val); const d = val / peak - 1; mdd = Math.min(mdd, d); path.push(val); dd.push(d); arith.push(arith[arith.length - 1] * (1 + mean)); });
    const sorted = [...r].sort((a, b) => a - b), pos = 0.05 * (n - 1), lo = Math.floor(pos), hv = sorted[lo] + (sorted[Math.min(n - 1, lo + 1)] - sorted[lo]) * (pos - lo);
    const ks = r.map((_, k) => k + 1);
    return {
      cards: [
        { key: true, label: 'Geometric mean (per period)', value: pct(geo, 3), sub: 'what you actually compounded at' },
        { label: 'Arithmetic mean', value: pct(mean, 3), sub: `${pct(mean - geo, 3)} above geometric` },
        { label: 'Standard deviation', value: pct(sd, 3), sub: `volatility drag ≈ ${pct(varr / 2, 3)}` },
        { label: 'Sharpe ratio', value: nf(sh, 3), sub: `annualized ${nf(sh * Math.sqrt(ppy), 3)}` },
        { label: 'Maximum drawdown', value: pct(mdd, 2), sub: 'worst peak-to-trough fall', tone: 'bad' },
        { label: 'Ending value', value: money(path[n], 0), sub: `${pct(path[n] / v.start - 1, 1)} total` },
        { label: '95% value at risk', value: pct(-hv, 2), sub: `historical · normal ${pct(-(mean - 1.645 * sd), 2)}` },
        { label: 'Annualized', value: pct(Math.pow(1 + geo, ppy) - 1, 2), sub: `volatility ${pct(sd * Math.sqrt(ppy), 2)}` },
        { label: 'Skewness', value: nf(skew, 3), sub: skew < 0 ? 'fatter left tail' : 'fatter right tail' }
      ],
      charts: [
        { title: 'Return in each period', sub: 'Gains above the line, losses below.', bars: 'stack', series: [{ name: 'Gain', type: 'bars', color: 'c1', pts: ks.map((k, i) => [k, r[i] > 0 ? r[i] * 100 : 0]) }, { name: 'Loss', type: 'bars', color: 'c4', pts: ks.map((k, i) => [k, r[i] < 0 ? r[i] * 100 : 0]) }], hlines: [{ y: 0 }], xlab: 'Period', yFmt: x => nf(x, 0) + '%', yRead: x => nf(x, 2) + '%' },
        { title: 'Compounding versus averaging', sub: 'The teal line is your real path. The dashed line is what you would have if every period earned the arithmetic mean. The gap is volatility drag.', series: [{ name: 'Actual path', type: 'line', color: 'c1', pts: path.map((x, k) => [k, x]) }, { name: 'If every period earned the average', type: 'line', color: 'c2', dash: true, pts: arith.map((x, k) => [k, x]) }], xlab: 'Period', yFmt: compact, yRead: money },
        { title: 'Drawdown', sub: 'How far below its previous high the investment sits.', series: [{ name: 'Drawdown', type: 'area', color: 'c4', pts: dd.map((x, k) => [k, x * 100]) }], xlab: 'Period', yFmt: x => nf(x, 0) + '%', yRead: x => nf(x, 2) + '%' }
      ],
      steps: [
        ['Arithmetic mean', `Σ r ÷ n = ${pct(sum(r), 3)} ÷ ${n} = ${pct(mean, 4)}`],
        ['Geometric mean', `[Π(1 + r)]^(1/n) − 1 = ${nfx(r.reduce((p, x) => p * (1 + x), 1), 5)}^(1/${n}) − 1 = ${pct(geo, 4)}`],
        ['Sample standard deviation', `σ = √[Σ(r − mean)² ÷ (n − 1)] = √${nfx(varr, 6)} = ${pct(sd, 4)}`],
        ['Sharpe ratio', `(${pct(mean, 3)} − ${pct(rf, 2)}) ÷ ${pct(sd, 3)} = ${nf(sh, 4)}`],
        ['Value at risk', `Historical: the 5th percentile of returns = ${pct(hv, 2)}\nNormal: mean − 1.645σ = ${pct(mean - 1.645 * sd, 2)}`]
      ]
    };
  }
});

register({
  id: 'options', group: 'Derivatives', title: 'Options (Black-Scholes)',
  blurb: 'Price calls and puts, read the Greeks, check put-call parity and watch time decay erase option value.',
  fields: [
    { id: 'S', label: 'Stock price', v: 100, step: 1, pre: '$', slider: [50, 150, 1] },
    { id: 'K', label: 'Strike price', v: 100, step: 1, pre: '$' },
    { id: 'T', label: 'Time to expiry', v: 1, step: 0.05, unit: 'yrs', slider: [0.05, 3, 0.05] },
    { id: 'vol', label: 'Volatility', v: 25, step: 0.5, unit: '%', slider: [5, 100, 0.5] },
    { id: 'r', label: 'Risk-free rate', v: 4, step: 0.1, unit: '%' },
    { id: 'q', label: 'Dividend yield', v: 0, step: 0.1, unit: '%' },
    { id: 'pos', label: 'Position to chart', type: 'select', v: 'lc', options: [['lc', 'Long call'], ['lp', 'Long put'], ['sc', 'Short call'], ['sp', 'Short put']] }
  ],
  concept: `<h4>The idea</h4>
<p>An option's value is its expected payoff discounted at the risk-free rate, under risk-neutral probabilities. Black-Scholes gives a closed form for European options.</p>
<div class="formula">C = S·e^(−qT)·N(d₁) − K·e^(−rT)·N(d₂)          P = K·e^(−rT)·N(−d₂) − S·e^(−qT)·N(−d₁)</div>
<div class="formula">d₁ = [ln(S/K) + (r − q + σ²/2)T] ÷ (σ√T)          d₂ = d₁ − σ√T</div>
<div class="formula">Put-call parity: C − P = S·e^(−qT) − K·e^(−rT)</div>
<ul><li><b>Delta</b> is the price change per $1 move in the stock. <b>Gamma</b> is how fast delta changes. <b>Vega</b> is the change per 1 point of volatility. <b>Theta</b> is daily time decay. <b>Rho</b> is the change per 1 point of rate.</li><li>Time value is largest when the option is at the money, and it melts faster as expiry nears.</li><li>Higher volatility raises both calls and puts, because the downside of an option is capped but the upside is not.</li></ul>`,
  calc(v) {
    const r = v.r / 100, q = v.q / 100, sg = v.vol / 100, o = bs(v.S, v.K, v.T, r, q, sg), eR = Math.exp(-r * v.T), eQ = Math.exp(-q * v.T);
    const isCall = v.pos[1] === 'c', sign = v.pos[0] === 'l' ? 1 : -1, nm = { lc: 'Long call', lp: 'Long put', sc: 'Short call', sp: 'Short put' }[v.pos];
    const price = (S, T) => { const x = bs(S, v.K, T, r, q, sg); return isCall ? x.c : x.p; }, prem = isCall ? o.c : o.p;
    const pay = S => (isCall ? Math.max(0, S - v.K) : Math.max(0, v.K - S));
    const grid = range(v.K * 0.5, v.K * 1.5, v.K / 50);
    const days = range(0, v.T * 365, v.T * 365 / 50);
    const parL = o.c - o.p, parR = v.S * eQ - v.K * eR, intr = isCall ? Math.max(0, v.S - v.K) : Math.max(0, v.K - v.S);
    const be = isCall ? v.K + prem : v.K - prem;
    return {
      cards: [
        { key: true, label: 'Call price', value: money(o.c), sub: `delta ${nf(o.dc, 3)}` },
        { key: true, label: 'Put price', value: money(o.p), sub: `delta ${nf(o.dp, 3)}` },
        { label: 'Gamma', value: nf(o.gamma, 4), sub: 'change in delta per $1' },
        { label: 'Vega', value: money(o.vega / 100, 3), sub: 'per 1 point of volatility' },
        { label: 'Theta (call)', value: money(o.thc / 365, 3), sub: `put ${money(o.thp / 365, 3)} · per day` },
        { label: 'Rho (call)', value: money(o.rhoc / 100, 3), sub: `put ${money(o.rhop / 100, 3)} · per 1 point of rate` },
        { label: `${isCall ? 'Call' : 'Put'} time value`, value: money(prem - intr), sub: `${money(intr)} intrinsic` },
        { label: 'Break-even at expiry', value: money(be), sub: `${nm.toLowerCase()}, premium ${money(prem)}` }
      ],
      info: Math.abs(parL - parR) < 1e-6 ? `Put-call parity holds: C − P = ${money(parL, 4)} = S·e^(−qT) − K·e^(−rT).` : '',
      charts: [
        { title: `${nm}: profit and loss`, sub: 'Profit at expiry (amber) and today\'s value (teal), relative to the premium. The two lines meet as expiry approaches.', series: [{ name: 'At expiry', type: 'line', color: 'c2', pts: grid.map(s => [s, sign * (pay(s) - prem)]) }, { name: 'Today', type: 'line', color: 'c1', pts: grid.map(s => [s, sign * (price(s, v.T) - prem)]) }], vlines: [{ x: v.S, label: 'stock today', color: 'c4' }], hlines: [{ y: 0 }], xlab: 'Stock price at the time', xFmt: x => '$' + nf(x, 0), yFmt: x => '$' + nf(x, 0), yRead: money },
        { title: 'Delta across stock prices', sub: 'Call delta runs from 0 to 1, put delta from −1 to 0. Both are steepest at the strike, which is where gamma peaks.', series: [{ name: 'Call delta', type: 'line', color: 'c1', pts: grid.map(s => [s, bs(s, v.K, v.T, r, q, sg).dc]) }, { name: 'Put delta', type: 'line', color: 'c3', pts: grid.map(s => [s, bs(s, v.K, v.T, r, q, sg).dp]) }], vlines: [{ x: v.S, label: 'stock today', color: 'c4' }], hlines: [{ y: 0 }], xlab: 'Stock price', xFmt: x => '$' + nf(x, 0), yFmt: x => nf(x, 1), yRead: x => nf(x, 3) },
        { title: 'Time decay', sub: `Value of the ${isCall ? 'call' : 'put'} as expiry approaches, for three stock prices. Decay accelerates near the end.`, series: [0.9, 1, 1.1].map((m, k) => ({ name: `Stock at ${money(v.K * m, 0)}`, type: 'line', color: ['c4', 'c1', 'c2'][k], pts: days.map(d => [d, price(v.K * m, d / 365)]) })), xlab: 'Days remaining', xFmt: x => nf(x, 0), yFmt: x => '$' + nf(x, 0), yRead: money, xRev: true }
      ],
      steps: [
        ['d₁ and d₂', `d₁ = [ln(${nf(v.S, 2)}/${nf(v.K, 2)}) + (${pct(r, 2)} − ${pct(q, 2)} + ${nfx(sg * sg / 2, 4)})×${nf(v.T, 2)}] ÷ (${pct(sg, 1)} × √${nf(v.T, 2)}) = ${nfx(o.d1, 4)}\nd₂ = d₁ − σ√T = ${nfx(o.d2, 4)}`],
        ['Normal probabilities', `N(d₁) = ${nfx(ncdf(o.d1), 4)}     N(d₂) = ${nfx(ncdf(o.d2), 4)}`],
        ['Call', `C = ${nf(v.S, 2)}×${nfx(eQ, 4)}×${nfx(ncdf(o.d1), 4)} − ${nf(v.K, 2)}×${nfx(eR, 4)}×${nfx(ncdf(o.d2), 4)} = ${money(o.c, 4)}`],
        ['Put', `P = ${nf(v.K, 2)}×${nfx(eR, 4)}×${nfx(ncdf(-o.d2), 4)} − ${nf(v.S, 2)}×${nfx(eQ, 4)}×${nfx(ncdf(-o.d1), 4)} = ${money(o.p, 4)}`],
        ['Put-call parity', `C − P = ${money(parL, 4)}     S·e^(−qT) − K·e^(−rT) = ${money(parR, 4)}`]
      ]
    };
  }
});

/* ================= ANALYSIS ================= */
register({
  id: 'ratios', group: 'Analysis', title: 'Ratios & DuPont',
  blurb: 'Enter a simple income statement and balance sheet to get liquidity, leverage, efficiency, profitability and market ratios, plus a DuPont breakdown of ROE.',
  fields: [
    { id: 'rev', label: 'Revenue', v: 5000, step: 100 }, { id: 'cogs', label: 'Cost of goods sold', v: 3000, step: 100 },
    { id: 'opex', label: 'Operating expenses (excl. D&A)', v: 1000, step: 50 }, { id: 'da', label: 'Depreciation & amortization', v: 200, step: 10 },
    { id: 'int', label: 'Interest expense', v: 120, step: 10 }, { id: 'tax', label: 'Tax rate', v: 25, step: 1, unit: '%' },
    { id: 'cash', label: 'Cash', v: 300, step: 25 }, { id: 'ar', label: 'Receivables', v: 500, step: 25 }, { id: 'inv', label: 'Inventory', v: 600, step: 25 },
    { id: 'oca', label: 'Other current assets', v: 100, step: 25 }, { id: 'nfa', label: 'Net fixed assets', v: 2500, step: 100 },
    { id: 'cl', label: 'Current liabilities', v: 700, step: 25 }, { id: 'ltd', label: 'Long-term debt', v: 1200, step: 50 },
    { id: 'sh', label: 'Shares outstanding', v: 100, step: 5 }, { id: 'px', label: 'Share price', v: 40, step: 1, pre: '$' }
  ],
  concept: `<h4>The idea</h4>
<p>Ratios turn statements into comparable numbers. Group them by the question they answer: can the firm pay its bills, how much does it borrow, how well does it use assets, how profitable is it, and how does the market value it.</p>
<div class="formula">ROE = Net margin × Asset turnover × Equity multiplier          (DuPont)</div>
<div class="formula">ROE = Tax burden × Interest burden × EBIT margin × Asset turnover × Equity multiplier</div>
<ul><li>Two firms can have the same ROE for very different reasons: thin margins and high leverage, or fat margins and low leverage. DuPont separates them.</li><li>Compare ratios with the same firm's history and with industry peers. A number on its own says little.</li></ul>`,
  calc(v) {
    const t = v.tax / 100, gp = v.rev - v.cogs, ebitda = gp - v.opex, ebit = ebitda - v.da, ebt = ebit - v.int, ni = ebt > 0 ? ebt * (1 - t) : ebt;
    const ca = v.cash + v.ar + v.inv + v.oca, ta = ca + v.nfa, tl = v.cl + v.ltd, eq = ta - tl;
    if (eq <= 0) return { note: `Assets (${nf(ta, 0)}) do not exceed liabilities (${nf(tl, 0)}), so equity is not positive. Lower the debt or raise assets.`, cards: [], charts: [], steps: [] };
    const eps = ni / v.sh, mc = v.px * v.sh, ev = mc + v.ltd - v.cash;
    const R = (name, val, f, why) => [name, val, f, why];
    const rows = [
      { h: 'Liquidity' }, R('Current ratio', nf(ca / v.cl, 2), 'Current assets ÷ current liabilities', 'Can short-term assets cover short-term bills?'),
      R('Quick ratio', nf((v.cash + v.ar) / v.cl, 2), '(Cash + receivables) ÷ current liabilities', 'Same test without slow-moving inventory'), R('Cash ratio', nf(v.cash / v.cl, 2), 'Cash ÷ current liabilities', 'Strictest liquidity test'),
      { h: 'Leverage' }, R('Debt to equity', nf(v.ltd / eq, 2), 'Long-term debt ÷ equity', 'Borrowed money per dollar of owners\' money'), R('Liabilities to assets', pct(tl / ta, 1), 'Total liabilities ÷ total assets', 'Share of assets funded by creditors'),
      R('Equity multiplier', nf(ta / eq, 2), 'Total assets ÷ equity', 'Asset base per dollar of equity'), R('Interest coverage', mult(ebit / v.int, 1), 'EBIT ÷ interest', 'How easily profit covers interest'), R('Net debt to EBITDA', mult((v.ltd - v.cash) / ebitda, 2), '(Debt − cash) ÷ EBITDA', 'Years of operating cash to repay debt'),
      { h: 'Efficiency' }, R('Asset turnover', mult(v.rev / ta, 2), 'Revenue ÷ total assets', 'Sales generated per dollar of assets'), R('Inventory turnover', mult(v.cogs / v.inv, 1), 'COGS ÷ inventory', 'How often stock is sold and replaced'),
      R('Days inventory', nf(v.inv / v.cogs * 365, 1), 'Inventory ÷ COGS × 365', 'Average days stock sits'), R('Days sales outstanding', nf(v.ar / v.rev * 365, 1), 'Receivables ÷ revenue × 365', 'Average days to collect'), R('Fixed asset turnover', mult(v.rev / v.nfa, 2), 'Revenue ÷ net fixed assets', 'Sales per dollar of plant and equipment'),
      { h: 'Profitability' }, R('Gross margin', pct(gp / v.rev, 1), 'Gross profit ÷ revenue', 'Pricing power and production cost'), R('EBITDA margin', pct(ebitda / v.rev, 1), 'EBITDA ÷ revenue', 'Operating cash profit'), R('EBIT margin', pct(ebit / v.rev, 1), 'EBIT ÷ revenue', 'Operating profit'),
      R('Net margin', pct(ni / v.rev, 1), 'Net income ÷ revenue', 'Profit left per dollar of sales'), R('Return on assets', pct(ni / ta, 1), 'Net income ÷ total assets', 'Profit from all assets'), R('Return on equity', pct(ni / eq, 1), 'Net income ÷ equity', 'Profit for shareholders'),
      R('Return on invested capital', pct(ebit * (1 - t) / (v.ltd + eq), 1), 'EBIT(1−t) ÷ (debt + equity)', 'Profit from all capital invested'),
      { h: 'Market value' }, R('Earnings per share', money(eps), 'Net income ÷ shares', 'Profit per share'), R('Price to earnings', mult(v.px / eps, 1), 'Price ÷ EPS', 'Price paid per dollar of earnings'), R('Price to book', mult(mc / eq, 2), 'Market cap ÷ equity', 'Market value versus accounting value'),
      R('Enterprise value', money(ev, 0), 'Market cap + debt − cash', 'Value of the whole business'), R('EV to EBITDA', mult(ev / ebitda, 1), 'Enterprise value ÷ EBITDA', 'Common takeover and comps multiple')
    ];
    const npm = ni / v.rev, at = v.rev / ta, em = ta / eq, roe = ni / eq, tb = ebt ? ni / ebt : NaN, ib = ebit ? ebt / ebit : NaN, em5 = ebit / v.rev;
    const bx = (l, val, s, i) => `<div class="dp" style="--i:${i}"><span>${l}</span><b>${val}</b><small>${s}</small></div>`, op = x => `<span class="op">${x}</span>`;
    const dup = `<div class="dupont"><p class="dl">3-step DuPont</p><div class="dprow">${bx('Return on equity', pct(roe, 1), 'net income ÷ equity', 0)}${op('=')}${bx('Net margin', pct(npm, 1), 'profit per $ of sales', 1)}${op('×')}${bx('Asset turnover', mult(at, 2), 'sales per $ of assets', 2)}${op('×')}${bx('Equity multiplier', mult(em, 2), 'assets per $ of equity', 3)}</div>
<p class="dl">5-step DuPont</p><div class="dprow">${bx('Return on equity', pct(roe, 1), 'check', 4)}${op('=')}${bx('Tax burden', nf(tb, 3), 'NI ÷ EBT', 5)}${op('×')}${bx('Interest burden', nf(ib, 3), 'EBT ÷ EBIT', 6)}${op('×')}${bx('EBIT margin', pct(em5, 1), 'EBIT ÷ sales', 7)}${op('×')}${bx('Asset turnover', mult(at, 2), 'sales ÷ assets', 8)}${op('×')}${bx('Equity multiplier', mult(em, 2), 'assets ÷ equity', 9)}</div></div>`;
    return {
      cards: [
        { key: true, label: 'Return on equity', value: pct(roe, 1), sub: `${pct(npm, 1)} × ${nf(at, 2)} × ${nf(em, 2)}` },
        { label: 'Net income', value: money(ni, 1), sub: `EBIT ${nf(ebit, 1)} · EBT ${nf(ebt, 1)}` },
        { label: 'Equity (computed)', value: money(eq, 0), sub: `assets ${nf(ta, 0)} − liabilities ${nf(tl, 0)}` },
        { label: 'Current ratio', value: nf(ca / v.cl, 2), sub: 'liquidity' },
        { label: 'Interest coverage', value: mult(ebit / v.int, 1), sub: 'EBIT ÷ interest' }
      ],
      charts: [{ type: 'html', title: 'DuPont: what drives ROE', sub: 'The same ROE can come from margin, efficient asset use or leverage. Each box is one lever.', html: dup }],
      steps: [
        ['Income statement', `Gross profit = ${nf(v.rev, 0)} − ${nf(v.cogs, 0)} = ${nf(gp, 0)}\nEBITDA = ${nf(gp, 0)} − ${nf(v.opex, 0)} = ${nf(ebitda, 0)}     EBIT = ${nf(ebitda, 0)} − ${nf(v.da, 0)} = ${nf(ebit, 0)}\nEBT = ${nf(ebit, 0)} − ${nf(v.int, 0)} = ${nf(ebt, 0)}     Net income = EBT × (1 − ${pct(t, 0)}) = ${nf(ni, 1)}`],
        ['Balance sheet', `Current assets = ${nf(ca, 0)}     Total assets = ${nf(ta, 0)}\nLiabilities = ${nf(tl, 0)}     Equity = ${nf(ta, 0)} − ${nf(tl, 0)} = ${nf(eq, 0)}`],
        ['DuPont check', `${pct(npm, 2)} × ${nf(at, 3)} × ${nf(em, 3)} = ${pct(npm * at * em, 2)}   (direct ROE = ${pct(roe, 2)})`]
      ],
      tables: [{ title: 'All ratios', cols: ['Ratio', 'Value', 'Formula', 'What it tells you'], rows, left: true }]
    };
  }
});
