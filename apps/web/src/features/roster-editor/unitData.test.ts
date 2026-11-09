import { expect, it } from 'vitest';
import type { EvaluatedCompositionNode } from '@battlegroup/core';
import { collectUnitProfiles, collectUnitReferenceData } from './unitData';

it('counts selected evaluated members across nested formations, including replacements', () => {
  const node: EvaluatedCompositionNode = {
    nodeId: 'company', role: 'company', quantity: 1,
    children: [
      { nodeId: 'command', role: 'command', quantity: 1, profileLocalId: 't-72a' },
      { nodeId: 'platoons', role: 'platoon', quantity: 3, children: [
        { nodeId: 'tanks', role: 'tank', quantity: 3, profileLocalId: 't-72b1' },
      ] },
      { nodeId: 'removed', role: 'tank', quantity: 0, profileLocalId: 't-72a' },
    ],
  };
  const original = structuredClone(node);
  expect(collectUnitProfiles(node)).toEqual([
    { profileLocalId: 't-72a', quantity: 1 },
    { profileLocalId: 't-72b1', quantity: 9 },
  ]);
  expect(node).toEqual(original);
  expect(collectUnitProfiles(node.children![1]!)).toEqual([{ profileLocalId: 't-72b1', quantity: 9 }]);
});

const identity = {rulesetId:'classic-coldwar',catalogId:'soviet-armoured-division-v4_1',catalogRevision:'1.1.0'} as const;

it('shows infantry weapon properties without inventing personnel or squad armour', () => {
  const data = collectUnitReferenceData({nodeId:'squad',role:'squad',quantity:1,profileLocalId:'bmp-1-rifle-squad',children:[
    {nodeId:'crew',role:'crew',quantity:7,profileLocalId:'infantry-personnel'},
    {nodeId:'rpk',role:'rpk',quantity:1,profileLocalId:'rpk-74'},
    {nodeId:'rpg',role:'rpg',quantity:1,profileLocalId:'rpg-7v'},
  ]}, identity);
  expect(data.vehicles).toEqual([]);
  expect(data.unclassified).toEqual([]);
  expect(data.missingWeapons).toEqual([]);
  expect(data.weapons.map(group => [group.weapon.id,group.quantity,group.quantityMode])).toEqual([
    ['ak74',1,'unit-equipment'],['rpk74',1,'weapons'],['rpg7v',1,'weapons'],
  ]);
});

it('keeps a targeted Konkurs upgrade separate from unmodified vehicles of the same type', () => {
  const node:EvaluatedCompositionNode={nodeId:'platoon',role:'platoon',quantity:1,children:[
    {nodeId:'first',role:'transport',quantity:1,profileLocalId:'bmp-1p',tags:['konkurs']},
    {nodeId:'others',role:'transport',quantity:2,profileLocalId:'bmp-1p'},
    {nodeId:'not-eligible',role:'tank',quantity:1,profileLocalId:'t-72a',tags:['konkurs']},
  ]};
  const original=structuredClone(node);
  const data=collectUnitReferenceData(node,identity);
  expect(data.vehicles.map(group=>[group.quantity,group.weaponIds,group.replacesCardAtgm])).toEqual([
    [1,['konkurs'],true],[2,[],false],[1,[],false],
  ]);
  expect(node).toEqual(original);
});

it('resolves current replacement weapons, zero SAM modifiers and exact-version isolation', () => {
  const node:EvaluatedCompositionNode={nodeId:'sam',role:'sam',quantity:3,profileLocalId:'sa-14'};
  const data=collectUnitReferenceData(node,identity);
  expect(data.weapons[0]?.weapon.id).toBe('sa14');
  expect(data.weapons[0]?.quantity).toBe(3);
  expect(data.vehicles).toHaveLength(0);
  const other=collectUnitReferenceData(node,{...identity,rulesetId:'northag'});
  expect(other.supported).toBe(false);
  expect(other.weapons).toEqual([]);
  const personalOnly=collectUnitReferenceData({nodeId:'medic',role:'crew',quantity:1,profileLocalId:'infantry-personnel'},identity);
  expect(personalOnly.vehicles).toEqual([]);
  expect(personalOnly.unclassified).toEqual([]);
});
