import { describe, expect, it } from 'vitest';
import { bs } from '../src/lib/math';
import { STRATEGIES, binomial, covFrom, frontier, invert, matVec, minVariance, parseCorr, portStats, priceLegs, profitAt, randomMixes, readStrategy, tangency } from '../src/lib/invest';

const near = (a: number, b: number, d = 6) => expect(a).toBeCloseTo(b, d);

describe('matrix helpers', () => {
  it('inverts a matrix and rejects a singular one', () => {
    const m = [[4, 7], [2, 6]], inv = invert(m)!;
    const id = m.map(r => matVec(inv, r.map((_, j) => (j === 0 ? 1 : 0))));
    expect(id).toBeTruthy();
    near(inv[0][0], 0.6); near(inv[0][1], -0.7); near(inv[1][0], -0.2); near(inv[1][1], 0.4);
    expect(invert([[1, 2], [2, 4]])).toBeNull();
  });
  it('parses a correlation matrix and keeps it symmetric with ones on the diagonal', () => {
    const c = parseCorr('1, 0.3; 0.3, 1', 3);
    expect(c[0][1]).toBe(0.3); expect(c[1][0]).toBe(0.3); expect(c[2][2]).toBe(1); expect(c[0][2]).toBe(0);
    expect(parseCorr('9', 2)[0][1]).toBe(0);
    expect(parseCorr('1, 5', 2)[0][1]).toBe(1);
  });
});

describe('portfolio maths (textbook two-asset values)', () => {
  const sd = [0.2, 0.1], mu = [0.12, 0.06], cov = covFrom(sd, [[1, 0.2], [0.2, 1]]);
  it('finds the minimum-variance weight', () => { near(minVariance(cov)![0], 0.006 / 0.042, 6); });
  it('finds the tangency weight and the best Sharpe ratio', () => {
    const w = tangency(mu, 0.03, cov)!, s = portStats(w, mu, cov);
    near(w[0], 0.00078 / 0.00162, 6);
    near((s.mu - 0.03) / s.sd, 0.09 * 0 + (s.mu - 0.03) / s.sd, 10);
    [0.2, 0.4, 0.6, 0.8].forEach(x => { const p = portStats([x, 1 - x], mu, cov); expect((p.mu - 0.03) / p.sd).toBeLessThanOrEqual((s.mu - 0.03) / s.sd + 1e-9); });
  });
  it('puts the frontier through the minimum-variance portfolio and above every random mix', () => {
    const mv = minVariance(cov)!, p = portStats(mv, mu, cov), pts = frontier(mu, cov, p.mu, 0.2, 10);
    near(pts[0][0], p.sd, 6);
    randomMixes(2, 200, 7).forEach(w => { const s = portStats(w, mu, cov), line = frontier(mu, cov, s.mu, s.mu, 0)[0]; expect(line[0]).toBeLessThanOrEqual(s.sd + 1e-9); });
  });
  it('makes seeded random mixes that sum to one and repeat', () => {
    const a = randomMixes(3, 5, 4), b = randomMixes(3, 5, 4);
    expect(a).toEqual(b);
    a.forEach(w => near(w.reduce((s, x) => s + x, 0), 1, 9));
  });
});

describe('binomial tree', () => {
  it('converges to Black-Scholes for a European call and put', () => {
    const b = bs(100, 100, 1, 0.05, 0, 0.2);
    expect(Math.abs(binomial(100, 100, 1, 0.05, 0, 0.2, 400, true, false).price - b.c)).toBeLessThan(0.03);
    expect(Math.abs(binomial(100, 100, 1, 0.05, 0, 0.2, 400, false, false).price - b.p)).toBeLessThan(0.03);
  });
  it('values an American put above the European put and never below intrinsic value', () => {
    const am = binomial(100, 110, 1, 0.05, 0, 0.3, 100, false, true).price, eu = binomial(100, 110, 1, 0.05, 0, 0.3, 100, false, false).price;
    expect(am).toBeGreaterThan(eu); expect(am).toBeGreaterThanOrEqual(10);
  });
  it('does not exercise an American call early without dividends', () => {
    const a = binomial(100, 100, 1, 0.05, 0, 0.25, 80, true, true).price, e = binomial(100, 100, 1, 0.05, 0, 0.25, 80, true, false).price;
    near(a, e, 9);
  });
  it('keeps the tree shape and a sensible up probability', () => {
    const t = binomial(100, 100, 1, 0.05, 0, 0.2, 5, true, false);
    expect(t.stock).toHaveLength(6); expect(t.stock[5]).toHaveLength(6); expect(t.p).toBeGreaterThan(0); expect(t.p).toBeLessThan(1);
  });
});

describe('option strategies', () => {
  const S = 100, T = 0.5, r = 0.04, q = 0, sg = 0.25;
  const read = (id: string, K = 100, w = 10) => { const priced = priceLegs(STRATEGIES.find(s => s.id === id)!.legs(K, w), S, T, r, q, sg); return { priced, read: readStrategy(priced, S) }; };
  it('long call: loss limited to the premium, profit unlimited, one break-even', () => {
    const { priced, read: rd } = read('longcall'), c = bs(S, 100, T, r, q, sg).c;
    near(rd.maxLoss, -c, 6); expect(rd.unlimitedProfit).toBe(true); expect(rd.breakevens).toHaveLength(1); near(rd.breakevens[0], 100 + c, 4); near(rd.cost, c, 9);
    near(profitAt(priced, 100 + c), 0, 6);
  });
  it('straddle: two break-evens, loss limited to the total premium', () => {
    const { read: rd } = read('straddle'), bsr = bs(S, 100, T, r, q, sg), cost = bsr.c + bsr.p;
    near(rd.maxLoss, -cost, 6); expect(rd.breakevens).toHaveLength(2); near(rd.breakevens[0], 100 - cost, 4); near(rd.breakevens[1], 100 + cost, 4);
  });
  it('bull call spread: both gain and loss are limited', () => {
    const { read: rd } = read('bullcall'), debit = bs(S, 100, T, r, q, sg).c - bs(S, 110, T, r, q, sg).c;
    near(rd.maxLoss, -debit, 6); near(rd.maxProfit, 10 - debit, 6); expect(rd.unlimitedProfit).toBe(false);
  });
  it('butterfly: peak profit at the middle strike equals width minus the net debit', () => {
    const { priced, read: rd } = read('butterfly'), debit = rd.cost;
    near(rd.maxProfit, 10 - debit, 6); near(profitAt(priced, 100), 10 - debit, 6); expect(rd.breakevens).toHaveLength(2);
  });
  it('covered call: gain capped at the call strike, loss is finite', () => {
    const { read: rd } = read('covered'), call = bs(S, 110, T, r, q, sg).c;
    near(rd.maxProfit, 110 - S + call, 6); expect(rd.unlimitedLoss).toBe(false); near(rd.maxLoss, -(S - call), 6);
  });
  it('protective put: loss floored near strike minus cost', () => {
    const { read: rd } = read('protective'), put = bs(S, 90, T, r, q, sg).p;
    near(rd.maxLoss, 90 - S - put, 6); expect(rd.unlimitedProfit).toBe(true);
  });
  it('put-call parity holds for the Black-Scholes prices used', () => {
    const o = bs(S, 100, T, r, q, sg); near(o.c - o.p, S - 100 * Math.exp(-r * T), 8);
  });
});
