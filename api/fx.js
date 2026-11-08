/* Serverless function: currency exchange rates.
     GET /api/fx?view=rates&base=USD                         -> every rate against one base currency (about 165 currencies), plus names
     GET /api/fx?view=history&base=USD&quote=EUR&range=1y     -> the rate for one pair over time, thinned for charting
     GET /api/fx?view=moves&base=USD                          -> major currencies now and a year ago, biggest mover first
   Today's rates come from open.er-api.com (about 165 currencies, including the Pakistani rupee). History for pairs the European Central Bank covers
   comes from Frankfurter (back 10 years); history for any other pair comes from the community currency-api dataset (back to March 2024).
   The student only ever supplies currency codes and a range. The hosts are fixed. */
import { route, pick, getJson, HttpError, cached } from './_http.js';
import { RANGES, MAJORS, MAX_POINTS, FAWAZ_FIRST, startDate, sampleDates, parseRates, parseErRates, parseFawaz, fawazSeries, currencyName, parseSeries, parseMoves, summarise, thin, isoDay } from './_fx.js';

const ECB = 'https://api.frankfurter.dev/v1';
const ER = 'https://open.er-api.com/v6/latest';
const FAWAZ = v => `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@${v}/v1/currencies`;
const DAY = 24 * 3600e3;
const SOURCE = 'open.er-api.com daily rates; history from the European Central Bank (Frankfurter) and currency-api';
let cache = { at: 0, data: null };

/** Which currencies we offer (every currency er-api prices) and which of those the ECB also covers. Both are kept for a day. */
async function currencyLists(signal) {
  if (cache.data && Date.now() - cache.at < DAY) return cache.data;
  const [er, ecb] = await Promise.all([getJson(`${ER}/USD`, { signal }), getJson(`${ECB}/currencies`, { signal }).catch(e => { if (e.name === 'AbortError') throw e; return {}; })]);
  const all = Object.keys(parseErRates(er, 'USD').rates).sort(), names = {};
  for (const c of all) names[c] = currencyName(c);
  const ecbSet = new Set(Object.keys(ecb && typeof ecb === 'object' ? ecb : {}).filter(k => /^[A-Z]{3}$/.test(k)));
  cache = { at: Date.now(), data: { names, ecbSet } };
  return cache.data;
}
export const resetCache = () => { cache = { at: 0, data: null }; };

/** The shape of a currency code is checked before anything goes over the network; membership in our list is checked once the list is known. */
const shape = (q, name) => pick(q, name, { max: 3, re: /^[A-Z]{3}$/, say: `Choose a currency for "${name}", using its three-letter code such as USD.` });
const known = (c, names) => { if (!names[c]) throw new HttpError(400, `${c} is not a currency we have rates for.`); return c; };
const meta = () => ({ asOf: new Date().toISOString(), source: SOURCE, url: 'https://www.exchangerate-api.com/docs/free' });

async function rates(q, signal) {
  const wanted = shape(q, 'base'), { names } = await currencyLists(signal), base = known(wanted, names);
  const r = parseErRates(await getJson(`${ER}/${base}`, { signal }), base), shown = {};
  for (const k of Object.keys(r.rates)) if (names[k]) shown[k] = names[k];
  return cached({ ...r, names: shown, ...meta() }, 's-maxage=3600, stale-while-revalidate=86400');
}

/** Dated answers from currency-api, a handful at a time so one slow day cannot hold up all the others. A day with no release is skipped. */
async function fawazDays(base, dates, signal) {
  const out = [];
  for (let i = 0; i < dates.length; i += 12) {
    const batch = await Promise.allSettled(dates.slice(i, i + 12).map(d => getJson(`${FAWAZ(d)}/${base.toLowerCase()}.json`, { signal }).then(j => parseFawaz(j, base))));
    for (const r of batch) { if (r.status === 'fulfilled') out.push(r.value); else if (r.reason && r.reason.name === 'AbortError') throw r.reason; }
  }
  return out;
}

async function history(q, signal) {
  const wantBase = shape(q, 'base'), wantQuote = shape(q, 'quote');
  if (wantBase === wantQuote) throw new HttpError(400, 'Choose two different currencies.');
  const range = pick(q, 'range', { list: RANGES, fallback: '1y', say: 'Choose a range: 1m, 3m, 1y, 5y or 10y.' });
  const { names, ecbSet } = await currencyLists(signal), base = known(wantBase, names), quote = known(wantQuote, names);
  const ecbPair = ecbSet.has(base) && ecbSet.has(quote);
  const all = ecbPair ? parseSeries(await getJson(`${ECB}/${startDate(range)}..?base=${base}&symbols=${quote}`, { signal }), quote) : fawazSeries(await fawazDays(base, sampleDates(range), signal), quote);
  const s = summarise(all), limited = !ecbPair && startDate(range) < FAWAZ_FIRST;
  return cached({ base, quote, range, points: thin(all, MAX_POINTS), first: s.first, last: s.last, change: s.change, high: s.high, low: s.low, firstDate: s.firstDate, lastDate: s.lastDate, limited, earliest: limited ? FAWAZ_FIRST : null, ...meta() }, 's-maxage=21600, stale-while-revalidate=86400');
}

async function moves(q, signal) {
  const wanted = shape(q, 'base'), { names, ecbSet } = await currencyLists(signal), base = known(wanted, names);
  const ago = startDate('1y');
  if (ecbSet.has(base)) {
    const symbols = MAJORS.filter(c => c !== base && ecbSet.has(c)).join(',');
    const [now, then] = await Promise.all([getJson(`${ECB}/latest?base=${base}&symbols=${symbols}`, { signal }), getJson(`${ECB}/${ago}?base=${base}&symbols=${symbols}`, { signal })]);
    return cached({ base, ...parseMoves(now, then, base), ...meta() }, 's-maxage=3600, stale-while-revalidate=86400');
  }
  const day = ago < FAWAZ_FIRST ? FAWAZ_FIRST : ago;
  const [now, then] = await Promise.all([getJson(`${FAWAZ('latest')}/${base.toLowerCase()}.json`, { signal }), getJson(`${FAWAZ(day)}/${base.toLowerCase()}.json`, { signal })]);
  return cached({ base, ...parseMoves(parseFawaz(now, base), parseFawaz(then, base), base), ...meta() }, 's-maxage=3600, stale-while-revalidate=86400');
}

const VIEWS = { rates, history, moves };

export default route(({ q, signal }) => {
  const view = pick(q, 'view', { list: Object.keys(VIEWS), fallback: 'rates', say: 'Choose a view: rates, history or moves.' });
  return VIEWS[view](q, signal);
}, { timeout: 15000, allow: ['view', 'base', 'quote', 'range'] });
