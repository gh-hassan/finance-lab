import { describe, expect, it } from 'vitest';
import '../src/modules/m1.js';
import '../src/modules/m2.js';
import '../src/modules/m3.js';
import '../src/modules/m4.js';
import '../src/modules/m5.js';
import { MODS, type Values } from '../src/lib/registry';
import { BEGINNER, keyCard } from '../src/ui/beginner.js';

const defaults = (m: (typeof MODS)[number]): Values => Object.fromEntries(m.fields.map(f => [f.id, f.v]));
const get = (id: string) => MODS.find(m => m.id === id)!;

describe('calculator registry', () => {
  it('registers 19 calculators with unique ids', () => {
    expect(MODS).toHaveLength(19);
    expect(new Set(MODS.map(m => m.id)).size).toBe(19);
  });
  it('every calculator runs on its defaults without NaN in charts', () => {
    for (const m of MODS) {
      const o = m.calc(defaults(m));
      expect(o.note, m.id).toBeUndefined();
      expect(o.cards?.length, m.id).toBeGreaterThan(0);
      for (const c of o.charts ?? []) for (const s of c.series ?? []) for (const p of s.pts) expect(p.every((x: unknown) => typeof x !== 'number' || Number.isFinite(x)), `${m.id} ${c.title}`).toBe(true);
    }
  });
  it('beginner overlays produce a headline for every calculator', () => {
    for (const m of MODS) {
      const b = (BEGINNER as Record<string, any>)[m.id];
      expect(b, m.id).toBeDefined();
      const values = b.simple ? { ...defaults(m), ...b.simple.map(Object.fromEntries(b.simple.fields.map((f: { id: string; v: number }) => [f.id, f.v]))) } : { ...defaults(m), ...(b.force ?? {}) };
      const out = m.calc(values);
      const plainFn = b.simple ? b.simple.plain : b.plain;
      const [headline] = plainFn(b.simple ? Object.fromEntries(b.simple.fields.map((f: { id: string; v: number }) => [f.id, f.v])) : values, out, keyCard(out));
      expect(typeof headline, m.id).toBe('string');
      expect(headline.length, m.id).toBeGreaterThan(5);
    }
  });
});

describe('known answers', () => {
  it('solves TVM in every direction', () => {
    const t = get('tvm'), base = { ...defaults(t), pv: -1000, pmt: -100, n: 10, iy: 6, fv: 0 };
    const fv = t.calc({ ...base, solve: 'fv' }).solved!.value;
    expect(fv).toBeCloseTo(3108.93, 1);
    expect(t.calc({ ...base, solve: 'pv', pv: 0, fv }).solved!.value).toBeCloseTo(-1000, 2);
    expect(t.calc({ ...base, solve: 'pmt', pmt: 0, fv }).solved!.value).toBeCloseTo(-100, 2);
    expect(t.calc({ ...base, solve: 'n', n: 1, fv }).solved!.value).toBeCloseTo(10, 3);
    expect(t.calc({ ...base, solve: 'iy', iy: 1, fv }).solved!.value).toBeCloseTo(6, 3);
  });
  it('computes a mortgage payment and bond price', () => {
    expect(get('loan').calc(defaults(get('loan'))).cards![0].value).toBe('$1,580.17');
    expect(get('bond').calc(defaults(get('bond'))).cards![0].value).toBe('$925.61');
  });
  it('computes M&A accretion and the FX parity forward', () => {
    expect(get('merger').calc(defaults(get('merger'))).cards![0].value).toBe('+2.64%');
    expect(get('fx').calc(defaults(get('fx'))).cards![0].value).toBe('1.1010');
  });
  it('reports a clear note for impossible inputs', () => {
    expect(get('breakeven').calc({ ...defaults(get('breakeven')), p: 10, vc: 20 }).note).toMatch(/Price must be above/);
    expect(get('ddm').calc({ ...defaults(get('ddm')), g: 12 }).note).toMatch(/greater than/);
  });
});
