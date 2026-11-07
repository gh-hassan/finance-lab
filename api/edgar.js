/* Serverless function: company financial statements from the US SEC's free EDGAR data.
     GET /api/edgar?find=app      -> up to 8 companies whose ticker or name matches
     GET /api/edgar?ticker=AAPL   -> ten years of annual figures taken from the company's 10-K filings
   The student only ever supplies a ticker or a few letters. The hosts we call are fixed. */
import { route, pick, getJson, HttpError, cached } from './_http.js';
import { parseFacts, findCompanies } from './_edgar.js';

const TICKERS = 'https://www.sec.gov/files/company_tickers.json';
const FACTS = cik => `https://data.sec.gov/api/xbrl/companyfacts/CIK${String(cik).padStart(10, '0')}.json`;
const HOURS = 6 * 3600e3;
let listCache = { at: 0, data: null, pending: null };

/** The SEC company list, cached for hours. Several requests that arrive together share one download. */
async function tickerList(signal) {
  if (listCache.data && Date.now() - listCache.at < HOURS) return listCache.data;
  if (!listCache.pending) {
    listCache.pending = getJson(TICKERS, {}).then(data => {
      if (!data || typeof data !== 'object') throw new HttpError(502, 'The company list could not be read.');
      listCache = { at: Date.now(), data, pending: null }; return data;
    }).catch(e => { listCache.pending = null; throw e; });
  }
  return listCache.pending;
}

export const resetCache = () => { listCache = { at: 0, data: null, pending: null }; };

export default route(async ({ q, signal }) => {
  if (q.find !== undefined) {
    const text = pick(q, 'find', { max: 40, re: /^[\w .,&'\-]{1,40}$/, say: 'Type a company name or ticker.' });
    return cached({ results: findCompanies(await tickerList(signal), text) }, 's-maxage=3600, stale-while-revalidate=86400');
  }
  const ticker = pick(q, 'ticker', { max: 10, re: /^[A-Za-z0-9.\-]{1,10}$/, say: 'Enter a ticker symbol such as AAPL or MSFT.' }).toUpperCase().replace(/\./g, '-');
  const list = await tickerList(signal);
  const hit = Object.values(list).find(c => c && String(c.ticker).toUpperCase() === ticker);
  if (!hit) throw new HttpError(404, `We could not find ${ticker} in the SEC's list of US companies. Check the ticker, or search by name.`);
  const cik = Number(hit.cik_str);
  if (!Number.isInteger(cik) || cik <= 0) throw new HttpError(502, 'The SEC list had an entry we could not use.');
  let facts;
  try { facts = await getJson(FACTS(cik), { signal }); }
  catch (e) { if (e instanceof HttpError && e.status === 404) throw new HttpError(404, `${hit.title} has no financial statements on file with the SEC. Funds and ETFs do not file them.`); throw e; }
  const out = parseFacts(facts);
  if (!out) throw new HttpError(404, `${hit.title} has no annual US filings we can read. Foreign companies and some funds file differently.`);
  return {
    ...out, ticker, name: out.name || hit.title,
    filingsUrl: `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${String(cik).padStart(10, '0')}&type=10-K&dateb=&owner=include&count=10`,
    asOf: new Date().toISOString(), source: 'US SEC EDGAR, annual 10-K filings'
  };
}, { timeout: 25000, allow: ['ticker', 'find'], cache: 's-maxage=21600, stale-while-revalidate=86400' });
