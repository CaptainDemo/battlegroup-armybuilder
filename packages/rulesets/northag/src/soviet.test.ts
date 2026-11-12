import { describe, expect, it } from 'vitest';
import { executeRosterCommands, type OptionChoice, type RosterDocument, type RosterSelection } from '@battlegroup/core';
import raw from '../../../catalogs/northag/public/catalogs/northag/russian-armoured-battlegroup/1-0-0/catalog.json';
import { evaluateNorthagRoster, northagRequestAllowance, validateNorthagRoster } from './rules';
import { northagReleaseSchema } from './schema';

const release = northagReleaseSchema.parse(raw);
const identity = release.catalog.manifest.identity;
const entries = new Map(release.catalog.entries.map(entry => [entry.localId, entry]));
const profiles = new Map(release.catalog.profiles.map(profile => [profile.localId, profile]));
const evaluate = (document: RosterDocument) => evaluateNorthagRoster(document, release);

function selection(id: string, entryId: string, parentSelectionId: string | null = null, targetMemberPath?: string[]): RosterSelection {
  return {
    selectionId: id, entryReference: { ...identity, localId: entryId }, parentSelectionId,
    ...(!parentSelectionId && { sectionId: entries.get(entryId)!.sectionIds[0]! }),
    ...(targetMemberPath && { targetMemberPath }),
    optionChoices: [],
  };
}
function document(selections: RosterSelection[], optionalRules: string[] = []): RosterDocument {
  return {
    formatVersion: 'roster/1', rosterId: 'northag-test', revision: '1', name: 'Test NORTHAG',
    catalogRef: identity, armyListId: identity.catalogId,
    settings: { budgetPoints: 500, gameSizeId: 'platoon', optionalRules },
    selections,
  };
}
const whole = (optionGroupLocalId: string, optionLocalId: string): OptionChoice => ({
  optionGroupLocalId, optionLocalId, targets: [{ kind: 'whole-selection' }],
});
const rules = (document: RosterDocument) => evaluate(document).issues.map(issue => issue.ruleId);

describe('NORTHAG 2020 Russian Armoured Battlegroup', () => {
  it('validates NORTHAG settings and keeps same-name section purchases separate', () => {
    const roster = document([
      selection('screen', 'marked-minefield'), selection('v', 'vanguard-tank-company'), selection('m', 'main-tank-company'),
    ]);
    expect(rules(roster)).toEqual([]);
    roster.selections.push(selection('second-main', 'main-tank-company'));
    expect(rules(roster)).toContain('northag/entry-limit');
    expect(rules(roster)).not.toContain('northag/vanguard');
    expect(rules(document([]))).toEqual(['northag/forward-screen', 'northag/vanguard']);
    expect(validateNorthagRoster({ ...roster, settings: { ...roster.settings, gameSizeId: 'squad' } })).not.toHaveLength(0);
    const recce = evaluate(document([selection('screen', 'tank-recce-patrol'), selection('v', 'vanguard-tank-company')]));
    expect(recce.statistics.find(item => item.statId === 'scout-weight')).toMatchObject({ value: 1, status: 'covered' });
  });

  it('applies the official TCC one-each erratum and does not add arrival BR to requests', () => {
    const roster = document([
      selection('screen', 'armoured-car-patrol'), selection('v', 'vanguard-tank-company'),
      selection('tcc', 'tactical-command-centre'), selection('fac', 'forward-air-controller', 'tcc'),
      selection('ew', 'electronic-warfare-team', 'tcc'), selection('supply', 'supply-truck', 'tcc'),
      selection('ambulance', 'ambulance', 'tcc'),
      selection('req1', 'additional-request'), selection('req2', 'additional-request'),
    ], ['reinforcement-requests']);
    const result = evaluate(roster);
    expect(result.issues).toEqual([]);
    expect([result.totals.points.knownSubtotal, result.totals.br.knownSubtotal]).toEqual([327, 30]);
    expect(result.statistics.map(stat => [stat.statId, stat.value, stat.status])).toEqual([
      ['officers', 3, 'covered'], ['scout-weight', 1, 'covered'],
    ]);
    expect(northagRequestAllowance(roster)).toEqual({ enabled: true, free: 1, paid: 2, maximum: 3 });
    roster.selections.push(selection('req3', 'additional-request'), selection('fac2', 'forward-air-controller', 'tcc'));
    expect(rules(roster)).toEqual(expect.arrayContaining(['northag/request-limit', 'northag/attachment-limit']));
    roster.settings.optionalRules = [];
    expect(rules(roster)).toContain('northag/requests-disabled');
  });

  it('charges the company conversion once and applies KMT to a single stable tank', () => {
    const company = selection('v', 'vanguard-tank-company');
    company.optionChoices = [
      whole('vanguard-tank-company-model', 't-80b'),
      { optionGroupLocalId: 'vanguard-tank-company-equipment', optionLocalId: 'kmt', targets: [{ kind: 'member-path', nodePath: ['tank-4'] }] },
    ];
    const roster = document([selection('screen', 'armoured-car-patrol'), company]);
    const result = evaluate(roster);
    expect(result.issues).toEqual([]);
    expect([result.totals.points.knownSubtotal, result.totals.br.knownSubtotal]).toEqual([389, 22]);
    const tanks = result.composition.find(item => item.selectionId === 'v')!.node.children!;
    expect(tanks.map(tank => tank.profileLocalId)).toEqual(Array(10).fill('t-80b'));
    expect(tanks.filter(tank => tank.tags?.includes('kmt')).map(tank => tank.nodeId)).toEqual(['tank-4']);
    roster.selections.push(selection('strike1', 'timed-203'), selection('strike2', 'timed-203'));
    expect(rules(roster)).toContain('northag/restricted');
  });

  it('applies transport chains and counts BMP-2 across standalone platoons only', () => {
    const platoon = selection('platoon', 'motor-rifle-platoon');
    platoon.optionChoices = [
      whole('motor-rifle-platoon-transports', 'bmp-2'),
      whole('motor-rifle-platoon-transports', 'bmp-1'),
      { optionGroupLocalId: 'motor-rifle-platoon-transports', optionLocalId: 'btr-70', targets: [{ kind: 'member-path', nodePath: ['group-2', 'transport'] }] },
    ];
    const second = { ...structuredClone(platoon), selectionId: 'platoon-2' };
    const roster = document([selection('screen', 'forward-foo'), selection('v', 'motor-rifle-company'), platoon, second]);
    const result = evaluate(roster);
    expect(result.issues.map(issue => issue.ruleId)).toEqual(['northag/bmp2-platoon']);
    const groups = result.composition.find(item => item.selectionId === 'platoon')!.node.children!;
    expect(groups.map(group => group.children?.find(member => member.nodeId === 'transport')?.profileLocalId)).toEqual(Array(3).fill('bmp-2'));
    expect(evaluate({ ...roster, selections: roster.selections.slice(0, -1) }).issues).toEqual([]);
  });

  it('checks distinct weapon teams and two slots independently in each fixed platoon', () => {
    const roster = document([
      selection('screen', 'forward-foo'), selection('v', 'motor-rifle-company'),
      selection('team1', 'attached-spkm-team', 'v', ['platoon-1']),
      selection('team2', 'attached-at-4-team', 'v', ['platoon-1']),
      selection('team3', 'attached-spkm-team', 'v', ['platoon-2']),
    ]);
    expect(rules(roster)).toEqual([]);
    const added = executeRosterCommands(roster, [{ kind: 'add', selection: selection('team4', 'attached-spkm-team', 'v', ['platoon-1']) }], release, '2');
    if (!added.ok) throw new Error(JSON.stringify(added.problems));
    expect(rules(added.document)).toEqual(['northag/attachment-limit', 'northag/weapon-team-limit']);
  });

  it('counts each Scout list box once across both homogeneous and mixed patrols', () => {
    const scoutEntries = ['armoured-car-patrol', 'armoured-car-patrol', 'tank-recce-patrol',
      'brm-1-patrol', 'spetsnaz-patrol', 'armoured-reconnaissance-patrol'];
    const roster = document([selection('v', 'vanguard-tank-company'),
      ...scoutEntries.map((id, index) => selection('scout-' + index, id))]);
    expect(evaluate(roster).statistics.find(item => item.statId === 'scout-weight')).toMatchObject({ value: 6, status: 'covered' });
  });

  it('adds one shared transport for one or two weapon teams and includes it in the BMP-2 conversion', () => {
    const platoon = selection('m', 'motor-rifle-platoon');
    const roster = document([selection('screen', 'forward-foo'), selection('v', 'motor-rifle-company'), platoon]);
    const transport = (result = evaluate(roster)) => result.composition.find(item => item.selectionId === 'm')?.node.children
      ?.filter(member => member.nodeId === 'weapon-team-transport');
    expect(transport()).toEqual([]);
    roster.selections.push(selection('team1', 'attached-spkm-team', 'm'));
    expect(transport()).toEqual([expect.objectContaining({ profileLocalId: 'btr-60', quantity: 1 })]);
    roster.selections.push(selection('team2', 'attached-at-3-team', 'm'));
    platoon.optionChoices = [whole('motor-rifle-platoon-weapon-team-transport', 'btr-70')];
    expect(transport()).toEqual([expect.objectContaining({ profileLocalId: 'btr-70', quantity: 1 })]);
    platoon.optionChoices.push(whole('motor-rifle-platoon-transports', 'bmp-1'), whole('motor-rifle-platoon-transports', 'bmp-2'));
    const result = evaluate(roster);
    expect(result.issues).toEqual([]);
    expect(transport(result)).toEqual([expect.objectContaining({ profileLocalId: 'bmp-2', quantity: 1 })]);
    expect([result.totals.points.knownSubtotal, result.totals.br.knownSubtotal]).toEqual([254, 42]);
    roster.selections = roster.selections.filter(item => item.parentSelectionId !== 'm');
    expect(transport()).toEqual([]);
  });

  it('adds transport to the exact company platoons and covers all of them in the fixed-price company conversion', () => {
    const company = selection('v', 'motor-rifle-company');
    company.optionChoices = [whole('motor-rifle-company-transports', 'bmp-1')];
    const roster = document([
      selection('screen', 'forward-foo'), company,
      selection('team1', 'attached-spkm-team', 'v', ['platoon-1']),
      selection('team2', 'attached-at-4-team', 'v', ['platoon-1']),
      selection('team3', 'attached-spkm-team', 'v', ['platoon-3']),
    ]);
    const result = evaluate(roster);
    expect(result.issues).toEqual([]);
    const platoons = result.composition.find(item => item.selectionId === 'v')!.node.children!;
    expect(platoons.map(platoon => platoon.children?.find(member => member.nodeId === 'weapon-team-transport')?.profileLocalId))
      .toEqual(['bmp-1', undefined, 'bmp-1']);
    expect([result.totals.points.knownSubtotal, result.totals.br.knownSubtotal]).toEqual([274, 32]);
  });

  it('keeps distinct command-tank profiles and records the verified equipment sources', () => {
    for (const [commandId, baseId] of [['t-62k', 't-62'], ['t-64ak', 't-64a'], ['t-64bk', 't-64b'], ['t-80k', 't-80'], ['t-80bk', 't-80b']] as const) {
      const base = profiles.get(baseId)!;
      const command = profiles.get(commandId)!;
      expect(command).toMatchObject({ localId: commandId, armour: base.armour, mounts: base.mounts, movement: base.movement });
      expect(command.sourceRefs).toEqual(expect.arrayContaining([expect.objectContaining({ printedPage: 71 }), ...base.sourceRefs]));
    }
    expect(profiles.get('btr-60r')).toMatchObject({ capacity: 1, mounts: [{ weaponId: 'hmg' }, { weaponId: 'mg' }] });
    expect(profiles.get('btr-60pu')).toMatchObject({ capacity: 1, mounts: [], sourceRefs: expect.arrayContaining([{ documentId: 'hwc-v6', pdfPage: 4, note: 'WAR-15b' }]) });
    expect(profiles.get('land-rover')).toMatchObject({ capacity: 1, armour: { kind: 'soft-skin' } });
    expect(profiles.get('ambulance-truck')?.armour).toBeUndefined();
  });

  it('materializes roster and arsenal errata against exact records', () => {
    expect(entries.get('forward-foo')?.optionGroupIds).toEqual([]);
    expect(entries.get('main-foo')?.optionGroupIds).toEqual(['main-foo-vehicle']);
    expect(profiles.get('grom')?.fireModes?.map(mode => mode.bands)).toEqual([[2, 2, 2, null, null], [1, 1, 1, null, null]]);
    for (const id of ['brm-1', 'btr-60', 'btr-70', 'btr-60k', 'btr-70k', 'pmm-2']) {
      expect(profiles.get(id)?.rules).toContain('amphibious');
    }
    expect(profiles.get('mi-24d')?.armour).toEqual({ kind: 'soft-skin' });
    expect(profiles.get('mi-24d')?.mounts.find(mount => mount.weaponId === 'at-6')?.ammunition).toBe(2);
    expect(profiles.get('mi-24d')?.mounts.find(mount => mount.weaponId === 'gatling-mg')?.doubleRoll).toBe(true);
    expect(profiles.get('shilka')?.mounts[0]?.doubleRoll).toBe(true);
    expect(profiles.get('sa-7-missile')?.fireModes).toEqual([{ ammo: 'HE', he: 'Light' }]);
    expect(profiles.get('ags-17')?.range).toBe(40);
    expect(raw.catalog.profiles.filter(profile => profile.kind === 'aircraft').every(profile => !('hits' in profile))).toBe(true);
    expect(release.catalog.errataRecords?.every(record => record.status === 'applied')).toBe(true);
  });
});
