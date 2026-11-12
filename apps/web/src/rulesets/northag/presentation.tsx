import type { CatalogShell } from '@battlegroup/core';
import { northagRulesRevision, type NorthagCatalog } from '@battlegroup/northag';
import { unavailableReference, type RulesetPresentation } from '../presentationTypes';
import { collectEquipmentCards, EquipmentCards, type EquipmentCardsView } from './EquipmentCards';

const appendixFormat = 'northag/unit-data/2';

function details(catalog: CatalogShell): NorthagCatalog | undefined {
  return catalog.manifest.identity.rulesetId === 'northag' && catalog.manifest.rulesRevision === northagRulesRevision &&
    'ruleDefinitions' in catalog ? catalog as NorthagCatalog : undefined;
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
    const data = collectEquipmentCards(concrete, evaluation.composition.map(composition => composition.node));
    return {
      supported: true,
      vehicles: data.units.filter(unit => unit.profile.kind === 'vehicle').map(({ key, profile, quantity, kmt, weapons }) => ({
        key, profileLocalId: profile.localId, quantity, label: profile.name,
        weaponNames: [...new Set(weapons.map(({ mount, weapon }) => weapon?.name ?? mount.weaponId))],
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
      <EquipmentCards data={collectEquipmentCards(catalog, [node])} />
    </section>;
  },
  PrintAppendix({ reference }) {
    if (reference.appendix?.format !== appendixFormat) return null;
    return <section aria-label="Unit data appendix" className="print-data-appendix print-block" data-testid="print-data-appendix">
      <h2>Unit data appendix</h2>
      <EquipmentCards data={reference.appendix.data as EquipmentCardsView} />
    </section>;
  },
};
