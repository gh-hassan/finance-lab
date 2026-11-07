// @ts-nocheck
/* Plain-English layer for the calculators added after the first release. Same shape as the entries in beginner.js. */
import { BEGINNER } from './beginner.js';
import { nf } from '../lib/math';

Object.assign(BEGINNER, {
  frontier: {
    ask: 'How should I split my money across several investments?', essential: ['mu', 'sd', 'corr', 'w'],
    labels: { mu: 'Expected return of each (%)', sd: 'How bumpy each one is (%)', corr: 'How much they move together', w: 'How you split your money (%)' },
    tips: { mu: 'One number per investment, separated by commas, in the same order each time.', sd: 'How much each return jumps around. Bigger means riskier.', corr: 'A table of numbers from −1 to 1. Rows are separated by a semicolon. 1 means move together, 0 unrelated.', w: 'For example 25, 25, 25, 25 puts a quarter of your money in each.' },
    easy: [['Your portfolio return', 'What you can expect to earn', 'Your mix of the investments'], ['Your portfolio risk (σ)', 'How bumpy your mix is', 'Lower is calmer'], ['Your Sharpe ratio', 'Reward for each bit of risk', 'Higher is better'], ['Minimum-variance mix', 'The calmest possible mix', 'The lowest risk you can reach'], ['Tangency (best Sharpe) mix', 'The best risk-for-reward mix', 'Where the best line touches the curve']],
    plain: (v, o, k) => [`Your mix is expected to earn about ${k.value} a year.`, `The curve shows the best return possible for each level of risk. Your mix is the dot marked You: the closer to the curve, the better it uses the risk.`],
    words: [['Efficient frontier', 'The best return you can get for each level of risk.'], ['Tangency portfolio', 'The mix of risky investments with the best reward for the risk.'], ['Sharpe ratio', 'Extra return earned per unit of risk.']]
  },
  strategies: {
    ask: 'What can I do with options?', essential: ['strat', 'S', 'K', 'wd', 'T', 'vol'],
    labels: { strat: 'Pick a strategy', S: 'Stock price today', K: 'Middle strike price', wd: 'Gap between strikes', T: 'Time until it ends', vol: 'How bumpy the stock is' },
    tips: { strat: 'Each one is a different bet on where the price goes.', S: 'What one share costs now.', K: 'The agreed price in the option contract.', wd: 'Used by strategies with more than one strike.', T: 'In years. 0.5 is six months.', vol: 'Bigger means options cost more.' },
    easy: [['Net cost (debit)', 'What it costs to start', 'Per share'], ['Net credit received', 'What you are paid to start', 'Per share'], ['Maximum profit', 'Best you can make', 'At expiry'], ['Maximum loss', 'Worst you can lose', 'At expiry'], ['Break-even price', 'Price where you neither win nor lose', 'At expiry']],
    plain: (v, o, k) => [`Starting this position ${k.label.startsWith('Net credit') ? 'pays you' : 'costs'} ${k.value} a share.`, o.info || 'The chart shows your profit for every possible final price.'],
    words: [['Option', 'A contract giving the right to buy or sell at a set price.'], ['Strike price', 'The set price in the contract.'], ['Premium', 'What you pay for the option.'], ['Break-even', 'The price where profit is zero.']]
  },
  binomial: {
    ask: 'What is this option worth, step by step?', essential: ['S', 'K', 'T', 'vol', 'n', 'kind', 'style'],
    labels: { S: 'Stock price today', K: 'Agreed price (strike)', T: 'Time until it ends', vol: 'How bumpy the stock is', n: 'Steps in the tree', kind: 'Call or put', style: 'Can you use it early?' },
    tips: { S: 'What one share costs now.', K: 'The agreed price in the option contract.', T: 'In years. 1 is one year.', vol: 'How much the stock price jumps around.', n: 'More steps give a more exact answer but a bigger tree.', kind: 'A call is a right to buy, a put is a right to sell.', style: 'American options can be used at any time, European only at the end.' },
    easy: [['Black-Scholes (European)', 'Textbook price', 'The limit of many steps'], ['Value of exercising early', 'Extra value of using it early', 'American minus European']],
    plain: (v, o, k) => [`On this tree the option is worth about ${k.value}.`, `Each step the price goes up or down. Working back from the end gives today's value.`],
    words: [['Binomial tree', 'A picture of the price going up or down each step.'], ['American option', 'Can be used at any time before it ends.'], ['European option', 'Can only be used at the end.']]
  }
});

Object.assign(BEGINNER, {
  comps: {
    ask: 'What is this company worth compared to similar ones?', essential: ['ebitda', 'ni', 'rev', 'book', 'debt', 'sh', 'px', 'evE', 'pe'],
    labels: { ebitda: 'Yearly profit before interest and tax ($M)', ni: 'Yearly profit ($M)', rev: 'Yearly sales ($M)', book: 'What the company owns minus owes ($M)', debt: 'Debt minus cash ($M)', sh: 'Number of shares (M)', px: 'Price of one share today', evE: 'How rivals are priced: value ÷ operating profit', pe: 'How rivals are priced: price ÷ profit' },
    tips: { ebitda: 'Profit before interest, tax and depreciation.', ni: 'The profit left for owners after everything.', rev: 'Total sales for the year.', book: 'Also called net assets.', debt: 'What it owes in debt, less the cash it holds.', sh: 'In millions.', px: 'Used to see if the company looks cheap or dear.', evE: 'A list of numbers, one per rival, separated by commas.', pe: 'A list of numbers, one per rival, separated by commas.' },
    easy: [['Likely range', 'Likely price range', 'Middle half of rivals'], ['Versus current price', 'Cheap or expensive?', 'Our value against the market price']],
    plain: (v, o, k) => [`Compared with similar companies, one share looks worth about ${k.value}.`, o.cards[1] ? `The likely range is ${o.cards[1].value}.` : ''],
    words: [['Multiple', 'A price divided by something the company earns or owns.'], ['Peers', 'Companies similar enough to compare.'], ['EBITDA', 'Profit before interest, tax and depreciation.']]
  },
  model3: {
    ask: 'What will the company\'s numbers look like in five years?', essential: ['rev0', 'growth', 'cogs', 'opex', 'tax'],
    labels: { rev0: 'Sales this year ($M)', growth: 'How fast sales grow each year (%)', cogs: 'Cost of making what it sells (% of sales)', opex: 'Running costs (% of sales)', tax: 'Tax rate' },
    tips: { rev0: 'Total sales for the year, in millions.', growth: 'Five numbers separated by commas, one per year.', cogs: 'Materials and labour to make the product.', opex: 'Rent, salaries, marketing and so on.', tax: 'Share of profit paid in tax.' },
    easy: [['Revenue growth per year (CAGR)', 'Sales growth per year', 'Over five years'], ['Free cash flow, five years', 'Spare cash made', 'After running costs and investing']],
    plain: (v, o, k) => [`In five years this company could earn about ${k.value} a year.`, `Sales, costs, cash and what it owns all link together. The balance check shows the numbers add up.`],
    words: [['Income statement', 'Sales minus costs gives profit.'], ['Cash flow', 'Money actually coming in and going out.'], ['Balance sheet', 'What the company owns and owes.']]
  },
  lease: {
    ask: 'Should we lease it or buy it?', essential: ['cost', 'salv', 'life', 'method', 'tax', 'pay', 'term'],
    labels: { cost: 'Price of the asset', salv: 'What it is worth at the end', life: 'Years we will use it', method: 'How the cost is spread over the years', tax: 'Tax rate', pay: 'Lease payment each year', term: 'Years of the lease' },
    tips: { cost: 'What it costs to buy outright.', salv: 'Its resale value when we are done.', life: 'How many years it is useful.', method: 'Faster methods give bigger tax savings early.', tax: 'Share of profit paid in tax.', pay: 'What the lessor charges each year.', term: 'How long the lease lasts.' },
    easy: [['Net advantage to leasing', 'Lease or buy?', 'Positive means leasing is cheaper'], ['Net advantage to buying', 'Lease or buy?', 'Positive means buying is cheaper']],
    plain: (v, o, k) => [`${k.label === 'Net advantage to leasing' ? 'Leasing' : 'Buying'} looks cheaper by about ${k.value} in today's money.`, 'The tax saving from depreciation is part of the answer.'],
    words: [['Depreciation', 'Spreading an asset\'s cost over its useful life.'], ['Tax shield', 'Tax saved because depreciation lowers taxable profit.'], ['Lease', 'Paying to use an asset without owning it.']]
  },
  payout: {
    ask: 'Pay a dividend or buy back shares?', essential: ['earn', 'sh', 'px', 'cash', 'td', 'tg', 'basis', 'hold'],
    labels: { earn: 'Yearly profit ($M)', sh: 'Number of shares (M)', px: 'Price of one share', cash: 'Cash to give back ($M)', td: 'Tax on dividends', tg: 'Tax on gains from selling shares', basis: 'What you paid per share', hold: 'Shares you own' },
    tips: { earn: 'Profit left for owners.', sh: 'In millions.', px: 'What one share trades at now.', cash: 'How much the company wants to return.', td: 'Dividends are often taxed at a higher rate.', tg: 'Profit from selling shares is often taxed lower.', basis: 'Your cost per share.', hold: 'How many shares you hold.' },
    easy: [['EPS after the buyback', 'Profit per share afterwards', 'Fewer shares, same profit']],
    plain: (v, o, k) => [`${k.label.startsWith('Dividend') ? 'The two choices are equal for you.' : k.label + ' ' + k.value + '.'}`, 'A buyback can be kinder on tax; a dividend gives cash without selling shares.'],
    words: [['Dividend', 'Profit paid out to shareholders.'], ['Buyback', 'The company buys its own shares, so fewer remain.'], ['Payout ratio', 'Share of profit returned to owners.']]
  }
});

Object.assign(BEGINNER, {
  curve: {
    ask: 'What do interest rates look like for different lengths of time?', essential: ['par', 'face', 'cpn', 'yrs'],
    labels: { par: 'Rate for 1 year, 2 years, 3 years… (%)', face: 'Face value of the bond', cpn: 'Yearly interest the bond pays', yrs: 'Years until the bond ends' },
    tips: { par: 'One rate per year, separated by commas, for example 4, 4.2, 4.4.', face: 'What the bond repays at the end.', cpn: 'The yearly payment as a percent of the face value.', yrs: 'How long until the bond repays.' },
    easy: [['Curve shape', 'Shape of the rate curve', 'Rising is normal, falling is a warning'], ['Macaulay duration of your bond', 'Average wait for your money', 'In years']],
    plain: (v, o, k) => [`Using today's rates for each length of time, this bond is worth about ${k.value}.`, `Longer money usually earns a higher rate. The curve also shows the rates the market expects in the future.`],
    words: [['Spot rate', 'The rate for lending from today to a set date.'], ['Forward rate', 'The rate the market expects for a future year.'], ['Duration', 'How long you wait on average to get your money back.']]
  },
  futures: {
    ask: 'What should a future price be, and how do I hedge?', essential: ['S', 'r', 'T', 'mkt', 'expo', 'cv', 'rho', 'sdS', 'sdF'],
    labels: { S: 'Price today', r: 'Safe interest rate', T: 'Time until delivery', mkt: 'Price quoted in the market', expo: 'Value you want to protect', cv: 'Value of one contract', rho: 'How closely they move together', sdS: 'How bumpy your holding is (%)', sdF: 'How bumpy the future is (%)' },
    tips: { S: 'What it costs right now.', r: 'What cash earns with no risk.', T: 'In years. 0.5 is six months.', mkt: 'The price you can lock in today for later.', expo: 'The amount at risk of falling.', cv: 'What one contract is worth.', rho: '1 means they move together exactly.', sdS: 'Yearly ups and downs of your holding.', sdF: 'Yearly ups and downs of the future.' },
    easy: [['Arbitrage', 'Free money?', 'Whether the quoted price is off'], ['Contracts to sell', 'Contracts to sell', 'To cancel out the risk']],
    plain: (v, o, k) => [`A fair price for delivery later is about ${k.value}.`, `${o.cards[1].value === 'None' ? 'The quoted price matches, so there is no free profit.' : 'The quoted price is off, which would allow a riskless profit.'}`],
    words: [['Forward', 'An agreement to buy or sell at a set price later.'], ['Hedge', 'A trade that cancels out a risk you already have.'], ['Basis', 'The gap between the future price and today\'s price.']]
  },
  swaps: {
    ask: 'What is a fair fixed rate, and what is my swap worth now?', essential: ['par', 'term', 'notional', 'fixed'],
    labels: { par: 'Rate for 1 year, 2 years, 3 years… (%)', term: 'Years of the swap', notional: 'Amount the rates apply to', fixed: 'Fixed rate you pay now' },
    tips: { par: 'One rate per year, separated by commas.', term: 'How long the swap lasts.', notional: 'The amount payments are worked out on. It is never exchanged.', fixed: 'The rate already agreed in an existing swap.' },
    easy: [['Value of your swap (to fixed payer)', 'What your swap is worth', 'Positive means you are ahead']],
    plain: (v, o, k) => [`A fair fixed rate for this swap today is ${k.value}.`, `If you already pay a different fixed rate, your swap is worth ${o.cards[1].value} to you.`],
    words: [['Swap', 'Two sides trade payments, usually fixed for floating.'], ['Notional', 'The amount payments are based on.'], ['Floating rate', 'A rate that changes with the market.']]
  },
  varcalc: {
    ask: 'How much could I lose in a bad period?', essential: ['val', 'mu', 'sd', 'days', 'conf', 'hist'],
    labels: { val: 'Money invested', mu: 'Expected yearly return', sd: 'How bumpy it is each year', days: 'How long you hold it (days)', conf: 'How sure you want to be (%)', hist: 'Past returns, if you have them (%)' },
    tips: { val: 'The total you have at risk.', mu: 'The average yearly return you expect.', sd: 'Bigger means bigger swings.', days: 'Market days, about 252 in a year.', conf: '95 means the loss should be worse only 1 time in 20.', hist: 'Optional. A list separated by commas.' },
    easy: [['Expected shortfall', 'Average loss in the worst cases', 'Beyond the main line'], ['Historical VaR', 'Loss using your past returns', 'Based on what actually happened']],
    plain: (v, o, k) => [`With ${v.conf}% confidence you should not lose more than ${k.value} over ${v.days} days.`, `The loss is worse only about ${nf(100 - v.conf, 1)}% of the time, and when it is, it averages ${o.cards[1].value}.`],
    words: [['Value at risk', 'The loss you should only exceed rarely.'], ['Confidence level', 'How sure you want the answer to be.'], ['Expected shortfall', 'The average loss when it is worse than the main line.']]
  },
  altman: {
    ask: 'How close is this company to going bust?', essential: ['model', 'wc', 're', 'ebit', 'eq', 'liab', 'sales', 'assets'],
    labels: { model: 'What kind of company?', wc: 'Short-term assets minus short-term debts ($M)', re: 'Profit kept over the years ($M)', ebit: 'Operating profit ($M)', eq: 'Value of the shares ($M)', liab: 'Everything it owes ($M)', sales: 'Yearly sales ($M)', assets: 'Everything it owns ($M)' },
    tips: { model: 'Pick the closest match. Listed manufacturers use market value.', wc: 'Also called working capital.', re: 'Accumulated profits not paid out.', ebit: 'Profit before interest and tax.', eq: 'Market value for a listed company, book value otherwise.', liab: 'Total liabilities.', sales: 'Total revenue for the year.', assets: 'Total assets.' },
    easy: [['Z-score', 'Health score', 'Higher is safer']],
    plain: (v, o, k) => [`The health score is ${k.value}, which is the ${k.sub.toLowerCase()}.`, 'Below the low line means high risk of failing. Above the high line means low risk.'],
    words: [['Z-score', 'A single number summarising financial health.'], ['Distress', 'A real risk of the company failing to pay its debts.'], ['Working capital', 'Short-term assets minus short-term debts.']]
  },
  lbo: {
    ask: 'What return can a buyer make with borrowed money?', essential: ['ebitda', 'entry', 'debtX', 'rate', 'g', 'exit', 'yrs'],
    labels: { ebitda: 'Yearly operating profit ($M)', entry: 'Price paid (times profit)', debtX: 'Money borrowed (times profit)', rate: 'Interest on the loan', g: 'Profit growth each year', exit: 'Sale price (times profit)', yrs: 'Years before selling' },
    tips: { ebitda: 'Profit before interest, tax and depreciation.', entry: 'For example 8 means eight times the yearly profit.', debtX: 'How much of the price is borrowed.', rate: 'What the lenders charge.', g: 'How fast the business grows.', exit: 'What the buyer sells for, in the same units.', yrs: 'How long the buyer owns it.' },
    easy: [['Equity out at the sale', 'Money back at the sale', 'After repaying the loan']],
    plain: (v, o, k) => [`The buyer could earn about ${k.value} a year on the money they put in.`, 'Most of the return usually comes from growth and from paying down the loan.'],
    words: [['LBO', 'Buying a company mostly with borrowed money.'], ['IRR', 'The yearly return on the money put in.'], ['Cash sweep', 'Using all spare cash to repay debt.']]
  },
  retire: {
    ask: 'Will I have enough to retire?', essential: ['age', 'ret', 'live', 'saved', 'add', 'pre', 'post', 'inf', 'inc'],
    labels: { age: 'Your age now', ret: 'Age you want to stop working', live: 'Age to plan for', saved: 'Saved so far', add: 'Saved each year', pre: 'Yearly return while saving', post: 'Yearly return in retirement', inf: 'Price rises each year', inc: 'Yearly income you want (today\'s money)' },
    tips: { age: 'How old you are today.', ret: 'When you plan to stop.', live: 'How long to make the money last.', saved: 'What you already have.', add: 'What you will add each year.', pre: 'What your savings earn while you work.', post: 'What your savings earn after you stop.', inf: 'Inflation, which shrinks what money buys.', inc: 'What you want to spend each year, in today\'s prices.' },
    easy: [['Pot at retirement', 'Savings when you stop', 'What you will have'], ['Needed at retirement', 'Savings you need', 'To pay your income']],
    plain: (v, o, k) => [`${k.label === 'You are on track' ? 'You look on track.' : 'You may fall short.'} ${k.label === 'You are on track' ? '' : 'The gap is ' + k.value + '.'}`.trim(), `Your savings could reach ${o.cards[1].value} at ${v.ret}. You would need about ${o.cards[2].value}.`],
    words: [['Nest egg', 'The savings you retire with.'], ['Inflation', 'Prices rising over time.'], ['Real return', 'The return after inflation.']]
  },
  factors: {
    ask: 'What should this investment earn for its risks?', essential: ['rf', 'names', 'prem', 'beta', 'actual'],
    labels: { rf: 'Safe return', names: 'The kinds of risk', prem: 'Extra return each risk has paid (%)', beta: 'How much your investment has of each', actual: 'What it actually earned' },
    tips: { rf: 'What cash earns with no risk.', names: 'For example Market, Size, Value, Momentum.', prem: 'A list, one per risk, in the same order.', beta: 'A list, one per risk. Negative means the opposite.', actual: 'The return it really earned.' },
    easy: [['Alpha versus the factor model', 'Beat the odds?', 'Positive means it earned more than its risks explain']],
    plain: (v, o, k) => [`For the risks it carries, this investment should earn about ${k.value} a year.`, `Compared with its actual return, the gap is ${o.cards[2].value}.`],
    words: [['Factor', 'A kind of risk that earns extra return.'], ['Alpha', 'Return that the risks do not explain.'], ['Loading', 'How strongly an investment moves with a factor.']]
  }
});
