import { describe, expect, it } from 'vitest';
import { curveShape, asOfLabel, ratePct, changeWords } from '../src/lib/rates';

//                1M   3M   6M   1Y   2Y   3Y   5Y   7Y   10Y  20Y  30Y
const NORMAL = [3.9, 4.0, 4.0, 4.0, 4.1, 4.2, 4.4, 4.6, 4.8, 5.1, 5.0];
const INVERTED = [5.4, 5.4, 5.3, 5.0, 4.7, 4.4, 4.2, 4.2, 4.2, 4.5, 4.4];
const FLAT = [4.2, 4.2, 4.2, 4.2, 4.1, 4.1, 4.1, 4.2, 4.2, 4.4, 4.4];
const HUMPED = [4.0, 4.0, 4.2, 4.4, 4.5, 4.6, 4.8, 4.7, 4.5, 4.6, 4.5];

describe('curveShape', () => {
  it('reads a normal curve', () => {
    const r = curveShape(NORMAL);
    expect(r.shape).toBe('normal');
    expect(r.spread10y2y).toBeCloseTo(0.7, 4);
    expect(r.spread10y3m).toBeCloseTo(0.8, 4);
    expect(r.text).toMatch(/slopes upward/);
  });
  it('reads an inverted curve when the 2-year beats the 10-year', () => {
    const r = curveShape(INVERTED);
    expect(r.shape).toBe('inverted');
    expect(r.spread10y2y).toBeLessThan(0);
    expect(r.text).toMatch(/not a forecast/);
    expect(r.text).toMatch(/minus 0\.50/);
  });
  it('calls an inversion on the 3-month gap alone', () => {
    expect(curveShape([4, 5, null, null, null, null, null, null, 4, null, null]).shape).toBe('inverted');
  });
  it('reads a flat curve', () => expect(curveShape(FLAT).shape).toBe('flat'));
  it('reads a humped curve', () => expect(curveShape(HUMPED).shape).toBe('humped'));
  it('works with only 10Y and 2Y', () => {
    const r = curveShape([null, null, null, null, 3, null, null, null, 4.5, null, null]);
    expect(r.shape).toBe('normal'); expect(r.spread10y3m).toBeNull();
  });
  it('gives unknown when 10Y is missing', () => {
    const r = curveShape([4, 4, 4, 4, 4, 4, 4, 4, null, 4, 4]);
    expect(r.shape).toBe('unknown'); expect(r.text).toMatch(/not enough data/);
  });
  it('gives unknown for NaN, empty, null and wrong types', () => {
    expect(curveShape([NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN]).shape).toBe('unknown');
    expect(curveShape([]).shape).toBe('unknown');
    expect(curveShape(null).shape).toBe('unknown');
    expect(curveShape(undefined).shape).toBe('unknown');
    expect(curveShape('abc' as any).shape).toBe('unknown');
  });
  it('treats a tiny dip as flat, not inverted', () => {
    expect(curveShape([4, 4.05, 4, 4, 4.1, 4, 4, 4, 4.05, 4, 4]).shape).toBe('flat');
  });
});

describe('labels and words', () => {
  it('labels dates by frequency', () => {
    expect(asOfLabel('2026-11-05', 'daily')).toBe('5 Nov 2026');
    expect(asOfLabel('2026-09-01', 'monthly')).toBe('Sep 2026');
    expect(asOfLabel('nope')).toBe('');
    expect(asOfLabel(null)).toBe('');
    expect(asOfLabel('2026-13-01')).toBe('');
  });
  it('formats rates with an em dash for missing', () => {
    expect(ratePct(4.35)).toBe('4.35%');
    expect(ratePct(null)).toBe('—');
    expect(ratePct(NaN)).toBe('—');
    expect(ratePct(-0.004)).toBe('0.00%');
    expect(ratePct(-1.5)).toBe('−1.50%');
    expect(ratePct(3, 1)).toBe('3.0%');
  });
  it('describes changes in points', () => {
    expect(changeWords(4.35, 4.0)).toBe('up 0.35 points from a year ago');
    expect(changeWords(3.0, 4.0, 'last month')).toBe('down 1.00 points from last month');
    expect(changeWords(4, 4)).toBe('unchanged from a year ago');
    expect(changeWords(4, null)).toBe('');
    expect(changeWords(NaN, 1)).toBe('');
  });
});
