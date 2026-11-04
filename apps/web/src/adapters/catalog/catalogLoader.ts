import { catalogIndexSchema, type CatalogIdentity } from '@battlegroup/core';
import { classicCatalogReleaseSchema, type ClassicCatalogRelease } from '@battlegroup/classic-coldwar';
import rawIndex from '../../../../../packages/catalogs/classic-coldwar/public/catalogs/index.json';

/** Bundled application registry, never an index URL supplied by a roster/import. */
export const catalogIndex = catalogIndexSchema.parse(rawIndex);
type CatalogFailure = 'not-found' | 'unsupported-version' | 'network-error' | 'digest-mismatch' | 'invalid-data';
export type CatalogLoadResult = {status:'ready';release:ClassicCatalogRelease} | {status:CatalogFailure;reason:string};
type FetchCatalog = (url:string) => Promise<{ok:boolean;arrayBuffer():Promise<ArrayBuffer>}>;

export function parseClassicRelease(value:unknown, identity:CatalogIdentity): CatalogLoadResult {
  const parsed = classicCatalogReleaseSchema.safeParse(value);
  if (!parsed.success) return {status:'invalid-data',reason:parsed.error.issues.map(issue=>issue.message).join('; ')};
  const actual = parsed.data.catalog.manifest.identity;
  if (actual.rulesetId !== identity.rulesetId || actual.catalogId !== identity.catalogId || actual.catalogRevision !== identity.catalogRevision) {
    return {status:'invalid-data',reason:'Catalog identity does not match the requested exact revision.'};
  }
  return {status:'ready',release:parsed.data};
}

export async function loadCatalog(identity:CatalogIdentity, options:{fetchCatalog?:FetchCatalog;baseUrl?:string} = {}):Promise<CatalogLoadResult> {
  const entry = catalogIndex.releases.find(item => item.identity.rulesetId === identity.rulesetId && item.identity.catalogId === identity.catalogId && item.identity.catalogRevision === identity.catalogRevision);
  if (!entry) {
    const family = catalogIndex.releases.some(item=>item.identity.rulesetId===identity.rulesetId && item.identity.catalogId===identity.catalogId);
    return {status:family?'unsupported-version':'not-found',reason:'No application-indexed catalog at that exact identity. No fallback was used.'};
  }
  if (!((entry.moduleContract === 'classic/1' && entry.rulesRevision === 'cw-draft6+sov-v4.1') || (entry.moduleContract === 'classic/2' && entry.rulesRevision === 'cw-draft6+sov-v4.1+formations1'))) {
    return {status:'unsupported-version',reason:'Catalog requires an unsupported module contract or rules revision.'};
  }
  const base = options.baseUrl ?? import.meta.env.BASE_URL;
  let bytes:ArrayBuffer;
  try {
    const response = await (options.fetchCatalog ?? fetch)(`${base.endsWith('/')?base:base+'/'}${entry.assetPath}`);
    if (!response.ok) return {status:'network-error',reason:'Catalog request failed.'};
    bytes = await response.arrayBuffer();
  } catch { return {status:'network-error',reason:'Catalog could not be retrieved.'}; }
  const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),byte=>byte.toString(16).padStart(2,'0')).join('');
  if (digest !== entry.sha256) return {status:'digest-mismatch',reason:'Catalog bytes differ from the indexed immutable release.'};
  try { return parseClassicRelease(JSON.parse(new TextDecoder().decode(bytes)) as unknown, identity); }
  catch { return {status:'invalid-data',reason:'Catalog is not valid JSON.'}; }
}
