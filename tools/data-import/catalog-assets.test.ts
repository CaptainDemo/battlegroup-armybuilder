import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import { collectCatalogAssets } from './catalogAssets';
import { applicationCatalogIndex } from '../../packages/catalogs/registry';
import { catalogIndexSchema } from '../../packages/core/src/contracts/catalogIndex';

it('publishes the shared index and exactly its allowlisted releases', () => {
  const assets=collectCatalogAssets(process.cwd());
  const index=catalogIndexSchema.parse(applicationCatalogIndex);
  expect([...assets.keys()].sort()).toEqual(['catalogs/index.json',...index.releases.map(item=>item.assetPath)].sort());
  expect(JSON.parse(assets.get('catalogs/index.json')!.toString())).toEqual(index);
});
it('assembles independent data roots without copying neighboring files and rejects collisions/tampering', () => {
  mkdirSync('.tmp/catalog-assets-tests',{recursive:true});
  const root=mkdtempSync(resolve('.tmp/catalog-assets-tests/run-'));
  const sources=['classic-coldwar','northag'].map(rulesetId=>{
    const publicDirectory=rulesetId+'/public';
    mkdirSync(resolve(root,publicDirectory,'catalogs'),{recursive:true});
    const bytes=Buffer.from(JSON.stringify({marker:rulesetId}));
    const assetPath=`catalogs/${rulesetId}.json`;
    writeFileSync(resolve(root,publicDirectory,assetPath),bytes);
    writeFileSync(resolve(root,publicDirectory,'private-reference.txt'),'must not publish');
    return {rulesetId,publicDirectory,index:{indexVersion:1,releases:[{
      identity:{rulesetId,catalogId:'test',catalogRevision:'1'},label:'synthetic',assetPath,
      sha256:createHash('sha256').update(bytes).digest('hex'),rulesRevision:'test',moduleContract:'test/1',
    }]}};
  });
  expect([...collectCatalogAssets(root,sources).keys()].sort()).toEqual(['catalogs/classic-coldwar.json','catalogs/index.json','catalogs/northag.json']);
  expect(()=>collectCatalogAssets(root,[sources[0]!,sources[0]!])).toThrow('Duplicate');
  writeFileSync(resolve(root,sources[1]!.publicDirectory,'catalogs/northag.json'),'changed');
  expect(()=>collectCatalogAssets(root,sources)).toThrow('digest mismatch');
});
