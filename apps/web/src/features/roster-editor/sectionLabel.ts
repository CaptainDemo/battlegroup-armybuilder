import type { ArmySection, CatalogIdentity } from '@battlegroup/core';

export function sectionLabel(
  catalog: CatalogIdentity,
  section: ArmySection,
): string {
  // Soviet V4.1 p. 2 labels this category INFANTRY UNITS.
  // Correct the display of the pinned 1.0.0 and 1.1.0 catalogs.
  if (
    catalog.rulesetId === 'classic-coldwar' &&
    catalog.catalogId === 'soviet-armoured-division-v4_1' &&
    (catalog.catalogRevision === '1.0.0' ||
      catalog.catalogRevision === '1.1.0') &&
    section.sectionId === 'motor-rifle'
  ) {
    return 'Infantry';
  }
  return section.name;
}
