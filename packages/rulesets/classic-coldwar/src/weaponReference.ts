import { z } from 'zod';
import type { CatalogIdentity } from '@battlegroup/core';

const weaponSchema = z.strictObject({
  id: z.string().min(1),
  name: z.string().min(1),
  kind: z.enum(['small-arms', 'anti-tank', 'atgm', 'sam', 'support']),
  pages: z.array(z.number().int().positive()).min(1),
  rateOfFire: z.string().nullable(),
  range: z.string().nullable(),
  crew: z.string().nullable(),
  heRating: z.string().nullable(),
  heEffect: z.string().nullable(),
  penetration: z.string().nullable(),
  generation: z.string().nullable(),
  backBlast: z.boolean().nullable(),
  tandem: z.boolean().nullable(),
  unreliable: z.boolean().nullable(),
  /** Range-table dashes are explicitly not applicable, not zero. */
  rangeValues: z.array(z.number().nonnegative().nullable()).length(8).optional(),
  sam: z.strictObject({ type: z.string().min(1), attackModifier: z.number().int(), damage: z.string().min(1) }).optional(),
  notes: z.array(z.string().min(1)),
});

const bindingSchema = z.strictObject({
  catalogId: z.string().min(1),
  catalogRevision: z.string().min(1),
  vehicleProfileIds: z.array(z.string().min(1)),
  /** Personnel, formation containers and non-weapon equipment have no combat card. */
  nonCombatProfileIds: z.array(z.string().min(1)),
  unverifiedWeaponProfileIds: z.array(z.string().min(1)),
  profileWeapons: z.record(z.string(), z.strictObject({
    weaponIds: z.array(z.string().min(1)).min(1),
    quantityMode: z.enum(['weapons', 'unit-equipment']),
  })),
  vehicleWeapons: z.record(z.string(), z.array(z.string().min(1)).min(1)),
  tagWeapons: z.array(z.strictObject({
    tag: z.string().min(1),
    profileIds: z.array(z.string().min(1)).min(1),
    weaponIds: z.array(z.string().min(1)).min(1),
    replacesCardAtgm: z.boolean(),
  })),
});

export const classicWeaponReferenceSchema = z.strictObject({
  revision: z.string().min(1),
  rulesetId: z.literal('classic-coldwar'),
  source: z.strictObject({
    title: z.string().min(1),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
    authority: z.literal('unofficial-community'),
  }),
  rangeBands: z.array(z.string().min(1)).length(8),
  weapons: z.array(weaponSchema),
  bindings: z.array(bindingSchema),
}).superRefine((pack, ctx) => {
  const ids = new Set(pack.weapons.map(weapon => weapon.id));
  if (ids.size !== pack.weapons.length) ctx.addIssue({ code: 'custom', message: 'Duplicate weapon identity.' });
  for (const weapon of pack.weapons) {
    if (weapon.kind === 'sam' && (!weapon.sam || weapon.rangeValues || weapon.generation !== null)) {
      ctx.addIssue({ code: 'custom', message: 'SAM data requires its own system fields, without ATGM penetration or generation.' });
    }
    if (weapon.kind !== 'sam' && weapon.sam) ctx.addIssue({ code: 'custom', message: 'SAM fields are not applicable to this weapon kind.' });
    if (weapon.kind === 'atgm' && (!weapon.rangeValues || !weapon.generation)) {
      ctx.addIssue({ code: 'custom', message: 'ATGM data requires generation and penetration ranges.' });
    }
  }
  const identities = new Set<string>();
  for (const binding of pack.bindings) {
    const identity = JSON.stringify([binding.catalogId, binding.catalogRevision]);
    if (identities.has(identity)) ctx.addIssue({ code: 'custom', message: 'Duplicate weapon catalog binding.' });
    identities.add(identity);
    const classified = [...binding.vehicleProfileIds, ...binding.nonCombatProfileIds,
      ...binding.unverifiedWeaponProfileIds, ...Object.keys(binding.profileWeapons)];
    if (classified.length !== new Set(classified).size) ctx.addIssue({ code: 'custom', message: 'A profile has conflicting presentation kinds.' });
    const links = [...Object.values(binding.profileWeapons).flatMap(item => item.weaponIds),
      ...Object.values(binding.vehicleWeapons).flat(), ...binding.tagWeapons.flatMap(item => item.weaponIds)];
    for (const id of links) if (!ids.has(id)) ctx.addIssue({ code: 'custom', message: 'Unknown weapon reference.' });
    for (const id of [...Object.keys(binding.vehicleWeapons), ...binding.tagWeapons.flatMap(item => item.profileIds)]) {
      if (!binding.vehicleProfileIds.includes(id)) ctx.addIssue({ code: 'custom', message: 'Vehicle weapon link targets a non-vehicle profile.' });
    }
  }
});

export type ClassicWeaponReference = z.infer<typeof classicWeaponReferenceSchema>;
export type ClassicWeapon = ClassicWeaponReference['weapons'][number];
export type ClassicWeaponBinding = ClassicWeaponReference['bindings'][number];

export function findClassicWeaponBinding(reference: ClassicWeaponReference, identity: CatalogIdentity): ClassicWeaponBinding | undefined {
  if (reference.rulesetId !== identity.rulesetId) return undefined;
  return reference.bindings.find(item => item.catalogId === identity.catalogId && item.catalogRevision === identity.catalogRevision);
}
