import { describe, expect, it } from 'vitest';
import { hbars } from '../src/ui/visuals.js';
import { toCsv } from '../src/ui/sharing.js';
import '../src/modules/m9.js';
import { MODS } from '../src/lib/registry';

const HOSTILE = '<img src=x onerror=alert(1)>';
describe('untrusted text never becomes markup', () => {
  it('escapes bar labels and values', () => {
    const html = hbars([{ label: HOSTILE, from: 0, to: 5, color: 'c1', text: HOSTILE }]);
    expect(html).not.toContain('<img'); expect(html).toContain('&lt;img');
  });
  it('keeps hostile factor names out of the factor-model chart html', () => {
    const m = MODS.find(x => x.id === 'factors')!, v = { ...Object.fromEntries(m.fields.map(f => [f.id, f.v])), names: HOSTILE + ', Size', prem: '5, 2', beta: '1, 0.5' };
    const out: any = m.calc(v), html = out.charts.map((c: any) => c.html || '').join('');
    expect(html).not.toContain('<img'); expect(html).toContain('&lt;img');
  });
  it('neutralises spreadsheet formulas in CSV cells but leaves real numbers alone', () => {
    const csv = toCsv('T', [['Name', '=HYPERLINK("http://evil","x")'], ['Name2', '@SUM(A1)'], ['Neg', '-$1,200.50'], ['Pct', '+2.5%'], ['Days', '56.3 days'], ['Minus', '−4.2%']], { cards: [] });
    expect(csv).toContain("\"'=HYPERLINK"); expect(csv).toContain("'@SUM(A1)");
    expect(csv).toContain('Neg,"-$1,200.50"'); expect(csv).toContain('Pct,+2.5%'); expect(csv).toContain('Days,56.3 days'); expect(csv).toContain('Minus,−4.2%');
  });
});
