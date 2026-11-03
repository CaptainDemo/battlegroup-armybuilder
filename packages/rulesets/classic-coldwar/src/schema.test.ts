import { describe, expect, it } from 'vitest';
import {
  catalogShellSchema,
  validateCatalogRelations,
} from '@battlegroup/core';
import { makeIsolationCatalog } from '@battlegroup/core/samples';
import {
  classicCatalogShellSchema,
  classicGameSizeSchema,
  classicRosterDocumentSchema,
  classicTrainingLevelLabels,
  classicTrainingLevelSchema,
  classicUnitProfileSchema,
  isClassicTrainingLevel,
  unverifiedStats,
} from './index';

/**
 * Classic-specific schema boundary: the ruleset identity lock (rework R3),
 * training tokens incl. base training (R7), tracked stats and the
 * catalog/roster refinements on top of the core shell. The M01 sample facts
 * live in @battlegroup/core samples; this file builds small local synthetic
 * records so the ruleset package stays self-contained.
 */

interface SyntheticCatalog {
  manifest: { identity: Record<string, unknown> } & Record<string, unknown>;
  armyLists: Array<Record<string, unknown>>;
  profiles: Array<Record<string, unknown>>;
  entries: Array<Record<string, unknown>>;
  optionGroups: Array<Record<string, unknown>>;
}

function syntheticClassicCatalog(rulesetId = 'classic-coldwar', baseTraining?: unknown): SyntheticCatalog {
  return {
    manifest: {
      identity: { rulesetId, catalogId: 'classic-synthetic', catalogRevision: 'cs-1' },
      schemaVersion: 'catalog-shell/1',
      rulesRevision: 'cw-draft6',
      baseEdition: 'Synthetic Classic fixture',
      sources: [
        {
          documentId: 'SOV',
          title: 'SOVIET ARMOURED DIVISION BATTLEGROUP V4.1',
          authority: 'unofficial-community',
          reviewStatus: 'selected-pages-reviewed',
          errataApplication: 'none-declared',
        },
      ],
      errataSummary: { declaredErrataIds: [], applicationStatus: 'none-declared' },
      coverage: { status: 'sample-scope', note: 'synthetic schema-boundary fixture' },
    },
    armyLists: [
      {
        armyListId: 'synthetic-list',
        rulesetId,
        nation: 'Soviet',
        name: 'Synthetic Classic list',
        structure: {
          sections: [{ sectionId: 'tank', name: 'Tanks', parentSectionId: null, directlyPurchasable: true }],
        },
      },
    ],
    profiles: [
      {
        localId: 't62a',
        name: 'T-62A',
        stats: unverifiedStats('M01 fingerprinted the AFV cards but did not verify stats'),
        sourceRefs: [{ documentId: 'SOV', pdfPage: 7 }],
      },
    ],
    entries: [
      {
        localId: 't62-synthetic',
        name: 'T-62 Tank Platoon (synthetic)',
        kind: 'formation',
        armyListIds: ['synthetic-list'],
        sectionIds: ['tank'],
        baseCost: { points: { state: 'known', value: 75 }, br: { state: 'known', value: 6 } },
        ...(baseTraining === undefined ? {} : { baseTraining }),
        composition: {
          state: 'known',
          root: {
            nodeId: 'platoon',
            role: 'formation',
            quantity: 1,
            children: [{ nodeId: 'platoon-command', role: 'platoon-command', profileLocalId: 't62a', quantity: 3 }],
          },
        },
        optionGroupIds: ['t62-upgrades'],
        sourceRefs: [{ documentId: 'SOV', pdfPage: 7 }],
      },
    ],
    optionGroups: [
      {
        localId: 't62-upgrades',
        name: 'T-62 upgrades',
        scope: 'selection',
        selectionLimit: { kind: 'unlimited' },
        options: [
          {
            localId: 'regular',
            name: 'Upgrade training to Regular',
            target: { kind: 'whole-selection' },
            effects: [{ kind: 'training-change', toTrainingLevel: 'r' }],
            chargeMode: 'once',
            costDelta: { points: { state: 'known', value: 20 }, br: { state: 'known', value: 3 } },
            ownLimit: { kind: 'limited', max: 1 },
            sourceRefs: [{ documentId: 'SOV', pdfPage: 7 }],
          },
        ],
      },
    ],
  };
}

function syntheticRoster(rulesetId: string, gameSizeId = 'platoon'): Record<string, unknown> {
  return {
    formatVersion: 'roster/1',
    rosterId: 'r',
    name: 'r',
    revision: 'synthetic-rev-1',
    catalogRef: { rulesetId, catalogId: 'classic-synthetic', catalogRevision: 'cs-1' },
    armyListId: 'synthetic-list',
    settings: { budgetPoints: 500, gameSizeId, optionalRules: [] },
    selections: [
      {
        selectionId: 'tank',
        entryReference: { rulesetId, catalogId: 'classic-synthetic', catalogRevision: 'cs-1', localId: 't62-synthetic' },
        parentSelectionId: null,
        sectionId: 'tank',
        optionChoices: [],
      },
    ],
  };
}

describe('Classic training levels', () => {
  it('accepts exactly i / r / v / e — including Elite even though M01 only buys i and r', () => {
    for (const level of ['i', 'r', 'v', 'e'] as const) {
      expect(classicTrainingLevelSchema.safeParse(level).success, level).toBe(true);
      expect(classicTrainingLevelLabels[level]).toBeTruthy();
    }
    expect(classicTrainingLevelSchema.safeParse('c').success).toBe(false); // NORTHAG token
    expect(classicTrainingLevelSchema.safeParse('regular').success).toBe(false);
    expect(isClassicTrainingLevel('e')).toBe(true);
    expect(isClassicTrainingLevel('p')).toBe(false);
  });
});

describe('rework R7: base training tokens are validated by the Classic boundary', () => {
  it('accepts known Classic levels and the honest unknown / not-applicable states', () => {
    expect(classicCatalogShellSchema.safeParse(syntheticClassicCatalog('classic-coldwar', { state: 'known', value: 'i' })).success).toBe(true);
    expect(classicCatalogShellSchema.safeParse(syntheticClassicCatalog('classic-coldwar', { state: 'unknown', reason: 'suffix not recorded' })).success).toBe(true);
    expect(classicCatalogShellSchema.safeParse(syntheticClassicCatalog('classic-coldwar', { state: 'not_applicable', reason: 'off-table' })).success).toBe(true);
  });

  it('rejects foreign training tokens on entries (NORTHAG c/p/e are not Classic levels)', () => {
    const catalog = syntheticClassicCatalog('classic-coldwar', { state: 'known', value: 'p' });
    const parsed = classicCatalogShellSchema.safeParse(catalog);
    expect(parsed.success).toBe(false);
  });

  it('rejects foreign training-change tokens in options', () => {
    const catalog = syntheticClassicCatalog();
    const group = (catalog.optionGroups as Array<{ options: Array<{ effects: Array<Record<string, unknown>> }> }>)[0];
    group?.options[0]?.effects.push({ kind: 'training-change', toTrainingLevel: 'p' });
    expect(classicCatalogShellSchema.safeParse(catalog).success).toBe(false);
  });
});

describe('rework R3: the Classic boundary refuses to claim other rulesets', () => {
  it('accepts the classic-coldwar synthetic catalog and roster', () => {
    expect(classicCatalogShellSchema.safeParse(syntheticClassicCatalog()).success).toBe(true);
    expect(classicRosterDocumentSchema.safeParse(syntheticRoster('classic-coldwar')).success).toBe(true);
  });

  it('rejects a NORTHAG catalog with identical shape, names and attributes', () => {
    // The AirLand/NORTHAG synthetic isolation catalogs deliberately share
    // names and attributes with Classic data — the Classic schema must not
    // accept them just because the shape parses.
    const northag = makeIsolationCatalog('northag');
    expect(catalogShellSchema.safeParse(northag).success).toBe(true); // shape is fine for core...
    expect(classicCatalogShellSchema.safeParse(northag).success).toBe(false); // ...but not Classic
    const airland = makeIsolationCatalog('airland');
    expect(classicCatalogShellSchema.safeParse(airland).success).toBe(false);
  });

  it('rejects a synthetic catalog whose manifest claims another ruleset', () => {
    expect(classicCatalogShellSchema.safeParse(syntheticClassicCatalog('northag')).success).toBe(false);
    expect(classicCatalogShellSchema.safeParse(syntheticClassicCatalog('airland')).success).toBe(false);
  });

  it('rejects rosters bound to another ruleset even with Classic game sizes', () => {
    // The a1 probe: catalogRef and every selection reference switched to
    // northag while keeping the Classic "platoon" size token.
    expect(classicRosterDocumentSchema.safeParse(syntheticRoster('northag')).success).toBe(false);
    expect(classicRosterDocumentSchema.safeParse(syntheticRoster('airland')).success).toBe(false);
  });

  it('rejects a classic-bound roster containing a foreign selection reference', () => {
    const roster = syntheticRoster('classic-coldwar') as {
      selections: Array<{ entryReference: { rulesetId: string } }>;
    };
    roster.selections[0]?.entryReference.rulesetId !== undefined &&
      (roster.selections[0]!.entryReference.rulesetId = 'airland');
    expect(classicRosterDocumentSchema.safeParse(roster).success).toBe(false);
  });
});

describe('Classic profile stats stay honestly unknown', () => {
  it('unverified stats are unknown with a reason, never zero', () => {
    const stats = unverifiedStats('AFV card not verified');
    expect(stats.frontArmour).toEqual({ state: 'unknown', reason: 'AFV card not verified' });
    expect(stats.frontArmour).not.toEqual({ state: 'known', value: 0 });
    expect(classicUnitProfileSchema.safeParse({
      localId: 'x',
      name: 'X',
      stats,
      sourceRefs: [{ documentId: 'SOV', pdfPage: 1 }],
    }).success).toBe(true);
  });

  it('rejects bare numbers and unknown keys in stats', () => {
    expect(classicUnitProfileSchema.safeParse({
      localId: 'x',
      name: 'X',
      stats: { frontArmour: 4, sideArmour: 3, rearArmour: 2, topArmour: 1, hits: 2 },
      sourceRefs: [{ documentId: 'SOV', pdfPage: 1 }],
    }).success).toBe(false);
    expect(classicUnitProfileSchema.safeParse({
      localId: 'x',
      name: 'X',
      stats: { ...unverifiedStats('r'), extraStat: { state: 'known', value: 1 } },
      sourceRefs: [{ documentId: 'SOV', pdfPage: 1 }],
    }).success).toBe(false);
  });

  it('not-applicable is distinct from unknown (errata can remove a field)', () => {
    const stats = {
      ...unverifiedStats('r'),
      hits: { state: 'not_applicable', reason: 'aircraft have no Hits after errata (NORTHAG precedent)' },
    };
    expect(classicUnitProfileSchema.safeParse({
      localId: 'x',
      name: 'X',
      stats,
      sourceRefs: [{ documentId: 'SOV', pdfPage: 1 }],
    }).success).toBe(true);
  });
});

describe('Classic catalog refinement', () => {
  it('keeps accepting unknown base costs (missing data is not zero)', () => {
    const catalog = syntheticClassicCatalog();
    const entry = (catalog.entries as Array<Record<string, unknown>>)[0];
    if (entry === undefined) throw new Error('fixture entry missing');
    entry['baseCost'] = {
      points: { state: 'known', value: 75 },
      br: { state: 'unknown', reason: 'BR not transcribed yet' },
    };
    // Still valid for the core shell shape; classic adds no numeric invention.
    expect(catalogShellSchema.safeParse(catalog).success).toBe(true);
    expect(classicCatalogShellSchema.safeParse(catalog).success).toBe(true);
  });
});

describe('Classic roster refinement', () => {
  it('accepts the four C13 game sizes', () => {
    for (const size of ['squad', 'platoon', 'company', 'battalion'] as const) {
      expect(classicGameSizeSchema.safeParse(size).success, size).toBe(true);
      expect(classicRosterDocumentSchema.safeParse(syntheticRoster('classic-coldwar', size)).success, size).toBe(true);
    }
  });

  it('rejects foreign game-size tokens', () => {
    expect(classicRosterDocumentSchema.safeParse(syntheticRoster('classic-coldwar', 'synthetic')).success).toBe(false);
  });
});

describe('the M02 descriptor entry stays intact', () => {
  it('classic-coldwar exports keep importing core from a DOM-free Node environment', async () => {
    const { classicColdWarRuleset, classicTrainingLevelSchema: levels } = await import('./index');
    expect(classicColdWarRuleset.id).toBe('classic-coldwar');
    expect(classicColdWarRuleset.corePackageId).toBe('@battlegroup/core');
    expect(levels.options).toHaveLength(4);
  });
});

describe('core catalog type stays compatible', () => {
  it('core relationship validation runs directly on the ruleset-extended catalog', () => {
    const parsed = catalogShellSchema.parse(syntheticClassicCatalog());
    expect(parsed.profiles[0]?.localId).toBe('t62a');
    expect(validateCatalogRelations(parsed)).toEqual([]);
  });
});
