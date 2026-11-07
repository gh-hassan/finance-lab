// Builds src/data/countries-latest.json: the latest World Bank figure for every offered country and indicator.
// The ranking table uses this snapshot because one live request for 100 countries can take a minute.
// Run now and then (World Bank data is annual):  node scripts/build-countries.mjs
import { writeFileSync } from 'node:fs';
import { COUNTRIES, INDICATORS, MAX_AGE } from '../api/_world.js';

const OUT = new URL('../src/data/countries-latest.json', import.meta.url);
const now = new Date().getFullYear(), latest = {};
async function one(id) {
  const url = `https://api.worldbank.org/v2/country/${COUNTRIES.join(';')}/indicator/${id}?format=json&mrnev=1&per_page=500`;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(120000) });
      const body = await res.json(), rows = Array.isArray(body) ? body[1] : null;
      if (!Array.isArray(rows)) throw new Error('unexpected answer');
      const out = {};
      for (const c of COUNTRIES) out[c] = null;
      for (const r of rows) {
        const code = r && r.country && r.country.id, year = Number(r && r.date);
        if (COUNTRIES.includes(code) && typeof r.value === 'number' && Number.isFinite(r.value) && year >= now - MAX_AGE) out[code] = { year, value: Math.round(r.value * 1e4) / 1e4 };
      }
      return out;
    } catch (e) { console.error(`${id} attempt ${attempt} failed: ${e.message}`); }
  }
  throw new Error('gave up on ' + id);
}
const results = await Promise.all(Object.keys(INDICATORS).map(async id => [id, await one(id)]));
for (const [id, v] of results) latest[id] = v;
writeFileSync(OUT, JSON.stringify({ asOf: new Date().toISOString().slice(0, 10), source: 'World Bank open data', latest }));
console.log('wrote', Object.keys(latest).length, 'indicators for', COUNTRIES.length, 'countries');
