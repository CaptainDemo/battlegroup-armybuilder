import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { b01Roster } from '@battlegroup/core/samples';
import { classicCatalogReleaseSchema } from '@battlegroup/classic-coldwar';
import { restoreRoster } from './restoreRoster';
import {
  summarize,
  type StoredRoster,
} from '../../adapters/storage/rosterStore';
import type { CatalogLoadResult } from '../../adapters/catalog/catalogLoader';

const release = classicCatalogReleaseSchema.parse(
  JSON.parse(
    readFileSync(
      'packages/catalogs/classic-coldwar/public/catalogs/classic-coldwar/soviet-armoured-division/1-0-0/catalog.json',
      'utf8',
    ),
  ),
);
function fixture(): StoredRoster {
  const document = b01Roster();
  document.catalogRef = release.catalog.manifest.identity;
  for (const selection of document.selections) {
    selection.entryReference = {
      ...document.catalogRef,
      localId: selection.entryReference.localId,
    };
    if (!selection.parentSelectionId) {
      selection.sectionId = release.catalog.entries.find(
        (entry) => entry.localId === selection.entryReference.localId,
      )!.sectionIds[0]!;
    }
  }
  document.settings.budgetPoints = 100;
  return {
    rosterId: document.rosterId,
    saveRevision: 9,
    document,
    summary: summarize(document),
    updatedAt: '2026-11-07',
    deleted: false,
  };
}

describe('restoring stored player choices', () => {
  it('loads the exact old catalog and permits a structurally valid over-budget draft', async () => {
    const stored = fixture();
    const result = await restoreRoster(stored, async (identity) => {
      expect(identity.catalogRevision).toBe('1.0.0');
      return { status: 'ready', release };
    });
    expect(result?.document).toEqual(stored.document);
    expect(
      result?.catalog.release.catalog.manifest.identity.catalogRevision,
    ).toBe('1.0.0');
  });

  it('leaves unsupported and malformed documents intact for recovery', async () => {
    const stored = fixture();
    const original = structuredClone(stored);
    const missing = async (): Promise<CatalogLoadResult> => ({
      status: 'unsupported-version',
      reason: 'Missing exact release',
    });
    expect(await restoreRoster(stored, missing)).toBeNull();
    expect(stored).toEqual(original);
    stored.document = { formatVersion: 'future', originalPayload: [1, 2] };
    expect(await restoreRoster(stored, missing)).toBeNull();
    expect(stored.document).toEqual({
      formatVersion: 'future',
      originalPayload: [1, 2],
    });
  });

  it('rejects identity and relationship corruption before opening an editor', async () => {
    const stored = fixture();
    stored.rosterId = 'wrong-row-id';
    const loader = async (): Promise<CatalogLoadResult> => ({
      status: 'ready',
      release,
    });
    expect(await restoreRoster(stored, loader)).toBeNull();
    const foreign = fixture();
    const document = foreign.document as ReturnType<typeof b01Roster>;
    document.selections[0]!.entryReference.catalogRevision = 'other';
    expect(await restoreRoster(foreign, loader)).toBeNull();
  });
});
