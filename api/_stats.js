/* Plain statistics for the quote endpoint. Kept free of network code so they can be tested. */

/** Month key such as "2024-03" from a unix timestamp in seconds. */
export const monthKey = ts => new Date(ts * 1000).toISOString().slice(0, 7);

/** Simple returns between consecutive monthly closes. Entries with a missing close are skipped. Returns [{ key, r }]. */
export function monthlyReturns(timestamps, closes) {
  const rows = [];
  for (let i = 0; i < timestamps.length; i++) if (Number.isFinite(closes[i]) && closes[i] > 0) rows.push({ key: monthKey(timestamps[i]), c: closes[i] });
  const out = [];
  for (let i = 1; i < rows.length; i++) out.push({ key: rows[i].key, r: rows[i].c / rows[i - 1].c - 1 });
  return out;
}

const mean = a => a.reduce((s, x) => s + x, 0) / a.length;
const variance = a => { const m = mean(a); return a.reduce((s, x) => s + (x - m) * (x - m), 0) / (a.length - 1); };

/** Beta, volatility and average return from two monthly return series, matched by month. Needs at least 12 shared months. */
export function computeStats(stock, market) {
  const byKey = new Map(market.map(m => [m.key, m.r])), pairs = stock.filter(s => byKey.has(s.key)).map(s => [s.r, byKey.get(s.key)]);
  if (pairs.length < 12) return null;
  const rs = pairs.map(p => p[0]), rm = pairs.map(p => p[1]), ms = mean(rs), mm = mean(rm);
  const cov = pairs.reduce((s, [a, b]) => s + (a - ms) * (b - mm), 0) / (pairs.length - 1), vm = variance(rm);
  const growth = rs.reduce((p, x) => p * (1 + x), 1);
  return { months: pairs.length, beta: vm > 0 ? cov / vm : null, vol: Math.sqrt(variance(rs) * 12), avgReturn: ms * 12, cagr: Math.pow(growth, 12 / pairs.length) - 1 };
}

/** Dividends paid in the last 12 months, from a Yahoo-style events object { id: { amount, date } }. */
export function trailingDividends(events, nowSeconds) {
  const cutoff = nowSeconds - 365 * 86400;
  return Object.values(events || {}).filter(e => e && e.date >= cutoff && Number.isFinite(e.amount)).reduce((s, e) => s + e.amount, 0);
}
