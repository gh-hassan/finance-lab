/* Serverless function: country statistics from the World Bank's free indicators API.
     GET /api/world?indicator=FP.CPI.TOTL.ZG&countries=US;DE;JP -> { indicator, series:{US:[[year,value]]}, latest:{US:{year,value}}, source }
     GET /api/world?indicator=FP.CPI.TOTL.ZG&view=ranking       -> { indicator, latest:{ every offered country }, source }
   Only listed indicators and countries are accepted. The host is fixed. */
import { route, pick, getJson, cached } from './_http.js';
import { COUNTRIES, INDICATORS, FIRST_YEAR, parseCountries, parseWorldBank, latestOf } from './_world.js';

const URL_FOR = (codes, id, year) => `https://api.worldbank.org/v2/country/${codes.join(';')}/indicator/${id}?format=json&per_page=1000&date=${FIRST_YEAR}:${year}`;
const CACHE = 's-maxage=86400, stale-while-revalidate=604800';

export default route(async ({ q, signal }) => {
  const id = pick(q, 'indicator', { list: Object.keys(INDICATORS), say: 'Choose one of the indicators we offer.' });
  const view = pick(q, 'view', { list: ['series', 'ranking'], fallback: 'series', say: 'The view must be series or ranking.' });
  const codes = view === 'ranking' ? COUNTRIES : parseCountries(pick(q, 'countries', { max: 40, re: /^[A-Za-z]{2}([;,][A-Za-z]{2}){0,19}$/, say: 'Choose between 1 and 8 countries from the list we offer.' }));
  const now = new Date().getFullYear();
  const all = parseWorldBank(await getJson(URL_FOR(codes, id, now), { signal }));
  const latest = {};
  codes.forEach(c => { latest[c] = latestOf(all[c], now); });
  const indicator = { id, label: INDICATORS[id].label, unit: INDICATORS[id].unit }, source = 'World Bank open data';
  if (view === 'ranking') return cached({ indicator, latest, source }, CACHE);
  const series = Object.fromEntries(codes.map(c => [c, all[c] || []]));
  return cached({ indicator, series, latest, source }, CACHE);
}, { timeout: 15000, cache: CACHE, allow: ['indicator', 'countries', 'view'] });
