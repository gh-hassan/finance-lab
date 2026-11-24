import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseFeed, decode, plain, clip, inner, collect, relevance, SOURCES, resetNewsCache } from '../api/_news.js';
import handler, { resetNewsCache as reset2 } from '../api/news.js';
import { ago, kindOf, freshIds, frontPage, ofGroup, initials, hueOf, TABS, type NewsItem } from '../src/lib/news';
import { readNewsCache, writeNewsCache, prefetchNews } from '../src/ui/newscache.js';
import { call, mockFetch } from './helpers';

const NOW = Date.parse('2026-11-22T12:00:00Z');
const rss = (items: string) => `<?xml version="1.0"?><rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:content="http://purl.org/rss/1.0/modules/content/"><channel><title>Feed</title><link>https://example.com/</link>${items}</channel></rss>`;
const item = (t: string, l: string, d: string, desc = 'A short description that is long enough to keep.') => `<item><title>${t}</title><link>${l}</link><pubDate>${d}</pubDate><description>${desc}</description></item>`;

afterEach(() => { vi.unstubAllGlobals(); resetNewsCache(); reset2(); });

describe('reading feeds', () => {
  it('reads RSS stories with title, link, time and a clean summary', () => {
    const r = parseFeed(rss(item('Rates hold', 'https://example.com/a?x=1#top', 'Sun, 22 Nov 2026 08:00:00 GMT', '&lt;p&gt;The bank kept rates &amp; said <b>more</b> is coming.&lt;/p&gt;')), { now: NOW });
    expect(r).toHaveLength(1); expect(r[0]).toMatchObject({ title: 'Rates hold', link: 'https://example.com/a?x=1', published: '2026-11-22T08:00:00.000Z' });
    expect(r[0].summary).toBe('The bank kept rates & said more is coming.');
  });
  it('reads CDATA titles and links', () => {
    const r = parseFeed(rss(`<item><title><![CDATA[Big <b>news</b> & more]]></title><link><![CDATA[https://example.com/c]]></link><pubDate>Sun, 22 Nov 2026 08:00:00 GMT</pubDate></item>`), { now: NOW });
    expect(r[0].title).toBe('Big news & more'); expect(r[0].link).toBe('https://example.com/c');
  });
  it('reads Atom entries and picks the alternate link', () => {
    const xml = `<feed xmlns="http://www.w3.org/2005/Atom"><title>B</title><entry><title>Valuation notes</title><link rel="replies" href="https://example.com/r"/><link rel="alternate" type="text/html" href="https://example.com/post"/><published>2026-11-20T10:00:00Z</published><content type="html">&lt;p&gt;Long body text about valuation that goes on and on.&lt;/p&gt;</content></entry></feed>`;
    const r = parseFeed(xml, { now: NOW }); expect(r).toHaveLength(1); expect(r[0].link).toBe('https://example.com/post'); expect(r[0].summary).toContain('Long body text');
  });
  it('drops stories without a usable link, title or date, and unsafe links', () => {
    const r = parseFeed(rss([item('No date', 'https://example.com/1', 'not a date'), item('Bad scheme', 'javascript:alert(1)', 'Sun, 22 Nov 2026 08:00:00 GMT'), item('', 'https://example.com/2', 'Sun, 22 Nov 2026 08:00:00 GMT'), item('Fine', 'https://example.com/3', 'Sun, 22 Nov 2026 08:00:00 GMT')].join('')), { now: NOW });
    expect(r.map(x => x.title)).toEqual(['Fine']);
  });
  it('keeps the stories it got when a long feed is cut off', () => {
    const xml = rss(item('One', 'https://example.com/1', 'Sun, 22 Nov 2026 08:00:00 GMT') + item('Two', 'https://example.com/2', 'Sun, 22 Nov 2026 07:00:00 GMT')) + '';
    const cut = xml.slice(0, xml.indexOf('Two') + 20);
    expect(parseFeed(cut, { now: NOW }).map(x => x.title)).toEqual(['One']);
  });
  it('never lets a story be dated in the future, and drops summaries that only repeat the title', () => {
    const r = parseFeed(rss(item('Same words here for the title', 'https://example.com/9', 'Mon, 01 Jan 2029 00:00:00 GMT', 'Same words here for the title')), { now: NOW });
    expect(Date.parse(r[0].published)).toBeLessThanOrEqual(NOW); expect(r[0].summary).toBe('');
  });
  it('does not stack ellipses when a feed already ends its summary with dots', () => {
    const r = parseFeed(rss(item('Plots scenarios', 'https://example.com/e', 'Sun, 22 Nov 2026 08:00:00 GMT', 'Wharton senior fellow plots four trajectories for business leaders to follow as they plan their AI future, with all its potential risks and rewards. ...')), { now: NOW });
    expect(r[0].summary).not.toMatch(/(\.|…)\s*(\.|…)/); expect(r[0].summary.endsWith('rewards.')).toBe(true);
  });
  it('copes with empty, broken and non-feed text', () => { for (const x of ['', '<html>nope</html>', '<item><title>x', null as any]) expect(parseFeed(x, { now: NOW })).toEqual([]); });
  it('decodes entities and shortens on a whole word', () => {
    expect(decode('Fish &amp; chips &#8217;n&#x2019; &lt;3 &bogus;')).toBe('Fish & chips ’n’ <3 &bogus;'); expect(plain('<p>a  <b>b</b>\n c</p><script>x()</script>')).toBe('a b c');
    const c = clip('word '.repeat(80), 50); expect(c.length).toBeLessThanOrEqual(51); expect(c.endsWith('…')).toBe(true); expect(c).not.toMatch(/wor…$/);
  });
  it('finds the right tag, not one that only starts the same way', () => { expect(inner('<linked>x</linked><link>y</link>', 'link')).toBe('y'); expect(inner('<a/>', 'a')).toBe(''); });
});

describe('collecting every source', () => {
  const feedFor = (url: string) => {
    const host = new URL(url).host, n = host.length;
    return { text: rss(item(`Stocks and rates: story from ${host}`, `https://${host}/one`, 'Sun, 22 Nov 2026 08:00:00 GMT') + item(`Stocks and rates: older from ${host}`, `https://${host}/two`, `Sat, 21 Nov 2026 0${n % 9}:00:00 GMT`) + item(`Ancient from ${host}`, `https://${host}/old`, 'Mon, 01 Jan 2024 00:00:00 GMT')) };
  };
  it('merges the sources newest first, drops stale stories and tags each with its group', async () => {
    mockFetch(feedFor);
    const r = await collect({ now: NOW });
    expect(r.items.length).toBeGreaterThan(20); expect(r.items.every(i => !/Ancient/.test(i.title))).toBe(true);
    for (let i = 1; i < r.items.length; i++) expect(r.items[i - 1].published >= r.items[i].published).toBe(true);
    expect(new Set(r.items.map(i => i.group))).toEqual(new Set(['global', 'local', 'policy', 'learn'])); expect(r.sources).toHaveLength(SOURCES.length); expect(r.items.every(i => /^https:\/\//.test(i.link))).toBe(true);
  });
  it('removes the same story that two sources both carry', async () => {
    mockFetch(() => ({ text: rss(item('Stocks and rates: same story', 'https://example.com/same?utm=1', 'Sun, 22 Nov 2026 08:00:00 GMT')) }));
    expect((await collect({ now: NOW })).items).toHaveLength(1);
  });
  it('carries on without a source that fails, and says which one', async () => {
    mockFetch(u => (u.includes('dawn.com') ? { status: 500, text: '' } : feedFor(u)));
    const r = await collect({ now: NOW }); expect(r.sources.find(s => s.id === 'dawn')).toMatchObject({ ok: false, count: 0, why: 'answered 500' }); expect(r.items.some(i => i.sourceId === 'cnbc')).toBe(true);
  });
  it('does not wait for a slow source, says why it is missing, and has it ready next time', async () => {
    mockFetch(u => (u.includes('dawn.com') ? new Promise(r => setTimeout(() => r(feedFor(u)), 120)) : feedFor(u)));
    const first = await collect({ now: NOW, deadline: 20 }), d = first.sources.find(x => x.id === 'dawn')!;
    expect(d).toMatchObject({ ok: false, count: 0, why: 'slow' }); expect(first.items.some(i => i.sourceId === 'cnbc')).toBe(true);
    await new Promise(r => setTimeout(r, 250));
    const second = await collect({ now: NOW + 1000, deadline: 20 }); expect(second.sources.find(x => x.id === 'dawn')).toMatchObject({ ok: true }); expect(second.items.some(i => i.sourceId === 'dawn')).toBe(true);
  });
  it('gives up with a clear message when nothing can be reached', async () => {
    mockFetch(() => ({ status: 503, text: '' })); await expect(collect({ now: NOW })).rejects.toThrow(/No news source/);
  });
  it('only ever asks the fixed, https addresses in the source list', async () => {
    const m = mockFetch(feedFor); await collect({ now: NOW });
    expect(m.calls.every(u => SOURCES.some(s => s.url === u) && u.startsWith('https://'))).toBe(true); expect(new Set(SOURCES.map(s => s.id)).size).toBe(SOURCES.length);
  });
  it('is served as short-lived JSON and refuses options it does not know', async () => {
    mockFetch(feedFor);
    const ok = await call(handler); expect(ok.status).toBe(200); expect(ok.headers['cache-control']).toMatch(/s-maxage=120/); expect(ok.body.items.length).toBeGreaterThan(0);
    expect((await call(handler, { q: 'x' })).status).toBe(400); expect((await call(handler, {}, 'POST')).status).toBe(405);
  });
});

describe('choosing the most relevant stories', () => {
  const it_ = (title: string, hoursAgo: number, summary = '') => ({ title, summary, published: new Date(NOW - hoursAgo * 36e5).toISOString() });
  it('ranks a story about money above general news, and newer above older', () => {
    expect(relevance(it_('Central bank raises interest rates as inflation climbs', 3), 'global', NOW)).toBeGreaterThan(relevance(it_('Italian jeweller dies aged 89', 3), 'global', NOW) * 4);
    expect(relevance(it_('Stocks fall as investors fear a recession', 2), 'global', NOW)).toBeGreaterThan(relevance(it_('Stocks fall as investors fear a recession', 30), 'global', NOW));
  });
  it('lets articles and central bank notes age slowly', () => {
    expect(relevance(it_('Valuation notes', 24 * 7), 'learn', NOW)).toBeGreaterThan(relevance(it_('Valuation notes', 24 * 7), 'global', NOW) * 50);
  });
  it('sends only the best few of each group, never lets one source take over, and gives each story a score', async () => {
    mockFetch(u => { const host = new URL(u).host; return { text: rss(Array.from({ length: 20 }, (_, i) => item(`Stocks and rates story ${i} from ${host}`, `https://${host}/s${i}`, new Date(NOW - i * 36e5).toUTCString())).join('')) }; });
    const r = await collect({ now: NOW }), count = (g: string) => r.items.filter(i => i.group === g).length;
    expect(count('global')).toBeLessThanOrEqual(10); expect(count('local')).toBeLessThanOrEqual(10); expect(count('policy')).toBeLessThanOrEqual(6); expect(count('learn')).toBeLessThanOrEqual(8); expect(r.items.length).toBeLessThanOrEqual(34);
    for (const g of ['global', 'policy', 'learn']) { const per: Record<string, number> = {}; r.items.filter(i => i.group === g).forEach(i => { per[i.sourceId] = (per[i.sourceId] || 0) + 1; }); expect(Math.max(...Object.values(per)), g).toBeLessThanOrEqual(g === 'global' ? 4 : g === 'policy' ? 3 : 2); }
    expect(r.items.every(i => typeof (i as any).score === 'number')).toBe(true); expect(JSON.stringify(r).length).toBeLessThan(40000);
  });
  it('leaves out general news that is not about money', async () => {
    mockFetch(u => ({ text: rss(item('A celebrity gets married in a quiet ceremony', `https://${new URL(u).host}/x`, 'Sun, 22 Nov 2026 11:00:00 GMT', 'Friends and family gathered for the day.') + item('Bank raises interest rates as inflation rises', `https://${new URL(u).host}/y`, 'Sun, 22 Nov 2026 10:00:00 GMT', 'Markets reacted at once.')) }));
    const r = await collect({ now: NOW }); expect(r.items.filter(i => i.group === 'global').every(i => /interest rates/.test(i.title))).toBe(true);
  });
});

const mk = (id: string, group: NewsItem['group'], over: Partial<NewsItem> = {}): NewsItem => ({ id, title: 'T' + id, link: 'https://x.test/' + id, summary: '', published: '2026-11-22T10:00:00Z', source: 'Dawn Business', sourceId: 'dawn', group, score: 10, ...over });
describe('news page helpers', () => {
  it('says how old a story is in plain words', () => {
    const now = Date.parse('2026-11-22T12:00:00Z');
    expect([ago('2026-11-22T11:59:40Z', now), ago('2026-11-22T11:48:00Z', now), ago('2026-11-22T09:00:00Z', now), ago('2026-11-21T09:00:00Z', now), ago('2026-11-18T09:00:00Z', now), ago('2026-10-02T09:00:00Z', now), ago('2025-10-02T09:00:00Z', now), ago('nope', now)]).toEqual(['just now', '12 min ago', '3 h ago', 'yesterday', '4 days ago', '2 Oct', '2 Oct 2025', '']);
  });
  it('names the kind of story', () => {
    expect(kindOf(mk('1', 'local'))).toBe('Pakistan'); expect(kindOf(mk('2', 'learn', { title: 'A case study of Boeing' }))).toBe('Case study'); expect(kindOf(mk('3', 'learn', { sourceId: 'fed-notes' }))).toBe('Research note'); expect(kindOf(mk('4', 'learn'))).toBe('Article');
  });
  it('finds which stories are new', () => { expect(freshIds(new Set(['a', 'b']), [mk('a', 'global'), mk('c', 'global'), mk('d', 'local')])).toEqual(['c', 'd']); expect(freshIds(new Set(), [])).toEqual([]); });
  it('lays out the front page: one lead, four more, short lists, and never the same story twice', () => {
    const items = [...Array.from({ length: 8 }, (_, i) => mk('g' + i, 'global', { score: 90 - i, published: `2026-11-22T0${i}:00:00Z` })), ...Array.from({ length: 7 }, (_, i) => mk('l' + i, 'local', { score: 50 - i, published: `2026-11-21T0${i}:00:00Z` })), ...Array.from({ length: 6 }, (_, i) => mk('p' + i, 'policy', { score: 20 - i })), ...Array.from({ length: 6 }, (_, i) => mk('a' + i, 'learn', { score: 60 - i }))];
    const f = frontPage(items), ids = [f.lead, ...f.next, ...f.global, ...f.local, ...f.policy, ...f.learn].filter(Boolean).map(x => (x as NewsItem).id);
    expect(f.lead!.id).toBe('g0'); expect(f.next.map(x => x.id)).toEqual(['g1', 'g2', 'g3', 'g4']); expect(f.global).toHaveLength(3); expect(f.local).toHaveLength(5); expect(f.policy).toHaveLength(4); expect(f.learn).toHaveLength(4); expect(new Set(ids).size).toBe(ids.length);
    expect(f.learn.every(x => x.group === 'learn')).toBe(true); expect(f.next.concat(f.lead!).every(x => x.group !== 'learn')).toBe(true);
  });
  it('copes with no stories at all', () => { const f = frontPage([]); expect(f.lead).toBeNull(); expect(f.next).toEqual([]); expect(ofGroup([], 'local')).toEqual([]); });
  it('lists a group newest first', () => { expect(ofGroup([mk('a', 'local', { published: '2026-11-20T00:00:00Z' }), mk('b', 'local', { published: '2026-11-22T00:00:00Z' }), mk('c', 'global')], 'local').map(x => x.id)).toEqual(['b', 'a']); });
  it('gives each source steady initials and a steady colour', () => {
    expect(initials('Dawn Business')).toBe('DB'); expect(initials('MarketWatch')).toBe('MA'); expect(initials('')).toBe('?'); expect(hueOf('dawn')).toBe(hueOf('dawn')); expect(hueOf('dawn')).not.toBe(hueOf('cnbc')); expect(hueOf('x')).toBeLessThan(360);
  });
  it('has a tab for the front page and for each group', () => { expect(TABS.map(t => t[0])).toEqual(['top', 'global', 'local', 'policy', 'learn']); });
});

describe('keeping the last news for an instant open', () => {
  const store: Record<string, string> = {};
  const setup = () => { for (const k of Object.keys(store)) delete store[k]; vi.stubGlobal('localStorage', { getItem: (k: string) => (k in store ? store[k] : null), setItem: (k: string, v: string) => { store[k] = v; } }); };
  it('saves and reads the news, and ignores a broken or very old copy', () => {
    setup(); expect(readNewsCache()).toBeNull();
    writeNewsCache({ updated: 'x', items: [{ id: 'a' }] }); expect(readNewsCache()!.data.items).toHaveLength(1);
    store['fl:news:v2'] = '{not json'; expect(readNewsCache()).toBeNull();
    store['fl:news:v2'] = JSON.stringify({ at: Date.now() - 3 * 864e5, data: { items: [] } }); expect(readNewsCache()).toBeNull();
    store['fl:news:v2'] = JSON.stringify({ at: Date.now(), data: { items: 'no' } }); expect(readNewsCache()).toBeNull();
  });
  it('does not throw when storage is blocked', () => {
    vi.stubGlobal('localStorage', { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } });
    expect(readNewsCache()).toBeNull(); expect(() => writeNewsCache({ items: [] })).not.toThrow();
  });
  it('asks for the news once when called many times, and keeps what it got', async () => {
    setup();
    const m = mockFetch(() => ({ json: { updated: 'x', items: [{ id: 'z' }] } }));
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, headers: { get: () => 'application/json' }, json: async () => ({ updated: 'x', items: [{ id: 'z' }] }) })));
    const [a, b] = await Promise.all([prefetchNews(), prefetchNews()]);
    expect(a).toEqual(b); expect((fetch as any).mock.calls).toHaveLength(1); expect(readNewsCache()!.data.items[0].id).toBe('z'); void m;
  });
});

describe('news page styles stay out of the way of the rest of the site', () => {
  /* the site already has global classes such as .big (huge answer figures) and .lead; an unprefixed name here once squashed every story's text */
  const js = readFileSync(new URL('../src/ui/news.js', import.meta.url), 'utf8'), css = readFileSync(new URL('../src/styles/news.css', import.meta.url), 'utf8');
  it('gives every class the page uses its own nw- prefix', () => {
    const used = [...js.matchAll(/(?:class:\s*|link\(|h\('[a-z]+',\s*\{\s*class:\s*)(?:'([^']+)'|`([^`]+)`)/g)].flatMap(m => (m[1] || m[2]).split(/\s+/)).filter(Boolean);
    const stray = [...new Set(used)].filter(c => !/^(nw-|d-)/.test(c) && !/^\$\{/.test(c));
    expect(stray).toEqual([]);
    for (const m of js.matchAll(/'(nw-[a-z-]+)(?: ([a-z-]+))+'/g)) for (const c of m[0].replace(/'/g, '').split(' ')) expect(c, m[0]).toMatch(/^nw-/);
  });
  it('styles only nw- classes', () => {
    const noKeyframes = css.replace(/@keyframes\s+\w+\s*\{[^}]*\{[^}]*\}[^}]*\{[^}]*\}\s*\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
    const classes = [...noKeyframes.matchAll(/\.([a-zA-Z_][\w-]*)/g)].map(m => m[1]);
    expect(classes.filter(c => !c.startsWith('nw-'))).toEqual([]);
  });
});
