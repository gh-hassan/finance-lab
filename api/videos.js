/* Serverless function: GET /api/videos
   Reads the SmartWealth YouTube channel's public RSS feed (no key needed) and returns its latest videos.
   The page keeps a built-in list as a fallback, so a failure here is harmless. */
import { parseFeed } from './_videos.js';

const CHANNEL = 'UCJuAJsnCM3U5wdzIjwuHudw';

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 8000);
  try {
    const r = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${CHANNEL}`, { signal: ctl.signal, headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SmartWealthSite/1.0)' } });
    if (!r.ok) throw new Error(`YouTube answered ${r.status}`);
    const videos = parseFeed(await r.text());
    if (!videos.length) throw new Error('No videos found in the feed');
    res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=86400');
    res.statusCode = 200; res.end(JSON.stringify({ channel: CHANNEL, videos }));
  } catch (e) {
    res.statusCode = 502; res.end(JSON.stringify({ error: e && e.name === 'AbortError' ? 'YouTube took too long.' : (e && e.message) || 'Could not load videos.' }));
  } finally { clearTimeout(timer); }
}
