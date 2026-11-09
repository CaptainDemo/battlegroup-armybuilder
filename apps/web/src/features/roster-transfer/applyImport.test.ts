import { describe, expect, it } from 'vitest';
import { b01Roster } from '@battlegroup/core/samples';
import type { RosterDocument } from '@battlegroup/core';
import { SaveQueue } from '../../adapters/storage/saveQueue';
import {
  summarize,
  type ImportWrite,
  type RosterStore,
  type StoredRoster,
  type WriteResult,
} from '../../adapters/storage/rosterStore';
import { applyImportCopy, applyOverwrite } from './applyImport';
import type { ImportRecord } from './parseImportFile';

function rowOf(document: RosterDocument, saveRevision: number): StoredRoster {
  return {
    rosterId: document.rosterId,
    document: structuredClone(document),
    saveRevision,
    summary: summarize(document),
    updatedAt: '2026-11-09',
    deleted: false,
  };
}

/** In-memory store with the same compare-and-write rules as the Dexie adapter. */
function memoryStore(initial: StoredRoster[] = []) {
  const rows = new Map(initial.map((row) => [row.rosterId, structuredClone(row)]));
  const saves: { expected: number | null; document: RosterDocument }[] = [];
  const store: RosterStore = {
    list: async () =>
      [...rows.values()]
        .filter((row) => !row.deleted)
        .map((row) => structuredClone(row)),
    read: async (id) =>
      rows.has(id) ? structuredClone(rows.get(id)) : undefined,
    save: async (expected, document) => {
      saves.push({ expected, document: structuredClone(document) });
      const current = rows.get(document.rosterId);
      if (
        current &&
        !current.deleted &&
        JSON.stringify(current.document) === JSON.stringify(document)
      )
        return { status: 'saved', row: structuredClone(current) };
      if ((current?.saveRevision ?? null) !== expected)
        return { status: 'conflict', current: current && structuredClone(current) };
      const row = rowOf(document, (expected ?? 0) + 1);
      rows.set(document.rosterId, structuredClone(row));
      return { status: 'saved', row: structuredClone(row) };
    },
    remove: async (id, expected) => {
      const current = rows.get(id);
      if ((current?.saveRevision ?? null) !== expected)
        return { status: 'conflict', current: current && structuredClone(current) };
      const row: StoredRoster = {
        rosterId: id,
        saveRevision: (expected ?? 0) + 1,
        updatedAt: '2026-11-09',
        document: null,
        summary: null,
        deleted: true,
      };
      rows.set(id, structuredClone(row));
      return { status: 'saved', row: structuredClone(row) };
    },
    importBatch: async (writes: readonly ImportWrite[]) => {
      const written: StoredRoster[] = [];
      for (const write of writes) {
        if (rows.has(write.rosterId))
          throw new Error(`import batch target exists: ${write.rosterId}`);
        const row: StoredRoster = {
          rosterId: write.rosterId,
          saveRevision: 1,
          updatedAt: '2026-11-09',
          document: structuredClone(write.document),
          summary:
            write.kind === 'document' ? summarize(write.document) : null,
          deleted: false,
        };
        rows.set(write.rosterId, structuredClone(row));
        written.push(structuredClone(row));
      }
      return written;
    },
  };
  return { store, rows, saves };
}

function counter(start = 0) {
  let next = start;
  return () => {
    next += 1;
    return `id-${next}`;
  };
}

/**
 * Store whose save() results are resolved manually by the test, so queue
 * writes and the overwrite write genuinely interleave at controlled points
 * instead of completing immediately.
 */
function manualStore(initial: StoredRoster) {
  let current: StoredRoster | undefined = structuredClone(initial);
  interface Held {
    expected: number | null;
    document: RosterDocument;
    finish: () => void;
  }
  const held: Held[] = [];
  const store: RosterStore = {
    list: async () => (current && !current.deleted ? [structuredClone(current)] : []),
    read: async () => (current ? structuredClone(current) : undefined),
    save: (expected, document) =>
      new Promise<WriteResult>((resolve) => {
        held.push({
          expected,
          document,
          finish: () => {
            if (!current || current.deleted || expected !== current.saveRevision)
              resolve({ status: 'conflict', current: current && structuredClone(current) });
            else {
              current = { ...structuredClone(current), document: structuredClone(document), saveRevision: expected + 1, summary: summarize(document), updatedAt: '2026-11-09' };
              resolve({ status: 'saved', row: structuredClone(current) });
            }
          },
        });
      }),
    remove: async (id, expected) => {
      if (!current || expected !== current.saveRevision)
        return { status: 'conflict', current: current && structuredClone(current) };
      current = { rosterId: id, saveRevision: expected + 1, updatedAt: '2026-11-09', document: null, summary: null, deleted: true };
      return { status: 'saved', row: structuredClone(current) };
    },
    importBatch: async () => {
      throw new Error('not used here');
    },
  };
  return {
    store,
    held,
    row: (): StoredRoster => {
      if (!current) throw new Error('no row');
      return structuredClone(current);
    },
  };
}

/** Yields several microtask ticks so queue drains and settles progress. */
const flush = async (times = 12): Promise<void> => {
  for (let i = 0; i < times; i += 1) await Promise.resolve();
};

const readyRecord = (document: RosterDocument, release = { catalog: { manifest: { identity: document.catalogRef } } }): ImportRecord =>
  ({ status: 'ready', document, release }) as ImportRecord;

describe('default copy import', () => {
  it('imports with fresh ids and revisions, preserving all player choices', async () => {
    const { store } = memoryStore();
    const queue = new SaveQueue(store);
    const source = b01Roster();
    source.notes = 'keep me';
    const result = await applyImportCopy(store, queue, [readyRecord(source)], counter());
    expect(result.sessions).toHaveLength(1);
    const imported = result.sessions[0]!.document;
    expect(imported.rosterId).not.toBe(source.rosterId);
    expect(imported.revision).not.toBe(source.revision);
    expect(imported.selections).toEqual(source.selections);
    expect(imported.settings).toEqual(source.settings);
    expect(imported.notes).toBe('keep me');
    expect(imported.catalogRef).toEqual(source.catalogRef);
    // The queue knows the stored revision, so the autosave re-enqueue no-ops.
    expect(queue.snapshot()[imported.rosterId]).toMatchObject({
      phase: 'saved',
      saveRevision: 1,
      persistedEditRevision: imported.revision,
    });
    expect(result.originals).toEqual([]);
    expect(result.releases).toHaveLength(1);
  });

  it('writes originals verbatim alongside documents in one batch', async () => {
    const { store } = memoryStore();
    const queue = new SaveQueue(store);
    const original = { formatVersion: 'roster/9', rosterId: 'old', blob: [1] };
    const result = await applyImportCopy(
      store,
      queue,
      [
        readyRecord(b01Roster()),
        { status: 'original', document: original, reason: 'unknown-format', label: 'x' },
        { status: 'error', detail: 'skip me' },
      ],
      counter(),
    );
    expect(result.sessions).toHaveLength(1);
    expect(result.originals).toHaveLength(1);
    expect(result.originals[0]).toMatchObject({
      document: original,
      saveRevision: 1,
      deleted: false,
    });
    expect(queue.snapshot()[result.originals[0]!.rosterId]).toBeUndefined();
  });

  it('propagates batch failure without touching queue or sessions', async () => {
    const { store, rows } = memoryStore();
    const queue = new SaveQueue(store);
    rows.set('id-1', rowOf(b01Roster(), 1)); // collides with counter()'s first id
    await expect(
      applyImportCopy(store, queue, [readyRecord(b01Roster())], counter()),
    ).rejects.toThrow('import batch target exists');
    expect(queue.snapshot()).toEqual({});
  });
});

describe('explicit overwrite', () => {
  it('settles the queue first, then writes with the page-known acknowledged revision', async () => {
    const target = { ...b01Roster(), rosterId: 'target', revision: 'old' };
    const { store, saves } = memoryStore([rowOf(target, 5)]);
    const queue = new SaveQueue(store);
    queue.restore(target, 5);
    // A pending autosave for the stale draft must complete before overwrite.
    queue.enqueue({ ...target, revision: 'stale-draft', name: 'Stale' });
    await queue.settle('target');
    const result = await applyOverwrite(
      store,
      queue,
      { ...b01Roster(), name: 'Imported' },
      'target',
      'fresh-revision',
    );
    expect(result.status).toBe('saved');
    if (result.status !== 'saved') throw new Error('unreachable');
    expect(result.document.rosterId).toBe('target');
    expect(result.document.revision).toBe('fresh-revision');
    expect(result.document.name).toBe('Imported');
    expect(saves.at(-1)).toMatchObject({ expected: 6 });
    // The slot is re-anchored: a stale queued draft cannot write back.
    expect(queue.snapshot()['target']).toMatchObject({
      phase: 'saved',
      saveRevision: 7,
      editRevision: 'fresh-revision',
      persistedEditRevision: 'fresh-revision',
    });
    expect(queue.snapshot()['target']?.error).toBeNull();
  });

  it('conflicts when another tab committed after this page loaded, keeping both sides', async () => {
    const local = { ...b01Roster(), rosterId: 'target', revision: 'local-view', name: 'Local view' };
    let current: StoredRoster = rowOf(local, 1);
    const store: RosterStore = {
      list: async () => [structuredClone(current)],
      read: async () => structuredClone(current),
      save: async (expected, document) => {
        if (expected !== current.saveRevision)
          return { status: 'conflict', current: structuredClone(current) };
        current = rowOf(document, current.saveRevision + 1);
        return { status: 'saved', row: structuredClone(current) };
      },
      remove: async () => ({ status: 'conflict', current: structuredClone(current) }),
      importBatch: async () => [],
    };
    const queue = new SaveQueue(store);
    queue.restore(local, 1);
    // Another tab commits revision 2 after this page loaded revision 1.
    current = rowOf({ ...local, revision: 'remote', name: 'Other tab edits' }, 2);
    const result = await applyOverwrite(store, queue, { ...b01Roster(), name: 'Import source' }, 'target', 'import-revision');
    expect(result).toEqual({ status: 'conflict' });
    expect((current.document as RosterDocument).name).toBe('Other tab edits');
    // This page's memory draft survives untouched in its slot.
    expect(queue.snapshot()['target']).toMatchObject({
      phase: 'saved',
      saveRevision: 1,
      editRevision: 'local-view',
      persistedEditRevision: 'local-view',
    });
  });

  it('flushes a genuinely in-flight save and its coalesced successor before anchoring', async () => {
    const target = { ...b01Roster(), rosterId: 'target', revision: 'r0' };
    const manual = manualStore(rowOf(target, 1));
    const queue = new SaveQueue(manual.store);
    queue.restore(target, 1);
    // save #1 goes in flight and stays unresolved; a newer edit coalesces behind it.
    queue.enqueue({ ...target, revision: 'edit-a' });
    queue.enqueue({ ...target, revision: 'edit-b', name: 'Latest edit' });
    expect(manual.held).toHaveLength(1);
    const overwriting = applyOverwrite(manual.store, queue, { ...b01Roster(), name: 'Imported' }, 'target', 'fresh');
    // Release the in-flight autosave: the queue drains edit-b as save #2.
    manual.held[0]!.finish();
    await flush();
    expect(manual.held).toHaveLength(2);
    expect(manual.held[1]!.document.revision).toBe('edit-b');
    manual.held[1]!.finish();
    await flush();
    // Only now does the overwrite write, against the acknowledged revision 3.
    expect(manual.held).toHaveLength(3);
    expect(manual.held[2]!.expected).toBe(3);
    expect(manual.held[2]!.document.name).toBe('Imported');
    manual.held[2]!.finish();
    const result = await overwriting;
    expect(result).toMatchObject({ status: 'saved', saveRevision: 4 });
    expect((manual.row().document as RosterDocument).name).toBe('Imported');
    expect(queue.snapshot()['target']).toMatchObject({
      phase: 'saved',
      saveRevision: 4,
      editRevision: 'fresh',
    });
  });

  it('cannot write an edit back that raced the overwrite write itself', async () => {
    const target = { ...b01Roster(), rosterId: 'target', revision: 'r0' };
    const manual = manualStore(rowOf(target, 1));
    const queue = new SaveQueue(manual.store);
    queue.restore(target, 1);
    // The overwrite write is held in flight…
    const overwriting = applyOverwrite(manual.store, queue, { ...b01Roster(), name: 'Imported' }, 'target', 'fresh');
    await flush();
    expect(manual.held).toHaveLength(1);
    expect(manual.held[0]!.expected).toBe(1);
    // …and a new edit is enqueued while it is unresolved.
    queue.enqueue({ ...target, revision: 'raced-edit', name: 'Raced' });
    await flush();
    expect(manual.held).toHaveLength(2);
    expect(manual.held[1]!.document.revision).toBe('raced-edit');
    // The overwrite commits first; the racing save then conflicts and the
    // re-anchored slot keeps the imported content.
    manual.held[0]!.finish();
    const result = await overwriting;
    expect(result).toMatchObject({ status: 'saved', saveRevision: 2 });
    manual.held[1]!.finish();
    await queue.settle('target');
    expect((manual.row().document as RosterDocument).name).toBe('Imported');
    expect(queue.snapshot()['target']).toMatchObject({
      phase: 'saved',
      saveRevision: 2,
      editRevision: 'fresh',
      persistedEditRevision: 'fresh',
    });
  });

  it('overwrites on top of a failed queue write, clearing the error slot', async () => {
    const target = { ...b01Roster(), rosterId: 'target', revision: 'r0' };
    const manual = manualStore(rowOf(target, 3));
    let failures = 1; // one transient quota error, then writes recover
    const flaky: RosterStore = {
      ...manual.store,
      save: (expected, document) => {
        if (failures > 0) {
          failures -= 1;
          return Promise.reject(new Error('Quota exceeded'));
        }
        return manual.store.save(expected, document);
      },
    };
    const queue = new SaveQueue(flaky);
    queue.restore(target, 3);
    queue.enqueue({ ...target, revision: 'doomed' });
    await queue.settle('target');
    expect(queue.snapshot()['target']?.phase).toBe('error');
    expect(queue.snapshot()['target']?.saveRevision).toBe(3);
    // The overwrite still succeeds against the acknowledged revision 3 and
    // replaces the error slot with a clean, anchored one.
    const overwriting = applyOverwrite(flaky, queue, { ...b01Roster(), name: 'Imported' }, 'target', 'fresh');
    await flush();
    expect(manual.held).toHaveLength(1);
    expect(manual.held[0]!.expected).toBe(3);
    manual.held[0]!.finish();
    const result = await overwriting;
    expect(result).toMatchObject({ status: 'saved', saveRevision: 4 });
    expect(queue.snapshot()['target']).toMatchObject({
      phase: 'saved',
      saveRevision: 4,
      editRevision: 'fresh',
    });
    expect(queue.snapshot()['target']?.error).toBeNull();
  });

  it('refuses a target deleted in this tab and never resurrects a tombstone', async () => {
    const target = { ...b01Roster(), rosterId: 'target', revision: 'r0' };
    const manual = manualStore(rowOf(target, 2));
    const queue = new SaveQueue(manual.store);
    queue.restore(target, 2);
    expect(await queue.remove('target')).toBe(true);
    expect(queue.snapshot()['target']?.phase).toBe('deleted');
    const result = await applyOverwrite(manual.store, queue, b01Roster(), 'target', 'fresh');
    expect(result).toEqual({ status: 'missing' });
    expect(manual.held).toHaveLength(0);
    expect(manual.row().deleted).toBe(true);
  });

  it('keeps the stored roster and memory draft on conflict', async () => {
    const target = { ...b01Roster(), rosterId: 'target', revision: 'mine' };
    const base = memoryStore([rowOf(target, 5)]);
    const queue = new SaveQueue(base.store);
    queue.restore(target, 5);
    queue.enqueue({ ...target, revision: 'memory-draft' });
    await queue.settle('target');
    expect(queue.snapshot()['target']).toMatchObject({
      phase: 'saved',
      saveRevision: 6,
      editRevision: 'memory-draft',
    });
    // Another tab advances the row: our page-known token (6) no longer matches.
    const racing: RosterStore = {
      ...base.store,
      save: async (): Promise<WriteResult> => ({
        status: 'conflict',
        current: { ...rowOf({ ...target, revision: 'remote' }, 7), saveRevision: 7 },
      }),
    };
    const result = await applyOverwrite(
      racing,
      queue,
      b01Roster(),
      'target',
      'fresh',
    );
    expect(result).toEqual({ status: 'conflict' });
    // Nothing changed: the queue slot still tracks the memory draft.
    expect(queue.snapshot()['target']).toMatchObject({
      phase: 'saved',
      saveRevision: 6,
      editRevision: 'memory-draft',
      persistedEditRevision: 'memory-draft',
    });
    const stored = (await base.store.read('target')) as StoredRoster;
    expect((stored.document as RosterDocument).revision).toBe('memory-draft');
  });

  it('refuses missing or deleted targets without writing', async () => {
    const { store, saves } = memoryStore();
    const queue = new SaveQueue(store);
    expect(
      await applyOverwrite(store, queue, b01Roster(), 'ghost', 'r'),
    ).toEqual({ status: 'missing' });
    const deleted = rowOf({ ...b01Roster(), rosterId: 'gone' }, 3);
    deleted.deleted = true;
    deleted.document = null;
    const withTombstone = memoryStore([deleted]);
    expect(
      await applyOverwrite(withTombstone.store, queue, b01Roster(), 'gone', 'r'),
    ).toEqual({ status: 'missing' });
    expect(saves).toHaveLength(0);
    expect(withTombstone.saves).toHaveLength(0);
  });
});
