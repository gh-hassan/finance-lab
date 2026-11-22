/* Serverless function: finance news and learning articles.
     GET /api/news   -> { updated, items: [{ id, title, link, summary, published, source, sourceId, group }], sources: [{ id, name, group, ok, count }] }
   Stories come from public RSS and Atom feeds listed in _news.js: world markets, Pakistan, central banks and regulators, and free articles and
   case studies from universities and research groups. We keep a headline, a short summary, the time and the link, and nothing else.
   The page asks again every couple of minutes, so the answer is cached for a short time only. */
import { route } from './_http.js';
import { collect, resetNewsCache } from './_news.js';

export { resetNewsCache };
export default route(({ signal }) => collect({ signal }), { cache: 's-maxage=120, stale-while-revalidate=600', timeout: 15000, allow: [] });
