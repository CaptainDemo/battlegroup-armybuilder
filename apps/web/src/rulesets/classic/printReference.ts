import type { CatalogShell, Evaluation } from '@battlegroup/core';
import { findClassicCombatCard, type ClassicCombatCard, type ClassicWeapon } from '@battlegroup/classic-coldwar';
import { collectUnitReferenceData, combatReference, weaponReference } from './unitData';
import type { PrintReferenceView } from '../presentationTypes';

export interface ClassicPrintReferenceVehicle {
  readonly key: string;
  readonly profileLocalId: string;
  readonly card: ClassicCombatCard | null;
  readonly additionalWeapons: readonly ClassicWeapon[];
  readonly quantity: number;
  readonly label: string;
  readonly weaponNames: readonly string[];
  readonly upgraded: boolean;
}

export interface ClassicPrintReferenceWeapon {
  readonly weapon: ClassicWeapon;
  readonly quantity: number;
  readonly label: string;
  readonly unitEquipment: boolean;
}

export interface ClassicPrintReferenceView {
  readonly supported: boolean;
  readonly vehicles: readonly ClassicPrintReferenceVehicle[];
  readonly weapons: readonly ClassicPrintReferenceWeapon[];
  readonly missingWeaponProfiles: readonly string[];
  readonly unclassifiedProfiles: readonly string[];
  readonly combatSource: string;
  readonly weaponSource: string;
}

function projectClassicData(catalog: CatalogShell, evaluation: Evaluation): ClassicPrintReferenceView {
  const identity = catalog.manifest.identity;
  const profiles = new Map(catalog.profiles.map(profile => [profile.localId, profile]));
  // Vehicle/weapon quick reference: reuse the verified reference packages and
  // the same evaluated composition the editor reads. Aggregation only.
  const vehicleTotals = new Map<string, { quantity: number; view: Omit<ClassicPrintReferenceVehicle, 'quantity'> }>();
  const weaponTotals = new Map<string, { quantity: number; view: Omit<ClassicPrintReferenceWeapon, 'quantity'> }>();
  const missing = new Map<string, number>();
  const unclassified = new Set<string>();
  let referenceSupported = false;
  for (const item of evaluation.composition) {
    const data = collectUnitReferenceData(item.node, identity);
    referenceSupported = referenceSupported || data.supported;
    for (const group of data.vehicles) {
      const existing = vehicleTotals.get(group.key);
      if (existing) {
        existing.quantity += group.quantity;
        continue;
      }
      vehicleTotals.set(group.key, {
        quantity: group.quantity,
        view: {
          key: group.key,
          profileLocalId: group.profileLocalId,
          card: findClassicCombatCard(combatReference, identity, group.profileLocalId) ?? null,
          additionalWeapons: group.weaponIds.map(id => weaponReference.weapons.find(weapon => weapon.id === id)!),
          label: profiles.get(group.profileLocalId)?.name ?? group.profileLocalId,
          weaponNames: group.weaponIds.map((id) => weaponReference.weapons.find((weapon) => weapon.id === id)?.name ?? id),
          upgraded: group.replacesCardAtgm,
        },
      });
    }
    for (const group of data.weapons) {
      const existing = weaponTotals.get(group.key);
      if (existing) {
        existing.quantity += group.quantity;
        continue;
      }
      weaponTotals.set(group.key, {
        quantity: group.quantity,
        view: {
          weapon: group.weapon,
          label: group.weapon.name,
          unitEquipment: group.quantityMode === 'unit-equipment',
        },
      });
    }
    for (const group of data.missingWeapons) missing.set(group.profileLocalId, (missing.get(group.profileLocalId) ?? 0) + group.quantity);
    for (const id of data.unclassified) unclassified.add(id);
  }

  return {
      supported: referenceSupported,
      vehicles: [...vehicleTotals.values()].map(({ quantity, view }) => ({ quantity, ...view })),
      weapons: [...weaponTotals.values()].map(({ quantity, view }) => ({ quantity, ...view })),
      missingWeaponProfiles: [...missing.entries()].map(([profileLocalId, quantity]) => `${quantity} × ${profiles.get(profileLocalId)?.name ?? profileLocalId}`),
      unclassifiedProfiles: [...unclassified].map((id) => profiles.get(id)?.name ?? id),
      combatSource: `${combatReference.source.title} · ${combatReference.revision}`,
      weaponSource: `${weaponReference.source.title} · ${weaponReference.revision}`,
    };
}

export function projectClassicReference(catalog: CatalogShell, evaluation: Evaluation): PrintReferenceView {
  const data = projectClassicData(catalog, evaluation);
  return {...data, appendix: {format: 'classic-reference/1', data}};
}

/** Internal frozen projection, never accepted from an imported roster. */
export function classicReferenceData(reference: PrintReferenceView): ClassicPrintReferenceView {
  if (reference.appendix?.format !== 'classic-reference/1') throw new Error('Not a Classic print reference');
  return reference.appendix.data as ClassicPrintReferenceView;
}
