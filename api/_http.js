/* Shared helpers for the serverless data functions.
   Every function takes a few short, validated query values, calls ONE fixed public host and returns small JSON.
   A user never chooses the host, only an identifier that is checked against a pattern or a list. */

/** Some public data sources ask for a contact address. Set CONTACT_EMAIL in the Vercel project settings if one ever blocks us; it is never hard-coded. */
export const UA = `SmartWealthStudy/1.0 (student finance tool; +https://finance-lab-nine.vercel.app${typeof process !== 'undefined' && process.env && process.env.CONTACT_EMAIL ? '; ' + process.env.CONTACT_EMAIL : ''})`;
const MAX_BYTES = 40e6;

/** An error whose message is safe to show to the student. */
export class HttpError extends Error {
  constructor(status, message) { super(message); this.name = 'HttpError'; this.status = status; }
}

/** Reads one short query value, or throws a 400 that says what to fix. Anything other than a single string (for example a repeated parameter) is refused. */
export function pick(q, name, { re, max = 40, fallback, list, say } = {}) {
  let v = q && q[name];
  if (v !== undefined && typeof v !== 'string') throw new HttpError(400, say || `"${name}" must be a single value.`);
  v = v == null ? '' : v.trim();
  if (!v) { if (fallback !== undefined) return fallback; throw new HttpError(400, say || `Missing "${name}".`); }
  if (v.length > max) throw new HttpError(400, say || `"${name}" is too long.`);
  if (list && !list.includes(v)) throw new HttpError(400, say || `"${name}" is not one we offer.`);
  if (re && !re.test(v)) throw new HttpError(400, say || `"${name}" looks wrong.`);
  return v;
}

async function guarded(url, { signal, headers, accept }) {
  let res;
  try { res = await fetch(url, { signal, headers: { 'User-Agent': UA, Accept: accept, ...headers } }); }
  catch (e) { if (e && e.name === 'AbortError') throw e; throw new HttpError(502, 'The data source could not be reached. Try again in a moment.'); }
  if (res.status === 404) throw new HttpError(404, 'The data source has nothing for that request.');
  if (res.status === 429) throw new HttpError(503, 'The free data source is busy right now. Wait a minute and try again.');
  if (!res.ok) throw new HttpError(502, `The data source answered ${res.status}. Try again in a moment.`);
  const len = Number(res.headers && res.headers.get ? res.headers.get('content-length') : 0);
  if (len > MAX_BYTES) throw new HttpError(502, 'The data source sent more than we can handle.');
  return res;
}
export const getJson = async (url, o = {}) => { const res = await guarded(url, { ...o, accept: 'application/json' }); try { return await res.json(); } catch (e) { if (e && e.name === 'AbortError') throw e; throw new HttpError(502, 'The data source sent something we could not read.'); } };
export const getText = async (url, o = {}) => (await guarded(url, { ...o, accept: 'text/csv,text/plain,*/*' })).text();
export const getBuffer = async (url, o = {}) => Buffer.from(await (await guarded(url, { ...o, accept: '*/*' })).arrayBuffer());

/** Wraps a data function. `fn({ q, signal })` returns a JSON-able body, or `{ body, cache }` to choose its own caching. */
export function route(fn, { cache = 's-maxage=3600, stale-while-revalidate=86400', timeout = 9000, allow = [] } = {}) {
  return async function handler(req, res) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    const send = (status, body, cc) => { res.setHeader('Cache-Control', cc); res.statusCode = status; res.end(JSON.stringify(body)); };
    if (req.method && req.method !== 'GET' && req.method !== 'HEAD') { res.setHeader('Allow', 'GET, HEAD'); send(405, { error: 'Use GET.' }, 'no-store'); return; }
    /* unknown query keys are refused so nobody can bypass the cache with ?x=1, ?x=2 ... */
    const extra = Object.keys(req.query || {}).filter(k => !allow.includes(k));
    if (extra.length) { send(400, { error: 'Unknown option in the request.' }, 'no-store'); return; }
    const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), timeout);
    try {
      const out = await fn({ q: req.query || {}, signal: ctl.signal });
      const custom = out instanceof Cached ? out : null;
      send(200, custom ? custom.body : out, custom ? custom.cc : cache);
    } catch (e) {
      if (e instanceof HttpError) { send(e.status, { error: e.message }, e.status === 404 ? 's-maxage=60' : 'no-store'); return; }
      console.error('data function failed', e && e.message);
      send(502, { error: e && e.name === 'AbortError' ? 'The data source took too long. Try again in a moment.' : 'Could not load that data. Try again in a moment.' }, 'no-store');
    } finally { clearTimeout(timer); }
  };
}
/** Return this from a function to override the cache header for one response. */
class Cached { constructor(body, cc) { this.body = body; this.cc = cc; } }
export const cached = (body, cacheControl) => new Cached(body, cacheControl);

/** Median of a number list, ignoring non-finite values. */
export const median = a => { const s = a.filter(Number.isFinite).sort((x, y) => x - y); if (!s.length) return null; const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
