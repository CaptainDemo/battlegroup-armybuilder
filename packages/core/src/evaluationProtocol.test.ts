import { describe, expect, it } from 'vitest';
import * as coreExports from './index';
import type {
  Availability,
  Evaluation,
  RulesetModule,
} from './contracts/evaluation';
import { manifestVersionIdentity } from './contracts/versioning';
import { classicM01Catalog } from './samples/classicM01Catalog';

/**
 * The evaluation/availability protocols are result shapes only. M03 must not
 * ship anything that looks like a usable pricing or legality engine, so this
 * file pins two things: (1) plain data can populate the protocol (proving it
 * is representable for M06/M07), and (2) the core public surface exports no
 * evaluate/calculate/price function.
 */

describe('protocol shapes are plain data', () => {
  it('a populated Evaluation object keeps totals completeness and coverage separate', () => {
    const evaluation: Evaluation = {
      identity: {
        rosterId: 'b01',
        inputRevision: 'b01-rev-1',
        catalog: classicM01Catalog.manifest.identity,
        versions: manifestVersionIdentity(classicM01Catalog.manifest),
      },
      composition: [],
      chargeLines: [
        {
          chargeLineId: 'line-1',
          attributionKey: 'hq/base',
          kind: 'base-cost',
          selectionId: 'hq',
          chargedUnits: 1,
          points: { state: 'known', value: 20 },
          br: { state: 'known', value: 3 },
          sourceRefs: [{ documentId: 'SOV', pdfPage: 1 }],
        },
      ],
      totals: {
        points: { knownSubtotal: 398, complete: true, incompleteChargeLineIds: [] },
        br: { knownSubtotal: 23, complete: true, incompleteChargeLineIds: [] },
      },
      resources: [
        {
          resourceKind: 'army-support-choice',
          scope: 'army',
          capacity: { state: 'known', value: 4 },
          consumed: 1,
          status: 'covered',
        },
      ],
      statistics: [
        { statId: 'officers', label: 'Officers', value: 1, status: 'covered' },
      ],
      issues: [],
      coverage: [
        { checkId: 'budget', status: 'covered' },
        { checkId: 'pt76-exclusion', status: 'not-implemented', note: 'M07 scope' },
      ],
      legality: 'undetermined',
    };
    // Manual expectations from M01 are NOT produced here; this object only
    // proves the protocol can carry them. B01 legality stays undetermined
    // until rule coverage exists (A08 note in the calibration fixture).
    expect(evaluation.totals.points.knownSubtotal).toBe(398);
    expect(evaluation.legality).toBe('undetermined');
    expect(evaluation.coverage[1]?.status).toBe('not-implemented');
  });

  it('inputRevision distinguishes two edit snapshots of the same rosterId (R5)', () => {
    // Same roster, same catalog, two consecutive edits: catalog revisions
    // cannot tell them apart; the edit input revision can. Producer stamps
    // the evaluated document's revision; consumers drop mismatches.
    const snapshot = (inputRevision: string): Evaluation['identity'] => ({
      rosterId: 'b01',
      inputRevision,
      catalog: classicM01Catalog.manifest.identity,
      versions: manifestVersionIdentity(classicM01Catalog.manifest),
    });
    const first = snapshot('b01-rev-1');
    const second = snapshot('b01-rev-2');
    expect(first.rosterId).toBe(second.rosterId);
    expect(first.versions).toEqual(second.versions);
    expect(first.inputRevision).not.toBe(second.inputRevision);
    expect(second.inputRevision).not.toBe(first.inputRevision);
  });

  it('availability distinguishes allowed, blocked and unknown with reasons', () => {
    const allowed: Availability = { status: 'allowed', reasons: [] };
    const blocked: Availability = {
      status: 'blocked',
      reasons: [{ code: 'C16', message: 'PT-76 excludes other tank formations' }],
    };
    const unknown: Availability = {
      status: 'unknown',
      reasons: [{ code: 'unverified-threshold', message: 'eligibility pending data verification' }],
    };
    expect([allowed.status, blocked.status, unknown.status]).toEqual(['allowed', 'blocked', 'unknown']);
  });

  it('the RulesetModule protocol is a usable type constraint with no core implementation', () => {
    // The interface compiles as a constraint; any implementation arrives with
    // M07. Nothing in core (or classic-coldwar yet) provides evaluate().
    const conforms = (module: RulesetModule): RulesetModule => module;
    expect(conforms).toBeTypeOf('function');
  });
});

describe('core exports no pseudo-engine', () => {
  it('the public surface exposes no evaluate/calculate/pricing entry point', () => {
    // Names that would announce a callable engine; schema/type names such as
    // optionChargeModeSchema (a charge-mode enum) are deliberately fine.
    const forbidden = /^(evaluate|calculate|price|total|legality|isLegal|validateGame)/i;
    for (const key of Object.keys(coreExports)) {
      expect(key, `export "${key}" looks like an engine entry point`).not.toMatch(forbidden);
    }
  });

  it('structural validators are exported and named as integrity checks', () => {
    expect(coreExports.validateCatalogRelations).toBeTypeOf('function');
    expect(coreExports.validateRosterRelations).toBeTypeOf('function');
  });
});
