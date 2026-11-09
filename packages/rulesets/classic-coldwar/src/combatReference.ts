import { z } from 'zod';
import type { CatalogIdentity } from '@battlegroup/core';

/** Read-only source supplement. It never changes a pinned catalog or evaluation. */
export const classicCombatReferenceSchema = z.strictObject({
  revision: z.string().min(1),
  rulesetId: z.literal('classic-coldwar'),
  source: z.strictObject({
    title: z.string().min(1),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
    authority: z.literal('unofficial-community'),
  }),
  rangeBands: z.array(z.string().min(1)).length(8),
  cards: z.array(z.strictObject({
    id: z.string().min(1),
    name: z.string().min(1),
    page: z.number().int().positive(),
    position: z.string().min(1),
    movement: z.strictObject({ offRoad: z.number().nonnegative(), road: z.number().nonnegative() }),
    armour: z.strictObject({ front: z.number().nonnegative(), side: z.number().nonnegative(), rear: z.number().nonnegative(), top: z.number().nonnegative() }),
    size: z.string().min(1),
    nbc: z.boolean(),
    amphibious: z.boolean(),
    night: z.array(z.string().min(1)),
    mounts: z.array(z.string().min(1)),
    specialRules: z.array(z.string().min(1)),
    notes: z.array(z.string().min(1)),
    weapons: z.array(z.strictObject({
      name: z.string().min(1),
      ammunition: z.string().min(1),
      he: z.string().nullable(),
      generation: z.string().nullable(),
      /** A source dash is not applicable, never a zero or an unknown. */
      rangeValues: z.array(z.number().nonnegative().nullable()).length(8),
    })),
  })),
  bindings: z.array(z.strictObject({
    catalogId: z.string().min(1),
    catalogRevision: z.string().min(1),
    profiles: z.record(z.string(), z.string()),
  })),
}).superRefine((pack, ctx) => {
  const cards = new Set<string>();
  for (const card of pack.cards) {
    if (cards.has(card.id)) ctx.addIssue({ code: 'custom', message: 'Duplicate combat card identity.' });
    cards.add(card.id);
  }
  const identities = new Set<string>();
  for (const binding of pack.bindings) {
    const identity = JSON.stringify([binding.catalogId, binding.catalogRevision]);
    if (identities.has(identity)) ctx.addIssue({ code: 'custom', message: 'Duplicate catalog binding.' });
    identities.add(identity);
    for (const cardId of Object.values(binding.profiles)) {
      if (!cards.has(cardId)) ctx.addIssue({ code: 'custom', message: 'Combat binding references an unknown card.' });
    }
  }
});

export type ClassicCombatReference = z.infer<typeof classicCombatReferenceSchema>;
export type ClassicCombatCard = ClassicCombatReference['cards'][number];

export function findClassicCombatCard(
  reference: ClassicCombatReference,
  identity: CatalogIdentity,
  profileLocalId: string,
): ClassicCombatCard | undefined {
  if (identity.rulesetId !== reference.rulesetId) return undefined;
  const binding = reference.bindings.find(item =>
    item.catalogId === identity.catalogId && item.catalogRevision === identity.catalogRevision);
  const cardId = binding?.profiles[profileLocalId];
  return cardId ? reference.cards.find(card => card.id === cardId) : undefined;
}
