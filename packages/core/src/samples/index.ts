/**
 * Synthetic contract-test fixtures (see each file's header). These are NOT
 * game data and never a publishable catalog: they exist so tests in this
 * package and in ruleset packages can prove isolation and expressiveness.
 * Exposed via the "./samples" subpath so the main package index stays a
 * clean product surface.
 */
export { makeIsolationCatalog, ISOLATION_SHARED_ENTRY_ID, ISOLATION_SHARED_PROFILE_ID } from './isolationCatalogs';
export { classicM01Catalog, CLASSIC_SAMPLE_CATALOG_ID, CLASSIC_SAMPLE_CATALOG_REVISION, CLASSIC_SAMPLE_ARMY_LIST_ID } from './classicM01Catalog';
export * from './classicM01Rosters';
