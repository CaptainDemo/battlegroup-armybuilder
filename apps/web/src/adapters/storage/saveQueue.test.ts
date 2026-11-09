import { describe, expect, it } from 'vitest';
import { b01Roster } from '@battlegroup/core/samples';
import type { RosterDocument } from '@battlegroup/core';
import { SaveQueue } from './saveQueue';
import {
  summarize,
  type ImportWrite,
  type RosterStore,
  type StoredRoster,
  type WriteResult,
} from './rosterStore';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
function row(document: RosterDocument, saveRevision: number): StoredRoster {
  return {
    rosterId: document.rosterId,
    document,
    saveRevision,
    summary: summarize(document),
    updatedAt: '2026-11-07',
    deleted: false,
  };
}
function fixture() {
  const calls: {
    document: RosterDocument;
    expected: number | null;
    response: ReturnType<typeof deferred<WriteResult>>;
  }[] = [];
  const store: RosterStore = {
    list: async () => [],
    read: async () => undefined,
    save: (expected, document) => {
      const response = deferred<WriteResult>();
      calls.push({ expected, document, response });
      return response.promise;
    },
    remove: async (id, revision) => ({
      status: 'saved',
      row: {
        ...row(b01Roster(), (revision ?? 0) + 1),
        rosterId: id,
        deleted: true,
        document: null,
      },
    }),
    importBatch: async (writes: readonly ImportWrite[]) =>
      writes.map((write) => ({ ...row(write.document as RosterDocument, 1), rosterId: write.rosterId })),
  };
  return { calls, queue: new SaveQueue(store) };
}

describe('serialized draft saving', () => {
  it('coalesces pending edits and never acknowledges a newer edit with an older save', async () => {
    const { calls, queue } = fixture();
    const a = { ...b01Roster(), revision: 'a' };
    queue.enqueue(a);
    queue.enqueue({ ...a, revision: 'b' });
    queue.enqueue({ ...a, revision: 'c', name: 'Latest' });
    expect(calls).toHaveLength(1);
    calls[0]!.response.resolve({ status: 'saved', row: row(a, 1) });
    await Promise.resolve();
    expect(queue.snapshot()[a.rosterId]).toMatchObject({
      phase: 'saving',
      editRevision: 'c',
      persistedEditRevision: 'a',
    });
    expect(calls).toHaveLength(2);
    expect(calls[1]!.expected).toBe(1);
    expect(calls[1]!.document.name).toBe('Latest');
    calls[1]!.response.resolve({
      status: 'saved',
      row: row(calls[1]!.document, 2),
    });
    await queue.settle(a.rosterId);
    expect(queue.snapshot()[a.rosterId]).toMatchObject({
      phase: 'saved',
      persistedEditRevision: 'c',
    });
  });

  it('retains the latest draft across failure and retries using the last acknowledged storage revision', async () => {
    const { calls, queue } = fixture();
    const a = { ...b01Roster(), revision: 'a' };
    queue.restore(a, 4);
    queue.enqueue({ ...a, revision: 'b' });
    calls[0]!.response.reject(new Error('Quota exceeded'));
    await queue.settle(a.rosterId);
    queue.enqueue({ ...a, revision: 'c' });
    expect(queue.snapshot()[a.rosterId]?.phase).toBe('error');
    expect(calls).toHaveLength(1);
    queue.retry(a.rosterId);
    expect(calls[1]!.expected).toBe(4);
    expect(calls[1]!.document.revision).toBe('c');
    calls[1]!.response.resolve({
      status: 'saved',
      row: row(calls[1]!.document, 5),
    });
    await queue.settle(a.rosterId);
    expect(queue.snapshot()[a.rosterId]?.phase).toBe('saved');
  });

  it('blocks subsequent writes after conflict and resumes only after explicit reload', async () => {
    const { calls, queue } = fixture();
    const a = b01Roster();
    queue.restore(a, 1);
    queue.enqueue({ ...a, revision: 'local' });
    calls[0]!.response.resolve({ status: 'conflict', current: row(a, 2) });
    await queue.settle(a.rosterId);
    queue.enqueue({ ...a, revision: 'new-local' });
    queue.retry(a.rosterId);
    expect(calls).toHaveLength(1);
    expect(await queue.remove(a.rosterId)).toBe(false);
    queue.restore({ ...a, revision: 'remote' }, 2);
    queue.enqueue({ ...a, revision: 'after-reload' });
    expect(calls[1]!.expected).toBe(2);
    calls[1]!.response.resolve({
      status: 'saved',
      row: row(calls[1]!.document, 3),
    });
    await queue.settle(a.rosterId);
  });

  it('waits for an in-flight save before deletion and suppresses queued writes', async () => {
    const { calls, queue } = fixture();
    const a = b01Roster();
    queue.enqueue(a);
    queue.enqueue({ ...a, revision: 'pending' });
    const removed = queue.remove(a.rosterId);
    calls[0]!.response.resolve({ status: 'saved', row: row(a, 1) });
    expect(await removed).toBe(true);
    queue.enqueue({ ...a, revision: 'stale-effect' });
    expect(calls).toHaveLength(1);
    expect(queue.snapshot()[a.rosterId]?.phase).toBe('deleted');
  });
});
