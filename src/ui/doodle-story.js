// @ts-nocheck
/* The one continuous drawing of the home page story, 1400 wide by 410 high. A money question is typed into the site, the pointer
   picks it and moves a slider, the answer changes, and the same working ends up on paper on the right. Every piece has a start time
   (data-s), a length (data-d) and sometimes an end time (data-e). doodle.js reads those and draws the picture for the current moment. */
import { wobblyLine, wobblyRect, wobblyEllipse, wobblyPath } from './doodle-shapes.js';
import { SLIDE } from './doodle-timeline.js';

export const W = 1400, H = 410;

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
const vis = (spec, inner, extra = '') => `<g data-v="${spec}"${extra}>${inner}</g>`;

const still = svg => svg.replace(/ data-k="[a-z]+"/g, '');
const WX = 516, SW = 'var(--pill-on)';
/** One link of the site's menu: a pill with a word in it. `from`/`to` say when it is the page being shown. */
const pill = (x, w, label, o = {}) => (o.fill ? `<rect class="dd-f" data-k="pop" data-s="${o.fill.s}" data-d="0.3"${o.fill.e != null ? ` data-e="${o.fill.e}"` : ''} x="${x}" y="57" width="${w}" height="20" rx="10" style="fill:${NAVYFILL}"/>` : '') + tx(x + w / 2, 70, label, { size: 10, a: 'middle', s: o.s ?? 6.5, d: 0.3, weight: o.bold ? 700 : 500 });
const NAVYFILL = 'color-mix(in srgb,var(--pill-on) 24%,transparent)';
function siteHeader() {
  const bar = ln(wobblyLine(502, 48, 958, 48, sd(), 1.2), { s: 5.8, d: 0.5 }) + [516, 530, 544].map((cx, i) => dot(cx, 35, 4, { s: 6.0 + i * 0.08, d: 0.3, fill: 'var(--line)' })).join('');
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
    + box(WX, 120, 230, 20, { s: 7.9, d: 0.4, e: 10.6, rx: 10, fill: 'var(--panel-solid)', amt: 0.8, w: 1.8 }) + tx(WX + 14, 133, 'What will my loan really cost?', { size: 9.5, s: 7.9, d: 0.3, e: 10.6, fill: 'var(--mute)', id: 'dd-typed' })
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
    + box(702, 176, 242, 38, { s: 12.0, d: 0.5, e: 15.8, rx: 10, fill: 'var(--panel-solid)', amt: 0.8, w: 1.8 }) + ln(wobblyPath([[716, 206], [760, 202], [820, 194], [930, 184]], sd(), 1), { s: 14.0, d: 0.9, e: 15.8, c: 'var(--pill-on)', w: 3.5 });
  /* page 3: the explanation under the answer */
  const full = 396, loan = Math.round(full * 20000 / TOTALS.long), bx = WX + 14;
  const bars = tx(WX, 104, 'Where your money goes', { size: 14, weight: 700, s: 16.2, d: 0.4 }) + box(WX, 112, 428, 102, { s: 16.4, d: 0.5, rx: 10, fill: 'var(--panel-solid)', amt: 0.8, w: 1.8 })
    + `<rect class="dd-bar dd-bar1" data-k="grow" data-s="17" data-d="0.9" x="${bx}" y="124" width="${loan}" height="24" rx="5"/><rect class="dd-bar dd-bar2" data-k="grow" data-s="18" data-d="0.6" x="${bx + loan}" y="124" width="${full - loan}" height="24" rx="5"/>`
    + ln(wobblyRect(bx, 124, full, 24, sd(), 1.2), { s: 16.6, d: 0.6 })
    + tx(bx, 166, 'The loan: ' + usd(20000), { size: 11.5, s: 18.0, d: 0.4 }) + tx(bx + full, 166, 'Extra interest: ' + usd(TOTALS.interest), { size: 11.5, weight: 700, a: 'end', s: 18.8, d: 0.4 })
    + box(bx, 176, full, 30, { s: 19.6, d: 0.5, rx: 8, fill: 'var(--soft)', amt: 0.8, w: 1.8 }) + tx(bx + 12, 195, 'A longer loan means more months of interest.', { size: 12, s: 20.0, d: 0.5 });
  const ripple = (t, x, y) => `<circle class="dd-ripple" data-ripple="${t}" cx="${x}" cy="${y}" r="14"/>`;
  const cursor = `<g id="dd-cursor" class="dd-cursor"><path d="M0 0 L0 24 L6.5 18.5 L11 29 L15.5 27 L11 16.5 L19 16.5 Z" transform="scale(.8)"/></g>`;
  return `<g transform="translate(30 10) scale(1.92) translate(-500 -22)">` + frame + siteHeader() + home + calc + bars + ripple(9.4, WX + 158, 190) + ripple(12.1, SLIDE.x0, SLIDE.y) + cursor + `</g>`;
}

/* ---- right: the paper, and the small prompt that offers to play it all again ---- */
function paper() {
  const lines = [['Loan = $20,000', 64, 23.6], ['5 years, 8% a year', 104, 24.6], ['Pay back = ' + usd(TOTALS.long), 144, 25.6], ['Interest = ' + usd(TOTALS.interest), 184, 26.6]];
  const again = `<g id="dd-again" style="opacity:0;transition:opacity .3s;pointer-events:none">` + still(fillBox(1162, 330, 170, 46, { s: 0, rx: 23, fill: 'var(--panel-solid)' }) + ln(wobblyEllipse(1247, 353, 85, 23, sd(), 1.5), { s: 0, w: 2.2 }) + tx(1247, 361, 'Watch again', { size: 22, hand: true, a: 'middle', s: 0 })) + `</g>`;
  return `<g transform="translate(1094 76) scale(0.9) translate(-1020 -18)"><g transform="rotate(-2 1190 120)">` + fillBox(1020, 18, 340, 214, { s: 22.4, d: 0.6, rx: 6 }) + ln(wobblyRect(1020, 18, 340, 214, sd(), 1.6), { s: 22.4, d: 1 })
    + [0, 1, 2, 3].map(i => ln(wobblyLine(1038, 74 + i * 40, 1342, 74 + i * 40, sd(), 1), { s: 22.9 + i * 0.1, d: 0.6, c: 'var(--line)', w: 2 })).join('')
    + lines.map(([t, y, s]) => tx(1042, y, t, { size: 25, hand: true, s, d: 0.8 })).join('')
    + ln(wobblyEllipse(1222, 134, 72, 24, sd()), { s: 27.7, d: 0.7, c: 'var(--c4)', w: 3.5 })
    + ln(wobblyPath([[1262, 180], [1286, 208], [1342, 150]], sd(), 1), { s: 28.7, d: 0.5, c: 'var(--pill-on)', w: 6 }) + `</g></g>`
    + again
    + `<rect id="dd-hit" x="1162" y="330" width="170" height="46" rx="23" style="fill:transparent;pointer-events:none"/>`;
}

/** The whole picture as SVG markup. */
export function buildStory() {
  seed = 0;
  return `<g id="dd-world">${site()}${paper()}</g>`;
}
