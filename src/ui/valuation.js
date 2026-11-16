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
const PRED_NOTE = { steady: 'Profit hardly changes from year to year. Think of a school, a pharmacy or an electricity company.', bumpy: 'Profit goes up and down with the economy or the season.', risky: 'Profit could vanish. Examples: a new business, a fashion shop, or a business with one big customer.' };
const EDGE = [['none', 'No edge'], ['some', 'Some edge'], ['strong', 'Strong edge']];
const EDGE_NOTE = { none: 'Rivals can copy it easily, so they will likely take away its profit.', some: 'Loyal customers, a good location or a good name protect it a little.', strong: 'Hard to copy. It has a trusted brand, the lowest costs, or customers who rarely switch.' };
const CAP = [['light', 'Very little'], ['medium', 'Some'], ['heavy', 'A lot']];
const CAP_NOTE = { light: 'Growing needs little new spending. Examples: consulting, software, a small online shop.', medium: 'Growing needs some new equipment, stock or staff. Most small businesses are like this.', heavy: 'Growing needs new factories, shops, machines or lots of stock.' };
const KINDS = [['whole', 'The whole business'], ['part', 'Part of it'], ['new', 'New money in']];
const CURR = [['$', 'US dollars'], ['Rs ', 'Rupees']];
const SAFE_RATE = { '$': '4', 'Rs ': '12' };
const VERDICT = {
  bargain: ['good', 'A bargain', 'The price is below what the earnings alone are worth. Good news, but ask why it is so cheap.'],
  good: ['good', 'A good buy', 'The price is at or below our sweet spot. You have a safety cushion if things go worse than you hoped.'],
  stretch: ['warn', 'A stretch', 'The price could be fair, but you have little room for mistakes. Try to bring it down to the sweet spot.'],
  toohigh: ['bad', 'Too expensive', 'The price is more than we would pay. Walk away, or ask for a lower price or proof of higher profit.']
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
    out.push(ruler(z, askMark, isNew ? 'Value they ask' : 'Asking price', $));
    const sub = isNew && d.shareAt ? [d.shareAt.bargain, d.shareAt.sweet, d.shareAt.ceiling].map(x => `You would own ${pct(x, 1)}`) : ['Below this, ask why it is so cheap', 'The price to aim for', 'Pay more and you take on the risk'];
    const names = isNew ? ['Bargain value', 'Sweet spot value', 'Highest value to accept'] : ['Bargain price', 'Sweet spot', 'Highest price to pay'];
    out.push(statGrid([{ label: names[0], value: $(z.bargain), sub: sub[0], tone: 'good' }, { label: names[1], value: $(z.sweet), sub: sub[1] }, { label: names[2], value: $(z.ceiling), sub: sub[2], tone: 'bad' }]));
    if (isNew) out.push(h('p', { class: 'bv-note' }, 'These are values for the whole company ', h('b', {}, 'before'), ' your money goes in. The lower the value, the bigger the share your money should buy.'));
    if (isNew && d.shareAt) out.push(ownership(d.impliedValue != null ? d.share : d.shareAt.sweet, $, amount(st.money) || 0), h('p', { class: 'bv-note' }, d.impliedValue != null ? 'The bar shows the share they offer.' : 'The bar shows the share you would get at the sweet spot value.'));
    if (d.discounted) out.push(h('p', { class: 'bv-note' }, `You would own less than half, so you could not decide things or control payouts to owners. So we took ${pct(MINORITY_DISCOUNT, 0)} off the price.`));
    if (d.kind === 'part' && d.impliedValue) out.push(h('p', { class: 'bv-note' }, `At that price, the whole business is being valued at ${$(d.impliedValue)}. Our fair value for the whole business is ${$(v.fair)}.`));
    if (isNew && d.impliedValue != null) out.push(h('p', { class: 'bv-note' }, d.impliedValue > 0 ? `${$(amount(st.money) || 0)} for ${st.offered}% values the company at ${$(d.impliedValue)} before your money.` : 'That share is too small to make sense for that money.'));
    if (d.yield != null && d.payback != null) out.push(h('p', { class: 'bv-yield' }, 'At that price, your share of today’s owner earnings is about ', h('b', {}, pct(d.yield, 1)), ' a year. It would take about ', h('b', {}, num(d.payback, 1) + ' years'), ' to earn the price back if profit stays the same.'));
    if (askMark != null && d.impliedValue > 0) out.push(assumes(b, d.impliedValue));
    return out;
  }

  /** What the asking price quietly assumes about growth. */
  function assumes(b, whole) {
    const r = impliedGrowth(b, whole), mine = b.growth;
    let text, tone = 'bv-note';
    if (r.status === 'none') text = r.why === 'too-high' ? 'No growth rate we tested can explain this price. It asks you to pay more than the business can likely earn.' : 'This price is below the business’s value even if its profit shrank fast. Check what is wrong with it.';
    else {
      const g = r.growth;
      text = `For this price to be fair under the cash method, profit would need to grow about ${pct(g, 1)} a year. You expect ${pct(mine, 1)}. `;
      if (g > 0.15) text += 'Growth that high rarely lasts. The price depends on hope.';
      else if (g > mine + 0.005) { text += 'The price needs better results than you expect.'; tone = 'bv-warn'; }
      else text += 'The price needs no more than you expect.';
    }
    return h('div', { class: 'bv-assume' }, h('b', {}, 'What this price expects'), h('p', { class: tone }, text));
  }

  function why(v, b) {
    if (!v.ok) return [];
    const m = v.methods, rf = b.riskFree, blend = Math.round(m[0].mid * 0.3 + m[1].mid * 0.4 + m[2].mid * 0.3), usedFloor = m[3] && v.fair === m[3].mid && v.fair > blend;
    return [h('ol', { class: 'bv-why' },
      h('li', {}, h('b', {}, 'Count only real cash. '), `After removing one-off items, averaging years and fixing pay, profit is ${$(v.normalised)}. Add depreciation ${$(b.depreciation)}, subtract upkeep ${$(b.upkeep)}, and `, h('b', {}, $(v.ownerEarnings)), ' a year is left for the owners to take home.'),
      h('li', {}, h('b', {}, 'Ask for a fair return. '), `A safe bond pays ${pct(rf, 1)}. The profit is ${v.predictability}, so we ask for ${pct(v.required, 1)} a year on the money. We ask for more if debt is high.`),
      h('li', {}, h('b', {}, 'Count what growth costs. '), `Growing ${pct(b.growth, 1)} a year uses about ${pct(v.reinvest, 0)} of the earnings. The owners cannot take that cash home.`),
      h('li', {}, h('b', {}, 'Value it more than one way. '), `If nothing grows, it is worth ${$(m[0].mid)}. Counting the next ${YEARS} years of cash, ${$(m[1].mid)}. Using what similar businesses sell for, ${$(m[2].mid)}.${m[3] ? ` Sold off piece by piece, it might fetch ${$(m[3].mid)}.` : ''}`),
      h('li', {}, h('b', {}, 'Blend them. '), 'We trust the cash method most (40%) and the other two less (30% each). This gives a fair value of ', h('b', {}, $(v.fair)), usedFloor ? ', raised to what the assets alone would sell for.' : '.'),
      h('li', {}, h('b', {}, 'Leave room for mistakes. '), `We want a ${pct(v.margin, 0)} safety cushion (paying that much less than it is worth). So the sweet spot is ${$(v.zones.sweet)}, and we would not pay more than ${$(v.zones.ceiling)}.`)), ...v.warnings.map(w => h('p', { class: 'bv-warn' }, w))];
  }

  function cashChart(v, b) {
    const pr = project(v.ownerEarnings, b.growth, b.edge, v.required, b.cash, b.capital, terminalCap(b.riskFree));
    chart.update({
      title: 'Cash the owners could take out each year, for ten years',
      series: [
        { name: 'Earnings before growth costs', pts: [[0, v.ownerEarnings], ...pr.rows.map(r => [r.year, r.earnings])], color: 'mute', dash: true },
        { name: 'Cash left for the owners', pts: [[0, v.ownerEarnings], ...pr.rows.map(r => [r.year, r.free])], color: 'c1' },
        { name: 'That cash in today’s value', pts: pr.rows.map(r => [r.year, r.pv]), color: 'c3' }
      ],
      xFmt: x => (x === 0 ? 'Now' : 'Yr ' + Math.round(x)), xRead: x => (x === 0 ? 'Last year' : 'Year ' + Math.round(x)), yFmt: x => $(x), yRead: x => $(x),
      hint: 'Growth lasts a few years, then slows to a small long-term rate.'
    });
    return chart.el;
  }

  function sens(b, v, ask) {
    if (!v.ok) return [];
    const g = sensitivity(b), mid = g.values[2][2], up = g.values[1][2];
    const tone = (x, i, j) => (ask ? (x >= ask ? 'pos' : 'neg') : i === 2 && j === 2 ? 'pos' : '');
    return [h('p', { class: 'd-sub' }, 'Each box is the value from the cash method alone. Across: faster or slower growth. Down: a higher or lower return you ask for.' + (ask ? ' Green means the business is worth at least the asking price.' : '')),
      dataTable({ label: 'Value for different growth and return', head: ['Return you ask for ↓ / growth →', ...g.growths.map(x => pct(x, 1))], rows: g.returns.map((r, i) => ({ label: pct(r, 1), cells: g.values[i].map((x, j) => ({ t: $(x), tone: tone(x, i, j) })) })) }),
      h('p', { class: 'bv-note' }, `Ask for a return one point lower and the value rises by ${pct(mid ? up / mid - 1 : 0, 0)}. Small changes in your guesses move the answer a lot. That is why we ask for a safety cushion.`)];
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
    tipHost.textContent = used ? `You have filled in ${used} optional ${used === 1 ? 'detail' : 'details'}. Each one makes the answer more accurate.` : 'These are optional, but each one you fill in makes the answer more accurate.';
    fill(ownerHost, h('div', { class: 'bv-oe' }, h('span', {}, 'Owner earnings: cash the owners could really take home each year'), h('b', {}, junk ? '—' : $(v.ownerEarnings))));
    fill(outHost, priceCard(v, d, b));
    fill(whyHost, why(v, b), v.ok ? [h('h3', { class: 'bv-h3' }, 'From profit to owner earnings'), bridge(earningsBridge(b), $), h('h3', { class: 'bv-h3' }, 'The cash it should produce'), cashChart(v, b), h('h3', { class: 'bv-h3' }, 'Ways of valuing the whole business'), ...football(v, ask, $)] : []);
    fill(scenHost, v.ok ? [h('p', { class: 'd-sub' }, 'The same business in three futures. The tick mark shows the sweet spot for each.'), scenarioBars(scenarios(b), ask, $)] : []);
    fill(sensHost, sens(b, v, ask));
  }

  main.replaceChildren(h('div', { class: 'd-page bv-page' },
    head({ eyebrow: 'Valuation', title: 'What is a business <em>really</em> worth?', lead: 'Answer a few questions about a business. We work out what it is worth to a careful buyer, and which prices are worth paying. Nothing here is real money.' }),
    h('section', { class: 'd-card' }, h('h2', { class: 'd-h' }, '1. The numbers for last year'),
      h('p', { class: 'd-sub' }, 'Use the business’s own accounts. The boxes hold an example. Replace it with the real numbers.'),
      h('div', { class: 'bv-cur' }, h('span', { class: 'bv-fl' }, 'Currency'), cur.el),
      grid(numberField('profit', 'Profit after tax', 'What is left after all costs, interest and tax. For a loss, type a minus number.', { negative: true }),
        numberField('dep', 'Depreciation', 'A cost on paper for machines and equipment wearing out. No cash leaves the business.'),
        numberField('upkeep', 'Upkeep spending', 'Money spent each year just to keep the business running as it is, not to grow.'),
        numberField('cash', 'Spare cash', 'Cash in the business that the owners could take out.'),
        numberField('debt', 'Debt', 'Everything it owes to banks and other lenders.')),
      h('details', { class: 'bv-sharp' }, h('summary', {}, 'Make it more accurate (optional)'),
        h('div', { class: 'bv-sharpb' }, tipHost,
          grid(numberField('h1', 'Profit two years ago', 'We average the years, so one lucky or unlucky year does not set the price.', { negative: true, placeholder: 'Leave blank if unknown' }),
            numberField('h2', 'Profit three years ago', 'Same idea. If profit jumps around, we treat the business as riskier.', { negative: true, placeholder: 'Leave blank if unknown' }),
            numberField('pay', 'What the owner paid themselves', 'Already counted in the costs above.'),
            numberField('mgr', 'What a hired manager would cost', 'If the owner leaves, someone must be paid to do the job.'),
            numberField('oneC', 'One-off costs last year', 'A court case, a fire or a move that will not happen again. We add it back.'),
            numberField('oneG', 'One-off gains last year', 'A land sale or one huge order. We take it out.'),
            numberField('assets', 'What the assets could be sold for', 'Equipment, property and stock. It sets a lowest value for the business.'),
            numberField('rf', 'Safe interest rate (%)', 'What a government bond pays in this currency. The return we ask for starts from here.')))),
      ownerHost),
    h('section', { class: 'd-card' }, h('h2', { class: 'd-h' }, '2. What you expect'),
      h('div', { class: 'bv-f' }, h('span', { class: 'bv-fl' }, 'How fast will profits grow each year?'), h('small', {}, 'Be careful here. We use this rate for a few years, then slow it down, because growth rarely lasts. Drag the bar or type a number.'), growth.el),
      h('div', { class: 'bv-f' }, h('span', { class: 'bv-fl' }, 'How much new spending does growth need?'), capital.el, capNote),
      h('div', { class: 'bv-f' }, h('span', { class: 'bv-fl' }, 'How steady are the profits?'), pred.el, predNote),
      h('div', { class: 'bv-f' }, h('span', { class: 'bv-fl' }, 'How hard is it for rivals to copy?'), edge.el, edgeNote)),
    h('section', { class: 'd-card' }, h('h2', { class: 'd-h' }, '3. What are you buying?'), kind.el, dealHost),
    h('section', { class: 'd-card bv-out' }, h('h2', { class: 'd-h' }, '4. The price range'), outHost),
    h('section', { class: 'd-card' }, h('h2', { class: 'd-h' }, '5. How we got there'), whyHost),
    h('section', { class: 'd-card' }, h('h2', { class: 'd-h' }, '6. Good, normal and bad futures'), scenHost),
    h('section', { class: 'd-card' }, h('h2', { class: 'd-h' }, '7. How much do guesses change the answer?'), sensHost),
    explainer('What does "owner earnings" mean?', '<p>Reported profit can make a business look better than it is. <b>Owner earnings</b> are profit, plus depreciation (it costs no cash), minus the money the business must keep spending to stay as it is. It is the cash an owner could take out each year without hurting the business.</p>'),
    explainer('Why does growth cost money?', '<p>To earn more, a business usually has to spend more: new machines, more stock, more staff. The owners cannot take that money home. A business that needs little keeps most of its growth. One that needs a lot of equipment keeps far less.</p>'),
    explainer('What is a margin of safety?', '<p>Nobody can predict exactly. A <b>margin of safety</b> is a safety cushion: you pay well below what you think the business is worth. Then you are still fine if you were too hopeful. The riskier the business, the bigger the cushion we ask for.</p>'),
    explainer('Buying part of a business, or putting new money in', '<p>When you <b>buy part</b>, you pay the owner for shares that already exist. When you <b>put new money in</b>, the money goes into the business, and new shares are made for you. The value before your money goes in is the <b>pre-money</b> value. The value with your money added is the <b>post-money</b> value. Your share is your money divided by the post-money value.</p><p>If you would own less than half, you cannot decide on pay, spending or payouts to owners. So we ask for a lower price.</p>'),
    explainer('What this page cannot do', '<p>It uses fixed rules and your own numbers, so it is only as good as they are. It cannot value patents, land bought for its location, or a business that is losing money. It leaves out taxes, fees and the cost of finding a buyer. This page is for learning. It is not financial advice.</p>')));
  drawDeal(); update();
  return () => chart.destroy();
}
