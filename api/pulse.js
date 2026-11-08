/* Serverless function: a snapshot of the market for the "Market pulse" page.
     GET /api/pulse?market=us        -> indices, sector funds, risk gauges and big companies, with today's intraday lines (live while the US market is open)
     GET /api/pulse?market=pakistan  -> about 60 large Pakistani stocks at end of day, with 1-day, 5-day and 1-month changes
   Data comes from Yahoo Finance's public batch chart endpoint (unofficial, delayed). Pakistan data is end of day only: the Pakistan Stock Exchange does not
   allow its live data to be redistributed without a licence, so we do not use its portal. The student only chooses a market; every symbol is ours. */
import { route, pick, getJson, HttpError, cached } from './_http.js';
import { MARKETS, MARKET_IDS, BATCH, chunk, yahooSymbol, parseSpark, buildUs, buildPk } from './_pulse.js';

const HOST = 'https://query1.finance.yahoo.com/v8/finance/spark';
const KEEP_MS = { us: 45e3, pakistan: 10 * 60e3 };
const memo = new Map();

async function batch(symbols, market, signal) {
  const url = `${HOST}?symbols=${symbols.map(s => encodeURIComponent(yahooSymbol(s))).join(',')}&range=${market.range}&interval=${market.interval}`;
  try { return parseSpark(await getJson(url, { signal })); }
  catch (e) { if (e && e.name === 'AbortError') throw e; return {}; }
}

async function load(id, signal) {
  const market = MARKETS[id], parts = await Promise.all(chunk(market.symbols, BATCH).map(g => batch(g, market, signal)));
  const parsed = Object.assign({}, ...parts), built = id === 'us' ? buildUs(parsed) : buildPk(parsed);
  if (built.items.length < (id === 'us' ? 12 : 15)) throw new HttpError(502, 'The market data source is not answering right now. Try again in a moment.');
  return { market: id, tz: market.tz, granularity: market.granularity, count: built.items.length, requested: market.symbols.length, lastBar: built.lastBar, items: built.items, asOf: new Date().toISOString(), source: 'Yahoo Finance public chart data (delayed, unofficial)' };
}

export const resetCache = () => memo.clear();

export default route(async ({ q, signal }) => {
  const id = pick(q, 'market', { list: MARKET_IDS, say: 'Choose us or pakistan.' });
  const hit = memo.get(id), cc = id === 'us' ? 's-maxage=30, stale-while-revalidate=120' : 's-maxage=600, stale-while-revalidate=3600';
  if (hit && hit.data && Date.now() - hit.at < KEEP_MS[id]) return cached(hit.data, cc);
  const pending = hit && hit.pending ? hit.pending : load(id, signal).finally(() => { const m = memo.get(id); if (m) m.pending = null; });
  memo.set(id, { ...(hit || {}), pending });
  const data = await pending;
  memo.set(id, { at: Date.now(), data, pending: null });
  return cached(data, cc);
}, { timeout: 15000, allow: ['market'] });
