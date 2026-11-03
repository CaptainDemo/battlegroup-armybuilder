import { z } from 'zod';

/**
 * Identity primitives shared by every M03 contract.
 *
 * Record identity is `rulesetId + catalogId + catalogRevision + localId`
 * (docs/architecture.md §4.1). Nothing here resolves records by display name,
 * and no lookup ever falls back to a same-name record from another ruleset or
 * revision: Classic, AirLand and NORTHAG game records are fully isolated even
 * when names, stats and points match.
 */

/** Non-empty identifier fragment (localIds, roles, node ids, selection ids). */
export const localIdSchema = z.string().min(1);
export type LocalId = z.infer<typeof localIdSchema>;

/**
 * The three rulesets this project will ever ship. This is project identity,
 * not game data: core never attaches units, options, training levels or
 * thresholds to these ids. Concrete game records live in per-ruleset
 * catalogs and ruleset modules only.
 */
export const rulesetIds = ['classic-coldwar', 'airland', 'northag'] as const;
export const rulesetIdSchema = z.enum(rulesetIds);
export type RulesetId = z.infer<typeof rulesetIdSchema>;

/** Identity of one published catalog package at an exact revision. */
export const catalogIdentitySchema = z.strictObject({
  rulesetId: rulesetIdSchema,
  catalogId: localIdSchema,
  catalogRevision: localIdSchema,
});
export type CatalogIdentity = z.infer<typeof catalogIdentitySchema>;

/**
 * Precise reference from a roster to a catalog record. The full identity is
 * embedded on purpose: a reference that drifts across a ruleset, catalog or
 * revision must fail validation instead of being silently re-attached.
 */
export const entryReferenceSchema = z.strictObject({
  rulesetId: rulesetIdSchema,
  catalogId: localIdSchema,
  catalogRevision: localIdSchema,
  localId: localIdSchema,
});
export type EntryReference = z.infer<typeof entryReferenceSchema>;

/**
 * Player purchase-instance id. Distinct from entry ids and profile ids:
 * buying the same entry twice produces two selections with their own ids.
 */
export type SelectionId = LocalId;

/** SHA-256 content fingerprint (hex, lowercase), used by source and manifest records. */
export const sha256Schema = z.string().regex(/^[0-9a-f]{64}$/);
