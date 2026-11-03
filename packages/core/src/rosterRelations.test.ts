import { describe, expect, it } from 'vitest';
import type { RosterDocument } from './contracts/roster';
import { rosterDocumentSchema } from './contracts/roster';
import {
  resolveAttachmentMemberPath,
  resolveRosterMemberPath,
  validateRosterRelations,
} from './validation/rosterRelations';
import { classicM01Catalog } from './samples/classicM01Catalog';
import {
  b01Roster,
  b02Roster,
  b03Roster,
  b04Roster,
  duplicateFireSupportAllRoster,
  f01Roster,
  f02Roster,
  f03Roster,
  f04Roster,
  f05Roster,
  f06Roster,
  f07Roster,
  l01Roster,
  l02Roster,
  l03Roster,
  l04Roster,
  l05Roster,
  l06Roster,
  l07Roster,
  l08Roster,
  l09Roster,
  l10Roster,
  s01Roster,
  s02Roster,
} from './samples/classicM01Rosters';

/**
 * Roster relationship checks against the explicit M01-facts catalog.
 *
 * Positive cases include rosters whose *game-rule* violations are documented
 * manual expectations (B02, B03, B04, S02, F03, F04, F05, F06, F07): those
 * are structurally sound documents, and M03 must not implement game rules
 * under the guise of structural validation.
 *
 * The `rework` blocks are the a1 review regression probes (R1, R2, R4, R6,
 * R7 behaviour halves; R3/R5 live in the classic schema and evaluation
 * protocol tests).
 */

function issuesFor(roster: RosterDocument): string[] {
  return validateRosterRelations(roster, classicM01Catalog).map((issue) => issue.checkId);
}

describe('positive: all 23 M01 account shapes are structurally representable', () => {
  const rosters: Array<[string, () => RosterDocument]> = [
    ['B01 main sample', b01Roster],
    ['B02 duplicate medic (C02 game violation, structure valid)', b02Roster],
    ['B03 reduced budget (C01 game violation, structure valid)', b03Roster],
    ['B04 request without producer (C09 game violation, structure valid)', b04Roster],
    ['L01 whole-platoon + single-member upgrades', l01Roster],
    ['L02 training change + prerequisite Bastion', l02Roster],
    ['L03 independent BMP-2 platoon context', l03Roster],
    ['L04 company fire support on an included platoon', l04Roster],
    ['L05 same attachment under two platoons', l05Roster],
    ['L06 per-target all-BMP upgrade (3 basic transports)', l06Roster],
    ['L07 free BTR-80 swap', l07Roster],
    ['L08 negative-delta downgrade', l08Roster],
    ['L09 non-entity barrage purchase', l09Roster],
    ['L10 per-tank upgrade of all ten T-72A', l10Roster],
    ['S01 two independent support pools at 4/4', s01Roster],
    ['S02 fifth recon choice (C07 game violation, structure valid)', s02Roster],
    ['F01 all-BMP with 12 targets incl. attachments (A03)', f01Roster],
    ['F02 second Fire Support consumes a platoon slot (A04)', f02Roster],
    ['F03 fifth platoon-support pick (C03 game violation, structure valid)', f03Roster],
    ['F04 standalone PT-76 (C16 game violation, structure valid)', f04Roster],
    ['F05 PT-76 vs company (C16 game violation, structure valid)', f05Roster],
    ['F06 PT-76 vs additional tank (C16 game violation, structure valid)', f06Roster],
    ['F07 nested PT-76 transport choice (C16 trigger preserved)', f07Roster],
  ];

  it.each(rosters)('%s produces no structural issues', (_label, build) => {
    const roster = build();
    expect(rosterDocumentSchema.safeParse(roster).success).toBe(true);
    expect(issuesFor(roster)).toEqual([]);
  });
});

describe('rework R1: resolution never borrows records across identities', () => {
  it('a foreign start selection does not resolve Classic members by localId', () => {
    const roster = structuredClone(b01Roster());
    const tank = roster.selections.find((s) => s.selectionId === 'tank');
    if (tank === undefined) throw new Error('fixture selection missing');
    tank.entryReference.rulesetId = 'airland';
    // The a1 probe: this used to return the Classic t72a platoon-command node.
    expect(resolveRosterMemberPath(roster, classicM01Catalog, 'tank', ['platoon-command'])).toBeNull();
  });

  it('a wrong-revision start selection does not resolve', () => {
    const roster = structuredClone(b01Roster());
    const tank = roster.selections.find((s) => s.selectionId === 'tank');
    if (tank === undefined) throw new Error('fixture selection missing');
    tank.entryReference.catalogRevision = 'm01-sample-2';
    expect(resolveRosterMemberPath(roster, classicM01Catalog, 'tank', ['platoon-command'])).toBeNull();
  });

  it('a roster bound to a different catalog context resolves nothing', () => {
    const roster = structuredClone(b01Roster());
    roster.catalogRef.catalogRevision = 'other-revision';
    // Valid selection, valid entry — but the roster is not bound to this
    // catalog, so no record of it may be used.
    expect(resolveRosterMemberPath(roster, classicM01Catalog, 'tank', ['platoon-command'])).toBeNull();
    expect(resolveAttachmentMemberPath(roster, classicM01Catalog, 'medic', ['medic-team'])).toBeNull();
  });

  it('a foreign attachment owner does not resolve its members', () => {
    const roster = structuredClone(b01Roster());
    const medic = roster.selections.find((s) => s.selectionId === 'medic');
    if (medic === undefined) throw new Error('fixture selection missing');
    medic.entryReference.rulesetId = 'airland'; // same localId exists in Classic — must not be borrowed
    expect(resolveAttachmentMemberPath(roster, classicM01Catalog, 'medic', ['medic-team'])).toBeNull();
  });

  it('relation validation reports the identity error and stops catalog-dependent checks', () => {
    const roster = structuredClone(b01Roster());
    roster.catalogRef.catalogRevision = 'wrong-revision';
    const issues = validateRosterRelations(roster, classicM01Catalog);
    expect(issues.map((issue) => issue.checkId)).toEqual(['roster/catalog/identity-mismatch']);
  });

  it('a legit start selection still resolves after the fix', () => {
    const roster = b01Roster();
    const resolved = resolveRosterMemberPath(roster, classicM01Catalog, 'tank', ['platoon-command']);
    expect(resolved?.node.profileLocalId).toBe('t72a');
    expect(resolved?.owner.selectionId).toBe('tank');
  });
});

describe('rework R2: attachment members are owner-addressed and order-independent', () => {
  it('two identical Fire Support attachments validate and are individually addressable', () => {
    const roster = duplicateFireSupportAllRoster();
    expect(issuesFor(roster)).toEqual([]);
    const fs1 = resolveAttachmentMemberPath(roster, classicM01Catalog, 'fs1', ['transport']);
    const fs2 = resolveAttachmentMemberPath(roster, classicM01Catalog, 'fs2', ['transport']);
    expect(fs1?.owner.selectionId).toBe('fs1');
    expect(fs2?.owner.selectionId).toBe('fs2');
    expect(fs1?.node.profileLocalId).toBe('bmp1');
    expect(fs2?.node.profileLocalId).toBe('bmp1');
  });

  it('reversing the selections array changes neither validation nor ownership', () => {
    const roster = duplicateFireSupportAllRoster();
    roster.selections.reverse();
    expect(issuesFor(roster)).toEqual([]);
    expect(resolveAttachmentMemberPath(roster, classicM01Catalog, 'fs1', ['transport'])?.owner.selectionId).toBe('fs1');
    expect(resolveAttachmentMemberPath(roster, classicM01Catalog, 'fs2', ['transport'])?.owner.selectionId).toBe('fs2');
  });

  it('legacy traversal-style paths fail loudly instead of silently picking the first attachment', () => {
    // A path through an attachment root is NOT a static path; it must be
    // reported unresolvable rather than resolved to whichever attachment
    // happens to sit first in the array.
    const roster = structuredClone(duplicateFireSupportAllRoster());
    const company = roster.selections.find((s) => s.selectionId === 'company');
    const upgrade = company?.optionChoices[0];
    if (upgrade === undefined) throw new Error('fixture choice missing');
    upgrade.targets = [
      { kind: 'member-path', nodePath: ['platoon-1', 'fire-support', 'transport'] },
    ];
    expect(issuesFor(roster)).toContain('roster/option/member-path-unresolvable');
    expect(resolveRosterMemberPath(roster, classicM01Catalog, 'company', ['platoon-1', 'fire-support', 'transport'])).toBeNull();
  });

  it('a static node and an attachment root with the same id do not collide', () => {
    // Give platoon-1 a static child also named fire-support (with its own
    // transport): the static path resolves to the static node, the
    // attachment stays reachable only through its owner id.
    const catalog = structuredClone(classicM01Catalog);
    const entry = catalog.entries.find((candidate) => candidate.localId === 'bmp1-company');
    const platoon1 = entry?.composition.state === 'known'
      ? entry.composition.root.children?.find((child) => child.nodeId === 'platoon-1')
      : undefined;
    if (platoon1 === undefined) throw new Error('fixture composition missing');
    platoon1.children = [
      ...(platoon1.children ?? []),
      {
        nodeId: 'fire-support',
        role: 'static-slot',
        quantity: 1,
        children: [{ nodeId: 'transport', role: 'transport', profileLocalId: 'bmp1', quantity: 1 }],
      },
    ];
    const roster = duplicateFireSupportAllRoster();
    const staticHit = resolveRosterMemberPath(roster, catalog, 'company', ['platoon-1', 'fire-support', 'transport']);
    expect(staticHit?.node.profileLocalId).toBe('bmp1');
    expect(staticHit?.owner.selectionId).toBe('company'); // the static node belongs to the company itself
    const attachmentHit = resolveAttachmentMemberPath(roster, catalog, 'fs1', ['transport']);
    expect(attachmentHit?.owner.selectionId).toBe('fs1'); // the attachment is untouched by the name collision
  });

  it('attachment-member targets must name an existing descendant of the choosing selection', () => {
    const roster = structuredClone(f01Roster());
    const company = roster.selections.find((s) => s.selectionId === 'company');
    const upgrade = company?.optionChoices[0];
    const last = upgrade?.targets[upgrade.targets.length - 1];
    if (last === undefined || last.kind !== 'attachment-member') throw new Error('fixture target missing');
    last.ownerSelectionId = 'ghost';
    expect(issuesFor(roster)).toContain('roster/option/attachment-owner-unknown');

    const roster2 = structuredClone(f01Roster());
    const hq = b01Roster().selections.find((s) => s.selectionId === 'hq');
    if (hq === undefined) throw new Error('fixture selection missing');
    roster2.selections.push(structuredClone(hq));
    const company2 = roster2.selections.find((s) => s.selectionId === 'company');
    const upgrade2 = company2?.optionChoices[0];
    const last2 = upgrade2?.targets[upgrade2.targets.length - 1];
    if (last2 === undefined || last2.kind !== 'attachment-member') throw new Error('fixture target missing');
    last2.ownerSelectionId = 'hq'; // exists, but not under company
    expect(issuesFor(roster2)).toContain('roster/option/attachment-owner-not-descendant');
  });
});

describe('rework R4: directlyPurchasable is enforced as structure', () => {
  it('flipping the tank section to non-purchasable rejects the top-level tank purchase', () => {
    const catalog = structuredClone(classicM01Catalog);
    const armyList = catalog.armyLists[0];
    const tankSection = armyList?.structure.sections.find((section) => section.sectionId === 'tank');
    if (tankSection === undefined) throw new Error('fixture section missing');
    tankSection.directlyPurchasable = false;
    const issues = validateRosterRelations(b01Roster(), catalog).map((issue) => issue.checkId);
    expect(issues).toContain('roster/selection/section-not-directly-purchasable');
  });

  it('purchasable sections keep accepting purchases (motor-rifle unaffected)', () => {
    expect(issuesFor(b01Roster())).toEqual([]);
  });
});

describe('rework R6: the second Fire Support Section is fully declared', () => {
  it('exists as a paid entry with explicit composition, its own cost and a platoon-slot consumption', () => {
    const entry = classicM01Catalog.entries.find(
      (candidate) => candidate.localId === 'bmp2-company-platoon-fire-support-second',
    );
    expect(entry).toBeDefined();
    expect(entry?.baseCost.points).toEqual({ state: 'known', value: 35 });
    expect(entry?.baseCost.br).toEqual({ state: 'known', value: 1 });
    expect(entry?.resourceConsumptions).toEqual([
      { resourceKind: 'platoon-support-slots', amount: 1 },
    ]);
    expect(entry?.sourceRefs).toContainEqual(expect.objectContaining({ documentId: 'SOV', pdfPage: 5 }));
    if (entry?.composition.state !== 'known') throw new Error('second section composition missing');
    const roles = entry.composition.root.children?.map((child) => child.role) ?? [];
    expect(roles).toContain('weapon-team');
    const transport = entry.composition.root.children?.find((child) => child.nodeId === 'transport');
    expect(transport?.profileLocalId).toBe('bmp2');
    // Not a full-price duplicate of the first section (40): its own 35-point entry.
    const first = classicM01Catalog.entries.find((candidate) => candidate.localId === 'bmp2-company-platoon-fire-support');
    expect(first?.baseCost.points).toEqual({ state: 'known', value: 40 });
  });

  it('F02 buys both sections under the same platoon and stays structurally valid', () => {
    const roster = f02Roster();
    expect(issuesFor(roster)).toEqual([]);
    const fs1 = resolveAttachmentMemberPath(roster, classicM01Catalog, 'fs1', ['transport']);
    const fs2 = resolveAttachmentMemberPath(roster, classicM01Catalog, 'fs2', ['transport']);
    expect(fs1?.owner.entryReference.localId).toBe('bmp2-company-platoon-fire-support');
    expect(fs2?.owner.entryReference.localId).toBe('bmp2-company-platoon-fire-support-second');
  });

  it('two sections + all-upgrade uniquely address both attachment transports', () => {
    // The BMP-1 variant of the combined example: duplicate sections plus
    // the all selector covering both transports (see duplicateFireSupportAllRoster).
    const roster = duplicateFireSupportAllRoster();
    const company = roster.selections.find((s) => s.selectionId === 'company');
    const upgrade = company?.optionChoices[0];
    const attachmentTargets = (upgrade?.targets ?? []).filter(
      (target) => target.kind === 'attachment-member',
    );
    expect(attachmentTargets).toHaveLength(2);
    expect(issuesFor(roster)).toEqual([]);
  });
});

describe('declared static slots cannot be bypassed by attachment targets', () => {
  it('rejects an attachment member for an option restricted to the purchasing entry slots', () => {
    const roster = structuredClone(b01Roster());
    const tank = roster.selections.find((s) => s.selectionId === 'tank');
    const support = roster.selections.find((s) => s.selectionId === 'fs');
    if (tank === undefined || support === undefined) throw new Error('fixture selection missing');
    // A synthetic tree, not a claim that tank platoons offer this attachment:
    // both instances resolve, but KMT explicitly names static tank slots.
    support.parentSelectionId = tank.selectionId;
    tank.optionChoices = [{
      optionGroupLocalId: 't72-platoon-upgrades',
      optionLocalId: 'kmt',
      targets: [{ kind: 'attachment-member', ownerSelectionId: support.selectionId, nodePath: ['transport'] }],
    }];
    expect(resolveAttachmentMemberPath(roster, classicM01Catalog, support.selectionId, ['transport'])).not.toBeNull();
    expect(issuesFor(roster)).toContain('roster/option/target-not-in-declared-slots');
  });
});

describe('rework R7: base training is carried per entry, mixed levels expressible', () => {
  function trainingOf(localId: string) {
    const entry = classicM01Catalog.entries.find((candidate) => candidate.localId === localId);
    if (entry?.baseTraining === undefined) throw new Error(`training missing for ${localId}`);
    return entry.baseTraining;
  }

  it('B01 mixes Regular formations with Inexperienced attachments and off-table n/a', () => {
    // Known values come from the M01 table's printed suffixes; no level is
    // inferred from BR or names.
    expect(trainingOf('fhq')).toEqual({ state: 'known', value: 'r' });
    expect(trainingOf('t72-platoon')).toEqual({ state: 'known', value: 'r' });
    expect(trainingOf('bmp1-platoon')).toEqual({ state: 'known', value: 'r' });
    expect(trainingOf('bmp1-platoon-medic')).toEqual({ state: 'known', value: 'i' });
    expect(trainingOf('brdm2-recon')).toEqual({ state: 'known', value: 'r' });
    expect(trainingOf('zsu23-4')).toEqual({ state: 'known', value: 'i' });
    expect(trainingOf('artillery-request-priority3')).toEqual({
      state: 'not_applicable',
      reason: expect.stringContaining('no training concept'),
    });
    expect(trainingOf('timed122')).toEqual({ state: 'not_applicable', reason: expect.any(String) });
    // Entries whose suffix the sample scope does not record stay explicitly
    // unknown — never guessed.
    expect(trainingOf('additional-t72a')).toEqual({ state: 'unknown', reason: expect.any(String) });
    expect(trainingOf('recon-command')).toEqual({ state: 'unknown', reason: expect.any(String) });
  });

  it('T-62 platoon carries its Inexperienced start; the Regular option changes it to r', () => {
    expect(trainingOf('t62-platoon')).toEqual({ state: 'known', value: 'i' });
    const group = classicM01Catalog.optionGroups.find((candidate) => candidate.localId === 't62-platoon-upgrades');
    const regular = group?.options.find((option) => option.localId === 'regular');
    const effect = regular?.effects[0];
    if (effect?.kind !== 'training-change') throw new Error('training-change effect missing');
    expect(effect.toTrainingLevel).toBe('r');
    // BR stays a separate numeric field: +20 Points / +3 BR, not a level.
    expect(regular?.costDelta.br).toEqual({ state: 'known', value: 3 });
  });

  it('the same profile in different purchase contexts keeps independent training', () => {
    // t72a appears in the Regular platoon and company; t62a in the
    // Inexperienced platoon. Training belongs to entries, so no profile-
    // level merge could blur them.
    expect(trainingOf('t72-platoon')).toEqual({ state: 'known', value: 'r' });
    expect(trainingOf('t72-company')).toEqual({ state: 'known', value: 'r' });
    expect(trainingOf('t62-platoon')).toEqual({ state: 'known', value: 'i' });
  });
});

describe('negative: instance tree integrity', () => {
  it('rejects duplicate selection ids', () => {
    const roster = structuredClone(b01Roster());
    const hq = roster.selections[0];
    if (hq === undefined) throw new Error('fixture selection missing');
    roster.selections.push(structuredClone(hq));
    expect(issuesFor(roster)).toContain('roster/selection/duplicate-id');
  });

  it('rejects selections with unknown parents (orphans)', () => {
    const roster = structuredClone(b01Roster());
    const medic = roster.selections.find((s) => s.selectionId === 'medic');
    if (medic === undefined) throw new Error('fixture selection missing');
    medic.parentSelectionId = 'ghost-parent';
    expect(issuesFor(roster)).toContain('roster/selection/unknown-parent');
  });

  it('rejects parent cycles', () => {
    const roster = structuredClone(b01Roster());
    const medic = roster.selections.find((s) => s.selectionId === 'medic');
    const fs = roster.selections.find((s) => s.selectionId === 'fs');
    if (medic === undefined || fs === undefined) throw new Error('fixture selections missing');
    medic.parentSelectionId = 'fs';
    fs.parentSelectionId = 'medic';
    expect(issuesFor(roster)).toContain('roster/selection/parent-cycle');
  });

  it('rejects attachment paths that do not resolve in the parent', () => {
    const roster = structuredClone(l05Roster());
    const medic1 = roster.selections.find((s) => s.selectionId === 'medic1');
    if (medic1 === undefined) throw new Error('fixture selection missing');
    medic1.targetMemberPath = ['ghost-platoon'];
    expect(issuesFor(roster)).toContain('roster/selection/attachment-path-unresolvable');
  });
});

describe('negative: identity and catalog binding', () => {
  it('rejects a roster bound to a different catalog identity (ruleset, id or revision)', () => {
    const roster = structuredClone(b01Roster());
    roster.catalogRef.catalogRevision = 'wrong-revision';
    expect(issuesFor(roster)).toEqual(['roster/catalog/identity-mismatch']);
    const otherRuleset = structuredClone(b01Roster());
    otherRuleset.catalogRef.rulesetId = 'northag';
    expect(issuesFor(otherRuleset)).toEqual(['roster/catalog/identity-mismatch']);
  });

  it('rejects selections whose embedded reference crosses rulesets', () => {
    const roster = structuredClone(b01Roster());
    const tank = roster.selections.find((s) => s.selectionId === 'tank');
    if (tank === undefined) throw new Error('fixture selection missing');
    tank.entryReference.rulesetId = 'airland';
    // Even though a same-localId entry exists in the classic catalog, the
    // foreign reference is rejected and borrows nothing from it.
    expect(issuesFor(roster)).toEqual(['roster/selection/entry-reference-identity-mismatch']);
  });

  it('rejects selections with a wrong catalog revision', () => {
    const roster = structuredClone(b01Roster());
    const tank = roster.selections.find((s) => s.selectionId === 'tank');
    if (tank === undefined) throw new Error('fixture selection missing');
    tank.entryReference.catalogRevision = 'm01-sample-2';
    expect(issuesFor(roster)).toContain('roster/selection/entry-reference-identity-mismatch');
  });

  it('rejects unknown entry localIds without any same-name fallback', () => {
    const roster = structuredClone(b01Roster());
    const tank = roster.selections.find((s) => s.selectionId === 'tank');
    if (tank === undefined) throw new Error('fixture selection missing');
    tank.entryReference.localId = 'T-72 MBT Platoon'; // the display name is not an id
    expect(issuesFor(roster)).toContain('roster/selection/entry-unknown');
  });

  it('rejects unknown army lists and sections', () => {
    const unknownList = structuredClone(b01Roster());
    unknownList.armyListId = 'ghost-list';
    expect(issuesFor(unknownList)).toContain('roster/army-list/unknown');

    const unknownSection = structuredClone(b01Roster());
    const hq = unknownSection.selections.find((s) => s.selectionId === 'hq');
    if (hq === undefined || hq.sectionId === undefined) throw new Error('fixture selection missing');
    hq.sectionId = 'ghost-section';
    expect(issuesFor(unknownSection)).toContain('roster/selection/section-unknown');
  });

  it('rejects purchases into sections the entry is not eligible for', () => {
    const roster = structuredClone(b01Roster());
    const hq = roster.selections.find((s) => s.selectionId === 'hq');
    if (hq === undefined || hq.sectionId === undefined) throw new Error('fixture selection missing');
    hq.sectionId = 'tank';
    expect(issuesFor(roster)).toContain('roster/selection/section-not-eligible');
  });
});

describe('negative: option choices', () => {
  it('rejects option groups not offered by the entry', () => {
    const roster = structuredClone(b01Roster());
    const hq = roster.selections.find((s) => s.selectionId === 'hq');
    if (hq === undefined) throw new Error('fixture selection missing');
    hq.optionChoices = [
      { optionGroupLocalId: 't72-platoon-upgrades', optionLocalId: 'platoon-to-b', targets: [{ kind: 'whole-selection' }] },
    ];
    expect(issuesFor(roster)).toContain('roster/option/group-not-attached');
  });

  it('rejects unknown options inside an attached group', () => {
    const roster = structuredClone(l01Roster());
    const tank = roster.selections.find((s) => s.selectionId === 'tank');
    if (tank === undefined) throw new Error('fixture selection missing');
    tank.optionChoices = [
      { optionGroupLocalId: 't72-platoon-upgrades', optionLocalId: 'ghost-option', targets: [{ kind: 'whole-selection' }] },
    ];
    expect(issuesFor(roster)).toContain('roster/option/unknown-option');
  });

  it('rejects member paths that do not resolve under the selection', () => {
    const roster = structuredClone(l01Roster());
    const tank = roster.selections.find((s) => s.selectionId === 'tank');
    if (tank === undefined) throw new Error('fixture selection missing');
    tank.optionChoices = [
      {
        optionGroupLocalId: 't72-platoon-upgrades',
        optionLocalId: 'kmt',
        targets: [{ kind: 'member-path', nodePath: ['ghost'] }],
      },
    ];
    expect(issuesFor(roster)).toContain('roster/option/member-path-unresolvable');
  });

  it('rejects target kinds that contradict the option definition', () => {
    const roster = structuredClone(l01Roster());
    const tank = roster.selections.find((s) => s.selectionId === 'tank');
    if (tank === undefined) throw new Error('fixture selection missing');
    // platoon-to-b is a whole-selection option; a member path is a wrong target.
    tank.optionChoices = [
      {
        optionGroupLocalId: 't72-platoon-upgrades',
        optionLocalId: 'platoon-to-b',
        targets: [{ kind: 'member-path', nodePath: ['platoon-command'] }],
      },
    ];
    expect(issuesFor(roster)).toContain('roster/option/target-kind-mismatch');
  });

  it('rejects member-slots choices outside the declared slots', () => {
    // s01Roster's mortar has the MTLB swap option declaring the transport
    // slot only; targeting its mortar team is resolvable but not declared.
    const roster = structuredClone(s01Roster());
    const mortar = roster.selections.find((s) => s.selectionId === 'mortar');
    if (mortar === undefined) throw new Error('fixture selection missing');
    mortar.optionChoices = [
      {
        optionGroupLocalId: 'bmp1-mortar-upgrades',
        optionLocalId: 'mortar-to-mtlb',
        targets: [{ kind: 'member-path', nodePath: ['mortar-team'] }],
      },
    ];
    expect(issuesFor(roster)).toContain('roster/option/target-not-in-declared-slots');
  });

  it('accepts the declared MTLB transport swap as a positive control', () => {
    const roster = structuredClone(s01Roster());
    const mortar = roster.selections.find((s) => s.selectionId === 'mortar');
    if (mortar === undefined) throw new Error('fixture selection missing');
    mortar.optionChoices = [
      {
        optionGroupLocalId: 'bmp1-mortar-upgrades',
        optionLocalId: 'mortar-to-mtlb',
        targets: [{ kind: 'member-path', nodePath: ['transport'] }],
      },
    ];
    expect(issuesFor(roster)).toEqual([]);
  });
});

describe('A03: all-selector target sets include purchased attachments (owner-addressed)', () => {
  it('F01 resolves 12 targets: 10 static BMPs plus 2 owner-addressed attachment transports', () => {
    const roster = f01Roster();
    const company = roster.selections.find((s) => s.selectionId === 'company');
    const upgrade = company?.optionChoices[0];
    if (upgrade === undefined) throw new Error('fixture choice missing');
    const memberPaths = upgrade.targets.filter((target) => target.kind === 'member-path');
    const attachmentMembers = upgrade.targets.filter((target) => target.kind === 'attachment-member');
    expect(memberPaths).toHaveLength(10);
    expect(attachmentMembers).toHaveLength(2);
  });

  it('breaking one attachment transport target is caught', () => {
    const roster = structuredClone(f01Roster());
    const company = roster.selections.find((s) => s.selectionId === 'company');
    const upgrade = company?.optionChoices[0];
    const lastTarget = upgrade?.targets[upgrade.targets.length - 1];
    if (lastTarget === undefined || lastTarget.kind !== 'attachment-member') throw new Error('fixture choice missing');
    lastTarget.nodePath = ['ghost-node'];
    expect(issuesFor(roster)).toContain('roster/option/member-path-unresolvable');
  });
});
