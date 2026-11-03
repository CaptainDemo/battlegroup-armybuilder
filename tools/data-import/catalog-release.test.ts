import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import { catalogIndexSchema } from '../../packages/core/src/index';
import { classicCatalogReleaseSchema } from '../../packages/rulesets/classic-coldwar/src/index';

const base = 'packages/catalogs/classic-coldwar/public/';
const index = catalogIndexSchema.parse(JSON.parse(readFileSync(base+'catalogs/index.json','utf8')));

it('validates each immutable indexed release, source fingerprints and the independently recorded M01 prices', () => {
  const prices:Record<string,[number,number]> = {fhq:[20,3],'t72-platoon':[180,7],'bmp1-platoon':[95,8],'bmp1-platoon-medic':[8,0],'bmp1-platoon-fire-support':[25,1],'bmp1-platoon-agl':[18,1],'bmp1-platoon-mortar':[40,1],'brdm2-recon':[12,1],'zsu23-4':[35,2],'artillery-request-priority3':[5,0]};
  const evidence = JSON.parse(readFileSync('tests/fixtures/classic-coldwar/m01-sources.json','utf8')) as {sources:Array<{id:string;sha256:string}>};
  for (const row of index.releases) {
    const bytes = readFileSync(base+row.assetPath);
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(row.sha256);
    const release = classicCatalogReleaseSchema.parse(JSON.parse(bytes.toString('utf8')));
    expect(release.catalog.manifest.identity).toEqual(row.identity);
    expect(release.catalog.manifest.rulesRevision).toBe(row.rulesRevision);
    expect(release.moduleContract).toBe(row.moduleContract);
    expect(release.catalog.entries).toHaveLength(10);
    for (const entry of release.catalog.entries) {
      expect([entry.baseCost.points,entry.baseCost.br]).toEqual(prices[entry.localId]?.map(value=>({state:'known',value})));
    }
    for (const source of release.catalog.manifest.sources) expect(source.sha256).toBe(evidence.sources.find(item=>item.id===source.documentId)?.sha256);
    for (const profile of release.catalog.profiles) expect(Object.values(profile.stats).every(stat=>stat.state==='unknown')).toBe(true);
    expect(release.purchases.filter(item=>item.kind==='attachment')).toHaveLength(4);
    expect(release.catalog.entries.find(item=>item.localId==='artillery-request-priority3')?.sectionIds).toEqual(['additional-fire-support']);
    expect(release.catalog.entries.find(item=>item.localId==='bmp1-platoon')?.resourceGrants?.find(grant=>grant.scope==='army')?.eligibleCategories).toEqual(['reconnaissance','engineer','specialist']);
    expect(release.catalog.entries.find(item=>item.localId==='t72-platoon')?.resourceGrants?.[0]?.eligibleCategories).toEqual(['reconnaissance','engineer','logistics','specialist']);
  }
});

it('publishes only the explicit index and release JSON resources', () => {
  const actual = readdirSync(base,{recursive:true,withFileTypes:true}).filter(item=>item.isFile()).map(item=>(`${item.parentPath}/${item.name}`).replaceAll('\\','/').slice(base.length)).sort();
  expect(actual).toEqual(['catalogs/index.json',...index.releases.map(row=>row.assetPath)].sort());
});
