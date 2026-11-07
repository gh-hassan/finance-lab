// @ts-nocheck
import { register } from '../lib/registry';
import { nf, nfx, money, pct, mult, yrs, compact, parseList, sum, range, npv, irr, findRoot, annF, fvF, bondPrice, ncdf, bs, isNum } from '../lib/math';
import { hbars } from '../ui/visuals.js';

/* ================= FOUNDATIONS ================= */
register({
  id: 'tvm', group: 'Foundations', title: 'Time Value of Money',
  blurb: 'Solve for N, I/Y, PV, PMT or FV using the same sign convention as a BA II Plus, then watch the balance grow period by period.',
  fields: [
    { id: 'solve', label: 'Solve for', type: 'select', v: 'fv', options: [['fv', 'Future value (FV)'], ['pv', 'Present value (PV)'], ['pmt', 'Payment (PMT)'], ['n', 'Number of periods (N)'], ['iy', 'Interest rate (I/Y)']] },
    { id: 'n', label: 'N · number of periods', v: 10, step: 1, min: 0, slider: [1, 60, 1] },
    { id: 'iy', label: 'I/Y · annual interest rate', v: 6, step: 0.05, unit: '%', slider: [0, 20, 0.25] },
    { id: 'pv', label: 'PV · present value', v: -1000, step: 100, pre: '$' },
    { id: 'pmt', label: 'PMT · payment each period', v: -100, step: 10, pre: '$' },
    { id: 'fv', label: 'FV · future value', v: 0, step: 100, pre: '$' },
    { id: 'py', label: 'Periods per year (P/Y = C/Y)', v: 1, step: 1, min: 1 },
    { id: 'when', label: 'Payments are made', type: 'select', v: '0', options: [['0', 'At the end of each period'], ['1', 'At the start of each period']] }
  ],
  concept: `<h4>The idea</h4>
<p>A dollar today is worth more than a dollar later because today's dollar can earn a return. Every time-value problem is one balance equation: the cash you put in and the cash you take out must net to zero once all of it is moved to the same date.</p>
<div class="formula">PV·(1+i)^N + PMT·(1+i·t)·[(1+i)^N − 1] ÷ i + FV = 0</div>
<ul><li><b>i</b> is the rate per period, I/Y ÷ P/Y.</li><li><b>t</b> is 0 for payments at the end of the period and 1 for payments at the start (annuity due).</li><li><b>Sign convention:</b> money you pay out is negative, money you receive is positive. Depositing $1,000 is PV = −1,000.</li></ul>
<h4>Try these</h4>
<ul><li>How long to double money at 7%? Set PV = −1, FV = 2, PMT = 0, solve N.</li><li>Monthly payment on a car loan? PV = +25,000, FV = 0, N = 60, I/Y = 6, P/Y = 12, solve PMT.</li><li>What rate turns $5,000 into $12,000 in 12 years? Solve I/Y.</li></ul>
<h4>Common mistakes</h4>
<ul><li>Entering N in years while using a monthly rate. N and the rate must use the same period.</li><li>Leaving PV and FV both positive so the equation cannot balance.</li><li>Forgetting that annuity-due payments earn one extra period of interest.</li></ul>`,
  calc(v) {
    const t = +v.when, py = Math.max(1, v.py);
    let { n, iy, pv, pmt, fv } = v;
    const A = (i, k) => (1 + i * t) * fvF(i, k);
    const eq = (i, k, a, b, c) => a * Math.pow(1 + i, k) + b * A(i, k) + c;
    let i = iy / 100 / py;
    if (v.solve === 'fv') fv = -(pv * Math.pow(1 + i, n) + pmt * A(i, n));
    else if (v.solve === 'pv') pv = -(fv + pmt * A(i, n)) / Math.pow(1 + i, n);
    else if (v.solve === 'pmt') pmt = -(fv + pv * Math.pow(1 + i, n)) / A(i, n);
    else if (v.solve === 'n') {
      if (Math.abs(i) < 1e-12) n = -(pv + fv) / pmt;
      else { const k = pmt * (1 + i * t) / i, g = (k - fv) / (pv + k); n = g > 0 ? Math.log(g) / Math.log(1 + i) : NaN; }
    } else { i = findRoot(x => eq(x, n, pv, pmt, fv), -0.9, 3, 4000); iy = i * py * 100; }
    const solvedVal = { fv, pv, pmt, n, iy }[v.solve];
    if (![n, i, pv, pmt, fv].every(isNum)) {
      return { solved: { id: v.solve, value: NaN }, note: 'No solution with these inputs. Check that PV, PMT and FV have signs that can offset each other (money out is negative, money in is positive).', cards: [], charts: [], steps: [] };
    }
    const g = Math.pow(1 + i, n), af = A(i, n), ear = Math.pow(1 + i, py) - 1;
    const labels = { fv: 'Future value', pv: 'Present value', pmt: 'Payment per period', n: 'Number of periods', iy: 'Annual interest rate' };
    const shown = { fv: money(fv), pv: money(pv), pmt: money(pmt), n: nf(n, 3), iy: nf(iy, 4) + '%' }[v.solve];
    const saver = pv * pmt >= 0 && (pv !== 0 || pmt !== 0);
    const cards = [
      { key: true, label: labels[v.solve], value: shown, sub: v.solve === 'n' && py > 1 ? `${nf(n / py, 2)} years` : 'solved' },
      { label: 'Rate per period', value: pct(i, 4), sub: `${nf(iy, 3)}% ÷ ${py}` },
      { label: 'Effective annual rate', value: pct(ear, 3), sub: 'after compounding' }
    ];
    if (saver) cards.push({ label: 'Interest earned', value: money(Math.abs(fv) - Math.abs(pv) - Math.abs(pmt) * n), sub: `on ${money(Math.abs(pv) + Math.abs(pmt) * n)} paid in`, tone: 'good' });
    else if (pmt !== 0) cards.push({ label: 'Total of all payments', value: money(Math.abs(pmt) * n), sub: `over ${nf(n, 2)} periods` });
    const solveText = {
      fv: `FV = −[PV·g + PMT·AF] = −[${nf(pv)} × ${nfx(g, 6)} + ${nf(pmt)} × ${nfx(af, 6)}] = ${money(fv)}`,
      pv: `PV = −(FV + PMT·AF) ÷ g = −(${nf(fv)} + ${nf(pmt)} × ${nfx(af, 6)}) ÷ ${nfx(g, 6)} = ${money(pv)}`,
      pmt: `PMT = −(FV + PV·g) ÷ AF = −(${nf(fv)} + ${nf(pv)} × ${nfx(g, 6)}) ÷ ${nfx(af, 6)} = ${money(pmt)}`,
      n: `g = (k − FV) ÷ (PV + k) with k = PMT·(1+i·t) ÷ i\nN = ln(g) ÷ ln(1 + i) = ${nf(n, 4)} periods`,
      iy: `No closed form. Search for the i that makes the balance equation zero:\ni = ${pct(i, 5)} per period, so I/Y = ${pct(i, 5)} × ${py} = ${nf(iy, 4)}%`
    }[v.solve];
    const steps = [
      ['Rate per period', `i = I/Y ÷ P/Y = ${nf(iy, 4)}% ÷ ${py} = ${pct(i, 4)}`],
      ['Growth factor g', `g = (1 + i)^N = (1 + ${nfx(i, 6)})^${nf(n, 4)} = ${nfx(g, 6)}`],
      ['Annuity factor AF', `AF = ${t ? '(1 + i) × ' : ''}[(1 + i)^N − 1] ÷ i = ${nfx(af, 6)}`],
      ['Solve', solveText],
      ['Check: the balance equation', `PV·g + PMT·AF + FV = ${nf(pv)} × ${nfx(g, 6)} + ${nf(pmt)} × ${nfx(af, 6)} + ${nf(fv)} = ${nf(eq(i, n, pv, pmt, fv), 6)}`]
    ];
    const K = Math.max(1, Math.round(n)), stp = Math.max(1, Math.ceil(K / 80)), ks = [];
    for (let k = 0; k <= K; k += stp) ks.push(k);
    if (ks[ks.length - 1] !== K) ks.push(K);
    const series = [{ name: saver ? 'Account value' : 'Balance owed', type: 'area', color: 'c1', pts: ks.map(k => [k, Math.abs(pv * Math.pow(1 + i, k) + pmt * A(i, k))]) }];
    if (saver) series.push({ name: 'Cash you paid in', type: 'line', color: 'c2', dash: true, pts: ks.map(k => [k, Math.abs(pv) + Math.abs(pmt) * k]) });
    return {
      solved: { id: v.solve, value: solvedVal, dp: 6 }, cards, steps,
      charts: [{ title: saver ? 'How the balance grows' : 'How the balance falls', sub: saver ? 'The gap between the two lines is interest on interest.' : 'Balance outstanding after each period.', series, xlab: 'Period', yFmt: compact, yRead: money }]
    };
  }
});

register({
  id: 'rates', group: 'Foundations', title: 'Interest Rates & Compounding',
  blurb: 'Convert APR to effective annual rate, compare compounding frequencies, strip out inflation and apply the rule of 72.',
  fields: [
    { id: 'apr', label: 'Stated annual rate (APR)', v: 12, step: 0.25, unit: '%', slider: [1, 30, 0.25] },
    { id: 'm', label: 'Compounding periods per year', v: 12, step: 1, min: 1 },
    { id: 'years', label: 'Years invested', v: 10, step: 1, min: 1, slider: [1, 40, 1] },
    { id: 'p', label: 'Starting amount', v: 1000, step: 100, pre: '$' },
    { id: 'infl', label: 'Inflation', v: 3, step: 0.25, unit: '%', slider: [0, 12, 0.25] }
  ],
  concept: `<h4>The idea</h4>
<p>A quoted rate (APR) is not the rate you actually earn. What you earn depends on how often interest is added. The effective annual rate (EAR) is the single annual rate that gives the same result.</p>
<div class="formula">EAR = (1 + APR ÷ m)^m − 1      continuous: EAR = e^APR − 1</div>
<div class="formula">Real rate = (1 + nominal) ÷ (1 + inflation) − 1     (Fisher)</div>
<div class="formula">Rule of 72: years to double ≈ 72 ÷ rate in percent</div>
<ul><li>More frequent compounding always raises EAR, but with sharply diminishing returns. Continuous compounding is the ceiling.</li><li>Compare loans and deposits by EAR, never by APR alone.</li><li>The Fisher formula is exact. Subtracting inflation is only an approximation.</li></ul>`,
  calc(v) {
    const apr = v.apr / 100, m = Math.max(1, v.m), i = apr / m, ear = Math.pow(1 + i, m) - 1, cont = Math.exp(apr) - 1, infl = v.infl / 100;
    const real = (1 + ear) / (1 + infl) - 1, dbl = Math.log(2) / Math.log(1 + ear);
    const fvN = v.p * Math.pow(1 + i, m * v.years), fvReal = fvN / Math.pow(1 + infl, v.years);
    const freqs = [[1, 'Annual'], [2, 'Semi'], [4, 'Qtr'], [12, 'Month'], [52, 'Week'], [365, 'Day']];
    const gain = freqs.map(([k], idx) => [idx, (Math.pow(1 + apr / k, k) - 1 - apr) * 100]);
    gain.push([6, (cont - apr) * 100]);
    const Y = Math.max(1, Math.ceil(v.years)), ys = range(0, Y, 1);
    return {
      cards: [
        { key: true, label: 'Effective annual rate', value: pct(ear, 3), sub: `vs ${pct(apr, 2)} stated` },
        { label: 'Rate per period', value: pct(i, 4), sub: `${pct(apr, 2)} ÷ ${m}` },
        { label: 'Continuous compounding', value: pct(cont, 3), sub: 'e^APR − 1' },
        { label: 'Real rate (Fisher)', value: pct(real, 3), sub: `after ${pct(infl, 1)} inflation`, tone: real < 0 ? 'bad' : '' },
        { label: 'Doubling time', value: yrs(dbl, 2), sub: `rule of 72 says ${nf(72 / v.apr, 2)} yrs` },
        { label: `Value after ${v.years} yrs`, value: money(fvN), sub: `${money(fvReal)} in today's dollars` }
      ],
      steps: [
        ['Rate per period', `i = APR ÷ m = ${pct(apr, 3)} ÷ ${m} = ${pct(i, 4)}`],
        ['Effective annual rate', `EAR = (1 + i)^m − 1 = (1 + ${nfx(i, 6)})^${m} − 1 = ${pct(ear, 4)}`],
        ['Real rate', `(1 + ${pct(ear, 3)}) ÷ (1 + ${pct(infl, 2)}) − 1 = ${pct(real, 4)}`],
        ['Doubling time', `ln 2 ÷ ln(1 + EAR) = 0.693147 ÷ ${nfx(Math.log(1 + ear), 6)} = ${nf(dbl, 3)} years`],
        ['Future value', `FV = P·(1 + i)^(m·years) = ${money(v.p)} × ${nfx(Math.pow(1 + i, m * v.years), 6)} = ${money(fvN)}`],
        ['In today\'s dollars', `${money(fvN)} ÷ (1 + ${pct(infl, 2)})^${v.years} = ${money(fvReal)}`]
      ],
      charts: [
        { title: 'What more frequent compounding adds', sub: 'Extra yield over the stated APR, in percentage points. It flattens fast.', series: [{ name: 'EAR − APR', type: 'bars', color: 'c1', pts: gain }], xLabels: [...freqs.map(f => f[1]), 'Cont.'], yFmt: x => x.toFixed(2), yRead: x => x.toFixed(3) + ' pts' },
        {
          title: 'Growth of your money', sub: 'Compare compounding choices, and what inflation does to purchasing power.',
          series: [
            { name: 'Annual compounding', type: 'line', color: 'c3', pts: ys.map(y => [y, v.p * Math.pow(1 + apr, y)]) },
            { name: `${m}× per year`, type: 'line', color: 'c1', pts: ys.map(y => [y, v.p * Math.pow(1 + i, m * y)]) },
            { name: 'Continuous', type: 'line', color: 'c2', dash: true, pts: ys.map(y => [y, v.p * Math.exp(apr * y)]) },
            { name: "In today's dollars", type: 'line', color: 'c4', pts: ys.map(y => [y, v.p * Math.pow(1 + i, m * y) / Math.pow(1 + infl, y)]) }
          ], xlab: 'Years', yFmt: compact, yRead: money
        }
      ]
    };
  }
});

register({
  id: 'annuity', group: 'Foundations', title: 'Annuities & Perpetuities',
  blurb: 'Present and future value of level or growing payment streams. See each payment shrink as it is discounted.',
  fields: [
    { id: 'c', label: 'First payment', v: 1000, step: 100, pre: '$' },
    { id: 'r', label: 'Discount rate', v: 8, step: 0.25, unit: '%', slider: [0.5, 20, 0.25] },
    { id: 'g', label: 'Payment growth rate', v: 0, step: 0.25, unit: '%', slider: [0, 10, 0.25] },
    { id: 'n', label: 'Number of payments', v: 10, step: 1, min: 1, slider: [1, 40, 1] },
    { id: 'when', label: 'Payments are made', type: 'select', v: '0', options: [['0', 'End of period (ordinary annuity)'], ['1', 'Start of period (annuity due)']] }
  ],
  concept: `<h4>The idea</h4>
<p>An annuity is a stream of payments. You value it by discounting each payment back to today and adding them up. The formulas below are just that sum written compactly.</p>
<div class="formula">PV = C · [1 − (1+r)^−n] ÷ r</div>
<div class="formula">Growing: PV = C · [1 − ((1+g)/(1+r))^n] ÷ (r − g)</div>
<div class="formula">Perpetuity: PV = C ÷ r      Growing perpetuity: PV = C ÷ (r − g)</div>
<div class="formula">Annuity due = ordinary annuity × (1 + r)</div>
<ul><li>A perpetuity is just the limit of an annuity as n grows. Distant payments are worth very little today, so a 40-year annuity at 8% already captures about 95% of a perpetuity.</li><li>The growing formulas need r &gt; g for a perpetuity to have a finite value.</li></ul>
<h4>Common mistakes</h4>
<ul><li>Using the ordinary-annuity formula when the first payment is today.</li><li>Treating the first payment of a growing stream as C(1+g). Here C is the first payment itself.</li></ul>`,
  calc(v) {
    const C = v.c, r = v.r / 100, g = v.g / 100, n = Math.max(1, Math.round(v.n)), t = +v.when;
    const ord = Math.abs(r - g) < 1e-12 ? C * n / (1 + r) : C * (1 - Math.pow((1 + g) / (1 + r), n)) / (r - g);
    const PV = ord * Math.pow(1 + r, t), FV = PV * Math.pow(1 + r, n);
    const perp = r > g ? C / (r - g) * Math.pow(1 + r, t) : NaN;
    const rows = []; let cum = 0;
    for (let k = 1; k <= n; k++) {
      const time = k - 1 + (1 - t), cf = C * Math.pow(1 + g, k - 1), df = Math.pow(1 + r, -time), pv = cf * df;
      cum += pv; rows.push({ k, time, cf, df, pv, cum });
    }
    const total = sum(rows.map(x => x.cf));
    const charts = [{
      title: 'Discounting every payment', sub: 'Each payment (amber) is worth less today (teal). The running total climbs toward the present value.',
      series: [
        { name: 'Payment', type: 'bars', color: 'c2', pts: rows.map(x => [x.k, x.cf]) },
        { name: 'Present value', type: 'bars', color: 'c1', pts: rows.map(x => [x.k, x.pv]) },
        { name: 'Running present value', type: 'line', color: 'c3', pts: rows.map(x => [x.k, x.cum]) }
      ], xlab: 'Payment number', yFmt: compact, yRead: money
    }];
    if (r > g) {
      const N2 = Math.max(40, n + 20), st = Math.max(1, Math.ceil(N2 / 60)), xs = range(0, N2, st);
      charts.push({
        title: 'How close does an annuity get to a perpetuity?', sub: 'Share of the perpetuity\'s value captured by the first n payments.',
        series: [{ name: 'Annuity ÷ perpetuity', type: 'area', color: 'c1', pts: xs.map(k => [k, (1 - Math.pow((1 + g) / (1 + r), k)) * 100]) }],
        vlines: [{ x: n, label: `your n = ${n}`, color: 'c4' }], hlines: [{ y: 100, label: 'perpetuity' }], xlab: 'Number of payments', yFmt: x => x + '%', yRead: x => x.toFixed(1) + '%', yDomain: [0, 105]
      });
    }
    return {
      cards: [
        { key: true, label: 'Present value', value: money(PV), sub: t ? 'annuity due' : 'ordinary annuity' },
        { label: 'Future value at the end', value: money(FV), sub: `PV × (1 + r)^${n}` },
        { label: 'Perpetuity value', value: isNum(perp) ? money(perp) : 'Infinite', sub: isNum(perp) ? `annuity is ${nf(PV / perp * 100, 1)}% of it` : 'requires r > g' },
        { label: 'Sum of payments', value: money(total), sub: `${money(total - PV)} lost to discounting` }
      ],
      steps: [
        ['Ordinary-annuity value', Math.abs(r - g) < 1e-12 ? `r = g, so PV = C·n ÷ (1+r) = ${money(ord)}` : `PV = C·[1 − ((1+g)/(1+r))^n] ÷ (r − g)\n   = ${money(C)} × [1 − (${nfx(1 + g, 4)} ÷ ${nfx(1 + r, 4)})^${n}] ÷ ${nfx(r - g, 4)} = ${money(ord)}`],
        ['Timing adjustment', t ? `Annuity due: × (1 + r) = ${money(ord)} × ${nfx(1 + r, 4)} = ${money(PV)}` : 'Payments at the end of each period, so no adjustment.'],
        ['Future value', `FV = PV × (1 + r)^n = ${money(PV)} × ${nfx(Math.pow(1 + r, n), 6)} = ${money(FV)}`],
        ['Perpetuity', isNum(perp) ? `PV = C ÷ (r − g)${t ? ' × (1 + r)' : ''} = ${money(C)} ÷ ${nfx(r - g, 4)}${t ? ' × ' + nfx(1 + r, 4) : ''} = ${money(perp)}` : 'Because r ≤ g the payments grow as fast as they are discounted, so the value is unbounded.']
      ],
      charts,
      tables: [{ title: 'Payment schedule', cols: ['#', 'Time', 'Payment', 'Discount factor', 'Present value', 'Running PV'], rows: rows.map(x => [x.k, nf(x.time, 0), money(x.cf), nfx(x.df, 5), money(x.pv), money(x.cum)]), collapsed: n > 12 }]
    };
  }
});

register({
  id: 'loan', group: 'Foundations', title: 'Loan Amortization',
  blurb: 'Payment, total interest and a full schedule. Add extra payments and see how many years and dollars you save.',
  fields: [
    { id: 'amt', label: 'Loan amount', v: 250000, step: 5000, pre: '$' },
    { id: 'apr', label: 'Annual interest rate', v: 6.5, step: 0.125, unit: '%', slider: [1, 15, 0.125] },
    { id: 'years', label: 'Term', v: 30, step: 1, unit: 'yrs', slider: [1, 40, 1] },
    { id: 'ppy', label: 'Payments per year', v: 12, step: 1, min: 1 },
    { id: 'extra', label: 'Extra payment each period', v: 0, step: 50, pre: '$', slider: [0, 2000, 50] }
  ],
  concept: `<h4>The idea</h4>
<p>A level-payment loan is an annuity in reverse. The payment is set so the present value of all payments equals the amount borrowed. Early on most of each payment is interest. As the balance falls, more goes to principal.</p>
<div class="formula">PMT = L · i ÷ [1 − (1+i)^−N]</div>
<div class="formula">Interest_k = Balance_(k−1) × i      Principal_k = PMT − Interest_k</div>
<ul><li>Interest is charged on what you still owe, so paying principal early saves interest on every later period.</li><li>Extra payments go straight to principal. On a 30-year mortgage a modest extra amount can remove years from the term.</li></ul>`,
  calc(v) {
    const ppy = Math.max(1, Math.round(v.ppy)), i = v.apr / 100 / ppy, N = Math.max(1, Math.round(v.years * ppy));
    if (!(v.amt >= 1)) return { note: 'Enter a loan amount of at least $1.', cards: [], charts: [], steps: [] };
    const pay = i === 0 ? v.amt / N : v.amt * i / (1 - Math.pow(1 + i, -N));
    const sched = ex => { const rows = []; let bal = v.amt; for (let k = 1; k <= N + 2 && bal > 0.005; k++) { const int = bal * i; let p = pay + ex; if (p > bal + int) p = bal + int; const pr = p - int; bal = Math.max(0, bal - pr); rows.push({ k, pay: p, int, pr, bal }); } return rows; };
    const base = sched(0), act = sched(Math.max(0, v.extra));
    const totInt = sum(act.map(r => r.int)), baseInt = sum(base.map(r => r.int));
    const Y = Math.ceil(act.length / ppy), yi = Array(Y).fill(0), yp = Array(Y).fill(0);
    act.forEach(r => { const y = Math.ceil(r.k / ppy) - 1; yi[y] += r.int; yp[y] += r.pr; });
    const YB = Math.ceil(base.length / ppy), balAt = (rows, k) => (k === 0 ? v.amt : rows[k - 1] ? rows[k - 1].bal : 0);
    const first = base[0];
    const charts = [
      { title: 'Where each year\'s payments go', sub: 'Interest (rose) shrinks while principal (teal) grows.', bars: 'stack', series: [{ name: 'Principal', type: 'bars', color: 'c1', pts: yp.map((y, k) => [k + 1, y]) }, { name: 'Interest', type: 'bars', color: 'c4', pts: yi.map((y, k) => [k + 1, y]) }], xlab: 'Year', yFmt: compact, yRead: money },
      { title: 'Balance remaining', sub: v.extra > 0 ? 'Extra payments pull the payoff date forward.' : 'Balance owed at the end of each year.', series: [{ name: 'Scheduled', type: 'area', color: 'c3', pts: range(0, YB, 1).map(y => [y, balAt(base, y * ppy)]) }].concat(v.extra > 0 ? [{ name: 'With extra payments', type: 'line', color: 'c1', pts: range(0, YB, 1).map(y => [y, balAt(act, y * ppy)]) }] : []), xlab: 'Year', yFmt: compact, yRead: money }
    ];
    return {
      cards: [
        { key: true, label: 'Payment each period', value: money(pay), sub: v.extra > 0 ? `${money(pay + v.extra)} with extra` : `${ppy} per year` },
        { label: 'Total interest', value: money(totInt), sub: `${nf(totInt / v.amt * 100, 1)}% of the loan` },
        { label: 'Total paid', value: money(v.amt + totInt), sub: `${money(v.amt)} principal + interest` },
        { label: 'Time to pay off', value: yrs(act.length / ppy, 2), sub: `${act.length} payments` },
        ...(v.extra > 0 ? [{ label: 'Interest saved', value: money(baseInt - totInt), sub: `${nf((base.length - act.length) / ppy, 2)} years sooner`, tone: 'good' }] : [])
      ],
      steps: [
        ['Rate per period and number of payments', `i = ${nf(v.apr, 3)}% ÷ ${ppy} = ${pct(i, 4)}     N = ${v.years} × ${ppy} = ${N}`],
        ['Level payment', `PMT = L·i ÷ [1 − (1+i)^−N] = ${money(v.amt, 0)} × ${nfx(i, 6)} ÷ [1 − ${nfx(Math.pow(1 + i, -N), 6)}] = ${money(pay)}`],
        ['First payment split', `Interest = ${money(v.amt)} × ${pct(i, 4)} = ${money(first.int)}\nPrincipal = ${money(pay)} − ${money(first.int)} = ${money(pay - first.int)}\nNew balance = ${money(v.amt)} − ${money(pay - first.int)} = ${money(v.amt - (pay - first.int))}`],
        ['Total interest', `Sum of all payments − amount borrowed = ${money(sum(base.map(r => r.pay)))} − ${money(v.amt)} = ${money(baseInt)}`]
      ],
      charts,
      tables: [{ title: 'Full amortization schedule', collapsed: true, cols: ['#', 'Payment', 'Interest', 'Principal', 'Balance'], rows: act.slice(0, 720).map(r => [r.k, money(r.pay), money(r.int), money(r.pr), money(r.bal)]) }]
    };
  }
});
