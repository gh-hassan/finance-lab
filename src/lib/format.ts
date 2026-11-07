/** Number and date formatting for the data pages. Pure and locale independent, so the same input always prints the same text. */

const MINUS = '−';
const finite = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Adds thousands commas to the whole-number part only. */
const group = (s: string) => { const [i, f] = s.split('.'); return i.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (f !== undefined ? '.' + f : ''); };

/** 1234567 becomes "1.2M". Rounding that reaches the next unit moves up (999,950 is "1.0M", not "1000.0K"). */
export function compact(x: number, d = 1): string {
  const units: [number, string][] = [[1e12, 'T'], [1e9, 'B'], [1e6, 'M'], [1e3, 'K']], a = Math.abs(x);
  for (let i = 0; i < units.length; i++) {
    const [div, suf] = units[i];
    if (a >= div) {
      let v = a / div, txt = v.toFixed(v >= 100 ? 0 : d);
      if (parseFloat(txt) >= 1000 && i > 0) { const [d2, s2] = units[i - 1]; v = a / d2; txt = v.toFixed(v >= 100 ? 0 : d); return (x < 0 ? MINUS : '') + txt + s2; }
      return (x < 0 ? MINUS : '') + txt + suf;
    }
  }
  return (x < 0 ? MINUS : '') + group(a.toFixed(a >= 100 ? 0 : 2).replace(/\.00$/, ''));
}

export function money(x: number | null | undefined, o: { d?: number; sym?: string } = {}): string {
  if (!finite(x)) return '—';
  const a = Math.abs(x), sym = o.sym ?? '$';
  /* an explicit number of decimals is honoured for amounts under 1,000 (share prices, earnings per share) */
  const body = o.d !== undefined && a < 1000 ? group(a.toFixed(o.d)) : compact(a, o.d ?? 1);
  return (x < 0 && /[1-9]/.test(body) ? MINUS : '') + sym + body;
}
export const pct = (x: number | null | undefined, d = 1): string => (finite(x) ? (x < 0 && Math.abs(x) * 100 >= 0.5 * 10 ** -d ? MINUS : '') + Math.abs(x * 100).toFixed(d) + '%' : '—');
export const signedPct = (x: number | null | undefined, d = 1): string => (finite(x) ? (x > 0 && x * 100 >= 0.5 * 10 ** -d ? '+' : '') + pct(x, d) : '—');
export const mult = (x: number | null | undefined, d = 1): string => (finite(x) ? (x < 0 ? MINUS : '') + Math.abs(x).toFixed(d) + '×' : '—');
export const num = (x: number | null | undefined, d = 0): string => (finite(x) ? (x < 0 && Math.abs(x) >= 0.5 * 10 ** -d ? MINUS : '') + group(Math.abs(x).toFixed(d)) : '—');

const parse = (iso: string): [number, number, number] | null => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso)); if (!m) return null; const mo = +m[2], d = +m[3]; return mo >= 1 && mo <= 12 && d >= 1 && d <= 31 ? [+m[1], mo, d] : null; };
/** "2026-09-26" becomes "Sep 2026". */
export const monthYear = (iso: string): string => { const p = parse(iso); return p ? `${MONTHS[p[1] - 1]} ${p[0]}` : '—'; };
/** "2026-09-26" becomes "26 Sep 2026". */
export const longDate = (iso: string): string => { const p = parse(iso); return p ? `${p[2]} ${MONTHS[p[1] - 1]} ${p[0]}` : '—'; };
/** "2026-09-26" becomes "’26". */
export const yy = (iso: string): string => { const p = parse(iso); return p ? '’' + String(p[0]).slice(2) : ''; };
