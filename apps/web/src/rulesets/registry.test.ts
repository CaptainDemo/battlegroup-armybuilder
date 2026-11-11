import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';
import { catalogShellSchema, createRosterDocument, evaluateRoster, executeRosterCommands, type CatalogIndex } from '@battlegroup/core';
import { makeIsolationCatalog } from '@battlegroup/core/samples';
import { createRulesetRegistry, rulesets } from './registry';
import type { AppCatalogRelease, RulesetRegistration } from './types';
import { classicRegistration } from './classic/registration';
import { catalogIndex, createCatalogLoader, loadCatalog } from '../adapters/catalog/catalogLoader';
import { restoreRoster } from '../features/roster-editor/restoreRoster';
import { summarize } from '../adapters/storage/rosterStore';
import { parseImportFile } from '../features/roster-transfer/parseImportFile';
import { projectPrintableRoster } from '../features/roster-output/printProjection';
import { RosterTree } from '../features/roster-editor/RosterTree';
import { CreateForm, SettingsForm } from '../features/roster-editor/RosterForms';
import { unavailableReference } from './presentationTypes';

// This is a synthetic adapter contract test, NOT NORTHAG rules or published game data.
const catalog = makeIsolationCatalog('northag');
catalog.entries.find(entry => entry.localId === 'tank-company-vanguard')!.baseTraining = {state:'known',value:'synthetic-grade'};
const release: AppCatalogRelease = {
  moduleContract: 'synthetic/1', catalog,
  purchases: catalog.entries.map(entry => ({kind:'top-level',entryId:entry.localId})),
  coverage: {omitted:['All real game rules'],note:'Synthetic integration test only'},
};
const bytes = Buffer.from(JSON.stringify(release));
const index: CatalogIndex = {indexVersion:1,releases:[{
  identity:catalog.manifest.identity,label:'Synthetic list',assetPath:'catalogs/northag/synthetic.json',
  moduleContract:release.moduleContract,rulesRevision:catalog.manifest.rulesRevision,
  sha256:createHash('sha256').update(bytes).digest('hex'),
}]};
const evaluate = vi.fn((document, context) => evaluateRoster(document,context.catalog));
const availability = vi.fn(() => ({status:'allowed' as const,reasons:[]}));
const synthetic: RulesetRegistration = {
  id:'northag',label:'Synthetic test ruleset',
  armies:[{identity:catalog.manifest.identity,armyListId:'isolation-list',nation:'Test nation',label:'Test list',defaultName:'Test roster'}],
  settings:{sizes:[{id:'synthetic-size',label:'Synthetic size'}],defaultSize:'synthetic-size',defaultBudget:999,scenarios:[],playerRoles:[],optionalRules:[{id:'test-toggle',label:'Test toggle'}]},
  supports: entry => entry.identity.rulesetId === 'northag' && entry.moduleContract === 'synthetic/1' && entry.rulesRevision === catalog.manifest.rulesRevision,
  parseRelease(value) {
    const input = value as AppCatalogRelease;
    const parsed = catalogShellSchema.safeParse(input?.catalog);
    return parsed.success && parsed.data.manifest.identity.rulesetId === 'northag'
      ? {success:true,release:{...input,catalog:parsed.data}} : {success:false,reason:'Not a synthetic catalog'};
  },
  validateRoster: document => document.settings.gameSizeId === 'synthetic-size' ? [] : [{code:'test/size',message:'Unsupported synthetic size'}],
  evaluate, availability,
  trainingLabels:{'synthetic-grade':'Synthetic training'},
  sectionLabel: (_identity,section) => section.name,
  sectionAllowances: () => new Map(), isMemberGroup: () => false, usesPlatoonSupportLabel: () => false,
};
const registry = createRulesetRegistry([synthetic]);
const loader = createCatalogLoader(index,registry);
const fetchCatalog = vi.fn(async () => ({ok:true,arrayBuffer:async () => Uint8Array.from(bytes).buffer}));
function roster() {
  const created = createRosterDocument({rosterId:'synthetic-roster',revision:'r1',name:'Synthetic',catalogRef:catalog.manifest.identity,armyListId:'isolation-list',settings:{budgetPoints:999,gameSizeId:'synthetic-size',optionalRules:['test-toggle']}},release);
  if (!created.ok) throw Error('Invalid fixture');
  const result = executeRosterCommands(created.document,[{kind:'add',selection:{selectionId:'chosen',entryReference:{...catalog.manifest.identity,localId:'tank-company-vanguard'},parentSelectionId:null,sectionId:'vanguard',optionChoices:[]}}],release,'r2');
  if (!result.ok) throw Error('Invalid fixture purchase');
  return result.document;
}
it('loads and evaluates an independent second adapter without Classic game records', async () => {
  const loaded = await loader.load(catalog.manifest.identity,{fetchCatalog,baseUrl:'/sub/'});
  expect(loaded.status).toBe('ready');
  expect(fetchCatalog).toHaveBeenCalledWith('/sub/catalogs/northag/synthetic.json');
  if (loaded.status !== 'ready') throw Error('Missing release');
  expect(registry.validateRoster(roster(),loaded.release)).toEqual([]);
  const result = registry.require('northag').evaluate(roster(),loaded.release);
  expect(result.totals.points.knownSubtotal).toBeGreaterThan(0);
  expect(registry.require('northag').availability(roster(),loaded.release,'tank-company-vanguard',{sectionId:'vanguard'}).status).toBe('allowed');
  expect(evaluate).toHaveBeenCalled(); expect(availability).toHaveBeenCalled();
  expect(registry.get('classic-coldwar')).toBeUndefined();
});
it('rejects unsupported contracts before fetch and never falls back to another module', async () => {
  const fetch = vi.fn(fetchCatalog);
  const absent = createCatalogLoader(index,createRulesetRegistry([classicRegistration]));
  expect((await absent.load(catalog.manifest.identity,{fetchCatalog:fetch})).status).toBe('unsupported-version');
  const changed = structuredClone(index); changed.releases[0]!.moduleContract='future/1';
  expect((await createCatalogLoader(changed,registry).load(catalog.manifest.identity,{fetchCatalog:fetch})).status).toBe('unsupported-version');
  expect(fetch).not.toHaveBeenCalled();
  expect(loader.parseRelease({...release,moduleContract:'future/1'},catalog.manifest.identity).status).toBe('invalid-data');
  const changedRules = structuredClone(release); changedRules.catalog.manifest.rulesRevision='future';
  expect(loader.parseRelease(changedRules,catalog.manifest.identity).status).toBe('invalid-data');
  expect(() => createRulesetRegistry([synthetic,synthetic])).toThrow('Duplicate');
});
it('keeps explicit creation defaults when catalog indexes are reordered and hides unimplemented rulesets', () => {
  const reversed = {...catalogIndex,releases:[...catalogIndex.releases].reverse()};
  expect(rulesets.creationChoices(reversed)).toEqual(rulesets.creationChoices(catalogIndex));
  expect(rulesets.creationChoices(reversed).map(choice => choice.army.identity.catalogRevision)).toEqual(['1.1.0']);
  expect(rulesets.creationChoices(reversed).map(choice => choice.runtime.id)).toEqual(['classic-coldwar']);
  expect(registry.creationChoices(index)[0]?.army.identity).toEqual(catalog.manifest.identity);
});
it('restores and imports both rulesets, but rejects adapter-specific invalid settings', async () => {
  const combined = createRulesetRegistry([classicRegistration,synthetic]);
  const syntheticLoad = () => loader.load(catalog.manifest.identity,{fetchCatalog,baseUrl:'/'});
  const document=roster();
  const row={rosterId:document.rosterId,document,saveRevision:1,summary:summarize(document),updatedAt:'test',deleted:false};
  expect((await restoreRoster(row,syntheticLoad,combined.validateRoster))?.document).toEqual(document);
  const bad={...document,settings:{...document.settings,gameSizeId:'platoon'}};
  expect(await restoreRoster({...row,document:bad},syntheticLoad,combined.validateRoster)).toBeNull();
  const classicRecord=catalogIndex.releases.find(item=>item.identity.catalogRevision==='1.0.0')!;
  const classicBytes=readFileSync('packages/catalogs/classic-coldwar/public/'+classicRecord.assetPath);
  const classicLoad=await loadCatalog(classicRecord.identity,{baseUrl:'/',fetchCatalog:async()=>({ok:true,arrayBuffer:async()=>Uint8Array.from(classicBytes).buffer})});
  if(classicLoad.status!=='ready')throw Error('Classic fixture failed');
  const created=createRosterDocument({rosterId:'classic-empty',revision:'r1',name:'Classic',catalogRef:classicRecord.identity,armyListId:'soviet-armoured-division-v4_1',settings:{budgetPoints:500,gameSizeId:'platoon',optionalRules:[]}},classicLoad.release);
  if(!created.ok)throw Error('Classic create failed');
  const text=JSON.stringify({formatVersion:'library-backup/1',kind:'library-backup',savedAt:'2026-11-10T00:00:00Z',rosters:[document,created.document]});
  const preview=await parseImportFile({text,byteSize:Buffer.byteLength(text)},async identity=>identity.rulesetId==='northag'?syntheticLoad():classicLoad,combined.validateRoster);
  expect(preview.fatal).toBeNull();
  expect(preview.records.map(record=>record.status)).toEqual(['ready','ready']);
  const invalidText=JSON.stringify(bad);
  expect((await parseImportFile({text:invalidText,byteSize:invalidText.length},syntheticLoad,combined.validateRoster)).records[0]?.status).toBe('error');
});
it('renders nested sections and settings with a synthetic adapter, without a parent purchase button', () => {
  const document=roster();
  const html=renderToStaticMarkup(createElement(RosterTree,{document,release,runtime:synthetic,selectedId:null,selectedMemberPath:null,addTarget:null,allowances:new Map(),onSelect:()=>{},onRemove:()=>{},onAdd:()=>{}}));
  expect(html).toContain('aria-label="Main Force"');
  expect(html).toContain('aria-label="Vanguard"');
  expect(html).not.toContain('aria-label="Add to Main Force"');
  expect(html.match(/id="selection-chosen"/g)).toHaveLength(1);
  const choice=registry.creationChoices(index)[0]!;
  const create=renderToStaticMarkup(createElement(CreateForm,{disabled:false,choices:[choice],selected:choice,onSelect:()=>{},onCreate:()=>{}}));
  expect(create).toContain('Synthetic size'); expect(create).not.toContain('Classic Cold War');
  const settings=renderToStaticMarkup(createElement(SettingsForm,{document,runtime:synthetic,onApply:()=>{}}));
  expect(settings).toContain('Test toggle'); expect(settings).not.toContain('attack-defence');
});
it('prints grouping parents and adapter training without borrowing Classic reference columns', () => {
  const document=roster();
  const projected=projectPrintableRoster({document,release,evaluation:evaluateRoster(document,catalog)},{registry,presentation:()=>undefined});
  if(projected.status!=='ready')throw Error('Projection failed');
  const main=projected.roster.sections.find(section=>section.sectionId==='main-force')!;
  expect(main.purchases).toEqual([]);
  expect(main.children.find(section=>section.sectionId==='vanguard')?.purchases[0]?.trainingLabel).toBe('Synthetic training');
  expect(projected.roster.reference).toEqual(unavailableReference());
});
it('keeps concrete ruleset imports and data out of shared Web features', () => {
  for(const directory of ['apps/web/src/features','apps/web/src/adapters']) {
    for(const file of readdirSync(directory,{recursive:true,withFileTypes:true}).filter(entry=>entry.isFile() && /\.tsx?$/.test(entry.name) && !entry.name.includes('.test.'))) {
      const text=readFileSync(`${file.parentPath}/${file.name}`,'utf8');
      expect(text,`${file.parentPath}/${file.name}`).not.toMatch(/@battlegroup\/(classic-coldwar|northag|airland)|catalogs\/(classic-coldwar|northag|airland)/);
    }
  }
});
