/* Parse a YouTube channel's public RSS feed into a plain list of videos. Pure functions, no network, so they can be tested. */

const ENTITIES = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&apos;': "'" };
export const decode = s => String(s || '').replace(/&(amp|lt|gt|quot|apos|#39);/g, m => ENTITIES[m]).replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));
const pick = (xml, re) => { const m = re.exec(xml); return m ? decode(m[1]).trim() : ''; };

export const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

/** Turn the feed text into [{ id, title, published, description, views }], newest first. Entries with an odd id are dropped. */
export function parseFeed(xml) {
  const entries = String(xml || '').match(/<entry>[\s\S]*?<\/entry>/g) || [];
  return entries.map(e => ({
    id: pick(e, /<yt:videoId>([^<]*)<\/yt:videoId>/),
    title: pick(e, /<title>([^<]*)<\/title>/),
    published: pick(e, /<published>([^<]*)<\/published>/),
    description: pick(e, /<media:description>([\s\S]*?)<\/media:description>/).slice(0, 400),
    views: Number((/<media:statistics[^>]*views="(\d+)"/.exec(e) || [])[1] || 0)
  })).filter(v => VIDEO_ID.test(v.id) && v.title).sort((a, b) => (a.published < b.published ? 1 : -1));
}
