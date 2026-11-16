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
  { n: 1, place: 'Base Camp', title: 'Why time matters for money', rank: 'Explorer', chapter: 'Money and time', hours: 2,
    why: 'A dollar today is worth more than a dollar next year. Today\'s dollar can earn interest. All other finance ideas build on this one.',
    can: ['Work out how much your savings will grow to', 'Explain compounding (interest that earns more interest) in one sentence', 'Compare a yearly rate with a monthly one'],
    ideas: ['Interest', 'Compounding', 'Present value', 'Future value', 'Effective rate'],
    tools: ['tvm', 'rates'],
    quest: 'You have $1,000 today. How much is it worth in 10 years at 5%? How much would you pay today for $1,000 in 10 years?',
    treasure: 'The Clock: you ask "when?" before you ask "how much?"' },
  { n: 2, place: 'Savings Meadow', title: 'Saving and paying every month', rank: 'Explorer', chapter: 'Borrowing and lending', hours: 2,
    why: 'Real life is not one big payment. You save a little each month. You repay a loan a little each month. These tools handle payments that repeat.',
    can: ['Find what monthly saving builds up to', 'Read a loan schedule and see where the interest goes', 'Check if your retirement plan is on track'],
    ideas: ['Annuity (equal payments)', 'Perpetuity (payments forever)', 'Amortization (paying a loan off)', 'Principal (the money you borrowed)', 'Interest-only vs repaying'],
    tools: ['annuity', 'loan', 'retire'],
    quest: 'Compare a 15-year and a 30-year home loan for the same house. How much more interest does the longer one cost?',
    treasure: 'The Ledger: you can read any loan or savings plan.' },
  { n: 3, place: 'Chance Cove', title: 'Numbers, chance and risk', rank: 'Explorer', chapter: 'Chance and numbers', hours: 3,
    why: 'Returns are never sure. To talk about risk, you first need tools to describe numbers and chance.',
    can: ['Sum up a list of returns with an average and a spread', 'Say how likely a big move is', 'Tell if two things move together'],
    ideas: ['Average', 'Standard deviation (the spread)', 'Probability (the chance)', 'Expected value', 'Correlation', 'Normal curve (the bell)'],
    tools: ['stats', 'prob', 'normal', 'corr'],
    quest: 'A stock rises 2% a month on average, with a 5% spread. How likely is a month worse than minus 8%?',
    treasure: 'The Dice: you can put a number on "how likely?"' },
  { n: 4, place: 'Bond Bay', title: 'Lending and interest rates', rank: 'Navigator', chapter: 'Borrowing and lending', hours: 3,
    why: 'A bond is a loan you give to a company or government. When interest rates go up, its price goes down. This one fact explains many news stories.',
    can: ['Work out a bond\'s price', 'Explain why bond prices fall when rates rise', 'Read the yield curve (rates for short and long loans) and say what it tells you'],
    ideas: ['Bond', 'Coupon (the yearly payment)', 'Yield (the yearly return)', 'Duration (how sensitive to rates)', 'Yield curve', 'Inflation (rising prices)'],
    tools: ['bond', 'curve', 'economy'],
    quest: 'Look at today\'s yield curve. Is it normal or inverted (short rates higher than long)? What would a 1-point rise in rates do to a 10-year bond?',
    treasure: 'The Lighthouse: you can read what interest rates tell you.' },
  { n: 5, place: 'Stock Summit', title: 'Owning a piece of a company', rank: 'Navigator', chapter: 'Owning things', hours: 3,
    why: 'A share gives you a claim on a company\'s future cash. Its price depends on what the company will pay out, and how fast that grows.',
    can: ['Find a share\'s value from its dividends', 'Measure a return and how bumpy it was', 'Read today\'s market in plain words'],
    ideas: ['Share', 'Dividend (profit paid out)', 'Growth', 'Return', 'Volatility (how much it jumps)', 'Market mood'],
    tools: ['ddm', 'returns', 'market-pulse'],
    quest: 'A share pays a $2 dividend that grows 4% a year. You want a 9% return. What is the share worth? Compare it with today\'s price.',
    treasure: 'The Telescope: you can tell what a share is worth and how risky it has been.' },
  { n: 6, place: 'Risk Ridge', title: 'Risk and return together', rank: 'Strategist', chapter: 'Risk', hours: 4,
    why: 'Higher returns come with more risk. Spreading your money around cuts risk, but cuts return less. This is the "free lunch" of finance.',
    can: ['Combine investments into a portfolio', 'Say how much risk a stock adds to a portfolio', 'Estimate a worst-case loss', 'Explain what drives returns'],
    ideas: ['Diversification (spreading your money)', 'Beta (how jumpy a stock is)', 'CAPM (the return a stock should give)', 'Efficient frontier', 'Value at risk (a worst-case loss)', 'Factors'],
    tools: ['portfolio', 'capm', 'frontier', 'varcalc', 'factors', 'factor-returns'],
    quest: 'Build a portfolio of two investments. Find the mix with the lowest risk. How much risk did mixing remove?',
    treasure: 'The Shield: you spread risk instead of just hoping.' },
  { n: 7, place: 'Company Canyon', title: 'Read a company\'s report card', rank: 'Strategist', chapter: 'Owning things', hours: 4,
    why: 'Before you value a company, learn how it makes money, what it owes, and if it is healthy. Ratios turn pages of accounts into a few numbers.',
    can: ['Work out and explain key ratios', 'Get a real company\'s last ten years of numbers', 'Compare a company with its industry', 'Judge the risk that it cannot repay its debts'],
    ideas: ['Profit margin', 'Return on equity (profit on owners\' money)', 'DuPont', 'Leverage (using borrowed money)', 'Liquidity (cash on hand)', 'Credit risk'],
    tools: ['ratios', 'financials', 'industries', 'altman'],
    quest: 'Pick a company you know. Is its margin above or below its industry? Does it owe more than before?',
    treasure: 'The Magnifier: you can see how healthy a company is.' },
  { n: 8, place: 'Decision Forest', title: 'Should the company do it?', rank: 'Strategist', chapter: 'Making decisions', hours: 5,
    why: 'Companies must keep choosing: build a factory or not, borrow or sell shares, buy or lease. A choice is good if it earns more than it costs to fund.',
    can: ['Judge a project with NPV and IRR (its gain and its yearly return)', 'Work out what a company pays for its funding', 'Find a break-even point', 'Compare scenarios side by side'],
    ideas: ['NPV (gain in today\'s money)', 'IRR (yearly return)', 'WACC (average cost of funding)', 'Capital structure (debt and ownership mix)', 'Break-even', 'Working capital (cash for daily needs)'],
    tools: ['capbud', 'wacc', 'capstruct', 'breakeven', 'wc', 'lease', 'scenarios'],
    quest: 'A project costs $500,000 and brings in $150,000 a year for 5 years. Funding costs 10%. Should the company go ahead?',
    treasure: 'The Compass: you can decide if a plan is worth doing.' },
  { n: 9, place: 'Value Valley', title: 'What is a business worth?', rank: 'Analyst', chapter: 'Making decisions', hours: 5,
    why: 'Valuation puts everything together. Forecast the cash, bring it back to today\'s value, check it against similar companies, then see how deals and payouts change the answer.',
    can: ['Value a company from its future cash', 'Check your answer against similar companies', 'Build a forecast of profit, cash and debts', 'See how a merger, buyout or payout changes value'],
    ideas: ['Free cash flow (spare cash)', 'Terminal value (value after the forecast)', 'Multiples (like P/E)', 'Synergies (savings from joining)', 'Buyouts', 'Dividends vs buybacks'],
    tools: ['business-value', 'dcf', 'comps', 'model3', 'merger', 'payout', 'lbo'],
    quest: 'Value a company from its future cash, then with a multiple of similar firms. If the answers differ, say which guess you trust less, and why.',
    treasure: 'The Scales: you can give a business a price and explain it.' },
  { n: 10, place: 'Option Heights', title: 'Contracts on future prices', rank: 'Analyst', chapter: 'Risk', hours: 5,
    why: 'Options, futures and swaps let you protect yourself from price moves, or bet on them. Each one is a payoff you can draw.',
    can: ['Draw what an option strategy earns or loses', 'Work out an option\'s price', 'Protect yourself from a price or rate change', 'Handle the risk of changing exchange rates'],
    ideas: ['Call and put (right to buy, right to sell)', 'Strike price (the fixed price)', 'Premium (the fee)', 'Hedging (protecting yourself)', 'Forward', 'Swap', 'Exchange rate'],
    tools: ['options-payoff', 'options', 'strategies', 'binomial', 'futures', 'swaps', 'fx', 'currency'],
    quest: 'A seller abroad will get $1 million in 6 months and fears the dollar will fall. Describe two ways to protect that income, and what each costs.',
    treasure: 'The Summit View: you can manage risk with contracts, not just avoid it.' }
];

export const TREASURE = {
  title: 'The Treasure: think like a finance analyst',
  can: ['Compare money across time, loans and savings', 'Judge risk, return and spreading your money', 'Read a company and decide if a project pays', 'Value a business and price simple contracts'],
  quest: 'Choose a real company that sells shares. Read its numbers, value it two ways, describe its main risks, and say if you would invest.'
};

export const RANKS: readonly { name: string; from: number; blurb: string }[] = [
  { name: 'Newcomer', from: 0, blurb: 'Just setting out' },
  { name: 'Explorer', from: 1, blurb: 'You know how money grows and how risk works' },
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
