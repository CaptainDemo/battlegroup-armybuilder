import {
  LIBRARY_BACKUP_FILE_VERSION,
  type LibraryBackupFile,
  type RosterDocument,
} from '@battlegroup/core';
import type { RosterStore } from '../../adapters/storage/rosterStore';

/**
 * Builds a full-library backup envelope. Persisted records are merged with
 * the current in-memory drafts: for a roster open in this tab the memory
 * document wins, even when it has not been saved or a save failed. Tombstones
 * never export. Unsupported originals are carried verbatim so a restore can
 * re-import them as originals again.
 */
export async function buildLibraryBackup(
  drafts: ReadonlyMap<string, RosterDocument>,
  store: RosterStore,
): Promise<LibraryBackupFile> {
  const merged = new Map<string, unknown>();
  for (const row of await store.list()) merged.set(row.rosterId, row.document);
  for (const [rosterId, document] of drafts)
    merged.set(rosterId, structuredClone(document));
  return {
    formatVersion: LIBRARY_BACKUP_FILE_VERSION,
    kind: 'library-backup',
    savedAt: new Date().toISOString(),
    rosters: [...merged].map(([rosterId, document]) => ({
      rosterId,
      document,
    })),
  };
}
