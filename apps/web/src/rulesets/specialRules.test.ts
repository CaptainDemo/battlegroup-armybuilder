import { expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createRosterDocument, executeRosterCommands } from '@battlegroup/core';
import { classicCatalogReleaseSchema, evaluateClassicRoster } from '@battlegroup/classic-coldwar';
import legacyRaw from '../../../../packages/catalogs/classic-coldwar/public/catalogs/classic-coldwar/soviet-armoured-division/1-0-0/catalog.json';
import raw from '../../../../packages/catalogs/classic-coldwar/public/catalogs/classic-coldwar/soviet-armoured-division/1-1-0/catalog.json';
import { createSpecialRuleLookup, projectSpecialRules, specialRulesForSelection, type SpecialRulesAdapter } from './specialRules';
import { classicSpecialRules } from './classic/specialRules';
import { getPresentation } from './presentation';
import { SpecialRulesPanel } from '../components/SpecialRulesPanel';
import { projectPrintableRoster } from '../features/roster-output/printProjection';

const release = classicCatalogReleaseSchema.parse(raw);
const legacyRelease = classicCatalogReleaseSchema.parse(legacyRaw);
function fixture(catalogRelease = release, entryIds = ['fhq', 'brdm2-recon']) {
  const created = createRosterDocument({rosterId:'special-test',revision:'1',name:'Rules',catalogRef:catalogRelease.catalog.manifest.identity,armyListId:'soviet-armoured-division-v4_1',settings:{budgetPoints:500,gameSizeId:'platoon',optionalRules:[]}}, catalogRelease);
  if (!created.ok) throw Error('fixture');
  const added = executeRosterCommands(created.document, entryIds.map((id, i) => ({kind:'add' as const,selection:{selectionId:String(i),entryReference:{...created.document.catalogRef,localId:id},parentSelectionId:null,sectionId:catalogRelease.catalog.entries.find(e=>e.localId===id)!.sectionIds[0]!,optionChoices:[]}})),catalogRelease,'2');
  if (!added.ok) throw Error('fixture add');
  return {document:added.document, evaluation:evaluateClassicRoster(added.document,catalogRelease)};
}
it('renders sourced Classic rule text in unit details and the print projection', () => {
  const {document,evaluation}=fixture();
  const view=projectSpecialRules(document,release.catalog,evaluation,classicSpecialRules);
  expect(view.rules.map(rule=>rule.id)).toContain('senior-officer');
  expect(view.rules.map(rule=>rule.id)).toContain('scout');
  expect(view.rules.every(rule=>rule.text && rule.source)).toBe(true);
  const entry={...release.catalog.entries[0]!,tags:[],specialRules:['max-per-parent:1','pt76-tank-exclusion','toc-battalion-only','scout']};
  expect(classicSpecialRules.entryRules(entry,document.selections[0]!,release.catalog)).toEqual(['tactical-operations-centre','scout']);
  const markup = renderToStaticMarkup(createElement(SpecialRulesPanel,{view}));
  expect(markup).toContain('reroll one Orders die');
  expect(markup).toContain('Battlegroup Rulebook');
  const printed=projectPrintableRoster({document,release,evaluation});
  if(printed.status!=='ready') throw Error('print');
  expect(printed.roster.specialRules).toEqual(view);
});
it.each([legacyRelease, release])('resolves all mapped Classic purchase and profile rules for $catalog.manifest.identity.catalogRevision', catalogRelease => {
  const {catalog} = catalogRelease;
  const {document, evaluation} = fixture(catalogRelease);
  const projected = projectSpecialRules(document, catalog, evaluation, classicSpecialRules);
  const ids = new Set([
    ...projected.rules.map(rule => rule.id),
    ...catalog.entries.flatMap(entry => classicSpecialRules.entryRules(entry, document.selections[0]!, catalog)),
    ...catalog.profiles.flatMap(profile => classicSpecialRules.nodeRules(
      {nodeId: profile.localId, role: 'unit', quantity: 1, profileLocalId: profile.localId}, catalog,
    )),
  ]);
  expect([...ids].filter(id => !classicSpecialRules.definition(id, catalog))).toEqual([]);
  expect(projected.rules.map(rule => rule.id)).toEqual(expect.arrayContaining(['senior-officer', 'mortar-spotter']));
});
it('shows option rules at their evaluated member paths', () => {
  const {document} = fixture(release, ['bmp1-platoon', 'recon-command']);
  const project = () => projectSpecialRules(document, release.catalog, evaluateClassicRoster(document, release), classicSpecialRules);
  expect(project().rules.map(rule => rule.id)).not.toContain('marksman');
  expect(project().rules.map(rule => rule.id)).not.toContain('ground-surveillance-radar');

  document.selections[0]!.optionChoices = [{
    optionGroupLocalId: 'bmp1-platoon-infantry', optionLocalId: 'svd-marksman',
    targets: [{kind: 'member-path', nodePath: ['rifle']}],
  }];
  document.selections[1]!.optionChoices = [{
    optionGroupLocalId: 'recon-command-transport', optionLocalId: 'brm-1',
    targets: [{kind: 'member-path', nodePath: ['transport']}],
  }];
  const view = project();
  expect(specialRulesForSelection(view, document, '0', ['rifle']).rules.map(rule => rule.id)).toContain('marksman');
  expect(specialRulesForSelection(view, document, '0', ['command']).rules.map(rule => rule.id)).not.toContain('marksman');
  expect(specialRulesForSelection(view, document, '1', ['transport']).rules.map(rule => rule.id)).toContain('ground-surveillance-radar');
});
it('deduplicates rule text and uses evaluated replacement profiles and tags', () => {
  const {document,evaluation}=fixture();
  const adapter:SpecialRulesAdapter={entryRules:()=>['scout'],nodeRules:node=>node.profileLocalId==='replacement'?['replacement-rule']:node.tags??[],label:id=>id,definition:id=>({id,name:id,text:'Verified '+id,source:'Test source'})};
  evaluation.composition[0]!.node.children=[{nodeId:'changed',role:'unit',quantity:1,profileLocalId:'replacement',tags:[]}];
  const view=projectSpecialRules(document,release.catalog,evaluation,adapter);
  expect(view.rules.filter(rule=>rule.id==='scout')).toHaveLength(1);
  expect(view.rules.find(rule=>rule.id==='replacement-rule')?.text).toBe('Verified replacement-rule');
  expect(view.uses.some(use=>use.path.join('/')==='changed')).toBe(true);
  expect(renderToStaticMarkup(createElement(SpecialRulesPanel,{view,appendix:true}))).toContain('Verified replacement-rule');
  evaluation.composition[0]!.node.children=[];
  expect(projectSpecialRules(document,release.catalog,evaluation,adapter).rules.some(rule=>rule.id==='replacement-rule')).toBe(false);
});
it('never uses Classic text for a foreign ruleset or unsupported revision', () => {
  const {document,evaluation}=fixture();
  const foreign=structuredClone(release.catalog);foreign.manifest.identity.rulesetId='northag';
  expect(getPresentation('northag')?.specialRules?.definition('scout', foreign)).toBeUndefined();
  expect(projectSpecialRules(document,foreign,evaluation).rules).toEqual([]);
  expect(classicSpecialRules.definition('scout',foreign)).toBeUndefined();
  const a:SpecialRulesAdapter={entryRules:()=>['scout'],nodeRules:()=>[],label:id=>id,definition:id=>({id,name:'Scout',text:'Classic-only example',source:'fixture'})};
  const b:SpecialRulesAdapter={...a,definition:id=>({id,name:'Scout',text:'NORTHAG-only example',source:'fixture'})};
  const first=projectSpecialRules(document,release.catalog,evaluation,a).rules[0]!;
  const second=projectSpecialRules(document,foreign,evaluation,b).rules[0]!;
  expect(first.key).not.toBe(second.key);expect(second.text).toBe('NORTHAG-only example');
  foreign.manifest.identity.rulesetId='classic-coldwar';foreign.manifest.identity.catalogRevision='future';
  expect(classicSpecialRules.definition('scout',foreign)).toBeUndefined();
  const missing = projectSpecialRules(document, foreign, evaluation, classicSpecialRules);
  expect(renderToStaticMarkup(createElement(SpecialRulesPanel,{view:missing}))).toContain('Rule text has not been added');
});
it('binds populated text records to exact ruleset, catalog revision and rules revision', () => {
  const catalog=release.catalog;
  const binding={...catalog.manifest.identity,rulesRevision:catalog.manifest.rulesRevision};
  const record={id:'scout',name:'Scout',text:'Classic fixture text',source:'fixture only'};
  const lookup=createSpecialRuleLookup({rulesetId:'classic-coldwar',bindings:[binding],definitions:[record]});
  expect(lookup('scout',catalog)).toEqual(record);
  for(const key of ['rulesetId','catalogId','catalogRevision'] as const) {
    const other=structuredClone(catalog);
    if(key==='rulesetId')other.manifest.identity.rulesetId='northag';else other.manifest.identity[key]='different';
    expect(lookup('scout',other)).toBeUndefined();
  }
  const other=structuredClone(catalog);other.manifest.rulesRevision='different';
  expect(lookup('scout',other)).toBeUndefined();
  other.manifest.rulesRevision=catalog.manifest.rulesRevision;other.manifest.identity.rulesetId='northag';
  const northag=createSpecialRuleLookup({rulesetId:'northag',bindings:[binding],definitions:[{...record,text:'NORTHAG fixture text'}]});
  expect(northag('scout',other)?.text).toBe('NORTHAG fixture text');
  expect(northag('scout',catalog)).toBeUndefined();
  expect(()=>createSpecialRuleLookup({rulesetId:'northag',bindings:[],definitions:[record,record]})).toThrow('Duplicate');
});
it('scopes member rules and recursively includes only its anchored attachments', () => {
  const {document}=fixture();
  document.selections.push({...document.selections[1]!,selectionId:'child',parentSelectionId:'0',targetMemberPath:['platoon-1']});
  document.selections.push({...document.selections[1]!,selectionId:'grandchild',parentSelectionId:'child'});
  const rule={key:'scout',id:'scout',name:'Scout',text:null,source:null};
  const uses=[['0',[]],['0',['platoon-1']],['0',['platoon-2']],['child',[]],['grandchild',[]],['1',[]]].map(([id,path])=>({selectionId:id as string,path:path as string[],unit:'unit',rules:[rule]}));
  const view=specialRulesForSelection({supported:true,uses,rules:[rule]},document,'0',['platoon-1']);
  expect(view.uses.map(use=>use.selectionId)).toEqual(['0','child','grandchild']);
  expect(view.rules).toHaveLength(1);
});
