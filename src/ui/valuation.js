// @ts-nocheck
/* "Value a business" page: plain questions in, a price range out (bargain, sweet spot, ceiling), for the whole business, a part of it, or new money going in. Everything is worked out in the browser. */
import '../styles/valuation.css';
import { h, head, segmented, statGrid, dataTable, explainer, chartBox, fill } from './dataui.js';
import { rangeSlider } from './slider.js';
import { withNumberBox } from './slidebox.js';
import { ruler, football, bridge, scenarioBars, ownership } from './valuation-visuals.js';
import { money, pct, num } from '../lib/format';
import { valueBusiness, dealView, sensitivity, scenarios, impliedGrowth, earningsBridge, project, terminalCap, YEARS, MINORITY_DISCOUNT } from '../lib/valuation';

const PRED = [['steady', 'Steady'], ['bumpy', 'Bumpy'], ['risky', 'Risky']];
const PRED_NOTE = { steady: 'Profits hardly move from year to year, such as a school, a pharmacy or a utility.', bumpy: 'Profits rise and fall with the economy or the season.', risky: 'Profits could disappear: a new business, a fashion business, or one that lives off one big customer.' };
const EDGE = [['none', 'No edge'], ['some', 'Some edge'], ['strong', 'Strong edge']];
const EDGE_NOTE = { none: 'Rivals could copy it easily, so profits are likely to be competed away.', some: 'Loyal customers, a good location or a good name give it some protection.', strong: 'Hard to copy: a trusted brand, the lowest costs, or customers who would never bother to switch.' };
const CAP = [['light', 'Very little'], ['medium', 'Some'], ['heavy', 'A lot']];
const CAP_NOTE = { light: 'Growth needs few new assets, such as consulting, software or a small online shop.', medium: 'Growth needs some new equipment, stock or staff, as in most small businesses.', heavy: 'Every bit of growth needs new factories, shops, machines or large stocks.' };
const KINDS = [['whole', 'The whole business'], ['part', 'Part of it'], ['new', 'New money in']];
const CURR = [['$', 'US dollars'], ['Rs ', 'Rupees']];
const SAFE_RATE = { '$': '4', 'Rs ': '12' };
const VERDICT = {
  bargain: ['good', 'A bargain', 'The price is below what the earnings alone are worth. Good news, but ask why it is so cheap before you celebrate.'],
  good: ['good', 'A good buy', 'The price is at or below our sweet spot, so you have a margin of safety if things turn out worse than you hoped.'],
  stretch: ['warn', 'A stretch', 'This could be fair, but there is little room for error. Try to bring the price down toward the sweet spot.'],
  toohigh: ['bad', 'Too expensive', 'The price is above the most we would pay. Walk away, or ask for a lower price or proof of higher profits.']
};

const amount = (v, allowNegative = false) => {
  const s = String(v).replace(/[,\s]/g, '').replace('−', '-');
  if (s === '') return null;
  const n = Number(s);
  return Number.isFinite(n) && (allowNegative || n >= 0) ? n : NaN;
};
const orZero = x => (x == null ? 0 : x);

export function renderValuation(main) {
  const st = { sym: '$', profit: '600000', dep: '150000', upkeep: '150000', cash: '400000', debt: '800000', h1: '', h2: '', pay: '', mgr: '', oneC: '', oneG: '', assets: '', rf: '4', rfTouched: false, growth: 6, pred: 'bumpy', edge: 'some', capital: 'medium', kind: 'whole', stake: 25, money: '500000', offered: '', ask: '' };
  const $ = x => money(x, { sym: st.sym });
  let rfInput = null;

  const ownerHost = h('div'), outHost = h('div', { class: 'bv-stack' }), whyHost = h('div', { class: 'bv-stack' }), sensHost = h('div', { class: 'bv-stack' }), scenHost = h('div', { class: 'bv-stack' }), dealHost = h('div', { class: 'bv-fields' }), tipHost = h('p', { class: 'bv-note' });
  const predNote = h('p', { class: 'bv-note' }, PRED_NOTE[st.pred]), edgeNote = h('p', { class: 'bv-note' }, EDGE_NOTE[st.edge]), capNote = h('p', { class: 'bv-note' }, CAP_NOTE[st.capital]);
  const chart = chartBox({ series: [{ name: '', pts: [[0, 0], [1, 0]] }] });

  function numberField(key, label, hint, { negative = false, placeholder = '' } = {}) {
    const input = h('input', { class: 'd-in bv-in', type: 'text', inputmode: 'decimal', value: st[key], placeholder, 'aria-label': label });
    input.addEventListener('input', () => { st[key] = input.value; if (key === 'rf') st.rfTouched = true; update(); });
    input.addEventListener('change', () => { const n = amount(input.value, negative); if (n != null && !Number.isNaN(n) && key !== 'rf') { st[key] = num(n, n % 1 ? 2 : 0); input.value = st[key]; } update(); });
    if (key === 'rf') rfInput = input;
    return h('label', { class: 'bv-f' }, h('span', { class: 'bv-fl' }, label), h('small', {}, hint), input);
  }
  const grid = (...kids) => h('div', { class: 'bv-fields' }, ...kids);

  const cur = segmented({ options: CURR, value: st.sym, label: 'Currency', onChange: v => { st.sym = v; if (!st.rfTouched) { st.rf = SAFE_RATE[v]; if (rfInput) rfInput.value = st.rf; } update(); } });
  const pred = segmented({ options: PRED, value: st.pred, label: 'How steady are the profits', onChange: v => { st.pred = v; predNote.textContent = PRED_NOTE[v]; update(); } });
  const edge = segmented({ options: EDGE, value: st.edge, label: 'How hard is the business to copy', onChange: v => { st.edge = v; edgeNote.textContent = EDGE_NOTE[v]; update(); } });
  const capital = segmented({ options: CAP, value: st.capital, label: 'How much new money growth needs', onChange: v => { st.capital = v; capNote.textContent = CAP_NOTE[v]; update(); } });
  const growth = withNumberBox(rangeSlider({ min: -10, max: 30, step: 0.5, value: st.growth, label: 'Yearly profit growth', fmt: v => (v > 0 ? '+' : '') + v + '%' }), { label: 'Yearly profit growth', unit: '%', decimals: 1 });
  growth.input.addEventListener('input', () => { st.growth = +growth.input.value; update(); });
  const kind = segmented({ options: KINDS, value: st.kind, label: 'What is being sold', onChange: v => { st.kind = v; drawDeal(); update(); } });
  const stake = withNumberBox(rangeSlider({ min: 1, max: 99, step: 1, value: st.stake, label: 'Share being sold', fmt: v => v + '%' }), { label: 'Share being sold', unit: '%' });
  stake.input.addEventListener('input', () => { st.stake = +stake.input.value; update(); });

  function drawDeal() {
    const ask = numberField('ask', st.kind === 'part' ? 'Price they are asking for that share' : 'Price they are asking', 'Optional. Leave it blank to see only the price range.', { placeholder: 'Not sure yet' });
    const kids = st.kind === 'whole' ? [ask]
      : st.kind === 'part' ? [h('div', { class: 'bv-f' }, h('span', { class: 'bv-fl' }, 'Share of the business being sold'), h('small', {}, 'The owner keeps the rest and sells you this part. Drag the bar or type a number.'), stake.el), ask]
        : [numberField('money', 'Money you would put in', 'This money goes into the business, not to the owner.'), numberField('offered', 'Share of the business they offer for it (%)', 'Optional. For example 10 means you would own 10%.', { placeholder: 'Not sure yet' })];
    fill(dealHost, kids);
  }

  function priceCard(v, d, b) {
    if (!v.ok) return [h('p', { class: 'bv-bad', role: 'alert' }, v.reason)];
    const z = d.zones, isNew = d.kind === 'new', askMark = d.kind === 'part' ? (amount(st.ask) || null) : (d.impliedValue > 0 ? d.impliedValue : null);
    const out = [];
    if (d.verdict) { const [tone, title, text] = VERDICT[d.verdict]; out.push(h('div', { class: 'bv-verdict ' + tone, role: 'status' }, h('b', {}, title), h('p', {}, text))); }
    else out.push(h('p', { class: 'bv-note' }, isNew ? 'Enter the share they offer to see a verdict.' : 'Enter the price they are asking to see a verdict.'));
    out.push(ruler(z, askMark, isNew ? 'Their value' : 'Asking price', $));
    const sub = isNew && d.shareAt ? [d.shareAt.bargain, d.shareAt.sweet, d.shareAt.ceiling].map(x => `You would own ${pct(x, 1)}`) : ['Below this, ask why it is so cheap', 'The price to aim for', 'Pay more and you carry the risk'];
    const names = isNew ? ['Bargain value', 'Sweet spot value', 'Ceiling value'] : ['Bargain price', 'Sweet spot', 'Walk-away ceiling'];
    out.push(statGrid([{ label: names[0], value: $(z.bargain), sub: sub[0], tone: 'good' }, { label: names[1], value: $(z.sweet), sub: sub[1] }, { label: names[2], value: $(z.ceiling), sub: sub[2], tone: 'bad' }]));
    if (isNew) out.push(h('p', { class: 'bv-note' }, 'These are values for the whole company ', h('b', {}, 'before'), ' your money goes in. The lower the value they accept, the bigger the share your money should buy.'));
    if (isNew && d.shareAt) out.push(ownership(d.impliedValue != null ? d.share : d.shareAt.sweet, $, amount(st.money) || 0), h('p', { class: 'bv-note' }, d.impliedValue != null ? 'The bar shows the share they offer.' : 'The bar shows the share you would get at the sweet spot value.'));
    if (d.discounted) out.push(h('p', { class: 'bv-note' }, `Because you would own less than half, you could not control decisions or dividends, so we took ${pct(MINORITY_DISCOUNT, 0)} off the price.`));
    if (d.kind === 'part' && d.impliedValue) out.push(h('p', { class: 'bv-note' }, `At that price, the whole business is being valued at ${$(d.impliedValue)}. Our fair value for the whole business is ${$(v.fair)}.`));
    if (isNew && d.impliedValue != null) out.push(h('p', { class: 'bv-note' }, d.impliedValue > 0 ? `${$(amount(st.money) || 0)} for ${st.offered}% values the company at ${$(d.impliedValue)} before your money.` : 'That share is too small to make sense for that money.'));
    if (d.yield != null && d.payback != null) out.push(h('p', { class: 'bv-yield' }, 'At that price, your share of today’s owner earnings is about ', h('b', {}, pct(d.yield, 1)), ' a year, so it would take about ', h('b', {}, num(d.payback, 1) + ' years'), ' to earn the price back if profits stay flat.'));
    if (askMark != null && d.impliedValue > 0) out.push(assumes(b, d.impliedValue));
    return out;
  }

  /** What the asking price quietly assumes about growth. */
  function assumes(b, whole) {
    const r = impliedGrowth(b, whole), mine = b.growth;
    let text, tone = 'bv-note';
    if (r.status === 'none') text = r.why === 'too-high' ? 'No growth rate we tested could justify this price. It asks you to pay for more than the business can plausibly earn.' : 'This price is below the value of the business even if its profits shrank fast. Check what is wrong with it.';
    else {
      const g = r.growth;
      text = `To be worth this price on the cash method, profits would need to grow about ${pct(g, 1)} a year. You expect ${pct(mine, 1)}. `;
      if (g > 0.15) text += 'Growth that high rarely lasts, so the price leans on hope.';
      else if (g > mine + 0.005) { text += 'The price needs better results than your own forecast.'; tone = 'bv-warn'; }
      else text += 'The price needs no more than you expect.';
    }
    return h('div', { class: 'bv-assume' }, h('b', {}, 'What this price is betting on'), h('p', { class: tone }, text));
  }

  function why(v, b) {
    if (!v.ok) return [];
    const m = v.methods, rf = b.riskFree, blend = Math.round(m[0].mid * 0.3 + m[1].mid * 0.4 + m[2].mid * 0.3), usedFloor = m[3] && v.fair === m[3].mid && v.fair > blend;
    return [h('ol', { class: 'bv-why' },
      h('li', {}, h('b', {}, 'Count only real cash. '), `After one-offs, averaging and pay adjustments, profit is ${$(v.normalised)}. Add depreciation ${$(b.depreciation)}, take off upkeep ${$(b.upkeep)}, and `, h('b', {}, $(v.ownerEarnings)), ' a year is left that the owners could take home.'),
      h('li', {}, h('b', {}, 'Ask for a fair return. '), `A safe bond pays ${pct(rf, 1)}. Because the profits are ${v.predictability}, we ask for ${pct(v.required, 1)} a year on the money (more if debt is heavy).`),
      h('li', {}, h('b', {}, 'Charge growth for what it costs. '), `Growing ${pct(b.growth, 1)} a year takes about ${pct(v.reinvest, 0)} of the earnings back into the business, so that cash is not free for the owners.`),
      h('li', {}, h('b', {}, 'Value it more than one way. '), `If nothing grows it is worth ${$(m[0].mid)}. Counting the next ${YEARS} years of cash, ${$(m[1].mid)}. At what similar businesses sell for, ${$(m[2].mid)}.${m[3] ? ` Sold off piece by piece it might fetch ${$(m[3].mid)}.` : ''}`),
      h('li', {}, h('b', {}, 'Blend them. '), 'We trust the cash method most (40%), then the other two (30% each), to get a fair value of ', h('b', {}, $(v.fair)), usedFloor ? ', raised to what the assets alone would fetch.' : '.'),
      h('li', {}, h('b', {}, 'Leave room for being wrong. '), `We want a ${pct(v.margin, 0)} margin of safety, so the sweet spot is ${$(v.zones.sweet)}, and we would not pay more than ${$(v.zones.ceiling)}.`)), ...v.warnings.map(w => h('p', { class: 'bv-warn' }, w))];
  }

  function cashChart(v, b) {
    const pr = project(v.ownerEarnings, b.growth, b.edge, v.required, b.cash, b.capital, terminalCap(b.riskFree));
    chart.update({
      title: 'Cash the owners could take out each year, for ten years',
      series: [
        { name: 'Earnings before paying for growth', pts: [[0, v.ownerEarnings], ...pr.rows.map(r => [r.year, r.earnings])], color: 'mute', dash: true },
        { name: 'Cash left for the owners', pts: [[0, v.ownerEarnings], ...pr.rows.map(r => [r.year, r.free])], color: 'c1' },
        { name: 'That cash in today’s money', pts: pr.rows.map(r => [r.year, r.pv]), color: 'c3' }
      ],
      xFmt: x => (x === 0 ? 'Now' : 'Yr ' + Math.round(x)), xRead: x => (x === 0 ? 'Last year' : 'Year ' + Math.round(x)), yFmt: x => $(x), yRead: x => $(x),
      hint: 'Growth holds for a few years, then fades to a modest long-run rate.'
    });
    return chart.el;
  }

  function sens(b, v, ask) {
    if (!v.ok) return [];
    const g = sensitivity(b), mid = g.values[2][2], up = g.values[1][2];
    const tone = (x, i, j) => (ask ? (x >= ask ? 'pos' : 'neg') : i === 2 && j === 2 ? 'pos' : '');
    return [h('p', { class: 'd-sub' }, 'Each box is the value from the cash method alone. Slide across for faster or slower growth, and down for a harder or easier return.' + (ask ? ' Green means the business is worth at least the price asked.' : '')),
      dataTable({ label: 'Value for different growth and return', head: ['Return ↓ / growth →', ...g.growths.map(x => pct(x, 1))], rows: g.returns.map((r, i) => ({ label: pct(r, 1), cells: g.values[i].map((x, j) => ({ t: $(x), tone: tone(x, i, j) })) })) }),
      h('p', { class: 'bv-note' }, `Lowering the return we ask for by just one point lifts the value by ${pct(mid ? up / mid - 1 : 0, 0)}. Small changes in the assumptions move the answer a lot, which is why we ask for a margin of safety.`)];
  }

  function update() {
    const profit = amount(st.profit, true), hist = [amount(st.h1, true), amount(st.h2, true)].filter(x => x != null);
    const opt = [amount(st.pay), amount(st.mgr), amount(st.oneC), amount(st.oneG), amount(st.assets)], rate = String(st.rf).trim() === '' ? null : Number(st.rf);
    const plain = [amount(st.dep), amount(st.upkeep), amount(st.cash), amount(st.debt)];
    const junk = profit == null || [profit, ...hist, ...opt, ...plain].some(x => Number.isNaN(x)) || (rate != null && !Number.isFinite(rate));
    const b = { profit: junk ? NaN : profit, depreciation: orZero(plain[0]), upkeep: orZero(plain[1]), cash: orZero(plain[2]), debt: orZero(plain[3]), growth: st.growth / 100, predictability: st.pred, edge: st.edge, capital: st.capital, history: hist.filter(Number.isFinite), ownerPay: orZero(opt[0]), managerCost: orZero(opt[1]), oneOffCosts: orZero(opt[2]), oneOffGains: orZero(opt[3]), assets: orZero(opt[4]), riskFree: (rate == null ? Number(SAFE_RATE[st.sym]) : rate) / 100 };
    const v = valueBusiness(b);
    const d = dealView(v, { kind: st.kind, stakePct: st.stake, newMoney: orZero(amount(st.money)) || 0, offeredPct: Number(String(st.offered).replace(/,/g, '')) || 0, ask: amount(st.ask) || 0 });
    const ask = d.impliedValue > 0 ? d.impliedValue : null, used = [st.h1, st.h2, st.pay, st.mgr, st.oneC, st.oneG, st.assets].filter(x => String(x).trim() !== '').length + (st.rfTouched ? 1 : 0);
    tipHost.textContent = used ? `You have filled in ${used} optional ${used === 1 ? 'detail' : 'details'}. Each one makes the answer closer to the truth.` : 'These are optional, but each one you fill in makes the answer closer to the truth.';
    fill(ownerHost, h('div', { class: 'bv-oe' }, h('span', {}, 'Owner earnings: what the owners could really take home each year'), h('b', {}, junk ? '—' : $(v.ownerEarnings))));
    fill(outHost, priceCard(v, d, b));
    fill(whyHost, why(v, b), v.ok ? [h('h3', { class: 'bv-h3' }, 'From profit to owner earnings'), bridge(earningsBridge(b), $), h('h3', { class: 'bv-h3' }, 'The cash it should produce'), cashChart(v, b), h('h3', { class: 'bv-h3' }, 'Ways of valuing the whole business'), ...football(v, ask, $)] : []);
    fill(scenHost, v.ok ? [h('p', { class: 'd-sub' }, 'The same business in three futures. The tick marks the sweet spot for each.'), scenarioBars(scenarios(b), ask, $)] : []);
    fill(sensHost, sens(b, v, ask));
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
      h('details', { class: 'bv-sharp' }, h('summary', {}, 'Make it sharper (optional)'),
        h('div', { class: 'bv-sharpb' }, tipHost,
          grid(numberField('h1', 'Profit two years ago', 'Averaging years stops one lucky or unlucky year setting the price.', { negative: true, placeholder: 'Leave blank if unknown' }),
            numberField('h2', 'Profit three years ago', 'Same idea. A business whose profit swings is treated as riskier.', { negative: true, placeholder: 'Leave blank if unknown' }),
            numberField('pay', 'What the owner paid themselves', 'Already counted in the costs above.'),
            numberField('mgr', 'What a hired manager would cost', 'If the owner leaves, someone must be paid to do the job.'),
            numberField('oneC', 'One-off costs last year', 'A lawsuit, a fire or a move that will not happen again. We add it back.'),
            numberField('oneG', 'One-off gains last year', 'A sale of land or a single huge order. We take it out.'),
            numberField('assets', 'What the assets could be sold for', 'Equipment, property and stock. It gives a floor under the price.'),
            numberField('rf', 'Safe interest rate (%)', 'What a government bond pays in this currency. The return we ask for starts from here.')))),
      ownerHost),
    h('section', { class: 'd-card' }, h('h2', { class: 'd-h' }, '2. What you expect'),
      h('div', { class: 'bv-f' }, h('span', { class: 'bv-fl' }, 'How fast will profits grow each year?'), h('small', {}, 'Be modest. We keep this for a few years, then let it fade, because growth rarely lasts. Drag the bar or type a number.'), growth.el),
      h('div', { class: 'bv-f' }, h('span', { class: 'bv-fl' }, 'How much new money does growth need?'), capital.el, capNote),
      h('div', { class: 'bv-f' }, h('span', { class: 'bv-fl' }, 'How steady are the profits?'), pred.el, predNote),
      h('div', { class: 'bv-f' }, h('span', { class: 'bv-fl' }, 'How hard is it for rivals to copy this business?'), edge.el, edgeNote)),
    h('section', { class: 'd-card' }, h('h2', { class: 'd-h' }, '3. What are you buying?'), kind.el, dealHost),
    h('section', { class: 'd-card bv-out' }, h('h2', { class: 'd-h' }, '4. The price range'), outHost),
    h('section', { class: 'd-card' }, h('h2', { class: 'd-h' }, '5. How we got there'), whyHost),
    h('section', { class: 'd-card' }, h('h2', { class: 'd-h' }, '6. Good, expected and bad futures'), scenHost),
    h('section', { class: 'd-card' }, h('h2', { class: 'd-h' }, '7. How touchy is the answer?'), sensHost),
    explainer('What does "owner earnings" mean?', '<p>Reported profit can flatter a business. <b>Owner earnings</b> are profit, plus depreciation (which costs no cash), minus the money the business must keep spending to stay as it is. It is the cash an owner could take out each year without hurting the business.</p>'),
    explainer('Why does growth cost money?', '<p>A business that wants to earn more usually has to spend more: new machines, bigger stocks, more staff. That money is not free to take home. We assume a business with light needs keeps most of its growth, and one that needs a lot of equipment keeps far less.</p>'),
    explainer('What is a margin of safety?', '<p>Nobody can forecast exactly. A <b>margin of safety</b> means paying well below what you think the business is worth, so that you still do fine if you were a bit too hopeful. The riskier the business, the bigger the margin we ask for.</p>'),
    explainer('Buying part of a business, or putting new money in', '<p>When you <b>buy part</b>, you pay the owner for shares that already exist. When you <b>put new money in</b>, the money goes into the business and new shares are made for you. The value before your money goes in is the <b>pre-money</b> value, and with your money added it is the <b>post-money</b> value. Your share is your money divided by the post-money value.</p><p>If you would own less than half, you cannot decide on pay, spending or dividends, so we ask for a lower price.</p>'),
    explainer('What this page cannot do', '<p>It uses simple rules and your own numbers, so it is only as good as they are. It does not value patents, land bought for its location, or a business that is losing money. Taxes, fees and the cost of finding a buyer are left out. This page is for learning and is not financial advice.</p>')));
  drawDeal(); update();
  return () => chart.destroy();
}
