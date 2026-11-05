// @ts-nocheck
/* Concept animations. Each scene draws one idea as a short, clean infographic.
   draw(t, p, W, H): t runs 0..1, p holds the parameters, and W x H is the real pixel size of the stage,
   so text is never scaled. Design rules: no characters, only proportional bars and lines, one accent per idea,
   labels centred on what they describe. */
import { corr, linreg, mean, median, money, ncdf, nf, stdev, sum } from '../lib/math';
import { esc, h, reduced } from './visuals.js';
import { rangeSlider } from './slider.js';
import { tick } from './ticker.js';

const M = x => money(x, 0);
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const lerp = (a, b, u) => a + (b - a) * u;
const ease = u => 1 - Math.pow(1 - clamp(u, 0, 1), 3);
const seg = (t, a, b) => clamp((t - a) / (b - a), 0, 1);
const f1 = x => x.toFixed(1);

/* ----- drawing primitives (y of text is its vertical centre) ----- */
const T = (x, y, s, o = {}) => `<text x="${f1(x)}" y="${f1(y)}" dy=".35em" text-anchor="${o.a || 'middle'}" font-size="${o.z || 14}" font-weight="${o.w || 700}"${o.f ? ` font-family="var(--display)" letter-spacing="-.03em"` : ''} fill="${o.c || 'var(--ink)'}"${o.halo ? ' stroke="var(--panel-solid)" stroke-width="4" paint-order="stroke" stroke-linejoin="round"' : ''}${o.op != null ? ` opacity="${o.op}"` : ''}>${esc(s)}</text>`;
const R = (x, y, w, hh, f, o = {}) => (w <= 0.2 || hh <= 0.2 ? '' : `<rect x="${f1(x)}" y="${f1(y)}" width="${f1(w)}" height="${f1(hh)}" rx="${f1(Math.min(o.r == null ? 8 : o.r, w / 2, hh / 2))}" fill="${f}"${o.stroke ? ` stroke="${o.stroke}" stroke-width="${o.sw || 1.5}"` : ''}${o.dash ? ' stroke-dasharray="5 4"' : ''}${o.op != null ? ` opacity="${o.op}"` : ''}/>`);
const L = (x1, y1, x2, y2, c = 'var(--line)', w = 2, dash) => `<line x1="${f1(x1)}" y1="${f1(y1)}" x2="${f1(x2)}" y2="${f1(y2)}" stroke="${c}" stroke-width="${w}" stroke-linecap="round"${dash ? ' stroke-dasharray="5 5"' : ''}/>`;
const C = (x, y, r, f, o = {}) => `<circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(Math.max(0, r))}" fill="${f}"${o.stroke ? ` stroke="${o.stroke}" stroke-width="${o.sw || 2}"` : ''}${o.op != null ? ` opacity="${o.op}"` : ''}/>`;
const chip = (cx, cy, s, bg = 'var(--soft)', fg = 'var(--ink)', z = 13) => { const w = s.length * z * 0.62 + 22; return R(cx - w / 2, cy - 14, w, 28, bg, { r: 14 }) + T(cx, cy, s, { z, c: fg }); };
const GOLD = '#FFD45C', GOLD_INK = '#5C3F00';
const prog = (t, W, H, label) => { const pad = Math.max(18, W * 0.06); return R(pad, H - 14, W - 2 * pad, 6, 'var(--soft)', { r: 3 }) + R(pad, H - 14, (W - 2 * pad) * t, 6, 'var(--c1)', { r: 3 }) + T(pad, H - 32, label, { a: 'start', z: 12.5, w: 600, c: 'var(--mute)' }); };
const legend = (items, x, y, maxW = 1e9) => { let g = '', cx = x, cy = y; items.forEach(([c, s]) => { const w = 16 + s.length * 7 + 18; if (cx + w - 18 > maxW && cx > x) { cx = x; cy += 18; } g += C(cx + 5, cy, 5, c) + T(cx + 16, cy, s, { a: 'start', z: 12.5, w: 600 }); cx += w; }); return g; };

function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const gauss = r => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r());
const series = (seed, n) => { const r = rng(seed); return Array.from({ length: n }, () => gauss(r)); };

export const SCENES = {
  rent: {
    chapter: 'Money and time', title: 'Interest is rent for money', plain: 'When you borrow money, you pay a little extra for using it. That extra is called interest.',
    how: ['Sam has money and lends it to Alex.', 'Alex uses it for a year.', 'Alex pays back what he borrowed plus a fee. The fee is the interest.'],
    words: [['Interest', 'The fee for borrowing money.'], ['Interest rate', 'The fee as a percent of the loan, per year.'], ['Principal', 'The money you borrowed.']],
    params: [{ id: 'amount', label: 'Amount lent', min: 100, max: 5000, step: 100, v: 1000, fmt: M }, { id: 'rate', label: 'Interest rate per year', min: 1, max: 20, step: 1, v: 8, fmt: x => x + '%' }], link: '/rates',
    draw(t, p, W, H) {
      const fee = p.amount * p.rate / 100, pad = Math.max(24, W * 0.08), ax = pad + 24, bx = W - pad - 24, cy = H * 0.4, a = seg(t, 0.04, 0.3), b = seg(t, 0.3, 0.58), c = seg(t, 0.6, 0.94);
      const who = (x, ini, name, role, col) => C(x, cy, 24, col) + T(x, cy, ini, { z: 20, c: '#17120F' }) + T(x, cy + 42, name, { z: 15 }) + T(x, cy + 60, role, { z: 12.5, w: 600, c: 'var(--mute)' });
      const x0 = ax + 80, x1 = bx - 80;
      let g = L(ax + 36, cy, bx - 36, cy, 'var(--line)', 3, true) + who(ax, 'S', 'Sam', 'lender', 'var(--sky)') + who(bx, 'A', 'Alex', 'borrower', 'var(--pink)');
      const lab = c > 0 ? 'Alex pays it back, plus a fee' : b > 0 ? 'Alex uses the money for a year' : a > 0 ? 'Sam lends the money' : 'Sam has money to lend';
      if (c === 0) g += chip(a < 1 ? lerp(x0, x1, ease(a)) : x1, cy - 34, M(p.amount), GOLD, GOLD_INK);
      else { const x = lerp(x1, x0, ease(c)); g += chip(x, cy - 34, M(p.amount), GOLD, GOLD_INK) + chip(x, cy - 68, '+ ' + M(fee) + ' fee', 'var(--c3)', '#fff'); }
      g += T(W / 2, H * 0.74, lab, { z: 15 }) + chip(W / 2, H * 0.89, `${p.rate}% of ${M(p.amount)} = ${M(fee)} interest`);
      return { svg: g, cap: c >= 1 ? `Done. Sam gets ${M(p.amount + fee)} back. The extra ${M(fee)} is the interest: ${p.rate}% of ${M(p.amount)}.` : c > 0 ? `Alex pays back ${M(p.amount)} plus ${M(fee)} extra.` : b > 0 ? 'Alex uses the money for a year, maybe to buy tools for his shop.' : a > 0 ? `Sam hands over ${M(p.amount)}.` : `Sam has ${M(p.amount)} to lend.` };
    }
  },
  growth: {
    chapter: 'Money and time', title: 'Money grows while it waits', plain: 'Money in the bank earns interest. Money in a jar does not. Over time the difference gets big.',
    how: ['You start with some money and add a little each year.', 'The jar keeps it safe, but it never grows.', 'The bank pays interest, so the green part on top gets taller every year.'],
    words: [['Savings', 'Money you set aside.'], ['Return', 'The extra money your money earns.'], ['Time', 'The most powerful ingredient. Start early.']],
    params: [{ id: 'start', label: 'Start with', min: 0, max: 10000, step: 500, v: 1000, fmt: M }, { id: 'add', label: 'Add each year', min: 0, max: 5000, step: 100, v: 600, fmt: M }, { id: 'rate', label: 'Bank pays per year', min: 1, max: 12, step: 0.5, v: 6, fmt: x => x + '%' }, { id: 'years', label: 'For how many years', min: 5, max: 40, step: 1, v: 25, fmt: x => x + ' yrs' }], link: '/tvm',
    draw(t, p, W, H) {
      const m = p.mpy || 1, im = p.rate / 100 / m, val = y => { const g = Math.pow(1 + im, m * y); return p.start * g + (p.add / m) * (im ? (g - 1) / im : m * y); };
      const y = t * p.years, dep = p.start + p.add * y, bank = val(y), top = Math.max(val(p.years), 1), base = H - 98, hmax = base - 52, sc = hmax / top, bw = Math.min(130, W * 0.24), c1 = W * 0.28, c2 = W * 0.72, pad = Math.max(18, W * 0.06);
      let g = L(pad, base, W - pad, base, 'var(--line)', 2);
      g += R(c1 - bw / 2, base - dep * sc, bw, dep * sc, 'var(--mute)', { r: 10, op: 0.5 });
      g += R(c2 - bw / 2, base - dep * sc, bw, dep * sc, 'var(--mute)', { r: 10, op: 0.5 }) + R(c2 - bw / 2, base - bank * sc, bw, Math.max(0, bank - dep) * sc, 'var(--c3)', { r: 10 });
      g += T(c1, base - hmax - 16, M(dep), { z: 18 }) + T(c2, base - hmax - 16, M(bank), { z: 18, c: 'var(--c3)' });
      g += T(c1, base + 18, 'In a jar', { z: 15 }) + T(c1, base + 37, 'no interest', { z: 12.5, w: 600, c: 'var(--mute)' }) + T(c2, base + 18, 'In the bank', { z: 15 }) + T(c2, base + 37, `${M(Math.max(0, bank - dep))} from interest`, { z: 12.5, w: 600, c: 'var(--c3)' });
      g += prog(t, W, H, `Year ${Math.round(y)} of ${p.years}`);
      return { svg: g, cap: `Year ${Math.round(y)}: the jar has ${M(dep)}. The bank has ${M(bank)}. That is ${M(bank - dep)} of free money from interest.` };
    }
  },
  snowball: {
    chapter: 'Money and time', title: 'The money snowball (compounding)', plain: 'Interest earns interest. Each year the pile grows by more than the year before.',
    how: ['Year 1: interest is paid on your starting money (green).', 'Year 2: interest is paid on your money and on last year\'s interest (coral).', 'Each year the coral slice gets bigger, so the bars climb faster and faster.'],
    words: [['Compounding', 'Earning interest on your interest.'], ['Simple interest', 'Interest on the starting money only.'], ['Rule of 72', '72 ÷ rate = years to double your money.']],
    params: [{ id: 'start', label: 'Start with', min: 500, max: 20000, step: 500, v: 5000, fmt: M }, { id: 'rate', label: 'Interest per year', min: 1, max: 15, step: 0.5, v: 8, fmt: x => x + '%' }, { id: 'years', label: 'Years', min: 5, max: 40, step: 1, v: 30, fmt: x => x + ' yrs' }], link: '/rates',
    draw(t, p, W, H) {
      const N = Math.max(2, Math.round(p.years)), r = p.rate / 100, m = p.m || 1, fv = k => p.start * Math.pow(1 + r / m, m * k), top = fv(N), pad = Math.max(18, W * 0.06), base = H - 62, hmax = base - 86, sc = hmax / top, cw = (W - 2 * pad) / N, bw = Math.max(3, cw * 0.74), pos = t * N, n = Math.floor(pos + 1e-9);
      let g = legend([['var(--sky)', 'Your money'], ['var(--mint)', 'Interest'], ['var(--coral)', 'Interest on interest']], pad, 14, W - pad) + L(pad, base, W - pad, base);
      for (let k = 1; k <= Math.min(N, n + 1); k++) {
        const grow = k <= n ? 1 : ease(pos - n), x = pad + (k - 0.5) * cw - bw / 2, own = p.start * sc, simple = p.start * r * k * sc, rest = Math.max(0, fv(k) - p.start - p.start * r * k) * sc;
        const hs = [own, simple, rest].map(v => v * grow); let y = base;
        [['var(--sky)', hs[0]], ['var(--mint)', hs[1]], ['var(--coral)', hs[2]]].forEach(([c, hh]) => { y -= hh; g += R(x, y, bw, hh, c, { r: 2 }); });
      }
      const k = clamp(Math.round(pos), 0, N), now = fv(k), simple = p.start * r * k;
      g += T(W - pad, 62, `Year ${k}: ${M(now)}`, { a: 'end', z: 19 }) + T(pad, base + 18, '0', { a: 'start', z: 12, w: 600, c: 'var(--mute)' }) + T(W / 2, base + 18, `Year ${Math.round(N / 2)}`, { z: 12, w: 600, c: 'var(--mute)' }) + T(W - pad, base + 18, `Year ${N}`, { a: 'end', z: 12, w: 600, c: 'var(--mute)' });
      return { svg: g, cap: `Year ${k}: ${M(now)}. Of the growth, ${M(simple)} is interest on your starting money and ${M(Math.max(0, now - p.start - simple))} is interest on earlier interest.` };
    }
  },
  inflation: {
    chapter: 'Money and time', title: 'Prices go up, so money shrinks', plain: 'Inflation means things cost more each year. The same money buys less and less.',
    how: ['Today a basket of groceries costs $100.', 'Each year the price creeps up by the inflation rate.', 'Your $100 now buys only a part of that basket. Your money lost buying power.'],
    words: [['Inflation', 'Prices rising over time.'], ['Buying power', 'How much your money can actually buy.'], ['Real return', 'Your return after inflation is taken out.']],
    params: [{ id: 'infl', label: 'Inflation per year', min: 1, max: 12, step: 0.5, v: 4, fmt: x => x + '%' }, { id: 'years', label: 'Years', min: 5, max: 40, step: 1, v: 20, fmt: x => x + ' yrs' }], link: '/rates',
    draw(t, p, W, H) {
      const y = t * p.years, f = Math.pow(1 + p.infl / 100, y), power = 1 / f, pad = Math.max(24, W * 0.08), bw = W - 2 * pad;
      let g = T(W / 2, H * 0.1, 'A basket of groceries that cost $100 today', { z: 14, w: 600, c: 'var(--mute)' }) + T(W / 2, H * 0.24, `now costs ${M(100 * f)}`, { z: 30, c: 'var(--c1)' });
      g += T(W / 2, H * 0.47, 'So your $100 now buys only', { z: 14, w: 600, c: 'var(--mute)' }) + R(pad, H * 0.55, bw, 28, 'var(--soft)', { r: 14 }) + R(pad, H * 0.55, bw * power, 28, 'var(--c3)', { r: 14 }) + T(W / 2, H * 0.75, `${nf(power * 100, 0)}% of the basket`, { z: 24, c: power < 0.7 ? 'var(--c4)' : 'var(--ink)' });
      g += prog(t, W, H, `Year ${Math.round(y)} of ${p.years}`);
      return { svg: g, cap: `Year ${Math.round(y)}: the basket costs ${M(100 * f)}. Your $100 buys ${nf(power * 100, 0)}% of it, so your money lost ${nf((1 - power) * 100, 0)}% of its buying power.` };
    }
  },
  present: {
    chapter: 'Money and time', title: 'Money later is worth less today', plain: 'A promise of $1,000 in ten years is worth less than $1,000 in your hand now, because money in hand can earn interest.',
    how: ['The dashed bar is the amount you are promised later.', 'The solid bar is what that promise is worth today.', 'The longer you wait, the more it shrinks. The coral bar at the left adds up everything it is worth today.'],
    words: [['Present value', 'What future money is worth today.'], ['Discount rate', 'How fast future money shrinks when brought back to today.'], ['Future value', 'What money today will be worth later.']],
    params: [{ id: 'amount', label: 'Money you will get', min: 100, max: 5000, step: 100, v: 1000, fmt: M }, { id: 'years', label: 'In how many years', min: 1, max: 30, step: 1, v: 10, fmt: x => x + ' yrs' }, { id: 'rate', label: 'Discount rate', min: 1, max: 20, step: 0.5, v: 6, fmt: x => x + '%' }], link: '/annuity',
    draw(t, p, W, H) {
      const flows = p.flows && p.flows.length ? p.flows : [{ y: p.years, a: p.amount }], r = p.rate / 100, N = Math.max(...flows.map(f => f.y)), u = ease(t), pad = Math.max(18, W * 0.05), base = H - 78, hmax = base - 70;
      const nominal = sum(flows.map(f => f.a)), maxCol = Math.max(nominal, ...flows.map(f => f.a), 1), sc = hmax / maxCol, slot = (W - 2 * pad) / (N + 1), bw = clamp(slot * 0.62, 6, 46);
      let g = L(pad, base, W - pad, base) + T(pad, 16, 'Dashed = promised. Solid = worth today.', { a: 'start', z: 12.5, w: 600, c: 'var(--mute)' });
      let now = 0, pv = 0; const few = flows.length <= 8;
      flows.forEach(f => { const val = f.a / Math.pow(1 + r, f.y * u); now += val; pv += f.a / Math.pow(1 + r, f.y); const cx = pad + (f.y + 0.5) * slot; g += R(cx - bw / 2, base - f.a * sc, bw, f.a * sc, 'none', { r: 6, stroke: 'var(--mute)', dash: true }) + R(cx - bw / 2, base - val * sc, bw, val * sc, 'var(--c3)', { r: 6 }); if (few) g += T(cx, base - f.a * sc - 14, M(val), { z: 13.5 }); });
      const px = pad + 0.5 * slot, pw = clamp(slot * 0.8, 10, 60);
      g += R(px - pw / 2, base - now * sc, pw, now * sc, 'var(--c1)', { r: 6 }) + T(px, base - Math.max(pv, 1) * sc - 16, M(now), { z: 17, c: 'var(--c1)' }) + T(px, base + 16, 'Today', { z: 12, w: 700 });
      const step = Math.max(N <= 12 ? 1 : Math.ceil(N / 6), Math.ceil(40 / slot));
      for (let k = step; k <= N; k += step) g += T(pad + (k + 0.5) * slot, base + 16, slot * step > 50 ? 'Yr ' + k : '' + k, { z: 12, w: 600, c: 'var(--mute)' });
      const cap = u < 0.03 ? `These payments add up to ${M(nominal)} on paper.` : u < 0.999 ? `Bringing them back to today at ${p.rate}% a year, each one shrinks.` : `Worth ${p.result || M(pv)} today, not ${M(nominal)}. Waiting costs money.`;
      return { svg: g + prog(t, W, H, 'Bringing the money back to today'), cap };
    }
  },
  exchange: {
    chapter: 'Money and time', title: 'Swapping money between countries', plain: 'To use another country\'s money you swap yours at an exchange rate. A fair rate for later is set by the gap in interest rates, so nobody gets free money.',
    how: ['You swap your money for foreign money at today\'s rate.', 'Each pile grows at its own country\'s interest rate.', 'Swapping back at the fair future rate gives the same result as staying home. No free lunch.'],
    words: [['Exchange rate', 'The price of one currency in another.'], ['Forward rate', 'A rate agreed today for swapping later.'], ['Parity', 'The fair price that leaves no free money.']],
    params: [{ id: 'S', label: 'Rate today (home per 1 foreign)', min: 0.5, max: 2, step: 0.01, v: 1.08, fmt: x => nf(x, 2) }, { id: 'id', label: 'Home interest rate', min: 0, max: 10, step: 0.5, v: 5, fmt: x => x + '%' }, { id: 'if', label: 'Foreign interest rate', min: 0, max: 10, step: 0.5, v: 3, fmt: x => x + '%' }, { id: 'T', label: 'Years ahead', min: 1, max: 5, step: 1, v: 1, fmt: x => x + ' yr' }], link: '/fx',
    draw(t, p, W, H) {
      const A = 1000, fgn = A / p.S, home = A * Math.pow(1 + p.id / 100, p.T), F = p.S * Math.pow((1 + p.id / 100) / (1 + p.if / 100), p.T), abroad = fgn * Math.pow(1 + p.if / 100, p.T) * F;
      const b = ease(seg(t, 0.12, 0.7)), c = ease(seg(t, 0.72, 0.98)), top = Math.max(home, abroad) * 1.08, base = H - 78, hmax = base - 70, sc = hmax / top, bw = Math.min(120, W * 0.22), c1 = W * 0.3, c2 = W * 0.7, pad = Math.max(18, W * 0.06);
      const hv = lerp(A, home, b), av = lerp(A, abroad, b);
      let g = T(W / 2, 18, `Start: ${M(A)} = ${nf(fgn, 0)} foreign money at ${nf(p.S, 2)}`, { z: 14, w: 600, c: 'var(--mute)' }) + L(pad, base, W - pad, base);
      g += R(c1 - bw / 2, base - hv * sc, bw, hv * sc, 'var(--sky)', { r: 10 }) + R(c2 - bw / 2, base - av * sc, bw, av * sc, 'var(--pink)', { r: 10 });
      g += T(c1, base - home * sc - 16, M(hv), { z: 18 }) + T(c2, base - abroad * sc - 16, M(av), { z: 18 }) + T(c1, base + 18, 'Stay home', { z: 15 }) + T(c1, base + 37, `earns ${p.id}%`, { z: 12.5, w: 600, c: 'var(--mute)' }) + T(c2, base + 18, 'Swap, earn abroad, swap back', { z: 14 }) + T(c2, base + 37, `earns ${p.if}%, swaps back at ${nf(lerp(p.S, F, c), 3)}`, { z: 12.5, w: 600, c: 'var(--mute)' });
      return { svg: g, cap: t < 0.7 ? `Both piles grow: home at ${p.id}%, foreign at ${p.if}%.` : `After ${p.T} yr the foreign pile is swapped back at the fair future rate of ${nf(F, 3)}. Both end at about ${M(home)}: no free money.` };
    }
  },
  loan: {
    chapter: 'Borrowing and lending', title: 'How a loan gets paid off', plain: 'Each payment has two parts: a fee to the bank (interest) and a real payment on what you owe. At first, most is fee.',
    how: ['The tank on the left is what you still owe.', 'Each month you pay. The bank takes its fee first (rose).', 'The rest (green) empties the tank. As the tank drops, the fee shrinks.'],
    words: [['Loan balance', 'What you still owe.'], ['Principal', 'The part of a payment that reduces what you owe.'], ['Mortgage', 'A loan to buy a home.']],
    params: [{ id: 'amt', label: 'Loan amount', min: 5000, max: 500000, step: 5000, v: 200000, fmt: M }, { id: 'apr', label: 'Interest rate', min: 1, max: 15, step: 0.25, v: 6.5, fmt: x => x + '%' }, { id: 'years', label: 'Years to repay', min: 1, max: 40, step: 1, v: 30, fmt: x => x + ' yrs' }], link: '/loan',
    draw(t, p, W, H) {
      const i = p.apr / 1200, n = Math.round(p.years * 12), base = i ? p.amt * i / (1 - Math.pow(1 + i, -n)) : p.amt / n, pay = base + (p.extra || 0), mth = Math.max(1, Math.min(n, Math.ceil(t * n)));
      let bal = p.amt, iPaid = 0, pPaid = 0, int = 0, pr = 0;
      for (let k = 1; k <= mth && bal > 0.01; k++) { int = bal * i; const pay2 = Math.min(pay, bal + int); pr = pay2 - int; bal = Math.max(0, bal - pr); iPaid += int; pPaid += pr; }
      const pad = Math.max(18, W * 0.06), tw = Math.min(110, W * 0.22), ty = 34, th = H - 100, lvl = bal / p.amt, rx = pad + tw + Math.max(20, W * 0.06), rw = W - pad - rx, share = int / Math.max(0.01, int + pr);
      let g = T(pad + tw / 2, 14, 'You still owe', { z: 13, w: 600, c: 'var(--mute)' }) + R(pad, ty, tw, th, 'var(--soft)', { r: 14 }) + R(pad, ty + th * (1 - lvl), tw, th * lvl, 'color-mix(in srgb, var(--c4) 55%, transparent)', { r: 14 }) + T(pad + tw / 2, ty + th / 2, M(bal), { z: 17 });
      g += T(rx, 22, `Your monthly payment: ${M(pay)}`, { a: 'start', z: 16 }) + R(rx, 44, rw, 34, 'var(--c3)', { r: 10 }) + R(rx, 44, rw * share, 34, 'var(--c4)', { r: 10 });
      if (rw * share > 70) g += T(rx + (rw * share) / 2, 61, 'fee', { z: 13, c: '#fff' });
      if (rw * (1 - share) > 90) g += T(rx + rw * share + (rw * (1 - share)) / 2, 61, 'pays the loan', { z: 13, c: '#fff' });
      g += T(rx, 100, `Fee ${M(int)}`, { a: 'start', z: 14, c: 'var(--c4)' }) + T(rx + rw, 100, `Loan ${M(pr)}`, { a: 'end', z: 14, c: 'var(--c3)' });
      g += T(rx, 140, 'Paid so far', { a: 'start', z: 13, w: 600, c: 'var(--mute)' }) + T(rx, 164, `${M(iPaid)} in fees`, { a: 'start', z: 16, c: 'var(--c4)' }) + T(rx, 190, `${M(pPaid)} on the loan`, { a: 'start', z: 16, c: 'var(--c3)' });
      return { svg: g + prog(t, W, H, `Year ${nf(mth / 12, 1)} of ${p.years}`), cap: `Month ${mth}: out of ${M(pay)}, ${M(int)} is the bank's fee and ${M(pr)} reduces what you owe. You still owe ${M(bal)}.` };
    }
  },
  bond: {
    chapter: 'Borrowing and lending', title: 'A bond is an IOU that pays you', plain: 'When you buy a bond, you lend money to a company or government. They pay you a small amount every year and give your money back at the end.',
    how: ['You lend $1,000 by buying the bond.', 'Every year you get a small payment, called a coupon.', 'At the end you get your $1,000 back. Your pocket ends up with more than you lent.'],
    words: [['Bond', 'A loan you make to a company or government.'], ['Coupon', 'The yearly payment the bond pays you.'], ['Maturity', 'The day you get your money back.']],
    params: [{ id: 'face', label: 'You lend', min: 500, max: 5000, step: 500, v: 1000, fmt: M }, { id: 'cr', label: 'Yearly payment rate', min: 1, max: 12, step: 0.5, v: 5, fmt: x => x + '%' }, { id: 'years', label: 'Years', min: 2, max: 10, step: 1, v: 5, fmt: x => x + ' yrs' }], link: '/bond',
    draw(t, p, W, H) {
      const N = Math.round(p.years), c = p.face * p.cr / 100, cy = t * N, pad = Math.max(18, W * 0.06), pw = Math.min(100, W * 0.2), px = W - pad - pw, tlw = px - pad - 100, base = H - 78, hmax = base - 64, top = p.face + c * N, sc = hmax / top;
      let got = 0; for (let k = 1; k <= N; k++) if (cy >= k) got += c + (k === N ? p.face : 0);
      const lineY = 120, X = k => pad + 24 + (tlw - 48) * (k - 1) / Math.max(1, N - 1);
      let g = chip(pad + 70, 16, `You lend ${M(p.face)}`, 'color-mix(in srgb, var(--c4) 28%, transparent)') + L(pad + 10, lineY, px - 90, lineY, 'var(--line)', 4);
      const gapX = (tlw - 48) / Math.max(1, N - 1), rr = clamp(gapX * 0.42, 13, 20), wide = gapX > 62;
      for (let k = 1; k <= N; k++) { const a = clamp(cy - k + 1, 0, 1), last = k === N, r = last ? Math.max(rr + 5, M(c + p.face).length * 3.4 + 9) : rr; g += T(X(k), lineY + 40, wide ? (last ? 'Final year' : 'Year ' + k) : (last ? 'End' : 'Y' + k), { z: 12, w: 600, c: 'var(--mute)' }); if (a > 0) g += `<g opacity="${a}">` + C(X(k), lineY - (1 - ease(a)) * 40, r, GOLD, { stroke: '#E0A200', sw: 2 }) + T(X(k), lineY - (1 - ease(a)) * 40, last ? M(c + p.face) : M(c), { z: rr < 16 ? 10.5 : (last ? 11.5 : 12), c: GOLD_INK }) + '</g>'; else g += C(X(k), lineY, 4, 'var(--mute)'); }
      g += L(px - 8, base - p.face * sc, px + pw + 8, base - p.face * sc, 'var(--mute)', 1.5, true) + T(px - 12, base - p.face * sc, `lent ${M(p.face)}`, { a: 'end', z: 12, w: 600, c: 'var(--mute)' }) + R(px, base - got * sc, pw, got * sc, 'var(--c3)', { r: 10 });
      g += T(px + pw / 2, base - hmax - 16, M(got), { z: 17, c: 'var(--c3)', halo: true }) + T(px + pw / 2, base + 18, 'In your pocket', { z: 13 });
      return { svg: g + prog(t, W, H, `Year ${Math.min(N, Math.floor(cy))} of ${N}`), cap: cy < 0.05 ? `You lend ${M(p.face)} by buying the bond.` : cy < N - 0.02 ? `Year ${Math.floor(cy)}: another ${M(c)} drops into your pocket (${p.cr}% of ${M(p.face)}).` : `Finished. You got ${M(c * N)} in payments plus your ${M(p.face)} back = ${M(c * N + p.face)}.${p.result ? ' Today it is worth ' + p.result + ' to buyers.' : ''}` };
    }
  },
  stock: {
    chapter: 'Owning things', title: 'A stock is a slice of a company', plain: 'Buying a stock means you own a small slice of a real business. When the business earns money, your slice earns too.',
    how: ['The pie is the whole company, cut into 10 equal slices.', 'You own some slices (shown in green).', 'When the company shares its profit, each slice gets the same. That payout is a dividend.'],
    words: [['Stock (share)', 'One slice of ownership in a company.'], ['Dividend', 'Profit the company pays out to its owners.'], ['Shareholder', 'A person who owns shares.']],
    params: [{ id: 'own', label: 'Slices you own (of 10)', min: 1, max: 5, step: 1, v: 2, fmt: x => x }, { id: 'profit', label: 'Company profit', min: 10000, max: 1000000, step: 10000, v: 200000, fmt: M }], link: '/ddm',
    draw(t, p, W, H) {
      const own = Math.round(p.own), R0 = Math.min(H * 0.34, W * 0.2), cx = Math.max(R0 + 24, W * 0.24), cy = H * 0.44, reveal = ease(seg(t, 0.05, 0.6)), pay = ease(seg(t, 0.55, 0.95)), share = p.profit * 0.5 / 10;
      let g = '';
      for (let k = 0; k < 10; k++) {
        const a0 = (k / 10) * 2 * Math.PI - Math.PI / 2, a1 = ((k + 1) / 10) * 2 * Math.PI - Math.PI / 2, mine = k < own, rr = R0 * clamp(reveal * 1.4 - k * 0.04, 0, 1);
        g += `<path d="M${f1(cx)} ${f1(cy)}L${f1(cx + rr * Math.cos(a0))} ${f1(cy + rr * Math.sin(a0))}A${f1(rr)} ${f1(rr)} 0 0 1 ${f1(cx + rr * Math.cos(a1))} ${f1(cy + rr * Math.sin(a1))}Z" fill="${mine ? 'var(--c3)' : 'color-mix(in srgb, var(--lav) 55%, var(--panel-solid))'}" stroke="var(--panel-solid)" stroke-width="3"/>`;
      }
      g += T(cx, cy + R0 + 26, `You own ${own} of 10 slices`, { z: 14 });
      const rx = cx + R0 + Math.max(30, W * 0.08), row = (y, label, value, c) => T(rx, y, label, { a: 'start', z: 13, w: 600, c: 'var(--mute)' }) + T(rx, y + 26, value, { a: 'start', z: 22, c });
      g += row(H * 0.14, 'The company earned', M(p.profit * reveal), 'var(--ink)') + row(H * 0.38, 'It pays half to its owners', M(p.profit / 2 * pay), 'var(--ink)') + row(H * 0.62, `Your ${own} slices get`, M(share * own * pay), 'var(--c3)');
      return { svg: g, cap: pay < 0.02 ? 'The company makes a profit.' : pay < 0.99 ? 'Half the profit is paid out, shared equally between the 10 slices.' : `Each slice gets ${M(share)}. You own ${own} of 10 slices, so your dividend is ${M(share * own)}.` };
    }
  },
  leverage: {
    chapter: 'Owning things', title: 'Borrowing magnifies wins and losses', plain: 'Using borrowed money makes your gains bigger when things go well, and your losses bigger when they do not.',
    how: ['Two people buy the same $100 house. One pays cash (blue). One borrows part of it (rose).', 'The house price changes. A gain shows in green, a loss as a dashed red gap.', 'Compare each person\'s gain or loss with the money they actually put in. The borrower swings more.'],
    words: [['Leverage', 'Using borrowed money to invest.'], ['Equity', 'The part you own with your own money.'], ['Debt', 'Money you owe.']],
    params: [{ id: 'debt', label: 'Share borrowed', min: 10, max: 90, step: 10, v: 60, fmt: x => x + '%' }, { id: 'change', label: 'House price change', min: -30, max: 30, step: 5, v: 20, fmt: x => (x > 0 ? '+' : '') + x + '%' }, { id: 'rate', label: 'Loan interest', min: 0, max: 10, step: 1, v: 5, fmt: x => x + '%' }], link: '/capstruct',
    draw(t, p, W, H) {
      const ch = p.change * ease(t), house = 100 * (1 + ch / 100), D = clamp(p.debt, 0, 95), E = 100 - D, interest = D * p.rate / 100 * ease(t), gain = house - 100, retCash = gain, retBorrow = (gain - interest) / E * 100;
      const base = H - 84, hmax = base - 56, sc = hmax / 140, bw = Math.min(120, W * 0.22), c1 = W * 0.27, c2 = W * 0.73, col = v => (v >= 0 ? 'var(--c3)' : 'var(--c4)'), pad = Math.max(18, W * 0.06);
      const bar = (cx, debt, title, equity, ret) => {
        const he = equity * sc, hd = debt * sc, hg = Math.max(0, house - 100) * sc, hl = Math.max(0, 100 - house) * sc;
        let b = T(cx, 14, title, { z: 15 }) + R(cx - bw / 2, base - he, bw, he, 'var(--sky)', { r: 8 }) + R(cx - bw / 2, base - he - hd, bw, hd, 'color-mix(in srgb, var(--c4) 45%, var(--panel-solid))', { r: 8 }) + R(cx - bw / 2, base - he - hd - hg, bw, hg, 'var(--c3)', { r: 8 });
        if (hl > 1) b += R(cx - bw / 2, base - he - hd, bw, hl, 'none', { r: 6, stroke: 'var(--c4)', dash: true, sw: 2 });
        return b + T(cx, base - he / 2, 'your ' + M(equity), { z: 12.5, c: '#17120F' }) + (debt > 0 && hd > 24 ? T(cx, base - he - hd / 2, 'borrowed ' + M(debt), { z: 12, c: 'var(--ink)' }) : '') + T(cx, base + 24, `${ret >= 0 ? '+' : '−'}${nf(Math.abs(ret), 0)}%`, { z: 26, c: col(ret) }) + T(cx, base + 48, 'on your own money', { z: 12.5, w: 600, c: 'var(--mute)' });
      };
      const g = L(pad, base, W - pad, base) + bar(c1, 0, 'All cash', 100, retCash) + bar(c2, D, `Borrowing ${D}%`, E, retBorrow);
      return { svg: g, cap: `The house is now worth ${M(house)} (${nf(ch, 0)}%). With cash only, you ${gain >= 0 ? 'gain' : 'lose'} ${nf(Math.abs(retCash), 0)}%. By borrowing, your ${M(E)} ${retBorrow >= 0 ? 'gains' : 'loses'} ${nf(Math.abs(retBorrow), 0)}%. Bigger swings both ways.` };
    }
  },
  risk: {
    chapter: 'Risk', title: 'More risk, bumpier ride', plain: 'Investments that can earn more also jump around more. Safe ones are steady but grow slowly.',
    how: ['Three roads, each starting with $100.', 'Savings are smooth and slow. Stocks swing a lot but usually climb higher over 20 years.', 'Every time you play it you get a different future. The bumps change, the pattern stays.'],
    words: [['Risk', 'How much the value can jump around.'], ['Return', 'How much it grows on average.'], ['Volatility', 'A fancy word for how bumpy the ride is.']],
    params: [], seeded: true, link: '/returns',
    draw(t, p, W, H) {
      const lanes = [['Savings', 3, 0.6, 'var(--c3)'], ['Bonds', 5, 5, 'var(--c2)'], ['Stocks', 9, 17, 'var(--c1)']], N = 20, pad = Math.max(18, W * 0.06), rpad = Math.max(64, W * 0.14), top0 = 36;
      const data = lanes.map((l, i) => { const z = series((p.seed || 1) * 97 + i * 13, N); let v = 100; return [100, ...z.map(zz => (v *= 1 + (l[1] + l[2] * zz) / 100))]; });
      const top = Math.max(...data.flat()) * 1.06, bot = Math.min(...data.flat(), 100) * 0.94, base = H - 52, X = k => pad + (W - pad - rpad - pad) * k / N, Y = v => base - (base - top0) * (v - bot) / (top - bot), pos = t * N, k0 = Math.min(N - 1, Math.floor(pos)), fr = pos - k0;
      let g = legend(lanes.map(l => [l[3], l[0]]), pad, 14, W - pad) + L(pad, Y(100), W - rpad, Y(100), 'var(--line)', 1.5, true) + T(W - rpad + 6, Y(100), '$100', { a: 'start', z: 11.5, w: 600, c: 'var(--mute)' });
      const vals = data.map((arr, i) => { let d = ''; for (let k = 0; k <= k0; k++) d += (k ? 'L' : 'M') + f1(X(k)) + ' ' + f1(Y(arr[k])); const cur = lerp(arr[k0], arr[k0 + 1], fr); d += `L${f1(X(pos))} ${f1(Y(cur))}`; g += `<path d="${d}" fill="none" stroke="${lanes[i][3]}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>` + C(X(pos), Y(cur), 5, lanes[i][3], { stroke: 'var(--panel-solid)', sw: 2 }); return cur; });
      const ys = vals.map((v, i) => ({ y: Y(v), i })).sort((a, b) => a.y - b.y); for (let k = 1; k < ys.length; k++) if (ys[k].y - ys[k - 1].y < 18) ys[k].y = ys[k - 1].y + 18;
      ys.forEach(o => { g += T(X(pos) + 12, o.y, M(vals[o.i]), { a: 'start', z: 13, c: lanes[o.i][3] }); });
      return { svg: g + prog(t, W, H, `Year ${Math.round(pos)} of ${N}`), cap: `Year ${Math.round(pos)}: savings ${M(vals[0])}, bonds ${M(vals[1])}, stocks ${M(vals[2])}. See how the stocks line zig-zags while savings glide.` };
    }
  },
  diversify: {
    chapter: 'Risk', title: 'Do not put all your eggs in one basket', plain: 'If you spread your money across many things, one bad thing cannot ruin you.',
    how: ['Both rows start with the same $1,000, split equally into blocks.', 'The top row puts everything in one company. The bottom row spreads it over six.', 'Then one company goes bust. The top row loses everything. The bottom row loses one small block.'],
    words: [['Diversification', 'Spreading money across many investments.'], ['Portfolio', 'All your investments together.'], ['Bankruptcy', 'When a company fails and its stock becomes worthless.']],
    params: [{ id: 'n', label: 'Companies in the bottom row', min: 1, max: 5, step: 1, v: 4, fmt: x => [1, 2, 3, 4, 6, 12][x] }], link: '/portfolio',
    draw(t, p, W, H) {
      const nb = [1, 2, 3, 4, 6, 12][Math.round(p.n)], pad = Math.max(24, W * 0.08), bw = W - 2 * pad, crash = ease(seg(t, 0.4, 0.75)), laneH = (H - 70) / 2;
      const lane = (n, top, label) => {
        const gap = n > 6 ? 3 : 6, cw = (bw - gap * (n - 1)) / n, y0 = top + 30, bh = 46, left = 1000 - 1000 / n * crash;
        let g = T(pad, top + 8, label, { a: 'start', z: 14 }) + T(W - pad, top + 8, M(left), { a: 'end', z: 17, c: left < 1000 ? 'var(--c4)' : 'var(--c3)' });
        for (let k = 0; k < n; k++) { const x = pad + k * (cw + gap), dead = k === 0 && crash > 0; g += R(x, y0 + (dead ? bh * crash : 0), cw, bh * (dead ? 1 - crash : 1), dead ? 'var(--c4)' : 'var(--c3)', { r: 8, op: dead ? 1 - crash * 0.4 : 1 }) + R(x, y0, cw, bh, 'none', { r: 8, stroke: 'var(--line)', sw: 1.5 }); if (cw > 40) g += T(x + cw / 2, y0 + bh / 2, dead && crash > 0.5 ? '✕' : 'Co. ' + (k + 1), { z: 12.5, c: dead && crash > 0.5 ? 'var(--c4)' : '#fff' }); }
        return g;
      };
      const g = lane(1, 10, 'All in one company') + lane(nb, 10 + laneH + 8, `Spread over ${nb} companies`) + T(W / 2, H - 22, crash > 0.05 ? 'One company goes bust' : 'Same $1,000 in both rows', { z: 15, c: crash > 0.05 ? 'var(--c4)' : 'var(--mute)' });
      return { svg: g, cap: crash < 0.05 ? `The same $1,000, either all in one company or spread over ${nb}.` : `One company fails. Top row: you lose 100% of your money. Bottom row: you lose ${nf(100 / nb, 0)}% and keep ${M(1000 - 1000 / nb)}.` };
    }
  },
  beta: {
    chapter: 'Risk', title: 'Beta: how jumpy is a stock?', plain: 'Beta tells you how much a stock moves when the whole market moves. Beta 2 means it jumps twice as much.',
    how: ['The grey line is the whole stock market.', 'The coloured line is one stock with a beta of 1.5, so it moves 1.5 times as much.', 'Beta 1 copies the market. Above 1 exaggerates it. Below 1 calms it.'],
    words: [['Beta', 'How much a stock moves compared with the market.'], ['Market', 'All stocks together.'], ['Defensive stock', 'A stock with beta below 1.']],
    params: [{ id: 'beta', label: 'Beta of the stock', min: 0, max: 2.5, step: 0.1, v: 1.5, fmt: x => nf(x, 1) }], seeded: true, link: '/capm',
    draw(t, p, W, H) {
      const N = 24, z = series((p.seed || 1) * 31 + 5, N), mk = [100], st = [100], pad = Math.max(18, W * 0.06);
      z.forEach(zz => { const r = (1 + 4 * zz) / 100; mk.push(mk[mk.length - 1] * (1 + r)); st.push(st[st.length - 1] * (1 + r * p.beta)); });
      const lo = Math.min(...mk, ...st) * 0.95, hi = Math.max(...mk, ...st) * 1.05, base = H - 52, X = k => pad + (W - 2 * pad) * k / N, Y = v => base - (base - 40) * (v - lo) / (hi - lo), pos = t * N, k0 = Math.min(N - 1, Math.floor(pos));
      const path = (arr, c) => { let d = ''; for (let k = 0; k <= k0; k++) d += (k ? 'L' : 'M') + f1(X(k)) + ' ' + f1(Y(arr[k])); const cur = lerp(arr[k0], arr[k0 + 1], pos - k0); d += `L${f1(X(pos))} ${f1(Y(cur))}`; return `<path d="${d}" fill="none" stroke="${c}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>` + C(X(pos), Y(cur), 5, c, { stroke: 'var(--panel-solid)', sw: 2 }); };
      const g = legend([['var(--mute)', 'The market'], ['var(--c1)', `Your stock (beta ${nf(p.beta, 1)})`]], pad, 14, W - pad) + L(pad, Y(100), W - pad, Y(100), 'var(--line)', 1.5, true) + path(mk, 'var(--mute)') + path(st, 'var(--c1)');
      const m1 = (mk[k0 + 1] / mk[k0] - 1) * 100, s1 = (st[k0 + 1] / st[k0] - 1) * 100;
      return { svg: g + prog(t, W, H, `Month ${Math.round(pos)} of ${N}`), cap: `This month the market moved ${m1 >= 0 ? '+' : ''}${nf(m1, 1)}%, so a beta of ${nf(p.beta, 1)} moved ${s1 >= 0 ? '+' : ''}${nf(s1, 1)}%.` };
    }
  },
  mix2: {
    chapter: 'Risk', title: 'Mixing investments calms the ride', plain: 'When one investment drops while the other rises, blending them smooths the bumps. That is why mixing works.',
    how: ['Two investments, A (jumpy) and B (calmer).', 'Here they are unrelated (0): sometimes one rises while the other falls.', 'The dark line is your mix. The less they move together, the calmer it gets.'],
    words: [['Correlation', 'Do two things move together? +1 yes, −1 opposite.'], ['Blend', 'Putting money in both.'], ['Standard deviation', 'A number for how bumpy something is.']],
    params: [{ id: 'rho', label: 'How much A and B move together', min: -1, max: 1, step: 0.1, v: 0, fmt: x => nf(x, 1) }, { id: 'wA', label: 'Share in A', min: 0, max: 100, step: 10, v: 50, fmt: x => x + '%' }], seeded: true, link: '/portfolio',
    draw(t, p, W, H) {
      const N = 30, sdA = p.sdA || 20, sdB = p.sdB || 10, za = series((p.seed || 1) * 7 + 1, N), zc = series((p.seed || 1) * 7 + 2, N), w = p.wA / 100, rho = clamp(p.rho, -1, 1), pad = Math.max(18, W * 0.06);
      const A = za.map(z => sdA * z), B = za.map((z, k) => sdB * (rho * z + Math.sqrt(1 - rho * rho) * zc[k])), P = A.map((a, k) => w * a + (1 - w) * B[k]);
      const sd = a => { const m = sum(a) / a.length; return Math.sqrt(sum(a.map(x => (x - m) ** 2)) / (a.length - 1)); }, lim = Math.max(sdA, sdB) * 2.6, cy = 40 + (H - 150) / 2 + 10, hh = (H - 150) / 2, X = k => pad + (W - 2 * pad) * k / (N - 1), Y = v => cy - hh * v / lim, k0 = Math.floor(t * (N - 1));
      const pathOf = (arr, c, wd) => { let d = ''; for (let k = 0; k <= k0; k++) d += (k ? 'L' : 'M') + f1(X(k)) + ' ' + f1(Y(arr[k])); return `<path d="${d}" fill="none" stroke="${c}" stroke-width="${wd}" stroke-linecap="round" stroke-linejoin="round"/>`; };
      let g = legend([['var(--c1)', 'A'], ['var(--c2)', 'B'], ['var(--ink)', 'Your mix']], pad, 14) + L(pad, cy, W - pad, cy, 'var(--line)', 1.5, true) + pathOf(A, 'var(--c1)', 2.5) + pathOf(B, 'var(--c2)', 2.5) + pathOf(P, 'var(--ink)', 4);
      const tw = (W - 2 * pad - 20) / 3, ty = H - 92;
      [['A', sd(A), 'var(--c1)'], ['B', sd(B), 'var(--c2)'], ['Your mix', sd(P), 'var(--ink)']].forEach((r, i) => { const x = pad + i * (tw + 10); g += R(x, ty, tw, 58, 'var(--soft)', { r: 12 }) + T(x + tw / 2, ty + 16, r[0] + ' swings', { z: 12.5, w: 600, c: 'var(--mute)' }) + T(x + tw / 2, ty + 40, '±' + nf(r[1], 1) + '%', { z: 20, c: r[2] }); });
      return { svg: g, cap: `A swings about ${nf(sd(A), 1)}% and B about ${nf(sd(B), 1)}%. Your mix swings only ${nf(sd(P), 1)}%${rho < 0.5 ? ', because one often rises when the other falls' : ''}.` };
    }
  },
  journey: {
    chapter: 'Risk', title: 'Ups and downs cost more than they give', plain: 'If you gain 50% and then lose 50%, you do not break even. Losses hit a bigger base, so they hurt more.',
    how: ['Start with $100.', 'Gain 50%: you have $150.', 'Lose 50%: you have $75. The average is 0%, but you are down 25%.'],
    words: [['Average return', 'The simple average of yearly returns.'], ['Compound return', 'What you really earned after compounding.'], ['Drawdown', 'A fall from a high point.']],
    params: [{ id: 'swing', label: 'Size of the gain and loss', min: 10, max: 90, step: 10, v: 50, fmt: x => x + '%' }], link: '/returns',
    draw(t, p, W, H) {
      const rets = p.rets && p.rets.length ? p.rets : [p.swing, -p.swing], N = rets.length, start = p.start || 100; let v = start; const vals = [v]; rets.forEach(r => vals.push((v *= 1 + r / 100)));
      const pad = Math.max(18, W * 0.06), base = H - 70, top = Math.max(...vals) * 1.12, slot = (W - 2 * pad) / (N + 1), bw = clamp(slot * 0.6, 12, 80), pos = t * N, k0 = Math.min(N - 1, Math.floor(pos)), z = N > 6 ? 11.5 : 14;
      let g = L(pad, base, W - pad, base);
      for (let k = 0; k <= N; k++) { if (k > k0 + 1) break; const part = k === k0 + 1 ? ease(pos - k0) : 1, val = k === k0 + 1 ? lerp(vals[k0], vals[k], part) : vals[k], hh = (base - 44) * val / top, cx = pad + (k + 0.5) * slot; g += R(cx - bw / 2, base - hh, bw, hh, k === 0 ? 'var(--sky)' : rets[k - 1] >= 0 ? 'var(--c3)' : 'var(--c4)', { r: 8 }); if (bw > 26 || N <= 6) g += T(cx, base - (base - 44) * vals[k] / top - 14, M(val), { z }); g += T(cx, base + 18, k === 0 ? 'Start' : (rets[k - 1] >= 0 ? '+' : '') + nf(rets[k - 1], 0) + '%', { z: 12.5, c: k === 0 ? 'var(--mute)' : rets[k - 1] >= 0 ? 'var(--c3)' : 'var(--c4)' }); }
      const avg = sum(rets) / N, done = pos >= N - 0.02;
      return { svg: g, cap: done ? `Average return: ${nf(avg, 1)}% a period. But you went from ${M(start)} to ${M(vals[N])} (${nf((vals[N] / start - 1) * 100, 0)}%). Ups and downs cost you.` : `Period ${Math.min(N, k0 + 1)}: ${rets[k0] >= 0 ? 'a gain' : 'a loss'} of ${nf(Math.abs(rets[k0]), 0)}%.` };
    }
  },
  npv: {
    chapter: 'Making decisions', title: 'Is this project worth doing?', plain: 'Add up what you will get in the future (shrunk to today\'s value) and compare it with what you pay now. If you get more, do it.',
    how: ['The rose bar is what you pay today.', 'Each future payment is shrunk to today\'s value and stacked in the green bar.', 'If the green bar ends above the dashed line, the project is worth it. The gap is called NPV.'],
    words: [['NPV', 'Net present value: what you gain, in today\'s money.'], ['Hurdle rate', 'The return you need to make the project worth it.'], ['Investment', 'Money spent now to earn more later.']],
    params: [{ id: 'cost', label: 'Cost today', min: 50, max: 500, step: 10, v: 100, fmt: M }, { id: 'pay', label: 'You get each year', min: 10, max: 200, step: 5, v: 40, fmt: M }, { id: 'rate', label: 'Return you need', min: 1, max: 25, step: 1, v: 10, fmt: x => x + '%' }], link: '/capbud',
    draw(t, p, W, H) {
      const flows = (p.flows && p.flows.length ? p.flows : [p.pay, p.pay, p.pay, p.pay]).slice(0, 10), n = flows.length, r = p.rate / 100, pvs = flows.map((f, k) => f / Math.pow(1 + r, k + 1)), total = sum(pvs), top = Math.max(p.cost, total) * 1.15, base = H - 78, hmax = base - 58, sc = hmax / top, bw = Math.min(130, W * 0.24), c1 = W * 0.27, c2 = W * 0.73, pad = Math.max(18, W * 0.06);
      let g = L(pad, base, W - pad, base) + R(c1 - bw / 2, base - p.cost * sc, bw, p.cost * sc, 'var(--c4)', { r: 10 }) + T(c1, base - p.cost * sc - 16, M(p.cost), { z: 18, c: 'var(--c4)', halo: true }) + T(c1, base + 18, 'You pay today', { z: 14 });
      let y = base, landed = 0;
      pvs.forEach((pv, k) => { const a = ease(seg(t, k / (n + 0.6), (k + 1) / (n + 0.6))), hh = pv * sc * a; landed += pv * a; y -= hh; g += R(c2 - bw / 2, y, bw, hh, k % 2 ? 'var(--c3)' : 'color-mix(in srgb, var(--c3) 72%, var(--panel-solid))', { r: 4 }); if (hh > 18 && bw > 60) g += T(c2, y + hh / 2, `Year ${k + 1}`, { z: 11.5, c: '#fff' }); });
      g += L(c1 - bw / 2 - 10, base - p.cost * sc, c2 + bw / 2 + 10, base - p.cost * sc, 'var(--ink)', 1.5, true) + T(c2, base - sum(pvs) * sc - 16, M(landed), { z: 18, c: 'var(--c3)', halo: true }) + T(c2, base + 18, 'Worth today', { z: 14 }) + T(c2, base + 37, 'of what you get', { z: 12.5, w: 600, c: 'var(--mute)' });
      const done = t > 0.96, good = total > p.cost;
      if (done) g += chip(W / 2, 18, good ? `Worth it: +${M(total - p.cost)}` : `Not worth it: −${M(p.cost - total)}`, good ? 'var(--c3)' : 'var(--c4)', '#fff', 14);
      return { svg: g, cap: done ? (good ? `Worth ${M(total)} today for a cost of ${M(p.cost)}. You gain ${M(total - p.cost)}. Do it! (That gain is the NPV.)` : `Worth only ${M(total)} today for a cost of ${M(p.cost)}. You lose ${M(p.cost - total)}. Skip it. (Negative NPV.)`) : `Each payment is worth less today than on the day you get it. The green bar holds ${M(landed)} so far against ${M(p.cost)} paid.` };
    }
  },
  blend: {
    chapter: 'Making decisions', title: 'What return does a company need?', plain: 'A company is funded by owners and lenders. Each wants a return. The company must earn the average of both, weighted by how much each put in.',
    how: ['The bar widths show who funds the company: owners (blue) and lenders (yellow).', 'Owners want a higher return because they take more risk.', 'The dashed line shows the blended average. Any new project must beat it.'],
    words: [['Cost of capital', 'The return a company must earn to keep funders happy.'], ['Equity', 'Money put in by owners.'], ['Debt', 'Money borrowed from lenders.']],
    params: [{ id: 'wE', label: 'Share funded by owners', min: 10, max: 100, step: 5, v: 70, fmt: x => x + '%' }, { id: 'ke', label: 'Return owners want', min: 4, max: 20, step: 0.5, v: 10.5, fmt: x => x + '%' }, { id: 'kd', label: 'Return lenders want (after tax)', min: 1, max: 12, step: 0.5, v: 4.5, fmt: x => x + '%' }], link: '/wacc',
    draw(t, p, W, H) {
      const w = p.wE / 100, avg = w * p.ke + (1 - w) * p.kd, u = ease(seg(t, 0.05, 0.6)), a = ease(seg(t, 0.6, 0.95)), pad = Math.max(24, W * 0.08), BW = W - 2 * pad, base = H - 80, hmax = base - 58, hi = Math.max(p.ke, p.kd) * 1.1, sc = hmax / hi, gap = 4;
      const wE = BW * w - gap / 2, wD = BW * (1 - w) - gap / 2;
      let g = L(pad, base, W - pad, base) + R(pad, base - p.ke * sc * u, wE, p.ke * sc * u, 'var(--sky)', { r: 10 }) + R(pad + BW * w + gap / 2, base - p.kd * sc * u, wD, p.kd * sc * u, 'var(--sun)', { r: 10 });
      g += T(pad + wE / 2, base - p.ke * sc - 16, `${nf(p.ke * u, 1)}%`, { z: 17 }) + (wD > 40 ? T(pad + BW * w + gap / 2 + wD / 2, base - p.kd * sc - 16, `${nf(p.kd * u, 1)}%`, { z: 17 }) : '');
      g += T(pad + wE / 2, base + 18, `Owners ${p.wE}%`, { z: 14 }) + (wD > 70 ? T(pad + BW * w + gap / 2 + wD / 2, base + 18, `Lenders ${100 - p.wE}%`, { z: 14 }) : '') + T(pad + wE / 2, base + 37, 'want this return', { z: 12.5, w: 600, c: 'var(--mute)' });
      g += L(pad - 6, base - avg * sc * a, W - pad + 6, base - avg * sc * a, 'var(--c4)', 2.5, true) + chip(W / 2, 18, `Company must earn ${nf(avg * a, 2)}%`, 'color-mix(in srgb, var(--c4) 25%, transparent)', 'var(--ink)', 14);
      return { svg: g, cap: a < 0.99 ? 'Owners and lenders each want a different return.' : `Blend: ${p.wE}% × ${nf(p.ke, 1)}% + ${100 - p.wE}% × ${nf(p.kd, 1)}% = ${nf(avg, 2)}%. A new project must earn more than this to be worth it.` };
    }
  },
  breakeven: {
    chapter: 'Making decisions', title: 'When does a business start to profit?', plain: 'First you earn back your fixed costs, like rent. Only after that does each sale become real profit.',
    how: ['Each cup of lemonade earns a little after its own ingredients.', 'That little amount slowly fills the rent bar.', 'When the rent bar is full you break even. Every cup after that is profit.'],
    words: [['Fixed costs', 'Bills you pay no matter how much you sell.'], ['Break-even', 'The point where you stop losing money.'], ['Margin', 'What is left of a sale after its own cost.']],
    params: [{ id: 'price', label: 'Price per cup', min: 2, max: 10, step: 0.5, v: 5, fmt: x => '$' + x }, { id: 'cost', label: 'Cost per cup', min: 0.5, max: 8, step: 0.5, v: 2, fmt: x => '$' + x }, { id: 'fixed', label: 'Fixed costs (rent)', min: 100, max: 2000, step: 50, v: 300, fmt: M }], link: '/breakeven',
    draw(t, p, W, H) {
      const mg = Math.max(0.01, p.price - p.cost), be = Math.ceil(p.fixed / mg), maxC = Math.ceil(be * 2.2), cups = Math.round(t * maxC), paid = Math.min(p.fixed, cups * mg), profit = Math.max(0, cups * mg - p.fixed), pad = Math.max(24, W * 0.08), BW = W - 2 * pad, pmax = Math.max(1, maxC * mg - p.fixed);
      let g = T(W / 2, 30, `${cups} cups sold`, { z: 30 });
      g += T(pad, 84, 'Step 1: pay the rent', { a: 'start', z: 14 }) + T(W - pad, 84, `${M(paid)} of ${M(p.fixed)}`, { a: 'end', z: 14, c: 'var(--mute)' }) + R(pad, 98, BW, 28, 'var(--soft)', { r: 14 }) + R(pad, 98, BW * paid / p.fixed, 28, paid >= p.fixed ? 'var(--c3)' : 'var(--c2)', { r: 14 });
      g += T(pad, 164, 'Step 2: keep the profit', { a: 'start', z: 14, c: paid >= p.fixed ? 'var(--ink)' : 'var(--mute)' }) + T(W - pad, 164, M(profit), { a: 'end', z: 14, c: 'var(--c3)' }) + R(pad, 178, BW, 28, 'var(--soft)', { r: 14 }) + R(pad, 178, BW * profit / pmax, 28, 'var(--c3)', { r: 14 });
      g += prog(t, W, H, `Each cup adds ${M(mg)} after its own cost`);
      return { svg: g, cap: cups < be ? `Each cup adds ${M(mg)} toward the rent. ${M(p.fixed - paid)} still to cover. Not profitable yet.` : cups === be ? `Break-even! The rent is paid with cup number ${be}.` : `Rent is paid. Every extra cup is ${M(mg)} of pure profit. You made ${M(profit)} so far.` };
    }
  },
  cycle: {
    chapter: 'Making decisions', title: 'Where does the cash get stuck?', plain: 'A shop pays for goods, waits to sell them, then waits again to be paid. During that wait its cash is stuck.',
    how: ['Goods sit on the shelf until they sell (blue).', 'Customers take time to pay (green).', 'Suppliers give you time to pay (yellow). The part not covered is the time your cash is stuck (rose).'],
    words: [['Inventory', 'Goods waiting to be sold.'], ['Receivables', 'Money customers still owe you.'], ['Cash cycle', 'Days your cash is tied up in the business.']],
    params: [{ id: 'dio', label: 'Days goods sit on the shelf', min: 5, max: 120, step: 5, v: 45, fmt: x => x }, { id: 'dso', label: 'Days customers take to pay', min: 5, max: 90, step: 5, v: 40, fmt: x => x }, { id: 'dpo', label: 'Days you take to pay suppliers', min: 5, max: 120, step: 5, v: 30, fmt: x => x }], link: '/wc',
    draw(t, p, W, H) {
      const total = Math.max(p.dio + p.dso, p.dpo) * 1.05, pad = Math.max(18, W * 0.05), X = d => pad + (W - 2 * pad) * d / total, day = t * total, stuck = p.dio + p.dso - p.dpo, bh = 30;
      const bar = (a, b, y, c, label) => { const w = X(b) - X(a), fw = clamp(X(Math.min(b, Math.max(a, day))) - X(a), 0, w); return T(pad, y - 13, label, { a: 'start', z: 13 }) + R(X(a), y, w, bh, 'var(--soft)', { r: 9 }) + R(X(a), y, fw, bh, c, { r: 9 }); };
      let g = L(X(day), 38, X(day), 238, 'var(--mute)', 1.5, true) + bar(0, p.dio, 56, 'var(--sky)', `Goods sit on the shelf: ${p.dio} days`) + bar(p.dio, p.dio + p.dso, 110, 'var(--mint)', `Customers take to pay: ${p.dso} days`) + bar(0, p.dpo, 164, 'var(--sun)', `You pay your supplier: day ${p.dpo}`);
      if (stuck > 0) g += R(X(p.dpo), 208, X(p.dio + p.dso) - X(p.dpo), 24, 'var(--c4)', { r: 8, op: day >= p.dio + p.dso ? 1 : 0.3 }) + T((X(p.dpo) + X(p.dio + p.dso)) / 2, 220, X(p.dio + p.dso) - X(p.dpo) > 110 ? `Stuck ${stuck} days` : `${stuck}d`, { z: 12.5, c: '#fff' });
      return { svg: g + T(W - pad, H - 30, `Day ${Math.round(day)}`, { a: 'end', z: 12.5, w: 600, c: 'var(--mute)' }) + R(pad, H - 14, W - 2 * pad, 6, 'var(--soft)', { r: 3 }) + R(pad, H - 14, (W - 2 * pad) * t, 6, 'var(--c1)', { r: 3 }), cap: stuck > 0 ? `You pay your supplier on day ${p.dpo} but customers only pay you by day ${p.dio + p.dso}. Your cash is stuck for ${stuck} days.` : 'Customers pay you before you must pay suppliers. No cash is stuck, which is great.' };
    }
  },
  merge: {
    chapter: 'Making decisions', title: 'Will a takeover help profit per share?', plain: 'When one company buys another, its profit grows, but so can the number of shares. It is a good deal if profit grows faster than shares.',
    how: ['Profit: the two companies\' profits add up.', 'Shares: new shares may be created to pay for the deal.', 'Profit per share = profit ÷ shares. Compare before and after.'],
    words: [['Profit per share', 'Company profit divided by the number of shares.'], ['Accretive', 'A deal that raises profit per share.'], ['Dilutive', 'A deal that lowers profit per share.']],
    params: [{ id: 'stock', label: 'Share paid with new stock', min: 0, max: 100, step: 10, v: 50, fmt: x => x + '%' }, { id: 'syn', label: 'Yearly savings from joining', min: 0, max: 100, step: 5, v: 20, fmt: x => '$' + x + 'M' }], link: '/merger',
    draw(t, p, W, H) {
      const d = (k, v) => (p[k] != null ? p[k] : v), aNI = d('aNI', 500), aSh = d('aSh', 100), aPx = d('aPx', 60), tNI = d('tNI', 100), tSh = d('tSh', 40), tPx = d('tPx', 30), prem = d('prem', 30), rate = d('rate', 6), tax = d('tax', 25), syn = d('syn', 20), st = d('stock', 50) / 100;
      const price = tPx * (1 + prem / 100) * tSh, newSh = price * st / aPx, intAT = price * (1 - st) * rate / 100 * (1 - tax / 100), ni = aNI + tNI + syn * (1 - tax / 100) - intAT, sh = aSh + newSh, e0 = aNI / aSh, e1 = ni / sh;
      const pad = Math.max(16, W * 0.04), gap = 14, pw = (W - 2 * pad - 2 * gap) / 3, base = H - 76, hmax = base - 70;
      const panel = (i, title, v0, v1, fmt, c1, a) => { const x = pad + i * (pw + gap), top = Math.max(v0, v1) * 1.1, bw = Math.min(50, pw * 0.3), h0 = hmax * v0 / top, h1 = hmax * v1 / top * a, x0 = x + pw * 0.27, x1 = x + pw * 0.73; return R(x, 30, pw, base + 2, 'var(--soft)', { r: 14, op: 0.6 }) + T(x + pw / 2, 46, title, { z: 13.5 }) + R(x0 - bw / 2, base - h0, bw, h0, 'var(--sky)', { r: 8 }) + R(x1 - bw / 2, base - h1, bw, h1, c1, { r: 8 }) + T(x0, base - h0 - 12, fmt(v0), { z: 12.5 }) + T(x1, base - hmax * v1 / top - 12, fmt(v1 * a), { z: 12.5 }) + T(x0, base + 16, 'Before', { z: 12, w: 600, c: 'var(--mute)' }) + T(x1, base + 16, 'After', { z: 12, w: 600, c: 'var(--mute)' }); };
      const a1 = ease(seg(t, 0.05, 0.4)), a2 = ease(seg(t, 0.35, 0.7)), a3 = ease(seg(t, 0.65, 0.98));
      const g = panel(0, 'Profit ($M)', aNI, ni, x => nf(x, 0), 'var(--c3)', a1) + panel(1, 'Shares (M)', aSh, sh, x => nf(x, 0), 'var(--c2)', a2) + panel(2, 'Profit per share', e0, e1, x => money(x, 2), e1 >= e0 ? 'var(--c3)' : 'var(--c4)', a3);
      return { svg: g + prog(t, W, H, 'Profit ÷ shares'), cap: a3 < 0.99 ? 'Profit grows when the two companies join, and new shares may be created to pay for the deal.' : `Profit per share moves from ${money(e0, 2)} to ${money(e1, 2)}: ${e1 >= e0 ? 'a good deal for existing owners (accretive)' : 'a bad deal for existing owners (dilutive)'}, ${nf((e1 / e0 - 1) * 100, 1)}%.` };
    }
  },
  option: {
    chapter: 'Making decisions', title: 'An option is a ticket to buy later at a fixed price', plain: 'For a small fee you get the right (not the duty) to buy a stock at a set price. If the stock soars, you win big. If not, you lose only the fee.',
    how: ['You pay a small fee for the ticket.', 'The ticket says: buy at the strike price, whatever the stock does.', 'If the stock ends above the strike, the ticket is worth the difference. If below, it is worth nothing.'],
    words: [['Option', 'A ticket giving you the right to buy or sell.'], ['Strike price', 'The fixed price written on the ticket.'], ['Premium', 'The fee you pay for the ticket.']],
    params: [{ id: 'K', label: 'Strike price', min: 50, max: 150, step: 5, v: 100, fmt: M }, { id: 'prem', label: 'Fee for the ticket', min: 1, max: 30, step: 1, v: 8, fmt: M }], link: '/options',
    draw(t, p, W, H) {
      const S = p.K * lerp(0.6, 1.4, ease(t)), profit = Math.max(0, S - p.K) - p.prem, lo = p.K * 0.6, hi = p.K * 1.4, pad = Math.max(34, W * 0.08), X = s => pad + (W - 2 * pad) * (s - lo) / (hi - lo), top = 80, bot = H - 76, maxP = Math.max(10, hi - p.K - p.prem), span = maxP + p.prem, zero = top + (bot - top) * (maxP / span), Y = v => zero - (bot - top) * v / span;
      const col = profit >= 0 ? 'var(--c3)' : 'var(--c4)';
      let g = T(pad, 18, 'Your profit or loss at the end', { a: 'start', z: 13, w: 600, c: 'var(--mute)' }) + T(W - pad, 18, `${profit >= 0 ? '+' : '−'}${M(Math.abs(profit))}`, { a: 'end', z: 24, c: col }) + L(pad, zero, W - pad, zero, 'var(--mute)', 1.5);
      g += `<path d="M${f1(X(lo))} ${f1(Y(-p.prem))}L${f1(X(p.K))} ${f1(Y(-p.prem))}L${f1(X(hi))} ${f1(Y(hi - p.K - p.prem))}" fill="none" stroke="var(--c1)" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round"/>` + L(X(p.K), 62, X(p.K), bot + 6, 'var(--mute)', 1.5, true) + T(X(p.K), 52, `Strike ${M(p.K)}`, { z: 12.5, w: 600, c: 'var(--mute)' });
      g += L(X(S), Y(profit), X(S), bot + 6, col, 2, true) + C(X(S), Y(profit), 8, col, { stroke: 'var(--panel-solid)', sw: 3 }) + T(clamp(X(S), pad + 30, W - pad - 30), bot + 20, `Stock ${M(S)}`, { z: 14 });
      return { svg: g + prog(t, W, H, 'Stock price at the end'), cap: S <= p.K ? `The stock is at ${M(S)}, below the strike of ${M(p.K)}. The ticket is worthless. You lose only the ${M(p.prem)} fee.` : `The stock is at ${M(S)}. Your ticket lets you buy at ${M(p.K)}, worth ${M(S - p.K)}. After the ${M(p.prem)} fee, you ${profit >= 0 ? 'profit' : 'lose'} ${M(Math.abs(profit))}.` };
    }
  }
  ,
  average: {
    chapter: 'Chance and numbers', title: 'Average vs typical', plain: 'One very large number can drag the average far from what is typical. The middle value hardly moves.',
    how: ['Ten values, each shown as a dot on a line.', 'The average (coral) is the total shared out equally.', 'The middle value (green) is the one in the exact centre. One dot is far bigger than the rest, so only the average gets dragged.'],
    words: [['Average (mean)', 'Add everything up, divide by how many.'], ['Median', 'The middle value when sorted.'], ['Outlier', 'A value far away from the rest.']],
    params: [{ id: 'big', label: 'The biggest value', min: 55, max: 500, step: 5, v: 400, fmt: x => '$' + x + 'k' }], link: '/stats',
    draw(t, p, W, H) {
      const own = !!(p.data && p.data.length), data = own ? p.data : [32, 35, 38, 40, 42, 45, 48, 52, 55, p.big], pre = own ? (p.pre || '') : '$', post = own ? (p.post || '') : 'k';
      const fmt = x => pre + nf(x, !own || Number.isInteger(x) ? 0 : Math.abs(x) < 10 ? 2 : 1) + post, n = data.length, mu = mean(data), md = median(data), lo = Math.min(...data), hi = Math.max(...data), pad = Math.max(30, W * 0.08), sp = (hi - lo) || 1;
      const X = v => pad + (W - 2 * pad) * (v - lo + sp * 0.04) / (sp * 1.08), baseY = H * 0.74, shown = Math.ceil(seg(t, 0.02, 0.6) * n), u = ease(seg(t, 0.62, 0.92));
      const stack = rr => { const placed = [], out = []; [...data].sort((a, b) => a - b).forEach(v => { const x = X(v); let k = 0; placed.forEach(q => { if (Math.abs(q - x) < 2 * rr) k++; }); placed.push(x); out.push({ x, k }); }); return out; };
      let r = 9; while (r > 4 && Math.max(...stack(r).map(o => o.k + 1)) * (2 * r + 1) > H * 0.4) r -= 1;
      let g = L(pad - 6, baseY, W - pad + 6, baseY, 'var(--line)', 3) + T(pad, baseY + 20, fmt(lo), { a: 'start', z: 12.5, w: 600, c: 'var(--mute)' }) + T(W - pad, baseY + 20, fmt(hi), { a: 'end', z: 12.5, w: 600, c: 'var(--mute)' });
      stack(r).forEach((o, i) => { if (i < shown) g += C(o.x, baseY - r - 3 - o.k * (2 * r + 1), r, 'var(--c2)'); });
      const mark = (v, label, c, y) => { const x = clamp(X(v), pad + 40, W - pad - 40); return `<g opacity="${u}">` + L(X(v), y + 16, X(v), baseY, c, 2, true) + chip(x, y, `${label} ${fmt(v)}`, c, '#fff', 12.5) + '</g>'; };
      if (u > 0) g += mark(md, 'Middle', 'var(--c3)', H * 0.2) + mark(mu, 'Average', 'var(--c1)', H * 0.07);
      const gap = Math.abs(mu - md) / (Math.abs(md) || 1);
      return { svg: g, cap: u < 0.5 ? 'Each dot is one value.' : gap > 0.2 ? `The average is ${fmt(mu)} but the middle value is ${fmt(md)}. One big value drags the average. The middle is a better picture of what is typical.` : `The average (${fmt(mu)}) and the middle (${fmt(md)}) are close, so the values are fairly even.` };
    }
  },
  spread: {
    chapter: 'Chance and numbers', title: 'Spread: how bumpy is it?', plain: 'Two things can have the same average and feel completely different. The spread (standard deviation) tells you how bumpy.',
    how: ['Two investments both average 7% a year.', 'Each dot is one year. The shaded band is one spread either side of the average.', 'The bumpy lane has a wide band: results land far from the average.'],
    words: [['Standard deviation', 'A typical distance from the average. Bigger means bumpier.'], ['Volatility', 'Finance word for spread in returns.'], ['Variance', 'The spread, squared.']],
    params: [{ id: 'wild', label: 'How wild the bumpy lane is', min: 6, max: 30, step: 1, v: 18, fmt: x => '±' + x + '%' }], seeded: true, link: '/stats',
    draw(t, p, W, H) {
      const lanes = [['Calm', 4, 'var(--c3)'], ['Bumpy', p.wild, 'var(--c1)']], N = 20, avg = 7, pad = Math.max(24, W * 0.07), lh = (H - 96) / 2, k = Math.floor(t * N + 1e-9), sc = (lh / 2 - 8) / (Math.max(4, p.wild) * 2.4);
      let g = '';
      lanes.forEach(([name, sd, c], i) => {
        const top = 14 + i * (lh + 34), mid = top + 22 + lh / 2, z = series((p.seed || 1) * 11 + i * 7, N), X = j => pad + (W - 2 * pad) * (j + 0.5) / N, Y = v => mid - (v - avg) * sc;
        g += T(pad, top + 6, name, { a: 'start', z: 15 }) + T(W - pad, top + 6, `Spread ±${sd}%`, { a: 'end', z: 14, c: c }) + R(pad, Y(avg + sd), W - 2 * pad, Math.max(2, 2 * sd * sc), `color-mix(in srgb, ${c} 18%, transparent)`, { r: 8 }) + L(pad, Y(avg), W - pad, Y(avg), 'var(--mute)', 1.5, true);
        let d = ''; for (let j = 0; j < Math.min(N, k + 1); j++) { const v = avg + sd * z[j]; d += (j ? 'L' : 'M') + f1(X(j)) + ' ' + f1(clamp(Y(v), top + 20, top + 24 + lh)); }
        g += `<path d="${d}" fill="none" stroke="${c}" stroke-width="2" opacity=".45" stroke-linejoin="round"/>`;
        for (let j = 0; j < Math.min(N, k + 1); j++) g += C(X(j), clamp(Y(avg + sd * z[j]), top + 20, top + 24 + lh), 4.5, c);
      });
      g += prog(t, W, H, `Year ${Math.min(N, k + 1)} of ${N}`);
      return { svg: g, cap: `Both average ${avg}% a year. The calm lane stays near it (±4%). The bumpy lane lands anywhere from ${nf(avg - p.wild, 0)}% to ${nf(avg + p.wild, 0)}% in a typical year. Spread is the bumpiness.` };
    }
  },
  bell: {
    chapter: 'Chance and numbers', title: 'The bell curve: 68, 95, 99.7', plain: 'Many things follow a bell shape. Knowing the average and the spread tells you how likely any result is.',
    how: ['Most results land near the average, in the middle of the bell.', 'About 68 in 100 land within one spread of the average.', 'About 95 within two spreads, and almost all (99.7) within three.'],
    words: [['Normal distribution', 'The bell-shaped pattern of chance.'], ['Average (mean)', 'The centre of the bell.'], ['Standard deviation', 'How wide the bell is.']],
    params: [{ id: 'mean', label: 'Average yearly return', min: 0, max: 15, step: 1, v: 8, fmt: x => x + '%' }, { id: 'sd', label: 'Spread', min: 5, max: 30, step: 1, v: 15, fmt: x => '±' + x + '%' }], link: '/normal',
    draw(t, p, W, H) {
      const pad = Math.max(24, W * 0.06), base = H - 62, top = 48, X = z => pad + (W - 2 * pad) * (z + 4) / 8, Y = z => base - (base - top) * Math.exp(-z * z / 2);
      const curve = (a, b) => { let d = `M${f1(X(a))} ${f1(base)}`; for (let z = a; z <= b + 1e-9; z += 0.05) d += `L${f1(X(z))} ${f1(Y(z))}`; return d + `L${f1(X(b))} ${f1(base)}Z`; };
      let g = '';
      [[3, 'var(--lav)', 0.5, '99.7%'], [2, 'var(--sky)', 0.65, '95%'], [1, 'var(--c3)', 0.85, '68%']].forEach(([k, c, op, lab], i) => { const a = ease(seg(t, (2 - i) / 3, (3 - i) / 3)); if (a > 0) g += `<path d="${curve(-k, k)}" fill="${c}" opacity="${(op * a).toFixed(2)}"/>`; });
      let d = ''; for (let z = -4; z <= 4.001; z += 0.05) d += (z > -4 ? 'L' : 'M') + f1(X(z)) + ' ' + f1(Y(z));
      g += `<path d="${d}" fill="none" stroke="var(--ink)" stroke-width="2.5"/>` + L(pad, base, W - pad, base, 'var(--mute)', 1.5);
      for (let z = -3; z <= 3; z++) g += L(X(z), base, X(z), base + 6, 'var(--mute)', 1.5) + T(X(z), base + 22, nf(p.mean + z * p.sd, 0) + '%', { z: 12.5, w: z === 0 ? 700 : 500, c: z === 0 ? 'var(--ink)' : 'var(--mute)' });
      const ph = t < 0.33 ? 1 : t < 0.66 ? 2 : 3, lab = ['68%', '95%', '99.7%'][ph - 1];
      g += chip(W / 2, 20, `${lab} of years land between ${nf(p.mean - ph * p.sd, 0)}% and ${nf(p.mean + ph * p.sd, 0)}%`, 'var(--soft)', 'var(--ink)', 13.5);
      return { svg: g, cap: `Average ${p.mean}%, spread ±${p.sd}%. About ${['68 in 100', '95 in 100', '997 in 1,000'][ph - 1]} years land within ${ph} spread${ph > 1 ? 's' : ''} of the average, between ${nf(p.mean - ph * p.sd, 0)}% and ${nf(p.mean + ph * p.sd, 0)}%.` };
    }
  },
  tail: {
    chapter: 'Chance and numbers', title: 'The chance of a big loss', plain: 'With the average and the spread you can estimate how likely a bad year is. This is how banks measure risk.',
    how: ['The bell shows how likely each yearly return is.', 'The red line slides toward a bad loss.', 'The shaded area to its left is the chance of a year that bad, or worse.'],
    words: [['Probability', 'How likely something is, from 0% to 100%.'], ['Tail risk', 'The chance of a very bad result.'], ['Value at Risk', 'The loss you should only exceed a few times in 100.']],
    params: [{ id: 'mean', label: 'Average yearly return', min: 0, max: 15, step: 1, v: 7, fmt: x => x + '%' }, { id: 'sd', label: 'Spread', min: 5, max: 30, step: 1, v: 16, fmt: x => '±' + x + '%' }, { id: 'cut', label: 'A loss that worries you', min: -50, max: -5, step: 5, v: -20, fmt: x => x + '%' }], link: '/normal',
    draw(t, p, W, H) {
      const pad = Math.max(24, W * 0.06), base = H - 62, top = 66, lo = p.mean - 4 * p.sd, hi = p.mean + 4 * p.sd, X = v => pad + (W - 2 * pad) * (v - lo) / (hi - lo), Y = v => base - (base - top) * Math.exp(-Math.pow((v - p.mean) / p.sd, 2) / 2), cutNow = lerp(p.mean, p.cut, ease(t));
      const lowEnd = Math.max(lo, Math.min(cutNow, hi)), prob = ncdf((cutNow - p.mean) / p.sd);
      let g = '', d = `M${f1(X(lo))} ${f1(base)}`; for (let v = lo; v <= lowEnd + 1e-9; v += (hi - lo) / 160) d += `L${f1(X(v))} ${f1(Y(v))}`;
      g += `<path d="${d}L${f1(X(lowEnd))} ${f1(base)}Z" fill="var(--bad)" opacity=".5"/>`;
      let c = ''; for (let v = lo; v <= hi + 1e-9; v += (hi - lo) / 160) c += (v > lo ? 'L' : 'M') + f1(X(v)) + ' ' + f1(Y(v));
      g += `<path d="${c}" fill="none" stroke="var(--ink)" stroke-width="2.5"/>` + L(pad, base, W - pad, base, 'var(--mute)', 1.5);
      for (let k = -3; k <= 3; k++) { const v = p.mean + k * p.sd; g += L(X(v), base, X(v), base + 6, 'var(--mute)', 1.5) + T(X(v), base + 22, nf(v, 0) + '%', { z: 12.5, w: 500, c: 'var(--mute)' }); }
      if (0 > lo && 0 < hi) g += L(X(0), top - 8, X(0), base, 'var(--mute)', 1.5, true) + T(X(0), top - 18, 'break-even', { z: 12, w: 600, c: 'var(--mute)' });
      g += L(X(cutNow), top - 4, X(cutNow), base, 'var(--bad)', 2.5) + chip(clamp(X(cutNow), pad + 46, W - pad - 46), 22, `Chance: ${prob < 0.001 ? '<0.1' : nf(prob * 100, prob < 0.1 ? 1 : 0)}%`, 'var(--bad)', '#fff', 14);
      return { svg: g, cap: prob > 0.0005 ? `About ${nf(prob * 100, 1)}% chance of a year worse than ${nf(cutNow, 0)}%, roughly 1 year in ${nf(1 / prob, 0)}.` : 'Almost no chance of a year this bad.' };
    }
  },
  expected: {
    chapter: 'Chance and numbers', title: 'Expected value: the fair price of a bet', plain: 'Weigh each possible result by its chance and add them up. That is what a bet, a stock or a project is worth on average.',
    how: ['Each bar is one outcome. Wider means more likely, taller means bigger.', 'Green is a gain, rose is a loss.', 'The dashed line is the expected value: the average per try if you could repeat it many times.'],
    words: [['Probability', 'The chance of one outcome.'], ['Expected value', 'Each result × its chance, added up.'], ['Risk', 'Real results can differ a lot from the expected value.']],
    params: [{ id: 'pwin', label: 'Chance of winning', min: 10, max: 90, step: 5, v: 40, fmt: x => x + '%' }, { id: 'win', label: 'Win amount', min: 20, max: 200, step: 10, v: 100, fmt: M }, { id: 'lose', label: 'Loss amount', min: 10, max: 100, step: 10, v: 50, fmt: M }], link: '/prob',
    draw(t, p, W, H) {
      const outs = p.outcomes && p.outcomes.length ? p.outcomes : [{ label: 'Win', prob: p.pwin / 100, value: p.win }, { label: 'Lose', prob: 1 - p.pwin / 100, value: -p.lose }], ev = sum(outs.map(o => o.prob * o.value)), maxA = Math.max(...outs.map(o => Math.abs(o.value)), 1);
      const pad = Math.max(24, W * 0.07), BW = W - 2 * pad, gap = 6, hasNeg = outs.some(o => o.value < 0), zero = hasNeg ? H * 0.52 : H - 70, up = zero - 44, down = H - 60 - zero, sc = Math.min(up / maxA, hasNeg ? down / maxA : 1e9);
      let x = pad, g = L(pad, zero, W - pad, zero, 'var(--mute)', 1.5);
      outs.forEach((o, i) => {
        const w = Math.max(10, (BW - gap * (outs.length - 1)) * o.prob), a = ease(seg(t, i * 0.18, i * 0.18 + 0.4)), hh = Math.abs(o.value) * sc * a, y = o.value >= 0 ? zero - hh : zero;
        g += R(x, y, w, hh, o.value >= 0 ? 'var(--c3)' : 'var(--c4)', { r: 8 });
        if (a > 0.6) { g += T(x + w / 2, o.value >= 0 ? zero - Math.abs(o.value) * sc - 26 : zero + Math.abs(o.value) * sc + 14, (o.value >= 0 ? '+' : '−') + M(Math.abs(o.value)), { z: 15 }) + T(x + w / 2, o.value >= 0 ? zero - Math.abs(o.value) * sc - 10 : zero + Math.abs(o.value) * sc + 30, `${nf(o.prob * 100, 0)}% chance`, { z: 12.5, w: 600, c: 'var(--mute)' }); }
        x += w + gap;
      });
      const u = ease(seg(t, 0.7, 0.95)), yEv = zero - ev * sc;
      g += `<g opacity="${u}">` + L(pad - 6, yEv, W - pad + 6, yEv, 'var(--ink)', 2.5, true) + chip(W - pad - 60, clamp(yEv, 22, H - 22) + (ev >= 0 ? -22 : 22), `Expected ${ev >= 0 ? '+' : '−'}${M(Math.abs(ev))}`, 'var(--ink)', 'var(--panel-solid)', 13) + '</g>';
      return { svg: g, cap: u < 0.5 ? 'Each bar is one possible outcome. Wider means more likely.' : `Weighing each result by its chance gives ${ev >= 0 ? '+' : '−'}${M(Math.abs(ev))} per try on average. ${ev >= 0 ? 'Worth taking on average.' : 'A losing bet on average.'} Individual tries can still go either way.` };
    }
  },
  lawlarge: {
    chapter: 'Chance and numbers', title: 'More tries, more predictable', plain: 'A few flips can be lucky or unlucky. Over many tries, the result settles on the true chance.',
    how: ['Each flip is heads or tails. The line shows the share of heads so far.', 'At first it swings wildly.', 'After many flips it settles near the true chance (dashed line).'],
    words: [['Law of large numbers', 'More tries bring the result close to the true chance.'], ['Sample size', 'How many tries you have.'], ['Luck', 'Short-run noise that evens out over time.']],
    params: [{ id: 'p', label: 'True chance of heads', min: 10, max: 90, step: 5, v: 50, fmt: x => x + '%' }], seeded: true, link: '/prob',
    draw(t, p, W, H) {
      const N = 300, r = rng((p.seed || 1) * 13), flips = Array.from({ length: N }, () => (r() < p.p / 100 ? 1 : 0)), k = Math.max(1, Math.round(Math.pow(t, 1.7) * N)), pad = Math.max(34, W * 0.08), base = H - 74, top = 58;
      let cum = 0, d = ''; const X = j => pad + (W - 2 * pad - 8) * Math.log(j + 1) / Math.log(N + 1), Y = v => base - (base - top) * v;
      for (let j = 1; j <= k; j++) { cum += flips[j - 1]; d += (j > 1 ? 'L' : 'M') + f1(X(j)) + ' ' + f1(Y(cum / j)); }
      const heads = cum, share = heads / k;
      let g = L(pad, base, W - pad, base, 'var(--line)', 2) + L(pad, Y(p.p / 100), W - pad, Y(p.p / 100), 'var(--mute)', 1.5, true) + T(W - pad, Y(p.p / 100) - 12, `true chance ${p.p}%`, { a: 'end', z: 12.5, w: 600, c: 'var(--mute)' });
      [1, 10, 100, 300].forEach(v => { g += L(X(v), base, X(v), base + 5, 'var(--mute)', 1.5) + T(X(v), base + 20, String(v), { z: 12, w: 600, c: 'var(--mute)' }); });
      g += `<path d="${d}" fill="none" stroke="var(--c1)" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>` + C(X(k), Y(share), 5, 'var(--c1)', { stroke: 'var(--panel-solid)', sw: 2 }) + T(pad, 22, `After ${k} flips: ${heads} heads = ${nf(share * 100, 0)}%`, { a: 'start', z: 16 }) + T(W / 2, H - 14, 'number of flips', { z: 12, w: 600, c: 'var(--mute)' });
      return { svg: g, cap: k < 20 ? `After only ${k} flips, ${nf(share * 100, 0)}% heads is mostly luck.` : `After ${k} flips, ${nf(share * 100, 0)}% heads. The true chance is ${p.p}%. More flips, closer it gets.` };
    }
  },
  correlation: {
    chapter: 'Chance and numbers', title: 'Correlation: do two things move together?', plain: 'Correlation is a score from −1 to +1. It tells you whether two things rise and fall together, or not at all.',
    how: ['Each dot is one moment: the value of A (across) and B (up).', 'Dots in a tight rising line mean +1: they move together.', 'A shapeless cloud means 0, and a falling line means −1: opposite.'],
    words: [['Correlation', 'A score from −1 to +1 for moving together.'], ['Positive', 'Both rise and fall together.'], ['Diversify', 'Mix things with low correlation to calm the ride.']],
    params: [{ id: 'r', label: 'How much they move together', min: -1, max: 1, step: 0.1, v: 0.7, fmt: x => nf(x, 1) }], seeded: true, link: '/corr',
    draw(t, p, W, H) {
      const ext = !!(p.xs && p.xs.length > 2), N = ext ? Math.min(p.xs.length, p.ys.length) : 45, z1 = series((p.seed || 1) * 5 + 1, N), z2 = series((p.seed || 1) * 5 + 2, N), rr = clamp(p.r == null ? 0 : p.r, -1, 1);
      const xs0 = ext ? p.xs.slice(0, N) : z1, ys0 = ext ? p.ys.slice(0, N) : z1.map((z, i) => rr * z + Math.sqrt(1 - rr * rr) * z2[i]), sx = stdev(xs0) || 1, sy = stdev(ys0) || 1, mx = mean(xs0), my = mean(ys0), xs = xs0.map(v => (v - mx) / sx), ys = ys0.map(v => (v - my) / sy);
      const r = corr(xs0, ys0), size = Math.min(H - 70, W * 0.54), x0 = Math.max(18, W * 0.05), y0 = 18, S = v => clamp(v, -3, 3), X = v => x0 + size * (S(v) + 3.2) / 6.4, Y = v => y0 + size - size * (S(v) + 3.2) / 6.4, k = Math.ceil(t * N);
      let g = R(x0, y0, size, size, 'var(--card)', { r: 18, stroke: 'var(--line)' }) + L(X(0), y0 + 14, X(0), y0 + size - 14, 'var(--line)', 1.5, true) + L(x0 + 14, Y(0), x0 + size - 14, Y(0), 'var(--line)', 1.5, true) + T(x0 + 16, y0 + 18, 'B ↑', { a: 'start', z: 12, w: 600, c: 'var(--mute)' });
      for (let i = 0; i < k; i++) g += C(X(xs[i]), Y(ys[i]), 5, 'var(--c1)', { stroke: '#fff', sw: 1.5, op: 0.88 });
      const fa = ease(seg(t, 0.7, 1)); if (fa > 0 && Number.isFinite(r)) g += L(X(-2.9), Y(-2.9 * r), X(2.9), Y(2.9 * r), 'var(--c4)', 3.5).replace('stroke-linecap="round"', `stroke-linecap="round" opacity="${fa}"`);
      g += T(x0 + size / 2, y0 + size + 22, 'A moves →', { z: 12.5, w: 600, c: 'var(--mute)' });
      const tx0 = x0 + size + Math.max(16, W * 0.04), room = W - tx0 - 8, bigZ = room < 125 ? 26 : 34, lab = Math.abs(r) > 0.7 ? 'strong' : Math.abs(r) > 0.3 ? 'moderate' : 'weak', dir = r > 0.1 ? (room < 125 ? 'together' : 'move together') : r < -0.1 ? (room < 125 ? 'opposite' : 'move opposite') : 'unrelated';
      const yc = y0 + size / 2 - 62;
      g += T(tx0, yc, 'Score', { a: 'start', z: 13, w: 600, c: 'var(--mute)' }) + T(tx0, yc + 38, (r >= 0 ? '+' : '−') + nf(Math.abs(r), 2), { a: 'start', z: bigZ - 4, f: 1, c: r >= 0 ? 'var(--c1)' : 'var(--c4)' }) + T(tx0, yc + 80, Math.abs(r) < 0.1 ? 'none' : lab, { a: 'start', z: 16 }) + T(tx0, yc + 102, dir, { a: 'start', z: 14, w: 500, c: 'var(--mute)' });
      return { svg: g, cap: `A correlation of ${r >= 0 ? '+' : '−'}${nf(Math.abs(r), 2)}: the two ${dir}. ${Math.abs(r) > 0.6 ? (r > 0 ? 'Mixing them gives little diversification.' : 'Mixing them calms the ride a lot.') : 'Mixing them helps calm the ride.'}` };
    }
  },
  regression: {
    chapter: 'Chance and numbers', title: 'Beta is a slope', plain: 'Plot a stock\'s moves against the market\'s. The slope of the line through the dots is the stock\'s beta.',
    how: ['Each dot is one month: how far the market moved (across) and the stock (up).', 'The best-fit line runs through the middle of the dots.', 'Its slope is beta: how much the stock moves for each 1% the market moves.'],
    words: [['Beta', 'The slope of stock moves against market moves.'], ['Regression', 'Fitting the best straight line through dots.'], ['R-squared', 'How tightly the dots hug the line.']],
    params: [{ id: 'beta', label: 'The stock\'s beta', min: -0.5, max: 2.5, step: 0.1, v: 1.5, fmt: x => nf(x, 1) }], seeded: true, link: '/corr',
    draw(t, p, W, H) {
      const ext = !!(p.xs && p.xs.length > 2), N = ext ? Math.min(p.xs.length, p.ys.length) : 40, z1 = series((p.seed || 1) * 9 + 1, N), z2 = series((p.seed || 1) * 9 + 2, N);
      const xs = ext ? p.xs.slice(0, N) : z1.map(z => 3.5 * z), ys = ext ? p.ys.slice(0, N) : z1.map((z, i) => p.beta * 3.5 * z + 2.5 * z2[i]), fit = linreg(xs, ys), m = Math.max(1e-6, ...xs.map(Math.abs), ...ys.map(Math.abs)) * 1.1;
      const size = Math.min(H - 76, W * 0.54), x0 = Math.max(18, W * 0.05), y0 = 14, X = v => x0 + size * (clamp(v, -m, m) + m) / (2 * m), Y = v => y0 + size - size * (clamp(v, -m, m) + m) / (2 * m), k = Math.ceil(seg(t, 0, 0.7) * N);
      let g = R(x0, y0, size, size, 'var(--card)', { r: 18, stroke: 'var(--line)' }) + L(X(0), y0 + 14, X(0), y0 + size - 14, 'var(--line)', 1.5, true) + L(x0 + 14, Y(0), x0 + size - 14, Y(0), 'var(--line)', 1.5, true) + T(x0 + 16, y0 + 18, 'Stock ↑', { a: 'start', z: 12, w: 600, c: 'var(--mute)' });
      for (let i = 0; i < k; i++) g += C(X(xs[i]), Y(ys[i]), 5, 'var(--c1)', { stroke: '#fff', sw: 1.5, op: 0.88 });
      const fa = ease(seg(t, 0.72, 0.95)), run = m * 0.6;
      if (fa > 0 && Number.isFinite(fit.slope)) {
        const ex = m * 0.97; g += `<g opacity="${fa}">` + L(X(-ex), Y(fit.intercept - fit.slope * ex), X(ex), Y(fit.intercept + fit.slope * ex), 'var(--c4)', 3.5) + L(X(0), Y(fit.intercept), X(run), Y(fit.intercept), 'var(--c2)', 1.6, true) + L(X(run), Y(fit.intercept), X(run), Y(fit.intercept + fit.slope * run), 'var(--c2)', 1.6, true) + chip(Math.min(X(run) + 30, x0 + size - 26), Y(fit.intercept + fit.slope * run / 2), 'rise', 'var(--panel-solid)', 'var(--ink)', 12) + chip(X(run / 2), Y(fit.intercept) + (fit.slope >= 0 ? 20 : -20), 'run', 'var(--panel-solid)', 'var(--ink)', 12) + '</g>';
      }
      g += T(x0 + size / 2, y0 + size + 20, 'Market moved →', { z: 12.5, w: 600, c: 'var(--mute)' });
      const tx0 = x0 + size + Math.max(16, W * 0.04);
      const yc = y0 + size / 2 - 50;
      g += T(tx0, yc, 'Slope = beta', { a: 'start', z: 13, w: 600, c: 'var(--mute)' }) + T(tx0, yc + 40, fa > 0 ? nf(fit.slope, 2) : '…', { a: 'start', z: 30, f: 1, c: 'var(--c1)' }) + T(tx0, yc + 82, 'rise ÷ run', { a: 'start', z: 14, w: 500, c: 'var(--mute)' });
      return { svg: g, cap: fa > 0.5 ? `For every 1% the market moves, this stock tends to move ${nf(fit.slope, 2)}%. That slope is its beta.` : 'Each dot is one month: market move across, stock move up.' };
    }
  },
  montecarlo: {
    chapter: 'Chance and numbers', title: 'Risk simulation: try many futures', plain: 'Nobody knows the future, so we try many random ones and look at where they end up. That is a Monte Carlo simulation.',
    how: ['Each line is one possible future for $100 invested.', 'Every year gets a random result, using the average and spread.', 'The pile of end points on the right shows the range of what could happen.'],
    words: [['Simulation', 'Running many made-up futures on a computer.'], ['Monte Carlo', 'Simulation using random numbers.'], ['Range of outcomes', 'From a bad future to a good one.']],
    params: [{ id: 'vol', label: 'How bumpy (spread)', min: 5, max: 35, step: 1, v: 18, fmt: x => '±' + x + '%' }], seeded: true, link: '/scenarios',
    draw(t, p, W, H) {
      const M_ = 50, N = 20, mu = 7, paths = Array.from({ length: M_ }, (_, i) => { const z = series((p.seed || 1) * 101 + i * 17, N); let v = 100; return [100, ...z.map(zz => (v *= Math.max(0.05, 1 + (mu + p.vol * zz) / 100)))]; });
      const finals = paths.map(a => a[N]), sorted = [...finals].sort((a, b) => a - b), q = f => sorted[Math.floor(f * (sorted.length - 1))], top = Math.max(150, q(0.95) * 1.15), pad = Math.max(16, W * 0.04), hw = Math.max(70, W * 0.2), cx0 = pad + 36, cx1 = W - pad - hw - 14, base = H - 70, ty = 36;
      const X = k => cx0 + (cx1 - cx0) * k / N, Y = v => base - (base - ty) * Math.min(v, top) / top, pos = t * N, k0 = Math.min(N - 1, Math.floor(pos));
      let g = T(pad, 14, 'Each line is one possible future', { a: 'start', z: 13, w: 600, c: 'var(--mute)' }) + L(cx0, Y(100), cx1, Y(100), 'var(--mute)', 1.5, true) + T(cx0 - 6, Y(100), '$100', { a: 'end', z: 12, w: 600, c: 'var(--mute)' }) + L(cx0, base, cx1, base, 'var(--line)', 2);
      paths.forEach(a => { let d = ''; for (let k = 0; k <= k0; k++) d += (k ? 'L' : 'M') + f1(X(k)) + ' ' + f1(Y(a[k])); d += `L${f1(X(pos))} ${f1(Y(lerp(a[k0], a[k0 + 1], pos - k0)))}`; g += `<path d="${d}" fill="none" stroke="var(--c1)" stroke-width="1.5" opacity=".3" stroke-linejoin="round" stroke-linecap="round"/>`; });
      const bins = 14, hist = Array(bins).fill(0); finals.forEach(v => { hist[Math.min(bins - 1, Math.floor(Math.min(v, top - 1e-6) / top * bins))]++; });
      const hx = W - pad - hw, rev = ease(seg(t, 0.7, 1)), hmax = Math.max(...hist, 1);
      g += T(hx, 14, hw < 100 ? 'Ends' : 'Where they end', { a: 'start', z: 13, w: 600, c: 'var(--mute)' });
      hist.forEach((c, i) => { const y1 = Y((i + 1) * top / bins), y2 = Y(i * top / bins); g += R(hx, y1 + 1.5, (hw - 6) * c / hmax * rev, Math.max(1, y2 - y1 - 3), 'var(--c1)', { r: 4, op: 0.55 }); });
      if (rev > 0.8) [[0.1, 'bad', 'var(--c4)'], [0.5, 'typical', 'var(--c2)'], [0.9, 'good', 'var(--c3)']].forEach(([f, lab, col]) => { const yy = Y(q(f)), s2 = `${lab} ${M(q(f))}`, cw = s2.length * 7.4 + 22; g += L(cx0, yy, hx - 6, yy, col, 1.4, true) + R(cx1 - cw - 4, yy - 13, cw, 26, 'var(--panel-solid)', { r: 13, stroke: col }) + T(cx1 - cw / 2 - 4, yy, s2, { z: 12, w: 700 }); });
      return { svg: g + prog(t, W, H, `Year ${Math.round(pos)} of ${N}`), cap: rev > 0.9 ? `${M_} random futures. After ${N} years a typical one ends near ${M(q(0.5))}, a bad one near ${M(q(0.1))}, a good one near ${M(q(0.9))}. That spread is the risk.` : 'Each line is one random future for $100 invested.' };
    }
  }
};

/** Which moment of each story to show while the picture is at rest (1 = the finished frame). */
const POSTER = { loan: 0.4, growth: 0.7, inflation: 0.75, breakeven: 0.6, cycle: 0.85, rent: 0.9, spread: 0.75, risk: 0.85, snowball: 0.85 };

export const SCENE_ORDER = ['rent', 'growth', 'snowball', 'inflation', 'present', 'exchange', 'loan', 'bond', 'stock', 'leverage', 'risk', 'diversify', 'beta', 'mix2', 'journey', 'npv', 'blend', 'breakeven', 'cycle', 'merge', 'option', 'average', 'spread', 'bell', 'tail', 'expected', 'lawlarge', 'correlation', 'regression', 'montecarlo'];

/** Animated scene player with two modes.
 *  - mode "hover" (Learn page): sits still on its finished frame, plays while the pointer is over it (tap on touch).
 *  - mode "loop" (calculator pages): loops on its own while visible; one button switches on scrubbing and sliders.
 *  Draws at the stage's real pixel size; the caption box reserves the height of its longest caption. */
export class SceneView {
  constructor(host, id, { params = {}, external = false, mode = 'loop' } = {}) {
    this.sc = SCENES[id]; this.id = id; this.external = external; this.hover = mode === 'hover'; this.poster = POSTER[id] == null ? 1 : POSTER[id]; this.t = this.hover ? this.poster : 0; this.mode = 'watch';
    this.raf = 0; this.timer = 0; this.loopT = 0; this.playing = false; this.visible = this.hover; this.touched = false; this.active = false; this.plays = 0;
    this.p = { seed: 3, ...Object.fromEntries(this.sc.params.map(q => [q.id, q.v])), ...params };
    host.innerHTML = ''; host.classList.add('sv-wrap');
    this.stage = h('div', { class: 'sv-stage', role: 'img', 'aria-label': this.sc.title });
    this.cap = h('p', { class: 'sv-cap', 'aria-live': 'polite' });
    if (this.hover) this.buildHover(host); else this.buildLoop(host);
    if (typeof ResizeObserver !== 'undefined') { this.ob = new ResizeObserver(() => { const w = Math.floor(this.stage.clientWidth); if (w !== this.lastW) { this.lastW = w; requestAnimationFrame(() => { this.draw(); this.fitCaption(); }); } }); this.ob.observe(this.stage); }
    this.draw();
    requestAnimationFrame(() => this.fitCaption());
  }
  buildHover(host) {
    this.stage.tabIndex = 0; this.stage.classList.add('hoverable');
    host.append(h('div', { class: 'sv-frame' }, this.stage), this.cap);
    const start = () => {
      if (this.active) return;
      if (SceneView.current && SceneView.current !== this) SceneView.current.stopHover();
      SceneView.current = this; this.active = true;
      if (this.sc.seeded && this.plays++ > 0) { this.p.seed = (this.p.seed || 1) + 1; this.fitCaption(); }
      this.startWatch();
    };
    this.stage.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') start(); });
    this.stage.addEventListener('pointerdown', e => { if (e.pointerType !== 'mouse') start(); });
    this.stage.addEventListener('focus', start);
    /* once started it keeps playing until the reader moves on: another picture starts, or this one scrolls away */
    if ('IntersectionObserver' in window) { this.io = new IntersectionObserver(es => { if (!es[0].isIntersecting) this.stopHover(); }, { threshold: 0.15 }); this.io.observe(host); }
  }
  stopHover() {
    if (!this.active) return;
    this.active = false; this.halt(); this.t = this.poster; this.draw();
    if (SceneView.current === this) SceneView.current = null;
  }
  buildLoop(host) {
    this.btn = h('button', { class: 'btn play', type: 'button', onclick: () => this.setMode(this.mode === 'watch' ? 'explore' : 'watch') }, 'Make it interactive');
    this.hint = h('span', { class: 'sv-hint', hidden: true }, 'Move across the picture to explore');
    const ctl = h('div', { class: 'sv-ctl' }, this.btn, this.hint);
    if (this.sc.seeded) ctl.append(h('button', { class: 'btn small', type: 'button', onclick: () => { this.p.seed = (this.p.seed || 1) + 1; this.fitCaption(); if (this.mode === 'watch') this.startWatch(); else this.draw(); } }, 'Roll again'));
    this.sl = h('div', { class: 'sv-params', hidden: true });
    if (!this.external) this.sc.params.forEach(q => {
      const val = h('b', {}, q.fmt(this.p[q.id])), rs = rangeSlider({ min: q.min, max: q.max, step: q.step, value: this.p[q.id], label: q.label, fmt: q.fmt }), inp = rs.input;
      inp.addEventListener('input', () => { this.p[q.id] = +inp.value; val.textContent = q.fmt(+inp.value); this.draw(); clearTimeout(this.timer); this.timer = setTimeout(() => this.fitCaption(), 200); });
      this.sl.append(h('div', { class: 'sv-p' }, h('span', {}, q.label, val), rs.el));
    });
    host.append(this.stage, this.cap, ctl, this.sl);
    const scrub = e => {
      if (this.mode !== 'explore') return;
      if (e.pointerType !== 'mouse' && e.buttons === 0 && e.type === 'pointermove') return;
      const r = this.stage.getBoundingClientRect(), u = clamp(((e.clientX - r.left) / r.width - 0.04) / 0.92, 0, 1);
      this.t = u; this.draw();
      if (!this.touched) { this.touched = true; this.hint.classList.add('gone'); }
    };
    this.stage.addEventListener('pointermove', scrub);
    this.stage.addEventListener('pointerdown', e => { if (this.mode === 'explore' && e.pointerType !== 'mouse') { try { this.stage.setPointerCapture(e.pointerId); } catch (err) { /* not supported */ } } scrub(e); });
    if ('IntersectionObserver' in window) {
      this.io = new IntersectionObserver(es => {
        const vis = es[0].isIntersecting; if (vis === this.visible) return;
        this.visible = vis;
        if (vis) { if (this.mode === 'watch') setTimeout(() => this.startWatch(), 250); } else this.halt();
      }, { threshold: 0.35 });
      this.io.observe(host);
    } else { this.visible = true; this.startWatch(); }
  }
  setMode(m) {
    this.mode = m; this.halt();
    const ex = m === 'explore';
    this.btn.textContent = ex ? 'Back to watching' : 'Make it interactive';
    this.hint.hidden = !ex; this.stage.classList.toggle('scrub', ex);
    this.sl.hidden = !ex || this.external || !this.sc.params.length;
    if (ex) { this.t = reduced() ? 1 : Math.max(this.t, 0.001); this.draw(); } else this.startWatch();
  }
  halt() { cancelAnimationFrame(this.raf); clearTimeout(this.loopT); this.playing = false; }
  startWatch() {
    this.halt();
    if (this.mode !== 'watch' || !this.visible) return;
    if (reduced()) { this.t = 1; this.draw(); return; }
    const dur = this.sc.dur || 6500, t0 = performance.now(); this.t = 0; this.playing = true;
    const step = now => {
      const u = clamp((now - t0) / dur, 0, 1);
      this.t = u; this.draw();
      if (u < 1 && this.playing) this.raf = requestAnimationFrame(step);
      else if (u >= 1) { this.playing = false; this.loopT = setTimeout(() => this.startWatch(), 1800); }
    };
    this.raf = requestAnimationFrame(step);
  }
  setParams(p, replay = true) { Object.assign(this.p, p); this.draw(); this.fitCaption(); if (replay && !this.hover && this.mode === 'watch') { clearTimeout(this.timer); this.timer = setTimeout(() => this.startWatch(), 300); } }
  size() { const W = Math.max(280, Math.floor(this.stage.clientWidth) || 520); return { W, H: Math.round(clamp(W * 0.6, 270, 340)) }; }
  draw() {
    const { W, H } = this.size();
    let out;
    try { out = this.sc.draw(this.t, this.p, W, H); } catch (e) { out = { svg: '', cap: 'Could not draw this scene.' }; }
    this.stage.style.height = H + 'px';
    this.stage.innerHTML = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" class="sv-svg">${out.svg}</svg>`;
    if (this.cap._txt !== out.cap) { this.cap._txt = out.cap; tick(this.cap, out.cap); }
  }
  /** Reserve the height of the longest caption so the box never jumps while the story changes. */
  fitCaption() {
    const w = this.cap.clientWidth; if (!w || !this.cap.parentNode) return;
    const m = this.measure || (this.measure = h('p', { class: 'sv-cap sv-measure', 'aria-hidden': 'true' }));
    if (!m.isConnected) this.cap.parentNode.append(m);
    m.style.width = w + 'px';
    const { W, H } = this.size(); let max = 0;
    [0, 0.15, 0.3, 0.45, 0.6, 0.75, 0.9, 1].forEach(t => { let c = ''; try { c = this.sc.draw(t, this.p, W, H).cap; } catch (e) { /* ignore */ } m.textContent = c; max = Math.max(max, m.offsetHeight); });
    this.cap.style.minHeight = max + 'px';
  }
  destroy() { if (SceneView.current === this) SceneView.current = null; this.halt(); clearTimeout(this.timer); if (this.io) this.io.disconnect(); if (this.ob) this.ob.disconnect(); if (this.measure) this.measure.remove(); }
}
