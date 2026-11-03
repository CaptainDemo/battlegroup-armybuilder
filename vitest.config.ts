import { defineConfig } from 'vitest/config';

/**
 * Targeted unit tests for the pure TypeScript packages. The environment is
 * deliberately `node`: core and ruleset packages must stay importable and
 * testable without a DOM (M02 acceptance). The web app is covered by the
 * Playwright e2e suite in tests/e2e instead.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['packages/*/src/**/*.test.ts', 'packages/rulesets/*/src/**/*.test.ts', 'apps/web/src/**/*.test.ts', 'tools/data-import/**/*.test.ts'],
  },
});
