/** The full analysis of one company: six scored areas, a year-by-year cash flow review, facts found in the numbers and a verdict.
    It reads only the annual table from the SEC filings. It cannot see the share price, so it judges the business, not the price. */
import type { Statements } from './fin';
import { makeCtx, growthMetrics, profitMetrics, returnMetrics, cashMetrics, balanceMetrics, ownerMetrics, financialMetrics, groupScore, toneOf, isNum, tail, total, type Category, type Metric, type Tone, type Ctx } from './analysis-metrics';
import { factsFor } from './analysis-facts';
import { money } from './format';

export interface CashYear { year: string; cfo: number | null; capex: number | null; fcf: number | null; cfi: number | null; cff: number | null; returned: number | null; label: string; tone: Tone }
export interface Verdict { label: string; tone: Tone; score: number | null; headline: string; yes: string[]; no: string[]; bottom: string; blind: string[] }
export interface SplitPart { key: string; label: string; cents: number }
export interface Split { total: number; parts: SplitPart[]; over: number | null; note: string }
export interface Analysis { split: { all: Split | null; last: Split | null; allYears: string; lastYear: string }; name: string; kind: 'standard' | 'financial'; from: string; to: string; categories: Category[]; cashYears: CashYear[]; facts: string[]; verdict: Verdict }

const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const b = (t: string) => `<b>${t}</b>`;
/** The SEC writes many names in capitals. Shouting in a sentence reads badly, so they are set in normal capitals. */
export function niceName(name: string): string {
  const t = String(name || '').trim();
  if (!t || t !== t.toUpperCase()) return t;
  return t.toLowerCase().replace(/(^|[\s(\/-])([a-z])/g, (_, a, ch) => a + ch.toUpperCase()).replace(/\b(Llc|Lp|Plc|Nv|Sa|Ag)\b/g, m => m.toUpperCase());
}
const WEIGHT: Record<string, number> = { growth: 0.15, profit: 0.2, returns: 0.15, cash: 0.25, balance: 0.15, owners: 0.1 };

const cat = (key: string, label: string, blurb: string, metrics: Metric[]): Category => { const score = groupScore(metrics); return { key, label, blurb, score, tone: toneOf(score), metrics }; };

function categoriesFor(c: Ctx): Category[] {
  if (c.s.kind === 'financial') {
    const f = financialMetrics(c);
    return [cat('growth', 'Is it growing?', 'Getting bigger over time', f.growth), cat('profit', 'Is it profitable?', 'Profit for the money put in', f.profit), cat('owners', 'How does it treat owners?', 'Payouts and share count', f.owners)].filter(x => x.metrics.length);
  }
  return [
    cat('growth', 'Is it growing?', 'Getting bigger over time', growthMetrics(c)),
    cat('profit', 'Is it profitable?', 'How much of each sale it keeps', profitMetrics(c)),
    cat('returns', 'Does it use money well?', 'Profit for the money put in', returnMetrics(c)),
    cat('cash', 'Does it make real cash?', 'Profit that turns into cash', cashMetrics(c)),
    cat('balance', 'Could it survive a bad year?', 'Debt and savings', balanceMetrics(c)),
    cat('owners', 'How does it treat owners?', 'Payouts and share count', ownerMetrics(c))
  ].filter(x => x.metrics.length);
}

/** Names the pattern of one year from the three parts of the cash flow statement. */
export function pattern(cfo: number | null, cfi: number | null, cff: number | null, fcf: number | null): { label: string; tone: Tone } {
  if (isNum(cfo) && cfo <= 0) return { label: isNum(cff) && cff > 0 ? 'Burning cash, funded by outside money' : 'Operations used cash', tone: 'bad' };
  if (isNum(cfo) && isNum(cfi) && isNum(cff)) {
    if (cfi < 0 && cff < 0) return { label: 'Pays for itself, repays and pays out', tone: 'good' };
    if (cfi < 0 && cff > 0) return { label: 'Growing with outside money', tone: 'ok' };
    if (cfi >= 0 && cff < 0) return { label: 'Pays owners and lenders, helped by investments sold', tone: 'ok' };
    return { label: 'Cash is piling up', tone: 'ok' };
  }
  if (isNum(fcf)) return fcf >= 0 ? { label: 'Covers its own spending', tone: 'good' } : { label: 'Spends more than it earns', tone: 'warn' };
  return { label: 'Not enough data', tone: 'info' };
}

export function cashYears(c: Ctx): CashYear[] {
  const r = c.row;
  return c.s.periods.map((_, i) => { const cfo = r('cfo')[i], cfi = r('cfi')[i], cff = r('cff')[i], fcf = c.q.fcf[i], p = pattern(cfo, cfi, cff, fcf); return { year: c.years[i], cfo, capex: r('capex')[i], fcf, cfi, cff, returned: c.returned[i], ...p }; }).filter(y => isNum(y.cfo) || isNum(y.fcf));
}

/** Where each $1 of operating cash went, over the given years: equipment, owners (dividends and buybacks), other companies, and what is left. */
export function splitOf(c: Ctx, idx: number[]): Split | null {
  const sum = (k: string) => total(idx.map(i => c.row(k)[i])), cfo = sum('cfo');
  if (!isNum(cfo) || cfo <= 0) return null;
  const spec: [string, string][] = [['capex', 'Equipment and buildings'], ['dividends', 'Dividends'], ['buybacks', 'Share buybacks'], ['acquisitions', 'Buying other companies']];
  const parts: SplitPart[] = spec.map(([key, label]) => ({ key, label, cents: (sum(key) ?? 0) / cfo })).filter(p => p.cents >= 0.005);
  const used = parts.reduce((a, p) => a + p.cents, 0), left = 1 - used;
  if (left >= 0.005) parts.push({ key: 'left', label: 'Left over', cents: left });
  const over = left < -0.005 ? -left : null;
  return { total: cfo, parts, over, note: over != null ? `It spent ${Math.round(over * 100)} cents more than its business brought in, so the extra came from savings or new borrowing.` : 'What is left over stays as savings or is used to repay debt.' };
}

/** Facts that cap how good the verdict can be, however good the average is. */
function redFlags(c: Ctx): { text: string; severe: boolean }[] {
  const out: { text: string; severe: boolean }[] = [], i = c.n - 1, ni = c.row('netIncome')[i], cfo = c.row('cfo')[i], fcf = tail(c.q.fcf, 5).filter(isNum), eq = c.row('equity')[i];
  if (isNum(ni) && ni < 0) out.push({ text: `It lost ${b(money(Math.abs(ni)))} in the latest year.`, severe: isNum(cfo) && cfo < 0 });
  const neg = fcf.filter(v => v < 0).length;
  if (fcf.length >= 3 && neg >= 3) out.push({ text: `Free cash flow was negative in ${b(neg + ' of the last ' + fcf.length + ' years')}, so it has not paid for its own spending.`, severe: true });
  const cover = c.q.interestCover[i]; if (isNum(cover) && cover < 1.5) out.push({ text: cover < 0 ? 'The business made an operating loss, so it did not earn enough to pay its interest.' : `Operating profit covers interest only ${b(cover.toFixed(1) + ' times')}, which leaves little room for a bad year.`, severe: cover < 1 });
  if (isNum(eq) && eq < 0) out.push({ text: `Owners\' equity is negative (${b(money(eq))}). Losses or buybacks have used up the owners\' stake.`, severe: false });
  return out;
}

function overall(cats: Category[]): number | null {
  const parts = cats.filter(x => x.score != null), wsum = parts.reduce((a, x) => a + (WEIGHT[x.key] ?? 0.1), 0);
  return parts.length >= 2 && wsum > 0 ? Math.round(parts.reduce((a, x) => a + (x.score as number) * (WEIGHT[x.key] ?? 0.1), 0) / wsum) : null;
}

function label(score: number | null, capped: boolean): { label: string; tone: Tone } {
  if (score == null) return { label: 'Not enough data to judge', tone: 'info' };
  const base = score >= 75 ? { label: 'A strong business', tone: 'good' as Tone } : score >= 58 ? { label: 'A good business with some weak spots', tone: 'ok' as Tone } : score >= 45 ? { label: 'A mixed picture', tone: 'warn' as Tone } : score >= 30 ? { label: 'A weak business', tone: 'bad' as Tone } : { label: 'A poor business', tone: 'bad' as Tone };
  return capped && score >= 45 ? { label: 'A mixed picture', tone: 'warn' } : base;
}

const BLIND = [
  'The share price. Even a great business is a poor investment if you pay too much. Use the DCF and peer calculators above to test a price.',
  'The future. Everything here is from past annual reports, and the latest quarters are not included.',
  'Competition and change. A strong record can end when a rival, a new rule or a new technology arrives.',
  'One-off items. A big sale of assets, a legal payment or a change in accounting can distort a single year.',
  'The business model. A company with a finance arm, such as a carmaker that lends to buyers, can show far more debt and interest than its main business alone would need.'
];

function reasons(cats: Category[]): { yes: Metric[]; no: Metric[] } {
  const all = cats.flatMap(x => x.metrics).filter(m => m.score != null);
  const sorted = [...all].sort((a, z) => (z.score as number) - (a.score as number));
  return { yes: sorted.filter(m => (m.score as number) >= 75 && m.say).slice(0, 3), no: [...sorted].reverse().filter(m => (m.score as number) < 60 && m.say).slice(0, 3) };
}
const line = (m: Metric) => (m.say ? `${b(m.say)}` : `${b(m.label + ': ' + m.shown)}.`);

/** Two or three sentences that pull the whole analysis together. */
function bottomLine(cats: Category[], tone: Tone, score: number | null, capped: boolean): string {
  const scored = cats.filter(x => x.score != null).sort((a, z) => (z.score as number) - (a.score as number));
  if (score == null || scored.length < 2) return 'There is not enough data in the filings to reach a fair view. Read the filing itself before deciding anything.';
  const top = scored[0], low = scored[scored.length - 1], areas = `Its best area is ${b(top.blurb.toLowerCase())} (${b(String(top.score))}/100). Its weakest is ${b(low.blurb.toLowerCase())} (${b(String(low.score))}/100).`;
  const view = capped ? 'There is at least one serious warning sign, so you would need a clear reason to believe things will improve.' : tone === 'good' ? 'It grows, earns well and turns profit into cash. That is what long-term investors look for.' : tone === 'ok' ? 'It has real strengths and some weak spots. It could suit someone who accepts those risks.' : tone === 'warn' ? 'Some numbers are good and some are worrying. You would need a clear reason to believe the weak areas will improve.' : 'The business struggles. Without a strong reason to expect a turnaround, the record gives little support for investing.';
  return `${view} ${areas} A good business can still be a poor investment if the price is too high, and this check does not know the price.`;
}

function verdictFor(c: Ctx, cats: Category[], name: string): Verdict {
  const score = overall(cats), flags = redFlags(c), capped = flags.some(f => f.severe), v = label(score, capped), { yes, no } = reasons(cats);
  const nm = esc(name || 'The company'), financial = c.s.kind === 'financial';
  const headline = score == null ? `There is too little data to judge ${nm} fairly.` : `${nm} looks like ${b(v.label.charAt(0).toLowerCase() + v.label.slice(1))}. Its score is ${b(score + ' out of 100')}.${capped ? ' One serious warning sign holds the verdict back.' : ''}${financial ? ' Banks and insurers get a lighter check, with fewer measures.' : ''}`;
  return { ...v, score, headline, yes: yes.map(line), no: [...flags.map(f => f.text), ...no.map(line)].slice(0, Math.max(3, flags.length)), bottom: bottomLine(cats, v.tone, score, capped), blind: BLIND };
}

/** The whole analysis. Returns null when there are fewer than three years of profit numbers to work with. */
export function analyse(s: Statements, name: string): Analysis | null {
  if (!s || !Array.isArray(s.periods) || s.periods.length < 3 || (s.rows.netIncome || []).filter(isNum).length < 3) return null;
  const c = makeCtx(s), cats = categoriesFor(c), n = c.n, nm = niceName(name), withCfo = c.s.periods.map((_, i) => i).filter(i => isNum(c.row('cfo')[i])), std = s.kind === 'standard';
  return { split: { all: std ? splitOf(c, withCfo) : null, last: std && withCfo.includes(n - 1) ? splitOf(c, [n - 1]) : null, allYears: withCfo.length ? `${c.years[withCfo[0]]} to ${c.years[withCfo[withCfo.length - 1]]}` : '', lastYear: c.years[n - 1] }, name: nm, kind: s.kind, from: c.years[0], to: c.years[n - 1], categories: cats, cashYears: s.kind === 'standard' ? cashYears(c) : [], facts: factsFor(c, nm), verdict: verdictFor(c, cats, nm) };
}

