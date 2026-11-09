import {
  SINGLE_ROSTER_FILE_VERSION,
  type LibraryBackupFile,
  type RosterDocument,
  type SingleRosterFile,
} from '@battlegroup/core';
import { downloadDraft } from '../roster-editor/downloadDraft';

/**
 * Exports always read the current in-memory draft, so a roster can be
 * exported even while unsaved or after a failed save. The envelope carries
 * the player's document verbatim — no derived totals, no storage revisions.
 */
export function singleRosterFile(
  document: RosterDocument,
  savedAt = new Date().toISOString(),
): SingleRosterFile {
  return {
    formatVersion: SINGLE_ROSTER_FILE_VERSION,
    kind: 'single-roster',
    savedAt,
    document: structuredClone(document),
  };
}

export function downloadSingleRoster(document: RosterDocument): void {
  downloadDraft(singleRosterFile(document), document.name || document.rosterId);
}

export function downloadLibraryBackup(file: LibraryBackupFile): void {
  downloadDraft(file, 'battlegroup-backup-' + file.savedAt.slice(0, 10));
}
