/* Serverless function: interest rates and the economy, from FRED (St. Louis Fed) and US Treasury FiscalData.
     GET /api/macro?view=snapshot                          -> latest, month-ago and year-ago values plus the yield curve at three dates
     GET /api/macro?view=history&series=DGS10&range=5y     -> up to 600 [date, value] points
     GET /api/macro?view=treasury                          -> average interest rates the US government pays, by security type
   The student only supplies values from fixed lists. The two hosts we call are fixed. */
import { route, pick, getText, getJson, HttpError, cached } from './_http.js';
import { SERIES, HISTORY_IDS, RANGES, MAX_POINTS, parseFredCsv, yearOverYear, rangeStart, shiftMonths, thin, buildSnapshot, parseTreasury } from './_macro.js';

const FRED = (id, cosd) => `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${id}${cosd ? `&cosd=${cosd}` : ''}`;
const TREASURY = 'https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v2/accounting/od/avg_interest_rates?sort=-record_date&page%5Bsize%5D=40';
const LONG = 's-maxage=3600, stale-while-revalidate=86400';
const SOURCE_ID = id => SERIES[id].source || id;
const isoDay = ms => new Date(ms).toISOString().slice(0, 10);

/** One series as [date, value] points. INFLATION is built from the CPI index. */
async function load(id, cosd, signal) {
  const points = parseFredCsv(await getText(FRED(SOURCE_ID(id), cosd), { signal }), SOURCE_ID(id));
  return id === 'INFLATION' ? yearOverYear(points) : points;
}

async function snapshot(signal) {
  const now = Date.now(), ids = Object.keys(SERIES);
  /* daily and weekly series need about 14 months; the CPI index needs another year to compute inflation */
  const cosd = id => shiftMonths(isoDay(now), id === 'INFLATION' ? -38 : -16);
  const settled = await Promise.allSettled(ids.map(id => load(id, cosd(id), signal)));
  const maps = {}; let failed = 0, firstError = null;
  settled.forEach((r, i) => { if (r.status === 'fulfilled') maps[ids[i]] = r.value; else { failed++; firstError = firstError || r.reason; } });
  if (failed === ids.length || !maps.DGS10) throw firstError instanceof HttpError ? firstError : new HttpError(502, 'Could not load the interest rate data. Try again in a moment.');
  const body = buildSnapshot(maps, now);
  /* a partial answer is useful but must not be cached for an hour */
  return failed ? cached(body, 's-maxage=60') : body;
}

async function history(q, signal) {
  const id = pick(q, 'series', { list: HISTORY_IDS, max: 16, say: 'Choose one of the listed series.' });
  const range = pick(q, 'range', { list: RANGES, max: 4, fallback: '5y', say: 'Range must be 1y, 5y, 10y, 30y or max.' });
  const now = Date.now(), start = rangeStart(range, now);
  const all = await load(id, start ? shiftMonths(start, id === 'INFLATION' ? -13 : 0) : null, signal);
  const kept = start ? all.filter(p => p[0] >= start) : all;
  if (!kept.length) throw new HttpError(404, 'That series has no values for this time range.');
  /* high, low and average come from every observation, not from the thinned chart points */
  let hi = kept[0], lo = kept[0], sum = 0;
  for (const p of kept) { if (p[1] > hi[1]) hi = p; if (p[1] < lo[1]) lo = p; sum += p[1]; }
  const stats = { high: { date: hi[0], value: hi[1] }, low: { date: lo[0], value: lo[1] }, mean: sum / kept.length };
  return { series: id, label: SERIES[id].label, unit: 'percent', freq: SERIES[id].freq, range, asOf: kept[kept.length - 1][0], stats, points: thin(kept, MAX_POINTS).map(([d, v]) => [d, Math.round(v * 1e4) / 1e4]) };
}

export default route(async ({ q, signal }) => {
  const view = pick(q, 'view', { list: ['snapshot', 'history', 'treasury'], max: 10, say: 'Choose a view: snapshot, history or treasury.' });
  if (view === 'snapshot') return snapshot(signal);
  if (view === 'history') return history(q, signal);
  return parseTreasury(await getJson(TREASURY, { signal }));
}, { cache: LONG, timeout: 12000, allow: ['view', 'series', 'range'] });
