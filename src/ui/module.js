// @ts-nocheck
/* Calculator page: Beginner mode (question, friendly inputs, one big answer, a teaching animation)
   and Pro mode (every input, result, chart, step and table). */
import { XY, h, esc, store, donutHtml, countUp, burst } from './visuals.js';
import { tick } from './ticker.js';
import { ASSUMPTIONS } from './assumptions.js';
import { readShared, toolsBar } from './sharing.js';
import { liveCard } from './livedata.js';
import { UNIT_LIST, fieldsHaveUnits, isUnitField, unitFactor, unitize } from './units.js';
import { BEGINNER, TOPICS, keyCard, easyCard } from './beginner.js';
import { SceneView, SCENES } from './scenes.js';
import { rangeSlider } from './slider.js';
import { nf } from '../lib/math';

const stepsHtml = steps => `<ol class="steps">${steps.map(s => `<li><b>${esc(s[0])}</b><code>${esc(s[1])}</code></li>`).join('')}</ol>`;
function tableHtml(t) {
  const cell = c => { const [txt, st] = Array.isArray(c) ? c : [c, '']; return `<td${st ? ` style="${st}"` : ''}>${esc(txt)}</td>`; };
  const head = `<tr>${t.cols.map(c => `<th>${esc(c)}</th>`).join('')}</tr>`;
  const rows = t.rows.map(r => (r.h ? `<tr class="gh"><td colspan="${t.cols.length}">${esc(r.h)}</td></tr>` : `<tr>${r.map(cell).join('')}</tr>`)).join('');
  const tbl = `<div class="tw"><table class="${t.left ? 'left' : ''}"><thead>${head}</thead><tbody>${rows}</tbody></table></div>`;
  return t.collapsed ? `<details><summary><h3>${esc(t.title)}</h3></summary>${tbl}</details>` : `<h3>${esc(t.title)}</h3>${tbl}`;
}

function chartCard(spec) {
  const body = h('div', { class: 'cbody' }), btn = h('button', { class: 'btn play', type: 'button' }, 'Play');
  const card = h('section', { class: 'card chart reveal' }, h('div', { class: 'chead' }, h('div', {}, h('h3', {}, spec.title), spec.sub && h('p', { class: 'sub' }, spec.sub)), btn), body);
  const item = { card, inst: null };
  item.set = (sp, first) => {
    if (sp.type === 'html' || sp.type === 'donut') {
      body.classList.remove('play');
      body.innerHTML = sp.type === 'html' ? sp.html : donutHtml(sp);
      if (first) requestAnimationFrame(() => body.classList.add('play'));
      btn.onclick = () => { body.classList.remove('play'); void body.offsetWidth; body.classList.add('play'); };
    } else if (!item.inst) { item.inst = new XY(body, sp); btn.onclick = () => item.inst.play(); } else item.inst.setSpec(sp);
  };
  item.play = () => { btn.onclick && btn.onclick(); };
  item.destroy = () => item.inst && item.inst.destroy();
  return item;
}

export function mountModule(m, main, onMode) {
  /* a shared link brings its own numbers and mode */
  const shared = readShared(m.id);
  if (shared) { store.set('fl:mode', shared.mode); store.set('fl:' + m.id + (shared.simple ? ':simple' : ''), shared.state); if (shared.unit) store.set('fl:unit', shared.unit); }
  const beginner = store.get('fl:mode') !== 'pro', B = BEGINNER[m.id] || {}, simple = beginner && B.simple;
  const topic = TOPICS[m.group] || { label: m.group, tint: 'coral' };
  const defaults = Object.fromEntries(m.fields.map(f => [f.id, f.v]));
  const key = 'fl:' + m.id, sKey = key + ':simple';
  const unit = store.get('fl:unit') || 'M', hasUnits = fieldsHaveUnits(m.fields) || fieldsHaveUnits(B.simple && B.simple.fields);
  const U = x => (hasUnits ? unitize(x, unit) : x);
  const moduleKey = () => m.id + (beginner ? 'b' : 'p');
  const clean = (fields, st) => { fields.forEach(f => { if (f.type !== 'select' && f.type !== 'text') st[f.id] = Number.isFinite(+st[f.id]) ? +st[f.id] : f.v; }); return st; };
  const v = clean(m.fields, { ...defaults, ...(store.get(key) || {}) });
  const b = simple ? clean(B.simple.fields, { ...Object.fromEntries(B.simple.fields.map(f => [f.id, f.v])), ...(store.get(sKey) || {}) }) : null;
  const ids = B.essential || m.fields.map(f => f.id);
  const fieldList = simple ? B.simple.fields : beginner ? m.fields.filter(f => ids.includes(f.id)) : m.fields;
  const state = simple ? b : v, stateKey = simple ? sKey : key;
  const effective = () => (simple ? { ...defaults, ...B.simple.map(b) } : beginner ? { ...v, ...(B.force || {}) } : v);
  const refs = {};
  let lastOut = null;
  let raf = 0, charts = [], sig = '', observers = [], sceneView = null;

  /* ----- inputs ----- */
  const inputsEl = h('aside', { class: 'card inputs reveal' });
  const read = f => { const r = refs[f.id]; state[f.id] = f.type === 'select' || f.type === 'text' ? r.input.value : (Number.isFinite(r.input.valueAsNumber) ? r.input.valueAsNumber : 0); store.set(stateKey, state); schedule(); };
  const schedule = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => update(false)); };
  inputsEl.append(h('div', { class: 'ihead' }, h('h2', {}, beginner ? 'Play with these' : 'Inputs'), h('button', { class: 'btn small', type: 'button', onclick: () => { store.del(key); store.del(sKey); onMode(); } }, 'Reset')));
  const live = liveCard(m.id, vals => {
    let n = 0;
    Object.entries(vals).forEach(([fid, val]) => { const ref = refs[fid]; if (ref && val != null) { ref.input.value = val; ref.input.dispatchEvent(new Event('input', { bubbles: true })); n++; } });
    return n;
  });
  if (live) inputsEl.append(live);
  fieldList.forEach(f => {
    const id = `f_${m.id}_${f.id}`, wrap = h('div', { class: 'fld' }), label = U((beginner && B.labels && B.labels[f.id]) || f.label), tip = beginner && U(f.tip || (B.tips && B.tips[f.id]));
    const tipEl = tip ? h('small', { class: 'tip', hidden: true }, tip) : null;
    wrap.append(h('div', { class: 'lrow' }, h('label', { for: id }, label), tip ? h('button', { class: 'qbtn', type: 'button', 'aria-label': 'What does this mean?', onclick: () => { tipEl.hidden = !tipEl.hidden; } }, '?') : null));
    if (tipEl) wrap.append(tipEl);
    let input, slider = null;
    if (f.type === 'select') { input = h('select', { id }, f.options.map(([val, txt]) => h('option', { value: val }, txt))); input.value = state[f.id]; }
    else if (f.type === 'text') input = h('input', { id, type: 'text', value: state[f.id], spellcheck: 'false', autocomplete: 'off' });
    else { input = h('input', { id, type: 'number', step: f.step || 'any', inputmode: 'decimal', value: state[f.id], autocomplete: 'off' }); if (f.min != null) input.min = f.min; if (f.max != null) input.max = f.max; }
    const box = f.type === 'select' ? input : h('div', { class: 'inp' }, f.pre && h('span', { class: 'u' }, f.pre), input, f.unit && h('span', { class: 'u' }, f.unit));
    wrap.append(box);
    if (f.slider) {
      const decs = String(f.slider[2]).includes('.') ? Math.min(2, String(f.slider[2]).split('.')[1].length) : 0;
      const rs = rangeSlider({ min: f.slider[0], max: f.slider[1], step: f.slider[2], value: state[f.id], label: label + ' slider', fmt: x => (f.pre || '') + nf(x, decs) + (f.unit ? (f.unit === '%' ? '%' : ' ' + f.unit) : '') });
      slider = rs.input;
      slider.addEventListener('input', () => { input.value = slider.value; read(f); });
      wrap.append(rs.el);
    }
    if (f.help && !beginner) wrap.append(h('small', { class: 'help' }, f.help));
    input.addEventListener('input', () => { read(f); if (slider) slider.value = input.value; });
    input.addEventListener('change', () => read(f));
    refs[f.id] = { f, wrap, input, slider, box, solved: false };
    inputsEl.append(wrap);
  });

  /* ----- outputs ----- */
  const noteEl = h('div', { class: 'note', hidden: true }), infoEl = h('div', { class: 'note info', hidden: true });
  const heroEl = h('section', { class: 'card answer reveal', hidden: !beginner });
  const cardsEl = h('div', { class: 'stats' }), chartsEl = h('div', { class: 'charts' });
  const sceneHost = h('div', { class: 'sv-wrap' }), sceneCard = h('section', { class: 'card scenecard reveal', hidden: true });
  const wordsEl = h('section', { class: 'words reveal', hidden: !beginner });
  const stepsEl = h('section', { class: 'card steps-card reveal' }), tablesEl = h('div', { class: 'tables' });
  const fieldLabel = f => U((beginner && B.labels && B.labels[f.id]) || f.label);
  const toolsEl = toolsBar({
    id: m.id, title: m.title, getState: () => ({ ...state }), getSimple: () => !!simple, getMode: () => (beginner ? 'beginner' : 'pro'), getUnit: () => unit, getOut: () => lastOut,
    getInputs: () => fieldList.map(f => [fieldLabel(f), (f.pre || '') + state[f.id] + (f.unit ? ' ' + f.unit : '')])
  });
  const assume = ASSUMPTIONS[m.id];
  const assumeEl = assume ? h('details', { class: 'assume card' }, h('summary', {}, h('h3', {}, 'Assumptions and method')), h('ul', {}, assume.map(x => h('li', {}, x))), h('p', { class: 'src' }, 'Standard textbook formulation (for example Brealey, Myers and Allen; Berk and DeMarzo; Bodie, Kane and Marcus). For study and practice.')) : null;
  const outEl = h('div', { class: 'out' + (beginner ? ' beg' : '') }, toolsEl, noteEl, infoEl, heroEl, cardsEl, sceneCard, chartsEl, stepsEl, tablesEl, assumeEl, wordsEl);

  function update(fresh) {
    const eff = effective();
    let out;
    try { out = U(m.calc(eff)); } catch (e) { out = { note: 'Something went wrong in this calculation: ' + e.message, cards: [], charts: [], steps: [] }; }
    lastOut = out;
    if (!beginner) {
      Object.values(refs).forEach(r => {
        const sh = m.show && m.show[r.f.id]; r.wrap.hidden = sh ? !sh(v) : false;
        if (r.solved) { r.solved = false; r.box.classList.remove('solved'); r.input.readOnly = false; r.input.value = v[r.f.id]; }
      });
      if (out.solved && refs[out.solved.id]) {
        const r = refs[out.solved.id];
        r.solved = true; r.box.classList.add('solved'); r.input.readOnly = true;
        r.input.value = isFinite(out.solved.value) ? +out.solved.value.toFixed(out.solved.dp == null ? 6 : out.solved.dp) : '';
        if (r.slider) r.slider.value = r.input.value;
      }
    } else Object.values(refs).forEach(r => { const sh = m.show && m.show[r.f.id]; r.wrap.hidden = sh && !simple ? !sh(eff) : false; });
    noteEl.hidden = !out.note; noteEl.textContent = out.note || '';
    infoEl.hidden = !out.info; infoEl.textContent = out.info || '';
    const k = keyCard(out), cards = out.cards || [];
    let list = (out.charts || []).filter(Boolean);
    if (beginner) {
      const ek = easyCard(B, k);
      let plain; try { const fn = simple ? B.simple.plain : B.plain; plain = fn ? U(fn(simple ? b : eff, out, k)) : [`${ek.label}: ${k.value}`, '']; } catch (e) { plain = [`${ek.label}: ${k.value}`, '']; }
      heroEl.hidden = !cards.length;
      heroEl.innerHTML = `<p class="eyebrow">${esc(ek.label || '')}</p><div class="big" data-v></div><p class="headline">${esc(plain[0] || '')}</p>`;
      const big = heroEl.querySelector('[data-v]');
      tick(big, k.value || '—', 'big:' + moduleKey());
      const hl = heroEl.querySelector('.headline'); if (hl) tick(hl, plain[0] || '', 'hl:' + moduleKey()); if (fresh && k.tone === 'good') setTimeout(() => burst(big), 900);
      const extra = cards.filter(c => !c.head && c !== k).slice(0, 2).map(c => easyCard(B, c));
      cardsEl.innerHTML = extra.map(c => `<div class="stat ${c.tone || ''}"><span class="sl">${esc(c.label)}</span><b class="sv"></b></div>`).join('');
      cardsEl.querySelectorAll('.sv').forEach((el, i) => tick(el, extra[i].value, `sv:${moduleKey()}:${i}`));
      wordsEl.innerHTML = (B.words || []).length ? `<details><summary>Words to know</summary><div class="wgrid">${B.words.map(([t, d]) => `<div class="word"><b>${esc(t)}</b><span>${esc(d)}</span></div>`).join('')}</div></details>` : '';
      /* teaching animation driven by the user's numbers */
      if (B.scene && SCENES[B.scene.id] && cards.length) {
        let sp = null; try { sp = B.scene.map(simple ? b : eff, out); } catch (e) { sp = null; }
        if (sp) {
          sceneCard.hidden = false;
          if (!sceneView) { sceneView = new SceneView(sceneHost, B.scene.id, { params: sp, external: true }); sceneCard.append(h('div', { class: 'chead' }, h('h3', {}, SCENES[B.scene.id].title)), sceneHost); }
          else sceneView.setParams(sp, !fresh);
        }
        list = [];
      } else sceneCard.hidden = true;
      if (list.length) list = list.slice(0, 1);
    } else {
      cardsEl.innerHTML = cards.map(c => (c.head ? `<h3 class="grp">${esc(c.head)}</h3>` : `<div class="stat ${c.key ? 'key' : ''} ${c.tone || ''}"><span class="sl">${esc(c.label)}</span><b class="sv"></b>${c.sub ? `<small>${esc(c.sub)}</small>` : ''}</div>`)).join('');
      cardsEl.querySelectorAll('.sv').forEach((el, i) => tick(el, cards.filter(c => !c.head)[i].value, `sv:${moduleKey()}:${i}`));
    }
    const nsig = list.map(c => (c.type || 'xy') + '|' + c.title).join('~');
    let fr = fresh;
    if (nsig !== sig) {
      charts.forEach(c => c.destroy()); observers.forEach(o => o.disconnect()); observers = [];
      chartsEl.innerHTML = ''; charts = list.map(chartCard); charts.forEach(c => chartsEl.append(c.card)); sig = nsig; fr = true;
    }
    list.forEach((sp, i) => charts[i].set(sp, fr));
    if (fr && 'IntersectionObserver' in window) charts.forEach(c => { const o = new IntersectionObserver(es => { if (es[0].isIntersecting) { o.disconnect(); setTimeout(() => c.play(), 120); } }, { threshold: 0.3 }); o.observe(c.card); observers.push(o); });
    const hasSteps = out.steps && out.steps.length;
    stepsEl.hidden = !hasSteps;
    stepsEl.innerHTML = hasSteps ? (beginner ? `<details><summary><h3>Show me the math</h3></summary>${stepsHtml(out.steps)}</details>` : `<h3>Step-by-step calculation</h3>${stepsHtml(out.steps)}`) : '';
    tablesEl.innerHTML = beginner ? '' : (out.tables || []).map(t => `<section class="card tcard">${tableHtml(t)}</section>`).join('');
  }

  /* ----- page frame ----- */
  const modeBtn = (label, on) => h('button', { type: 'button', class: on ? 'on' : '', 'aria-pressed': String(on), onclick: () => { store.set('fl:mode', label === 'Pro' ? 'pro' : 'beginner'); onMode(); } }, label);
  function unitSeg() {
    const pick = next => {
      if (next === unit) return;
      const f = unitFactor(unit, next);
      const conv = (fields, st, k) => { fields.filter(isUnitField).forEach(fd => { st[fd.id] = +(st[fd.id] * f).toPrecision(12); }); store.set(k, st); };
      conv(m.fields, v, key);
      if (b) conv(B.simple.fields, b, sKey);
      store.set('fl:unit', next);
      onMode();
    };
    return h('div', { class: 'seg units', title: 'Units for money and share counts' }, h('span', { class: 'ulab' }, 'Units'), UNIT_LIST.map(([id, txt, name]) => h('button', { type: 'button', class: id === unit ? 'on' : '', 'aria-pressed': String(id === unit), title: name, onclick: () => pick(id) }, txt)));
  }
  const head = h('header', { class: 'vhead reveal' },
    h('div', { class: 'vtitle' },
      h('a', { class: `chip tint-${topic.tint}`, href: '/', 'data-link': true }, '← ' + topic.label),
      h('h1', { html: esc(beginner && B.ask ? B.ask : m.title).replace(/(\S+\??)$/, '<em>$1</em>') }),
      beginner ? null : h('p', { class: 'blurb' }, m.blurb)),
    h('div', { class: 'vctl' }, hasUnits ? unitSeg() : null, h('div', { class: 'seg', title: 'Beginner shows the simple version. Pro shows everything.' }, modeBtn('Beginner', beginner), modeBtn('Pro', !beginner))));
  const lab = h('div', { class: 'lab' }, inputsEl, outEl);
  const concept = h('div', { class: 'concept card', html: m.concept, hidden: true });
  main.innerHTML = '';
  if (beginner) main.append(head, lab);
  else {
    const tabBtns = ['Calculator', 'Concept & formulas'].map((t, k) => h('button', { type: 'button', class: 'tab' + (k ? '' : ' on'), onclick: () => { tabBtns.forEach((x, j) => x.classList.toggle('on', j === k)); lab.hidden = !!k; concept.hidden = !k; } }, t));
    main.append(head, h('div', { class: 'tabs', role: 'tablist' }, tabBtns), lab, concept);
  }
  update(true);
  return () => { cancelAnimationFrame(raf); charts.forEach(c => c.destroy()); observers.forEach(o => o.disconnect()); if (sceneView) sceneView.destroy(); };
}
