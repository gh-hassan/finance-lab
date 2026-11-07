// @ts-nocheck
/* Plain-English layer for the calculators added after the first release. Same shape as the entries in beginner.js. */
import { BEGINNER } from './beginner.js';

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
