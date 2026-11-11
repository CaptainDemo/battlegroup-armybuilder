import type { CatalogIdentity, EvaluatedCompositionNode } from '@battlegroup/core';
import { classicCombatReferenceSchema, classicWeaponReferenceSchema, findClassicWeaponBinding, type ClassicWeapon } from '@battlegroup/classic-coldwar';
import rawReference from '../../../../../packages/catalogs/classic-coldwar/reference/soviet-afv-v1.json';
import rawWeapons from '../../../../../packages/catalogs/classic-coldwar/reference/draft6-weapons-v1.json';

export const combatReference = classicCombatReferenceSchema.parse(rawReference);
export const weaponReference = classicWeaponReferenceSchema.parse(rawWeapons);

export interface VehicleReferenceGroup {
  key: string;
  profileLocalId: string;
  quantity: number;
  weaponIds: string[];
  replacesCardAtgm: boolean;
}
export interface WeaponReferenceGroup {
  key: string;
  weapon: ClassicWeapon;
  quantity: number;
  quantityMode: 'weapons' | 'unit-equipment';
}

/** Classification and tag links are catalog-owned; personnel never get vehicle stats. */
export function collectUnitReferenceData(node: EvaluatedCompositionNode, identity: CatalogIdentity) {
  const binding = findClassicWeaponBinding(weaponReference, identity);
  const vehicles = new Map<string, VehicleReferenceGroup>();
  const weapons = new Map<string, WeaponReferenceGroup>();
  const missingWeapons = new Map<string, number>();
  const unclassified = new Set<string>();
  const visit = (member: EvaluatedCompositionNode, parentQuantity: number, inheritedTags: readonly string[]): void => {
    const quantity = member.quantity * parentQuantity;
    if (quantity <= 0) return;
    const tags = [...new Set([...inheritedTags, ...(member.tags ?? [])])];
    const id = member.profileLocalId;
    if (id && binding) {
      if (binding.vehicleProfileIds.includes(id)) {
        const upgrades = binding.tagWeapons.filter(link => link.profileIds.includes(id) && tags.includes(link.tag));
        const weaponIds = [...new Set([...(binding.vehicleWeapons[id] ?? []), ...upgrades.flatMap(link => link.weaponIds)])];
        const replacesCardAtgm = upgrades.some(link => link.replacesCardAtgm);
        const key = JSON.stringify([id, weaponIds, replacesCardAtgm]);
        const group = vehicles.get(key);
        if (group) group.quantity += quantity;
        else vehicles.set(key, { key, profileLocalId: id, quantity, weaponIds, replacesCardAtgm });
      } else if (binding.profileWeapons[id]) {
        const link = binding.profileWeapons[id];
        for (const weaponId of link.weaponIds) {
          const weapon = weaponReference.weapons.find(item => item.id === weaponId)!;
          const key = JSON.stringify([weaponId, link.quantityMode]);
          const group = weapons.get(key);
          if (group) group.quantity += quantity;
          else weapons.set(key, { key, weapon, quantity, quantityMode: link.quantityMode });
        }
      } else if (binding.unverifiedWeaponProfileIds.includes(id)) {
        missingWeapons.set(id, (missingWeapons.get(id) ?? 0) + quantity);
      } else if (!binding.nonCombatProfileIds.includes(id)) unclassified.add(id);
    } else if (id) unclassified.add(id);
    for (const child of member.children ?? []) visit(child, quantity, tags);
  };
  visit(node, 1, []);
  return {
    supported: !!binding,
    vehicles: [...vehicles.values()],
    weapons: [...weapons.values()],
    missingWeapons: [...missingWeapons].map(([profileLocalId, quantity]) => ({ profileLocalId, quantity })),
    unclassified: [...unclassified],
  };
}
