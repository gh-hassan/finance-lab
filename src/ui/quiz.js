// @ts-nocheck
/* Quiz page: rounds of ten questions with fresh numbers, instant feedback, and progress that is remembered on this device. */
import { h, store } from './visuals.js';
import { TOPICS, makeQuestion } from '../lib/quizgen';

const KEY = 'fl:quiz';
const blank = () => ({ a: 0, c: 0, streak: 0, best: 0, rounds: 0, byTopic: {} });
const load = () => { const s = store.get(KEY); return s && typeof s === 'object' ? { ...blank(), ...s, byTopic: { ...(s.byTopic || {}) } } : blank(); };
const LETTERS = ['A', 'B', 'C', 'D'];
const ROUND = 10;

export function renderQuiz(main) {
  let prog = load(), topic = '', round = null, cleanup = [];
  const root = h('div', { class: 'quiz' });
  const save = () => store.set(KEY, prog);
  const record = (t, ok) => {
    prog.a++; if (ok) prog.c++;
    const e = prog.byTopic[t] || { a: 0, c: 0 }; e.a++; if (ok) e.c++; prog.byTopic[t] = e;
    prog.streak = ok ? prog.streak + 1 : 0; prog.best = Math.max(prog.best, prog.streak); save();
  };
  const mastery = () => {
    const rows = TOPICS.map(t => { const e = prog.byTopic[t] || { a: 0, c: 0 }, p = e.a ? Math.round((e.c / e.a) * 100) : 0; return h('div', { class: 'qm-row' }, h('span', { class: 'qm-t' }, t), h('span', { class: 'qm-bar' }, h('i', { style: `width:${p}%` })), h('span', { class: 'qm-n' }, e.a ? `${p}% of ${e.a}` : 'not tried'));
    });
    return h('section', { class: 'card qm' }, h('h3', {}, 'Your progress'), h('div', { class: 'qm-top' }, h('span', {}, h('b', {}, String(prog.a)), ' answered'), h('span', {}, h('b', {}, prog.a ? Math.round((prog.c / prog.a) * 100) + '%' : '–'), ' correct'), h('span', {}, h('b', {}, String(prog.best)), ' best streak'), h('span', {}, h('b', {}, String(prog.rounds)), ' rounds')), rows,
      prog.a ? h('button', { type: 'button', class: 'btn small', onclick: () => { if (window.confirm('Clear your quiz progress on this device?')) { prog = blank(); save(); showStart(); } } }, 'Reset progress') : null);
  };

  function showStart() {
    round = null; root.innerHTML = '';
    const pills = h('div', { class: 'picker' }, ['All topics', ...TOPICS].map((t, i) => h('button', { type: 'button', class: 'pick' + ((i === 0 && !topic) || t === topic ? ' on' : ''), onclick: () => { topic = i === 0 ? '' : t; showStart(); } }, t)));
    root.append(h('p', { class: 'quiz-lead' }, 'Ten questions with fresh numbers each time. Every answer is explained, with a link to practise it.'), pills,
      h('div', { class: 'quiz-go' }, h('button', { type: 'button', class: 'btn', onclick: startRound }, prog.a ? 'Start a round' : 'Start your first round')), mastery());
  }

  function startRound() { round = { i: 0, ok: 0, base: Math.floor(Math.random() * 1e9), seen: new Set() }; ask(); }

  function ask() {
    root.innerHTML = '';
    let q, tries = 0;
    do { q = makeQuestion(round.base + round.i * 101 + tries * 7, topic || undefined); tries++; } while (round.seen.has(q.q) && tries < 12);
    round.seen.add(q.q);
    let done = false;
    const fb = h('div', { class: 'quiz-fb', role: 'status', hidden: true }), next = h('button', { type: 'button', class: 'btn', hidden: true, onclick: () => { round.i++; round.i >= ROUND ? finish() : ask(); } }, round.i + 1 >= ROUND ? 'See my score' : 'Next question');
    const btns = q.options.map((o, k) => h('button', { type: 'button', class: 'qopt', onclick: () => choose(k) }, h('span', { class: 'ql' }, LETTERS[k]), h('span', {}, o)));
    function choose(k) {
      if (done) return; done = true;
      const ok = k === q.answer; if (ok) round.ok++; record(q.topic, ok);
      btns.forEach((b, j) => { b.disabled = true; b.classList.toggle('right', j === q.answer); b.classList.toggle('wrong', j === k && !ok); });
      fb.hidden = false; fb.className = 'quiz-fb ' + (ok ? 'ok' : 'no'); fb.innerHTML = '';
      fb.append(h('b', {}, ok ? (prog.streak > 2 ? `Correct. ${prog.streak} in a row.` : 'Correct.') : `Not quite. The answer is ${LETTERS[q.answer]}.`), h('p', {}, q.explain), h('a', { href: q.link, 'data-link': true }, 'Practise this in the calculator →'));
      next.hidden = false; next.focus();
    }
    root.append(h('div', { class: 'quiz-head' }, h('span', { class: 'quiz-n' }, `Question ${round.i + 1} of ${ROUND}`), h('span', { class: 'quiz-t' }, q.topic), h('span', { class: 'quiz-s' }, prog.streak > 1 ? `${prog.streak} in a row` : '')),
      h('div', { class: 'quiz-bar' }, h('i', { style: `width:${(round.i / ROUND) * 100}%` })),
      h('section', { class: 'card quiz-q' }, h('h2', {}, q.q), h('div', { class: 'qopts' }, btns), fb, h('div', { class: 'quiz-next' }, next)));
    ask.choose = choose; ask.n = q.options.length;
  }

  function finish() {
    prog.rounds++; save();
    const pct = Math.round((round.ok / ROUND) * 100), msg = pct >= 90 ? 'Outstanding. You know this material.' : pct >= 70 ? 'Solid. A little more practice on the misses.' : pct >= 50 ? 'A fair start. Use the explanations and try again.' : 'Keep going. Read the lesson, then retry.';
    root.innerHTML = '';
    root.append(h('section', { class: 'card quiz-done' }, h('p', { class: 'eyebrow' }, 'Round complete'), h('div', { class: 'quiz-score' }, `${round.ok} / ${ROUND}`), h('p', { class: 'quiz-msg' }, msg),
      h('div', { class: 'quiz-go' }, h('button', { type: 'button', class: 'btn', onclick: startRound }, 'Another round'), h('button', { type: 'button', class: 'btn small', onclick: showStart }, 'Back to topics'))), mastery());
  }

  const onKey = e => {
    if (!round || !root.isConnected) return;
    const k = '1234'.indexOf(e.key); if (k >= 0 && ask.choose && k < ask.n) ask.choose(k);
  };
  document.addEventListener('keydown', onKey); cleanup.push(() => document.removeEventListener('keydown', onKey));
  main.innerHTML = '';
  main.append(h('header', { class: 'learn-hero reveal' }, h('p', { class: 'eyebrow' }, 'Test yourself'), h('h1', { html: 'Quick <em>quiz</em>' })), root);
  showStart();
  return () => cleanup.forEach(f => f());
}
