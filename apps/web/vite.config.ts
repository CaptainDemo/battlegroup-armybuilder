import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import { fileURLToPath } from 'node:url';
import { collectCatalogAssets } from '../../tools/data-import/catalogAssets';

function catalogAssets(): Plugin {
  const root = fileURLToPath(new URL('../../', import.meta.url));
  let base = '/';
  return {
    name: 'indexed-catalog-assets',
    configResolved(config) { base = config.base; },
    configureServer(server) {
      const assets = collectCatalogAssets(root);
      server.middlewares.use((request, response, next) => {
        const pathname = (request.url ?? '').split('?')[0]!;
        const path = pathname.startsWith(base) ? pathname.slice(base.length) : pathname.replace(/^\//, '');
        const bytes = assets.get(path);
        if (!bytes) return next();
        response.setHeader('Content-Type', 'application/json');
        response.end(bytes);
      });
    },
    generateBundle() {
      for (const [fileName, source] of collectCatalogAssets(root)) this.emitFile({type: 'asset', fileName, source});
    },
  };
}

/**
 * Asset base path is configurable for sub-path hosting (for example
 * VITE_BASE=/armybuilder/ in apps/web/.env.<mode>). Hash routing keeps
 * application routes working regardless of the deployed base path.
 */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  return {
    publicDir: false,
    base: env.VITE_BASE || '/',
    plugins: [react(), catalogAssets()],
  };
});
