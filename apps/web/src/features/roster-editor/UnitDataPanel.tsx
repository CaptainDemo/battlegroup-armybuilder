import type { EvaluatedCompositionNode } from '@battlegroup/core';
import { findClassicCombatCard, type ClassicCatalogRelease, type ClassicCombatCard, type ClassicWeapon } from '@battlegroup/classic-coldwar';
import { t } from '../../i18n';
import { collectUnitReferenceData, combatReference, weaponReference } from './unitData';

export function UnitDataPanel({ node, release }: { node: EvaluatedCompositionNode; release: ClassicCatalogRelease }) {
  const data = collectUnitReferenceData(node, release.catalog.manifest.identity);
  const name = (id: string) => release.catalog.profiles.find(item => item.localId === id)?.name ?? id;
  return (
    <section className="unit-data" aria-label={t('unitData.title')}>
      <h4>{t('unitData.title')}</h4>
      <p className="muted">{t('unitData.referenceNote')}</p>
      {data.weapons.length > 0 && <>
        <h5>{t('unitData.carriedWeapons')}</h5>
        {data.weapons.map((group, index) => <details className="unit-data-card" key={group.key} open={index === 0}>
          <summary>{group.quantityMode === 'weapons' ? `${group.quantity} × ` : ''}{group.weapon.name}</summary>
          <div className="unit-data-body">
            {group.quantityMode === 'unit-equipment' && <p className="muted">{t('unitData.equipmentNote')}</p>}
            <WeaponDetails weapon={group.weapon} />
          </div>
        </details>)}
      </>}
      {data.vehicles.length > 0 && <h5>{t('unitData.vehicles')}</h5>}
      {data.vehicles.map((group, index) => {
        const card = findClassicCombatCard(combatReference, release.catalog.manifest.identity, group.profileLocalId);
        return <details className="unit-data-card" key={group.key} open={index === 0}>
          <summary>{group.quantity} × {name(group.profileLocalId)}{group.replacesCardAtgm ? ` · ${t('unitData.upgradedWeapons')}` : ''}</summary>
          {card ? <CombatCard card={card} replacesCardAtgm={group.replacesCardAtgm} /> : <p className="unit-data-body muted">{t('unitData.vehicleMissing')}</p>}
          {group.weaponIds.map(id => <div className="unit-data-body" key={id}>
            <h5>{weaponReference.weapons.find(weapon => weapon.id === id)!.name}</h5>
            <WeaponDetails weapon={weaponReference.weapons.find(weapon => weapon.id === id)!} />
          </div>)}
        </details>;
      })}
      {data.missingWeapons.length > 0 && (
        <div className="unit-data-missing">
          <p>{t('unitData.weaponMissing')}</p>
          <ul>{data.missingWeapons.map(profile => <li key={profile.profileLocalId}>{profile.quantity} × {name(profile.profileLocalId)}</li>)}</ul>
        </div>
      )}
      {data.unclassified.length > 0 && <p className="muted">{t('unitData.missing')} {data.unclassified.map(name).join(', ')}</p>}
      {data.weapons.length === 0 && data.missingWeapons.length === 0 && <p className="muted">{t('unitData.noCarriedWeapons')}</p>}
      {!data.supported && <p className="muted">{t('unitData.unsupported')}</p>}
    </section>
  );
}

export function CombatCard({ card, replacesCardAtgm, sourceNotesExpanded = false }: { card: ClassicCombatCard; replacesCardAtgm: boolean; sourceNotesExpanded?: boolean }) {
  const weapons = card.weapons.filter(weapon => !replacesCardAtgm || !weapon.name.endsWith(' ATGM'));
  return (
    <div className="unit-data-body">
      <dl className="unit-data-stats">
        <div><dt>{t('unitData.offRoad')}</dt><dd>{card.movement.offRoad}″</dd></div>
        <div><dt>{t('unitData.road')}</dt><dd>{card.movement.road}″</dd></div>
        <div><dt>{t('unitData.armour')}</dt><dd>{card.armour.front} / {card.armour.side} / {card.armour.rear} / {card.armour.top}</dd></div>
        <div><dt>{t('unitData.size')}</dt><dd>{card.size}</dd></div>
        <div><dt>NBC</dt><dd>{t(card.nbc ? 'unitData.yes' : 'unitData.no')}</dd></div>
        <div><dt>{t('unitData.amphibious')}</dt><dd>{t(card.amphibious ? 'unitData.yes' : 'unitData.no')}</dd></div>
        <div><dt>{t('unitData.night')}</dt><dd>{card.night.join(', ') || '—'}</dd></div>
        <div><dt>{t('unitData.mounts')}</dt><dd>{card.mounts.join(', ') || '—'}</dd></div>
      </dl>
      {card.specialRules.length > 0 && <p><strong>{t('unitData.specialRules')}</strong> {card.specialRules.join(' · ')}</p>}
      {replacesCardAtgm && <p className="muted">{t('unitData.replacedMissile')}</p>}
      {weapons.length > 0 ? (
        <div className="unit-data-table-scroll" role="region" aria-label={t('unitData.weapons')} tabIndex={0}>
          <table className="unit-data-weapons">
            <caption>{t('unitData.weapons')}</caption>
            <thead><tr>
              <th scope="col">{t('unitData.weapon')}</th><th scope="col">{t('unitData.ammunition')}</th><th scope="col">HE</th><th scope="col">Gen</th>
              {combatReference.rangeBands.map(band => <th scope="col" key={band}>{band}</th>)}
            </tr></thead>
            <tbody>{weapons.map((weapon, index) => <tr key={index}>
              <th scope="row">{weapon.name}</th><td>{weapon.ammunition}</td><td>{weapon.he ?? '—'}</td><td>{weapon.generation ?? '—'}</td>
              {weapon.rangeValues.map((value, range) => <td key={range}>{value ?? '—'}</td>)}
            </tr>)}</tbody>
          </table>
        </div>
      ) : <p className="muted">{t('unitData.noWeaponTable')}</p>}
      <p className="muted">{t('unitData.dashNote')}</p>
      {card.notes.length > 0 && (sourceNotesExpanded ? <div className="unit-data-source-notes">
        <strong>{t('unitData.sourceNotes')}</strong>
        {card.notes.map(note => <p className="muted" key={note}>{note}</p>)}
      </div> : <details>
        <summary>{t('unitData.sourceNotes')}</summary>
        {card.notes.map(note => <p className="muted" key={note}>{note}</p>)}
      </details>)}
      <p className="muted unit-data-source">{combatReference.source.title} · {combatReference.revision} · {t('unitData.sourceCard')} {card.name} · {t('unitData.page')} {card.page} · {card.position}</p>
    </div>
  );
}

export function WeaponDetails({ weapon }: { weapon: ClassicWeapon }) {
  const stats = [
    [t('unitData.rateOfFire'), weapon.rateOfFire],
    [t('unitData.range'), weapon.range],
    [t('unitData.crew'), weapon.crew],
    [t('unitData.heRating'), weapon.heRating],
    [t('unitData.heEffect'), weapon.heEffect],
    [t('unitData.penetration'), weapon.penetration],
    [t('unitData.generation'), weapon.generation],
    [t('unitData.backBlast'), weapon.backBlast === null ? null : t(weapon.backBlast ? 'unitData.yes' : 'unitData.no')],
    [t('unitData.tandem'), weapon.tandem === null ? null : t(weapon.tandem ? 'unitData.yes' : 'unitData.no')],
    [t('unitData.unreliable'), weapon.unreliable === null ? null : t(weapon.unreliable ? 'unitData.yes' : 'unitData.no')],
    [t('unitData.samType'), weapon.sam?.type ?? null],
    [t('unitData.attackModifier'), weapon.sam ? (weapon.sam.attackModifier > 0 ? '+' : '') + weapon.sam.attackModifier : null],
    [t('unitData.damage'), weapon.sam?.damage ?? null],
  ];
  return <>
    <dl className="unit-data-stats">
      {stats.filter(([, value]) => value !== null).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
    </dl>
    {weapon.rangeValues && <div className="unit-data-table-scroll" role="region" aria-label={weapon.name + ' ' + t('unitData.penetration')} tabIndex={0}>
      <table className="unit-data-weapons">
        <caption>{t('unitData.penetration')}</caption>
        <thead><tr>{weaponReference.rangeBands.map(band => <th scope="col" key={band}>{band}</th>)}</tr></thead>
        <tbody><tr>{weapon.rangeValues.map((value, index) => <td key={index}>{value ?? '—'}</td>)}</tr></tbody>
      </table>
      <p className="muted">{t('unitData.dashNote')}</p>
    </div>}
    {weapon.notes.map(note => <p className="muted" key={note}>{note}</p>)}
    <p className="muted unit-data-source">{weaponReference.source.title} · {weaponReference.revision} · {t('unitData.page')} {weapon.pages.join(', ')}</p>
  </>;
}
