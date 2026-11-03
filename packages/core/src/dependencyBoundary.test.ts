import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Architecture boundary checks for the M02 workspace:
 * core <- rulesets <- web, one direction only.
 *
 * See docs/architecture.md §3: core must not import concrete rulesets, React,
 * browser databases or hosting platforms; ruleset modules depend on core and
 * never on each other; only the web app composes concrete ruleset modules.
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
  it('core declares no dependencies of any kind', () => {
    const core = readManifest('packages/core/package.json');
    expect(core.dependencies).toBeUndefined();
    expect(core.peerDependencies).toBeUndefined();
    expect(core.devDependencies).toBeUndefined();
  });

  it('classic-coldwar depends only on core', () => {
    const classic = readManifest('packages/rulesets/classic-coldwar/package.json');
    expect(classic.dependencies ?? {}).toEqual({ '@battlegroup/core': '*' });
    expect(classic.peerDependencies).toBeUndefined();
  });

  it('web composes core and ruleset packages on top of React', () => {
    const web = readManifest('apps/web/package.json');
    const dependencies = web.dependencies ?? {};
    expect(Object.keys(dependencies)).toContain('@battlegroup/core');
    expect(Object.keys(dependencies)).toContain('@battlegroup/classic-coldwar');
    expect(Object.keys(dependencies)).toContain('react');
  });

  it('core and classic sources never import React, DOM or other rulesets', () => {
    const forbidden = /^(react|react-dom|@battlegroup\/classic-coldwar|@battlegroup\/web)(\/|$)/;
    for (const specifier of sourceImports('packages/core/src')) {
      expect(specifier, `core imports ${specifier}`).not.toMatch(forbidden);
    }
    for (const specifier of sourceImports('packages/rulesets/classic-coldwar/src')) {
      expect(specifier, `classic-coldwar imports ${specifier}`).not.toMatch(forbidden);
    }
  });
});
