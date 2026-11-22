/** The printed report as HTML text. Pure, so it can be tested. "Print or PDF" builds this instead of printing the live page, which is full
    of sliders and animations: title, the answer, key figures, the inputs used, the working, any tables and the assumptions. */
export interface ReportCard { head?: string; key?: boolean; label?: string; value?: string; sub?: string; tone?: string }
export interface ReportTable { title: string; cols: string[]; rows: any[]; left?: boolean }
export interface ReportData { title: string; ask?: string; blurb?: string; topic?: string; headline?: string; units?: string; url?: string; key?: ReportCard | null; inputs?: [string, string][]; out?: { cards?: ReportCard[]; steps?: [string, string][]; tables?: ReportTable[]; note?: string; info?: string }; assume?: string[] }

const MAP: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = (x: unknown): string => String(x == null ? '' : x).replace(/[&<>"']/g, c => MAP[c]);
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const reportDate = (d: Date): string => `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
const html = (tag: string, cls: string, inner: string): string => `<${tag}${cls ? ` class="${cls}"` : ''}>${inner}</${tag}>`;

function table(t: ReportTable): string {
  const cell = (c: any): string => { const [txt, st] = Array.isArray(c) ? c : [c, '']; return `<td${st ? ` style="${esc(st)}"` : ''}>${esc(txt)}</td>`; };
  const head = `<tr>${t.cols.map(c => `<th>${esc(c)}</th>`).join('')}</tr>`;
  const rows = (t.rows || []).map(r => (r.h ? `<tr class="gh"><td colspan="${t.cols.length}">${esc(r.h)}</td></tr>` : `<tr>${r.map(cell).join('')}</tr>`)).join('');
  return html('section', 'rp-sec rp-tbl' + ((t.rows || []).length <= 14 ? ' keep' : ''), `<h2>${esc(t.title)}</h2><table class="${t.left ? 'left' : ''}"><thead>${head}</thead><tbody>${rows}</tbody></table>`);
}

/** Key figures as small tiles, with the group headings that the calculator gives them. */
function figures(cards: ReportCard[], key: ReportCard | null | undefined): string {
  const out: string[] = []; let open = false;
  const close = () => { if (open) { out.push('</div>'); open = false; } };
  for (const c of cards) {
    if (c === key || (key && !c.head && c.label === key.label && c.value === key.value)) continue;
    if (c.head) { close(); out.push(`<h3 class="rp-grp">${esc(c.head)}</h3><div class="rp-tiles">`); open = true; continue; }
    if (!open) { out.push('<div class="rp-tiles">'); open = true; }
    out.push(`<div class="rp-tile ${esc(c.tone || '')}"><span>${esc(c.label)}</span><b>${esc(c.value)}</b>${c.sub ? `<small>${esc(c.sub)}</small>` : ''}</div>`);
  }
  close();
  return out.join('');
}

export function reportHtml(r: ReportData, now: Date = new Date()): string {
  const out = r.out || {}, cards = out.cards || [], key = r.key || cards.find(c => c.key) || cards.find(c => !c.head), parts: string[] = [];
  parts.push(html('header', 'rp-head', `<div class="rp-brand"><b>LUMS</b><span>Suleman Dawood School of Business</span><i>Finance Fundamentals</i></div><div class="rp-kind"><b>Calculation report</b><span>${esc(reportDate(now))}</span></div>`));
  parts.push(html('div', 'rp-titlebox', `${r.topic ? `<p class="rp-topic">${esc(r.topic)}</p>` : ''}<h1>${esc(r.title)}</h1>${r.ask ? `<p class="rp-ask">${esc(r.ask)}</p>` : r.blurb ? `<p class="rp-ask">${esc(r.blurb)}</p>` : ''}`));
  if (key && key.value != null) parts.push(html('section', 'rp-result', `<span class="rp-rl">${esc(key.label || 'Result')}</span><b class="rp-rv">${esc(key.value)}</b>${r.headline ? `<p>${esc(r.headline)}</p>` : key.sub ? `<p>${esc(key.sub)}</p>` : ''}`));
  if (out.note) parts.push(html('p', 'rp-note warn', `<b>Note.</b> ${esc(out.note)}`));
  if (out.info) parts.push(html('p', 'rp-note', esc(out.info)));
  const fig = figures(cards, key);
  if (fig) parts.push(html('section', 'rp-sec', `<h2>Key figures</h2>${fig}`));
  if ((r.inputs || []).length) parts.push(html('section', 'rp-sec rp-inputs', `<h2>The numbers used</h2>${r.units ? `<p class="rp-cap">${esc(r.units)}</p>` : ''}<table class="left"><tbody>${(r.inputs || []).map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join('')}</tbody></table>`));
  if ((out.steps || []).length) parts.push(html('section', 'rp-sec rp-steps', `<h2>How the answer was worked out</h2><ol>${(out.steps || []).map(s => `<li><b>${esc(s[0])}</b><code>${esc(s[1])}</code></li>`).join('')}</ol>`));
  (out.tables || []).filter(t => t && t.cols).forEach(t => parts.push(table(t)));
  if ((r.assume || []).length) parts.push(html('section', 'rp-sec', `<h2>What this calculation assumes</h2><ul>${(r.assume || []).map(x => `<li>${esc(x)}</li>`).join('')}</ul>`));
  parts.push(html('footer', 'rp-foot', `<p><b>For study and practice, not investment advice.</b> Results depend on the numbers entered and on simplifying assumptions. Past results do not predict the future.</p><p>Made with Finance Fundamentals, Suleman Dawood School of Business, LUMS${r.url ? ' · ' + esc(r.url) : ''}</p>`));
  return parts.join('');
}
