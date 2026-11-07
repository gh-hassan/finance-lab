/* Serverless function: currency exchange rates from Frankfurter, which republishes the European Central Bank's daily reference rates.
     GET /api/fx?view=rates&base=USD                         -> every rate against one base currency, plus currency names
     GET /api/fx?view=history&base=USD&quote=EUR&range=1y     -> the daily rate for one pair, thinned for charting
     GET /api/fx?view=moves&base=USD                          -> major currencies now and a year ago, biggest mover first
   The student only ever supplies currency codes and a range. The host is fixed. */
import { route, pick, getJson, HttpError, cached } from './_http.js';
import { RANGES, MAJORS, MAX_POINTS, startDate, parseRates, parseNames, parseSeries, parseMoves, summarise, thin } from './_fx.js';

const HOST = 'https://api.frankfurter.dev/v1';
const DAY = 24 * 3600e3;
const SOURCE = 'European Central Bank reference rates via Frankfurter';
let namesCache = { at: 0, data: null };

async function currencyNames(signal) {
  if (namesCache.data && Date.now() - namesCache.at < DAY) return namesCache.data;
  const data = parseNames(await getJson(`${HOST}/currencies`, { signal }));
  namesCache = { at: Date.now(), data };
  return data;
}
export const resetCache = () => { namesCache = { at: 0, data: null }; };

const code = (q, name, names) => {
  const c = pick(q, name, { max: 3, re: /^[A-Z]{3}$/, say: `Choose a currency for "${name}", using its three-letter code such as USD.` });
  if (!names[c]) throw new HttpError(400, `${c} is not a currency we have rates for.`);
  return c;
};
const meta = () => ({ asOf: new Date().toISOString(), source: SOURCE, url: 'https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/index.en.html' });

async function rates(q, signal) {
  const names = await currencyNames(signal), base = code(q, 'base', names);
  const r = parseRates(await getJson(`${HOST}/latest?base=${base}`, { signal }), base);
  const shown = {};
  for (const k of Object.keys(r.rates)) if (names[k]) shown[k] = names[k];
  return cached({ ...r, names: shown, ...meta() }, 's-maxage=3600, stale-while-revalidate=86400');
}

async function history(q, signal) {
  const names = await currencyNames(signal), base = code(q, 'base', names), quote = code(q, 'quote', names);
  if (base === quote) throw new HttpError(400, 'Choose two different currencies.');
  const range = pick(q, 'range', { list: RANGES, fallback: '1y', say: 'Choose a range: 1m, 3m, 1y, 5y or 10y.' });
  const all = parseSeries(await getJson(`${HOST}/${startDate(range)}..?base=${base}&symbols=${quote}`, { signal }), quote);
  const s = summarise(all);
  return cached({ base, quote, range, points: thin(all, MAX_POINTS), first: s.first, last: s.last, change: s.change, high: s.high, low: s.low, firstDate: s.firstDate, lastDate: s.lastDate, ...meta() }, 's-maxage=21600, stale-while-revalidate=86400');
}

async function moves(q, signal) {
  const names = await currencyNames(signal), base = code(q, 'base', names);
  const symbols = MAJORS.filter(c => c !== base && names[c]).join(',');
  const ago = startDate('1y');
  const [now, then] = await Promise.all([getJson(`${HOST}/latest?base=${base}&symbols=${symbols}`, { signal }), getJson(`${HOST}/${ago}?base=${base}&symbols=${symbols}`, { signal })]);
  return cached({ base, ...parseMoves(now, then, base), ...meta() }, 's-maxage=3600, stale-while-revalidate=86400');
}

const VIEWS = { rates, history, moves };

export default route(({ q, signal }) => {
  const view = pick(q, 'view', { list: Object.keys(VIEWS), fallback: 'rates', say: 'Choose a view: rates, history or moves.' });
  return VIEWS[view](q, signal);
}, { timeout: 15000, allow: ['view', 'base', 'quote', 'range'] });
