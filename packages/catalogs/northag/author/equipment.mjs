// Transcription of NORTHAG 2020. Values apply only to this catalog.
export const book = printedPage => ({ documentId: 'book', pdfPage: printedPage + 1, printedPage });
export const errata = pdfPage => ({ documentId: 'errata', pdfPage });
const card = (pdfPage, note) => ({ documentId: 'hwc-v6', pdfPage, note });
const row = (ammo, bands, he, minRange) => ({ ammo, ...(bands && { bands }), ...(he && { he }), ...(minRange && { minRange }) });
const profile = (localId, name, kind, page, details = {}) => ({
  localId, name, kind, rules: [], mounts: [], sourceRefs: [book(page)], ...details,
});
const weapon = (id, name, page, fireModes, details = {}) => profile(id, name, 'weapon', page, { fireModes, ...details });
const repeat = value => Array(5).fill(value);
const mount = (weaponId, position, rate, ammunition, doubleRoll) => ({
  weaponId, ...(position && { mount: position }), ...(rate && { rate }),
  ...(ammunition && { ammunition }), ...(doubleRoll && { doubleRoll }),
});
const turret = (id, rate, ammunition) => mount(id, 'Turret', rate, ammunition);
const coAx = mount('mg', 'Co-axial', 'Low');
const pintle = mount('mg', 'Pintle', 'Medium');
const tankMounts = (gun, kobra = false) => [turret(gun), coAx, pintle, ...(kobra ? [turret('at-8', undefined, 2)] : [])];
const apcMounts = [turret('hmg', 'Medium'), coAx];
const bmpMounts = variant => variant === 1 ? [turret('grom'), coAx, turret('at-3', undefined, 1)] : [turret('cannon-30', 'High'), coAx, turret('at-5', undefined, 1)];
const armoured = ([front, side, rear]) => ({ kind: 'armoured', front, side, rear });
const vehicle = (id, name, page, movement, protection, mounts = [], rules = [], extra = {}) => profile(id, name, 'vehicle', page, {
  movement, ...(protection && { armour: protection === 'soft' ? { kind: 'soft-skin' } : armoured(protection) }), mounts, rules, ...extra,
});
const vehicleRef = (id, name, page) => profile(id, name, 'vehicle', page, { note: 'Equipment profile not verified for this variant.' });
const infantry = (id, name, mounts = [], rules = []) => profile(id, name, 'infantry', 100, { mounts, rules: ['infantry', ...rules] });

const aaMissiles = [
  ['sa-6', 'Gainful', 'Heavy'], ['sa-7', 'Grail', 'Light'], ['sa-8', 'Gecko', 'Heavy'],
  ['sa-9', 'Gaskin', 'Medium'], ['sa-11', 'Gadfly', 'Very Heavy'], ['sa-13', 'Gopher', 'Medium'],
];
const arsenal = [
  weapon('cannon-23', '23mm', 99, [row('AP', [1, 1, 1, 1, null]), row('HE', [1, 1, 1, 1, null], 'Light')]),
  weapon('cannon-30', '30mm', 99, [row('AP', [2, 1, 1, 1, null]), row('HE', [1, 1, 1, 1, null], 'Light')]),
  weapon('grom', '73mm Grom', 99, [row('AP', [2, 2, 2, null, null]), row('HE', [1, 1, 1, null, null], 'Light')], { sourceRefs: [book(99), errata(10)] }),
  weapon('cannon-100', '100mm T-12 / D10', 99, [row('AP', [6, 5, 4, 3, 2]), row('HE', repeat(3), 'Medium')]),
  weapon('cannon-115', '115mm U5TS', 99, [row('AP', [7, 6, 5, 4, 3]), row('HE', repeat(4), 'Medium')]),
  weapon('cannon-125', '125mm D81', 99, [row('AP', [8, 7, 6, 5, 4]), row('HE', repeat(4), 'Medium')]),
  weapon('at-3', 'AT-3 Sagger', 99, [row('AP', [null, null, 5, 5, 5], undefined, 30)]),
  weapon('at-4', 'AT-4 Spigot', 99, [row('AP', [null, 6, 6, 6, 6], undefined, 20)]),
  weapon('at-5', 'AT-5 Spandrel', 99, [row('AP', [null, 7, 7, 7, 7], undefined, 20)]),
  weapon('at-6', 'AT-6 Spiral', 99, [row('AP', [null, 8, 8, 8, 8], undefined, 20)]),
  weapon('at-8', 'AT-8 Kobra / Songster', 99, [row('AP', [null, 7, 7, 7, 7], undefined, 20)]),
  weapon('rpg-7', 'RPG-7', 99, [row('AP', [3, null, null, null, null])]),
  weapon('ub-32', 'UB-32 (57mm)', 99, [row('HE', repeat(2), 'Various')]),
  weapon('s24', 'S24 (240mm)', 99, [row('HE', repeat(7), 'Very Heavy')], { sourceRefs: [book(99), errata(10)] }),
  weapon('bm-21-rocket', 'BM-21 (122mm)', 99, [row('HE', repeat(4), 'Heavy')]),
  weapon('bm-27-rocket', 'BM-27 (220mm)', 99, [row('HE', repeat(7), 'Very Heavy')], { sourceRefs: [book(99), errata(10)] }),
  ...aaMissiles.map(([id, name, he]) => weapon(id + '-missile', id.toUpperCase() + ' ' + name, 100, [row('HE', undefined, he)], { sourceRefs: [book(100), errata(10)] })),
  weapon('mortar-82', '82mm Mortar', 100, [row('HE', repeat(1), 'Light')]),
  weapon('mortar-120', '120mm Mortar', 100, [row('HE', repeat(2), 'Medium')]),
  weapon('artillery-122', '122mm', 100, [row('HE', repeat(4), 'Medium')]),
  weapon('artillery-152', '152mm', 100, [row('HE', repeat(5), 'Heavy')]),
  weapon('artillery-203', '203mm', 100, [row('HE', repeat(7), 'Very Heavy')]),
  weapon('ags-17', 'AGS-17 Grenade Launcher', 100, [row('HE', undefined, 'Light')], { range: 40, sourceRefs: [book(100), { documentId: 'book', pdfPage: 115 }, errata(10)] }),
  weapon('mg', 'Vehicle MG', 100, []),
  weapon('hmg', 'HMG', 94, []),
  weapon('gatling-mg', 'Gatling MG', 100, [], { range: 30 }),
  weapon('flamethrower', 'Vehicle Flamethrower', 100, [row('HE', undefined, 'Very Heavy')], { range: 10 }),
  weapon('fire-team-small-arms', 'Fire Team Small Arms', 100, [], { range: 30 }),
  weapon('at-team-small-arms', 'Anti-Tank Team Small Arms', 100, [], { range: 30 }),
  weapon('command-small-arms', 'Command Team Small Arms', 100, [], { range: 20 }),
  weapon('weapon-team-small-arms', 'Weapons Team Small Arms', 100, [], { range: 20 }),
  weapon('spkm', 'sPKM GPMG', 100, [], { range: 40 }),
  weapon('sniper-rifle', 'Sniper Team Small Arms', 100, [], { range: 30 }),
  infantry('fire-team', 'Infantry Fire Team', [mount('fire-team-small-arms', undefined, 'Medium')]),
  infantry('at-team', 'Infantry Anti-Tank Team', [mount('at-team-small-arms', undefined, 'Low'), mount('rpg-7')]),
  infantry('command-team', 'Infantry Command Team', [mount('command-small-arms', undefined, 'Low')]),
  infantry('spkm-team', 'sPKM GPMG Weapons Team', [mount('spkm', undefined, 'High')]),
  infantry('at-3-team', 'AT-3 Sagger Weapons Team', [mount('weapon-team-small-arms', undefined, 'Low'), mount('at-3')], ['atgm']),
  infantry('at-4-team', 'AT-4 Spigot Weapons Team', [mount('weapon-team-small-arms', undefined, 'Low'), mount('at-4')], ['atgm']),
  infantry('ags-17-team', 'AGS-17 AGL Weapons Team', [mount('ags-17', undefined, 'Medium')]),
  infantry('sa-7-team', 'SA-7 Grail Weapons Team', [mount('weapon-team-small-arms', undefined, 'Low'), mount('sa-7-missile')], ['aa']),
  infantry('sniper-team', 'Infantry Sniper Team', [mount('sniper-rifle', undefined, 'Low')], ['sniper']),
  profile('t-12', 'T-12 100mm Anti-Tank Gun', 'gun', 70, { mounts: [mount('cannon-100')] }),
  vehicle('brdm-2', 'BRDM-2', 94, 'Wheel-AT', [0, 0, 0], apcMounts, ['scout', 'amphibious']),
  vehicle('brdm-2-malyutka', 'BRDM-2 Malyutka', 94, 'Wheel-AT', [0, 0, 0], [mount('at-3', 'Hull', undefined, 7)], ['atgm', 'amphibious']),
  vehicle('brdm-2-konkurs', 'BRDM-2 Konkurs', 94, 'Wheel-AT', [0, 0, 0], [mount('at-5', 'Hull', undefined, 5)], ['atgm', 'amphibious'], { sourceRefs: [book(94), errata(9)] }),
  vehicle('brm-1', 'BRM-1', 94, 'Fast Track', [1, 0, 0], [turret('grom'), coAx], ['scout', 'amphibious', 'ground-radar'], { capacity: 1, sourceRefs: [book(94), errata(9)] }),
  vehicle('t-62', 'T-62', 94, 'Medium Track', [4, 2, 1], tankMounts('cannon-115')),
  vehicle('t-64a', 'T-64A', 94, 'Medium Track', [5, 3, 1], tankMounts('cannon-125')),
  vehicle('t-64b', 'T-64B', 94, 'Medium Track', [6, 4, 2], tankMounts('cannon-125', true), ['atgm']),
  vehicle('t-80', 'T-80', 95, 'Fast Track', [7, 5, 2], tankMounts('cannon-125')),
  vehicle('t-80b', 'T-80B', 95, 'Fast Track', [7, 5, 2], tankMounts('cannon-125', true), ['atgm']),
  ...[['bmp-1', 'BMP-1', 1, 2], ['bmp-1k', 'BMP-1K', 1, 1], ['bmp-2', 'BMP-2', 2, 2], ['bmp-2k', 'BMP-2K', 2, 1]]
    .map(([id, name, variant, capacity]) => vehicle(id, name, 95, 'Fast Track', [1, 0, 0], bmpMounts(variant), ['amphibious', 'atgm'], { capacity })),
  ...[['btr-60', 'BTR-60', 2], ['btr-70', 'BTR-70', 2], ['btr-60k', 'BTR-60K', 1], ['btr-70k', 'BTR-70K', 1]]
    .map(([id, name, capacity]) => vehicle(id, name, 96, 'Wheel-AT', [1, 0, 0], apcMounts, ['amphibious'], { capacity, sourceRefs: [book(96), errata(9), errata(12)] })),
  vehicle('acrv-2', 'ACRV-2', 96, 'Medium Track', [0, 0, 0], [pintle], ['amphibious'], { capacity: 1, sourceRefs: [book(96), errata(9)] }),
  vehicle('pmm-2', 'PMM-2', 96, 'Slow Track', 'soft', [], ['bridging', 'amphibious'], { sourceRefs: [book(96), errata(9)] }),
  vehicle('ur-67', 'UR-67', 97, 'Slow Track', [0, 0, 0], [], ['mine-clearance']),
  vehicle('to-62', 'TO-62', 97, 'Medium Track', [4, 2, 1], [turret('cannon-115'), mount('flamethrower', 'Co-axial'), pintle], [], { sourceRefs: [book(97), errata(9)] }),
  vehicle('sa-6', 'SA-6 Gainful', 97, 'Slow Track', [0, 0, 0], [mount('sa-6-missile', 'Hull', undefined, 3)], ['aa']),
  vehicle('sa-8', 'SA-8 Gecko', 97, 'Wheel-AT', [0, 0, 0], [turret('sa-8-missile', undefined, 6)], ['aa', 'amphibious']),
  vehicle('sa-9', 'SA-9 Gaskin', 97, 'Wheel-AT', [0, 0, 0], [turret('sa-9-missile', undefined, 4)], ['aa', 'amphibious']),
  vehicle('sa-11', 'SA-11 Gadfly', 97, 'Medium Track', [0, 0, 0], [mount('sa-11-missile', 'Hull', undefined, 4)], ['aa-high']),
  vehicle('sa-13', 'SA-13 Gopher', 97, 'Medium Track', [0, 0, 0], [turret('sa-13-missile', undefined, 6)], ['aa']),
  vehicle('shilka', 'ZSU-23-4 Shilka', 98, 'Medium Track', [2, 1, 0], [mount('cannon-23', 'Turret (quad)', 'High', undefined, true)], ['aa'], { sourceRefs: [book(98), errata(9)] }),
  vehicle('2s1', '2S1 Gvozdika', 98, 'Medium Track', [2, 1, 0], [turret('artillery-122')], ['no-indirect-fire'], { sourceRefs: [book(98), errata(7), errata(9)] }),
  vehicle('mi-8', 'Mi-8 Hip', 98, 'Helicopter', 'soft', [], ['helicopter'], { capacity: 6 }),
  vehicle('mi-24d', 'Mi-24D Hind', 98, 'Helicopter', 'soft', [
    mount('gatling-mg', 'Hull', 'High', undefined, true), mount('ub-32', 'Hull', undefined, 2),
    mount('s24', 'Hull', undefined, 2), mount('at-6', 'Hull', undefined, 2), mount('mg', 'Door', 'Medium'),
  ], ['helicopter', 'atgm'], { capacity: 2, sourceRefs: [book(98), errata(9), errata(10)] }),
  profile('su-25', 'Su-25 Frogfoot', 'aircraft', 98, { sourceRefs: [book(73), book(98), errata(10)], note: 'Timed strike loadouts: 8 medium bombs, 4 large bombs, or 4 UB-32 pods.' }),
  profile('su-17', 'Su-17 Fitter', 'aircraft', 98, { sourceRefs: [book(73), book(98), errata(10)], note: 'Timed strike loadouts: 12 medium bombs or 4 cluster bombs.' }),
  profile('mig-23', 'MiG-23 Flogger', 'aircraft', 98, { sourceRefs: [book(73), book(98), errata(10)], note: 'Timed strike loadouts: 2 large bombs or 2 UB-32 pods.' }),
  vehicle('luaz-967', 'LuAZ-967', 100, 'Wheeled All-Terrain', 'soft', [], [], { capacity: 1 }),
  vehicle('uaz-469', 'UAZ-469', 100, 'Wheeled Roadster', 'soft', [], [], { capacity: 1 }),
  vehicle('ural-truck', 'Ural-4320 / Ural-375 Truck', 100, 'Wheeled Roadster', 'soft', [], [], { capacity: 4 }),
  vehicle('land-rover', 'Captured Land Rover', 106, 'Wheeled All-Terrain', 'soft', [], [], {
    capacity: 1, sourceRefs: [book(69), book(106)], note: 'Equipment from the NORTHAG Land Rover row (p.106).',
  }),
  vehicle('btr-60r', 'BTR-60 R', 72, 'Wheel-AT', [1, 0, 0], apcMounts, ['amphibious'], {
    capacity: 1, sourceRefs: [book(72), card(4, 'WAR-15a'), errata(12)],
    note: 'Equipment from HWC v6 WAR-15a (community card). Amphibious follows Official Errata v9.',
  }),
  vehicle('btr-60pu', 'BTR-60 PU', 72, 'Wheel-AT', [1, 0, 0], [], ['amphibious'], {
    capacity: 1, sourceRefs: [book(72), card(4, 'WAR-15b'), errata(12)],
    note: 'Equipment from HWC v6 WAR-15b (community card). No weapon mount is listed. Amphibious follows Official Errata v9.',
  }),
  vehicleRef('ambulance-truck', 'Ambulance Truck', 72),
];

const commandTanks = [
  ['t-62k', 'T-62K', 't-62'], ['t-64ak', 'T-64AK', 't-64a'], ['t-64bk', 'T-64BK', 't-64b'],
  ['t-80k', 'T-80K', 't-80'], ['t-80bk', 'T-80BK', 't-80b'],
].map(([localId, name, baseId]) => {
  const base = arsenal.find(item => item.localId === baseId);
  if (!base) throw new Error('Missing NORTHAG base equipment: ' + baseId);
  return {
    ...structuredClone(base), localId, name, sourceRefs: [book(71), ...base.sourceRefs],
    note: 'Equipment values use the NORTHAG ' + base.name + ' row. The K suffix identifies the command variant.',
  };
});
export const profiles = [...arsenal, ...commandTanks];

export const ruleDefinitions = [
  ['aa', 'AA', 'May engage aircraft and helicopters. It cannot target ground units.', 'p.51'],
  ['aa-high', 'AA-high', 'May engage aircraft, including fighters on Combat Air Patrol. It cannot engage helicopters or ground targets.', 'p.51'],
  ['ambush', 'Ambush', 'May start on Ambush Fire in addition to other units so deployed. The Ambush Fire order is free, but other orders cost as usual.', 'p.51'],
  ['amphibious', 'Amphibious', 'Can cross impassable water, treating the water as dangerous terrain.', 'p.51'],
  ['behind-enemy-lines', 'Behind Enemy Lines', 'Deploys after both sides’ other Forward Screen units and may deploy anywhere on Ambush Fire. Enemies cannot fire at it on turns 1 and 2 unless it fires first.', 'p.51'],
  ['air-spotter', 'Air Spotter', 'May reroll a Gunship counter roll or an Airborne Reinforcement Request roll.', 'p.51'],
  ['ambulance', 'Ambulance', 'Can embark a destroyed infantry stand awaiting evacuation. Taking it off the friendly edge returns one BR counter of the player’s choice.', 'p.51'],
  ['bridging', 'Bridging', 'May use the bridge construction rules with an Engineering order.', 'p.51'],
  ['communications', 'Communications', 'Reroll one failed off-table mortar or artillery communication test each turn. A test cannot be rerolled twice and the reroll spends no order.', 'official v9, PDF p.6'],
  ['dug-in', 'Dug-in', 'Begins in reinforced cover with a 3+ Cover Save and loses that cover if it moves.', 'p.52'],
  ['engineer', 'Engineer', 'May use the Engineering order.', 'p.52'],
  ['electronic-warfare', 'Electronic Warfare', 'Once per game for one order, halve the enemy’s next orders total, rounding up, or make their next Reinforcement Request require a 6 without rerolls or other assistance.', 'p.52; official v9, PDF p.6'],
  ['forward-deployed', 'Forward Deployed', 'May set up as far as halfway across the table during Forward Screen deployment.', 'p.52'],
  ['ground-radar', 'Ground Surveillance Radar', 'A deployed radar may guide one mortar or artillery strike per turn, excluding multiple rocket launchers. The strike starts Accurate and may reroll misses on the barrage accuracy table.', 'p.52'],
  ['helicopter', 'Helicopter', 'Moves up to 60 inches over terrain and may hover. Apply the Air Power chapter’s helicopter rules.', 'p.52'],
  ['infantry', 'Infantry', 'The team is represented by one stand. It may be targeted with Suppressing Fire; Aimed Fire cannot target it.', 'p.52'],
  ['officer', 'Officer', 'Adds one to the side’s Command and Control roll.', 'p.53'],
  ['senior-officer', 'Senior Officer', 'Counts as an Officer and can reroll one Command and Control die once per game.', 'p.53'],
  ['resupply', 'Resupply', 'Can rearm up to three eligible missile vehicles or infantry teams per game. Both units must remain in contact for a turn without other orders. Helicopters are excluded.', 'p.53'],
  ['traffic-control', 'Traffic Control', 'Provides one reroll per game for an eligible Armour, Infantry, Anti-Tank, Anti-Aircraft or Engineer request while the Military Police unit is on the table.', 'p.53'],
  ['sniper', 'Sniper', 'Sniper fire treats infantry as in the open, with a best Cover Save of 6+. Suppressing the sniper requires observing it first. Its loss draws no BR counter.', 'p.53'],
  ['scout', 'Scout', 'Counts toward the side’s Scout total for scenario setup and out-scouting.', 'official v9, PDF p.6'],
  ['scout-2', 'Scout (2)', 'Counts as two Scouts. Other Scout rules apply as usual.', 'official v9, PDF p.6'],
  ['scout-3', 'Scout (3)', 'Counts as three Scouts. Other Scout rules apply as usual.', 'official v9, PDF p.6'],
  ['mortar-spotter', 'Mortar Spotter', 'Provides the spotter required to use off-table mortar batteries.', 'pp.69, 72'],
  ['mine-clearance', 'Mine Clearance', 'This vehicle is listed as a mine-clearing engineering asset.', 'p.97'],
  ['atgm', 'ATGM', 'Use the mounted missile profile for anti-tank guided missile fire, including its minimum range and listed ammunition.', 'pp.94–99'],
  ['no-indirect-fire', 'No Indirect Fire', 'An on-table 2S1 may use Suppressing Fire or Aimed Fire with its HE shells.', 'pp.72, 98'],
  ['kmt', 'KMT Mine Plough', 'The chosen tank carries the KMT mine plough upgrade.', 'pp.70–72'],
].map(([id, name, text, source]) => ({ id, name, text, source: 'NORTHAG ' + source }));
