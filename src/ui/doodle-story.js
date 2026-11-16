// @ts-nocheck
/* The one continuous drawing of the home page story, 1400 wide by 400 high. A student with a money question walks from the worried
   thought on the left, to the site in the middle, to the paper on the right. Every piece has a start time (data-s), a length (data-d)
   and sometimes an end time (data-e). doodle.js reads those and draws the picture for the current moment, so nothing needs to be cut. */
import { wobblyLine, wobblyRect, wobblyEllipse, wobblyPath } from './doodle-shapes.js';
import { SLIDE } from './doodle-timeline.js';

export const W = 1400, H = 590, GROUND = 556;

/** What a loan of `principal` at a yearly rate `apr` costs in total over `years`, paid monthly (whole dollars). */
export function loanTotal(principal, apr, years) {
  const r = apr / 12, n = years * 12, m = (principal * r) / (1 - Math.pow(1 + r, -n));
  return Math.round(m * n);
}
export const TOTALS = { short: loanTotal(20000, 0.08, 2), long: loanTotal(20000, 0.08, 5), interest: loanTotal(20000, 0.08, 5) - 20000 };
export const usd = n => '$' + Math.round(n).toLocaleString('en-US');

let seed = 0;
const sd = () => (seed += 7);
const r1 = v => Math.round(v * 10) / 10;
const timing = o => ` data-s="${o.s}" data-d="${o.d ?? 0.9}"${o.e != null ? ` data-e="${o.e}"` : ''}`;
/** A line that draws itself. */
const ln = (d, o) => `<path class="dd-s" data-k="draw"${timing(o)} d="${d}" pathLength="1"${o.c || o.w ? ` style="${o.c ? `stroke:${o.c};` : ''}${o.w ? `stroke-width:${o.w}` : ''}"` : ''}/>`;
/** A soft filled shape that fades in. */
const fillBox = (x, y, w, h, o) => `<rect class="dd-f" data-k="pop"${timing(o)} x="${x}" y="${y}" width="${w}" height="${h}" rx="${o.rx ?? 10}" style="fill:${o.fill || 'var(--soft)'}"/>`;
const box = (x, y, w, h, o) => fillBox(x, y, w, h, o) + ln(wobblyRect(x, y, w, h, sd(), o.amt ?? 2), o);
const tx = (x, y, s, o) => `<text class="dd-t${o.hand ? ' hand' : ''}" data-k="pop"${timing(o)} x="${x}" y="${y}" text-anchor="${o.a || 'start'}" style="font-size:${o.size || 17}px${o.weight ? `;font-weight:${o.weight}` : ''}${o.fill ? `;fill:${o.fill}` : ''}"${o.id ? ` id="${o.id}"` : ''}>${s}</text>`;
const dot = (x, y, r, o) => `<circle class="dd-dot" data-k="pop"${timing(o)} cx="${x}" cy="${y}" r="${r}"${o.fill ? ` style="fill:${o.fill}"` : ''}/>`;
const spark = (x, y, s, t) => ln(`M${x} ${y - s} L${x} ${y + s} M${x - s} ${y} L${x + s} ${y}`, { s: t, d: 0.5, c: 'var(--c4)', w: 3 });
const vis = (spec, inner, extra = '') => `<g data-v="${spec}"${extra}>${inner}</g>`;

/** The standing student's size and where his shoulder is, so the player can move his signing arm. */
/** The standing student's size and where his shoulder is, so the player can move his signing arm. */
export const STAND = { K: 1.3, shoulder: 70, reach: [34, 88] };
const still = svg => svg.replace(/ data-k="[a-z]+"/g, '');

/** The stick-figure student standing: he walks across the floor between the three places. Feet at x = 0 inside the group. */
function student() {
  const K = STAND.K, P = (a, b) => [r1(a * K), r1(GROUND + b * K)], S = (a, b, c, e) => still(ln(wobblyLine(...P(a, b), ...P(c, e), sd(), 1.6), { s: 0, d: 0 }));
  const head = P(0, -98), e1 = P(-6, -101), e2 = P(6, -101);
  const mouth = (q, a, b, c) => `<path class="dd-s" d="M${P(a, q)} Q${P(b, q + (q === -92 ? 10 : 4))} ${P(c, q)}"/>`;
  return `<g id="dd-person" data-v="5.4-35">`
    + still(ln(wobblyEllipse(head[0], head[1], 18 * K, 18 * K, sd(), 1.2), { s: 0, d: 0 })) + S(0, -80, 0, -36)
    + vis('5.4-6.5;29.4-999', `<circle cx="${e1[0]}" cy="${e1[1]}" r="${r1(2.3 * K)}" style="fill:var(--ink)"/><circle cx="${e2[0]}" cy="${e2[1]}" r="${r1(2.3 * K)}" style="fill:var(--ink)"/>`)
    + vis('6.5-29.4', `<circle cx="${e1[0] + 4}" cy="${e1[1] - 3}" r="${r1(2.3 * K)}" style="fill:var(--ink)"/><circle cx="${e2[0] + 4}" cy="${e2[1] - 3}" r="${r1(2.3 * K)}" style="fill:var(--ink)"/>`)
    + vis('0-5.4;6.5-21;23-31;35-999', S(0, -36, -16, 0) + S(0, -36, 16, 0))
    + `<g data-walk="A">${S(0, -36, -20, -6)}${S(0, -36, 18, -2)}</g><g data-walk="B">${S(0, -36, -6, 0)}${S(0, -36, 24, -10)}</g>`
    + vis('0-6.5;21-23;31-999', S(0, -70, -24, -46) + S(0, -70, 24, -46))
    + vis('6.5-21;23-29.4', S(0, -70, -24, -46) + `<path id="dd-arm" class="dd-s" d="M0 ${GROUND - 70 * K} L${34 * K} ${GROUND - 88 * K}"/><circle id="dd-pinch" r="4.5" cx="${34 * K}" cy="${GROUND - 88 * K}" style="fill:var(--panel-solid);stroke:var(--ink);stroke-width:2.2;opacity:0"/>`)
    + vis('29.4-31', S(0, -70, -26, -104) + S(0, -70, 26, -104))
    + vis('5.4-29.4', mouth(-90, -6, 0, 6)) + vis('29.4-999', mouth(-92, -8, 0, 8))
    + `</g>`;
}

/** Everything he studies with, laid out on the floor in front of him: paper, laptop, coffee and calculator. `x` is where he sits; `t0` is when it starts to draw itself. */
function floorSet(x, t0, sticky, later) {
  const K = 1.25, P = (a, b) => [r1(x + a * K), r1(GROUND + b * K)], L = (a, b, c, e, at, w = 2.6) => ln(wobblyLine(...P(a, b), ...P(c, e), sd(), 1.3), { s: t0 + at, d: 0.4, w });
  const B = (a, b, c, e, at, fill, o = {}) => { const [bx, by] = P(a, b); return box(bx, by, (c - a) * K, (e - b) * K, { s: t0 + at, d: 0.4, rx: o.rx ?? 4, fill, amt: 1, w: o.w ?? 2.2 }); };
  const T = (a, b, s2, size, at) => tx(...P(a, b), s2, { size, a: 'middle', s: t0 + at, d: 0.3, hand: true });
  const steam = a => { const [sx, sy] = P(a, -24); return `<path class="dd-steam dd-s" style="animation-delay:${(a % 3) * 0.5}s" d="M${sx} ${sy} q${r1(4 * K)} ${r1(-6 * K)} 0 ${r1(-12 * K)} t0 ${r1(-12 * K)}"/>`; };
  const dots = [0, 1, 2].map(r => [0, 1, 2].map(c => { const [dx, dy] = P(183 + c * 6, -17 + r * 5); return `<circle cx="${dx}" cy="${dy}" r="1.4" style="fill:var(--ink)"/>`; }).join('')).join('');
  return ln(`M${P(46, -3).join(' ')} L${P(94, -3).join(' ')} L${P(100, -11).join(' ')} L${P(52, -11).join(' ')} Z`, { s: t0 + 0.2, d: 0.5, w: 2 })
    + B(108, -54, 150, -10, 0.4, 'var(--panel-solid)', { rx: 5 }) + L(102, -8, 156, -8, 0.5, 3) + [0, 1, 2].map(i => L(114, -45 + i * 9, 114 + 28 - i * 6, -45 + i * 9, 0.7 + i * 0.1, 1.5)).join('')
    + B(162, -22, 174, -8, 0.6, 'var(--panel-solid)', { rx: 3 }) + ln(wobblyEllipse(...P(177, -15), 4 * K, 5 * K, sd(), 0.6), { s: t0 + 0.7, d: 0.3, w: 1.8 })
    + B(182, -36, 202, -8, 0.8, 'var(--soft)') + B(185, -33, 199, -27, 0.9, 'var(--panel-solid)', { rx: 2, w: 1.2 }) + dots
    + B(122, -80, 154, -60, 1.0, GOLD_FILL, { rx: 2, w: 1.6 }) + T(138, -70, sticky, 11, 1.2)
    + (later ? B(122, -80, 154, -60, later.at, 'var(--panel-solid)', { rx: 2, w: 0.1 }) + B(122, -80, 154, -60, later.at + 0.05, GOLD_FILL, { rx: 2, w: 1.6 }) + T(138, -70, later.text, 11, later.at + 0.2) : '')
    + `<g>${steam(168)}${steam(172)}</g>`;
}
const GOLD_FILL = 'rgba(242,193,78,.7)';

/** The student sitting on the floor with his knees up. `window` says when he can be seen; `mood` is worried or happy. The forearm and pencil keep scribbling. */
function sitter(x, window, mood, t0 = 0, o = {}) {
  const K = 1.25, P = (a, b) => [r1(x + a * K), r1(GROUND + b * K)], L = (a, b, c, e, at, w = 2.8) => ln(wobblyLine(...P(a, b), ...P(c, e), sd(), 1.5), { s: t0 + at, d: 0.4, w });
  const head = P(2, -76), eyes = look => { const e1 = P(look ? -3 : 5, look ? -78 : -76), e2 = P(look ? 8 : 13, look ? -78 : -76); return `<circle cx="${e1[0]}" cy="${e1[1]}" r="${r1(2.3 * K)}" style="fill:var(--ink)"/><circle cx="${e2[0]}" cy="${e2[1]}" r="${r1(2.3 * K)}" style="fill:var(--ink)"/>`; };
  const smile = (a, b, c, q) => `<path class="dd-s" d="M${P(a, q)} Q${P(b, q + 9)} ${P(c, q)}"/>`;
  const worried = L(-1, -63, 9, -65, 0.9, 2.4) + L(-4, -86, 4, -89, 0.9, 2) + L(10, -89, 17, -86, 0.9, 2);
  const body = ln(wobblyEllipse(head[0], head[1], 18 * K, 18 * K, sd(), 1.2), { s: t0 + 0.2, d: 0.6 }) + L(0, -56, 2, -8, 0.2) + L(2, -8, 24, -34, 0.3) + L(24, -34, 36, -2, 0.35) + L(2, -8, 48, -4, 0.35) + L(0, -48, 14, -32, 0.4);
  const write = `<g class="dd-write">${still(L(14, -32, 46, -14, 0, 2.8))}${still(L(46, -14, 42, -4, 0, 2.4))}</g>`;
  return `<g data-v="${window}">` + body + (o.look ? '' : write) + (mood === 'worried' ? eyes(false) + worried : `<g id="dd-face-study">${eyes(false)}${smile(-1, 8, 17, -64)}${o.look ? write : ''}</g>` + (o.look ? `<g id="dd-face-look" style="visibility:hidden">${eyes(true)}${smile(-6, 3, 12, -64)}${still(L(0, -48, 30, -84, 0, 2.8))}</g>` : '')) + `</g>`;
}

/* ---- left: he studies on the floor, gets stuck, and the worry floats above his head until he gets up ---- */
const GONE = 5.4;
const thought = () => ln(wobblyLine(20, GROUND, 1380, GROUND, sd(), 2), { s: 0, d: 1, c: 'var(--mute)' }) + floorSet(70, 0, 'EXAM', { at: 35.0, text: 'READY' }) + sitter(70, '0-5.4', 'worried', 0) + still(sitter(70, '35-999', 'happy', 35, { look: true }))
  + tx(26, 474, '?', { size: 34, hand: true, s: 2.0, d: 0.4, e: GONE, fill: 'var(--c4)' }) + tx(140, 466, '?', { size: 30, hand: true, s: 2.2, d: 0.4, e: GONE, fill: 'var(--c4)' })
  + ln(wobblyEllipse(82, 422, 6, 6, sd()), { s: 2.4, d: 0.3, e: GONE }) + ln(wobblyEllipse(94, 398, 9, 9, sd()), { s: 2.55, d: 0.3, e: GONE }) + ln(wobblyEllipse(112, 368, 13, 13, sd()), { s: 2.7, d: 0.3, e: GONE })
  + fillBox(24, 112, 400, 138, { s: 2.8, d: 0.5, e: GONE, rx: 68, fill: 'var(--panel-solid)' }) + ln(wobblyEllipse(224, 181, 200, 68, sd(), 2), { s: 2.8, d: 0.9, e: GONE })
  + tx(224, 170, 'How should I calculate', { size: 25, hand: true, a: 'middle', s: 3.2, d: 0.6, e: GONE }) + tx(224, 202, 'what this loan will', { size: 25, hand: true, a: 'middle', s: 3.8, d: 0.6, e: GONE }) + tx(224, 234, 'actually cost?', { size: 25, hand: true, a: 'middle', s: 4.4, d: 0.5, e: GONE });

/* ---- middle: the site, drawn like the real one: browser bar, site header, then the pages he visits ---- */
const WX = 516, SW = 'var(--pill-on)';
/** One link of the site's menu: a pill with a word in it. `from`/`to` say when it is the page he is on. */
const pill = (x, w, label, o = {}) => (o.fill ? `<rect class="dd-f" data-k="pop" data-s="${o.fill.s}" data-d="0.3"${o.fill.e != null ? ` data-e="${o.fill.e}"` : ''} x="${x}" y="57" width="${w}" height="20" rx="10" style="fill:${NAVYFILL}"/>` : '') + tx(x + w / 2, 70, label, { size: 10, a: 'middle', s: o.s ?? 6.5, d: 0.3, weight: o.bold ? 700 : 500 });
const NAVYFILL = 'color-mix(in srgb,var(--pill-on) 24%,transparent)';
function siteHeader() {
  const bar = ln(wobblyLine(502, 48, 958, 48, sd(), 1.2), { s: 5.8, d: 0.5 }) + [516, 530, 544].map((cx, i) => dot(cx, 35, 4, { s: 6.0 + i * 0.08, d: 0.3, fill: i === 0 ? 'var(--bad)' : i === 1 ? 'var(--c4)' : 'var(--good)' })).join('');
  const brand = ln(wobblyEllipse(526, 67, 8.5, 8.5, sd(), 0.8), { s: 6.4, d: 0.4 }) + tx(526, 70, 'L', { size: 9, a: 'middle', hand: true, s: 6.6, d: 0.3 }) + tx(540, 70, 'LUMS', { size: 9, weight: 700, s: 6.6, d: 0.3 })
    + ln(wobblyLine(572, 59, 572, 75, sd(), 0.5), { s: 6.7, d: 0.2, c: 'var(--line)', w: 2 }) + tx(580, 70, 'Finance Fundamentals', { size: 10, weight: 700, s: 6.7, d: 0.4 });
  const menu = box(690, 54, 208, 26, { s: 6.5, d: 0.5, rx: 13, fill: 'var(--panel-solid)', amt: 0.8, w: 1.8 })
    + pill(694, 40, 'Home', { s: 6.8, bold: true, fill: { s: 6.8, e: 10.6 } }) + pill(738, 42, 'Learn', { s: 6.9 }) + pill(784, 64, 'Calculators', { s: 7.0, fill: { s: 10.6 } }) + pill(852, 42, 'Decide', { s: 7.1 });
  const icons = [918, 940].map((cx, i) => ln(wobblyEllipse(cx, 67, 8, 8, sd(), 0.6), { s: 7.0 + i * 0.1, d: 0.3, w: 2 })).join('');
  return bar + brand + menu + icons + ln(wobblyLine(502, 86, 958, 86, sd(), 0.8), { s: 7.2, d: 0.4, c: 'var(--line)', w: 1.8 });
}
function site() {
  const frame = box(500, 22, 460, 204, { s: 5.0, d: 1.1, fill: 'var(--panel-solid)' });
  /* page 1: the home page, with its headline, its question box and its row of question cards */
  const cardTexts = [['How much will my', 'savings grow?'], ['What will my loan', 'really cost?'], ['What is this', 'bond worth?'], ['Is this share', 'worth its price?']];
  const home = tx(WX, 112, 'Finance, made clear.', { size: 21, hand: true, s: 7.4, d: 0.6, e: 10.6 })
    + box(WX, 120, 230, 20, { s: 7.9, d: 0.4, e: 10.6, rx: 10, fill: 'var(--panel-solid)', amt: 0.8, w: 1.8 }) + tx(WX + 14, 133, 'What will my loan really cost?', { size: 9.5, s: 8.1, d: 0.3, e: 10.6, fill: 'var(--mute)' })
    + tx(WX, 160, 'Start with a question', { size: 11, weight: 700, s: 8.2, d: 0.3, e: 10.6 })
    + cardTexts.map(([a, b], i) => { const x = WX + i * 108, pick = i === 1; return box(x, 168, 100, 44, { s: 8.4 + i * 0.15, d: 0.4, e: 10.6, rx: 8, fill: 'var(--panel-solid)', amt: 0.8, w: 1.8 }) + tx(x + 50, 186, a, { size: 10, a: 'middle', s: 8.6 + i * 0.15, d: 0.3, e: 10.6 }) + tx(x + 50, 200, b, { size: 10, a: 'middle', s: 8.6 + i * 0.15, d: 0.3, e: 10.6, weight: pick ? 700 : 400 }); }).join('')
    + `<rect class="dd-tint" data-k="tint" data-s="9.45" data-d="0.5" data-e="10.6" x="${WX + 108}" y="168" width="100" height="44" rx="8"/>`;
  /* page 2: the calculator, with its "Play with these" panel, its big answer and its chart */
  const rows = [['Loan', '$20,000', 148, 0.55], ['Rate', '8%', 172, 0.4]];
  const calc = tx(WX, 104, 'What will my loan really cost?', { size: 14, weight: 700, s: 10.6, d: 0.4, e: 15.8 })
    + box(WX, 112, 170, 102, { s: 10.9, d: 0.5, e: 15.8, rx: 10, fill: 'var(--panel-solid)', amt: 0.8, w: 1.8 }) + tx(WX + 12, 127, 'Play with these', { size: 9.5, weight: 700, s: 11.1, d: 0.3, e: 15.8 })
    + rows.map(([n, v, y, f], i) => tx(WX + 12, y - 8, n, { size: 9, s: 11.2 + i * 0.1, d: 0.3, e: 15.8 }) + tx(WX + 158, y - 8, v, { size: 9, a: 'end', weight: 700, s: 11.2 + i * 0.1, d: 0.3, e: 15.8 }) + ln(wobblyLine(WX + 12, y, WX + 158, y, sd(), 0.8), { s: 11.3 + i * 0.1, d: 0.3, e: 15.8, c: 'var(--line)', w: 5 }) + ln(wobblyLine(WX + 12, y, WX + 12 + 146 * f, y, sd(), 0.8), { s: 11.4 + i * 0.1, d: 0.3, e: 15.8, c: SW, w: 5 }) + `<circle class="dd-knob" data-k="pop" data-s="${11.4 + i * 0.1}" data-d="0.3" data-e="15.8" cx="${WX + 12 + 146 * f}" cy="${y}" r="6.5" style="stroke-width:3"/>`).join('')
    + tx(WX + 12, SLIDE.y - 8, 'Years', { size: 9, s: 11.6, d: 0.3, e: 15.8 }) + tx(WX + 158, SLIDE.y - 8, '2', { size: 9, a: 'end', weight: 700, s: 11.6, d: 0.3, e: 15.8, id: 'dd-years' })
    + ln(wobblyLine(SLIDE.x0 - 29, SLIDE.y, SLIDE.x0 - 29 + 144, SLIDE.y, sd(), 0.8), { s: 11.6, d: 0.3, e: 15.8, c: 'var(--line)', w: 5 })
    + `<path class="dd-fill" data-k="fade" data-s="11.7" data-d="0.3" data-e="15.8" id="dd-fill" d="${wobblyLine(SLIDE.x0 - 29, SLIDE.y, SLIDE.x0 - 29 + 144, SLIDE.y, sd(), 0.6)}" pathLength="1" style="stroke-width:5"/>`
    + `<circle class="dd-knob" data-k="pop" data-s="11.7" data-d="0.3" data-e="15.8" id="dd-knob" cx="${SLIDE.x0}" cy="${SLIDE.y}" r="7" style="stroke-width:3"/>`
    + box(702, 112, 242, 58, { s: 11.6, d: 0.5, e: 15.8, rx: 10, fill: NAVYFILL }) + tx(716, 129, 'You pay back', { size: 10, s: 11.9, d: 0.3, e: 15.8, fill: 'var(--mute)' })
    + tx(716, 158, usd(TOTALS.short), { size: 28, weight: 700, s: 11.9, d: 0.3, e: 15.8, id: 'dd-total' })
    + box(702, 176, 242, 38, { s: 12.0, d: 0.5, e: 15.8, rx: 10, fill: 'var(--panel-solid)', amt: 0.8, w: 1.8 }) + ln(wobblyPath([[716, 206], [760, 202], [820, 194], [930, 184]], sd(), 1), { s: 14.0, d: 0.9, e: 15.8, c: 'var(--good)', w: 3.5 });
  /* page 3: the explanation under the answer */
  const full = 396, loan = Math.round(full * 20000 / TOTALS.long), bx = WX + 14;
  const bars = tx(WX, 104, 'Where your money goes', { size: 14, weight: 700, s: 16.2, d: 0.4 }) + box(WX, 112, 428, 102, { s: 16.4, d: 0.5, rx: 10, fill: 'var(--panel-solid)', amt: 0.8, w: 1.8 })
    + `<rect class="dd-bar dd-bar1" data-k="grow" data-s="17" data-d="0.9" x="${bx}" y="124" width="${loan}" height="24" rx="5"/><rect class="dd-bar dd-bar2" data-k="grow" data-s="18" data-d="0.6" x="${bx + loan}" y="124" width="${full - loan}" height="24" rx="5"/>`
    + ln(wobblyRect(bx, 124, full, 24, sd(), 1.2), { s: 16.6, d: 0.6 })
    + tx(bx, 166, 'The loan: ' + usd(20000), { size: 11.5, s: 18.0, d: 0.4 }) + tx(bx + full, 166, 'Extra interest: ' + usd(TOTALS.interest), { size: 11.5, weight: 700, a: 'end', s: 18.8, d: 0.4 })
    + box(bx, 176, full, 30, { s: 19.6, d: 0.5, rx: 8, fill: 'var(--soft)', amt: 0.8, w: 1.8 }) + tx(bx + 12, 195, 'A longer loan means more months of interest.', { size: 12, s: 20.0, d: 0.5 });
  const ripple = (t, x, y) => `<circle class="dd-ripple" data-ripple="${t}" cx="${x}" cy="${y}" r="14"/>`;
  const cursor = `<g id="dd-cursor" class="dd-cursor"><path d="M0 0 L0 24 L6.5 18.5 L11 29 L15.5 27 L11 16.5 L19 16.5 Z" transform="scale(.8)"/></g>`;
  return `<g transform="translate(400 22) scale(1.4) translate(-500 -22)">` + frame + siteHeader() + home + calc + bars + ripple(9.4, WX + 158, 190) + ripple(12.1, SLIDE.x0, SLIDE.y) + cursor + `</g>`;
}

/* ---- right: the paper, and the desk where he sits down to study again, happily ---- */
function paper() {
  const lines = [['Loan = $20,000', 64, 23.6], ['5 years, 8% a year', 104, 24.6], ['Pay back = ' + usd(TOTALS.long), 144, 25.6], ['Interest = ' + usd(TOTALS.interest), 184, 26.6]];
  const again = `<g id="dd-again" style="opacity:0;transition:opacity .25s;pointer-events:none">` + still(fillBox(166, 340, 224, 100, { s: 0, rx: 50, fill: 'var(--panel-solid)' }) + ln(wobblyEllipse(278, 390, 108, 46, sd(), 2), { s: 0 }) + tx(278, 381, 'Should I do', { size: 24, hand: true, a: 'middle', s: 0 }) + tx(278, 410, 'it all again?', { size: 24, hand: true, a: 'middle', s: 0 })) + `</g>`;
  return `<g transform="translate(1094 18) scale(0.9) translate(-1020 -18)"><g transform="rotate(-2 1190 120)">` + fillBox(1020, 18, 340, 214, { s: 22.4, d: 0.6, rx: 6 }) + ln(wobblyRect(1020, 18, 340, 214, sd(), 1.6), { s: 22.4, d: 1 })
    + [0, 1, 2, 3].map(i => ln(wobblyLine(1038, 74 + i * 40, 1342, 74 + i * 40, sd(), 1), { s: 22.9 + i * 0.1, d: 0.6, c: 'var(--line)', w: 2 })).join('')
    + lines.map(([t, y, s]) => tx(1042, y, t, { size: 25, hand: true, s, d: 0.8 })).join('')
    + ln(wobblyEllipse(1222, 134, 72, 24, sd()), { s: 27.7, d: 0.7, c: 'var(--c4)', w: 3.5 })
    + ln(wobblyPath([[1262, 180], [1286, 208], [1342, 150]], sd(), 1), { s: 28.7, d: 0.5, c: 'var(--good)', w: 7 }) + `</g></g>`
    + fillBox(796, 462, 220, 70, { s: 29.5, d: 0.4, e: 31.2, rx: 35, fill: 'var(--panel-solid)' }) + ln(wobblyEllipse(906, 497, 106, 34, sd(), 2), { s: 29.5, d: 0.8, e: 31.2 }) + tx(906, 507, 'I get it!', { size: 30, hand: true, a: 'middle', s: 30.1, d: 0.4, e: 31.2 })
    + spark(700, 470, 9, 30.0) + spark(1030, 450, 13, 30.2) + spark(1180, 470, 9, 30.4) + spark(1250, 430, 11, 30.6) + spark(1350, 470, 9, 30.8)
    + again
    + `<rect id="dd-hit" x="20" y="${GROUND - 215}" width="360" height="225" style="fill:transparent;pointer-events:none"/>`;
}

/** The whole picture as SVG markup. */
export function buildStory() {
  seed = 0;
  return `<g id="dd-world">${thought()}${site()}${paper()}${student()}</g>`;
}
