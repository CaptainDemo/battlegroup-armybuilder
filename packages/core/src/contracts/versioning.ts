import { z } from 'zod';
import { catalogIdentitySchema } from './primitives';
import {
  errataApplicationStatusSchema,
  sourceDocumentSchema,
} from './source';

/**
 * Version identity (docs/architecture.md §7.3).
 *
 * At least three versions are distinguished and never derived from each
 * other:
 * - file schema version (shape of the JSON documents themselves),
 * - rulesRevision (which rules text the data follows),
 * - catalogRevision (which revision of the catalog package).
 *
 * The manifest is the boundary object for M04 loaders. Core defines and
 * validates its shape; it never fetches, resolves or migrates catalogs.
 */

export const CATALOG_SCHEMA_VERSION = 'catalog-shell/1';

/** Current persisted roster-document format. Migration is M10 scope. */
export const ROSTER_FORMAT_VERSION = 'roster/1';

/** Manifest describing one published catalog package. */
export const catalogManifestSchema = z.strictObject({
  identity: catalogIdentitySchema,
  schemaVersion: z.literal(CATALOG_SCHEMA_VERSION),
  /** Rules text identity, e.g. "cw-draft6+sov-v4.1". */
  rulesRevision: z.string().min(1),
  /** Human description of the base edition this data was transcribed from. */
  baseEdition: z.string().min(1),
  sources: z.array(sourceDocumentSchema).min(1),
  errataSummary: z.strictObject({
    declaredErrataIds: z.array(z.string().min(1)),
    applicationStatus: errataApplicationStatusSchema,
  }),
  coverage: z.strictObject({
    status: z.enum(['sample-scope', 'partial', 'release-candidate']),
    note: z.string().min(1),
  }),
  contentSha256: z.string().regex(/^[0-9a-f]{64}$/).optional(),
});
export type CatalogManifest = z.infer<typeof catalogManifestSchema>;

/**
 * The three version layers of a catalog in one projection type, used by the
 * evaluation protocol to stamp results (schemaVersion + rulesRevision +
 * catalogRevision).
 */
export interface VersionIdentity {
  readonly schemaVersion: string;
  readonly rulesRevision: string;
  readonly catalogRevision: string;
}

export function manifestVersionIdentity(manifest: CatalogManifest): VersionIdentity {
  return {
    schemaVersion: manifest.schemaVersion,
    rulesRevision: manifest.rulesRevision,
    catalogRevision: manifest.identity.catalogRevision,
  };
}
