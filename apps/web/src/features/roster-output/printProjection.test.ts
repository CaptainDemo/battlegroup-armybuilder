import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  createRosterDocument,
  executeRosterCommands,
  evaluateRoster,
  knownValue,
  limited,
  type CatalogShell,
  type Evaluation,
  type RosterCommand,
  type RosterDocument,
  type RosterSelection,
} from '@battlegroup/core';
import {
  classicCatalogReleaseSchema,
  evaluateClassicRoster,
} from '@battlegroup/classic-coldwar';
import rawRelease from '../../../../../packages/catalogs/classic-coldwar/public/catalogs/classic-coldwar/soviet-armoured-division/1-1-0/catalog.json';
import rawOldRelease from '../../../../../packages/catalogs/classic-coldwar/public/catalogs/classic-coldwar/soviet-armoured-division/1-0-0/catalog.json';
import { PrintPreview } from './PrintPreview';
import {
  projectPrintableRoster,
  type PrintPurchaseView,
} from './printProjection';

/**
 * M11 print-projection checks. The real-catalog cases reuse the published
 * Soviet V4.1 release and the same evaluation pipeline the editor runs, so the
 * assertions cover genuine parent/child purchases, fixed sub-platoons with
 * member-anchored attachments, per-target option billing and issue location.
 * The synthetic catalog covers value states the published catalog does not
 * currently contain (unknown cost, known zero, not-applicable) without
 * touching published data.
 */

const release = classicCatalogReleaseSchema.parse(rawRelease);
const identity = release.catalog.manifest.identity;

function add(selection: RosterSelection): { kind: 'add'; selection: RosterSelection } {
  return { kind: 'add', selection };
}

function baseDocument(budgetPoints: number): RosterDocument {
  const created = createRosterDocument(
    {
      rosterId: 'print-test-roster',
      revision: 'rev-1',
      name: 'Print projection test',
      catalogRef: identity,
      armyListId: release.catalog.armyLists[0]!.armyListId,
      settings: { budgetPoints, gameSizeId: 'battalion', optionalRules: [] },
    },
    release,
  );
  if (!created.ok) throw new Error(created.problems.map((problem) => problem.message).join('; '));
  return created.document;
}

interface Roster {
  document: RosterDocument;
  evaluation: ReturnType<typeof evaluateClassicRoster>;
}

/** Company with a fixed-platoon medic, a BMP-1 platoon with per-target upgrades
 * and a duplicated platoon medic that violates the once-per-platoon rule. */
function buildRealisticRoster(): Roster {
  const ref = (localId: string) => ({ ...identity, localId });
  const commands = [
    add({ selectionId: 's-company', entryReference: ref('t72-company'), parentSelectionId: null, sectionId: 'tank', optionChoices: [] }),
    add({ selectionId: 's-bmp-company', entryReference: ref('bmp1-company'), parentSelectionId: null, sectionId: 'motor-rifle', optionChoices: [] }),
    add({
      selectionId: 's-company-medic',
      entryReference: ref('bmp1-company-medic'),
      parentSelectionId: 's-bmp-company',
      targetMemberPath: ['platoon-2'],
      optionChoices: [],
    }),
    add({ selectionId: 's-platoon', entryReference: ref('bmp1-platoon'), parentSelectionId: null, sectionId: 'motor-rifle', optionChoices: [] }),
    add({ selectionId: 's-plt-medic-1', entryReference: ref('bmp1-platoon-medic'), parentSelectionId: 's-platoon', optionChoices: [] }),
    add({ selectionId: 's-plt-medic-2', entryReference: ref('bmp1-platoon-medic'), parentSelectionId: 's-platoon', optionChoices: [] }),
    {
      kind: 'options',
      selectionId: 's-platoon',
      choices: [
        {
          optionGroupLocalId: 'bmp1-platoon-infantry',
          optionLocalId: 'bg-15-ugl',
          targets: [
            { kind: 'member-path', nodePath: ['command'] },
            { kind: 'member-path', nodePath: ['rifle'] },
          ],
        },
      ],
    },
  ] satisfies RosterCommand[];
  const result = executeRosterCommands(baseDocument(100), commands, release, 'rev-2');
  if (!result.ok) throw new Error(result.problems.map((problem) => problem.message).join('; '));
  return { document: result.document, evaluation: evaluateClassicRoster(result.document, release) };
}

function allPurchases(views: readonly PrintPurchaseView[]): PrintPurchaseView[] {
  return views.flatMap((view) => [
    view,
    ...allPurchases(view.attachments),
    ...allPurchases(view.platoons.flatMap((platoon) => platoon.attachments)),
    ...allPurchases(view.otherAnchored.map((item) => item.purchase)),
  ]);
}

describe('print projection over the published Classic catalog', () => {
  it('renders the roster from one evaluation snapshot with matching totals', () => {
    const { document, evaluation } = buildRealisticRoster();
    const projection = projectPrintableRoster({ document, release, evaluation });
    expect(projection.status).toBe('ready');
    if (projection.status !== 'ready') return;
    const { roster } = projection;
    expect(roster.name).toBe('Print projection test');
    expect(roster.totals.points.knownSubtotal).toBe(evaluation.totals.points.knownSubtotal);
    expect(roster.totals.points.complete).toBe(evaluation.totals.points.complete);
    expect(roster.totals.br.knownSubtotal).toBe(evaluation.totals.br.knownSubtotal);
    expect(roster.versions.catalogRevision).toBe(identity.catalogRevision);
    expect(roster.versions.rulesRevision).toBe(evaluation.identity.versions.rulesRevision);
    expect(roster.versions.editRevision).toBe(document.revision);
    // Subtotals of all printed purchases reproduce the snapshot total exactly
    // once — fixed sub-platoons add no second charge line.
    const printed = allPurchases(roster.sections.flatMap((section) => section.purchases));
    expect(printed.reduce((sum, view) => sum + view.subtotal.points.knownSubtotal, 0)).toBe(
      evaluation.totals.points.knownSubtotal,
    );
    expect(new Set(printed.map((view) => view.selectionId))).toEqual(
      new Set(document.selections.map((item) => item.selectionId)),
    );
  });

  it('nests fixed sub-platoons and member-anchored attachments by stable identity', () => {
    const { document, evaluation } = buildRealisticRoster();
    const projection = projectPrintableRoster({ document, release, evaluation });
    if (projection.status !== 'ready') throw new Error('projection should be ready');
    const company = projection.roster.sections
      .flatMap((section) => section.purchases)
      .find((view) => view.selectionId === 's-bmp-company')!;
    expect(company.platoons.map((platoon) => platoon.nodeId)).toEqual(['platoon-1', 'platoon-2', 'platoon-3']);
    // The medic anchored at platoon-2 prints under that platoon, not platoon-1.
    const anchored = company.platoons.flatMap((platoon) =>
      platoon.attachments.map((attachment) => [platoon.nodeId, attachment.selectionId] as const),
    );
    expect(anchored).toEqual([['platoon-2', 's-company-medic']]);
    const medic = company.platoons[1]!.attachments[0]!;
    expect(medic.role).toBe('attachment');
    expect(medic.baseKind).toBe('attachment-cost');
    expect(medic.baseCost.points).toEqual({ state: 'known', value: 8 });
    // Fixed platoons are part of the company price: the company itself keeps a
    // single base line and the platoon blocks carry no separate charge lines.
    expect(company.charges.filter((line) => line.kind === 'base-cost')).toHaveLength(1);
    expect(company.charges.filter((line) => line.kind !== 'option-delta')).toHaveLength(1);
    // The duplicated platoon medics print as direct attachments of the platoon.
    const platoon = projection.roster.sections
      .flatMap((section) => section.purchases)
      .find((view) => view.selectionId === 's-platoon')!;
    expect(platoon.attachments.map((view) => view.selectionId)).toEqual(['s-plt-medic-1', 's-plt-medic-2']);
  });

  it('prints per-target option charges with target labels and omits unselected options', () => {
    const { document, evaluation } = buildRealisticRoster();
    const projection = projectPrintableRoster({ document, release, evaluation });
    if (projection.status !== 'ready') throw new Error('projection should be ready');
    const platoon = projection.roster.sections
      .flatMap((section) => section.purchases)
      .find((view) => view.selectionId === 's-platoon')!;
    expect(platoon.options).toHaveLength(1);
    const option = platoon.options[0]!;
    expect(option.optionName).toBe('BG-15 UGL per squad');
    expect(option.chargeMode).toBe('per-target');
    expect(option.targetLabels).toEqual(['command', 'rifle']);
    expect(option.chargedUnits).toBe(2);
    expect(option.points).toEqual({ knownSubtotal: 10, complete: true });
    const optionLines = platoon.charges.filter((line) => line.kind === 'option-delta');
    expect(optionLines).toHaveLength(2);
    expect(optionLines.every((line) => line.optionName === 'BG-15 UGL per squad')).toBe(true);
    // An option nobody selected must not appear as equipment or a charge.
    expect(JSON.stringify(platoon)).not.toContain('RPG-18');
  });

  it('keeps confirmed violations and their purchase location printable', () => {
    const { document, evaluation } = buildRealisticRoster();
    expect(evaluation.legality).toBe('violations-confirmed');
    const projection = projectPrintableRoster({ document, release, evaluation });
    if (projection.status !== 'ready') throw new Error('projection should be ready');
    expect(projection.roster.legality).toBe('violations-confirmed');
    const duplicate = projection.roster.issues.find((issue) => issue.ruleId === 'C02');
    expect(duplicate).toBeDefined();
    expect(duplicate!.purchaseHeading).toContain('Combat Medic');
    const budget = projection.roster.issues.find((issue) => issue.ruleId === 'C01');
    expect(budget).toBeDefined();
    expect(budget!.actual).toBe(evaluation.totals.points.knownSubtotal);
    expect(budget!.limit).toBe(100);
    expect(budget!.purchaseHeading).toBeNull();
    // The offending duplicate itself carries an inline marker count.
    const printed = allPurchases(projection.roster.sections.flatMap((section) => section.purchases));
    expect(printed.find((view) => view.selectionId === 's-plt-medic-2')!.issueCount).toBeGreaterThan(0);
    // Coverage gaps stay distinguishable from confirmed violations.
    expect(projection.roster.coverage.some((check) => check.status === 'not-implemented')).toBe(true);
  });

  it('rejects mismatched or out-of-date evaluation snapshots', () => {
    const { document, evaluation } = buildRealisticRoster();
    const editedRevision = projectPrintableRoster({
      document: { ...document, revision: 'rev-3' },
      release,
      evaluation,
    });
    expect(editedRevision).toMatchObject({ status: 'stale', reason: 'edit-revision' });

    const otherRoster = projectPrintableRoster({
      document: { ...document, rosterId: 'different-roster' },
      release,
      evaluation,
    });
    expect(otherRoster).toMatchObject({ status: 'stale', reason: 'roster-id' });

    const otherRelease = structuredClone(release);
    otherRelease.catalog.manifest.identity.catalogRevision = '9.9.9';
    const wrongRelease = projectPrintableRoster({ document, release: otherRelease, evaluation });
    expect(wrongRelease).toMatchObject({ status: 'stale', reason: 'release-catalog' });

    const otherCatalog = structuredClone(release);
    otherCatalog.catalog.manifest.identity.catalogRevision = '9.9.9';
    const foreignEvaluation = evaluateClassicRoster(document, otherCatalog);
    const wrongEvaluation = projectPrintableRoster({ document, release, evaluation: foreignEvaluation });
    expect(wrongEvaluation).toMatchObject({ status: 'stale', reason: 'document-catalog' });
  });
});

/* ------------------- a2 review regressions (real catalogs) ------------------- */

/** One top-level purchase against an arbitrary exact catalog release. */
function singlePurchaseRoster(raw: unknown, entryId: string) {
  const release = classicCatalogReleaseSchema.parse(raw);
  const entry = release.catalog.entries.find((e) => e.localId === entryId)!;
  const created = createRosterDocument(
    {
      rosterId: 'print-review-roster',
      revision: 'rev-1',
      name: 'Review roster',
      catalogRef: release.catalog.manifest.identity,
      armyListId: release.catalog.armyLists[0]!.armyListId,
      settings: { budgetPoints: 5000, gameSizeId: 'battalion', optionalRules: ['review-optional-rule'] },
    },
    release,
  );
  if (!created.ok) throw new Error(created.problems.map((problem) => problem.message).join('; '));
  const added = executeRosterCommands(
    created.document,
    [
      {
        kind: 'add',
        selection: {
          selectionId: 'purchase',
          entryReference: { ...release.catalog.manifest.identity, localId: entryId },
          parentSelectionId: null,
          sectionId: entry.sectionIds[0]!,
          optionChoices: [],
        },
      },
    ],
    release,
    'rev-2',
  );
  if (!added.ok) throw new Error(added.problems.map((problem) => problem.message).join('; '));
  return { document: added.document, release, evaluation: evaluateClassicRoster(added.document, release) };
}

describe('print projection review regressions', () => {
  it('prints each fixed composition member exactly once per purchase', () => {
    const snapshot = singlePurchaseRoster(rawRelease, 'bmp1-company');
    const projection = projectPrintableRoster(snapshot);
    if (projection.status !== 'ready') throw new Error('projection should be ready');
    const company = projection.roster.sections.flatMap((section) => section.purchases)[0]!;
    const rows = [...company.rows, ...company.platoons.flatMap((platoon) => platoon.rows)];
    // The exact 1.1.0 catalog has 1 command BMP-1 plus 9 platoon BMP-1s;
    // printing both the purchase rows and the platoon blocks must not
    // double them, and dropping members to dedupe would also fail here.
    expect(rows.filter((row) => row.label === 'BMP-1').reduce((sum, row) => sum + row.quantity, 0)).toBe(10);
    const keys = rows.map((row) => row.key);
    expect(new Set(keys).size).toBe(keys.length);
    // Fixed platoons print as titled blocks, not as wrapper rows.
    expect(company.rows.some((row) => row.label === 'platoon')).toBe(false);
    expect(company.platoons.map((platoon) => platoon.label)).toEqual(['platoon 1', 'platoon 2', 'platoon 3']);
    // Members and structure survive on both levels.
    expect(company.rows.some((row) => row.label === 'BMP-1' && row.quantity === 1)).toBe(true);
    for (const platoon of company.platoons)
      expect(platoon.rows.filter((row) => row.label === 'BMP-1')).toHaveLength(3);
  });

  it.each(['schemaVersion', 'rulesRevision', 'catalogRevision'] as const)(
    'rejects an evaluation whose stamped %s drifted from the release manifest',
    (field) => {
      const snapshot = singlePurchaseRoster(rawRelease, 'bmp1-company');
      const drifted: Evaluation = {
        ...snapshot.evaluation,
        identity: {
          ...snapshot.evaluation.identity,
          versions: { ...snapshot.evaluation.identity.versions, [field]: 'wrong-version' },
        },
      };
      expect(projectPrintableRoster({ ...snapshot, evaluation: drifted }).status).toBe('stale');
    },
  );

  it('prints the selected optional rules as settings text', () => {
    const snapshot = singlePurchaseRoster(rawRelease, 'bmp1-company');
    const projection = projectPrintableRoster(snapshot);
    if (projection.status !== 'ready') throw new Error('projection should be ready');
    expect(projection.roster.settings.optionalRules).toEqual(['review-optional-rule']);
    const html = renderToStaticMarkup(
      createElement(PrintPreview, {
        snapshot,
        onClose: () => {},
        onRefresh: () => {},
      }),
    );
    expect(html).toContain('Optional rules');
    expect(html).toContain('review-optional-rule');
  });

  it('retains the leaf composition root of the exact legacy 1.0.0 catalog', () => {
    const snapshot = singlePurchaseRoster(rawOldRelease, 'brdm2-recon');
    const projection = projectPrintableRoster(snapshot);
    if (projection.status !== 'ready') throw new Error('projection should be ready');
    const purchase = projection.roster.sections.flatMap((section) => section.purchases)[0]!;
    expect(purchase.rows.some((row) => row.label === 'BRDM-2' && row.quantity === 1)).toBe(true);
    expect(projection.roster.versions.catalogRevision).toBe('1.0.0');
    expect(projection.roster.versions.rulesRevision).toBe('cw-draft6+sov-v4.1');
  });
});

/* ------------------------- synthetic value states ------------------------- */

const syntheticCatalog: CatalogShell = {
  manifest: {
    identity: { rulesetId: 'classic-coldwar', catalogId: 'print-synth', catalogRevision: 's-1' },
    schemaVersion: 'catalog-shell/1',
    rulesRevision: 'synthetic-print-rules',
    baseEdition: 'Synthetic print fixture (not game data)',
    sources: [
      {
        documentId: 'SYN',
        title: 'Synthetic print fixture',
        authority: 'internal-transcription',
        reviewStatus: 'not-reviewed',
        errataApplication: 'not-applicable',
      },
    ],
    errataSummary: { declaredErrataIds: [], applicationStatus: 'not-applicable' },
    coverage: { status: 'sample-scope', note: 'synthetic values for print projection states' },
  },
  armyLists: [
    {
      armyListId: 'synth-list',
      rulesetId: 'classic-coldwar',
      nation: 'Synthetic',
      name: 'Synthetic print list',
      structure: { sections: [{ sectionId: 'core', name: 'Core', parentSectionId: null, directlyPurchasable: true }] },
    },
  ],
  profiles: [
    { localId: 'synth-tank', name: 'Synth Tank', sourceRefs: [{ documentId: 'SYN' }] },
  ],
  entries: [
    {
      localId: 'unknown-cost-unit',
      name: 'Unknown Cost Unit',
      kind: 'formation',
      armyListIds: ['synth-list'],
      sectionIds: ['core'],
      baseCost: { points: { state: 'unknown', reason: 'price not printed in the source' }, br: knownValue(3) },
      baseTraining: { state: 'known', value: 'r' },
      composition: {
        state: 'known',
        root: {
          nodeId: 'unit',
          role: 'formation',
          quantity: 1,
          children: [{ nodeId: 'tank-1', role: 'tank', profileLocalId: 'synth-tank', quantity: 2 }],
        },
      },
      optionGroupIds: ['synth-options'],
      sourceRefs: [{ documentId: 'SYN' }],
    },
    {
      localId: 'zero-br-unit',
      name: 'Zero BR Unit',
      kind: 'single',
      armyListIds: ['synth-list'],
      sectionIds: ['core'],
      baseCost: { points: knownValue(50), br: knownValue(0) },
      composition: { state: 'no-entities', reason: 'Off-table request with no deployed models.' },
      optionGroupIds: [],
      sourceRefs: [{ documentId: 'SYN' }],
    },
  ],
  optionGroups: [
    {
      localId: 'synth-options',
      name: 'Synth upgrades',
      scope: 'selection',
      selectionLimit: limited(2),
      options: [
        {
          localId: 'free-upgrade',
          name: 'Free upgrade (known zero)',
          target: { kind: 'whole-selection' },
          effects: [{ kind: 'tag-grant', tag: 'free' }],
          chargeMode: 'once',
          costDelta: { points: knownValue(0), br: knownValue(0) },
          ownLimit: limited(1),
          sourceRefs: [{ documentId: 'SYN' }],
        },
        {
          localId: 'na-br-upgrade',
          name: 'BR not applicable upgrade',
          target: { kind: 'member-slots', nodePaths: [['tank-1']] },
          effects: [{ kind: 'tag-grant', tag: 'na' }],
          chargeMode: 'once',
          costDelta: { points: knownValue(5), br: { state: 'not_applicable', reason: 'BR delta not listed' } },
          ownLimit: limited(1),
          sourceRefs: [{ documentId: 'SYN' }],
        },
      ],
    },
  ],
};

function syntheticRoster(): RosterDocument {
  return {
    formatVersion: 'roster/1',
    rosterId: 'synth-roster',
    revision: 'synth-rev-1',
    name: 'Synthetic states roster',
    catalogRef: syntheticCatalog.manifest.identity,
    armyListId: 'synth-list',
    settings: { budgetPoints: 500, gameSizeId: 'platoon', optionalRules: [] },
    selections: [
      {
        selectionId: 'u1',
        entryReference: { ...syntheticCatalog.manifest.identity, localId: 'unknown-cost-unit' },
        parentSelectionId: null,
        sectionId: 'core',
        optionChoices: [
          { optionGroupLocalId: 'synth-options', optionLocalId: 'free-upgrade', targets: [{ kind: 'whole-selection' }] },
          { optionGroupLocalId: 'synth-options', optionLocalId: 'na-br-upgrade', targets: [{ kind: 'member-path', nodePath: ['tank-1'] }] },
        ],
      },
      {
        selectionId: 'u2',
        entryReference: { ...syntheticCatalog.manifest.identity, localId: 'zero-br-unit' },
        parentSelectionId: null,
        sectionId: 'core',
        optionChoices: [],
      },
    ],
    notes: 'Long player notes for the print sheet — line one.\nLine two with <markup> that must stay text.',
  };
}

describe('print projection value states (synthetic catalog)', () => {
  it('separates unknown, known zero and not-applicable in totals and lines', () => {
    const document = syntheticRoster();
    const evaluation = evaluateRoster(document, syntheticCatalog);
    const projection = projectPrintableRoster({ document, release: { catalog: syntheticCatalog }, evaluation });
    expect(projection.status).toBe('ready');
    if (projection.status !== 'ready') return;
    const { roster } = projection;
    // points: 50 (known base) + 5 + 0 known, base of u1 unknown -> incomplete.
    expect(roster.totals.points).toEqual({ knownSubtotal: 55, complete: false });
    // br: 3 + 0 + 0 known, one not-applicable line -> incomplete, never zeroed.
    expect(roster.totals.br).toEqual({ knownSubtotal: 3, complete: false });
    expect(roster.budgetRemaining).toBeNull();
    const u1 = roster.sections[0]!.purchases.find((view) => view.selectionId === 'u1')!;
    expect(u1.baseCost.points.state).toBe('unknown');
    expect(u1.trainingLabel).toBe('Regular');
    expect(u1.rows[0]).toMatchObject({ label: 'Synth Tank', quantity: 2 });
    const free = u1.options.find((option) => option.optionLocalId === 'free-upgrade')!;
    expect(free.points).toEqual({ knownSubtotal: 0, complete: true });
    const na = u1.options.find((option) => option.optionLocalId === 'na-br-upgrade')!;
    expect(na.br.complete).toBe(false);
    expect(na.targetLabels).toEqual(['tank 1']);
    const u2 = roster.sections[0]!.purchases.find((view) => view.selectionId === 'u2')!;
    expect(u2.rows).toHaveLength(0);
    expect(u2.compositionNote).toBe('Off-table request with no deployed models.');
    expect(roster.notes).toContain('<markup>');
  });

  it('keeps rosters isolated by exact catalog revision', () => {
    const document = syntheticRoster();
    const revised = structuredClone(syntheticCatalog);
    revised.manifest.identity.catalogRevision = 's-2';
    const evaluation = evaluateRoster(document, revised);
    const projection = projectPrintableRoster({ document, release: { catalog: syntheticCatalog }, evaluation });
    expect(projection).toMatchObject({ status: 'stale', reason: 'document-catalog' });
  });
});
