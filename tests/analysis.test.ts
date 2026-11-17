import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import type { Statements } from '../src/lib/fin';
import { analyse, pattern, niceName } from '../src/lib/analysis';
import { grade, toneOf, mean, total } from '../src/lib/analysis-metrics';

/** Real annual figures taken from the SEC filings through /api/edgar. */
const live = (t: string): Statements & { name: string } => JSON.parse(readFileSync(new URL(`./fixtures/live-${t}.json`, import.meta.url), 'utf8'));
const run = (t: string) => { const d = live(t); return analyse(d, d.name)!; };
const years = (n: number) => Array.from({ length: n }, (_, i) => ({ end: `${2015 + i}-12-31` }));
const mk = (rows: Record<string, (number | null)[]>, n = 6, kind: any = 'standard'): Statements => ({ kind, periods: years(n), rows });
const everyText = (a: NonNullable<ReturnType<typeof analyse>>) => [a.verdict.headline, a.verdict.bottom, ...a.verdict.yes, ...a.verdict.no, ...a.facts, ...a.categories.flatMap(c => c.metrics.flatMap(m => [m.shown, m.what, m.read]))].join('\n');

describe('grade', () => {
  it('maps weak, fair and strong marks to 25, 60 and 90', () => {
    expect(grade(0, [0, 0.04, 0.1])).toBe(25); expect(grade(0.04, [0, 0.04, 0.1])).toBe(60); expect(grade(0.1, [0, 0.04, 0.1])).toBe(90);
  });
  it('rises with the value, stays between 0 and 100, and flips when lower is better', () => {
    let last = -1; for (let v = -0.2; v <= 0.3; v += 0.01) { const g = grade(v, [0, 0.04, 0.1]); expect(g).toBeGreaterThanOrEqual(last); expect(g).toBeGreaterThanOrEqual(0); expect(g).toBeLessThanOrEqual(100); last = g; }
    expect(grade(1, [4, 2.5, 1], true)).toBe(90); expect(grade(0, [4, 2.5, 1], true)).toBeGreaterThan(90); expect(grade(8, [4, 2.5, 1], true)).toBe(0);
  });
  it('names the tone from the score', () => { expect([toneOf(80), toneOf(60), toneOf(40), toneOf(10), toneOf(null)]).toEqual(['good', 'ok', 'warn', 'bad', 'info']); });
  it('averages and sums only real numbers', () => { expect(mean([1, null, 3, NaN])).toBe(2); expect(total([null, null])).toBeNull(); expect(total([2, 3])).toBe(5); });
});

describe('cash flow pattern', () => {
  it('reads the signs of the three parts', () => {
    expect(pattern(10, -5, -4, 5)).toMatchObject({ tone: 'good' }); expect(pattern(10, -5, 4, 5)).toMatchObject({ tone: 'ok', label: expect.stringContaining('outside money') });
    expect(pattern(-3, -5, 8, -8)).toMatchObject({ tone: 'bad', label: expect.stringContaining('Burning') }); expect(pattern(10, 2, -4, 5)).toMatchObject({ tone: 'ok' });
  });
  it('falls back to free cash flow, then to nothing', () => {
    expect(pattern(10, null, null, 4).tone).toBe('good'); expect(pattern(null, null, null, -2).tone).toBe('warn'); expect(pattern(null, null, null, null).tone).toBe('info');
  });
});

describe('company names', () => {
  it('sets all-capital names in normal capitals and leaves other names alone', () => {
    expect(niceName('MICROSOFT CORP')).toBe('Microsoft Corp'); expect(niceName('Apple Inc.')).toBe('Apple Inc.'); expect(niceName('')).toBe('');
  });
});

describe('full analysis, real companies', () => {
  it('rates Apple as a strong business with six areas and ten years of cash flow', () => {
    const a = run('AAPL');
    expect(a.verdict.tone).toBe('good'); expect(a.verdict.score).toBeGreaterThanOrEqual(75); expect(a.categories.map(c => c.key)).toEqual(['growth', 'profit', 'returns', 'cash', 'balance', 'owners']);
    expect(a.cashYears).toHaveLength(10); expect(a.facts.length).toBeGreaterThanOrEqual(8); expect(a.verdict.yes.length).toBeGreaterThan(2);
    expect(a.facts.join(' ')).toContain('free cash'); expect(a.verdict.yes.length).toBeLessThanOrEqual(3); expect(a.verdict.yes.join(' ')).not.toMatch(/divided by|ratio/i); expect(a.from).toBe('2017'); expect(a.to).toBe('2026');
  });
  it('does not call Ford strong, and says it lost money', () => {
    const a = run('F');
    expect(a.verdict.tone).not.toBe('good'); expect(a.verdict.no.join(' ')).toMatch(/lost/); expect(a.verdict.headline).toContain('Ford');
  });
  it('holds a company with repeated negative free cash flow back from a good verdict', () => {
    const a = run('PTON');
    expect(['warn', 'bad']).toContain(a.verdict.tone); expect(a.verdict.no.join(' ')).toMatch(/negative in/); expect(a.verdict.headline).toContain('serious warning');
  });
  it('judges a bank on fewer measures, with revenue instead of sales and no cash flow table', () => {
    const a = run('JPM');
    expect(a.categories.length).toBeLessThanOrEqual(3); expect(a.cashYears).toEqual([]); expect(a.verdict.headline).toContain('lighter check');
    expect(a.facts.join(' ')).not.toMatch(/\bsales\b/); expect(a.name).toBe('Jpmorgan Chase & Co');
  });
  it('orders the companies sensibly: strong tech above a carmaker and a loss-maker', () => {
    expect(run('MSFT').verdict.score!).toBeGreaterThan(run('WMT').verdict.score!); expect(run('WMT').verdict.score!).toBeGreaterThan(run('F').verdict.score!); expect(run('KO').verdict.score!).toBeGreaterThan(run('F').verdict.score!);
  });
  it('never prints NaN, undefined, null or Infinity, for any company', () => {
    for (const t of ['AAPL', 'MSFT', 'F', 'WMT', 'TSLA', 'JPM', 'PTON', 'KO']) expect(everyText(run(t)), t).not.toMatch(/NaN|undefined|null|Infinity/);
  });
  it('gives every score between 0 and 100 and every metric a number', () => {
    for (const t of ['AAPL', 'F', 'TSLA', 'PTON', 'JPM']) for (const c of run(t).categories) for (const m of c.metrics) { expect(Number.isFinite(m.value)).toBe(true); if (m.score != null) { expect(m.score).toBeGreaterThanOrEqual(0); expect(m.score).toBeLessThanOrEqual(100); } }
  });
  it('is repeatable and does not change its input', () => {
    const d = live('KO'), before = JSON.stringify(d); const x = analyse(d, d.name), y = analyse(d, d.name);
    expect(JSON.stringify(x)).toBe(JSON.stringify(y)); expect(JSON.stringify(d)).toBe(before);
  });
});

describe('visual helpers: cash split and trend lines', () => {
  it('splits each $1 of Apple\'s operating cash into parts that add up to a dollar or flag overspending', () => {
    const a = run('AAPL'), s = a.split.all!;
    expect(s).not.toBeNull(); expect(s.parts.every(p => p.cents > 0)).toBe(true);
    const sum = s.parts.reduce((x, p) => x + p.cents, 0); if (s.over == null) expect(sum).toBeCloseTo(1, 6); else expect(sum).toBeCloseTo(1 + s.over, 6);
    expect(s.parts.map(p => p.key)).toContain('buybacks'); expect(a.split.allYears).toBe('2017 to 2026'); expect(a.split.last).not.toBeNull();
  });
  it('says so when a company paid out more than its business brought in', () => {
    const a = run('KO').split.all!; expect(a.over).not.toBeNull(); expect(a.note).toMatch(/more than its business brought in/);
  });
  it('has no split for banks or for a business whose operations used cash', () => {
    expect(run('JPM').split.all).toBeNull(); expect(analyse(mk({ revenue: [9, 8, 7, 6, 5, 4], netIncome: [-1, -2, -3, -4, -5, -6], cfo: [-1, -1, -1, -1, -1, -1] }), 'Loss Co')!.split.all).toBeNull();
  });
  it('gives the ratios that move through the years a trend line as long as the table', () => {
    const a = run('AAPL'), m = a.categories.flatMap(c => c.metrics).find(x => x.key === 'op')!;
    expect(m.trend).toHaveLength(10); expect(m.trend!.every(v => v == null || Number.isFinite(v))).toBe(true);
    expect(a.categories.flatMap(c => c.metrics).find(x => x.key === 'salesCagr')!.trend).toBeNull();
  });
  it('gives every scored ratio a one-line plain sentence', () => {
    for (const t of ['AAPL', 'F', 'KO']) for (const c of run(t).categories) for (const m of c.metrics) if (m.score != null) expect(m.say.length, t + m.key).toBeGreaterThan(10);
  });
});

describe('full analysis, thin and odd data', () => {
  it('needs three years of profit figures', () => {
    expect(analyse(mk({ revenue: [1, 2], netIncome: [1, 1] }, 2), 'X')).toBeNull(); expect(analyse(mk({ revenue: [1, 2, 3, 4], netIncome: [1, null, null, null] }, 4), 'X')).toBeNull(); expect(analyse(null as any, 'X')).toBeNull();
  });
  it('still works with only sales and profit, and says what it cannot judge', () => {
    const a = analyse(mk({ revenue: [100, 110, 120, 130, 140, 150], netIncome: [10, 11, 12, 13, 14, 15] }), 'Tiny Co')!;
    expect(a).not.toBeNull(); expect(everyText(a)).not.toMatch(/NaN|undefined|null|Infinity/); expect(a.verdict.blind.length).toBeGreaterThan(2);
  });
  it('gives no verdict when too few areas can be scored', () => {
    const a = analyse(mk({ netIncome: [1, 2, 3, 4, 5, 6] }), 'Bare Co')!;
    expect(a.verdict.score).toBeNull(); expect(a.verdict.label).toContain('Not enough'); expect(a.verdict.bottom).toContain('not enough data');
  });
  it('escapes the company name in every sentence', () => {
    const a = analyse(mk({ revenue: [100, 110, 120, 130, 140, 150], netIncome: [10, 11, 12, 13, 14, 15], operatingIncome: [12, 13, 14, 15, 16, 17], cfo: [12, 13, 14, 15, 16, 17], capex: [2, 2, 2, 2, 2, 2] }), '<img src=x onerror=alert(1)>')!;
    expect(everyText(a)).not.toContain('<img'); expect(everyText(a)).toContain('&lt;img');
  });
  it('treats a company that burns cash and borrows as a poor business', () => {
    const a = analyse(mk({ revenue: [100, 90, 80, 70, 60, 50], netIncome: [-5, -10, -20, -30, -40, -50], operatingIncome: [-4, -9, -19, -29, -39, -49], cfo: [-3, -6, -9, -12, -15, -18], capex: [1, 1, 1, 1, 1, 1], cff: [5, 8, 11, 14, 17, 20], cfi: [-2, -2, -2, -2, -2, -2], assets: [100, 90, 80, 70, 60, 50], equity: [50, 40, 30, 20, 10, 5], debt: [30, 40, 50, 60, 70, 80], cash: [10, 8, 6, 4, 2, 1] }), 'Sinking Co')!;
    expect(['bad', 'warn']).toContain(a.verdict.tone); expect(a.cashYears.every(y => y.tone === 'bad')).toBe(true); expect(a.verdict.no.join(' ')).toMatch(/lost/);
  });
});
