import type { EvaluatedCompositionNode, SourceReference } from '@battlegroup/core';
import { northagRangeBands, type NorthagCatalog, type NorthagProfile } from '@battlegroup/northag';
import mgRangeReference from '../../../../../packages/catalogs/northag/reference/mounted-mg-ranges-v1.json';
import './equipmentCards.css';

type Mount = NorthagProfile['mounts'][number];
type FireMode = NonNullable<NorthagProfile['fireModes']>[number];

interface MountedWeapon {
  mount: Mount;
  weapon: NorthagProfile | undefined;
  range: number | undefined;
  smallArms: boolean;
}

export interface EquipmentCardView {
  key: string;
  profile: NorthagProfile;
  quantity: number;
  kmt: boolean;
  ruleNames: readonly string[];
  weapons: readonly MountedWeapon[];
  source: string;
}

export interface EquipmentCardsView {
  units: readonly EquipmentCardView[];
  context: string;
}

export function collectEquipmentCards(catalog: NorthagCatalog, nodes: readonly EvaluatedCompositionNode[]): EquipmentCardsView {
  const profiles = new Map(catalog.profiles.map(profile => [profile.localId, profile]));
  const rules = new Map(catalog.ruleDefinitions.map(rule => [rule.id, rule.name]));
  const units = new Map<string, EquipmentCardView>();
  const { identity, rulesRevision } = catalog.manifest;
  const useMgRange = identity.rulesetId === mgRangeReference.identity.rulesetId &&
    identity.catalogId === mgRangeReference.identity.catalogId &&
    identity.catalogRevision === mgRangeReference.identity.catalogRevision &&
    rulesRevision === mgRangeReference.rulesRevision;

  const visit = (node: EvaluatedCompositionNode, inherited: number) => {
    const quantity = inherited * node.quantity;
    if (quantity <= 0) return;
    const profile = node.profileLocalId ? profiles.get(node.profileLocalId) : undefined;
    if (profile) {
      const kmt = node.tags?.includes('kmt') ?? false;
      const key = JSON.stringify([profile.localId, kmt]);
      const existing = units.get(key);
      if (existing) {
        existing.quantity += quantity;
      } else {
        const sources = [...profile.sourceRefs];
        const weapons = profile.mounts.map(mount => {
          const weapon = profiles.get(mount.weaponId);
          if (weapon) sources.push(...weapon.sourceRefs);
          const smallArms = useMgRange && mount.weaponId === mgRangeReference.weaponId &&
            mgRangeReference.mounts.includes(mount.mount ?? '');
          if (smallArms) sources.push(mgRangeReference.sourceRef);
          return { mount, weapon, range: weapon?.range ?? (smallArms ? mgRangeReference.range : undefined), smallArms };
        });
        units.set(key, {
          key, profile, quantity, kmt, weapons,
          ruleNames: profile.rules.map(rule => rules.get(rule) ?? rule),
          source: formatSources(catalog, sources),
        });
      }
    }
    for (const child of node.children ?? []) visit(child, quantity);
  };
  for (const node of nodes) visit(node, 1);

  const nations = [...new Set(catalog.armyLists.map(army => army.nation))];
  return { units: [...units.values()], context: nations.length === 1 ? 'NORTHAG · ' + nations[0] : 'NORTHAG' };
}

function formatSources(catalog: NorthagCatalog, references: readonly SourceReference[]): string {
  const groups = new Map<string, Set<string>>();
  for (const reference of references) {
    const pages = groups.get(reference.documentId) ?? new Set<string>();
    if (reference.printedPage !== undefined) pages.add('p. ' + reference.printedPage);
    else if (reference.pdfPage !== undefined) pages.add('PDF p. ' + reference.pdfPage);
    groups.set(reference.documentId, pages);
  }

  return [...groups].map(([id, pages]) => {
    const name = id === 'book' ? 'NORTHAG 2020' : id === 'errata' ? 'Official Rules Errata v9'
      : catalog.manifest.sources.find(source => source.documentId === id)?.title ?? id;
    return pages.size ? name + ', ' + [...pages].join(', ') : name;
  }).join(' · ');
}

export function EquipmentCards({ data }: { data: EquipmentCardsView }) {
  if (!data.units.length) return <p className="muted">No equipment profiles are recorded for this composition.</p>;
  return <>{data.units.map(unit => <EquipmentCard key={unit.key} unit={unit} context={data.context} />)}</>;
}

function EquipmentCard({ unit, context }: { unit: EquipmentCardView; context: string }) {
  const { profile, quantity, kmt, ruleNames, weapons, source } = unit;
  const vehicle = profile.kind === 'vehicle' || profile.kind === 'aircraft';
  const showStats = vehicle || profile.movement || profile.armour || profile.capacity !== undefined || ruleNames.length > 0;
  return <article className="northag-equipment-card" data-profile-id={profile.localId}>
    <header className="northag-equipment-heading">
      <h4>{quantity} × {profile.name}{kmt && ' · KMT Mine Plough'}</h4>
      <small>{context}</small>
    </header>
    <div className="northag-equipment-body">
      {showStats && <dl className="northag-equipment-stats">
        {(vehicle || profile.movement) && <div><dt>Movement</dt><dd>{profile.movement ?? 'Unknown'}</dd></div>}
        {(vehicle || profile.armour) && <div><dt>Armour · Front / Side / Rear</dt><dd>{armourLabel(profile.armour)}</dd></div>}
        {profile.capacity !== undefined && <div><dt>Capacity</dt><dd>{profile.capacity} {profile.capacity === 1 ? 'stand' : 'stands'}</dd></div>}
        {ruleNames.length > 0 && <div><dt>Special rules</dt><dd>{ruleNames.join(' · ')}</dd></div>}
      </dl>}
      {weapons.length > 0 && <WeaponTable weapons={weapons} vehicle={vehicle} />}
      {profile.note && <p className="northag-equipment-note">{profile.note}</p>}
      {source && <p className="northag-equipment-note northag-equipment-source">{source}</p>}
    </div>
  </article>;
}

function armourLabel(armour: NorthagProfile['armour']): string {
  if (!armour) return 'Unknown';
  if (armour.kind === 'soft-skin') return 'Soft Skin';
  return [armour.front, armour.side, armour.rear].join(' / ');
}

function WeaponTable({ weapons, vehicle }: { weapons: readonly MountedWeapon[]; vehicle: boolean }) {
  const label = vehicle ? 'Mounted weapons' : 'Weapons';
  const notes = new Set<string>();
  for (const { mount, weapon } of weapons) {
    const name = weapon?.name ?? mount.weaponId;
    for (const mode of weapon?.fireModes ?? []) {
      if (mode.minRange !== undefined) notes.add(name + ' has no effect under ' + mode.minRange + '″.');
    }
    if (mount.doubleRoll) notes.add(name + ' may roll twice per attack.');
  }

  return <>
    <p className="northag-weapon-heading">{label}</p>
    <div className="northag-weapon-scroll" role="region" aria-label={label} tabIndex={0}>
      <table className="northag-weapon-table" aria-label={label}>
        <colgroup><col className="northag-weapon-name-col" /><col span={3} /></colgroup>
        <colgroup span={northagRangeBands.length} />
        <thead>
          <tr>
            <th scope="col" rowSpan={2} className="northag-weapon-name">{vehicle ? 'Weapon / mount' : 'Weapon'}</th>
            <th scope="col" rowSpan={2}>Ammo</th>
            <th scope="col" rowSpan={2}>RoF</th>
            <th scope="col" rowSpan={2}>HE</th>
            <th scope="colgroup" colSpan={northagRangeBands.length}>Range (inches)</th>
          </tr>
          <tr>{northagRangeBands.map(band => <th scope="col" key={band}>{band}</th>)}</tr>
        </thead>
        {weapons.map((weapon, index) => <WeaponRows key={index} item={weapon} />)}
      </table>
    </div>
    <p className="northag-equipment-note">{[...notes, 'A dash means not applicable.'].join(' ')}</p>
  </>;
}

function WeaponRows({ item }: { item: MountedWeapon }) {
  const { mount, weapon } = item;
  const modes: readonly (FireMode | undefined)[] = weapon?.fireModes?.length ? weapon.fireModes : [undefined];
  const mountDescription = [mount.mount, mount.ammunition === undefined ? undefined
    : 'Ammo: ' + mount.ammunition].filter(Boolean).join(' · ');

  return <tbody data-weapon-id={mount.weaponId}>{modes.map((mode, index) => <tr key={mode?.ammo ?? 'basic'}>
    {index === 0 && <th scope="rowgroup" rowSpan={modes.length} className="northag-weapon-name">
      {weapon?.name ?? mount.weaponId}
      {mountDescription && <small>{mountDescription}</small>}
    </th>}
    <td>{mode?.ammo ?? '—'}</td>
    <td>{mount.rate ?? '—'}</td>
    <td>{mode?.he ?? '—'}</td>
    <RangeCells mode={mode} item={item} />
  </tr>)}</tbody>;
}

function RangeCells({ mode, item }: { mode: FireMode | undefined; item: MountedWeapon }) {
  if (mode?.bands) return <>{mode.bands.map((value, index) => <td key={index} className="northag-range-value">{value ?? '—'}</td>)}</>;
  if (item.range !== undefined) return <td className="northag-range-note" colSpan={northagRangeBands.length}>
    {item.smallArms && 'Small arms · '}Max {item.range}″
  </td>;
  if (!mode) return <td className="northag-range-note" colSpan={northagRangeBands.length}>Range not recorded</td>;
  return <>{northagRangeBands.map(band => <td key={band}>—</td>)}</>;
}
