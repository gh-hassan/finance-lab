// @ts-nocheck
/* Concept animations. Each scene draws one idea as a short, clean infographic.
   draw(t, p, W, H): t runs 0..1, p holds the parameters, and W x H is the real pixel size of the stage,
   so text is never scaled. Design rules: no characters, only proportional bars and lines, one accent per idea,
   labels centred on what they describe. */
import { compact, corr, linreg, mean, median, money, ncdf, nf, stdev, sum } from '../lib/math';
import { esc, h, reduced } from './visuals.js';
import { rangeSlider } from './slider.js';
import { say } from './ticker.js';
import { rng, gauss, series } from './scene-random.js';
import { MONEY_AND_TIME, BORROWING_AND_LENDING } from './lesson-doodles.js';
import { CHANCE_AND_NUMBERS } from './lesson-doodles-stats.js';
import { OWNING_AND_RISK } from './lesson-doodles-risk.js';
import { MAKING_DECISIONS } from './lesson-doodles-decide.js';
import '../styles/lesson-doodles.css';

const M = x => (Math.abs(x) >= 1e6 ? compact(x) : money(x, 0));
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const lerp = (a, b, u) => a + (b - a) * u;
const ease = u => 1 - Math.pow(1 - clamp(u, 0, 1), 3);
const seg = (t, a, b) => clamp((t - a) / (b - a), 0, 1);
const f1 = x => x.toFixed(1);

/* ----- drawing primitives (y of text is its vertical centre) ----- */
const T = (x, y, s, o = {}) => `<text x="${f1(x)}" y="${f1(y)}" dy=".35em" text-anchor="${o.a || 'middle'}" font-size="${o.z || 14}" font-weight="${o.w || 700}"${o.f ? ` font-family="var(--display)" letter-spacing="-.03em"` : ''} fill="${o.c || 'var(--ink)'}"${o.halo ? ' stroke="var(--panel-solid)" stroke-width="4" paint-order="stroke" stroke-linejoin="round"' : ''}${o.op != null ? ` opacity="${o.op}"` : ''}>${esc(s)}</text>`;
const R = (x, y, w, hh, f, o = {}) => (w <= 0.2 || hh <= 0.2 ? '' : `<rect x="${f1(x)}" y="${f1(y)}" width="${f1(w)}" height="${f1(hh)}" rx="${f1(Math.min(o.r == null ? 8 : o.r, w / 2, hh / 2))}" fill="${f}"${o.stroke ? ` stroke="${o.stroke}" stroke-width="${o.sw || 1.5}"` : ''}${o.dash ? ' stroke-dasharray="5 4"' : ''}${o.op != null ? ` opacity="${o.op}"` : ''}/>`);
const L = (x1, y1, x2, y2, c = 'var(--line)', w = 2, dash) => `<line x1="${f1(x1)}" y1="${f1(y1)}" x2="${f1(x2)}" y2="${f1(y2)}" stroke="${c}" stroke-width="${w}" stroke-linecap="round"${dash ? ' stroke-dasharray="5 5"' : ''}/>`;
const C = (x, y, r, f, o = {}) => `<circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(Math.max(0, r))}" fill="${f}"${o.stroke ? ` stroke="${o.stroke}" stroke-width="${o.sw || 2}"` : ''}${o.op != null ? ` opacity="${o.op}"` : ''}/>`;
const chip = (cx, cy, s, bg = 'var(--soft)', fg = 'var(--ink)', z = 13) => { const w = s.length * z * 0.62 + 22; return R(cx - w / 2, cy - 14, w, 28, bg, { r: 14 }) + T(cx, cy, s, { z, c: fg }); };
const GOLD = '#FFD45C', GOLD_INK = '#5C3F00';
const prog = (t, W, H, label) => { const pad = Math.max(18, W * 0.06); return R(pad, H - 14, W - 2 * pad, 6, 'var(--soft)', { r: 3 }) + R(pad, H - 14, (W - 2 * pad) * t, 6, 'var(--c1)', { r: 3 }) + T(pad, H - 32, label, { a: 'start', z: 12.5, w: 600, c: 'var(--mute)' }); };
const legend = (items, x, y, maxW = 1e9) => { let g = '', cx = x, cy = y; items.forEach(([c, s]) => { const w = 16 + s.length * 7 + 18; if (cx + w - 18 > maxW && cx > x) { cx = x; cy += 18; } g += C(cx + 5, cy, 5, c) + T(cx + 16, cy, s, { a: 'start', z: 12.5, w: 600 }); cx += w; }); return g; };

export const SCENES = {
  rent: {
    chapter: 'Money and time', title: 'Interest is rent for money', plain: 'When you borrow money, you pay a little extra. That extra is called interest.',
    how: ['Sam has money and lends it to Alex.', 'Alex uses it for a year.', 'Alex pays back the loan plus a fee. The fee is the interest.'],
    words: [['Interest', 'The fee for borrowing money.'], ['Interest rate', 'The fee as a percent of the loan, each year.'], ['Principal', 'The money you borrowed.']],
    params: [{ id: 'amount', label: 'Amount lent', min: 100, max: 5000, step: 100, v: 1000, fmt: M }, { id: 'rate', label: 'Interest rate per year', min: 1, max: 20, step: 1, v: 8, fmt: x => x + '%' }], link: '/rates',
    doodle: true, draw: MONEY_AND_TIME.rent
  },
  growth: {
    chapter: 'Money and time', title: 'Money grows while it waits', plain: 'Money in the bank earns interest. Money in a jar does not. Over time the gap gets big.',
    how: ['You start with some money and add a little each year.', 'The jar keeps it safe, but it never grows.', 'The bank pays interest, so the green part gets taller every year.'],
    words: [['Savings', 'Money you set aside.'], ['Return', 'The extra money your money earns.'], ['Time', 'The more time, the more growth. Start early.']],
    params: [{ id: 'start', label: 'Start with', min: 0, max: 10000, step: 500, v: 1000, fmt: M }, { id: 'add', label: 'Add each year', min: 0, max: 5000, step: 100, v: 600, fmt: M }, { id: 'rate', label: 'Bank pays per year', min: 1, max: 12, step: 0.5, v: 6, fmt: x => x + '%' }, { id: 'years', label: 'For how many years', min: 5, max: 40, step: 1, v: 25, fmt: x => x + ' yrs' }], link: '/tvm',
    doodle: true, draw: MONEY_AND_TIME.growth
  },
  snowball: {
    chapter: 'Money and time', title: 'The money snowball (compounding)', plain: 'Compounding means interest earns more interest. Each year the pile grows by more than the year before.',
    how: ['Year 1: interest is paid on your starting money (green).', 'Year 2: interest is paid on your money and on last year\'s interest (coral).', 'Each year the coral slice gets bigger, so the bars climb faster.'],
    words: [['Compounding', 'Earning interest on your interest.'], ['Simple interest', 'Interest on the starting money only.'], ['Rule of 72', 'Divide 72 by the rate. You get the years to double your money.']],
    params: [{ id: 'start', label: 'Start with', min: 500, max: 20000, step: 500, v: 5000, fmt: M }, { id: 'rate', label: 'Interest per year', min: 1, max: 15, step: 0.5, v: 8, fmt: x => x + '%' }, { id: 'years', label: 'Years', min: 5, max: 40, step: 1, v: 30, fmt: x => x + ' yrs' }], link: '/rates',
    doodle: true, draw: MONEY_AND_TIME.snowball
  },
  inflation: {
    chapter: 'Money and time', title: 'Prices go up, so money shrinks', plain: 'Inflation means things cost more each year. The same money buys less and less.',
    how: ['Today a basket of groceries costs $100.', 'Each year the price creeps up by the inflation rate.', 'Your $100 now buys only part of that basket. Your money lost buying power.'],
    words: [['Inflation', 'Prices rising over time.'], ['Buying power', 'How much your money can actually buy.'], ['Real return', 'What you earned after prices went up.']],
    params: [{ id: 'infl', label: 'Inflation per year', min: 1, max: 12, step: 0.5, v: 4, fmt: x => x + '%' }, { id: 'years', label: 'Years', min: 5, max: 40, step: 1, v: 20, fmt: x => x + ' yrs' }], link: '/rates',
    doodle: true, draw: MONEY_AND_TIME.inflation
  },
  present: {
    chapter: 'Money and time', title: 'Money later is worth less today', plain: '$1,000 promised in ten years is worth less than $1,000 today. Money you hold now can earn interest.',
    how: ['The dashed bar is the amount you are promised later.', 'The solid bar is what that promise is worth today.', 'The longer you wait, the more it shrinks. The coral bar at the left adds up what it is all worth today.'],
    words: [['Present value', 'What future money is worth today.'], ['Discount rate', 'How fast future money shrinks when you bring it back to today.'], ['Future value', 'What today\'s money will be worth later.']],
    params: [{ id: 'amount', label: 'Money you will get', min: 100, max: 5000, step: 100, v: 1000, fmt: M }, { id: 'years', label: 'In how many years', min: 1, max: 30, step: 1, v: 10, fmt: x => x + ' yrs' }, { id: 'rate', label: 'Discount rate', min: 1, max: 20, step: 0.5, v: 6, fmt: x => x + '%' }], link: '/annuity',
    doodle: true, draw: MONEY_AND_TIME.present
  },
  exchange: {
    chapter: 'Money and time', title: 'Swapping money between countries', plain: 'To use another country\'s money, you swap yours at an exchange rate. The fair rate for later depends on the gap in interest rates, so nobody gets free money.',
    how: ['You swap your money for foreign money at today\'s rate.', 'Each pile grows at its own country\'s interest rate.', 'Swapping back at the fair future rate gives the same result as staying home. No free money.'],
    words: [['Exchange rate', 'The price of one currency in another.'], ['Forward rate', 'A rate you agree today for swapping later.'], ['Parity', 'The fair price that leaves no free money.']],
    params: [{ id: 'S', label: 'Rate today (home per 1 foreign)', min: 0.5, max: 2, step: 0.01, v: 1.08, fmt: x => nf(x, 2) }, { id: 'id', label: 'Home interest rate', min: 0, max: 10, step: 0.5, v: 5, fmt: x => x + '%' }, { id: 'if', label: 'Foreign interest rate', min: 0, max: 10, step: 0.5, v: 3, fmt: x => x + '%' }, { id: 'T', label: 'Years ahead', min: 1, max: 5, step: 1, v: 1, fmt: x => x + ' yr' }], link: '/fx',
    doodle: true, draw: MONEY_AND_TIME.exchange
  },
  loan: {
    chapter: 'Borrowing and lending', title: 'How a loan gets paid off', plain: 'Each payment has two parts: interest for the bank, and money that reduces what you owe. At first, most is interest.',
    how: ['The tank on the left is what you still owe.', 'Each month you pay. The bank takes its interest first (rose).', 'The rest (green) empties the tank. As the tank drops, the interest shrinks.'],
    words: [['Loan balance', 'What you still owe.'], ['Principal', 'The part of a payment that cuts what you owe.'], ['Mortgage', 'A loan to buy a home.']],
    params: [{ id: 'amt', label: 'Loan amount', min: 5000, max: 500000, step: 5000, v: 200000, fmt: M }, { id: 'apr', label: 'Interest rate', min: 1, max: 15, step: 0.25, v: 6.5, fmt: x => x + '%' }, { id: 'years', label: 'Years to repay', min: 1, max: 40, step: 1, v: 30, fmt: x => x + ' yrs' }], link: '/loan',
    doodle: true, draw: BORROWING_AND_LENDING.loan
  },
  bond: {
    chapter: 'Borrowing and lending', title: 'A bond is an IOU that pays you', plain: 'A bond is a loan you give to a company or government. They pay you a little every year and return your money at the end.',
    how: ['You lend $1,000 by buying the bond.', 'Every year you get a small payment, called a coupon.', 'At the end you get your $1,000 back. You end up with more than you lent.'],
    words: [['Bond', 'A loan you make to a company or government.'], ['Coupon', 'The yearly payment the bond pays you.'], ['Maturity', 'The day you get your loan back.']],
    params: [{ id: 'face', label: 'You lend', min: 500, max: 5000, step: 500, v: 1000, fmt: M }, { id: 'cr', label: 'Yearly payment rate', min: 1, max: 12, step: 0.5, v: 5, fmt: x => x + '%' }, { id: 'years', label: 'Years', min: 2, max: 10, step: 1, v: 5, fmt: x => x + ' yrs' }], link: '/bond',
    doodle: true, draw: BORROWING_AND_LENDING.bond
  },
  stock: {
    chapter: 'Owning things', title: 'A stock is a slice of a company', plain: 'A stock means you own a small slice of a real business. When the business earns money, your slice earns too.',
    how: ['The pie is the whole company, cut into 10 equal slices.', 'You own some slices (green).', 'When the company shares its profit, each slice gets the same. That payout is a dividend.'],
    words: [['Stock (share)', 'One slice of a company that you own.'], ['Dividend', 'Profit a company pays to its owners.'], ['Shareholder', 'A person who owns shares.']],
    params: [{ id: 'own', label: 'Slices you own (of 10)', min: 1, max: 5, step: 1, v: 2, fmt: x => x }, { id: 'profit', label: 'Company profit', min: 10000, max: 1000000, step: 10000, v: 200000, fmt: M }], link: '/ddm',
    doodle: true, draw: OWNING_AND_RISK.stock
  },
  leverage: {
    chapter: 'Owning things', title: 'Borrowing makes wins and losses bigger', plain: 'Using borrowed money (leverage) makes your gains bigger when things go well. It makes your losses bigger when they do not.',
    how: ['Two people buy the same $100 house. One pays cash (blue). One borrows part of it (rose).', 'The house price changes. A gain shows in green, a loss as a dashed red gap.', 'Compare each gain or loss with the money each person put in. The borrower swings more.'],
    words: [['Leverage', 'Using borrowed money to invest.'], ['Equity', 'The part you own with your own money.'], ['Debt', 'Money you owe.']],
    params: [{ id: 'debt', label: 'Share borrowed', min: 10, max: 90, step: 10, v: 60, fmt: x => x + '%' }, { id: 'change', label: 'House price change', min: -30, max: 30, step: 5, v: 20, fmt: x => (x > 0 ? '+' : '') + x + '%' }, { id: 'rate', label: 'Loan interest', min: 0, max: 10, step: 1, v: 5, fmt: x => x + '%' }], link: '/capstruct',
    doodle: true, draw: OWNING_AND_RISK.leverage
  },
  risk: {
    chapter: 'Risk', title: 'More risk, bumpier ride', plain: 'Investments that can earn more also jump up and down more. Safe ones are steady but grow slowly.',
    how: ['Three roads, each starting with $100.', 'Savings are smooth and slow. Stocks swing a lot but often climb higher over 20 years.', 'Each time you play it, you get a different future. The bumps change, the pattern stays.'],
    words: [['Risk', 'How much the value can jump up and down.'], ['Return', 'How much it grows on average.'], ['Volatility', 'How much a price jumps up and down.']],
    params: [], seeded: true, link: '/returns',
    doodle: true, draw: OWNING_AND_RISK.risk
  },
  diversify: {
    chapter: 'Risk', title: 'Do not put all your eggs in one basket', plain: 'Spread your money across many things. Then one bad thing cannot ruin you.',
    how: ['Both rows start with the same $1,000, split equally into blocks.', 'The top row puts everything in one company. The bottom row spreads it over six.', 'Then one company goes bust. The top row loses everything. The bottom row loses one small block.'],
    words: [['Diversification', 'Spreading your money across many investments.'], ['Portfolio', 'All your investments together.'], ['Bankruptcy', 'When a company fails and its stock is worth nothing.']],
    params: [{ id: 'n', label: 'Companies in the bottom row', min: 1, max: 5, step: 1, v: 4, fmt: x => [1, 2, 3, 4, 6, 12][x] }], link: '/portfolio',
    doodle: true, draw: OWNING_AND_RISK.diversify
  },
  beta: {
    chapter: 'Risk', title: 'Beta: how jumpy is a stock?', plain: 'Beta shows how much a stock moves when the whole market moves. Beta 2 means it moves twice as much.',
    how: ['The grey line is the whole stock market.', 'The coloured line is one stock with a beta of 1.5, so it moves 1.5 times as much.', 'Beta 1 copies the market. Above 1 moves more. Below 1 moves less.'],
    words: [['Beta', 'How much a stock moves compared with the market.'], ['Market', 'All stocks together.'], ['Defensive stock', 'A stock that moves less than the market (beta below 1).']],
    params: [{ id: 'beta', label: 'Beta of the stock', min: 0, max: 2.5, step: 0.1, v: 1.5, fmt: x => nf(x, 1) }], seeded: true, link: '/capm',
    doodle: true, draw: OWNING_AND_RISK.beta
  },
  mix2: {
    chapter: 'Risk', title: 'Mixing investments calms the ride', plain: 'When one investment falls while the other rises, mixing them smooths the bumps.',
    how: ['Two investments, A (jumpy) and B (calmer).', 'Here they are unrelated (0): sometimes one rises while the other falls.', 'The dark line is your mix. The less they move together, the calmer it is.'],
    words: [['Correlation', 'Do two things move together? +1 yes, −1 opposite.'], ['Blend', 'Putting money in both.'], ['Standard deviation', 'A number for how bumpy something is (how far results land from the average).']],
    params: [{ id: 'rho', label: 'How much A and B move together', min: -1, max: 1, step: 0.1, v: 0, fmt: x => nf(x, 1) }, { id: 'wA', label: 'Share in A', min: 0, max: 100, step: 10, v: 50, fmt: x => x + '%' }], seeded: true, link: '/portfolio',
    doodle: true, draw: OWNING_AND_RISK.mix2
  },
  journey: {
    chapter: 'Risk', title: 'Ups and downs cost more than they give', plain: 'Gain 50%, then lose 50%, and you are not back to even. The loss is taken from a bigger amount, so it hurts more.',
    how: ['Start with $100.', 'Gain 50%: you have $150.', 'Lose 50%: you have $75. The average is 0%, but you are down 25%.'],
    words: [['Average return', 'The simple average of yearly returns.'], ['Compound return', 'What you really earned, with each year building on the last.'], ['Drawdown', 'A fall from the highest point.']],
    params: [{ id: 'swing', label: 'Size of the gain and loss', min: 10, max: 90, step: 10, v: 50, fmt: x => x + '%' }], link: '/returns',
    doodle: true, draw: OWNING_AND_RISK.journey
  },
  npv: {
    chapter: 'Making decisions', title: 'Is this project worth doing?', plain: 'Add up what you will get later, shrunk to today\'s value. Compare it with what you pay now. If you get more, do it.',
    how: ['The rose bar is what you pay today.', 'Each future payment is shrunk to today\'s value and stacked in the green bar.', 'If the green bar goes above the dashed line, the project is worth it. The gap is called NPV.'],
    words: [['NPV', 'Net present value: what you gain, in today\'s money.'], ['Hurdle rate', 'The least return that makes the project worth it.'], ['Investment', 'Money spent now to earn more later.']],
    params: [{ id: 'cost', label: 'Cost today', min: 50, max: 500, step: 10, v: 100, fmt: M }, { id: 'pay', label: 'You get each year', min: 10, max: 200, step: 5, v: 40, fmt: M }, { id: 'rate', label: 'Return you need', min: 1, max: 25, step: 1, v: 10, fmt: x => x + '%' }], link: '/capbud',
    doodle: true, draw: MAKING_DECISIONS.npv
  },
  blend: {
    chapter: 'Making decisions', title: 'What return does a company need?', plain: 'Owners and lenders fund a company. Each wants a return. The company must earn the average of both, based on how much each put in.',
    how: ['The bar widths show who funds the company: owners (blue) and lenders (yellow).', 'Owners want a higher return because they take more risk.', 'The dashed line is the blended average. A new project must beat it.'],
    words: [['Cost of capital', 'The return a company must earn to keep its funders happy.'], ['Equity', 'Money put in by owners.'], ['Debt', 'Money borrowed from lenders.']],
    params: [{ id: 'wE', label: 'Share funded by owners', min: 10, max: 100, step: 5, v: 70, fmt: x => x + '%' }, { id: 'ke', label: 'Return owners want', min: 4, max: 20, step: 0.5, v: 10.5, fmt: x => x + '%' }, { id: 'kd', label: 'Return lenders want (after tax)', min: 1, max: 12, step: 0.5, v: 4.5, fmt: x => x + '%' }], link: '/wacc',
    doodle: true, draw: MAKING_DECISIONS.blend
  },
  breakeven: {
    chapter: 'Making decisions', title: 'When does a business start to profit?', plain: 'First you earn back fixed costs, like rent. After that, each sale is real profit.',
    how: ['Each cup of lemonade earns a little after the cost of its ingredients.', 'That small amount slowly fills the rent bar.', 'When the rent bar is full, you break even. Every cup after that is profit.'],
    words: [['Fixed costs', 'Bills you pay no matter how much you sell.'], ['Break-even', 'The point where you stop losing money.'], ['Margin', 'What is left of a sale after its own cost.']],
    params: [{ id: 'price', label: 'Price per cup', min: 2, max: 10, step: 0.5, v: 5, fmt: x => '$' + x }, { id: 'cost', label: 'Cost per cup', min: 0.5, max: 8, step: 0.5, v: 2, fmt: x => '$' + x }, { id: 'fixed', label: 'Fixed costs (rent)', min: 100, max: 2000, step: 50, v: 300, fmt: M }], link: '/breakeven',
    doodle: true, draw: MAKING_DECISIONS.breakeven
  },
  cycle: {
    chapter: 'Making decisions', title: 'Where does the cash get stuck?', plain: 'A shop pays for goods, waits to sell them, then waits to be paid. During that wait, its cash is stuck.',
    how: ['Goods sit on the shelf until they sell (blue).', 'Customers take time to pay (green).', 'Suppliers give you time to pay (yellow). The time not covered is when your cash is stuck (rose).'],
    words: [['Inventory', 'Goods waiting to be sold.'], ['Receivables', 'Money customers still owe you.'], ['Cash cycle', 'Days your cash is stuck in the business.']],
    params: [{ id: 'dio', label: 'Days goods sit on the shelf', min: 5, max: 120, step: 5, v: 45, fmt: x => x }, { id: 'dso', label: 'Days customers take to pay', min: 5, max: 90, step: 5, v: 40, fmt: x => x }, { id: 'dpo', label: 'Days you take to pay suppliers', min: 5, max: 120, step: 5, v: 30, fmt: x => x }], link: '/wc',
    doodle: true, draw: MAKING_DECISIONS.cycle
  },
  merge: {
    chapter: 'Making decisions', title: 'Will a takeover help profit per share?', plain: 'When one company buys another, its profit grows, and so can its number of shares. It is a good deal if profit grows faster than shares.',
    how: ['Profit: the two companies\' profits add up.', 'Shares: new shares may be made to pay for the deal.', 'Profit per share = profit ÷ shares. Compare before and after.'],
    words: [['Profit per share', 'Company profit divided by the number of shares.'], ['Accretive', 'A deal that raises profit per share.'], ['Dilutive', 'A deal that lowers profit per share.']],
    params: [{ id: 'stock', label: 'Share paid with new stock', min: 0, max: 100, step: 10, v: 50, fmt: x => x + '%' }, { id: 'syn', label: 'Yearly savings from joining', min: 0, max: 100, step: 5, v: 20, fmt: x => '$' + x + 'M' }], link: '/merger',
    doodle: true, draw: MAKING_DECISIONS.merge
  },
  option: {
    chapter: 'Making decisions', title: 'An option: a ticket to buy at a fixed price', plain: 'You pay a small fee for the right to buy a stock at a set price. You do not have to buy. If the stock soars, you win. If not, you lose only the fee.',
    how: ['You pay a small fee for the ticket.', 'The ticket lets you buy at the strike price, whatever the stock does.', 'If the stock ends above the strike, the ticket is worth the difference. If below, it is worth nothing.'],
    words: [['Option', 'A ticket giving you the right to buy or sell.'], ['Strike price', 'The fixed price written on the ticket.'], ['Premium', 'The fee you pay for the ticket.']],
    params: [{ id: 'K', label: 'Strike price', min: 50, max: 150, step: 5, v: 100, fmt: M }, { id: 'prem', label: 'Fee for the ticket', min: 1, max: 30, step: 1, v: 8, fmt: M }], link: '/options',
    doodle: true, draw: MAKING_DECISIONS.option
  }
  ,
  average: {
    chapter: 'Chance and numbers', title: 'Average or typical?', plain: 'One very big number can pull the average far from what is typical. The middle value barely moves.',
    how: ['Ten values, each shown as a dot on a line.', 'The average (coral) is the total shared out equally.', 'The middle value (green) is the one in the exact centre. One dot is far bigger than the rest, so only the average gets pulled.'],
    words: [['Average (mean)', 'Add everything up. Divide by how many there are.'], ['Median', 'The middle value when you put them in order.'], ['Outlier', 'A value far away from the rest.']],
    params: [{ id: 'big', label: 'The biggest value', min: 55, max: 500, step: 5, v: 400, fmt: x => '$' + x + 'k' }], link: '/stats',
    doodle: true, draw: CHANCE_AND_NUMBERS.average
  },
  spread: {
    chapter: 'Chance and numbers', title: 'Spread: how bumpy is it?', plain: 'Two things can have the same average and still feel very different. The spread (standard deviation) shows how bumpy.',
    how: ['Two investments both average 7% a year.', 'Each dot is one year. The shaded band is one spread either side of the average.', 'The bumpy lane has a wide band. Results land far from the average.'],
    words: [['Standard deviation', 'A typical distance from the average. Bigger means bumpier.'], ['Volatility', 'How much returns jump up and down.'], ['Variance', 'The spread multiplied by itself.']],
    params: [{ id: 'wild', label: 'How wild the bumpy lane is', min: 6, max: 30, step: 1, v: 18, fmt: x => '±' + x + '%' }], seeded: true, link: '/stats',
    doodle: true, draw: CHANCE_AND_NUMBERS.spread
  },
  bell: {
    chapter: 'Chance and numbers', title: 'The bell curve: 68, 95, 99.7', plain: 'Many things follow a bell shape. With the average and the spread, you can tell how likely a result is.',
    how: ['Most results land near the average, in the middle of the bell.', 'About 68 in 100 land within one spread of the average.', 'About 95 land within two spreads, and almost all (99.7) within three.'],
    words: [['Normal distribution', 'The bell-shaped pattern of results.'], ['Average (mean)', 'The centre of the bell.'], ['Standard deviation', 'How wide the bell is.']],
    params: [{ id: 'mean', label: 'Average yearly return', min: 0, max: 15, step: 1, v: 8, fmt: x => x + '%' }, { id: 'sd', label: 'Spread', min: 5, max: 30, step: 1, v: 15, fmt: x => '±' + x + '%' }], link: '/normal',
    doodle: true, draw: CHANCE_AND_NUMBERS.bell
  },
  tail: {
    chapter: 'Chance and numbers', title: 'The chance of a big loss', plain: 'With the average and the spread, you can estimate how likely a bad year is. Banks use this to measure risk.',
    how: ['The bell shows how likely each yearly return is.', 'The red line slides toward a bad loss.', 'The shaded area to its left is the chance of a year that bad or worse.'],
    words: [['Probability', 'How likely something is, from 0% to 100%.'], ['Tail risk', 'The chance of a very bad result.'], ['Value at Risk', 'A loss that happens only a few times in 100.']],
    params: [{ id: 'mean', label: 'Average yearly return', min: 0, max: 15, step: 1, v: 7, fmt: x => x + '%' }, { id: 'sd', label: 'Spread', min: 5, max: 30, step: 1, v: 16, fmt: x => '±' + x + '%' }, { id: 'cut', label: 'A loss that worries you', min: -50, max: -5, step: 5, v: -20, fmt: x => x + '%' }], link: '/normal',
    doodle: true, draw: CHANCE_AND_NUMBERS.tail
  },
  expected: {
    chapter: 'Chance and numbers', title: 'Expected value: the fair price of a bet', plain: 'Multiply each possible result by its chance, then add them up. That is what a bet, a stock or a project is worth on average.',
    how: ['Each bar is one outcome. Wider means more likely, taller means bigger.', 'Green is a gain, rose is a loss.', 'The dashed line is the expected value: the average per try if you could repeat it many times.'],
    words: [['Probability', 'The chance of one result.'], ['Expected value', 'Each result × its chance, added up.'], ['Risk', 'Real results can be very different from the expected value.']],
    params: [{ id: 'pwin', label: 'Chance of winning', min: 10, max: 90, step: 5, v: 40, fmt: x => x + '%' }, { id: 'win', label: 'Win amount', min: 20, max: 200, step: 10, v: 100, fmt: M }, { id: 'lose', label: 'Loss amount', min: 10, max: 100, step: 10, v: 50, fmt: M }], link: '/prob',
    doodle: true, draw: CHANCE_AND_NUMBERS.expected
  },
  lawlarge: {
    chapter: 'Chance and numbers', title: 'More tries, more predictable', plain: 'A few flips can be lucky or unlucky. After many tries, the result gets close to the true chance.',
    how: ['Each flip is heads or tails. The line shows the share of heads so far.', 'At first it swings wildly.', 'After many flips it settles near the true chance (dashed line).'],
    words: [['Law of large numbers', 'With more tries, the result gets close to the true chance.'], ['Sample size', 'How many tries you have.'], ['Luck', 'Random ups and downs that even out over time.']],
    params: [{ id: 'p', label: 'True chance of heads', min: 10, max: 90, step: 5, v: 50, fmt: x => x + '%' }], seeded: true, link: '/prob',
    doodle: true, draw: CHANCE_AND_NUMBERS.lawlarge
  },
  correlation: {
    chapter: 'Chance and numbers', title: 'Correlation: do two things move together?', plain: 'Correlation is a score from −1 to +1. It shows if two things rise and fall together, or not at all.',
    how: ['Each dot is one moment: the value of A (across) and B (up).', 'Dots in a tight rising line mean +1: they move together.', 'A shapeless cloud means 0, and a falling line means −1: opposite.'],
    words: [['Correlation', 'A score from −1 to +1 for moving together.'], ['Positive', 'Both rise and fall together.'], ['Diversify', 'Spread your money across things with low correlation to calm the ride.']],
    params: [{ id: 'r', label: 'How much they move together', min: -1, max: 1, step: 0.1, v: 0.7, fmt: x => nf(x, 1) }], seeded: true, link: '/corr',
    doodle: true, draw: CHANCE_AND_NUMBERS.correlation
  },
  regression: {
    chapter: 'Chance and numbers', title: 'Beta is a slope', plain: 'Plot a stock\'s moves against the market\'s moves. The slope (steepness) of the line through the dots is the stock\'s beta.',
    how: ['Each dot is one month: how far the market moved (across) and the stock (up).', 'The best-fit line runs through the middle of the dots.', 'Its slope is beta: how much the stock moves for each 1% the market moves.'],
    words: [['Beta', 'How steeply a stock moves when the market moves.'], ['Regression', 'Drawing the best straight line through dots.'], ['R-squared', 'How close the dots sit to the line.']],
    params: [{ id: 'beta', label: 'The stock\'s beta', min: -0.5, max: 2.5, step: 0.1, v: 1.5, fmt: x => nf(x, 1) }], seeded: true, link: '/corr',
    doodle: true, draw: CHANCE_AND_NUMBERS.regression
  },
  montecarlo: {
    chapter: 'Chance and numbers', title: 'Risk simulation: try many futures', plain: 'Nobody knows the future. So we try many random futures and see where they end. This is a Monte Carlo simulation.',
    how: ['Each line is one possible future for $100 invested.', 'Every year gets a random result, using the average and spread.', 'The pile of end points on the right shows the range of what could happen.'],
    words: [['Simulation', 'Trying many made-up futures on a computer.'], ['Monte Carlo', 'A simulation that uses random numbers.'], ['Range of outcomes', 'From a bad future to a good one.']],
    params: [{ id: 'vol', label: 'How bumpy (spread)', min: 5, max: 35, step: 1, v: 18, fmt: x => '±' + x + '%' }], seeded: true, link: '/scenarios',
    doodle: true, draw: CHANCE_AND_NUMBERS.montecarlo
  }
};

/** Which moment of each story to show while the picture is at rest (1 = the finished frame). */
const POSTER = { loan: 0.4, growth: 0.7, inflation: 0.75, breakeven: 0.6, cycle: 0.85, rent: 0.9, spread: 0.75, risk: 0.85, snowball: 0.85 };

export const SCENE_ORDER = ['rent', 'growth', 'snowball', 'inflation', 'present', 'exchange', 'loan', 'bond', 'stock', 'leverage', 'risk', 'diversify', 'beta', 'mix2', 'journey', 'npv', 'blend', 'breakeven', 'cycle', 'merge', 'option', 'average', 'spread', 'bell', 'tail', 'expected', 'lawlarge', 'correlation', 'regression', 'montecarlo'];

/** Animated scene player with two modes.
 *  - mode "hover" (Learn page): sits still on its finished frame, plays while the pointer is over it (tap on touch).
 *  - mode "loop" (calculator pages): loops on its own while visible; one button switches on scrubbing and sliders.
 *  Draws at the stage's real pixel size; the caption box reserves the height of its longest caption. */
export class SceneView {
  constructor(host, id, { params = {}, external = false, mode = 'loop' } = {}) {
    this.sc = SCENES[id]; this.id = id; this.external = external; this.hover = mode === 'hover'; this.poster = POSTER[id] == null ? 1 : POSTER[id]; this.t = this.hover ? this.poster : 0; this.mode = 'watch';
    this.raf = 0; this.timer = 0; this.loopT = 0; this.playing = false; this.visible = this.hover; this.touched = false; this.active = false; this.plays = 0;
    this.p = { seed: 3, ...Object.fromEntries(this.sc.params.map(q => [q.id, q.v])), ...params };
    host.innerHTML = ''; host.classList.add('sv-wrap');
    this.stage = h('div', { class: 'sv-stage' + (this.sc.doodle ? ' dd-paper' : ''), role: 'img', 'aria-label': this.sc.title });
    this.cap = h('p', { class: 'sv-cap', 'aria-live': 'polite' });
    if (this.hover) this.buildHover(host); else this.buildLoop(host);
    if (typeof ResizeObserver !== 'undefined') { this.ob = new ResizeObserver(() => { const w = Math.floor(this.stage.clientWidth); if (w !== this.lastW) { this.lastW = w; requestAnimationFrame(() => { this.draw(); this.fitCaption(); }); } }); this.ob.observe(this.stage); }
    this.draw();
    requestAnimationFrame(() => this.fitCaption());
  }
  buildHover(host) {
    this.stage.tabIndex = 0; this.stage.classList.add('hoverable');
    host.append(h('div', { class: 'sv-frame' }, this.stage), this.cap);
    const start = () => {
      if (this.active) return;
      if (SceneView.current && SceneView.current !== this) SceneView.current.stopHover();
      SceneView.current = this; this.active = true;
      if (this.sc.seeded && this.plays++ > 0) { this.p.seed = (this.p.seed || 1) + 1; this.fitCaption(); }
      this.startWatch();
    };
    this.stage.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') start(); });
    this.stage.addEventListener('pointerdown', e => { if (e.pointerType !== 'mouse') start(); });
    this.stage.addEventListener('focus', start);
    /* once started it keeps playing until the reader moves on: another picture starts, or this one scrolls away */
    if ('IntersectionObserver' in window) { this.io = new IntersectionObserver(es => { if (!es[0].isIntersecting) this.stopHover(); }, { threshold: 0.15 }); this.io.observe(host); }
  }
  stopHover() {
    if (!this.active) return;
    this.active = false; this.halt(); this.t = this.poster; this.draw();
    if (SceneView.current === this) SceneView.current = null;
  }
  buildLoop(host) {
    this.btn = h('button', { class: 'btn play', type: 'button', onclick: () => this.setMode(this.mode === 'watch' ? 'explore' : 'watch') }, 'Make it interactive');
    this.hint = h('span', { class: 'sv-hint', hidden: true }, 'Move across the picture to explore');
    const ctl = h('div', { class: 'sv-ctl' }, this.btn, this.hint);
    if (this.sc.seeded) ctl.append(h('button', { class: 'btn small', type: 'button', onclick: () => { this.p.seed = (this.p.seed || 1) + 1; this.fitCaption(); if (this.mode === 'watch') this.startWatch(); else this.draw(); } }, 'Roll again'));
    this.sl = h('div', { class: 'sv-params', hidden: true });
    if (!this.external) this.sc.params.forEach(q => {
      const val = h('b', {}, q.fmt(this.p[q.id])), rs = rangeSlider({ min: q.min, max: q.max, step: q.step, value: this.p[q.id], label: q.label, fmt: q.fmt }), inp = rs.input;
      inp.addEventListener('input', () => { this.p[q.id] = +inp.value; val.textContent = q.fmt(+inp.value); this.draw(); clearTimeout(this.timer); this.timer = setTimeout(() => this.fitCaption(), 200); });
      this.sl.append(h('div', { class: 'sv-p' }, h('span', {}, q.label, val), rs.el));
    });
    host.append(this.stage, this.cap, ctl, this.sl);
    const scrub = e => {
      if (this.mode !== 'explore') return;
      if (e.pointerType !== 'mouse' && e.buttons === 0 && e.type === 'pointermove') return;
      const r = this.stage.getBoundingClientRect(), u = clamp(((e.clientX - r.left) / r.width - 0.04) / 0.92, 0, 1);
      this.t = u; this.draw();
      if (!this.touched) { this.touched = true; this.hint.classList.add('gone'); }
    };
    this.stage.addEventListener('pointermove', scrub);
    this.stage.addEventListener('pointerdown', e => { if (this.mode === 'explore' && e.pointerType !== 'mouse') { try { this.stage.setPointerCapture(e.pointerId); } catch (err) { /* not supported */ } } scrub(e); });
    if ('IntersectionObserver' in window) {
      this.io = new IntersectionObserver(es => {
        const vis = es[0].isIntersecting; if (vis === this.visible) return;
        this.visible = vis;
        if (vis) { if (this.mode === 'watch') setTimeout(() => this.startWatch(), 250); } else this.halt();
      }, { threshold: 0.35 });
      this.io.observe(host);
    } else { this.visible = true; this.startWatch(); }
  }
  setMode(m) {
    this.mode = m; this.halt();
    const ex = m === 'explore';
    this.btn.textContent = ex ? 'Back to watching' : 'Make it interactive';
    this.hint.hidden = !ex; this.stage.classList.toggle('scrub', ex);
    this.sl.hidden = !ex || this.external || !this.sc.params.length;
    if (ex) { this.t = reduced() ? 1 : Math.max(this.t, 0.001); this.draw(); } else this.startWatch();
  }
  halt() { cancelAnimationFrame(this.raf); clearTimeout(this.loopT); this.playing = false; }
  startWatch() {
    this.halt();
    if (this.mode !== 'watch' || !this.visible) return;
    if (reduced()) { this.t = 1; this.draw(); return; }
    const dur = this.sc.dur || 6500, t0 = performance.now(); this.t = 0; this.playing = true;
    const step = now => {
      const u = clamp((now - t0) / dur, 0, 1);
      this.t = u; this.draw();
      if (u < 1 && this.playing) this.raf = requestAnimationFrame(step);
      else if (u >= 1) { this.playing = false; this.loopT = setTimeout(() => this.startWatch(), 1800); }
    };
    this.raf = requestAnimationFrame(step);
  }
  /** A lever moved: show the finished picture at once. The story is not replayed from the start, so nobody waits for it to catch up. */
  setParams(p, replay = true) {
    Object.assign(this.p, p);
    if (replay && !this.hover && this.mode === 'watch') { this.halt(); clearTimeout(this.timer); this.t = 1; }
    this.draw(); this.fitCaption();
  }
  size() { const W = Math.max(280, Math.floor(this.stage.clientWidth) || 520); return { W, H: Math.round(clamp(W * 0.6, 270, 340)) }; }
  draw() {
    const { W, H } = this.size();
    let out;
    try { out = this.sc.draw(this.t, this.p, W, H); } catch (e) { out = { svg: '', cap: 'Could not draw this scene.' }; }
    this.stage.style.height = H + 'px';
    this.stage.innerHTML = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" class="sv-svg">${out.svg}</svg>`;
    say(this.cap, out.cap);
  }
  /** Reserve the height of the longest caption so the box never jumps while the story changes. */
  fitCaption() {
    const w = this.cap.clientWidth; if (!w || !this.cap.parentNode) return;
    const m = this.measure || (this.measure = h('p', { class: 'sv-cap sv-measure', 'aria-hidden': 'true' }));
    if (!m.isConnected) this.cap.parentNode.append(m);
    m.style.width = w + 'px';
    const { W, H } = this.size(); let max = 0;
    [0, 0.15, 0.3, 0.45, 0.6, 0.75, 0.9, 1].forEach(t => { let c = ''; try { c = this.sc.draw(t, this.p, W, H).cap; } catch (e) { /* ignore */ } m.textContent = c; max = Math.max(max, m.offsetHeight); });
    this.cap.style.minHeight = max + 'px';
  }
  destroy() { if (SceneView.current === this) SceneView.current = null; this.halt(); clearTimeout(this.timer); if (this.io) this.io.disconnect(); if (this.ob) this.ob.disconnect(); if (this.measure) this.measure.remove(); }
}
