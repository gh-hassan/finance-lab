// @ts-nocheck
/* The home page story: one continuous hand-drawn animation of a new student's first steps. A single clock drives every line, so it
   loops without drift. It plays only while it is on screen. Sound is off until the visitor taps the picture (browsers do not allow
   sound before a tap). It is not shown on phones. */
import '../styles/doodle.css';
import { h } from './visuals.js';
import { buildStory, W, H, TOTALS, usd } from './doodle-story.js';
import { START, LOOP, POSTER_T, clamp, smooth, inWindows, SLIDE, slideProgress, yearsAt, cursorAt, cursorShows, captionAt, EVENTS } from './doodle-timeline.js';
import { makeSound } from './doodle-sound.js';

const reduced = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };

export function mountDoodle(host) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('aria-hidden', 'true'); svg.setAttribute('focusable', 'false'); svg.setAttribute('viewBox', `0 0 ${W} ${H}`); svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  svg.innerHTML = buildStory();
  const q = sel => svg.querySelector(sel), qa = sel => [...svg.querySelectorAll(sel)];
  const parts = qa('[data-k]').map(el => ({ el, k: el.dataset.k, s: +el.dataset.s, d: +(el.dataset.d || 0.9), e: el.dataset.e === undefined ? Infinity : +el.dataset.e }));
  const views = qa('[data-v]').map(el => ({ el, spec: el.dataset.v }));
  const ripples = qa('[data-ripple]').map(el => ({ el, s: +el.dataset.ripple }));
  const hit = q('#dd-hit'), again = q('#dd-again'), typed = q('#dd-typed'), cursor = q('#dd-cursor'), knob = q('#dd-knob'), fill = q('#dd-fill'), years = q('#dd-years'), total = q('#dd-total');

  const sound = makeSound();
  let t = 0, playing = false, done = false, started = false, visible = false, soundOn = false, ei = 0, raf = 0, last = 0, lastCap = '', toastTimer = 0;
  const cap = h('p', { class: 'dd-sr', 'aria-live': 'polite' }), toast = h('span', { class: 'dd-toast', 'aria-live': 'polite' });
  const stage = h('div', { class: 'dd-stage', role: 'button', tabindex: '0', 'aria-pressed': 'false', 'aria-label': 'Animation showing a money question typed into the site and answered. Press to turn sound on or off.' }, svg, toast, cap);
  const root = h('div', { class: 'dd' }, stage);
  host.replaceChildren(root);

  function render(now) {
    for (const p of parts) {
      const raw = clamp((now - p.s) / p.d), out = p.e === Infinity ? 1 : 1 - clamp((now - p.e) / 0.35), e = smooth(raw);
      if (p.k === 'draw') { p.el.style.strokeDashoffset = (1 - e).toFixed(3); p.el.style.opacity = raw > 0.03 ? out : 0; }
      else if (p.k === 'pop') { p.el.style.opacity = (e * out).toFixed(3); p.el.style.transform = `translateY(${((1 - e) * 6).toFixed(2)}px)`; }
      else if (p.k === 'fade') p.el.style.opacity = (e * out).toFixed(3);
      else if (p.k === 'tint') p.el.style.opacity = (0.5 * e * out).toFixed(3);
      else if (p.k === 'grow') p.el.style.transform = `scaleX(${e.toFixed(3)})`;
    }
    for (const v of views) v.el.style.visibility = inWindows(v.spec, now) ? '' : 'hidden';
    const c = cursorAt(now);
    cursor.setAttribute('transform', `translate(${c.x.toFixed(1)} ${c.y.toFixed(1)})`);
    cursor.style.opacity = cursorShows(now) ? clamp((now - 7.6) / 0.3) * (1 - clamp((now - 15.9) / 0.3)) : 0;
    const pk = slideProgress(now);
    const word = 'What will my loan really cost?'; typed.textContent = word.slice(0, Math.ceil(word.length * clamp((now - 7.9) / 1.0)));
    knob.setAttribute('cx', (SLIDE.x0 + (SLIDE.x1 - SLIDE.x0) * pk).toFixed(1)); fill.style.strokeDashoffset = (0.8 - 0.7 * pk).toFixed(3);
    years.textContent = String(yearsAt(pk)); total.textContent = usd(TOTALS.short + (TOTALS.long - TOTALS.short) * pk);
    for (const r of ripples) { const p = (now - r.s) / 0.7; r.el.style.opacity = p > 0 && p < 1 ? (1 - p).toFixed(2) : 0; r.el.style.transform = `scale(${(0.3 + 2.1 * clamp(p)).toFixed(2)})`; }
    const text = captionAt(now); if (text !== lastCap) { lastCap = text; cap.textContent = text; }
  }
  function fireSounds(to) { while (ei < EVENTS.length && EVENTS[ei][0] <= to) { if (soundOn) sound.play(EVENTS[ei][1]); ei++; } }
  function tickLoop(ts) {
    if (!playing) return;
    const dt = Math.min(0.1, (ts - last) / 1000); last = ts; t += dt * 1.1;
    if (t >= LOOP) { t = LOOP; fireSounds(t); render(t); finish(); return; }
    fireSounds(t); render(t); raf = requestAnimationFrame(tickLoop);
  }
  function setPlaying(on) { if (on === playing) return; playing = on; cancelAnimationFrame(raf); if (on) { last = performance.now(); raf = requestAnimationFrame(tickLoop); } }
  /** The story is over: a small prompt offers to play it again. */
  function showAgain() { again.style.opacity = done ? '1' : '0'; }
  function finish() {
    playing = false; done = true; hit.style.pointerEvents = 'all'; stage.classList.add('rest'); showAgain();
    stage.setAttribute('aria-label', 'Animation finished. Press to watch it again.');
  }
  function replay() {
    if (reduced()) return;
    done = false; showAgain(); hit.style.pointerEvents = 'none'; stage.classList.remove('rest');
    stage.setAttribute('aria-label', 'Animation showing a money question typed into the site and answered. Press to turn sound on or off.');
    t = START; ei = 0; setPlaying(true);
  }
  function say(text) { toast.textContent = text; toast.classList.add('on'); clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove('on'), 1800); }
  function toggleSound() {
    const on = !soundOn;
    if (on && !sound.enable()) { say('Sound is not available here'); return; }
    soundOn = on; stage.setAttribute('aria-pressed', String(on)); say(on ? 'Sound on' : 'Sound off'); if (on) sound.play('tick');
  }
  stage.addEventListener('click', toggleSound);
  hit.addEventListener('click', e => { e.stopPropagation(); replay(); });
  stage.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (done) replay(); else toggleSound(); } });

  t = reduced() ? POSTER_T : START; render(t);
  const io = new IntersectionObserver(es => {
    visible = es.some(e => e.isIntersecting);
    if (visible && !reduced() && !playing && !done) { if (!started) { started = true; t = START; ei = 0; } setPlaying(true); } else if (!visible && playing) setPlaying(false);
  }, { threshold: 0.4 });
  io.observe(root);
  const vis = () => { if (document.hidden && playing) setPlaying(false); else if (!document.hidden && visible && !reduced() && !playing && !done) setPlaying(true); };
  document.addEventListener('visibilitychange', vis);
  return () => { setPlaying(false); clearTimeout(toastTimer); io.disconnect(); document.removeEventListener('visibilitychange', vis); sound.close(); };
}
