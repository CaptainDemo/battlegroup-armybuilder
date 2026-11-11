import type { ArmySection, CatalogIdentity } from '@battlegroup/core';
import { rulesets } from '../../rulesets/registry';

export function sectionLabel(catalog: CatalogIdentity, section: ArmySection): string {
  return rulesets.get(catalog.rulesetId)?.sectionLabel(catalog, section) ?? section.name;
}
