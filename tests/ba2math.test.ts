import { describe, expect, it } from 'vitest';
import { accrued, addDays, addMonths, amortize, bondPriceFromYield, bondYieldFromPrice, days360, daysActual, depreciate, effFromNom, expandFlows, fmtDate, fromDate, irrPercent, nfvAt, nomFromEff, npvAt, paybackPeriod, piAt, solveBreakeven, solveProfit, solveTvm, statistics, toDate, tvmResidual, type Tvm } from '../src/lib/ba2math';

const near = (a: number | null, b: number, d = 6) => { expect(a).not.toBeNull(); expect(a as number).toBeCloseTo(b, d); };
const t = (o: Partial<Tvm>): Tvm => ({ N: 0, IY: 0, PV: 0, PMT: 0, FV: 0, ...o });

describe('time value of money (BA II Plus answers)', () => {
  it('grows $1,000 at 5% for 10 years to $1,628.89', () => { near(solveTvm(t({ N: 10, IY: 5, PV: -1000 }), 'FV', 1, 1, false), 1628.89, 2); });
  it('finds the 30-year payment on $250,000 at 6.5%: −$1,580.17', () => { near(solveTvm(t({ N: 360, IY: 6.5, PV: 250000 }), 'PMT', 12, 12, false), -1580.17, 2); });
  it('finds the rate that doubles money in 10 years: 7.18%', () => { near(solveTvm(t({ N: 10, PV: -1000, FV: 2000 }), 'IY', 1, 1, false), 7.177346, 4); });
  it('finds the number of periods, with and without interest', () => {
    near(solveTvm(t({ IY: 7.177346, PV: -1000, FV: 2000 }), 'N', 1, 1, false), 10, 4);
    near(solveTvm(t({ IY: 0, PV: -1000, PMT: 100 }), 'N', 1, 1, false), 10, 9);
  });
  it('values an annuity due above an ordinary annuity by one period of interest', () => {
    const base = t({ N: 5, IY: 6, PMT: -100 });
    near(solveTvm(base, 'PV', 1, 1, false), 421.2364, 3); near(solveTvm(base, 'PV', 1, 1, true), 421.2364 * 1.06, 3);
  });
  it('honours payments per year and compounding periods per year', () => {
    const v = solveTvm(t({ N: 120, IY: 12, PV: -1000 }), 'FV', 12, 12, false); near(v, 1000 * Math.pow(1.01, 120), 6);
    const q = solveTvm(t({ N: 4, IY: 12, PV: -1000 }), 'FV', 1, 4, false); near(q, 1000 * Math.pow(1.03, 16), 6); /* 4 payments a year-apart, rate compounds quarterly */
  });
  it('every solved value satisfies the balance equation', () => {
    (['FV', 'PV', 'PMT', 'N', 'IY'] as const).forEach(k => {
      const base = t({ N: 24, IY: 9, PV: 5000, PMT: -200, FV: -1000 }), v = solveTvm(base, k, 12, 12, true)!;
      expect(Math.abs(tvmResidual({ ...base, [k]: v }, 12, 12, true)), k).toBeLessThan(1e-6);
    });
  });
  it('reports no answer when none exists', () => { expect(solveTvm(t({ N: 10, IY: 5, PV: 1000, FV: 1000, PMT: 0 }), 'N', 1, 1, false)).toBeNull(); expect(solveTvm(t({ N: 5, IY: 5, PV: 100, PMT: 20, FV: 100 }), 'IY', 1, 1, false)).toBeNull(); });
});

describe('cash flow worksheet', () => {
  const series = expandFlows(-1000, [{ c: 300, f: 1 }, { c: 400, f: 1 }, { c: 500, f: 1 }, { c: 600, f: 1 }]);
  it('expands repeat counts', () => { expect(expandFlows(-100, [{ c: 50, f: 2 }])).toEqual([-100, 50, 50]); expect(expandFlows(0, [{ c: 5, f: 0 }])).toEqual([0]); });
  it('NPV at 10% and IRR check out', () => {
    near(npvAt(10, series), -1000 + 300 / 1.1 + 400 / 1.21 + 500 / 1.331 + 600 / 1.4641, 9);
    const r = irrPercent(series)!; near(npvAt(r, series), 0, 6); expect(r).toBeGreaterThan(20); expect(r).toBeLessThan(30);
  });
  it('NFV, profitability index and payback', () => {
    near(nfvAt(10, series), npvAt(10, series) * Math.pow(1.1, 4), 9); near(piAt(10, series), 1 + (npvAt(10, series) + 1000) / 1000, 9);
    near(paybackPeriod([-1000, 400, 400, 400]), 2.5, 9); expect(paybackPeriod([-1000, 100, 100])).toBeNull(); near(paybackPeriod([500, 1]), 0, 9);
    near(paybackPeriod([-1000, 500, 500, 500]), 2, 9); expect(paybackPeriod([-1000, 500, 500, 500], 10)!).toBeGreaterThan(2); expect(paybackPeriod([-1000, 400, 400, 400], 10)).toBeNull();
  });
  it('has no IRR when every flow has the same sign', () => { expect(irrPercent([100, 100, 100])).toBeNull(); });
});

describe('amortization', () => {
  const loan = t({ N: 12, IY: 12, PV: 10000, PMT: -888.49 });
  it('splits the first payment into interest and principal', () => {
    const a = amortize(loan, 12, 12, false, 1, 1, 2)!; near(a.int, -100, 6); near(a.prn, -788.49, 6); near(a.bal, 10000 - 788.49, 6);
  });
  it('pays the loan off by the last payment', () => {
    const a = amortize(loan, 12, 12, false, 1, 12, 2)!; expect(Math.abs(a.bal)).toBeLessThan(0.2); near(a.prn, -10000, 0); near(a.prn + a.int, -888.49 * 12, 6);
  });
  it('rejects ranges outside the loan', () => { expect(amortize(loan, 12, 12, false, 0, 3, 2)).toBeNull(); expect(amortize(loan, 12, 12, false, 5, 3, 2)).toBeNull(); expect(amortize(loan, 12, 12, false, 1, 13, 2)).toBeNull(); });
  it('charges no interest on a payment made at the start of the loan', () => { near(amortize(loan, 12, 12, true, 1, 1, 2)!.int, 0, 9); });
});

describe('dates', () => {
  it('reads MM.DDYY and rejects impossible dates', () => {
    expect(fmtDate(toDate(12.3124)!)).toBe('12-31-2024'); expect(fmtDate(toDate(1.0199)!)).toBe('01-01-1999'); expect(toDate(2.3024)).toBeNull(); expect(toDate(13.0124)).toBeNull();
  });
  it('round-trips and counts days', () => {
    const d = toDate(6.1520)!; near(fromDate(d), 6.152, 9); near(daysActual(toDate(1.0120)!, toDate(3.0120)!), 60, 9);
    near(daysActual(toDate(1.0120)!, addDays(toDate(1.0120)!, 45)), 45, 9); expect(fmtDate(addMonths(toDate(1.3120)!, 1))).toBe('02-29-2020');
  });
  it('counts 30/360 days', () => { near(days360(toDate(1.3120)!, toDate(3.3120)!), 60, 9); near(days360(toDate(2.1517)!, toDate(11.1517)!), 270, 9); });
});

describe('bonds', () => {
  const b = { sdt: 2.1508, cpn: 5.75, rdt: 11.1517, rv: 100, act: false, semi: true };
  it('matches the published price for a 5.75% bond at a 6.5% yield (30/360, semi-annual): 94.6344', () => { near(bondPriceFromYield(b, 6.5), 94.63436162, 5); });
  it('recovers the yield from that price', () => { near(bondYieldFromPrice(b, 94.63436162), 6.5, 5); });
  it('prices at par when the yield equals the coupon on a coupon date', () => { near(bondPriceFromYield({ ...b, sdt: 5.1508, rdt: 11.1517 }, 5.75) as number + (accrued({ ...b, sdt: 5.1508 }) as number), 100, 0); });
  it('falls when the yield rises and rejects settlement after maturity', () => {
    expect(bondPriceFromYield(b, 8)!).toBeLessThan(bondPriceFromYield(b, 6)!); expect(bondPriceFromYield({ ...b, sdt: 12.0120 }, 6)).toBeNull(); expect(accrued({ ...b, sdt: 99.9999 })).toBeNull();
  });
  it('pays accrued interest between coupons and none on a coupon date', () => { expect(accrued(b)!).toBeGreaterThan(0); near(accrued({ ...b, sdt: 5.1508 }), 0, 9); });
});

describe('depreciation', () => {
  const base = { method: 'SL' as const, life: 5, m: 1, cst: 10000, sal: 1000, yr: 1, db: 200 };
  it('straight line', () => { near(depreciate(base)!.dep, 1800, 6); near(depreciate({ ...base, yr: 3 })!.rbv, 4600, 6); near(depreciate({ ...base, yr: 5 })!.rdv, 0, 6); });
  it('sum of the years digits', () => { near(depreciate({ ...base, method: 'SYD' })!.dep, 3000, 6); near(depreciate({ ...base, method: 'SYD', yr: 5 })!.rdv, 0, 6); });
  it('declining balance at 200%', () => { near(depreciate({ ...base, method: 'DB' })!.dep, 4000, 6); near(depreciate({ ...base, method: 'DB', yr: 2 })!.dep, 2400, 6); });
  it('never takes the book value below salvage and handles a partial first year', () => {
    expect(depreciate({ ...base, method: 'DB', yr: 5 })!.rbv).toBeGreaterThanOrEqual(1000 - 1e-6);
    near(depreciate({ ...base, m: 7 })!.dep, 1800 * 0.5, 6);
  });
  it('rejects nonsense', () => { expect(depreciate({ ...base, life: 0 })).toBeNull(); expect(depreciate({ ...base, m: 13 })).toBeNull(); expect(depreciate({ ...base, yr: 0 })).toBeNull(); });
});

describe('statistics and small worksheets', () => {
  it('fits a straight line', () => {
    const s = statistics([{ x: 1, y: 2 }, { x: 2, y: 4 }, { x: 3, y: 6 }])!;
    near(s.b, 2, 9); near(s.a, 0, 9); near(s.r, 1, 9); expect(s.n).toBe(3); near(s.xbar, 2, 9); near(s.sx, 1, 9); near(s.sumxy, 28, 9); near(s.sigx, Math.sqrt(2 / 3), 9);
    expect(statistics([])).toBeNull(); expect(Number.isNaN(statistics([{ x: 1, y: 1 }])!.sx)).toBe(true);
  });
  it('break-even', () => {
    const b = { fc: 10000, vc: 5, p: 15, pft: 0, q: 0 };
    near(solveBreakeven(b, 'q'), 1000, 9); near(solveBreakeven({ ...b, q: 2000 }, 'pft'), 10000, 9); near(solveBreakeven({ ...b, q: 1000 }, 'p'), 15, 9); near(solveBreakeven({ ...b, q: 1000 }, 'vc'), 5, 9); near(solveBreakeven({ ...b, q: 1000 }, 'fc'), 10000, 9);
    expect(solveBreakeven({ ...b, p: 5 }, 'q')).toBeNull();
  });
  it('profit margin', () => { near(solveProfit({ cst: 80, sel: 100, mar: 0 }, 'mar'), 20, 9); near(solveProfit({ cst: 80, sel: 0, mar: 20 }, 'sel'), 100, 9); near(solveProfit({ cst: 0, sel: 100, mar: 20 }, 'cst'), 80, 9); expect(solveProfit({ cst: 1, sel: 0, mar: 0 }, 'mar')).toBeNull(); });
  it('converts nominal and effective rates', () => { near(effFromNom(12, 12), 12.682503, 5); near(nomFromEff(12.682503, 12), 12, 5); });
});
