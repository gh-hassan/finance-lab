// @ts-nocheck
/* Small helpers shared by the live currency and crypto pages: a session cache, and chart axes for time measured in days. */
import { longDate, monthYear } from '../lib/format';

const store = new Map();
/** Returns a cached value if it is younger than `ttlMs`, otherwise runs `load()` and keeps the result for the session. Failures are never kept. */
export async function memo(key, ttlMs, load) {
  const hit = store.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return hit.value;
  const value = await load();
  store.set(key, { at: Date.now(), value });
  return value;
}

const DAY = 864e5, MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const group = s => s.replace(/\B(?=(\d{3})+(?!\d))/g, ',');

/** Axis labels for a chart whose x values are days since `startMs`. Short spans show "8 Nov", medium ones "Nov ’26", long ones the year.
    Hovering reads the full date, with the hour when `withTime` is set. Spread into a chart spec. */
export function dayAxis(startMs, spanDays, withTime = false) {
  const at = d => new Date(startMs + d * DAY), iso = d => at(d).toISOString().slice(0, 10);
  const xFmt = v => {
    if (spanDays <= 200) { const t = at(v); return `${t.getUTCDate()} ${MON[t.getUTCMonth()]}`; }
    return spanDays <= 2200 ? monthYear(iso(v)).replace(/ 20/, ' ’') : String(at(v).getUTCFullYear());
  };
  const xRead = v => (withTime ? `${longDate(iso(v))}, ${String(at(v).getUTCHours()).padStart(2, '0')}:00 UTC` : longDate(iso(v)));
  return { xFmt, xRead };
}

/** A y-axis tick without float noise: 0.8800000000000001 becomes "0.88", 18100 becomes "18,100". */
export const tick = v => { const s = String(+Number(v).toFixed(6)), [w, f] = s.replace('-', '').split('.'); return (v < 0 ? '−' : '') + group(w) + (f ? '.' + f : ''); };
