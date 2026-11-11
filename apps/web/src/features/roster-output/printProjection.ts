import type {
  CatalogShell,
  ChargeLine,
  CheckCoverage,
  EvaluatedCompositionNode,
  Evaluation,
  Option,
  OptionChoice,
  ResourceLedgerSnapshot,
  RosterDocument,
  RosterSelection,
  RosterStatistic,
  RosterIssue,
  TrackedToken,
  TrackedValue,
  UnitEntry,
} from '@battlegroup/core';
import { manifestVersionIdentity } from '@battlegroup/core';
import type { PurchaseAccess, RulesetId } from '@battlegroup/core';
import { projectSpecialRules, type SpecialRulesView } from '../../rulesets/specialRules';
import { rulesets } from '../../rulesets/registry';
import { getPresentation } from '../../rulesets/presentation';
import { unavailableReference, type PrintReferenceView } from '../../rulesets/presentationTypes';
import { sectionTree, descendantSectionIds } from '../roster-editor/sectionTree';
import { type SectionAllowance } from '../roster-editor/sectionAllowances';

/**
 * Pure print projection (M11). Everything below derives from ONE evaluation
 * snapshot plus the document and catalog it was computed against — the
 * projection never re-prices or re-runs game validation. Display subtotals
 * sum the snapshot's charge lines. Section counters reuse the canonical
 * resource allocator over the same frozen choices; they do not add issues.
 *
 * A mismatched or out-of-date snapshot is rejected (`status: 'stale'`) instead
 * of being silently printed: identity checks cover rosterId, edit revision and
 * the exact catalog identity on all three sides (document, catalog, evaluation).
 */

export interface PrintSnapshotInput {
  readonly document: RosterDocument;
  /** The same release the evaluation consumed; Application releases satisfy this structurally. */
  readonly release: { readonly catalog: CatalogShell; readonly purchases?: readonly PurchaseAccess[] };
  readonly evaluation: Evaluation;
}

export type PrintStaleReason =
  | 'roster-id'
  | 'edit-revision'
  | 'document-catalog'
  | 'release-catalog'
  | 'evaluation-catalog'
  | 'evaluation-schema-version'
  | 'evaluation-rules-revision'
  | 'evaluation-catalog-revision';

/** One displayed measurement: known sum plus completeness, mirroring MeasureStatus. */
export interface PrintMeasure {
  readonly knownSubtotal: number;
  readonly complete: boolean;
}

export interface PrintChargeLineView {
  readonly chargeLineId: string;
  readonly kind: ChargeLine['kind'];
  /** Option name for option deltas; null for base/attachment lines (component labels those). */
  readonly optionName: string | null;
  readonly chargedUnits: number;
  readonly points: TrackedValue;
  readonly br: TrackedValue;
}

export interface PrintOptionChoiceView {
  readonly optionGroupLocalId: string;
  readonly optionLocalId: string;
  readonly optionName: string;
  readonly groupName: string;
  readonly chargeMode: Option['chargeMode'];
  /** Resolved display labels for the player's stored targets (stable ids, not array positions). */
  readonly targetLabels: readonly string[];
  readonly chargedUnits: number;
  readonly points: PrintMeasure;
  readonly br: PrintMeasure;
}

export interface PrintCompositionRow {
  readonly key: string;
  readonly depth: number;
  readonly quantity: number;
  readonly label: string;
  readonly trainingToken: string | null;
  readonly trainingLabel: string | null;
}

export interface PrintFixedPlatoonView {
  readonly nodeId: string;
  readonly label: string;
  readonly trainingLabel: string | null;
  readonly rows: readonly PrintCompositionRow[];
  readonly attachments: readonly PrintPurchaseView[];
}

/**
 * Attachments anchored to a member path that is not one of the entry's fixed
 * platoon slots. The editor tree has no branch for them; printing them in a
 * residual group keeps the paper complete without guessing a parent.
 */
export interface PrintAnchoredAttachmentView {
  readonly pathLabel: string;
  readonly purchase: PrintPurchaseView;
}

export interface PrintPurchaseView {
  readonly specialRules: readonly string[];
  readonly selectionId: string;
  readonly entryLocalId: string;
  readonly name: string;
  readonly heading: string;
  readonly role: 'top-level' | 'attachment';
  /** Where this attachment is anchored (parent heading and member path words), when applicable. */
  readonly anchorLabel: string | null;
  readonly baseCost: { readonly points: TrackedValue; readonly br: TrackedValue };
  readonly baseKind: 'base-cost' | 'attachment-cost';
  readonly trainingToken: string | null;
  readonly trainingLabel: string | null;
  readonly compositionNote: string | null;
  readonly rows: readonly PrintCompositionRow[];
  readonly platoons: readonly PrintFixedPlatoonView[];
  readonly attachments: readonly PrintPurchaseView[];
  readonly otherAnchored: readonly PrintAnchoredAttachmentView[];
  readonly options: readonly PrintOptionChoiceView[];
  readonly charges: readonly PrintChargeLineView[];
  readonly subtotal: { readonly points: PrintMeasure; readonly br: PrintMeasure };
  readonly issueCount: number;
}

export interface PrintSectionView {
  readonly children: readonly PrintSectionView[];
  readonly sectionId: string;
  readonly label: string;
  readonly allowance?: SectionAllowance | undefined;
  readonly purchases: readonly PrintPurchaseView[];
}

export interface PrintIssueView {
  readonly ruleId: string;
  readonly severity: RosterIssue['severity'];
  readonly message: string;
  readonly actual?: number | string;
  readonly limit?: number | string;
  /** Heading of the offending purchase, when the issue is located to one. */
  readonly purchaseHeading: string | null;
}

export interface PrintVersionsView {
  readonly rosterFormat: string;
  readonly rulesetId: RulesetId;
  readonly catalogId: string;
  readonly catalogRevision: string;
  readonly catalogSchema: string;
  readonly rulesRevision: string;
  readonly baseEdition: string;
  readonly sourceTitles: readonly string[];
  readonly coverageNote: string;
  /** The edit revision this projection froze; shown so a stale preview is visible. */
  readonly editRevision: string;
}

export interface PrintableRoster {
  readonly specialRules: SpecialRulesView;
  readonly rosterId: string;
  readonly name: string;
  readonly armyListLabel: string;
  readonly settings: {
    readonly budgetPoints: number;
    readonly gameSizeId: string;
    readonly scenarioId: string | null;
    readonly playerRoleId: string | null;
    readonly optionalRules: readonly string[];
  };
  readonly notes: string | null;
  readonly versions: PrintVersionsView;
  readonly totals: { readonly points: PrintMeasure; readonly br: PrintMeasure };
  readonly budgetRemaining: number | null;
  readonly legality: Evaluation['legality'];
  readonly issues: readonly PrintIssueView[];
  readonly coverage: readonly CheckCoverage[];
  readonly resources: readonly ResourceLedgerSnapshot[];
  readonly statistics: readonly RosterStatistic[];
  readonly sections: readonly PrintSectionView[];
  readonly reference: PrintReferenceView;
}

export type PrintProjectionResult =
  | { readonly status: 'ready'; readonly roster: PrintableRoster }
  | { readonly status: 'stale'; readonly reason: PrintStaleReason; readonly detail: string };

const words = (id: string): string => id.replaceAll('-', ' ');
const pathWords = (path: readonly string[]): string => path.map(words).join(' / ');

function trainingView(token: TrackedToken | undefined, labels: Readonly<Record<string, string>>): { token: string | null; label: string | null } {
  if (!token || token.state !== 'known') return { token: null, label: null };
  return { token: token.value, label: labels[token.value] ?? null };
}

function measure(values: readonly TrackedValue[]): PrintMeasure {
  return {
    knownSubtotal: values.reduce((sum, value) => sum + (value.state === 'known' ? value.value : 0), 0),
    complete: values.every((value) => value.state === 'known'),
  };
}

export function projectPrintableRoster(input: PrintSnapshotInput, services = {registry: rulesets, presentation: getPresentation}): PrintProjectionResult {
  const { document, release, evaluation } = input;
  const catalog = release.catalog;
  const identity = catalog.manifest.identity;
  const runtime = services.registry.get(identity.rulesetId);
  const trainingLabels = runtime?.trainingLabels ?? {};
  const same = (a: { rulesetId: string; catalogId: string; catalogRevision: string }, b: { rulesetId: string; catalogId: string; catalogRevision: string }) =>
    a.rulesetId === b.rulesetId && a.catalogId === b.catalogId && a.catalogRevision === b.catalogRevision;
  if (evaluation.identity.rosterId !== document.rosterId)
    return { status: 'stale', reason: 'roster-id', detail: `evaluation ${evaluation.identity.rosterId} vs draft ${document.rosterId}` };
  if (evaluation.identity.inputRevision !== document.revision)
    return { status: 'stale', reason: 'edit-revision', detail: `evaluation ${evaluation.identity.inputRevision} vs draft ${document.revision}` };
  if (!same(evaluation.identity.catalog, document.catalogRef))
    return { status: 'stale', reason: 'document-catalog', detail: `document ${document.catalogRef.catalogId}/${document.catalogRef.catalogRevision}` };
  if (!same(identity, document.catalogRef))
    return { status: 'stale', reason: 'release-catalog', detail: `release ${identity.catalogId}/${identity.catalogRevision}` };
  if (!same(evaluation.identity.catalog, identity))
    return { status: 'stale', reason: 'evaluation-catalog', detail: `evaluation ${evaluation.identity.catalog.catalogId}/${evaluation.identity.catalog.catalogRevision}` };
  // The evaluation's stamped version triple must also match the release
  // manifest actually being printed; otherwise the sheet would show one set
  // of versions next to another version's costs and composition.
  const versions = manifestVersionIdentity(catalog.manifest);
  if (evaluation.identity.versions.schemaVersion !== versions.schemaVersion)
    return { status: 'stale', reason: 'evaluation-schema-version', detail: `evaluation ${evaluation.identity.versions.schemaVersion} vs catalog ${versions.schemaVersion}` };
  if (evaluation.identity.versions.rulesRevision !== versions.rulesRevision)
    return { status: 'stale', reason: 'evaluation-rules-revision', detail: `evaluation ${evaluation.identity.versions.rulesRevision} vs catalog ${versions.rulesRevision}` };
  if (evaluation.identity.versions.catalogRevision !== versions.catalogRevision)
    return { status: 'stale', reason: 'evaluation-catalog-revision', detail: `evaluation ${evaluation.identity.versions.catalogRevision} vs catalog ${versions.catalogRevision}` };

  const specialRules = projectSpecialRules(document, catalog, evaluation, services.presentation(identity.rulesetId)?.specialRules);
  const entries = new Map(catalog.entries.map((entry) => [entry.localId, entry]));
  const profiles = new Map(catalog.profiles.map((profile) => [profile.localId, profile]));
  const optionById = (groupId: string, optionId: string): Option | undefined =>
    catalog.optionGroups.find((group) => group.localId === groupId)?.options.find((option) => option.localId === optionId);
  const compositionOf = (selectionId: string): EvaluatedCompositionNode | undefined =>
    evaluation.composition.find((item) => item.selectionId === selectionId)?.node;
  const issueCountBySelection = new Map<string, number>();
  for (const issue of evaluation.issues)
    if (issue.selectionId) issueCountBySelection.set(issue.selectionId, (issueCountBySelection.get(issue.selectionId) ?? 0) + 1);

  // Pass 1: stable display headings per selection (name + ordinal inside its
  // own parent/member-path group, mirroring how the editor numbers instances).
  const headingBySelection = new Map<string, string>();
  const ordinalGroups = new Map<string, number>();
  for (const selection of document.selections) {
    const entry = entries.get(selection.entryReference.localId);
    const groupKey = JSON.stringify([
      selection.parentSelectionId,
      selection.parentSelectionId === null ? selection.sectionId : selection.targetMemberPath ?? [],
    ]);
    const ordinal = (ordinalGroups.get(groupKey) ?? 0) + 1;
    ordinalGroups.set(groupKey, ordinal);
    headingBySelection.set(selection.selectionId, `${entry?.name ?? selection.entryReference.localId} · ${ordinal}`);
  }

  const rowOf = (node: EvaluatedCompositionNode, prefix: string, depth: number): PrintCompositionRow => {
    const training = trainingView(node.training, trainingLabels);
    return {
      key: prefix + node.nodeId,
      depth,
      quantity: node.quantity,
      label: (node.profileLocalId ? profiles.get(node.profileLocalId)?.name : undefined) ?? words(node.role),
      trainingToken: training.token,
      trainingLabel: training.label,
    };
  };
  const buildRows = (node: EvaluatedCompositionNode, prefix: string, depth: number): PrintCompositionRow[] => [
    rowOf(node, prefix, depth),
    ...(node.children ?? []).flatMap((child, index) => buildRows(child, `${prefix}${node.nodeId}/${index}/`, depth + 1)),
  ];
  // Fixed platoons print as their own titled blocks (with their anchored
  // attachments); their members must therefore NOT repeat in the purchase's
  // own composition rows — every member appears exactly once per purchase.
  const isFixedPlatoon = (child: EvaluatedCompositionNode): boolean =>
    runtime?.isMemberGroup(child) ?? (!!child.configurableSlot && !!child.children?.length);

  const buildPurchase = (selection: RosterSelection, role: PrintPurchaseView['role'], anchorLabel: string | null): PrintPurchaseView => {
    const entry: UnitEntry | undefined = entries.get(selection.entryReference.localId);
    const heading = headingBySelection.get(selection.selectionId) ?? selection.selectionId;
    const node = compositionOf(selection.selectionId);
    const charges: PrintChargeLineView[] = evaluation.chargeLines
      .filter((line) => line.selectionId === selection.selectionId)
      .map((line) => ({
        chargeLineId: line.chargeLineId,
        kind: line.kind,
        optionName: line.optionChoiceRef
          ? optionById(line.optionChoiceRef.optionGroupLocalId, line.optionChoiceRef.optionLocalId)?.name ?? line.optionChoiceRef.optionLocalId
          : null,
        chargedUnits: line.chargedUnits,
        points: line.points,
        br: line.br,
      }));
    const baseLine = charges.find((line) => line.kind !== 'option-delta');
    const options: PrintOptionChoiceView[] = selection.optionChoices.map((choice: OptionChoice) => {
      const option = optionById(choice.optionGroupLocalId, choice.optionLocalId);
      const group = catalog.optionGroups.find((item) => item.localId === choice.optionGroupLocalId);
      const optionLines = evaluation.chargeLines.filter((line) => line.selectionId === selection.selectionId && line.optionChoiceRef?.optionGroupLocalId === choice.optionGroupLocalId && line.optionChoiceRef?.optionLocalId === choice.optionLocalId);
      return {
        optionGroupLocalId: choice.optionGroupLocalId,
        optionLocalId: choice.optionLocalId,
        optionName: option?.name ?? choice.optionLocalId,
        groupName: group?.name ?? choice.optionGroupLocalId,
        chargeMode: option?.chargeMode ?? 'once',
        targetLabels: choice.targets.map((target) => {
          if (target.kind === 'whole-selection') return 'whole-selection';
          if (target.kind === 'member-path') return pathWords(target.nodePath);
          return `${headingBySelection.get(target.ownerSelectionId) ?? target.ownerSelectionId} — ${pathWords(target.nodePath)}`;
        }),
        chargedUnits: optionLines.reduce((sum, line) => sum + line.chargedUnits, 0),
        points: measure(optionLines.map((line) => line.points)),
        br: measure(optionLines.map((line) => line.br)),
      };
    });
    const ownLines = evaluation.chargeLines.filter((line) => line.selectionId === selection.selectionId);
    const childSelections = document.selections.filter((item) => item.parentSelectionId === selection.selectionId);
    const directAttachments = childSelections.filter((item) => !item.targetMemberPath);
    const training = trainingView(node?.training, trainingLabels);
    const compositionNote =
      entry && entry.composition.state !== 'known' ? entry.composition.reason : null;
    const platoonViews =
      node?.children
        ?.filter(isFixedPlatoon)
        .map((platoon) => ({
          platoon,
          view: {
            nodeId: platoon.nodeId,
            label: words(platoon.nodeId),
            // A platoon node that itself carries a profile (a leaf platoon)
            // is a member too; role-only platoon wrappers are represented by
            // the block heading alone.
            rows: [
              ...(platoon.profileLocalId
                ? [rowOf(platoon, `${selection.selectionId}/${platoon.nodeId}/`, 0)]
                : []),
              ...(platoon.children ?? []).flatMap((child, index) =>
                buildRows(child, `${selection.selectionId}/${platoon.nodeId}/${index}/`, 0),
              ),
            ],
            trainingLabel: trainingView(platoon.training, trainingLabels).label,
            attachments: childSelections
              .filter((item) => (item.targetMemberPath ?? []).length === 1 && item.targetMemberPath?.[0] === platoon.nodeId)
              .map((item, index) => buildPurchase(item, 'attachment', `${heading} — ${words(platoon.nodeId)} · ${index + 1}`)),
          } satisfies PrintFixedPlatoonView,
        })) ?? [];
    const matchedAnchored = new Set(
      platoonViews.flatMap(({ platoon }) =>
        childSelections
          .filter((item) => (item.targetMemberPath ?? []).length === 1 && item.targetMemberPath?.[0] === platoon.nodeId)
          .map((item) => item.selectionId),
      ),
    );
    return {
      specialRules: [...new Set(specialRules.uses.filter(use => use.selectionId === selection.selectionId).flatMap(use => use.rules.map(rule => rule.name)))],
      selectionId: selection.selectionId,
      entryLocalId: selection.entryReference.localId,
      name: entry?.name ?? selection.entryReference.localId,
      heading,
      role,
      anchorLabel,
      baseCost: baseLine
        ? { points: baseLine.points, br: baseLine.br }
        : entry
          ? { points: entry.baseCost.points, br: entry.baseCost.br }
          : { points: { state: 'unknown', reason: 'missing entry' }, br: { state: 'unknown', reason: 'missing entry' } },
      baseKind: selection.parentSelectionId === null ? 'base-cost' : 'attachment-cost',
      trainingToken: training.token,
      trainingLabel: training.label,
      compositionNote,
      rows: node
        ? [
            // A root that itself carries a profile (e.g. the exact 1.0.0
            // BRDM-2 leaf) is a composition member in its own right; a
            // role-only container root is represented by its children only.
            ...(node.profileLocalId ? [rowOf(node, `${selection.selectionId}/`, 0)] : []),
            ...(node.children ?? [])
              .filter((child) => !isFixedPlatoon(child))
              .flatMap((child, index) => buildRows(child, `${selection.selectionId}/${index}/`, 0)),
          ]
        : [],
      platoons: platoonViews.map(({ view }) => view),
      attachments: directAttachments.map((item, index) =>
        buildPurchase(item, 'attachment', `${heading} · ${index + 1}`),
      ),
      otherAnchored: childSelections
        .filter((item) => item.targetMemberPath && !matchedAnchored.has(item.selectionId))
        .map((item) => ({
          pathLabel: pathWords(item.targetMemberPath ?? []),
          purchase: buildPurchase(item, 'attachment', `${heading} — ${pathWords(item.targetMemberPath ?? [])}`),
        })),
      options,
      charges,
      subtotal: {
        points: measure(ownLines.map((line) => line.points)),
        br: measure(ownLines.map((line) => line.br)),
      },
      issueCount: issueCountBySelection.get(selection.selectionId) ?? 0,
    };
  };

  const armyList = catalog.armyLists.find((list) => list.armyListId === document.armyListId);
  const allowances = release.purchases && runtime
    ? runtime.sectionAllowances(document, {catalog, purchases: release.purchases}, evaluation)
    : new Map<string, SectionAllowance>();
  const buildSections = (nodes: ReturnType<typeof sectionTree>): PrintSectionView[] => nodes.map(({section, children}) => ({
    sectionId: section.sectionId,
    label: runtime?.sectionLabel(identity, section) ?? section.name,
    allowance: children.length ? {
      limits: allowances.get(section.sectionId)?.limits ?? [],
      selected: document.selections.filter(item => item.parentSelectionId === null && descendantSectionIds({section, children}).includes(item.sectionId!)).length,
    } : allowances.get(section.sectionId),
    children: buildSections(children),
    purchases: document.selections
      .filter(item => item.parentSelectionId === null && item.sectionId === section.sectionId)
      .map(item => buildPurchase(item, 'top-level', null)),
  })).filter(section => section.purchases.length > 0 || section.children.length > 0);
  const sections = buildSections(sectionTree(armyList?.structure.sections ?? []));
  const allSections = (items: readonly PrintSectionView[]): PrintSectionView[] => items.flatMap(item => [item, ...allSections(item.children)]);
  // Orphans (structure failures) must not vanish from the printout silently.
  const knownTop = new Set(document.selections.filter((item) => item.parentSelectionId === null).map((item) => item.selectionId));
  const listed = new Set(allSections(sections).flatMap((section) => section.purchases.map((purchase) => purchase.selectionId)));
  const orphans = [...knownTop].filter((id) => !listed.has(id));
  if (orphans.length)
    sections.push({
      sectionId: 'unplaced',
      label: 'Unplaced purchases',
      children: [],
      purchases: orphans.map((id) => {
        const selection = document.selections.find((item) => item.selectionId === id)!;
        return buildPurchase(selection, 'top-level', null);
      }),
    });

  const roster: PrintableRoster = {
    specialRules,
    rosterId: document.rosterId,
    name: document.name,
    armyListLabel: armyList ? `${armyList.nation} · ${armyList.name}` : document.armyListId,
    settings: {
      budgetPoints: document.settings.budgetPoints,
      gameSizeId: document.settings.gameSizeId,
      scenarioId: document.settings.scenarioId ?? null,
      playerRoleId: document.settings.playerRoleId ?? null,
      optionalRules: document.settings.optionalRules,
    },
    notes: document.notes ?? null,
    versions: {
      rosterFormat: document.formatVersion,
      rulesetId: identity.rulesetId,
      catalogId: identity.catalogId,
      catalogRevision: identity.catalogRevision,
      catalogSchema: evaluation.identity.versions.schemaVersion,
      rulesRevision: evaluation.identity.versions.rulesRevision,
      baseEdition: catalog.manifest.baseEdition,
      sourceTitles: catalog.manifest.sources.map((source) => source.title),
      coverageNote: catalog.manifest.coverage.note,
      editRevision: evaluation.identity.inputRevision,
    },
    totals: {
      points: { knownSubtotal: evaluation.totals.points.knownSubtotal, complete: evaluation.totals.points.complete },
      br: { knownSubtotal: evaluation.totals.br.knownSubtotal, complete: evaluation.totals.br.complete },
    },
    budgetRemaining: evaluation.totals.points.complete ? document.settings.budgetPoints - evaluation.totals.points.knownSubtotal : null,
    legality: evaluation.legality,
    issues: evaluation.issues.map((issue) => ({
      ruleId: issue.ruleId,
      severity: issue.severity,
      message: issue.message,
      ...(issue.actual !== undefined ? { actual: issue.actual } : {}),
      ...(issue.limit !== undefined ? { limit: issue.limit } : {}),
      purchaseHeading: issue.selectionId ? headingBySelection.get(issue.selectionId) ?? null : null,
    })),
    coverage: evaluation.coverage,
    resources: evaluation.resources,
    statistics: evaluation.statistics,
    sections,
    reference: services.presentation(identity.rulesetId)?.projectReference(catalog, evaluation) ?? unavailableReference(),
  };
  return { status: 'ready', roster };
}
