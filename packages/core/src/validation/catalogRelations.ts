import type {
  ArmyListDescriptor,
  CatalogShell,
  CompositionNode,
  Option,
  OptionGroup,
  UnitEntry,
} from '../contracts/catalog';
import { integrityIssue, type IntegrityIssue } from './integrityIssue';

/**
 * Pure relationship checks over an already schema-parsed catalog shell.
 *
 * These checks need the *explicit catalog context* — they relate records to
 * each other, which a single-object Zod parse cannot do. Zod covers shape,
 * numeric ranges and discriminated states; everything here covers identity
 * and reference relationships. Not checked (out of M03 scope, never claimed):
 * game-rule thresholds, category eligibility semantics, whether a resource
 * kind is known to a ruleset, and whether composition modelling is faithful
 * to the printed army list.
 */

function duplicateValues(values: readonly string[]): Set<string> {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) {
      duplicates.add(value);
    } else {
      seen.add(value);
    }
  }
  return duplicates;
}

/** Node ids must be unique among siblings; the same id under different parents is a distinct, unambiguous path. */
function validateSiblingNodeIds(node: CompositionNode, entryLocalId: string): IntegrityIssue[] {
  const issues: IntegrityIssue[] = [];
  const siblings = node.children ?? [];
  for (const duplicate of duplicateValues(siblings.map((child) => child.nodeId))) {
    issues.push(
      integrityIssue(
        'catalog/entry/duplicate-node-id',
        `entries[${entryLocalId}].composition`,
        `duplicate composition nodeId "${duplicate}" among children of "${node.nodeId}" in entry "${entryLocalId}"`,
      ),
    );
  }
  for (const child of siblings) {
    issues.push(...validateSiblingNodeIds(child, entryLocalId));
  }
  return issues;
}

/** Resolves a member nodePath against an entry's known composition; null when unresolvable. */
export function resolveCompositionPath(
  entry: UnitEntry,
  nodePath: readonly string[],
): CompositionNode | null {
  if (entry.composition.state !== 'known' || nodePath.length === 0) {
    return null;
  }
  let current = entry.composition.root;
  for (const segment of nodePath) {
    const child = (current.children ?? []).find((candidate) => candidate.nodeId === segment);
    if (child === undefined) {
      return null;
    }
    current = child;
  }
  return current;
}

function validateSections(armyList: ArmyListDescriptor): IntegrityIssue[] {
  const issues: IntegrityIssue[] = [];
  const prefix = `armyLists[${armyList.armyListId}].structure.sections`;
  const sectionIds = armyList.structure.sections.map((section) => section.sectionId);
  for (const duplicate of duplicateValues(sectionIds)) {
    issues.push(
      integrityIssue(
        'catalog/section/duplicate-id',
        `${prefix}[${duplicate}]`,
        `duplicate sectionId "${duplicate}" in army list "${armyList.armyListId}"`,
      ),
    );
  }
  const byId = new Map(armyList.structure.sections.map((section) => [section.sectionId, section]));
  for (const section of armyList.structure.sections) {
    const parent = section.parentSectionId;
    if (parent !== null && !byId.has(parent)) {
      issues.push(
        integrityIssue(
          'catalog/section/unknown-parent',
          `${prefix}[${section.sectionId}].parentSectionId`,
          `section "${section.sectionId}" references unknown parent section "${parent}"`,
        ),
      );
    }
  }
  // Cycle detection: walk parent chains with a visited set per starting node.
  for (const section of armyList.structure.sections) {
    const visited = new Set<string>();
    let cursor: string | null = section.sectionId;
    while (cursor !== null) {
      if (visited.has(cursor)) {
        issues.push(
          integrityIssue(
            'catalog/section/cycle',
            `${prefix}[${section.sectionId}].parentSectionId`,
            `section parent chain from "${section.sectionId}" cycles at "${cursor}"`,
          ),
        );
        break;
      }
      visited.add(cursor);
      const current = byId.get(cursor);
      cursor = current?.parentSectionId ?? null;
      if (cursor !== null && !byId.has(cursor)) {
        break; // unknown parent already reported above
      }
    }
  }
  return issues;
}

function validateOptionInEntryContext(
  entry: UnitEntry,
  group: OptionGroup,
  option: Option,
  profileIds: Set<string>,
): IntegrityIssue[] {
  const issues: IntegrityIssue[] = [];
  const prefix = `optionGroups[${group.localId}].options[${option.localId}] (entry ${entry.localId})`;
  if (option.target.kind === 'member-slots') {
    for (const nodePath of option.target.nodePaths) {
      if (resolveCompositionPath(entry, nodePath) === null) {
        issues.push(
          integrityIssue(
            'catalog/option/member-path-unresolvable',
            `${prefix}.target.nodePaths`,
            `member path [${nodePath.join('/')}] does not resolve in entry "${entry.localId}" composition`,
          ),
        );
      }
    }
  }
  if (option.target.kind === 'scope-selector') {
    for (const profileLocalId of option.target.matchProfileLocalIds) {
      if (!profileIds.has(profileLocalId)) {
        issues.push(
          integrityIssue(
            'catalog/option/scope-selector-profile-unknown',
            `${prefix}.target.matchProfileLocalIds`,
            `scope selector matches unknown profile "${profileLocalId}"`,
          ),
        );
      }
    }
  }
  for (const effect of option.effects) {
    if (effect.kind === 'model-replacement') {
      for (const profileLocalId of [effect.fromProfileLocalId, effect.toProfileLocalId]) {
        if (!profileIds.has(profileLocalId)) {
          issues.push(
            integrityIssue(
              'catalog/option/effect-profile-unknown',
              `${prefix}.effects`,
              `model replacement references unknown profile "${profileLocalId}"`,
            ),
          );
        }
      }
    }
    if (effect.kind === 'composition-addition') {
      // Explicitly declared added members (rework R6): every profile must
      // exist and node ids must stay unambiguous among siblings.
      issues.push(...validateSiblingNodeIds(effect.root, `${entry.localId}:${option.localId}`));
      const walkProfiles = (node: CompositionNode): void => {
        if (node.profileLocalId !== undefined && !profileIds.has(node.profileLocalId)) {
          issues.push(
            integrityIssue(
              'catalog/option/effect-profile-unknown',
              `${prefix}.effects`,
              `composition addition references unknown profile "${node.profileLocalId}"`,
            ),
          );
        }
        for (const child of node.children ?? []) {
          walkProfiles(child);
        }
      };
      walkProfiles(effect.root);
      if (option.target.kind === 'member-slots') {
        // The addition lands under the targeted slot; a root id colliding
        // with an existing child would make addressing ambiguous.
        for (const nodePath of option.target.nodePaths) {
          const slot = resolveCompositionPath(entry, nodePath);
          const collides = slot?.children?.some((child) => child.nodeId === effect.root.nodeId) ?? false;
          if (collides) {
            issues.push(
              integrityIssue(
                'catalog/option/addition-node-id-collides',
                `${prefix}.effects`,
                `composition addition root "${effect.root.nodeId}" collides with an existing child under [${nodePath.join('/')}] in entry "${entry.localId}"`,
              ),
            );
          }
        }
      }
    }
    // training-change level tokens and baseTraining tokens are opaque in
    // core; the ruleset schema (e.g. classic-coldwar i/r/v/e) validates
    // them. Deliberately not checked here — core has no training
    // enumeration.
  }
  const optionIds = new Set(group.options.map((candidate) => candidate.localId));
  for (const required of option.requires ?? []) {
    if (!optionIds.has(required)) {
      issues.push(
        integrityIssue(
          'catalog/option/prerequisite-unknown',
          `${prefix}.requires`,
          `prerequisite option "${required}" is not part of group "${group.localId}"`,
        ),
      );
    }
  }
  for (const mutex of option.mutuallyExclusiveWith ?? []) {
    if (!optionIds.has(mutex)) {
      issues.push(
        integrityIssue(
          'catalog/option/mutex-unknown',
          `${prefix}.mutuallyExclusiveWith`,
          `mutually-exclusive option "${mutex}" is not part of group "${group.localId}"`,
        ),
      );
    }
  }
  return issues;
}

function validateResourceGrants(entry: UnitEntry): IntegrityIssue[] {
  const issues: IntegrityIssue[] = [];
  for (const [index, grant] of (entry.resourceGrants ?? []).entries()) {
    if (grant.scope === 'formation-member' && grant.memberPath !== undefined) {
      if (resolveCompositionPath(entry, grant.memberPath) === null) {
        issues.push(
          integrityIssue(
            'catalog/entry/grant-member-path-unresolvable',
            `entries[${entry.localId}].resourceGrants[${index}].memberPath`,
            `formation-member grant for "${grant.resourceKind}" targets unresolvable member path [${grant.memberPath.join('/')}]`,
          ),
        );
      }
    }
  }
  return issues;
}

/**
 * Validates all relationships inside one catalog shell. The catalog is
 * self-contained: validating a Classic catalog never needs AirLand or NORTHAG
 * records, and same-name/same-localId records in other rulesets are
 * invisible here by construction.
 */
export function validateCatalogRelations(catalog: CatalogShell): IntegrityIssue[] {
  const issues: IntegrityIssue[] = [];

  // Manifest identity vs army lists.
  for (const armyList of catalog.armyLists) {
    if (armyList.rulesetId !== catalog.manifest.identity.rulesetId) {
      issues.push(
        integrityIssue(
          'catalog/identity/ruleset-mismatch',
          `armyLists[${armyList.armyListId}].rulesetId`,
          `army list "${armyList.armyListId}" declares ruleset "${armyList.rulesetId}" but the manifest declares "${catalog.manifest.identity.rulesetId}"`,
        ),
      );
    }
  }

  for (const duplicate of duplicateValues(catalog.armyLists.map((list) => list.armyListId))) {
    issues.push(
      integrityIssue(
        'catalog/army-list/duplicate-id',
        `armyLists[${duplicate}]`,
        `duplicate armyListId "${duplicate}"`,
      ),
    );
  }
  for (const armyList of catalog.armyLists) {
    issues.push(...validateSections(armyList));
  }

  for (const duplicate of duplicateValues(catalog.profiles.map((profile) => profile.localId))) {
    issues.push(
      integrityIssue(
        'catalog/profile/duplicate-id',
        `profiles[${duplicate}]`,
        `duplicate profile localId "${duplicate}"`,
      ),
    );
  }
  const profileIds = new Set(catalog.profiles.map((profile) => profile.localId));

  const armyListIds = new Set(catalog.armyLists.map((list) => list.armyListId));
  const sectionIdsByArmyList = new Map(
    catalog.armyLists.map((list) => [
      list.armyListId,
      new Map(
        list.structure.sections.map((section) => [
          section.sectionId,
          { directlyPurchasable: section.directlyPurchasable },
        ] as const),
      ),
    ] as const),
  );
  const optionGroupsById = new Map(
    catalog.optionGroups.map((group) => [group.localId, group] as const),
  );

  for (const duplicate of duplicateValues(catalog.optionGroups.map((group) => group.localId))) {
    issues.push(
      integrityIssue(
        'catalog/option-group/duplicate-id',
        `optionGroups[${duplicate}]`,
        `duplicate option group localId "${duplicate}"`,
      ),
    );
  }
  for (const group of catalog.optionGroups) {
    for (const duplicate of duplicateValues(group.options.map((option) => option.localId))) {
      issues.push(
        integrityIssue(
          'catalog/option/duplicate-id',
          `optionGroups[${group.localId}].options[${duplicate}]`,
          `duplicate option localId "${duplicate}" in group "${group.localId}"`,
        ),
      );
    }
  }

  for (const duplicate of duplicateValues(catalog.entries.map((entry) => entry.localId))) {
    issues.push(
      integrityIssue(
        'catalog/entry/duplicate-id',
        `entries[${duplicate}]`,
        `duplicate entry localId "${duplicate}"`,
      ),
    );
  }

  const documentIds = new Set(catalog.manifest.sources.map((source) => source.documentId));
  issues.push(...validateProfileAndOptionSources(catalog, documentIds));

  for (const entry of catalog.entries) {
    const prefix = `entries[${entry.localId}]`;
    for (const armyListId of entry.armyListIds) {
      if (!armyListIds.has(armyListId)) {
        issues.push(
          integrityIssue(
            'catalog/entry/unknown-army-list',
            `${prefix}.armyListIds`,
            `entry "${entry.localId}" references unknown army list "${armyListId}"`,
          ),
        );
      }
    }
    for (const armyListId of entry.armyListIds) {
      const sections = sectionIdsByArmyList.get(armyListId);
      if (sections === undefined) {
        continue; // unknown army list already reported
      }
      for (const sectionId of entry.sectionIds) {
        const section = sections.get(sectionId);
        if (section === undefined) {
          issues.push(
            integrityIssue(
              'catalog/entry/unknown-section',
              `${prefix}.sectionIds`,
              `entry "${entry.localId}" references section "${sectionId}" that does not exist in army list "${armyListId}"`,
            ),
          );
        } else if (!section.directlyPurchasable) {
          issues.push(
            integrityIssue(
              'catalog/entry/section-not-directly-purchasable',
              `${prefix}.sectionIds`,
              `entry "${entry.localId}" lists section "${sectionId}" as purchase eligibility, but that section is not directly purchasable`,
            ),
          );
        }
      }
    }
    for (const optionGroupId of entry.optionGroupIds) {
      if (!optionGroupsById.has(optionGroupId)) {
        issues.push(
          integrityIssue(
            'catalog/entry/unknown-option-group',
            `${prefix}.optionGroupIds`,
            `entry "${entry.localId}" references unknown option group "${optionGroupId}"`,
          ),
        );
      }
    }
    if (entry.composition.state === 'known') {
      issues.push(...validateSiblingNodeIds(entry.composition.root, entry.localId));
      const walkProfiles = (node: CompositionNode): void => {
        if (node.profileLocalId !== undefined && !profileIds.has(node.profileLocalId)) {
          issues.push(
            integrityIssue(
              'catalog/composition/profile-unknown',
              `${prefix}.composition`,
              `composition node "${node.nodeId}" references unknown profile "${node.profileLocalId}"`,
            ),
          );
        }
        for (const child of node.children ?? []) {
          walkProfiles(child);
        }
      };
      walkProfiles(entry.composition.root);
    }
    for (const [index, sourceRef] of entry.sourceRefs.entries()) {
      if (!documentIds.has(sourceRef.documentId)) {
        issues.push(
          integrityIssue(
            'catalog/source/document-unknown',
            `${prefix}.sourceRefs[${index}]`,
            `source reference names document "${sourceRef.documentId}" which the manifest does not declare`,
          ),
        );
      }
    }
    issues.push(...validateResourceGrants(entry));
    for (const optionGroupId of entry.optionGroupIds) {
      const group = optionGroupsById.get(optionGroupId);
      if (group === undefined) {
        continue; // unknown group already reported
      }
      for (const option of group.options) {
        issues.push(
          ...validateOptionInEntryContext(entry, group, option, profileIds),
        );
      }
    }
  }

  const recordIds = new Set<string>([
    ...catalog.entries.map((entry) => entry.localId),
    ...catalog.profiles.map((profile) => profile.localId),
  ]);
  for (const [index, errata] of (catalog.errataRecords ?? []).entries()) {
    if (errata.status === 'applied' && !recordIds.has(errata.targetRecordId)) {
      issues.push(
        integrityIssue(
          'catalog/errata/target-unknown',
          `errataRecords[${index}]`,
          `applied errata "${errata.errataId}" targets unknown record "${errata.targetRecordId}"`,
        ),
      );
    }
    if (!documentIds.has(errata.sourceRef.documentId)) {
      issues.push(
        integrityIssue(
          'catalog/source/document-unknown',
          `errataRecords[${index}].sourceRef`,
          `errata "${errata.errataId}" cites undeclared document "${errata.sourceRef.documentId}"`,
        ),
      );
    }
  }

  return issues;
}

/** Entry and errata references are checked above; these records share the same source registry. */
function validateProfileAndOptionSources(catalog: CatalogShell, documentIds: ReadonlySet<string>): IntegrityIssue[] {
  const issues: IntegrityIssue[] = [];
  const records = [
    ...catalog.profiles.map((profile) => ({ path: `profiles[${profile.localId}]`, sourceRefs: profile.sourceRefs })),
    ...catalog.optionGroups.flatMap((group) => group.options.map((option) => ({
      path: `optionGroups[${group.localId}].options[${option.localId}]`,
      sourceRefs: option.sourceRefs,
    }))),
  ];
  for (const record of records) {
    for (const [index, reference] of record.sourceRefs.entries()) {
      if (!documentIds.has(reference.documentId)) {
        issues.push(integrityIssue(
          'catalog/source/document-unknown',
          `${record.path}.sourceRefs[${index}]`,
          `source reference names document "${reference.documentId}" which the manifest does not declare`,
        ));
      }
    }
  }
  return issues;
}
