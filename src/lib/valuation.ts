/** Pure maths for the "Value a business" page: what a business is worth to a careful buyer, and the price range worth paying. No page, no network.
 *  Method: count only the cash the owners can really take out (owner earnings), do not pay for growth that is not earned, and ask for a margin of safety. */

export type Predictability = 'steady' | 'bumpy' | 'risky';
export type Edge = 'none' | 'some' | 'strong';

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
}

export const YEARS = 10;
export const TERMINAL_CAP = 0.025;
export const MINORITY_DISCOUNT = 0.1;

const REQUIRED: Record<Predictability, number> = { steady: 0.1, bumpy: 0.12, risky: 0.15 };
const SAFETY: Record<Predictability, number> = { steady: 0.2, bumpy: 0.3, risky: 0.4 };
const SAFETY_EDGE: Record<Edge, number> = { strong: -0.05, some: 0, none: 0.05 };
const HOLD: Record<Edge, number> = { strong: 7, some: 5, none: 3 };
const MULTIPLE: Record<Edge, number> = { strong: 16, some: 12, none: 8 };
const MULTIPLE_PRED: Record<Predictability, number> = { steady: 1, bumpy: 0.9, risky: 0.75 };

const fin = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x));
const round = (x: number): number => Math.round(x);

/** What the owners could really take home each year: profit, plus depreciation (a bookkeeping cost), minus the upkeep spending. */
export const ownerEarnings = (b: Pick<BusinessInputs, 'profit' | 'depreciation' | 'upkeep'>): number => b.profit + b.depreciation - b.upkeep;

/** The yearly return a careful buyer should demand. Riskier or more indebted businesses must promise more. */
export function requiredReturn(b: BusinessInputs): number {
  const oe = ownerEarnings(b);
  const lever = oe > 0 ? b.debt / oe : b.debt > 0 ? Infinity : 0;
  return REQUIRED[b.predictability] + (lever > 4 ? 0.02 : lever > 2 ? 0.01 : 0);
}

/** The margin of safety: how far below fair value the buyer wants to pay, as a fraction. */
export const marginOfSafety = (b: Pick<BusinessInputs, 'predictability' | 'edge'>): number => clamp(SAFETY[b.predictability] + SAFETY_EDGE[b.edge], 0.15, 0.45);

/** Growth that settles to a modest long-run rate. The growth rate holds for a few years (more if the business has a strong edge), then fades. */
export function growthPath(growth: number, edge: Edge, years = YEARS): number[] {
  const g = clamp(growth, -0.2, 0.3), terminal = Math.min(TERMINAL_CAP, g), hold = HOLD[edge];
  return Array.from({ length: years }, (_, i) => {
    const t = i + 1;
    if (t <= hold) return g;
    return g + (terminal - g) * ((t - hold) / (years - hold));
  });
}

/** Cash-flow method: add up the owner earnings of the next ten years and what the business is worth after that, each brought back to today's money. */
export function dcfValue(oe: number, growth: number, edge: Edge, required: number, cash: number): number {
  if (!(oe > 0)) return Math.max(0, cash);
  const path = growthPath(growth, edge), terminal = Math.min(TERMINAL_CAP, clamp(growth, -0.2, 0.3));
  let e = oe, pv = 0;
  path.forEach((g, i) => { e *= 1 + g; pv += e / (1 + required) ** (i + 1); });
  const tv = (e * (1 + terminal)) / (required - terminal);
  return Math.max(0, pv + tv / (1 + required) ** YEARS + cash);
}

/** No-growth method: what the earnings alone are worth if they never grew. The safest anchor. */
export const earningsPower = (oe: number, required: number, cash: number): number => (oe > 0 ? oe / required + Math.max(0, cash) : Math.max(0, cash));

/** What similar quality businesses tend to sell for, as a multiple of owner earnings. */
export const fairMultiple = (edge: Edge, predictability: Predictability): number => MULTIPLE[edge] * MULTIPLE_PRED[predictability];
const multipleValue = (oe: number, m: number, cash: number): number => (oe > 0 ? oe * Math.max(1, m) + Math.max(0, cash) : Math.max(0, cash));

export interface MethodRange { id: 'power' | 'dcf' | 'market'; name: string; low: number; mid: number; high: number; weight: number; note: string }
export interface Zones { bargain: number; sweet: number; ceiling: number }

export interface Valuation {
  ok: boolean;
  /** Why no price could be worked out, when ok is false. */
  reason?: string;
  ownerEarnings: number;
  required: number;
  margin: number;
  multiple: number;
  methods: MethodRange[];
  fair: number;
  zones: Zones;
  warnings: string[];
}

const EMPTY: Zones = { bargain: 0, sweet: 0, ceiling: 0 };

function warningsFor(b: BusinessInputs, oe: number): string[] {
  const out: string[] = [];
  if (b.growth > 0.15) out.push('A growth rate above 15% a year is rare and rarely lasts. We hold it for a few years, then let it fade, so the price does not rely on it.');
  if (b.growth < 0) out.push('You entered shrinking profits. We assume that continues for a while and then levels off.');
  if (b.upkeep < b.depreciation * 0.5) out.push('Upkeep spending is much lower than depreciation. Machines and equipment wear out, so check that the business is not skipping repairs and replacements.');
  if (oe > 0 && b.profit > 0 && oe < b.profit * 0.5) out.push('Less than half of the reported profit is real spare cash once upkeep is paid. Profit on paper is not the same as cash you can take home.');
  if (oe > 0 && b.debt > 4 * oe) out.push('Debt is more than four years of owner earnings. We asked for a higher return to cover this risk. Check when the loans must be repaid.');
  if (oe > 0 && b.cash > 5 * oe) out.push('Cash is more than five years of owner earnings. Check it is really spare and not needed to run the business.');
  return out;
}

/** The full valuation: three ways of valuing the business, the fair value, and the three prices that matter (bargain, sweet spot, ceiling). */
export function valueBusiness(input: BusinessInputs): Valuation {
  const b: BusinessInputs = { ...input, cash: Math.max(0, input.cash), debt: Math.max(0, input.debt), growth: clamp(input.growth, -0.2, 0.3) };
  const bad = [b.profit, b.depreciation, b.upkeep, b.cash, b.debt, b.growth].some(x => !fin(x));
  const oe = ownerEarnings(b), req = requiredReturn(b), margin = marginOfSafety(b), mult = fairMultiple(b.edge, b.predictability);
  const base = { ownerEarnings: oe, required: req, margin, multiple: mult, methods: [] as MethodRange[], fair: 0, zones: EMPTY, warnings: warningsFor(b, oe) };
  if (bad) return { ...base, ok: false, reason: 'Some numbers are missing or not valid. Check each box.' };
  if (!(oe > 0)) return { ...base, ok: false, reason: 'After upkeep spending this business has no spare cash for its owners. A price based on earnings cannot be worked out. Its worth then depends on what its assets could be sold for, which this page does not estimate.' };

  const power: MethodRange = { id: 'power', name: 'Earnings if nothing grows', low: earningsPower(oe, req + 0.02, b.cash), mid: earningsPower(oe, req, b.cash), high: earningsPower(oe, req - 0.02, b.cash), weight: 0.3, note: 'What today’s earnings are worth if they never grow. The safest anchor.' };
  const dcf: MethodRange = { id: 'dcf', name: 'Cash it will produce', low: dcfValue(oe, b.growth - 0.02, b.edge, req + 0.01, b.cash), mid: dcfValue(oe, b.growth, b.edge, req, b.cash), high: dcfValue(oe, b.growth + 0.02, b.edge, req - 0.01, b.cash), weight: 0.4, note: 'Ten years of owner earnings plus what the business is worth after that, in today’s money.' };
  const market: MethodRange = { id: 'market', name: 'What similar businesses sell for', low: multipleValue(oe, mult - 2, b.cash), mid: multipleValue(oe, mult, b.cash), high: multipleValue(oe, mult + 2, b.cash), weight: 0.3, note: `About ${mult.toFixed(mult % 1 ? 1 : 0)} times yearly owner earnings, set by quality and how steady profits are.` };
  const methods = [power, dcf, market].map(m => ({ ...m, low: round(m.low), mid: round(m.mid), high: round(m.high) }));
  const fair = round(methods.reduce((a, m) => a + m.mid * m.weight, 0));

  const sweet = fair * (1 - margin);
  const ceiling = Math.min(fair, Math.max(fair * (1 - margin / 2), sweet * 1.05));
  const bargain = Math.min(power.mid, sweet * 0.85);
  return { ...base, ok: true, methods, fair, zones: { bargain: round(bargain), sweet: round(sweet), ceiling: round(ceiling) } };
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
  const oe = ownerEarnings(b), req = requiredReturn(b);
  const growths = growthSteps.map(s => b.growth + s), returns = returnSteps.map(s => req + s);
  return { growths, returns, values: returns.map(r => growths.map(g => round(dcfValue(oe, g, b.edge, r, Math.max(0, b.cash))))) };
}
