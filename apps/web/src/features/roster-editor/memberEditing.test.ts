import { expect, it } from 'vitest';
import { createRosterDocument, executeRosterCommands, type OptionChoice } from '@battlegroup/core';
import { classicCatalogReleaseSchema, evaluateClassicRoster } from '@battlegroup/classic-coldwar';
import raw from '../../../../../packages/catalogs/classic-coldwar/public/catalogs/classic-coldwar/soviet-armoured-division/1-1-0/catalog.json';
import { classicRegistration } from '../../rulesets/classic/registration';
import { flattenMembers, memberElementId, memberTree, targetOwner } from './memberTree';
import { updateMemberChoice } from './memberOptions';

const release = classicCatalogReleaseSchema.parse(raw);
const catalog = release.catalog;
const entry = catalog.entries.find(item => item.localId === 'bmp1-platoon')!;
const group = catalog.optionGroups.find(item => item.localId === 'bmp1-platoon-infantry')!;
const option = (id: string) => group.options.find(item => item.localId === id)!;

it('preserves sibling equipment and charges each chosen squad once', () => {
  let choices: OptionChoice[] = [];
  choices = updateMemberChoice(choices, group.localId, option('bg-15-ugl'), ['command'], true);
  choices = updateMemberChoice(choices, group.localId, option('bg-15-ugl'), ['rifle'], true);
  expect(choices[0]!.targets).toEqual([{kind:'member-path',nodePath:['command']},{kind:'member-path',nodePath:['rifle']}]);
  const created = createRosterDocument({rosterId:'member-test',revision:'1',name:'Members',catalogRef:catalog.manifest.identity,armyListId:entry.armyListIds[0]!,settings:{gameSizeId:'platoon',budgetPoints:500,optionalRules:[]}},release);
  if(!created.ok) throw Error('create');
  const added = executeRosterCommands(created.document,[{kind:'add',selection:{selectionId:'platoon',entryReference:{...catalog.manifest.identity,localId:entry.localId},parentSelectionId:null,sectionId:entry.sectionIds[0]!,optionChoices:choices}}],release,'2');
  if(!added.ok) throw Error('add');
  const evaluated = evaluateClassicRoster(added.document, release);
  expect(evaluated.chargeLines.filter(line=>line.kind==='option-delta').reduce((sum,line)=>sum+line.chargedUnits,0)).toBe(2);
  const root=evaluated.composition[0]!.node;
  expect(root.children!.filter(node=>node.children?.some(child=>child.nodeId==='bg-15-ugl')).map(node=>node.nodeId)).toEqual(['command','rifle']);
  choices = updateMemberChoice(choices, group.localId, option('bg-15-ugl'), ['command'], false);
  expect(choices[0]!.targets).toEqual([{kind:'member-path',nodePath:['rifle']}]);
});

it('moves a once-priced upgrade explicitly and leaves other options intact', () => {
  let choices=updateMemberChoice([],group.localId,option('rpg-18'),['command'],true);
  choices=updateMemberChoice(choices,group.localId,option('svd-marksman'),['command'],true,classicRegistration.memberChoiceMode!(option('svd-marksman')));
  choices=updateMemberChoice(choices,group.localId,option('svd-marksman'),['rifle'],true,classicRegistration.memberChoiceMode!(option('svd-marksman')));
  expect(choices.find(choice=>choice.optionLocalId==='svd-marksman')!.targets).toEqual([{kind:'member-path',nodePath:['rifle']}]);
  expect(choices.find(choice=>choice.optionLocalId==='rpg-18')!.targets).toEqual([{kind:'member-path',nodePath:['command']}]);
});

it('does not infer single-target cardinality from once-only pricing in shared editing', () => {
  let choices=updateMemberChoice([],group.localId,option('svd-marksman'),['command'],true);
  choices=updateMemberChoice(choices,group.localId,option('svd-marksman'),['rifle'],true);
  expect(choices[0]!.targets).toHaveLength(2);
});

it('projects company, platoon, squad and transport recursively using stable identities', () => {
  const company=catalog.entries.find(item=>item.localId==='bmp1-company')!;
  if(company.composition.state!=='known')throw Error('composition');
  const tree=memberTree(company.composition.root,catalog,classicRegistration);
  const paths=flattenMembers(tree).map(member=>member.path);
  expect(paths).toContainEqual(['platoon-2','rifle','transport']);
  expect(targetOwner(['platoon-2','rifle','rpg'],tree)).toEqual(['platoon-2','rifle']);
  expect(targetOwner(['platoon-2','rifle','transport'],tree)).toEqual(['platoon-2','rifle','transport']);
  expect(memberElementId('unit',['a-b','c'])).not.toBe(memberElementId('unit',['a','b-c']));
});

it('supports arbitrary ruleset-defined nesting and current replacement/addition/removal', () => {
  const other={...classicRegistration,id:'northag' as const,memberPresentation:(node:{nodeId:string})=>({label:'Custom '+node.nodeId})};
  const root={nodeId:'root',role:'formation',quantity:1,children:[{nodeId:'section',role:'section',quantity:1,children:[{nodeId:'team',role:'team',quantity:1,children:[{nodeId:'vehicle',role:'vehicle',quantity:1,profileLocalId:'new-profile'}]}]}]};
  const projected=flattenMembers(memberTree(root,catalog,other));
  expect(projected.map(member=>member.label)).toEqual(['Custom section','Custom team','Custom vehicle']);
  expect(projected[2]!.node.profileLocalId).toBe('new-profile');
  root.children[0]!.children[0]!.children=[];
  expect(flattenMembers(memberTree(root,catalog,other))).toHaveLength(2);
});
