import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const registry = read('src/ui/datapages.js');
const pages = [...registry.matchAll(/\{ id: '([a-z\-]+)', title: '([^']+)', blurb: '([^']+)', load: \(\) => import\('\.\/([a-z\-]+\.js)'\), fn: '(\w+)'/g)].map(m => ({ id: m[1], title: m[2], blurb: m[3], file: m[4], fn: m[5] }));
const apiFiles = readdirSync(new URL('../api', import.meta.url)).filter(f => f.endsWith('.js'));
const functions = apiFiles.filter(f => !f.startsWith('_'));

/** Every outside host our server code is allowed to call. Adding a source means adding it here on purpose. */
const ALLOWED_HOSTS = ['www.sec.gov', 'data.sec.gov', 'fred.stlouisfed.org', 'api.fiscaldata.treasury.gov', 'mba.tuck.dartmouth.edu', 'api.frankfurter.dev', 'api.worldbank.org', 'api.coingecko.com', 'www.coingecko.com', 'www.ecb.europa.eu', 'data.worldbank.org', 'fiscaldata.treasury.gov', 'home.treasury.gov', 'query1.finance.yahoo.com', 'www.youtube.com', 'finance-lab-nine.vercel.app', 'www.w3.org'];

describe('live data page registry', () => {
  it('lists every page with a unique id and a real module that exports its function', () => {
    expect(pages.length).toBeGreaterThanOrEqual(2);
    expect(new Set(pages.map(p => p.id)).size).toBe(pages.length);
    for (const p of pages) {
      expect(existsSync(new URL(`../src/ui/${p.file}`, import.meta.url)), p.id).toBe(true);
      expect(read(`src/ui/${p.file}`), p.id).toMatch(new RegExp(`export function ${p.fn}\\(`));
      expect(p.title.length).toBeGreaterThan(3); expect(p.blurb.length).toBeLessThan(60);
    }
  });
  it('has an icon for each page so the menu never shows a blank', () => {
    const icons = read('src/ui/icons.js');
    for (const p of pages) expect(icons, p.id).toContain(`'d-${p.id}'`);
  });
});

describe('serverless functions', () => {
  it('stays under the free plan limit of 12 functions', () => { expect(functions.length).toBeLessThanOrEqual(12); });
  it('exports a default handler from every function file', () => {
    for (const f of functions) expect(read(`api/${f}`), f).toMatch(/export default/);
  });
  it('is only asked for by pages through functions that exist', () => {
    for (const f of readdirSync(new URL('../src/ui', import.meta.url)).filter(x => x.endsWith('.js'))) {
      for (const m of read(`src/ui/${f}`).matchAll(/\bapi\('([a-z\-]+)'/g)) expect(functions, `${f} calls /api/${m[1]}`).toContain(`${m[1]}.js`);
      for (const m of read(`src/ui/${f}`).matchAll(/fetch\('\/api\/([a-z\-]+)/g)) expect(functions, `${f} fetches /api/${m[1]}`).toContain(`${m[1]}.js`);
    }
  });
  it('only ever calls hosts on the allow-list (no user-chosen URLs)', () => {
    for (const f of apiFiles) {
      for (const m of read(`api/${f}`).matchAll(/https?:\/\/([a-z0-9.\-]+)/gi)) expect(ALLOWED_HOSTS, `${f} mentions ${m[1]}`).toContain(m[1].toLowerCase());
    }
  });
  it('never builds a request URL from a bare query value without validating it', () => {
    for (const f of functions) {
      const src = read(`api/${f}`);
      if (f === 'videos.js' || f === 'quote.js') continue;
      expect(src, f).toMatch(/route\(/);
      if (/\bq\.|\bq\[|\{ q\b|\bq,/.test(src)) expect(src, f).toMatch(/pick\(/);
    }
  });
  it('declares exactly which query options it accepts, so the CDN cache cannot be bypassed', () => {
    for (const f of functions) { if (f === 'videos.js' || f === 'quote.js') continue; expect(read(`api/${f}`), f).toMatch(/allow:|route\(async \(\{ signal \}\)/); }
  });
  it('never logs request values or sends raw upstream text to the browser', () => {
    for (const f of apiFiles) { const src = read(`api/${f}`); expect(src, f).not.toMatch(/console\.log/); expect(src, f).not.toMatch(/res\.end\(.*(e\.stack|e\.message)/); }
  });
});

describe('deployment config', () => {
  const v = JSON.parse(read('vercel.json')), csp: string = v.headers.flatMap((h: any) => h.headers).find((h: any) => h.key === 'Content-Security-Policy').value;
  it('keeps the page locked to its own origin for scripts and connections', () => {
    expect(csp).toMatch(/connect-src 'self'(;|$)/); expect(csp).not.toMatch(/unsafe-eval/); expect(csp).not.toMatch(/script-src[^;]*unsafe-inline/); expect(csp).toMatch(/object-src 'none'/); expect(csp).toMatch(/frame-ancestors 'none'/);
  });
  it('gives the heavy SEC function enough time', () => { expect(v.functions['api/edgar.js'].maxDuration).toBeGreaterThanOrEqual(20); });
  it('sends every route except assets and the api to the app', () => { expect(v.rewrites[0].source).toMatch(/api\//); });
});
