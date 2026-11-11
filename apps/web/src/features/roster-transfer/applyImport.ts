import type { RosterDocument } from '@battlegroup/core';
import type { AppCatalogRelease } from '../../rulesets/types';
import type {
  ImportWrite,
  RosterStore,
  StoredRoster,
} from '../../adapters/storage/rosterStore';
import type { SaveQueue } from '../../adapters/storage/saveQueue';
import { makeSession, type EditorSession } from '../roster-editor/session';
import type { ImportRecord } from './parseImportFile';

export interface ImportApplyResult {
  /** Ready documents imported as new copies, already tracked for autosave. */
  sessions: EditorSession[];
  /** Originals stored verbatim as recovery rows (not editable, re-exportable). */
  originals: StoredRoster[];
  /** Distinct catalog releases of the imported ready documents. */
  releases: AppCatalogRelease[];
}

function sameIdentity(
  a: { rulesetId: string; catalogId: string; catalogRevision: string },
  b: { rulesetId: string; catalogId: string; catalogRevision: string },
): boolean {
  return (
    a.rulesetId === b.rulesetId &&
    a.catalogId === b.catalogId &&
    a.catalogRevision === b.catalogRevision
  );
}

type ReadyRecord = Extract<ImportRecord, { status: 'ready' }>;

/**
 * Default import: every ready record becomes a new copy with a fresh roster
 * id and edit revision; player member/attachment ids, mount paths, option
 * targets, settings, notes and the exact catalog version are untouched. The
 * whole batch is written in one storage transaction — a failure throws and
 * the caller keeps its previous state untouched. On success each session is
 * registered with the queue at its stored revision, so the autosave effect's
 * re-enqueue is a no-op instead of a conflicting rewrite.
 */
export async function applyImportCopy(
  store: RosterStore,
  queue: SaveQueue,
  records: readonly ImportRecord[],
  freshId: () => string,
): Promise<ImportApplyResult> {
  const writes: ImportWrite[] = [];
  const ready: { record: ReadyRecord; document: RosterDocument }[] = [];
  for (const record of records) {
    if (record.status === 'ready') {
      // Copy contract: new roster identity, everything else verbatim.
      const document: RosterDocument = {
        ...structuredClone(record.document),
        rosterId: freshId(),
        revision: freshId(),
      };
      writes.push({ kind: 'document', rosterId: document.rosterId, document });
      ready.push({ record, document });
    } else if (record.status === 'original') {
      writes.push({
        kind: 'original',
        rosterId: freshId(),
        document: structuredClone(record.document),
      });
    }
  }
  const rows = await store.importBatch(writes);
  const byId = new Map(rows.map((row) => [row.rosterId, row]));
  const sessions: EditorSession[] = [];
  const releases: AppCatalogRelease[] = [];
  for (const { record, document } of ready) {
    queue.restore(document, byId.get(document.rosterId)!.saveRevision);
    sessions.push(makeSession(document));
    if (!releases.some((release) => sameIdentity(release.catalog.manifest.identity, record.release.catalog.manifest.identity)))
      releases.push(record.release);
  }
  const originals = rows.filter((row) =>
    writes.some(
      (write) => write.rosterId === row.rosterId && write.kind === 'original',
    ),
  );
  return { sessions, originals, releases };
}

export type OverwriteResult =
  | { status: 'saved'; document: RosterDocument; saveRevision: number }
  | { status: 'conflict' }
  | { status: 'missing' };

/**
 * Explicit overwrite of one existing roster by the user's chosen target.
 *
 * The expected revision is the one THIS page knows: after settling every
 * in-flight and coalesced queue write for the target, the slot's last
 * acknowledged saveRevision is used as the compare-and-write token. A fresh
 * store read is deliberately NOT taken — re-reading would silently adopt
 * whatever another tab committed since this page loaded, granting the
 * overwrite a revision the user never saw. With the page-known token, a
 * remote update between load and confirmation surfaces as a conflict and
 * both the remote row and this page's memory draft survive. A revision
 * carried by the import file grants nothing. A target that is not tracked
 * by this page's queue, or whose slot is mid-deletion or deleted, is
 * refused: a tombstone revision must never authorize resurrection.
 */
export async function applyOverwrite(
  store: RosterStore,
  queue: SaveQueue,
  source: RosterDocument,
  targetRosterId: string,
  newRevision: string,
): Promise<OverwriteResult> {
  await queue.settle(targetRosterId);
  const slot = queue.snapshot()[targetRosterId];
  if (!slot || slot.phase === 'deleting' || slot.phase === 'deleted')
    return { status: 'missing' };
  const document: RosterDocument = {
    ...structuredClone(source),
    rosterId: targetRosterId,
    revision: newRevision,
  };
  const result = await store.save(slot.saveRevision, document);
  if (result.status !== 'saved') return { status: 'conflict' };
  // Re-anchor the slot: a stale queued draft (including one enqueued while
  // our save was in flight) can never write the old content back over the
  // imported document — restore replaces the slot the old drain held.
  queue.restore(document, result.row.saveRevision);
  return {
    status: 'saved',
    document,
    saveRevision: result.row.saveRevision,
  };
}
