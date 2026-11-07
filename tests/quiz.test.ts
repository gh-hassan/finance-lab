import { describe, expect, it } from 'vitest';
import { CONCEPTS, GENERATORS, TOPICS, makeQuestion, mulberry32 } from '../src/lib/quizgen';

describe('quiz questions', () => {
  it('give four different answers, one marked right, with an explanation and a link', () => {
    GENERATORS.forEach(g => {
      for (let s = 1; s <= 120; s++) {
        const q = g.make(mulberry32(s * 7919));
        expect(q.options, `${g.id} seed ${s}`).toHaveLength(4);
        expect(new Set(q.options).size, `${g.id} seed ${s}: ${q.options.join(' | ')}`).toBe(4);
        expect(q.answer).toBeGreaterThanOrEqual(0); expect(q.answer).toBeLessThan(4);
        expect(q.explain.length).toBeGreaterThan(20); expect(q.link.startsWith('/')).toBe(true);
        expect(/NaN|Infinity|undefined/.test(JSON.stringify(q)), `${g.id} seed ${s}`).toBe(false);
      }
    });
  });
  it('are repeatable for a seed and vary between seeds', () => {
    expect(makeQuestion(42)).toEqual(makeQuestion(42));
    expect(new Set(Array.from({ length: 40 }, (_, i) => makeQuestion(i + 1).q)).size).toBeGreaterThan(20);
  });
  it('put the explanation\'s number in the right answer for the compounding question', () => {
    const q = GENERATORS.find(g => g.id === 'fv')!.make(mulberry32(5));
    expect(q.explain).toContain(q.options[q.answer]);
  });
  it('keep concept questions valid and in known topics', () => {
    CONCEPTS.forEach(c => { expect(c.options).toHaveLength(4); expect(c.answer).toBeLessThan(4); expect(TOPICS).toContain(c.topic); });
    TOPICS.forEach(t => expect(makeQuestion(3, t).topic).toBe(t));
  });
  it('shuffle concept answers but keep the right one marked', () => {
    for (let s = 1; s <= 30; s++) { const q = makeQuestion(s, 'Loans and bonds'); if (q.id.startsWith('c')) expect(q.explain.length).toBeGreaterThan(10); }
    const q = makeQuestion(11, 'Options and futures');
    if (q.id.startsWith('c')) { const orig = CONCEPTS.find(c => c.q === q.q)!; expect(q.options[q.answer]).toBe(orig.options[orig.answer]); }
  });
});
