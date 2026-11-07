/* Serverless function: cryptocurrency prices from CoinGecko's free public API.
     GET /api/crypto?view=markets                      -> the 20 biggest coins by market value, with changes and a 7-day sparkline
     GET /api/crypto?view=chart&id=bitcoin&days=30     -> price history for one coin
   The free tier is rate limited and shared, so answers are cached hard and the last good answer is reused when the source is busy.
   The student only supplies a coin id and a number of days. The host is fixed. */
import { route, pick, getJson, HttpError, cached } from './_http.js';
import { DAYS, parseMarkets, parseChart } from './_crypto.js';

const HOST = 'https://api.coingecko.com/api/v3';
const SOURCE = 'CoinGecko';
const KEEP_MS = 3600e3, MAX_KEPT = 60;
const lastGood = new Map();

export const resetCache = () => lastGood.clear();
const remember = (key, body) => { if (lastGood.size >= MAX_KEPT) lastGood.delete(lastGood.keys().next().value); lastGood.set(key, { at: Date.now(), body }); };

/** Runs `load`; if the source is busy or down, answers with the last good copy (marked stale) when there is a recent one. */
async function withFallback(key, load) {
  try { const body = await load(); remember(key, body); return { body, stale: false }; }
  catch (e) {
    const old = lastGood.get(key);
    if (e instanceof HttpError && e.status >= 502 && old && Date.now() - old.at < KEEP_MS) return { body: old.body, stale: true };
    throw e;
  }
}
const meta = () => ({ asOf: new Date().toISOString(), source: SOURCE, url: 'https://www.coingecko.com' });
const reply = (r, cache) => cached({ ...r.body, stale: r.stale, ...meta() }, r.stale ? 's-maxage=60, stale-while-revalidate=600' : cache);

async function markets(q, signal) {
  const url = `${HOST}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=20&page=1&sparkline=true&price_change_percentage=24h,7d,30d,1y`;
  const r = await withFallback('markets', async () => ({ coins: parseMarkets(await getJson(url, { signal })) }));
  return reply(r, 's-maxage=300, stale-while-revalidate=3600');
}

async function chart(q, signal) {
  const id = pick(q, 'id', { max: 50, re: /^[a-z0-9-]{1,50}$/, say: 'Choose a coin by its id, such as bitcoin.' });
  const days = pick(q, 'days', { list: DAYS, fallback: '30', say: 'Choose 7, 30, 90 or 365 days.' });
  const url = `${HOST}/coins/${id}/market_chart?vs_currency=usd&days=${days}`;
  const r = await withFallback(`${id}:${days}`, async () => {
    try { return { id, days: Number(days), points: parseChart(await getJson(url, { signal })) }; }
    catch (e) { if (e instanceof HttpError && e.status === 404) throw new HttpError(404, 'We could not find price history for that coin.'); throw e; }
  });
  return reply(r, 's-maxage=900, stale-while-revalidate=86400');
}

const VIEWS = { markets, chart };

export default route(({ q, signal }) => {
  const view = pick(q, 'view', { list: Object.keys(VIEWS), fallback: 'markets', say: 'Choose a view: markets or chart.' });
  return VIEWS[view](q, signal);
}, { timeout: 15000, allow: ['view', 'id', 'days'] });
