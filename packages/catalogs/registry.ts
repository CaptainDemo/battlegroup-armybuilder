import classicIndex from './classic-coldwar/public/catalogs/index.json';
import northagIndex from './northag/public/catalogs/index.json';

/** Reviewed application asset sources. Adding a ruleset never publishes its working directory. */
export const catalogSources = [
  { rulesetId: 'classic-coldwar', publicDirectory: 'packages/catalogs/classic-coldwar/public', index: classicIndex },
  { rulesetId: 'northag', publicDirectory: 'packages/catalogs/northag/public', index: northagIndex },
] as const;
export const applicationCatalogIndex = { indexVersion: 1, releases: catalogSources.flatMap(source => source.index.releases) };
