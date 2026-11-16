import { describe, it, expect } from 'vitest';
import { rng, wobblyLine, wobblyRect, wobblyEllipse, wobblyPath } from '../src/ui/doodle-shapes.js';
import { TOTALS, loanTotal, buildStory, usd } from '../src/ui/doodle-story.js';
import { LOOP, interp, inWindows, captionAt, CAPTIONS, EVENTS, nextEvent, slideProgress, yearsAt, SLIDE, cursorAt, cursorShows, PERSON_X, isWalking } from '../src/ui/doodle-timeline.js';

const CAPS = CAPTIONS as unknown as [number, string][], EVS = EVENTS as unknown as [number, string][];
const nums = (d: string) => (d.match(/-?\d+(\.\d+)?/g) || []).map(Number);

describe('doodle shapes', () => {
  it('rng is repeatable and stays between 0 and 1', () => {
    const a = rng(7), b = rng(7);
    for (let i = 0; i < 20; i++) { const x = a(); expect(x).toBe(b()); expect(x).toBeGreaterThanOrEqual(0); expect(x).toBeLessThan(1); }
  });
  it('a wobbly line is the same every time and ends near its end', () => {
    const d = wobblyLine(10, 20, 200, 20, 3);
    expect(d).toBe(wobblyLine(10, 20, 200, 20, 3)); expect(d.startsWith('M')).toBe(true);
    const n = nums(d); expect(Math.abs(n[0] - 10)).toBeLessThan(4); expect(Math.abs(n[n.length - 2] - 200)).toBeLessThan(4); expect(n.every(Number.isFinite)).toBe(true);
  });
  it('different seeds give different drawings', () => { expect(wobblyLine(0, 0, 100, 0, 1)).not.toBe(wobblyLine(0, 0, 100, 0, 2)); });
  it('a rectangle has four sides', () => { expect((wobblyRect(0, 0, 100, 50, 1).match(/M/g) || []).length).toBe(4); });
  it('an ellipse stays near its box', () => {
    const n = nums(wobblyEllipse(100, 100, 40, 20, 5)), xs = n.filter((_, i) => i % 2 === 0), ys = n.filter((_, i) => i % 2 === 1);
    expect(Math.min(...xs)).toBeGreaterThan(54); expect(Math.max(...xs)).toBeLessThan(146); expect(Math.min(...ys)).toBeGreaterThan(74); expect(Math.max(...ys)).toBeLessThan(126);
  });
  it('a path through points needs at least two points', () => { expect(wobblyPath([[0, 0]], 1)).toBe(''); expect(wobblyPath([[0, 0], [10, 10], [20, 5]], 1).startsWith('M')).toBe(true); });
});

describe('doodle clock', () => {
  it('interp holds the ends and eases between points', () => {
    const tr: [number, number][] = [[0, 10], [10, 20]];
    expect(interp(tr, -5)).toBe(10); expect(interp(tr, 20)).toBe(20); expect(interp(tr, 5)).toBeCloseTo(15, 5);
    expect(interp(tr, 2.5)).toBeLessThan(12.5);
  });
  it('windows are read as start-end pairs', () => {
    expect(inWindows('0-4.8;6.4-21', 3)).toBe(true); expect(inWindows('0-4.8;6.4-21', 5)).toBe(false); expect(inWindows('0-4.8;6.4-21', 6.4)).toBe(true);
  });
  it('the student walks only between stops, and ends up under the paper', () => {
    expect(isWalking(5)).toBe(false); expect(isWalking(6)).toBe(true); expect(isWalking(10)).toBe(false); expect(isWalking(22)).toBe(true);
    expect(interp(PERSON_X, 10)).toBe(360); expect(interp(PERSON_X, 30)).toBe(1060); expect(interp(PERSON_X, LOOP)).toBe(70); expect(isWalking(33)).toBe(true); expect(isWalking(35.3)).toBe(false);
  });
  it('the slider and the answer move together', () => {
    expect(slideProgress(SLIDE.from - 1)).toBe(0); expect(slideProgress(SLIDE.to + 1)).toBe(1);
    expect(yearsAt(0)).toBe(2); expect(yearsAt(1)).toBe(5);
    expect(cursorAt(SLIDE.to).x).toBeCloseTo(SLIDE.x1, 0);
    expect(cursorShows(5)).toBe(false); expect(cursorShows(10)).toBe(true); expect(cursorShows(20)).toBe(false);
  });
  it('has six short, plain captions in order of time', () => {
    expect(CAPS).toHaveLength(6);
    CAPS.forEach(([t, c], i) => { expect(c.length).toBeGreaterThan(10); expect(c.length).toBeLessThan(80); if (i) expect(t).toBeGreaterThan(CAPS[i - 1][0]); });
    expect(captionAt(0)).toBe(CAPS[0][1]); expect(captionAt(LOOP)).toBe(CAPS[5][1]);
  });
  it('sound moments are in order and inside the story', () => {
    EVS.forEach(([t], i) => { expect(t).toBeGreaterThan(0); expect(t).toBeLessThan(LOOP); if (i) expect(t).toBeGreaterThanOrEqual(EVS[i - 1][0]); });
    expect(nextEvent(0)).toBe(0); expect(nextEvent(LOOP)).toBe(EVS.length);
  });
});

describe('doodle story', () => {
  it('the loan numbers shown on screen are the real figures', () => {
    expect(loanTotal(20000, 0.08, 2)).toBe(TOTALS.short); expect(loanTotal(20000, 0.08, 5)).toBe(TOTALS.long);
    expect(TOTALS.long - 20000).toBe(TOTALS.interest); expect(TOTALS.long).toBeGreaterThan(TOTALS.short);
    expect(usd(TOTALS.long)).toBe('$24,332');
  });
  it('the thought bubble goes away when the student starts to walk', () => {
    const svg = buildStory();
    expect(svg).toContain('How should I calculate'); expect(svg).toContain('actually cost?');
    const bubble = svg.match(/<text[^>]*data-e="5.4"[^>]*>How should I calculate/);
    expect(bubble).not.toBeNull();
    expect(isWalking(5.5)).toBe(true);
  });
  it('the student rests at the side with a hidden "do it again" question', () => {
    const svg = buildStory();
    expect(svg).toContain('id="dd-again"'); expect(svg).toContain('Should I do'); expect(svg).toContain('it all again?'); expect(svg).toContain('id="dd-hit"');
    expect(svg).toContain('Finance Fundamentals'); expect(svg).toContain('Calculators'); expect(svg).toContain('Play with these'); expect(svg).toContain('Start with a question');
  });
  it('opens with him studying on the floor and ends with him back in the same spot, with no second set of things', () => {
    const svg = buildStory();
    expect(svg).toContain('EXAM'); expect(svg).toContain('READY'); expect((svg.match(/id="dd-face-look"/g) || []).length).toBe(1); expect((svg.match(/>EXAM</g) || []).length).toBe(1); expect(svg).toContain('id="dd-face-look"'); expect(svg).toContain('id="dd-arm"'); expect(svg).toContain('id="dd-pinch"'); expect(svg).toContain('dd-write'); expect(svg).toContain('dd-steam');
    expect(svg).not.toContain('vercel.app'); expect(svg).toContain('How should I calculate');
  });
  it('the seated student at the end is fully drawn, not drawn in, and stops writing when he waves', () => {
    const svg = buildStory();
    const i = svg.indexOf('data-v="35-999"'); expect(i).toBeGreaterThan(0);
    const part = svg.slice(i, svg.indexOf('</g></g>', svg.indexOf('id="dd-face-look"')) + 8);
    expect(part).not.toContain('data-k='); expect(part).toMatch(/id="dd-face-study"[\s\S]*dd-write[\s\S]*id="dd-face-look"/);
  });
  it('draws one world with every piece timed', () => {
    const svg = buildStory();
    expect(svg).toContain('id="dd-world"'); expect(svg).toContain('id="dd-person"'); expect(svg).toContain('id="dd-total"');
    const timed = svg.match(/data-k="[a-z]+"[^>]*data-s="[\d.]+"/g) || [];
    expect(timed.length).toBeGreaterThan(80);
    expect(svg).not.toContain('NaN'); expect(svg).not.toContain('undefined');
    for (const m of svg.matchAll(/data-s="([\d.]+)"/g)) expect(+m[1]).toBeLessThan(LOOP);
  });
});
