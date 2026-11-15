/** Pure maths for the "Value a business" page: what a business is worth to a careful buyer, and the price range worth paying. No page, no network.
 *  Method: count only the cash the owners can really take out (owner earnings), charge growth for the money it needs, do not pay for growth that is
 *  not earned, and ask for a margin of safety. */

export type Predictability = 'steady' | 'bumpy' | 'risky';
export type Edge = 'none' | 'some' | 'strong';
/** How much new money the business needs to grow: light (services), medium, heavy (factories, shops, stock). */
export type Capital = 'light' | 'medium' | 'heavy';

export interface BusinessInputs {
  /** Profit after tax and interest, last year. */
  profit: number;
  /** Depreciation and amortisation added back (not real cash going out). */
  depreciation: number;
  /** Spending needed each year just to keep the business running as it is. */
  upkeep: number;
  /** Spare cash the owners could take out. */
  cash: number;
  /** Money the business owes. Already costs profit through interest, so it is a risk check, not a deduction. */
  debt: number;
  /** Expected yearly profit growth for the next few years, as a fraction (0.06 is 6%). */
  growth: number;
  predictability: Predictability;
  edge: Edge;
  /** Profit of the two years before last year, most recent first. Empty or missing means not given. */
  history?: number[];
  /** What the owner paid themselves last year (already inside the costs). */
  ownerPay?: number;
  /** What a hired manager would cost instead. */
  managerCost?: number;
  /** One-off costs last year that will not repeat (added back). */
  oneOffCosts?: number;
  /** One-off gains last year that will not repeat (taken out). */
  oneOffGains?: number;
  /** What the equipment, property and stock could be sold for. 0 means not given. */
  assets?: number;
  /** What a safe government bond pays, as a fraction. Sets the base of the return we ask for. */
  riskFree?: number;
  capital?: Capital;
  /** Internal: shifts the return asked for, used by the bear and bull cases. */
  returnShift?: number;
}

export const YEARS = 10;
export const TERMINAL_CAP = 0.025;
export const MINORITY_DISCOUNT = 0.1;
export const RISK_FREE = 0.04;
export const LIQUIDATION_RECOVERY = 0.7;

const PREMIUM: Record<Predictability, number> = { steady: 0.06, bumpy: 0.08, risky: 0.11 };
const SAFETY: Record<Predictability, number> = { steady: 0.2, bumpy: 0.3, risky: 0.4 };
const SAFETY_EDGE: Record<Edge, number> = { strong: -0.05, some: 0, none: 0.05 };
const HOLD: Record<Edge, number> = { strong: 7, some: 5, none: 3 };
const MULTIPLE: Record<Edge, number> = { strong: 16, some: 12, none: 8 };
const MULTIPLE_PRED: Record<Predictability, number> = { steady: 1, bumpy: 0.9, risky: 0.75 };
/** Return on each extra dollar put into the business. Light businesses need little to grow. */
export const ROIC: Record<Capital, number> = { light: 0.5, medium: 0.25, heavy: 0.12 };
const ORDER: Predictability[] = ['steady', 'bumpy', 'risky'];

const fin = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x));
const round = (x: number): number => Math.round(x);
const nz = (x: number | undefined): number => (fin(x) ? x : 0);

/** Long-run growth can not outrun the economy, so it is tied to the safe interest rate (about 2.5% when that is 4%). */
export const terminalCap = (riskFree: number): number => clamp(riskFree * 0.6, 0.015, 0.06);

/** Last year's profit after taking out one-offs, averaged with the earlier years when given, and adjusted for the owner's own pay. */
export function normalisedProfit(b: BusinessInputs): number {
  const last = b.profit + nz(b.oneOffCosts) - nz(b.oneOffGains);
  const years = [last, ...(b.history ?? []).filter(fin)];
  const avg = years.reduce((a, x) => a + x, 0) / years.length;
  return avg + nz(b.ownerPay) - nz(b.managerCost);
}

/** What the owners could really take home each year: normalised profit, plus depreciation (a bookkeeping cost), minus the upkeep spending. */
export const ownerEarnings = (b: BusinessInputs): number => normalisedProfit(b) + b.depreciation - b.upkeep;

/** How much profit has swung between years, as a share of its average. Null when fewer than two years are given. */
export function volatility(b: BusinessInputs): number | null {
  const ys = [b.profit, ...(b.history ?? []).filter(fin)];
  if (ys.length < 2) return null;
  const mean = ys.reduce((a, x) => a + x, 0) / ys.length;
  if (!(Math.abs(mean) > 0)) return null;
  const sd = Math.sqrt(ys.reduce((a, x) => a + (x - mean) ** 2, 0) / ys.length);
  return sd / Math.abs(mean);
}

/** The steadiness used in the maths: the choice made, or worse when the profit history swings a lot. */
export function effectivePredictability(b: BusinessInputs): Predictability {
  const v = volatility(b);
  const floor: Predictability = v == null ? 'steady' : v > 0.6 ? 'risky' : v > 0.3 ? 'bumpy' : 'steady';
  return ORDER[Math.max(ORDER.indexOf(b.predictability), ORDER.indexOf(floor))];
}

/** The yearly return a careful buyer should demand: the safe rate, plus extra for risk, plus extra for heavy debt. */
export function requiredReturn(b: BusinessInputs): number {
  const oe = ownerEarnings(b);
  const lever = oe > 0 ? b.debt / oe : b.debt > 0 ? Infinity : 0;
  return (b.riskFree ?? RISK_FREE) + PREMIUM[effectivePredictability(b)] + (lever > 4 ? 0.02 : lever > 2 ? 0.01 : 0) + nz(b.returnShift);
}

/** The margin of safety: how far below fair value the buyer wants to pay, as a fraction. */
export const marginOfSafety = (b: Pick<BusinessInputs, 'predictability' | 'edge'>): number => clamp(SAFETY[b.predictability] + SAFETY_EDGE[b.edge], 0.15, 0.45);

/** Growth that settles to a modest long-run rate. The growth rate holds for a few years (more if the business has a strong edge), then fades. */
export function growthPath(growth: number, edge: Edge, years = YEARS, cap = TERMINAL_CAP): number[] {
  const g = clamp(growth, -0.2, 0.3), terminal = Math.min(cap, g), hold = HOLD[edge];
  return Array.from({ length: years }, (_, i) => {
    const t = i + 1;
    if (t <= hold) return g;
    return g + (terminal - g) * ((t - hold) / (years - hold));
  });
}

/** The share of earnings that must go back into the business to grow at `g` a year. Shrinking businesses are not credited with freed-up money. */
export const reinvestRate = (g: number, capital: Capital): number => clamp(Math.max(0, g) / ROIC[capital], 0, 0.9);

export interface YearRow { year: number; growth: number; earnings: number; reinvested: number; free: number; pv: number }
export interface Projection { rows: YearRow[]; terminalValue: number; terminalPv: number; cash: number; total: number }

/** Ten years of cash the owners could take out, and what the business is worth after that, each in today's money. Growth costs money to fund. */
export function project(oe: number, growth: number, edge: Edge, required: number, cash: number, capital: Capital = 'medium', cap = TERMINAL_CAP): Projection {
  const spare = Math.max(0, cash);
  if (!(oe > 0)) return { rows: [], terminalValue: 0, terminalPv: 0, cash: spare, total: spare };
  const terminal = Math.min(cap, clamp(growth, -0.2, 0.3));
  let e = oe, pvSum = 0;
  const rows = growthPath(growth, edge, YEARS, cap).map((g, i) => {
    e *= 1 + g;
    const reinvested = e * reinvestRate(g, capital), free = e - reinvested, pv = free / (1 + required) ** (i + 1);
    pvSum += pv;
    return { year: i + 1, growth: g, earnings: e, reinvested, free, pv };
  });
  const tv = (e * (1 + terminal) * (1 - reinvestRate(terminal, capital))) / (required - terminal), terminalPv = tv / (1 + required) ** YEARS;
  return { rows, terminalValue: tv, terminalPv, cash: spare, total: Math.max(0, pvSum + terminalPv + spare) };
}

/** Cash-flow method: the total of {@link project}. */
export const dcfValue = (oe: number, growth: number, edge: Edge, required: number, cash: number, capital: Capital = 'medium', cap = TERMINAL_CAP): number => project(oe, growth, edge, required, cash, capital, cap).total;

/** No-growth method: what the earnings alone are worth if they never grew. The safest anchor. */
export const earningsPower = (oe: number, required: number, cash: number): number => (oe > 0 ? oe / required + Math.max(0, cash) : Math.max(0, cash));

/** What similar quality businesses tend to sell for, as a multiple of owner earnings. */
export const fairMultiple = (edge: Edge, predictability: Predictability): number => MULTIPLE[edge] * MULTIPLE_PRED[predictability];
const multipleValue = (oe: number, m: number, cash: number): number => (oe > 0 ? oe * Math.max(1, m) + Math.max(0, cash) : Math.max(0, cash));

export interface MethodRange { id: 'power' | 'dcf' | 'market' | 'assets'; name: string; low: number; mid: number; high: number; weight: number; note: string }
export interface Zones { bargain: number; sweet: number; ceiling: number }

export interface Valuation {
  ok: boolean;
  /** Why no price could be worked out, when ok is false. */
  reason?: string;
  ownerEarnings: number;
  /** Profit after one-offs, averaging and the owner-pay adjustment. */
  normalised: number;
  required: number;
  margin: number;
  multiple: number;
  /** The steadiness used, which may be worse than the one chosen. */
  predictability: Predictability;
  volatility: number | null;
  terminal: number;
  /** Share of earnings reinvested to fund the growth asked for in the first years. */
  reinvest: number;
  methods: MethodRange[];
  fair: number;
  zones: Zones;
  warnings: string[];
}

const EMPTY: Zones = { bargain: 0, sweet: 0, ceiling: 0 };

function warningsFor(b: BusinessInputs, oe: number, pred: Predictability): string[] {
  const out: string[] = [];
  const vol = volatility(b);
  if (b.growth > 0.15) out.push('A growth rate above 15% a year is rare and rarely lasts. We hold it for a few years, then let it fade, so the price does not rely on it.');
  if (b.growth < 0) out.push('You entered shrinking profits. We assume that continues for a while and then levels off.');
  if (reinvestRate(clamp(b.growth, -0.2, 0.3), b.capital ?? 'medium') > 0.6) out.push('Growing this fast would take most of the cash the business makes. Check whether you could really fund it.');
  if (vol != null && pred !== b.predictability) out.push(`Profits swung a lot between years, so we treated this business as ${pred}, not ${b.predictability}.`);
  if (b.history?.some(fin) && b.profit > 1.25 * (b.history.filter(fin).reduce((a, x) => a + x, 0) / b.history.filter(fin).length) && b.profit > 0) out.push('Last year was much better than the years before it. We averaged the years so one good year does not set the price.');
  if (b.upkeep < b.depreciation * 0.5) out.push('Upkeep spending is much lower than depreciation. Machines and equipment wear out, so check that the business is not skipping repairs and replacements.');
  if (oe > 0 && b.profit > 0 && oe < b.profit * 0.5) out.push('Less than half of the reported profit is real spare cash once upkeep is paid. Profit on paper is not the same as cash you can take home.');
  if (oe > 0 && b.debt > 4 * oe) out.push('Debt is more than four years of owner earnings. We asked for a higher return to cover this risk. Check when the loans must be repaid.');
  if (oe > 0 && b.cash > 5 * oe) out.push('Cash is more than five years of owner earnings. Check it is really spare and not needed to run the business.');
  return out;
}

/** The full valuation: ways of valuing the business, the fair value, and the three prices that matter (bargain, sweet spot, ceiling). */
export function valueBusiness(input: BusinessInputs): Valuation {
  const b: BusinessInputs = { ...input, cash: Math.max(0, input.cash), debt: Math.max(0, input.debt), growth: clamp(input.growth, -0.2, 0.3), assets: Math.max(0, nz(input.assets)), riskFree: clamp(fin(input.riskFree) ? input.riskFree : RISK_FREE, 0, 0.4), capital: input.capital ?? 'medium' };
  const bad = [b.profit, b.depreciation, b.upkeep, b.cash, b.debt, b.growth].some(x => !fin(x)) || (b.history ?? []).some(x => !fin(x));
  const oe = ownerEarnings(b), pred = effectivePredictability(b), req = requiredReturn(b), margin = marginOfSafety({ predictability: pred, edge: b.edge });
  const cap = terminalCap(b.riskFree as number), baseReq = RISK_FREE + PREMIUM[pred];
  const mult = fairMultiple(b.edge, pred) * (req > 0 ? clamp(baseReq / req, 0.5, 1.2) : 1);
  const base = { ownerEarnings: oe, normalised: normalisedProfit(b), required: req, margin, multiple: mult, predictability: pred, volatility: volatility(b), terminal: Math.min(cap, b.growth), reinvest: reinvestRate(b.growth, b.capital as Capital), methods: [] as MethodRange[], fair: 0, zones: EMPTY, warnings: warningsFor(b, oe, pred) };
  if (bad) return { ...base, ok: false, reason: 'Some numbers are missing or not valid. Check each box.' };
  if (!(oe > 0)) return { ...base, ok: false, reason: 'After upkeep spending this business has no spare cash for its owners. A price based on earnings cannot be worked out. Its worth then depends on what its assets could be sold for, which this page does not estimate.' };

  const capital = b.capital as Capital;
  const power: MethodRange = { id: 'power', name: 'Earnings if nothing grows', low: earningsPower(oe, req + 0.02, b.cash), mid: earningsPower(oe, req, b.cash), high: earningsPower(oe, req - 0.02, b.cash), weight: 0.3, note: 'What today’s earnings are worth if they never grow. The safest anchor.' };
  const dcf: MethodRange = { id: 'dcf', name: 'Cash it will produce', low: dcfValue(oe, b.growth - 0.02, b.edge, req + 0.01, b.cash, capital, cap), mid: dcfValue(oe, b.growth, b.edge, req, b.cash, capital, cap), high: dcfValue(oe, b.growth + 0.02, b.edge, req - 0.01, b.cash, capital, cap), weight: 0.4, note: 'Ten years of cash left after paying for growth, plus what the business is worth after that, in today’s money.' };
  const market: MethodRange = { id: 'market', name: 'What similar businesses sell for', low: multipleValue(oe, mult - 2, b.cash), mid: multipleValue(oe, mult, b.cash), high: multipleValue(oe, mult + 2, b.cash), weight: 0.3, note: `About ${mult.toFixed(mult % 1 ? 1 : 0)} times yearly owner earnings, set by quality, steadiness and interest rates.` };
  const sale = (k: number): number => Math.max(0, (b.assets as number) * k + b.cash - b.debt);
  const methods: MethodRange[] = [power, dcf, market];
  if ((b.assets as number) > 0) methods.push({ id: 'assets', name: 'If everything were sold', low: sale(0.5), mid: sale(LIQUIDATION_RECOVERY), high: sale(0.9), weight: 0, note: `What the assets could fetch (we assume about ${Math.round(LIQUIDATION_RECOVERY * 100)}% of the figure you gave), plus cash, less debt. A floor, not a target.` });
  const rounded = methods.map(m => ({ ...m, low: round(m.low), mid: round(m.mid), high: round(m.high) }));
  const blend = rounded.reduce((a, m) => a + m.mid * m.weight, 0);
  const floor = rounded.find(m => m.id === 'assets')?.mid ?? 0;
  const fair = round(Math.max(blend, floor));

  const sweet = fair * (1 - margin);
  const ceiling = Math.min(fair, Math.max(fair * (1 - margin / 2), sweet * 1.05));
  const bargain = Math.min(power.mid, sweet * 0.85);
  return { ...base, ok: true, methods: rounded, fair, zones: { bargain: round(bargain), sweet: round(sweet), ceiling: round(ceiling) } };
}

export interface Scenario { id: 'bear' | 'base' | 'bull'; name: string; fair: number; sweet: number; ceiling: number }
/** Three views of the same business: things go worse, as expected, or better. */
export function scenarios(b: BusinessInputs): Scenario[] {
  const defs: [Scenario['id'], string, number, number][] = [['bear', 'If things go worse', -0.04, 0.02], ['base', 'As you expect', 0, 0], ['bull', 'If things go better', 0.03, -0.01]];
  return defs.map(([id, name, dg, dr]) => {
    const v = valueBusiness({ ...b, growth: b.growth + dg, returnShift: nz(b.returnShift) + dr });
    return { id, name, fair: v.fair, sweet: v.zones.sweet, ceiling: v.zones.ceiling };
  });
}

export type Implied = { status: 'ok'; growth: number } | { status: 'none'; why: 'too-high' | 'too-low' };
/** The yearly growth the cash method needs in order to justify a price for the whole business. Scans a grid of growth rates and picks the match nearest the user's own. */
export function impliedGrowth(b: BusinessInputs, price: number): Implied {
  const v = valueBusiness(b);
  if (!v.ok || !(price > 0)) return { status: 'none', why: 'too-low' };
  const oe = v.ownerEarnings, cap = terminalCap(b.riskFree ?? RISK_FREE), at = (g: number): number => dcfValue(oe, g, b.edge, v.required, Math.max(0, b.cash), b.capital ?? 'medium', cap) - price;
  const hits: number[] = [];
  let prevG = -0.2, prev = at(prevG);
  if (prev === 0) hits.push(prevG);
  for (let g = -0.195; g <= 0.3001; g += 0.005) {
    const cur = at(g);
    if ((prev < 0 && cur >= 0) || (prev > 0 && cur <= 0)) hits.push(prevG + (0 - prev) * (g - prevG) / (cur - prev));
    prevG = g; prev = cur;
  }
  if (!hits.length) return { status: 'none', why: at(0.3) < 0 && at(-0.2) < 0 ? 'too-high' : 'too-low' };
  return { status: 'ok', growth: hits.reduce((best, x) => (Math.abs(x - b.growth) < Math.abs(best - b.growth) ? x : best)) };
}

export interface BridgeStep { label: string; delta: number; total: number; final?: boolean }
/** How reported profit turns into owner earnings, one step at a time. Steps that change nothing are left out. */
export function earningsBridge(b: BusinessInputs): BridgeStep[] {
  const steps: BridgeStep[] = [{ label: 'Profit last year', delta: b.profit, total: b.profit }];
  let run = b.profit;
  const add = (label: string, delta: number): void => { if (Math.abs(delta) > 0.5) { run += delta; steps.push({ label, delta, total: run }); } };
  add('Take out one-off items', nz(b.oneOffCosts) - nz(b.oneOffGains));
  add('Average with earlier years', normalisedProfit({ ...b, ownerPay: 0, managerCost: 0 }) - (b.profit + nz(b.oneOffCosts) - nz(b.oneOffGains)));
  add('Pay a manager instead of the owner', nz(b.ownerPay) - nz(b.managerCost));
  add('Add back depreciation (no cash leaves)', b.depreciation);
  add('Subtract upkeep spending', -b.upkeep);
  steps.push({ label: 'Owner earnings', delta: run, total: run, final: true });
  return steps;
}

export type Verdict = 'bargain' | 'good' | 'stretch' | 'toohigh';
/** Where a price sits against the three zones. */
export function verdictFor(price: number, z: Zones): Verdict {
  if (price <= z.bargain) return 'bargain';
  if (price <= z.sweet) return 'good';
  if (price <= z.ceiling) return 'stretch';
  return 'toohigh';
}

export type DealKind = 'whole' | 'part' | 'new';
export interface Deal {
  kind: DealKind;
  /** For 'part': the share of the business being sold, as a percent (1 to 99). */
  stakePct: number;
  /** For 'new': the money the buyer puts into the business for new shares. */
  newMoney: number;
  /** For 'new': the share of the business the buyer is offered for that money, as a percent. 0 means not stated. */
  offeredPct: number;
  /** The price being asked (whole and part). 0 means not stated. */
  ask: number;
}

export interface DealView {
  kind: DealKind;
  /** The share of the business you would own, as a fraction. */
  share: number;
  /** Prices you should pay for that share at each zone. For 'new', the company value before the money goes in. */
  zones: Zones;
  /** Whole-company value implied by the ask, or null when no ask is given. */
  impliedValue: number | null;
  verdict: Verdict | null;
  /** For 'new': the share you would own at each zone for the money put in. */
  shareAt: Zones | null;
  /** Yearly share of owner earnings per dollar paid, as a fraction. Null with no ask. */
  yield: number | null;
  /** Years of today’s owner earnings (your share) needed to earn back the price. Null when not meaningful. */
  payback: number | null;
  /** Whether a 10% not-in-control discount was applied. */
  discounted: boolean;
}

const scale = (z: Zones, k: number): Zones => ({ bargain: round(z.bargain * k), sweet: round(z.sweet * k), ceiling: round(z.ceiling * k) });
const pctToFrac = (p: number): number => clamp(fin(p) ? p : 0, 0, 100) / 100;

/** Turns the whole-business prices into what matters for the deal: a part of the business, or new money going in for new shares. */
export function dealView(v: Valuation, d: Deal): DealView {
  const none: DealView = { kind: d.kind, share: 0, zones: EMPTY, impliedValue: null, verdict: null, shareAt: null, yield: null, payback: null, discounted: false };
  if (!v.ok) return none;
  const oe = v.ownerEarnings;
  if (d.kind === 'whole') {
    const ask = d.ask > 0 ? d.ask : null;
    return { ...none, share: 1, zones: v.zones, impliedValue: ask, verdict: ask ? verdictFor(ask, v.zones) : null, yield: ask ? oe / ask : null, payback: ask ? ask / oe : null };
  }
  if (d.kind === 'part') {
    const share = clamp(pctToFrac(d.stakePct), 0.01, 0.99), discounted = share < 0.5, k = share * (discounted ? 1 - MINORITY_DISCOUNT : 1), zones = scale(v.zones, k), ask = d.ask > 0 ? d.ask : null;
    return { ...none, share, zones, discounted, impliedValue: ask ? ask / share : null, verdict: ask ? verdictFor(ask, zones) : null, yield: ask ? (oe * share) / ask : null, payback: ask ? ask / (oe * share) : null };
  }
  const m = Math.max(0, fin(d.newMoney) ? d.newMoney : 0);
  if (!(m > 0)) return { ...none, kind: 'new' };
  const share0 = m / (v.zones.sweet + m), discounted = share0 < 0.5, zones = scale(v.zones, discounted ? 1 - MINORITY_DISCOUNT : 1);
  const shareAt: Zones = { bargain: m / (zones.bargain + m), sweet: m / (zones.sweet + m), ceiling: m / (zones.ceiling + m) };
  const y = pctToFrac(d.offeredPct), implied = y > 0 ? m / y - m : null;
  const share = y > 0 ? y : shareAt.sweet;
  return { ...none, kind: 'new', share, zones, shareAt, discounted, impliedValue: implied != null ? implied : null, verdict: implied != null ? verdictFor(Math.max(0, implied), zones) : null, yield: y > 0 ? (oe * y) / m : null, payback: y > 0 ? m / (oe * y) : null };
}

/** A grid of cash-flow values for different growth rates and required returns, so a student sees how touchy a valuation is. */
export function sensitivity(b: BusinessInputs, growthSteps = [-0.04, -0.02, 0, 0.02, 0.04], returnSteps = [-0.02, -0.01, 0, 0.01, 0.02]): { growths: number[]; returns: number[]; values: number[][] } {
  const oe = ownerEarnings(b), req = requiredReturn(b), cap = terminalCap(b.riskFree ?? RISK_FREE), capital = b.capital ?? 'medium';
  const growths = growthSteps.map(s => b.growth + s), returns = returnSteps.map(s => req + s);
  return { growths, returns, values: returns.map(r => growths.map(g => round(dcfValue(oe, g, b.edge, r, Math.max(0, b.cash), capital, cap)))) };
}
