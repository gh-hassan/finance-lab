// @ts-nocheck
/* Concept animations. Each scene draws one idea as a short story. draw(t, p) returns the SVG and a live caption.
   t runs 0..1 over the animation; p holds the scene's parameters (sliders, or numbers from a calculator). */
import { money, nf, sum } from '../lib/math';
import { esc, h, reduced } from './visuals.js';

const M = x => money(x, 0);
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const lerp = (a, b, u) => a + (b - a) * u;
const ease = u => (u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2);
const seg = (t, a, b) => clamp((t - a) / (b - a), 0, 1);
const tx = (x, y, s, o = {}) => `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="${o.a || 'middle'}" font-size="${o.s || 15}" font-weight="${o.w || 700}" style="fill:${o.c || 'var(--ink)'}" ${o.op != null ? `opacity="${o.op}"` : ''}>${esc(s)}</text>`;
const rect = (x, y, w, hh, f, o = {}) => `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${Math.max(0, w).toFixed(1)}" height="${Math.max(0, hh).toFixed(1)}" rx="${o.r == null ? 8 : o.r}" fill="${f}" ${o.stroke ? `stroke="${o.stroke}" stroke-width="${o.sw || 2}"` : ''} ${o.dash ? 'stroke-dasharray="6 5"' : ''} ${o.op != null ? `opacity="${o.op}"` : ''}/>`;
const circ = (x, y, r, f, o = {}) => `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${Math.max(0, r).toFixed(1)}" fill="${f}" ${o.stroke ? `stroke="${o.stroke}" stroke-width="${o.sw || 2}"` : ''} ${o.op != null ? `opacity="${o.op}"` : ''}/>`;
const line = (x1, y1, x2, y2, c = 'var(--line)', w = 2, dash) => `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${c}" stroke-width="${w}" stroke-linecap="round" ${dash ? 'stroke-dasharray="5 5"' : ''}/>`;
const coin = (x, y, r = 10, op = 1) => `<g opacity="${op}"><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(1)}" fill="#FFD45C" stroke="#E0A200" stroke-width="2"/><text x="${x.toFixed(1)}" y="${(y + r * 0.36).toFixed(1)}" text-anchor="middle" font-size="${(r * 1.1).toFixed(1)}" font-weight="800" fill="#9A6A00">$</text></g>`;
const face = (x, y, r, f, happy = true) => `${circ(x, y, r, f)}${circ(x - r * 0.35, y - r * 0.15, r * 0.1, '#17120F')}${circ(x + r * 0.35, y - r * 0.15, r * 0.1, '#17120F')}<path d="M${(x - r * 0.4).toFixed(1)} ${(y + r * 0.3).toFixed(1)} Q${x.toFixed(1)} ${(y + r * (happy ? 0.65 : 0.1)).toFixed(1)} ${(x + r * 0.4).toFixed(1)} ${(y + r * 0.3).toFixed(1)}" stroke="#17120F" stroke-width="2.4" fill="none" stroke-linecap="round"/>`;
const pill = (x, y, s, f = 'var(--soft)', c = 'var(--ink)') => { const w = s.length * 8 + 22; return `${rect(x - w / 2, y - 14, w, 28, f, { r: 14 })}${tx(x, y + 5, s, { s: 13, c })}`; };

function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function gauss(r) { return Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r()); }
const series = (seed, n) => { const r = rng(seed); return Array.from({ length: n }, () => gauss(r)); };
const niceUnit = (max, cap) => { for (const u of [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000, 100000, 200000, 500000, 1e6, 2e6, 5e6, 1e7]) if (max / u <= cap) return u; return 1e8; };
const timeline = (t, x0, x1, y, label) => `${line(x0, y, x1, y, 'var(--line)', 6)}${line(x0, y, lerp(x0, x1, t), y, 'var(--c1)', 6)}${circ(lerp(x0, x1, t), y, 9, 'var(--c1)', { stroke: 'var(--panel-solid)', sw: 3 })}${tx((x0 + x1) / 2, y + 26, label, { s: 13, c: 'var(--mute)', w: 600 })}`;

export const SCENES = {
  rent: {
    chapter: 'Money and time', title: 'Interest is rent for money', plain: 'When you borrow money, you pay a little extra for using it. That extra is called interest.',
    how: ['Sam has money and lends it to Alex.', 'Alex uses it for a year.', 'Alex pays back what he borrowed plus a thank-you fee. The fee is the interest.'],
    words: [['Interest', 'The fee for borrowing money.'], ['Interest rate', 'The fee as a percent of the loan, per year.'], ['Principal', 'The money you borrowed.']],
    params: [{ id: 'amount', label: 'Amount lent', min: 100, max: 5000, step: 100, v: 1000, fmt: M }, { id: 'rate', label: 'Interest rate per year', min: 1, max: 20, step: 1, v: 8, fmt: x => x + '%' }], link: '/rates',
    draw(t, p) {
      const fee = p.amount * p.rate / 100, a = seg(t, 0.05, 0.32), b = seg(t, 0.32, 0.58), c = seg(t, 0.62, 0.95);
      let g = face(80, 150, 36, 'var(--sky)') + tx(80, 212, 'Sam (lender)', { s: 14 }) + face(440, 150, 36, 'var(--pink)', c > 0.5 || b < 1) + tx(440, 212, 'Alex (borrower)', { s: 14 });
      let cap = 'Sam has ' + M(p.amount) + ' to lend.';
      if (a > 0 && c === 0) { const cx = lerp(110, 410, ease(a)), cy = 150 - Math.sin(a * Math.PI) * 60; g += coin(cx, cy, 20) + tx(cx, cy - 32, M(p.amount), { s: 14 }); cap = a < 1 ? `Step 1: Sam hands over ${M(p.amount)}.` : 'Step 2: Alex uses the money for a year, maybe to buy tools for his shop.'; }
      else if (c === 0) g += coin(80, 100, 20);
      if (b > 0 && c === 0) { for (let k = 0; k < 6; k++) g += circ(440 + Math.cos(b * 6 + k) * 54, 120 + Math.sin(b * 6 + k * 1.7) * 30, 3 + (k % 3), 'var(--sun)', { op: 0.9 }); cap = 'Step 2: Alex uses the money for a year, maybe to buy tools for his shop.'; }
      if (c > 0) { const cx = lerp(410, 110, ease(c)), cy = 150 - Math.sin(c * Math.PI) * 60; g += coin(cx, cy, 20) + coin(cx + 30, cy + 14, 11) + tx(cx, cy - 34, M(p.amount + fee), { s: 14 }); cap = c < 1 ? `Step 3: Alex pays back ${M(p.amount)} plus ${M(fee)} extra.` : `Done. Sam gets ${M(p.amount + fee)} back. The extra ${M(fee)} is the interest: ${p.rate}% of ${M(p.amount)}.`; }
      g += pill(260, 268, `Fee = ${p.rate}% of ${M(p.amount)} = ${M(fee)}`, 'color-mix(in srgb, var(--c3) 22%, transparent)');
      return { svg: g, cap };
    }
  },
  growth: {
    chapter: 'Money and time', title: 'Money grows while it waits', plain: 'Money in the bank earns interest. Money in a jar does not. Over time the difference gets big.',
    how: ['You start with some money and add a little each year.', 'The jar keeps it safe, but it never grows.', 'The bank pays interest, so the pile gets taller every year.'],
    words: [['Savings', 'Money you set aside.'], ['Return', 'The extra money your money earns.'], ['Time', 'The most powerful ingredient. Start early.']],
    params: [{ id: 'start', label: 'Start with', min: 0, max: 10000, step: 500, v: 1000, fmt: M }, { id: 'add', label: 'Add each year', min: 0, max: 5000, step: 100, v: 600, fmt: M }, { id: 'rate', label: 'Bank pays per year', min: 1, max: 12, step: 0.5, v: 6, fmt: x => x + '%' }, { id: 'years', label: 'For how many years', min: 5, max: 40, step: 1, v: 25, fmt: x => x + ' yrs' }], link: '/tvm',
    draw(t, p) {
      const r = p.rate / 100, m = p.mpy || 1, im = r / m, val = y => { const n = m * y; const g = Math.pow(1 + im, n); return p.start * g + (p.add / m) * (im ? (g - 1) / im : n); };
      const y = t * p.years, jar = p.start + p.add * y, bank = val(y), top = val(p.years), unit = niceUnit(top, 60);
      const stack = (x0, n, f) => { let s = ''; for (let i = 0; i < Math.min(80, n); i++) { const col = Math.floor(i / 10), row = i % 10; s += circ(x0 + col * 15 + 7, 222 - row * 14, 6.2, f, { stroke: '#E0A200', sw: 1.2 }); } return s; };
      let g = rect(36, 84, 190, 150, 'none', { stroke: 'var(--mute)', dash: true, op: 0.7 }) + tx(131, 70, 'In a jar', { s: 16 }) + stack(48, Math.round(jar / unit), '#FFD45C');
      g += rect(286, 84, 190, 150, 'color-mix(in srgb, var(--c3) 12%, transparent)', { stroke: 'var(--c3)' }) + tx(381, 70, 'In the bank', { s: 16 }) + stack(298, Math.round(bank / unit), '#FFD45C');
      g += tx(131, 256, M(jar), { s: 18 }) + tx(381, 256, M(bank), { s: 18, c: 'var(--c3)' }) + tx(260, 160, 'vs', { s: 14, c: 'var(--mute)' }) + tx(496, 112, `1 coin = ${M(unit)}`, { a: 'end', s: 11, c: 'var(--mute)', w: 600 });
      g += timeline(t, 60, 460, 284, `Year ${Math.round(y)} of ${p.years}`);
      return { svg: g, cap: `Year ${Math.round(y)}: the jar has ${M(jar)}. The bank has ${M(bank)}. That is ${M(bank - jar)} of free money from interest.` };
    }
  },
  snowball: {
    chapter: 'Money and time', title: 'The money snowball (compounding)', plain: 'Interest earns interest. Like a snowball rolling downhill, the bigger it gets, the faster it grows.',
    how: ['Year 1: interest is paid on your starting money.', 'Year 2: interest is paid on your money and on last year\'s interest.', 'Each year the "interest on interest" slice gets bigger.'],
    words: [['Compounding', 'Earning interest on your interest.'], ['Simple interest', 'Interest on the starting money only.'], ['Rule of 72', '72 ÷ rate = years to double your money.']],
    params: [{ id: 'start', label: 'Start with', min: 500, max: 20000, step: 500, v: 5000, fmt: M }, { id: 'rate', label: 'Interest per year', min: 1, max: 15, step: 0.5, v: 8, fmt: x => x + '%' }, { id: 'years', label: 'Years', min: 5, max: 40, step: 1, v: 30, fmt: x => x + ' yrs' }], link: '/rates',
    draw(t, p) {
      const r = p.rate / 100, m = p.m || 1, fv = y => p.start * Math.pow(1 + r / m, m * y), y = t * p.years, now = fv(y), top = fv(p.years);
      const simple = p.start * r * y, onInt = Math.max(0, now - p.start - simple);
      const hx = u => 36 + 448 * u, hy = u => 40 + 130 * (1 - Math.pow(1 - u, 2));
      let d = 'M36 40'; for (let u = 0; u <= 1.001; u += 0.05) d += `L${hx(u).toFixed(1)} ${hy(u).toFixed(1)}`;
      d += 'L484 200L36 200Z';
      const rad = 9 + 34 * Math.sqrt(Math.max(0, now - p.start) / Math.max(1, top - p.start));
      let g = `<path d="${d}" fill="color-mix(in srgb, var(--sky) 35%, transparent)"/>` + circ(hx(t), hy(t) - rad, rad, 'var(--panel-solid)', { stroke: 'var(--sky)', sw: 3 }) + tx(hx(t), hy(t) - rad + 5, M(now), { s: clamp(rad * 0.42, 10, 15) });
      const W = 440, sc = W / Math.max(1, top), x0 = 40;
      g += rect(x0, 222, p.start * sc, 26, 'var(--sky)', { r: 6 }) + rect(x0 + p.start * sc, 222, simple * sc, 26, 'var(--mint)', { r: 0 }) + rect(x0 + (p.start + simple) * sc, 222, onInt * sc, 26, 'var(--coral)', { r: 6 });
      g += `<g font-size="12">${circ(48, 270, 6, 'var(--sky)')}${tx(60, 274, 'Your money', { a: 'start', s: 12, w: 600 })}${circ(168, 270, 6, 'var(--mint)')}${tx(180, 274, 'Interest on your money', { a: 'start', s: 12, w: 600 })}${circ(340, 270, 6, 'var(--coral)')}${tx(352, 274, 'Interest on interest', { a: 'start', s: 12, w: 600 })}</g>`;
      return { svg: g, cap: `Year ${Math.round(y)}: ${M(now)}. Of that growth, ${M(simple)} is interest on your starting money and ${M(onInt)} is interest on earlier interest.` };
    }
  },
  inflation: {
    chapter: 'Money and time', title: 'Prices go up, so money shrinks', plain: 'Inflation means things cost more each year. The same money buys less and less.',
    how: ['Today $20 buys 20 apples at $1 each.', 'Each year the price creeps up by the inflation rate.', 'The same $20 now buys fewer apples. Your money lost buying power.'],
    words: [['Inflation', 'Prices rising over time.'], ['Buying power', 'How much your money can actually buy.'], ['Real return', 'Your return after inflation is taken out.']],
    params: [{ id: 'infl', label: 'Inflation per year', min: 1, max: 12, step: 0.5, v: 4, fmt: x => x + '%' }, { id: 'years', label: 'Years', min: 5, max: 40, step: 1, v: 20, fmt: x => x + ' yrs' }], link: '/rates',
    draw(t, p) {
      const y = t * p.years, price = Math.pow(1 + p.infl / 100, y), n = Math.floor(20 / price + 1e-9);
      let g = '';
      for (let k = 0; k < 20; k++) { const x = 44 + (k % 10) * 46, yy = k < 10 ? 112 : 168, on = k < n; g += `<g opacity="${on ? 1 : 0.18}">${circ(x, yy, 15, on ? '#E5484D' : 'none', { stroke: '#E5484D', sw: 2 })}<path d="M${x} ${yy - 14} q2 -9 9 -10" stroke="#3B9B4E" stroke-width="3" fill="none" stroke-linecap="round"/></g>`; }
      g += pill(260, 48, `1 apple costs ${money(price, 2)}`, 'color-mix(in srgb, var(--c1) 22%, transparent)') + tx(260, 232, `Your $20 buys ${n} apples`, { s: 20 }) + tx(260, 256, `(it bought 20 when prices were lower)`, { s: 13, c: 'var(--mute)', w: 600 });
      g += timeline(t, 60, 460, 284, `Year ${Math.round(y)}`);
      return { svg: g, cap: `Year ${Math.round(y)}: an apple costs ${money(price, 2)}. Your $20 now buys ${n} apples, so your money lost ${nf((1 - n / 20) * 100, 0)}% of its buying power.` };
    }
  },
  present: {
    chapter: 'Money and time', title: 'Money later is worth less today', plain: 'A promise of $1,000 in ten years is worth less than $1,000 in your hand now, because money in hand can earn interest.',
    how: ['A coin waits in the future with its full amount.', 'We slide it back to today. Every year we move it, it shrinks by the interest it could have earned.', 'What is left is its "present value": what it is worth today.'],
    words: [['Present value', 'What future money is worth today.'], ['Discount rate', 'The yearly shrink rate used when sliding money back.'], ['Future value', 'What money today will be worth later.']],
    params: [{ id: 'amount', label: 'Money you will get', min: 100, max: 5000, step: 100, v: 1000, fmt: M }, { id: 'years', label: 'In how many years', min: 1, max: 30, step: 1, v: 10, fmt: x => x + ' yrs' }, { id: 'rate', label: 'Discount rate', min: 1, max: 20, step: 0.5, v: 6, fmt: x => x + '%' }], link: '/annuity',
    draw(t, p) {
      const flows = p.flows && p.flows.length ? p.flows : [{ y: p.years, a: p.amount }], r = p.rate / 100, N = Math.max(...flows.map(f => f.y)), u = ease(t), maxA = Math.max(...flows.map(f => f.a)) || 1;
      const X = yy => 60 + 400 * yy / N;
      let g = line(60, 214, 460, 214, 'var(--line)', 6);
      const step = N <= 12 ? 1 : Math.ceil(N / 6);
      for (let k = 0; k <= N; k += step) g += line(X(k), 208, X(k), 220, 'var(--mute)', 2) + tx(X(k), 238, k === 0 ? 'Today' : 'Yr ' + k, { s: 12, c: 'var(--mute)', w: 600 });
      let now = 0, nominal = 0, pv = 0; const many = flows.length > 6;
      flows.forEach((f, i) => { const d = f.y * u, val = f.a / Math.pow(1 + r, d), cur = f.y - d; now += val; nominal += f.a; pv += f.a / Math.pow(1 + r, f.y); const rad = (many ? 5 : 9) + (many ? 9 : 24) * Math.sqrt(val / maxA); g += coin(X(cur), 160 - (many ? (i % 3) * 14 : 0), rad); if (!many) g += tx(X(cur), 160 - rad - 8, M(val), { s: 14 }); });
      g += pill(260, 44, p.flows && p.flows.length > 1 ? `Worth right now: ${M(now)}` : `This coin is now worth ${M(now)}`, 'color-mix(in srgb, var(--c3) 22%, transparent)');
      const cap = u < 0.03 ? `These payments add up to ${M(nominal)} on paper. Watch them slide back to today.` : u < 0.999 ? `Sliding back at ${p.rate}% a year: the money shrinks as it moves toward today.` : `Today they are worth only ${p.result || M(pv)}, not ${M(nominal)}. Waiting costs money.`;
      return { svg: g, cap };
    }
  },
  loan: {
    chapter: 'Borrowing and lending', title: 'How a loan gets paid off', plain: 'Each payment has two parts: a fee to the bank (interest) and a real payment on what you owe. At first, most is fee.',
    how: ['The tank is what you still owe.', 'Each month you pay. The bank takes its fee first (rose).', 'The rest (green) empties the tank. As the tank drops, the fee shrinks.'],
    words: [['Loan balance', 'What you still owe.'], ['Principal', 'The part of a payment that reduces what you owe.'], ['Mortgage', 'A loan to buy a home.']],
    params: [{ id: 'amt', label: 'Loan amount', min: 5000, max: 500000, step: 5000, v: 200000, fmt: M }, { id: 'apr', label: 'Interest rate', min: 1, max: 15, step: 0.25, v: 6.5, fmt: x => x + '%' }, { id: 'years', label: 'Years to repay', min: 1, max: 40, step: 1, v: 30, fmt: x => x + ' yrs' }], link: '/loan',
    draw(t, p) {
      const i = p.apr / 1200, n = Math.round(p.years * 12), base = i ? p.amt * i / (1 - Math.pow(1 + i, -n)) : p.amt / n, pay = base + (p.extra || 0), mth = Math.max(1, Math.min(n, Math.ceil(t * n)));
      let bal = p.amt, iPaid = 0, pPaid = 0, int = 0, pr = 0;
      for (let k = 1; k <= mth && bal > 0.01; k++) { int = bal * i; const pay2 = Math.min(pay, bal + int); pr = pay2 - int; bal = Math.max(0, bal - pr); iPaid += int; pPaid += pr; }
      const lvl = bal / p.amt, W = 290, f = int / Math.max(0.01, int + pr);
      let g = rect(40, 50, 100, 190, 'var(--soft)', { r: 14 }) + rect(40, 50 + 190 * (1 - lvl), 100, 190 * lvl, 'color-mix(in srgb, var(--c4) 55%, transparent)', { r: 14 }) + tx(90, 36, 'You still owe', { s: 13, c: 'var(--mute)' }) + tx(90, 150, M(bal), { s: 17 });
      g += tx(335, 60, `Each payment: ${M(pay)}`, { s: 17 }) + rect(190, 76, W, 34, 'var(--c3)', { r: 10 }) + rect(190, 76, W * f, 34, 'var(--c4)', { r: 10 });
      g += tx(190 + (W * f) / 2, 98, f > 0.14 ? 'Fee' : '', { s: 13, c: '#fff' }) + tx(190 + W * f + (W * (1 - f)) / 2, 98, W * (1 - f) > 110 ? 'Pays the loan' : (W * (1 - f) > 40 ? 'Loan' : ''), { s: 13, c: '#fff' });
      g += tx(190, 138, `Fee: ${M(int)}`, { a: 'start', s: 15, c: 'var(--c4)' }) + tx(480, 138, `Loan paid: ${M(pr)}`, { a: 'end', s: 15, c: 'var(--c3)' });
      g += rect(190, 166, W, 74, 'var(--soft)', { r: 12 }) + tx(335, 190, 'So far you have paid', { s: 13, c: 'var(--mute)' }) + tx(260, 220, `${M(iPaid)} in fees`, { s: 15, c: 'var(--c4)' }) + tx(412, 220, `${M(pPaid)} on the loan`, { s: 15, c: 'var(--c3)' });
      g += timeline(t, 60, 460, 276, `Year ${nf(mth / 12, 1)} of ${p.years}`);
      return { svg: g, cap: `Month ${mth}: out of ${M(pay)}, ${M(int)} is the bank's fee and ${M(pr)} reduces what you owe. You still owe ${M(bal)}.` };
    }
  },
  bond: {
    chapter: 'Borrowing and lending', title: 'A bond is an IOU that pays you', plain: 'When you buy a bond, you lend money to a company or government. They pay you a small amount every year and give your money back at the end.',
    how: ['You lend $1,000 by buying the bond.', 'Every year you get a small payment, called a coupon.', 'At the end you get your $1,000 back.'],
    words: [['Bond', 'A loan you make to a company or government.'], ['Coupon', 'The yearly payment the bond pays you.'], ['Maturity', 'The day you get your money back.']],
    params: [{ id: 'face', label: 'You lend', min: 500, max: 5000, step: 500, v: 1000, fmt: M }, { id: 'cr', label: 'Yearly payment rate', min: 1, max: 12, step: 0.5, v: 5, fmt: x => x + '%' }, { id: 'years', label: 'Years', min: 2, max: 10, step: 1, v: 5, fmt: x => x + ' yrs' }], link: '/bond',
    draw(t, p) {
      const N = Math.round(p.years), c = p.face * p.cr / 100, cy = t * N, X = k => 70 + 380 * k / N;
      let g = line(70, 200, 450, 200, 'var(--line)', 6) + line(70, 200, lerp(70, 450, t), 200, 'var(--c1)', 6) + face(52, 120, 24, 'var(--sky)') + tx(52, 166, 'You', { s: 13 });
      let got = 0;
      for (let k = 1; k <= N; k++) { const a = clamp((cy - k) / 0.45 + 1, 0, 1); g += circ(X(k), 200, 5, 'var(--mute)'); g += tx(X(k), 224, k === N ? 'End' : 'Yr ' + k, { s: 12, c: 'var(--mute)', w: 600 }); if (a > 0) { const last = k === N; const drop = lerp(60, 150, ease(a)); g += coin(X(k), drop, last ? 20 : 12, a) + tx(X(k), drop - (last ? 28 : 18), last ? M(c) + ' + ' + M(p.face) : M(c), { s: 12, op: a }); got += c + (last ? p.face : 0); } }
      g += pill(260, 262, `In your pocket: ${M(got)}`, 'color-mix(in srgb, var(--c3) 22%, transparent)');
      const cap = cy < 0.05 ? `You lend ${M(p.face)} by buying the bond.` : cy < N - 0.02 ? `Year ${Math.floor(cy)}: another ${M(c)} drops into your pocket (${p.cr}% of ${M(p.face)}).` : `Finished. You got ${M(c * N)} in payments plus your ${M(p.face)} back = ${M(c * N + p.face)}.${p.result ? ' Today it is worth ' + p.result + ' to buyers.' : ''}`;
      return { svg: g, cap };
    }
  },
  stock: {
    chapter: 'Owning things', title: 'A stock is a slice of a company', plain: 'Buying a stock means you own a small slice of a real business. When the business earns money, your slice earns too.',
    how: ['The pie is the whole company, cut into 10 equal slices.', 'You own some slices (shown in green).', 'When the company shares its profit, each slice gets the same. That payout is a dividend.'],
    words: [['Stock (share)', 'One slice of ownership in a company.'], ['Dividend', 'Profit the company pays out to its owners.'], ['Shareholder', 'A person who owns shares.']],
    params: [{ id: 'own', label: 'Slices you own (of 10)', min: 1, max: 5, step: 1, v: 2, fmt: x => x }, { id: 'profit', label: 'Company profit', min: 10000, max: 1000000, step: 10000, v: 200000, fmt: M }], link: '/ddm',
    draw(t, p) {
      const cx = 150, cy = 150, R = 100, own = Math.round(p.own), share = p.profit * 0.5 / 10; let g = '';
      for (let k = 0; k < 10; k++) { const a0 = (k / 10) * 2 * Math.PI - Math.PI / 2, a1 = ((k + 1) / 10) * 2 * Math.PI - Math.PI / 2, mine = k < own; g += `<path d="M${cx} ${cy}L${(cx + R * Math.cos(a0)).toFixed(1)} ${(cy + R * Math.sin(a0)).toFixed(1)}A${R} ${R} 0 0 1 ${(cx + R * Math.cos(a1)).toFixed(1)} ${(cy + R * Math.sin(a1)).toFixed(1)}Z" fill="${mine ? 'var(--mint)' : 'color-mix(in srgb, var(--lav) 55%, transparent)'}" stroke="var(--panel-solid)" stroke-width="3"/>`; }
      g += tx(cx, cy + 6, 'Company', { s: 15 });
      const u = ease(seg(t, 0.1, 0.8));
      for (let k = 0; k < 10; k++) { const am = ((k + 0.5) / 10) * 2 * Math.PI - Math.PI / 2, tx2 = cx + (R - 18) * Math.cos(am), ty2 = cy + (R - 18) * Math.sin(am); const mine = k < own, px = lerp(cx, tx2, u), py = lerp(cy, ty2, u); if (u > 0 && u < 1) g += coin(px, py, 8); if (mine && u >= 1) { const w = seg(t, 0.8, 1); g += coin(lerp(tx2, 360, ease(w)), lerp(ty2, 150 + (k % 3) * 12, ease(w)), 8, 1); } }
      const w = seg(t, 0.8, 1), got = share * own * w;
      g += rect(330, 100, 170, 100, 'var(--soft)', { r: 16 }) + tx(415, 126, 'Your pocket', { s: 13, c: 'var(--mute)' }) + tx(415, 168, M(got), { s: 26, c: 'var(--c3)' });
      g += tx(415, 232, `Profit ${M(p.profit)}`, { s: 13, c: 'var(--mute)', w: 600 }) + tx(415, 252, `Half paid out: ${M(p.profit / 2)}`, { s: 13, c: 'var(--mute)', w: 600 });
      return { svg: g, cap: u < 1 ? 'The company made a profit and starts sharing it with its owners, slice by slice.' : `Each slice gets ${M(share)}. You own ${own} of 10 slices, so your dividend is ${M(share * own)}.` };
    }
  },
  leverage: {
    chapter: 'Owning things', title: 'Borrowing magnifies wins and losses', plain: 'Using borrowed money makes your gains bigger when things go well, and your losses bigger when they do not.',
    how: ['Two people buy the same $100 house. One pays all cash. One borrows part of it.', 'The house price changes.', 'The borrower\'s gain or loss is bigger compared with the money they actually put in.'],
    words: [['Leverage', 'Using borrowed money to invest.'], ['Equity', 'The part you own with your own money.'], ['Debt', 'Money you owe.']],
    params: [{ id: 'debt', label: 'Share borrowed', min: 10, max: 90, step: 10, v: 60, fmt: x => x + '%' }, { id: 'change', label: 'House price change', min: -30, max: 30, step: 5, v: 20, fmt: x => (x > 0 ? '+' : '') + x + '%' }, { id: 'rate', label: 'Loan interest', min: 0, max: 10, step: 1, v: 5, fmt: x => x + '%' }], link: '/capstruct',
    draw(t, p) {
      const ch = p.change * ease(t), house = 100 * (1 + ch / 100), D = p.debt, E = 100 - D, interest = D * p.rate / 100 * ease(t), gain = house - 100;
      const retCash = gain, retBorrow = (gain - interest) / E * 100, col = v => (v >= 0 ? 'var(--c3)' : 'var(--c4)');
      const col1 = (x, dd, ret, ttl, eq) => rect(x, 60, 150, 140, 'var(--soft)', { r: 14 }) + rect(x, 200 - 140 * Math.min(1, dd / 100), 150, 140 * Math.min(1, dd / 100), 'color-mix(in srgb, var(--c4) 45%, transparent)', { r: 14 }) + tx(x + 75, 44, ttl, { s: 15 }) + tx(x + 75, 128, dd > 0 ? `Borrowed ${M(dd)}` : '', { s: 12, c: 'var(--mute)' }) + tx(x + 75, 170, `You put in ${M(eq)}`, { s: 13 }) + tx(x + 75, 232, `${ret >= 0 ? '+' : '−'}${nf(Math.abs(ret), 0)}%`, { s: 28, c: col(ret) }) + tx(x + 75, 254, 'on your own money', { s: 12, c: 'var(--mute)', w: 600 });
      const g = col1(70, 0, retCash / 100 * 100, 'All your own money', 100) + col1(300, D, retBorrow, 'Borrowing ' + D + '%', E) + pill(260, 280, `House is worth ${M(house)} (${ch >= 0 ? '+' : ''}${nf(ch, 0)}%)`);
      return { svg: g, cap: `The house moved ${nf(ch, 0)}%. With cash only, you ${gain >= 0 ? 'gain' : 'lose'} ${nf(Math.abs(retCash), 0)}%. By borrowing, your ${M(E)} ${retBorrow >= 0 ? 'gains' : 'loses'} ${nf(Math.abs(retBorrow), 0)}%. Bigger swings both ways.` };
    }
  },
  risk: {
    chapter: 'Risk', title: 'More risk, bumpier ride', plain: 'Investments that can earn more also jump around more. Safe ones are steady but grow slowly.',
    how: ['Three roads, each starting with $100.', 'Savings are smooth and slow. Stocks swing a lot but usually climb higher over 20 years.', 'Press "Roll again" for a different future. The bumps change, the pattern stays.'],
    words: [['Risk', 'How much the value can jump around.'], ['Return', 'How much it grows on average.'], ['Volatility', 'A fancy word for how bumpy the ride is.']],
    params: [], seeded: true, link: '/returns',
    draw(t, p) {
      const lanes = [['Savings account', 3, 0.6, 'var(--c3)'], ['Bonds', 5, 5, 'var(--c2)'], ['Stocks', 9, 17, 'var(--c1)']], N = 20;
      const data = lanes.map((l, i) => { const z = series((p.seed || 1) * 97 + i * 13, N); let v = 100; return [100, ...z.map(zz => (v *= 1 + (l[1] + l[2] * zz) / 100))]; });
      const top = Math.max(...data.flat()) * 1.05, X = k => 50 + 430 * k / N, Y = v => 250 - 220 * v / top, pos = t * N, k0 = Math.floor(pos), fr = pos - k0;
      let g = line(50, Y(100), 480, Y(100), 'var(--line)', 2, true) + tx(46, Y(100) + 4, '$100', { a: 'end', s: 11, c: 'var(--mute)', w: 600 });
      const vals = data.map((arr, i) => { let d = ''; const lim = Math.min(N, k0); for (let k = 0; k <= lim; k++) d += (k ? 'L' : 'M') + X(k).toFixed(1) + ' ' + Y(arr[k]).toFixed(1); let cur = arr[lim]; if (lim < N) { cur = lerp(arr[lim], arr[lim + 1], fr); d += `L${X(pos).toFixed(1)} ${Y(cur).toFixed(1)}`; } g += `<path d="${d}" fill="none" stroke="${lanes[i][3]}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>` + circ(X(Math.min(pos, N)), Y(cur), 5, lanes[i][3], { stroke: 'var(--panel-solid)', sw: 2 }); return cur; });
      lanes.forEach((l, i) => { g += circ(60 + i * 140, 20, 6, l[3]) + tx(70 + i * 140, 25, `${l[0]} ${M(vals[i])}`, { a: 'start', s: 12 }); });
      g += tx(265, 282, `Year ${Math.round(pos)} of ${N}`, { s: 13, c: 'var(--mute)', w: 600 });
      return { svg: g, cap: `Year ${Math.round(pos)}: savings ${M(vals[0])}, bonds ${M(vals[1])}, stocks ${M(vals[2])}. See how the stocks line zig-zags while savings glide.` };
    }
  },
  diversify: {
    chapter: 'Risk', title: 'Do not put all your eggs in one basket', plain: 'If you spread your money across many things, one bad thing cannot ruin you.',
    how: ['Your money is 12 eggs. Choose how many baskets to spread them over.', 'Then one company fails and its basket drops.', 'With more baskets, you lose far less.'],
    words: [['Diversification', 'Spreading money across many investments.'], ['Portfolio', 'All your investments together.'], ['Bankruptcy', 'When a company fails and its stock becomes worthless.']],
    params: [{ id: 'n', label: 'Number of baskets', min: 0, max: 5, step: 1, v: 0, fmt: x => [1, 2, 3, 4, 6, 12][x] }], link: '/portfolio',
    draw(t, p) {
      const n = [1, 2, 3, 4, 6, 12][Math.round(p.n)], per = 12 / n, W = 460, bw = Math.min(110, W / n - 10), crash = ease(seg(t, 0.4, 0.75)); let g = '';
      for (let b = 0; b < n; b++) {
        const cx = 30 + (W / n) * (b + 0.5), broken = b === 0 && crash > 0, shake = broken && crash < 1 ? Math.sin(t * 90) * 3 : 0, cols = Math.min(per, n === 1 ? 6 : 3);
        g += `<g transform="translate(${shake.toFixed(1)} ${broken ? (crash * 30).toFixed(1) : 0})">` + rect(cx - bw / 2, 140, bw, 70, broken ? 'color-mix(in srgb, var(--c4) 40%, transparent)' : 'color-mix(in srgb, var(--sun) 55%, transparent)', { r: 10 }) + `<path d="M${cx - bw / 3} 140 Q${cx} 90 ${cx + bw / 3} 140" fill="none" stroke="var(--mute)" stroke-width="3"/></g>`;
        for (let k = 0; k < per; k++) { const ex = cx - ((cols - 1) * 15) / 2 + (k % cols) * 15, ey = 170 + Math.floor(k / cols) * 14, fall = broken ? crash * (90 + (k % 3) * 20) : 0; g += `<ellipse cx="${ex.toFixed(1)}" cy="${(ey + fall).toFixed(1)}" rx="6" ry="8" fill="${broken && crash > 0.3 ? '#E5484D' : '#FFF4DC'}" stroke="#D9B26C" stroke-width="1.5" opacity="${broken ? clamp(1.3 - crash, 0.2, 1) : 1}"/>`; }
      }
      const left = crash > 0.02 ? 1 - crash / n : 1, money_ = 1000 * left;
      g += tx(260, 40, crash > 0.05 ? 'A company goes bankrupt!' : 'Your $1,000 is spread over ' + n + (n === 1 ? ' basket' : ' baskets'), { s: 18, c: crash > 0.05 ? 'var(--c4)' : 'var(--ink)' }) + pill(260, 262, `Your money: ${M(money_)}`, left < 1 ? 'color-mix(in srgb, var(--c4) 25%, transparent)' : 'color-mix(in srgb, var(--c3) 22%, transparent)');
      return { svg: g, cap: crash < 0.05 ? `You put 12 eggs (your $1,000) into ${n} ${n === 1 ? 'basket' : 'baskets'}.` : `One basket drops. You lose 1 of ${n} baskets = ${nf(100 / n, 0)}% of your money. You still have ${M(1000 - 1000 / n)}.` };
    }
  },
  beta: {
    chapter: 'Risk', title: 'Beta: how jumpy is a stock?', plain: 'Beta tells you how much a stock moves when the whole market moves. Beta 2 means it jumps twice as much.',
    how: ['The grey line is the whole stock market.', 'The coloured line is one stock with the beta you choose.', 'Beta 1 copies the market. Above 1 exaggerates it. Below 1 calms it.'],
    words: [['Beta', 'How much a stock moves compared with the market.'], ['Market', 'All stocks together.'], ['Defensive stock', 'A stock with beta below 1.']],
    params: [{ id: 'beta', label: 'Beta of the stock', min: 0, max: 2.5, step: 0.1, v: 1.5, fmt: x => nf(x, 1) }], seeded: true, link: '/capm',
    draw(t, p) {
      const N = 24, z = series((p.seed || 1) * 31 + 5, N), mk = [100], st = [100];
      z.forEach(zz => { const r = (1 + 4 * zz) / 100; mk.push(mk[mk.length - 1] * (1 + r)); st.push(st[st.length - 1] * (1 + r * p.beta)); });
      const lo = Math.min(...mk, ...st) * 0.95, hi = Math.max(...mk, ...st) * 1.05, X = k => 40 + 440 * k / N, Y = v => 240 - 200 * (v - lo) / (hi - lo), pos = t * N, k0 = Math.min(N - 1, Math.floor(pos));
      const path = (arr, c) => { let d = ''; for (let k = 0; k <= k0; k++) d += (k ? 'L' : 'M') + X(k).toFixed(1) + ' ' + Y(arr[k]).toFixed(1); const cur = lerp(arr[k0], arr[k0 + 1], pos - k0); d += `L${X(pos).toFixed(1)} ${Y(cur).toFixed(1)}`; return `<path d="${d}" fill="none" stroke="${c}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>` + circ(X(pos), Y(cur), 5, c); };
      const g = line(40, Y(100), 480, Y(100), 'var(--line)', 2, true) + path(mk, 'var(--mute)') + path(st, 'var(--c1)') + circ(60, 20, 6, 'var(--mute)') + tx(72, 25, 'The market', { a: 'start', s: 13 }) + circ(180, 20, 6, 'var(--c1)') + tx(192, 25, `Your stock (beta ${nf(p.beta, 1)})`, { a: 'start', s: 13 }) + tx(260, 280, `Month ${Math.round(pos)} of ${N}`, { s: 13, c: 'var(--mute)', w: 600 });
      const m1 = (mk[k0 + 1] / mk[k0] - 1) * 100, s1 = (st[k0 + 1] / st[k0] - 1) * 100;
      return { svg: g, cap: `This month the market moved ${m1 >= 0 ? '+' : ''}${nf(m1, 1)}%, so a beta of ${nf(p.beta, 1)} moved ${s1 >= 0 ? '+' : ''}${nf(s1, 1)}%.` };
    }
  },
  mix2: {
    chapter: 'Risk', title: 'Mixing investments calms the ride', plain: 'When one investment drops while the other rises, blending them smooths the bumps. That is why mixing works.',
    how: ['Two investments, A (jumpy) and B (calmer).', 'The "together" slider says if they move in step (+1) or in opposite directions (-1).', 'The white line is your mix. The lower the together-ness, the calmer it gets.'],
    words: [['Correlation', 'Do two things move together? +1 yes, −1 opposite.'], ['Blend', 'Putting money in both.'], ['Standard deviation', 'A number for how bumpy something is.']],
    params: [{ id: 'rho', label: 'How much A and B move together', min: -1, max: 1, step: 0.1, v: 0, fmt: x => nf(x, 1) }, { id: 'wA', label: 'Share in A', min: 0, max: 100, step: 10, v: 50, fmt: x => x + '%' }], seeded: true, link: '/portfolio',
    draw(t, p) {
      const N = 30, sdA = p.sdA || 20, sdB = p.sdB || 10, za = series((p.seed || 1) * 7 + 1, N), zc = series((p.seed || 1) * 7 + 2, N), w = p.wA / 100, rho = clamp(p.rho, -1, 1);
      const A = za.map(z => sdA * z), B = za.map((z, k) => sdB * (rho * z + Math.sqrt(1 - rho * rho) * zc[k])), P = A.map((a, k) => w * a + (1 - w) * B[k]);
      const sd = a => { const m = sum(a) / a.length; return Math.sqrt(sum(a.map(x => (x - m) ** 2)) / (a.length - 1)); }, lim = Math.max(sdA, sdB) * 2.6, X = k => 40 + 440 * k / (N - 1), Y = v => 140 - 110 * v / lim, pos = t * (N - 1), k0 = Math.floor(pos);
      const pathOf = (arr, c, wd) => { let d = ''; for (let k = 0; k <= k0; k++) d += (k ? 'L' : 'M') + X(k).toFixed(1) + ' ' + Y(arr[k]).toFixed(1); return `<path d="${d}" fill="none" stroke="${c}" stroke-width="${wd}" stroke-linecap="round" stroke-linejoin="round"/>`; };
      const g = line(40, 140, 480, 140, 'var(--line)', 2) + pathOf(A, 'var(--c1)', 2.5) + pathOf(B, 'var(--c2)', 2.5) + pathOf(P, 'var(--ink)', 4) + circ(60, 20, 6, 'var(--c1)') + tx(72, 25, 'A', { a: 'start' }) + circ(110, 20, 6, 'var(--c2)') + tx(122, 25, 'B', { a: 'start' }) + circ(160, 20, 6, 'var(--ink)') + tx(172, 25, 'Your mix', { a: 'start' }) + tx(260, 190, 'Ups and downs each month (%)', { s: 12, c: 'var(--mute)', w: 600 })
        + [['A', sd(A), 'var(--c1)'], ['B', sd(B), 'var(--c2)'], ['Mix', sd(P), 'var(--ink)']].map((r, i) => rect(40 + i * 150, 210, 140, 56, 'var(--soft)', { r: 12 }) + tx(110 + i * 150, 232, r[0] + ' bumpiness', { s: 12, c: 'var(--mute)', w: 600 }) + tx(110 + i * 150, 256, nf(r[1], 1) + '%', { s: 19, c: r[2] })).join('');
      return { svg: g, cap: `A swings about ${nf(sd(A), 1)}% and B about ${nf(sd(B), 1)}%. Your mix swings only ${nf(sd(P), 1)}%${rho < 0.5 ? ', because one often rises when the other falls' : ''}.` };
    }
  },
  journey: {
    chapter: 'Risk', title: 'Ups and downs cost more than they give', plain: 'If you gain 50% and then lose 50%, you do not break even. Losses hit a bigger base, so they hurt more.',
    how: ['Start with $100.', 'Gain 50%: you have $150.', 'Lose 50%: you have $75. The average is 0%, but you are down 25%.'],
    words: [['Average return', 'The simple average of yearly returns.'], ['Compound return', 'What you really earned after compounding.'], ['Drawdown', 'A fall from a high point.']],
    params: [{ id: 'swing', label: 'Size of the gain and loss', min: 10, max: 90, step: 10, v: 50, fmt: x => x + '%' }], link: '/returns',
    draw(t, p) {
      const rets = p.rets && p.rets.length ? p.rets : [p.swing, -p.swing], N = rets.length, start = p.start || 100; let v = start; const vals = [v]; rets.forEach(r => vals.push((v *= 1 + r / 100)));
      const top = Math.max(...vals) * 1.15, bw = Math.min(70, 400 / (N + 1) - 8), X = k => 50 + (440 * (k + 0.5)) / (N + 1), pos = t * N, k0 = Math.min(N - 1, Math.floor(pos));
      let g = line(40, 232, 490, 232, 'var(--line)', 2);
      for (let k = 0; k <= N; k++) { const show = k <= k0 || (k === k0 + 1 && pos - k0 > 0.0), part = k === k0 + 1 ? ease(pos - k0) : 1, val = k === k0 + 1 ? lerp(vals[k0], vals[k], part) : vals[k]; if (k > k0 + 1) continue; const hh = 190 * val / top; g += rect(X(k) - bw / 2, 232 - hh, bw, hh, k === 0 ? 'var(--sky)' : rets[k - 1] >= 0 ? 'var(--c3)' : 'var(--c4)', { r: 8 }) + tx(X(k), 232 - hh - 8, M(val), { s: 14 }) + (k > 0 ? tx(X(k), 252, (rets[k - 1] >= 0 ? '+' : '') + nf(rets[k - 1], 0) + '%', { s: 14, c: rets[k - 1] >= 0 ? 'var(--c3)' : 'var(--c4)' }) : tx(X(0), 252, 'Start', { s: 13, c: 'var(--mute)' })); }
      const avg = sum(rets) / N, cur = k0 + (pos - k0 > 0.98 ? 1 : 0), done = pos >= N - 0.02;
      return { svg: g, cap: done ? `Average return: ${nf(avg, 1)}% a period. But you went from ${M(start)} to ${M(vals[N])} (${nf((vals[N] / start - 1) * 100, 0)}%). Ups and downs cost you.` : `Period ${Math.min(N, k0 + 1)}: ${rets[k0] >= 0 ? 'a gain' : 'a loss'} of ${nf(Math.abs(rets[k0]), 0)}%.` };
    }
  },
  npv: {
    chapter: 'Making decisions', title: 'Is this project worth doing?', plain: 'Add up what you will get in the future (shrunk to today\'s value) and compare it with what you pay now. If you get more, do it.',
    how: ['The left scale holds what you pay today.', 'Each future payment slides back to today and shrinks, then drops on the right.', 'If the right side ends heavier, the project is worth it. The gap is called NPV.'],
    words: [['NPV', 'Net present value: what you gain, in today\'s money.'], ['Hurdle rate', 'The return you need to make the project worth it.'], ['Investment', 'Money spent now to earn more later.']],
    params: [{ id: 'cost', label: 'Cost today', min: 50, max: 500, step: 10, v: 100, fmt: M }, { id: 'pay', label: 'You get each year', min: 10, max: 200, step: 5, v: 40, fmt: M }, { id: 'rate', label: 'Return you need', min: 1, max: 25, step: 1, v: 10, fmt: x => x + '%' }], link: '/capbud',
    draw(t, p) {
      const flows = p.flows && p.flows.length ? p.flows : [p.pay, p.pay, p.pay, p.pay], n = Math.min(10, flows.length), r = p.rate / 100, pvs = flows.slice(0, n).map((f, k) => f / Math.pow(1 + r, k + 1)), arrive = k => (k + 1) / (n + 1);
      let landed = 0, falling = ''; const sumPV = sum(pvs);
      pvs.forEach((pv, k) => { const a = seg(t, arrive(k) - 1 / (n + 1), arrive(k)); if (a >= 1) landed += pv; else if (a > 0) falling += coin(lerp(320, 400, k / n), lerp(30, 150, ease(a)), 6 + 10 * Math.sqrt(lerp(flows[k], pv, a) / Math.max(...flows)), 1) + tx(lerp(320, 400, k / n) + 24, lerp(30, 150, ease(a)) + 4, M(lerp(flows[k], pv, a)), { a: 'start', s: 11 }); });
      const diff = landed - p.cost, ang = clamp(diff / Math.max(p.cost, 1), -0.6, 0.6) * 24 * Math.PI / 180, L = 150, cxp = 260, cyp = 120, lx = cxp - L * Math.cos(ang), ly = cyp - L * Math.sin(ang), rx = cxp + L * Math.cos(ang), ry = cyp + L * Math.sin(ang);
      let g = line(cxp, cyp, cxp, 250, 'var(--mute)', 6) + rect(cxp - 40, 248, 80, 10, 'var(--mute)', { r: 4 }) + line(lx, ly, rx, ry, 'var(--ink)', 7) + circ(cxp, cyp, 8, 'var(--ink)');
      const pan = (x, y, label, fill, val) => line(x, y, x - 50, y + 56, 'var(--mute)', 2) + line(x, y, x + 50, y + 56, 'var(--mute)', 2) + rect(x - 70, y + 56, 140, 40, fill, { r: 12 }) + tx(x, y + 80, label, { s: 13 }) + tx(x, y + 114, val, { s: 15 });
      g += pan(lx, ly, 'You pay today', 'color-mix(in srgb, var(--c4) 35%, transparent)', M(p.cost)) + pan(rx, ry, 'Worth today', 'color-mix(in srgb, var(--c3) 35%, transparent)', M(landed)) + falling;
      const done = t > 0.97;
      return { svg: g, cap: done ? (sumPV > p.cost ? `Worth ${M(sumPV)} today for a cost of ${M(p.cost)}. You gain ${M(sumPV - p.cost)}. Do it! (That gain is the NPV.)` : `Worth only ${M(sumPV)} today for a cost of ${M(p.cost)}. You lose ${M(p.cost - sumPV)}. Skip it. (Negative NPV.)`) : `Each payment is worth less today than on the day you get it. The right side now holds ${M(landed)} against ${M(p.cost)} on the left.` };
    }
  },
  breakeven: {
    chapter: 'Making decisions', title: 'When does a business start to profit?', plain: 'First you earn back your fixed costs, like rent. Only after that does each sale become real profit.',
    how: ['Each cup of lemonade earns a little after its own ingredients.', 'That little amount slowly fills the rent bucket.', 'When the bucket is full you break even. Every cup after that is profit.'],
    words: [['Fixed costs', 'Bills you pay no matter how much you sell.'], ['Break-even', 'The point where you stop losing money.'], ['Margin', 'What is left of a sale after its own cost.']],
    params: [{ id: 'price', label: 'Price per cup', min: 2, max: 10, step: 0.5, v: 5, fmt: x => '$' + x }, { id: 'cost', label: 'Cost per cup', min: 0.5, max: 8, step: 0.5, v: 2, fmt: x => '$' + x }, { id: 'fixed', label: 'Fixed costs (rent)', min: 100, max: 2000, step: 50, v: 300, fmt: M }], link: '/breakeven',
    draw(t, p) {
      const mg = Math.max(0.01, p.price - p.cost), be = Math.ceil(p.fixed / mg), maxC = Math.ceil(be * 2.2), cups = Math.round(t * maxC), paid = Math.min(p.fixed, cups * mg), profit = Math.max(0, cups * mg - p.fixed);
      const W = 420, pw = W * paid / p.fixed, pmax = (maxC * mg - p.fixed) || 1;
      let g = tx(260, 40, `Cups sold: ${cups}`, { s: 26 }) + tx(50, 86, 'Rent bucket', { a: 'start', s: 14 }) + rect(50, 96, W, 30, 'var(--soft)', { r: 10 }) + rect(50, 96, pw, 30, paid >= p.fixed ? 'var(--c3)' : 'var(--c2)', { r: 10 }) + tx(50 + W, 86, `${M(paid)} of ${M(p.fixed)}`, { a: 'end', s: 14, c: 'var(--mute)' });
      g += tx(50, 172, 'Profit', { a: 'start', s: 14 }) + rect(50, 182, W, 30, 'var(--soft)', { r: 10 }) + rect(50, 182, W * profit / pmax, 30, 'var(--c3)', { r: 10 }) + tx(50 + W, 172, M(profit), { a: 'end', s: 14, c: 'var(--c3)' });
      for (let k = 0; k < Math.min(cups, 24); k++) g += `<path d="M${(56 + k * 17).toFixed(1)} 238 l-4 -22 h14 l-4 22z" fill="#FFE27A" stroke="#E0A200" stroke-width="1.5"/>`;
      return { svg: g, cap: cups < be ? `Each cup adds ${M(mg)} toward the rent. ${M(p.fixed - paid)} still to cover. Not profitable yet.` : cups === be ? `Break-even! The rent is paid with cup number ${be}.` : `Rent is paid. Every extra cup is ${M(mg)} of pure profit. You made ${M(profit)} so far.` };
    }
  },
  cycle: {
    chapter: 'Making decisions', title: 'Where does the cash get stuck?', plain: 'A shop pays for goods, waits to sell them, then waits again to be paid. During that wait its cash is stuck.',
    how: ['Goods sit on the shelf until they sell (blue).', 'Customers take time to pay (green).', 'Suppliers give you time to pay (yellow). The gap left over is the time your cash is stuck.'],
    words: [['Inventory', 'Goods waiting to be sold.'], ['Receivables', 'Money customers still owe you.'], ['Cash cycle', 'Days your cash is tied up in the business.']],
    params: [{ id: 'dio', label: 'Days goods sit on the shelf', min: 5, max: 120, step: 5, v: 45, fmt: x => x }, { id: 'dso', label: 'Days customers take to pay', min: 5, max: 90, step: 5, v: 40, fmt: x => x }, { id: 'dpo', label: 'Days you take to pay suppliers', min: 5, max: 120, step: 5, v: 30, fmt: x => x }], link: '/wc',
    draw(t, p) {
      const total = Math.max(p.dio + p.dso, p.dpo) * 1.08, X = d => 50 + 430 * d / total, day = t * total, stuck = p.dio + p.dso - p.dpo;
      const bar = (a, b, y, c, lbl) => rect(X(a), y, X(b) - X(a), 30, 'var(--soft)', { r: 9 }) + rect(X(a), y, Math.max(0, X(Math.min(b, Math.max(a, day))) - X(a)), 30, c, { r: 9 }) + tx(X(a) + 8, y + 20, lbl, { a: 'start', s: 13, c: '#17120F' });
      let g = bar(0, p.dio, 50, 'var(--sky)', `Goods on shelf ${p.dio} days`) + bar(p.dio, p.dio + p.dso, 96, 'var(--mint)', `Customers pay ${p.dso} days`) + bar(0, p.dpo, 142, 'var(--sun)', `You pay supplier at day ${p.dpo}`);
      if (stuck > 0) g += rect(X(p.dpo), 190, X(p.dio + p.dso) - X(p.dpo), 24, 'var(--c4)', { r: 8, op: day >= p.dio + p.dso ? 1 : 0.35 }) + tx((X(p.dpo) + X(p.dio + p.dso)) / 2, 207, `Cash stuck ${stuck} days`, { s: 13, c: '#fff' });
      g += line(X(day), 40, X(day), 224, 'var(--ink)', 2, true) + tx(X(day), 242, `Day ${Math.round(day)}`, { s: 13 });
      return { svg: g, cap: stuck > 0 ? `You pay your supplier on day ${p.dpo} but customers only pay you by day ${p.dio + p.dso}. Your cash is stuck for ${stuck} days.` : `Customers pay you before you must pay suppliers. No cash is stuck, which is great.` };
    }
  },
  option: {
    chapter: 'Making decisions', title: 'An option is a ticket to buy later at a fixed price', plain: 'For a small fee you get the right (not the duty) to buy a stock at a set price. If the stock soars, you win big. If not, you lose only the fee.',
    how: ['You pay a small fee for the ticket.', 'The ticket says: buy at the strike price, whatever the stock does.', 'If the stock ends above the strike, the ticket is worth the difference. If below, it is worth nothing.'],
    words: [['Option', 'A ticket giving you the right to buy or sell.'], ['Strike price', 'The fixed price written on the ticket.'], ['Premium', 'The fee you pay for the ticket.']],
    params: [{ id: 'K', label: 'Strike price', min: 50, max: 150, step: 5, v: 100, fmt: M }, { id: 'prem', label: 'Fee for the ticket', min: 1, max: 30, step: 1, v: 8, fmt: M }], link: '/options',
    draw(t, p) {
      const S = p.K * lerp(0.6, 1.4, ease(t)), profit = Math.max(0, S - p.K) - p.prem, lo = p.K * 0.6, hi = p.K * 1.4, X = s => 50 + 430 * (s - lo) / (hi - lo), maxP = Math.max(10, hi - p.K - p.prem), Y = v => 150 - 90 * v / maxP;
      let g = line(50, Y(0), 480, Y(0), 'var(--mute)', 2) + `<path d="M${X(lo)} ${Y(-p.prem)}L${X(p.K)} ${Y(-p.prem)}L${X(hi)} ${Y(hi - p.K - p.prem)}" fill="none" stroke="var(--c1)" stroke-width="3.5" stroke-linejoin="round"/>` + line(X(p.K), 40, X(p.K), 222, 'var(--mute)', 1.5, true) + tx(X(p.K), 36, `Strike ${M(p.K)}`, { s: 12, c: 'var(--mute)' });
      g += circ(X(S), Y(profit), 9, profit >= 0 ? 'var(--c3)' : 'var(--c4)', { stroke: 'var(--panel-solid)', sw: 3 }) + line(X(S), Y(profit), X(S), 232, profit >= 0 ? 'var(--c3)' : 'var(--c4)', 2, true) + tx(X(S), 252, `Stock ${M(S)}`, { s: 14 }) + tx(260, 280, `Your profit or loss: ${profit >= 0 ? '+' : '−'}${M(Math.abs(profit))}`, { s: 17, c: profit >= 0 ? 'var(--c3)' : 'var(--c4)' });
      return { svg: g, cap: S <= p.K ? `The stock is at ${M(S)}, below the strike of ${M(p.K)}. The ticket is worthless. You lose only the ${M(p.prem)} fee.` : `The stock is at ${M(S)}. Your ticket lets you buy at ${M(p.K)}, worth ${M(S - p.K)}. After the ${M(p.prem)} fee, you ${profit >= 0 ? 'profit' : 'lose'} ${M(Math.abs(profit))}.` };
    }
  },
  exchange: {
    chapter: 'Money and time', title: 'Swapping money between countries', plain: 'To use another country\'s money you swap yours at an exchange rate. A fair rate for later is set by the gap in interest rates, so nobody gets free money.',
    how: ['You swap your money for foreign money at today\'s rate.', 'Each pile grows at its own country\'s interest rate.', 'Swapping back at the fair future rate gives the same result as staying home. No free lunch.'],
    words: [['Exchange rate', 'The price of one currency in another.'], ['Forward rate', 'A rate agreed today for swapping later.'], ['Parity', 'The fair price that leaves no free money.']],
    params: [{ id: 'S', label: 'Rate today (home per 1 foreign)', min: 0.5, max: 2, step: 0.01, v: 1.08, fmt: x => nf(x, 2) }, { id: 'id', label: 'Home interest rate', min: 0, max: 10, step: 0.5, v: 5, fmt: x => x + '%' }, { id: 'if', label: 'Foreign interest rate', min: 0, max: 10, step: 0.5, v: 3, fmt: x => x + '%' }, { id: 'T', label: 'Years ahead', min: 1, max: 5, step: 1, v: 1, fmt: x => x + ' yr' }], link: '/fx',
    draw(t, p) {
      const A = 1000, fgn = A / p.S, home = A * Math.pow(1 + p.id / 100, p.T), abroad = fgn * Math.pow(1 + p.if / 100, p.T), F = p.S * Math.pow((1 + p.id / 100) / (1 + p.if / 100), p.T);
      const a = seg(t, 0.05, 0.35), b = seg(t, 0.38, 0.7), c = seg(t, 0.75, 0.98), top = Math.max(home, abroad * F) * 1.1;
      let g = face(70, 90, 30, 'var(--sky)') + tx(70, 140, 'Home money', { s: 13 }) + face(450, 90, 30, 'var(--pink)') + tx(450, 140, 'Foreign money', { s: 13 });
      if (a < 1) g += coin(lerp(110, 410, ease(a)), 80 - Math.sin(a * Math.PI) * 40, 16) + tx(260, 30, a > 0 ? `${M(A)} becomes ${nf(fgn, 0)} foreign at ${nf(p.S, 2)}` : `You have ${M(A)}`, { s: 14 }); else g += tx(260, 30, `You hold ${nf(fgn, 0)} foreign money`, { s: 14 });
      const bar = (x, v, f, lbl, lbl2, col) => rect(x, 250 - 90 * v / top, 120, 90 * v / top, col, { r: 10 }) + tx(x + 60, 244 - 90 * v / top, lbl, { s: 14 }) + tx(x + 60, 270, lbl2, { s: 12, c: 'var(--mute)', w: 600 });
      const hv = lerp(A, home, ease(b)), av = lerp(fgn, abroad, ease(b)) * lerp(p.S, F, ease(c));
      g += bar(120, hv, 0, M(hv), 'Stay home', 'var(--sky)') + bar(280, av, 0, M(av), c > 0 ? 'Swap back' : 'Abroad (in $)', 'var(--pink)');
      return { svg: g, cap: c < 0.98 ? (b < 1 ? `Both piles grow: home at ${p.id}%, foreign at ${p.if}%.` : `Now swap the foreign pile back at the fair future rate of ${nf(F, 3)}.`) : `Both end near ${M(home)}. The fair future rate ${nf(F, 3)} is ${F > p.S ? 'higher' : 'lower'} than today's, so there is no free money.` };
    }
  },
  blend: {
    chapter: 'Making decisions', title: 'What return does a company need?', plain: 'A company is funded by owners and lenders. Each wants a return. The company must earn the average of both, weighted by how much each put in.',
    how: ['The bar shows who funds the company: owners (blue) and lenders (yellow).', 'Owners want a higher return because they take more risk.', 'The needle shows the blended average. Any new project must beat it.'],
    words: [['Cost of capital', 'The return a company must earn to keep funders happy.'], ['Equity', 'Money put in by owners.'], ['Debt', 'Money borrowed from lenders.']],
    params: [{ id: 'wE', label: 'Share funded by owners', min: 10, max: 100, step: 5, v: 70, fmt: x => x + '%' }, { id: 'ke', label: 'Return owners want', min: 4, max: 20, step: 0.5, v: 10.5, fmt: x => x + '%' }, { id: 'kd', label: 'Return lenders want (after tax)', min: 1, max: 12, step: 0.5, v: 4.5, fmt: x => x + '%' }], link: '/wacc',
    draw(t, p) {
      const w = p.wE / 100, W = 420, avg = w * p.ke + (1 - w) * p.kd, u = ease(seg(t, 0.1, 0.8)), x0 = 50, hi = Math.max(p.ke, p.kd, avg) * 1.15, Y = v => 200 - 130 * v / hi;
      let g = rect(x0, 215, W * w * u, 34, 'var(--sky)', { r: 10 }) + rect(x0 + W * w * u, 215, W * (1 - w) * u, 34, 'var(--sun)', { r: 10 }) + tx(x0 + (W * w) / 2, 238, u > 0.5 ? `Owners ${p.wE}%` : '', { s: 14, c: '#17120F' }) + tx(x0 + W * w + (W * (1 - w)) / 2, 238, u > 0.5 && w < 0.95 ? `Lenders ${100 - p.wE}%` : '', { s: 14, c: '#17120F' });
      g += rect(x0, Y(p.ke * u), W * w, 200 - Y(p.ke * u), 'color-mix(in srgb, var(--sky) 40%, transparent)', { r: 8 }) + rect(x0 + W * w, Y(p.kd * u), W * (1 - w), 200 - Y(p.kd * u), 'color-mix(in srgb, var(--sun) 55%, transparent)', { r: 8 });
      g += tx(x0 + (W * w) / 2, Y(p.ke * u) - 8, `Want ${nf(p.ke * u, 1)}%`, { s: 13 }) + tx(x0 + W * w + (W * (1 - w)) / 2, Y(p.kd * u) - 8, `Want ${nf(p.kd * u, 1)}%`, { s: 13 });
      const a = ease(seg(t, 0.6, 1));
      g += line(x0, Y(avg * a), x0 + W, Y(avg * a), 'var(--c4)', 3, true) + pill(260, 40, `Company needs to earn ${nf(avg * a, 2)}%`, 'color-mix(in srgb, var(--c4) 25%, transparent)');
      return { svg: g, cap: a < 0.99 ? 'Owners and lenders each want a different return.' : `Blend: ${p.wE}% × ${nf(p.ke, 1)}% + ${100 - p.wE}% × ${nf(p.kd, 1)}% = ${nf(avg, 2)}%. A new project must earn more than this to be worth it.` };
    }
  },
  merge: {
    chapter: 'Making decisions', title: 'Will a takeover help profit per share?', plain: 'When one company buys another, its profit grows, but so can the number of shares. It is a good deal if profit grows faster than shares.',
    how: ['Two companies join, so their profits add up.', 'If new shares are issued to pay, profit is split among more shares.', 'Compare profit per share before and after.'],
    words: [['Profit per share', 'Company profit divided by the number of shares.'], ['Accretive', 'A deal that raises profit per share.'], ['Dilutive', 'A deal that lowers profit per share.']],
    params: [{ id: 'stock', label: 'Share paid with new stock', min: 0, max: 100, step: 10, v: 50, fmt: x => x + '%' }, { id: 'syn', label: 'Yearly savings from joining', min: 0, max: 100, step: 5, v: 20, fmt: x => '$' + x + 'M' }], link: '/merger',
    draw(t, p) {
      const d = (k, v) => (p[k] != null ? p[k] : v), aNI = d('aNI', 500), aSh = d('aSh', 100), aPx = d('aPx', 60), tNI = d('tNI', 100), tSh = d('tSh', 40), tPx = d('tPx', 30), prem = d('prem', 30), rate = d('rate', 6), tax = d('tax', 25), syn = d('syn', 20), st = d('stock', 50) / 100;
      const price = tPx * (1 + prem / 100) * tSh, newSh = price * st / aPx, intAT = price * (1 - st) * rate / 100 * (1 - tax / 100), ni = aNI + tNI + syn * (1 - tax / 100) - intAT, sh = aSh + newSh, e0 = aNI / aSh, e1 = ni / sh;
      const a = ease(seg(t, 0.05, 0.5)), b = ease(seg(t, 0.55, 0.95)), r1 = 26 + 20 * Math.sqrt(aNI / (aNI + tNI)), r2 = 26 + 20 * Math.sqrt(tNI / (aNI + tNI));
      let g = circ(lerp(110, 215, a), 90, lerp(r1, 50, a), 'var(--sky)', { op: 0.9 }) + circ(lerp(420, 305, a), 90, lerp(r2, 50 * 0.8, a), 'var(--pink)', { op: 0.9 }) + tx(lerp(110, 215, a), 95, 'Buyer', { s: 13 }) + tx(lerp(420, 305, a), 95, 'Target', { s: 13 }) + tx(260, 38, a < 1 ? 'Two companies join...' : `Combined profit ${M(ni)}M, ${nf(sh, 0)}M shares`, { s: 15 });
      const mx = Math.max(e0, e1) * 1.2, H = v => 85 * v / mx * b;
      g += rect(140, 250 - H(e0), 100, H(e0), 'var(--sky)', { r: 10 }) + rect(280, 250 - H(e1), 100, H(e1), e1 >= e0 ? 'var(--c3)' : 'var(--c4)', { r: 10 }) + tx(190, 270, 'Before', { s: 13, c: 'var(--mute)' }) + tx(330, 270, 'After', { s: 13, c: 'var(--mute)' }) + tx(190, 244 - H(e0), b > 0.2 ? money(e0 * b, 2) : '', { s: 15 }) + tx(330, 244 - H(e1), b > 0.2 ? money(e1 * b, 2) : '', { s: 15 }) + tx(260, 176, 'Profit per share', { s: 13, c: 'var(--mute)', w: 600 });
      return { svg: g, cap: b < 0.99 ? 'The two profits add up, and new shares may be created to pay for the deal.' : `Profit per share moves from ${money(e0, 2)} to ${money(e1, 2)}: ${e1 >= e0 ? 'a good deal (accretive)' : 'a bad deal for existing owners (dilutive)'}, ${nf((e1 / e0 - 1) * 100, 1)}%.` };
    }
  }
};

export const SCENE_ORDER = ['rent', 'growth', 'snowball', 'inflation', 'present', 'exchange', 'loan', 'bond', 'stock', 'leverage', 'risk', 'diversify', 'beta', 'mix2', 'journey', 'npv', 'blend', 'breakeven', 'cycle', 'merge', 'option'];

/** Animated scene player: play, scrub, speed, parameter sliders. */
export class SceneView {
  constructor(host, id, { params = {}, external = false, autoplay = true } = {}) {
    this.sc = SCENES[id]; this.id = id; this.external = external; this.t = autoplay ? 0 : 1; this.speed = 1; this.raf = 0; this.timer = 0;
    this.p = { seed: 3, ...Object.fromEntries(this.sc.params.map(q => [q.id, q.v])), ...params };
    host.innerHTML = '';
    this.stage = h('div', { class: 'sv-stage', role: 'img', 'aria-label': this.sc.title });
    this.cap = h('p', { class: 'sv-cap', 'aria-live': 'polite' });
    this.btn = h('button', { class: 'btn play', type: 'button', onclick: () => (this.playing ? this.pause() : this.play()) }, 'Play');
    this.range = h('input', { type: 'range', min: 0, max: 1000, value: autoplay ? 0 : 1000, 'aria-label': 'Move through the animation', class: 'sv-t' });
    this.range.addEventListener('input', () => { this.playing = false; this.stop(); this.t = this.range.value / 1000; this.draw(); });
    this.spd = h('button', { class: 'btn small', type: 'button', onclick: () => { this.speed = this.speed === 1 ? 2 : 1; this.spd.textContent = this.speed + '×'; } }, '1×');
    const ctl = h('div', { class: 'sv-ctl' }, this.btn, this.range, this.spd);
    if (this.sc.seeded) ctl.append(h('button', { class: 'btn small', type: 'button', onclick: () => { this.p.seed = (this.p.seed || 1) + 1; this.play(); } }, 'Roll again'));
    const sl = h('div', { class: 'sv-params' });
    if (!external) this.sc.params.forEach(q => {
      const val = h('b', {}, q.fmt(this.p[q.id])), inp = h('input', { type: 'range', min: q.min, max: q.max, step: q.step, value: this.p[q.id], 'aria-label': q.label });
      inp.addEventListener('input', () => { this.p[q.id] = +inp.value; val.textContent = q.fmt(+inp.value); this.draw(); clearTimeout(this.timer); this.timer = setTimeout(() => this.play(), 350); });
      sl.append(h('label', { class: 'sv-p' }, h('span', {}, q.label, val), inp));
    });
    host.append(this.stage, this.cap, ctl, sl);
    this.draw();
    if (autoplay) this.whenVisible(host);
  }
  whenVisible(host) {
    if (!('IntersectionObserver' in window)) { this.play(); return; }
    this.io = new IntersectionObserver(es => { if (es[0].isIntersecting) { this.io.disconnect(); setTimeout(() => this.play(), 250); } }, { threshold: 0.4 });
    this.io.observe(host);
  }
  setParams(p, replay = true) { Object.assign(this.p, p); this.draw(); if (replay) { clearTimeout(this.timer); this.timer = setTimeout(() => this.play(), 300); } }
  draw() {
    let out;
    try { out = this.sc.draw(this.t, this.p); } catch (e) { out = { svg: '', cap: 'Could not draw this scene.' }; }
    this.stage.innerHTML = `<svg viewBox="0 0 520 300" class="sv-svg">${out.svg}</svg>`;
    this.cap.innerHTML = esc(out.cap);
    this.range.value = Math.round(this.t * 1000);
  }
  stop() { cancelAnimationFrame(this.raf); this.btn.textContent = this.t >= 1 ? 'Replay' : 'Play'; }
  pause() { this.playing = false; this.stop(); this.btn.textContent = 'Resume'; }
  play() {
    cancelAnimationFrame(this.raf);
    if (reduced()) { this.t = 1; this.draw(); this.btn.textContent = 'Replay'; return; }
    const dur = (this.sc.dur || 6500) / this.speed, from = this.t >= 0.999 ? 0 : this.t, t0 = performance.now();
    this.btn.textContent = 'Pause';
    this.playing = true;
    const step = now => {
      const u = clamp(from + Math.max(0, now - t0) / dur * (1 - from), 0, 1);
      this.t = u; this.draw();
      if (u < 1 && this.playing) this.raf = requestAnimationFrame(step);
      else if (u >= 1) { this.playing = false; this.btn.textContent = 'Replay'; }
    };
    this.raf = requestAnimationFrame(step);
  }
  destroy() { cancelAnimationFrame(this.raf); clearTimeout(this.timer); if (this.io) this.io.disconnect(); this.playing = false; }
}
