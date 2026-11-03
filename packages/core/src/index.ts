/**
 * @battlegroup/core — ruleset-agnostic contracts (M03).
 *
 * Public surface:
 * - contracts/*: Zod boundary schemas + inferred types for identities, value
 *   states, sources, versions, the catalog shell, roster documents, and the
 *   evaluation/availability result protocols.
 * - validation/*: pure structural and reference integrity checks that take an
 *   explicit catalog context.
 *
 * Not here, on purpose: game-rule evaluation, pricing, training-level
 * enumerations, shared combat stats, React, DOM, storage. The only runtime
 * dependency is `zod` (pure schema library).
 */
export const corePackageId = '@battlegroup/core' as const;

export * from './contracts/primitives';
export * from './contracts/values';
export * from './contracts/source';
export * from './contracts/versioning';
export * from './contracts/catalog';
export * from './contracts/catalogIndex';
export * from './contracts/roster';
export * from './contracts/evaluation';
export * from './validation/integrityIssue';
export * from './validation/catalogRelations';
export * from './validation/rosterRelations';
export * from './roster/commands';
export * from './evaluation/evaluate';
export * from './evaluation/targets';
export * from './evaluation/resources';
