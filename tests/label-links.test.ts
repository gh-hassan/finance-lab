import { describe, it, expect } from 'vitest';
import '../src/modules/m1.js';import '../src/modules/m2.js';import '../src/modules/m3.js';import '../src/modules/m4.js';import '../src/modules/m5.js';import '../src/modules/m6.js';import '../src/modules/m7.js';import '../src/modules/m8.js';import '../src/modules/m9.js';
import { MODS } from '../src/lib/registry';
import { BEGINNER } from '../src/ui/beginner.js';
import '../src/ui/beginner2.js';

const def = (m: any) => Object.fromEntries(m.fields.map((f: any) => [f.id, f.v]));
const labelsOf = (m: any) => (m.calc(def(m)).cards || []).map((c: any) => c.label).filter((l: any) => typeof l === 'string') as string[];
/* these cards only show up for some inputs, so the default numbers do not show them */
const SOMETIMES = new Set(['loan:Interest saved', 'strategies:Net credit received', 'strategies:Break-even price', 'lease:Net advantage to leasing', 'merger:EPS accretion', 'merger:EPS dilution']);

describe('plain-English layer stays linked to the calculators', () => {
  it('every beginner "easy" row matches a card the calculator really shows', () => {
    const bad: string[] = [];
    for (const m of MODS as any[]) {
      const b: any = (BEGINNER as any)[m.id]; if (!b) continue;
      const labels = labelsOf(m);
      for (const row of b.easy || []) { const k: string = row[0]; if (SOMETIMES.has(`${m.id}:${k}`)) continue; if (!labels.some(l => l === k || (k.endsWith(':') && l.startsWith(k)))) bad.push(`${m.id}: "${k}"`); }
    }
    expect(bad, bad.join('\n')).toEqual([]);
  });
});
