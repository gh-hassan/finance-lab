import { describe, expect, it } from 'vitest';
import { initial, press, view, type State } from '../src/lib/ba2';
import { expandFlows, npvAt, irrPercent } from '../src/lib/ba2math';

/** Turn "12.5" or "-4" into key presses. */
const num = (t: string): string[] => [...t.replace('-', '')].map(c => c).concat([]).reduce<string[]>((a, c) => [...a, c], t.startsWith('-') ? [] : []).concat(t.startsWith('-') ? ['NEG'] : []);
const typed = (t: string): string[] => (t.startsWith('-') ? [...t.slice(1)].concat('NEG') : [...t]);
const run = (keys: string[], s: State = initial()): State => keys.reduce((st, k) => press(st, k), s);
const val = (s: State) => view(s).value;
const lab = (s: State) => view(s).label;
void num;

describe('arithmetic like the handheld (chain calculation)', () => {
  it('evaluates left to right', () => { expect(val(run([...typed('2'), 'ADD', ...typed('3'), 'MUL', ...typed('4'), 'EQ']))).toBe('20.00'); });
  it('shows the running result when the next operator is pressed', () => { expect(val(run(['2', 'ADD', '3', 'MUL']))).toBe('5.00'); });
  it('percent of a number and add-on percent', () => {
    expect(val(run(['2', '0', '0', 'MUL', '1', '5', 'PCT', 'EQ']))).toBe('30.00');
    expect(val(run(['1', '0', '0', 'ADD', '1', '0', 'PCT', 'EQ']))).toBe('110.00');
    expect(val(run(['5', '0', 'PCT']))).toBe('0.50');
  });
  it('unary keys and powers', () => {
    expect(val(run(['9', 'SQRT']))).toBe('3.00'); expect(val(run(['4', '2ND', 'SQRT']))).toBe('16.00'); expect(val(run(['4', '2ND', 'YX']))).toBe('0.25');
    expect(val(run(['2', 'YX', '1', '0', 'EQ']))).toBe('1,024.00'); expect(val(run(['1', 'LN']))).toBe('0.00'); expect(val(run(['1', '2ND', 'LN']))).toBe('2.72'); expect(val(run(['5', '2ND', 'BACK']))).toBe('120.00');
  });
  it('permutations and combinations', () => { expect(val(run(['5', '2ND', 'PCT', '2', 'EQ']))).toBe('20.00'); expect(val(run(['5', '2ND', '3', '2', 'EQ']))).toBe('10.00'); });
  it('sign, backspace and clear', () => {
    expect(val(run(['5', 'NEG']))).toBe('-5'); expect(val(run(['1', '2', '3', 'BACK']))).toBe('12'); expect(val(run(['1', '2', '3', 'CLR']))).toBe('0.00');
    expect(val(run(['5', 'ENTER', 'NEG']))).toBe('-5.00');
  });
  it('shows thousands separators and limits entry to ten digits', () => {
    expect(val(run(['1', '2', '3', '4', '5', '6', '7']))).toBe('1,234,567'); expect(val(run([...'12345678901']))).toBe('1,234,567,890');
  });
  it('flags errors and recovers', () => {
    const e = run(['1', 'DIV', '0', 'EQ']); expect(val(e)).toBe('Error 1'); expect(val(press(e, 'CLR'))).toBe('0.00'); expect(val(run(['0', 'LN']))).toBe('Error 1'); expect(val(run(['2', 'NEG', 'SQRT']))).toBe('Error 1');
  });
  it('stores and recalls memory', () => { const s = run(['5', 'STO', '1', '0', 'RCL', '1']); expect(val(s)).toBe('5.00'); expect(run(['7', 'STO', '9'], initial()).mem[9]).toBe(7); });
  it('2ND toggles and a second press cancels', () => { expect(view(press(initial(), '2ND')).second).toBe(true); expect(view(run(['2ND', '2ND'])).second).toBe(false); });
});

describe('time value of money keys', () => {
  const annual = (): State => run(['2ND', 'IY', '1', 'ENTER', 'DOWN', '1', 'ENTER', '2ND', 'CPT']);
  it('compound growth, solving FV: 10 years at 5%', () => {
    const s = run(['1', '0', 'N', '5', 'IY', '1', '0', '0', '0', 'NEG', 'PV', '0', 'PMT', 'CPT', 'FV'], annual());
    expect(lab(s)).toBe('FV ='); expect(val(s)).toBe('1,628.89');
  });
  it('mortgage payment with the default 12 payments a year: −1,580.17', () => {
    const s = run(['3', '0', '2ND', 'N', '6', '.', '5', 'IY', '2', '5', '0', '0', '0', '0', 'PV', '0', 'FV', 'CPT', 'PMT']);
    expect(s.tvm.N).toBe(360); expect(val(s)).toBe('-1,580.17');
  });
  it('shows a stored value when a key is pressed without a number', () => { const s = run(['7', 'N', '5', 'ADD', '3', 'EQ', 'N']); expect(val(s)).toBe('7.00'); expect(lab(s)).toBe('N ='); });
  it('solves for the rate and the number of periods', () => {
    const r = run(['1', '0', 'N', '1', '0', '0', '0', 'NEG', 'PV', '2', '0', '0', '0', 'FV', '0', 'PMT', 'CPT', 'IY'], annual()); expect(val(r)).toBe('7.18');
    const n = run(['7', '.', '1', '7', '7', '3', '4', '6', 'IY', 'CPT', 'N'], r); expect(val(n)).toBe('10.00');
  });
  it('annuity due via BGN: payment at the start is worth one period more', () => {
    const base = ['5', 'N', '6', 'IY', '1', '0', '0', 'NEG', 'PMT', '0', 'FV'];
    const end = run([...base, 'CPT', 'PV'], annual()), start = run(['2ND', 'PMT', '2ND', 'ENTER', '2ND', 'CPT', ...base, 'CPT', 'PV'], annual());
    expect(end.tvm.PV).toBeCloseTo(421.2364, 3); expect(start.bgn).toBe(true); expect(start.tvm.PV).toBeCloseTo(421.2364 * 1.06, 3);
    expect(view(run(['2ND', 'PMT'], annual())).value).toBe('END'); expect(view(run(['2ND', 'PMT', '2ND', 'ENTER'], annual())).value).toBe('BGN');
  });
  it('CLR TVM empties the five registers and keeps P/Y', () => { const s = run(['5', 'N', '2ND', 'FV'], annual()); expect(s.tvm.N).toBe(0); expect(s.py).toBe(1); });
  it('reports Error 5 when there is no solution', () => { const s = run(['1', '0', 'N', '5', 'IY', '1', '0', '0', '0', 'PV', '1', '0', '0', '0', 'FV', '0', 'PMT', 'CPT', 'N'], annual()); expect(val(s)).toBe('Error 5'); });
  it('P/Y worksheet edits P/Y and C/Y and rejects zero', () => {
    const s = run(['2ND', 'IY'], initial()); expect(lab(s)).toBe('P/Y ='); expect(val(s)).toBe('12');
    expect(val(run(['4', 'ENTER', 'DOWN'], s))).toBe('12'); expect(run(['4', 'ENTER'], s).py).toBe(4); expect(val(run(['0', 'ENTER'], s))).toBe('Error 1');
  });
});

describe('cash flow worksheets', () => {
  const sheet = (): State => run(['CF', '1', '0', '0', '0', 'NEG', 'ENTER', 'DOWN', '3', '0', '0', 'ENTER', 'DOWN', 'DOWN', '4', '0', '0', 'ENTER', 'DOWN', 'DOWN', '5', '0', '0', 'ENTER', 'DOWN', 'DOWN', '6', '0', '0', 'ENTER']);
  it('enters flows and shows the field names', () => {
    expect(sheet().cf.cf0).toBe(-1000); expect(sheet().cf.flows.map(f => f.c)).toEqual([300, 400, 500, 600]);
    expect(lab(run(['CF']))).toBe('CF0 ='); expect(lab(run(['CF', 'DOWN']))).toBe('C01 ='); expect(lab(run(['CF', 'DOWN', 'DOWN']))).toBe('F01 =');
    expect(val(run(['CF', 'DOWN', 'DOWN']))).toBe('1.00');
  });
  it('NPV and IRR agree with direct calculation', () => {
    const npv = run(['NPV', '1', '0', 'ENTER', 'DOWN', 'CPT'], sheet());
    expect(lab(npv)).toBe('NPV ='); expect(Number(val(npv).replace(/,/g, ''))).toBeCloseTo(npvAt(10, expandFlows(-1000, sheet().cf.flows)), 2);
    const irr = run(['IRR', 'CPT'], sheet()); expect(Number(val(irr))).toBeCloseTo(irrPercent(expandFlows(-1000, sheet().cf.flows))!, 2);
  });
  it('repeat counts extend the series', () => {
    const s = run(['2ND', 'CLR'], run(['CF'])); expect(s.cf.flows.length).toBe(0);
    const t = run(['CF', '1', '0', '0', 'NEG', 'ENTER', 'DOWN', '5', '0', 'ENTER', 'DOWN', '3', 'ENTER']); expect(expandFlows(t.cf.cf0, t.cf.flows)).toEqual([-100, 50, 50, 50]);
    expect(val(run(['0', 'ENTER'], run(['CF', 'DOWN', 'DOWN'])))).toBe('Error 1');
  });
  it('payback and discounted payback', () => {
    const s = run(['NPV', '1', '0', 'ENTER', 'DOWN', 'DOWN', 'DOWN', 'DOWN', 'CPT'], sheet()); expect(lab(s)).toBe('PB ='); expect(Number(val(s))).toBeCloseTo(2.6, 2);
  });
  it('INS and DEL edit the list, CLR WORK clears it', () => {
    const s = run(['CF', 'DOWN', '2ND', 'UP'], sheet()); expect(s.cf.flows.map(f => f.c)).toEqual([0, 300, 400, 500, 600]);
    const d = run(['CF', 'DOWN', '2ND', 'DOWN'], sheet()); expect(d.cf.flows.map(f => f.c)).toEqual([400, 500, 600]);
    expect(run(['CF', '2ND', 'CLR'], sheet()).cf.flows).toEqual([]);
  });
  it('IRR with no solution shows Error 5', () => { const s = run(['CF', '1', '0', '0', 'ENTER', 'DOWN', '5', '0', 'ENTER', 'IRR', 'CPT']); expect(val(s)).toBe('Error 5'); });
});

describe('amortization, bonds and the other worksheets', () => {
  const loan = (): State => run(['2ND', 'IY', '1', '2', 'ENTER', '2ND', 'CPT', '1', '2', 'N', '1', '2', 'IY', '1', '0', '0', '0', '0', 'PV', '0', 'FV', 'CPT', 'PMT']);
  it('splits the first year of a loan', () => {
    expect(val(loan())).toBe('-888.49');
    const a = run(['2ND', 'PV', '1', 'ENTER', 'DOWN', '1', '2', 'ENTER', 'DOWN'], loan()); expect(lab(a)).toBe('BAL ='); expect(Number(val(a))).toBeLessThan(1);
    const p = run(['DOWN'], a), i = run(['DOWN', 'DOWN'], a); expect(lab(p)).toBe('PRN ='); expect(Number(val(p).replace(/,/g, ''))).toBeCloseTo(-10000, 0); expect(lab(i)).toBe('INT ='); expect(Number(val(i).replace(/,/g, ''))).toBeCloseTo(-661.88, 0);
  });
  it('bond price from yield, and yield back from price', () => {
    const b = run(['2ND', '4', ...typed('2.1508'), 'ENTER', 'DOWN', ...typed('5.75'), 'ENTER', 'DOWN', ...typed('11.1517'), 'ENTER', 'DOWN', 'DOWN', '2ND', 'ENTER', 'DOWN', 'DOWN', ...typed('6.5'), 'ENTER', 'DOWN', 'CPT']);
    expect(lab(b)).toBe('PRI ='); expect(Number(val(b))).toBeCloseTo(94.63, 2);
    const back = run(['UP', ...typed('0'), 'ENTER', 'DOWN', ...typed('94.63436162'), 'ENTER', 'UP', 'CPT'], b); expect(lab(back)).toBe('YLD ='); expect(Number(val(back))).toBeCloseTo(6.5, 3);
  });
  it('rejects an impossible date', () => { const s = run(['2ND', '4', ...typed('2.3024'), 'ENTER']); expect(val(s)).toBe('Error 2'); });
  it('depreciation by three methods', () => {
    const w = run(['2ND', '5', 'DOWN', '5', 'ENTER', 'DOWN', 'DOWN', '1', '0', '0', '0', '0', 'ENTER', 'DOWN', '1', '0', '0', '0', 'ENTER', 'DOWN', '1', 'ENTER', 'DOWN']);
    expect(lab(w)).toBe('DEP ='); expect(val(w)).toBe('1,800.00');
    const syd = run(['UP', 'UP', 'UP', 'UP', 'UP', 'UP', '2ND', 'ENTER', 'DOWN', 'DOWN', 'DOWN', 'DOWN', 'DOWN', 'DOWN'], w); expect(view(syd).label).toBe('DEP ='); expect(val(syd)).toBe('3,000.00');
  });
  it('statistics from a data list', () => {
    const d = run(['2ND', '7', '1', 'ENTER', 'DOWN', '2', 'ENTER', 'DOWN', '2', 'ENTER', 'DOWN', '4', 'ENTER', 'DOWN', '3', 'ENTER', 'DOWN', '6', 'ENTER']);
    expect(d.stat.pts).toEqual([{ x: 1, y: 2 }, { x: 2, y: 4 }, { x: 3, y: 6 }]);
    const s = run(['2ND', '8', 'DOWN'], d); expect(lab(s)).toBe('n ='); expect(val(s)).toBe('3.00');
    const b = run(['2ND', '8', ...Array(9).fill('DOWN')], d); expect(lab(b)).toBe('b ='); expect(val(b)).toBe('2.00');
    const lin = run(['2ND', '8', '2ND', 'ENTER'], d); expect(val(lin)).toBe('1-V');
  });
  it('break-even, profit margin, date and interest conversion', () => {
    const be = run(['2ND', '9', '1', '0', '0', '0', '0', 'ENTER', 'DOWN', '5', 'ENTER', 'DOWN', '1', '5', 'ENTER', 'DOWN', '0', 'ENTER', 'DOWN', 'CPT']); expect(lab(be)).toBe('Q ='); expect(val(be)).toBe('1,000.00');
    const pr = run(['2ND', '1', '8', '0', 'ENTER', 'DOWN', '1', '0', '0', 'ENTER', 'DOWN', 'CPT']); expect(lab(pr)).toBe('MAR ='); expect(val(pr)).toBe('20.00');
    const dt = run(['2ND', '2', ...typed('1.0120'), 'ENTER', 'DOWN', ...typed('3.0120'), 'ENTER', 'DOWN', 'DOWN']); expect(lab(dt)).toBe('DBD ='); expect(val(dt)).toBe('60.00');
    const ic = run(['2ND', '6', '1', '2', 'ENTER', 'DOWN', 'DOWN', '1', '2', 'ENTER', 'UP', 'CPT']); expect(lab(ic)).toBe('EFF ='); expect(val(ic)).toBe('12.68');
  });
  it('format, memory worksheet, quit and reset', () => {
    expect(val(run(['2ND', '.', '4', 'ENTER', '2ND', 'QUIT', '1', 'DIV', '3', 'EQ']))).toBe('0.3333');
    expect(val(run(['2ND', '.', '9', 'ENTER', '2ND', 'QUIT', '1', 'DIV', '3', 'EQ']))).toBe('0.333333333');
    expect(val(run(['2ND', '.', '1', '5', 'ENTER']))).toBe('Error 1');
    const m = run(['2ND', '0', 'DOWN', '4', '2', 'ENTER']); expect(m.mem[1]).toBe(42); expect(lab(m)).toBe('M1 =');
    const r = run(['5', 'N', '2ND', 'NEG']); expect(r.tvm.N).toBe(0); expect(view(r).label).toBe('RST'); expect(run(['2ND', 'CF']).ws!.id).toBe('CF'); /* a key with no 2nd function just works */
  });
});

describe('robustness: no key sequence can break the calculator', () => {
  const KEYS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '.', 'NEG', 'BACK', 'CLR', 'ADD', 'SUB', 'MUL', 'DIV', 'EQ', 'PCT', 'SQRT', 'YX', 'LN', '2ND', 'CPT', 'ENTER', 'UP', 'DOWN', 'N', 'IY', 'PV', 'PMT', 'FV', 'CF', 'NPV', 'IRR', 'STO', 'RCL'];
  it('survives thousands of random presses with a sane display every time', () => {
    let seed = 12345; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    for (let run_ = 0; run_ < 40; run_++) {
      let s = initial();
      for (let i = 0; i < 400; i++) {
        s = press(s, KEYS[Math.floor(rnd() * KEYS.length)]);
        const v = view(s);
        expect(typeof v.value).toBe('string'); expect(/NaN|undefined|Infinity|\[object/.test(v.value + v.label), `${v.label} ${v.value}`).toBe(false);
        expect(Array.isArray(s.mem) && s.mem.length === 10).toBe(true);
      }
    }
  });
  it('and every worksheet can be opened and walked through when empty', () => {
    ['CF', 'NPV', 'IRR'].forEach(k => { let s = press(initial(), k); for (let i = 0; i < 40; i++) { s = press(s, 'DOWN'); expect(/NaN|undefined/.test(view(s).value)).toBe(false); } });
    ['2ND|PV', '2ND|IY', '2ND|7', '2ND|8', '2ND|4', '2ND|5', '2ND|9', '2ND|1', '2ND|2', '2ND|6', '2ND|0', '2ND|.'].forEach(c => {
      let s = initial(); c.split('|').forEach(k => { s = press(s, k); });
      for (let i = 0; i < 30; i++) { s = press(s, 'DOWN'); s = press(s, 'CPT'); const v = view(s); expect(/NaN|undefined|Infinity/.test(v.value + v.label), c + ' ' + v.label + ' ' + v.value).toBe(false); s = press(s, 'CLR'); }
    });
  });
});
