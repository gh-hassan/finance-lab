import { describe, expect, it } from 'vitest';
import '../src/modules/m1.js';
import '../src/modules/m2.js';
import '../src/modules/m3.js';
import '../src/modules/m4.js';
import '../src/modules/m5.js';
import '../src/modules/m6.js';
import '../src/modules/m7.js';
import { comparable, parseValue, winner } from '../src/ui/compare.js';
import { glossary } from '../src/ui/glossary.js';
import { unitize } from '../src/ui/units.js';

describe('compare helpers', () => {
  it('reads numbers out of displayed values', () => {
    expect(parseValue('$1,580.17')).toBeCloseTo(1580.17, 2);
    expect(parseValue('−$54,562')).toBe(-54562);
    expect(parseValue('+2.64%')).toBeCloseTo(2.64, 2);
    expect(parseValue('56.3 days')).toBeCloseTo(56.3, 1);
    expect(Number.isNaN(parseValue('n/a'))).toBe(true);
  });
  it('picks the better side by direction, and calls equal or unreadable values a tie', () => {
    expect(winner(100, 200, 'high')).toBe('b');
    expect(winner(100, 200, 'low')).toBe('a');
    expect(winner(5, 5, 'high')).toBe('tie');
    expect(winner(NaN, 5, 'low')).toBe('tie');
  });
  it('offers only calculators whose measures exist', () => {
    expect(comparable().length).toBeGreaterThanOrEqual(8);
  });
});

describe('glossary', () => {
  it('collects unique terms with a definition and somewhere to read more', () => {
    const g = glossary();
    expect(g.length).toBeGreaterThan(40);
    expect(new Set(g.map((e: any) => e.key)).size).toBe(g.length);
    g.forEach((e: any) => { expect(e.def.length, e.term).toBeGreaterThan(5); expect(e.where.length, e.term).toBeGreaterThan(0); });
  });
});

describe('units', () => {
  it('relabels millions into thousands and billions, and leaves millions alone', () => {
    expect(unitize('Sales ($M)', 'K')).toBe('Sales ($K)');
    expect(unitize({ v: '$2,930.4M', s: ['100M'] }, 'B')).toEqual({ v: '$2,930.4B', s: ['100B'] });
    expect(unitize('Shares (M)', '1')).toBe('Shares (count)');
    expect(unitize('Sales ($M)', 'M')).toBe('Sales ($M)');
  });
});
