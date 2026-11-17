/** The ratios behind the full company analysis, grouped into six areas. Each one is a Metric: a number, how it is shown, a score from 0 to 100
    (when it has a fair yardstick) and a short plain sentence about what it says. Nothing is guessed: when an input is missing the metric is left out. */
import { ratios, revenueCagr, type Statements, type Row, type Ratios } from './fin';
import { cagr } from './series';
import { pct, mult, num } from './format';

export type Tone = 'good' | 'ok' | 'warn' | 'bad' | 'info';
export interface Metric { key: string; label: string; value: number; shown: string; tone: Tone; score: number | null; what: string; read: string; say: string; trend: (number | null)[] | null }
export interface Category { key: string; label: string; blurb: string; score: number | null; tone: Tone; metrics: Metric[] }

export const isNum = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
export const mean = (xs: readonly (number | null | undefined)[]): number | null => { const v = xs.filter(isNum); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
export const total = (xs: readonly (number | null | undefined)[]): number | null => { const v = xs.filter(isNum); return v.length ? v.reduce((a, b) => a + b, 0) : null; };
export const tail = <T,>(xs: readonly T[], k: number): T[] => xs.slice(Math.max(0, xs.length - k));
export const head = <T,>(xs: readonly T[], k: number): T[] => xs.slice(0, k);
const stdev = (xs: readonly (number | null)[]): number | null => { const v = xs.filter(isNum); if (v.length < 3) return null; const m = v.reduce((a, b) => a + b, 0) / v.length; return Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / (v.length - 1)); };
const ratio = (a: number | null | undefined, b: number | null | undefined): number | null => (isNum(a) && isNum(b) && b !== 0 ? a / b : null);

/** Turns a value into 0-100 using three marks: weak, fair and strong. `lower` flips it for measures where less is better. */
export function grade(v: number, [bad, fair, good]: readonly [number, number, number], lower = false): number {
  const [a, b, c, x] = lower ? [-bad, -fair, -good, -v] : [bad, fair, good, v];
  const clamp = (t: number) => Math.min(1, Math.max(0, t));
  const out = x < a ? 25 * clamp(1 - (a - x) / (b - a)) : x < b ? 25 + 35 * (x - a) / (b - a) : x < c ? 60 + 30 * (x - b) / (c - b) : 90 + 10 * clamp((x - c) / (c - b));
  return Math.round(out);
}
export const toneOf = (score: number | null): Tone => (score == null ? 'info' : score >= 75 ? 'good' : score >= 50 ? 'ok' : score >= 30 ? 'warn' : 'bad');

export interface Ctx { s: Statements; n: number; w: number; q: Ratios; row: (k: string) => Row; returned: Row; years: string[] }

export function makeCtx(s: Statements): Ctx {
  const n = s.periods.length, row = (k: string): Row => s.rows[k] ?? Array.from({ length: n }, () => null);
  const div = row('dividends'), bb = row('buybacks');
  const returned: Row = Array.from({ length: n }, (_, i) => (isNum(div[i]) || isNum(bb[i]) ? (div[i] ?? 0) + (bb[i] ?? 0) : null));
  return { s, n, w: Math.min(5, n), q: ratios(s), row, returned, years: s.periods.map(p => p.end.slice(0, 4)) };
}

/** One short, everyday sentence for a metric. `strong` says whether the number is on the good side. */
const SAY: Record<string, (v: number, s: string, strong: boolean) => string> = {
  salesCagr: (v, s, g) => (v < 0 ? `Sales are shrinking, by ${s.replace('-', '').replace('−', '')} a year.` : g ? `Sales grow about ${s} a year.` : `Sales grow only ${s} a year.`),
  salesNow: (v, s) => `Sales ${v >= 0 ? 'rose' : 'fell'} ${s.replace('-', '').replace('−', '')} last year.`,
  upYears: (_, s, g) => (g ? `Sales went up in ${s} of the years.` : `Sales went up in only ${s} of the years.`),
  profitCagr: (v, s, g) => (v < 0 ? 'Profit is shrinking.' : g ? `Profit grows about ${s} a year.` : `Profit grows only ${s} a year.`),
  gross: (_, s) => `After paying for what it sells, it keeps ${s} of each $1 of sales.`,
  op: (_, s) => `It keeps ${s} of each $1 of sales as profit from running the business.`,
  net: (v, s) => (v < 0 ? 'It loses money on each $1 of sales.' : `It keeps ${s} of each $1 of sales as final profit.`),
  trend: (_, __, g) => (g ? 'It has become more profitable over the years.' : 'It earns less on each sale than it used to.'),
  steady: (_, __, g) => (g ? 'Its profit margin is steady from year to year.' : 'Its profit margin swings a lot from year to year.'),
  roe: (_, s) => `Owners earn ${s} a year on their money in the company.`,
  roa: (_, s) => `It earns ${s} a year on everything it owns.`,
  roic: (_, s, g) => `It earns ${s} a year on the money put in, which is ${g ? 'a high' : 'a low'} return.`,
  fcfMargin: (v, s) => (v <= 0 ? 'It does not keep any free cash from its sales.' : `It keeps ${s} of each $1 of sales as free cash.`),
  conv: (_, s) => `Each $1 of profit turns into ${s} of cash.`,
  fcfYears: (_, s, g) => (g ? `It made free cash in ${s} of the years.` : `It made free cash in only ${s} of the years.`),
  fcfGrowth: (v, s, g) => (g ? `Free cash grows about ${s} a year.` : v < 0 ? 'Free cash is shrinking.' : `Free cash grows only ${s} a year.`),
  capexCfo: (_, s, g) => (g ? `It spends little of its cash on equipment (${s}).` : `It spends ${s} of its cash on equipment just to keep going.`),
  accruals: (_, __, g) => (g ? 'Its cash is as high as its profit, or higher.' : 'Its profit is running ahead of its cash.'),
  current: (_, __, g) => (g ? 'It can pay its short-term bills with room to spare.' : 'Its short-term bills are close to what it has on hand.'),
  ndx: (v, s, g) => (v <= 0 ? 'It has more cash than debt.' : g ? 'Its debt is small next to its yearly profit.' : `Its debt is large next to its yearly profit (${s}).`),
  cover: (v, s, g) => (v < 0 ? 'It did not earn enough to pay its interest.' : g ? `It earns ${s} what it needs to pay interest.` : `It earns only ${s} what it needs to pay interest.`),
  de: (_, __, g) => (g ? 'It borrows little compared with the owners\' money.' : 'It borrows a lot compared with the owners\' money.'),
  payback: (_, s, g) => (g ? `It could repay its debt from free cash in about ${s}.` : `Repaying its debt would take about ${s} of free cash.`),
  payout: (_, s, g) => (g ? 'It pays owners less than the free cash it makes.' : `It pays owners ${s} of its free cash, more than it can afford.`),
  shares: (v, s, g) => (g ? `The number of shares is shrinking (${s}), so each share owns more.` : v > 0 ? `The number of shares is growing (${s}), so each share owns less.` : 'The number of shares is about the same.'),
  sbc: (_, s, g) => (g ? 'It pays its staff little in shares.' : `It pays its staff a lot in shares (${s} of its cash).`),
  profitYears: (_, s) => `It made a profit in ${s} of the years.`
};

interface Opts { thr?: readonly [number, number, number]; lower?: boolean; tone?: Tone; read?: (v: number) => string; trend?: Row }
function metric(key: string, label: string, value: number | null, fmt: (v: number) => string, what: string, o: Opts = {}): Metric | null {
  if (!isNum(value)) return null;
  const score = o.thr ? grade(value, o.thr, o.lower) : null;
  const shown = fmt(value), say = SAY[key] && score != null ? SAY[key](value, shown, score >= 60) : '';
  return { key, label, value, shown, tone: o.tone ?? toneOf(score), score, what, read: o.read ? o.read(value) : '', say, trend: o.trend && o.trend.filter(isNum).length >= 3 ? o.trend.map(x => (isNum(x) ? x : null)) : null };
}
const pts = (v: number) => (v >= 0 ? '+' : '−') + (Math.abs(v) * 100).toFixed(1) + ' pts';
const days = (v: number) => num(v, 0) + ' days';
const times = (v: number) => mult(v, 1);
const keep = (xs: (Metric | null)[]): Metric[] => xs.filter((m): m is Metric => m != null);
const last = (xs: Row) => (xs.length ? xs[xs.length - 1] : null);
const recent = (c: Ctx, row: Row) => mean(tail(row, 3));

export function growthMetrics(c: Ctx): Metric[] {
  const cg = revenueCagr(c.s), g = last(c.q.revenueGrowth), ups = c.q.revenueGrowth.filter(isNum), ni = c.row('netIncome');
  const a = ni.findIndex(v => isNum(v) && v > 0), z = ni.length - 1 - [...ni].reverse().findIndex(v => isNum(v) && v > 0);
  const yrs = a >= 0 && z > a ? (Date.parse(c.s.periods[z].end) - Date.parse(c.s.periods[a].end)) / (365.25 * 864e5) : 0;
  const pc = a >= 0 && z > a ? cagr(ni[a], ni[z], yrs) : null;
  return keep([
    metric('salesCagr', 'Sales growth per year', cg ? cg.cagr : null, v => pct(v), 'How fast sales grew each year on average over the whole table.', { thr: [0, 0.04, 0.1], read: v => (v >= 0.1 ? 'Sales compound quickly.' : v >= 0.04 ? 'Sales grow steadily.' : v >= 0 ? 'Sales are close to flat.' : 'Sales have shrunk.') }),
    metric('salesNow', 'Sales growth last year', g, v => pct(v), 'The latest one-year change in sales.', { thr: [-0.02, 0.03, 0.08], trend: c.q.revenueGrowth }),
    metric('upYears', 'Years sales went up', ups.length >= 3 ? ups.filter(v => v > 0).length / ups.length : null, v => pct(v, 0), 'The share of years with higher sales than the year before. Steady growth is easier to trust.', { thr: [0.5, 0.7, 0.85] }),
    metric('profitCagr', 'Profit growth per year', pc, v => pct(v), 'How fast net income grew each year, from the first to the last profitable year.', { thr: [0, 0.05, 0.12] })
  ]);
}

export function profitMetrics(c: Ctx): Metric[] {
  const { q } = c, om = q.operatingMargin, n = c.n, rev = c.row('revenue');
  const trend = n >= 6 && isNum(mean(head(om, 3))) && isNum(mean(tail(om, 3))) ? (mean(tail(om, 3)) as number) - (mean(head(om, 3)) as number) : null;
  return keep([
    metric('gross', 'Gross margin', recent(c, q.grossMargin), v => pct(v), 'Of each $1 of sales, what is left after the direct cost of making or buying what was sold.', { thr: [0.2, 0.35, 0.5], trend: q.grossMargin }),
    metric('op', 'Operating margin', recent(c, om), v => pct(v), 'Of each $1 of sales, what is left from running the business, before interest and tax.', { thr: [0.03, 0.1, 0.2], trend: om, read: v => `It keeps about ${Math.round(v * 100)} cents of operating profit from each $1 of sales.` }),
    metric('net', 'Net margin', recent(c, q.netMargin), v => pct(v), 'Of each $1 of sales, what finally belongs to owners after every cost, interest and tax.', { thr: [0.02, 0.07, 0.15], trend: q.netMargin }),
    metric('trend', 'Margin trend', trend, pts, 'Operating margin in the latest three years, compared with the first three years in the table.', { thr: [-0.03, 0, 0.03], read: v => (v > 0.005 ? 'The business has become more profitable.' : v < -0.005 ? 'Each $1 of sales now earns less than it used to.' : 'The margin has held steady.') }),
    metric('steady', 'Margin swings', stdev(om), v => pct(v), 'How much the operating margin moves from year to year. Smaller swings mean a more predictable business.', { thr: [0.07, 0.04, 0.02], lower: true }),
    metric('tax', 'Tax rate', last(q.taxRate), v => pct(v, 0), 'The share of pre-tax profit paid as income tax in the latest year.', { tone: 'info' }),
    metric('rnd', 'Spending on research', ratio(last(c.row('rnd')), last(c.row('revenue'))), v => pct(v), 'Research and development as a share of sales. It is a bet on future products.', { tone: 'info' }),
    metric('sga', 'Selling and admin costs', ratio(last(c.row('sga')), last(rev)), v => pct(v), 'The cost of selling and running the company, as a share of sales.', { tone: 'info' })
  ]);
}

export function returnMetrics(c: Ctx): Metric[] {
  const { q } = c, r = c.row, tax = last(q.taxRate), op = last(r('operatingIncome')), capexShare = r('capex').map((v, k) => ratio(v, r('revenue')[k]));
  const debt = last(r('debt')), eq = last(r('equity')), cash = last(r('cash'));
  const invested = isNum(debt) && isNum(eq) && isNum(cash) ? debt + eq - cash : null;
  const roic = isNum(op) && isNum(tax) && isNum(invested) && invested > 0 ? (op * (1 - tax)) / invested : null;
  const dso = ratio(last(r('receivables')), last(r('revenue'))), dio = ratio(last(r('inventory')), last(r('costOfRevenue'))), dpo = ratio(last(r('payables')), last(r('costOfRevenue')));
  const cycle = isNum(dso) && isNum(dio) && isNum(dpo) ? dso * 365 + dio * 365 - dpo * 365 : null;
  return keep([
    metric('roe', 'Return on equity', recent(c, q.roe), v => pct(v), 'Profit made for each $1 of the owners\' money in the company (three-year average).', { thr: [0.05, 0.1, 0.18], trend: q.roe, read: v => (v > 0.4 ? 'Very high, partly because buybacks have shrunk the owners\' money. Check debt.' : '') }),
    metric('roa', 'Return on assets', recent(c, q.roa), v => pct(v), 'Profit made for each $1 of everything the company owns (three-year average).', { thr: [0.02, 0.05, 0.09], trend: q.roa }),
    metric('roic', 'Return on invested capital', roic, v => pct(v), 'Operating profit after tax, for each $1 that owners and lenders have put in. This is the cleanest test of a good business.', { thr: [0.05, 0.09, 0.15], read: v => (v >= 0.09 ? 'It earns more than most funding costs, so growth creates value.' : 'It earns little on the money put in, so growth may not create value.') }),
    metric('turn', 'Asset turnover', last(q.assetTurnover), times, 'Sales made from each $1 of assets. Retailers are high, banks and utilities are low.', { tone: 'info' }),
    metric('dso', 'Days to collect from customers', isNum(dso) ? dso * 365 : null, days, 'How long customers take to pay.', { tone: 'info' }),
    metric('dio', 'Days stock sits unsold', isNum(dio) ? dio * 365 : null, days, 'How long inventory is held before it is sold.', { tone: 'info' }),
    metric('dpo', 'Days it takes to pay suppliers', isNum(dpo) ? dpo * 365 : null, days, 'How long it waits before paying its own bills.', { tone: 'info' }),
    metric('ccc', 'Cash cycle', cycle, days, 'Days from paying for stock to being paid by customers. Lower is better, and below zero means suppliers fund the business.', { tone: 'info' }),
    metric('capexSales', 'Equipment spending', recent(c, capexShare), v => pct(v), 'Money spent on equipment and buildings, as a share of sales.', { tone: 'info' }),
    metric('reinvest', 'Spending vs wear on equipment', ratio(last(r('capex')), last(r('da'))), times, 'Equipment spending divided by yearly wear (depreciation). Above 1× means it is building up; well below 1× means it is running assets down.', { tone: 'info' })
  ]);
}

export function cashMetrics(c: Ctx): Metric[] {
  const { q } = c, cfo = c.row('cfo'), ni = c.row('netIncome'), assets = c.row('assets'), capex = c.row('capex'), w = c.w, n = c.n;
  const sumCfo = total(tail(cfo, w)), sumNi = total(tail(ni, w)), fcf = q.fcf, f = fcf.filter(isNum);
  const a = mean(head(fcf, 3)), b = mean(tail(fcf, 3)), span = n - 3;
  const grow = n >= 6 && isNum(a) && isNum(b) && a > 0 && b > 0 ? (b / a) ** (1 / span) - 1 : null;
  const accr = isNum(last(ni)) && isNum(last(cfo)) && isNum(last(assets)) ? ((last(ni) as number) - (last(cfo) as number)) / (last(assets) as number) : null;
  const cx = ratio(mean(tail(capex, 3)), mean(tail(cfo, 3)));
  return keep([
    metric('fcfMargin', 'Free cash flow margin', recent(c, q.fcfMargin), v => pct(v), 'Free cash flow is operating cash minus equipment spending. This is what is left for owners, per $1 of sales (three-year average).', { thr: [0, 0.05, 0.12], trend: q.fcfMargin }),
    metric('conv', 'Cash made per $1 of profit', isNum(sumCfo) && isNum(sumNi) && sumNi > 0 ? sumCfo / sumNi : null, v => '$' + v.toFixed(2), `Operating cash divided by net income over the last ${w} years. Above $1.00 means the profit is real cash, not only accounting.`, { thr: [0.7, 1, 1.2] }),
    metric('fcfYears', 'Years with positive free cash', f.length >= 3 ? f.filter(v => v > 0).length / f.length : null, v => pct(v, 0), 'The share of years where the business paid for its own spending.', { thr: [0.5, 0.8, 1] }),
    metric('fcfGrowth', 'Free cash growth per year', grow, v => pct(v), 'How fast free cash flow grew, comparing the last three years with the first three.', { thr: [0, 0.04, 0.1] }),
    metric('capexCfo', 'Share of operating cash spent on equipment', cx, v => pct(v, 0), 'A business that must spend most of its cash just to keep going has less to give owners.', { thr: [0.8, 0.5, 0.3], lower: true }),
    metric('accruals', 'Profit that is not cash', accr, v => pct(v), 'Net income minus operating cash, as a share of assets. Persistently above zero is a warning about earnings quality.', { thr: [0.08, 0.03, 0], lower: true, read: v => (v <= 0 ? 'Cash is higher than profit, which is a good sign.' : v > 0.03 ? 'Profit is running ahead of cash.' : '') })
  ]);
}

export function balanceMetrics(c: Ctx): Metric[] {
  const { q } = c, r = c.row, debt = last(r('debt')), cash = last(r('cash')), eq = last(r('equity')), ebitda = last(q.ebitda), fcf = last(q.fcf);
  const nd = last(q.netDebt), ndx = isNum(nd) && isNum(ebitda) && ebitda > 0 ? nd / ebitda : null;
  const quick = ratio(isNum(last(r('currentAssets'))) ? (last(r('currentAssets')) as number) - (last(r('inventory')) ?? 0) : null, last(r('currentLiabilities')));
  return keep([
    metric('current', 'Current ratio', last(q.currentRatio), times, 'Short-term assets divided by short-term bills. Below 1× is tight, though some strong retailers run that way on purpose.', { thr: [0.8, 1.2, 1.8], trend: q.currentRatio }),
    metric('quick', 'Quick ratio', quick, times, 'Like the current ratio, but without inventory, which can be slow to turn into cash.', { tone: 'info' }),
    metric('ndx', 'Net debt to yearly profit', ndx, v => (v <= 0 ? 'Net cash' : mult(v, 1)), 'Debt minus cash, divided by operating profit before wear (EBITDA). It is roughly how many years of profit it would take to repay the debt.', { thr: [4, 2.5, 1], lower: true, read: v => (v <= 0 ? 'It holds more cash than debt.' : '') }),
    metric('cover', 'Interest cover', last(q.interestCover), v => (v < 0 ? 'Negative' : mult(v, 1)), 'Operating profit divided by interest paid. Higher means interest is easy to pay.', { thr: [2, 5, 10], trend: q.interestCover, read: v => (v < 0 ? 'Operating profit was negative, so interest was not covered by the business.' : '') }),
    metric('de', 'Borrowings to owners\' money', last(q.debtToEquity), v => mult(v, 2), 'Long-term borrowing for each $1 of the owners\' money.', { thr: [2, 1, 0.5], lower: true, trend: q.debtToEquity }),
    metric('payback', 'Years of free cash to repay debt', isNum(debt) && isNum(fcf) && fcf > 0 ? debt / fcf : null, v => v.toFixed(1) + ' years', 'Debt divided by free cash flow.', { thr: [8, 4, 2], lower: true }),
    metric('equityShare', 'Owners\' share of assets', ratio(eq, last(r('assets'))), v => pct(v, 0), 'The part of everything it owns that is paid for by owners rather than lenders and suppliers.', { tone: 'info' }),
    metric('cashShare', 'Cash as a share of assets', ratio(cash, last(r('assets'))), v => pct(v, 0), 'A larger cushion makes bad years easier to survive.', { tone: 'info' })
  ]);
}

export function ownerMetrics(c: Ctx): Metric[] {
  const { q } = c, r = c.row, w = c.w, sh = r('shares'), f = sh.findIndex(isNum), z = sh.length - 1 - [...sh].reverse().findIndex(isNum);
  const change = f >= 0 && z > f ? (sh[z] as number) / (sh[f] as number) - 1 : null;
  const pay = ratio(mean(tail(c.returned, 3)), mean(tail(q.fcf, 3))), fcfAvg = mean(tail(q.fcf, 3));
  const sbc = ratio(mean(tail(r('sbc'), 3)), mean(tail(r('cfo'), 3))), acq = ratio(total(tail(r('acquisitions'), w)), total(tail(r('cfo'), w)));
  const div = ratio(mean(tail(r('dividends'), 3)), mean(tail(r('netIncome'), 3)));
  return keep([
    metric('payout', 'Paid back to owners vs free cash', isNum(fcfAvg) && fcfAvg > 0 ? pay : null, v => pct(v, 0), 'Dividends plus share buybacks, divided by free cash flow (three-year average). Over 100% means it pays out more than it earns and must use savings or borrow.', { thr: [1.6, 1.15, 0.8], lower: true }),
    metric('divPayout', 'Dividends as a share of profit', div, v => pct(v, 0), 'The part of net income paid out as dividends.', { tone: 'info' }),
    metric('shares', 'Change in share count', change, v => (v >= 0 ? '+' : '−') + (Math.abs(v) * 100).toFixed(1) + '%', 'Fewer shares means each remaining share owns more of the company. More shares means owners are being diluted.', { thr: [0.05, 0, -0.04], lower: true }),
    metric('sbc', 'Stock pay as a share of operating cash', sbc, v => pct(v, 0), 'Shares given to staff are a real cost to owners even though no cash leaves.', { thr: [0.25, 0.12, 0.05], lower: true }),
    metric('acq', 'Spent on buying companies', acq, v => pct(v, 0), `Money spent on acquisitions, as a share of operating cash over the last ${w} years.`, { tone: 'info' })
  ]);
}

export function financialMetrics(c: Ctx): { growth: Metric[]; profit: Metric[]; owners: Metric[] } {
  const { q } = c, ni = c.row('netIncome'), eq = c.row('equity'), assets = c.row('assets');
  const growth = growthMetrics(c).filter(m => ['salesCagr', 'salesNow', 'profitCagr'].includes(m.key)).map(m => ({ ...m, label: m.label.replace('Sales', 'Revenue'), what: m.what.replace(/sales/g, 'revenue') }));
  const gain = ni.filter(isNum), up = gain.length >= 3 ? gain.filter(v => v > 0).length / gain.length : null;
  const em = last(q.equityMultiplier), eqa = ratio(last(eq), last(assets));
  const profit = keep([
    metric('roe', 'Return on equity', recent(c, q.roe), v => pct(v), 'Profit made for each $1 of the owners\' money (three-year average). Good banks earn around 10% to 15%.', { thr: [0.06, 0.1, 0.14] }),
    metric('roa', 'Return on assets', recent(c, q.roa), v => pct(v, 2), 'Profit made for each $1 of everything it owns. For a bank, 1% is a solid result.', { thr: [0.004, 0.008, 0.012] }),
    metric('profitYears', 'Years with a profit', up, v => pct(v, 0), 'Banks and insurers can lose heavily in a crisis, so a clean record matters.', { thr: [0.7, 0.9, 1] }),
    metric('lev', 'Assets per $1 of owners\' money', em, v => mult(v, 1), 'How much the firm leans on borrowed and customers\' money. Banks are normally 8× to 14×.', { tone: 'info' }),
    metric('eqShare', 'Owners\' share of assets', eqa, v => pct(v, 1), 'The cushion owners provide before losses reach depositors and lenders.', { tone: 'info' })
  ]);
  return { growth, profit, owners: ownerMetrics(c).filter(m => ['shares', 'divPayout'].includes(m.key)) };
}

/** Averages the scores of a group of metrics. Null when none of them has a score. */
export function groupScore(ms: readonly Metric[]): number | null { const v = ms.map(m => m.score).filter(isNum); return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null; }
