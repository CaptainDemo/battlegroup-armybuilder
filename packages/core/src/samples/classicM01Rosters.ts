import type { OptionChoice, RosterDocument, RosterSelection } from '../contracts/roster';
import { ROSTER_FORMAT_VERSION } from '../contracts/versioning';
import {
  CLASSIC_SAMPLE_ARMY_LIST_ID,
  CLASSIC_SAMPLE_CATALOG_ID,
  CLASSIC_SAMPLE_CATALOG_REVISION,
  classicM01Catalog,
} from './classicM01Catalog';

/**
 * CONTRACT-TEST ROSTERS shaped after the M01 manual calibration accounts
 * (docs/data/classic-calibration.md). They are structural documents only:
 * accounts that intentionally break *game* rules (B02, B03, S02, F03, F04,
 * F05, F06, F07) are deliberately still structurally valid — M03 must not
 * smuggle rule checking into structural validation.
 */

function entryRef(localId: string): RosterSelection['entryReference'] {
  return {
    rulesetId: 'classic-coldwar',
    catalogId: CLASSIC_SAMPLE_CATALOG_ID,
    catalogRevision: CLASSIC_SAMPLE_CATALOG_REVISION,
    localId,
  };
}

function top(selectionId: string, localId: string, sectionId: string, optionChoices: OptionChoice[] = []): RosterSelection {
  return { selectionId, entryReference: entryRef(localId), parentSelectionId: null, sectionId, optionChoices };
}

function under(
  selectionId: string,
  localId: string,
  parentSelectionId: string,
  targetMemberPath?: string[],
  optionChoices: OptionChoice[] = [],
): RosterSelection {
  return {
    selectionId,
    entryReference: entryRef(localId),
    parentSelectionId,
    ...(targetMemberPath === undefined ? {} : { targetMemberPath }),
    optionChoices,
  };
}

function memberPath(...segments: string[]): OptionChoice['targets'][number] {
  return { kind: 'member-path', nodePath: segments };
}

/** Owner-addressed member of a purchased attachment (R2): stable regardless of ordering. */
function attachmentMember(ownerSelectionId: string, ...segments: string[]): OptionChoice['targets'][number] {
  return { kind: 'attachment-member', ownerSelectionId, nodePath: segments };
}

const whole = (): OptionChoice['targets'][number] => ({ kind: 'whole-selection' });

function choice(optionGroupLocalId: string, optionLocalId: string, targets: OptionChoice['targets']): OptionChoice {
  return { optionGroupLocalId, optionLocalId, targets };
}

function makeRoster(
  rosterId: string,
  selections: RosterSelection[],
  settings?: Partial<RosterDocument['settings']>,
): RosterDocument {
  return {
    formatVersion: ROSTER_FORMAT_VERSION,
    rosterId,
    name: rosterId,
    revision: `${rosterId}-rev-1`,
    catalogRef: {
      rulesetId: 'classic-coldwar',
      catalogId: CLASSIC_SAMPLE_CATALOG_ID,
      catalogRevision: CLASSIC_SAMPLE_CATALOG_REVISION,
    },
    armyListId: CLASSIC_SAMPLE_ARMY_LIST_ID,
    settings: {
      budgetPoints: 500,
      gameSizeId: 'platoon',
      optionalRules: [],
      ...settings,
    },
    selections,
  };
}

/* ------------------------------------------------------------------ */
/* B-series: main sample and budget/source variants                     */
/* ------------------------------------------------------------------ */

/** B01: the 398 Points / 23 BR main sample — structurally valid. */
export function b01Roster(): RosterDocument {
  return makeRoster('b01', [
    top('hq', 'fhq', 'hq'),
    top('tank', 't72-platoon', 'tank'),
    top('inf', 'bmp1-platoon', 'motor-rifle'),
    under('medic', 'bmp1-platoon-medic', 'inf'),
    under('fs', 'bmp1-platoon-fire-support', 'inf'),
    under('agl', 'bmp1-platoon-agl', 'inf'),
    top('recon', 'brdm2-recon', 'reconnaissance'),
    top('aa', 'zsu23-4', 'specialist'),
    top('request', 'artillery-request-priority3', 'artillery'),
  ]);
}

/** B02: duplicate Medic — C02 *game* violation, still a structurally valid document. */
export function b02Roster(): RosterDocument {
  return makeRoster('b02', [...b01Roster().selections, under('medic2', 'bmp1-platoon-medic', 'inf')]);
}

/** B03: identical purchases, budget 397 — C01 violation is not a structural property. */
export function b03Roster(): RosterDocument {
  return { ...b01Roster(), rosterId: 'b03', settings: { budgetPoints: 397, gameSizeId: 'platoon', optionalRules: [] } };
}

/** B04: request without its HQ producer — C09 violation is not a structural property. */
export function b04Roster(): RosterDocument {
  return makeRoster(
    'b04',
    b01Roster().selections.filter((selection) => selection.selectionId !== 'hq'),
  );
}

/* ------------------------------------------------------------------ */
/* L-series: local calibration shapes                                  */
/* ------------------------------------------------------------------ */

/** L01: whole-platoon upgrade once + single-member KMT per-target. */
export function l01Roster(): RosterDocument {
  return makeRoster('l01', [
    top('tank', 't72-platoon', 'tank', [
      choice('t72-platoon-upgrades', 'platoon-to-b', [whole()]),
      choice('t72-platoon-upgrades', 'kmt', [memberPath('ordinary-2')]),
    ]),
  ]);
}

/** L02: T-62 upgrades incl. training change and a prerequisite Bastion on one tank. */
export function l02Roster(): RosterDocument {
  return makeRoster('l02', [
    top('tank', 't62-platoon', 'tank', [
      choice('t62-platoon-upgrades', 'platoon-to-m', [whole()]),
      choice('t62-platoon-upgrades', 'one-bastion', [memberPath('ordinary-1')]),
      choice('t62-platoon-upgrades', 'regular', [whole()]),
    ]),
  ]);
}

/** L03: independent BMP-2 platoon context (45-point fire support, not the 40 company variant). */
export function l03Roster(): RosterDocument {
  return makeRoster('l03', [
    top('inf', 'bmp2-platoon', 'motor-rifle'),
    under('fs', 'bmp2-platoon-fire-support', 'inf'),
  ]);
}

/** L04: company fire support attached to one included platoon — no re-charging of platoon base prices. */
export function l04Roster(): RosterDocument {
  return makeRoster('l04', [
    top('company', 'bmp2-company', 'motor-rifle'),
    under('fs', 'bmp2-company-platoon-fire-support', 'company', ['platoon-1']),
  ]);
}

/** L05: same-named attachment under two different included platoons. */
export function l05Roster(): RosterDocument {
  return makeRoster('l05', [
    top('company', 'bmp1-company', 'motor-rifle'),
    under('medic1', 'bmp1-company-platoon-medic', 'company', ['platoon-1']),
    under('medic2', 'bmp1-company-platoon-medic', 'company', ['platoon-2']),
  ]);
}

/** L06: per-target all-BMP upgrade with the three basic transports (no attachments bought). */
export function l06Roster(): RosterDocument {
  return makeRoster('l06', [
    top('inf', 'bmp1-platoon', 'motor-rifle', [
      choice('bmp1-upgrades', 'all-bmp1-to-p', [
        memberPath('command-squad', 'transport'),
        memberPath('assistant-squad', 'transport'),
        memberPath('rifle-squad', 'transport'),
      ]),
    ]),
  ]);
}

/** L07: free BTR-80 replacement (known zero delta). */
export function l07Roster(): RosterDocument {
  return makeRoster('l07', [
    top('eng', 'combat-engineers', 'engineer', [choice('engineer-transport', 'btr80-swap', [whole()])]),
  ]);
}

/** L08: negative-delta downgrade (-5 Points / -1 BR). */
export function l08Roster(): RosterDocument {
  return makeRoster('l08', [
    top('ambulance', 'ambulance', 'logistics', [choice('ambulance-downgrade', 'heavy-truck', [whole()])]),
  ]);
}

/** L09: non-entity purchase with a price and zero BR. */
export function l09Roster(): RosterDocument {
  return makeRoster('l09', [top('barrage', 'timed122', 'artillery')]);
}

/** L10: per-tank B1 upgrade of all ten company tanks (A01 composition, A09 BR unchanged). */
export function l10Roster(): RosterDocument {
  return makeRoster('l10', [
    top('company', 't72-company', 'tank', [
      choice('t72-company-upgrades', 'b1-per-tank', [
        memberPath('company-command'),
        memberPath('platoon-1', 'platoon-command'),
        memberPath('platoon-1', 'ordinary-1'),
        memberPath('platoon-1', 'ordinary-2'),
        memberPath('platoon-2', 'platoon-command'),
        memberPath('platoon-2', 'ordinary-1'),
        memberPath('platoon-2', 'ordinary-2'),
        memberPath('platoon-3', 'platoon-command'),
        memberPath('platoon-3', 'ordinary-1'),
        memberPath('platoon-3', 'ordinary-2'),
      ]),
    ]),
  ]);
}

/* ------------------------------------------------------------------ */
/* S-series: two independent support pools                             */
/* ------------------------------------------------------------------ */

function s01Selections(): RosterSelection[] {
  return [
    top('inf', 'bmp1-platoon', 'motor-rifle'),
    under('medic', 'bmp1-platoon-medic', 'inf'),
    under('fs', 'bmp1-platoon-fire-support', 'inf'),
    under('agl', 'bmp1-platoon-agl', 'inf'),
    under('mortar', 'bmp1-platoon-mortar', 'inf'),
    top('recon1', 'brdm2-recon', 'reconnaissance'),
    top('recon2', 'brdm2-recon', 'reconnaissance'),
    top('recon3', 'brdm2-recon', 'reconnaissance'),
    top('recon4', 'brdm2-recon', 'reconnaissance'),
  ];
}

/** S01: 4/4 local Platoon Support Options AND 4/4 army Reconnaissance choices at once (A02). */
export function s01Roster(): RosterDocument {
  return makeRoster('s01', s01Selections());
}

/** S02: fifth recon choice — C07 game violation, still structurally valid. */
export function s02Roster(): RosterDocument {
  return makeRoster('s02', [...s01Selections(), top('recon5', 'brdm2-recon', 'reconnaissance')]);
}

/* ------------------------------------------------------------------ */
/* F-series: clarified-rule boundary shapes                            */
/* ------------------------------------------------------------------ */

/**
 * F01: all-BMP upgrade with 12 explicit targets — 10 company BMPs as static
 * member paths plus the transports of two purchased attachments addressed by
 * their owning selection id (A03: attachments join the selector's target
 * set; each target once; ordering-independent per R2).
 */
export function f01Roster(): RosterDocument {
  return makeRoster('f01', [
    top('company', 'bmp1-company', 'motor-rifle', [
      choice('bmp1-upgrades', 'all-bmp1-to-p', [
        memberPath('command-squad', 'transport'),
        memberPath('platoon-1', 'squad-1', 'transport'),
        memberPath('platoon-1', 'squad-2', 'transport'),
        memberPath('platoon-1', 'squad-3', 'transport'),
        memberPath('platoon-2', 'squad-1', 'transport'),
        memberPath('platoon-2', 'squad-2', 'transport'),
        memberPath('platoon-2', 'squad-3', 'transport'),
        memberPath('platoon-3', 'squad-1', 'transport'),
        memberPath('platoon-3', 'squad-2', 'transport'),
        memberPath('platoon-3', 'squad-3', 'transport'),
        attachmentMember('fs', 'transport'),
        attachmentMember('agl', 'transport'),
      ]),
    ]),
    under('fs', 'bmp1-company-platoon-fire-support', 'company', ['platoon-1']),
    under('agl', 'bmp1-company-platoon-agl', 'company', ['platoon-2']),
  ]);
}

/**
 * R2/R6 contract example: the same Fire Support Section purchased twice
 * under the same platoon. Duplicate purchases are not rejected (that is a
 * game rule); both attachments and their transports stay individually
 * addressable through owner ids, and the all-upgrade covers both.
 */
export function duplicateFireSupportAllRoster(): RosterDocument {
  return makeRoster('duplicate-fs-all', [
    top('company', 'bmp1-company', 'motor-rifle', [
      choice('bmp1-upgrades', 'all-bmp1-to-p', [
        memberPath('command-squad', 'transport'),
        memberPath('platoon-1', 'squad-1', 'transport'),
        memberPath('platoon-1', 'squad-2', 'transport'),
        memberPath('platoon-1', 'squad-3', 'transport'),
        memberPath('platoon-2', 'squad-1', 'transport'),
        memberPath('platoon-2', 'squad-2', 'transport'),
        memberPath('platoon-2', 'squad-3', 'transport'),
        memberPath('platoon-3', 'squad-1', 'transport'),
        memberPath('platoon-3', 'squad-2', 'transport'),
        memberPath('platoon-3', 'squad-3', 'transport'),
        attachmentMember('fs1', 'transport'),
        attachmentMember('fs2', 'transport'),
      ]),
    ]),
    under('fs1', 'bmp1-company-platoon-fire-support', 'company', ['platoon-1']),
    under('fs2', 'bmp1-company-platoon-fire-support', 'company', ['platoon-1']),
  ]);
}

/** F02: first + second Fire Support each consume one platoon-support slot of platoon-1 (A04). */
export function f02Roster(): RosterDocument {
  return makeRoster('f02', [
    top('company', 'bmp2-company', 'motor-rifle'),
    under('fs1', 'bmp2-company-platoon-fire-support', 'company', ['platoon-1']),
    under('fs2', 'bmp2-company-platoon-fire-support-second', 'company', ['platoon-1']),
    under('medic', 'bmp2-company-platoon-medic', 'company', ['platoon-1']),
    under('mortar', 'bmp2-company-platoon-mortar', 'company', ['platoon-1']),
  ]);
}

/** F03: fifth platoon-support pick — C03 game violation, still structurally valid. */
export function f03Roster(): RosterDocument {
  return makeRoster('f03', [
    ...f02Roster().selections,
    under('agl', 'bmp2-company-platoon-agl', 'company', ['platoon-1']),
  ]);
}

function pt76Selection(): RosterSelection {
  return top('pt76', 'pt76b-recon', 'reconnaissance');
}

/** F04: standalone PT-76 next to a T-72 platoon — C16 game violation, structurally valid. */
export function f04Roster(): RosterDocument {
  return makeRoster('f04', [...b01Roster().selections, pt76Selection()]);
}

/** F05: PT-76 next to a T-72 company — C16 game violation, structurally valid. */
export function f05Roster(): RosterDocument {
  return makeRoster('f05', [top('company', 't72-company', 'tank'), pt76Selection()]);
}

/** F06: PT-76 next to an additional single T-72A — C16 game violation, structurally valid. */
export function f06Roster(): RosterDocument {
  return makeRoster('f06', [top('tank', 'additional-t72a', 'tank'), pt76Selection()]);
}

/** F07: PT-76 through the nested Recon Command transport choice — C16 trigger is preserved structurally. */
export function f07Roster(): RosterDocument {
  return makeRoster('f07', [
    top('command', 'recon-command', 'reconnaissance', [
      choice('recon-command-transport', 'transport-pt76b', [whole()]),
    ]),
    top('tank', 'additional-t72a', 'tank'),
  ]);
}

export { classicM01Catalog };
