/* Serverless function: GET /api/quote?symbol=AAPL
   Looks up a share price, trailing dividends and a five-year beta against the S&P 500 from Yahoo Finance's public chart data.
   It is an unofficial source and can stop working, so the page treats every failure as normal and says so plainly. */
import { computeStats, monthlyReturns, trailingDividends } from './_stats.js';

const HOST = 'https://query1.finance.yahoo.com/v8/finance/chart/';
const SYMBOL = /^[A-Za-z0-9.\-^]{1,12}$/;

async function chart(symbol, signal) {
  const url = `${HOST}${encodeURIComponent(symbol)}?range=5y&interval=1mo&events=div`;
  const res = await fetch(url, { signal, headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SmartWealthStudy/1.0)', Accept: 'application/json' } });
  if (!res.ok) throw new Error(`The data source answered ${res.status} for ${symbol}`);
  const body = await res.json(), r = body && body.chart && body.chart.result && body.chart.result[0];
  if (!r) throw new Error(`No data found for ${symbol}`);
  return r;
}

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  const symbol = String((req.query && req.query.symbol) || '').trim().toUpperCase();
  if (!SYMBOL.test(symbol)) { res.statusCode = 400; res.end(JSON.stringify({ error: 'Enter a ticker symbol such as AAPL or MSFT.' })); return; }
  const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 9000);
  try {
    const [s, m] = await Promise.all([chart(symbol, ctl.signal), chart('^GSPC', ctl.signal)]);
    const closes = s.indicators.quote[0].close, stock = monthlyReturns(s.timestamp || [], closes), market = monthlyReturns(m.timestamp || [], m.indicators.quote[0].close);
    const stats = computeStats(stock, market), meta = s.meta || {}, price = meta.regularMarketPrice, divs = trailingDividends(s.events && s.events.dividends, Math.floor(Date.now() / 1000));
    if (!Number.isFinite(price) || !stats) throw new Error(`Not enough price history for ${symbol}`);
    res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=3600');
    res.statusCode = 200;
    res.end(JSON.stringify({ symbol, name: meta.longName || meta.shortName || symbol, currency: meta.currency || 'USD', price, dividend: divs, dividendYield: price > 0 ? divs / price : 0, beta: stats.beta, vol: stats.vol, avgReturn: stats.avgReturn, cagr: stats.cagr, months: stats.months, asOf: new Date().toISOString(), source: 'Yahoo Finance (unofficial, delayed)' }));
  } catch (e) {
    res.statusCode = 502;
    res.end(JSON.stringify({ error: e && e.name === 'AbortError' ? 'The data source took too long. Try again in a moment.' : (e && e.message) || 'Could not load market data.' }));
  } finally { clearTimeout(timer); }
}
