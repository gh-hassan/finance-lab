import { existsSync } from 'node:fs';
import { defineConfig } from 'vitest/config';

/** In development, serve the same /api functions that Vercel runs in production, so live data can be tried locally. */
const devApi = {
  name: 'dev-api',
  configureServer(server: { middlewares: { use: (fn: (req: any, res: any, next: () => void) => void) => void }; ssrLoadModule: (p: string) => Promise<any> }) {
    server.middlewares.use(async (req, res, next) => {
      const m = req.url && /^\/api\/([a-z][a-z0-9-]*)(?:\?|$)/.exec(req.url);
      if (!m || !existsSync(`api/${m[1]}.js`)) return next();
      try {
        const mod = await server.ssrLoadModule(`/api/${m[1]}.js`);
        req.query = Object.fromEntries(new URL(req.url, 'http://localhost').searchParams);
        await mod.default(req, res);
      } catch (e) { res.statusCode = 500; res.end(JSON.stringify({ error: 'Local data function failed.' })); }
    });
  }
};

export default defineConfig({
  plugins: [devApi],
  /* flags are loaded one by one when shown, so none are packed into the script as base64 */
  build: { target: 'es2022', sourcemap: false, assetsInlineLimit: (file: string) => (file.includes('/assets/flags/') ? false : undefined) },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: { provider: 'v8', include: ['src/lib/**', 'src/modules/**'], reporter: ['text'] }
  }
});
