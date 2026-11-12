import {
  evaluateRoster, executeRosterCommands, validateRosterCommandDocument,
  type Availability, type EvaluatedCompositionNode, type Evaluation, type RosterDocument,
  type RosterIssue, type RosterSelection,
} from '@battlegroup/core';
import {
  northagGameSizes, northagRequestRule, northagRosterSchema,
  type NorthagRelease,
} from './schema';

export const northagSections = {
  forward: 'forward-screen',
  vanguard: 'vanguard',
  main: 'main-column',
  requests: 'reinforcement-requests',
} as const;

export function validateNorthagRoster(document: RosterDocument) {
  const result = northagRosterSchema.safeParse(document);
  return result.success ? [] : result.error.issues.map(issue => ({
    code: 'northag/document',
    message: issue.path.join('.') + ': ' + issue.message,
  }));
}

export function northagRequestAllowance(document: RosterDocument) {
  const enabled = document.settings.optionalRules.includes(northagRequestRule);
  const paid = document.selections.filter(selection => selection.sectionId === northagSections.requests).length;
  const size = northagGameSizes[document.settings.gameSizeId as keyof typeof northagGameSizes];
  return { enabled, paid, free: enabled ? 1 : 0, maximum: enabled ? size?.requests ?? 0 : 0 };
}

const book = (printedPage: number) => ({ documentId: 'book', printedPage, pdfPage: printedPage + 1 });

export function evaluateNorthagRoster(document: RosterDocument, release: NorthagRelease): Evaluation {
  const { catalog } = release;
  const base = evaluateRoster(document, catalog);
  const problems = [...validateRosterCommandDocument(document, release), ...validateNorthagRoster(document)];
  if (problems.length) {
    return {
      ...base,
      issues: problems.map(problem => ({ ruleId: problem.code, message: problem.message, severity: 'error' })),
      coverage: [{ checkId: 'structure', status: 'blocked-unknown-data' }],
      legality: 'violations-confirmed',
    };
  }

  const issues: RosterIssue[] = [...base.issues];
  const size = northagGameSizes[document.settings.gameSizeId as keyof typeof northagGameSizes];
  const top = document.selections.filter(item => item.parentSelectionId === null);
  const entries = new Map(catalog.entries.map(entry => [entry.localId, entry]));
  const groups = new Map(catalog.optionGroups.map(group => [group.localId, group]));
  const add = (ruleId: string, message: string, page: number, location: Partial<RosterIssue> = {}) => {
    issues.push({ ruleId: 'northag/' + ruleId, message, severity: 'error', sourceRefs: [book(page)], ...location });
  };

  if (base.totals.points.complete && base.totals.points.knownSubtotal > document.settings.budgetPoints) {
    add('budget', 'Points exceed the agreed budget.', 56, { actual: base.totals.points.knownSubtotal, limit: document.settings.budgetPoints });
  }
  if (!top.some(selection => selection.sectionId === northagSections.forward)) {
    add('forward-screen', 'Include at least one Forward Screen choice.', 56, { actual: 0, limit: 1 });
  }
  const vanguards = top.filter(selection => selection.sectionId === northagSections.vanguard);
  if (vanguards.length !== 1) {
    add('vanguard', 'Choose exactly one Vanguard formation.', 70, {
      ...(vanguards[1] ? { selectionId: vanguards[1].selectionId } : {}),
      actual: vanguards.length, limit: 1,
    });
  }
  for (const [id, limit] of Object.entries(release.entryLimits)) {
    if (limit.kind !== 'limited') continue;
    const matching = top.filter(selection => selection.entryReference.localId === id);
    const excess = matching[limit.max];
    if (excess) {
      const entry = entries.get(id)!;
      add('entry-limit', 'The list allows at most ' + limit.max + ' × ' + entry.name + ' in this section.',
        entry.sourceRefs[0]?.printedPage ?? 56, { selectionId: excess.selectionId, actual: matching.length, limit: limit.max });
    }
  }

  let restricted = 0;
  const bmp2Platoons: RosterSelection[] = [];
  for (const selection of document.selections) {
    const entry = entries.get(selection.entryReference.localId)!;
    if (entry.tags?.includes('restricted')) restricted++;
    const choices = new Set<string>();
    for (const choice of selection.optionChoices) {
      const key = JSON.stringify([choice.optionGroupLocalId, choice.optionLocalId]);
      if (choices.has(key)) continue;
      choices.add(key);
      const option = groups.get(choice.optionGroupLocalId)?.options.find(item => item.localId === choice.optionLocalId);
      if (option?.specialRules?.includes('restricted-choice')) restricted++;
      if (option?.specialRules?.includes('bmp2-platoon-limit')) bmp2Platoons.push(selection);
    }
  }
  if (restricted > size.restricted) {
    add('restricted', 'The selected game size allows fewer Restricted purchases or upgrades.', 56,
      { actual: restricted, limit: size.restricted });
  }
  if (bmp2Platoons[1]) {
    add('bmp2-platoon', 'Only one Main Column Motor Rifle Platoon may take the BMP-2 upgrade.', 71,
      { selectionId: bmp2Platoons[1].selectionId, actual: bmp2Platoons.length, limit: 1 });
  }

  const byAnchor = new Map<string, RosterSelection[]>();
  for (const selection of document.selections) {
    if (!selection.parentSelectionId) continue;
    const key = JSON.stringify([selection.parentSelectionId, selection.targetMemberPath ?? []]);
    const children = byAnchor.get(key) ?? [];
    children.push(selection);
    byAnchor.set(key, children);
  }
  for (const children of byAnchor.values()) {
    const types = new Set<string>();
    let teams = 0;
    for (const child of children) {
      const entry = entries.get(child.entryReference.localId)!;
      const weaponTeam = entry.tags?.includes('platoon-weapon-team');
      if (types.has(entry.localId)) {
        const page = weaponTeam ? (child.targetMemberPath?.length ? 70 : 71) : 72;
        add('attachment-limit', 'This attachment type may be taken once at this location.', page, {
          selectionId: child.selectionId, limit: 1,
          ...(weaponTeam ? {} : { sourceRefs: [book(72), { documentId: 'errata', pdfPage: 7 }] }),
        });
      }
      types.add(entry.localId);
      if (weaponTeam && ++teams > 2) {
        add('weapon-team-limit', 'A Motor Rifle Platoon may add at most two different weapon teams.',
          child.targetMemberPath?.length ? 70 : 71, { selectionId: child.selectionId, actual: teams, limit: 2 });
      }
    }
    if (teams > 0) addWeaponTeamTransport(base.composition, children[0]!);
  }

  const requests = northagRequestAllowance(document);
  if (!requests.enabled && requests.paid) {
    add('requests-disabled', 'Enable Reinforcement Requests or remove the paid requests.', 57);
  } else if (requests.free + requests.paid > requests.maximum) {
    add('request-limit', 'The request limit includes the free initial request.', 74,
      { actual: requests.free + requests.paid, limit: requests.maximum });
  }

  const officers = document.selections.filter(selection => {
    const rules = entries.get(selection.entryReference.localId)?.specialRules;
    return rules?.includes('officer') || rules?.includes('senior-officer');
  }).length;
  const profiles = new Map(catalog.profiles.map(profile => [profile.localId, profile]));
  let scoutWeight = 0;
  for (const { selectionId, node } of base.composition) {
    const selection = document.selections.find(item => item.selectionId === selectionId)!;
    const entry = entries.get(selection.entryReference.localId)!;
    let weight = scoutValue(entry.specialRules);
    const visit = (member: EvaluatedCompositionNode) => {
      const profile = member.profileLocalId ? profiles.get(member.profileLocalId) : undefined;
      weight = Math.max(weight, scoutValue(profile?.rules));
      for (const child of member.children ?? []) visit(child);
    };
    visit(node);
    scoutWeight += weight;
  }

  return {
    ...base, issues,
    legality: issues.some(issue => issue.severity === 'error') ? 'violations-confirmed' : 'undetermined',
    statistics: [
      { statId: 'officers', label: 'Officers', value: officers, status: 'covered', sourceRefs: [book(53)] },
      { statId: 'scout-weight', label: 'Scouts', value: scoutWeight,
        status: 'covered', sourceRefs: [book(69), { documentId: 'errata', pdfPage: 6 }] },
    ],
    coverage: [
      ...base.coverage.filter(check => check.checkId !== 'game-rules'),
      { checkId: 'northag/list-limits', status: 'covered' },
      { checkId: 'northag/restricted', status: 'covered', note: 'Each Restricted purchase or chosen upgrade counts once.' },
      { checkId: 'northag/requests', status: 'covered', note: 'Arrival BR is outside initial roster totals.' },
      { checkId: 'northag/scouts', status: 'covered', note: 'Count each Scout roster entry once, at its stated Scout weight.' },
      { checkId: 'northag/weapon-team-transports', status: 'covered',
        note: 'Each platoon with attached weapon teams includes one shared transport and it follows the platoon conversion price.' },
      { checkId: 'northag/reference', status: 'not-implemented', note: release.coverage.note },
    ],
  };
}

function scoutValue(rules: readonly string[] = []): number {
  if (rules.includes('scout-3')) return 3;
  if (rules.includes('scout-2')) return 2;
  return rules.includes('scout') ? 1 : 0;
}

function addWeaponTeamTransport(composition: Evaluation['composition'], attachment: RosterSelection): void {
  let platoon = composition.find(item => item.selectionId === attachment.parentSelectionId)?.node;
  for (const id of attachment.targetMemberPath ?? []) platoon = platoon?.children?.find(member => member.nodeId === id);
  if (!platoon) return;

  const transportTypes = new Set(platoon.children?.filter(member => member.role === 'transport-group')
    .flatMap(group => group.children?.filter(member => member.role === 'vehicle').map(member => member.profileLocalId) ?? []));
  const defaultBtr = platoon.tags?.includes('weapon-team-btr-70') ? 'btr-70' : 'btr-60';
  let profileLocalId = defaultBtr;
  if (transportTypes.size === 1) {
    if (transportTypes.has('bmp-2')) profileLocalId = 'bmp-2';
    if (transportTypes.has('bmp-1')) profileLocalId = 'bmp-1';
  }
  platoon.children = [...(platoon.children ?? []), {
    nodeId: 'weapon-team-transport', role: 'weapon-team-transport', profileLocalId, quantity: 1,
  }];
}

export function getNorthagAvailability(document: RosterDocument, release: NorthagRelease, entryId: string, target: {
  parentSelectionId?: string; sectionId?: string; targetMemberPath?: string[];
}): Availability {
  const entry = release.catalog.entries.find(item => item.localId === entryId);
  if (!entry) return { status: 'blocked', reasons: [{ code: 'entry-missing', message: 'The entry is not in this release.' }] };
  if (entry.sectionIds.includes(northagSections.requests) && !northagRequestAllowance(document).enabled) {
    return { status: 'blocked', reasons: [{ code: 'northag/requests-disabled', message: 'Enable Reinforcement Requests in roster settings first.' }] };
  }
  let id = 'availability/' + entryId;
  while (document.selections.some(selection => selection.selectionId === id)) id += '/next';
  const selection: RosterSelection = {
    selectionId: id,
    entryReference: { ...document.catalogRef, localId: entryId },
    parentSelectionId: target.parentSelectionId ?? null,
    ...(!target.parentSelectionId ? { sectionId: target.sectionId ?? entry.sectionIds[0]! } : {}),
    ...(target.targetMemberPath ? { targetMemberPath: target.targetMemberPath } : {}),
    optionChoices: [],
  };
  const edited = executeRosterCommands(document, [{ kind: 'add', selection }], release, document.revision + '/preview');
  if (!edited.ok) return { status: 'blocked', reasons: edited.problems };

  const before = new Set(evaluateNorthagRoster(document, release).issues.map(issue => JSON.stringify(issue)));
  const reasons = evaluateNorthagRoster(edited.document, release).issues
    .filter(issue => issue.severity === 'error' && !before.has(JSON.stringify(issue)))
    .map(issue => ({ code: issue.ruleId, message: issue.message, ...(issue.sourceRefs ? { sourceRefs: issue.sourceRefs } : {}) }));
  return { status: reasons.length ? 'allowed-with-issues' : 'allowed', reasons };
}
