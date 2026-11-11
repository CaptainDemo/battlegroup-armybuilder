import { catalogIndexSchema, type CatalogIdentity, type CatalogIndex } from '@battlegroup/core';
import { applicationCatalogIndex } from '../../../../../packages/catalogs/registry';
import { rulesets, sameCatalogIdentity, type createRulesetRegistry } from '../../rulesets/registry';
import type { AppCatalogRelease } from '../../rulesets/types';

/** Bundled application registry, never an index URL supplied by a roster/import. */
export const catalogIndex = catalogIndexSchema.parse(applicationCatalogIndex);
type CatalogFailure = 'not-found' | 'unsupported-version' | 'network-error' | 'digest-mismatch' | 'invalid-data';
export type CatalogLoadResult = {status:'ready';release:AppCatalogRelease} | {status:CatalogFailure;reason:string};
type FetchCatalog = (url:string) => Promise<{ok:boolean;arrayBuffer():Promise<ArrayBuffer>}>;
type LoadOptions = {fetchCatalog?:FetchCatalog;baseUrl?:string};

export function createCatalogLoader(index: CatalogIndex, registry: ReturnType<typeof createRulesetRegistry>) {
  const validatedIndex = catalogIndexSchema.parse(index);
  function parseRelease(value: unknown, identity: CatalogIdentity): CatalogLoadResult {
    const runtime = registry.get(identity.rulesetId);
    if (!runtime) return {status:'unsupported-version',reason:'The catalog ruleset is not installed.'};
    const parsed = runtime.parseRelease(value);
    if (!parsed.success) return {status:'invalid-data',reason:parsed.reason};
    const actual = parsed.release.catalog.manifest;
    if (!sameCatalogIdentity(actual.identity, identity)) return {status:'invalid-data',reason:'Catalog identity does not match the requested exact revision.'};
    const indexed = validatedIndex.releases.find(item => sameCatalogIdentity(item.identity, identity));
    if (!indexed || indexed.moduleContract !== parsed.release.moduleContract || indexed.rulesRevision !== actual.rulesRevision)
      return {status:'invalid-data',reason:'Catalog contract or rules revision differs from the indexed release.'};
    if (!runtime.supports(indexed)) return {status:'unsupported-version',reason:'Catalog requires an unsupported module contract or rules revision.'};
    return {status:'ready',release:parsed.release};
  }
  async function load(identity: CatalogIdentity, options: LoadOptions = {}): Promise<CatalogLoadResult> {
    const entry = validatedIndex.releases.find(item => sameCatalogIdentity(item.identity, identity));
    if (!entry) {
      const family = validatedIndex.releases.some(item => item.identity.rulesetId === identity.rulesetId && item.identity.catalogId === identity.catalogId);
      return {status:family?'unsupported-version':'not-found',reason:'No application-indexed catalog at that exact identity. No fallback was used.'};
    }
    if (!registry.get(identity.rulesetId)?.supports(entry)) return {status:'unsupported-version',reason:'Catalog requires an unsupported module contract or rules revision.'};
    const base = options.baseUrl ?? import.meta.env.BASE_URL;
    let bytes: ArrayBuffer;
    try {
      const response = await (options.fetchCatalog ?? fetch)(`${base.endsWith('/')?base:base+'/'}${entry.assetPath}`);
      if (!response.ok) return {status:'network-error',reason:'Catalog request failed.'};
      bytes = await response.arrayBuffer();
    } catch { return {status:'network-error',reason:'Catalog could not be retrieved.'}; }
    const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),byte=>byte.toString(16).padStart(2,'0')).join('');
    if (digest !== entry.sha256) return {status:'digest-mismatch',reason:'Catalog bytes differ from the indexed immutable release.'};
    try { return parseRelease(JSON.parse(new TextDecoder().decode(bytes)) as unknown,identity); }
    catch { return {status:'invalid-data',reason:'Catalog is not valid data for its ruleset.'}; }
  }
  return { load, parseRelease };
}
const loader = createCatalogLoader(catalogIndex,rulesets);
export const loadCatalog = loader.load;
export const parseCatalogRelease = loader.parseRelease;
