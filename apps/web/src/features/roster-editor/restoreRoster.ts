import {
  rosterDocumentSchema,
  validateRosterCommandDocument,
  type RosterDocument,
} from '@battlegroup/core';
import {
  loadCatalog,
  type CatalogLoadResult,
} from '../../adapters/catalog/catalogLoader';
import type { StoredRoster } from '../../adapters/storage/rosterStore';

export async function restoreRoster(
  row: StoredRoster,
  loader = loadCatalog,
): Promise<{
  document: RosterDocument;
  catalog: Extract<CatalogLoadResult, { status: 'ready' }>;
} | null> {
  const parsed = rosterDocumentSchema.safeParse(row.document);
  if (
    !parsed.success ||
    parsed.data.rosterId !== row.rosterId ||
    !Number.isSafeInteger(row.saveRevision) ||
    row.saveRevision < 1 ||
    row.deleted
  )
    return null;
  const catalog = await loader(parsed.data.catalogRef);
  if (
    catalog.status !== 'ready' ||
    validateRosterCommandDocument(parsed.data, catalog.release).length
  )
    return null;
  return { document: parsed.data, catalog };
}
