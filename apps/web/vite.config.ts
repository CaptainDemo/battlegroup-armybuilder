import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';
import { fileURLToPath } from 'node:url';

/**
 * Asset base path is configurable for sub-path hosting (for example
 * VITE_BASE=/armybuilder/ in apps/web/.env.<mode>). Hash routing keeps
 * application routes working regardless of the deployed base path.
 */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  return {
    publicDir: fileURLToPath(new URL('../../packages/catalogs/classic-coldwar/public', import.meta.url)),
    base: env.VITE_BASE || '/',
    plugins: [react()],
  };
});
