import { describe, it, expect } from 'vitest';
import '../src/modules/m1.js';import '../src/modules/m2.js';import '../src/modules/m3.js';import '../src/modules/m4.js';import '../src/modules/m5.js';import '../src/modules/m6.js';import '../src/modules/m7.js';import '../src/modules/m8.js';import '../src/modules/m9.js';
import { MODS } from '../src/lib/registry';
import { DATA_PAGES } from '../src/ui/datapages.js';
import { STAGES, RANKS, mapProgress, currentIndex, rankFor, nextTool } from '../src/lib/roadmap';

const all = STAGES.flatMap(s => s.tools);
describe('roadmap content', () => {
  it('has ten stops in order', () => { expect(STAGES.map(s => s.n)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]); });
  it('every tool exists', () => {
    const ids = new Set([...MODS.map(m => m.id), ...DATA_PAGES.map(p => p.id), 'scenarios']);
    for (const t of all) expect(ids.has(t), t).toBe(true);
  });
  it('no tool appears twice', () => { expect(new Set(all).size).toBe(all.length); });
  it('every calculator is on the roadmap', () => { for (const m of MODS) expect(all.includes(m.id), m.id).toBe(true); });
  it('every stop has the full set of parts', () => {
    for (const s of STAGES) { expect(s.can.length).toBeGreaterThan(1); expect(s.ideas.length).toBeGreaterThan(2); expect(s.tools.length).toBeGreaterThan(0); expect(s.quest.length).toBeGreaterThan(30); expect(s.hours).toBeGreaterThan(0); }
  });
  it('ranks never go backwards', () => { const order = ['Explorer', 'Navigator', 'Strategist', 'Analyst']; const r = STAGES.map(s => order.indexOf(s.rank)); expect([...r].sort()).toEqual(r); });
});
describe('progress', () => {
  it('starts at stop 1 with the first tool', () => {
    const p = mapProgress(STAGES, []);
    expect(currentIndex(p)).toBe(0); expect(nextTool(p)).toBe('tvm');
  });
  it('moves on once a stop is finished', () => {
    const p = mapProgress(STAGES, ['tvm', 'rates', 'annuity']);
    expect(p[0].complete).toBe(true); expect(currentIndex(p)).toBe(1); expect(nextTool(p)).toBe('loan');
  });
  it('finishing everything stays on the last stop', () => {
    const p = mapProgress(STAGES, all);
    expect(currentIndex(p)).toBe(9); expect(nextTool(p)).toBeNull();
  });
  it('ranks follow finished stops', () => {
    expect(rankFor(0).name).toBe('Newcomer'); expect(rankFor(1).name).toBe('Explorer'); expect(rankFor(4).name).toBe('Navigator'); expect(rankFor(9).name).toBe('Analyst');
    expect(RANKS[0].from).toBe(0);
  });
});
