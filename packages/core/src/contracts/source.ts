import { z } from 'zod';
import { localIdSchema, sha256Schema } from './primitives';

/**
 * Source identity and provenance (docs/architecture.md §4.1, §8).
 *
 * Three statuses are recorded independently per document:
 * - `authority`: who published it (official / unofficial community / internal
 *   transcription). Official provenance does not imply the numbers were
 *   transcribed correctly.
 * - `reviewStatus`: how far a human has actually checked the content.
 * - `errataApplication`: whether a declared errata set was applied to the
 *   records derived from this document. A verified community card is still
 *   not a purchase definition for an army list.
 *
 * `pdfPage` counts PDF file order; `printedPage` is the printed page number.
 * They differ (e.g. the base rulebook is offset by -1) and are recorded
 * separately, never merged.
 */

export const sourceAuthoritySchema = z.enum([
  'official',
  'unofficial-community',
  'internal-transcription',
]);
export type SourceAuthority = z.infer<typeof sourceAuthoritySchema>;

export const documentReviewStatusSchema = z.enum([
  'not-reviewed',
  'fingerprinted-only',
  'selected-pages-reviewed',
  'fully-reviewed',
]);
export type DocumentReviewStatus = z.infer<typeof documentReviewStatusSchema>;

export const errataApplicationStatusSchema = z.enum([
  'not-applicable',
  'none-declared',
  'applied',
  'partially-applied',
]);
export type ErrataApplicationStatus = z.infer<typeof errataApplicationStatusSchema>;

export const sourceDocumentSchema = z.strictObject({
  documentId: localIdSchema,
  title: z.string().min(1),
  /** Repository-relative path, recorded for traceability only; core never loads it. */
  filePath: z.string().min(1).optional(),
  sha256: sha256Schema.optional(),
  pdfPageCount: z.number().int().positive().optional(),
  /** printed page = pdfPage + offset, when both are known. */
  printedPageOffset: z.number().int().optional(),
  authority: sourceAuthoritySchema,
  reviewStatus: documentReviewStatusSchema,
  errataApplication: errataApplicationStatusSchema,
});
export type SourceDocument = z.infer<typeof sourceDocumentSchema>;

/** Pointer to the exact place a fact came from. */
export const sourceReferenceSchema = z.strictObject({
  documentId: localIdSchema,
  pdfPage: z.number().int().positive().optional(),
  printedPage: z.number().int().optional(),
  note: z.string().min(1).optional(),
});
export type SourceReference = z.infer<typeof sourceReferenceSchema>;

/**
 * One errata entry against a record of the same ruleset catalog. Core only
 * models the record; matching the target and regenerating published JSON is
 * M04 data-tooling work and is not implemented here.
 */
export const errataRecordSchema = z.strictObject({
  errataId: localIdSchema,
  /** Entry or profile localId inside the same catalog. */
  targetRecordId: localIdSchema,
  field: z.string().min(1),
  previousValue: z.string().min(1).optional(),
  newValue: z.string().min(1),
  sourceRef: sourceReferenceSchema,
  status: z.enum(['applied', 'pending', 'unmatched']),
});
export type ErrataRecord = z.infer<typeof errataRecordSchema>;
