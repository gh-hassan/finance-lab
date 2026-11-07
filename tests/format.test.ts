import { describe, expect, it } from 'vitest';
import { compact, money, pct, signedPct, mult, num, monthYear, longDate, yy } from '../src/lib/format';

describe('number formatting', () => {
  it('shortens big numbers', () => {
    expect(money(478834000000)).toBe('$479B'); expect(money(1.234e12)).toBe('$1.2T'); expect(money(12_345_678)).toBe('$12.3M'); expect(money(4500)).toBe('$4.5K'); expect(money(950)).toBe('$950'); expect(money(0)).toBe('$0'); expect(money(7.5)).toBe('$7.50');
  });
  it('never prints 1000 of a unit', () => {
    expect(compact(999_950)).toBe('1.0M'); expect(compact(999_999_999)).toBe('1.0B'); expect(compact(999_400)).toBe('999K'); expect(compact(999_950_000_000)).toBe('1.0T');
  });
  it('uses a real minus sign and keeps the sign with the symbol', () => {
    expect(money(-54562)).toBe('−$54.6K'); expect(pct(-0.123)).toBe('−12.3%'); expect(mult(-2)).toBe('−2.0×'); expect(num(-1234.5, 1)).toBe('−1,234.5');
  });
  it('honours explicit decimals under 1,000 and groups only whole numbers', () => {
    expect(money(123.45, { d: 2 })).toBe('$123.45'); expect(money(8.98, { d: 2 })).toBe('$8.98'); expect(money(1234.5678, { d: 2 })).toBe('$1.23K'); expect(num(1234.5678, 4)).toBe('1,234.5678'); expect(num(1234567.891, 2)).toBe('1,234,567.89'); expect(money(-0.001)).toBe('$0');
  });
  it('does not print a minus in front of zero', () => {
    expect(pct(-0.00001)).toBe('0.0%'); expect(num(-0.2)).toBe('0'); expect(signedPct(0.00001)).toBe('0.0%'); expect(money(-0.001)).not.toMatch(/^−\$0\.0/);
  });
  it('formats percentages, multiples and grouped numbers', () => {
    expect(pct(0.1234)).toBe('12.3%'); expect(pct(0.1234, 0)).toBe('12%'); expect(signedPct(0.05)).toBe('+5.0%'); expect(mult(12.345)).toBe('12.3×'); expect(num(1234567)).toBe('1,234,567'); expect(num(0.5, 2)).toBe('0.50');
  });
  it('shows a dash for anything that is not a number', () => {
    for (const f of [money, pct, signedPct, mult, num] as any[]) for (const bad of [null, undefined, NaN, Infinity, 'x']) expect(f(bad)).toBe('—');
  });
});

describe('date formatting', () => {
  it('reads ISO dates without time zone surprises', () => {
    expect(monthYear('2026-09-26')).toBe('Sep 2026'); expect(longDate('2026-01-03')).toBe('3 Jan 2026'); expect(yy('2026-09-26')).toBe('’26'); expect(monthYear('2024-12-31')).toBe('Dec 2024');
  });
  it('is safe on bad input', () => {
    for (const bad of ['', 'nope', '2026-13-01', '2026-00-10', '2026-05-00', null as any, undefined as any]) { expect(monthYear(bad)).toBe('—'); expect(longDate(bad)).toBe('—'); expect(yy(bad)).toBe(''); }
  });
});
