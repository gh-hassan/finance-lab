import { describe, expect, it } from 'vitest';
import { SCENES as RAW, SCENE_ORDER } from '../src/ui/scenes.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const SCENES = RAW as Record<string, any>;

const defaults = (id: string) => ({ seed: 3, ...Object.fromEntries(SCENES[id].params.map((q: { id: string; v: number }) => [q.id, q.v])) });

const WIDTHS = [320, 520, 900];

describe('concept scenes', () => {
  it('lists every scene once', () => {
    expect(new Set(SCENE_ORDER).size).toBe(SCENE_ORDER.length);
    expect(SCENE_ORDER.sort()).toEqual(Object.keys(SCENES).sort());
  });
  it('draws every scene at every point in time without NaN', () => {
    for (const id of SCENE_ORDER) {
      for (const W of WIDTHS) for (const t of [0, 0.01, 0.25, 0.5, 0.75, 0.99, 1]) {
        const out = SCENES[id].draw(t, defaults(id), W, 300);
        expect(out.svg.length, `${id} @${t} W${W}`).toBeGreaterThan(20);
        expect(out.svg, `${id} svg @${t} W${W}`).not.toMatch(/NaN|undefined|Infinity/);
        expect(out.cap, `${id} cap @${t} W${W}`).not.toMatch(/NaN|undefined|Infinity/);
        expect(out.cap.length, id).toBeGreaterThan(10);
      }
    }
  });
  it('survives the extremes of every slider', () => {
    for (const W of WIDTHS) for (const id of SCENE_ORDER) for (const q of SCENES[id].params) for (const v of [q.min, q.max]) {
      const out = SCENES[id].draw(0.6, { ...defaults(id), [q.id]: v }, W, 300);
      expect(out.svg, `${id} ${q.id}=${v}`).not.toMatch(/NaN|undefined|Infinity/);
    }
  });
  it('explains every scene in plain words', () => {
    for (const id of SCENE_ORDER) {
      const s = SCENES[id];
      expect(s.plain.length, id).toBeGreaterThan(30);
      expect(s.how.length, id).toBe(3);
      expect(s.words.length, id).toBeGreaterThanOrEqual(2);
    }
  });
});
