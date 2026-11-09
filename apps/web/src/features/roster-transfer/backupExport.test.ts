import { describe, expect, it } from 'vitest';
import { b01Roster } from '@battlegroup/core/samples';
import type { RosterDocument } from '@battlegroup/core';
import {
  libraryBackupFileSchema,
  LIBRARY_BACKUP_FILE_VERSION,
} from '@battlegroup/core';
import type {
  RosterStore,
  StoredRoster,
} from '../../adapters/storage/rosterStore';
import { buildLibraryBackup } from './backupExport';

function storeWith(rows: StoredRoster[]): RosterStore {
  return {
    list: async () =>
      structuredClone(rows.filter((row) => !row.deleted)),
    read: async (id) => structuredClone(rows.find((row) => row.rosterId === id)),
    save: async () => {
      throw new Error('not used');
    },
    remove: async () => {
      throw new Error('not used');
    },
    importBatch: async () => {
      throw new Error('not used');
    },
  };
}
function stored(
  document: RosterDocument | unknown,
  rosterId: string,
  saveRevision = 1,
  deleted = false,
): StoredRoster {
  return {
    rosterId,
    saveRevision,
    updatedAt: '2026-11-09',
    document: structuredClone(document),
    summary: null,
    deleted,
  };
}

describe('library backup export', () => {
  it('merges memory drafts over stored rows and includes memory-only rosters', async () => {
    const savedA = b01Roster();
    const savedB = { ...b01Roster(), rosterId: 'b', name: 'Stored B' };
    const store = storeWith([stored(savedA, 'a', 4), stored(savedB, 'b', 2)]);
    // 'a' has a newer unsaved memory draft; 'c' exists only in memory.
    const draftA = { ...structuredClone(savedA), revision: 'newer', name: 'Memory A' };
    const memoryOnly = { ...b01Roster(), rosterId: 'c', name: 'Never saved' };
    const drafts = new Map<string, RosterDocument>([
      ['a', draftA],
      ['c', memoryOnly],
    ]);
    const backup = await buildLibraryBackup(drafts, store);
    expect(libraryBackupFileSchema.safeParse(backup).success).toBe(true);
    expect(backup.formatVersion).toBe(LIBRARY_BACKUP_FILE_VERSION);
    expect(backup.rosters).toHaveLength(3);
    const entries = backup.rosters as { rosterId: string; document: unknown }[];
    const byId = new Map(entries.map((entry) => [entry.rosterId, entry]));
    expect((byId.get('a') as { document: RosterDocument }).document).toEqual(draftA);
    expect((byId.get('b') as { document: RosterDocument }).document).toEqual(savedB);
    expect((byId.get('c') as { document: RosterDocument }).document).toEqual(memoryOnly);
  });

  it('excludes tombstones and carries unsupported originals verbatim', async () => {
    const live = b01Roster();
    const original = { formatVersion: 'future', original: [1, 2] };
    const store = storeWith([
      stored(live, 'live'),
      stored(original, 'opaque', 3),
      stored(null, 'gone', 9, true),
    ]);
    const backup = await buildLibraryBackup(new Map(), store);
    const entries = backup.rosters as { rosterId: string; document: unknown }[];
    expect(entries.map((entry) => entry.rosterId).sort()).toEqual([
      'live',
      'opaque',
    ]);
    expect(entries.find((entry) => entry.rosterId === 'opaque')?.document).toEqual(
      original,
    );
  });
});
