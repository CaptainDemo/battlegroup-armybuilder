import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { classicCombatReferenceSchema, classicWeaponReferenceSchema, findClassicCombatCard, findClassicWeaponBinding } from '../../packages/rulesets/classic-coldwar/src/index';

const raw = JSON.parse(readFileSync('packages/catalogs/classic-coldwar/reference/soviet-afv-v1.json', 'utf8'));
const reference = classicCombatReferenceSchema.parse(raw);
const identity = { rulesetId: 'classic-coldwar', catalogId: 'soviet-armoured-division-v4_1', catalogRevision: '1.1.0' } as const;

it('binds every source card to explicitly declared profiles in exact catalog revisions', () => {
  expect(reference.cards).toHaveLength(51);
  const sources = JSON.parse(readFileSync('tests/fixtures/classic-coldwar/m01-sources.json', 'utf8'));
  expect(reference.source.sha256).toBe(sources.sources.find((source: {id:string}) => source.id === 'AFV').sha256);
  expect(reference.cards.every(card => card.page >= 1 && card.page <= 9)).toBe(true);
  for (const binding of reference.bindings) {
    const release = JSON.parse(readFileSync(`packages/catalogs/classic-coldwar/public/catalogs/classic-coldwar/soviet-armoured-division/${binding.catalogRevision.replaceAll('.', '-')}/catalog.json`, 'utf8'));
    expect(release.catalog.manifest.identity).toEqual({ ...identity, catalogId: binding.catalogId, catalogRevision: binding.catalogRevision });
    for (const [id, cardId] of Object.entries(binding.profiles)) {
      expect(release.catalog.profiles.some((profile: {localId:string}) => profile.localId === id), id).toBe(true);
      expect(findClassicCombatCard(reference, { ...identity, catalogRevision: binding.catalogRevision }, id)?.id).toBe(cardId);
    }
  }
  expect(findClassicCombatCard(reference, { ...identity, rulesetId: 'airland' }, 't-72a')).toBeUndefined();
  expect(findClassicCombatCard(reference, { ...identity, catalogRevision: '1.2.0' }, 't-72a')).toBeUndefined();
  expect(findClassicCombatCard(reference, { ...identity, catalogId: 'another-army' }, 't-72a')).toBeUndefined();
  expect(findClassicCombatCard(reference, identity, 't-72ak')).toBeUndefined();
  expect(findClassicCombatCard(reference, identity, 'T-72A')).toBeUndefined();
});

it('matches independently read armour, movement and range rows on PDF pages 1, 3, 5 and 6', () => {
  const tank = findClassicCombatCard(reference, identity, 't-72a')!;
  expect(tank.page).toBe(1);
  expect(tank.movement).toEqual({ offRoad: 12, road: 18 });
  expect(tank.armour).toEqual({ front: 17, side: 8, rear: 3, top: 2 });
  expect(tank.weapons[0]?.rangeValues).toEqual([23,23,23,22,21,20,19,null]);
  expect(findClassicCombatCard(reference, identity, 'bmp-2d')?.amphibious).toBe(false);
  expect(findClassicCombatCard(reference, identity, 'bmp-1p')?.weapons.at(-1)?.rangeValues).toEqual([null,null,19,19,19,19,null,null]);
  expect(findClassicCombatCard(reference, identity, 'btr-50pu')?.armour.front).toBe(0);
  expect(findClassicCombatCard(reference, identity, 'zsu-23-4')?.weapons[1]?.rangeValues).toEqual([1,2,2,2,2,2,null,null]);
});

it('does not silently equip optional missiles or guess related variants', () => {
  expect(findClassicCombatCard(reference, identity, 't-72b1')?.weapons.some(weapon => weapon.name.includes('Svir'))).toBe(false);
  expect(findClassicCombatCard(reference, identity, 't-72b-with-svir')).toBeUndefined();
  expect(findClassicCombatCard(reference, identity, 't-62mb')).toBeUndefined();
  expect(findClassicCombatCard(reference, identity, 't-62mb-with-bastion')?.weapons.at(-1)?.name).toBe('Bastion ATGM');
});

it('rejects incomplete weapon rows, duplicate card ids and dangling bindings', () => {
  const shortRow = structuredClone(raw);
  shortRow.cards[0].weapons[0].rangeValues.pop();
  expect(classicCombatReferenceSchema.safeParse(shortRow).success).toBe(false);
  const duplicate = structuredClone(raw);
  duplicate.cards.push(duplicate.cards[0]);
  expect(classicCombatReferenceSchema.safeParse(duplicate).success).toBe(false);
  const dangling = structuredClone(raw);
  dangling.bindings[0].profiles['t-72a'] = 'not-a-card';
  expect(classicCombatReferenceSchema.safeParse(dangling).success).toBe(false);
});

const rawWeapons = JSON.parse(readFileSync('packages/catalogs/classic-coldwar/reference/draft6-weapons-v1.json', 'utf8'));
const weaponReference = classicWeaponReferenceSchema.parse(rawWeapons);

it('classifies every profile once and binds Draft 6 weapons to the actual catalog identities', () => {
  const sources = JSON.parse(readFileSync('tests/fixtures/classic-coldwar/m01-sources.json', 'utf8'));
  expect(weaponReference.source.sha256).toBe(sources.sources.find((source: {id:string}) => source.id === 'CW').sha256);
  expect(weaponReference.weapons).toHaveLength(33);
  for (const binding of weaponReference.bindings) {
    const release = JSON.parse(readFileSync(`packages/catalogs/classic-coldwar/public/catalogs/classic-coldwar/soviet-armoured-division/${binding.catalogRevision.replaceAll('.', '-')}/catalog.json`, 'utf8'));
    expect(findClassicWeaponBinding(weaponReference, release.catalog.manifest.identity)).toEqual(binding);
    const ids = release.catalog.profiles.map((profile: {localId:string}) => profile.localId);
    const classified = [...binding.vehicleProfileIds, ...binding.nonCombatProfileIds, ...binding.unverifiedWeaponProfileIds, ...Object.keys(binding.profileWeapons)];
    expect(classified.sort()).toEqual(ids.sort());
    expect(new Set(classified).size).toBe(classified.length);
    for (const id of [...Object.keys(binding.vehicleWeapons), ...binding.tagWeapons.flatMap(link => link.profileIds)]) expect(ids).toContain(id);
  }
  expect(findClassicWeaponBinding(weaponReference, {...identity, rulesetId:'northag'})).toBeUndefined();
  expect(findClassicWeaponBinding(weaponReference, {...identity, catalogRevision:'9.9.9'})).toBeUndefined();
});

it('matches the independent small-arms, RPG, ATGM and SAM source tables', () => {
  const weapon = (id:string) => weaponReference.weapons.find(item => item.id === id)!;
  expect(weapon('rpk74').rateOfFire).toBe('3');
  expect(weapon('rpk74').crew).toBe('1');
  expect(weapon('rpg7v').rangeValues).toEqual([10,10,10,null,null,null,null,null]);
  expect(weapon('rpg7vs').heEffect).toBe('3/5+');
  expect(weapon('rpg22').rangeValues).toEqual([13,13,null,null,null,null,null,null]);
  expect(weapon('ags17')).toMatchObject({rateOfFire:'3',crew:'2',heRating:'Very Light × 2',heEffect:'4/4+',backBlast:false});
  expect(weapon('fagot').rangeValues).toEqual([null,null,null,19,19,19,null,null]);
  expect(weapon('konkurs').rangeValues).toEqual([null,null,20,20,20,20,20,20]);
  expect(weapon('sa7').sam).toEqual({type:'Basic',attackModifier:0,damage:'Light (D3)'});
  expect(weapon('sa14').sam).toEqual({type:'Intermediate',attackModifier:2,damage:'Standard (D6)'});
  expect(weapon('sa7').rangeValues).toBeUndefined();
  expect(weapon('heavy-mortar')).toMatchObject({range:'15–240″',heEffect:'6/4+',penetration:'3'});
  expect(weapon('vasilek').rateOfFire).toBeNull();
  expect(weapon('svd-marksman').range).toBe('30″');
});

it('rejects conflicting unit kinds and broken weapon links without altering vehicle-card facts', () => {
  const conflict = structuredClone(rawWeapons);
  conflict.bindings[0].vehicleProfileIds.push('rpk-74');
  expect(classicWeaponReferenceSchema.safeParse(conflict).success).toBe(false);
  const dangling = structuredClone(rawWeapons);
  dangling.bindings[0].profileWeapons['rpk-74'].weaponIds = ['unknown'];
  expect(classicWeaponReferenceSchema.safeParse(dangling).success).toBe(false);
  const fakeArmour = structuredClone(rawWeapons);
  fakeArmour.weapons[0].armour = 0;
  expect(classicWeaponReferenceSchema.safeParse(fakeArmour).success).toBe(false);
  const fakeSamPenetration = structuredClone(rawWeapons);
  fakeSamPenetration.weapons.find((weapon:{id:string}) => weapon.id === 'sa7').rangeValues = Array(8).fill(0);
  expect(classicWeaponReferenceSchema.safeParse(fakeSamPenetration).success).toBe(false);
  // The vehicle card starts Spigot at 10–20, whereas Draft 6 starts Fagot at 20–30.
  expect(findClassicCombatCard(reference, identity, 'bmp-1p')?.weapons.at(-1)?.rangeValues[2]).toBe(19);
  expect(weaponReference.weapons.find(item => item.id === 'fagot')?.rangeValues?.[2]).toBeNull();
});
