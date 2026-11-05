// @ts-nocheck
/* Plain-English layer. Beginner mode shows a question, a few friendly inputs, one big answer,
   one chart and a short glossary. Everything else stays one click away in Pro mode. */
import { money, pct, nf } from '../lib/math';

export const TOPICS = {
  Foundations: { label: 'Money basics', tint: 'coral', blurb: 'Interest, savings and loans' },
  Valuation: { label: 'What things are worth', tint: 'lav', blurb: 'Bonds, stocks and companies' },
  'Corporate Finance': { label: 'Company decisions', tint: 'sun', blurb: 'Projects, funding and deals' },
  Investments: { label: 'Investing', tint: 'mint', blurb: 'Risk, return and portfolios' },
  Derivatives: { label: 'Options', tint: 'sky', blurb: 'Bets on future prices' },
  International: { label: 'Global money', tint: 'pink', blurb: 'Exchange rates' },
  Analysis: { label: 'Company health', tint: 'peach', blurb: 'Ratios and report cards' }
};

const cardBy = (o, label) => (o.cards || []).find(c => c.label === label);

export const BEGINNER = {
  tvm: {
    ask: 'How much will my savings grow?', intro: 'Start with some money, add a little each month, and watch time and interest do the heavy lifting.',
    simple: {
      fields: [
        { id: 'start', label: 'Money you start with', v: 1000, pre: '$', step: 100 },
        { id: 'monthly', label: 'Add every month', v: 100, pre: '$', step: 10, slider: [0, 1000, 10] },
        { id: 'rate', label: 'Yearly interest rate', v: 6, unit: '%', step: 0.25, slider: [0, 15, 0.25] },
        { id: 'years', label: 'For how many years', v: 10, unit: 'yrs', step: 1, slider: [1, 40, 1] }
      ],
      map: b => ({ solve: 'fv', pv: -b.start, pmt: -b.monthly, fv: 0, iy: b.rate, py: 12, n: b.years * 12, when: '0' }),
      plain: (b, o, k) => [`In ${b.years} years you'd have ${k.value}.`, `You put in ${money(b.start + b.monthly * 12 * b.years, 0)}. Interest earning interest did the rest.`]
    },
    words: [['Present value', 'What money is worth today.'], ['Future value', 'What it will be worth later.'], ['Compounding', 'Earning interest on your interest.']]
  },
  rates: {
    ask: 'What rate am I really earning?', essential: ['apr', 'm', 'years', 'p'],
    labels: { apr: 'Quoted yearly rate', m: 'Times interest is added per year', years: 'Years', p: 'Starting amount' },
    plain: (v, o, k) => [`A quoted ${nf(v.apr, 2)}% really pays ${k.value} a year.`, 'The more often interest is added, the more you earn, but the gains flatten quickly.'],
    words: [['APR', 'The headline rate before compounding.'], ['EAR', 'The rate you actually earn in a year.'], ['Real rate', 'Your rate after inflation.']]
  },
  annuity: {
    ask: 'What is a stream of payments worth today?', essential: ['c', 'r', 'n'],
    labels: { c: 'Payment each year', r: 'Return you could earn elsewhere', n: 'Number of payments' }, force: { g: 0, when: '0' },
    plain: (v, o, k) => [`Getting ${money(v.c, 0)} a year for ${v.n} years is worth ${k.value} today.`, 'Later payments count for less because you could have been earning interest on that money.'],
    words: [['Annuity', 'A series of equal payments.'], ['Discount rate', 'The return you give up by waiting.'], ['Perpetuity', 'Payments that never stop.']]
  },
  loan: {
    ask: 'What will my loan really cost?', essential: ['amt', 'apr', 'years', 'extra'],
    labels: { amt: 'Amount you borrow', apr: 'Yearly interest rate', years: 'Years to repay', extra: 'Extra you pay each month' }, force: { ppy: 12 },
    plain: (v, o, k) => [`You'd pay ${k.value} a month and ${cardBy(o, 'Total interest').value} in interest overall.`, 'Early payments are mostly interest. Paying extra early saves the most.'],
    words: [['Principal', 'The money you borrowed.'], ['Interest', 'The price of borrowing.'], ['Amortization', 'Paying a loan down over time.']]
  },
  bond: {
    ask: 'What is this bond worth?', essential: ['face', 'cr', 'ytm', 'yrs'],
    labels: { face: 'Value paid back at the end', cr: 'Yearly interest it pays', ytm: 'Return buyers want today', yrs: 'Years until it ends' }, force: { solve: 'price', m: '2' },
    plain: (v, o, k) => [`With buyers wanting ${nf(v.ytm, 2)}%, this bond is worth ${k.value}.`, 'When market rates rise, existing bonds lose value. Longer bonds move more.'],
    words: [['Coupon', 'The interest payment a bond makes.'], ['Yield', 'The return a buyer gets.'], ['Duration', 'How sensitive the price is to rates.']]
  },
  ddm: {
    ask: 'Is this stock worth its price?', essential: ['d0', 'ke', 'g', 'mkt'],
    labels: { d0: 'Dividend paid per share', ke: 'Return you want', g: 'Dividend growth per year', mkt: 'Price on the market' }, force: { model: 'gordon' },
    plain: (v, o, k) => [`Based on its dividends, a fair price is about ${k.value}.`, v.mkt > 0 ? `The market asks ${money(v.mkt)}, so the stock looks ${k.value && parseFloat(k.value.replace(/[^\d.]/g, '')) > v.mkt ? 'cheap' : 'expensive'} on this model.` : 'Add a market price to compare.'],
    words: [['Dividend', 'Cash a company pays shareholders.'], ['Required return', 'What you need to earn to hold the stock.'], ['Growth rate', 'How fast dividends increase.']]
  },
  dcf: {
    ask: 'What is the whole company worth?', essential: ['rev0', 'g1', 'margin', 'wacc', 'tg', 'netdebt', 'shares'],
    labels: { rev0: 'Sales today ($M)', g1: 'Sales growth next year', margin: 'Profit margin', wacc: 'Return investors want', tg: 'Long-run growth', netdebt: 'Debt minus cash ($M)', shares: 'Shares (millions)' }, force: { tmethod: 'gordon', fade: 'fade' },
    plain: (v, o, k) => [`This company is worth about ${k.value} per share.`, 'The value is the cash it will produce, shrunk back to today. Change the growth and see how touchy the answer is.'],
    words: [['Free cash flow', 'Cash left after running and investing.'], ['Terminal value', 'Everything after the forecast years.'], ['Net debt', 'Debt minus cash.']]
  },
  capbud: {
    ask: 'Should the company do this project?', essential: ['i0A', 'cfA', 'rate'],
    labels: { i0A: 'Cost today', cfA: 'Cash it brings in each year', rate: 'Return the company needs' }, force: { cfB: '' },
    plain: (v, o, k) => [k.tone === 'good' ? `Yes. It adds ${k.value} of value in today's money.` : `No. It loses ${k.value.replace('−', '')} of value in today's money.`, 'If the value added (NPV) is above zero, the project beats what investors could earn elsewhere.'],
    words: [['NPV', 'Value added in today\'s dollars.'], ['IRR', 'The project\'s own yearly return.'], ['Payback', 'Years to get your money back.']]
  },
  wacc: {
    ask: 'What return do investors expect from this company?', essential: ['rf', 'beta', 'erp', 'kd', 'tax', 'E', 'D'],
    labels: { rf: 'Safe return (government bonds)', beta: 'How jumpy is the stock? (1 = market)', erp: 'Extra return for stock risk', kd: 'Interest rate on its debt', tax: 'Tax rate', E: 'Value of its shares ($M)', D: 'Value of its debt ($M)' },
    plain: (v, o, k) => [`The company must earn about ${k.value} to keep investors happy.`, 'This blend of share and debt returns is the hurdle rate for new projects.'],
    words: [['WACC', 'The blended return lenders and owners expect.'], ['Beta', 'How much a stock swings vs the market.'], ['Equity', 'Money from shareholders.']]
  },
  capstruct: {
    ask: 'Does borrowing boost earnings per share?', essential: ['cap', 'ebit', 'dp', 'rate'],
    labels: { cap: 'Money to raise ($M)', ebit: 'Yearly operating profit ($M)', dp: 'Share raised by borrowing', rate: 'Interest rate on the loan' },
    plain: (v, o, k) => [`With ${nf(v.dp, 0)}% debt, profit per share goes from ${k.value} to ${cardBy(o, `EPS: ${nf(v.dp, 0)}% debt`).value}.`, 'Debt boosts profit per share in good years and hurts it in bad ones.'],
    words: [['EPS', 'Profit per share.'], ['Leverage', 'Using borrowed money.'], ['EBIT', 'Operating profit before interest and tax.']]
  },
  breakeven: {
    ask: 'How many do I need to sell to break even?', essential: ['p', 'vc', 'fc', 'q'],
    labels: { p: 'Selling price each', vc: 'Cost to make each', fc: 'Fixed costs (rent, salaries)', q: 'How many you expect to sell' },
    plain: (v, o, k) => [`You need to sell ${k.value.replace(' units', '')} units before you make a profit.`, `At ${nf(v.q, 0)} units you'd make ${cardBy(o, 'Operating profit at expected sales').value}.`],
    words: [['Fixed cost', 'Bills that do not change with sales.'], ['Variable cost', 'Cost that grows with each unit.'], ['Contribution', 'Price minus variable cost.']]
  },
  wc: {
    ask: 'How long is our cash stuck in the business?', essential: ['sales', 'cogs', 'inv', 'ar', 'ap'],
    labels: { sales: 'Yearly sales', cogs: 'Yearly cost of goods', inv: 'Stock sitting in warehouse', ar: 'Money customers owe', ap: 'Money we owe suppliers' },
    plain: (v, o, k) => [`Cash is tied up for about ${k.value}.`, 'That is the gap between paying suppliers and getting paid. Shorter is better.'],
    words: [['Inventory', 'Goods waiting to be sold.'], ['Receivables', 'Money customers owe you.'], ['Payables', 'Money you owe suppliers.']]
  },
  capm: {
    ask: 'What return should this investment offer?', essential: ['rf', 'rm', 'beta', 'er'],
    labels: { rf: 'Safe return', rm: 'Expected stock-market return', beta: 'How jumpy vs the market (1 = same)', er: 'Return you expect from it' },
    plain: (v, o, k) => [`For its risk it should return ${k.value}.`, `You expect ${nf(v.er, 1)}%, so it looks ${v.er / 100 >= parseFloat(k.value) / 100 ? 'worth it' : 'too low for the risk'}.`],
    words: [['Beta', 'Sensitivity to the market.'], ['Alpha', 'Return above what risk justifies.'], ['Sharpe ratio', 'Return per unit of risk.']]
  },
  portfolio: {
    ask: 'Does mixing two investments reduce risk?', essential: ['muA', 'sdA', 'muB', 'sdB', 'rho', 'wA'],
    labels: { muA: 'Investment A: expected return', sdA: 'Investment A: risk', muB: 'Investment B: expected return', sdB: 'Investment B: risk', rho: 'Do they move together? (−1 to 1)', wA: 'Share put in A' },
    plain: (v, o, k) => [`This mix earns ${k.value} with risk of ${o.cards[1].value}.`, `Mixing cut risk by ${o.cards[2].value} compared with a simple average. That is diversification.`],
    words: [['Diversification', 'Spreading money to lower risk.'], ['Correlation', 'How much two things move together.'], ['Volatility', 'How much returns bounce around.']]
  },
  returns: {
    ask: 'How did my investment really perform?', essential: ['rets', 'start'],
    labels: { rets: 'Return each year (%)', start: 'Money you started with' },
    plain: (v, o, k) => [`You really grew ${k.value} per period.`, `That is lower than the simple average of ${o.cards[1].value} because losses hurt more than gains help.`],
    words: [['Geometric mean', 'The compounded average.'], ['Drawdown', 'A fall from a previous peak.'], ['Volatility', 'How bumpy the ride was.']]
  },
  options: {
    ask: 'What is this option worth?', essential: ['S', 'K', 'T', 'vol'],
    labels: { S: 'Stock price today', K: 'Price you can buy or sell at', T: 'Years until it expires', vol: 'How jumpy the stock is' }, force: { pos: 'lc' },
    plain: (v, o, k) => [`The right to buy at ${money(v.K, 0)} is worth ${k.value}. The right to sell is worth ${o.cards[1].value}.`, 'Options cost more when the stock is jumpier or there is more time left.'],
    words: [['Call', 'The right to buy at a set price.'], ['Put', 'The right to sell at a set price.'], ['Strike', 'The set price in the contract.']]
  },
  ratios: {
    ask: 'How healthy is this company?', essential: ['rev', 'cogs', 'opex', 'int', 'cash', 'ar', 'inv', 'nfa', 'cl', 'ltd'],
    labels: { rev: 'Sales', cogs: 'Cost of goods', opex: 'Other running costs', int: 'Interest paid', cash: 'Cash', ar: 'Money owed by customers', inv: 'Inventory', nfa: 'Buildings and equipment', cl: 'Bills due within a year', ltd: 'Long-term debt' },
    plain: (v, o, k) => [`The company earns ${k.value} a year on its owners' money.`, 'That return comes from profit margin, how hard assets work, and how much it borrows.'],
    words: [['ROE', 'Profit per dollar of owner money.'], ['Liquidity', 'Ability to pay near-term bills.'], ['DuPont', 'Splitting ROE into its causes.']]
  },
  fx: {
    ask: 'What will the exchange rate be?', essential: ['S', 'id', 'if', 'T'],
    labels: { S: 'Rate today (home per 1 foreign)', id: 'Home interest rate', if: 'Foreign interest rate', T: 'Years ahead' }, force: { Fm: 0 },
    plain: (v, o, k) => [`A fair rate to lock in for ${nf(v.T, 2)} years is ${k.value}.`, 'Currencies with higher interest rates trade at a discount in the future.'],
    words: [['Spot rate', 'Today\'s exchange rate.'], ['Forward rate', 'A rate agreed today for later.'], ['Parity', 'No free-money gap between markets.']]
  },
  merger: {
    ask: 'Will this takeover help earnings per share?', essential: ['prem', 'stock', 'syn'],
    labels: { prem: 'Extra paid over the market price', stock: 'Share paid in new stock', syn: 'Yearly cost savings ($M)' },
    plain: (v, o, k) => [`${k.label.startsWith('EPS acc') ? 'Earnings per share rise' : 'Earnings per share fall'} ${k.value.replace(/[+−-]/, '')}.`, `The deal needs ${cardBy(o, 'Break-even synergies').value} of yearly savings to leave earnings unchanged.`],
    words: [['Accretive', 'Raises earnings per share.'], ['Dilutive', 'Lowers earnings per share.'], ['Synergies', 'Savings from combining firms.']]
  }
};

/** Key result card of an output. */
export const keyCard = o => (o.cards || []).find(c => c.key) || (o.cards || []).find(c => !c.head) || { label: '', value: '—' };
