import type { ClassicWeapon } from '@battlegroup/classic-coldwar';
import { t } from '../../i18n';
import { CombatCard, WeaponDetails } from './UnitDataPanel';
import type { ClassicPrintReferenceView } from './printReference';

/** Include carried and vehicle-mounted systems once each, by stable weapon id. */
export function appendixWeapons(reference: ClassicPrintReferenceView): readonly ClassicWeapon[] {
  const weapons = new Map(reference.weapons.map(group => [group.weapon.id, group.weapon]));
  for (const vehicle of reference.vehicles)
    for (const weapon of vehicle.additionalWeapons) weapons.set(weapon.id, weapon);
  return [...weapons.values()];
}

export function ClassicPrintUnitDataAppendix({ reference }: { reference: ClassicPrintReferenceView }) {
  const weapons = appendixWeapons(reference);
  return (
    <section className="print-data-appendix print-block" aria-label={t('print.appendix.title')} data-testid="print-data-appendix">
      <h2>{t('print.appendix.title')}</h2>
      {!reference.supported && <p>{t('unitData.unsupported')}</p>}
      {reference.vehicles.length > 0 && <h3>{t('unitData.vehicles')}</h3>}
      {reference.vehicles.map(vehicle => (
        <article className="print-data-card" key={vehicle.key} data-profile-id={vehicle.profileLocalId} data-upgraded={vehicle.upgraded}>
          <h4>{vehicle.quantity} × {vehicle.label}{vehicle.upgraded ? ` · ${t('unitData.upgradedWeapons')}` : ''}</h4>
          {vehicle.card ? (
            <CombatCard card={vehicle.card} replacesCardAtgm={vehicle.upgraded} sourceNotesExpanded />
          ) : <p>{t('unitData.vehicleMissing')}</p>}
          {vehicle.weaponNames.length > 0 && <p className="print-data-weapon-links">{t('print.appendix.weaponLinks')} {vehicle.weaponNames.join(' · ')}</p>}
        </article>
      ))}
      {weapons.length > 0 && <h3>{t('print.appendix.weapons')}</h3>}
      {weapons.map(weapon => (
        <article className="print-data-card" key={weapon.id} data-weapon-id={weapon.id}>
          <h4>{weapon.name}</h4>
          <div className="unit-data-body"><WeaponDetails weapon={weapon} /></div>
        </article>
      ))}
      {reference.missingWeaponProfiles.length > 0 && <p className="print-gap">{t('unitData.weaponMissing')} {reference.missingWeaponProfiles.join('; ')}</p>}
      {reference.unclassifiedProfiles.length > 0 && <p className="print-gap">{t('unitData.missing')} {reference.unclassifiedProfiles.join(', ')}</p>}
      {reference.vehicles.length === 0 && weapons.length === 0 && <p>{t('print.appendix.noData')}</p>}
      <p className="muted print-reference-source">{reference.combatSource} · {reference.weaponSource}</p>
    </section>
  );
}
