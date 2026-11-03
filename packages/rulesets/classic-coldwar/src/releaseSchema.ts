import { z } from 'zod';
import { validateCatalogRelations } from '@battlegroup/core';
import { classicCatalogShellSchema } from './classicSchema';

/** Release metadata describes purchase context; the catalog remains the only game-data authority. */
export const classicCatalogReleaseSchema = z.strictObject({
  moduleContract: z.literal('classic/1'),
  catalog: classicCatalogShellSchema,
  purchases: z.array(z.discriminatedUnion('kind', [
    z.strictObject({kind: z.literal('top-level'), entryId: z.string().min(1)}),
    z.strictObject({kind: z.literal('attachment'), entryId: z.string().min(1), parentEntryIds: z.array(z.string().min(1)).min(1)}),
  ])),
  coverage: z.strictObject({
    omitted: z.array(z.string().min(1)),
    note: z.string().min(1),
  }),
}).superRefine((release, ctx) => {
  const ids = new Set(release.catalog.entries.map(entry => entry.localId));
  const seen = new Set<string>();
  for (const [i, purchase] of release.purchases.entries()) {
    if (!ids.has(purchase.entryId) || seen.has(purchase.entryId)) {
      ctx.addIssue({code:'custom', path:['purchases',i], message:'unknown or duplicate purchase entry'});
    }
    seen.add(purchase.entryId);
    if (purchase.kind === 'attachment') for (const parent of purchase.parentEntryIds) {
      if (!release.purchases.some(item => item.kind === 'top-level' && item.entryId === parent)) {
        ctx.addIssue({code:'custom', path:['purchases',i], message:'attachment parent must be an available top-level entry'});
      }
    }
  }
  for (const id of ids) if (!seen.has(id)) ctx.addIssue({code:'custom', path:['purchases'], message:`missing purchase context: ${id}`});
  for (const issue of validateCatalogRelations(release.catalog)) {
    ctx.addIssue({code:'custom', path:['catalog'], message:`${issue.checkId}: ${issue.message}`});
  }
});
export type ClassicCatalogRelease = z.infer<typeof classicCatalogReleaseSchema>;
