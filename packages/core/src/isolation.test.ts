import { describe, expect, it } from 'vitest';
import { catalogShellSchema } from './contracts/catalog';
import { rosterDocumentSchema, type RosterDocument } from './contracts/roster';
import { validateCatalogRelations } from './validation/catalogRelations';
import { validateRosterRelations } from './validation/rosterRelations';
import {
  ISOLATION_SHARED_ENTRY_ID,
  ISOLATION_SHARED_PROFILE_ID,
  makeIsolationCatalog,
} from './samples/isolationCatalogs';
import { ROSTER_FORMAT_VERSION } from './contracts/versioning';

/**
 * Full game-data isolation across the three rulesets
 * (docs/technical_plan.md §4.3, m03 task §样本与检查分工).
 *
 * The three synthetic catalogs deliberately share names, attributes and even
 * localIds. Each validates standalone; references never cross rulesets; and
 * no name-based fallback can borrow a record from another ruleset.
 */

const isolationCatalogs = {
  'classic-coldwar': makeIsolationCatalog('classic-coldwar'),
  airland: makeIsolationCatalog('airland'),
  northag: makeIsolationCatalog('northag'),
} as const;

function isolationRoster(rulesetId: 'classic-coldwar' | 'airland' | 'northag', entryLocalId: string, sectionId?: string): RosterDocument {
  return {
    formatVersion: ROSTER_FORMAT_VERSION,
    rosterId: 'iso-roster',
    name: 'iso',
    revision: 'iso-rev-1',
    catalogRef: { rulesetId, catalogId: 'isolation-sample', catalogRevision: 'iso-1' },
    armyListId: 'isolation-list',
    settings: { budgetPoints: 500, gameSizeId: 'synthetic', optionalRules: [] },
    selections: [
      {
        selectionId: 'main',
        entryReference: { rulesetId, catalogId: 'isolation-sample', catalogRevision: 'iso-1', localId: entryLocalId },
        parentSelectionId: null,
        sectionId: sectionId ?? (rulesetId === 'northag' ? 'vanguard' : 'core'),
        optionChoices: [],
      },
    ],
  };
}

describe('synthetic catalogs with identical names, attributes and localIds', () => {
  it('all three expose the same shared entry/profile ids with identical values', () => {
    for (const catalog of Object.values(isolationCatalogs)) {
      const entry = catalog.entries.find((candidate) => candidate.localId === ISOLATION_SHARED_ENTRY_ID);
      const profile = catalog.profiles.find((candidate) => candidate.localId === ISOLATION_SHARED_PROFILE_ID);
      expect(entry, catalog.manifest.identity.rulesetId).toBeDefined();
      expect(profile).toBeDefined();
      expect(entry?.name).toBe('T-72 MBT Platoon');
      expect(entry?.baseCost.points).toEqual({ state: 'known', value: 180 });
    }
  });

  it('each catalog parses and validates alone — no other ruleset is needed', () => {
    for (const catalog of Object.values(isolationCatalogs)) {
      expect(catalogShellSchema.safeParse(catalog).success).toBe(true);
      expect(validateCatalogRelations(catalog)).toEqual([]);
    }
  });
});

describe('references never cross rulesets', () => {
  it('a classic roster referencing the airland record is rejected despite the identical localId', () => {
    const roster = isolationRoster('classic-coldwar', ISOLATION_SHARED_ENTRY_ID);
    const main = roster.selections[0];
    if (main === undefined) throw new Error('fixture selection missing');
    main.entryReference.rulesetId = 'airland';
    const issues = validateRosterRelations(roster, isolationCatalogs['classic-coldwar']).map((i) => i.checkId);
    // The mismatch alone rejects the reference; the record is NOT resolved
    // through the same-localId classic entry.
    expect(issues).toEqual(['roster/selection/entry-reference-identity-mismatch']);
  });

  it('the same localId resolves fine inside its own ruleset (isolation is per-identity, not per-name)', () => {
    const roster = isolationRoster('airland', ISOLATION_SHARED_ENTRY_ID);
    expect(rosterDocumentSchema.safeParse(roster).success).toBe(true);
    expect(validateRosterRelations(roster, isolationCatalogs.airland)).toEqual([]);
  });

  it('a classic roster cannot borrow a northag-only entry by name or id', () => {
    const roster = isolationRoster('classic-coldwar', 'tank-company-vanguard'); // exists only in NORTHAG
    const issues = validateRosterRelations(roster, isolationCatalogs['classic-coldwar']).map((i) => i.checkId);
    expect(issues).toContain('roster/selection/entry-unknown');
  });

  it('modifying one ruleset catalog leaves the others untouched', () => {
    const classic = structuredClone(isolationCatalogs['classic-coldwar']);
    const entry = classic.entries[0];
    if (entry === undefined) throw new Error('fixture entry missing');
    entry.baseCost = { points: { state: 'known', value: 999 }, br: { state: 'known', value: 99 } };
    expect(isolationCatalogs.airland.entries[0]?.baseCost.points).toEqual({ state: 'known', value: 180 });
    expect(isolationCatalogs.northag.entries[0]?.baseCost.points).toEqual({ state: 'known', value: 180 });
    expect(validateCatalogRelations(classic)).toEqual([]);
  });
});

describe('NORTHAG structural capabilities (synthetic only, no real thresholds)', () => {
  it('expresses a nested section tree, same-name entries in different sections, one-each options and non-entity requests', () => {
    const northag = isolationCatalogs.northag;
    const sections = northag.armyLists[0]?.structure.sections ?? [];
    const byId = new Map(sections.map((section) => [section.sectionId, section] as const));
    expect(byId.get('vanguard')?.parentSectionId).toBe('main-force');
    expect(byId.get('main-column')?.parentSectionId).toBe('main-force');

    const companyEntries = northag.entries.filter((entry) => entry.name === 'Tank Company');
    expect(companyEntries.map((entry) => entry.localId).sort()).toEqual([
      'tank-company-main-column',
      'tank-company-vanguard',
    ]);

    const oneEach = northag.optionGroups.find((group) => group.localId === 'vanguard-one-each');
    expect(oneEach?.selectionLimit).toEqual({ kind: 'limited', max: 3 });
    for (const option of oneEach?.options ?? []) {
      expect(option.ownLimit).toEqual({ kind: 'limited', max: 1 });
    }

    const request = northag.entries.find((entry) => entry.localId === 'synthetic-reinforcement-request');
    expect(request?.composition.state).toBe('no-entities');
  });

  it('a synthetic NORTHAG roster with one-each picks and a request purchase validates', () => {
    const roster: RosterDocument = {
      formatVersion: ROSTER_FORMAT_VERSION,
      rosterId: 'northag-synthetic',
      name: 'northag-synthetic',
      revision: 'northag-rev-1',
      catalogRef: { rulesetId: 'northag', catalogId: 'isolation-sample', catalogRevision: 'iso-1' },
      armyListId: 'isolation-list',
      settings: { budgetPoints: 500, gameSizeId: 'synthetic', optionalRules: [] },
      selections: [
        {
          selectionId: 'company',
          entryReference: { rulesetId: 'northag', catalogId: 'isolation-sample', catalogRevision: 'iso-1', localId: 'tank-company-vanguard' },
          parentSelectionId: null,
          sectionId: 'vanguard',
          optionChoices: [
            {
              optionGroupLocalId: 'vanguard-one-each',
              optionLocalId: 'synthetic-a',
              targets: [{ kind: 'whole-selection' }],
            },
            {
              optionGroupLocalId: 'vanguard-one-each',
              optionLocalId: 'synthetic-b',
              targets: [{ kind: 'whole-selection' }],
            },
          ],
        },
        {
          selectionId: 'request',
          entryReference: { rulesetId: 'northag', catalogId: 'isolation-sample', catalogRevision: 'iso-1', localId: 'synthetic-reinforcement-request' },
          parentSelectionId: null,
          sectionId: 'reinforcement-requests',
          optionChoices: [],
        },
      ],
    };
    expect(validateRosterRelations(roster, isolationCatalogs.northag)).toEqual([]);
  });

  it('rejects top-level purchases into non-directly-purchasable sections (main-force groups children)', () => {
    // R4: main-force is a grouping section; buying "into" it is a structural
    // error, while its purchasable children (vanguard) keep working above.
    const catalog = structuredClone(isolationCatalogs.northag);
    const platoon = catalog.entries.find((entry) => entry.localId === ISOLATION_SHARED_ENTRY_ID);
    if (platoon === undefined) throw new Error('fixture entry missing');
    platoon.sectionIds = ['vanguard', 'main-force']; // eligible for both, but main-force is not directly purchasable
    const roster = isolationRoster('northag', ISOLATION_SHARED_ENTRY_ID, 'main-force');
    const issues = validateRosterRelations(roster, catalog).map((issue) => issue.checkId);
    expect(issues).toContain('roster/selection/section-not-directly-purchasable');
  });
});
