import type {
  ArmySection,
  CatalogShell,
  CompositionNode,
  Option,
  OptionGroup,
  ProfileIdentity,
  UnitEntry,
} from '../contracts/catalog';
import type { SourceReference } from '../contracts/source';
import type { TrackedToken } from '../contracts/values';
import { CATALOG_SCHEMA_VERSION } from '../contracts/versioning';
import { knownValue, limited, unlimited } from '../contracts/values';

/** Known training from a printed M01 suffix. */
const train = (level: 'i' | 'r'): TrackedToken => ({ state: 'known', value: level });
/** No suffix recorded in the M01 sample scope — explicitly unknown, never guessed. */
const trainUnknown = (entry: string): TrackedToken => ({
  state: 'unknown',
  reason: `training suffix not recorded in the M01 sample scope (${entry})`,
});
/** Off-table purchases have no training concept. */
const trainNotApplicable = (reason: string): TrackedToken => ({ state: 'not_applicable', reason });

/**
 * CONTRACT-TEST CATALOG built from M01 verified facts
 * (docs/data/classic-sample-scope.md, 2026-10-30 baseline).
 *
 * This is NOT a publishable catalog: it contains exactly the entries the 23
 * manual calibration accounts need, at contract-test fidelity. Stats are not
 * modelled here (AFV cards were fingerprinted but not verified in M01);
 * entries reference profile identity shells only. Training levels are
 * tokens validated by @battlegroup/classic-coldwar, not by this data.
 *
 * Encoded user clarifications: A01 (T-72 company = 10 T-72A), A02 (two
 * independent support pools), A03 (all-BMP scope selector), A04 (second Fire
 * Support consumes a platoon-support slot), A07/C16 (PT-76 exclusion hook via
 * specialRules), A09 (Points-only options carry known BR delta 0).
 */

export const CLASSIC_SAMPLE_CATALOG_ID = 'soviet-armoured-division-sample';
export const CLASSIC_SAMPLE_CATALOG_REVISION = 'm01-sample-1';
export const CLASSIC_SAMPLE_ARMY_LIST_ID = 'soviet-armoured-division-v4_1';

const SOV = 'SOV';
const CW = 'CW';
const BASE = 'BASE';

function sovRef(pdfPage: number, note?: string): SourceReference {
  return { documentId: SOV, pdfPage, note };
}

const ARMY_SUPPORT_KIND = 'army-support-choice';
const PLATOON_SUPPORT_KIND = 'platoon-support-slots';
const ALL_SUPPORT_CATEGORIES = [
  'reconnaissance',
  'engineer',
  'logistics',
  'specialist',
  'additional-fire-support',
];

function tank(name: string, profile: string, qty = 1): CompositionNode {
  return { nodeId: name, role: name, profileLocalId: profile, quantity: qty };
}

function squadWithTransport(squadId: string, transportProfile: string): CompositionNode {
  return {
    nodeId: squadId,
    role: 'squad',
    quantity: 1,
    children: [{ nodeId: 'transport', role: 'transport', profileLocalId: transportProfile, quantity: 1 }],
  };
}

function baseEntry(fields: {
  localId: string;
  name: string;
  kind: UnitEntry['kind'];
  sectionIds: string[];
  points: number;
  br: number;
  /**
   * Base training from the M01 table's printed suffix (e.g. "7r"), kept as an
   * explicit tracked token: known for i/r entries, not_applicable for
   * off-table requests/strikes, unknown with a reason when the sample scope
   * records no suffix. Never inferred from BR or names (rework R7).
   */
  baseTraining: TrackedToken;
  composition: UnitEntry['composition'];
  sourceRefs: SourceReference[];
  optionGroupIds?: string[] | undefined;
  resourceGrants?: UnitEntry['resourceGrants'] | undefined;
  resourceConsumptions?: UnitEntry['resourceConsumptions'] | undefined;
  specialRules?: string[] | undefined;
  tags?: string[] | undefined;
}): UnitEntry {
  return {
    localId: fields.localId,
    name: fields.name,
    kind: fields.kind,
    armyListIds: [CLASSIC_SAMPLE_ARMY_LIST_ID],
    sectionIds: fields.sectionIds,
    baseCost: { points: knownValue(fields.points), br: knownValue(fields.br) },
    baseTraining: fields.baseTraining,
    composition: fields.composition,
    optionGroupIds: fields.optionGroupIds ?? [],
    resourceGrants: fields.resourceGrants,
    resourceConsumptions: fields.resourceConsumptions,
    specialRules: fields.specialRules,
    tags: fields.tags,
    sourceRefs: fields.sourceRefs,
  };
}

function profile(localId: string, name: string, pdfPage: number): ProfileIdentity {
  return { localId, name, sourceRefs: [sovRef(pdfPage)] };
}

function threeTankPlatoon(profileId: string): UnitEntry['composition'] {
  return {
    state: 'known',
    root: {
      nodeId: 'platoon',
      role: 'formation',
      quantity: 1,
      children: [tank('platoon-command', profileId), tank('ordinary-1', profileId), tank('ordinary-2', profileId)],
    },
  };
}

/* ------------------------------------------------------------------ */
/* Option groups                                                       */
/* ------------------------------------------------------------------ */

const t72PlatoonUpgrades: OptionGroup = {
  localId: 't72-platoon-upgrades',
  name: 'T-72 platoon upgrades',
  scope: 'selection',
  selectionLimit: unlimited,
  options: [
    {
      localId: 'platoon-to-b',
      name: 'Upgrade all three tanks to T-72B',
      target: { kind: 'whole-selection' },
      effects: [{ kind: 'model-replacement', fromProfileLocalId: 't72a', toProfileLocalId: 't72b' }],
      chargeMode: 'once',
      costDelta: { points: knownValue(30), br: knownValue(0) }, // A09: Points-only option, BR delta known 0
      ownLimit: limited(1),
      sourceRefs: [sovRef(6)],
    },
    {
      localId: 'kmt',
      name: 'KMT mine plough on one tank',
      target: {
        kind: 'member-slots',
        nodePaths: [['platoon-command'], ['ordinary-1'], ['ordinary-2']],
      },
      effects: [{ kind: 'tag-grant', tag: 'kmt' }],
      chargeMode: 'per-target',
      costDelta: { points: knownValue(5), br: knownValue(0) },
      ownLimit: limited(1),
      sourceRefs: [sovRef(6)],
    },
  ],
};

const t72CompanyUpgrades: OptionGroup = {
  localId: 't72-company-upgrades',
  name: 'T-72 company upgrades (+10 each)',
  scope: 'selection',
  selectionLimit: unlimited,
  options: [
    {
      localId: 'b1-per-tank',
      name: 'Upgrade each tank to T-72B1 (+10 each)',
      target: {
        kind: 'scope-selector',
        selectorId: 'all-company-tanks',
        description: 'Each T-72A in the company (company command, platoon commands, ordinary tanks).',
        includeSubFormations: true,
        matchProfileLocalIds: ['t72a'],
      },
      effects: [{ kind: 'model-replacement', fromProfileLocalId: 't72a', toProfileLocalId: 't72b1' }],
      chargeMode: 'per-target',
      costDelta: { points: knownValue(10), br: knownValue(0) }, // A09: BR unchanged (L10)
      ownLimit: limited(10),
      sourceRefs: [sovRef(6)],
    },
  ],
};

/** A03: recursive all-BMP selector, shared by the standalone platoon and the company. */
const bmp1Upgrades: OptionGroup = {
  localId: 'bmp1-upgrades',
  name: 'BMP-1 upgrades',
  scope: 'selection',
  selectionLimit: unlimited,
  options: [
    {
      localId: 'all-bmp1-to-p',
      name: 'Upgrade all BMP-1 to BMP-1P (+5 each)',
      target: {
        kind: 'scope-selector',
        selectorId: 'all-bmp1-transports',
        description:
          'All BMP-1 in the formation, including every sub-formation and purchased Platoon Support Option transports; each target once.',
        includeSubFormations: true,
        matchProfileLocalIds: ['bmp1'],
      },
      effects: [{ kind: 'model-replacement', fromProfileLocalId: 'bmp1', toProfileLocalId: 'bmp1p' }],
      chargeMode: 'per-target',
      costDelta: { points: knownValue(5), br: knownValue(0) },
      ownLimit: limited(12),
      sourceRefs: [sovRef(2)],
    },
  ],
};

const t62PlatoonUpgrades: OptionGroup = {
  localId: 't62-platoon-upgrades',
  name: 'T-62 platoon upgrades',
  scope: 'selection',
  selectionLimit: unlimited,
  options: [
    {
      localId: 'platoon-to-m',
      name: 'Upgrade all three tanks to T-62M',
      target: { kind: 'whole-selection' },
      effects: [{ kind: 'model-replacement', fromProfileLocalId: 't62a', toProfileLocalId: 't62m' }],
      chargeMode: 'once',
      costDelta: { points: knownValue(30), br: knownValue(0) },
      ownLimit: limited(1),
      sourceRefs: [sovRef(7)],
    },
    {
      localId: 'one-bastion',
      name: 'Bastion ATGM on one T-62M',
      target: {
        kind: 'member-slots',
        nodePaths: [['platoon-command'], ['ordinary-1'], ['ordinary-2']],
      },
      effects: [{ kind: 'tag-grant', tag: 'bastion' }],
      chargeMode: 'per-target',
      costDelta: { points: knownValue(20), br: knownValue(0) },
      ownLimit: limited(1),
      requires: ['platoon-to-m'],
      sourceRefs: [sovRef(7)],
    },
    {
      localId: 'regular',
      name: 'Upgrade training to Regular',
      target: { kind: 'whole-selection' },
      effects: [{ kind: 'training-change', toTrainingLevel: 'r' }],
      chargeMode: 'once',
      costDelta: { points: knownValue(20), br: knownValue(3) }, // C06: +20 Points / +3 BR, training i -> r
      ownLimit: limited(1),
      sourceRefs: [sovRef(7)],
    },
  ],
};

/** C02/sample-scope p.2: the heavy mortar team may swap its GAZ-66 for an MTLB (+5). */
const bmp1MortarUpgrades: OptionGroup = {
  localId: 'bmp1-mortar-upgrades',
  name: 'Heavy Mortar Team transport swap',
  scope: 'selection',
  selectionLimit: unlimited,
  options: [
    {
      localId: 'mortar-to-mtlb',
      name: 'Replace GAZ-66 with MTLB (+5)',
      target: {
        kind: 'member-slots',
        nodePaths: [['transport']],
      },
      effects: [{ kind: 'model-replacement', fromProfileLocalId: 'gaz66', toProfileLocalId: 'mtlb' }],
      chargeMode: 'per-target',
      costDelta: { points: knownValue(5), br: knownValue(0) },
      ownLimit: limited(1),
      sourceRefs: [sovRef(2)],
    },
  ],
};

const reconCommandTransport: OptionGroup = {
  localId: 'recon-command-transport',
  name: 'Recon Command transport',
  scope: 'selection',
  selectionLimit: unlimited,
  options: [
    {
      localId: 'transport-pt76b',
      name: 'Replace transport with PT-76B (free)',
      target: { kind: 'whole-selection' },
      effects: [{ kind: 'model-replacement', fromProfileLocalId: 'btr60pb', toProfileLocalId: 'pt76b' }],
      chargeMode: 'once',
      costDelta: { points: knownValue(0), br: knownValue(0) }, // F07: free swap, no BR change listed
      ownLimit: limited(1),
      specialRules: ['pt76-tank-exclusion'], // A07/C16: triggers through the nested choice
      sourceRefs: [sovRef(10)],
    },
  ],
};

const engineerTransport: OptionGroup = {
  localId: 'engineer-transport',
  name: 'Engineer transport swap',
  scope: 'selection',
  selectionLimit: unlimited,
  options: [
    {
      localId: 'btr80-swap',
      name: 'Replace BTR-60PB with BTR-80 (free)',
      target: { kind: 'whole-selection' },
      effects: [{ kind: 'model-replacement', fromProfileLocalId: 'btr60pb', toProfileLocalId: 'btr80' }],
      chargeMode: 'once',
      costDelta: { points: knownValue(0), br: knownValue(0) }, // C18/L07: free replacement
      ownLimit: limited(1),
      sourceRefs: [sovRef(11)],
    },
  ],
};

const ambulanceDowngrade: OptionGroup = {
  localId: 'ambulance-downgrade',
  name: 'Ambulance downgrade',
  scope: 'selection',
  selectionLimit: unlimited,
  options: [
    {
      localId: 'heavy-truck',
      name: 'Downgrade to Heavy Truck (-5 Points / -1 BR)',
      target: { kind: 'whole-selection' },
      effects: [{ kind: 'model-replacement', fromProfileLocalId: 'ural452', toProfileLocalId: 'heavy-truck' }],
      chargeMode: 'once',
      costDelta: { points: knownValue(-5), br: knownValue(-1) }, // C18/L08: negative deltas are known values
      ownLimit: limited(1),
      sourceRefs: [sovRef(11)],
    },
  ],
};

/* ------------------------------------------------------------------ */
/* Sections and entries                                                */
/* ------------------------------------------------------------------ */

const sections: ArmySection[] = [
  { sectionId: 'hq', name: 'HQ', parentSectionId: null, directlyPurchasable: true },
  { sectionId: 'motor-rifle', name: 'Motor Rifle', parentSectionId: null, directlyPurchasable: true },
  { sectionId: 'tank', name: 'Tanks', parentSectionId: null, directlyPurchasable: true },
  { sectionId: 'reconnaissance', name: 'Reconnaissance', parentSectionId: null, directlyPurchasable: true },
  { sectionId: 'specialist', name: 'Specialist', parentSectionId: null, directlyPurchasable: true },
  { sectionId: 'artillery', name: 'Artillery', parentSectionId: null, directlyPurchasable: true },
  { sectionId: 'engineer', name: 'Engineer', parentSectionId: null, directlyPurchasable: true },
  { sectionId: 'logistics', name: 'Logistics', parentSectionId: null, directlyPurchasable: true },
];

function infantryPlatoons(count: number, squadTransport: (index: number) => string): CompositionNode[] {
  const platoons: CompositionNode[] = [];
  for (let index = 1; index <= count; index += 1) {
    platoons.push({
      nodeId: `platoon-${index}`,
      role: 'platoon',
      quantity: 1,
      children: [
        squadWithTransport('squad-1', squadTransport(index)),
        squadWithTransport('squad-2', squadTransport(index)),
        squadWithTransport('squad-3', squadTransport(index)),
      ],
    });
  }
  return platoons;
}

function attachmentEntry(fields: {
  localId: string;
  name: string;
  points: number;
  br: number;
  rootId: string;
  children: CompositionNode[];
  pdfPage: number;
  baseTraining: TrackedToken;
  optionGroupIds?: string[];
  note?: string;
  tags?: string[];
}): UnitEntry {
  return baseEntry({
    localId: fields.localId,
    name: fields.name,
    kind: 'single',
    sectionIds: ['motor-rifle'],
    points: fields.points,
    br: fields.br,
    baseTraining: fields.baseTraining,
    composition: {
      state: 'known',
      root: { nodeId: fields.rootId, role: fields.rootId, quantity: 1, children: fields.children },
    },
    sourceRefs: [sovRef(fields.pdfPage, fields.note)],
    optionGroupIds: fields.optionGroupIds,
    resourceConsumptions: [{ resourceKind: PLATOON_SUPPORT_KIND, amount: 1 }],
    tags: fields.tags,
  });
}

const entries: UnitEntry[] = [
  baseEntry({
    localId: 'fhq',
    name: 'Forward Headquarters',
    kind: 'formation',
    sectionIds: ['hq'],
    points: 20,
    br: 3,
    baseTraining: train('r'),
    composition: {
      state: 'known',
      root: {
        nodeId: 'fhq',
        role: 'formation',
        quantity: 1,
        children: [
          { nodeId: 'command-group', role: 'hq-staff', quantity: 3 },
          { nodeId: 'transport', role: 'transport', profileLocalId: 'bmp1k', quantity: 1 },
        ],
      },
    },
    sourceRefs: [sovRef(1)],
    resourceGrants: [
      {
        resourceKind: ARMY_SUPPORT_KIND,
        scope: 'army',
        capacity: 1,
        eligibleCategories: ['logistics', 'additional-fire-support'],
        note: 'C09: Logistics or Additional Fire Support — one of the two, not both (rule execution is M07).',
      },
    ],
    tags: ['unique'],
  }),
  baseEntry({
    localId: 't72-platoon',
    name: 'T-72 MBT Platoon',
    kind: 'formation',
    sectionIds: ['tank'],
    points: 180,
    br: 7,
    baseTraining: train('r'),
    composition: threeTankPlatoon('t72a'),
    sourceRefs: [sovRef(6)],
    optionGroupIds: ['t72-platoon-upgrades'],
    resourceGrants: [
      { resourceKind: ARMY_SUPPORT_KIND, scope: 'army', capacity: 4, eligibleCategories: ALL_SUPPORT_CATEGORIES, note: 'C08' },
    ],
  }),
  baseEntry({
    localId: 't72-company',
    name: 'T-72 MBT Company',
    kind: 'formation',
    sectionIds: ['tank'],
    points: 600,
    br: 25,
    baseTraining: train('r'),
    composition: {
      // A01: 10 T-72A — 1 company command, 3 platoon commands, 6 ordinary (T-80B summary is a typo).
      state: 'known',
      root: {
        nodeId: 'company',
        role: 'formation',
        quantity: 1,
        children: [
          tank('company-command', 't72a'),
          {
            nodeId: 'platoon-1',
            role: 'platoon',
            quantity: 1,
            children: [tank('platoon-command', 't72a'), tank('ordinary-1', 't72a'), tank('ordinary-2', 't72a')],
          },
          {
            nodeId: 'platoon-2',
            role: 'platoon',
            quantity: 1,
            children: [tank('platoon-command', 't72a'), tank('ordinary-1', 't72a'), tank('ordinary-2', 't72a')],
          },
          {
            nodeId: 'platoon-3',
            role: 'platoon',
            quantity: 1,
            children: [tank('platoon-command', 't72a'), tank('ordinary-1', 't72a'), tank('ordinary-2', 't72a')],
          },
        ],
      },
    },
    sourceRefs: [sovRef(6, 'A01: composition corrected to 10 T-72A by user clarification')],
    optionGroupIds: ['t72-company-upgrades'],
    resourceGrants: [
      { resourceKind: ARMY_SUPPORT_KIND, scope: 'army', capacity: 9, eligibleCategories: ALL_SUPPORT_CATEGORIES, note: 'C08' },
    ],
  }),
  baseEntry({
    localId: 'additional-t72a',
    name: 'Additional T-72A tank',
    kind: 'single',
    sectionIds: ['tank'],
    points: 60,
    br: 3,
    baseTraining: trainUnknown('additional-t72a'),
    composition: { state: 'known', root: { nodeId: 'tank', role: 'single-tank', profileLocalId: 't72a', quantity: 1 } },
    sourceRefs: [sovRef(7)],
  }),
  baseEntry({
    localId: 't62-platoon',
    name: 'T-62 Tank Platoon',
    kind: 'formation',
    sectionIds: ['tank'],
    points: 75,
    br: 6,
    baseTraining: train('i'), // L02: the Regular upgrade starts from Inexperienced
    composition: threeTankPlatoon('t62a'),
    sourceRefs: [sovRef(7)],
    optionGroupIds: ['t62-platoon-upgrades'],
  }),
  baseEntry({
    localId: 'bmp1-platoon',
    name: 'BMP-1 Motor Rifle Platoon',
    kind: 'formation',
    sectionIds: ['motor-rifle'],
    points: 95,
    br: 8,
    baseTraining: train('r'),
    composition: {
      state: 'known',
      root: {
        nodeId: 'platoon',
        role: 'formation',
        quantity: 1,
        children: [
          squadWithTransport('command-squad', 'bmp1'),
          squadWithTransport('assistant-squad', 'bmp1'),
          squadWithTransport('rifle-squad', 'bmp1'),
        ],
      },
    },
    sourceRefs: [sovRef(2)],
    optionGroupIds: ['bmp1-upgrades'],
    resourceGrants: [
      { resourceKind: ARMY_SUPPORT_KIND, scope: 'army', capacity: 4, eligibleCategories: ALL_SUPPORT_CATEGORIES, note: 'C07' },
      { resourceKind: PLATOON_SUPPORT_KIND, scope: 'parent-formation', capacity: 4, note: 'C02' },
    ],
  }),
  baseEntry({
    localId: 'bmp1-company',
    name: 'BMP-1 Motor Rifle Company',
    kind: 'formation',
    sectionIds: ['motor-rifle'],
    points: 275,
    br: 25,
    baseTraining: train('r'),
    composition: {
      // Fixed platoons included in the company price (C04: 275 is not 3x95 plus command).
      state: 'known',
      root: {
        nodeId: 'company',
        role: 'formation',
        quantity: 1,
        children: [
          squadWithTransport('command-squad', 'bmp1'),
          ...infantryPlatoons(3, () => 'bmp1'),
        ],
      },
    },
    sourceRefs: [sovRef(3)],
    optionGroupIds: ['bmp1-upgrades'],
    resourceGrants: [
      { resourceKind: ARMY_SUPPORT_KIND, scope: 'army', capacity: 12, eligibleCategories: ALL_SUPPORT_CATEGORIES, note: 'C07' },
      { resourceKind: PLATOON_SUPPORT_KIND, scope: 'formation-member', capacity: 4, memberPath: ['platoon-1'], note: 'C03' },
      { resourceKind: PLATOON_SUPPORT_KIND, scope: 'formation-member', capacity: 4, memberPath: ['platoon-2'], note: 'C03' },
      { resourceKind: PLATOON_SUPPORT_KIND, scope: 'formation-member', capacity: 4, memberPath: ['platoon-3'], note: 'C03' },
    ],
  }),
  baseEntry({
    localId: 'bmp2-platoon',
    name: 'BMP-2 Motor Rifle Platoon',
    kind: 'formation',
    sectionIds: ['motor-rifle'],
    points: 130,
    br: 12,
    baseTraining: train('r'),
    composition: {
      state: 'known',
      root: {
        nodeId: 'platoon',
        role: 'formation',
        quantity: 1,
        children: [
          squadWithTransport('squad-1', 'bmp2'),
          squadWithTransport('squad-2', 'bmp2'),
          squadWithTransport('squad-3', 'bmp2'),
        ],
      },
    },
    sourceRefs: [sovRef(4)],
    resourceGrants: [
      { resourceKind: ARMY_SUPPORT_KIND, scope: 'army', capacity: 4, eligibleCategories: ALL_SUPPORT_CATEGORIES, note: 'C07' },
      { resourceKind: PLATOON_SUPPORT_KIND, scope: 'parent-formation', capacity: 4, note: 'C02' },
    ],
  }),
  baseEntry({
    localId: 'bmp2-company',
    name: 'BMP-2 Motor Rifle Company',
    kind: 'formation',
    sectionIds: ['motor-rifle'],
    points: 380,
    br: 35,
    baseTraining: train('r'),
    composition: {
      state: 'known',
      root: {
        nodeId: 'company',
        role: 'formation',
        quantity: 1,
        children: [squadWithTransport('command-squad', 'bmp2'), ...infantryPlatoons(3, () => 'bmp2')],
      },
    },
    sourceRefs: [sovRef(5)],
    resourceGrants: [
      { resourceKind: ARMY_SUPPORT_KIND, scope: 'army', capacity: 12, eligibleCategories: ALL_SUPPORT_CATEGORIES, note: 'C07 (BMP motor rifle company)' },
      { resourceKind: PLATOON_SUPPORT_KIND, scope: 'formation-member', capacity: 4, memberPath: ['platoon-1'], note: 'C03' },
      { resourceKind: PLATOON_SUPPORT_KIND, scope: 'formation-member', capacity: 4, memberPath: ['platoon-2'], note: 'C03' },
      { resourceKind: PLATOON_SUPPORT_KIND, scope: 'formation-member', capacity: 4, memberPath: ['platoon-3'], note: 'C03' },
    ],
  }),
  attachmentEntry({
    localId: 'bmp1-platoon-medic',
    name: 'Combat Medic',
    points: 8,
    br: 0, // known zero BR, not unknown (B01)
    rootId: 'medic',
    children: [{ nodeId: 'medic-team', role: 'medic', quantity: 1 }],
    pdfPage: 2,
    baseTraining: train('i'),
    tags: ['medic'],
  }),
  attachmentEntry({
    localId: 'bmp1-platoon-fire-support',
    name: 'Fire Support Section',
    points: 25,
    br: 1,
    rootId: 'fire-support',
    children: [
      { nodeId: 'gun-group-1', role: 'weapon-team', quantity: 2 },
      { nodeId: 'gun-group-2', role: 'weapon-team', quantity: 2 },
      { nodeId: 'transport', role: 'transport', profileLocalId: 'bmp1', quantity: 1 }, // two teams share one BMP-1
    ],
    pdfPage: 2,
    baseTraining: train('r'),
  }),
  attachmentEntry({
    localId: 'bmp1-platoon-agl',
    name: 'AGL Section',
    points: 18,
    br: 1,
    rootId: 'agl',
    children: [
      { nodeId: 'agl-team', role: 'weapon-team', quantity: 3 },
      { nodeId: 'transport', role: 'transport', profileLocalId: 'bmp1', quantity: 1 },
    ],
    pdfPage: 2,
    baseTraining: train('r'),
  }),
  attachmentEntry({
    localId: 'bmp1-platoon-mortar',
    name: 'Heavy Mortar Team',
    points: 40,
    br: 1,
    rootId: 'mortar',
    children: [
      { nodeId: 'mortar-team', role: 'weapon-team', quantity: 3 },
      { nodeId: 'transport', role: 'transport', profileLocalId: 'gaz66', quantity: 1 },
    ],
    pdfPage: 2,
    baseTraining: train('r'),
    optionGroupIds: ['bmp1-mortar-upgrades'],
    note: 'May swap its GAZ-66 for an MTLB (+5).',
  }),
  // Company-context attachments are separate entries (same names, own pages
  // and prices — e.g. the company AGL is 35 Points, the standalone one 18):
  // identical names never merge across purchase contexts.
  attachmentEntry({
    localId: 'bmp1-company-platoon-fire-support',
    name: 'Fire Support Section',
    points: 25,
    br: 1,
    rootId: 'fire-support',
    children: [
      { nodeId: 'gun-group-1', role: 'weapon-team', quantity: 2 },
      { nodeId: 'gun-group-2', role: 'weapon-team', quantity: 2 },
      { nodeId: 'transport', role: 'transport', profileLocalId: 'bmp1', quantity: 1 },
    ],
    pdfPage: 3,
    baseTraining: trainUnknown('bmp1-company-platoon-fire-support'),
  }),
  attachmentEntry({
    localId: 'bmp1-company-platoon-agl',
    name: 'AGL Section',
    points: 35,
    br: 1,
    rootId: 'agl',
    children: [
      { nodeId: 'agl-team', role: 'weapon-team', quantity: 3 },
      { nodeId: 'transport', role: 'transport', profileLocalId: 'bmp1', quantity: 1 },
    ],
    pdfPage: 3,
    baseTraining: trainUnknown('bmp1-company-platoon-agl'),
  }),
  attachmentEntry({
    localId: 'bmp1-company-platoon-medic',
    name: 'Combat Medic',
    points: 8,
    br: 0,
    rootId: 'medic',
    children: [{ nodeId: 'medic-team', role: 'medic', quantity: 1 }],
    pdfPage: 3,
    baseTraining: trainUnknown('bmp1-company-platoon-medic'),
    tags: ['medic'],
  }),
  baseEntry({
    localId: 'bmp2-platoon-fire-support',
    name: 'Fire Support Section (independent BMP-2 platoon)',
    kind: 'single',
    sectionIds: ['motor-rifle'],
    points: 45, // L03: independent platoon context price, not the company 40
    br: 1,
    baseTraining: train('r'),
    composition: {
      state: 'known',
      root: {
        nodeId: 'fire-support',
        role: 'fire-support',
        quantity: 1,
        children: [
          { nodeId: 'gun-group-1', role: 'weapon-team', quantity: 2 },
          { nodeId: 'gun-group-2', role: 'weapon-team', quantity: 2 },
          { nodeId: 'transport', role: 'transport', profileLocalId: 'bmp2', quantity: 1 },
        ],
      },
    },
    sourceRefs: [sovRef(4)],
    resourceConsumptions: [{ resourceKind: PLATOON_SUPPORT_KIND, amount: 1 }],
  }),
  attachmentEntry({
    localId: 'bmp2-company-platoon-fire-support',
    name: 'Fire Support Section',
    points: 40,
    br: 1,
    rootId: 'fire-support',
    children: [
      { nodeId: 'gun-group-1', role: 'weapon-team', quantity: 2 },
      { nodeId: 'gun-group-2', role: 'weapon-team', quantity: 2 },
      { nodeId: 'transport', role: 'transport', profileLocalId: 'bmp2', quantity: 1 },
    ],
    pdfPage: 5,
    baseTraining: train('r'),
  }),
  // A04/R6: the second Fire Support Section is its own paid, context-specific
  // entry — full explicit composition (two PKM teams + BMP-2 transport), its
  // own 35 Points / +1 BR attribution, and it consumes one of the target
  // platoon's four Platoon Support Options slots. It is not a full-price
  // duplicate of the first section and hides nothing in string ids.
  attachmentEntry({
    localId: 'bmp2-company-platoon-fire-support-second',
    name: 'Second Fire Support Section',
    points: 35,
    br: 1,
    rootId: 'second-fire-support',
    children: [
      { nodeId: 'gun-group-1', role: 'weapon-team', quantity: 2 },
      { nodeId: 'gun-group-2', role: 'weapon-team', quantity: 2 },
      { nodeId: 'transport', role: 'transport', profileLocalId: 'bmp2', quantity: 1 },
    ],
    pdfPage: 5,
    baseTraining: trainUnknown('bmp2-company-platoon-fire-support-second'),
    note: 'A04: occupies another one of the four Platoon Support Options of the target platoon.',
  }),
  attachmentEntry({
    localId: 'bmp2-company-platoon-medic',
    name: 'Combat Medic',
    points: 8,
    br: 0,
    rootId: 'medic',
    children: [{ nodeId: 'medic-team', role: 'medic', quantity: 1 }],
    pdfPage: 5,
    baseTraining: trainUnknown('bmp2-company-platoon-medic'),
    tags: ['medic'],
  }),
  attachmentEntry({
    localId: 'bmp2-company-platoon-mortar',
    name: 'Heavy Mortar Team',
    points: 40,
    br: 1,
    rootId: 'mortar',
    children: [
      { nodeId: 'mortar-team', role: 'weapon-team', quantity: 3 },
      { nodeId: 'transport', role: 'transport', profileLocalId: 'gaz66', quantity: 1 },
    ],
    pdfPage: 5,
    baseTraining: trainUnknown('bmp2-company-platoon-mortar'),
  }),
  attachmentEntry({
    localId: 'bmp2-company-platoon-agl',
    name: 'AGL Section',
    points: 35,
    br: 1,
    rootId: 'agl',
    children: [
      { nodeId: 'agl-team', role: 'weapon-team', quantity: 3 },
      { nodeId: 'transport', role: 'transport', profileLocalId: 'bmp2', quantity: 1 },
    ],
    pdfPage: 5,
    baseTraining: trainUnknown('bmp2-company-platoon-agl'),
  }),
  baseEntry({
    localId: 'brdm2-recon',
    name: 'BRDM-2 Armoured Car',
    kind: 'single',
    sectionIds: ['reconnaissance'],
    points: 12,
    br: 1,
    baseTraining: train('r'),
    composition: { state: 'known', root: { nodeId: 'brdm2', role: 'armoured-car', profileLocalId: 'brdm2', quantity: 1 } },
    sourceRefs: [sovRef(10)],
    resourceConsumptions: [
      { resourceKind: ARMY_SUPPORT_KIND, category: 'reconnaissance', amount: 1, note: 'Consumes one explicitly granted army support choice (C07).' },
    ],
    tags: ['scout', 'mortar-spotter'],
  }),
  baseEntry({
    localId: 'zsu23-4',
    name: 'ZSU-23-4 SP AA Gun',
    kind: 'single',
    sectionIds: ['specialist'],
    points: 35,
    br: 2,
    baseTraining: train('i'),
    composition: { state: 'known', root: { nodeId: 'zsu', role: 'sp-aa', profileLocalId: 'zsu234', quantity: 1 } },
    sourceRefs: [sovRef(12)],
    resourceConsumptions: [{ resourceKind: ARMY_SUPPORT_KIND, category: 'specialist', amount: 1 }],
  }),
  baseEntry({
    localId: 'artillery-request-priority3',
    name: 'Off-Table Artillery Support Request (3rd Priority)',
    kind: 'tactical-resource',
    sectionIds: ['artillery'],
    points: 5,
    br: 0,
    baseTraining: trainNotApplicable('off-table fire support request: no training concept'),
    composition: {
      state: 'no-entities',
      reason: 'Off-table fire support request: no deployed models; future random units are battle state.',
    },
    sourceRefs: [sovRef(13)],
    resourceConsumptions: [{ resourceKind: ARMY_SUPPORT_KIND, category: 'additional-fire-support', amount: 1 }],
  }),
  baseEntry({
    localId: 'timed122',
    name: 'Timed 122mm HE Barrage',
    kind: 'off-table-support',
    sectionIds: ['artillery'],
    points: 25,
    br: 0,
    baseTraining: trainNotApplicable('pre-registered off-table strike: no training concept'),
    composition: {
      state: 'no-entities',
      reason: 'Pre-registered strike by six off-table guns; not six deployed models; target point included (L09).',
    },
    sourceRefs: [sovRef(15)],
  }),
  baseEntry({
    localId: 'pt76b-recon',
    name: 'PT-76B',
    kind: 'single',
    sectionIds: ['reconnaissance'],
    points: 17,
    br: 1,
    baseTraining: trainUnknown('pt76b-recon'),
    composition: { state: 'known', root: { nodeId: 'pt76', role: 'light-tank', profileLocalId: 'pt76b', quantity: 1 } },
    sourceRefs: [sovRef(10)],
    specialRules: ['pt76-tank-exclusion'], // C16: excludes non-T-62 tank formations
  }),
  baseEntry({
    localId: 'recon-command',
    name: 'Recon Command',
    kind: 'formation',
    sectionIds: ['reconnaissance'],
    points: 22,
    br: 2,
    baseTraining: trainUnknown('recon-command'),
    composition: {
      state: 'known',
      root: {
        nodeId: 'recon-command',
        role: 'formation',
        quantity: 1,
        children: [
          { nodeId: 'command-group', role: 'hq-staff', quantity: 2 },
          { nodeId: 'transport', role: 'transport', profileLocalId: 'btr60pb', quantity: 1 },
        ],
      },
    },
    sourceRefs: [sovRef(10)],
    optionGroupIds: ['recon-command-transport'],
  }),
  baseEntry({
    localId: 'combat-engineers',
    name: 'Combat Engineer Squad',
    kind: 'single',
    sectionIds: ['engineer'],
    points: 25,
    br: 3,
    baseTraining: train('r'),
    composition: {
      state: 'known',
      root: {
        nodeId: 'engineers',
        role: 'engineer-squad',
        quantity: 1,
        children: [
          { nodeId: 'squad', role: 'squad', quantity: 8 },
          { nodeId: 'transport', role: 'transport', profileLocalId: 'btr60pb', quantity: 1 },
        ],
      },
    },
    sourceRefs: [sovRef(11)],
    optionGroupIds: ['engineer-transport'],
  }),
  baseEntry({
    localId: 'ambulance',
    name: 'Ambulance',
    kind: 'single',
    sectionIds: ['logistics'],
    points: 20,
    br: 2,
    baseTraining: train('i'),
    composition: { state: 'known', root: { nodeId: 'ambulance', role: 'ambulance', profileLocalId: 'ural452', quantity: 1 } },
    sourceRefs: [sovRef(11)],
    optionGroupIds: ['ambulance-downgrade'],
    tags: ['restricted', 'medic'],
  }),
];

const optionGroups: OptionGroup[] = [
  t72PlatoonUpgrades,
  t72CompanyUpgrades,
  bmp1Upgrades,
  t62PlatoonUpgrades,
  bmp1MortarUpgrades,
  reconCommandTransport,
  engineerTransport,
  ambulanceDowngrade,
];

const profiles: ProfileIdentity[] = [
  profile('t72a', 'T-72A', 6),
  profile('t72b', 'T-72B', 6),
  profile('t72b1', 'T-72B1', 6),
  profile('t62a', 'T-62A', 7),
  profile('t62m', 'T-62M', 7),
  profile('bmp1', 'BMP-1', 2),
  profile('bmp1p', 'BMP-1P', 2),
  profile('bmp1k', 'BMP-1K', 1),
  profile('bmp2', 'BMP-2', 4),
  profile('brdm2', 'BRDM-2', 10),
  profile('zsu234', 'ZSU-23-4', 12),
  profile('pt76b', 'PT-76B', 10),
  profile('btr60pb', 'BTR-60PB', 11),
  profile('btr80', 'BTR-80', 11),
  profile('ural452', 'Ural-452', 11),
  profile('heavy-truck', 'Heavy Truck', 11),
  profile('gaz66', 'GAZ-66', 2),
  profile('mtlb', 'MTLB', 2),
];

/** The M01-facts contract-test catalog (Classic Cold War, Soviet Armoured Division V4.1). */
export const classicM01Catalog: CatalogShell = {
  manifest: {
    identity: {
      rulesetId: 'classic-coldwar',
      catalogId: CLASSIC_SAMPLE_CATALOG_ID,
      catalogRevision: CLASSIC_SAMPLE_CATALOG_REVISION,
    },
    schemaVersion: CATALOG_SCHEMA_VERSION,
    rulesRevision: 'cw-draft6+sov-v4.1',
    baseEdition: 'Unofficial Battlegroup: Cold War Draft 6 + Soviet Armoured Division V4.1',
    sources: [
      {
        documentId: SOV,
        title: 'SOVIET ARMOURED DIVISION BATTLEGROUP V4.1',
        filePath: 'references/SOVIET ARMOURED DIVISION BATTLEGROUP V4.1.pdf',
        sha256: 'a53afd517f693f7a9d5f2424a9a181c2ae5987ccb265fa6eb0e1ab238a83e03b',
        pdfPageCount: 21,
        printedPageOffset: 0,
        authority: 'unofficial-community',
        reviewStatus: 'selected-pages-reviewed',
        errataApplication: 'none-declared',
      },
      {
        documentId: CW,
        title: 'Unofficial Battlegroup CW Rules — Draft 6',
        filePath: 'references/Unofficial Battlegroup CW Rules. - Draft 6pdf.pdf',
        sha256: '56595a4c83a35e6acf5242800361285381a16b0f44846331c7c26f2c5bda0b1b',
        pdfPageCount: 58,
        printedPageOffset: 0,
        authority: 'unofficial-community',
        reviewStatus: 'selected-pages-reviewed',
        errataApplication: 'none-declared',
      },
      {
        documentId: BASE,
        title: 'Battlegroup rulebook',
        filePath: 'references/battlegroup rulebook.pdf',
        sha256: '0d40ccd81747641ae7e930bed816d9987903e7f6dc3659e26945e67d9cee645f',
        pdfPageCount: 66,
        printedPageOffset: -1,
        authority: 'official',
        reviewStatus: 'selected-pages-reviewed',
        errataApplication: 'not-applicable',
      },
    ],
    errataSummary: {
      declaredErrataIds: [],
      applicationStatus: 'none-declared',
    },
    coverage: {
      status: 'sample-scope',
      note: 'M01 contract-test catalog: entries needed by the 23 manual calibration accounts only; not a publishable catalog.',
    },
  },
  armyLists: [
    {
      armyListId: CLASSIC_SAMPLE_ARMY_LIST_ID,
      rulesetId: 'classic-coldwar',
      nation: 'Soviet',
      name: 'Soviet Armoured Division (V4.1)',
      structure: { sections },
      note: 'Contract-test section tree; full list coverage is M04 data work.',
    },
  ],
  profiles,
  entries,
  optionGroups,
};

export const CLASSIC_SAMPLE_OPTION_IDS = {
  t72PlatoonToB: 'platoon-to-b',
  t72Kmt: 'kmt',
  t72CompanyB1PerTank: 'b1-per-tank',
  allBmp1ToP: 'all-bmp1-to-p',
  t62PlatoonToM: 'platoon-to-m',
  t62OneBastion: 'one-bastion',
  t62Regular: 'regular',
  mortarToMtlb: 'mortar-to-mtlb',
  reconCommandPt76b: 'transport-pt76b',
  engineerBtr80: 'btr80-swap',
  ambulanceHeavyTruck: 'heavy-truck',
} as const;

export type ClassicSampleOption = Option;
