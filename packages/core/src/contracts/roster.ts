import { z } from 'zod';
import { catalogIdentitySchema, entryReferenceSchema, localIdSchema } from './primitives';
import { ROSTER_FORMAT_VERSION } from './versioning';

/**
 * Roster document contracts: the persisted player state (docs/architecture.md
 * §7.1). The document stores player *choices* only — never a second copy of
 * catalog data and never derived totals. Points, BR, expanded composition and
 * rule results all come from one evaluation snapshot over this document.
 */

/**
 * Budget and game size are saved independently. Nothing in the schema lets a
 * budget imply a size or vice versa (C13): switching budget never silently
 * re-picks the game size.
 */
export const rosterSettingsSchema = z.strictObject({
  budgetPoints: z.number().int().positive(),
  /** Ruleset-defined size token (e.g. Classic "platoon"). Not derived from budgetPoints. */
  gameSizeId: localIdSchema,
  scenarioId: localIdSchema.optional(),
  optionalRules: z.array(localIdSchema),
});
export type RosterSettings = z.infer<typeof rosterSettingsSchema>;

/**
 * Target of one option choice. Two addressable spaces, deliberately kept
 * apart so reordering purchases can never retarget an option (rework R2):
 *
 * - `member-path` resolves ONLY within the choosing selection's own entry
 *   composition (static nodes; attachments are never traversed implicitly —
 *   an ambiguous path fails instead of silently picking the first match).
 * - `attachment-member` addresses a member of a purchased attachment by the
 *   owning selection id plus a path relative to that attachment's own
 *   composition root. Two identical attachments (e.g. two Fire Support
 *   Sections under the same platoon) each stay individually addressable.
 *
 * For scope-selector options the player's resolved target set is recorded
 * explicitly at edit time as a mix of both target kinds; M05+ recomputes it
 * as attachments change.
 */
export const optionChoiceTargetSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('whole-selection') }),
  z.strictObject({
    kind: z.literal('member-path'),
    nodePath: z.array(localIdSchema).min(1),
  }),
  z.strictObject({
    kind: z.literal('attachment-member'),
    ownerSelectionId: localIdSchema,
    nodePath: z.array(localIdSchema).min(1),
  }),
]);
export type OptionChoiceTarget = z.infer<typeof optionChoiceTargetSchema>;

export const optionChoiceSchema = z.strictObject({
  optionGroupLocalId: localIdSchema,
  optionLocalId: localIdSchema,
  targets: z.array(optionChoiceTargetSchema).min(1),
});
export type OptionChoice = z.infer<typeof optionChoiceSchema>;

/**
 * One purchased instance. Top-level selections carry the section they were
 * purchased into; child selections inherit their ancestor's section and must
 * not repeat it (docs/architecture.md §4.2). `targetMemberPath` anchors an
 * attachment inside its parent's composition (e.g. company attachment to
 * ["platoon-1"]).
 */
export const rosterSelectionSchema = z
  .strictObject({
    selectionId: localIdSchema,
    entryReference: entryReferenceSchema,
    parentSelectionId: localIdSchema.nullable(),
    sectionId: localIdSchema.optional(),
    targetMemberPath: z.array(localIdSchema).optional(),
    optionChoices: z.array(optionChoiceSchema),
  })
  .superRefine((selection, ctx) => {
    if (selection.parentSelectionId === null && selection.sectionId === undefined) {
      ctx.addIssue({
        code: 'custom',
        message: 'top-level selections must declare their sectionId',
        path: ['sectionId'],
        input: selection,
      });
    }
    if (selection.parentSelectionId !== null && selection.sectionId !== undefined) {
      ctx.addIssue({
        code: 'custom',
        message: 'child selections inherit their section; sectionId must be omitted',
        path: ['sectionId'],
        input: selection,
      });
    }
    if (selection.parentSelectionId === null && selection.targetMemberPath !== undefined) {
      ctx.addIssue({
        code: 'custom',
        message: 'targetMemberPath is only valid on child (attachment) selections',
        path: ['targetMemberPath'],
        input: selection,
      });
    }
  });
export type RosterSelection = z.infer<typeof rosterSelectionSchema>;

export const rosterDocumentSchema = z.strictObject({
  formatVersion: z.literal(ROSTER_FORMAT_VERSION),
  rosterId: localIdSchema,
  name: z.string().min(1),
  /**
   * Edit revision of this snapshot, assigned/advanced by the editing session
   * (M05 generates it; M03 only carries it). Every Evaluation stamps it into
   * `EvaluationIdentity.inputRevision` so consumers can reject stale results
   * for the same rosterId. Distinct from catalog revisions and from the M09
   * storage save revision (persistence concurrency token).
   */
  revision: localIdSchema,
  /** Exact catalog identity this roster is bound to; every selection reference must match it. */
  catalogRef: catalogIdentitySchema,
  armyListId: localIdSchema,
  settings: rosterSettingsSchema,
  selections: z.array(rosterSelectionSchema),
  notes: z.string().optional(),
});
export type RosterDocument = z.infer<typeof rosterDocumentSchema>;
