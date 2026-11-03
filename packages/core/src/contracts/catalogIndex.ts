import { z } from 'zod';
import { catalogIdentitySchema, sha256Schema } from './primitives';

export const catalogIndexSchema = z.strictObject({
  indexVersion: z.literal(1),
  releases: z.array(z.strictObject({
    identity: catalogIdentitySchema,
    label: z.string().min(1),
    assetPath: z.string().regex(/^catalogs\/[a-z0-9/_-]+\.json$/),
    sha256: sha256Schema,
    rulesRevision: z.string().min(1),
    moduleContract: z.string().min(1),
  })),
}).superRefine((index, ctx) => {
  const seen = new Set<string>();
  for (const [i, release] of index.releases.entries()) {
    const key = JSON.stringify(release.identity);
    if (seen.has(key)) ctx.addIssue({code: 'custom', path: ['releases', i], message: 'duplicate release identity'});
    seen.add(key);
  }
});
export type CatalogIndex = z.infer<typeof catalogIndexSchema>;
