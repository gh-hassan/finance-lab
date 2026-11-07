import { defineConfig } from 'vitest/config';

/** In development, serve the same /api functions that Vercel runs in production, so live data can be tried locally. */
const devApi = {
  name: 'dev-api',
  configureServer(server: { middlewares: { use: (fn: (req: any, res: any, next: () => void) => void) => void }; ssrLoadModule: (p: string) => Promise<any> }) {
    server.middlewares.use(async (req, res, next) => {
      const route = req.url && ['/api/quote', '/api/videos'].find(r => req.url.startsWith(r));
      if (!route) return next();
      try {
        const mod = await server.ssrLoadModule(route + '.js');
        req.query = Object.fromEntries(new URL(req.url, 'http://localhost').searchParams);
        await mod.default(req, res);
      } catch (e) { res.statusCode = 500; res.end(JSON.stringify({ error: 'Local data function failed.' })); }
    });
  }
};

export default defineConfig({
  plugins: [devApi],
  build: { target: 'es2022', sourcemap: false },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: { provider: 'v8', include: ['src/lib/**', 'src/modules/**'], reporter: ['text'] }
  }
});
