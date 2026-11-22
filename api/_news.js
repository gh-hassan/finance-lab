/* Finance news and learning articles from public RSS and Atom feeds.
   Every source is a fixed address in this file. A student never supplies one. We keep only a headline, a short summary, the time and the link,
   so each story sends the reader to the publisher. We do not copy articles. */
import { UA, HttpError } from './_http.js';

/** group: global (world markets), local (Pakistan), policy (central banks and regulators), learn (articles and case studies). */
export const SOURCES = [
  { id: 'cnbc', name: 'CNBC Finance', group: 'global', url: 'https://www.cnbc.com/id/10000664/device/rss/rss.html' },
  { id: 'marketwatch', name: 'MarketWatch', group: 'global', url: 'https://feeds.content.dowjones.io/public/rss/mw_topstories' },
  { id: 'bbc', name: 'BBC Business', group: 'global', url: 'https://feeds.bbci.co.uk/news/business/rss.xml' },
  { id: 'guardian', name: 'The Guardian Business', group: 'global', url: 'https://www.theguardian.com/business/rss' },
  { id: 'dawn', name: 'Dawn Business', group: 'local', url: 'https://www.dawn.com/feeds/business' },
  { id: 'tribune', name: 'Express Tribune Business', group: 'local', url: 'https://tribune.com.pk/feed/business' },
  { id: 'fed', name: 'Federal Reserve', group: 'policy', url: 'https://www.federalreserve.gov/feeds/press_all.xml' },
  { id: 'sec', name: 'US SEC', group: 'policy', url: 'https://www.sec.gov/news/pressreleases.rss' },
  { id: 'ecb', name: 'European Central Bank', group: 'policy', url: 'https://www.ecb.europa.eu/rss/press.html' },
  { id: 'damodaran', name: 'Aswath Damodaran, Musings on Markets', group: 'learn', url: 'https://aswathdamodaran.blogspot.com/feeds/posts/default?max-results=4' },
  { id: 'harvard-gov', name: 'Harvard Law School Forum on Corporate Governance', group: 'learn', url: 'https://corpgov.law.harvard.edu/feed/' },
  { id: 'yale', name: 'Yale Insights', group: 'learn', url: 'https://insights.som.yale.edu/rss' },
  { id: 'wharton', name: 'Knowledge at Wharton', group: 'learn', url: 'https://knowledge.wharton.upenn.edu/feed/' },
  { id: 'fed-notes', name: 'Federal Reserve research notes', group: 'learn', url: 'https://www.federalreserve.gov/feeds/feds_notes.xml' }
];
export const GROUPS = ['global', 'local', 'policy', 'learn'];

const DAY = 864e5;
/** How old a story may be, how many we send per group, and the most from any one source. Only the most relevant stories are sent. */
const KEEP = { global: { age: 3 * DAY, send: 10, perSource: 4, half: 14 }, local: { age: 3 * DAY, send: 10, perSource: 6, half: 14 }, policy: { age: 21 * DAY, send: 6, perSource: 3, half: 96 }, learn: { age: 90 * DAY, send: 8, perSource: 2, half: 24 * 14 } };
/** Words that make a business story about money, markets or the economy. General news in a business feed has none of them. */
const MONEY = /\b(markets?|stocks?|shares?|equit(?:y|ies)|bonds?|yields?|rates?|inflation|interest|central bank|fed|ecb|sbp|state bank|econom(?:y|ic|ics|ist|ists)|gdp|budget|tax(?:es)?|trade|tariffs?|exports?|imports?|currency|dollar|euro|rupee|oil|gold|banks?|banking|investors?|investment|earnings|profits?|revenues?|ipo|merger|acquisition|takeover|debt|imf|world bank|psx|kse|growth|recession|prices?|crypto|bitcoin|funds?|financ(?:e|ial|ing)|insurance|loans?|credit|capital|jobs|wages|unemployment|inflationary|valuation|dividends?|bankruptcy|regulat(?:or|ors|ion|ory)|sec|treasury)\b/gi;
/** A feed is read from its start only. The newest stories come first, and some feeds are megabytes long. */
const MAX_FEED_BYTES = 260e3;
const SOURCE_TIMEOUT = 3500;
const MAX_ITEMS_PER_FEED = 60;

const NAMED = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”', hellip: '…', pound: '£', euro: '€' };
/** Turns &amp;, &#8217; and &#x2019; back into the characters they stand for. */
export function decode(s) {
  return String(s).replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === '#') { const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); return Number.isFinite(n) && n > 8 && n < 0x110000 ? String.fromCodePoint(n) : ' '; }
    const v = NAMED[e.toLowerCase()]; return v === undefined ? m : v;
  });
}
/** Plain text from a piece of feed markup: tags removed, entities decoded, spaces tidied. */
export function plain(s) {
  let t = String(s == null ? '' : s);
  const cdata = /^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/.exec(t);
  t = cdata ? cdata[1] : decode(t);
  t = t.replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]*>/g, ' ');
  return decode(t).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').replace(/^[\s•·▪◦*–—-]+/, '').trim();
}
/** A short summary that ends on a whole word. */
export function clip(s, n = 170) {
  if (s.length <= n) return s;
  const cut = s.slice(0, n), sp = cut.lastIndexOf(' ');
  return (sp > n * 0.6 ? cut.slice(0, sp) : cut).replace(/[\s,.;:–-]+$/, '') + '…';
}

/** The text inside the first <tag> of a block, or null. Works for names like content:encoded. Plain scanning, so no regex can run away on a big feed. */
export function inner(block, tag) {
  let from = 0;
  for (;;) {
    const i = block.indexOf('<' + tag, from);
    if (i < 0) return null;
    const c = block[i + tag.length + 1];
    if (c !== '>' && c !== ' ' && c !== '/' && c !== '\n' && c !== '\t' && c !== '\r') { from = i + 1; continue; }
    const open = block.indexOf('>', i);
    if (open < 0) return null;
    if (block[open - 1] === '/') return '';
    const close = block.indexOf('</' + tag + '>', open);
    return close < 0 ? null : block.slice(open + 1, close);
  }
}
/** The value of an attribute on the first <tag> that has it, optionally only when another attribute matches. */
function attrOf(block, tag, attr, where) {
  let from = 0;
  for (;;) {
    const i = block.indexOf('<' + tag, from);
    if (i < 0) return null;
    const end = block.indexOf('>', i);
    if (end < 0) return null;
    const head = block.slice(i, end), c = head[tag.length + 1];
    from = end;
    if (c !== ' ' && c !== '\n' && c !== '\t' && c !== '/') continue;
    if (where && !where.test(head)) continue;
    const m = new RegExp(attr + '\\s*=\\s*("([^"]*)"|\'([^\']*)\')', 'i').exec(head);
    if (m) return decode(m[2] !== undefined ? m[2] : m[3]);
  }
}

const cleanUrl = u => {
  const t = String(u || '').trim();
  if (!/^https?:\/\/[^\s<>"']+$/i.test(t) || t.length > 600) return null;
  try { const x = new URL(t); x.hash = ''; return x.toString(); } catch { return null; }
};
const hash = s => { let a = 5381; for (let i = 0; i < s.length; i++) a = ((a << 5) + a + s.charCodeAt(i)) >>> 0; return a.toString(36); };

/** Reads the stories out of an RSS or Atom feed. Bad or half-sent entries are skipped; a feed that is cut off still gives the stories it sent whole. */
export function parseFeed(xml, { now = Date.now() } = {}) {
  const text = String(xml == null ? '' : xml), out = [], atom = /<feed[\s>]/.test(text.slice(0, 2000)) && !/<rss[\s>]/.test(text.slice(0, 2000)), tag = atom ? 'entry' : 'item';
  let pos = 0;
  while (out.length < MAX_ITEMS_PER_FEED) {
    const a = text.indexOf('<' + tag, pos);
    if (a < 0) break;
    const c = text[a + tag.length + 1];
    if (c !== '>' && c !== ' ' && c !== '\n' && c !== '\t' && c !== '\r') { pos = a + 1; continue; }
    const z = text.indexOf('</' + tag + '>', a);
    if (z < 0) break;
    pos = z + tag.length + 3;
    const block = text.slice(a, z);
    const title = plain(inner(block, 'title') || '');
    let link = null;
    if (atom) link = cleanUrl(attrOf(block, 'link', 'href', /rel\s*=\s*["']alternate["']/i) || attrOf(block, 'link', 'href', /^(?:(?!rel\s*=).)*$/is));
    else { const l = inner(block, 'link'); link = cleanUrl(l == null ? '' : l.replace(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/, '$1')); if (!link) { const g = inner(block, 'guid'); link = cleanUrl(g == null ? '' : plain(g)); } }
    const rawDate = inner(block, 'pubDate') || inner(block, 'dc:date') || inner(block, 'published') || inner(block, 'updated') || inner(block, 'dcterms:issued');
    let when = Date.parse(plain(rawDate || ''));
    if (!Number.isFinite(when)) continue;
    if (when > now + 36e5) when = now;
    const body = inner(block, 'description') || inner(block, 'summary') || inner(block, 'content:encoded') || inner(block, 'content') || '';
    let summary = clip(plain(body), 170);
    if (summary.toLowerCase() === title.toLowerCase() || summary.length < 25) summary = '';
    if (!title || !link) continue;
    out.push({ title: clip(title, 180), link, published: new Date(when).toISOString(), summary });
  }
  return out;
}

/** Fetches the start of one feed. It reads at most MAX_FEED_BYTES, and stops reading after that. */
export async function fetchFeed(url, signal, cap = MAX_FEED_BYTES) {
  let res;
  try { res = await fetch(url, { signal, headers: { 'User-Agent': UA, Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*' } }); }
  catch (e) { if (e && e.name === 'AbortError') throw e; throw new HttpError(502, 'A news source could not be reached.'); }
  if (!res.ok) throw new HttpError(502, `A news source answered ${res.status}.`);
  const body = res.body;
  if (body && typeof body.getReader === 'function') {
    const reader = body.getReader(), dec = new TextDecoder('utf-8'); let got = 0, text = '';
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      got += value.length; text += dec.decode(value, { stream: true });
      if (got >= cap) { try { await reader.cancel(); } catch { /* ignore */ } break; }
    }
    return text;
  }
  const all = await res.text();
  return all.length > cap ? all.slice(0, cap) : all;
}

const memo = new Map();
/** How long a source is remembered, by group. Articles change slowly, so they are fetched less often. */
const TTL = { global: 3 * 60e3, local: 3 * 60e3, policy: 10 * 60e3, learn: 30 * 60e3 };
export const resetNewsCache = () => memo.clear();

async function loadSource(src, signal, now) {
  const hit = memo.get(src.id);
  if (hit && now - hit.at < (TTL[src.group] || TTL.global)) return hit.items;
  const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), SOURCE_TIMEOUT), onAbort = () => ctl.abort();
  if (signal) signal.addEventListener('abort', onAbort, { once: true });
  try {
    const items = parseFeed(await fetchFeed(src.url, ctl.signal), { now });
    memo.set(src.id, { at: now, items });
    return items;
  } finally { clearTimeout(timer); if (signal) signal.removeEventListener('abort', onAbort); }
}

/** How worth showing a story is: newer is better, and a story that is plainly about money beats general news. Learning pieces age slowly. */
export function relevance(it, group, now) {
  const keep = KEEP[group] || KEEP.global, ageH = Math.max(0, (now - Date.parse(it.published)) / 36e5), fresh = Math.pow(0.5, ageH / keep.half);
  const hits = new Set(((it.title + ' ' + it.summary).match(MONEY) || []).map(x => x.toLowerCase())).size;
  const money = group === 'policy' || group === 'learn' ? 1 : hits === 0 ? 0.15 : 1 + Math.min(hits, 4) * 0.35;
  return Math.round(fresh * money * 1000) / 10;
}

/** All stories from every source, newest first. A source that fails is left out and named in `sources`. */
export async function collect({ signal, now = Date.now(), sources = SOURCES } = {}) {
  const results = await Promise.all(sources.map(async src => {
    try { return { src, items: await loadSource(src, signal, now), ok: true }; }
    catch (e) { if (e && e.name === 'AbortError' && signal && signal.aborted) throw e; const stale = memo.get(src.id); return { src, items: stale ? stale.items : [], ok: !!stale }; }
  }));
  const seen = new Set(), items = [];
  for (const { src, items: list } of results) {
    const keep = KEEP[src.group] || KEEP.global;
    for (const it of list.filter(x => now - Date.parse(x.published) <= keep.age)) {
      const key = it.link.replace(/^https?:\/\/(www\.)?/i, '').replace(/[?#].*$/, '').replace(/\/$/, '').toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      items.push({ id: hash(it.link), title: it.title, link: it.link, summary: it.summary, published: it.published, source: src.name, sourceId: src.id, group: src.group, score: relevance(it, src.group, now) });
    }
  }
  /* keep the best few of each group, with no one source taking over, then put the newest first */
  const picked = [];
  for (const g of GROUPS) {
    const keep = KEEP[g], per = new Map();
    for (const it of items.filter(x => x.group === g && x.score >= (g === 'global' ? 20 : 0)).sort((x, y) => y.score - x.score || (x.published < y.published ? 1 : -1))) {
      if (picked.filter(p => p.group === g).length >= keep.send) break;
      if ((per.get(it.sourceId) || 0) >= keep.perSource) continue;
      per.set(it.sourceId, (per.get(it.sourceId) || 0) + 1); picked.push(it);
    }
  }
  picked.sort((a, b) => (a.published < b.published ? 1 : a.published > b.published ? -1 : a.id < b.id ? -1 : 1));
  items.length = 0; items.push(...picked);
  const ok = results.filter(r => r.ok).length;
  if (!ok) throw new HttpError(502, 'No news source could be reached right now. Try again in a moment.');
  return { updated: new Date(now).toISOString(), items, sources: results.map(r => ({ id: r.src.id, name: r.src.name, group: r.src.group, ok: r.ok, count: items.filter(i => i.sourceId === r.src.id).length })) };
}
