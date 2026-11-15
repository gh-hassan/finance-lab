// @ts-nocheck
/* "Value a business" page: a few plain questions in, a price range out (bargain, sweet spot, ceiling), for the whole business, a part of it, or new money going in. Everything is worked out in the browser. */
import '../styles/valuation.css';
import { h, head, segmented, statGrid, dataTable, explainer, fill } from './dataui.js';
import { rangeSlider } from './slider.js';
import { money, pct, num } from '../lib/format';
import { valueBusiness, dealView, sensitivity, YEARS, MINORITY_DISCOUNT } from '../lib/valuation';

const PRED = [['steady', 'Steady'], ['bumpy', 'Bumpy'], ['risky', 'Risky']];
const PRED_NOTE = { steady: 'Profits hardly move from year to year, such as a school, a pharmacy or a utility.', bumpy: 'Profits rise and fall with the economy or the season.', risky: 'Profits could disappear: a new business, a fashion business, or one that lives off one big customer.' };
const EDGE = [['none', 'No edge'], ['some', 'Some edge'], ['strong', 'Strong edge']];
const EDGE_NOTE = { none: 'Rivals could copy it easily, so profits are likely to be competed away.', some: 'Loyal customers, a good location or a good name give it some protection.', strong: 'Hard to copy: a trusted brand, the lowest costs, or customers who would never bother to switch.' };
const KINDS = [['whole', 'The whole business'], ['part', 'Part of it'], ['new', 'New money in']];
const CURR = [['$', 'US dollars'], ['Rs ', 'Rupees']];

const amount = (v, allowNegative = false) => {
  const s = String(v).replace(/[,\s]/g, '');
  if (s === '') return null;
  const n = Number(s);
  return Number.isFinite(n) && (allowNegative || n >= 0) ? n : NaN;
};
const must = x => (x == null ? NaN : x);
const orZero = x => (x == null ? 0 : x);

export function renderValuation(main) {
  const st = { sym: '$', profit: '600000', dep: '150000', upkeep: '150000', cash: '400000', debt: '800000', growth: 6, pred: 'bumpy', edge: 'some', kind: 'whole', stake: 25, money: '500000', offered: '', ask: '' };
  const $ = x => money(x, { sym: st.sym });

  const ownerHost = h('div'), outHost = h('div', { class: 'bv-stack' }), whyHost = h('div', { class: 'bv-stack' }), fieldHost = h('div', { class: 'bv-stack' }), sensHost = h('div', { class: 'bv-stack' }), dealHost = h('div', { class: 'bv-fields' });
  const predNote = h('p', { class: 'bv-note' }, PRED_NOTE[st.pred]), edgeNote = h('p', { class: 'bv-note' }, EDGE_NOTE[st.edge]);

  function numberField(key, label, hint, { negative = false, optional = false, placeholder = '' } = {}) {
    const input = h('input', { class: 'd-in bv-in', type: 'text', inputmode: 'decimal', value: st[key], placeholder, 'aria-label': label });
    input.addEventListener('input', () => { st[key] = input.value; update(); });
    input.addEventListener('change', () => { const n = amount(input.value, negative); if (n != null && !Number.isNaN(n)) { st[key] = num(n, n % 1 ? 2 : 0); input.value = st[key]; } update(); });
    return h('label', { class: 'bv-f' }, h('span', { class: 'bv-fl' }, label), h('small', {}, hint), input);
  }
  const grid = (...kids) => h('div', { class: 'bv-fields' }, ...kids);

  const cur = segmented({ options: CURR, value: st.sym, label: 'Currency', onChange: v => { st.sym = v; update(); } });
  const pred = segmented({ options: PRED, value: st.pred, label: 'How steady are the profits', onChange: v => { st.pred = v; predNote.textContent = PRED_NOTE[v]; update(); } });
  const edge = segmented({ options: EDGE, value: st.edge, label: 'How hard is the business to copy', onChange: v => { st.edge = v; edgeNote.textContent = EDGE_NOTE[v]; update(); } });
  const growth = rangeSlider({ min: -10, max: 25, step: 0.5, value: st.growth, label: 'Yearly profit growth', fmt: v => (v > 0 ? '+' : '') + v + '%' });
  growth.input.addEventListener('input', () => { st.growth = +growth.input.value; update(); });
  const kind = segmented({ options: KINDS, value: st.kind, label: 'What is being sold', onChange: v => { st.kind = v; drawDeal(); update(); } });
  const stake = rangeSlider({ min: 1, max: 99, step: 1, value: st.stake, label: 'Share being sold', fmt: v => v + '%' });
  stake.input.addEventListener('input', () => { st.stake = +stake.input.value; update(); });

  function drawDeal() {
    const ask = numberField('ask', st.kind === 'part' ? 'Price they are asking for that share' : 'Price they are asking', 'Optional. Leave it blank to see only the price range.', { placeholder: 'Not sure yet' });
    const kids = st.kind === 'whole' ? [ask]
      : st.kind === 'part' ? [h('div', { class: 'bv-f' }, h('span', { class: 'bv-fl' }, 'Share of the business being sold'), h('small', {}, 'The owner keeps the rest and sells you this part.'), stake.el), ask]
        : [numberField('money', 'Money you would put in', 'This money goes into the business, not to the owner.'), numberField('offered', 'Share of the business they offer for it (%)', 'Optional. For example 10 means you would own 10%.', { placeholder: 'Not sure yet' })];
    fill(dealHost, kids);
  }

  /** The three prices on one ruler, with the asking price marked. */
  function ruler(z, mark, label) {
    const lo = Math.min(z.bargain * 0.75, mark ? mark * 0.9 : Infinity), max = Math.max(z.ceiling * 1.25, (mark || 0) * 1.08), p = x => Math.min(100, Math.max(0, ((x - lo) / (max - lo)) * 100));
    const seg = (a, b, cls, text) => h('i', { class: 'bv-seg ' + cls, style: `left:${p(a)}%;width:${p(b) - p(a)}%` }, h('span', {}, text));
    const flag = mark ? h('div', { class: 'bv-mark', style: `left:${p(mark)}%` }, h('span', {}, label)) : null;
    return h('div', { class: 'bv-ruler', role: 'img', 'aria-label': `Price zones. Bargain up to ${$(z.bargain)}, good buy up to ${$(z.sweet)}, stretch up to ${$(z.ceiling)}, above that too expensive.${mark ? ` Asking price ${$(mark)}.` : ''}` },
      h('div', { class: 'bv-bar' }, seg(lo, z.bargain, 'z1', 'Bargain'), seg(z.bargain, z.sweet, 'z2', 'Good buy'), seg(z.sweet, z.ceiling, 'z3', 'Stretch'), seg(z.ceiling, max, 'z4', 'Too high'), flag));
  }

  const VERDICT = {
    bargain: ['good', 'A bargain', 'The price is below what the earnings alone are worth. Good news, but ask why it is so cheap before you celebrate.'],
    good: ['good', 'A good buy', 'The price is at or below our sweet spot, so you have a margin of safety if things turn out worse than you hoped.'],
    stretch: ['warn', 'A stretch', 'This could be fair, but there is little room for error. Try to bring the price down toward the sweet spot.'],
    toohigh: ['bad', 'Too expensive', 'The price is above the most we would pay. Walk away, or ask for a lower price or proof of higher profits.']
  };

  function priceCard(v, d) {
    if (!v.ok) return [h('p', { class: 'bv-bad', role: 'alert' }, v.reason)];
    const z = d.zones, isNew = d.kind === 'new';
    const askMark = d.kind === 'part' ? (amount(st.ask) || null) : (d.impliedValue > 0 ? d.impliedValue : null);
    const out = [];
    if (d.verdict) { const [tone, title, text] = VERDICT[d.verdict]; out.push(h('div', { class: 'bv-verdict ' + tone, role: 'status' }, h('b', {}, title), h('p', {}, text))); }
    else out.push(h('p', { class: 'bv-note' }, isNew ? 'Enter the share they offer to see a verdict.' : 'Enter the price they are asking to see a verdict.'));
    out.push(ruler(z, askMark, isNew ? 'Their value' : 'Asking price'));
    const sub = isNew && d.shareAt
      ? [`You would own ${pct(d.shareAt.bargain, 1)}`, `You would own ${pct(d.shareAt.sweet, 1)}`, `You would own ${pct(d.shareAt.ceiling, 1)}`]
      : ['Below this, ask why it is so cheap', 'The price to aim for', 'Pay more and you carry the risk'];
    const names = isNew ? ['Bargain value', 'Sweet spot value', 'Ceiling value'] : ['Bargain price', 'Sweet spot', 'Walk-away ceiling'];
    out.push(statGrid([{ label: names[0], value: $(z.bargain), sub: sub[0], tone: 'good' }, { label: names[1], value: $(z.sweet), sub: sub[1] }, { label: names[2], value: $(z.ceiling), sub: sub[2], tone: 'bad' }]));
    if (isNew) out.push(h('p', { class: 'bv-note' }, 'These are values for the whole company ', h('b', {}, 'before'), ' your money goes in. The lower the value they accept, the bigger the share your money should buy.'));
    if (d.discounted) out.push(h('p', { class: 'bv-note' }, `Because you would own less than half, you could not control decisions or dividends, so we took ${pct(MINORITY_DISCOUNT, 0)} off the price.`));
    if (d.kind === 'part' && d.impliedValue) out.push(h('p', { class: 'bv-note' }, `At that price, the whole business is being valued at ${$(d.impliedValue)}. Our fair value for the whole business is ${$(v.fair)}.`));
    if (d.kind === 'new' && d.impliedValue != null) out.push(h('p', { class: 'bv-note' }, d.impliedValue > 0 ? `${$(amount(st.money) || 0)} for ${st.offered}% values the company at ${$(d.impliedValue)} before your money.` : 'That share is too small to make sense for that money.'));
    if (d.yield != null && d.payback != null) out.push(h('p', { class: 'bv-yield' }, `At that price, your share of today’s owner earnings is about `, h('b', {}, pct(d.yield, 1)), ` a year, so it would take about `, h('b', {}, num(d.payback, 1) + ' years'), ' to earn the price back if profits stay flat.'));
    return out;
  }

  function football(v, ask) {
    const z = v.zones, max = Math.max(...v.methods.map(m => m.high), z.ceiling * 1.15, ask || 0) * 1.05, p = x => Math.min(100, Math.max(0, (x / max) * 100));
    const rows = v.methods.map(m => h('div', { class: 'bv-ff' },
      h('div', { class: 'bv-ffn' }, h('b', {}, m.name), h('small', {}, m.note)),
      h('div', { class: 'bv-fft', 'aria-hidden': 'true' }, h('i', { class: 'bv-band', style: `left:${p(z.bargain)}%;width:${p(z.ceiling) - p(z.bargain)}%` }), h('i', { class: 'bv-rng', style: `left:${p(m.low)}%;width:${Math.max(0.6, p(m.high) - p(m.low))}%` }), h('i', { class: 'bv-mid', style: `left:${p(m.mid)}%` }), ask ? h('i', { class: 'bv-askline', style: `left:${p(ask)}%` }) : null),
      h('div', { class: 'bv-ffv' }, `${$(m.low)} to ${$(m.high)}`, h('small', {}, `Best guess ${$(m.mid)}`))));
    return [h('div', { class: 'bv-ffs' }, rows), h('p', { class: 'bv-legend' }, h('i', { class: 'k1' }), 'range from cautious to hopeful', h('i', { class: 'k2' }), 'best guess', h('i', { class: 'k3' }), 'the price range worth paying', ask ? h('i', { class: 'k4' }) : null, ask ? 'asking price' : null)];
  }

  function why(v, b) {
    if (!v.ok) return [];
    const m = v.methods;
    return [h('ol', { class: 'bv-why' },
      h('li', {}, h('b', {}, 'Count only real cash. '), `Profit ${$(b.profit)}, plus depreciation ${$(b.depreciation)}, minus upkeep ${$(b.upkeep)}, leaves `, h('b', {}, $(v.ownerEarnings)), ' a year that the owners could take home.'),
      h('li', {}, h('b', {}, 'Ask for a fair return. '), `Because the profits are ${st.pred} we ask for ${pct(v.required, 0)} a year on the money.${v.required > { steady: 0.1, bumpy: 0.12, risky: 0.15 }[st.pred] + 0.001 ? ' Heavy debt added a little extra.' : ''}`),
      h('li', {}, h('b', {}, 'Value it three ways. '), `If nothing grows it is worth ${$(m[0].mid)}. Counting the next ${YEARS} years of cash, ${$(m[1].mid)}. At what similar businesses sell for, ${$(m[2].mid)}.`),
      h('li', {}, h('b', {}, 'Blend them. '), `We trust the cash method most (40%), then the other two (30% each), to get a fair value of `, h('b', {}, $(v.fair)), '.'),
      h('li', {}, h('b', {}, 'Leave room for being wrong. '), `We want a ${pct(v.margin, 0)} margin of safety, so the sweet spot is ${$(v.zones.sweet)}, and we would not pay more than ${$(v.zones.ceiling)}.`)), ...v.warnings.map(w => h('p', { class: 'bv-warn' }, w))];
  }

  function sens(b) {
    const g = sensitivity(b), oe = valueBusiness(b);
    if (!oe.ok) return [];
    const mid = g.values[2][2], up = g.values[1][2];
    return [h('p', { class: 'd-sub' }, 'Each box is the value from the cash method alone. Slide across for faster or slower growth, and down for a harder or easier return.'),
      dataTable({ label: 'Value for different growth and return', head: ['Return ↓ / growth →', ...g.growths.map(x => pct(x, 1))], rows: g.returns.map((r, i) => ({ label: pct(r, 1), cells: g.values[i].map((x, j) => ({ t: $(x), tone: i === 2 && j === 2 ? 'good' : '' })) })) }),
      h('p', { class: 'bv-note' }, `Lowering the return we ask for by just one point lifts the value by ${pct(mid ? up / mid - 1 : 0, 0)}. Small changes in the assumptions move the answer a lot, which is why we ask for a margin of safety.`)];
  }

  function update() {
    const profit = must(amount(st.profit, true)), dep = orZero(amount(st.dep)), upkeep = orZero(amount(st.upkeep)), cash = orZero(amount(st.cash)), debt = orZero(amount(st.debt));
    const b = { profit, depreciation: dep, upkeep, cash, debt, growth: st.growth / 100, predictability: st.pred, edge: st.edge };
    const v = valueBusiness(b);
    const d = dealView(v, { kind: st.kind, stakePct: st.stake, newMoney: orZero(amount(st.money)) || 0, offeredPct: Number(String(st.offered).replace(/,/g, '')) || 0, ask: amount(st.ask) || 0 });
    fill(ownerHost, h('div', { class: 'bv-oe' }, h('span', {}, 'Owner earnings: what the owners could really take home each year'), h('b', {}, Number.isNaN(profit) || [dep, upkeep, cash, debt].some(Number.isNaN) ? '—' : $(v.ownerEarnings))));
    fill(outHost, priceCard(v, d));
    fill(whyHost, why(v, b));
    fill(fieldHost, v.ok ? football(v, d.impliedValue > 0 ? d.impliedValue : null) : []);
    fill(sensHost, sens(b));
  }

  main.replaceChildren(h('div', { class: 'd-page bv-page' },
    head({ eyebrow: 'Valuation', title: 'What is a business <em>really</em> worth?', lead: 'Answer a few plain questions about a business. We work out what it is worth to a careful buyer and the range of prices worth paying. Nothing here is real money.' }),
    h('section', { class: 'd-card' }, h('h2', { class: 'd-h' }, '1. The numbers for last year'),
      h('p', { class: 'd-sub' }, 'Use the business’s own accounts. The boxes start filled with an example, so replace them with the real figures.'),
      h('div', { class: 'bv-cur' }, h('span', { class: 'bv-fl' }, 'Currency'), cur.el),
      grid(numberField('profit', 'Profit after tax', 'What was left after all costs, interest and tax. A loss is a negative number.', { negative: true }),
        numberField('dep', 'Depreciation', 'A cost on paper for machines and equipment wearing out. No cash leaves.'),
        numberField('upkeep', 'Upkeep spending', 'Money spent each year just to keep the business as it is, with no expansion.'),
        numberField('cash', 'Spare cash', 'Cash sitting in the business that the owners could take out.'),
        numberField('debt', 'Debt', 'Everything it owes to banks and lenders.')),
      ownerHost),
    h('section', { class: 'd-card' }, h('h2', { class: 'd-h' }, '2. What you expect'),
      h('div', { class: 'bv-f' }, h('span', { class: 'bv-fl' }, 'How fast will profits grow each year?'), h('small', {}, 'Be modest. We keep this for a few years, then let it fade, because growth rarely lasts.'), growth.el),
      h('div', { class: 'bv-f' }, h('span', { class: 'bv-fl' }, 'How steady are the profits?'), pred.el, predNote),
      h('div', { class: 'bv-f' }, h('span', { class: 'bv-fl' }, 'How hard is it for rivals to copy this business?'), edge.el, edgeNote)),
    h('section', { class: 'd-card' }, h('h2', { class: 'd-h' }, '3. What are you buying?'), kind.el, dealHost),
    h('section', { class: 'd-card bv-out' }, h('h2', { class: 'd-h' }, '4. The price range'), outHost),
    h('section', { class: 'd-card' }, h('h2', { class: 'd-h' }, '5. How we got there'), whyHost, h('h3', { class: 'bv-h3' }, 'Three ways of valuing the whole business'), fieldHost),
    h('section', { class: 'd-card' }, h('h2', { class: 'd-h' }, '6. How touchy is the answer?'), sensHost),
    explainer('What does "owner earnings" mean?', '<p>Reported profit can flatter a business. <b>Owner earnings</b> are profit, plus depreciation (which costs no cash), minus the money the business must keep spending to stay as it is. It is the cash an owner could take out each year without hurting the business.</p>'),
    explainer('What is a margin of safety?', '<p>Nobody can forecast exactly. A <b>margin of safety</b> means paying well below what you think the business is worth, so that you still do fine if you were a bit too hopeful. The riskier the business, the bigger the margin we ask for.</p>'),
    explainer('Buying part of a business, or putting new money in', '<p>When you <b>buy part</b>, you pay the owner for shares that already exist. When you <b>put new money in</b>, the money goes into the business and new shares are made for you. The value before your money goes in is the <b>pre-money</b> value, and with your money added it is the <b>post-money</b> value. Your share is your money divided by the post-money value.</p><p>If you would own less than half, you cannot decide on pay, spending or dividends, so we ask for a lower price.</p>'),
    explainer('What this page cannot do', '<p>It uses simple rules and your own numbers, so it is only as good as they are. It does not value what the assets could be sold for, patents, land, or a business that is losing money. Taxes, fees and the cost of finding a buyer are left out. This page is for learning and is not financial advice.</p>')));
  drawDeal(); update();
  return () => {};
}
