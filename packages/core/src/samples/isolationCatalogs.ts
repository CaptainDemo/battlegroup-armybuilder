import type {
  CatalogShell,
  OptionGroup,
  UnitEntry,
} from '../contracts/catalog';
import type { RulesetId } from '../contracts/primitives';
import { CATALOG_SCHEMA_VERSION } from '../contracts/versioning';
import type { ProfileIdentity } from '../contracts/catalog';
import { knownValue, limited } from '../contracts/values';

/**
 * SYNTHETIC CONTRACT-TEST FIXTURES — not game data.
 *
 * Three ruleset catalogs deliberately share names, attributes, points and
 * even localIds to prove full identity isolation (docs/technical_plan.md
 * §4.3): each catalog validates standalone, and a roster bound to one
 * ruleset can never resolve another ruleset's records, same localId or not.
 * No real AirLand or NORTHAG thresholds are encoded; the NORTHAG variant
 * only exercises the structural capabilities its reference package exposed
 * (nested section tree, same-name entries in different sections, one-each
 * option groups, non-entity request purchases).
 */

const SHARED_PROFILE_ID = 't72a';
const SHARED_ENTRY_ID = 'shared-t72-platoon';

function sharedProfile(): ProfileIdentity {
  return {
    localId: SHARED_PROFILE_ID,
    name: 'T-72A',
    sourceRefs: [{ documentId: 'synthetic', note: 'synthetic isolation fixture' }],
  };
}

function sharedTankPlatoon(sectionId: string): UnitEntry {
  return {
    localId: SHARED_ENTRY_ID,
    name: 'T-72 MBT Platoon',
    kind: 'formation',
    armyListIds: ['isolation-list'],
    sectionIds: [sectionId],
    baseCost: { points: knownValue(180), br: knownValue(7) },
    composition: {
      state: 'known',
      root: {
        nodeId: 'platoon',
        role: 'formation',
        quantity: 1,
        children: [
          { nodeId: 'platoon-command', role: 'platoon-command', profileLocalId: SHARED_PROFILE_ID, quantity: 1 },
          { nodeId: 'ordinary-1', role: 'ordinary', profileLocalId: SHARED_PROFILE_ID, quantity: 1 },
          { nodeId: 'ordinary-2', role: 'ordinary', profileLocalId: SHARED_PROFILE_ID, quantity: 1 },
        ],
      },
    },
    optionGroupIds: [],
    sourceRefs: [{ documentId: 'synthetic', note: 'synthetic isolation fixture' }],
  };
}

function manifestSources(): CatalogShell['manifest']['sources'] {
  return [
    {
      documentId: 'synthetic',
      title: 'Synthetic isolation fixture',
      authority: 'internal-transcription',
      reviewStatus: 'not-reviewed',
      errataApplication: 'not-applicable',
    },
  ];
}

const oneEachGroup: OptionGroup = {
  localId: 'vanguard-one-each',
  name: 'Vanguard upgrades (one each)',
  scope: 'selection',
  selectionLimit: limited(3),
  options: [
    {
      localId: 'synthetic-a',
      name: 'Synthetic upgrade A',
      target: { kind: 'whole-selection' },
      effects: [{ kind: 'tag-grant', tag: 'synthetic-a' }],
      chargeMode: 'once',
      costDelta: { points: knownValue(5), br: knownValue(0) },
      ownLimit: limited(1),
      sourceRefs: [{ documentId: 'synthetic', note: 'synthetic' }],
    },
    {
      localId: 'synthetic-b',
      name: 'Synthetic upgrade B',
      target: { kind: 'whole-selection' },
      effects: [{ kind: 'tag-grant', tag: 'synthetic-b' }],
      chargeMode: 'once',
      costDelta: { points: knownValue(5), br: knownValue(0) },
      ownLimit: limited(1),
      sourceRefs: [{ documentId: 'synthetic', note: 'synthetic' }],
    },
    {
      localId: 'synthetic-c',
      name: 'Synthetic upgrade C',
      target: { kind: 'whole-selection' },
      effects: [{ kind: 'tag-grant', tag: 'synthetic-c' }],
      chargeMode: 'once',
      costDelta: { points: knownValue(5), br: knownValue(0) },
      ownLimit: limited(1),
      sourceRefs: [{ documentId: 'synthetic', note: 'synthetic' }],
    },
  ],
};

/** Builds the synthetic isolation catalog for one ruleset. Same names, same attributes, same localIds. */
export function makeIsolationCatalog(rulesetId: RulesetId): CatalogShell {
  const isNorthag = rulesetId === 'northag';
  return {
    manifest: {
      identity: { rulesetId, catalogId: 'isolation-sample', catalogRevision: 'iso-1' },
      schemaVersion: CATALOG_SCHEMA_VERSION,
      rulesRevision: 'synthetic-iso-rules',
      baseEdition: 'Synthetic isolation fixture (no real game data)',
      sources: manifestSources(),
      errataSummary: { declaredErrataIds: [], applicationStatus: 'not-applicable' },
      coverage: {
        status: 'sample-scope',
        note: 'Synthetic contract-test fixture; values are invented and prove isolation only.',
      },
    },
    armyLists: [
      {
        armyListId: 'isolation-list',
        rulesetId,
        nation: 'Synthetic',
        name: `Synthetic ${rulesetId} isolation list`,
        structure: {
          sections: isNorthag
            ? [
                { sectionId: 'forward-screen', name: 'Forward Screen', parentSectionId: null, directlyPurchasable: true },
                { sectionId: 'main-force', name: 'Main Force', parentSectionId: null, directlyPurchasable: false },
                { sectionId: 'vanguard', name: 'Vanguard', parentSectionId: 'main-force', directlyPurchasable: true },
                { sectionId: 'main-column', name: 'Main Column', parentSectionId: 'main-force', directlyPurchasable: true },
                { sectionId: 'additional-fire-support', name: 'Additional Fire Support', parentSectionId: null, directlyPurchasable: true },
                { sectionId: 'reinforcement-requests', name: 'Reinforcement Requests', parentSectionId: null, directlyPurchasable: true },
              ]
            : [
                { sectionId: 'core', name: 'Core Formations', parentSectionId: null, directlyPurchasable: true },
              ],
        },
      },
    ],
    profiles: isNorthag
      ? [
          sharedProfile(),
          { localId: 'synthetic-tank', name: 'Synthetic Tank', sourceRefs: [{ documentId: 'synthetic' }] },
        ]
      : [sharedProfile()],
    entries: isNorthag
      ? [
          { ...sharedTankPlatoon('vanguard') },
          {
            ...sharedTankPlatoon('main-column'),
            localId: 'shared-t72-platoon-main-column',
          },
          {
            // Same display name as the platoon entries but a different section
            // and a different purchase identity (same-name, different pool).
            localId: 'tank-company-vanguard',
            name: 'Tank Company',
            kind: 'formation',
            armyListIds: ['isolation-list'],
            sectionIds: ['vanguard'],
            baseCost: { points: knownValue(650), br: knownValue(25) },
            composition: {
              state: 'known',
              root: {
                nodeId: 'company',
                role: 'formation',
                quantity: 1,
                children: [
                  { nodeId: 'company-command', role: 'company-command', profileLocalId: 'synthetic-tank', quantity: 1 },
                  { nodeId: 'platoon-1', role: 'platoon', quantity: 1, children: [
                    { nodeId: 'platoon-command', role: 'platoon-command', profileLocalId: 'synthetic-tank', quantity: 1 },
                    { nodeId: 'ordinary-1', role: 'ordinary', profileLocalId: 'synthetic-tank', quantity: 2 },
                  ] },
                ],
              },
            },
            optionGroupIds: ['vanguard-one-each'],
            sourceRefs: [{ documentId: 'synthetic', note: 'synthetic' }],
          },
          {
            localId: 'tank-company-main-column',
            name: 'Tank Company',
            kind: 'formation',
            armyListIds: ['isolation-list'],
            sectionIds: ['main-column'],
            baseCost: { points: knownValue(650), br: knownValue(25) },
            composition: {
              state: 'known',
              root: {
                nodeId: 'company',
                role: 'formation',
                quantity: 1,
                children: [
                  { nodeId: 'company-command', role: 'company-command', profileLocalId: 'synthetic-tank', quantity: 1 },
                ],
              },
            },
            optionGroupIds: [],
            sourceRefs: [{ documentId: 'synthetic', note: 'synthetic' }],
          },
          {
            // Non-entity reinforcement request: purchasable with cost and no
            // deployed models. No real threshold is encoded.
            localId: 'synthetic-reinforcement-request',
            name: 'Synthetic Reinforcement Request',
            kind: 'tactical-resource',
            armyListIds: ['isolation-list'],
            sectionIds: ['reinforcement-requests'],
            baseCost: { points: knownValue(15), br: knownValue(0) },
            composition: {
              state: 'no-entities',
              reason: 'Request purchases have no deployed models; arrivals are battle state (not modelled).',
            },
            optionGroupIds: [],
            resourceConsumptions: [
              { resourceKind: 'reinforcement-request-slots', amount: 1 },
            ],
            sourceRefs: [{ documentId: 'synthetic', note: 'synthetic' }],
          },
        ]
      : [sharedTankPlatoon('core')],
    optionGroups: isNorthag ? [oneEachGroup] : [],
  };
}

export const ISOLATION_SHARED_PROFILE_ID = SHARED_PROFILE_ID;
export const ISOLATION_SHARED_ENTRY_ID = SHARED_ENTRY_ID;
