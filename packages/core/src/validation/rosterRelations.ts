import type { CatalogShell, CompositionNode, Option, UnitEntry } from '../contracts/catalog';
import type { RosterDocument, RosterSelection } from '../contracts/roster';
import { resolveCompositionPath } from './catalogRelations';
import { integrityIssue, type IntegrityIssue } from './integrityIssue';

/**
 * Pure relationship checks over an already schema-parsed roster document
 * against an explicit, already-parsed catalog. This is the only place a
 * roster's references are resolved, and resolution is strictly by identity:
 * ruleset + catalog + exact revision + localId. A record that exists in
 * another ruleset or another revision is *not* a fallback — same-name and
 * same-localId records elsewhere simply do not exist for this validation.
 *
 * Resolution invariants (rework R1): every resolution — the roster->catalog
 * binding, the starting selection, and each attachment owner — is gated on
 * full identity; a mismatch refuses resolution instead of borrowing a
 * same-localId record. Relation validation stops entirely when the roster is
 * bound to a different catalog identity, so no check borrows records while
 * an identity error is being reported.
 *
 * Game-rule violations (over budget, too many support picks, PT-76 tank
 * exclusion, ...) are intentionally not checked here: a rule-breaking roster
 * is still a structurally valid document. See integrityIssue.ts.
 */

interface RosterContext {
  readonly roster: RosterDocument;
  readonly catalog: CatalogShell;
  readonly entries: Map<string, UnitEntry>;
  readonly selections: Map<string, RosterSelection>;
  readonly optionGroups: Map<string, CatalogShell['optionGroups'][number]>;
  readonly sectionsByArmyList: Map<string, Map<string, { directlyPurchasable: boolean }>>;
}

function buildContext(roster: RosterDocument, catalog: CatalogShell): RosterContext {
  return {
    roster,
    catalog,
    entries: new Map(catalog.entries.map((entry) => [entry.localId, entry] as const)),
    selections: new Map(roster.selections.map((selection) => [selection.selectionId, selection] as const)),
    optionGroups: new Map(catalog.optionGroups.map((group) => [group.localId, group] as const)),
    sectionsByArmyList: new Map(
      catalog.armyLists.map((list) => [
        list.armyListId,
        new Map(
          list.structure.sections.map((section) => [
            section.sectionId,
            { directlyPurchasable: section.directlyPurchasable },
          ] as const),
        ),
      ] as const),
    ),
  };
}

function sameIdentity(
  a: { rulesetId: string; catalogId: string; catalogRevision: string },
  b: { rulesetId: string; catalogId: string; catalogRevision: string },
): boolean {
  return (
    a.rulesetId === b.rulesetId &&
    a.catalogId === b.catalogId &&
    a.catalogRevision === b.catalogRevision
  );
}

/**
 * Resolves a member path within one selection's own entry composition.
 * Static-only: attachments are never traversed implicitly (R2) — an
 * attachment's members are addressed explicitly via
 * `resolveAttachmentMemberPath`. Identity gates (R1): the roster must be
 * bound to exactly this catalog, and the selection's embedded reference must
 * match that binding and resolve here; otherwise null, never a borrowed node.
 */
export function resolveRosterMemberPath(
  roster: RosterDocument,
  catalog: CatalogShell,
  selectionId: string,
  nodePath: readonly string[],
): { owner: RosterSelection; node: CompositionNode } | null {
  if (!sameIdentity(roster.catalogRef, catalog.manifest.identity)) {
    return null;
  }
  const owner = roster.selections.find((selection) => selection.selectionId === selectionId);
  if (owner === undefined || !sameIdentity(owner.entryReference, roster.catalogRef)) {
    return null;
  }
  const entry = catalog.entries.find((candidate) => candidate.localId === owner.entryReference.localId);
  if (entry === undefined) {
    return null;
  }
  const node = resolveCompositionPath(entry, nodePath);
  return node === null ? null : { owner, node };
}

/**
 * Resolves a member path inside a purchased attachment's own composition
 * (path relative to the attachment's composition root). The owning selection
 * keeps its identity: two identical attachments stay separately addressable
 * regardless of ordering. Same identity gates as resolveRosterMemberPath;
 * whether the owner actually belongs under the choosing formation is the
 * caller's (validator's) relationship check.
 */
export function resolveAttachmentMemberPath(
  roster: RosterDocument,
  catalog: CatalogShell,
  ownerSelectionId: string,
  nodePath: readonly string[],
): { owner: RosterSelection; node: CompositionNode } | null {
  return resolveRosterMemberPath(roster, catalog, ownerSelectionId, nodePath);
}

/** True when `selectionId` lies strictly below `ancestorId` in the parent chain. */
function isDescendantOf(
  selections: ReadonlyMap<string, RosterSelection>,
  selectionId: string,
  ancestorId: string,
): boolean {
  const visited = new Set<string>();
  let cursor = selections.get(selectionId);
  while (cursor !== undefined && cursor.parentSelectionId !== null) {
    if (visited.has(cursor.selectionId)) {
      return false; // cycle — reported separately
    }
    visited.add(cursor.selectionId);
    if (cursor.parentSelectionId === ancestorId) {
      return true;
    }
    cursor = selections.get(cursor.parentSelectionId);
  }
  return false;
}

function pathsEqual(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function validateOptionChoice(
  ctx: RosterContext,
  selection: RosterSelection,
  entry: UnitEntry,
  choiceIndex: number,
): IntegrityIssue[] {
  const issues: IntegrityIssue[] = [];
  const choice = selection.optionChoices[choiceIndex];
  if (choice === undefined) {
    return issues;
  }
  const prefix = `selections[${selection.selectionId}].optionChoices[${choiceIndex}]`;
  const group = ctx.optionGroups.get(choice.optionGroupLocalId);
  const groupAttached = entry.optionGroupIds.includes(choice.optionGroupLocalId);
  if (group === undefined || !groupAttached) {
    issues.push(
      integrityIssue(
        'roster/option/group-not-attached',
        `${prefix}.optionGroupLocalId`,
        group === undefined
          ? `option group "${choice.optionGroupLocalId}" does not exist in the catalog`
          : `option group "${choice.optionGroupLocalId}" is not offered by entry "${entry.localId}"`,
      ),
    );
    return issues;
  }
  const option: Option | undefined = group.options.find(
    (candidate) => candidate.localId === choice.optionLocalId,
  );
  if (option === undefined) {
    issues.push(
      integrityIssue(
        'roster/option/unknown-option',
        `${prefix}.optionLocalId`,
        `option "${choice.optionLocalId}" does not exist in group "${group.localId}"`,
      ),
    );
    return issues;
  }

  for (const [targetIndex, target] of choice.targets.entries()) {
    const targetPrefix = `${prefix}.targets[${targetIndex}]`;
    if (target.kind === 'whole-selection') {
      if (option.target.kind !== 'whole-selection') {
        issues.push(
          integrityIssue(
            'roster/option/target-kind-mismatch',
            targetPrefix,
            `option "${option.localId}" targets members but the choice records a whole-selection target`,
          ),
        );
      }
      continue;
    }
    if (target.kind === 'attachment-member') {
      if (option.target.kind === 'whole-selection') {
        issues.push(
          integrityIssue(
            'roster/option/target-kind-mismatch',
            targetPrefix,
            `option "${option.localId}" targets the whole selection but the choice records an attachment member path`,
          ),
        );
        continue;
      }
      if (option.target.kind === 'member-slots') {
        issues.push(
          integrityIssue(
            'roster/option/target-not-in-declared-slots',
            targetPrefix,
            `option "${option.localId}" declares slots in its own entry; an attachment member is outside those slots`,
          ),
        );
        continue;
      }
      if (!ctx.selections.has(target.ownerSelectionId)) {
        issues.push(
          integrityIssue(
            'roster/option/attachment-owner-unknown',
            `${targetPrefix}.ownerSelectionId`,
            `attachment owner selection "${target.ownerSelectionId}" does not exist`,
          ),
        );
        continue;
      }
      if (
        !isDescendantOf(ctx.selections, target.ownerSelectionId, selection.selectionId)
      ) {
        issues.push(
          integrityIssue(
            'roster/option/attachment-owner-not-descendant',
            `${targetPrefix}.ownerSelectionId`,
            `attachment owner "${target.ownerSelectionId}" is not an attachment under selection "${selection.selectionId}"`,
          ),
        );
        continue;
      }
      if (
        resolveAttachmentMemberPath(
          ctx.roster,
          ctx.catalog,
          target.ownerSelectionId,
          target.nodePath,
        ) === null
      ) {
        issues.push(
          integrityIssue(
            'roster/option/member-path-unresolvable',
            `${targetPrefix}.nodePath`,
            `attachment member path [${target.nodePath.join('/')}] of owner "${target.ownerSelectionId}" does not resolve (identity-checked, or outside the owner's composition)`,
          ),
        );
      }
      // Only scope-selector definitions may address attachment members;
      // static member-slots were rejected above.
      continue;
    }
    // member-path: static composition of the choosing selection only.
    if (option.target.kind !== 'member-slots' && option.target.kind !== 'scope-selector') {
      issues.push(
        integrityIssue(
          'roster/option/target-kind-mismatch',
          targetPrefix,
          `option "${option.localId}" targets the whole selection but the choice records a member path`,
        ),
      );
      continue;
    }
    if (resolveRosterMemberPath(ctx.roster, ctx.catalog, selection.selectionId, target.nodePath) === null) {
      issues.push(
        integrityIssue(
          'roster/option/member-path-unresolvable',
          `${targetPrefix}.nodePath`,
          `member path [${target.nodePath.join('/')}] does not resolve in the static composition of "${selection.selectionId}" (attachment members need an attachment-member target)`,
        ),
      );
      continue;
    }
    if (option.target.kind === 'member-slots') {
      const declared = option.target.nodePaths.some((nodePath) => pathsEqual(nodePath, target.nodePath));
      if (!declared) {
        issues.push(
          integrityIssue(
            'roster/option/target-not-in-declared-slots',
            `${targetPrefix}.nodePath`,
            `member path [${target.nodePath.join('/')}] is not one of the slots declared by option "${option.localId}"`,
          ),
        );
      }
    }
    // scope-selector options accept any identity-checked resolvable member
    // path: their live target set depends on current attachments (A03) and
    // is recomputed by evaluation, not frozen in the option definition.
  }
  return issues;
}

/** Validates a roster document against an explicit catalog. Both must already pass their Zod schema. */
export function validateRosterRelations(
  roster: RosterDocument,
  catalog: CatalogShell,
): IntegrityIssue[] {
  const ctx = buildContext(roster, catalog);
  const issues: IntegrityIssue[] = [];

  if (!sameIdentity(roster.catalogRef, catalog.manifest.identity)) {
    issues.push(
      integrityIssue(
        'roster/catalog/identity-mismatch',
        'catalogRef',
        `roster references catalog ${roster.catalogRef.rulesetId}/${roster.catalogRef.catalogId}@${roster.catalogRef.catalogRevision} but validation context is ${catalog.manifest.identity.rulesetId}/${catalog.manifest.identity.catalogId}@${catalog.manifest.identity.catalogRevision}; no record of this catalog may be borrowed for further checks`,
      ),
    );
    // Nothing below this line can be interpreted against this catalog.
    return issues;
  }
  const armyList = catalog.armyLists.find((list) => list.armyListId === roster.armyListId);
  if (armyList === undefined) {
    issues.push(
      integrityIssue(
        'roster/army-list/unknown',
        'armyListId',
        `army list "${roster.armyListId}" does not exist in the catalog`,
      ),
    );
  }

  const seen = new Set<string>();
  for (const selection of roster.selections) {
    if (seen.has(selection.selectionId)) {
      issues.push(
        integrityIssue(
          'roster/selection/duplicate-id',
          `selections[${selection.selectionId}]`,
          `duplicate selectionId "${selection.selectionId}"`,
        ),
      );
    }
    seen.add(selection.selectionId);
  }

  for (const selection of roster.selections) {
    const prefix = `selections[${selection.selectionId}]`;
    if (!sameIdentity(selection.entryReference, roster.catalogRef)) {
      issues.push(
        integrityIssue(
          'roster/selection/entry-reference-identity-mismatch',
          `${prefix}.entryReference`,
          `selection references ${selection.entryReference.rulesetId}/${selection.entryReference.catalogId}@${selection.entryReference.catalogRevision} instead of the roster catalog ${roster.catalogRef.rulesetId}/${roster.catalogRef.catalogId}@${roster.catalogRef.catalogRevision}; cross-ruleset and cross-revision references are rejected`,
        ),
      );
      // A foreign reference must not borrow a same-localId record from this
      // catalog for further checks: the reference is rejected outright.
      continue;
    }
    const entry = ctx.entries.get(selection.entryReference.localId);
    if (entry === undefined) {
      issues.push(
        integrityIssue(
          'roster/selection/entry-unknown',
          `${prefix}.entryReference.localId`,
          `entry "${selection.entryReference.localId}" does not exist in this catalog (records with the same name or localId in other rulesets or revisions are not substitutes)`,
        ),
      );
      continue;
    }
    if (!entry.armyListIds.includes(roster.armyListId)) {
      issues.push(
        integrityIssue(
          'roster/selection/entry-not-in-army-list',
          `${prefix}.entryReference.localId`,
          `entry "${entry.localId}" is not purchasable in army list "${roster.armyListId}"`,
        ),
      );
    }

    if (selection.parentSelectionId === null) {
      const sections = armyList === undefined ? undefined : ctx.sectionsByArmyList.get(armyList.armyListId);
      const sectionId = selection.sectionId;
      if (sectionId !== undefined && sections !== undefined) {
        const section = sections.get(sectionId);
        if (section === undefined) {
          issues.push(
            integrityIssue(
              'roster/selection/section-unknown',
              `${prefix}.sectionId`,
              `section "${sectionId}" does not exist in army list "${roster.armyListId}"`,
            ),
          );
        } else if (!entry.sectionIds.includes(sectionId)) {
          issues.push(
            integrityIssue(
              'roster/selection/section-not-eligible',
              `${prefix}.sectionId`,
              `entry "${entry.localId}" may not be purchased into section "${sectionId}"`,
            ),
          );
        } else if (!section.directlyPurchasable) {
          issues.push(
            integrityIssue(
              'roster/selection/section-not-directly-purchasable',
              `${prefix}.sectionId`,
              `section "${sectionId}" groups purchasable children but is not directly purchasable itself`,
            ),
          );
        }
      }
    } else {
      if (!ctx.selections.has(selection.parentSelectionId)) {
        issues.push(
          integrityIssue(
            'roster/selection/unknown-parent',
            `${prefix}.parentSelectionId`,
            `parent selection "${selection.parentSelectionId}" does not exist`,
          ),
        );
      }
      if (selection.targetMemberPath !== undefined && selection.parentSelectionId !== null) {
        const parent = ctx.selections.get(selection.parentSelectionId);
        if (parent !== undefined) {
          const resolved = resolveRosterMemberPath(
            ctx.roster,
            ctx.catalog,
            parent.selectionId,
            selection.targetMemberPath,
          );
          if (resolved === null) {
            issues.push(
              integrityIssue(
                'roster/selection/attachment-path-unresolvable',
                `${prefix}.targetMemberPath`,
                `attach point [${selection.targetMemberPath.join('/')}] does not resolve under parent "${parent.selectionId}"`,
              ),
            );
          }
        }
      }
    }

    for (let index = 0; index < selection.optionChoices.length; index += 1) {
      issues.push(...validateOptionChoice(ctx, selection, entry, index));
    }
  }

  // Parent-chain cycle detection (a -> b -> a cannot be a tree).
  for (const selection of roster.selections) {
    const visited = new Set<string>();
    let cursor: RosterSelection | undefined = selection;
    while (cursor !== undefined && cursor.parentSelectionId !== null) {
      if (visited.has(cursor.selectionId)) {
        issues.push(
          integrityIssue(
            'roster/selection/parent-cycle',
            `selections[${selection.selectionId}].parentSelectionId`,
            `parent chain from "${selection.selectionId}" cycles at "${cursor.selectionId}"`,
          ),
        );
        break;
      }
      visited.add(cursor.selectionId);
      cursor = ctx.selections.get(cursor.parentSelectionId);
    }
  }

  return issues;
}
