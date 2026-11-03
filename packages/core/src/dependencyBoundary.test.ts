import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Architecture boundary checks for the workspace:
 * core <- rulesets <- web, one direction only.
 *
 * See docs/architecture.md §3: core must not import concrete rulesets, React,
 * browser databases or hosting platforms; ruleset modules depend on core and
 * never on each other; only the web app composes concrete ruleset modules.
 *
 * M03 change: core declares exactly one runtime dependency — the pure schema
 * library `zod` — replacing the M02 zero-dependency assertion. Everything
 * else stays forbidden. A ruleset module that imports zod directly must
 * declare it directly (no reliance on hoisting).
 *
 * Tests run through the root vitest.config.ts, so the repository root is the
 * working directory.
 */
const repoRoot = process.cwd();

interface WorkspaceManifest {
  readonly name: string;
  readonly dependencies?: Record<string, string>;
  readonly peerDependencies?: Record<string, string>;
  readonly devDependencies?: Record<string, string>;
}

function readManifest(relativePath: string): WorkspaceManifest {
  return JSON.parse(readFileSync(join(repoRoot, relativePath), 'utf8')) as WorkspaceManifest;
}

function listSourceFiles(relativeDir: string): string[] {
  return readdirSync(join(repoRoot, relativeDir), { recursive: true, encoding: 'utf8' })
    .filter((entry) => typeof entry === 'string' && entry.endsWith('.ts'))
    .map((entry) => join(relativeDir, entry));
}

function sourceImports(relativeDir: string): string[] {
  const importPattern = /(?:^|\n)\s*import\s[^'"]*?from\s*['"]([^'"]+)['"]/g;
  const specifierPattern = /(?:^|\n)\s*import\s*['"]([^'"]+)['"]/g;
  const specifiers: string[] = [];
  for (const file of listSourceFiles(relativeDir)) {
    const content = readFileSync(join(repoRoot, file), 'utf8');
    for (const pattern of [importPattern, specifierPattern]) {
      for (const match of content.matchAll(pattern)) {
        const specifier = match[1];
        if (specifier) {
          specifiers.push(specifier);
        }
      }
    }
  }
  return specifiers;
}

describe('workspace dependency boundaries', () => {
  it('core declares exactly the pure schema dependency zod and nothing else', () => {
    const core = readManifest('packages/core/package.json');
    expect(Object.keys(core.dependencies ?? {})).toEqual(['zod']);
    expect(core.dependencies?.['zod']).toMatch(/^\^?\d/);
    expect(core.peerDependencies).toBeUndefined();
    expect(core.devDependencies).toBeUndefined();
  });

  it('classic-coldwar depends only on core plus its own direct zod use', () => {
    const classic = readManifest('packages/rulesets/classic-coldwar/package.json');
    expect(Object.keys(classic.dependencies ?? {}).sort()).toEqual(['@battlegroup/core', 'zod']);
    expect(classic.peerDependencies).toBeUndefined();
  });

  it('web composes core and ruleset packages on top of React', () => {
    const web = readManifest('apps/web/package.json');
    const dependencies = web.dependencies ?? {};
    expect(Object.keys(dependencies)).toContain('@battlegroup/core');
    expect(Object.keys(dependencies)).toContain('@battlegroup/classic-coldwar');
    expect(Object.keys(dependencies)).toContain('react');
  });

  it('core imports neither React, DOM storage, workspace packages nor rulesets', () => {
    const forbidden = /^(react|react-dom|dexie|idb|@battlegroup\/)/;
    for (const specifier of sourceImports('packages/core/src')) {
      expect(specifier, `core imports ${specifier}`).not.toMatch(forbidden);
    }
  });

  it('classic-coldwar imports only core (incl. its samples subpath), zod, vitest and relative modules', () => {
    const allowed = /^(@battlegroup\/core(\/samples)?|zod|vitest)$/;
    const forbidden = /^(react|react-dom|dexie|idb|@battlegroup\/(?!core))/;
    for (const specifier of sourceImports('packages/rulesets/classic-coldwar/src')) {
      if (specifier.startsWith('.') || specifier.startsWith('node:')) {
        continue;
      }
      expect(specifier, `classic-coldwar imports ${specifier}`).toMatch(allowed);
      expect(specifier, `classic-coldwar imports ${specifier}`).not.toMatch(forbidden);
    }
  });
});
