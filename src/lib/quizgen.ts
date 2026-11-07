/** Quiz questions with numbers made fresh each time. Every answer is computed with the same maths the calculators use. */
import { bs, ninv } from './math';
import { forwardPrice, varNormal } from './markets';

export interface Question { id: string; topic: string; q: string; options: string[]; answer: number; explain: string; link: string }
type Rnd = () => number;

export function mulberry32(seed: number): Rnd {
  let a = seed >>> 0;
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const pick = <T,>(r: Rnd, xs: readonly T[]): T => xs[Math.floor(r() * xs.length)];
const int = (r: Rnd, a: number, b: number): number => a + Math.floor(r() * (b - a + 1));
const usd = (x: number, d = 2): string => { const s = Math.abs(x).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }); return (x < 0 ? '−$' : '$') + s; };
const pc = (x: number, d = 1): string => (x * 100).toFixed(d) + '%';

/** Put the right answer among distinct wrong ones, in a seeded random order. Wrong answers equal to the right one or to each other are dropped and topped up. */
export function build(r: Rnd, id: string, topic: string, q: string, right: string, wrong: string[], explain: string, link: string): Question {
  const seen = new Set([right]), opts = [right];
  wrong.forEach(w => { if (!seen.has(w) && opts.length < 4) { seen.add(w); opts.push(w); } });
  let k = 1; while (opts.length < 4) { const w = right + ' ' + '·'.repeat(k++); if (!seen.has(w)) { seen.add(w); opts.push(w); } }
  const order = opts.map((_, i) => i).sort(() => r() - 0.5), options = order.map(i => opts[i]);
  return { id, topic, q, options, answer: options.indexOf(right), explain, link };
}

type Gen = (r: Rnd) => Question;
export const GENERATORS: { id: string; topic: string; make: Gen }[] = [
  { id: 'fv', topic: 'Time value of money', make: r => {
    const P = int(r, 2, 20) * 500, i = pick(r, [4, 5, 6, 7, 8]) / 100, n = int(r, 5, 20), fv = P * Math.pow(1 + i, n);
    return build(r, 'fv', 'Time value of money', `You invest ${usd(P, 0)} today at ${pc(i, 0)} a year, compounded annually. What is it worth after ${n} years?`, usd(fv), [usd(P * (1 + i * n)), usd(P * Math.pow(1 + i, n - 1)), usd(P * Math.pow(1 + i, n + 1))], `FV = P × (1 + i)^n = ${usd(P, 0)} × ${(1 + i).toFixed(2)}^${n} = ${usd(fv)}. Simple interest would give ${usd(P * (1 + i * n))}, missing the interest earned on interest.`, '/tvm');
  } },
  { id: 'pv', topic: 'Time value of money', make: r => {
    const F = int(r, 5, 40) * 1000, i = pick(r, [5, 6, 8, 10]) / 100, n = int(r, 3, 10), pv = F / Math.pow(1 + i, n);
    return build(r, 'pv', 'Time value of money', `You are promised ${usd(F, 0)} in ${n} years. At a ${pc(i, 0)} discount rate, what is that worth today?`, usd(pv), [usd(F * Math.pow(1 + i, n)), usd(F * (1 - i * n)), usd(F / Math.pow(1 + i, n - 1))], `PV = F ÷ (1 + i)^n = ${usd(F, 0)} ÷ ${(1 + i).toFixed(2)}^${n} = ${usd(pv)}. Money in the future is worth less today.`, '/tvm');
  } },
  { id: 'ear', topic: 'Time value of money', make: r => {
    const apr = pick(r, [6, 8, 10, 12, 18, 24]) / 100, m = pick(r, [2, 4, 12]), ear = Math.pow(1 + apr / m, m) - 1;
    return build(r, 'ear', 'Time value of money', `A card quotes ${pc(apr, 0)} APR compounded ${m === 2 ? 'twice' : m === 4 ? 'quarterly' : 'monthly'}. What is the effective annual rate?`, pc(ear, 2), [pc(apr, 2), pc(apr * (m + 1) / m, 2), pc(Math.pow(1 + apr / m, m + 1) - 1, 2)], `EAR = (1 + APR ÷ m)^m − 1 = (1 + ${apr / m})^${m} − 1 = ${pc(ear, 3)}. Compounding more often earns more than the quoted rate.`, '/rates');
  } },
  { id: 'loan', topic: 'Loans and bonds', make: r => {
    const A = int(r, 10, 60) * 10000, apr = pick(r, [4, 5, 6, 7]) / 100, yrs = pick(r, [15, 20, 30]), i = apr / 12, N = yrs * 12, pay = (A * i) / (1 - Math.pow(1 + i, -N));
    return build(r, 'loan', 'Loans and bonds', `A ${usd(A, 0)} loan at ${pc(apr, 0)} a year over ${yrs} years has level monthly payments. What is the payment?`, usd(pay), [usd(A / N), usd(A * i), usd((A * i) / (1 - Math.pow(1 + apr, -yrs)))], `Payment = A × i ÷ (1 − (1 + i)^−N) with i = ${pc(i, 3)} and N = ${N}: ${usd(pay)}. ${usd(A / N)} would repay only principal.`, '/loan');
  } },
  { id: 'bond', topic: 'Loans and bonds', make: r => {
    const n = pick(r, [5, 10]), cr = pick(r, [4, 5, 6]) / 100, ytm = pick(r, [3, 7, 8]) / 100, F = 1000;
    let price = 0; for (let t = 1; t <= n; t++) price += (F * cr) / Math.pow(1 + ytm, t); price += F / Math.pow(1 + ytm, n);
    const dir = ytm > cr ? 'below' : 'above';
    return build(r, 'bond', 'Loans and bonds', `A ${n}-year bond pays a ${pc(cr, 0)} annual coupon on $1,000. Market yields are ${pc(ytm, 0)}. What is the price?`, usd(price), [usd(F), usd(F * cr * n + F), usd(2 * F - price)], `Discount the coupons and face value at ${pc(ytm, 0)}: ${usd(price)}. The yield is ${ytm > cr ? 'above' : 'below'} the coupon, so the price is ${dir} face value.`, '/bond');
  } },
  { id: 'npv', topic: 'Company decisions', make: r => {
    const I = int(r, 4, 12) * 1000, cf = Math.round((I * (0.4 + r() * 0.15)) / 100) * 100, n = 3, i = pick(r, [8, 10, 12]) / 100;
    let pv = 0; for (let t = 1; t <= n; t++) pv += cf / Math.pow(1 + i, t); const npv = pv - I;
    return build(r, 'npv', 'Company decisions', `A project costs ${usd(I, 0)} and pays ${usd(cf, 0)} a year for ${n} years. At a ${pc(i, 0)} discount rate, what is the NPV?`, usd(npv), [usd(cf * n - I), usd(-npv), usd(pv)], `NPV = PV of cash flows − cost = ${usd(pv)} − ${usd(I, 0)} = ${usd(npv)}. Adding the cash flows without discounting gives ${usd(cf * n - I)}. ${npv > 0 ? 'A positive NPV means accept.' : 'A negative NPV means reject.'}`, '/capbud');
  } },
  { id: 'wacc', topic: 'Company decisions', make: r => {
    const we = pick(r, [50, 60, 70]) / 100, ke = pick(r, [10, 12, 14]) / 100, kd = pick(r, [5, 6, 7]) / 100, t = pick(r, [20, 25, 30]) / 100, w = we * ke + (1 - we) * kd * (1 - t);
    return build(r, 'wacc', 'Company decisions', `A firm is ${pc(we, 0)} equity at ${pc(ke, 0)} and ${pc(1 - we, 0)} debt at ${pc(kd, 0)} before tax. The tax rate is ${pc(t, 0)}. What is the WACC?`, pc(w, 2), [pc(we * ke + (1 - we) * kd, 2), pc((ke + kd) / 2, 2), pc(we * ke + (1 - we) * kd * (1 + t), 2)], `WACC = E/V × ke + D/V × kd × (1 − t) = ${pc(we * ke, 2)} + ${pc((1 - we) * kd * (1 - t), 2)} = ${pc(w, 2)}. Interest is tax deductible, so debt costs less after tax.`, '/wacc');
  } },
  { id: 'breakeven', topic: 'Company decisions', make: r => {
    const p = pick(r, [40, 50, 60, 80]), vc = Math.round(p * (0.4 + r() * 0.2)), fc = int(r, 4, 20) * 5000, q = fc / (p - vc);
    return build(r, 'breakeven', 'Company decisions', `A product sells for ${usd(p, 0)} with variable cost ${usd(vc, 0)} a unit and fixed costs of ${usd(fc, 0)}. How many units are needed to break even?`, Math.ceil(q - 1e-9).toLocaleString('en-US') + ' units', [Math.ceil(fc / p).toLocaleString('en-US') + ' units', Math.ceil(fc / vc).toLocaleString('en-US') + ' units', Math.ceil(fc / (p + vc)).toLocaleString('en-US') + ' units'], `Break-even = fixed costs ÷ contribution per unit = ${usd(fc, 0)} ÷ (${usd(p, 0)} − ${usd(vc, 0)}) = ${q.toFixed(1)}, so round up to ${Math.ceil(q - 1e-9)}.`, '/breakeven');
  } },
  { id: 'eoq', topic: 'Company decisions', make: r => {
    const D = pick(r, [5000, 8000, 10000, 20000]), S = pick(r, [25, 40, 50, 100]), H = pick(r, [1, 2, 4, 5]), q = Math.sqrt((2 * D * S) / H);
    return build(r, 'eoq', 'Company decisions', `Demand is ${D.toLocaleString('en-US')} units a year, each order costs ${usd(S, 0)}, and holding costs ${usd(H, 0)} per unit a year. What is the economic order quantity?`, Math.round(q).toLocaleString('en-US') + ' units', [Math.round(Math.sqrt((D * S) / H)).toLocaleString('en-US') + ' units', Math.round((2 * D * S) / H).toLocaleString('en-US') + ' units', Math.round(Math.sqrt((2 * D * H) / S)).toLocaleString('en-US') + ' units'], `EOQ = √(2 × D × S ÷ H) = √(2 × ${D} × ${S} ÷ ${H}) = ${q.toFixed(1)} units.`, '/wc');
  } },
  { id: 'capm', topic: 'Investing', make: r => {
    const rf = pick(r, [2, 3, 4]) / 100, beta = pick(r, [0.6, 0.8, 1.2, 1.5]), mrp = pick(r, [5, 5.5, 6]) / 100, ke = rf + beta * mrp;
    return build(r, 'capm', 'Investing', `The risk-free rate is ${pc(rf, 0)}, the market risk premium is ${pc(mrp, 1)} and a stock has a beta of ${beta}. What return does CAPM require?`, pc(ke, 2), [pc(rf + mrp, 2), pc(beta * mrp, 2), pc(rf + beta * (rf + mrp), 2)], `CAPM: r = rf + β × premium = ${pc(rf, 1)} + ${beta} × ${pc(mrp, 1)} = ${pc(ke, 2)}.`, '/capm');
  } },
  { id: 'sharpe', topic: 'Investing', make: r => {
    const rf = pick(r, [2, 3]) / 100, a = { mu: int(r, 8, 12) / 100, sd: int(r, 12, 20) / 100 }, b = { mu: int(r, 6, 10) / 100, sd: int(r, 6, 11) / 100 };
    const sa = (a.mu - rf) / a.sd, sb = (b.mu - rf) / b.sd, best = sa >= sb ? 'Fund A' : 'Fund B';
    return build(r, 'sharpe', 'Investing', `Risk-free rate ${pc(rf, 0)}. Fund A returns ${pc(a.mu, 0)} with risk ${pc(a.sd, 0)}. Fund B returns ${pc(b.mu, 0)} with risk ${pc(b.sd, 0)}. Which has the better Sharpe ratio?`, best, [best === 'Fund A' ? 'Fund B' : 'Fund A', 'They are equal', 'Cannot tell without beta'], `Sharpe = (return − rf) ÷ risk. Fund A: ${sa.toFixed(3)}. Fund B: ${sb.toFixed(3)}.`, '/capm');
  } },
  { id: 'port', topic: 'Investing', make: r => {
    const sA = pick(r, [20, 25, 30]) / 100, sB = pick(r, [10, 15]) / 100, w = pick(r, [0.4, 0.5, 0.6]), sd = Math.sqrt(w * w * sA * sA + (1 - w) * (1 - w) * sB * sB);
    return build(r, 'port', 'Investing', `Two assets with risks ${pc(sA, 0)} and ${pc(sB, 0)} and zero correlation are held ${pc(w, 0)} / ${pc(1 - w, 0)}. What is the portfolio risk?`, pc(sd, 2), [pc(w * sA + (1 - w) * sB, 2), pc(Math.sqrt(sA * sB), 2), pc(Math.sqrt((w * sA) * (w * sA) + ((1 - w) * sB) * ((1 - w) * sB)) + 0.01, 2)], `With zero correlation the cross term vanishes: σ = √(w²σ_A² + (1−w)²σ_B²) = ${pc(sd, 3)}. The weighted average ${pc(w * sA + (1 - w) * sB, 2)} is higher: diversification at work.`, '/portfolio');
  } },
  { id: 'dupont', topic: 'Company health', make: r => {
    const m = pick(r, [5, 8, 10, 12]) / 100, at = pick(r, [1.2, 1.5, 2]), lev = pick(r, [1.5, 2, 2.5]), roe = m * at * lev;
    return build(r, 'dupont', 'Company health', `A firm has a ${pc(m, 0)} net margin, asset turnover of ${at}× and equity multiplier of ${lev}×. What is its ROE?`, pc(roe, 1), [pc(m * at, 1), pc(m + at + lev, 1), pc(m * lev, 1)], `DuPont: ROE = margin × turnover × leverage = ${pc(m, 0)} × ${at} × ${lev} = ${pc(roe, 1)}.`, '/ratios');
  } },
  { id: 'forward', topic: 'Options and futures', make: r => {
    const S = pick(r, [50, 80, 100, 120]), rf = pick(r, [3, 4, 5, 6]) / 100, T = pick(r, [0.25, 0.5, 1]), F = forwardPrice(S, rf, 0, 0, T);
    return build(r, 'forward', 'Options and futures', `A non-dividend stock trades at ${usd(S, 0)}. The continuously compounded risk-free rate is ${pc(rf, 0)}. What is the fair ${T}-year forward price?`, usd(F), [usd(S), usd(S * (1 + rf * T) + rf), usd(S * Math.exp(-rf * T))], `F = S × e^(rT) = ${usd(S, 0)} × e^(${rf} × ${T}) = ${usd(F)}. The forward is above spot by the cost of carrying the stock.`, '/futures');
  } },
  { id: 'parity', topic: 'Options and futures', make: r => {
    const S = pick(r, [40, 50, 60]), K = S + pick(r, [-5, 0, 5]), rf = pick(r, [3, 4, 5]) / 100, T = pick(r, [0.5, 1]), c = Math.round(bs(S, K, T, rf, 0, 0.3).c * 100) / 100;
    const p = c - S + K * Math.exp(-rf * T);
    return build(r, 'parity', 'Options and futures', `A European call (strike ${usd(K, 0)}, ${T} years) on a ${usd(S, 0)} stock costs ${usd(c)}. The rate is ${pc(rf, 0)} continuous. By put-call parity, what is the put with the same strike?`, usd(p), [usd(c + S - K), usd(c - S + K), usd(c - S + K * Math.exp(rf * T))], `P = C − S + K × e^(−rT) = ${usd(c)} − ${usd(S, 0)} + ${usd(K * Math.exp(-rf * T))} = ${usd(p)}.`, '/options');
  } },
  { id: 'var', topic: 'Options and futures', make: r => {
    const V = pick(r, [500000, 1000000, 2000000]), sd = pick(r, [10, 15, 20]) / 100, conf = pick(r, [0.95, 0.99]), vv = varNormal(V, 0, sd, 1, conf);
    return build(r, 'var', 'Options and futures', `A ${usd(V, 0)} portfolio has yearly risk of ${pc(sd, 0)} and zero expected return. What is the one-year ${pc(conf, 0)} value at risk (normal)?`, usd(vv, 0), [usd(V * sd, 0), usd(vv * 2, 0), usd(V * sd * ninv(conf === 0.95 ? 0.99 : 0.95), 0)], `VaR = V × z × σ = ${usd(V, 0)} × ${ninv(conf).toFixed(3)} × ${pc(sd, 0)} = ${usd(vv, 0)}.`, '/varcalc');
  } }
];

/** Concept questions with fixed wording. */
export const CONCEPTS: Omit<Question, 'id'>[] = [
  { topic: 'Loans and bonds', q: 'Market yields rise. What happens to the price of an existing fixed-rate bond?', options: ['It falls', 'It rises', 'It stays the same', 'It depends on the coupon only'], answer: 0, explain: 'Existing coupons are fixed, so they are worth less when new bonds pay more. Price and yield move in opposite directions.', link: '/bond' },
  { topic: 'Loans and bonds', q: 'Two bonds have the same maturity. Which is more sensitive to interest rates?', options: ['The one with the lower coupon', 'The one with the higher coupon', 'They are equally sensitive', 'The one with the shorter duration'], answer: 0, explain: 'A lower coupon means more of the value arrives late, so duration is longer and the price moves more when rates change.', link: '/bond' },
  { topic: 'Investing', q: 'Adding an asset with a low correlation to a portfolio usually…', options: ['Lowers risk for a given return', 'Raises risk', 'Has no effect on risk', 'Lowers return only'], answer: 0, explain: 'Assets that do not move in lockstep offset each other\'s swings. That is diversification.', link: '/portfolio' },
  { topic: 'Investing', q: 'Which risk does CAPM say earns a premium?', options: ['Market (systematic) risk', 'All risk', 'Company-specific risk', 'Risk-free rate risk'], answer: 0, explain: 'Company-specific risk can be diversified away, so the market does not pay for it. Only market risk, measured by beta, is rewarded.', link: '/capm' },
  { topic: 'Company decisions', q: 'Two projects are mutually exclusive and their NPV and IRR rankings disagree. Which should you follow?', options: ['NPV', 'IRR', 'Payback', 'The one with the lower cost'], answer: 0, explain: 'NPV measures the value added in dollars. IRR can mislead when projects differ in size or timing.', link: '/capbud' },
  { topic: 'Company decisions', q: 'A company replaces equity with debt. With corporate taxes only (no distress costs), firm value…', options: ['Rises by the value of the interest tax shield', 'Is unchanged', 'Falls', 'Doubles'], answer: 0, explain: 'Modigliani and Miller with taxes: interest is deductible, so debt adds the present value of the tax saved.', link: '/capstruct' },
  { topic: 'Company decisions', q: 'In perfect markets with no taxes, a dividend versus a buyback of the same cash makes shareholders…', options: ['Equally well off', 'Better off with the dividend', 'Better off with the buyback', 'Worse off either way'], answer: 0, explain: 'With no taxes the share price adjusts by exactly the cash paid out, so wealth is unchanged.', link: '/payout' },
  { topic: 'Options and futures', q: 'Which strategy profits most from a large price move in either direction?', options: ['Long straddle', 'Covered call', 'Bull call spread', 'Protective put'], answer: 0, explain: 'A straddle holds a call and a put at the same strike, so it gains if the price rises or falls far enough.', link: '/strategies' },
  { topic: 'Options and futures', q: 'An American call on a stock that pays no dividends should usually be…', options: ['Held, not exercised early', 'Exercised right away', 'Exercised at the halfway point', 'Sold for intrinsic value'], answer: 0, explain: 'Exercising early throws away the time value and the interest on the strike. Selling or holding is better.', link: '/binomial' },
  { topic: 'Time value of money', q: 'You compare two deposits. Which number should you use to compare them fairly?', options: ['The effective annual rate', 'The stated APR', 'The coupon rate', 'The number of compounding periods'], answer: 0, explain: 'EAR puts different compounding frequencies on the same footing.', link: '/rates' }
];

/** One question for a topic filter, or from any topic. The same seed always gives the same question. */
export function makeQuestion(seed: number, topic?: string): Question {
  const r = mulberry32(seed), pool = [...GENERATORS.map(g => ({ topic: g.topic, gen: g })), ...CONCEPTS.map((c, i) => ({ topic: c.topic, concept: i }))].filter(p => !topic || p.topic === topic);
  const item = pool[Math.floor(r() * pool.length)] || pool[0];
  if ('gen' in item && item.gen) return item.gen.make(r);
  const c = CONCEPTS[(item as any).concept];
  const order = c.options.map((_, i) => i).sort(() => r() - 0.5), options = order.map(i => c.options[i]);
  return { ...c, id: 'c' + (item as any).concept, options, answer: options.indexOf(c.options[c.answer]) };
}
export const TOPICS = ['Time value of money', 'Loans and bonds', 'Company decisions', 'Investing', 'Company health', 'Options and futures'];
