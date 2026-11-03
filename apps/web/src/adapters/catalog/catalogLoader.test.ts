import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { catalogIndexSchema } from '@battlegroup/core';
import { catalogIndex, loadCatalog, parseClassicRelease } from './catalogLoader';

const entry = catalogIndex.releases[0]!;
const text = readFileSync('packages/catalogs/classic-coldwar/public/'+entry.assetPath,'utf8');
const response = (body=text) => ({ok:true,arrayBuffer:async()=>new TextEncoder().encode(body).buffer});

describe('exact catalog loading', () => {
  it('loads standalone Classic data with the configured hosting subpath', async()=>{
    const fetchCatalog = vi.fn(async()=>response());
    const result = await loadCatalog(entry.identity,{fetchCatalog,baseUrl:'/armybuilder/'});
    expect(result.status).toBe('ready');
    expect(fetchCatalog).toHaveBeenCalledWith('/armybuilder/'+entry.assetPath);
  });
  it('refuses foreign rulesets and missing versions without fetching or substituting', async()=>{
    const fetchCatalog = vi.fn(async()=>response());
    expect((await loadCatalog({...entry.identity,rulesetId:'airland'},{fetchCatalog})).status).toBe('not-found');
    expect((await loadCatalog({...entry.identity,catalogRevision:'newest'},{fetchCatalog})).status).toBe('unsupported-version');
    expect(fetchCatalog).not.toHaveBeenCalled();
  });
  it('distinguishes network failure, tampered bytes and malformed catalog data', async()=>{
    expect((await loadCatalog(entry.identity,{fetchCatalog:async()=>{throw new Error('offline');}})).status).toBe('network-error');
    expect((await loadCatalog(entry.identity,{fetchCatalog:async()=>response(text+' ')})).status).toBe('digest-mismatch');
    expect(parseClassicRelease({},entry.identity).status).toBe('invalid-data');
    const foreign = JSON.parse(text); foreign.catalog.manifest.identity.rulesetId = 'northag';
    expect(parseClassicRelease(foreign,entry.identity).status).toBe('invalid-data');
  });
  it('rejects broken references, unknown parents and unsupported index paths', ()=>{
    const data = JSON.parse(text); data.purchases[0] = {kind:'attachment',entryId:'fhq',parentEntryIds:['missing']};
    expect(parseClassicRelease(data,entry.identity).status).toBe('invalid-data');
    const bad = structuredClone(catalogIndex); bad.releases[0]!.assetPath = 'https://example.org/data.json';
    expect(catalogIndexSchema.safeParse(bad).success).toBe(false);
    bad.releases[0]!.assetPath = 'catalogs/../secret.json';
    expect(catalogIndexSchema.safeParse(bad).success).toBe(false);
  });
});
