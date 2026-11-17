/** Facts worked out from the company's own numbers: the sort of thing a careful reader would notice after going through ten years of
    statements. Every sentence is built only from figures in the table, and is skipped when a figure is missing. */
import { revenueCagr } from './fin';
import { isNum, mean, total, tail, type Ctx } from './analysis-metrics';
import { money, pct, mult } from './format';

const b = (t: string) => `<b>${t}</b>`;
const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const times = (x: number) => (x >= 10 ? Math.round(x) : x.toFixed(1).replace(/\.0$/, '')) + ' times';
const twice = (x: number) => (x >= 1.1 ? times(x) + ' as much' : x <= 0.9 ? pct(x, 0) + ' of the start' : 'about the same');
const firstIdx = (row: readonly (number | null)[]) => row.findIndex(isNum);
const lastIdx = (row: readonly (number | null)[]) => row.length - 1 - [...row].reverse().findIndex(isNum);
const extreme = (row: readonly (number | null)[], max: boolean): number => { let k = -1; row.forEach((v, i) => { if (isNum(v) && (k < 0 || (max ? v > (row[k] as number) : v < (row[k] as number)))) k = i; }); return k; };
const cents = (x: number) => Math.round(x * 100) + ' cents';

type Fact = (c: Ctx, nm: string) => string | null;

const scale: Fact = (c, nm) => {
  const r = c.row('revenue'), a = firstIdx(r), z = lastIdx(r);
  if (a < 0 || z <= a || (r[a] as number) <= 0) return null;
  const x = (r[z] as number) / (r[a] as number), span = `${c.years[a]} and ${c.years[z]}`;
  return x >= 1.1 ? `Between ${span}, ${nm}'s sales went from ${b(money(r[a]))} to ${b(money(r[z]))}. It is ${b(times(x))} bigger.` : x >= 0.9 ? `Between ${span}, ${nm}'s sales hardly moved: ${b(money(r[a]))} to ${b(money(r[z]))}.` : `Between ${span}, ${nm}'s sales shrank from ${b(money(r[a]))} to ${b(money(r[z]))}, down to ${b(pct(x, 0))} of where they started.`;
};

const swings: Fact = c => {
  const g = c.q.revenueGrowth, hi = extreme(g, true), lo = extreme(g, false);
  if (hi < 0 || lo < 0 || hi === lo || g.filter(isNum).length < 4) return null;
  return `Its best year for sales was ${b(c.years[hi])} (${b('+' + pct(g[hi] as number))}). Its weakest was ${b(c.years[lo])} (${b((g[lo] as number) >= 0 ? '+' + pct(g[lo] as number) : pct(g[lo] as number))}).`;
};

const lossYears: Fact = (c, nm) => {
  const ni = c.row('netIncome'), bad = ni.map((v, i) => (isNum(v) && v < 0 ? c.years[i] : null)).filter(Boolean), n = ni.filter(isNum).length;
  if (n < 3) return null;
  return bad.length === 0 ? `${nm} made a profit in ${b('all ' + n + ' years')} in the table, through all the ups and downs of those years.` : `${nm} lost money in ${b(bad.length + ' of ' + n + ' years')} (${bad.join(', ')}).`;
};

const cashVsProfit: Fact = c => {
  const ni = c.row('netIncome'), cfo = c.row('cfo'), idx = ni.map((v, i) => (isNum(v) && isNum(cfo[i]) ? i : -1)).filter(i => i >= 0);
  if (idx.length < 3) return null;
  const sn = idx.reduce((a, i) => a + (ni[i] as number), 0), sc = idx.reduce((a, i) => a + (cfo[i] as number), 0);
  if (sn <= 0) return `Over ${idx.length} years it reported ${b(money(sn))} of profit but generated ${b(money(sc))} of operating cash.`;
  const k = sc / sn;
  return `Over ${idx.length} years it reported ${b(money(sn))} of profit and generated ${b(money(sc))} of operating cash. Each $1 of profit came with ${b('$' + k.toFixed(2))} of cash${k > 2 ? ', far more than the profit, usually because of large non-cash costs such as wear on equipment' : k >= 1.1 ? ', a sign that the profit is real' : k < 0.8 ? ', so a lot of the profit stayed tied up in the business' : ''}.`;
};

const whereCashWent: Fact = c => {
  const fcf = c.q.fcf, f = total(fcf), rt = total(c.returned), acq = total(c.row('acquisitions'));
  if (!isNum(f) || f <= 0 || fcf.filter(isNum).length < 3) return null;
  const share = isNum(rt) && rt > 0 ? rt / f : 0, buys = isNum(acq) && acq > 0 ? acq / f : 0;
  const parts = [share >= 0.01 ? `${b(cents(share))} went to owners as dividends and buybacks` : '', buys >= 0.01 ? `${b(cents(buys))} bought other companies` : ''].filter(Boolean);
  const more = share > 1.02 ? ` It paid owners ${b(money(rt))}, which is more than all the free cash it made, so the extra came from savings or new borrowing.` : '';
  return `In total it produced ${b(money(f))} of free cash (the cash left after paying for equipment).${more || ` Of each $1 of it${parts.length ? ', ' + parts.join(' and ') : ', the table does not show where the money went'}.`}`;
};

const weakestCash: Fact = c => {
  const fcf = c.q.fcf, lo = extreme(fcf, false), hi = extreme(fcf, true);
  if (lo < 0 || hi < 0 || lo === hi || fcf.filter(isNum).length < 4) return null;
  const cx = c.row('capex'), cfo = c.row('cfo'), why = lo > 0 && isNum(cx[lo]) && isNum(cx[lo - 1]) && (cx[lo] as number) > 1.3 * (cx[lo - 1] as number) ? ' Equipment spending jumped that year.' : lo > 0 && isNum(cfo[lo]) && isNum(cfo[lo - 1]) && (cfo[lo] as number) < 0.85 * (cfo[lo - 1] as number) ? ' Operating cash fell that year.' : '';
  return `Free cash was strongest in ${b(c.years[hi])} (${b(money(fcf[hi]))}) and weakest in ${b(c.years[lo])} (${b(money(fcf[lo]))}).${why}`;
};

const reinvesting: Fact = c => {
  const cx = mean(tail(c.row('capex'), 3)), da = mean(tail(c.row('da'), 3)), rev = mean(tail(c.row('revenue'), 3));
  if (!isNum(cx) || !isNum(da) || da <= 0 || !isNum(rev) || rev <= 0) return null;
  const x = cx / da;
  return `It spends about ${b(pct(cx / rev))} of sales on equipment and buildings. That is ${b(mult(x, 1))} the yearly wear on what it already owns. ${x >= 1.3 ? 'That is building up what it owns, for growth.' : x >= 0.8 ? 'That roughly keeps its assets in shape.' : 'That is less than the wear, so it is running its assets down, which a business cannot do forever.'}`;
};

const debtVsSales: Fact = c => {
  const d = c.row('debt'), r = c.row('revenue'), a = firstIdx(d), z = lastIdx(d);
  if (a < 0 || z - a < 3 || !isNum(r[a]) || !isNum(r[z]) || (d[a] as number) <= 0 || (r[a] as number) <= 0) return null;
  const dg = (d[z] as number) / (d[a] as number), sg = (r[z] as number) / (r[a] as number);
  return `Borrowings went from ${b(money(d[a]))} (${c.years[a]}) to ${b(money(d[z]))} (${c.years[z]}), ${b(twice(dg))}. Over the same time sales ${sg >= 1.1 ? 'grew ' + b(times(sg)) : sg <= 0.9 ? 'shrank to ' + b(pct(sg, 0)) : 'stayed about the same'}. ${dg > sg * 1.3 ? 'Debt has grown faster than the business.' : dg < sg * 0.7 ? 'The business has outgrown its debt.' : 'Debt and sales have moved together.'}`;
};

const cushion: Fact = c => {
  const cash = c.row('cash'), debt = c.row('debt'), i = c.n - 1;
  if (!isNum(cash[i])) return null;
  if (!isNum(debt[i])) return `It holds ${b(money(cash[i]))} in cash.`;
  return (cash[i] as number) >= (debt[i] as number) ? `It holds ${b(money(cash[i]))} in cash against ${b(money(debt[i]))} of borrowings, so it could repay all its debt today and still have ${b(money((cash[i] as number) - (debt[i] as number)))} left.` : `It holds ${b(money(cash[i]))} in cash against ${b(money(debt[i]))} of borrowings, so net debt is ${b(money((debt[i] as number) - (cash[i] as number)))}.`;
};

const marginPeak: Fact = c => {
  const om = c.q.operatingMargin, hi = extreme(om, true), z = lastIdx(om);
  if (hi < 0 || z < 0 || om.filter(isNum).length < 5) return null;
  return hi === z ? `Its profit from running the business is at its ${b('highest')} of the whole period: ${b(pct(om[z]))} of sales in ${b(c.years[z])}.` : `Its profit from running the business peaked at ${b(pct(om[hi]))} of sales in ${b(c.years[hi])} and was ${b(pct(om[z]))} in ${b(c.years[z])}.`;
};

const research: Fact = c => {
  const rd = c.row('rnd'), r = c.row('revenue'), a = firstIdx(rd), z = lastIdx(rd);
  if (a < 0 || z <= a || !isNum(r[a]) || !isNum(r[z]) || (r[a] as number) <= 0 || (r[z] as number) <= 0) return null;
  const x = (rd[a] as number) / (r[a] as number), y = (rd[z] as number) / (r[z] as number);
  return `It put ${b(money(rd[z]))} into research in ${c.years[z]}, ${b(pct(y))} of sales, ${y > x * 1.1 ? 'up from' : y < x * 0.9 ? 'down from' : 'about the same as'} ${b(pct(x))} in ${c.years[a]}.`;
};

const staffShares: Fact = c => {
  const s = c.row('sbc'), cfo = c.row('cfo'), i = lastIdx(s);
  if (i < 0 || !isNum(cfo[i]) || (cfo[i] as number) <= 0) return null;
  const x = (s[i] as number) / (cfo[i] as number);
  return `In ${c.years[i]} it gave staff ${b(money(s[i]))} of shares, ${b(pct(x, 0))} of its operating cash. ${x > 0.25 ? 'That is a heavy hidden cost to owners.' : x > 0.1 ? 'That is a real cost to owners, though not heavy.' : 'That is small.'}`;
};

const shareCount: Fact = c => {
  const s = c.row('shares'), a = firstIdx(s), z = lastIdx(s);
  if (a < 0 || z <= a) return null;
  const ch = (s[z] as number) / (s[a] as number) - 1;
  return `The number of shares ${ch <= -0.005 ? 'fell' : ch >= 0.005 ? 'rose' : 'stayed level'} ${Math.abs(ch) >= 0.005 ? b(pct(Math.abs(ch))) : ''} between ${c.years[a]} and ${c.years[z]}. ${ch <= -0.02 ? 'Each share now owns a bigger slice of the company.' : ch >= 0.02 ? 'Each share now owns a smaller slice, which is dilution.' : ''}`.replace(/ \./g, '.').replace(/ {2,}/g, ' ');
};

const payTimes: Fact = c => {
  const r = c.row('revenue'), cost = c.row('costOfRevenue'), rec = c.row('receivables'), pay = c.row('payables'), i = c.n - 1;
  if (![r[i], cost[i], rec[i], pay[i]].every(isNum) || (r[i] as number) <= 0 || (cost[i] as number) <= 0) return null;
  const dso = ((rec[i] as number) / (r[i] as number)) * 365, dpo = ((pay[i] as number) / (cost[i] as number)) * 365;
  return `Customers take about ${b(Math.round(dso) + ' days')} to pay it, and it takes about ${b(Math.round(dpo) + ' days')} to pay its own suppliers. ${dpo > dso ? 'Suppliers are lending it money for free.' : 'It waits longer for its money than it makes suppliers wait.'}`;
};

const interestBite: Fact = c => {
  const ie = c.row('interestExpense'), op = c.row('operatingIncome'), i = c.n - 1;
  if (!isNum(ie[i]) || !isNum(op[i]) || (op[i] as number) <= 0 || (ie[i] as number) <= 0) return null;
  return `Interest takes ${b(cents((ie[i] as number) / (op[i] as number)))} of each $1 of operating profit.`;
};

const dividendRun: Fact = (c, nm) => {
  const d = c.row('dividends'), a = firstIdx(d), z = lastIdx(d);
  if (a < 0 || z <= a || (d[a] as number) <= 0 || (d[z] as number) <= 0) return null;
  const x = (d[z] as number) / (d[a] as number), t = total(d);
  return `${nm} has paid ${b(money(t))} in dividends over these years. The yearly payment went from ${b(money(d[a]))} to ${b(money(d[z]))}${x >= 1.1 ? ', a rise of ' + b(pct(x - 1, 0)) : x <= 0.9 ? ', a cut of ' + b(pct(1 - x, 0)) : ', about level'}.`;
};

const buyingCompanies: Fact = c => {
  const a = c.row('acquisitions'), hi = extreme(a, true), t = total(a);
  if (hi < 0 || !isNum(t) || t <= 0) return null;
  return `It spent ${b(money(t))} on buying other companies in the table. The biggest year was ${b(c.years[hi])} at ${b(money(a[hi]))}.`;
};

const operatingLeverage: Fact = c => {
  const cg = revenueCagr(c.s), ni = c.row('netIncome'), a = ni.findIndex(v => isNum(v) && v > 0), z = ni.length - 1 - [...ni].reverse().findIndex(v => isNum(v) && v > 0);
  if (!cg || a < 0 || z <= a) return null;
  const yrs = (Date.parse(c.s.periods[z].end) - Date.parse(c.s.periods[a].end)) / (365.25 * 864e5);
  if (yrs < 3) return null;
  const pg = ((ni[z] as number) / (ni[a] as number)) ** (1 / yrs) - 1;
  if (!Number.isFinite(pg)) return null;
  return pg > cg.cagr + 0.02 ? `Profit grew ${b(pct(pg))} a year while sales grew ${b(pct(cg.cagr))}. Profit is growing faster than sales, so each $1 of sales is worth more to owners than before.` : pg < cg.cagr - 0.02 ? `Profit grew ${b(pct(pg))} a year while sales grew ${b(pct(cg.cagr))}. Costs are growing faster than sales.` : null;
};

const FACTS: Fact[] = [scale, lossYears, cashVsProfit, whereCashWent, cushion, debtVsSales, shareCount, operatingLeverage, swings, weakestCash, marginPeak, reinvesting, research, staffShares, dividendRun, buyingCompanies, interestBite, payTimes];
const LIGHT: Fact[] = [scale, swings, lossYears, shareCount, dividendRun];

/** Up to twelve facts, in a sensible reading order. */
export function factsFor(c: Ctx, name: string): string[] {
  const nm = esc(name || 'The company');
  const out = (c.s.kind === 'financial' ? LIGHT : FACTS).map(f => f(c, nm)).filter((x): x is string => !!x).slice(0, 12);
  return c.s.kind === 'financial' ? out.map(t => t.replace(/\bsales\b/g, 'revenue')) : out;
}

export const cashFacts = (c: Ctx, name: string): string[] => [whereCashWent, weakestCash, cashVsProfit, reinvesting].map(f => f(c, esc(name))).filter((x): x is string => !!x);
