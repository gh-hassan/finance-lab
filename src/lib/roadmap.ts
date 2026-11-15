/** The learning roadmap: ten stops from Base Camp to the treasure. Pure data and progress logic, so tests can check it without a page. */
export type Rank = 'Explorer' | 'Navigator' | 'Strategist' | 'Analyst';
export interface Stage {
  n: number; place: string; title: string; rank: Rank;
  /** The lesson chapter (on the Lessons page) that goes with this stop. */
  chapter: string;
  why: string;
  /** What the student can do after this stop. */
  can: string[];
  /** Key ideas, in plain words. */
  ideas: string[];
  /** Tool or page ids to try, in the order to try them. */
  tools: string[];
  quest: string; treasure: string; hours: number;
}

export const STAGES: readonly Stage[] = [
  { n: 1, place: 'Base Camp', title: 'Money has a time', rank: 'Explorer', chapter: 'Money and time', hours: 2,
    why: 'A dollar today is worth more than a dollar next year, because today\'s dollar can earn interest. Every other idea in finance is built on this one.',
    can: ['Work out what savings grow to', 'Explain compounding in one sentence', 'Compare a yearly rate with a monthly one'],
    ideas: ['Interest', 'Compounding', 'Present value', 'Future value', 'Effective rate'],
    tools: ['tvm', 'rates'],
    quest: 'You are given $1,000 today. How much is it worth in 10 years at 5%? How much would you pay today for $1,000 in 10 years?',
    treasure: 'The Clock: you always ask "when" before you ask "how much".' },
  { n: 2, place: 'Savings Meadow', title: 'Regular saving and paying', rank: 'Explorer', chapter: 'Borrowing and lending', hours: 2,
    why: 'Real life is rarely one lump sum. You save a little each month and repay a loan a little each month. These tools handle streams of payments.',
    can: ['Find what monthly saving builds', 'Read a loan schedule and see where the interest goes', 'Check whether a retirement plan is on track'],
    ideas: ['Annuity', 'Perpetuity', 'Amortization', 'Principal', 'Interest-only vs repaying'],
    tools: ['annuity', 'loan', 'retire'],
    quest: 'Compare a 15-year and a 30-year mortgage for the same house. How much extra interest does the longer one cost?',
    treasure: 'The Ledger: you can read any loan or savings plan.' },
  { n: 3, place: 'Chance Cove', title: 'Numbers, chance and risk', rank: 'Explorer', chapter: 'Chance and numbers', hours: 3,
    why: 'Returns are never certain. Before you can talk about risk you need a few tools for describing numbers and chance.',
    can: ['Summarise a list of returns with an average and a spread', 'Say how likely a big move is', 'Tell whether two things move together'],
    ideas: ['Average', 'Standard deviation', 'Probability', 'Expected value', 'Correlation', 'Normal curve'],
    tools: ['stats', 'prob', 'normal', 'corr'],
    quest: 'A stock rises 2% a month on average with a 5% spread. How likely is a month worse than minus 8%?',
    treasure: 'The Dice: you can put a number on "how likely".' },
  { n: 4, place: 'Bond Bay', title: 'Lending and interest rates', rank: 'Navigator', chapter: 'Borrowing and lending', hours: 3,
    why: 'A bond is a loan you make to a company or government. Its price moves opposite to interest rates, and that single fact explains many headlines.',
    can: ['Price a bond', 'Explain why bond prices fall when rates rise', 'Read the yield curve and say what it signals'],
    ideas: ['Bond', 'Coupon', 'Yield', 'Duration', 'Yield curve', 'Inflation'],
    tools: ['bond', 'curve', 'economy'],
    quest: 'Look at today\'s yield curve. Is it normal or inverted? What would a 1-point rise in rates do to a 10-year bond?',
    treasure: 'The Lighthouse: you can read what interest rates are telling you.' },
  { n: 5, place: 'Stock Summit', title: 'Owning a piece of a company', rank: 'Navigator', chapter: 'Owning things', hours: 3,
    why: 'A share is a claim on a company\'s future cash. Its price rests on what the company is expected to pay out and how fast that grows.',
    can: ['Value a share from its dividends', 'Measure a return and how bumpy it was', 'Read today\'s market in plain words'],
    ideas: ['Share', 'Dividend', 'Growth', 'Return', 'Volatility', 'Market mood'],
    tools: ['ddm', 'returns', 'market-pulse'],
    quest: 'A share pays a $2 dividend that grows 4% a year. If you want 9%, what is it worth? Compare with its price today.',
    treasure: 'The Telescope: you can tell what a share is worth and how risky it has been.' },
  { n: 6, place: 'Risk Ridge', title: 'Risk and return together', rank: 'Strategist', chapter: 'Risk', hours: 4,
    why: 'Higher returns come with more risk. Spreading money across assets cuts risk without cutting return as much, which is the free lunch of finance.',
    can: ['Combine assets into a portfolio', 'Say how much risk a stock adds to a portfolio', 'Estimate a worst-case loss', 'Explain what drives returns'],
    ideas: ['Diversification', 'Beta', 'CAPM', 'Efficient frontier', 'Value at risk', 'Factors'],
    tools: ['portfolio', 'capm', 'frontier', 'varcalc', 'factors', 'factor-returns'],
    quest: 'Build a portfolio of two assets. Find the mix with the lowest risk. How much risk did mixing remove?',
    treasure: 'The Shield: you know how to spread risk instead of just hoping.' },
  { n: 7, place: 'Company Canyon', title: 'Read a company\'s report card', rank: 'Strategist', chapter: 'Owning things', hours: 4,
    why: 'Before you value a company you must understand how it makes money, what it owes and whether it is healthy. Ratios turn pages of accounts into a few numbers.',
    can: ['Compute and explain key ratios', 'Pull a real company\'s ten years of numbers', 'Compare a company to its industry', 'Judge the risk of default'],
    ideas: ['Profit margin', 'Return on equity', 'DuPont', 'Leverage', 'Liquidity', 'Credit risk'],
    tools: ['ratios', 'financials', 'industries', 'altman'],
    quest: 'Pick a company you know. Is its margin above or below its industry? Is it taking on more debt than before?',
    treasure: 'The Magnifier: you can see how healthy a company really is.' },
  { n: 8, place: 'Decision Forest', title: 'Should the company do it?', rank: 'Strategist', chapter: 'Making decisions', hours: 5,
    why: 'Companies keep choosing: build the plant or not, borrow or issue shares, buy or lease. The answer is whether a choice earns more than it costs to fund.',
    can: ['Judge a project with NPV and IRR', 'Work out a company\'s cost of funding', 'Find a break-even point', 'Compare scenarios side by side'],
    ideas: ['NPV', 'IRR', 'WACC', 'Capital structure', 'Break-even', 'Working capital'],
    tools: ['capbud', 'wacc', 'capstruct', 'breakeven', 'wc', 'lease', 'scenarios'],
    quest: 'A project costs $500,000 and returns $150,000 a year for 5 years. At a 10% cost of funds, should the company go ahead?',
    treasure: 'The Compass: you can decide whether a plan is worth doing.' },
  { n: 9, place: 'Value Valley', title: 'What is a business worth?', rank: 'Analyst', chapter: 'Making decisions', hours: 5,
    why: 'Valuation pulls everything together: forecast cash, discount it, check it against similar companies, then test how deals and payouts change the answer.',
    can: ['Value a company by discounting its cash', 'Cross-check with similar companies', 'Build a three-statement forecast', 'See how a merger, buyout or payout changes value'],
    ideas: ['Free cash flow', 'Terminal value', 'Multiples', 'Synergies', 'Buyouts', 'Dividends vs buybacks'],
    tools: ['dcf', 'comps', 'model3', 'merger', 'payout', 'lbo'],
    quest: 'Value a company with a discounted cash flow, then with a multiple of similar firms. If they disagree, say which assumption you trust less, and why.',
    treasure: 'The Scales: you can put a defensible price on a business.' },
  { n: 10, place: 'Option Heights', title: 'Contracts on future prices', rank: 'Analyst', chapter: 'Risk', hours: 5,
    why: 'Options, futures and swaps let you protect against price moves or bet on them. They look hard, but each is a simple payoff you can draw.',
    can: ['Draw what an option strategy earns or loses', 'Price an option', 'Hedge a price or rate risk', 'Handle foreign-exchange risk'],
    ideas: ['Call and put', 'Strike price', 'Premium', 'Hedging', 'Forward', 'Swap', 'Exchange rate'],
    tools: ['options-payoff', 'options', 'strategies', 'binomial', 'futures', 'swaps', 'fx', 'currency'],
    quest: 'An exporter expects $1 million in 6 months and fears the dollar will fall. Describe two ways to protect the income, and the cost of each.',
    treasure: 'The Summit View: you can manage risk with contracts, not just avoid it.' }
];

export const TREASURE = {
  title: 'The Treasure: think like a finance analyst',
  can: ['Value money across time, loans and savings', 'Judge risk, return and diversification', 'Read a company and decide whether a project pays', 'Value a business and price simple contracts'],
  quest: 'Choose a real listed company. Read its numbers, value it two ways, describe its main risks, and say whether you would invest.'
};

export const RANKS: readonly { name: string; from: number; blurb: string }[] = [
  { name: 'Newcomer', from: 0, blurb: 'Just setting out' },
  { name: 'Explorer', from: 1, blurb: 'You know how money grows and risk behaves' },
  { name: 'Navigator', from: 4, blurb: 'You can read bonds, rates and shares' },
  { name: 'Strategist', from: 6, blurb: 'You can weigh risk and judge a company' },
  { name: 'Analyst', from: 9, blurb: 'You can value a business and manage risk' }
];

export interface StageProgress { stage: Stage; done: number; total: number; complete: boolean; tried: ReadonlySet<string> }

/** How far through each stop the student is. A stop is finished when every tool in it has been opened. */
export function mapProgress(stages: readonly Stage[], seen: Iterable<string>): StageProgress[] {
  const s = new Set(seen);
  return stages.map(stage => { const tried = new Set(stage.tools.filter(t => s.has(t))); return { stage, done: tried.size, total: stage.tools.length, complete: tried.size === stage.tools.length, tried }; });
}
/** The first unfinished stop, or the last one when everything is done. */
export const currentIndex = (p: readonly StageProgress[]): number => { const i = p.findIndex(x => !x.complete); return i < 0 ? p.length - 1 : i; };
export const rankFor = (finished: number): { name: string; from: number; blurb: string } => [...RANKS].reverse().find(r => finished >= r.from) ?? RANKS[0];
/** The next tool to open: the first one not yet tried in the current stop. */
export function nextTool(p: readonly StageProgress[]): string | null {
  const cur = p[currentIndex(p)];
  return cur ? cur.stage.tools.find(t => !cur.tried.has(t)) ?? null : null;
}
