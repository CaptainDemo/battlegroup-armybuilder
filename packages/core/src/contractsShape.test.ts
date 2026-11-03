import { describe, expect, it } from 'vitest';
import {
  catalogShellSchema,
  compositionNodeSchema,
  costDeltaSchema,
  entryBaseCostSchema,
  knownValue,
  quantityLimitSchema,
  rosterDocumentSchema,
  rosterSelectionSchema,
  trackedValueSchema,
  unknownValue,
} from './index';
import { classicM01Catalog } from './samples/classicM01Catalog';
import { b01Roster, f02Roster, l08Roster } from './samples/classicM01Rosters';
import { makeIsolationCatalog } from './samples/isolationCatalogs';

/**
 * Schema-shape checks (the Zod half of M03 validation). These prove the
 * boundary rejects malformed documents; relationship checks (orphans,
 * cycles, reference integrity) live in catalogRelations/rosterRelations
 * tests — a single-object parse cannot see them by construction.
 */

describe('tracked values: known / unknown / not_applicable are distinct', () => {
  it('parses the three states and keeps known(0) distinct from unknown', () => {
    expect(trackedValueSchema.parse(knownValue(0))).toEqual({ state: 'known', value: 0 });
    expect(trackedValueSchema.parse(unknownValue('not recorded'))).toEqual({
      state: 'unknown',
      reason: 'not recorded',
    });
    expect(trackedValueSchema.parse({ state: 'not_applicable', reason: 'no AT value after errata' })).toEqual({
      state: 'not_applicable',
      reason: 'no AT value after errata',
    });
  });

  it('rejects bare numbers and unknowns without a reason', () => {
    // An unknown cost must not decay to zero or to a bare number.
    expect(trackedValueSchema.safeParse(0).success).toBe(false);
    expect(trackedValueSchema.safeParse({ state: 'unknown' }).success).toBe(false);
    expect(trackedValueSchema.safeParse({ state: 'known' }).success).toBe(false);
    expect(trackedValueSchema.safeParse({ state: 'maybe', value: 1 }).success).toBe(false);
  });

  it('quantity limits distinguish finite, unlimited, unknown and not-applicable', () => {
    expect(quantityLimitSchema.parse({ kind: 'limited', max: 4 })).toEqual({ kind: 'limited', max: 4 });
    expect(quantityLimitSchema.parse({ kind: 'unlimited' })).toEqual({ kind: 'unlimited' });
    expect(quantityLimitSchema.parse({ kind: 'unknown', reason: 'threshold not verified' })).toBeTruthy();
    expect(quantityLimitSchema.parse({ kind: 'not_applicable', reason: 'no group cap' })).toBeTruthy();
    expect(quantityLimitSchema.safeParse({ kind: 'limited', max: -1 }).success).toBe(false);
    expect(quantityLimitSchema.safeParse({ kind: 'limited', max: 1.5 }).success).toBe(false);
    expect(quantityLimitSchema.safeParse(null).success).toBe(false);
  });
});

describe('costs: zero and negative deltas are known values', () => {
  it('accepts A09 Points-only deltas (known BR 0) and L08 negative deltas', () => {
    const pointsOnly = costDeltaSchema.parse({ points: knownValue(30), br: knownValue(0) });
    expect(pointsOnly.br).toEqual({ state: 'known', value: 0 });
    const negative = costDeltaSchema.parse({ points: knownValue(-5), br: knownValue(-1) });
    expect(negative.points).toEqual({ state: 'known', value: -5 });
  });

  it('base costs must be non-negative when known', () => {
    expect(entryBaseCostSchema.safeParse({ points: knownValue(20), br: knownValue(3) }).success).toBe(true);
    expect(entryBaseCostSchema.safeParse({ points: knownValue(-1), br: knownValue(3) }).success).toBe(false);
    expect(entryBaseCostSchema.safeParse({ points: unknownValue('pending transcription'), br: knownValue(0) }).success).toBe(true);
  });
});

describe('composition shape', () => {
  it('rejects non-positive quantities and empty node ids', () => {
    expect(compositionNodeSchema.safeParse({ nodeId: 'a', role: 'tank', quantity: 0 }).success).toBe(false);
    expect(compositionNodeSchema.safeParse({ nodeId: '', role: 'tank', quantity: 1 }).success).toBe(false);
    expect(compositionNodeSchema.safeParse({ nodeId: 'a', role: 'tank', quantity: 1.5 }).success).toBe(false);
  });

  it('accepts nested fixed sub-formations (recursive getter schema)', () => {
    const nested = compositionNodeSchema.parse({
      nodeId: 'company',
      role: 'formation',
      quantity: 1,
      children: [
        { nodeId: 'platoon-1', role: 'platoon', quantity: 1, children: [
          { nodeId: 'platoon-command', role: 'platoon-command', profileLocalId: 't72a', quantity: 1 },
        ] },
      ],
    });
    expect(nested.children?.[0]?.children?.[0]?.nodeId).toBe('platoon-command');
  });
});

describe('catalog shell schema', () => {
  it('parses the M01 sample catalog and all three synthetic isolation catalogs', () => {
    expect(catalogShellSchema.safeParse(classicM01Catalog).success).toBe(true);
    for (const rulesetId of ['classic-coldwar', 'airland', 'northag'] as const) {
      const parsed = catalogShellSchema.safeParse(makeIsolationCatalog(rulesetId));
      expect(parsed.success, rulesetId).toBe(true);
    }
  });

  it('rejects unknown schema versions and unknown keys', () => {
    const wrongVersion = structuredClone(classicM01Catalog);
    (wrongVersion.manifest as { schemaVersion: string }).schemaVersion = 'catalog-shell/99';
    expect(catalogShellSchema.safeParse(wrongVersion).success).toBe(false);

    const extraKey = structuredClone(classicM01Catalog) as Record<string, unknown>;
    extraKey.temporaryField = true;
    expect(catalogShellSchema.safeParse(extraKey).success).toBe(false);
  });
});

describe('roster document schema', () => {
  it('parses the B01 main sample, an A04 second-fire-support roster and a negative-delta roster', () => {
    expect(rosterDocumentSchema.safeParse(b01Roster()).success).toBe(true);
    expect(rosterDocumentSchema.safeParse(f02Roster()).success).toBe(true);
    expect(rosterDocumentSchema.safeParse(l08Roster()).success).toBe(true);
  });

  it('requires the edit revision (R5: evaluations stamp it to reject stale results)', () => {
    const roster = structuredClone(b01Roster()) as Record<string, unknown>;
    delete roster['revision'];
    expect(rosterDocumentSchema.safeParse(roster).success).toBe(false);
  });

  it('rejects non-positive budgets (unreasonable quantities)', () => {
    const roster = structuredClone(b01Roster());
    roster.settings.budgetPoints = 0;
    expect(rosterDocumentSchema.safeParse(roster).success).toBe(false);
  });

  it('keeps budget and game size independent fields', () => {
    // C13: budget never determines game size; both are stored, no derivation.
    const roster = structuredClone(b01Roster());
    roster.settings.budgetPoints = 397;
    roster.settings.gameSizeId = 'company';
    const parsed = rosterDocumentSchema.parse(roster);
    expect(parsed.settings.budgetPoints).toBe(397);
    expect(parsed.settings.gameSizeId).toBe('company');
  });
});

describe('rework additions: option choice targets, base training, composition additions', () => {
  it('attachment-member targets carry an owner selection id and a path (R2)', () => {
    const roster = structuredClone(b01Roster());
    const inf = roster.selections.find((s) => s.selectionId === 'inf');
    if (inf === undefined) throw new Error('fixture selection missing');
    inf.optionChoices = [
      {
        optionGroupLocalId: 'bmp1-upgrades',
        optionLocalId: 'all-bmp1-to-p',
        targets: [{ kind: 'attachment-member', ownerSelectionId: 'medic', nodePath: ['x'] }],
      },
    ];
    // Shape-level parse only; relationship correctness is checked elsewhere.
    expect(rosterDocumentSchema.safeParse(roster).success).toBe(true);
    const bad = structuredClone(roster);
    const badInf = bad.selections.find((s) => s.selectionId === 'inf');
    badInf!.optionChoices = [
      {
        optionGroupLocalId: 'bmp1-upgrades',
        optionLocalId: 'all-bmp1-to-p',
        targets: [{ kind: 'attachment-member', nodePath: ['x'] } as never],
      },
    ];
    expect(rosterDocumentSchema.safeParse(bad).success).toBe(false);
  });

  it('baseTraining is a tracked token: known, unknown and not-applicable all parse (R7)', () => {
    const catalog = structuredClone(classicM01Catalog);
    const entry = catalog.entries[0];
    if (entry === undefined) throw new Error('fixture entry missing');
    entry.baseTraining = { state: 'known', value: 'r' };
    expect(catalogShellSchema.safeParse(catalog).success).toBe(true);
    entry.baseTraining = { state: 'unknown', reason: 'suffix not recorded' };
    expect(catalogShellSchema.safeParse(catalog).success).toBe(true);
    entry.baseTraining = { state: 'not_applicable', reason: 'no training concept' };
    expect(catalogShellSchema.safeParse(catalog).success).toBe(true);
    entry.baseTraining = { state: 'known' } as never; // known without a value is malformed
    expect(catalogShellSchema.safeParse(catalog).success).toBe(false);
  });

  it('composition-addition effects declare their members explicitly (R6)', () => {
    const catalog = structuredClone(classicM01Catalog);
    const group = catalog.optionGroups.find((candidate) => candidate.localId === 'engineer-transport');
    const option = group?.options.find((candidate) => candidate.localId === 'btr80-swap');
    if (option === undefined) throw new Error('fixture option missing');
    option.effects = [
      {
        kind: 'composition-addition',
        root: { nodeId: 'extra-team', role: 'weapon-team', quantity: 2, children: [
          { nodeId: 'transport', role: 'transport', profileLocalId: 'btr80', quantity: 1 },
        ] },
      },
    ];
    expect(catalogShellSchema.safeParse(catalog).success).toBe(true);
  });
});

describe('selection section rules (schema refinements)', () => {
  const baseEntryReference = {
    rulesetId: 'classic-coldwar',
    catalogId: 'soviet-armoured-division-sample',
    catalogRevision: 'm01-sample-1',
    localId: 'fhq',
  } as const;

  it('requires a section on top-level selections', () => {
    const result = rosterSelectionSchema.safeParse({
      selectionId: 'hq',
      entryReference: baseEntryReference,
      parentSelectionId: null,
      optionChoices: [],
    });
    expect(result.success).toBe(false);
  });

  it('forbids a section on child selections (they inherit)', () => {
    const result = rosterSelectionSchema.safeParse({
      selectionId: 'medic',
      entryReference: { ...baseEntryReference, localId: 'bmp1-platoon-medic' },
      parentSelectionId: 'inf',
      sectionId: 'motor-rifle',
      optionChoices: [],
    });
    expect(result.success).toBe(false);
  });

  it('forbids targetMemberPath on top-level selections', () => {
    const result = rosterSelectionSchema.safeParse({
      selectionId: 'hq',
      entryReference: baseEntryReference,
      parentSelectionId: null,
      sectionId: 'hq',
      targetMemberPath: ['platoon-1'],
      optionChoices: [],
    });
    expect(result.success).toBe(false);
  });

  it('accepts a well-formed child attachment with a member path', () => {
    const result = rosterSelectionSchema.safeParse({
      selectionId: 'medic',
      entryReference: { ...baseEntryReference, localId: 'bmp1-platoon-medic' },
      parentSelectionId: 'inf',
      targetMemberPath: ['platoon-1'],
      optionChoices: [],
    });
    expect(result.success).toBe(true);
  });
});
