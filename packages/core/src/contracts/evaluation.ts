import type { CatalogIdentity, RulesetId } from './primitives';
import type { CompositionNode } from './catalog';
import type { RosterDocument } from './roster';
import type { SourceReference } from './source';
import type { TrackedValue, TrackedToken } from './values';
import type { VersionIdentity } from './versioning';

/**
 * Evaluation and availability RESULT protocols (docs/architecture.md §5).
 *
 * M03 introduced these shapes. M06 now supplies generic evaluation/pricing;
 * concrete game rules remain in ruleset modules (M07). A ruleset module that
 * claims to implement `RulesetModule` returns these objects; the shapes make
 * honest reporting (unknown data, partial coverage) representable.
 */

/**
 * Stamps every derived result so the UI can reject stale evaluations.
 *
 * `inputRevision` is the roster document's edit revision (RosterDocument.revision)
 * the evaluation actually consumed. Producer convention: the evaluator copies
 * it verbatim from its input document. Consumer convention: compare against
 * the current document's revision and discard the result on any mismatch —
 * two snapshots of the same rosterId with different revisions are different
 * edits. This is deliberately a third revision axis: catalog revisions say
 * which *data* was used; the M09 storage save revision guards persistence
 * concurrency; inputRevision identifies the *edit* being evaluated.
 */
export interface EvaluationIdentity {
  readonly rosterId: string;
  readonly inputRevision: string;
  readonly catalog: CatalogIdentity;
  readonly versions: VersionIdentity;
}

/** Expanded composition of one selection, produced by evaluation — never stored on the roster. */
export type EvaluatedCompositionNode = Omit<CompositionNode,'children'> & {
  children?:EvaluatedCompositionNode[] | undefined;
  training?:TrackedToken;
  tags?:string[];
};
export interface ExpandedSelectionComposition {
  readonly selectionId: string;
  readonly node: EvaluatedCompositionNode;
}

/**
 * One billing line. `attributionKey` is unique per (selection, charge source,
 * target); re-expanding a fixed sub-formation never produces a second line
 * for the same key, which is how double-charging is prevented (C04).
 */
export interface ChargeLine {
  readonly chargeLineId: string;
  readonly attributionKey: string;
  readonly kind: 'base-cost' | 'option-delta' | 'attachment-cost';
  readonly selectionId: string;
  readonly optionChoiceRef?: { readonly optionGroupLocalId: string; readonly optionLocalId: string };
  readonly chargedUnits: number;
  readonly points: TrackedValue;
  readonly br: TrackedValue;
  readonly sourceRefs: readonly SourceReference[];
}

/** Totals with completeness. Unknown charge lines yield a known subtotal, never a final total. */
export interface MeasureStatus {
  readonly knownSubtotal: number;
  readonly complete: boolean;
  readonly incompleteChargeLineIds: readonly string[];
}

export interface RosterTotals {
  readonly points: MeasureStatus;
  readonly br: MeasureStatus;
}

export type IssueSeverity = 'error' | 'warning' | 'info';

/** One confirmed problem, located to a selection and optional member path. */
export interface RosterIssue {
  readonly ruleId: string;
  readonly severity: IssueSeverity;
  readonly message: string;
  readonly selectionId?: string;
  readonly nodePath?: readonly string[];
  readonly actual?: number | string;
  readonly limit?: number | string;
  readonly sourceRefs?: readonly SourceReference[];
}

/**
 * Coverage is independent of issue severity: "no errors found" plus
 * "check not implemented" must still read as "cannot conclude legal", not as
 * "legal" (docs/architecture.md §4.5).
 */
export type CheckStatus =
  | 'covered'
  | 'not-implemented'
  | 'blocked-unknown-data'
  | 'missing-input';

export interface CheckCoverage {
  readonly checkId: string;
  readonly status: CheckStatus;
  readonly note?: string;
}

export type LegalityConclusion = 'legal' | 'violations-confirmed' | 'undetermined';

/** One support pool: produced/consumed amounts with its own completeness state. */
export interface ResourceLedgerSnapshot {
  readonly resourceKind: string;
  readonly scope: 'army' | 'parent-formation' | 'formation-member';
  readonly selectionId?: string;
  readonly nodePath?: readonly string[];
  readonly capacity: TrackedValue;
  readonly consumed: number;
  readonly status: CheckStatus;
}

/** Named statistic (officers, scout weight, ...), values sourced by ruleset rules. */
export interface RosterStatistic {
  readonly statId: string;
  readonly label: string;
  readonly value: number;
  readonly status: CheckStatus;
  readonly sourceRefs?: readonly SourceReference[];
}

export interface Evaluation {
  readonly identity: EvaluationIdentity;
  readonly composition: readonly ExpandedSelectionComposition[];
  readonly chargeLines: readonly ChargeLine[];
  readonly totals: RosterTotals;
  readonly resources: readonly ResourceLedgerSnapshot[];
  readonly statistics: readonly RosterStatistic[];
  readonly issues: readonly RosterIssue[];
  readonly coverage: readonly CheckCoverage[];
  readonly legality: LegalityConclusion;
}

export type AvailabilityStatus = 'allowed' | 'blocked' | 'unknown';

export interface AvailabilityReason {
  readonly code: string;
  readonly message: string;
  readonly sourceRefs?: readonly SourceReference[];
}

/** Result of asking whether one entry may be purchased at one target. */
export interface Availability {
  readonly status: AvailabilityStatus;
  readonly reasons: readonly AvailabilityReason[];
}

export type CompatibilityStatus = 'supported' | 'unsupported' | 'unknown';

export interface CompatibilityResult {
  readonly status: CompatibilityStatus;
  readonly reasons: readonly string[];
}

/**
 * Protocol that a ruleset module implements. Declared here so the web app can
 * depend on the interface, not on a concrete module. No implementation of
 * this interface existed in M03. The evaluation context type is intentionally
 * left open (`unknown`) until the M04 loader defines the resolved-context
 * contract; implementations must not narrow it to something web-specific.
 */
export interface RulesetModule {
  readonly id: RulesetId;
  supports(identity: CatalogIdentity): CompatibilityResult;
  /**
   * Evaluates one roster against one resolved catalog. Implementations
   * arrive with M07; the signature is fixed here so evaluation results stay
   * interchangeable.
   */
  evaluate(roster: RosterDocument, context: unknown): Evaluation;
  getEntryAvailability(
    entryLocalId: string,
    target: {
      readonly selectionId?: string;
      readonly sectionId?: string;
      readonly targetMemberPath?: readonly string[];
    },
    roster: RosterDocument,
    context: unknown,
    evaluation: Evaluation,
  ): Availability;
}
