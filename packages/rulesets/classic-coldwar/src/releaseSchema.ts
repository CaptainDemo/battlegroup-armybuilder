import { z } from 'zod';
import { validateCatalogRelations, resolveCompositionPath } from '@battlegroup/core';
import { classicCatalogShellSchema } from './classicSchema';

/** Release metadata describes purchase context; the catalog remains the only game-data authority. */
export const classicCatalogReleaseSchema = z.strictObject({
  moduleContract: z.enum(['classic/1','classic/2']),
  catalog: classicCatalogShellSchema,
  purchases: z.array(z.discriminatedUnion('kind', [
    z.strictObject({kind: z.literal('top-level'), entryId: z.string().min(1)}),
    z.strictObject({kind: z.literal('attachment'), entryId: z.string().min(1), parentEntryIds: z.array(z.string().min(1)).min(1),parentMemberPaths:z.record(z.string(),z.array(z.array(z.string()).min(1)).min(1)).optional()}),
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
    if(purchase.kind==='attachment')for(const [parent,paths] of Object.entries(purchase.parentMemberPaths??{})) {
      const entry=release.catalog.entries.find(item=>item.localId===parent);
      if(!purchase.parentEntryIds.includes(parent)||!entry||paths.some(path=>!resolveCompositionPath(entry,path)?.configurableSlot))ctx.addIssue({code:'custom',path:['purchases',i],message:'invalid attachment member destinations'});
    }
  }
  for (const id of ids) if (!seen.has(id)) ctx.addIssue({code:'custom', path:['purchases'], message:`missing purchase context: ${id}`});
  for (const issue of validateCatalogRelations(release.catalog)) {
    ctx.addIssue({code:'custom', path:['catalog'], message:`${issue.checkId}: ${issue.message}`});
  }
});
export type ClassicCatalogRelease = z.infer<typeof classicCatalogReleaseSchema>;
