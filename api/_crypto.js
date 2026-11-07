/* Pure helpers for the crypto function: defensive readers for what CoinGecko sends back, trimmed to the few fields the page uses. */
import { HttpError } from './_http.js';

export const DAYS = ['7', '30', '90', '365'];
export const MAX_POINTS = 400;
export const SPARK_POINTS = 42;
const bad = () => new HttpError(502, 'The crypto price source sent something we could not read.');
const busy = () => new HttpError(503, 'The free data source is busy right now. Wait a minute and try again.');

const fin = x => typeof x === 'number' && Number.isFinite(x);
const round = (x, d) => (fin(x) ? Math.round(x * 10 ** d) / 10 ** d : null);
/** Prices keep about six significant digits, so a $0.00001234 coin does not turn into zero. */
export const price = x => (!fin(x) || x < 0 ? null : x >= 1 ? round(x, 2) : x === 0 ? 0 : Number(x.toPrecision(6)));
const whole = x => (fin(x) && x >= 0 ? Math.round(x) : null);
const text = (x, max) => (typeof x === 'string' ? x.trim().slice(0, max) : '');

/** CoinGecko sometimes answers 200 with an error object inside. */
function checkNotice(json) {
  const code = json && !Array.isArray(json) && typeof json === 'object' && json.status && json.status.error_code;
  if (code === 429) throw busy();
  if (code) throw bad();
}

export function thin(pts, max = MAX_POINTS) {
  if (pts.length <= max || max < 2) return pts.slice();
  const out = [], step = (pts.length - 1) / (max - 1);
  for (let i = 0; i < max; i++) out.push(pts[Math.round(i * step)]);
  return out;
}

function coin(c) {
  if (!c || typeof c !== 'object') return null;
  const id = text(c.id, 50), symbol = text(c.symbol, 12).toUpperCase(), name = text(c.name, 60);
  if (!/^[a-z0-9-]{1,50}$/.test(id) || !symbol || !name) return null;
  const spark = Array.isArray(c.sparkline_in_7d && c.sparkline_in_7d.price) ? c.sparkline_in_7d.price.filter(fin) : [];
  return {
    id, symbol, name, rank: whole(c.market_cap_rank), price: price(c.current_price), cap: whole(c.market_cap), volume: whole(c.total_volume),
    ch24: round(c.price_change_percentage_24h_in_currency ?? c.price_change_percentage_24h, 2), ch7d: round(c.price_change_percentage_7d_in_currency, 2),
    ch30d: round(c.price_change_percentage_30d_in_currency, 2), ch1y: round(c.price_change_percentage_1y_in_currency, 2),
    ath: price(c.ath), athChange: round(c.ath_change_percentage, 1), spark: thin(spark, SPARK_POINTS).map(price)
  };
}

/** The top coins, trimmed. Entries that are not coins are dropped; nothing usable is a 502. */
export function parseMarkets(json) {
  checkNotice(json);
  if (!Array.isArray(json)) throw bad();
  const coins = json.map(coin).filter(Boolean).slice(0, 20);
  if (!coins.length) throw bad();
  return coins;
}

/** [[ms, price], ...] sorted by time, with holes and bad numbers skipped, then thinned. */
export function parseChart(json) {
  checkNotice(json);
  const raw = json && typeof json === 'object' && json.prices;
  if (!Array.isArray(raw)) throw bad();
  const pts = [];
  for (const p of raw) if (Array.isArray(p) && fin(p[0]) && p[0] > 0 && fin(p[1]) && p[1] > 0) pts.push([Math.round(p[0]), price(p[1])]);
  pts.sort((a, b) => a[0] - b[0]);
  if (pts.length < 2) throw new HttpError(404, 'There is no price history for that coin yet.');
  return thin(pts);
}
