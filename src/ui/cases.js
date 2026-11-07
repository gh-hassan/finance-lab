// @ts-nocheck
/* Case studies: short business situations that chain several calculators. Each step opens a calculator with the case's numbers filled in. */
import { h } from './visuals.js';
import { sharePath } from './sharing.js';

const open = (id, state, label) => ({ id, state, label });
export const CASES = [
  {
    id: 'oven', tag: 'Company decisions', title: 'The café oven', level: 'Starter',
    story: 'Maple Café is choosing between two ovens. Oven A is a standard model that pays back quickly. Oven B costs the same, but it only pays off in year five when a big catering contract starts. The owner\'s hurdle rate is 9%.',
    steps: [
      ['Open Capital Budgeting and read the NPV, IRR and payback of each oven.', open('capbud', { rate: 9, rr: 9, i0A: 18000, cfA: '5000, 6000, 6500, 6500, 6000', i0B: 18000, cfB: '0, 0, 0, 0, 32000' }, 'Open the oven numbers')],
      ['The NPV and IRR may rank the ovens differently. Which should the owner follow, and why?', null],
      ['Raise the hurdle rate to 14% in the calculator. Which oven does the ranking favour now?', null],
      ['Stress the choice in Scenarios: what if the catering contract is worth only half as much?', open('capbud', { rate: 9, rr: 9, i0A: 18000, cfA: '5000, 6000, 6500, 6500, 6000', i0B: 18000, cfB: '0, 0, 0, 0, 16000' }, 'Try the half-value contract')]
    ],
    think: 'When projects differ in size or timing, NPV measures value added in dollars. IRR is a rate, and it can hide a bigger project that adds more money.'
  },
  {
    id: 'home', tag: 'Money basics', title: 'Buying a home', level: 'Starter',
    story: 'Priya is buying a flat for $420,000 with a mortgage at 6.8%. She can take a 30-year or a 15-year loan, and she may pay extra each month.',
    steps: [
      ['Open the Loan calculator and note the monthly payment and total interest on the 30-year loan.', open('loan', { amt: 420000, apr: 6.8, years: 30, ppy: 12, extra: 0 }, 'Open the 30-year loan')],
      ['Switch to 15 years. How much more is the payment, and how much interest does she save?', open('loan', { amt: 420000, apr: 6.8, years: 15, ppy: 12, extra: 0 }, 'Open the 15-year loan')],
      ['Back on 30 years, add $300 a month in extra payments. When is the loan paid off?', open('loan', { amt: 420000, apr: 6.8, years: 30, ppy: 12, extra: 300 }, 'Try $300 extra a month')],
      ['Use Compare to put two loan versions side by side and see which wins on each measure.', null]
    ],
    link: ['/compare', 'Open Compare'],
    think: 'A shorter loan costs more each month but far less in interest. Extra payments act like a shorter loan without the commitment.'
  },
  {
    id: 'techco', tag: 'What things are worth', title: 'Is TechCo overpriced?', level: 'Intermediate',
    story: 'TechCo trades at $38 a share. It has 180 million shares, $600M of net debt, $2.4B of sales growing about 15%, and a 22% operating margin. Peers trade at around 10× EBITDA and 19× earnings.',
    steps: [
      ['Value it with a discounted cash flow at a 9.5% discount rate and 3% long-run growth.', open('dcf', { rev0: 2400, g1: 15, margin: 22, wacc: 9.5, tg: 3, netdebt: 600, shares: 180 }, 'Open the DCF')],
      ['Cross-check with comparable companies using the peer multiples.', open('comps', { ebitda: 520, ni: 260, rev: 2400, book: 900, debt: 600, sh: 180, px: 38 }, 'Open the comps')],
      ['Do the two methods agree? If not, which assumption is doing the most work?', null],
      ['In the DCF, lower the long-run growth to 2% and the discount rate to 10.5%. How much does the value move?', open('dcf', { rev0: 2400, g1: 15, margin: 22, wacc: 10.5, tg: 2, netdebt: 600, shares: 180 }, 'Open the tougher case')]
    ],
    think: 'Valuation is a range, not a point. The terminal value drives most of a DCF, which is why the comps check matters.'
  },
  {
    id: 'buyout', tag: 'Company decisions', title: 'The buyout', level: 'Advanced',
    story: 'A fund is buying a packaging company with $80M of EBITDA for 9× earnings, using 5.5× of debt at 9%. It plans to hold for five years and sell at the same multiple. Growth is expected at 4% a year.',
    steps: [
      ['Run the base case. What return does the fund earn, and how much of the gain comes from debt paydown?', open('lbo', { ebitda: 80, entry: 9, debtX: 5.5, fee: 2, rate: 9, g: 4, capex: 20, tax: 25, exit: 9, yrs: 5 }, 'Open the base case')],
      ['Now suppose growth is 0% and the sale multiple falls to 7×. What happens to the return?', open('lbo', { ebitda: 80, entry: 9, debtX: 5.5, fee: 2, rate: 9, g: 0, capex: 20, tax: 25, exit: 7, yrs: 5 }, 'Open the downside')],
      ['Cut the debt to 3.5×. Is the return lower in the base case? Is the downside safer?', open('lbo', { ebitda: 80, entry: 9, debtX: 3.5, fee: 2, rate: 9, g: 4, capex: 20, tax: 25, exit: 9, yrs: 5 }, 'Open lower debt')],
      ['Link to theory: how does extra debt change risk and return for the equity holders?', open('capstruct', { cap: 720, ebit: 150, tax: 25, price: 20, rate: 9, dp: 70, ku: 10 }, 'Open Capital Structure')]
    ],
    think: 'Leverage magnifies both the good and the bad. The downside case shows why lenders and funds care about how much debt a business can carry.'
  },
  {
    id: 'trucks', tag: 'Company decisions', title: 'Lease or buy the trucks', level: 'Intermediate',
    story: 'A logistics firm needs a $240,000 truck that will be worth about $40,000 after five years. The tax rate is 30% and its after-tax borrowing cost is 6%. A lessor offers $52,000 a year for five years.',
    steps: [
      ['Open Lease vs Buy with MACRS 5-year depreciation. Does leasing or buying come out ahead?', open('lease', { cost: 240000, salv: 40000, life: 5, method: 'macrs5', tax: 30, rate: 6, pay: 52000, term: 5 }, 'Open with MACRS')],
      ['Change to straight-line depreciation. How much does the answer move, and why?', open('lease', { cost: 240000, salv: 40000, life: 5, method: 'sl', tax: 30, rate: 6, pay: 52000, term: 5 }, 'Open with straight line')],
      ['Find the lease payment that makes the firm indifferent. How does it compare to the offer?', null]
    ],
    think: 'Faster depreciation moves tax savings earlier, which raises the value of owning. The break-even payment gives a fair negotiating target.'
  },
  {
    id: 'retire60', tag: 'Money basics', title: 'Retire at 60?', level: 'Starter',
    story: 'Sam is 40, has $180,000 saved, adds $18,000 a year (rising 3%), and wants $70,000 a year in today\'s money from age 60 to 90. Savings earn 6% before retiring and 4% after. Inflation is 2.5%.',
    steps: [
      ['Open the planner. Is Sam on track to retire at 60? How large is the gap?', open('retire', { age: 40, ret: 60, live: 90, saved: 180000, add: 18000, ag: 3, pre: 6, post: 4, inf: 2.5, inc: 70000 }, 'Open the plan')],
      ['Move the retirement age to 65. How does the gap change, and why is it so large?', open('retire', { age: 40, ret: 65, live: 90, saved: 180000, add: 18000, ag: 3, pre: 6, post: 4, inf: 2.5, inc: 70000 }, 'Retire at 65 instead')],
      ['Back at 60, how much extra must Sam save each year to close the gap?', null]
    ],
    think: 'Five more working years do three things at once: more contributions, more growth, and fewer years to fund. That is why retirement age has such a big effect.'
  }
];

export function renderCases(main) {
  const list = h('div', { class: 'case-list' }, CASES.map(c => h('article', { class: 'card case', id: 'case-' + c.id },
    h('header', {}, h('p', { class: 'eyebrow' }, `${c.tag} · ${c.level}`), h('h2', {}, c.title)),
    h('p', { class: 'case-story' }, c.story),
    h('ol', { class: 'case-steps' }, c.steps.map(([text, go]) => h('li', {}, h('span', {}, text), go ? h('a', { class: 'btn small', href: sharePath(go.id, go.state), 'data-link': true }, go.label + ' →') : null))),
    c.link ? h('a', { class: 'btn small', href: c.link[0], 'data-link': true }, c.link[1] + ' →') : null,
    h('details', { class: 'case-think' }, h('summary', {}, 'The idea behind it'), h('p', {}, c.think)))));
  main.innerHTML = '';
  main.append(h('header', { class: 'learn-hero reveal' }, h('p', { class: 'eyebrow' }, 'Put it to work'), h('h1', { html: 'Real-world <em>cases</em>' }), h('p', { class: 'lead' }, 'Short situations from business and everyday life. Follow the steps and each calculator opens with the numbers already in, in Pro mode so every input is visible. Switch back any time.')), list);
  return () => { };
}
