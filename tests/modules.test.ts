import { describe, expect, it } from 'vitest';
import '../src/modules/m1.js';
import '../src/modules/m2.js';
import '../src/modules/m3.js';
import '../src/modules/m4.js';
import '../src/modules/m5.js';
import '../src/modules/m6.js';
import { MODS, type Values } from '../src/lib/registry';
import { BEGINNER, keyCard, easyCard } from '../src/ui/beginner.js';
import { SCENES } from '../src/ui/scenes.js';

const defaults = (m: (typeof MODS)[number]): Values => Object.fromEntries(m.fields.map(f => [f.id, f.v]));
const get = (id: string) => MODS.find(m => m.id === id)!;

describe('calculator registry', () => {
  it('registers 23 calculators with unique ids', () => {
    expect(MODS).toHaveLength(23);
    expect(new Set(MODS.map(m => m.id)).size).toBe(23);
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

describe('beginner layer', () => {
  const raw = BEGINNER as Record<string, any>;
  const sc = SCENES as Record<string, any>;
  it('only references real input fields', () => {
    for (const m of MODS) {
      const b = raw[m.id], ids = new Set(m.fields.map(f => f.id));
      for (const id of b.essential ?? []) expect(ids.has(id), `${m.id}.${id}`).toBe(true);
      for (const id of Object.keys(b.labels ?? {})) expect(ids.has(id), `${m.id} label ${id}`).toBe(true);
      for (const id of Object.keys(b.tips ?? {})) expect(ids.has(id), `${m.id} tip ${id}`).toBe(true);
      for (const id of Object.keys(b.force ?? {})) expect(ids.has(id), `${m.id} force ${id}`).toBe(true);
    }
  });
  it('gives every essential field a plain-English tip', () => {
    for (const m of MODS) {
      const b = raw[m.id];
      const fields = b.simple ? b.simple.fields : (b.essential ?? []).map((id: string) => ({ id }));
      for (const f of fields) expect(f.tip || b.tips?.[f.id], `${m.id}.${f.id}`).toBeTruthy();
    }
  });
  it('drives a real scene from the calculator numbers without NaN', () => {
    for (const m of MODS) {
      const b = raw[m.id];
      if (!b.scene) continue;
      const base = b.simple ? Object.fromEntries(b.simple.fields.map((f: { id: string; v: number }) => [f.id, f.v])) : null;
      const eff = b.simple ? { ...defaults(m), ...b.simple.map(base) } : { ...defaults(m), ...(b.force ?? {}) };
      const out = m.calc(eff);
      const params = b.scene.map(base ?? eff, out);
      expect(sc[b.scene.id], m.id).toBeDefined();
      for (const t of [0, 0.5, 1]) {
        const d = sc[b.scene.id].draw(t, { seed: 3, ...Object.fromEntries(sc[b.scene.id].params.map((q: { id: string; v: number }) => [q.id, q.v])), ...params }, 420, 300);
        expect(d.svg + d.cap, `${m.id} scene @${t}`).not.toMatch(/NaN|undefined|Infinity/);
      }
    }
  });
  it('relabels result cards in plain words', () => {
    const c = easyCard(raw.loan, { label: 'Total interest', value: '$1', sub: 'x' });
    expect(c.label).toBe('Total fees to the bank');
    expect(easyCard(raw.loan, { label: 'Unknown', value: '$1' }).label).toBe('Unknown');
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
  it('computes the statistics toolkit', () => {
    expect(get('stats').calc(defaults(get('stats'))).cards![0].value).toBe('6.08');
    expect(get('corr').calc(defaults(get('corr'))).cards![0].value).toMatch(/^\+0\.9/);
    expect(get('normal').calc(defaults(get('normal'))).cards![0].value).toBe('4.6%');
    expect(get('prob').calc(defaults(get('prob'))).cards![0].value).toBe('+$10.00');
  });
  it('explains what is wrong with unusable statistics input', () => {
    expect(get('stats').calc({ data: '5' }).note).toMatch(/at least two/);
    expect(get('corr').calc({ xs: '1,2', ys: '1,2' }).note).toMatch(/three pairs/);
    expect(get('corr').calc({ xs: '1,1,1', ys: '1,2,3' }).note).toMatch(/never changes/);
  });
  it('reports a clear note for impossible inputs', () => {
    expect(get('breakeven').calc({ ...defaults(get('breakeven')), p: 10, vc: 20 }).note).toMatch(/Price must be above/);
    expect(get('ddm').calc({ ...defaults(get('ddm')), g: 12 }).note).toMatch(/greater than/);
  });
});
