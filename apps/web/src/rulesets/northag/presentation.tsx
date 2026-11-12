import type { CatalogShell, EvaluatedCompositionNode } from '@battlegroup/core';
import { northagRangeBands, northagRulesRevision, type NorthagCatalog, type NorthagProfile } from '@battlegroup/northag';
import { unavailableReference, type RulesetPresentation } from '../presentationTypes';

interface ProfileGroup {
  key: string;
  profile: NorthagProfile;
  quantity: number;
  kmt: boolean;
}
interface Appendix {
  units: ProfileGroup[];
  weapons: NorthagProfile[];
}
const appendixFormat = 'northag/unit-data/1';

function details(catalog: CatalogShell): NorthagCatalog | undefined {
  return catalog.manifest.identity.rulesetId === 'northag' && catalog.manifest.rulesRevision === northagRulesRevision &&
    'ruleDefinitions' in catalog ? catalog as NorthagCatalog : undefined;
}

function collect(catalog: NorthagCatalog, nodes: readonly EvaluatedCompositionNode[]): Appendix {
  const profiles = new Map(catalog.profiles.map(profile => [profile.localId, profile]));
  const units = new Map<string, ProfileGroup>();
  const weapons = new Map<string, NorthagProfile>();
  const visit = (node: EvaluatedCompositionNode, inherited: number) => {
    const quantity = inherited * node.quantity;
    const profile = node.profileLocalId ? profiles.get(node.profileLocalId) : undefined;
    if (profile && quantity > 0) {
      const kmt = node.tags?.includes('kmt') ?? false;
      const key = JSON.stringify([profile.localId, kmt]);
      const existing = units.get(key);
      units.set(key, { key, profile, kmt, quantity: (existing?.quantity ?? 0) + quantity });
      for (const mount of profile.mounts) {
        const weapon = profiles.get(mount.weaponId);
        if (weapon) weapons.set(weapon.localId, weapon);
      }
    }
    for (const child of node.children ?? []) visit(child, quantity);
  };
  for (const node of nodes) visit(node, 1);
  return { units: [...units.values()], weapons: [...weapons.values()] };
}

function EquipmentCards({ data }: { data: Appendix }) {
  const weapons = new Map(data.weapons.map(weapon => [weapon.localId, weapon]));
  return <>
    {data.units.map(({ profile, quantity, key, kmt }) => <article className="unit-data-card unit-data-body" key={key} data-profile-id={profile.localId}>
      <h4>{quantity} × {profile.name}{kmt && ' · KMT Mine Plough'}</h4>
      {(profile.movement || profile.armour || profile.capacity !== undefined) && <dl className="unit-data-stats">
        {profile.movement && <div><dt>Movement</dt><dd>{profile.movement}</dd></div>}
        {profile.armour && <div><dt>Armour (Front / Side / Rear)</dt><dd>{profile.armour.kind === 'soft-skin'
          ? 'Soft Skin' : [profile.armour.front, profile.armour.side, profile.armour.rear].join(' / ')}</dd></div>}
        {profile.capacity !== undefined && <div><dt>Capacity</dt><dd>{profile.capacity}</dd></div>}
      </dl>}
      {profile.mounts.length > 0 && <ul>
        {profile.mounts.map((mount, index) => {
          const weapon = weapons.get(mount.weaponId);
          return <li key={index}>{weapon?.name ?? mount.weaponId}
            {mount.mount && ' · ' + mount.mount}
            {mount.rate && ' · RoF ' + mount.rate}
            {mount.ammunition !== undefined && ' · ' + mount.ammunition + ' rounds'}
            {weapon?.range !== undefined && ' · Max range ' + weapon.range + '″'}
            {mount.doubleRoll && ' · may roll twice per attack'}
          </li>;
        })}
      </ul>}
      {profile.note && <p className="muted">{profile.note}</p>}
    </article>)}
    {data.weapons.filter(weapon => weapon.fireModes?.length).map(weapon => <article key={weapon.localId} className="unit-data-card unit-data-body" data-weapon-id={weapon.localId}>
      <h4>{weapon.name}</h4>
      <div className="unit-data-table-scroll">
        <table className="unit-data-weapons">
          <thead><tr><th>Ammo</th><th>HE</th>{northagRangeBands.map(band => <th key={band}>{band}″</th>)}</tr></thead>
          <tbody>{weapon.fireModes!.map(mode => <tr key={mode.ammo}>
            <th>{mode.ammo}</th><td>{mode.he ?? '—'}</td>
            {northagRangeBands.map((band, index) => <td key={band}>{mode.bands?.[index] ?? '—'}</td>)}
          </tr>)}</tbody>
        </table>
      </div>
      {weapon.fireModes?.some(mode => mode.minRange !== undefined) && <small>Minimum range: {weapon.fireModes.find(mode => mode.minRange !== undefined)?.minRange}″</small>}
    </article>)}
    {!data.units.length && <p className="muted">No equipment profiles are recorded for this composition.</p>}
  </>;
}

export const northagPresentation: RulesetPresentation = {
  specialRules: {
    entryRules: entry => entry.specialRules ?? [],
    nodeRules: (node, catalog) => [
      ...(details(catalog)?.profiles.find(profile => profile.localId === node.profileLocalId)?.rules ?? []),
      ...(node.tags?.includes('kmt') ? ['kmt'] : []),
    ],
    definition: (id, catalog) => details(catalog)?.ruleDefinitions.find(rule => rule.id === id),
    label: id => id.replaceAll('-', ' '),
  },
  projectReference(catalog, evaluation) {
    const concrete = details(catalog);
    if (!concrete) return unavailableReference();
    const data = collect(concrete, evaluation.composition.map(composition => composition.node));
    const names = new Map(data.weapons.map(weapon => [weapon.localId, weapon.name]));
    return {
      supported: true,
      vehicles: data.units.filter(unit => unit.profile.kind === 'vehicle').map(({ key, profile, quantity, kmt }) => ({
        key, profileLocalId: profile.localId, quantity, label: profile.name,
        weaponNames: [...new Set(profile.mounts.map(mount => names.get(mount.weaponId) ?? mount.weaponId))],
        upgraded: kmt,
      })),
      weapons: [],
      missingWeaponProfiles: data.units.filter(unit => unit.profile.note?.includes('not verified')).map(unit => unit.profile.name),
      unclassifiedProfiles: [],
      combatSource: 'NORTHAG 2020 Russian Equipment Data',
      weaponSource: 'Official Rules Errata v9',
      appendix: { format: appendixFormat, data },
    };
  },
  UnitData({ node, release }) {
    const catalog = details(release.catalog);
    if (!catalog) return null;
    return <section aria-label="Unit data" className="unit-data-panel">
      <h4>Unit data</h4>
      <EquipmentCards data={collect(catalog, [node])} />
    </section>;
  },
  PrintAppendix({ reference }) {
    if (reference.appendix?.format !== appendixFormat) return null;
    return <section aria-label="Unit data appendix" className="print-data-appendix print-block" data-testid="print-data-appendix">
      <h2>Unit data appendix</h2>
      <EquipmentCards data={reference.appendix.data as Appendix} />
    </section>;
  },
};
