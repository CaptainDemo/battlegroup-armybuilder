import { z } from 'zod';
import { localIdSchema, rulesetIdSchema } from './primitives';
import { sourceReferenceSchema } from './source';
import { catalogManifestSchema } from './versioning';
import { errataRecordSchema } from './source';
import {
  costDeltaSchema,
  quantityLimitSchema,
  trackedTokenSchema,
  trackedValueSchema,
} from './values';

/**
 * Catalog shell contracts: the army-list section tree, purchasable entries,
 * their composition and options (docs/architecture.md §4.2–§4.4).
 *
 * Two trees are deliberately kept apart:
 * - `ArmyStructure` (sections) describes how one army list organizes what may
 *   be bought where. Sections are flat records with parent pointers, so
 *   relationship validation can detect duplicate ids, orphans and cycles.
 * - The player purchase tree lives in roster selections, never here.
 *
 * The shell is ruleset-agnostic on purpose. Combat stats and training levels
 * are *not* modelled here: a ruleset module extends this shell with its own
 * profile schema (see @battlegroup/classic-coldwar).
 */

/* ------------------------------------------------------------------ */
/* Army list and section tree                                          */
/* ------------------------------------------------------------------ */

export const armySectionSchema = z.strictObject({
  sectionId: localIdSchema,
  name: z.string().min(1),
  /** null = top-level section. Unknown parents and cycles are caught by catalog relations validation. */
  parentSectionId: localIdSchema.nullable(),
  /** Whether entries may be purchased directly into this section. */
  directlyPurchasable: z.boolean(),
  note: z.string().min(1).optional(),
});
export type ArmySection = z.infer<typeof armySectionSchema>;

export const armyStructureSchema = z.strictObject({
  sections: z.array(armySectionSchema).min(1),
});
export type ArmyStructure = z.infer<typeof armyStructureSchema>;

export const armyListDescriptorSchema = z.strictObject({
  armyListId: localIdSchema,
  rulesetId: rulesetIdSchema,
  nation: z.string().min(1),
  name: z.string().min(1),
  structure: armyStructureSchema,
  note: z.string().min(1).optional(),
});
export type ArmyListDescriptor = z.infer<typeof armyListDescriptorSchema>;

/* ------------------------------------------------------------------ */
/* Profiles (identity shell only)                                      */
/* ------------------------------------------------------------------ */

/**
 * Core knows profiles by identity only. Ruleset catalogs carry richer records
 * (their own combat stats, special rules, ...), so this view is intentionally
 * *not* strict: core parsing accepts extra keys and strips them to this
 * identity view. Parse with the concrete ruleset schema when stats must be
 * retained; core relationship checks accept that extended object directly.
 * Stats themselves are never shared across rulesets
 * even for identical real-world equipment — each ruleset schema owns them.
 */
export const profileIdentitySchema = z.object({
  localId: localIdSchema,
  name: z.string().min(1),
  sourceRefs: z.array(sourceReferenceSchema),
});
export type ProfileIdentity = z.infer<typeof profileIdentitySchema>;

/* ------------------------------------------------------------------ */
/* Composition                                                         */
/* ------------------------------------------------------------------ */

/**
 * One node of a known composition tree. Node ids are stable identifiers
 * chosen by the data author (e.g. "platoon-1", "squad-2", "transport");
 * option targets and roster member paths are sequences of these ids, never
 * array indices, so reordering children cannot silently retarget an option.
 */
export const compositionNodeSchema = z.strictObject({
  nodeId: localIdSchema,
  role: localIdSchema,
  /** Referenced profile in the same catalog; absent when unverified (e.g. infantry squads in M01). */
  profileLocalId: localIdSchema.optional(),
  quantity: z.number().int().positive(),
  /** Marks a node intended as a configurable option target slot. */
  configurableSlot: z.boolean().optional(),
  get children() {
    return z.array(compositionNodeSchema).optional();
  },
});
export type CompositionNode = z.infer<typeof compositionNodeSchema>;

/**
 * Three distinguishable composition states. An empty array cannot express
 * the last two (docs/architecture.md §4.3):
 * - known: full composition tree given;
 * - no-entities: the purchase deliberately has no deployed models
 *   (off-table barrages, fire-support requests);
 * - pending: composition not yet transcribed.
 */
export const compositionStateSchema = z.discriminatedUnion('state', [
  z.strictObject({ state: z.literal('known'), root: compositionNodeSchema }),
  z.strictObject({ state: z.literal('no-entities'), reason: z.string().min(1) }),
  z.strictObject({ state: z.literal('pending'), reason: z.string().min(1) }),
]);
export type CompositionState = z.infer<typeof compositionStateSchema>;

/* ------------------------------------------------------------------ */
/* Resources (support pools)                                           */
/* ------------------------------------------------------------------ */

/**
 * Declarative support-allowance bookkeeping. Pools are identified by
 * ruleset-defined resource kinds; core hardcodes no thresholds and no
 * unified "support" cap. Army-wide Support units grants and per-platoon
 * Platoon Support Options grants are simply different resource kinds, so the
 * two pools can never silently merge (user clarification A02).
 */
export const resourceGrantScopeSchema = z.enum([
  'army',
  'parent-formation',
  'formation-member',
]);
export type ResourceGrantScope = z.infer<typeof resourceGrantScopeSchema>;

export const resourceGrantSchema = z
  .strictObject({
    resourceKind: localIdSchema,
    scope: resourceGrantScopeSchema,
    capacity: z.number().int().nonnegative(),
    /** Which army-list support categories this grant may be spent on, when the resource is category-based. */
    eligibleCategories: z.array(localIdSchema).optional(),
    /** Required member path (from the entry's composition root) for formation-member scope. */
    memberPath: z.array(localIdSchema).optional(),
    note: z.string().min(1).optional(),
  })
  .superRefine((grant, ctx) => {
    if (grant.scope === 'formation-member' && grant.memberPath === undefined) {
      ctx.addIssue({
        code: 'custom',
        message: 'formation-member grants must declare memberPath',
        path: ['memberPath'],
        input: grant,
      });
    }
    if (grant.scope !== 'formation-member' && grant.memberPath !== undefined) {
      ctx.addIssue({
        code: 'custom',
        message: 'memberPath is only valid for formation-member scope',
        path: ['memberPath'],
        input: grant,
      });
    }
  });
export type ResourceGrant = z.infer<typeof resourceGrantSchema>;

export const resourceConsumptionSchema = z.strictObject({
  resourceKind: localIdSchema,
  category: localIdSchema.optional(),
  amount: z.number().int().positive(),
  note: z.string().min(1).optional(),
});
export type ResourceConsumption = z.infer<typeof resourceConsumptionSchema>;

/* ------------------------------------------------------------------ */
/* Unit entries                                                        */
/* ------------------------------------------------------------------ */

export const unitEntryKindSchema = z.enum([
  'formation',
  'single',
  'off-table-support',
  'tactical-resource',
]);
export type UnitEntryKind = z.infer<typeof unitEntryKindSchema>;

/**
 * Base Points / BR are the army-list's own printed values for this entry in
 * this context; fixed sub-formations and members are included in the parent
 * price and are never re-charged (C04). Known base costs are non-negative;
 * unknown costs stay `unknown` and must not default to 0.
 */
export const entryBaseCostSchema = z
  .strictObject({
    points: trackedValueSchema,
    br: trackedValueSchema,
  })
  .superRefine((cost, ctx) => {
    if (cost.points.state === 'known' && cost.points.value < 0) {
      ctx.addIssue({
        code: 'custom',
        message: 'known base points must be non-negative',
        path: ['points', 'value'],
        input: cost,
      });
    }
    if (cost.br.state === 'known' && cost.br.value < 0) {
      ctx.addIssue({
        code: 'custom',
        message: 'known base BR must be non-negative',
        path: ['br', 'value'],
        input: cost,
      });
    }
  });
export type EntryBaseCost = z.infer<typeof entryBaseCostSchema>;

export const unitEntrySchema = z.strictObject({
  localId: localIdSchema,
  name: z.string().min(1),
  kind: unitEntryKindSchema,
  armyListIds: z.array(localIdSchema).min(1),
  /** Sections this entry may be purchased into (top-level eligibility). */
  sectionIds: z.array(localIdSchema).min(1),
  baseCost: entryBaseCostSchema,
  /**
   * Base training of this purchase context as a ruleset-defined token
   * (Classic i/r/v/e, NORTHAG c/p/e, ...). Core keeps the slot generic and
   * opaque; the ruleset schema validates the enum. Training is per entry —
   * the same profile in different purchase contexts carries its own value
   * and is never globally merged. Numeric BR is a separate field and never
   * implies a level.
   */
  baseTraining: trackedTokenSchema.optional(),
  composition: compositionStateSchema,
  optionGroupIds: z.array(localIdSchema),
  resourceGrants: z.array(resourceGrantSchema).optional(),
  resourceConsumptions: z.array(resourceConsumptionSchema).optional(),
  /** Names of special rules this entry participates in (ruleset-defined hooks, e.g. "pt76-tank-exclusion"). */
  specialRules: z.array(localIdSchema).optional(),
  tags: z.array(localIdSchema).optional(),
  sourceRefs: z.array(sourceReferenceSchema).min(1),
});
export type UnitEntry = z.infer<typeof unitEntrySchema>;

/* ------------------------------------------------------------------ */
/* Options                                                             */
/* ------------------------------------------------------------------ */

/**
 * What an option applies to. `scope-selector` is a *declared* recursive
 * selector (for example "all BMP-1 transports in this formation, including
 * purchased platoon-support attachments", user clarification A03). M03 only
 * declares it; resolving the live target set is rule evaluation (M06/M07).
 */
export const optionTargetSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('whole-selection') }),
  z.strictObject({
    kind: z.literal('member-slots'),
    nodePaths: z.array(z.array(localIdSchema).min(1)).min(1),
  }),
  z.strictObject({
    kind: z.literal('scope-selector'),
    selectorId: localIdSchema,
    description: z.string().min(1),
    includeSubFormations: z.boolean(),
    matchProfileLocalIds: z.array(localIdSchema).min(1),
    /** Optional subtree boundary, e.g. one fixed platoon within a company. */
    rootMemberPath: z.array(localIdSchema).min(1).optional(),
  }),
]);
export type OptionTarget = z.infer<typeof optionTargetSchema>;

/**
 * Declarative effects. `training-change` carries a ruleset-defined level
 * token; core never enumerates training levels (Classic uses i/r/v/e, which
 * the classic-coldwar package validates; NORTHAG's c/p/e would be its own).
 * `composition-addition` declares the members an option adds (e.g. a second
 * Fire Support Section with its own transport) — explicit data, never a
 * hidden composition derived from ids or names. Where the addition attaches
 * is the option's target; expanding/charging it is evaluation (M06/M07).
 */
export const optionEffectSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('composition-change'),
    replacement: compositionNodeSchema.optional(),
    removeProfileLocalIds: z.array(localIdSchema).optional(),
    additions: z.array(compositionNodeSchema).optional(),
    /** Remove matching transports from owned purchases too; additions apply only to the target. */
    includeAttachments: z.boolean().optional(),
  }),
  z.strictObject({
    kind: z.literal('model-replacement'),
    fromProfileLocalId: localIdSchema,
    toProfileLocalId: localIdSchema,
  }),
  z.strictObject({
    kind: z.literal('training-change'),
    toTrainingLevel: z.string().min(1),
  }),
  z.strictObject({
    kind: z.literal('tag-grant'),
    tag: localIdSchema,
  }),
  z.strictObject({
    kind: z.literal('composition-addition'),
    root: compositionNodeSchema,
  }),
]);
export type OptionEffect = z.infer<typeof optionEffectSchema>;

export const optionChargeModeSchema = z.enum(['once', 'per-target']);
export type OptionChargeMode = z.infer<typeof optionChargeModeSchema>;

export const optionSchema = z.strictObject({
  localId: localIdSchema,
  name: z.string().min(1),
  target: optionTargetSchema,
  effects: z.array(optionEffectSchema),
  /** once = charged one time per choice; per-target = charged once per target. */
  chargeMode: optionChargeModeSchema,
  costDelta: costDeltaSchema,
  /** How often this single option may be chosen within the group's scope. */
  ownLimit: quantityLimitSchema,
  /** Prerequisite option localIds within the same group. */
  requires: z.array(localIdSchema).optional(),
  /** Mutually exclusive option localIds within the same group. */
  mutuallyExclusiveWith: z.array(localIdSchema).optional(),
  resourceConsumptions: z.array(resourceConsumptionSchema).optional(),
  specialRules: z.array(localIdSchema).optional(),
  sourceRefs: z.array(sourceReferenceSchema).min(1),
});
export type Option = z.infer<typeof optionSchema>;

export const optionGroupScopeSchema = z.enum([
  'selection',
  'parent-formation',
  'section',
  'army',
]);
export type OptionGroupScope = z.infer<typeof optionGroupScopeSchema>;

/**
 * A group of options offered in one scope. `selectionLimit` bounds total
 * picks inside the group and each option's `ownLimit` bounds that single
 * option. A "one each" group (NORTHAG errata p.72: "one of" -> "one each")
 * is expressed as a limited selectionLimit with ownLimit limited(1) per
 * option — no separate flag that could drift out of sync.
 */
export const optionGroupSchema = z.strictObject({
  localId: localIdSchema,
  name: z.string().min(1),
  scope: optionGroupScopeSchema,
  selectionLimit: quantityLimitSchema,
  options: z.array(optionSchema).min(1),
});
export type OptionGroup = z.infer<typeof optionGroupSchema>;

/* ------------------------------------------------------------------ */
/* Catalog shell                                                       */
/* ------------------------------------------------------------------ */

/**
 * One ruleset catalog package: manifest + army lists + records. All record
 * references inside are localIds of the same catalog; cross-ruleset or
 * cross-catalog references are structurally impossible here and are rejected
 * at the roster boundary where full identities are embedded.
 */
export const catalogShellSchema = z.strictObject({
  manifest: catalogManifestSchema,
  armyLists: z.array(armyListDescriptorSchema).min(1),
  profiles: z.array(profileIdentitySchema),
  entries: z.array(unitEntrySchema).min(1),
  optionGroups: z.array(optionGroupSchema),
  errataRecords: z.array(errataRecordSchema).optional(),
});
export type CatalogShell = z.infer<typeof catalogShellSchema>;
