// Builds src/data/countries-series/<indicator>.json: the yearly history (2000 to now) for every offered country, one file per indicator.
// The Countries page reads these files, so its charts appear at once. The World Bank's live service sometimes stalls for a minute or more,
// so it is only used here, where a stalled request is simply abandoned and tried again.
// Run now and then (World Bank data is annual):  node scripts/build-country-series.mjs
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { COUNTRIES, INDICATORS, FIRST_YEAR, parseWorldBank } from '../api/_world.js';

const pause = ms => new Promise(r => setTimeout(r, ms));
const DIR = new URL('../src/data/countries-series/', import.meta.url);
const now = new Date().getFullYear(), asOf = new Date().toISOString().slice(0, 10);
mkdirSync(DIR, { recursive: true });

/** One small batch of countries. The World Bank answers small requests quickly and stalls on big ones, so batches are small and a stalled one is simply tried again. */
async function fetchBatch(id, codes) {
  const url = `https://api.worldbank.org/v2/country/${codes.join(';')}/indicator/${id}?format=json&per_page=5000&date=${FIRST_YEAR}:${now}`;
  for (let attempt = 1; attempt <= 15; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
      return parseWorldBank(await res.json());
    } catch (e) { if (attempt === 15) throw new Error(`gave up on ${id} for ${codes[0]}...: ${e.message}`); await pause(Math.min(60000, 5000 * attempt)); }
  }
}

async function fetchSeries(id) {
  const batches = [];
  for (let i = 0; i < COUNTRIES.length; i += 8) batches.push(COUNTRIES.slice(i, i + 8));
  const merged = {};
  for (const b of batches) { Object.assign(merged, await fetchBatch(id, b)); await pause(2000); /* be gentle: the World Bank blocks fast callers */ }
  return merged;
}

for (const id of Object.keys(INDICATORS)) {
  if (existsSync(new URL(id + '.json', DIR)) && !process.argv.includes('--force')) { console.log(id, 'already built (use --force to rebuild)'); continue; }
  const all = await fetchSeries(id), series = {};
  for (const c of COUNTRIES) if (all[c] && all[c].length) series[c] = all[c];
  writeFileSync(new URL(id + '.json', DIR), JSON.stringify({ asOf, source: 'World Bank open data', series }));
  console.log(id, Object.keys(series).length, 'countries');
}
