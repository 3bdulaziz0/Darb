import { defineConfig, loadEnv, type Plugin, type ViteDevServer } from 'vite';
import react from '@vitejs/plugin-react';

/** Captured frames are a few hundred KB; this is headroom, not a target. */
const MAX_BODY_BYTES = 12 * 1024 * 1024;

/**
 * Serves the functions in api/ during `npm run dev`.
 *
 * In production the host runs these itself — Vercel turns every file in api/
 * into a serverless function. Vite does not, so without this the app would
 * work when deployed and 404 on your laptop, which is the worst way round.
 *
 * The handlers are written against a small { status, json } response shape, so
 * the same file runs unchanged in both places.
 */
function apiPlugin(): Plugin {
  return {
    name: 'rawi-api-dev',
    configureServer(server: ViteDevServer) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url?.split('?')[0];
        if (!url?.startsWith('/api/')) return next();

        const name = url.slice('/api/'.length).replace(/[^a-z0-9_-]/gi, '');
        if (!name) return next();

        const send = (status: number, body: unknown) => {
          res.statusCode = status;
          res.setHeader('content-type', 'application/json');
          res.end(JSON.stringify(body));
        };

        try {
          // Loaded through Vite so the handler is type-stripped and hot —
          // editing api/*.ts takes effect without restarting the server.
          const mod = await server.ssrLoadModule(`/api/${name}.ts`);
          const handler = mod.default;
          if (typeof handler !== 'function') return next();

          const body = await new Promise<string>((resolve, reject) => {
            let size = 0;
            const chunks: Buffer[] = [];
            req.on('data', (c: Buffer) => {
              size += c.length;
              if (size > MAX_BODY_BYTES) {
                reject(new Error('Request body is too large.'));
                req.destroy();
                return;
              }
              chunks.push(c);
            });
            req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
            req.on('error', reject);
          });

          await handler(
            { method: req.method, body },
            {
              status: (code: number) => ({ json: (payload: unknown) => send(code, payload) }),
            },
          );
        } catch (err) {
          send(500, { error: err instanceof Error ? err.message : 'Dev API error.' });
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  // Vite only exposes VITE_-prefixed variables, and only to the browser. The
  // API key deliberately has no prefix, so we load .env ourselves and put it
  // on process.env — where the api/ handlers read it, and where the browser
  // bundle can never see it. In production the host supplies these directly.
  const env = loadEnv(mode, process.cwd(), '');
  for (const key of ['GEMINI_API_KEY', 'GEMINI_MODEL', 'RAWI_CONFIDENCE_THRESHOLD']) {
    if (env[key]) process.env[key] = env[key];
  }

  return {
    plugins: [react(), apiPlugin()],
    server: {
      // host: true lets you open the dev server from a phone on the same Wi-Fi.
      // NOTE: camera + geolocation need a secure context. Plain
      // http://<lan-ip>:5173 will NOT grant them. See README.md — test on the
      // deployment preview URL.
      host: true,
      port: 5173,
    },
  };
});
