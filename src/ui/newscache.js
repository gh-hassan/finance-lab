// @ts-nocheck
/* The last news the reader saw is kept in the browser, so the page can open at once and then check for anything newer.
   prefetchNews() warms that copy when someone is about to open the page, for example when they point at its menu link. */
const KEY = 'fl:news:v2', MAX_AGE = 24 * 3600e3;

export function readNewsCache() {
  try { const o = JSON.parse(localStorage.getItem(KEY)); if (o && o.data && Array.isArray(o.data.items) && Date.now() - o.at < MAX_AGE) return o; } catch (e) { /* no copy yet */ }
  return null;
}
export function writeNewsCache(data) { try { localStorage.setItem(KEY, JSON.stringify({ at: Date.now(), data })); } catch (e) { /* storage may be full or blocked */ } }

let inflight = null;
/** Asks for the news once, no matter how many times it is called in a short time. Resolves to the data, or null when it could not load. */
export function prefetchNews() {
  if (inflight) return inflight;
  const c = readNewsCache();
  if (c && Date.now() - c.at < 45e3) return Promise.resolve(c.data);
  inflight = fetch('/api/news').then(r => (r.ok && (r.headers.get('content-type') || '').includes('json') ? r.json() : null)).then(d => { if (d && Array.isArray(d.items)) { writeNewsCache(d); return d; } return null; }).catch(() => null);
  inflight.finally(() => setTimeout(() => { inflight = null; }, 20e3));
  return inflight;
}
