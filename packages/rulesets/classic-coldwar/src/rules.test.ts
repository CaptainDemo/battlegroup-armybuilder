import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { classicCatalogReleaseSchema } from './releaseSchema';
import { createClassicRuleset, evaluateClassicRoster, getClassicEntryAvailability } from './rules';
import { b01Roster,b02Roster,b03Roster,b04Roster,s01Roster,s02Roster,f02Roster,f03Roster,f04Roster,f05Roster,f06Roster,f07Roster,classicM01Catalog } from '@battlegroup/core/samples';
import type { RosterCommandContext,RosterDocument } from '@battlegroup/core';

const release=classicCatalogReleaseSchema.parse(JSON.parse(readFileSync('packages/catalogs/classic-coldwar/public/catalogs/classic-coldwar/soviet-armoured-division/1-0-0/catalog.json','utf8')));
const context:RosterCommandContext=release;
function runtimeDocument(document:RosterDocument=b01Roster()):RosterDocument {
  document.catalogRef=structuredClone(release.catalog.manifest.identity);
  for(const selection of document.selections) {
    selection.entryReference={...document.catalogRef,localId:selection.entryReference.localId};
    if(selection.parentSelectionId===null)selection.sectionId=release.catalog.entries.find(entry=>entry.localId===selection.entryReference.localId)!.sectionIds[0]!;
  }
  return document;
}
function wideContext():RosterCommandContext {
  const catalog=structuredClone(classicM01Catalog);
  catalog.profiles=catalog.profiles.map(profile=>({...profile,specialRules:profile.localId.startsWith('t62')?['tank-family:t62']:profile.localId==='pt76b'?['tank-family:pt76']:profile.localId.startsWith('t72')?['tank-family:other']:[]}));
  return {catalog,purchases:catalog.entries.map(entry=>{
    const parent=entry.localId.startsWith('bmp1-company-platoon-')?'bmp1-company':entry.localId.startsWith('bmp2-company-platoon-')?'bmp2-company':entry.localId.startsWith('bmp1-platoon-')?'bmp1-platoon':entry.localId==='bmp2-platoon-fire-support'?'bmp2-platoon':null;
    return parent?{kind:'attachment',entryId:entry.localId,parentEntryIds:[parent]}:{kind:'top-level',entryId:entry.localId};
  })};
}
const codes=(document:RosterDocument,ctx=context)=>evaluateClassicRoster(document,ctx).issues.filter(issue=>issue.severity==='error').map(issue=>issue.ruleId);

describe('Classic enabled initial-catalog checks',()=>{
  it.each([['squad',2],['platoon',3],['company',4],['battalion',5]] as const)('checks the exact Restricted boundary for %s', (size,limit)=>{
    const ctx=structuredClone(context);ctx.catalog.entries.find(entry=>entry.localId==='brdm2-recon')!.tags=['restricted'];
    const document=runtimeDocument();const recon=document.selections.find(selection=>selection.selectionId==='recon')!;
    document.selections=document.selections.filter(selection=>selection.selectionId!=='recon');document.settings.gameSizeId=size;
    for(let i=0;i<limit;i++)document.selections.push({...structuredClone(recon),selectionId:'restricted-'+i});
    expect(codes(document,ctx)).not.toContain('C11');
    document.selections.push({...structuredClone(recon),selectionId:'over-restricted'});
    expect(codes(document,ctx)).toContain('C11');
  });
  it('reproduces the 398/23 sample, Officer=1 and Scout=1 without claiming full legality',()=>{
    const document=runtimeDocument();const result=evaluateClassicRoster(document,context);
    expect(result.totals.points.knownSubtotal).toBe(398);expect(result.totals.br.knownSubtotal).toBe(23);
    expect(result.issues.filter(issue=>issue.severity==='error')).toEqual([]);
    expect(result.statistics.map(stat=>stat.value)).toEqual([1,1]);
    expect(result.legality).toBe('undetermined');
    expect(result.coverage.some(check=>check.status==='not-implemented')).toBe(true);
  });
  it.each([[b02Roster,'C02'],[b03Roster,'C01'],[b04Roster,'C09'],[s02Roster,'C07']] as const)('reports the independently expected violation %s', (build,rule)=>{
    expect(codes(runtimeDocument(build()))).toContain(rule);
  });
  it('accepts 4 local and 4 army choices together and detects the fifth local pick separately',()=>{
    expect(codes(runtimeDocument(s01Roster()))).toEqual([]);
    const ctx=wideContext();expect(codes(f02Roster(),ctx)).not.toContain('C03');
    expect(codes(f03Roster(),ctx)).toContain('C03');
  });
  it('does not count a Platoon Commander as an Officer or reconnaissance category as Scout',()=>{
    const document=runtimeDocument();document.selections=document.selections.filter(selection=>!['hq','recon','request'].includes(selection.selectionId));
    const result=evaluateClassicRoster(document,context);expect(result.statistics.map(stat=>stat.value)).toEqual([0,0]);
  });
  it('checks Unique by explicit type and Restricted by selected size; budget does not change size',()=>{
    const ctx=structuredClone(context);const document=runtimeDocument();
    const hq=structuredClone(document.selections.find(selection=>selection.selectionId==='hq')!);hq.selectionId='hq2';document.selections.push(hq);
    expect(codes(document,ctx)).toContain('C12');
    const entry=ctx.catalog.entries.find(item=>item.localId==='brdm2-recon')!;entry.tags=[...(entry.tags??[]),'restricted'];
    const restricted=runtimeDocument(s02Roster());restricted.settings.gameSizeId='squad';restricted.settings.budgetPoints=1000;
    const result=evaluateClassicRoster(restricted,ctx);expect(result.issues.some(issue=>issue.ruleId==='C11')).toBe(true);
    expect(result.issues.some(issue=>issue.ruleId==='C13'&&issue.severity==='warning')).toBe(true);
    expect(restricted.settings.gameSizeId).toBe('squad');
  });
  it('distinguishes missing defender inputs from an actual scenario violation',()=>{
    const ctx=structuredClone(context);ctx.catalog.entries.find(entry=>entry.localId==='brdm2-recon')!.tags=['defence'];
    const document=runtimeDocument();expect(evaluateClassicRoster(document,ctx).coverage.some(check=>check.checkId==='C14'&&check.status==='missing-input')).toBe(true);
    document.settings.scenarioId='attack-defence';document.settings.playerRoleId='attacker';expect(codes(document,ctx)).toContain('C14');
    document.settings.playerRoleId='defender';expect(codes(document,ctx)).not.toContain('C14');
  });
  it('checks TOC size and preserves an unknown price as incomplete',()=>{
    const ctx=structuredClone(context);ctx.catalog.entries.find(entry=>entry.localId==='fhq')!.specialRules=['toc-battalion-only'];
    const document=runtimeDocument();expect(codes(document,ctx)).toContain('C15');
    document.settings.gameSizeId='battalion';expect(codes(document,ctx)).not.toContain('C15');
    ctx.catalog.entries.find(entry=>entry.localId==='fhq')!.baseCost.points={state:'unknown',reason:'synthetic missing price'};
    expect(evaluateClassicRoster(document,ctx).coverage.find(check=>check.checkId==='C01')?.status).toBe('blocked-unknown-data');
  });
});

describe('PT-76 actual-profile restrictions',()=>{
  it.each([f04Roster,f05Roster,f06Roster,f07Roster])('catches a platoon, company, additional tank and nested transport trigger',build=>{
    expect(codes(build(),wideContext())).toContain('C16');
  });
  it('allows T-62 family selections and leaves unclassified tanks unknown',()=>{
    const ctx=wideContext();const document=f06Roster();
    const tank=document.selections.find(selection=>selection.selectionId==='tank')!;
    tank.entryReference.localId='t62-platoon';expect(codes(document,ctx)).not.toContain('C16');
    const unknown=wideContext();unknown.catalog.profiles=unknown.catalog.profiles.map(profile=>({...profile,specialRules:[]}));
    expect(evaluateClassicRoster(f06Roster(),unknown).coverage.find(check=>check.checkId==='C16')?.status).toBe('blocked-unknown-data');
  });
});

describe('Classic purchase availability and module binding',()=>{
  it('distinguishes an allowed purchase, editable rule violations, unknown cost and invalid purchase targets',()=>{
    const document=runtimeDocument();
    expect(getClassicEntryAvailability(document,context,'brdm2-recon').status).toBe('allowed');
    expect(getClassicEntryAvailability(document,context,'fhq').status).toBe('allowed-with-issues');
    expect(getClassicEntryAvailability(document,context,'bmp1-platoon-medic',{parentSelectionId:'tank'}).status).toBe('blocked');
    expect(getClassicEntryAvailability(document,context,'missing').status).toBe('blocked');
    const ctx=structuredClone(context);ctx.catalog.entries.find(entry=>entry.localId==='brdm2-recon')!.baseCost.points={state:'unknown',reason:'synthetic missing cost'};
    expect(getClassicEntryAvailability(document,ctx,'brdm2-recon').status).toBe('unknown');
  });
  it('requires exact context identities and rejects foreign documents',()=>{
    const module=createClassicRuleset(context);const document=runtimeDocument();
    expect(module.supports(document.catalogRef).status).toBe('supported');
    expect(module.supports({...document.catalogRef,catalogRevision:'latest'}).status).toBe('unsupported');
    expect(module.evaluate(document,context).totals.points.knownSubtotal).toBe(398);
    const foreign=structuredClone(context);foreign.catalog.manifest.identity.rulesetId='airland';
    expect(()=>module.evaluate(document,foreign)).toThrow('identity');
    expect(()=>module.getEntryAvailability('fhq',{},document,foreign,module.evaluate(document,context))).toThrow('identity');
    document.catalogRef.rulesetId='northag';expect(evaluateClassicRoster(document,context).legality).toBe('violations-confirmed');
  });
});
