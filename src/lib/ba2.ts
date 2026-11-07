/** Key-by-key engine for a BA II Plus Professional financial calculator. `press` is a pure function: the old state in, a new state out.
 *  Independent training tool, not affiliated with or endorsed by Texas Instruments. */
import * as M from './ba2math';

type Fn = (a: number, b: number) => number;
const FNS: Record<string, Fn> = {
  ADD: (a, b) => a + b, SUB: (a, b) => a - b, MUL: (a, b) => a * b, DIV: (a, b) => (b === 0 ? NaN : a / b), YX: (a, b) => Math.pow(a, b),
  nPr: (n, r) => (Number.isInteger(n) && Number.isInteger(r) && n >= 0 && r >= 0 && r <= n && n <= 170 ? fact(n) / fact(n - r) : NaN),
  nCr: (n, r) => (Number.isInteger(n) && Number.isInteger(r) && n >= 0 && r >= 0 && r <= n && n <= 170 ? Math.round(fact(n) / (fact(r) * fact(n - r))) : NaN)
};
const fact = (n: number): number => { let r = 1; for (let i = 2; i <= n; i++) r *= i; return r; };

export interface State {
  entry: string; typing: boolean; x: number; op: { fn: string; a: number } | null;
  second: boolean; cpt: boolean; pend: '' | 'STO' | 'RCL'; error: string | null; label: string;
  tvm: M.Tvm; py: number; cy: number; bgn: boolean; dec: number; mem: number[];
  ws: { id: string; i: number } | null;
  cf: { cf0: number; flows: M.Flow[]; i: number }; res: Record<string, number | string>;
  amort: { p1: number; p2: number };
  bond: { sdt: number; cpn: number; rdt: number; rv: number; act: boolean; semi: boolean; yld: number; pri: number };
  depr: M.DeprIn; stat: { pts: M.Pt[]; lin: boolean };
  be: M.Be; prft: M.Prft; date: { d1: number; d2: number; dbd: number; act: boolean }; iconv: { nom: number; eff: number; cy: number };
}

export const initial = (): State => ({
  entry: '', typing: false, x: 0, op: null, second: false, cpt: false, pend: '', error: null, label: '',
  tvm: { N: 0, IY: 0, PV: 0, PMT: 0, FV: 0 }, py: 12, cy: 12, bgn: false, dec: 2, mem: Array(10).fill(0), ws: null,
  cf: { cf0: 0, flows: [], i: 0 }, res: {}, amort: { p1: 1, p2: 1 },
  bond: { sdt: 0, cpn: 0, rdt: 0, rv: 100, act: true, semi: true, yld: 0, pri: 0 },
  depr: { method: 'SL', life: 1, m: 1, cst: 0, sal: 0, yr: 1, db: 200 }, stat: { pts: [], lin: true },
  be: { fc: 0, vc: 0, p: 0, pft: 0, q: 0 }, prft: { cst: 0, sel: 0, mar: 0 }, date: { d1: 0, d2: 0, dbd: 0, act: true }, iconv: { nom: 0, eff: 0, cy: 1 }
});

/* ---------------- worksheets ---------------- */
interface Field {
  name: string; kind: 'in' | 'out' | 'toggle'; date?: boolean;
  get: (s: State) => number | string; set?: (s: State, v: number) => string | void; cpt?: (s: State) => number | string; toggle?: (s: State) => void;
}
const ERR5 = 'Error 5', ERR2 = 'Error 2';
const pad = (k: number) => String(k).padStart(2, '0');
const inp = (name: string, get: Field['get'], set: NonNullable<Field['set']>, extra: Partial<Field> = {}): Field => ({ name, kind: 'in', get, set, ...extra });
const out = (name: string, get: Field['get'], cpt?: Field['cpt']): Field => ({ name, kind: 'out', get, cpt });
const tog = (name: string, get: Field['get'], toggle: NonNullable<Field['toggle']>): Field => ({ name, kind: 'toggle', get, toggle });
const dateIn = (name: string, get: Field['get'], set: (s: State, v: number) => void): Field => inp(name, get, (s, v) => (M.toDate(v) ? set(s, v) : ERR2), { date: true });
const series = (s: State) => M.expandFlows(s.cf.cf0, s.cf.flows);
const rate = (s: State) => s.cf.i;
const rounder = (s: State) => (s.dec === 9 ? null : s.dec);
const amortRes = (s: State) => M.amortize(s.tvm, s.py, s.cy, s.bgn, s.amort.p1, s.amort.p2, rounder(s));
const bondIn = (s: State): M.BondIn => ({ sdt: s.bond.sdt, cpn: s.bond.cpn, rdt: s.bond.rdt, rv: s.bond.rv, act: s.bond.act, semi: s.bond.semi });
const deprRes = (s: State) => M.depreciate(s.depr);
const stats = (s: State) => M.statistics(s.stat.pts);
const sv = (s: State, name: string, v: number | null | undefined): number | string => { if (v === null || v === undefined || !Number.isFinite(v)) return ERR5; s.res[name] = v; return v; };

function listFields(label: 'C' | 'X', s: State): Field[] {
  const isCf = label === 'C', n = isCf ? s.cf.flows.length : s.stat.pts.length, max = isCf ? 32 : 50, f: Field[] = [];
  if (isCf) f.push(inp('CF0', st => st.cf.cf0, (st, v) => { st.cf.cf0 = v; }));
  for (let k = 1; k <= Math.min(max, n + 1); k++) {
    if (isCf) {
      f.push(inp('C' + pad(k), st => st.cf.flows[k - 1]?.c ?? 0, (st, v) => { if (k - 1 === st.cf.flows.length) st.cf.flows.push({ c: v, f: 1 }); else st.cf.flows[k - 1].c = v; }));
      f.push(inp('F' + pad(k), st => st.cf.flows[k - 1]?.f ?? 1, (st, v) => { if (!(v >= 1) || !Number.isInteger(v) || v > 9999) return 'Error 1'; if (st.cf.flows[k - 1]) st.cf.flows[k - 1].f = v; }));
    } else {
      f.push(inp('X' + pad(k), st => st.stat.pts[k - 1]?.x ?? 0, (st, v) => { if (k - 1 === st.stat.pts.length) st.stat.pts.push({ x: v, y: 0 }); else st.stat.pts[k - 1].x = v; }));
      f.push(inp('Y' + pad(k), st => st.stat.pts[k - 1]?.y ?? 0, (st, v) => { if (k - 1 === st.stat.pts.length) st.stat.pts.push({ x: 0, y: v }); else st.stat.pts[k - 1].y = v; }));
    }
  }
  return f;
}

const WS: Record<string, (s: State) => Field[]> = {
  PY: () => [inp('P/Y', s => s.py, (s, v) => { if (!(v >= 1) || v > 365) return 'Error 1'; s.py = v; }), inp('C/Y', s => s.cy, (s, v) => { if (!(v >= 1) || v > 365) return 'Error 1'; s.cy = v; })],
  BGN: () => [tog('', s => (s.bgn ? 'BGN' : 'END'), s => { s.bgn = !s.bgn; })],
  FORMAT: () => [inp('DEC', s => s.dec, (s, v) => { if (!Number.isInteger(v) || v < 0 || v > 9) return 'Error 1'; s.dec = v; })],
  CF: s => listFields('C', s),
  NPV: () => [
    inp('I', s => s.cf.i, (s, v) => { s.cf.i = v; }),
    out('NPV', s => s.res.NPV ?? 0, s => sv(s, 'NPV', M.npvAt(rate(s), series(s)))),
    out('NFV', s => s.res.NFV ?? 0, s => sv(s, 'NFV', M.nfvAt(rate(s), series(s)))),
    out('PI', s => s.res.PI ?? 0, s => sv(s, 'PI', M.piAt(rate(s), series(s)))),
    out('PB', s => s.res.PB ?? 0, s => { const v = M.paybackPeriod(series(s)); return v === null ? 'N/A' : sv(s, 'PB', v); }),
    out('DPB', s => s.res.DPB ?? 0, s => { const v = M.paybackPeriod(series(s), rate(s)); return v === null ? 'N/A' : sv(s, 'DPB', v); })
  ],
  IRR: () => [out('IRR', s => s.res.IRR ?? 0, s => sv(s, 'IRR', M.irrPercent(series(s))))],
  AMORT: () => [
    inp('P1', s => s.amort.p1, (s, v) => { if (!(v >= 1) || !Number.isInteger(v)) return 'Error 1'; s.amort.p1 = v; s.amort.p2 = Math.max(s.amort.p2, v); }),
    inp('P2', s => s.amort.p2, (s, v) => { if (!(v >= s.amort.p1) || !Number.isInteger(v)) return 'Error 1'; s.amort.p2 = v; }),
    out('BAL', s => amortRes(s)?.bal ?? ERR5), out('PRN', s => amortRes(s)?.prn ?? ERR5), out('INT', s => amortRes(s)?.int ?? ERR5)
  ],
  BOND: () => [
    dateIn('SDT', s => s.bond.sdt, (s, v) => { s.bond.sdt = v; }),
    inp('CPN', s => s.bond.cpn, (s, v) => { s.bond.cpn = v; }),
    dateIn('RDT', s => s.bond.rdt, (s, v) => { s.bond.rdt = v; }),
    inp('RV', s => s.bond.rv, (s, v) => { s.bond.rv = v; }),
    tog('', s => (s.bond.act ? 'ACT' : '360'), s => { s.bond.act = !s.bond.act; }),
    tog('', s => (s.bond.semi ? '2/Y' : '1/Y'), s => { s.bond.semi = !s.bond.semi; }),
    inp('YLD', s => s.bond.yld, (s, v) => { s.bond.yld = v; }, { cpt: s => { const v = M.bondYieldFromPrice(bondIn(s), s.bond.pri); if (v === null) return ERR5; s.bond.yld = v; return v; } }),
    inp('PRI', s => s.bond.pri, (s, v) => { s.bond.pri = v; }, { cpt: s => { const v = M.bondPriceFromYield(bondIn(s), s.bond.yld); if (v === null) return ERR5; s.bond.pri = v; return v; } }),
    out('AI', s => M.accrued(bondIn(s)) ?? ERR5)
  ],
  DEPR: s => [
    tog('', st => st.depr.method, st => { st.depr.method = st.depr.method === 'SL' ? 'SYD' : st.depr.method === 'SYD' ? 'DB' : 'SL'; }),
    inp('LIF', st => st.depr.life, (st, v) => { if (!(v > 0)) return 'Error 1'; st.depr.life = v; }),
    inp('M01', st => st.depr.m, (st, v) => { if (!Number.isInteger(v) || v < 1 || v > 12) return 'Error 1'; st.depr.m = v; }),
    inp('CST', st => st.depr.cst, (st, v) => { st.depr.cst = v; }), inp('SAL', st => st.depr.sal, (st, v) => { st.depr.sal = v; }),
    inp('YR', st => st.depr.yr, (st, v) => { if (!Number.isInteger(v) || v < 1) return 'Error 1'; st.depr.yr = v; }),
    ...(s.depr.method === 'DB' ? [inp('DB', st => st.depr.db, (st, v) => { if (!(v > 0)) return 'Error 1'; st.depr.db = v; })] : []),
    out('DEP', st => deprRes(st)?.dep ?? ERR5), out('RBV', st => deprRes(st)?.rbv ?? ERR5), out('RDV', st => deprRes(st)?.rdv ?? ERR5)
  ],
  DATA: s => listFields('X', s),
  STAT: s => {
    const g = (k: keyof M.Stats) => (st: State) => { const r = stats(st); const v = r ? r[k] : NaN; return Number.isFinite(v) ? v : ERR5; };
    const head = tog('', st => (st.stat.lin ? 'LIN' : '1-V'), st => { st.stat.lin = !st.stat.lin; });
    const one = [out('n', g('n')), out('X̄', g('xbar')), out('Sx', g('sx')), out('σx', g('sigx')), out('ΣX', g('sumx')), out('ΣX²', g('sumx2'))];
    return s.stat.lin ? [head, ...one.slice(0, 4), out('Ȳ', g('ybar')), out('Sy', g('sy')), out('σy', g('sigy')), out('a', g('a')), out('b', g('b')), out('r', g('r')), out('ΣX', g('sumx')), out('ΣX²', g('sumx2')), out('ΣY', g('sumy')), out('ΣY²', g('sumy2')), out('ΣXY', g('sumxy'))] : [head, ...one];
  },
  BRKEVN: () => (['fc', 'vc', 'p', 'pft', 'q'] as const).map(k => inp(({ fc: 'FC', vc: 'VC', p: 'P', pft: 'PFT', q: 'Q' })[k], s => s.be[k], (s, v) => { s.be[k] = v; }, { cpt: s => { const v = M.solveBreakeven(s.be, k); if (v === null) return ERR5; s.be[k] = v; return v; } })),
  PRFT: () => (['cst', 'sel', 'mar'] as const).map(k => inp(({ cst: 'CST', sel: 'SEL', mar: 'MAR' })[k], s => s.prft[k], (s, v) => { s.prft[k] = v; }, { cpt: s => { const v = M.solveProfit(s.prft, k); if (v === null) return ERR5; s.prft[k] = v; return v; } })),
  DATE: () => [
    dateIn('DT1', s => s.date.d1, (s, v) => { s.date.d1 = v; }),
    dateIn('DT2', s => s.date.d2, (s, v) => { s.date.d2 = v; }),
    tog('', s => (s.date.act ? 'ACT' : '360'), s => { s.date.act = !s.date.act; }),
    out('DBD', s => { const a = M.toDate(s.date.d1), b = M.toDate(s.date.d2); return a && b ? (s.date.act ? M.daysActual(a, b) : M.days360(a, b)) : ERR5; })
  ],
  ICONV: () => [
    inp('NOM', s => s.iconv.nom, (s, v) => { s.iconv.nom = v; }, { cpt: s => { if (!(s.iconv.cy >= 1)) return ERR5; s.iconv.nom = M.nomFromEff(s.iconv.eff, s.iconv.cy); return s.iconv.nom; } }),
    inp('EFF', s => s.iconv.eff, (s, v) => { s.iconv.eff = v; }, { cpt: s => { if (!(s.iconv.cy >= 1)) return ERR5; s.iconv.eff = M.effFromNom(s.iconv.nom, s.iconv.cy); return s.iconv.eff; } }),
    inp('C/Y', s => s.iconv.cy, (s, v) => { if (!(v >= 1) || v > 365) return 'Error 1'; s.iconv.cy = v; })
  ],
  MEM: () => Array.from({ length: 10 }, (_, k) => inp('M' + k, s => s.mem[k], (s, v) => { s.mem[k] = v; }))
};
const INSERTABLE = new Set(['CF', 'DATA']);
const ALIAS: Record<string, string> = { NPV: 'NPV', IRR: 'IRR' };
const fieldsOf = (s: State): Field[] => (s.ws ? WS[s.ws.id](s) : []);

/* ---------------- numbers on the display ---------------- */
export function fmtNumber(v: number, dec: number): string {
  if (!Number.isFinite(v)) return 'Error 1';
  if (Math.abs(v) >= 1e10) return v.toExponential(5).replace('e+', ' E');
  const z = Math.abs(v) < 0.5 * Math.pow(10, -(dec === 9 ? 9 : dec)) ? 0 : v;
  if (dec === 9) return Number(z.toPrecision(10)).toLocaleString('en-US', { maximumFractionDigits: 9 });
  return z.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec });
}
const groupInt = (e: string): string => { const neg = e.startsWith('-'), b = neg ? e.slice(1) : e, [i, f] = b.split('.'); return (neg ? '-' : '') + (i || '0').replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (f !== undefined ? '.' + f : ''); };
const cur = (s: State): number => { if (!s.typing) return s.x; const n = parseFloat(s.entry); return Number.isFinite(n) ? n : 0; };

export interface View { label: string; value: string; second: boolean; bgn: boolean; busy: string; ws: string }
/** What the display shows: a small left label, the main value, and indicator flags. */
export function view(s: State): View {
  const base = { second: s.second, bgn: s.bgn, busy: s.pend || (s.cpt ? 'CPT' : ''), ws: s.ws ? s.ws.id : '' };
  if (s.error) return { ...base, label: '', value: s.error };
  if (s.ws) {
    const f = fieldsOf(s)[s.ws.i];
    if (!f) return { ...base, label: '', value: fmtNumber(s.x, s.dec) };
    const label = f.name ? f.name + ' =' : '';
    if (s.typing) return { ...base, label, value: groupInt(s.entry || '0') };
    const v = f.get(s);
    if (typeof v === 'string') return { ...base, label, value: v };
    if (f.date) { const d = M.toDate(v); return { ...base, label, value: d ? M.fmtDate(d) : fmtNumber(v, 4) }; }
    return { ...base, label, value: s.ws.id === 'FORMAT' || (s.ws.id === 'CF' && f.name.startsWith('F')) || (s.ws.id === 'AMORT' && f.name.startsWith('P')) || f.name === 'C/Y' || f.name === 'P/Y' || f.name === 'YR' || f.name === 'M01' ? fmtNumber(v, f.name === 'C/Y' || f.name === 'P/Y' ? 0 : s.dec) : fmtNumber(v, s.dec) };
  }
  return { ...base, label: s.typing ? '' : s.label, value: s.typing ? groupInt(s.entry || '0') : fmtNumber(s.x, s.dec) };
}

/* ---------------- key handling ---------------- */
const SECOND: Record<string, string> = {
  N: 'xPY', IY: 'PY', PV: 'AMORT', PMT: 'BGN', FV: 'CLRTVM', CPT: 'QUIT', ENTER: 'SET', UP: 'INS', DOWN: 'DEL',
  '7': 'DATA', '8': 'STAT', '9': 'BRKEVN', '4': 'BOND', '5': 'DEPR', '6': 'ICONV', '1': 'PRFT', '2': 'DATE', '3': 'nCr', '0': 'MEM', '.': 'FORMAT',
  NEG: 'RESET', CLR: 'CLRWORK', BACK: 'FACT', PCT: 'nPr', SQRT: 'SQ', YX: 'INV', LN: 'EXP'
};
const OPENERS = new Set(['CF', 'NPV', 'IRR', 'AMORT', 'PY', 'BGN', 'DATA', 'STAT', 'BRKEVN', 'BOND', 'DEPR', 'ICONV', 'PRFT', 'DATE', 'MEM', 'FORMAT']);
const TVM_KEYS = ['N', 'IY', 'PV', 'PMT', 'FV'] as const;
const BINARY = new Set(['ADD', 'SUB', 'MUL', 'DIV', 'YX', 'nPr', 'nCr']);

function fail(s: State, msg: string): State { s.error = msg; s.x = 0; s.typing = false; s.entry = ''; s.op = null; s.cpt = false; return s; }
function apply(op: { fn: string; a: number }, b: number): number { return FNS[op.fn](op.a, b); }
function settle(s: State): boolean { /* finish any typed number or pending chain into s.x; false if it errored */
  let v = cur(s);
  if (s.op) { v = apply(s.op, v); s.op = null; }
  if (!Number.isFinite(v)) { fail(s, 'Error 1'); return false; }
  s.x = v; s.typing = false; s.entry = ''; return true;
}
function show(s: State, label: string, v: number): void { s.ws = null; s.x = v; s.label = label; s.typing = false; s.entry = ''; s.op = null; }
function clearWork(s: State): void {
  const id = s.ws ? s.ws.id : '', d = initial();
  if (id === 'CF' || id === 'NPV' || id === 'IRR') { s.cf = d.cf; s.res = {}; }
  else if (id === 'DATA') s.stat.pts = [];
  else if (id === 'AMORT') s.amort = d.amort; else if (id === 'BOND') s.bond = d.bond; else if (id === 'DEPR') s.depr = d.depr;
  else if (id === 'BRKEVN') s.be = d.be; else if (id === 'PRFT') s.prft = d.prft; else if (id === 'DATE') s.date = d.date; else if (id === 'ICONV') s.iconv = d.iconv; else if (id === 'MEM') s.mem = d.mem;
  s.typing = false; s.entry = '';
}

function tvmKey(s: State, k: typeof TVM_KEYS[number], compute: boolean): State {
  if (compute) {
    const v = solveFor(s, k);
    if (v === null) return fail(s, 'Error 5');
    s.tvm[k] = v; show(s, k === 'IY' ? 'I/Y =' : k + ' =', v); return s;
  }
  if (s.typing || s.op) { if (!settle(s)) return s; s.tvm[k] = s.x; }
  show(s, k === 'IY' ? 'I/Y =' : k + ' =', s.tvm[k]); return s;
}
const solveFor = (s: State, k: typeof TVM_KEYS[number]) => M.solveTvm(s.tvm, k, s.py, s.cy, s.bgn);

function moveField(s: State, d: number): void {
  if (!s.ws) return;
  const n = fieldsOf(s).length; if (!n) return;
  s.ws.i = (s.ws.i + d + n) % n; s.typing = false; s.entry = '';
}
function openWs(s: State, id: string): State { if (!settle(s)) return s; s.ws = { id, i: 0 }; s.typing = false; s.entry = ''; return s; }

function wsEnter(s: State): State {
  const f = fieldsOf(s)[s.ws!.i];
  if (!f || f.kind !== 'in' || !f.set) { s.typing = false; s.entry = ''; return s; }
  if (!s.typing && !s.op) return s;
  if (!settle(s)) return s;
  const msg = f.set(s, s.x);
  if (typeof msg === 'string') return fail(s, msg);
  return s;
}
function wsCompute(s: State): State {
  const f = fieldsOf(s)[s.ws!.i]; if (!f || !f.cpt) return s;
  if (f.kind === 'in' && (s.typing || s.op)) { /* a typed value on an input field is stored first, as a plain ENTER would */ if (!settle(s)) return s; f.set!(s, s.x); }
  const v = f.cpt(s);
  if (typeof v === 'string') { s.res[f.name] = v; return v === 'N/A' ? s : fail(s, v); }
  s.x = v; s.typing = false; s.entry = ''; return s;
}

/** Press one key. Keys are named: 0-9 . NEG BACK CLR ADD SUB MUL DIV EQ PCT SQRT YX LN 2ND CPT ENTER UP DOWN N IY PV PMT FV CF NPV IRR STO RCL. */
export function press(prev: State, k: string): State {
  const s: State = structuredClone(prev);
  if (s.error) { s.error = null; if (k === 'CLR' || k === '2ND') return s; }
  if (k === '2ND') { s.second = !s.second; return s; }
  const sec = s.second; s.second = false;
  if (s.pend) {
    const pend = s.pend; s.pend = '';
    if (!sec && /^[0-9]$/.test(k)) {
      const slot = Number(k);
      if (pend === 'STO') { s.mem[slot] = cur(s); } else { s.x = s.mem[slot]; s.typing = false; s.entry = ''; }
      s.label = pend === 'STO' ? 'STO ' + k : 'RCL ' + k; return s;
    }
  }
  let key = sec ? SECOND[k] ?? k : k;
  if (s.cpt) { s.cpt = false; if ((TVM_KEYS as readonly string[]).includes(key) && !sec) return tvmKey(s, key as typeof TVM_KEYS[number], true); }
  s.label = '';

  if (/^[0-9]$/.test(key)) { if (!s.typing) { s.entry = ''; s.typing = true; } if (s.entry.replace(/[-.]/g, '').length < 10) s.entry = s.entry === '0' ? key : s.entry + key; return s; }
  if (key === '.') { if (!s.typing) { s.entry = '0'; s.typing = true; } if (!s.entry.includes('.')) s.entry += '.'; return s; }
  switch (key) {
    case 'NEG': if (s.typing) s.entry = s.entry.startsWith('-') ? s.entry.slice(1) : '-' + s.entry; else s.x = -s.x; return s;
    case 'BACK': if (s.typing) { s.entry = s.entry.slice(0, -1); if (!s.entry || s.entry === '-') { s.typing = false; s.entry = ''; } } return s;
    case 'CLR': if (s.typing) { s.typing = false; s.entry = ''; } else { s.op = null; s.x = 0; } return s;
    case 'CLRWORK': clearWork(s); return s;
    case 'CLRTVM': s.tvm = { N: 0, IY: 0, PV: 0, PMT: 0, FV: 0 }; show(s, 'TVM CLR', 0); return s;
    case 'RESET': { const r = initial(); r.label = 'RST'; return r; }
    case 'QUIT': s.ws = null; s.typing = false; s.entry = ''; return s;
    case 'CPT': if (s.ws) return wsCompute(s); s.cpt = true; return s;
    case 'ENTER': return s.ws ? wsEnter(s) : (settle(s), s);
    case 'SET': { const f = s.ws ? fieldsOf(s)[s.ws.i] : null; if (f && f.kind === 'toggle' && f.toggle) f.toggle(s); return s; }
    case 'UP': moveField(s, -1); return s;
    case 'DOWN': moveField(s, 1); return s;
    case 'INS': case 'DEL': {
      if (!s.ws || !INSERTABLE.has(s.ws.id)) return s;
      const f = fieldsOf(s)[s.ws.i]; if (!f) return s;
      const cf = s.ws.id === 'CF', idx = cf ? Number(f.name.slice(1)) - 1 : Number(f.name.slice(1)) - 1;
      if (idx < 0 || Number.isNaN(idx)) return s;
      if (cf) { if (key === 'INS') s.cf.flows.splice(idx, 0, { c: 0, f: 1 }); else if (idx < s.cf.flows.length) s.cf.flows.splice(idx, 1); }
      else if (key === 'INS') s.stat.pts.splice(idx, 0, { x: 0, y: 0 }); else if (idx < s.stat.pts.length) s.stat.pts.splice(idx, 1);
      s.ws.i = Math.min(s.ws.i, fieldsOf(s).length - 1); return s;
    }
    case 'STO': case 'RCL': s.pend = key; return s;
    case 'EQ': settle(s); return s;
    case 'xPY': { if (!settle(s)) return s; s.tvm.N = s.x * s.py; show(s, 'N =', s.tvm.N); return s; }
    case 'PCT': { const v = cur(s); if (s.op) { const a = s.op.a, r = s.op.fn === 'ADD' || s.op.fn === 'SUB' ? (a * v) / 100 : v / 100; if (!Number.isFinite(r) || Math.abs(r) >= 1e10) return fail(s, 'Error 1'); s.entry = String(+r.toPrecision(12)); if (/e/i.test(s.entry)) return fail(s, 'Error 1'); s.typing = true; } else { s.x = v / 100; s.typing = false; s.entry = ''; } return s; }
    case 'SQRT': case 'SQ': case 'INV': case 'LN': case 'EXP': case 'FACT': {
      const v = cur(s);
      const r = key === 'SQRT' ? (v >= 0 ? Math.sqrt(v) : NaN) : key === 'SQ' ? v * v : key === 'INV' ? (v === 0 ? NaN : 1 / v) : key === 'LN' ? (v > 0 ? Math.log(v) : NaN) : key === 'EXP' ? Math.exp(v) : (Number.isInteger(v) && v >= 0 && v <= 69 ? fact(v) : NaN);
      if (!Number.isFinite(r)) return fail(s, 'Error 1');
      s.x = r; s.typing = false; s.entry = ''; return s;
    }
  }
  if (BINARY.has(key)) { const v = cur(s), a = s.op ? apply(s.op, v) : v; if (!Number.isFinite(a)) return fail(s, 'Error 1'); s.x = a; s.op = { fn: key, a }; s.typing = false; s.entry = ''; return s; }
  if ((TVM_KEYS as readonly string[]).includes(key)) return tvmKey(s, key as typeof TVM_KEYS[number], false);
  if (OPENERS.has(key) || ALIAS[key]) return openWs(s, ALIAS[key] ?? key);
  return s;
}
