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
