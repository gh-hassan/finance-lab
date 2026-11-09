/* Monthly history of large Pakistani stocks, turned into one equal-mix index in rupees and in US dollars. Pure functions, so tests can feed them Yahoo-shaped data. */

/** Thirteen big, long-listed companies with dividend-adjusted monthly prices back to 2008. */
export const PK_SYMBOLS = ['OGDC', 'LUCK', 'FFC', 'MCB', 'UBL', 'PPL', 'PSO', 'HBL', 'MEBL', 'NBP', 'POL', 'DGKC', 'MARI'];

/** Pairs [YYYYMM, adjusted close] from one Yahoo chart answer (monthly bars). Bars without a price are dropped; bars are labelled by their month in the exchange's local time. */
export function parseBars(j) {
  const r = j && j.chart && j.chart.result && j.chart.result[0];
  if (!r || !Array.isArray(r.timestamp)) return [];
  const q = r.indicators && r.indicators;
  const px = (q && q.adjclose && q.adjclose[0] && q.adjclose[0].adjclose) || (q && q.quote && q.quote[0] && q.quote[0].close) || [];
  const off = Number(r.meta && r.meta.gmtoffset) || 0, out = new Map();
  r.timestamp.forEach((t, i) => {
    const v = px[i];
    if (typeof t !== 'number' || typeof v !== 'number' || !Number.isFinite(v) || v <= 0) return;
    const d = new Date((t + off) * 1000);
    out.set(d.getUTCFullYear() * 100 + d.getUTCMonth() + 1, v);
  });
  return [...out].sort((a, b) => a[0] - b[0]);
}

const prev = m => (m % 100 === 1 ? (Math.floor(m / 100) - 1) * 100 + 12 : m - 1);

/** Month-by-month returns (fractions) from bars, only for months whose previous month is also present. */
export function monthlyReturns(bars) {
  const px = new Map(bars), out = new Map();
  for (const [m, v] of bars) { const p = px.get(prev(m)); if (p) out.set(m, v / p - 1); }
  return out;
}

/** The equal-mix index: each month, the average return of every stock that has one. `fx` is rupees per dollar by month; the dollar return divides out the rupee's fall.
 *  Months need at least `minStocks` stocks. Returns { months, pkr, usd } with percent returns. */
export function buildIndex(stockBars, fxBars, minStocks = 5) {
  const rets = stockBars.map(monthlyReturns).filter(m => m.size), fx = new Map(fxBars);
  const months = [...new Set(rets.flatMap(m => [...m.keys()]))].sort((a, b) => a - b);
  const out = { months: [], pkr: [], usd: [] };
  for (const m of months) {
    const vals = rets.map(r => r.get(m)).filter(v => v != null && Number.isFinite(v) && v > -0.9 && v < 3);
    const a = fx.get(m), b = fx.get(prev(m));
    if (vals.length < minStocks || !a || !b) continue;
    const r = vals.reduce((x, y) => x + y, 0) / vals.length;
    out.months.push(m); out.pkr.push(Math.round(r * 1e6) / 1e4); out.usd.push(Math.round(((1 + r) * (b / a) - 1) * 1e6) / 1e4);
  }
  return out;
}
