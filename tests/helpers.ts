import { vi } from 'vitest';

/** Calls a serverless handler the way Vercel does and returns what it sent. */
export async function call(handler: (req: any, res: any) => Promise<void>, query: Record<string, any> = {}, method = 'GET') {
  const headers: Record<string, string> = {};
  let status = 0, text = '';
  const res = { statusCode: 200, setHeader: (k: string, v: string) => { headers[k.toLowerCase()] = String(v); }, end: (t: string) => { text = t; } };
  await handler({ method, query }, res);
  status = res.statusCode;
  let body: any = null;
  try { body = JSON.parse(text); } catch { /* not json */ }
  return { status, body, headers, text };
}

/** Replaces fetch with a function that answers by URL. Return a Response-like object. */
export function mockFetch(answer: (url: string) => any) {
  const calls: string[] = [];
  const fn = vi.fn(async (url: string) => {
    calls.push(String(url));
    const a: any = await answer(String(url));
    if (a instanceof Error) throw a;
    const status = a.status ?? 200;
    return { ok: status >= 200 && status < 300, status, json: async () => a.json, text: async () => (a.text ?? JSON.stringify(a.json)), arrayBuffer: async () => (a.bytes ?? new TextEncoder().encode(a.text ?? '')).buffer };
  });
  vi.stubGlobal('fetch', fn);
  return { calls, fn };
}
