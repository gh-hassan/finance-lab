// @ts-nocheck
/* The clock of the home page story. One timeline, in seconds, runs from the worried question to the happy answer with no cuts.
   Everything on screen is worked out from the time alone, so the story can be paused, scrubbed and looped without drifting.
   These are plain numbers and functions, so tests can check them. */

/** The whole story lasts this long before it starts again. */
export const LOOP = 35.6;
/** A time at which the picture is complete, used for a still image when motion is reduced. */
export const POSTER_T = 35.4;

export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const smooth = p => p * p * (3 - 2 * p);

/** The value of a track [[time, value], ...] at time t. It eases from one point to the next and holds the first and last values. */
export function interp(track, t) {
  if (t <= track[0][0]) return track[0][1];
  for (let i = 1; i < track.length; i++) {
    if (t <= track[i][0]) { const [t0, v0] = track[i - 1], [t1, v1] = track[i]; return v0 + (v1 - v0) * smooth((t - t0) / (t1 - t0 || 1)); }
  }
  return track[track.length - 1][1];
}

/** Is t inside a window written like "0-4.8;6.4-21;23-999"? */
export const inWindows = (spec, t) => spec.split(';').some(w => { const [a, b] = w.split('-').map(Number); return t >= a && t < b; });

/** Where the student stands (feet). He walks from the thought, to the site, to the paper. */
export const PERSON_X = [[0, 70], [5.4, 70], [6.5, 360], [21, 360], [23, 1060], [31, 1060], [35, 70], [99, 70]];
/** The student walks during these windows. */
export const WALKS = '5.4-6.5;21-23;31-35';
export const isWalking = t => inWindows(WALKS, t);

/** The slider time: it moves from 12.4 s to 14.6 s, and the answer follows it. */
export const SLIDE = { from: 12.4, to: 14.6, x0: 557, x1: 658, y: 198 };
export const slideProgress = t => smooth(clamp((t - SLIDE.from) / (SLIDE.to - SLIDE.from)));
export const yearsAt = pk => 2 + Math.min(3, Math.floor(pk * 3.999));

/** The pointer: where it is at time t, and whether it shows. */
const CUR_A = [[7.8, 540, 215], [9.2, 674, 190], [11.2, 674, 190], [12.0, SLIDE.x0, SLIDE.y], [SLIDE.from, SLIDE.x0, SLIDE.y]];
const CUR_B = [[SLIDE.to, SLIDE.x1, SLIDE.y], [15.8, 780, 206]];
export function cursorAt(t) {
  if (t < SLIDE.from) return { x: interp(CUR_A.map(p => [p[0], p[1]]), t), y: interp(CUR_A.map(p => [p[0], p[2]]), t) };
  if (t < SLIDE.to) return { x: SLIDE.x0 + (SLIDE.x1 - SLIDE.x0) * slideProgress(t), y: SLIDE.y };
  return { x: interp(CUR_B.map(p => [p[0], p[1]]), t), y: interp(CUR_B.map(p => [p[0], p[2]]), t) };
}
export const cursorShows = t => t >= 7.6 && t < 16.2;

/** What the caption under the picture says at each moment. */
export const CAPTIONS = [
  [0, 'A new student has a real question about money.'],
  [5.2, 'They open the site and pick that question.'],
  [10.4, 'They move a slider. The answer changes at once.'],
  [16.0, 'A short note explains why it changed.'],
  [21.0, 'Then they use the same idea on paper, in class or in an exam.'],
  [29.4, 'Now it makes sense, and it stays with them.']
];
export const captionAt = t => { let c = CAPTIONS[0][1]; for (const [s, text] of CAPTIONS) if (t >= s) c = text; return c; };

/** The moments a sound plays when sound is on: a click when something is clicked, ticks as the slider moves, and so on. */
export const EVENTS = [[9.4, 'click'], [12.1, 'click'], [13.12, 'tick'], [13.5, 'tick'], [13.88, 'tick'], [23.6, 'scribble'], [24.6, 'scribble'], [25.6, 'scribble'], [26.6, 'scribble'], [27.7, 'swish'], [28.7, 'chime'], [29.5, 'pop']];
/** Index of the first sound that is still to come at time t. */
export const nextEvent = t => { const i = EVENTS.findIndex(e => e[0] > t); return i < 0 ? EVENTS.length : i; };
