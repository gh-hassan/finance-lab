// @ts-nocheck
/* Step-by-step lessons for the calculator page. Each step lists the exact keys, so the screen shown beside it is produced by the
   real calculator engine and the final answer is checked by a test. Keys are named as on the handheld. */
const LABEL = { N: 'N', IY: 'I/Y', PV: 'PV', PMT: 'PMT', FV: 'FV', CPT: 'CPT', ENTER: 'ENTER', UP: '↑', DOWN: '↓', NEG: '+/−', CF: 'CF', NPV: 'NPV', IRR: 'IRR', CLR: 'CE|C', '2ND': '2ND', EQ: '=' };

/** Press a key. */
export const K = id => ({ keys: [id], chip: LABEL[id] || id });
/** Press 2ND, then the key that carries this yellow label. `above` names the key it sits over when that is the same on every calculator. */
export const S = (id, name, above) => ({ keys: ['2ND', id], chip2: name, above });
/** Type a number. */
export const T = txt => ({ keys: [...String(txt)], type: String(txt) });
/** Plain words. */
export const W = text => ({ text });

const step = (...parts) => ({ parts });
const keysOf = s => s.parts.flatMap(p => p.keys || []);
export const stepKeys = keysOf;

/** The steps that set payments per year (P/Y) and compounding per year (C/Y). */
const setYearly = n => [
  step(W('Open the P/Y screen: press '), S('IY', 'P/Y', 'above I/Y'), W('.')),
  step(W('Type '), T(n), W(' and press '), K('ENTER'), W('. That is P/Y, the payments per year.')),
  step(W('Press '), K('DOWN'), W(' to move to C/Y. Type '), T(n), W(' and press '), K('ENTER'), W('.')),
  step(W('Leave this screen: press '), S('CPT', 'QUIT', 'above CPT'), W('.'))
];
const clearTvm = step(W('Clear old numbers: press '), S('FV', 'CLR TVM', 'above FV'), W('.'));

/** Steps that fill the cash flow list: -1000, then 300, 400, 500, 600. */
const flowSteps = [
  step(W('Open the cash flow list: press '), K('CF'), W('. The screen shows CF0, the money at the start.')),
  step(W('Type '), T('1000'), W(', press '), K('NEG'), W(', then '), K('ENTER'), W('. Then press '), K('DOWN'), W('.')),
  step(W('You are on C01, the first payback. Type '), T('300'), W(' and press '), K('ENTER'), W('.')),
  step(W('Press '), K('DOWN'), K('DOWN'), W(' (twice). The first press shows F01 (how many times it repeats, 1 is fine). The second moves to C02.')),
  step(W('Type '), T('400'), W(', press '), K('ENTER'), W(', then '), K('DOWN'), K('DOWN'), W(' (twice).')),
  step(W('Type '), T('500'), W(', press '), K('ENTER'), W(', then '), K('DOWN'), K('DOWN'), W(' (twice).')),
  step(W('Type '), T('600'), W(' and press '), K('ENTER'), W('.'))
];

export const BASICS = [
  ['Yellow words need 2ND.', 'Some keys have a yellow word above them. To use it, press 2ND first, then the key. In these lessons that looks like  2ND  P/Y.'],
  ['Money in is positive, money out is negative.', 'If you put $1,000 in, type 1000 then press +/− (the sign key). Money you get back shows without a minus sign.'],
  ['ENTER saves, CPT works it out.', 'On a worksheet screen, type a number and press ENTER to save it. To get an answer, move to that line and press CPT.'],
  ['↑ and ↓ move between lines.', 'Each worksheet is a list of lines. Use ↓ to go to the next one and ↑ to go back.'],
  ['2ND then QUIT leaves a worksheet.', 'QUIT is the yellow word above CPT. It takes you back to the normal calculator.'],
  ['Error 5 means there is no answer.', 'Check your numbers, and remember money in must be one sign and money out the other.']
];

export const EXAMPLES = [
  {
    title: 'How much will my savings grow?', level: 'Start here', expect: 'FV = 1,628.89',
    intro: 'You put $1,000 in the bank for 10 years at 5% a year. What is it worth at the end?',
    steps: [...setYearly(1), clearTvm,
      step(W('Type '), T('10'), W(' and press '), K('N'), W('. N is the number of years.')),
      step(W('Type '), T('5'), W(' and press '), K('IY'), W('. I/Y is the yearly interest rate.')),
      step(W('Type '), T('1000'), W(', press '), K('NEG'), W(', then press '), K('PV'), W('. PV is what you put in (negative, because it leaves your pocket).')),
      step(W('Type '), T('0'), W(' and press '), K('PMT'), W('. No yearly deposits.')),
      step(W('Now ask for the answer: press '), K('CPT'), W(' then '), K('FV'), W('.'))],
    after: 'FV is what you will have at the end: $1,628.89.'
  },
  {
    title: 'What is my monthly loan payment?', level: 'Start here', expect: 'PMT = -1,580.17',
    intro: 'A $250,000 loan for 30 years at 6.5% a year, paid every month.',
    steps: [...setYearly(12), clearTvm,
      step(W('Type '), T('30'), W(', then press '), S('N', 'xP/Y', 'above N'), W('. This turns 30 years into 360 monthly payments.')),
      step(W('Type '), T('6.5'), W(' and press '), K('IY'), W('.')),
      step(W('Type '), T('250000'), W(' and press '), K('PV'), W('. The loan is money you receive, so it is positive.')),
      step(W('Type '), T('0'), W(' and press '), K('FV'), W('. The loan ends at zero.')),
      step(W('Press '), K('CPT'), W(' then '), K('PMT'), W('.'))],
    after: 'The payment is negative because you pay it out: $1,580.17 a month.'
  },
  {
    title: 'What interest rate do I need?', level: 'Easy', expect: 'I/Y = 7.18',
    intro: 'You want $1,000 to turn into $2,000 in 10 years. What yearly rate does that take?',
    steps: [...setYearly(1), clearTvm,
      step(W('Type '), T('10'), W(', press '), K('N'), W('.')),
      step(W('Type '), T('1000'), W(', press '), K('NEG'), W(', then '), K('PV'), W('.')),
      step(W('Type '), T('2000'), W(', press '), K('FV'), W('.')),
      step(W('Type '), T('0'), W(', press '), K('PMT'), W('.')),
      step(W('Press '), K('CPT'), W(' then '), K('IY'), W('.'))],
    after: 'About 7.18% a year.'
  },
  {
    title: 'How long until I reach my goal?', level: 'Easy', expect: 'N = 9.01',
    intro: 'Your $1,000 earns 8% a year. How many years until it doubles to $2,000?',
    steps: [...setYearly(1), clearTvm,
      step(W('Type '), T('8'), W(', press '), K('IY'), W('.')),
      step(W('Type '), T('1000'), W(', press '), K('NEG'), W(', then '), K('PV'), W('.')),
      step(W('Type '), T('2000'), W(', press '), K('FV'), W('.')),
      step(W('Type '), T('0'), W(', press '), K('PMT'), W('.')),
      step(W('Press '), K('CPT'), W(' then '), K('N'), W('.'))],
    after: 'About 9 years.'
  },
  {
    title: 'Is this project worth it? (NPV)', level: 'Next step', expect: 'NPV = 388.77',
    intro: 'A project costs $1,000 and pays back $300, $400, $500 and $600 over four years. Your required return is 10%.',
    steps: [...flowSteps,
      step(W('Now press '), K('NPV'), W('. Type '), T('10'), W(' (your required return) and press '), K('ENTER'), W('.')),
      step(W('Press '), K('DOWN'), W(' to reach the NPV line, then press '), K('CPT'), W('.'))],
    after: 'A positive NPV means the project earns more than 10%, so it is worth doing: about $388.77.'
  },
  {
    title: 'What return does the project earn? (IRR)', level: 'Next step', expect: 'IRR = 24.89',
    intro: 'Same project as the NPV lesson. Enter the cash flows, then ask for the IRR. If they are already saved in your calculator, skip straight to the last two steps.',
    steps: [...flowSteps,
      step(W('Press '), K('IRR'), W('.')),
      step(W('Press '), K('CPT'), W('.'))],
    after: 'The project earns about 24.89% a year.'
  },
  {
    title: 'How much of my payment is interest? (Amortization)', level: 'Next step', expect: 'INT = -1,354.17',
    intro: 'Use the loan from the monthly payment lesson. See what the very first payment is made of.',
    steps: [...setYearly(12), clearTvm,
      step(W('Type '), T('30'), W(', '), S('N', 'xP/Y', 'above N'), W('. Type '), T('6.5'), W(', '), K('IY'), W('. Type '), T('250000'), W(', '), K('PV'), W('. Type '), T('0'), W(', '), K('FV'), W('.')),
      step(W('Press '), K('CPT'), W(' then '), K('PMT'), W(' so the payment is saved.')),
      step(W('Open the amortization list: press '), S('PV', 'AMORT', 'above PV'), W('.')),
      step(W('P1 is the first payment you want to look at. Type '), T('1'), W(' and press '), K('ENTER'), W('. Press '), K('DOWN'), W('.')),
      step(W('P2 is the last one. Type '), T('1'), W(' and press '), K('ENTER'), W('. Press '), K('DOWN'), W('.')),
      step(W('BAL is what you still owe after that payment. Press '), K('DOWN'), W(' for PRN (principal paid), and '), K('DOWN'), W(' again for INT (interest paid).'))],
    after: 'Of the first $1,580.17 payment, $1,354.17 is interest and only $226.00 reduces the loan.'
  },
  {
    title: 'What is this bond worth?', level: 'Advanced', expect: 'PRI = 94.63',
    intro: 'A bond pays a 5.75% coupon and matures on 15 Nov 2017. You buy it on 15 Feb 2008 and want a 6.5% yield. Dates are typed as month, a dot, day and two-digit year: 15 Feb 2008 is 2.1508.',
    steps: [
      step(W('Open the bond list: press '), S('4', 'BOND')),
      step(W('SDT is the settlement (buy) date. Type '), T('2.1508'), W(' and press '), K('ENTER'), W('. Press '), K('DOWN'), W('.')),
      step(W('CPN is the coupon. Type '), T('5.75'), W(' and press '), K('ENTER'), W('. Press '), K('DOWN'), W('.')),
      step(W('RDT is the maturity date. Type '), T('11.1517'), W(' and press '), K('ENTER'), W('. Press '), K('DOWN'), W('.')),
      step(W('RV is the redemption value. Leave it at 100. Press '), K('DOWN'), W('.')),
      step(W('This line shows ACT or 360 (how days are counted). Press '), S('ENTER', 'SET', 'above ENTER'), W(' once to choose 360. Press '), K('DOWN'), W('.')),
      step(W('This line shows 2/Y (coupons twice a year). Leave it. Press '), K('DOWN'), W('.')),
      step(W('YLD is your required yield. Type '), T('6.5'), W(' and press '), K('ENTER'), W('. Press '), K('DOWN'), W('.')),
      step(W('You are on PRI, the price. Press '), K('CPT'), W('.'))],
    after: 'The bond is worth about 94.63 for every 100 of face value. To go the other way, type a price on the PRI line, move up to YLD and press CPT.'
  },
  {
    title: 'How much does an asset lose each year? (Depreciation)', level: 'Advanced', expect: 'DEP = 1,800.00',
    intro: 'A machine costs $10,000, will be worth $1,000 after 5 years, and loses the same amount every year (straight line).',
    steps: [
      step(W('Open the depreciation list: press '), S('5', 'DEPR')),
      step(W('The first line shows SL (straight line). Press '), K('DOWN'), W('.')),
      step(W('LIF is the life in years. Type '), T('5'), W(', press '), K('ENTER'), W('. Press '), K('DOWN'), K('DOWN'), W(' (twice: the line in between is M01, leave it).')),
      step(W('CST is the cost. Type '), T('10000'), W(', press '), K('ENTER'), W('. Press '), K('DOWN'), W('.')),
      step(W('SAL is the value at the end. Type '), T('1000'), W(', press '), K('ENTER'), W('. Press '), K('DOWN'), W('.')),
      step(W('YR is the year you want to see. Type '), T('1'), W(', press '), K('ENTER'), W('. Press '), K('DOWN'), W('.'))],
    after: 'DEP is the depreciation for that year: $1,800. Keep pressing ↓ to see RBV (value left) and RDV (amount left to depreciate). To try another method, go back to the first line and press SET.'
  }
];

export const TIPS = [
  ['Start fresh', 'Press 2ND then CLR TVM (above FV) to clear the five money keys. Press 2ND then CLR WORK (above CE|C) inside a worksheet to clear its list.'],
  ['Payments at the start of the period', 'Press 2ND then BGN (above PMT), then 2ND then SET. The screen shows BGN. Do it again to go back to END.'],
  ['Change the number of decimals', 'Press 2ND then FORMAT, type the number of decimals (for example 4) and press ENTER.'],
  ['Save a number', 'Press STO then a digit from 0 to 9. Get it back with RCL then that digit.'],
  ['Wipe everything', 'Press 2ND then RESET. This clears every worksheet and setting.'],
  ['The gold label is the same on a real BA II Plus', 'Yellow words above keys work the same way on the handheld. Where a key sits can differ a little between calculators, so always look for the yellow word.']
];
