import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import {
  createRosterDocument,
  executeRosterCommands,
  resolveChoiceTargets,
  type RosterDocument,
  type RosterCommand,
  type OptionChoice,
  type EvaluatedCompositionNode,
} from '@battlegroup/core';
import { classicCatalogReleaseSchema } from './releaseSchema';
import { evaluateClassicRoster, getClassicEntryAvailability } from './rules';

const release = classicCatalogReleaseSchema.parse(
  JSON.parse(
    readFileSync(
      'packages/catalogs/classic-coldwar/public/catalogs/classic-coldwar/soviet-armoured-division/1-1-0/catalog.json',
      'utf8',
    ),
  ),
);
let revision = 0;
function empty(): RosterDocument {
  const result = createRosterDocument(
    {
      rosterId: 'formations',
      name: 'Independent source account',
      revision: 'initial',
      catalogRef: release.catalog.manifest.identity,
      armyListId: 'soviet-armoured-division-v4_1',
      settings: {
        budgetPoints: 10000,
        gameSizeId: 'battalion',
        optionalRules: [],
      },
    },
    release,
  );
  if (!result.ok) throw new Error(JSON.stringify(result.problems));
  return result.document;
}
function edit(
  document: RosterDocument,
  command: RosterCommand,
): RosterDocument {
  const result = executeRosterCommands(
    document,
    [command],
    release,
    'edit-' + ++revision,
  );
  if (!result.ok) throw new Error(JSON.stringify(result.problems));
  return result.document;
}
function add(
  document: RosterDocument,
  entryId: string,
  id = entryId,
  parent?: string,
  path?: string[],
): RosterDocument {
  const entry = release.catalog.entries.find(
    (item) => item.localId === entryId,
  )!;
  return edit(document, {
    kind: 'add',
    selection: {
      selectionId: id,
      entryReference: { ...document.catalogRef, localId: entryId },
      parentSelectionId: parent ?? null,
      ...(!parent ? { sectionId: entry.sectionIds[0]! } : {}),
      ...(path ? { targetMemberPath: path } : {}),
      optionChoices: [],
    },
  });
}
function choose(
  document: RosterDocument,
  selectionId: string,
  optionId: string,
  paths?: string[][],
  groupId?: string,
): RosterDocument {
  const selection = document.selections.find(
    (item) => item.selectionId === selectionId,
  )!;
  const entry = release.catalog.entries.find(
    (item) => item.localId === selection.entryReference.localId,
  )!;
  const group = release.catalog.optionGroups.find(
    (group) =>
      entry.optionGroupIds.includes(group.localId) &&
      (!groupId || group.localId === groupId) &&
      group.options.some((option) => option.localId === optionId),
  )!;
  const option = group.options.find((item) => item.localId === optionId)!;
  const choice: OptionChoice = {
    optionGroupLocalId: group.localId,
    optionLocalId: optionId,
    targets:
      option.target.kind === 'whole-selection'
        ? [{ kind: 'whole-selection' }]
        : option.target.kind === 'member-slots'
          ? (paths ?? [option.target.nodePaths[0]!]).map((nodePath) => ({
              kind: 'member-path',
              nodePath,
            }))
          : [],
  };
  if (option.target.kind === 'scope-selector')
    choice.targets = resolveChoiceTargets(
      document,
      release.catalog,
      selectionId,
      option,
      choice,
    );
  return edit(document, {
    kind: 'options',
    selectionId,
    choices: [
      ...selection.optionChoices.filter(
        (item) =>
          item.optionGroupLocalId !== group.localId ||
          item.optionLocalId !== optionId,
      ),
      choice,
    ],
  });
}
const evaluate = (document: RosterDocument) =>
  evaluateClassicRoster(document, release);
function models(
  document: RosterDocument,
): Array<{ profile: string; quantity: number }> {
  const result: Array<{ profile: string; quantity: number }> = [];
  const visit = (node: EvaluatedCompositionNode, quantity = 1): void => {
    const total = quantity * node.quantity;
    if (node.profileLocalId)
      result.push({ profile: node.profileLocalId, quantity: total });
    for (const child of node.children ?? []) visit(child, total);
  };
  for (const composition of evaluate(document).composition)
    visit(composition.node);
  return result;
}
const count = (document: RosterDocument, profile: string) =>
  models(document)
    .filter((item) => item.profile === profile)
    .reduce((sum, item) => sum + item.quantity, 0);

describe('Soviet V4.1 independently transcribed formation accounts', () => {
  it.each([
    ['toc', 40, 3],
    ['forward-signals', 30, 1],
    ['wire-team', 10, 0],
    ['artillery-command', 20, 1],
    ['ground-surveillance-radar', 20, 0],
    ['forward-air-control', 25, 1],
    ['bmp1-company', 275, 25],
    ['bmp2-company', 380, 35],
    ['bmp1-squad', 30, 2],
    ['bmp2-squad', 45, 3],
    ['t80-company', 650, 25],
    ['t80-platoon', 195, 7],
    ['t72-company', 600, 25],
    ['t64-company', 500, 25],
    ['t64-platoon', 150, 7],
    ['t62-company', 240, 20],
    ['t62-platoon', 75, 6],
    ['heavy-mortar-battery', 75, 2],
    ['2s1-battery', 140, 6],
    ['offtable-vasilek', 95, 0],
    ['offtable-152', 225, 0],
    ['defence-mg-dugout', 35, 1],
    ['defence-at-ditch', 20, 0],
    ['defence-intermediate-sam-shot', 30, 0],
    ['sniper', 10, 1],
    ['pt76', 17, 1],
    ['recon-command', 22, 2],
    ['spetsnaz', 30, 3],
    ['scout-helicopter', 30, 3],
    ['pmp-bridge', 35, 3],
    ['gsp-ferry', 25, 3],
    ['pmm2-ferry', 28, 3],
    ['flamethrower-detachment', 20, 2],
    ['forward-aid-post', 20, 5],
    ['tunguska', 50, 2],
    ['specialist-manpads', 45, 2],
    ['sprut-at-gun', 65, 3],
    ['9p149', 30, 1],
    ['artillery-request-priority1', 20, 0],
    ['timed203', 55, 0],
    ['timed-hind-d', 70, 0],
    ['timed-hind-f', 120, 0],
    ['cap', 20, 0],
  ] as Array<[string, number, number]>)(
    '%s uses its printed base price and BR',
    (id, points, br) => {
      const result = evaluate(add(empty(), id));
      expect(result.totals.points).toMatchObject({
        knownSubtotal: points,
        complete: true,
      });
      expect(result.totals.br).toMatchObject({
        knownSubtotal: br,
        complete: true,
      });
    },
  );
  it('keeps ten T-72A in the 600/25 company, without charging fixed platoons separately', () => {
    const document = add(empty(), 't72-company');
    expect(count(document, 't-72a')).toBe(10);
    expect(evaluate(document).chargeLines).toHaveLength(1);
    expect(
      evaluate(document)
        .resources.filter((pool) => pool.scope === 'army')
        .map((pool) => pool.capacity),
    ).toEqual([{ state: 'known', value: 9 }]);
  });
  it('charges ten company tanks at +10 each, while counting one Restricted upgrade event', () => {
    let document = empty();
    document.settings.gameSizeId = 'squad';
    for (let i = 0; i < 2; i++) {
      document = add(document, 't80-company', 'company-' + i);
      document = choose(document, 'company-' + i, 't-80bv');
    }
    expect(evaluate(document).totals.points.knownSubtotal).toBe(1500);
    expect(
      evaluate(document).issues.some((issue) => issue.ruleId === 'C11'),
    ).toBe(false);
    document = add(document, 't80-company', 'company-3');
    document = choose(document, 'company-3', 't-80bv');
    expect(
      evaluate(document).issues.some((issue) => issue.ruleId === 'C11'),
    ).toBe(true);
  });
  it('allows three Bastion tanks in one Unique company upgrade and preserves Regular BR delta', () => {
    let document = add(empty(), 't62-company');
    document = choose(document, 't62-company', 't-62m');
    document = choose(document, 't62-company', 'bastion', [
      ['platoon-1', 'ordinary-1'],
      ['platoon-2', 'ordinary-1'],
      ['platoon-3', 'ordinary-1'],
    ]);
    document = choose(document, 't62-company', 'regular');
    expect(evaluate(document).totals.points.knownSubtotal).toBe(455);
    expect(evaluate(document).totals.br.knownSubtotal).toBe(30);
    expect(count(document, 't-62mb')).toBe(3);
    expect(count(document, 't-62m')).toBe(7);
    expect(
      evaluate(document).issues.some((issue) => issue.ruleId === 'C12'),
    ).toBe(false);
    document = add(document, 'additional-t-62mb-with-bastion');
    expect(
      evaluate(document).issues.some((issue) => issue.ruleId === 'C12'),
    ).toBe(true);
  });
  it('applies a required vehicle upgrade before a later promotion regardless of choice order', () => {
    let document = add(empty(), 't80-platoon');
    document = choose(document, 't80-platoon', 't80u', [['ordinary-2']]);
    document = choose(document, 't80-platoon', 't-80bv');
    expect(count(document, 't-80u')).toBe(1);
    expect(count(document, 't-80bv')).toBe(2);
    expect(evaluate(document).totals.points.knownSubtotal).toBe(240);
  });
  it('requires the correct promoted vehicle for target-specific missiles', () => {
    let document = add(empty(), 't80-platoon');
    document = choose(document, 't80-platoon', 't-80bv');
    document = choose(document, 't80-platoon', 't80u', [['ordinary-2']]);
    document = choose(document, 't80-platoon', 'refleks', [['ordinary-1']]);
    expect(
      evaluate(document).issues.some((issue) => issue.ruleId === 'C30'),
    ).toBe(true);
    document = choose(document, 't80-platoon', 'refleks', [['ordinary-2']]);
    expect(
      evaluate(document).issues.some((issue) => issue.ruleId === 'C30'),
    ).toBe(false);
  });
  it('prices company Fire Support separately and upgrades only the owning fixed platoon plus its attachments', () => {
    let document = add(empty(), 'bmp1-company');
    document = add(
      document,
      'bmp1-company-fire-support',
      'p1-fs',
      'bmp1-company',
      ['platoon-1'],
    );
    document = add(
      document,
      'bmp1-company-fire-support',
      'p2-fs',
      'bmp1-company',
      ['platoon-2'],
    );
    expect(evaluate(document).totals.points.knownSubtotal).toBe(325);
    document = choose(
      document,
      'bmp1-company',
      'all-bmp1-to-p',
      undefined,
      'bmp1-company-platoon-1-infantry',
    );
    expect(evaluate(document).totals.points.knownSubtotal).toBe(345);
    expect(count(document, 'bmp-1p')).toBe(4);
    expect(count(document, 'bmp-1')).toBe(8);
    document = add(document, 'bmp1-company-agl', 'p1-agl', 'bmp1-company', [
      'platoon-1',
    ]);
    expect(evaluate(document).totals.points.knownSubtotal).toBe(385);
    expect(count(document, 'bmp-1p')).toBe(5);
    document = choose(document, 'p1-fs', 'bmp-1p');
    expect(evaluate(document).totals.points.knownSubtotal).toBe(385);
  });
  it('counts first and second Fire Support as two of four local slots, independently per platoon', () => {
    let document = add(empty(), 'bmp2-company');
    for (const suffix of [
      'fire-support',
      'fire-support-second',
      'agl',
      'mortar',
    ])
      document = add(
        document,
        'bmp2-company-' + suffix,
        suffix,
        'bmp2-company',
        ['platoon-1'],
      );
    expect(
      evaluate(document).issues.some((issue) => issue.ruleId === 'C03'),
    ).toBe(false);
    document = add(document, 'bmp2-company-medic', 'p2-medic', 'bmp2-company', [
      'platoon-2',
    ]);
    expect(
      evaluate(document).issues.some((issue) => issue.ruleId === 'C03'),
    ).toBe(false);
    document = add(document, 'bmp2-company-medic', 'p1-medic', 'bmp2-company', [
      'platoon-1',
    ]);
    expect(
      evaluate(document).issues.some((issue) => issue.ruleId === 'C03'),
    ).toBe(true);
    expect(
      evaluate(document)
        .resources.filter((pool) => pool.scope === 'army')
        .map((pool) => pool.capacity),
    ).toEqual([{ state: 'known', value: 12 }]);
  });
  it('requires the first Fire Support in the same fixed platoon before the discounted second Section', () => {
    let document = add(empty(), 'bmp1-company');
    document = add(
      document,
      'bmp1-company-fire-support',
      'first',
      'bmp1-company',
      ['platoon-1'],
    );
    document = add(
      document,
      'bmp1-company-fire-support-second',
      'second',
      'bmp1-company',
      ['platoon-2'],
    );
    expect(
      evaluate(document).issues.some((issue) => issue.ruleId === 'C03'),
    ).toBe(true);
    document = add(
      document,
      'bmp1-company-fire-support',
      'other-first',
      'bmp1-company',
      ['platoon-2'],
    );
    expect(
      evaluate(document).issues.some((issue) => issue.ruleId === 'C03'),
    ).toBe(false);
  });
  it('rejects missing or wrong company attachment member contexts at the command boundary', () => {
    const document = add(empty(), 'bmp1-company');
    expect(() =>
      add(document, 'bmp1-company-medic', 'wrong', 'bmp1-company'),
    ).toThrow('declared fixed platoon');
    expect(() =>
      add(document, 'bmp1-company-medic', 'wrong', 'bmp1-company', [
        'platoon-4',
      ]),
    ).toThrow();
  });
  it('limits a SAM Section to one platoon per company, including after SA-14 replacement', () => {
    let document = add(empty(), 'bmp1-company', 'company-a');
    document = add(document, 'bmp1-company', 'company-b');
    document = add(document, 'bmp1-company-sam', 'sam-a', 'company-a', [
      'platoon-1',
    ]);
    document = choose(document, 'sam-a', 'sa14');
    document = add(document, 'bmp1-company-sam', 'sam-b', 'company-b', [
      'platoon-1',
    ]);
    expect(
      evaluate(document).issues.some((issue) => issue.ruleId === 'C17'),
    ).toBe(false);
    expect(
      getClassicEntryAvailability(document, release, 'bmp1-company-sam', {
        parentSelectionId: 'company-a',
        targetMemberPath: ['platoon-2'],
      }).status,
    ).toBe('blocked');
    document = add(document, 'bmp1-company-sam', 'sam-a2', 'company-a', [
      'platoon-2',
    ]);
    expect(
      evaluate(document).issues.some((issue) => issue.ruleId === 'C17'),
    ).toBe(true);
  });
  it('keeps the printed SA-7 incompatibility local to its company', () => {
    let document = add(empty(), 'bmp2-company', 'company-a');
    document = add(document, 'bmp2-company', 'company-b');
    document = choose(
      document,
      'company-a',
      'sa-7',
      [['platoon-1', 'rifle']],
      'bmp2-company-platoon-1-infantry',
    );
    document = add(document, 'bmp2-company-sam', 'other-sam', 'company-b', [
      'platoon-1',
    ]);
    expect(
      evaluate(document).issues.some((issue) => issue.ruleId === 'C17'),
    ).toBe(false);
    document = add(document, 'bmp2-company-sam', 'same-sam', 'company-a', [
      'platoon-2',
    ]);
    expect(
      evaluate(document).issues.some((issue) => issue.ruleId === 'C17'),
    ).toBe(true);
  });
  it('converts the company and attachment BMP transports to exactly three helicopters, retaining personnel', () => {
    let document = add(empty(), 'bmp1-company');
    document = add(
      document,
      'bmp1-company-fire-support',
      'fs',
      'bmp1-company',
      ['platoon-1'],
    );
    document = add(document, 'bmp1-company-medic', 'medic', 'bmp1-company', [
      'platoon-1',
    ]);
    document = choose(document, 'bmp1-company', 'hip-conversion');
    expect(count(document, 'mi-8-hip-c')).toBe(3);
    expect(count(document, 'bmp-1')).toBe(0);
    expect(count(document, 'infantry-personnel')).toBe(78);
    expect(evaluate(document).totals.points.knownSubtotal).toBe(308);
    expect(evaluate(document).totals.br.knownSubtotal).toBe(26);
    document = add(document, 'bmp1-company-extra-hip', 'extra', 'bmp1-company');
    expect(count(document, 'mi-8-hip-c')).toBe(4);
    expect(evaluate(document).totals.points.knownSubtotal).toBe(338);
  });
  it('rejects an extra Hip without conversion and retains explicit conflict feedback for removed BMP upgrades', () => {
    let document = add(empty(), 'bmp1-company');
    document = add(document, 'bmp1-company-extra-hip', 'extra', 'bmp1-company');
    expect(
      evaluate(document).issues.some((issue) => issue.ruleId === 'C03'),
    ).toBe(true);
    document = choose(document, 'bmp1-company', 'hip-conversion');
    document = choose(
      document,
      'bmp1-company',
      'all-bmp1-to-p',
      undefined,
      'bmp1-company-platoon-1-infantry',
    );
    expect(
      evaluate(document).issues.some((issue) => issue.ruleId === 'C29'),
    ).toBe(true);
  });
  it('makes FHQ staff-to-command-tank replacement one tank, rather than three', () => {
    let document = add(empty(), 'fhq');
    document = choose(document, 'fhq', 't-62ak');
    expect(count(document, 't-62ak')).toBe(1);
    expect(evaluate(document).totals.points.knownSubtotal).toBe(35);
  });
  it('checks PT-76 against company, individual and command tanks while allowing T-62 variants', () => {
    let document = add(empty(), 't80-company');
    document = add(document, 'pt76');
    expect(
      evaluate(document).issues.some((issue) => issue.ruleId === 'C16'),
    ).toBe(true);
    document = add(empty(), 't62-company');
    document = choose(document, 't62-company', 't-62m');
    document = add(document, 'pt76');
    expect(
      evaluate(document).issues.some((issue) => issue.ruleId === 'C16'),
    ).toBe(false);
    document = add(document, 'additional-t-72av');
    expect(
      evaluate(document).issues.some((issue) => issue.ruleId === 'C16'),
    ).toBe(true);
  });
  it('enforces defender scenario inputs without granting defence support capacity', () => {
    let document = add(empty(), 'defence-at-ditch');
    expect(
      evaluate(document).coverage.some(
        (check) => check.status === 'missing-input',
      ),
    ).toBe(true);
    document = edit(document, {
      kind: 'settings',
      patch: { scenarioId: 'attack-defence', playerRoleId: 'attacker' },
    });
    expect(
      evaluate(document).issues.some((issue) => issue.ruleId === 'C14'),
    ).toBe(true);
    document = edit(document, {
      kind: 'settings',
      patch: { playerRoleId: 'defender' },
    });
    expect(
      evaluate(document).issues.some((issue) => issue.ruleId === 'C14'),
    ).toBe(false);
    expect(evaluate(document).resources).toEqual([]);
  });
  it('keeps ToT purchases exempt and ordinary requests subject to Additional Fire Support capacity', () => {
    let document = add(empty(), 'timed122');
    document = add(document, 'timed152');
    expect(
      evaluate(document).issues.some((issue) => issue.ruleId === 'C09'),
    ).toBe(false);
    document = add(document, 'artillery-request-priority3');
    expect(
      evaluate(document).issues.some((issue) => issue.ruleId === 'C09'),
    ).toBe(true);
    document = add(document, 'offtable-122');
    expect(
      evaluate(document).issues.some((issue) => issue.ruleId === 'C09'),
    ).toBe(false);
    expect(count(document, '2s1-gvozdika')).toBe(0);
  });
  it('retains negative BR deltas and the four-extra-truck limit', () => {
    let document = add(empty(), 'ambulance');
    document = choose(document, 'ambulance', 'heavy-truck');
    expect(evaluate(document).totals.points.knownSubtotal).toBe(15);
    expect(evaluate(document).totals.br.knownSubtotal).toBe(1);
    document = add(empty(), 'supply-column');
    for (let i = 0; i < 5; i++)
      document = add(
        document,
        'supply-extra-truck',
        'truck-' + i,
        'supply-column',
      );
    expect(
      evaluate(document).issues.some((issue) => issue.ruleId === 'C03'),
    ).toBe(true);
  });
});
