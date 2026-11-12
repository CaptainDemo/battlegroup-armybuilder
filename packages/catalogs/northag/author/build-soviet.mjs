import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { book, errata, profiles, ruleDefinitions } from './equipment.mjs';

const identity = { rulesetId: 'northag', catalogId: 'russian-armoured-battlegroup-2020', catalogRevision: '1.0.0' };
const rulesRevision = 'northag-2020+errata-v9';
const moduleContract = 'northag/1';
const armyListId = identity.catalogId;
const forward = 'forward-screen';
const main = 'main-column';
const vanguard = 'vanguard';
const fireSupport = 'additional-fire-support';
const requests = 'reinforcement-requests';

const entries = [];
const optionGroups = [];
const purchases = [];
const entryLimits = {};
const known = value => ({ state: 'known', value });
const limit = max => max === null ? { kind: 'unlimited' } : { kind: 'limited', max };
const node = (nodeId, role, profileLocalId, quantity = 1) => ({
  nodeId, role, quantity, ...(profileLocalId && { profileLocalId }),
});
const vehicle = (id, profile = id, count = 1) => node(id, 'vehicle', profile, count);
const team = (id, profile = id, count = 1) => node(id, 'team', profile, count);
const formation = (children, nodeId = 'formation', role = 'formation') => ({ ...node(nodeId, role), children });
const replace = (fromProfileLocalId, toProfileLocalId) => ({ kind: 'model-replacement', fromProfileLocalId, toProfileLocalId });
const grant = tag => ({ kind: 'tag-grant', tag });
const replaceComposition = children => ({ kind: 'composition-change', replacement: formation(children) });
const memberSlots = nodePaths => ({ kind: 'member-slots', nodePaths });

function option(localId, name, points, effects, extra = {}) {
  return { localId, name, points, effects, ...extra };
}

function alternatives(options) {
  return options.map(item => ({
    ...item,
    mutuallyExclusiveWith: options.filter(other => other !== item).map(other => other.localId),
  }));
}

function group(localId, name, page, options) {
  optionGroups.push({
    localId, name, scope: 'selection', selectionLimit: limit(null),
    options: options.map(({ points, br = 0, refs = [], ...item }) => ({
      target: { kind: 'whole-selection' }, chargeMode: 'once', ownLimit: limit(1),
      ...item, costDelta: { points: known(points), br: known(br) }, sourceRefs: [book(page), ...refs],
    })),
  });
  return localId;
}

function add({
  id, name, section, page, points, br, max, children, rules = [], grade = 'c',
  groups = [], tags = [], parent, anchors, reason, refs = [], kind,
}) {
  entries.push({
    localId: id, name, kind: kind ?? (children ? 'formation' : 'tactical-resource'),
    armyListIds: [armyListId], sectionIds: [section],
    baseCost: { points: known(points), br: known(br) },
    ...(grade && { baseTraining: known(grade) }),
    composition: children ? { state: 'known', root: formation(children) } : { state: 'no-entities', reason },
    optionGroupIds: groups, specialRules: rules, tags, sourceRefs: [book(page), ...refs],
  });
  if (parent) purchases.push({ kind: 'attachment', entryId: id, parentEntryIds: parent, ...(anchors && { parentMemberPaths: anchors }) });
  else {
    if (max === undefined) throw new Error('Missing entry limit: ' + id);
    purchases.push({ kind: 'top-level', entryId: id });
    entryLimits[id] = limit(max);
  }
}

const forward69 = record => add({ section: forward, page: 69, ...record });
const forward70 = record => add({ section: forward, page: 70, ...record });
const main71 = record => add({ section: main, page: 71, ...record });
const main72 = record => add({ section: main, page: 72, ...record });

forward69({
  id: 'tank-recce-patrol', name: 'Tank Recce Patrol', points: 52, br: 4, max: 1,
  children: [vehicle('patrol', 't-64a', 2)], rules: ['scout'],
  groups: [group('tank-recce-model', 'Patrol tank model', 69, alternatives([
    option('t-64b', 'Replace both with T-64Bs', 18, [replace('t-64a', 't-64b')]),
    option('t-80', 'Replace both with T-80s', 6, [replace('t-64a', 't-80')]),
    option('t-80b', 'Replace both with T-80Bs', 30, [replace('t-64a', 't-80b')]),
  ]))],
});
forward69({
  id: 'air-defence-battery', name: 'Air Defence Battery', points: 22, br: 2, max: 1,
  children: [vehicle('launcher', 'sa-9'), vehicle('gun', 'shilka')], rules: ['aa'],
  groups: [group('air-defence-battery-model', 'Battery vehicles', 69, alternatives([
    option('sa-8', 'Replace both vehicles with two SA-8 Gecko launchers', 6, [replace('sa-9', 'sa-8'), replace('shilka', 'sa-8')]),
    option('sa-13', 'Replace SA-9 with SA-13 Gopher', 0, [replace('sa-9', 'sa-13')]),
  ]))],
});
forward69({
  id: 'dismounted-motor-rifle-platoon', name: 'Dismounted Motor Rifle Platoon', points: 30, br: 6, max: 2,
  children: [team('fire-teams', 'fire-team', 3), team('at-teams', 'at-team', 3)], rules: ['dug-in'],
});
forward69({
  id: 'forward-foo', name: 'Forward Observation Officer', points: 12, br: 2, max: 1,
  children: [team('command', 'command-team')], rules: ['officer', 'mortar-spotter', 'dug-in'], refs: [errata(7)],
});
forward69({
  id: 'sniper-hideout', name: 'Sniper Hideout', points: 15, br: 1, max: 1,
  children: [team('sniper', 'sniper-team')], rules: ['sniper', 'behind-enemy-lines', 'forward-deployed'],
});
forward69({
  id: 'armoured-car-patrol', name: 'Armoured Car Patrol', points: 24, br: 2, max: 3,
  children: [vehicle('armoured-cars', 'brdm-2', 2)], rules: ['scout', 'mortar-spotter'],
});
forward69({
  id: 'brm-1-patrol', name: 'BRM-1 Patrol', points: 22, br: 3, max: 1,
  children: [team('at-team'), vehicle('transport', 'brm-1')], rules: ['scout', 'ground-radar'],
});
forward69({
  id: 'spetsnaz-patrol', name: 'Spetsnaz Long Range Patrol', points: 20, br: 1, grade: 'e', max: 1,
  children: [team('fire-team'), vehicle('transport', 'luaz-967')], rules: ['scout', 'mortar-spotter', 'behind-enemy-lines'],
  groups: [group('spetsnaz-transport', 'Patrol transport', 69, [
    option('land-rover', 'Use captured Land Rover', 0, [replace('luaz-967', 'land-rover')], { target: memberSlots([['transport']]) }),
  ])],
});
forward69({
  id: 'armoured-reconnaissance-patrol', name: 'Armoured Reconnaissance Patrol', points: 18, br: 2, max: 3,
  children: [team('fire-team'), team('at-team'), vehicle('transport', 'btr-60')], rules: ['scout'],
  groups: [group('armoured-reconnaissance-transport', 'Patrol transport', 69, alternatives([
    option('btr-70', 'Use BTR-70', 0, [replace('btr-60', 'btr-70')]),
    option('bmp-1', 'Replace BTR with BMP-1', 9, [replace('btr-60', 'bmp-1')]),
    option('bmp-2', 'Replace BTR with BMP-2', 13, [replace('btr-60', 'bmp-2')]),
  ]).map(item => ({ ...item, target: memberSlots([['transport']]) })))],
});
for (const [id, name, points] of [['marked-minefield', 'Marked Minefield', 15], ['hidden-minefield', 'Hidden Minefield', 30]]) {
  forward69({ id, name, points, br: 0, max: 1, grade: null, reason: 'One mixed minefield terrain placement.', rules: ['forward-deployed'] });
}
forward70({ id: 'bridge-demolitions', name: 'Bridge Demolitions', points: 10, br: 0, max: 1, grade: null, reason: 'Pre-placed demolition charge on one bridge.' });
forward70({ id: 'fortified-building', name: 'Fortified Building', points: 20, br: 0, max: 3, grade: null, reason: 'One fortified building terrain placement.' });
forward70({
  id: 'at-gun-dug-out', name: 'Anti-Tank Gun Battery Dug-out', points: 26, br: 2, max: 2,
  children: [node('guns', 'gun', 't-12', 2)], rules: ['ambush', 'dug-in'],
});
forward70({
  id: 'smg-dug-out', name: 'SMG Dug-out', points: 9, br: 1, max: 2,
  children: [team('weapons-team', 'spkm-team')], rules: ['ambush', 'dug-in'],
});
forward70({
  id: 'atgm-dug-out', name: 'ATGM Dug-out', points: 17, br: 1, max: 1,
  children: [team('weapons-team', 'at-3-team')], rules: ['ambush', 'dug-in'],
  groups: [group('atgm-dug-out-weapon', 'Weapons team', 70, [
    option('at-4', 'Replace AT-3 Sagger with AT-4 Spigot', 4, [replace('at-3-team', 'at-4-team')], { target: memberSlots([['weapons-team']]) }),
  ])],
});

for (const [id, section, page] of [['vanguard-tank-company', vanguard, 70], ['main-tank-company', main, 71]]) {
  const tanks = Array.from({ length: 10 }, (_, index) => vehicle('tank-' + (index + 1), 't-62'));
  const model = group(id + '-model', 'Company tank model', page, alternatives([
    option('t-64a', 'Replace all T-62s with T-64As', 30, [replace('t-62', 't-64a')]),
    option('t-64b', 'Replace all T-62s with T-64Bs', 120, [replace('t-62', 't-64b')]),
    option('t-80', 'Replace all T-62s with T-80s', 60, [replace('t-62', 't-80')], { specialRules: ['restricted-choice'] }),
    option('t-80b', 'Replace all T-62s with T-80Bs', 180, [replace('t-62', 't-80b')], { specialRules: ['restricted-choice'] }),
  ]));
  const equipment = group(id + '-equipment', 'Individual tank equipment', page, [
    option('kmt', 'KMT Mine Plough', 5, [grant('kmt')], { target: memberSlots(tanks.map(item => [item.nodeId])), chargeMode: 'per-target' }),
  ]);
  add({ id, name: 'Tank Company', section, page, points: 180, br: 20, max: 1, children: tanks, groups: [model, equipment] });
}

const motorRiflePlatoon = () => Array.from({ length: 3 }, (_, index) => formation(
  [team('fire-team'), team('at-team'), vehicle('transport', 'btr-60')], 'group-' + (index + 1), 'transport-group',
));
const platoons = Array.from({ length: 3 }, (_, index) => ({
  ...formation(motorRiflePlatoon(), 'platoon-' + (index + 1), 'platoon'), configurableSlot: true,
}));
const transports = motorRiflePlatoon().map(item => [item.nodeId, 'transport']);
function rifleOptions(id, page, paths, price, bmp2) {
  return group(id + '-transports', 'Motor Rifle transports', page, [
    option('btr-70', 'Use BTR-70', 0, [replace('btr-60', 'btr-70')], { target: memberSlots(paths), chargeMode: 'per-target', ownLimit: limit(null) }),
    option('bmp-1', 'Replace all BTRs with BMP-1s', price, [replace('btr-60', 'bmp-1'), replace('btr-70', 'bmp-1')]),
    ...(bmp2 ? [option('bmp-2', 'Replace all BMP-1s with BMP-2s', 16, [replace('bmp-1', 'bmp-2')], {
      requires: ['bmp-1'], specialRules: ['bmp2-platoon-limit'],
    })] : []),
  ]);
}
function weaponTeamTransportOption(id, page, paths = []) {
  const target = paths.length ? { target: memberSlots(paths), chargeMode: 'per-target', ownLimit: limit(null) } : {};
  return group(id + '-weapon-team-transport', 'Shared weapon-team transport', page, [
    option('btr-70', 'Use BTR-70 for attached weapon teams', 0, [grant('weapon-team-btr-70')], target),
  ]);
}
add({
  id: 'motor-rifle-company', name: 'Motor Rifle Company', section: vanguard, page: 70, points: 132, br: 30, max: 1,
  children: platoons, groups: [
    rifleOptions('motor-rifle-company', 70, platoons.flatMap(platoon => transports.map(path => [platoon.nodeId, ...path])), 108, false),
    weaponTeamTransportOption('motor-rifle-company', 70, platoons.map(platoon => [platoon.nodeId])),
  ],
});
main71({
  id: 'motor-rifle-platoon', name: 'Motor Rifle Platoon', points: 44, br: 10, max: 4,
  children: motorRiflePlatoon(), groups: [
    rifleOptions('motor-rifle-platoon', 71, transports, 36, true),
    weaponTeamTransportOption('motor-rifle-platoon', 71),
  ],
});
for (const [id, name, points, rules] of [
  ['spkm-team', 'sPKM GPMG Weapons Team', 4, []], ['at-3-team', 'AT-3 Sagger Weapons Team', 10, []],
  ['at-4-team', 'AT-4 Spigot Weapons Team', 14, []], ['ags-17-team', 'AGS-17 AGL Weapons Team', 5, []],
  ['sa-7-team', 'SA-7 Grail Weapons Team', 8, ['aa']], ['sniper-team', 'Sniper Team', 6, ['sniper']],
]) {
  main71({
    id: 'attached-' + id, name, points, br: 0, children: [team('team', id)], rules, tags: ['platoon-weapon-team'],
    parent: ['motor-rifle-company', 'motor-rifle-platoon'],
    anchors: { 'motor-rifle-company': platoons.map(platoon => [platoon.nodeId]) }, refs: [book(70)],
  });
}

const commandIn = transport => [team('command', 'command-team'), vehicle('transport', transport)];
main71({
  id: 'battlegroup-commander', name: 'Battlegroup Commander', points: 24, br: 4, max: 1,
  children: commandIn('bmp-1k'), rules: ['senior-officer'],
  groups: [group('commander-vehicle', 'Commander vehicle', 71, alternatives([
    option('bmp-2k', 'Use BMP-2K', 0, [replace('bmp-1k', 'bmp-2k')]),
    ...[['t-62k', 'T-62K', 2], ['t-64ak', 'T-64AK', 5], ['t-64bk', 'T-64BK', 14], ['t-80k', 'T-80K', 8], ['t-80bk', 'T-80BK', 20]]
      .map(([id, name, points]) => option(id, 'Replace command team and BMP with ' + name, points,
        [replaceComposition([vehicle('transport', id)])], { br: 1, ...(id.startsWith('t-80') && { specialRules: ['restricted-choice'] }) })),
  ]))],
});
main71({
  id: 'main-foo', name: 'Forward Observation Officer', points: 12, br: 2, max: 1,
  children: commandIn('uaz-469'), rules: ['officer', 'mortar-spotter'],
  groups: [group('main-foo-vehicle', 'Observer vehicle', 71, alternatives([
    option('btr-60', 'Replace team and UAZ-469 with BTR-60', 4, [replaceComposition([vehicle('transport', 'btr-60')])], { br: 1 }),
    option('acrv-2', 'Replace team and UAZ-469 with ACRV-2', 4, [replaceComposition([vehicle('transport', 'acrv-2')])], { br: 1 }),
  ]))],
});
main71({ id: 'air-defence-tank', name: 'Air Defence Tank', points: 12, br: 1, max: 2, children: [vehicle('tank', 'shilka')], rules: ['aa'] });
main71({ id: 'military-police', name: 'Military Police Team', points: 16, br: 2, max: 1, children: commandIn('uaz-469'), rules: ['officer', 'traffic-control'] });
main71({
  id: 'guided-weapons-carriers', name: 'Guided Weapons Carrier Section', points: 36, br: 4, max: 1,
  children: [vehicle('carriers', 'brdm-2-malyutka', 2)], rules: ['ambush'],
  groups: [group('guided-weapons-model', 'Carrier models', 71, [
    option('konkurs', 'Replace both carriers with BRDM-2 Konkurs', 16, [replace('brdm-2-malyutka', 'brdm-2-konkurs')], { refs: [errata(7)] }),
  ])],
});

const tcc = 'tactical-command-centre';
main72({ id: tcc, name: 'Tactical Command Centre', points: 16, br: 3, max: 1, children: commandIn('acrv-2'), rules: ['officer', 'communications'], refs: [errata(7)] });
main72({
  id: 'forward-air-controller', name: 'Forward Air Controller', points: 12, br: 2, parent: [tcc],
  children: commandIn('uaz-469'), rules: ['officer', 'air-spotter'], refs: [errata(7)],
  groups: [group('fac-vehicle', 'Controller transport', 72, alternatives([
    option('btr-60r', 'Replace UAZ-469 with BTR-60 R', 5, [replace('uaz-469', 'btr-60r')], { br: 1 }),
    option('bmp-1k', 'Replace UAZ-469 with BMP-1K', 11, [replace('uaz-469', 'bmp-1k')], { br: 1 }),
    option('bmp-2k', 'Replace UAZ-469 with BMP-2K', 11, [replace('uaz-469', 'bmp-2k')], { br: 1 }),
  ]).map(item => ({ ...item, target: memberSlots([['transport']]) })))],
});
main72({
  id: 'electronic-warfare-team', name: 'Electronic Warfare Team', points: 16, br: 3, parent: [tcc],
  children: commandIn('bmp-1k'), tags: ['restricted'], rules: ['officer', 'electronic-warfare'], refs: [errata(7)],
  groups: [group('ew-vehicle', 'Electronic Warfare transport', 72, alternatives([
    option('bmp-2k', 'Use BMP-2K', 0, [replace('bmp-1k', 'bmp-2k')]),
    option('btr-60pu', 'Use BTR-60 PU', 0, [replace('bmp-1k', 'btr-60pu')]),
  ]).map(item => ({ ...item, target: memberSlots([['transport']]) })))],
});
main72({ id: 'supply-truck', name: 'Supply Truck', points: 9, br: 0, parent: [tcc], children: [vehicle('truck', 'ural-truck')], rules: ['resupply'], refs: [errata(7)] });
main72({ id: 'ambulance', name: 'Ambulance', points: 10, br: 0, parent: [tcc], children: [vehicle('truck', 'ambulance-truck')], rules: ['ambulance'], refs: [errata(7)] });
main72({
  id: 'sam-launcher', name: 'Surface-to-Air Missile Launcher', points: 10, br: 1, max: 2,
  children: [vehicle('launcher', 'sa-9')],
  groups: [group('sam-launcher-model', 'Launcher model', 72, alternatives(
    [['sa-13', 'SA-13 Gopher', 0], ['sa-8', 'SA-8 Gecko', 4], ['sa-6', 'SA-6 Gainful', 6], ['sa-11', 'SA-11 Gadfly', 10]]
      .map(([id, name, points]) => option(id, 'Replace SA-9 with ' + name, points, [replace('sa-9', id)], { target: memberSlots([['launcher']]) })),
  ))],
});
main72({
  id: 'close-support-battery', name: 'Close Support Self-Propelled Gun Battery', points: 26, br: 2, max: 1,
  children: [vehicle('guns', '2s1', 2)], rules: ['no-indirect-fire'], refs: [errata(7)],
});
main72({
  id: 'armoured-engineering-vehicle', name: 'Armoured Engineering Vehicle', points: 10, br: 1, max: 1,
  children: [vehicle('vehicle', 'ur-67')], rules: ['engineer'],
  groups: [group('engineer-vehicle-model', 'Engineering vehicle model', 72, alternatives([
    option('t-62-kmt', 'Replace UR-67 with T-62 and KMT Mine Plough', 10, [replace('ur-67', 't-62'), grant('kmt')]),
    option('t-64a-kmt', 'Replace UR-67 with T-64A and KMT Mine Plough', 22, [replace('ur-67', 't-64a'), grant('kmt')]),
  ]).map(item => ({ ...item, target: memberSlots([['vehicle']]) })))],
});
for (const [size, points] of [[82, 32], [120, 48]]) {
  main72({
    id: 'mortar-battery-' + size, name: size + 'mm Mortar Battery', points, br: 0, max: 1, grade: null,
    kind: 'off-table-support', reason: 'Four off-table mortars. Use requires a Mortar Spotter.',
  });
}

for (const [id, name, points] of [
  ['chemical-attack-clearance', 'Cleared for Chemical Attack', 10], ['breakthrough', 'Breakthrough', 10],
  ['advance-and-hold', 'Advance and Hold', 10], ['critical-battlefield', 'Critical Battlefield', 15],
  ['deployed-smoke-screen', 'Deployed Smoke Screen', 15], ['vital-objective', 'Vital Objective', 25],
]) {
  add({ id, name, points, br: 0, max: 1, grade: null, section: fireSupport, page: 73, reason: 'Special Tactics purchase.' });
}
for (const [id, name, points, max, reason, restricted, rules] of [
  ['counter-battery', 'Counter-Battery Fire Mission (3+)', 5, null, 'One off-table Counter-Battery Fire Mission.'],
  ['timed-122', 'Timed 122mm Artillery Strike', 14, 8, 'One timed strike from six 122mm guns or 2S1s.'],
  ['timed-152', 'Timed 152mm Artillery Strike', 21, 4, 'One timed strike from six 152mm guns or 2S3s.'],
  ['timed-203', 'Timed 203mm Artillery Strike', 34, 2, 'One timed strike from six 2S7s.', true],
  ['timed-bm-21', 'Timed BM-21 Grad Rocket Launcher Strike', 24, 1, 'One timed strike from three BM-21 launchers.'],
  ['timed-bm-27', 'Timed BM-27 Uragan Rocket Launcher Strike', 50, 1, 'One timed strike from three BM-27 launchers.', true],
  ['timed-su-25', 'Timed Su-25 Frogfoot Air Strike', 30, null, 'One air strike with 8 medium bombs, 4 large bombs or 4 UB-32 pods.'],
  ['timed-su-17', 'Timed Su-17 Fitter Air Strike', 40, null, 'One air strike with 12 medium bombs or 4 cluster bombs.'],
  ['timed-mig-23', 'Timed MiG-23 Flogger Air Strike', 15, null, 'One air strike with 2 large bombs or 2 UB-32 pods.'],
  ['combat-air-patrol', 'Combat Air Patrol', 30, 1, 'Off-table fighter coverage.'],
  ['off-table-sam-cover', 'Off-table SAM Cover', 15, 3, 'Off-table SA-11 cover.', false, ['aa-high']],
]) {
  add({ id, name, points, max, reason, br: 0, grade: null, section: fireSupport, page: 73,
    kind: 'off-table-support', tags: restricted ? ['restricted'] : [], rules: rules ?? [] });
}
add({
  id: 'additional-request', name: 'Additional Reinforcement Request', section: requests, page: 74,
  points: 30, br: 0, max: null, grade: null, reason: 'One additional request. Arrival units and their BR are resolved during the game.',
});

const sections = [
  [forward, 'Forward Screen', null, true, 'Choose at least one Forward Screen entry.'],
  ['main-force', 'Main Force', null, false],
  [vanguard, 'Vanguard', 'main-force', true, 'Choose exactly one Vanguard formation.'],
  [main, 'Main Column', 'main-force', true],
  [fireSupport, 'Additional Fire Support', null, true],
  [requests, 'Reinforcement Requests', null, true, 'Enable the optional rule in roster settings. One request is included when enabled.'],
].map(([sectionId, name, parentSectionId, directlyPurchasable, note]) => ({
  sectionId, name, parentSectionId, directlyPurchasable, ...(note && { note }),
}));

const correction = (errataId, targetRecordId, field, previousValue, newValue, page) => ({
  errataId, targetRecordId, field, previousValue, newValue, sourceRef: errata(page), status: 'applied',
});
const errataRecords = [
  correction('forward-foo-option', 'forward-foo', 'options', 'Artillery Spotter +5 points', 'Removed', 7),
  correction('tcc-one-each', tcc, 'attachment limit', 'One of any', 'Up to one of each of the four child entries', 7),
  correction('carrier-konkurs', 'guided-weapons-carriers', 'carrier upgrade name', 'Konkur', 'Konkurs', 7),
  correction('close-support-2s1', 'close-support-battery', 'composition', 'S21', '2S1', 7),
  correction('brdm-konkurs', 'brdm-2-konkurs', 'name', 'Konkur', 'Konkurs', 9),
  correction('brm-amphibious', 'brm-1', 'rules', 'Amphibious absent', 'Amphibious added', 9),
  ...['btr-60', 'btr-70', 'btr-60k', 'btr-70k'].map(id =>
    correction(id + '-amphibious', id, 'rules', 'Amphibious absent; errata spells BTR as BRM', 'Amphibious added; verified against p.96 and v9 changelog', 9)),
  correction('acrv-name', 'acrv-2', 'name', 'ARCV-2', 'ACRV-2', 9),
  correction('pmm-amphibious', 'pmm-2', 'rules', 'Amphibious absent', 'Amphibious added', 9),
  correction('flame-tank-name', 'to-62', 'name', 'TO-62A', 'TO-62', 9),
  correction('shilka-rof', 'shilka', 'mounted cannon RoF', 'High with undefined asterisk', 'High, may roll twice', 9),
  correction('hind-rof', 'mi-24d', 'Gatling MG RoF', 'High with undefined asterisk', 'High, may roll twice', 9),
  correction('gvozdika-name', '2s1', 'name', 'Grozdika', 'Gvozdika', 9),
  correction('hind-armour', 'mi-24d', 'armour', '1/0/0', 'Soft Skin', 9),
  correction('hind-at-6', 'mi-24d', 'AT-6 ammunition', 'Unspecified', '2', 10),
  ...['su-25', 'su-17', 'mig-23'].map(id => correction(id + '-hits', id, 'Hits', 'Numeric', 'Removed', 10)),
  correction('grom-ap', 'grom', 'AP first three bands', '2/1/1', '2/2/2', 10),
  correction('s24-label', 's24', 'name', 'SB4', 'S24', 10),
  correction('bm-27-label', 'bm-27-rocket', 'name', 'MB.27', 'BM.27', 10),
  ...['sa-6', 'sa-7', 'sa-8', 'sa-9', 'sa-11', 'sa-13'].map(id =>
    correction(id + '-no-at', id + '-missile', 'AT values', 'Numeric bands', 'Removed; HE class preserved', 10)),
  correction('ags-range', 'ags-17', 'QRS range', '30 inches', '40 inches', 10),
];
const coverage = {
  omitted: ['ambulance-truck-equipment', 'battle-procedures'],
  note: 'Static Russian army-list purchases. Ambulance Truck equipment remains unverified. Reinforcement arrivals and combat are outside roster evaluation.',
};
const catalog = {
  manifest: {
    identity, schemaVersion: 'catalog-shell/1', rulesRevision, baseEdition: 'Battlegroup: NORTHAG (2020)',
    sources: [
      { documentId: 'book', title: 'Battlegroup: NORTHAG (2020)', sha256: 'a2750592057b1e88bb75d34a5249b56ac617bdc9e20cf89bd3933e0bce635992',
        pdfPageCount: 117, printedPageOffset: -1, authority: 'official', reviewStatus: 'selected-pages-reviewed', errataApplication: 'partially-applied' },
      { documentId: 'errata', title: 'NORTHAG Official Rules Errata v9 (9 May 2025)', sha256: '1148ff5689e7b405b4a93de2b7f116be765b4e55f4ce62ec1c05dc4b530e105b',
        pdfPageCount: 12, authority: 'official', reviewStatus: 'selected-pages-reviewed', errataApplication: 'not-applicable' },
      { documentId: 'hwc-v6', title: 'HWC WARPAC Unit Cards v6 (community)', sha256: '5dd97eca786d1111e459321fe870eba6bf0715b7ab61cb9c1c265d9fc9b9035b',
        pdfPageCount: 8, authority: 'unofficial-community', reviewStatus: 'selected-pages-reviewed', errataApplication: 'partially-applied' },
    ],
    errataSummary: { declaredErrataIds: ['official-v9'], applicationStatus: 'partially-applied' },
    coverage: { status: 'partial', note: coverage.note },
  },
  armyLists: [{ armyListId, rulesetId: 'northag', nation: 'Soviet', name: 'Russian Armoured Battlegroup', structure: { sections } }],
  profiles, entries, optionGroups, errataRecords, ruleDefinitions,
};
const release = { moduleContract, catalog, purchases, entryLimits, coverage };
const content = JSON.stringify(release, null, 2) + '\n';
const assetPath = 'catalogs/northag/russian-armoured-battlegroup/1-0-0/catalog.json';
const publicRoot = new URL('../public/', import.meta.url);
const catalogFile = new URL(assetPath, publicRoot);
mkdirSync(new URL('./', catalogFile), { recursive: true });
writeFileSync(catalogFile, content);
writeFileSync(new URL('catalogs/index.json', publicRoot), JSON.stringify({
  indexVersion: 1, releases: [{
    identity, label: 'Russian Armoured Battlegroup · NORTHAG 2020 + v9', assetPath,
    sha256: createHash('sha256').update(content).digest('hex'), rulesRevision, moduleContract,
  }],
}, null, 2) + '\n');
