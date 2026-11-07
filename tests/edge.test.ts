import { describe, expect, it } from 'vitest';
import '../src/modules/m1.js';
import '../src/modules/m2.js';
import '../src/modules/m3.js';
import '../src/modules/m4.js';
import '../src/modules/m5.js';
import '../src/modules/m6.js';
import '../src/modules/m7.js';
import '../src/modules/m8.js';
import '../src/modules/m9.js';
import { MODS } from '../src/lib/registry';

const BAD = /NaN|Infinity|undefined|\[object/;
const text = (o: any): string => JSON.stringify({ cards: o.cards, steps: o.steps, note: o.note, info: o.info, tables: o.tables });
const defaults = (m: any) => Object.fromEntries(m.fields.map((f: any) => [f.id, f.v]));

describe('calculators survive awkward inputs', () => {
  const probes: [string, (v: number) => number][] = [['zero', () => 0], ['negative', v => -Math.abs(v) - 1], ['tiny', () => 1e-6], ['huge', v => (Math.abs(v) + 1) * 1e6], ['one', () => 1]];
  MODS.forEach(m => {
    it(`${m.id}: defaults give clean output`, () => {
      const o = m.calc(defaults(m));
      expect(BAD.test(text(o)), `${m.id} defaults: ${(text(o).match(/.{30}(NaN|Infinity|undefined|\[object).{10}/) || [''])[0]}`).toBe(false);
    });
    it(`${m.id}: never throws and never prints NaN, one input at a time`, () => {
      const base = defaults(m), failures: string[] = [];
      m.fields.filter((f: any) => f.type !== 'select' && f.type !== 'text').forEach((f: any) => {
        probes.forEach(([name, fn]) => {
          const v = { ...base, [f.id]: fn(Number(f.v)) };
          try {
            const o = m.calc(v), t = text(o);
            if (BAD.test(t) && !o.note) failures.push(`${f.id}=${name}: ${(t.match(/.{30}(NaN|Infinity|undefined|\[object).{10}/) || [''])[0]}`);
          } catch (e: any) { failures.push(`${f.id}=${name}: threw ${e.message}`); }
        });
      });
      expect(failures, failures.join('\n')).toEqual([]);
    });
  });
});
