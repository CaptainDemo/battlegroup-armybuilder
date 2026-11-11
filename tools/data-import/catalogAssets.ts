import { readFileSync } from 'node:fs';
import { resolve, relative, isAbsolute } from 'node:path';
import { createHash } from 'node:crypto';
import { catalogIndexSchema } from '../../packages/core/src/contracts/catalogIndex';
import { catalogSources } from '../../packages/catalogs/registry';

interface CatalogSource { rulesetId: string; publicDirectory: string; index: unknown }
/** Emit only explicit index entries, never an entire data or reference directory. */
export function collectCatalogAssets(root: string, sources: readonly CatalogSource[] = catalogSources): ReadonlyMap<string, Buffer> {
  const assets = new Map<string, Buffer>();
  const indexes = sources.map(source => {
    const index = catalogIndexSchema.parse(source.index);
    const directory = resolve(root, source.publicDirectory);
    for (const release of index.releases) {
      if (release.identity.rulesetId !== source.rulesetId) throw new Error('Catalog source ruleset mismatch');
      const file = resolve(directory, release.assetPath);
      const path = relative(directory, file);
      if (path.startsWith('..') || isAbsolute(path)) throw new Error('Catalog asset escapes its public directory');
      if (assets.has(release.assetPath)) throw new Error(`Duplicate catalog asset: ${release.assetPath}`);
      const bytes = readFileSync(file);
      if (createHash('sha256').update(bytes).digest('hex') !== release.sha256) throw new Error(`Catalog digest mismatch: ${release.assetPath}`);
      assets.set(release.assetPath, bytes);
    }
    return index;
  });
  const combined = catalogIndexSchema.parse({indexVersion: 1, releases: indexes.flatMap(index => index.releases)});
  assets.set('catalogs/index.json', Buffer.from(JSON.stringify(combined, null, 2)+'\n'));
  return assets;
}
