import { defineConfig } from '@playwright/test';

/**
 * Browser checks for the M02 web shell. The suite runs against a preview
 * server of the static build (test:e2e builds first), so passing it means
 * the produced artifacts actually serve the app — not just that the dev
 * server works.
 *
 * By default tests use Playwright's bundled Chromium (`npx playwright install
 * chromium`). Set PLAYWRIGHT_CHANNEL=chrome (or msedge) to run against a
 * locally installed browser instead — useful on slow or offline networks.
 */
const channel = process.env.PLAYWRIGHT_CHANNEL;

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    ...(channel ? { channel } : {}),
  },
  webServer: {
    command: 'npm run preview --workspace @battlegroup/web -- --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
