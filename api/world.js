/* Serverless function: country statistics from the World Bank's free indicators API.
     GET /api/world?indicator=FP.CPI.TOTL.ZG&countries=US;DE;JP -> { indicator, series:{US:[[year,value]]}, latest:{US:{year,value}}, source }
     (The table that ranks every country comes from a snapshot built by scripts/build-countries.mjs, because one request for 100 countries can take a minute.)
   Only listed indicators and countries are accepted. The host is fixed. */
import { route, pick, getJson, cached, HttpError } from './_http.js';
import { COUNTRIES, INDICATORS, FIRST_YEAR, parseCountries, parseWorldBank, latestOf } from './_world.js';

const URL_FOR = (codes, id, year) => `https://api.worldbank.org/v2/country/${codes.join(';')}/indicator/${id}?format=json&per_page=1000&date=${FIRST_YEAR}:${year}`;
const CACHE = 's-maxage=86400, stale-while-revalidate=604800';

/** The World Bank is usually quick but sometimes stalls for a minute. A stalled request is abandoned and tried once more on a fresh connection. */
async function fetchWorldBank(url, signal) {
  for (const ms of [6000, 11000]) {
    const ctl = new AbortController(), stop = () => ctl.abort(), timer = setTimeout(stop, ms);
    signal.addEventListener('abort', stop);
    try { return await getJson(url, { signal: ctl.signal }); }
    catch (e) { if (e.name !== 'AbortError' || signal.aborted) throw e; }
    finally { clearTimeout(timer); signal.removeEventListener('abort', stop); }
  }
  throw new HttpError(502, 'The World Bank is slow right now. Try again in a moment.');
}

export default route(async ({ q, signal }) => {
  const id = pick(q, 'indicator', { list: Object.keys(INDICATORS), say: 'Choose one of the indicators we offer.' });
  const codes = parseCountries(pick(q, 'countries', { max: 40, re: /^[A-Za-z]{2}([;,][A-Za-z]{2}){0,19}$/, say: 'Choose between 1 and 8 countries from the list we offer.' }));
  const now = new Date().getFullYear();
  const all = parseWorldBank(await fetchWorldBank(URL_FOR(codes, id, now), signal));
  const latest = {};
  codes.forEach(c => { latest[c] = latestOf(all[c], now); });
  const indicator = { id, label: INDICATORS[id].label, unit: INDICATORS[id].unit };
  return cached({ indicator, series: Object.fromEntries(codes.map(c => [c, all[c] || []])), latest, source: 'World Bank open data' }, CACHE);
}, { timeout: 20000, cache: CACHE, allow: ['indicator', 'countries'] });
