import { describe, expect, it } from 'vitest';
import { reportHtml, reportDate } from '../src/lib/reporthtml';
import { MODS } from '../src/lib/registry';
import '../src/modules/m1';
import '../src/modules/m2';
import '../src/modules/m3';
import '../src/modules/m4';
import '../src/modules/m5';
import '../src/modules/m6';
import '../src/modules/m7';
import '../src/modules/m8';
import '../src/modules/m9';

const day = new Date(2026, 10, 17);
const base = { title: 'Loan Payments', topic: 'Foundations', blurb: 'Your payment.', key: { label: 'Payment each period', value: '$1,580.17', sub: '12 per year', key: true }, inputs: [['Loan amount', '$250,000'], ['Rate', '6.5%']] as [string, string][], out: { cards: [{ label: 'Payment each period', value: '$1,580.17', key: true }, { head: 'Totals' }, { label: 'Total interest', value: '$318,861.22', sub: '127.5% of the loan', tone: 'bad' }], steps: [['Level payment', 'PMT = L·i ÷ [1 − (1+i)^−N]']] as [string, string][], tables: [{ title: 'Schedule', cols: ['#', 'Payment'], rows: [['1', '$1,580.17'], { h: 'Year 2' }, ['13', '$1,580.17']] }] }, assume: ['Rates stay the same.'] };

describe('printed report', () => {
  it('is laid out as a structured document with the answer, figures, inputs, working, tables and assumptions', () => {
    const h = reportHtml(base, day);
    for (const part of ['rp-head', 'rp-titlebox', 'rp-result', 'Key figures', 'The numbers used', 'How the answer was worked out', 'Schedule', 'What this calculation assumes', 'rp-foot']) expect(h, part).toContain(part);
    expect(h).toContain('17 Nov 2026'); expect(h).toContain('$1,580.17'); expect(h).toContain('Loan amount'); expect(h).toContain('class="gh"'); expect(h).toContain('Totals');
  });
  it('has no sliders, inputs, buttons or scripts', () => { expect(reportHtml(base, day)).not.toMatch(/<(input|button|script|select|textarea)\b/i); });
  it('does not repeat the headline figure among the key figures', () => {
    const h = reportHtml(base, day), tiles = h.slice(h.indexOf('Key figures')); expect(tiles).not.toContain('<span>Payment each period</span>'); expect(tiles).toContain('Total interest');
  });
  it('uses the plain sentence under the answer when there is one, otherwise the card note', () => {
    expect(reportHtml({ ...base, headline: 'You pay about $1,580 a month.' }, day)).toContain('You pay about $1,580 a month.'); expect(reportHtml(base, day)).toContain('12 per year');
  });
  it('escapes everything it prints', () => {
    const h = reportHtml({ ...base, title: '<img src=x onerror=alert(1)>', inputs: [['<b>x</b>', '"quoted"']], out: { ...base.out, note: '<script>1</script>' } }, day);
    expect(h).not.toContain('<img'); expect(h).not.toContain('<script'); expect(h).toContain('&lt;img'); expect(h).toContain('&quot;quoted&quot;');
  });
  it('keeps short tables on one page and lets long ones run on', () => {
    const rows = (n: number) => Array.from({ length: n }, (_, i) => [String(i), 'x']);
    expect(reportHtml({ ...base, out: { cards: base.out.cards, tables: [{ title: 'A', cols: ['a', 'b'], rows: rows(10) }] } }, day)).toContain('rp-tbl keep');
    expect(reportHtml({ ...base, out: { cards: base.out.cards, tables: [{ title: 'A', cols: ['a', 'b'], rows: rows(60) }] } }, day)).not.toContain('keep');
  });
  it('copes with a result that has nothing in it', () => {
    const h = reportHtml({ title: 'Empty' }, day); expect(h).toContain('Empty'); expect(h).not.toMatch(/undefined|NaN|null/);
  });
  it('formats the date plainly', () => { expect(reportDate(new Date(2026, 0, 5))).toBe('5 Jan 2026'); });
  it('builds a clean report for every calculator, using its default numbers', () => {
    expect(MODS.length).toBeGreaterThan(30);
    for (const m of MODS) {
      const v = Object.fromEntries(m.fields.map(f => [f.id, f.v])), out = m.calc(v) as any;
      const h = reportHtml({ title: m.title, blurb: m.blurb, out, key: (out.cards || []).find((c: any) => c.key) || (out.cards || []).find((c: any) => !c.head), inputs: m.fields.map(f => [f.label, String(f.v)]) }, day);
      expect(h, m.id).toContain('rp-result'); expect(h, m.id).not.toMatch(/undefined|NaN|\[object|<(input|button|script)/);
    }
  });
});
