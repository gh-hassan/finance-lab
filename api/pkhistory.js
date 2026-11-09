/* Serverless function: GET /api/pkhistory
   Monthly returns, since 2008, of an equal mix of 13 large Pakistani stocks, in rupees and in US dollars. Built from Yahoo Finance's dividend-adjusted monthly prices.
   No query values. Only fixed symbols are requested. */
import { route, getJson, HttpError } from './_http.js';
import { PK_SYMBOLS, parseBars, buildIndex } from './_pkhistory.js';

const URL = s => `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(s)}?range=max&interval=1mo&events=div`;
const PKR_FX = 'PKR=X';
const DAY = 12 * 3600e3;
let memo = { at: 0, data: null };
export const resetCache = () => { memo = { at: 0, data: null }; };

export default route(async ({ signal }) => {
  if (memo.data && Date.now() - memo.at < DAY) return memo.data;
  const [fx, ...stocks] = await Promise.all([PKR_FX, ...PK_SYMBOLS.map(s => s + '.KA')].map(s => getJson(URL(s), { signal }).then(parseBars).catch(e => { if (e && e.name === 'AbortError') throw e; return []; })));
  const used = stocks.filter(b => b.length > 24);
  if (used.length < 8 || fx.length < 24) throw new HttpError(502, 'The Pakistan price history could not be loaded. Try again in a moment.');
  const idx = buildIndex(used, fx);
  if (idx.months.length < 60) throw new HttpError(502, 'The Pakistan price history looked incomplete. Try again later.');
  memo = { at: Date.now(), data: { ...idx, stocks: used.length, source: 'Yahoo Finance, dividend-adjusted monthly prices (unofficial)', note: 'An equal mix of 13 large companies that are listed today, so it flatters the result.' } };
  return memo.data;
}, { timeout: 20000, cache: 's-maxage=43200, stale-while-revalidate=604800' });

