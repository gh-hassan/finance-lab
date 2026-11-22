/** Small pure helpers for the news page: how old a story is, which stories are new, and how the front page is laid out. */
export interface NewsItem { id: string; title: string; link: string; summary: string; published: string; source: string; sourceId: string; group: 'global' | 'local' | 'policy' | 'learn'; score?: number }
export type Tab = 'top' | NewsItem['group'];

export const TABS: [Tab, string][] = [['top', 'Top stories'], ['global', 'World business'], ['local', 'Pakistan'], ['policy', 'Central banks'], ['learn', 'Read and learn']];
export const GROUP_LABEL: Record<NewsItem['group'], string> = { global: 'World business', local: 'Pakistan', policy: 'Central bank or regulator', learn: 'Article' };

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "just now", "12 min ago", "3 h ago", "yesterday", "5 days ago", then a plain date. */
export function ago(iso: string, now: number = Date.now()): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return '';
  const s = Math.max(0, Math.round((now - t) / 1000));
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  const d = Math.floor(s / 86400);
  if (d === 1) return 'yesterday';
  if (d < 7) return `${d} days ago`;
  const x = new Date(t);
  return `${x.getUTCDate()} ${MONTHS[x.getUTCMonth()]}${x.getUTCFullYear() !== new Date(now).getUTCFullYear() ? ' ' + x.getUTCFullYear() : ''}`;
}

/** What kind of reading a learning item is. Most are articles; research notes and anything that says "case study" are called that. */
export function kindOf(it: Pick<NewsItem, 'group' | 'title' | 'summary' | 'sourceId'>): string {
  if (it.group !== 'learn') return GROUP_LABEL[it.group];
  if (/\bcase stud(y|ies)\b|\bcase\b:/i.test(it.title + ' ' + it.summary)) return 'Case study';
  if (it.sourceId === 'fed-notes') return 'Research note';
  return 'Article';
}

/** Two letters for a source, such as "DB" for Dawn Business, and a steady colour for it. */
export const initials = (source: string): string => { const w = source.replace(/[^A-Za-z0-9 ]/g, ' ').split(/\s+/).filter(Boolean); return ((w[0] || '?')[0] + (w[1] ? w[1][0] : (w[0] || '?')[1] || '')).toUpperCase(); };
export const hueOf = (key: string): number => { let a = 7; for (const c of key) a = (Math.imul(a, 31) + c.charCodeAt(0)) >>> 0; return a % 360; };

/** Stories in `next` that the reader has not been shown yet. */
export const freshIds = (known: ReadonlySet<string>, next: readonly NewsItem[]): string[] => next.filter(i => !known.has(i.id)).map(i => i.id);

const byScore = (a: NewsItem, b: NewsItem) => (b.score ?? 0) - (a.score ?? 0) || (a.published < b.published ? 1 : -1);
const byTime = (a: NewsItem, b: NewsItem) => (a.published < b.published ? 1 : a.published > b.published ? -1 : a.id < b.id ? -1 : 1);

/** Stories of one group, newest first. */
export const ofGroup = (items: readonly NewsItem[], g: NewsItem['group']): NewsItem[] => items.filter(i => i.group === g).sort(byTime);

export interface Front { lead: NewsItem | null; next: NewsItem[]; global: NewsItem[]; local: NewsItem[]; policy: NewsItem[]; learn: NewsItem[] }
/** The front page: one lead story, four more of the best, a short list per group, and a few things to read. A story is never shown twice. */
export function frontPage(items: readonly NewsItem[]): Front {
  const news = items.filter(i => i.group !== 'learn').sort(byScore), lead = news[0] ?? null, next = news.slice(1, 5), used = new Set([lead, ...next].filter(Boolean).map(i => (i as NewsItem).id));
  const rest = (g: NewsItem['group'], n: number) => ofGroup(items, g).filter(i => !used.has(i.id)).slice(0, n);
  return { lead, next, global: rest('global', 5), local: rest('local', 5), policy: rest('policy', 4), learn: items.filter(i => i.group === 'learn').sort(byScore).slice(0, 4) };
}
