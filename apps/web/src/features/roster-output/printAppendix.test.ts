import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import { createRosterDocument, executeRosterCommands, type OptionChoice } from '@battlegroup/core';
import { classicCatalogReleaseSchema, evaluateClassicRoster } from '@battlegroup/classic-coldwar';
import currentRelease from '../../../../../packages/catalogs/classic-coldwar/public/catalogs/classic-coldwar/soviet-armoured-division/1-1-0/catalog.json';
import legacyRelease from '../../../../../packages/catalogs/classic-coldwar/public/catalogs/classic-coldwar/soviet-armoured-division/1-0-0/catalog.json';
import { projectPrintableRoster } from './printProjection';
import { PrintUnitDataAppendix, appendixWeapons } from './PrintUnitDataAppendix';

function project(entries: Array<{entry: string; choices?: OptionChoice[]}>, raw: unknown = currentRelease) {
  const release = classicCatalogReleaseSchema.parse(raw);
  const created = createRosterDocument({rosterId:'appendix',revision:'initial',name:'Appendix test',catalogRef:release.catalog.manifest.identity,armyListId:release.catalog.armyLists[0]!.armyListId,settings:{budgetPoints:5000,gameSizeId:'battalion',optionalRules:[]}}, release);
  if (!created.ok) throw Error('create failed');
  const added = executeRosterCommands(created.document,entries.map((item,index)=>({
    kind:'add' as const,
    selection:{selectionId:`purchase-${index}`,entryReference:{...release.catalog.manifest.identity,localId:item.entry},parentSelectionId:null,sectionId:release.catalog.entries.find(entry=>entry.localId===item.entry)!.sectionIds[0]!,optionChoices:item.choices??[]},
  })),release,'edited');
  if (!added.ok) throw Error('add failed');
  const evaluation = evaluateClassicRoster(added.document,release);
  const before = structuredClone({document:added.document,evaluation});
  const result = projectPrintableRoster({document:added.document,release,evaluation});
  expect({document:added.document,evaluation}).toEqual(before);
  if (result.status !== 'ready') throw Error('projection failed');
  return result.roster;
}

it('attaches only the selected profiles, with one data card per configuration',()=>{
  const roster=project([{entry:'t72-platoon'},{entry:'t72-platoon'},{entry:'bmp1-platoon'}]);
  const tanks=roster.reference.vehicles.filter(vehicle=>vehicle.profileLocalId==='t-72a');
  expect(tanks).toHaveLength(1);
  expect(tanks[0]?.quantity).toBe(6);
  expect(tanks[0]?.card?.armour).toEqual({front:17,side:8,rear:3,top:2});
  expect(appendixWeapons(roster.reference).map(weapon=>weapon.id)).toEqual(['ak74','rpk74','rpg7v']);
  const html=renderToStaticMarkup(createElement(PrintUnitDataAppendix,{reference:roster.reference}));
  expect(html.match(/data-profile-id="t-72a"/g)).toHaveLength(1);
  expect(html).not.toContain('data-profile-id="t-80u"');
  expect(html).toContain('125mm 2A46M-1 Early');
  expect(html).toContain('17 / 8 / 3 / 2');
  expect(html).toContain('data-weapon-id="rpg7v"');
});

it('keeps one upgraded vehicle separate and replaces its base-card missile',()=>{
  const roster=project([{entry:'bmp1-platoon',choices:[
    {optionGroupLocalId:'bmp1-platoon-infantry',optionLocalId:'all-bmp1-to-p',targets:['command','assistant','rifle'].map(id=>({kind:'member-path' as const,nodePath:[id,'transport']}))},
    {optionGroupLocalId:'bmp1-platoon-infantry',optionLocalId:'konkurs',targets:[{kind:'member-path',nodePath:['command','transport']}]},
  ]}]);
  const groups=roster.reference.vehicles.filter(vehicle=>vehicle.profileLocalId==='bmp-1p');
  expect(groups).toHaveLength(2);
  expect(groups.map(vehicle=>vehicle.quantity).sort()).toEqual([1,2]);
  const upgraded=groups.find(vehicle=>vehicle.upgraded)!;
  expect(upgraded.additionalWeapons.map(weapon=>weapon.id)).toEqual(['konkurs']);
  const html=renderToStaticMarkup(createElement(PrintUnitDataAppendix,{reference:{...roster.reference,vehicles:[upgraded],weapons:[]}}));
  expect(html).toContain('data-weapon-id="konkurs"');
  expect(html).toContain('GEN 2');
  expect(html).not.toContain('Spigot ATGM');
  expect(html).toContain('20');
});

it('keeps missing vehicle data visible without substituting a related variant',()=>{
  const roster=project([{entry:'t72-platoon',choices:[{optionGroupLocalId:'t72-platoon-upgrades',optionLocalId:'platoon-to-b',targets:[{kind:'whole-selection'}]}]}]);
  expect(roster.reference.vehicles[0]).toMatchObject({profileLocalId:'t-72b',quantity:3,card:null});
  const html=renderToStaticMarkup(createElement(PrintUnitDataAppendix,{reference:roster.reference}));
  expect(html).toContain('3 × T-72B');
  expect(html).toContain('independent attributes have not yet been verified');
  expect(html).not.toContain('17 / 8 / 3 / 2');
});

it('resolves legacy vehicle data by its exact identity and profile id',()=>{
  const roster=project([{entry:'brdm2-recon'}],legacyRelease);
  expect(roster.versions.catalogRevision).toBe('1.0.0');
  expect(roster.reference.vehicles[0]).toMatchObject({profileLocalId:'brdm2',quantity:1,card:{id:'brdm2'}});
});
