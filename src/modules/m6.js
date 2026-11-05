// @ts-nocheck
import { register } from '../lib/registry';
import { nf, nfx, money, pct, parseList, sum, range, ncdf, ninv, npdf, mean, median, stdev, percentile, corr, linreg, isNum } from '../lib/math';

/* ================= STATISTICS TOOLKIT ================= */
register({
  id: 'stats', group: 'Statistics', title: 'Describe My Numbers',
  blurb: 'Average, middle, spread and range of any list of numbers, with a histogram.',
  fields: [{ id: 'data', label: 'Your numbers', type: 'text', v: '12, -5, 8, 15, -2, 9, 4, -8, 20, 6, 11, 3', help: 'Separate with commas. Use a minus sign for negatives.' }],
  concept: `<h4>The idea</h4>
<p>A list of numbers is hard to read. A few summary numbers describe it: where the middle is, and how spread out it is.</p>
<div class="formula">Average = Σ x ÷ n          Median = the middle value when sorted</div>
<div class="formula">Standard deviation = √[ Σ (x − average)² ÷ (n − 1) ]</div>
<ul><li>The <b>average</b> is pulled by extreme values. The <b>median</b> is not.</li><li>The <b>standard deviation</b> is a typical distance from the average. In finance it is called volatility.</li><li>For bell-shaped data, about 68% of values are within one standard deviation of the average, and about 95% within two.</li></ul>`,
  calc(v) {
    const d = parseList(v.data), n = d.length;
    if (n < 2) return { note: 'Enter at least two numbers, separated by commas.', cards: [], charts: [], steps: [] };
    const mu = mean(d), md = median(d), sd = stdev(d), lo = Math.min(...d), hi = Math.max(...d), p10 = percentile(d, 0.1), p90 = percentile(d, 0.9);
    const bins = Math.max(5, Math.min(12, Math.ceil(Math.log2(n) + 1))), span = (hi - lo) || 1, counts = Array(bins).fill(0);
    d.forEach(x => { counts[Math.min(bins - 1, Math.floor((x - lo) / span * bins))]++; });
    const centers = counts.map((_, i) => lo + (i + 0.5) * span / bins);
    return {
      cards: [
        { key: true, label: 'Average', value: nf(mu, 2), sub: 'add up, divide by how many' },
        { label: 'Middle (median)', value: nf(md, 2), sub: 'half are below, half above' },
        { label: 'Spread (std. deviation)', value: nf(sd, 2), sub: 'typical distance from the average' },
        { label: 'Lowest to highest', value: `${nf(lo, 1)} to ${nf(hi, 1)}`, sub: `range ${nf(hi - lo, 1)}` },
        { label: '1 in 10 is below', value: nf(p10, 2), sub: '10th percentile' },
        { label: '1 in 10 is above', value: nf(p90, 2), sub: '90th percentile' },
        { label: 'How many numbers', value: String(n), sub: '' }
      ],
      charts: [{ title: 'Where your numbers fall', sub: 'Taller bars mean more numbers in that range.', series: [{ name: 'How many', type: 'bars', color: 'c2', pts: centers.map((c, i) => [c, counts[i]]) }], vlines: [{ x: mu, label: 'Average', color: 'c1' }, { x: md, label: 'Middle', color: 'c3' }], xlab: 'Value', xFmt: x => nf(x, 0), yFmt: x => nf(x, 0), yRead: x => nf(x, 0) + ' numbers' }],
      steps: [
        ['Average', `Σ x ÷ n = ${nf(sum(d), 2)} ÷ ${n} = ${nf(mu, 4)}`],
        ['Middle', `Sort the numbers. The middle one is ${nf(md, 4)}.`],
        ['Distance from the average', `Each number minus ${nf(mu, 2)}, then squared, then added: ${nf(sum(d.map(x => (x - mu) ** 2)), 3)}`],
        ['Variance and spread', `Variance = ${nf(sum(d.map(x => (x - mu) ** 2)), 3)} ÷ (${n} − 1) = ${nf(sd * sd, 4)}\nStandard deviation = √${nf(sd * sd, 4)} = ${nf(sd, 4)}`],
        ['Rule of thumb', `About 68% of values within ${nf(mu - sd, 2)} to ${nf(mu + sd, 2)}, and about 95% within ${nf(mu - 2 * sd, 2)} to ${nf(mu + 2 * sd, 2)} (if the data is bell-shaped).`]
      ],
      tables: [{ title: 'Each number against the average', collapsed: true, cols: ['Number', 'Distance from average', 'Spreads from average'], rows: d.slice(0, 200).map(x => [nf(x, 2), nf(x - mu, 2), nf((x - mu) / sd, 2)]) }]
    };
  }
});

register({
  id: 'corr', group: 'Statistics', title: 'Do Two Things Move Together?',
  blurb: 'Correlation, the best-fit line and beta for two lists of paired numbers.',
  fields: [
    { id: 'xs', label: 'First list, for example the market', type: 'text', v: '2.1, -1.4, 3.3, 0.6, -2.5, 4.0, 1.2, -0.8, 2.8, -3.1', help: 'Same number of values in both lists, in the same order.' },
    { id: 'ys', label: 'Second list, for example your stock', type: 'text', v: '3.0, -2.2, 4.6, 0.5, -3.9, 6.1, 2.0, -0.9, 3.7, -4.8' }
  ],
  concept: `<h4>The idea</h4>
<p>Correlation measures whether two things rise and fall together. It runs from −1 (perfectly opposite) through 0 (unrelated) to +1 (perfectly together).</p>
<div class="formula">r = Σ (x − x̄)(y − ȳ) ÷ √[ Σ (x − x̄)² · Σ (y − ȳ)² ]</div>
<div class="formula">Slope (beta) = Σ (x − x̄)(y − ȳ) ÷ Σ (x − x̄)²          R² = r²</div>
<ul><li>In finance the <b>slope</b> of a stock's returns against the market's returns is its <b>beta</b>.</li><li><b>R²</b> is the share of the moves of one explained by the other.</li><li>Correlation is not cause. Two things can move together because of something else.</li></ul>`,
  calc(v) {
    const xs = parseList(v.xs), ys = parseList(v.ys), n = Math.min(xs.length, ys.length);
    if (n < 3) return { note: 'Enter at least three pairs of numbers. Both lists need the same count.', cards: [], charts: [], steps: [] };
    const x = xs.slice(0, n), y = ys.slice(0, n), r = corr(x, y), f = linreg(x, y);
    if (!isNum(r)) return { note: 'One of the lists never changes, so there is nothing to compare.', cards: [], charts: [], steps: [] };
    const lo = Math.min(...x), hi = Math.max(...x);
    const word = Math.abs(r) > 0.7 ? 'strongly' : Math.abs(r) > 0.3 ? 'somewhat' : 'barely';
    return {
      info: xs.length !== ys.length ? `The lists have different lengths, so only the first ${n} pairs are used.` : '',
      cards: [
        { key: true, label: 'Correlation (r)', value: (r >= 0 ? '+' : '−') + nf(Math.abs(r), 3), sub: `they ${word} ${r >= 0 ? 'move together' : 'move opposite'}` },
        { label: 'Slope (beta)', value: nf(f.slope, 3), sub: 'second moves this much per 1 of the first' },
        { label: 'Share explained (R²)', value: pct(f.r2, 1), sub: 'of the second\'s moves explained by the first' },
        { label: 'Pairs of numbers', value: String(n), sub: '' }
      ],
      charts: [{
        title: 'Every pair as a dot', sub: 'The line is the best straight line through the dots.',
        series: [{ name: 'Pairs', type: 'dots', color: 'c2', r: 5, noLegend: false, pts: x.map((a, i) => [a, y[i]]) }, { name: 'Best-fit line', type: 'line', color: 'c1', noRead: true, pts: [[lo, f.intercept + f.slope * lo], [hi, f.intercept + f.slope * hi]] }],
        nearest: 'xy', xlab: 'First list', xFmt: a => nf(a, 1), yFmt: a => nf(a, 1), readout: i => `<span class="rx">First ${nf(x[i], 2)} · Second ${nf(y[i], 2)}</span>`, hint: 'Hover a dot to see its pair.'
      }],
      steps: [
        ['Averages', `First: ${nf(mean(x), 3)}     Second: ${nf(mean(y), 3)}`],
        ['Correlation', `r = ${nf(r, 4)}. Between −1 and +1, closer to either end means a stronger link.`],
        ['Best-fit line', `second = ${nf(f.intercept, 3)} + ${nf(f.slope, 3)} × first`],
        ['R squared', `r² = ${nf(r, 4)}² = ${nf(f.r2, 4)}, so ${pct(f.r2, 1)} of the second's moves line up with the first.`]
      ]
    };
  }
});

register({
  id: 'normal', group: 'Statistics', title: 'Chance of a Big Move',
  blurb: 'Use the average and the spread to estimate how likely a bad year is, and the loss to plan for.',
  fields: [
    { id: 'mean', label: 'Average yearly return', v: 7, step: 0.5, unit: '%' },
    { id: 'sd', label: 'Spread (standard deviation)', v: 16, step: 0.5, unit: '%', min: 0.1 },
    { id: 'cut', label: 'A loss you worry about', v: -20, step: 1, unit: '%' },
    { id: 'amount', label: 'Amount invested', v: 10000, step: 1000, pre: '$' },
    { id: 'conf', label: 'How sure do you want to be?', type: 'select', v: '95', options: [['90', '90%'], ['95', '95%'], ['99', '99%']] }
  ],
  concept: `<h4>The idea</h4>
<p>Many returns roughly follow a bell curve. If you know the average and the spread, you can work out how likely any result is.</p>
<div class="formula">z = (value − average) ÷ spread          chance = area of the bell below z</div>
<div class="formula">Value at Risk = amount × (average − z_conf × spread)</div>
<ul><li>About 68% of years land within one spread of the average, 95% within two.</li><li><b>Value at Risk</b> answers: "with 95% confidence, how much could I lose in a year?" The loss will be worse in the other 5% of years.</li><li>Real markets have fatter tails than a bell curve, so treat this as a guide, not a guarantee.</li></ul>`,
  calc(v) {
    const mu = v.mean, sd = Math.max(1e-6, v.sd), conf = +v.conf / 100, z = (v.cut - mu) / sd, pBelow = ncdf(z), pLoss = ncdf((0 - mu) / sd), zc = ninv(conf), edge = mu - zc * sd, dollars = v.amount * edge / 100;
    const lo = mu - 4 * sd, hi = mu + 4 * sd, xs = range(lo, hi, (hi - lo) / 120), dens = x => npdf((x - mu) / sd) / sd * 100;
    const tail = xs.filter(x => x <= v.cut);
    return {
      cards: [
        { key: true, label: `Chance of a year worse than ${nf(v.cut, 0)}%`, value: pct(pBelow, pBelow < 0.01 ? 2 : 1), sub: pBelow > 0.0005 ? `about 1 year in ${nf(1 / pBelow, 0)}` : 'very unlikely' },
        { label: 'Chance of any loss', value: pct(pLoss, 1), sub: 'a year below 0%' },
        { label: `Bad-year line (${v.conf}%)`, value: nf(edge, 1) + '%', sub: `only ${100 - +v.conf} years in 100 are worse` },
        { label: 'Loss to plan for', value: edge < 0 ? money(-dollars, 0) : 'No loss', sub: `on ${money(v.amount, 0)}, ${v.conf}% sure` },
        { label: 'Typical range (68%)', value: `${nf(mu - sd, 0)}% to ${nf(mu + sd, 0)}%`, sub: 'about 2 years in 3' },
        { label: 'Wide range (95%)', value: `${nf(mu - 2 * sd, 0)}% to ${nf(mu + 2 * sd, 0)}%`, sub: 'about 19 years in 20' }
      ],
      charts: [{
        title: 'The bell curve of yearly returns', sub: 'The rose area is the chance of a year as bad as your loss, or worse.',
        series: [{ name: 'Likelihood', type: 'line', color: 'c2', pts: xs.map(x => [x, dens(x)]) }, ...(tail.length > 1 ? [{ name: 'Year this bad or worse', type: 'area', color: 'c4', noRead: true, pts: tail.map(x => [x, dens(x)]) }] : [])],
        vlines: [{ x: mu, label: 'average', color: 'mute' }, { x: v.cut, label: 'your loss', color: 'c4' }], xlab: 'Yearly return', xFmt: a => nf(a, 0) + '%', yFmt: () => '', yRead: () => '', hint: 'Hover to see the chance of a year this bad or worse.',
        readout: i => `<span class="rx">A year of ${nf(xs[i], 1)}%</span><span class="ri">chance of this or worse <b>${pct(ncdf((xs[i] - mu) / sd), 1)}</b></span>`
      }],
      steps: [
        ['How many spreads away', `z = (${nf(v.cut, 1)} − ${nf(mu, 1)}) ÷ ${nf(sd, 1)} = ${nf(z, 3)}`],
        ['Chance of a year this bad or worse', `Area of the bell below z = ${nf(z, 2)} is ${pct(pBelow, 3)}`],
        [`Bad-year line at ${v.conf}%`, `average − ${nf(zc, 3)} × spread = ${nf(mu, 1)}% − ${nf(zc, 3)} × ${nf(sd, 1)}% = ${nf(edge, 2)}%`],
        ['Value at Risk', `${money(v.amount, 0)} × ${nf(edge, 2)}% = ${money(dollars, 0)}`]
      ]
    };
  }
});

register({
  id: 'prob', group: 'Statistics', title: 'Expected Value of a Bet',
  blurb: 'Weigh each outcome by its chance to see if a bet, project or decision is worth taking.',
  fields: [
    { id: 'win', label: 'What you win', v: 100, step: 10, pre: '$' },
    { id: 'pwin', label: 'Chance of winning', v: 40, step: 5, unit: '%', slider: [5, 95, 5] },
    { id: 'lose', label: 'What you lose', v: 50, step: 10, pre: '$' },
    { id: 'tries', label: 'How many times you play', v: 10, step: 1, min: 1 }
  ],
  concept: `<h4>The idea</h4>
<p>When the future is uncertain, weigh each possible result by its chance. The sum is the expected value: what you would average per try if you could repeat it many times.</p>
<div class="formula">Expected value = Σ (outcome × probability)</div>
<div class="formula">Spread = √[ Σ probability × (outcome − expected)² ]</div>
<ul><li>A positive expected value is worth taking <i>on average</i>. A single try can still lose.</li><li>The more times you repeat it, the closer your real average gets to the expected value (the law of large numbers).</li><li>This is how insurers, investors and casinos think.</li></ul>`,
  calc(v) {
    const p = Math.min(1, Math.max(0, v.pwin / 100)), ev = p * v.win - (1 - p) * v.lose, sd = Math.sqrt(p * (v.win - ev) ** 2 + (1 - p) * (-v.lose - ev) ** 2), n = Math.max(1, Math.round(v.tries));
    const ahead = k => (sd === 0 ? (ev > 0 ? 1 : 0) : 1 - ncdf((0 - k * ev) / (sd * Math.sqrt(k)))), ks = range(1, 100, 1);
    return {
      cards: [
        { key: true, label: 'Expected value per try', value: (ev >= 0 ? '+' : '−') + money(Math.abs(ev), 2), sub: ev >= 0 ? 'worth taking on average' : 'a losing bet on average', tone: ev >= 0 ? 'good' : 'bad' },
        { label: 'Chance of winning one try', value: pct(p, 0), sub: `${pct(1 - p, 0)} chance of losing` },
        { label: 'Typical swing', value: money(sd, 2), sub: 'spread of one try' },
        { label: `Expected total after ${n} ${n === 1 ? 'try' : 'tries'}`, value: (ev * n >= 0 ? '+' : '−') + money(Math.abs(ev * n), 2), sub: '' },
        { label: `Chance of being ahead after ${n}`, value: pct(ahead(n), 0), sub: 'more tries, more predictable' }
      ],
      charts: [
        { title: 'The two outcomes', sub: 'The dashed line is the expected value.', series: [{ name: 'Result', type: 'bars', color: 'c3', pts: [[0, v.win], [1, -v.lose]] }], xLabels: [`Win (${pct(p, 0)})`, `Lose (${pct(1 - p, 0)})`], hlines: [{ y: ev, label: 'expected value', color: 'c1' }], yFmt: x => money(x, 0), yRead: x => money(x, 0) },
        { title: 'More tries, more predictable', sub: 'Chance of being ahead after playing this many times.', series: [{ name: 'Chance of being ahead', type: 'area', color: 'c2', pts: ks.map(k => [k, ahead(k) * 100]) }], vlines: [{ x: Math.min(100, n), label: 'your tries', color: 'c4' }], hlines: [{ y: 50 }], yDomain: [0, 100], xlab: 'Number of tries', yFmt: x => nf(x, 0) + '%', yRead: x => nf(x, 1) + '%', xFmt: x => nf(x, 0) }
      ],
      steps: [
        ['Expected value', `${pct(p, 0)} × ${money(v.win, 0)} − ${pct(1 - p, 0)} × ${money(v.lose, 0)} = ${money(ev, 2)}`],
        ['Spread of one try', `√[${nf(p, 2)} × (${nf(v.win - ev, 1)})² + ${nf(1 - p, 2)} × (${nf(-v.lose - ev, 1)})²] = ${money(sd, 2)}`],
        [`After ${n} tries`, `Expected total = ${n} × ${money(ev, 2)} = ${money(ev * n, 2)}\nSpread of the total = ${money(sd, 2)} × √${n} = ${money(sd * Math.sqrt(n), 2)}`],
        ['Chance of being ahead', `${pct(ahead(n), 1)} (normal approximation)`]
      ]
    };
  }
});
