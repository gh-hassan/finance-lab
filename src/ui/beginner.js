// @ts-nocheck
/* Plain-English layer. Beginner mode shows a question, a few friendly inputs with a one-line tip each,
   one big answer, a concept animation driven by your numbers, and a few new words explained simply. */
import { money, nf, parseList, bs } from '../lib/math';

export const TOPICS = {
  Foundations: { label: 'Money basics', tint: 'coral', blurb: 'Interest, savings and loans' },
  Valuation: { label: 'What things are worth', tint: 'lav', blurb: 'Bonds, stocks and companies' },
  'Corporate Finance': { label: 'Company decisions', tint: 'sun', blurb: 'Projects, funding and deals' },
  Investments: { label: 'Investing', tint: 'mint', blurb: 'Risk, return and portfolios' },
  Derivatives: { label: 'Options', tint: 'sky', blurb: 'Tickets on future prices' },
  International: { label: 'Global money', tint: 'pink', blurb: 'Exchange rates' },
  Analysis: { label: 'Company health', tint: 'peach', blurb: 'Report cards for companies' }
};

const cardBy = (o, label) => (o.cards || []).find(c => c.label === label) || { value: '—' };
export const keyCard = o => (o.cards || []).find(c => c.key) || (o.cards || []).find(c => !c.head) || { label: '', value: '—' };
const rows = (n, f) => Array.from({ length: n }, (_, k) => f(k));

export const BEGINNER = {
  tvm: {
    ask: 'How much will my savings grow?', intro: 'Start with some money, add a little each month, and watch time and interest do the heavy lifting.',
    simple: {
      fields: [
        { id: 'start', label: 'Money you start with', v: 1000, pre: '$', step: 100, tip: 'What you put in the bank on day one.' },
        { id: 'monthly', label: 'Add every month', v: 100, pre: '$', step: 10, slider: [0, 1000, 10], tip: 'A small amount you add each month.' },
        { id: 'rate', label: 'Yearly interest rate', v: 6, unit: '%', step: 0.25, slider: [0, 15, 0.25], tip: 'What the bank pays you each year, as a percent.' },
        { id: 'years', label: 'For how many years', v: 10, unit: 'yrs', step: 1, slider: [1, 40, 1], tip: 'How long you leave the money alone.' }
      ],
      map: b => ({ solve: 'fv', pv: -b.start, pmt: -b.monthly, fv: 0, iy: b.rate, py: 12, n: b.years * 12, when: '0' }),
      plain: (b, o, k) => [`In ${b.years} years you'd have ${k.value}.`, `You put in ${money(b.start + b.monthly * 12 * b.years, 0)}. The rest is free money from interest.`]
    },
    scene: { id: 'growth', map: b => ({ start: b.start, add: b.monthly * 12, rate: b.rate, years: b.years, mpy: 12 }) },
    easy: [['Future value', 'Money you will have', 'At the end of your plan'], ['Rate per period', 'Interest added each month', 'The yearly rate split into 12 parts'], ['Effective annual rate', 'What you really earn in a year', 'A little more than the quoted rate, because interest earns interest'], ['Interest earned', 'Free money from interest', 'What your money made while you waited']],
    words: [['Present value', 'What money is worth today.'], ['Future value', 'What it will be worth later.'], ['Compounding', 'Earning interest on your interest.']]
  },
  rates: {
    ask: 'What rate am I really earning?', essential: ['apr', 'm', 'years', 'p'],
    labels: { apr: 'Quoted yearly rate', m: 'Times interest is added per year', years: 'Years', p: 'Starting amount' },
    tips: { apr: 'The headline rate the bank advertises.', m: '12 means every month, 365 means every day.', years: 'How long the money stays invested.', p: 'The money you start with.' },
    scene: { id: 'snowball', map: v => ({ start: v.p, rate: v.apr, years: v.years, m: v.m }) },
    easy: [['Effective annual rate', 'What you really earn per year', 'The honest rate, after interest earns interest'], ['Rate per period', 'Interest added each time', 'Quoted rate divided by times per year'], ['Continuous compounding', 'If interest were added non-stop', 'The most this rate could ever give'], ['Real rate (Fisher)', 'What you keep after prices rise', 'Your return minus inflation']],
    plain: (v, o, k) => [`A quoted ${nf(v.apr, 2)}% really pays ${k.value} a year.`, 'The more often interest is added, the more you earn. But the gains flatten quickly.'],
    words: [['APR', 'The headline rate, before interest earns interest.'], ['Real rate', 'Your return after prices rise (inflation).'], ['Compounding', 'Interest that earns interest.']]
  },
  annuity: {
    ask: 'What is a stream of payments worth today?', essential: ['c', 'r', 'n'],
    labels: { c: 'Payment each year', r: 'Return you could earn elsewhere', n: 'How many payments' }, force: { g: 0, when: '0' },
    tips: { c: 'The amount you receive every year.', r: 'What you could earn on the money if you had it now. Higher means later money is worth less.', n: 'How many years the payments last.' },
    scene: { id: 'present', map: (v, o) => ({ flows: rows(Math.min(40, Math.max(1, Math.round(v.n))), k => ({ y: k + 1, a: v.c })), rate: v.r, years: v.n, result: keyCard(o).value }) },
    easy: [['Present value', 'What all the payments are worth today', 'Added up after shrinking each one'], ['Future value at the end', 'Pile you would have at the end', 'If you saved every payment'], ['Perpetuity value', 'If the payments never stopped', 'What that endless stream is worth today'], ['Sum of payments', 'Payments added up on paper', 'Before shrinking to today\'s value']],
    plain: (v, o, k) => [`Getting ${money(v.c, 0)} a year for ${v.n} years is worth ${k.value} today.`, 'Later payments count for less, because you could have been earning interest on that money.'],
    words: [['Annuity', 'A series of equal payments.'], ['Discount rate', 'How fast future money shrinks when brought to today.'], ['Perpetuity', 'Payments that go on forever.']]
  },
  loan: {
    ask: 'What will my loan really cost?', essential: ['amt', 'apr', 'years', 'extra'],
    labels: { amt: 'Amount you borrow', apr: 'Yearly interest rate', years: 'Years to repay', extra: 'Extra you pay each month' }, force: { ppy: 12 },
    tips: { amt: 'How much money the bank lends you.', apr: 'The bank\'s yearly fee, as a percent of what you owe.', years: 'How long you have to pay it all back.', extra: 'Optional. Even a small extra amount saves a lot of fees.' },
    scene: { id: 'loan', map: v => ({ amt: v.amt, apr: v.apr, years: v.years, extra: v.extra }) },
    easy: [['Payment each period', 'Your monthly payment', 'Fixed for the life of the loan'], ['Total interest', 'Total fees to the bank', 'The price of borrowing'], ['Total paid', 'Total you will pay back', 'The loan plus all the fees'], ['Time to pay off', 'Time until you are debt-free', ''], ['Interest saved', 'Fees you save', 'By paying extra']],
    plain: (v, o, k) => [`You'd pay ${k.value} a month and ${cardBy(o, 'Total interest').value} in fees overall.`, 'Early payments are mostly fees. Paying extra early saves the most.'],
    words: [['Principal', 'The money you borrowed.'], ['Interest', 'The fee for borrowing.'], ['Amortization', 'Paying a loan off in small pieces.']]
  },
  bond: {
    ask: 'What is this bond worth?', essential: ['face', 'cr', 'ytm', 'yrs'],
    labels: { face: 'Money paid back at the end', cr: 'Yearly payment rate', ytm: 'Return buyers want today', yrs: 'Years until it ends' }, force: { solve: 'price', m: '2' },
    tips: { face: 'What you lend, and what you get back at the end.', cr: 'The yearly payment the bond makes, as a percent of the amount.', ytm: 'What other investments pay today. If it is higher than the bond pays, the bond is worth less.', yrs: 'How long until you get your money back.' },
    scene: { id: 'bond', map: (v, o) => ({ face: v.face, cr: v.cr, years: Math.max(2, Math.min(10, Math.round(v.yrs))), result: keyCard(o).value }) },
    easy: [['Bond price', 'What the bond is worth today', 'What a buyer would pay'], ['Yield to maturity', 'Your yearly return if you hold it', 'Counting every payment you get'], ['Current yield', 'Yearly payment as % of price', 'Ignores the money back at the end'], ['Macaulay duration', 'Average wait for your money', 'In years. Longer means more sensitive to rates.']],
    plain: (v, o, k) => [`With buyers wanting ${nf(v.ytm, 2)}%, this bond is worth ${k.value}.`, 'When market rates rise, existing bonds lose value. Longer bonds move more.'],
    words: [['Coupon', 'The yearly payment a bond makes.'], ['Yield', 'The return a buyer gets.'], ['Maturity', 'The day you get your money back.']]
  },
  ddm: {
    ask: 'Is this stock worth its price?', essential: ['d0', 'ke', 'g', 'mkt'],
    labels: { d0: 'Yearly payout per share', ke: 'Return you want', g: 'Payout growth per year', mkt: 'Price on the market' }, force: { model: 'gordon' },
    tips: { d0: 'Cash the company paid out per share last year (the dividend).', ke: 'The yearly return you need to be happy owning the stock.', g: 'How fast you expect the payout to grow. Keep it below the return you want.', mkt: 'What the stock costs right now. Used to compare.' },
    scene: { id: 'present', map: (v, o) => ({ flows: rows(10, k => ({ y: k + 1, a: v.d0 * Math.pow(1 + v.g / 100, k + 1) })), rate: v.ke, years: 10 }) },
    easy: [['Intrinsic value per share', 'Fair price of one share', 'From its payouts'], ['Dividend yield', 'Yearly payout as % of price', 'Cash you get just for owning it'], ['Value if no growth', 'Worth if it never grew', 'What the company is worth standing still'], ['Growth opportunities (PVGO)', 'Part of the price for future growth', 'Only pays off if growth happens'], ['Versus market price', 'Fair price vs market', 'Plus means cheap, minus means expensive']],
    plain: (v, o, k) => [`Based on its payouts, a fair price is about ${k.value}.`, v.mkt > 0 ? `The market asks ${money(v.mkt)}, so the stock looks ${parseFloat(k.value.replace(/[^\d.]/g, '')) > v.mkt ? 'cheap' : 'expensive'} on this model.` : 'Type a market price to compare.'],
    words: [['Dividend', 'Cash a company pays its owners.'], ['Required return', 'What you need to earn to hold the stock.'], ['Growth rate', 'How fast the payout increases.']]
  },
  dcf: {
    ask: 'What is the whole company worth?', essential: ['rev0', 'g1', 'margin', 'wacc', 'tg', 'netdebt', 'shares'],
    labels: { rev0: 'Sales this year ($M)', g1: 'Sales growth next year', margin: 'Profit on each sale', wacc: 'Return investors want', tg: 'Long-run growth', netdebt: 'Debt minus cash ($M)', shares: 'Number of shares (millions)' }, force: { tmethod: 'gordon', fade: 'fade' },
    tips: { rev0: 'How much the company sells in a year, in millions.', g1: 'How fast sales grow next year. It slows down over time.', margin: 'Operating profit as a percent of sales.', wacc: 'The yearly return investors expect from this company.', tg: 'How fast the company can grow forever, usually 2 to 3%.', netdebt: 'What it owes minus the cash it has. Taken off the value.', shares: 'How many shares exist, in millions.' },
    scene: { id: 'present', map: (v, o) => ({ flows: ((o.charts && o.charts[0] && o.charts[0].series[0].pts) || []).map(p => ({ y: p[0], a: Math.max(0, p[1]) })), rate: v.wacc, years: v.years }) },
    easy: [['Value per share', 'Fair price of one share', 'Value of the company ÷ shares'], ['Enterprise value', 'Value of the whole business', 'Before taking off debt'], ['Equity value', 'Value left for the owners', 'After paying off debt'], ['Implied exit multiple', 'Years of profit the end value equals', 'A quick sanity check']],
    plain: (v, o, k) => [`This company is worth about ${k.value} per share.`, 'Its value is all the cash it will produce, shrunk back to today. Change the growth and see how touchy the answer is.'],
    words: [['Free cash flow', 'Cash left after running the business.'], ['Terminal value', 'Everything the company earns after the forecast years.'], ['Net debt', 'What it owes minus the cash it has.']]
  },
  capbud: {
    ask: 'Should the company do this project?', essential: ['i0A', 'cfA', 'rate'],
    labels: { i0A: 'Cost today', cfA: 'Money it brings in each year', rate: 'Return the company needs' }, force: { cfB: '' },
    tips: { i0A: 'What the project costs right now.', cfA: 'List what you get in years 1, 2, 3... separated by commas.', rate: 'What the company could earn elsewhere. The project must beat this.' },
    scene: { id: 'npv', map: v => ({ cost: v.i0A, flows: parseList(v.cfA), rate: v.rate }) },
    easy: [['NPV', 'Value the project adds', 'In today\'s money'], ['IRR', 'The project\'s own yearly return', 'Should beat the return you need'], ['MIRR', 'A steadier yearly return', 'Assumes profits are reinvested'], ['Profitability index', 'Value for each dollar spent', 'Above 1 means worth it']],
    plain: (v, o, k) => [k.tone === 'good' ? `Yes. It adds ${k.value} of value in today's money.` : `No. It loses ${k.value.replace('−', '')} of value in today's money.`, 'If the value added is above zero, the project beats what you could earn elsewhere.'],
    words: [['NPV', 'Value added, measured in today\'s money.'], ['IRR', 'The project\'s own yearly return.'], ['Payback', 'How long to get your money back.']]
  },
  wacc: {
    ask: 'What return do investors expect from this company?', essential: ['rf', 'beta', 'erp', 'kd', 'tax', 'E', 'D'],
    labels: { rf: 'Safe return', beta: 'How jumpy is the stock?', erp: 'Extra return for stock risk', kd: 'Interest rate on its debt', tax: 'Tax rate', E: 'Value of its shares ($M)', D: 'Value of its debt ($M)' },
    tips: { rf: 'What a government bond pays. The no-risk return.', beta: '1 moves like the market. 2 jumps twice as much. 0.5 is calmer.', erp: 'How much more stocks pay than safe bonds, on average.', kd: 'What the company pays on its loans.', tax: 'Interest is tax-deductible, so debt costs less after tax.', E: 'What all its shares are worth together.', D: 'How much it owes lenders.' },
    scene: { id: 'blend', map: v => ({ wE: Math.round(v.E / (v.E + v.D) * 100), ke: +(v.rf + v.beta * v.erp).toFixed(2), kd: +(v.kd * (1 - v.tax / 100)).toFixed(2) }) },
    easy: [['WACC', 'Return investors expect overall', 'The average of what owners and lenders want'], ['Cost of equity (CAPM)', 'Return shareholders want', 'Safe return plus a reward for risk'], ['After-tax cost of debt', 'Real cost of borrowing', 'Cheaper, because interest cuts taxes'], ['Weights', 'Split: owners / lenders', 'Share of money from each']],
    plain: (v, o, k) => [`The company must earn about ${k.value} to keep investors happy.`, 'This blend of what owners and lenders want is the minimum return for any new project.'],
    words: [['WACC', 'The average return lenders and owners expect.'], ['Beta', 'How jumpy a stock is versus the market.'], ['Equity', 'Money from the owners.']]
  },
  capstruct: {
    ask: 'Does borrowing boost profit per share?', essential: ['cap', 'ebit', 'dp', 'rate'],
    labels: { cap: 'Money to raise ($M)', ebit: 'Yearly operating profit ($M)', dp: 'Share raised by borrowing', rate: 'Interest rate on the loan' },
    tips: { cap: 'How much money the company needs.', ebit: 'Profit from running the business, before interest and tax.', dp: 'The rest comes from selling new shares.', rate: 'What the lender charges each year.' },
    scene: { id: 'leverage', map: v => ({ debt: v.dp, change: v.ebit / v.cap * 100, rate: v.rate }) },
    easy: [['EPS: all equity', 'Profit per share, no borrowing', 'Money all from owners'], ['EPS:', 'Profit per share, with borrowing', 'Fewer shares, but interest to pay'], ['Indifference EBIT', 'Profit where both plans tie', 'Above this, borrowing wins'], ['Degree of financial leverage', 'How much borrowing magnifies swings', 'Higher means riskier']],
    plain: (v, o, k) => [`With ${nf(v.dp, 0)}% borrowed, profit per share goes from ${k.value} to ${(o.cards.find(c => c.label.startsWith('EPS: ') && !c.key) || { value: '—' }).value}.`, 'Borrowing boosts profit per share in good years and hurts it in bad ones.'],
    words: [['EPS', 'Earnings (profit) per share.'], ['Leverage', 'Using borrowed money.'], ['EBIT', 'Profit before interest and tax.']]
  },
  breakeven: {
    ask: 'How many do I need to sell to break even?', essential: ['p', 'vc', 'fc', 'q'],
    labels: { p: 'Selling price each', vc: 'Cost to make each', fc: 'Fixed bills (rent, salaries)', q: 'How many you expect to sell' },
    tips: { p: 'What one customer pays.', vc: 'Ingredients or parts for one item.', fc: 'Bills you pay even if you sell nothing.', q: 'Your sales guess for the period.' },
    scene: { id: 'breakeven', map: v => ({ price: v.p, cost: v.vc, fixed: v.fc }) },
    easy: [['Break-even volume', 'How many to sell to break even', 'After that you make profit'], ['Contribution per unit', 'Profit per item before rent', 'Price minus its own cost'], ['Operating profit at expected sales', 'Profit at your expected sales', 'Negative means a loss'], ['Margin of safety', 'How far sales can fall', 'Before you start losing money']],
    plain: (v, o, k) => [`You need to sell ${k.value.replace(' units', '')} before you make a profit.`, `At ${nf(v.q, 0)} sold, you'd make ${cardBy(o, 'Operating profit at expected sales').value}.`],
    words: [['Fixed cost', 'A bill that does not change with sales.'], ['Variable cost', 'A cost that grows with each item.'], ['Break-even', 'Where you stop losing money.']]
  },
  wc: {
    ask: 'How long is our cash stuck in the business?', essential: ['sales', 'cogs', 'inv', 'ar', 'ap'],
    labels: { sales: 'Yearly sales', cogs: 'Yearly cost of goods sold', inv: 'Goods sitting in storage', ar: 'Money customers owe you', ap: 'Money you owe suppliers' },
    tips: { sales: 'Total sold in a year.', cogs: 'What the goods you sold cost you.', inv: 'Value of goods not yet sold.', ar: 'Sold, but not yet paid for.', ap: 'Bought, but not yet paid for.' },
    scene: { id: 'cycle', map: v => ({ dio: Math.max(1, Math.round(v.inv / v.cogs * 365)), dso: Math.max(1, Math.round(v.ar / v.sales * 365)), dpo: Math.max(1, Math.round(v.ap / v.cogs * 365)) }) },
    easy: [['Cash conversion cycle', 'Days your cash is stuck', 'Shorter is better'], ['Days inventory (DIO)', 'Days goods sit unsold', ''], ['Days sales outstanding', 'Days customers take to pay', ''], ['Days payables (DPO)', 'Days you take to pay suppliers', 'Longer helps your cash']],
    plain: (v, o, k) => [`Cash is stuck for about ${k.value}.`, 'That is the gap between paying suppliers and getting paid. Shorter is better.'],
    words: [['Inventory', 'Goods waiting to be sold.'], ['Receivables', 'Money customers still owe you.'], ['Payables', 'Money you still owe suppliers.']]
  },
  capm: {
    ask: 'What return should this investment offer?', essential: ['rf', 'rm', 'beta', 'er'],
    labels: { rf: 'Safe return', rm: 'Expected stock-market return', beta: 'How jumpy vs the market', er: 'Return you expect from it' },
    tips: { rf: 'What a government bond pays.', rm: 'What stocks overall are expected to return.', beta: '1 moves like the market, 2 jumps twice as much, 0.5 is calmer.', er: 'What you hope this investment earns.' },
    scene: { id: 'beta', map: v => ({ beta: v.beta }) },
    easy: [['Required return (CAPM)', 'Return it should give you', 'For the risk you take'], ["Jensen's alpha", 'Extra return beyond the risk', 'Positive means a good deal'], ['Sharpe ratio', 'Reward for each bit of risk', 'Higher is better'], ['Treynor ratio', 'Reward per unit of market risk', '']],
    plain: (v, o, k) => [`For its risk, it should return ${k.value}.`, `You expect ${nf(v.er, 1)}%, so it looks ${v.er >= parseFloat(k.value) ? 'worth it' : 'too low for the risk'}.`],
    words: [['Beta', 'How much a stock moves compared with the market.'], ['Alpha', 'Return above what the risk justifies.'], ['Sharpe ratio', 'Return for each unit of risk.']]
  },
  portfolio: {
    ask: 'Does mixing two investments reduce risk?', essential: ['muA', 'sdA', 'muB', 'sdB', 'rho', 'wA'],
    labels: { muA: 'Investment A: expected return', sdA: 'Investment A: how bumpy', muB: 'Investment B: expected return', sdB: 'Investment B: how bumpy', rho: 'Do they move together? (−1 to 1)', wA: 'Share of your money in A' },
    tips: { muA: 'Average yearly return you expect.', sdA: 'How much the return jumps around. Bigger is riskier.', muB: 'Average yearly return you expect.', sdB: 'How much the return jumps around.', rho: '1 = move together, 0 = unrelated, −1 = opposite. Lower mixes better.', wA: 'The rest goes into B.' },
    scene: { id: 'mix2', map: v => ({ rho: v.rho, wA: v.wA, sdA: v.sdA, sdB: v.sdB }) },
    easy: [['Portfolio expected return', 'Your expected return', 'The mix of A and B'], ['Portfolio risk (σ)', 'Your risk (how bumpy)', 'Lower is calmer'], ['Diversification benefit', 'Risk removed by mixing', 'Compared with a simple average'], ['Sharpe ratio', 'Reward for each bit of risk', 'Higher is better']],
    plain: (v, o, k) => [`This mix earns about ${k.value} with risk of ${o.cards[1].value}.`, `Mixing cut the risk by ${o.cards[2].value} compared with a simple average. That is diversification.`],
    words: [['Diversification', 'Spreading money to lower risk.'], ['Correlation', 'How much two things move together.'], ['Volatility', 'How bumpy the returns are.']]
  },
  returns: {
    ask: 'How did my investment really perform?', essential: ['rets', 'start'],
    labels: { rets: 'Return each year (%)', start: 'Money you started with' },
    tips: { rets: 'Type each year\'s return as a percent, separated by commas. Use a minus sign for losses.', start: 'What you invested at the beginning.' },
    scene: { id: 'journey', map: v => ({ rets: parseList(v.rets).slice(0, 10), start: v.start }) },
    easy: [['Geometric mean (per period)', 'What you really earned per year', 'After the ups and downs'], ['Arithmetic mean', 'Simple average return', 'Looks better than reality'], ['Standard deviation', 'How bumpy the ride was', 'Bigger means riskier'], ['Sharpe ratio', 'Reward for each bit of risk', 'Higher is better']],
    plain: (v, o, k) => [`You really grew ${k.value} per period.`, `That is lower than the simple average of ${o.cards[1].value}, because losses hurt more than gains help.`],
    words: [['Compound return', 'What you really earned after compounding.'], ['Drawdown', 'A fall from a previous high.'], ['Volatility', 'How bumpy the ride was.']]
  },
  options: {
    ask: 'What is this option worth?', essential: ['S', 'K', 'T', 'vol'],
    labels: { S: 'Stock price today', K: 'Price on the ticket', T: 'Years until it expires', vol: 'How jumpy the stock is' }, force: { pos: 'lc' },
    tips: { S: 'What one share costs right now.', K: 'The price you may buy (call) or sell (put) at.', T: 'How long the ticket lasts.', vol: 'How much the stock bounces. More bounce makes tickets cost more.' },
    scene: { id: 'option', map: v => ({ K: v.K, prem: +bs(v.S, v.K, v.T, 0.04, 0, v.vol / 100).c.toFixed(2) }) },
    easy: [['Call price', 'Price of a "buy" ticket', 'The right to buy at the ticket price'], ['Put price', 'Price of a "sell" ticket', 'The right to sell at the ticket price'], ['Gamma', 'How fast the ticket value changes', 'Advanced'], ['Vega', 'Effect of a jumpier stock', 'Per 1 point of jumpiness']],
    plain: (v, o, k) => [`The right to buy at ${money(v.K, 0)} is worth ${k.value}. The right to sell is worth ${o.cards[1].value}.`, 'Tickets cost more when the stock is jumpier or when there is more time left.'],
    words: [['Call', 'The right to buy at a set price.'], ['Put', 'The right to sell at a set price.'], ['Strike', 'The set price on the ticket.']]
  },
  ratios: {
    ask: 'How healthy is this company?', essential: ['rev', 'cogs', 'opex', 'int', 'cash', 'ar', 'inv', 'nfa', 'cl', 'ltd'],
    labels: { rev: 'Sales', cogs: 'Cost of goods sold', opex: 'Other running costs', int: 'Interest paid', cash: 'Cash', ar: 'Money owed by customers', inv: 'Inventory', nfa: 'Buildings and equipment', cl: 'Bills due within a year', ltd: 'Long-term debt' },
    tips: { rev: 'Total sold in a year.', cogs: 'What the goods you sold cost.', opex: 'Salaries, rent and so on.', int: 'Interest paid on debt.', cash: 'Money in the bank.', ar: 'Customers who have not paid yet.', inv: 'Goods not yet sold.', nfa: 'Property, machines, vehicles.', cl: 'Money owed that is due soon.', ltd: 'Loans due after a year or more.' },
    easy: [['Return on equity', 'Profit on the owners\' money', 'A key score of how well it performs'], ['Net income', 'Profit after everything', 'Sales minus every cost and tax'], ['Equity (computed)', 'Owners\' share of the company', 'Assets minus what it owes'], ['Current ratio', 'Can it pay near-term bills?', 'Above 1 is comfortable']],
    plain: (v, o, k) => [`The company earns ${k.value} a year on its owners' money.`, 'That comes from profit on each sale, how hard its assets work, and how much it borrows.'],
    words: [['ROE', 'Profit for each dollar the owners put in.'], ['Liquidity', 'Ability to pay bills soon.'], ['Assets', 'Everything the company owns.']]
  },
  fx: {
    ask: 'What will the exchange rate be?', essential: ['S', 'id', 'if', 'T'],
    labels: { S: 'Rate today (home per 1 foreign)', id: 'Home interest rate', if: 'Foreign interest rate', T: 'Years ahead' }, force: { Fm: 0 },
    tips: { S: 'How much home currency 1 unit of foreign currency costs today.', id: 'What a bank pays at home.', if: 'What a bank pays abroad.', T: 'How far ahead you want the rate for.' },
    scene: { id: 'exchange', map: v => ({ S: v.S, id: v.id, if: v.if, T: Math.max(1, Math.round(v.T)) }) },
    easy: [['Parity forward rate', 'Fair rate to lock in for later', 'Set by the interest rate gap'], ['Expected spot (PPP)', 'Rate suggested by price changes', 'If prices drive the exchange rate'], ['Interest differential', 'Interest rate gap', 'Home minus foreign'], ['Inflation differential', 'Price-rise gap', 'Home minus foreign']],
    plain: (v, o, k) => [`A fair rate to lock in for ${nf(v.T, 2)} years is ${k.value}.`, 'Currencies with higher interest rates trade at a discount in the future.'],
    words: [['Spot rate', 'Today\'s exchange rate.'], ['Forward rate', 'A rate agreed today for a later date.'], ['Parity', 'No free-money gap between markets.']]
  },
  merger: {
    ask: 'Will this takeover help profit per share?', essential: ['prem', 'stock', 'syn'],
    labels: { prem: 'Extra paid over the market price', stock: 'Share paid in new stock', syn: 'Yearly cost savings ($M)' },
    tips: { prem: 'Buyers pay more than the market price to win the deal.', stock: 'The rest is paid with borrowed money.', syn: 'Savings from combining the two companies.' },
    scene: { id: 'merge', map: v => ({ aNI: v.aNI, aSh: v.aSh, aPx: v.aPx, tNI: v.tNI, tSh: v.tSh, tPx: v.tPx, prem: v.prem, stock: v.stock, rate: v.rate, tax: v.tax, syn: v.syn }) },
    easy: [['EPS accretion', 'Change in profit per share', 'Plus means the deal helps'], ['EPS dilution', 'Change in profit per share', 'Minus means the deal hurts'], ['Purchase price', 'Price paid for the target', ''], ['New shares issued', 'New shares created', 'Share the pie among more owners'], ['New debt raised', 'Money borrowed to pay', '']],
    plain: (v, o, k) => [`${k.label.startsWith('EPS acc') || k.label.startsWith('Change') && k.value.startsWith('+') ? 'Profit per share rises' : 'Profit per share falls'} by ${k.value.replace(/[+−-]/, '')}.`, `The deal needs ${cardBy(o, 'Break-even synergies').value} of yearly savings to leave profit per share unchanged.`],
    words: [['Accretive', 'Raises profit per share.'], ['Dilutive', 'Lowers profit per share.'], ['Synergies', 'Savings from joining two companies.']]
  }
};

/** Applies the plain-English relabel to a result card. */
export function easyCard(B, c) {
  const hit = (B.easy || []).find(e => c.label === e[0] || (e[0].endsWith(':') && c.label.startsWith(e[0])) || (e[0].endsWith('EPS:') && c.label.startsWith(e[0])));
  return hit ? { ...c, label: hit[1], sub: hit[2] != null && hit[2] !== '' ? hit[2] : c.sub } : c;
}
